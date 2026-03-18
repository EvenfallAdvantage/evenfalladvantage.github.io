-- Add dietary_restrictions column to company_memberships
ALTER TABLE company_memberships
ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}';
