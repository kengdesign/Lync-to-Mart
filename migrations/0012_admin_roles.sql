CREATE TABLE IF NOT EXISTS admin_roles (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','support'))
);
