CREATE TABLE IF NOT EXISTS shop_domains (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
 shop_id TEXT NOT NULL UNIQUE REFERENCES shops(id), hostname TEXT NOT NULL UNIQUE,
 verification_token TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending_dns' CHECK(status IN ('pending_dns','verified')),
 created_at INTEGER NOT NULL, checked_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS shop_domains_owner ON shop_domains(owner_id);
