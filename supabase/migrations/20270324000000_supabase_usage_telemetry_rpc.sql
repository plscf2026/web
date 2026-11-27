-- ============================================================================
-- MIGRATION: 20270324000000_supabase_usage_telemetry_rpc.sql
-- PURPOSE:
--   1. Enable Supabase Realtime on activity tables (donations, pending_orders,
--      ipn_logs, registrations_2027, system_settings) so the Super Admin
--      Backend & Supabase Limits Monitor updates immediately in real time.
--   2. Seed default monitor configuration row ('supabase_plan_monitor') inside
--      public.system_settings (readable/writable strictly by super_admin).
--   3. Create SECURITY DEFINER RPC public.rpc_get_supabase_usage_telemetry()
--      strictly gated to active super_admin (or service_role) to report live
--      database bytes, top table breakdown, storage buckets & objects bytes,
--      auth user / MAU counts, active PostgreSQL connections, recent activity
--      volume, and inactivity auto-pause countdown.
--   4. Create SECURITY DEFINER RPC public.rpc_update_supabase_monitor_config()
--      strictly gated to active super_admin to persist plan selection ('free'
--      vs 'pro'), alert thresholds, and auto-refresh cadence.
-- ============================================================================

BEGIN;

-- 1. Idempotently add core tables to supabase_realtime publication
DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'system_settings',
    'registrations_2027',
    'donations',
    'pending_orders',
    'ipn_logs',
    'current_student_ids'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY v_tables
    LOOP
      IF to_regclass('public.' || v_table) IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = v_table
        ) THEN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
        END IF;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 2. Seed default supabase_plan_monitor config inside public.system_settings
