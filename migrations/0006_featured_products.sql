ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN(0,1));
CREATE INDEX idx_products_shop_featured ON products(shop_id,status,featured DESC,created_at DESC,id DESC);
