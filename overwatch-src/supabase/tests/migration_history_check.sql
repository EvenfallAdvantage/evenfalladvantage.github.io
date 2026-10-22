-- Read-only: recorded OverwatchDB migrations. Compare with `ls overwatch-src/supabase/migrations/*.sql`.
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
