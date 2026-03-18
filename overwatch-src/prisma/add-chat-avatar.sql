-- Add avatar_url column to chat_channels
ALTER TABLE chat_channels
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
