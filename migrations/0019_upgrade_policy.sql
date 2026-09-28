ALTER TABLE billing_upgrades ADD COLUMN period TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE billing_upgrades ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'difference';
ALTER TABLE billing_upgrades ADD COLUMN period_start INTEGER NOT NULL DEFAULT 0;
ALTER TABLE billing_upgrades ADD COLUMN discount_deadline INTEGER NOT NULL DEFAULT 0;
ALTER TABLE billing_upgrades ADD COLUMN applied_start INTEGER;
ALTER TABLE billing_upgrades ADD COLUMN applied_end INTEGER;
