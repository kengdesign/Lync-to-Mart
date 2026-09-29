CREATE TABLE IF NOT EXISTS billing_cards (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 subscription_id TEXT NOT NULL,
 session_id TEXT UNIQUE,
 session_params TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_card_pending ON billing_cards(user_id) WHERE status IN ('pending','review');
CREATE INDEX IF NOT EXISTS billing_cards_history ON billing_cards(user_id,created_at DESC);
