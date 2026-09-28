CREATE TABLE IF NOT EXISTS billing_accounts (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 customer_id TEXT UNIQUE, subscription_id TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'none', plan_id TEXT NOT NULL DEFAULT 'free',
 period TEXT, paid_until INTEGER NOT NULL DEFAULT 0, cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
 checkout_id TEXT, attempt_id TEXT, attempt_plan TEXT, attempt_period TEXT,
 attempt_created INTEGER, lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS billing_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, processed_at INTEGER NOT NULL);
