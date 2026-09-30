CREATE TABLE IF NOT EXISTS shop_team (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 email TEXT NOT NULL, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('pending','active','revoked')),
 grants_json TEXT NOT NULL DEFAULT '{}', token_hash TEXT UNIQUE, expires INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()), UNIQUE(owner_id,email)
);
CREATE INDEX IF NOT EXISTS idx_team_user ON shop_team(user_id,status);
CREATE INDEX IF NOT EXISTS idx_team_owner ON shop_team(owner_id,status,created_at,id);
CREATE TABLE IF NOT EXISTS team_media (
 key TEXT PRIMARY KEY REFERENCES media(key) ON DELETE CASCADE,
 shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_team_media_shop ON team_media(shop_id);
CREATE TABLE IF NOT EXISTS team_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_team_audit_owner ON team_audit(owner_id,id);
