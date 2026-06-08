SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'company_memberships' AND table_schema = 'public';
