import { randomToken } from './auth.js';
import type { Env, Session, Site, User } from './env.js';

const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function findUserByEmail(
  db: D1Database,
  email: string,
): Promise<(User & { password_hash: string }) | null> {
  return db
    .prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?')
    .bind(email.toLowerCase().trim())
    .first();
}

export async function createSession(db: D1Database, userId: string): Promise<Session> {
  const session: Session = {
    id: randomToken(),
    user_id: userId,
    csrf_token: randomToken(16),
    expires_at: new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString(),
  };
  await db
    .prepare('INSERT INTO sessions (id, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)')
    .bind(session.id, session.user_id, session.csrf_token, session.expires_at)
    .run();
  return session;
}

export async function getSessionUser(
  db: D1Database,
  sessionId: string,
): Promise<{ session: Session; user: User } | null> {
  const row = await db
    .prepare(
      `SELECT s.id, s.user_id, s.csrf_token, s.expires_at, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(sessionId, new Date().toISOString())
    .first<Session & { email: string; name: string; role: User['role'] }>();
  if (!row) return null;
  return {
    session: {
      id: row.id,
      user_id: row.user_id,
      csrf_token: row.csrf_token,
      expires_at: row.expires_at,
    },
    user: { id: row.user_id, email: row.email, name: row.name, role: row.role },
  };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function deleteAllSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}

export async function isLockedOut(db: D1Database, email: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT attempts, locked_until FROM login_attempts WHERE email = ?')
    .bind(email)
    .first<{ attempts: number; locked_until: string | null }>();
  return !!row?.locked_until && new Date(row.locked_until) > new Date();
}

export async function recordLoginFailure(db: D1Database, email: string): Promise<void> {
  const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
  await db
    .prepare(
      `INSERT INTO login_attempts (email, attempts) VALUES (?, 1)
       ON CONFLICT(email) DO UPDATE SET
         attempts = attempts + 1,
         locked_until = CASE WHEN attempts + 1 >= ? THEN ? ELSE locked_until END`,
    )
    .bind(email, MAX_ATTEMPTS, lockedUntil)
    .run();
}

export async function clearLoginFailures(db: D1Database, email: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE email = ?').bind(email).run();
}

export async function sitesForUser(db: D1Database, user: User): Promise<Site[]> {
  if (user.role === 'owner') {
    const { results } = await db
      .prepare(
        'SELECT id, name, prefix, base_url, zone_id, theme_accent, logo_url FROM sites ORDER BY name',
      )
      .all<Site>();
    return results;
  }
  const { results } = await db
    .prepare(
      `SELECT s.id, s.name, s.prefix, s.base_url, s.zone_id, s.theme_accent, s.logo_url FROM sites s
       JOIN site_grants g ON g.site_id = s.id WHERE g.user_id = ? ORDER BY s.name`,
    )
    .bind(user.id)
    .all<Site>();
  return results;
}

export async function getSiteForUser(
  db: D1Database,
  user: User,
  siteId: string,
): Promise<Site | null> {
  const sites = await sitesForUser(db, user);
  return sites.find((s) => s.id === siteId) ?? null;
}

export interface AuditRow {
  action: string;
  target: string;
  created_at: string;
  email: string;
}

export async function listAudit(db: D1Database, siteId: string, limit = 100): Promise<AuditRow[]> {
  const { results } = await db
    .prepare(
      `SELECT a.action, a.target, a.created_at, COALESCE(u.email, a.user_id) AS email
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.site_id = ? ORDER BY a.id DESC LIMIT ?`,
    )
    .bind(siteId, limit)
    .all<AuditRow>();
  return results;
}

// --- login tokens (magic link / password reset) ---

const TOKEN_MINUTES = 30;

export async function createLoginToken(
  db: D1Database,
  userId: string,
  purpose: 'magic' | 'reset',
): Promise<string> {
  const id = randomToken();
  const expiresAt = new Date(Date.now() + TOKEN_MINUTES * 60_000).toISOString();
  await db
    .prepare('INSERT INTO login_tokens (id, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, purpose, expiresAt)
    .run();
  return id;
}

export async function consumeLoginToken(
  db: D1Database,
  id: string,
  purpose: 'magic' | 'reset',
): Promise<string | null> {
  const row = await db
    .prepare('SELECT user_id FROM login_tokens WHERE id = ? AND purpose = ? AND expires_at > ?')
    .bind(id, purpose, new Date().toISOString())
    .first<{ user_id: string }>();
  if (!row) return null;
  await db.prepare('DELETE FROM login_tokens WHERE id = ?').bind(id).run();
  return row.user_id;
}

export async function peekLoginToken(
  db: D1Database,
  id: string,
  purpose: 'magic' | 'reset',
): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM login_tokens WHERE id = ? AND purpose = ? AND expires_at > ?')
    .bind(id, purpose, new Date().toISOString())
    .first();
  return !!row;
}

export async function setPassword(db: D1Database, userId: string, hash: string): Promise<void> {
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, userId).run();
}

// --- user / site administration (dashboard owners only) ---

export interface UserRow extends User {
  grants: { site_id: string; role: string }[];
}

export async function listUsers(db: D1Database): Promise<UserRow[]> {
  const { results: users } = await db
    .prepare('SELECT id, email, name, role FROM users ORDER BY email')
    .all<User>();
  const { results: grants } = await db
    .prepare('SELECT user_id, site_id, role FROM site_grants')
    .all<{ user_id: string; site_id: string; role: string }>();
  return users.map((u) => ({
    ...u,
    grants: grants
      .filter((g) => g.user_id === u.id)
      .map((g) => ({ site_id: g.site_id, role: g.role })),
  }));
}

export async function createUser(
  db: D1Database,
  user: { email: string; name: string; role: User['role']; passwordHash: string },
): Promise<User> {
  const id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
    .bind(id, user.email.toLowerCase().trim(), user.passwordHash, user.name, user.role)
    .run();
  return { id, email: user.email, name: user.name, role: user.role };
}

export async function setGrant(
  db: D1Database,
  userId: string,
  siteId: string,
  role: 'admin' | 'editor',
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO site_grants (user_id, site_id, role) VALUES (?, ?, ?)
       ON CONFLICT(user_id, site_id) DO UPDATE SET role = excluded.role`,
    )
    .bind(userId, siteId, role)
    .run();
}

