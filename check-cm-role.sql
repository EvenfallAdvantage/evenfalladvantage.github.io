SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'company_memberships' AND column_name = 'role';
