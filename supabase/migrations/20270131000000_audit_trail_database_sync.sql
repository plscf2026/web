-- ============================================================================
-- Migration: 20270131000000_audit_trail_database_sync.sql
-- Description:
-- 1. Ensure public.admin_audit_history table has full schema with camelCase alias columns
-- 2. Grant full permissions and open RLS on admin_audit_history, admin_audit_logs,
--    and rms_audit_logs to anon, authenticated, service_role
-- 3. Deploy authoritative rpc_fetch_unified_audit_trail (SECURITY DEFINER)
--    unifying admin_audit_history, admin_audit_logs, and financial_audit_logs
-- ============================================================================

-- 1. ADMIN AUDIT HISTORY TABLE REINFORCEMENT
CREATE TABLE IF NOT EXISTS public.admin_audit_history (
    id text PRIMARY KEY,
    admin_id text,
    admin_name text,
    entity_type text,
    entity_id text,
    action text,
    previous_value text,
    new_value text,
    reason text,
    timestamp timestamptz DEFAULT now()
);

-- Add support columns for camelCase insertion compatibility
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_audit_history' AND column_name = 'adminId') THEN
        ALTER TABLE public.admin_audit_history ADD COLUMN "adminId" text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_audit_history' AND column_name = 'adminName') THEN
        ALTER TABLE public.admin_audit_history ADD COLUMN "adminName" text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_audit_history' AND column_name = 'entityType') THEN
        ALTER TABLE public.admin_audit_history ADD COLUMN "entityType" text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_audit_history' AND column_name = 'entityId') THEN
        ALTER TABLE public.admin_audit_history ADD COLUMN "entityId" text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_audit_history' AND column_name = 'previousValue') THEN
        ALTER TABLE public.admin_audit_history ADD COLUMN "previousValue" text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_audit_history' AND column_name = 'newValue') THEN
        ALTER TABLE public.admin_audit_history ADD COLUMN "newValue" text;
    END IF;
END $$;

-- 2. OPEN RLS & GRANT PERMISSIONS ON admin_audit_history
ALTER TABLE public.admin_audit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_history_admin_insert" ON public.admin_audit_history;
DROP POLICY IF EXISTS "audit_history_admin_read" ON public.admin_audit_history;
DROP POLICY IF EXISTS "allow_all_admin_audit_history" ON public.admin_audit_history;
DROP POLICY IF EXISTS "allow_read_admin_audit_history" ON public.admin_audit_history;
DROP POLICY IF EXISTS "allow_insert_admin_audit_history" ON public.admin_audit_history;

CREATE POLICY "allow_all_admin_audit_history"
  ON public.admin_audit_history
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.admin_audit_history TO anon, authenticated, service_role;

-- 3. OPEN RLS & GRANT PERMISSIONS ON admin_audit_logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_read_admin" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "allow_read_admin_audit_logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "allow_insert_admin_audit_logs" ON public.admin_audit_logs;

CREATE POLICY "allow_read_admin_audit_logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

CREATE POLICY "allow_insert_admin_audit_logs"
  ON public.admin_audit_logs
  FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.admin_audit_logs TO anon, authenticated, service_role;

-- 4. OPEN RLS & GRANT PERMISSIONS ON rms_audit_logs
ALTER TABLE public.rms_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view audit logs" ON public.rms_audit_logs;
DROP POLICY IF EXISTS "System insert audit logs" ON public.rms_audit_logs;
DROP POLICY IF EXISTS "allow_all_rms_audit_logs" ON public.rms_audit_logs;

CREATE POLICY "allow_all_rms_audit_logs"
  ON public.rms_audit_logs
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.rms_audit_logs TO anon, authenticated, service_role;

-- 5. OPEN RLS & GRANT PERMISSIONS ON financial_audit_logs
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.financial_audit_logs TO anon, authenticated, service_role;

-- 6. AUTHORITATIVE UNIFIED AUDIT TRAIL RPC
CREATE OR REPLACE FUNCTION public.rpc_fetch_unified_audit_trail(p_limit int DEFAULT 300)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_agg(sub) INTO v_result
    FROM (
        SELECT 
            id,
            COALESCE(admin_id, "adminId", 'ADMIN') as "adminId",
            COALESCE(admin_name, "adminName", 'Administrator') as "adminName",
            COALESCE(entity_type, "entityType", 'SYSTEM') as "entityType",
            COALESCE(entity_id, "entityId", 'ID') as "entityId",
            action,
            COALESCE(previous_value, "previousValue", '') as "previousValue",
            COALESCE(new_value, "newValue", '') as "newValue",
            COALESCE(reason, 'Admin Operation') as reason,
            timestamp as "timestamp",
            'audit_history' as "source"
        FROM public.admin_audit_history
        UNION ALL
        SELECT
            id,
            COALESCE(admin_id, 'SYSTEM') as "adminId",
            COALESCE(admin_username, 'Super Administrator') as "adminName",
            CASE 
                WHEN upper(target_type) IN ('MEAL', 'GATE', 'DRESS', 'BUDGET', 'EXPENSE', 'STAFF', 'REGISTRATION') THEN upper(target_type)
                WHEN upper(target_type) = 'REGISTRATIONS' THEN 'REGISTRATION'
                ELSE 'REGISTRATION'
            END as "entityType",
            COALESCE(target_id, id) as "entityId",
            action,
            '' as "previousValue",
            '' as "newValue",
            COALESCE(details, action) as reason,
            created_at as "timestamp",
            'audit_logs' as "source"
        FROM public.admin_audit_logs
        UNION ALL
        SELECT
            id,
            COALESCE(performed_by, 'ADMIN') as "adminId",
            COALESCE(performed_by_name, 'Finance Admin') as "adminName",
            CASE 
                WHEN upper(entity_type) = 'EXPENSE' THEN 'EXPENSE'
                WHEN upper(entity_type) = 'BUDGET' THEN 'BUDGET'
                ELSE 'BUDGET'
            END as "entityType",
            COALESCE(entity_id, id) as "entityId",
            action,
            COALESCE(previous_amount::text, '') as "previousValue",
            COALESCE(updated_amount::text, '') as "newValue",
            COALESCE(reason, 'Financial modification') as reason,
            created_at as "timestamp",
            'financial_logs' as "source"
        FROM public.financial_audit_logs
        ORDER BY "timestamp" DESC
        LIMIT p_limit
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_fetch_unified_audit_trail(int) TO anon, authenticated, service_role;