export async function removeGrant(db: D1Database, userId: string, siteId: string): Promise<void> {
  await db
    .prepare('DELETE FROM site_grants WHERE user_id = ? AND site_id = ?')
    .bind(userId, siteId)
    .run();
}

export async function createSite(db: D1Database, site: Omit<Site, 'id'>): Promise<Site> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO sites (id, name, prefix, base_url, zone_id, theme_accent, logo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, site.name, site.prefix, site.base_url, site.zone_id, site.theme_accent, site.logo_url)
    .run();
  return { id, ...site };
}

export async function updateSite(db: D1Database, site: Site): Promise<void> {
  await db
    .prepare(
      `UPDATE sites SET name = ?, base_url = ?, zone_id = ?, theme_accent = ?, logo_url = ?
       WHERE id = ?`,
    )
    .bind(site.name, site.base_url, site.zone_id, site.theme_accent, site.logo_url, site.id)
    .run();
}

// --- scheduled publishing ---

export interface ScheduledPublish {
  id: string;
  site_id: string;
  type_key: string;
  slug: string;
  publish_at: string;
  created_by: string;
}

export async function schedulePublish(
  db: D1Database,
  row: Omit<ScheduledPublish, 'id'>,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO scheduled_publishes (id, site_id, type_key, slug, publish_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), row.site_id, row.type_key, row.slug, row.publish_at, row.created_by)
    .run();
}

export async function duePublishes(db: D1Database): Promise<ScheduledPublish[]> {
  const { results } = await db
    .prepare(
      'SELECT id, site_id, type_key, slug, publish_at, created_by FROM scheduled_publishes WHERE publish_at <= ?',
    )
    .bind(new Date().toISOString())
    .all<ScheduledPublish>();
  return results;
}

export async function listScheduled(db: D1Database, siteId: string): Promise<ScheduledPublish[]> {
  const { results } = await db
    .prepare(
      'SELECT id, site_id, type_key, slug, publish_at, created_by FROM scheduled_publishes WHERE site_id = ? ORDER BY publish_at',
    )
    .bind(siteId)
    .all<ScheduledPublish>();
  return results;
}

export async function deleteScheduled(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM scheduled_publishes WHERE id = ?').bind(id).run();
}

export async function listSites(db: D1Database): Promise<Site[]> {
  const { results } = await db
    .prepare(
      'SELECT id, name, prefix, base_url, zone_id, theme_accent, logo_url FROM sites ORDER BY name',
    )
    .all<Site>();
  return results;
}

export async function getSiteById(db: D1Database, siteId: string): Promise<Site | null> {
  return db
    .prepare(
      'SELECT id, name, prefix, base_url, zone_id, theme_accent, logo_url FROM sites WHERE id = ?',
    )
    .bind(siteId)
    .first<Site>();
}

export async function audit(
  env: Env,
  userId: string,
  siteId: string,
  action: string,
  target: string,
): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO audit_log (user_id, site_id, action, target) VALUES (?, ?, ?, ?)',
  )
    .bind(userId, siteId, action, target)
    .run();
}
