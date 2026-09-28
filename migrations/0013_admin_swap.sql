CREATE TABLE admin_swaps (
 token_hash TEXT PRIMARY KEY,
 actor_session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 expires INTEGER NOT NULL
);
CREATE INDEX idx_admin_swaps_actor ON admin_swaps(actor_session_hash);
CREATE TABLE admin_audit (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL,
 target_id TEXT NOT NULL,
 shop_id TEXT NOT NULL,
 action TEXT NOT NULL,
 reason TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
