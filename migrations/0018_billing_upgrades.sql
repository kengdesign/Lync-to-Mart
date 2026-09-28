-- Durable, auditable one-time upgrade payments. One unresolved operation per account.
CREATE TABLE IF NOT EXISTS billing_upgrades (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 subscription_id TEXT NOT NULL, item_id TEXT NOT NULL,
 from_plan TEXT NOT NULL, to_plan TEXT NOT NULL, target_price TEXT NOT NULL,
 amount INTEGER NOT NULL, period_end INTEGER NOT NULL,
 cancel_at_period_end INTEGER NOT NULL,
 session_id TEXT UNIQUE, session_params TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_upgrade_pending
 ON billing_upgrades(user_id) WHERE status IN ('pending','review');
