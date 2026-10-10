-- Public destinations verified against the native product ID from ThaiMart HTML.
-- Keep merchant products, affiliate URLs, provenance and analytics IDs unchanged.
CREATE TABLE IF NOT EXISTS product_destinations (
 identity TEXT PRIMARY KEY,
 destination_url TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO product_destinations(identity,destination_url) VALUES
('https://thaimart.com/products/6a6044ba38080803c9a108ea','https://thaimart.com/products/%E0%B9%81%E0%B8%AD%E0%B8%A5-%E0%B8%8B%E0%B8%B5-%E0%B8%A7%E0%B8%B4%E0%B8%95-%E0%B8%88%E0%B8%B9%E0%B9%80%E0%B8%99%E0%B8%B5%E0%B8%A2%E0%B8%A3%E0%B9%8C-%E0%B9%80%E0%B8%A1%E0%B9%87%E0%B8%94%E0%B9%80%E0%B8%84%E0%B8%B5%E0%B9%89%E0%B8%A2%E0%B8%A7-%E0%B8%81%E0%B8%A5%E0%B8%B4%E0%B9%88%E0%B8%99%E0%B8%A1%E0%B8%B4%E0%B8%81%E0%B8%8B%E0%B9%8C%E0%B9%80%E0%B8%9A%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B8%A3%E0%B8%B5%E0%B9%88-%E0%B8%95%E0%B8%A3%E0%B8%B2%E0%B8%81%E0%B8%B4%E0%B8%9F%E0%B8%9F%E0%B8%B2%E0%B8%A3%E0%B8%B5%E0%B8%99-0803c9a108ea');
