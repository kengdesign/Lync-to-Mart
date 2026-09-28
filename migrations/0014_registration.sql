CREATE TABLE IF NOT EXISTS registration_tokens (
 token_hash TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_registration_email ON registration_tokens(email);
CREATE INDEX IF NOT EXISTS idx_registration_expiry ON registration_tokens(expires);
CREATE TABLE IF NOT EXISTS user_verifications (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 email_verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
