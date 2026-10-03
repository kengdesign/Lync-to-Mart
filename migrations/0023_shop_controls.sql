ALTER TABLE shops ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'active' CHECK(moderation_status IN ('active','suspended','banned','deleted'));
ALTER TABLE shops ADD COLUMN moderation_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN moderation_updated_at TEXT;
CREATE INDEX IF NOT EXISTS shops_moderation_status ON shops(moderation_status,created_at);
