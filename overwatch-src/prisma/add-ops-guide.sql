-- Add ops_guide JSONB column to events table for comprehensive operation details
-- Run this in your Supabase SQL Editor

ALTER TABLE events ADD COLUMN IF NOT EXISTS ops_guide jsonb DEFAULT NULL;

COMMENT ON COLUMN events.ops_guide IS 'Comprehensive operation guide data: client info, scope, dress code, emergency contacts, special instructions, etc.';
