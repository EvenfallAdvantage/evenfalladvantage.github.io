SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('teams', 'team_members');
