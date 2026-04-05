-- Add accent_color column to companies for dual brand theming
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#d59b3c';
