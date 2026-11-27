-- =============================================================================
-- Rollback: Super Admin Supabase Usage Telemetry & Plan Limits Monitor
-- File:     supabase/rollback/20270324000000_rollback.sql
-- Date:     2026-11-27
-- Undoes:   supabase/migrations/20270324000000_supabase_usage_telemetry_rpc.sql
-- =============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.rpc_get_supabase_usage_telemetry() FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.rpc_get_supabase_usage_telemetry();

REVOKE ALL ON FUNCTION public.rpc_update_supabase_monitor_config(JSONB, TEXT) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.rpc_update_supabase_monitor_config(JSONB, TEXT);

DELETE FROM public.system_settings
WHERE key = 'supabase_plan_monitor';

DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY['pending_orders', 'ipn_logs', 'donations', 'current_student_ids'];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY v_tables
    LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
