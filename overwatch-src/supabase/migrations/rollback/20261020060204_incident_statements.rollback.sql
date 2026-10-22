-- Rollback for 20261020060204_incident_statements. Drops all statements.
DROP TABLE IF EXISTS public.incident_statements;
DROP FUNCTION IF EXISTS public.incident_statements_guard();
