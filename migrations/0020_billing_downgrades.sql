CREATE TABLE IF NOT EXISTS billing_downgrades (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 subscription_id TEXT NOT NULL, schedule_id TEXT UNIQUE,
 from_plan TEXT NOT NULL, to_plan TEXT NOT NULL, period TEXT NOT NULL,
 from_price TEXT NOT NULL, target_price TEXT NOT NULL,
 effective_at INTEGER NOT NULL, trial_end INTEGER,
 params TEXT, status TEXT NOT NULL DEFAULT 'creating',
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_downgrade_pending ON billing_downgrades(user_id)
 WHERE status IN ('creating','scheduled','releasing','review');
