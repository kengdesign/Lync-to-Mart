CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,password_snapshot TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets(user_id);
