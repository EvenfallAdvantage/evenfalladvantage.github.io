-- Add hide_contact_roster column to company_memberships
-- Allows members to opt out of showing email/phone on the company-wide roster
ALTER TABLE company_memberships
  ADD COLUMN IF NOT EXISTS hide_contact_roster boolean DEFAULT false;
