-- Replace the palette constraint while retaining every shop's existing selection.
ALTER TABLE shops RENAME COLUMN theme TO theme_previous;
ALTER TABLE shops ADD COLUMN theme TEXT NOT NULL DEFAULT 'classic' CHECK(theme IN ('classic','midnight','ocean','sand','pop','neo','peach','graphite'));
UPDATE shops SET theme=theme_previous;
ALTER TABLE shops DROP COLUMN theme_previous;
