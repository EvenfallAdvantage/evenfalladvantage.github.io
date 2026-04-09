-- Add location_sharing preference to company_memberships
-- Defaults to TRUE (opted-in) so new users automatically share location when on shift

ALTER TABLE company_memberships
  ADD COLUMN IF NOT EXISTS location_sharing BOOLEAN DEFAULT true;

COMMENT ON COLUMN company_memberships.location_sharing IS
  'Whether this user shares their GPS location while clocked in. Defaults to true (opted-in).';
