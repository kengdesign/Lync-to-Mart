CREATE TABLE IF NOT EXISTS member_controls (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','invited','suspended','banned','deleted')),
 override_plan TEXT REFERENCES plans(id),
 override_expires INTEGER,
 invited_by TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_member_status ON member_controls(status);
