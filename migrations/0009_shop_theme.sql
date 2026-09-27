ALTER TABLE shops ADD COLUMN theme TEXT NOT NULL DEFAULT 'classic' CHECK(theme IN ('classic','midnight','ocean','sand'));
