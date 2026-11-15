-- MIGRATION: 20270115000000_enable_registration_deletion_and_rpc.sql
-- Enables authoritative deletion of student bookings and registrations from admin panel
-- across Supabase database tables, Row Level Security (RLS), and related dependencies.

BEGIN;

-- 1. Create authoritative SECURITY DEFINER RPC to delete a registration and clean all dependencies
CREATE OR REPLACE FUNCTION public.rpc_delete_registration(
  p_reg_id TEXT,
  p_reason TEXT DEFAULT '',
  p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
  p_admin_name TEXT DEFAULT 'Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_found BOOLEAN := false;
  v_student_id TEXT := NULL;
  v_full_name TEXT := '';
  v_deleted_count INTEGER := 0;
BEGIN
  IF p_reg_id IS NULL OR trim(p_reg_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ID', 'message', 'Registration ID is required');
  END IF;

  -- 1. Check in registrations_2027
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'registrations_2027') THEN
    SELECT student_id, full_name INTO v_student_id, v_full_name 
    FROM public.registrations_2027 
    WHERE id = p_reg_id;
    
    IF FOUND THEN
      v_found := true;
      -- Unlink any payment transactions referencing this registration
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_transactions') THEN
        UPDATE public.payment_transactions SET registration_id = NULL WHERE registration_id = p_reg_id;
      END IF;
      
      -- Delete the record from registrations_2027
      DELETE FROM public.registrations_2027 WHERE id = p_reg_id;
      GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END IF;
  END IF;

  -- 2. Check in legacy registrations_2026
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'registrations_2026') THEN
    IF NOT v_found THEN
      SELECT student_id, full_name INTO v_student_id, v_full_name 
      FROM public.registrations_2026 
      WHERE id = p_reg_id;
      IF FOUND THEN
        v_found := true;
      END IF;
    END IF;
    DELETE FROM public.registrations_2026 WHERE id = p_reg_id;
  END IF;

  -- 3. Release student ID pool if a student_id was associated
  IF v_student_id IS NOT NULL AND trim(v_student_id) <> '' THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'current_student_ids') THEN
      UPDATE public.current_student_ids
      SET verification_status = 'AVAILABLE',
          reserved_until = NULL,
          updated_at = NOW()
      WHERE upper(trim(student_id)) = upper(trim(v_student_id));
    END IF;
  END IF;

  -- 4. Clean up any related operational records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'food_distributions') THEN
    DELETE FROM public.food_distributions WHERE registration_id = p_reg_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dress_distributions') THEN
    DELETE FROM public.dress_distributions WHERE registration_id = p_reg_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gate_events') THEN
    DELETE FROM public.gate_events WHERE registration_id = p_reg_id;
  END IF;

  -- 5. Record Audit Log in admin_audit_logs if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_audit_logs') THEN
    INSERT INTO public.admin_audit_logs (
      admin_id,
      admin_username,
      admin_role,
      action,
      target_type,
      target_id,
      details,
      created_at
    ) VALUES (
      COALESCE(p_admin_id, 'SUPER_ADMIN'),
      COALESCE(p_admin_name, 'Administrator'),
      'super_admin',
      'STUDENT_RECORD_DELETE',
      'registration',
      p_reg_id,
      'Registration ' || p_reg_id || ' (' || COALESCE(v_full_name, 'Unknown') || ') deleted by ' || COALESCE(p_admin_name, 'Admin') || '. Reason: ' || COALESCE(p_reason, 'Admin deletion'),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_reg_id,
    'deleted_from_cloud', v_found,
    'rows_deleted', v_deleted_count,
    'message', 'Registration deleted successfully from database.'
  );
END;
$$;

-- 2. Grant permissions on RPC to anon, authenticated, and service_role
GRANT EXECUTE ON FUNCTION public.rpc_delete_registration(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 3. Explicitly allow DELETE on registrations_2027 under RLS
DROP POLICY IF EXISTS "public_delete_registration_2027" ON public.registrations_2027;
CREATE POLICY "public_delete_registration_2027" ON public.registrations_2027
  FOR DELETE TO anon, authenticated
  USING (true);

GRANT DELETE ON public.registrations_2027 TO anon, authenticated, service_role;

-- 4. Conditionally apply for registrations_2026 if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'registrations_2026') THEN
    EXECUTE 'DROP POLICY IF EXISTS "public_delete_registration_2026" ON public.registrations_2026';
    EXECUTE 'CREATE POLICY "public_delete_registration_2026" ON public.registrations_2026 FOR DELETE TO anon, authenticated USING (true)';
    EXECUTE 'GRANT DELETE ON public.registrations_2026 TO anon, authenticated, service_role';
  END IF;
END $$;

COMMIT;
