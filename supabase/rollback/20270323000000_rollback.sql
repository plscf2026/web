-- =============================================================================
-- Rollback: Pre-Launch Data Reset
-- File:     supabase/rollback/20270323000000_rollback.sql
-- Date:     2026-11-27
--
-- This rollback CANNOT restore deleted rows because the migration is
-- a data-deletion operation, not a schema change.
--
-- To recover from the pre-launch reset:
--   1. Go to Supabase Dashboard → Database → Backups.
--   2. Select the Point-in-Time Recovery (PITR) timestamp taken BEFORE you
--      ran 20270323000000_prelaunch_data_reset.sql.
--   3. Click "Restore" and confirm.
--
-- If you are on the Free plan (no PITR), restore from the CSV exports
-- you saved before running the reset migration.
--
-- This file exists as a placeholder to remind you of the recovery process.
-- =============================================================================

SELECT 'NOTICE: Data-reset rollback cannot be done in SQL. '
       'Restore from your Supabase PITR backup or CSV exports taken before '
       'running 20270323000000_prelaunch_data_reset.sql.' AS rollback_instructions;
