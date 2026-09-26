ALTER TABLE products ADD COLUMN import_provenance TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS import_receipts (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source_url TEXT NOT NULL,
 read_at TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_import_receipts_owner_expiry ON import_receipts(owner_id,expires_at);
