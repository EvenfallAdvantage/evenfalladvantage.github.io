-- Add audio fields to module_slides table
-- This allows slides to have audio narration with autoplay option

ALTER TABLE module_slides
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_autoplay BOOLEAN DEFAULT false;

-- Add comment to explain the fields
COMMENT ON COLUMN module_slides.audio_url IS 'URL to audio narration file for the slide';
COMMENT ON COLUMN module_slides.audio_autoplay IS 'Whether audio should auto-play once when slide loads';
