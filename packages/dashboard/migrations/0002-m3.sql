-- M3 migration for installations created before theming, roles,
-- magic-link login, and scheduled publishing were added.
-- Fresh installs only need schema.sql.

ALTER TABLE sites ADD COLUMN theme_accent TEXT NOT NULL DEFAULT '';
ALTER TABLE sites ADD COLUMN logo_url TEXT NOT NULL DEFAULT '';

ALTER TABLE site_grants ADD COLUMN role TEXT NOT NULL DEFAULT 'editor';

CREATE TABLE IF NOT EXISTS login_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('magic', 'reset')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS scheduled_publishes (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type_key TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  publish_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