--    (Preserves any existing owner customization via ON CONFLICT DO NOTHING)
INSERT INTO public.system_settings (key, value, description, updated_by, updated_at)
VALUES (
  'supabase_plan_monitor',
  jsonb_build_object(
    'activePlan', 'free',
    'warningThresholdPercent', 70,
    'criticalThresholdPercent', 85,
    'autoRefreshSeconds', 30,
    'updatedAt', NOW(),
    'updatedBy', 'Migration 20270324000000'
  ),
  'Super Admin Supabase Plan & Red Alert Threshold Monitor Preferences',
  'Migration 20270324000000',
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 3. Super Admin Live Telemetry RPC
DROP FUNCTION IF EXISTS public.rpc_get_supabase_usage_telemetry();

CREATE OR REPLACE FUNCTION public.rpc_get_supabase_usage_telemetry()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, pg_catalog
AS $$
DECLARE
  v_admin                         RECORD;
  v_monitor_config                JSONB;
  v_db_size_bytes                 BIGINT := 0;
  v_table_count                   INTEGER := 0;
  v_top_tables                    JSONB := '[]'::jsonb;
  v_storage_total_bytes           BIGINT := 0;
  v_storage_total_files           BIGINT := 0;
  v_storage_largest_file_bytes    BIGINT := 0;
  v_storage_buckets               JSONB := '[]'::jsonb;
  v_auth_total_users              BIGINT := 0;
  v_auth_mau_30d                  BIGINT := 0;
  v_auth_active_24h               BIGINT := 0;
  v_admin_count                   BIGINT := 0;
  v_active_admin_count            BIGINT := 0;
  v_staff_count                   BIGINT := 0;
  v_active_staff_count            BIGINT := 0;
  v_db_total_connections          INTEGER := 0;
  v_db_active_queries             INTEGER := 0;
  v_db_idle_connections           INTEGER := 0;
  v_db_max_connections            INTEGER := 60;
  v_reg_total                     BIGINT := 0;
  v_reg_24h                       BIGINT := 0;
  v_reg_last                      TIMESTAMPTZ := NULL;
  v_don_total                     BIGINT := 0;
  v_don_24h                       BIGINT := 0;
  v_don_last                      TIMESTAMPTZ := NULL;
  v_pending_total                 BIGINT := 0;
  v_pending_24h                   BIGINT := 0;
  v_pending_last                  TIMESTAMPTZ := NULL;
  v_ipn_total                     BIGINT := 0;
  v_ipn_24h                       BIGINT := 0;
  v_ipn_30d                       BIGINT := 0;
  v_ipn_last                      TIMESTAMPTZ := NULL;
  v_student_ids_total             BIGINT := 0;
  v_audit_total                   BIGINT := 0;
  v_audit_30d                     BIGINT := 0;
  v_settings_last                 TIMESTAMPTZ := NULL;
  v_last_activity_at              TIMESTAMPTZ := NULL;
  v_idle_days                     NUMERIC := 0;
BEGIN
  -- Strict Server-Verified Super Admin Authorization Gate
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required: Super Admin login required.'
        USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_admin
    FROM public.admin_accounts
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    IF NOT FOUND
       OR v_admin.is_locked IS TRUE
       OR (v_admin.status IS NOT NULL AND upper(v_admin.status) <> 'ACTIVE')
       OR lower(trim(COALESCE(v_admin.role, ''))) <> 'super_admin' THEN
      RAISE EXCEPTION 'Permission denied: only an active Super Admin can access backend telemetry.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Saved Monitor Preferences
  SELECT value INTO v_monitor_config
  FROM public.system_settings
  WHERE key = 'supabase_plan_monitor'
  LIMIT 1;

  IF v_monitor_config IS NULL OR jsonb_typeof(v_monitor_config) <> 'object' THEN
    v_monitor_config := jsonb_build_object(
      'activePlan', 'free',
      'warningThresholdPercent', 70,
      'criticalThresholdPercent', 85,
      'autoRefreshSeconds', 30
    );
  END IF;

  -- Database size & public schema table sizes
  BEGIN
    v_db_size_bytes := pg_database_size(current_database());

    SELECT COUNT(*)::integer
    INTO v_table_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p');

    SELECT COALESCE(jsonb_agg(t ORDER BY t.total_bytes DESC), '[]'::jsonb)
    INTO v_top_tables
    FROM (
      SELECT
        c.relname AS table_name,
        pg_total_relation_size(c.oid)::bigint AS total_bytes,
        pg_relation_size(c.oid)::bigint AS heap_bytes,
        pg_indexes_size(c.oid)::bigint AS index_bytes,
        GREATEST(COALESCE(s.n_live_tup, 0), 0)::bigint AS estimated_rows
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 10
    ) t;
  EXCEPTION WHEN OTHERS THEN
    v_db_size_bytes := COALESCE(v_db_size_bytes, 0);
  END;

  -- Supabase Storage metrics (buckets + objects)
  BEGIN
    IF to_regclass('storage.objects') IS NOT NULL THEN
      SELECT
        COALESCE(SUM(COALESCE((o.metadata->>'size')::bigint, 0)), 0)::bigint,
        COUNT(o.id)::bigint,
        COALESCE(MAX(COALESCE((o.metadata->>'size')::bigint, 0)), 0)::bigint
      INTO v_storage_total_bytes, v_storage_total_files, v_storage_largest_file_bytes
      FROM storage.objects o;
    END IF;

    IF to_regclass('storage.buckets') IS NOT NULL THEN
      SELECT COALESCE(jsonb_agg(b_row ORDER BY b_row.total_bytes DESC), '[]'::jsonb)
      INTO v_storage_buckets
      FROM (
        SELECT
          b.id AS bucket_id,
          b.name AS bucket_name,
          COALESCE(b.public, false) AS is_public,
          b.file_size_limit AS file_size_limit_bytes,
          COUNT(o.id)::bigint AS file_count,
          COALESCE(SUM(COALESCE((o.metadata->>'size')::bigint, 0)), 0)::bigint AS total_bytes,
          COALESCE(MAX(COALESCE((o.metadata->>'size')::bigint, 0)), 0)::bigint AS max_file_bytes
        FROM storage.buckets b
        LEFT JOIN storage.objects o ON o.bucket_id = b.id
        GROUP BY b.id, b.name, b.public, b.file_size_limit
      ) b_row;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_storage_total_bytes := COALESCE(v_storage_total_bytes, 0);
  END;

  -- Supabase Auth users & portal staff/admin counts
  BEGIN
    IF to_regclass('auth.users') IS NOT NULL THEN
      SELECT
        COUNT(*)::bigint,
        COUNT(*) FILTER (WHERE COALESCE(last_sign_in_at, created_at) >= NOW() - INTERVAL '30 days')::bigint,
        COUNT(*) FILTER (WHERE last_sign_in_at >= NOW() - INTERVAL '24 hours')::bigint
      INTO v_auth_total_users, v_auth_mau_30d, v_auth_active_24h
      FROM auth.users;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_auth_total_users := 0;
    v_auth_mau_30d := 0;
    v_auth_active_24h := 0;
  END;

  IF to_regclass('public.admin_accounts') IS NOT NULL THEN
    SELECT
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE (status IS NULL OR upper(status) = 'ACTIVE') AND is_locked IS NOT TRUE)::bigint
    INTO v_admin_count, v_active_admin_count
    FROM public.admin_accounts;
  END IF;

  IF to_regclass('public.staff_accounts') IS NOT NULL THEN
    SELECT
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE status IS NULL OR upper(status) = 'ACTIVE')::bigint
    INTO v_staff_count, v_active_staff_count
    FROM public.staff_accounts;
  END IF;

  -- Active PostgreSQL connections
  BEGIN
    SELECT
      COUNT(*)::integer,
      COUNT(*) FILTER (WHERE state = 'active')::integer,
      COUNT(*) FILTER (WHERE state LIKE 'idle%')::integer
    INTO v_db_total_connections, v_db_active_queries, v_db_idle_connections
    FROM pg_stat_activity
    WHERE datname = current_database();

    v_db_max_connections := COALESCE(NULLIF(current_setting('max_connections', true), '')::integer, 60);
  EXCEPTION WHEN OTHERS THEN
    v_db_total_connections := 1;
  END;

  -- Live Application Table Counters & Activity Recency
  IF to_regclass('public.registrations_2027') IS NOT NULL THEN
    SELECT
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE registered_at >= NOW() - INTERVAL '24 hours')::bigint,
      MAX(registered_at)
    INTO v_reg_total, v_reg_24h, v_reg_last
    FROM public.registrations_2027;
  END IF;

  IF to_regclass('public.donations') IS NOT NULL THEN
    SELECT
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::bigint,
      MAX(created_at)
    INTO v_don_total, v_don_24h, v_don_last
    FROM public.donations;
  END IF;

  IF to_regclass('public.pending_orders') IS NOT NULL THEN
    SELECT
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::bigint,
      MAX(created_at)
    INTO v_pending_total, v_pending_24h, v_pending_last
    FROM public.pending_orders;
  END IF;

  IF to_regclass('public.ipn_logs') IS NOT NULL THEN
    SELECT
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::bigint,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::bigint,
      MAX(created_at)
    INTO v_ipn_total, v_ipn_24h, v_ipn_30d, v_ipn_last
    FROM public.ipn_logs;
  END IF;

  IF to_regclass('public.current_student_ids') IS NOT NULL THEN
    SELECT COUNT(*)::bigint INTO v_student_ids_total FROM public.current_student_ids;
  END IF;

  IF to_regclass('public.admin_audit_history') IS NOT NULL THEN
    SELECT
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE "timestamp" >= NOW() - INTERVAL '30 days')::bigint
    INTO v_audit_total, v_audit_30d
    FROM public.admin_audit_history;
  END IF;

  IF to_regclass('public.system_settings') IS NOT NULL THEN
    SELECT MAX(updated_at) INTO v_settings_last FROM public.system_settings;
  END IF;

  -- Compute last write activity across business tables (excluding monitor poll writes)
  v_last_activity_at := NULLIF(
    GREATEST(
      COALESCE(v_reg_last, '-infinity'::timestamptz),
      COALESCE(v_don_last, '-infinity'::timestamptz),
      COALESCE(v_pending_last, '-infinity'::timestamptz),
      COALESCE(v_ipn_last, '-infinity'::timestamptz),
      COALESCE(v_settings_last, '-infinity'::timestamptz)
    ),
    '-infinity'::timestamptz
  );

  IF v_last_activity_at IS NOT NULL THEN
    v_idle_days := GREATEST(0, ROUND((EXTRACT(EPOCH FROM (NOW() - v_last_activity_at)) / 86400.0)::numeric, 2));
  ELSE
    v_idle_days := 0;
  END IF;

  RETURN jsonb_build_object(
    'capturedAt', NOW(),
    'databaseName', current_database(),
    'postgresVersion', split_part(current_setting('server_version'), ' ', 1),
    'monitorConfig', v_monitor_config,
    'database', jsonb_build_object(
      'sizeBytes', v_db_size_bytes,
      'maxFreeBytes', 524288000,
      'maxProBytes', 8589934592,
      'tableCount', v_table_count,
      'topTables', v_top_tables
    ),
    'storage', jsonb_build_object(
      'totalBytes', v_storage_total_bytes,
      'fileCount', v_storage_total_files,
      'largestFileBytes', v_storage_largest_file_bytes,
      'maxFreeBytes', 1073741824,
      'maxProBytes', 107374182400,
      'maxFreeUploadBytes', 52428800,
      'maxProUploadBytes', 53687091200,
      'buckets', v_storage_buckets
    ),
    'auth', jsonb_build_object(
      'totalUsers', v_auth_total_users,
      'mau30d', v_auth_mau_30d,
      'active24h', v_auth_active_24h,
      'adminAccountsCount', v_admin_count,
      'activeAdminAccountsCount', v_active_admin_count,
      'staffAccountsCount', v_staff_count,
      'activeStaffAccountsCount', v_active_staff_count
    ),
    'connections', jsonb_build_object(
      'totalConnections', v_db_total_connections,
      'activeQueries', v_db_active_queries,
      'idleConnections', v_db_idle_connections,
      'maxConnections', v_db_max_connections
    ),
    'activity', jsonb_build_object(
      'registrationsTotal', v_reg_total,
      'registrations24h', v_reg_24h,
      'donationsTotal', v_don_total,
      'donations24h', v_don_24h,
      'pendingOrdersTotal', v_pending_total,
      'pendingOrders24h', v_pending_24h,
      'ipnLogsTotal', v_ipn_total,
      'ipnLogs24h', v_ipn_24h,
      'ipnLogs30d', v_ipn_30d,
      'currentStudentIdsTotal', v_student_ids_total,
      'auditLogsTotal', v_audit_total,
      'auditLogs30d', v_audit_30d,
      'lastActivityAt', v_last_activity_at,
      'idleDays', v_idle_days
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_supabase_usage_telemetry() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_supabase_usage_telemetry() TO authenticated, service_role;

-- 4. Super Admin Monitor Preference Persistence RPC
DROP FUNCTION IF EXISTS public.rpc_update_supabase_monitor_config(JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_update_supabase_monitor_config(
  p_config JSONB,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin            RECORD;
  v_current          JSONB;
  v_next             JSONB;
  v_plan             TEXT;
  v_warn             INTEGER;
  v_crit             INTEGER;
  v_refresh          INTEGER;
  v_actor_name       TEXT;
BEGIN
  v_actor_name := COALESCE(NULLIF(trim(COALESCE(p_actor_name, '')), ''), 'Super Administrator');

  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required: Super Admin login required.'
        USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_admin
    FROM public.admin_accounts
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    IF NOT FOUND
       OR v_admin.is_locked IS TRUE
       OR (v_admin.status IS NOT NULL AND upper(v_admin.status) <> 'ACTIVE')
       OR lower(trim(COALESCE(v_admin.role, ''))) <> 'super_admin' THEN
      RAISE EXCEPTION 'Permission denied: only an active Super Admin may update backend monitor settings.'
        USING ERRCODE = '42501';
    END IF;

    v_actor_name := COALESCE(NULLIF(trim(COALESCE(p_actor_name, '')), ''), v_admin.full_name, v_admin.username, 'Super Administrator');
  END IF;

  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Monitor config payload must be a JSON object.'
      USING ERRCODE = '22023';
  END IF;

  SELECT value INTO v_current
  FROM public.system_settings
  WHERE key = 'supabase_plan_monitor'
  FOR UPDATE;

  v_current := COALESCE(
    v_current,
    jsonb_build_object(
      'activePlan', 'free',
      'warningThresholdPercent', 70,
      'criticalThresholdPercent', 85,
      'autoRefreshSeconds', 30
    )
  );

  v_plan := lower(trim(COALESCE(p_config->>'activePlan', v_current->>'activePlan', 'free')));
  IF v_plan NOT IN ('free', 'pro') THEN
    RAISE EXCEPTION 'activePlan must be free or pro.' USING ERRCODE = '22023';
  END IF;

  v_warn := COALESCE(ROUND(NULLIF(p_config->>'warningThresholdPercent', '')::numeric)::integer, ROUND(COALESCE((v_current->>'warningThresholdPercent')::numeric, 70))::integer);
  v_crit := COALESCE(ROUND(NULLIF(p_config->>'criticalThresholdPercent', '')::numeric)::integer, ROUND(COALESCE((v_current->>'criticalThresholdPercent')::numeric, 85))::integer);
  v_refresh := COALESCE(ROUND(NULLIF(p_config->>'autoRefreshSeconds', '')::numeric)::integer, ROUND(COALESCE((v_current->>'autoRefreshSeconds')::numeric, 30))::integer);

  IF v_warn < 50 OR v_warn > 90 THEN
    RAISE EXCEPTION 'warningThresholdPercent must be between 50 and 90.' USING ERRCODE = '22023';
  END IF;

  IF v_crit <= v_warn OR v_crit > 99 THEN
    RAISE EXCEPTION 'criticalThresholdPercent must be greater than warningThresholdPercent and <= 99.' USING ERRCODE = '22023';
  END IF;

  IF v_refresh < 10 OR v_refresh > 300 THEN
    RAISE EXCEPTION 'autoRefreshSeconds must be between 10 and 300.' USING ERRCODE = '22023';
  END IF;

  v_next := jsonb_build_object(
    'activePlan', v_plan,
    'warningThresholdPercent', v_warn,
    'criticalThresholdPercent', v_crit,
    'autoRefreshSeconds', v_refresh,
    'updatedAt', NOW(),
    'updatedBy', v_actor_name
  );

  INSERT INTO public.system_settings (key, value, description, updated_by, updated_at)
  VALUES (
    'supabase_plan_monitor',
    v_next,
    'Super Admin Supabase Plan & Red Alert Threshold Monitor Preferences',
    v_actor_name,
    NOW()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW();

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_supabase_monitor_config(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_supabase_monitor_config(JSONB, TEXT) TO authenticated, service_role;

COMMIT;
