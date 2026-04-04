-- Add dietary_restrictions column to company_memberships
-- The profile page UI already has the field but the column was never created
ALTER TABLE company_memberships ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}';
