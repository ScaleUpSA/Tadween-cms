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
      .prepare('SELECT id, name, prefix, base_url, zone_id FROM sites ORDER BY name')
      .all<Site>();
    return results;
  }
  const { results } = await db
    .prepare(
      `SELECT s.id, s.name, s.prefix, s.base_url, s.zone_id FROM sites s
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
