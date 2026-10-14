CREATE TABLE IF NOT EXISTS stock_status_cache (
 product_id TEXT PRIMARY KEY,
 sold_out INTEGER,
 valid_until INTEGER NOT NULL DEFAULT 0,
 next_check INTEGER NOT NULL DEFAULT 0
);
