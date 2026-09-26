CREATE TABLE IF NOT EXISTS product_trash (
 id TEXT PRIMARY KEY,
 shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
 deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_trash_shop ON product_trash(shop_id,deleted_at DESC);
