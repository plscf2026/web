-- ============================================================================
-- MIGRATION: 20270322000000_security_rpc_and_rls_hardening.sql
-- PURPOSE: Remediate Audit Findings F-01 (SECURITY DEFINER RPC privilege & role
--          hardening) and F-02 (cumulative permissive USING (true) RLS policies
--          and unprotected backup tables) safely and reversibly.
--
-- SAFETY GUARANTEES:
--   - Additive and idempotent (IF EXISTS / to_regclass guards).
--   - Zero DROP TABLE, DELETE, TRUNCATE, or data rewrites.
--   - Preserves service_role execution for all Edge Functions & triggers.
--   - Preserves public anonymous access for legitimate public flows:
--     * rpc_get_public_governance_settings, rpc_get_public_reunion_stats
--     * rpc_lookup_ticket, rpc_lookup_donation, rpc_verify_student_qr
--     * rpc_verify_student_id, rpc_reserve_student_id, rpc_release_student_id_reservation
--     * rpc_get_financial_transparency_summary, rpc_verify_personal_donation_history
--     * rpc_resolve_login_email, current_admin_role, current_event_staff_role
--     * gallery_media (SELECT), about_contact_content (SELECT), expense_categories (SELECT),
--       expenses approved (SELECT), inquiries (validated INSERT)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1 (F-01): INTERNAL CALLER AUTHORIZATION + REVOKE/GRANT HARDENING
-- Helper pattern for staff/admin gates:
--   service_role JWT OR active admin (current_admin_role() IS NOT NULL)
--   OR active event staff (current_event_staff_role() IS NOT NULL)
--   OR privileged postgres/supabase_admin direct SQL maintenance.
-- ============================================================================

-- 1.1 Internal Rate Limit Helper (Edge Functions via service_role only)
DO $$
BEGIN
  IF to_regprocedure('public.consume_ticket_lookup_rate_limit(text,integer,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.consume_ticket_lookup_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.consume_ticket_lookup_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
  END IF;
END $$;

-- 1.2 Legacy portal role helper (unused by frontend; lock to service_role)
CREATE OR REPLACE FUNCTION public.rpc_authenticate_portal_role(
  p_user_email TEXT,
  p_required_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_account RECORD;
  v_is_authorized BOOLEAN := false;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Direct client access disabled.');
  END IF;

  SELECT * INTO v_account
  FROM public.admin_accounts
  WHERE LOWER(email) = LOWER(p_user_email)
     OR LOWER(username) = LOWER(p_user_email);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_NOT_FOUND', 'message', 'No authorized staff account found matching credentials.');
  END IF;

  IF v_account.role = 'super_admin' THEN
    v_is_authorized := true;
  ELSIF (p_required_role = 'finance' OR p_required_role = 'finance_manager')
    AND (v_account.role = 'finance' OR v_account.role = 'finance_manager') THEN
    v_is_authorized := true;
  ELSIF (p_required_role = 'registration' OR p_required_role = 'registration_officer')
    AND (v_account.role = 'registration' OR v_account.role = 'registration_officer') THEN
    v_is_authorized := true;
  ELSIF (p_required_role = 'committee' OR p_required_role = 'committee_member')
    AND (v_account.role = 'committee' OR v_account.role = 'committee_member') THEN
    v_is_authorized := true;
  ELSIF v_account.role = p_required_role THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROLE_MISMATCH', 'message', 'Account role mismatch.');
  END IF;

  RETURN jsonb_build_object('success', true, 'role', v_account.role);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_authenticate_portal_role(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_authenticate_portal_role(TEXT, TEXT) TO service_role;

-- 1.3 Admin registration readers (Admin only)
CREATE OR REPLACE FUNCTION public.rpc_admin_get_registrations(p_year int DEFAULT 2027)
RETURNS SETOF public.registrations_2027
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Administrator access required.';
  END IF;

  RETURN QUERY
  SELECT * FROM public.registrations_2027
  WHERE (p_year IS NULL OR year = p_year)
  ORDER BY registered_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_get_registrations(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_get_registrations(int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_paid_registrations()
RETURNS SETOF public.registrations_2027
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Administrator access required.';
  END IF;

  RETURN QUERY
  SELECT * FROM public.registrations_2027
  WHERE payment_status = 'paid'
  ORDER BY registered_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_paid_registrations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_paid_registrations() TO authenticated, service_role;

-- 1.4 rpc_delete_registration (Super Admin / Admin only)
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
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND COALESCE(public.current_admin_role(), '') NOT IN ('super_admin', 'admin')
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Super Admin or Admin privileges required to delete registrations.');
  END IF;

  IF p_reg_id IS NULL OR trim(p_reg_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ID', 'message', 'Registration ID is required');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'registrations_2027') THEN
    SELECT student_id, full_name INTO v_student_id, v_full_name
    FROM public.registrations_2027
    WHERE id = p_reg_id;

    IF FOUND THEN
      v_found := true;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_transactions') THEN
        UPDATE public.payment_transactions SET registration_id = NULL WHERE registration_id = p_reg_id;
      END IF;
      DELETE FROM public.registrations_2027 WHERE id = p_reg_id;
      GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END IF;
  END IF;

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

  IF v_student_id IS NOT NULL AND trim(v_student_id) <> '' THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'current_student_ids') THEN
      UPDATE public.current_student_ids
      SET verification_status = 'AVAILABLE',
          reserved_until = NULL,
          updated_at = NOW()
      WHERE upper(trim(student_id)) = upper(trim(v_student_id));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'food_distributions') THEN
    DELETE FROM public.food_distributions WHERE registration_id = p_reg_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dress_distributions') THEN
    DELETE FROM public.dress_distributions WHERE registration_id = p_reg_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gate_events') THEN
    DELETE FROM public.gate_events WHERE registration_id = p_reg_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_audit_logs') THEN
    INSERT INTO public.admin_audit_logs (
      admin_id, admin_username, admin_role, action, target_type, target_id, details
    ) VALUES (
      COALESCE(public.current_admin_id(), p_admin_id, 'SUPER_ADMIN'),
      COALESCE(p_admin_name, 'Administrator'),
      COALESCE(public.current_admin_role(), 'admin'),
      'DELETE_REGISTRATION',
      'registrations_2027',
      p_reg_id,
      'Deleted registration (' || COALESCE(NULLIF(v_full_name, ''), p_reg_id) || '). Reason: ' || COALESCE(NULLIF(p_reason, ''), 'Admin removal')
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_found,
    'registration_id', p_reg_id,
    'message', CASE WHEN v_found THEN 'Registration permanently deleted and audit logged' ELSE 'Record cleaned up successfully' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_delete_registration(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_delete_registration(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 1.5 Unified Audit Trail RPC (Admin only)
CREATE OR REPLACE FUNCTION public.rpc_fetch_unified_audit_trail(p_limit int DEFAULT 300)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Administrator access required to inspect audit trail.';
  END IF;

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

REVOKE ALL ON FUNCTION public.rpc_fetch_unified_audit_trail(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_fetch_unified_audit_trail(int) TO authenticated, service_role;

-- 1.6 Student Photo Update RPC (Admin only + pinned search_path)
CREATE OR REPLACE FUNCTION public.rpc_update_student_photo(
  p_registration_id TEXT,
  p_storage_path TEXT,
  p_photo_url TEXT,
  p_admin_name TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_reg RECORD;
  v_old_path TEXT;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Administrator authorization required to update student photos.');
  END IF;

  SELECT * INTO v_reg
  FROM public.registrations_2027
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'REGISTRATION_NOT_FOUND');
  END IF;

  v_old_path := v_reg.photo_storage_path;

  UPDATE public.registrations_2027
  SET
    photo_storage_path = p_storage_path,
    photo_url = COALESCE(p_photo_url, photo_url),
    photo_updated_at = NOW(),
    photo_updated_by = p_admin_name
  WHERE id = p_registration_id;

  INSERT INTO public.admin_audit_logs (
    id, admin_id, admin_username, admin_role, action, details, checksum, created_at
  ) VALUES (
    'AUD-PHT-' || FLOOR(EXTRACT(EPOCH FROM NOW())) || '-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6),
    COALESCE(public.current_admin_id(), 'ADMIN-ACTION'),
    p_admin_name,
    COALESCE(public.current_admin_role(), 'admin'),
    'STUDENT_PHOTO_UPDATED',
    jsonb_build_object(
      'registration_id', p_registration_id,
      'old_storage_path', v_old_path,
      'new_storage_path', p_storage_path,
      'updated_by', p_admin_name,
      'bucket', 'student-photos'
    ),
    MD5(p_registration_id || p_storage_path || NOW()::TEXT),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', p_registration_id,
    'storage_path', p_storage_path,
    'photo_url', COALESCE(p_photo_url, v_reg.photo_url)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_student_photo(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_student_photo(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 1.7 Manual Registration RPCs (Admin / Registration Officer / Finance Manager)
CREATE OR REPLACE FUNCTION public.rpc_create_manual_registration(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_id text;
  v_qr_token text;
  v_student_id text := trim(upper(COALESCE(p_data->>'student_id', '')));
  v_mobile text := regexp_replace(trim(COALESCE(p_data->>'mobile_number', '')), '\D', '', 'g');
  v_full_name text := trim(COALESCE(p_data->>'full_name', ''));
  v_financial_amount numeric := GREATEST(0, COALESCE((p_data->>'financial_amount')::numeric, 0));
  v_financial_method text := trim(COALESCE(p_data->>'financial_method', 'Cash'));
  v_financial_ref text := trim(COALESCE(p_data->>'financial_reference', ''));
  v_fin_status text := 'pending';
  v_pay_method_norm text;
  v_staff_id text := COALESCE(NULLIF(trim(COALESCE(p_data->>'created_by_admin_id', '')), ''), public.current_admin_id(), 'VENUE_DESK');
  v_staff_name text := COALESCE(NULLIF(trim(COALESCE(p_data->>'created_by_admin_name', '')), ''), 'Registration Desk Staff');
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator login required for manual registration.');
  END IF;

  IF v_full_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student Full Name is required.');
  END IF;

  IF length(v_mobile) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A valid 11-digit Bangladeshi mobile number is required.');
  END IF;

  IF v_mobile LIKE '880%' THEN
    v_mobile := '0' || substr(v_mobile, 4);
  ELSIF length(v_mobile) = 10 AND v_mobile LIKE '1%' THEN
    v_mobile := '0' || v_mobile;
  END IF;

  IF lower(v_financial_method) = 'cash' THEN
    IF v_financial_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cash amount received must be greater than 0.');
    END IF;
  ELSIF lower(v_financial_method) IN ('bkash', 'bank transfer', 'bank_transfer') THEN
    IF v_financial_ref = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Transaction ID or Payment Token ID is mandatory for ' || v_financial_method || '.');
    END IF;
  END IF;

  IF v_student_id <> '' THEN
    IF EXISTS (SELECT 1 FROM public.registrations_2027 WHERE upper(student_id) = v_student_id)
       OR EXISTS (SELECT 1 FROM public.manual_registrations WHERE upper(student_id) = v_student_id AND registration_approval_status <> 'rejected') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_STUDENT_ID: Student ID ' || v_student_id || ' is already registered.'
      );
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.registrations_2027 WHERE mobile_number = v_mobile)
     OR EXISTS (SELECT 1 FROM public.manual_registrations WHERE mobile_number = v_mobile AND registration_approval_status <> 'rejected') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_MOBILE: Mobile number ' || v_mobile || ' is already registered.'
    );
  END IF;

  v_id := COALESCE(
    NULLIF(trim(COALESCE(p_data->>'id', '')), ''),
    'PLSCF-2027-' || CASE WHEN p_data->>'category' = 'current' THEN 'C' ELSE 'F' END || (floor(random() * 9000 + 1000))::text
  );
  v_qr_token := COALESCE(
    NULLIF(trim(COALESCE(p_data->>'qr_token', '')), ''),
    upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6))
  );

  v_pay_method_norm := CASE
    WHEN lower(v_financial_method) IN ('bank transfer', 'bank_transfer') THEN 'bank_transfer'
    WHEN lower(v_financial_method) = 'bkash' THEN 'bkash'
    ELSE 'cash'
  END;

  INSERT INTO public.manual_registrations (
    id, full_name, full_name_bn, photo_url, photo_storage_path, mobile_number, email, address,
    category, student_id, passing_year, last_class_attended, current_class, batch_name,
    group_or_section, roll_number, t_shirt_size, gender, blood_group,
    has_parent, parent_name, parent_age, parent_phone, parent_relation, parent_photo_url, parent_photo_storage_path, parent_fee,
    registration_fee, donation_amount, total_paid, payment_status, payment_method, transaction_id, qr_token, notes, year,
    is_manual_registration, registration_type, registration_approval_status,
    created_by_admin_id, created_by_admin_name,
    financial_amount, financial_description, financial_method, financial_reference, financial_notes, financial_approval_status,
    document_url, document_name, registered_at, updated_at
  ) VALUES (
    v_id,
    v_full_name,
    p_data->>'full_name_bn',
    COALESCE(p_data->>'photo_url', ''),
    p_data->>'photo_storage_path',
    v_mobile,
    NULLIF(trim(COALESCE(p_data->>'email', '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_data->>'address', '')), ''), 'Faridpur'),
    COALESCE(p_data->>'category', 'former'),
    NULLIF(v_student_id, ''),
    p_data->>'passing_year',
    p_data->>'last_class_attended',
    p_data->>'current_class',
    COALESCE(NULLIF(trim(COALESCE(p_data->>'batch_name', '')), ''), 'General'),
    p_data->>'group_or_section',
    p_data->>'roll_number',
    COALESCE(p_data->>'t_shirt_size', 'L'),
    COALESCE(p_data->>'gender', 'male'),
    p_data->>'blood_group',
    COALESCE((p_data->>'has_parent')::boolean, false),
    p_data->>'parent_name',
    p_data->>'parent_age',
    p_data->>'parent_phone',
    p_data->>'parent_relation',
    p_data->>'parent_photo_url',
    p_data->>'parent_photo_storage_path',
    COALESCE((p_data->>'parent_fee')::numeric, 0),
    COALESCE((p_data->>'registration_fee')::numeric, CASE WHEN p_data->>'category' = 'current' THEN 500 ELSE 1500 END),
    0,
    0,
    'pending',
    v_pay_method_norm,
    NULLIF(v_financial_ref, ''),
    v_qr_token,
    p_data->>'notes',
    2027,
    TRUE,
    COALESCE(p_data->>'registration_type', 'manual_venue'),
    'pending',
    v_staff_id,
    v_staff_name,
    v_financial_amount,
    p_data->>'financial_description',
    v_financial_method,
    NULLIF(v_financial_ref, ''),
    p_data->>'financial_notes',
    v_fin_status,
    p_data->>'document_url',
    p_data->>'document_name',
    now(),
    now()
  );

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details, new_data
  ) VALUES (
    v_id, v_staff_id, v_staff_name, COALESCE(public.current_admin_role(), 'registration_officer'), 'CREATE_MANUAL_REGISTRATION',
    'Manual registration submitted by ' || v_staff_name || ' (' || v_staff_id || '). Status: pending approval. Payment: ' || v_financial_method || ' BDT ' || v_financial_amount,
    p_data
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'qr_token', v_qr_token,
    'registration_approval_status', 'pending',
    'financial_approval_status', v_fin_status,
    'payment_status', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_manual_registration(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_manual_registration(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_staff_update_manual_registration(
  p_registration_id text,
  p_staff_id text,
  p_staff_role text,
  p_full_name text,
  p_mobile_number text,
  p_full_name_bn text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
  v_rec record;
  v_clean_name text := trim(COALESCE(p_full_name, ''));
  v_clean_mobile text := regexp_replace(trim(COALESCE(p_mobile_number, '')), '\D', '', 'g');
  v_caller_role text := COALESCE(public.current_admin_role(), '');
  v_caller_id text := COALESCE(public.current_admin_id(), '');
  v_is_super boolean := (v_caller_role = 'super_admin');
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND v_caller_role = ''
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator login required.');
  END IF;

  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role' THEN
    v_is_super := (lower(trim(COALESCE(p_staff_role, ''))) = 'super_admin');
  END IF;

  IF v_clean_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student full name cannot be empty.');
  END IF;

  IF v_clean_mobile LIKE '880%' THEN
    v_clean_mobile := '0' || substr(v_clean_mobile, 4);
  ELSIF length(v_clean_mobile) = 10 AND v_clean_mobile LIKE '1%' THEN
    v_clean_mobile := '0' || v_clean_mobile;
  END IF;

  IF v_clean_mobile !~ '^01[3-9]\d{8}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid 11-digit Bangladeshi mobile number.');
  END IF;

  SELECT * INTO v_rec
  FROM public.manual_registrations
  WHERE upper(id) = v_clean_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration record not found.');
  END IF;

  IF NOT v_is_super AND COALESCE(v_rec.created_by_admin_id, '') <> COALESCE(NULLIF(v_caller_id, ''), COALESCE(p_staff_id, '')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED_OWNERSHIP: You can only edit registrations you personally created.'
    );
  END IF;

  UPDATE public.manual_registrations
  SET
    full_name = v_clean_name,
    full_name_bn = COALESCE(NULLIF(trim(COALESCE(p_full_name_bn, '')), ''), full_name_bn),
    mobile_number = v_clean_mobile,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  UPDATE public.registrations_2027
  SET
    full_name = v_clean_name,
    full_name_bn = COALESCE(NULLIF(trim(COALESCE(p_full_name_bn, '')), ''), full_name_bn),
    mobile_number = v_clean_mobile
  WHERE upper(id) = v_clean_id;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details, previous_data, new_data
  ) VALUES (
    v_clean_id,
    COALESCE(NULLIF(v_caller_id, ''), p_staff_id, 'STAFF'),
    COALESCE(v_rec.created_by_admin_name, 'Staff'),
    COALESCE(NULLIF(v_caller_role, ''), p_staff_role, 'registration_officer'),
    'STAFF_EDIT_CONTACT_ONLY',
    'Updated allowed contact fields only (full_name, mobile_number). Financial & approval fields protected.',
    jsonb_build_object('full_name', v_rec.full_name, 'mobile_number', v_rec.mobile_number),
    jsonb_build_object('full_name', v_clean_name, 'mobile_number', v_clean_mobile)
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_clean_id,
    'full_name', v_clean_name,
    'mobile_number', v_clean_mobile
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_staff_update_manual_registration(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_staff_update_manual_registration(text, text, text, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_approve_manual_registration(
  p_registration_id text,
  p_admin_name text,
  p_notes text DEFAULT '',
  p_approve_payment boolean DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
  v_rec public.manual_registrations%ROWTYPE;
  v_paid_amt numeric;
  v_fin_status text;
  v_pay_status text;
  v_caller_role text := COALESCE(public.current_admin_role(), '');
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND v_caller_role NOT IN ('super_admin', 'admin')
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin or Admin can approve manual registrations.');
  END IF;

  SELECT * INTO v_rec FROM public.manual_registrations WHERE upper(id) = v_clean_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration not found: ' || p_registration_id);
  END IF;

  IF p_approve_payment THEN
    v_fin_status := 'approved';
    v_paid_amt := CASE
      WHEN COALESCE(v_rec.financial_amount, 0) > 0 THEN v_rec.financial_amount
      WHEN COALESCE(v_rec.registration_fee, 0) > 0 THEN v_rec.registration_fee
      WHEN v_rec.category = 'current' THEN 500
      ELSE 1500
    END;
    v_pay_status := 'paid';
  ELSE
    v_fin_status := v_rec.financial_approval_status;
    v_paid_amt := CASE
      WHEN v_rec.financial_approval_status = 'approved' THEN COALESCE(v_rec.financial_amount, v_rec.registration_fee, 0)
      WHEN COALESCE(v_rec.financial_amount, 0) = 0 THEN COALESCE(v_rec.registration_fee, 500)
      ELSE 0
    END;
    v_pay_status := CASE WHEN v_fin_status IN ('pending', 'rejected') AND COALESCE(v_rec.financial_amount, 0) > 0 THEN 'pending' ELSE 'paid' END;
  END IF;

  UPDATE public.manual_registrations
  SET
    registration_approval_status = 'approved',
    payment_status = v_pay_status,
    total_paid = v_paid_amt,
    financial_approval_status = v_fin_status,
    financial_approved_by = CASE WHEN p_approve_payment THEN COALESCE(financial_approved_by, p_admin_name) ELSE financial_approved_by END,
    financial_approved_at = CASE WHEN p_approve_payment THEN COALESCE(financial_approved_at, now()) ELSE financial_approved_at END,
    approved_by = p_admin_name,
    approved_at = COALESCE(approved_at, now()),
    approval_notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
    synced_to_main_at = now(),
    main_registration_id = v_rec.id,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  INSERT INTO public.registrations_2027 (
    id, full_name, full_name_bn, photo_url, photo_storage_path, mobile_number, email, address,
    category, student_id, passing_year, last_class_attended, current_class, batch_name,
    group_or_section, roll_number, t_shirt_size, gender, blood_group,
    has_parent, parent_name, parent_age, parent_phone, parent_relation, parent_photo_url, parent_photo_storage_path, parent_fee,
    registration_fee, donation_amount, total_paid, payment_status, transaction_id, payment_method,
    verified_by, verification_timestamp, registered_at, qr_token, notes, year,
    is_manual_registration, registration_type, registration_approval_status, approval_notes, approved_by, approved_at,
    created_by_admin_id, created_by_admin_name,
    financial_amount, financial_description, financial_method, financial_reference, financial_notes,
    financial_approval_status, financial_approved_by, financial_approved_at,
    document_url, document_name
  ) VALUES (
    v_rec.id, v_rec.full_name, v_rec.full_name_bn, COALESCE(v_rec.photo_url, ''), v_rec.photo_storage_path,
    v_rec.mobile_number, v_rec.email, COALESCE(v_rec.address, 'Faridpur'),
    v_rec.category, v_rec.student_id, v_rec.passing_year, v_rec.last_class_attended, v_rec.current_class, v_rec.batch_name,
    v_rec.group_or_section, v_rec.roll_number, COALESCE(v_rec.t_shirt_size, 'L'), COALESCE(v_rec.gender, 'male'), v_rec.blood_group,
    COALESCE(v_rec.has_parent, false), v_rec.parent_name,
    CASE WHEN v_rec.parent_age ~ '^\d+$' THEN v_rec.parent_age::integer ELSE NULL END,
    v_rec.parent_phone, v_rec.parent_relation, v_rec.parent_photo_url, v_rec.parent_photo_storage_path, COALESCE(v_rec.parent_fee, 0),
    COALESCE(v_rec.registration_fee, 1500), 0, v_paid_amt, v_pay_status,
    COALESCE(v_rec.financial_reference, v_rec.transaction_id, 'MANUAL-' || v_rec.id),
    COALESCE(v_rec.payment_method, 'cash'),
    p_admin_name, now(), COALESCE(v_rec.registered_at, now()), v_rec.qr_token, v_rec.notes, COALESCE(v_rec.year, 2027),
    TRUE, COALESCE(v_rec.registration_type, 'manual_venue'), 'approved', NULLIF(trim(COALESCE(p_notes, '')), ''), p_admin_name, now(),
    v_rec.created_by_admin_id, v_rec.created_by_admin_name,
    COALESCE(v_rec.financial_amount, 0), v_rec.financial_description, v_rec.financial_method, v_rec.financial_reference, v_rec.financial_notes,
    v_fin_status, CASE WHEN p_approve_payment THEN p_admin_name ELSE v_rec.financial_approved_by END,
    CASE WHEN p_approve_payment THEN now() ELSE v_rec.financial_approved_at END,
    v_rec.document_url, v_rec.document_name
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    full_name_bn = EXCLUDED.full_name_bn,
    photo_url = EXCLUDED.photo_url,
    photo_storage_path = EXCLUDED.photo_storage_path,
    mobile_number = EXCLUDED.mobile_number,
    registration_approval_status = 'approved',
    payment_status = EXCLUDED.payment_status,
    total_paid = EXCLUDED.total_paid,
    financial_approval_status = EXCLUDED.financial_approval_status,
    financial_approved_by = EXCLUDED.financial_approved_by,
    financial_approved_at = EXCLUDED.financial_approved_at,
    approved_by = EXCLUDED.approved_by,
    approved_at = EXCLUDED.approved_at,
    approval_notes = EXCLUDED.approval_notes;

  IF v_rec.category = 'current' AND COALESCE(v_rec.student_id, '') <> '' THEN
    BEGIN
      UPDATE public.current_student_ids
      SET registration_status = 'REGISTERED', registered_by_reg_id = v_rec.id, updated_at = now()
      WHERE upper(student_id) = upper(v_rec.student_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF p_approve_payment AND v_paid_amt > 0 THEN
    BEGIN
      INSERT INTO public.financial_transactions (
        id, transaction_type, source_type, reference_id, amount, payment_method,
        gateway_trx_id, description, transaction_date, created_by
      ) VALUES (
        'FTX-MAN-' || v_rec.id, 'income', 'registration_fee', v_rec.id, v_paid_amt,
        COALESCE(v_rec.financial_method, 'Cash'), v_rec.financial_reference,
        'Manual registration payment approved for ' || v_rec.full_name || ' (' || v_rec.id || ')',
        CURRENT_DATE, p_admin_name
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details
  ) VALUES (
    v_clean_id, COALESCE(public.current_admin_id(), 'ADMIN'), p_admin_name, COALESCE(NULLIF(v_caller_role, ''), 'super_admin'), 'APPROVE_AND_SYNC_TO_MAIN',
    'Approved by ' || p_admin_name || '. Transferred to registrations_2027 & QR activated. Payment approved: ' || p_approve_payment::text || ', Total Paid: BDT ' || v_paid_amt
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_clean_id,
    'status', 'approved',
    'payment_status', v_pay_status,
    'financial_approval_status', v_fin_status,
    'total_paid', v_paid_amt
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_approve_manual_registration(text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_registration(text, text, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_reject_manual_registration(
  p_registration_id text,
  p_admin_name text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
  v_caller_role text := COALESCE(public.current_admin_role(), '');
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND v_caller_role NOT IN ('super_admin', 'admin')
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin or Admin can reject manual registrations.');
  END IF;

  UPDATE public.manual_registrations
  SET
    registration_approval_status = 'rejected',
    payment_status = 'rejected',
    rejected_by = p_admin_name,
    rejected_at = now(),
    rejection_reason = p_reason,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration not found: ' || p_registration_id);
  END IF;

  DELETE FROM public.registrations_2027
  WHERE upper(id) = v_clean_id AND is_manual_registration IS TRUE;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details
  ) VALUES (
    v_clean_id, COALESCE(public.current_admin_id(), 'ADMIN'), p_admin_name, COALESCE(NULLIF(v_caller_role, ''), 'super_admin'), 'REJECT_MANUAL_REGISTRATION',
    'Rejected by ' || p_admin_name || '. Reason: ' || COALESCE(p_reason, '')
  );

  RETURN jsonb_build_object('success', true, 'id', v_clean_id, 'status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reject_manual_registration(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_registration(text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_approve_manual_financial(
  p_registration_id text,
  p_admin_name text,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
  v_rec public.manual_registrations%ROWTYPE;
  v_amt numeric;
  v_caller_role text := COALESCE(public.current_admin_role(), '');
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND v_caller_role NOT IN ('super_admin', 'finance_manager')
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin or Finance Manager can approve manual payments.');
  END IF;

  SELECT * INTO v_rec FROM public.manual_registrations WHERE upper(id) = v_clean_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration not found: ' || p_registration_id);
  END IF;

  v_amt := GREATEST(0, COALESCE(v_rec.financial_amount, v_rec.registration_fee, 0));

  UPDATE public.manual_registrations
  SET
    financial_approval_status = 'approved',
    financial_approved_by = p_admin_name,
    financial_approved_at = now(),
    payment_status = 'paid',
    total_paid = v_amt,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  UPDATE public.registrations_2027
  SET
    financial_approval_status = 'approved',
    financial_approved_by = p_admin_name,
    financial_approved_at = now(),
    payment_status = 'paid',
    total_paid = v_amt
  WHERE upper(id) = v_clean_id;

  BEGIN
    INSERT INTO public.financial_transactions (
      id, transaction_type, source_type, reference_id, amount, payment_method,
      gateway_trx_id, description, transaction_date, created_by
    ) VALUES (
      'FTX-MAN-' || v_rec.id, 'income', 'registration_fee', v_rec.id, v_amt,
      COALESCE(v_rec.financial_method, 'Cash'), v_rec.financial_reference,
      'Manual registration payment approved for ' || v_rec.full_name || ' (' || v_rec.id || ')',
      CURRENT_DATE, p_admin_name
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details
  ) VALUES (
    v_clean_id, COALESCE(public.current_admin_id(), 'FINANCE'), p_admin_name, COALESCE(NULLIF(v_caller_role, ''), 'super_admin'), 'APPROVE_MANUAL_PAYMENT',
    'Payment BDT ' || v_amt || ' verified & approved by ' || p_admin_name || '. ' || COALESCE(p_notes, '')
  );

  RETURN jsonb_build_object('success', true, 'id', v_clean_id, 'financial_approval_status', 'approved', 'total_paid', v_amt);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_approve_manual_financial(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_financial(text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_reject_manual_financial(
  p_registration_id text,
  p_admin_name text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
  v_caller_role text := COALESCE(public.current_admin_role(), '');
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND v_caller_role NOT IN ('super_admin', 'finance_manager')
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin or Finance Manager can reject manual payments.');
  END IF;

  UPDATE public.manual_registrations
  SET
    financial_approval_status = 'rejected',
    financial_rejected_by = p_admin_name,
    financial_rejected_at = now(),
    total_paid = 0,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration not found: ' || p_registration_id);
  END IF;

  UPDATE public.registrations_2027
  SET
    financial_approval_status = 'rejected',
    financial_rejected_by = p_admin_name,
    financial_rejected_at = now(),
    total_paid = 0
  WHERE upper(id) = v_clean_id;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details
  ) VALUES (
    v_clean_id, COALESCE(public.current_admin_id(), 'FINANCE'), p_admin_name, COALESCE(NULLIF(v_caller_role, ''), 'super_admin'), 'REJECT_MANUAL_PAYMENT',
    'Payment rejected by ' || p_admin_name || '. Reason: ' || COALESCE(p_reason, '')
  );

  RETURN jsonb_build_object('success', true, 'id', v_clean_id, 'financial_approval_status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reject_manual_financial(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_financial(text, text, text) TO authenticated, service_role;

-- 1.8 Gate / Food / Dress Scanner & Admin Toggle RPCs (Authenticated Admin or Staff only)
CREATE OR REPLACE FUNCTION public.rpc_confirm_gate_event(
    p_registration_id TEXT,
    p_event_type TEXT,
    p_gate_id TEXT DEFAULT 'Gate 01 - Main Entrance',
    p_staff_id TEXT DEFAULT 'GATE_STAFF',
    p_staff_name TEXT DEFAULT 'Gate Staff'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_id TEXT := upper(trim(COALESCE(p_registration_id, '')));
    v_norm_type TEXT;
    v_student RECORD;
    v_last_event RECORD;
    v_new_event_id TEXT;
    v_is_inside BOOLEAN;
BEGIN
    IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
       AND public.current_admin_role() IS NULL
       AND public.current_event_staff_role() IS NULL
       AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff or administrator login required for gate scanning.');
    END IF;

    IF upper(trim(COALESCE(p_event_type, ''))) IN ('BACK', 'EXIT') THEN
        v_norm_type := 'BACK';
    ELSE
        v_norm_type := 'ENTRY';
    END IF;

    SELECT id, full_name, batch_name, photo_url, payment_status, registration_approval_status, is_checked_in, gate_status
    INTO v_student
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id OR upper(student_id) = v_clean_id OR upper(qr_token) = v_clean_id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND', 'message', 'Student registration not found.');
    END IF;

    IF v_student.payment_status <> 'paid' AND v_student.registration_approval_status <> 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNPAID_REGISTRATION', 'message', 'Student registration is not paid.');
    END IF;

    SELECT event_type, status INTO v_last_event
    FROM public.gate_events
    WHERE registration_id = v_student.id
      AND status = 'APPROVED'
    ORDER BY timestamp DESC
    LIMIT 1;

    IF FOUND THEN
        v_is_inside := (v_last_event.event_type = 'ENTRY');
    ELSE
        v_is_inside := (v_student.gate_status = 'ENTRY' OR v_student.is_checked_in IS TRUE);
    END IF;

    v_new_event_id := 'GATE-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT;

    INSERT INTO public.gate_events (
        id, registration_id, student_name, batch_name, photo_url,
        event_type, gate_id, staff_id, staff_name, timestamp, status
    ) VALUES (
        v_new_event_id, v_student.id, v_student.full_name, v_student.batch_name,
        v_student.photo_url, v_norm_type, COALESCE(p_gate_id, 'Gate 01 - Main Entrance'),
        COALESCE(public.current_staff_id(), public.current_admin_id(), p_staff_id, 'GATE_STAFF'),
        COALESCE(p_staff_name, 'Gate Staff'), NOW(), 'APPROVED'
    );

    UPDATE public.registrations_2027
    SET is_checked_in = (v_norm_type = 'ENTRY'),
        gate_status = v_norm_type
    WHERE id = v_student.id;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_new_event_id,
        'event_type', v_norm_type,
        'gate_status', v_norm_type,
        'student_id', v_student.id,
        'student_name', v_student.full_name,
        'batch_name', v_student.batch_name,
        'is_inside', (v_norm_type = 'ENTRY')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_confirm_gate_event(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_gate_event(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_toggle_gate_attendance(
    p_reg_id TEXT,
    p_is_inside BOOLEAN,
    p_staff_id TEXT DEFAULT 'ADMIN',
    p_staff_name TEXT DEFAULT 'Admin',
    p_gate_id TEXT DEFAULT 'Gate 01 - Main Entrance'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_student RECORD;
    v_event_type TEXT;
    v_event_id TEXT;
BEGIN
    IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
       AND public.current_admin_role() IS NULL
       AND public.current_event_staff_role() IS NULL
       AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff or administrator login required.');
    END IF;

    v_event_type := CASE WHEN p_is_inside IS TRUE THEN 'ENTRY' ELSE 'BACK' END;

    SELECT id, full_name, batch_name, photo_url INTO v_student
    FROM public.registrations_2027
    WHERE id = p_reg_id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration record not found');
    END IF;

    UPDATE public.registrations_2027
    SET is_checked_in = p_is_inside,
        gate_status = v_event_type
    WHERE id = p_reg_id;

    v_event_id := 'GATE-TOGGLE-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT;
    INSERT INTO public.gate_events (
        id, registration_id, student_name, batch_name, photo_url,
        event_type, gate_id, staff_id, staff_name, timestamp, status
    ) VALUES (
        v_event_id, v_student.id, v_student.full_name, v_student.batch_name,
        v_student.photo_url, v_event_type, COALESCE(p_gate_id, 'Gate 01 - Main Entrance'),
        COALESCE(public.current_admin_id(), public.current_staff_id(), p_staff_id, 'ADMIN'),
        COALESCE(p_staff_name, 'Admin'), NOW(), 'APPROVED'
    );

    RETURN jsonb_build_object(
        'success', true,
        'is_inside', p_is_inside,
        'gate_status', v_event_type,
        'event_id', v_event_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_toggle_gate_attendance(TEXT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_toggle_gate_attendance(TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_confirm_food_distribution(
  p_registration_id TEXT,
  p_meal_type TEXT,
  p_staff_id TEXT,
  p_staff_name TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student RECORD;
  v_last_gate RECORD;
  v_already_collected RECORD;
  v_record_id TEXT;
  v_is_inside BOOLEAN;
  v_gate_status TEXT;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND public.current_event_staff_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff or administrator login required for food distribution.');
  END IF;

  SELECT id, full_name, batch_name, payment_status, is_checked_in, gate_status
  INTO v_student
  FROM public.registrations_2027
  WHERE id = p_registration_id OR student_id = p_registration_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Student registration not found.');
  END IF;

  IF v_student.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNPAID', 'message', 'Student registration is not paid.');
  END IF;

  SELECT event_type, status INTO v_last_gate
  FROM public.gate_events
  WHERE registration_id = v_student.id AND status = 'APPROVED'
  ORDER BY timestamp DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_last_gate.event_type = 'ENTRY' THEN
      v_gate_status := 'ENTRY';
      v_is_inside := TRUE;
    ELSE
      v_gate_status := 'BACK';
      v_is_inside := FALSE;
    END IF;
  ELSE
    IF v_student.is_checked_in IS TRUE THEN
      v_gate_status := 'ENTRY';
      v_is_inside := TRUE;
    ELSE
      v_gate_status := COALESCE(v_student.gate_status, 'NOT_ENTERED');
      v_is_inside := FALSE;
    END IF;
  END IF;

  IF v_gate_status = 'BACK' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BACK_TO_THE_GATE',
      'gate_status', 'BACK',
      'title', 'BACK TO THE GATE',
      'message', 'Student has exited the event. Food collection is not allowed. Please ask the student to enter through the gate first.'
    );
  END IF;

  IF NOT v_is_inside OR v_gate_status = 'NOT_ENTERED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_ENTERED',
      'gate_status', 'NOT_ENTERED',
      'title', 'GATE ENTRY REQUIRED',
      'message', 'Student has not entered the event. Please complete gate entry first.'
    );
  END IF;

  SELECT id, collected_at INTO v_already_collected
  FROM public.food_distributions
  WHERE registration_id = v_student.id
    AND meal_type = lower(trim(p_meal_type))
    AND status = 'COLLECTED'
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_COLLECTED',
      'message', format('Meal %s already collected at %s', upper(p_meal_type), v_already_collected.collected_at)
    );
  END IF;

  v_record_id := 'FOOD-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT;

  INSERT INTO public.food_distributions (
    id, registration_id, student_name, batch_name, meal_type,
    status, collected_at, staff_id, staff_name, notes
  ) VALUES (
    v_record_id, v_student.id, v_student.full_name, v_student.batch_name,
    lower(trim(p_meal_type)), 'COLLECTED', NOW(),
    COALESCE(public.current_staff_id(), public.current_admin_id(), p_staff_id), p_staff_name, p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'record_id', v_record_id,
    'meal_type', p_meal_type,
    'student_name', v_student.full_name,
    'batch_name', v_student.batch_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_confirm_food_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_food_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_toggle_food_distribution(
  p_reg_id TEXT,
  p_meal_type TEXT,
  p_collected BOOLEAN,
  p_staff_id TEXT DEFAULT 'ADMIN',
  p_staff_name TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_reg RECORD;
  v_meal TEXT := lower(trim(p_meal_type));
  v_gate_status TEXT;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND public.current_event_staff_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Staff or administrator login required.');
  END IF;

  IF v_meal NOT IN ('breakfast', 'lunch', 'dinner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid meal type: must be breakfast, lunch, or dinner');
  END IF;

  SELECT id, full_name, batch_name, is_checked_in, gate_status INTO v_reg
  FROM public.registrations_2027
  WHERE id = p_reg_id OR student_id = p_reg_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not found in registrations_2027: ' || p_reg_id);
  END IF;

  v_gate_status := COALESCE(v_reg.gate_status, CASE WHEN v_reg.is_checked_in THEN 'ENTRY' ELSE 'NOT_ENTERED' END);

  IF p_collected AND v_gate_status <> 'ENTRY' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'GATE_ENTRY_REQUIRED',
      'gate_status', v_gate_status,
      'message', 'GATE ENTRY REQUIRED: Cannot distribute food. Student must have ENTRY status through the gate first.'
    );
  END IF;

  IF p_collected THEN
    INSERT INTO public.food_distributions (
      id, registration_id, student_name, batch_name, meal_type,
      status, collected_at, staff_id, staff_name
    ) VALUES (
      'FOOD-' || floor(extract(epoch from now()) * 1000)::text || '-' || floor(random() * 900 + 100)::text,
      v_reg.id,
      v_reg.full_name,
      COALESCE(v_reg.batch_name, 'General'),
      v_meal,
      'COLLECTED',
      now(),
      COALESCE(public.current_admin_id(), public.current_staff_id(), p_staff_id, 'ADMIN'),
      COALESCE(p_staff_name, 'Admin')
    )
    ON CONFLICT (registration_id, meal_type)
    DO UPDATE SET
      status = 'COLLECTED',
      collected_at = now(),
      staff_id = EXCLUDED.staff_id,
      staff_name = EXCLUDED.staff_name;
  ELSE
    DELETE FROM public.food_distributions
    WHERE registration_id = v_reg.id AND meal_type = v_meal;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_reg.id,
    'meal_type', v_meal,
    'collected', p_collected
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_toggle_food_distribution(TEXT, TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_toggle_food_distribution(TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_confirm_dress_distribution(
  p_registration_id TEXT,
  p_staff_id TEXT,
  p_staff_name TEXT,
  p_issued_size TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student RECORD;
  v_last_gate RECORD;
  v_dist_id TEXT;
  v_is_inside BOOLEAN;
  v_gate_status TEXT;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND public.current_event_staff_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff or administrator login required for T-shirt distribution.');
  END IF;

  SELECT id, full_name, batch_name, t_shirt_size, payment_status, is_checked_in, is_t_shirt_collected, gate_status
  INTO v_student
  FROM public.registrations_2027
  WHERE id = p_registration_id OR student_id = p_registration_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Student registration not found.');
  END IF;

  IF v_student.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNPAID', 'message', 'Registration is not paid.');
  END IF;

  SELECT event_type, status INTO v_last_gate
  FROM public.gate_events
  WHERE registration_id = v_student.id AND status = 'APPROVED'
  ORDER BY timestamp DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_last_gate.event_type = 'ENTRY' THEN
      v_gate_status := 'ENTRY';
      v_is_inside := TRUE;
    ELSE
      v_gate_status := 'BACK';
      v_is_inside := FALSE;
    END IF;
  ELSE
    IF v_student.is_checked_in IS TRUE THEN
      v_gate_status := 'ENTRY';
      v_is_inside := TRUE;
    ELSE
      v_gate_status := COALESCE(v_student.gate_status, 'NOT_ENTERED');
      v_is_inside := FALSE;
    END IF;
  END IF;

  IF v_gate_status = 'BACK' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BACK_TO_THE_GATE',
      'gate_status', 'BACK',
      'title', 'BACK TO THE GATE',
      'message', 'Student has exited the event. T-shirt collection is currently blocked. Please ask the student to enter through the gate first.'
    );
  END IF;

  IF NOT v_is_inside OR v_gate_status = 'NOT_ENTERED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_ENTERED',
      'gate_status', 'NOT_ENTERED',
      'title', 'GATE ENTRY REQUIRED',
      'message', 'Student has not entered the event. Please complete gate entry first.'
    );
  END IF;

  IF v_student.is_t_shirt_collected IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_COLLECTED', 'message', 'T-Shirt / Dress has already been collected.');
  END IF;

  UPDATE public.registrations_2027
  SET is_t_shirt_collected = true
  WHERE id = v_student.id;

  v_dist_id := 'DRESS-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT;

  IF to_regclass('public.dress_distributions') IS NOT NULL THEN
    INSERT INTO public.dress_distributions (
      id, registration_id, student_name, item_type, registered_size,
      status, received_at, staff_id, staff_name, notes
    ) VALUES (
      v_dist_id, v_student.id, v_student.full_name, 'reunion_tshirt',
      COALESCE(p_issued_size, v_student.t_shirt_size, 'L'),
      'RECEIVED', NOW(), COALESCE(public.current_staff_id(), public.current_admin_id(), p_staff_id), p_staff_name, p_notes
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_student.id,
    'student_name', v_student.full_name,
    'issued_size', COALESCE(p_issued_size, v_student.t_shirt_size)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_confirm_dress_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_dress_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_toggle_tshirt_distribution(
  p_reg_id TEXT,
  p_collected BOOLEAN,
  p_staff_id TEXT DEFAULT 'ADMIN',
  p_staff_name TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_reg RECORD;
  v_gate_status TEXT;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND public.current_event_staff_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Staff or administrator login required.');
  END IF;

  SELECT id, full_name, t_shirt_size, batch_name, is_checked_in, gate_status INTO v_reg
  FROM public.registrations_2027
  WHERE id = p_reg_id OR student_id = p_reg_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not found in registrations_2027: ' || p_reg_id);
  END IF;

  v_gate_status := COALESCE(v_reg.gate_status, CASE WHEN v_reg.is_checked_in THEN 'ENTRY' ELSE 'NOT_ENTERED' END);

  IF p_collected AND v_gate_status <> 'ENTRY' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'GATE_ENTRY_REQUIRED',
      'gate_status', v_gate_status,
      'message', 'GATE ENTRY REQUIRED: Cannot distribute T-shirt. Student must have ENTRY status through the gate first.'
    );
  END IF;

  UPDATE public.registrations_2027
  SET is_t_shirt_collected = p_collected
  WHERE id = v_reg.id;

  IF p_collected THEN
    INSERT INTO public.dress_distributions (
      id, registration_id, student_name, item_type, registered_size,
      status, received_at, staff_id, staff_name
    ) VALUES (
      'DRS-' || floor(extract(epoch from now()) * 1000)::text || '-' || floor(random() * 900 + 100)::text,
      v_reg.id,
      v_reg.full_name,
      'reunion_tshirt',
      COALESCE(v_reg.t_shirt_size, 'L'),
      'RECEIVED',
      now(),
      COALESCE(public.current_admin_id(), public.current_staff_id(), p_staff_id, 'ADMIN'),
      COALESCE(p_staff_name, 'Admin')
    )
    ON CONFLICT (registration_id, item_type)
    DO UPDATE SET
      status = 'RECEIVED',
      received_at = now(),
      staff_id = EXCLUDED.staff_id,
      staff_name = EXCLUDED.staff_name,
      registered_size = COALESCE(v_reg.t_shirt_size, dress_distributions.registered_size);
  ELSE
    UPDATE public.dress_distributions
    SET status = 'RETURNED',
        corrected_by = COALESCE(p_staff_name, 'Admin'),
        correction_reason = 'Admin toggled to Pending',
        corrected_at = now()
    WHERE registration_id = v_reg.id AND item_type = 'reunion_tshirt';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_reg.id,
    'collected', p_collected
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_toggle_tshirt_distribution(TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_toggle_tshirt_distribution(TEXT, BOOLEAN, TEXT, TEXT) TO authenticated, service_role;

-- 1.9 Legacy Staff Department Verification Helpers
DO $$
BEGIN
  IF to_regprocedure('public.rpc_verify_and_approve_service(text,text,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rpc_verify_and_approve_service(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.rpc_verify_and_approve_service(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_student_token_for_department(
  p_staff_auth_id UUID,
  p_token_or_id TEXT,
  p_department TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_staff RECORD;
  v_student_id TEXT;
  v_student_name TEXT;
  v_batch_name TEXT;
  v_tshirt_size TEXT;
  v_payment_status TEXT;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND (auth.uid() IS NULL OR (auth.uid() <> p_staff_auth_id AND public.current_admin_role() IS NULL))
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'status', 'UNAUTHORIZED', 'message', 'Caller session mismatch.');
  END IF;

  SELECT id, full_name, role, department, permissions, status
  INTO v_staff
  FROM public.staff_accounts
  WHERE auth_user_id = p_staff_auth_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'STAFF_NOT_FOUND', 'message', 'Staff profile does not exist or auth mismatch.');
  END IF;

  IF v_staff.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'status', 'ACCOUNT_DEACTIVATED', 'message', 'Staff account is deactivated.');
  END IF;

  IF v_staff.role != 'SUPER_ADMIN' AND v_staff.department != 'ALL_SERVICES' AND v_staff.department != p_department THEN
    RETURN jsonb_build_object('success', false, 'status', 'PERMISSION_DENIED', 'message', format('Staff assigned to %s cannot approve services in %s.', v_staff.department, p_department));
  END IF;

  IF v_staff.role != 'SUPER_ADMIN' AND NOT (v_staff.permissions ? 'APPROVE') THEN
    RETURN jsonb_build_object('success', false, 'status', 'PERMISSION_DENIED', 'message', 'Staff lacks APPROVE permission for this service station.');
  END IF;

  SELECT id, full_name, batch_name, t_shirt_size, payment_status
  INTO v_student_id, v_student_name, v_batch_name, v_tshirt_size, v_payment_status
  FROM public.registrations_2027
  WHERE UPPER(id) = UPPER(p_token_or_id) OR UPPER(qr_token) = UPPER(p_token_or_id)
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'INVALID_TOKEN', 'message', format('No registration found for token or ID "%s".', p_token_or_id));
  END IF;

  IF v_payment_status != 'paid' THEN
    RETURN jsonb_build_object('success', false, 'status', 'NOT_ELIGIBLE', 'message', format('Student registration is in "%s" state. Payment required.', v_payment_status));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'ELIGIBLE',
    'student', jsonb_build_object(
      'registration_id', v_student_id,
      'full_name', v_student_name,
      'batch_name', v_batch_name,
      't_shirt_size', v_tshirt_size,
      'payment_status', v_payment_status
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_student_token_for_department(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_student_token_for_department(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 1.10 Guest Card & Meal Scanner RPCs (Admin / Event Staff)
CREATE OR REPLACE FUNCTION public.rpc_generate_guest_card_batch(
    p_quantity INT,
    p_category TEXT DEFAULT 'HONORARY_GUEST',
    p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
    p_admin_name TEXT DEFAULT 'Super Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_qty INT := COALESCE(p_quantity, 10);
    v_cat TEXT := COALESCE(NULLIF(trim(p_category), ''), 'HONORARY_GUEST');
    v_batch_num INT;
    v_batch_id TEXT;
    v_batch_name TEXT;
    v_max_seq INT := 0;
    v_start_seq INT;
    v_end_seq INT;
    v_guest_id TEXT;
    v_reg_no TEXT;
    v_token TEXT;
    v_payload TEXT;
    v_alpha TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_rand_part TEXT;
    i INT;
    j INT;
BEGIN
    IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
       AND public.current_admin_role() IS NULL
       AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator login required to generate guest batches.');
    END IF;

    IF v_qty <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quantity must be at least 1');
    END IF;

    SELECT COALESCE(MAX(batch_number), 0) + 1 INTO v_batch_num FROM public.guest_card_batches;
    v_batch_id := 'BATCH-2027-' || LPAD(v_batch_num::TEXT, 3, '0');
    v_batch_name := 'Batch #' || v_batch_num || ' (' || v_qty || ' ' || v_cat || ' Passes)';

    SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^GUEST-0*', '', 'g'), '')::INT), 0)
    INTO v_max_seq
    FROM public.guest_cards
    WHERE id ~ '^GUEST-[0-9]+$';

    v_start_seq := v_max_seq + 1;
    v_end_seq := v_max_seq + v_qty;

    INSERT INTO public.guest_card_batches (
        id, batch_name, batch_number, total_cards, category, created_by, created_at
    ) VALUES (
        v_batch_id, v_batch_name, v_batch_num, v_qty, v_cat,
        p_admin_name || ' (' || COALESCE(public.current_admin_id(), p_admin_id) || ')', NOW()
    );

    FOR i IN v_start_seq..v_end_seq LOOP
        v_guest_id := 'GUEST-' || LPAD(i::TEXT, 4, '0');
        v_reg_no := 'PLSCF-GST-2027-' || LPAD(i::TEXT, 4, '0');

        v_rand_part := '';
        FOR j IN 1..6 LOOP
            v_rand_part := v_rand_part || substr(v_alpha, floor(random() * length(v_alpha) + 1)::INT, 1);
        END LOOP;
        v_token := 'GST-' || v_rand_part || '-' || upper(substr(md5(random()::text), 1, 3));

        v_payload := jsonb_build_object(
            'type', 'GUEST',
            'id', v_guest_id,
            'regNumber', v_reg_no,
            'token', v_token,
            'category', v_cat
        )::TEXT;

        INSERT INTO public.guest_cards (
            id, batch_id, reg_number, token, qr_payload, category, status, is_activated, created_at, updated_at
        ) VALUES (
            v_guest_id, v_batch_id, v_reg_no, v_token, v_payload, v_cat, 'INACTIVE', FALSE, NOW(), NOW()
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'batchId', v_batch_id,
        'batchName', v_batch_name,
        'quantity', v_qty
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_generate_guest_card_batch(INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_guest_card_batch(INT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_activate_guest_card(
    p_identifier TEXT,
    p_token TEXT DEFAULT NULL,
    p_gate_id TEXT DEFAULT 'Main Gate',
    p_scanner_id TEXT DEFAULT NULL,
    p_operator_id TEXT DEFAULT 'GATE_STAFF',
    p_operator_name TEXT DEFAULT 'Gate Staff'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_id TEXT := trim(COALESCE(p_identifier, ''));
    v_clean_tok TEXT := trim(COALESCE(p_token, ''));
    v_card RECORD;
    v_act_id TEXT;
BEGIN
    IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
       AND public.current_admin_role() IS NULL
       AND public.current_event_staff_role() IS NULL
       AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'UNAUTHORIZED', 'error', 'Staff or administrator login required to activate guest cards.');
    END IF;

    IF v_clean_id = '' AND v_clean_tok = '' THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'INVALID_INPUT', 'error', 'No guest QR token or ID provided.');
    END IF;

    IF v_clean_id LIKE '{%}' THEN
        BEGIN
            IF (v_clean_id::jsonb)->>'id' IS NOT NULL THEN
                v_clean_id := trim((v_clean_id::jsonb)->>'id');
            ELSIF (v_clean_id::jsonb)->>'regNumber' IS NOT NULL THEN
                v_clean_id := trim((v_clean_id::jsonb)->>'regNumber');
            END IF;
            IF v_clean_tok = '' AND (p_identifier::jsonb)->>'token' IS NOT NULL THEN
                v_clean_tok := trim((p_identifier::jsonb)->>'token');
            END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    SELECT * INTO v_card
    FROM public.guest_cards
    WHERE upper(id) = upper(v_clean_id)
       OR upper(reg_number) = upper(v_clean_id)
       OR upper(token) = upper(v_clean_id)
       OR (v_clean_tok <> '' AND upper(token) = upper(v_clean_tok))
    LIMIT 1;

    IF v_card.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'NOT_FOUND', 'error', 'Guest Pass "' || v_clean_id || '" not found in database. Please verify the QR code.');
    END IF;

    IF v_card.status = 'REVOKED' THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'REVOKED', 'error', 'Security Alert: This guest pass has been revoked by Super Admin.', 'revocationReason', v_card.revocation_reason);
    END IF;

    IF v_card.status = 'ACTIVE' OR v_card.is_activated IS TRUE THEN
        RETURN jsonb_build_object(
            'success', true,
            'alreadyActive', true,
            'message', 'GUEST CARD IS ALREADY ACTIVE',
            'card', jsonb_build_object(
                'id', v_card.id,
                'regNumber', v_card.reg_number,
                'token', v_card.token,
                'category', v_card.category,
                'status', 'ACTIVE',
                'isActivated', true,
                'activatedAt', v_card.activated_at,
                'activatedGate', v_card.activated_gate,
                'activatedByStaffName', v_card.activated_by_staff_name
            )
        );
    END IF;

    v_act_id := 'ACT-' || v_card.id || '-' || to_char(NOW(), 'YYYYMMDDHH24MISS');

    UPDATE public.guest_cards
    SET status = 'ACTIVE',
        is_activated = TRUE,
        activated_at = NOW(),
        activated_gate = COALESCE(NULLIF(trim(p_gate_id), ''), 'Main Gate 01'),
        activated_by_staff_id = COALESCE(public.current_staff_id(), public.current_admin_id(), p_operator_id),
        activated_by_staff_name = p_operator_name,
        updated_at = NOW()
    WHERE id = v_card.id;

    INSERT INTO public.guest_gate_activations (
        id, guest_id, token, gate_id, scanner_id, operator_id, operator_name, activation_time, status
    ) VALUES (
        v_act_id, v_card.id, v_card.token, COALESCE(NULLIF(trim(p_gate_id), ''), 'Main Gate 01'),
        p_scanner_id, COALESCE(public.current_staff_id(), public.current_admin_id(), p_operator_id), p_operator_name, NOW(), 'SUCCESS'
    ) ON CONFLICT (id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'alreadyActive', false,
        'message', 'Guest Pass Activated Successfully',
        'card', jsonb_build_object(
            'id', v_card.id,
            'regNumber', v_card.reg_number,
            'token', v_card.token,
            'category', v_card.category,
            'status', 'ACTIVE',
            'isActivated', true,
            'activatedAt', NOW(),
            'activatedGate', COALESCE(NULLIF(trim(p_gate_id), ''), 'Main Gate 01'),
            'activatedByStaffName', p_operator_name
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_activate_guest_card(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_activate_guest_card(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_collect_guest_food(
    p_identifier TEXT,
    p_meal_type TEXT,
    p_token TEXT DEFAULT NULL,
    p_staff_id TEXT DEFAULT 'FOOD_STAFF',
    p_staff_name TEXT DEFAULT 'Food Staff',
    p_counter_id TEXT DEFAULT 'Food Counter 01'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_id TEXT := trim(COALESCE(p_identifier, ''));
    v_clean_tok TEXT := trim(COALESCE(p_token, ''));
    v_clean_meal TEXT := lower(trim(COALESCE(p_meal_type, '')));
    v_card RECORD;
    v_existing RECORD;
    v_col_id TEXT;
    v_time_check JSONB;
BEGIN
    IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
       AND public.current_admin_role() IS NULL
       AND public.current_event_staff_role() IS NULL
       AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'UNAUTHORIZED', 'error', 'Staff or administrator login required for guest food collection.');
    END IF;

    IF v_clean_meal NOT IN ('breakfast', 'lunch', 'dinner') THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'INVALID_MEAL', 'error', 'Invalid meal type. Must be breakfast, lunch, or dinner.');
    END IF;

    v_time_check := public.check_meal_scanner_active(v_clean_meal);
    IF (v_time_check->>'is_open')::boolean IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'TIMEOUT',
            'error', 'Time Out',
            'message', COALESCE(v_time_check->>'error', 'Time Out: Meal distribution is currently closed.')
        );
    END IF;

    IF v_clean_id LIKE '{%}' THEN
        BEGIN
            IF (v_clean_id::jsonb)->>'id' IS NOT NULL THEN
                v_clean_id := trim((v_clean_id::jsonb)->>'id');
            ELSIF (v_clean_id::jsonb)->>'regNumber' IS NOT NULL THEN
                v_clean_id := trim((v_clean_id::jsonb)->>'regNumber');
            END IF;
            IF v_clean_tok = '' AND (p_identifier::jsonb)->>'token' IS NOT NULL THEN
                v_clean_tok := trim((p_identifier::jsonb)->>'token');
            END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    SELECT * INTO v_card
    FROM public.guest_cards
    WHERE upper(id) = upper(v_clean_id)
       OR upper(reg_number) = upper(v_clean_id)
       OR upper(token) = upper(v_clean_id)
       OR (v_clean_tok <> '' AND upper(token) = upper(v_clean_tok))
    LIMIT 1;

    IF v_card.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'NOT_FOUND', 'error', 'Guest Pass "' || v_clean_id || '" not found in database.');
    END IF;

    IF v_card.status = 'INACTIVE' OR v_card.is_activated IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'INACTIVE_CARD',
            'error', 'Guest card has NOT been activated at the Main Gate. Food collection is only permitted after Gate entry.',
            'card', jsonb_build_object('id', v_card.id, 'status', 'INACTIVE')
        );
    END IF;

    IF v_card.status = 'REVOKED' THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'REVOKED', 'error', 'This guest pass is revoked.');
    END IF;

    SELECT * INTO v_existing
    FROM public.guest_food_collections
    WHERE guest_id = v_card.id AND meal_type = v_clean_meal
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'ALREADY_COLLECTED',
            'error', 'ALREADY COLLECTED',
            'message', 'ALREADY COLLECTED',
            'collectedAt', v_existing.collected_at,
            'staffName', v_existing.staff_name
        );
    END IF;

    v_col_id := 'MEAL-' || v_card.id || '-' || v_clean_meal || '-' || to_char(NOW(), 'YYYYMMDDHH24MISS');

    INSERT INTO public.guest_food_collections (
        id, guest_id, token, meal_type, status, collected_at, staff_id, staff_name, counter_id
    ) VALUES (
        v_col_id, v_card.id, v_card.token, v_clean_meal, 'COLLECTED', NOW(),
        COALESCE(public.current_staff_id(), public.current_admin_id(), p_staff_id), p_staff_name, p_counter_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Guest meal recorded successfully',
        'record', jsonb_build_object(
            'id', v_col_id,
            'guestId', v_card.id,
            'mealType', v_clean_meal,
            'collectedAt', NOW(),
            'status', 'COLLECTED'
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_collect_guest_food(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_collect_guest_food(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_revoke_guest_card(
    p_guest_id TEXT,
    p_reason TEXT,
    p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
    p_admin_name TEXT DEFAULT 'Super Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
       AND public.current_admin_role() IS NULL
       AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator login required to revoke guest cards.');
    END IF;

    UPDATE public.guest_cards
    SET status = 'REVOKED',
        revocation_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Revoked by administrator'),
        revoked_at = NOW(),
        revoked_by = p_admin_name,
        updated_at = NOW()
    WHERE id = p_guest_id;

    RETURN jsonb_build_object('success', true, 'message', 'Guest card revoked successfully.');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_revoke_guest_card(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_guest_card(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_update_meal_schedule(
  p_meal_type TEXT,
  p_start_time TEXT,
  p_end_time TEXT,
  p_mode TEXT,
  p_enabled BOOLEAN,
  p_updated_by TEXT DEFAULT 'Super Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_meal TEXT := lower(trim(COALESCE(p_meal_type, '')));
  v_mode TEXT := upper(trim(COALESCE(p_mode, 'SCHEDULED')));
  v_res RECORD;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator login required to update meal schedule.');
  END IF;

  IF v_meal NOT IN ('breakfast', 'lunch', 'dinner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid meal type: ' || p_meal_type);
  END IF;

  IF v_mode NOT IN ('SCHEDULED', 'MANUAL_ON', 'MANUAL_OFF') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid scanner mode: ' || p_mode);
  END IF;

  INSERT INTO public.meal_scanner_controls (
    id, meal_type, start_time, end_time, mode, enabled, updated_by, updated_at
  ) VALUES (
    v_meal, v_meal, p_start_time, p_end_time, v_mode, COALESCE(p_enabled, true), COALESCE(p_updated_by, 'Super Admin'), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    mode = EXCLUDED.mode,
    enabled = EXCLUDED.enabled,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING * INTO v_res;

  RETURN jsonb_build_object('success', true, 'schedule', row_to_json(v_res));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_meal_schedule(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_meal_schedule(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated, service_role;

-- 1.11 Staff Card RPCs (with fixed JSONB check_meal_scanner_active parsing + role checks)
CREATE OR REPLACE FUNCTION public.rpc_generate_staff_card_batch(
    p_count INT,
    p_category TEXT DEFAULT 'EVENT_STAFF',
    p_created_by TEXT DEFAULT 'SUPER_ADMIN',
    p_batch_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_batch_num INT;
    v_batch_id TEXT;
    v_batch_title TEXT;
    v_current_max_id INT;
    v_next_id_num INT;
    v_card_id TEXT;
    v_reg_num TEXT;
    v_token TEXT;
    v_qr_payload TEXT;
    v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    v_token_body TEXT;
    v_i INT;
    v_j INT;
    v_rand_idx INT;
    v_inserted_count INT := 0;
BEGIN
    IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
       AND public.current_admin_role() IS NULL
       AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator login required to generate staff cards.');
    END IF;

    IF p_count < 1 OR p_count > 500 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid count. Must be between 1 and 500.');
    END IF;

    SELECT COALESCE(MAX(batch_number), 0) + 1 INTO v_batch_num FROM public.staff_card_batches;
    v_batch_id := 'STF-BATCH-2027-' || LPAD(v_batch_num::TEXT, 3, '0');
    v_batch_title := COALESCE(NULLIF(TRIM(p_batch_name), ''), 'Staff Batch ' || v_batch_num || ' (' || p_category || ')');

    INSERT INTO public.staff_card_batches (id, batch_name, batch_number, total_cards, category, created_by, created_at)
    VALUES (v_batch_id, v_batch_title, v_batch_num, p_count, p_category, p_created_by, NOW());

    SELECT COALESCE(MAX(SUBSTRING(id FROM 'STF-([0-9]+)')::INT), 0) INTO v_current_max_id FROM public.staff_cards;
    v_next_id_num := v_current_max_id + 1;

    FOR v_i IN 1..p_count LOOP
        v_card_id := 'STF-' || LPAD(v_next_id_num::TEXT, 4, '0');
        v_reg_num := 'PLSCF-STF-2027-' || LPAD(v_next_id_num::TEXT, 4, '0');

        v_token_body := '';
        FOR v_j IN 1..6 LOOP
            v_rand_idx := floor(random() * length(v_chars) + 1)::INT;
            v_token_body := v_token_body || substr(v_chars, v_rand_idx, 1);
        END LOOP;
        v_token := 'STF-' || v_token_body;

        v_qr_payload := jsonb_build_object(
            'type', 'STAFF',
            'id', v_card_id,
            'regNumber', v_reg_num,
            'token', v_token,
            'category', p_category,
            'event', 'PLSCF_REUNION_2027'
        )::TEXT;

        INSERT INTO public.staff_cards (
            id, batch_id, reg_number, token, qr_payload, category, status, is_activated,
            staff_name, designation, mobile_number, department, notes, meal_facilities,
            generation_date, created_at, updated_at
        ) VALUES (
            v_card_id, v_batch_id, v_reg_num, v_token, v_qr_payload, p_category, 'INACTIVE', FALSE,
            NULL, NULL, NULL, NULL, NULL, '{}',
            NOW(), NOW(), NOW()
        );

        v_next_id_num := v_next_id_num + 1;
        v_inserted_count := v_inserted_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'batchId', v_batch_id,
        'batchName', v_batch_title,
        'cardsGenerated', v_inserted_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_generate_staff_card_batch(INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_staff_card_batch(INT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_activate_staff_card(
    p_identifier TEXT,
    p_token TEXT DEFAULT NULL,
    p_staff_name TEXT DEFAULT NULL,
    p_designation TEXT DEFAULT NULL,
    p_mobile_number TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL,
    p_meal_facilities TEXT[] DEFAULT '{}',
    p_notes TEXT DEFAULT NULL,
    p_activated_by TEXT DEFAULT 'SUPER_ADMIN',
    p_gate_id TEXT DEFAULT 'Main Gate / Admin Desk'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_card RECORD;
    v_act_id TEXT;
BEGIN
    IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
       AND public.current_admin_role() IS NULL
       AND public.current_event_staff_role() IS NULL
       AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'UNAUTHORIZED', 'error', 'Staff or administrator login required to activate staff cards.');
    END IF;

    SELECT * INTO v_card FROM public.staff_cards
    WHERE id = p_identifier OR reg_number = p_identifier OR token = p_identifier
       OR (p_token IS NOT NULL AND token = p_token)
    LIMIT 1;

    IF v_card IS NULL THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'CARD_NOT_FOUND', 'error', 'Staff card not found.');
    END IF;

    IF v_card.status = 'REVOKED' THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'CARD_REVOKED', 'error', 'Staff card is REVOKED and cannot be activated.');
    END IF;

    UPDATE public.staff_cards
    SET status = 'ACTIVE',
        is_activated = TRUE,
        staff_name = COALESCE(NULLIF(TRIM(p_staff_name), ''), v_card.staff_name, 'Staff Member'),
        designation = COALESCE(NULLIF(TRIM(p_designation), ''), v_card.designation, 'Event Volunteer'),
        mobile_number = COALESCE(NULLIF(TRIM(p_mobile_number), ''), v_card.mobile_number),
        department = COALESCE(NULLIF(TRIM(p_department), ''), v_card.department, 'Operations'),
        meal_facilities = COALESCE(p_meal_facilities, v_card.meal_facilities, '{}'),
        notes = COALESCE(p_notes, v_card.notes),
        activated_at = COALESCE(v_card.activated_at, NOW()),
        activated_gate = p_gate_id,
        activated_by_staff_name = p_activated_by,
        updated_at = NOW()
    WHERE id = v_card.id;

    v_act_id := 'ACT-STF-' || v_card.id || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT;
    INSERT INTO public.staff_card_activations (
        id, card_id, token, staff_name, designation, meal_facilities,
        operator_id, operator_name, activation_time, status
    ) VALUES (
        v_act_id, v_card.id, v_card.token,
        COALESCE(p_staff_name, v_card.staff_name),
        COALESCE(p_designation, v_card.designation),
        p_meal_facilities,
        COALESCE(public.current_admin_id(), public.current_staff_id(), p_activated_by),
        p_activated_by, NOW(), 'ACTIVE'
    ) ON CONFLICT (id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Staff card activated and entitlements configured successfully.',
        'cardId', v_card.id,
        'staffName', COALESCE(p_staff_name, v_card.staff_name),
        'mealFacilities', p_meal_facilities
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_activate_staff_card(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_activate_staff_card(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_collect_staff_food(
    p_identifier TEXT,
    p_meal_type TEXT,
    p_token TEXT DEFAULT NULL,
    p_staff_id TEXT DEFAULT 'FOOD_DESK_01',
    p_staff_name TEXT DEFAULT 'Food Desk Operator',
    p_counter_id TEXT DEFAULT 'Staff Counter'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_card RECORD;
    v_col_id TEXT;
    v_time_check JSONB;
    v_meal_lower TEXT := LOWER(TRIM(p_meal_type));
BEGIN
    IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
       AND public.current_admin_role() IS NULL
       AND public.current_event_staff_role() IS NULL
       AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
    THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'UNAUTHORIZED', 'error', 'Unauthorized', 'message', 'Staff or administrator login required for staff meal collection.');
    END IF;

    SELECT * INTO v_card FROM public.staff_cards
    WHERE id = p_identifier OR reg_number = p_identifier OR token = p_identifier
       OR (p_token IS NOT NULL AND token = p_token)
    LIMIT 1;

    IF v_card IS NULL THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'CARD_NOT_FOUND', 'error', 'Staff card not found.', 'message', 'No matching staff card record found.');
    END IF;

    IF v_card.status = 'INACTIVE' OR NOT v_card.is_activated THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'CARD_NOT_ACTIVATED', 'error', 'Card Not Activated', 'message', 'Staff card ' || v_card.id || ' is inactive. The Super Admin must activate this card before meals can be collected.');
    END IF;

    IF v_card.status = 'REVOKED' THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'CARD_REVOKED', 'error', 'Card Revoked', 'message', 'Staff card ' || v_card.id || ' has been revoked. Access denied.');
    END IF;

    IF NOT (v_meal_lower = ANY(v_card.meal_facilities)) THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'MEAL_NOT_ASSIGNED', 'error', 'Meal Not Assigned', 'message', 'Staff card ' || v_card.id || ' is not authorized for ' || INITCAP(v_meal_lower) || '.');
    END IF;

    v_time_check := public.check_meal_scanner_active(v_meal_lower);
    IF (v_time_check->>'is_open')::boolean IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'TIMEOUT',
            'error', 'Time Out',
            'message', COALESCE(v_time_check->>'error', 'Meal scanning is inactive or the scheduled time has expired for ' || INITCAP(v_meal_lower) || '.')
        );
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.staff_food_collections
        WHERE card_id = v_card.id AND meal_type = v_meal_lower
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'ALREADY_COLLECTED',
            'error', 'Already Collected',
            'message', INITCAP(v_meal_lower) || ' has already been claimed for staff card ' || v_card.id || '.'
        );
    END IF;

    v_col_id := 'COL-STF-' || v_card.id || '-' || v_meal_lower;
    INSERT INTO public.staff_food_collections (
        id, card_id, token, meal_type, status, collected_at,
        staff_id, staff_name, counter_id, staff_member_name
    ) VALUES (
        v_col_id, v_card.id, v_card.token, v_meal_lower, 'COLLECTED', NOW(),
        COALESCE(public.current_staff_id(), public.current_admin_id(), p_staff_id), p_staff_name, p_counter_id, v_card.staff_name
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', INITCAP(v_meal_lower) || ' collection confirmed successfully for ' || COALESCE(v_card.staff_name, v_card.id) || '.',
        'record', jsonb_build_object(
            'id', v_col_id,
            'cardId', v_card.id,
            'mealType', v_meal_lower,
            'staffMemberName', v_card.staff_name,
            'collectedAt', NOW()
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_collect_staff_food(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_collect_staff_food(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 1.12 Staff balance & internal helper locks
CREATE OR REPLACE FUNCTION public.get_staff_remaining_balance(p_staff_id TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_allocated NUMERIC := 0;
  v_expenses NUMERIC := 0;
  v_returns NUMERIC := 0;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role'
     AND public.current_admin_role() IS NULL
     AND COALESCE(public.current_staff_id(), '') <> COALESCE(p_staff_id, '')
     AND NOT (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Access denied for staff balance lookup.';
  END IF;

  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_allocated
  FROM public.staff_allocations
  WHERE staff_id = p_staff_id AND status = 'ACTIVE';

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.staff_expenses
  WHERE staff_id = p_staff_id AND status IN ('SUBMITTED', 'APPROVED');

  SELECT COALESCE(SUM(amount), 0) INTO v_returns
  FROM public.financial_ledger
  WHERE staff_id = p_staff_id AND transaction_type = 'CASH_RETURN';

  RETURN (v_allocated - v_expenses - v_returns);
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_remaining_balance(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_remaining_balance(TEXT) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.current_admin_id()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.current_admin_id() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.current_admin_id() TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.current_staff_id()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.current_staff_id() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.is_super_admin_caller()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.is_super_admin_caller() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_super_admin_caller() TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.is_finance_manager_of_staff(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.is_finance_manager_of_staff(TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_finance_manager_of_staff(TEXT) TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.is_protected_super_admin_identity(text,text,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.is_protected_super_admin_identity(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_protected_super_admin_identity(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.check_meal_scanner_active(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.check_meal_scanner_active(TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.check_meal_scanner_active(TEXT) TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.sync_donations_2027_to_canonical()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.sync_donations_2027_to_canonical() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.sync_donations_2027_to_canonical() TO service_role;
  END IF;
  IF to_regprocedure('public.fn_generate_six_char_token()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.fn_generate_six_char_token() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.fn_generate_six_char_token() TO service_role;
  END IF;
  IF to_regprocedure('public.trg_prevent_ledger_mutation()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.trg_prevent_ledger_mutation() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.trg_prevent_ledger_mutation() TO service_role;
  END IF;
  IF to_regprocedure('public.trg_sync_dress_distribution_to_registration()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.trg_sync_dress_distribution_to_registration() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.trg_sync_dress_distribution_to_registration() TO service_role;
  END IF;
  IF to_regprocedure('public.fn_protect_immutable_super_admin()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.fn_protect_immutable_super_admin() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.fn_protect_immutable_super_admin() TO service_role;
  END IF;
  IF to_regprocedure('public.fn_protect_immutable_super_admin_staff()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.fn_protect_immutable_super_admin_staff() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.fn_protect_immutable_super_admin_staff() TO service_role;
  END IF;
  IF to_regprocedure('public.fn_protect_immutable_super_admin_auth()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.fn_protect_immutable_super_admin_auth() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.fn_protect_immutable_super_admin_auth() TO service_role;
  END IF;
END $$;

-- Note: Public RPCs intentionally preserved for anonymous public flows:
-- rpc_get_public_governance_settings, rpc_get_public_reunion_stats,
-- rpc_lookup_ticket, rpc_lookup_donation, rpc_verify_student_qr,
-- rpc_verify_student_id, rpc_reserve_student_id, rpc_release_student_id_reservation,
-- rpc_get_financial_transparency_summary, rpc_verify_personal_donation_history,
-- rpc_resolve_login_email, current_admin_role, current_event_staff_role.

-- ============================================================================
-- PART 2 (F-02): REPLACE CUMULATIVE USING (true) / WITH CHECK (true) POLICIES
-- ============================================================================

-- 2.1 Drop legacy leftover permissive policies never removed in 20270305/20270310
DO $$
BEGIN
  IF to_regclass('public.admin_accounts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can view their own profile" ON public.admin_accounts;
  END IF;

  IF to_regclass('public.staff_accounts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Super admin full management on staff_accounts" ON public.staff_accounts;
    DROP POLICY IF EXISTS "Public staff login check" ON public.staff_accounts;
  END IF;

  IF to_regclass('public.staff_expenses') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admin can update expenses" ON public.staff_expenses;
    DROP POLICY IF EXISTS "Staff can view their own expenses" ON public.staff_expenses;
    DROP POLICY IF EXISTS "Staff can insert expenses" ON public.staff_expenses;
  END IF;

  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Ledger entries append-only" ON public.financial_ledger;
    DROP POLICY IF EXISTS "Ledger viewable by authenticated users" ON public.financial_ledger;
  END IF;

  IF to_regclass('public.donations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admin full control on donations" ON public.donations;
    DROP POLICY IF EXISTS "Public can view donations" ON public.donations;
    DROP POLICY IF EXISTS "Public select donations" ON public.donations;
    DROP POLICY IF EXISTS "Public insert donations" ON public.donations;
    DROP POLICY IF EXISTS "Public update donations" ON public.donations;
    DROP POLICY IF EXISTS "Public delete donations" ON public.donations;
  END IF;

  IF to_regclass('public.current_student_ids') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public can insert current student ids" ON public.current_student_ids;
    DROP POLICY IF EXISTS "Public can update current student ids" ON public.current_student_ids;
    DROP POLICY IF EXISTS "Public can delete current student ids" ON public.current_student_ids;
  END IF;
END $$;

-- 2.2 Audit tables
DO $$
BEGIN
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow authenticated read of audit logs" ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "Allow inserting audit logs" ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "allow_insert_admin_audit_logs" ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "allow_read_admin_audit_logs" ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "admin_audit_logs_service_all" ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "admin_audit_logs_admin_read" ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "admin_audit_logs_staff_insert" ON public.admin_audit_logs;

    REVOKE ALL ON public.admin_audit_logs FROM PUBLIC, anon;
    GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
    GRANT ALL ON public.admin_audit_logs TO service_role;

    CREATE POLICY "admin_audit_logs_service_all" ON public.admin_audit_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "admin_audit_logs_admin_read" ON public.admin_audit_logs
      FOR SELECT TO authenticated USING (public.current_admin_role() IS NOT NULL);
    CREATE POLICY "admin_audit_logs_staff_insert" ON public.admin_audit_logs
      FOR INSERT TO authenticated WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.admin_audit_history') IS NOT NULL THEN
    ALTER TABLE public.admin_audit_history ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Audit history append-only" ON public.admin_audit_history;
    DROP POLICY IF EXISTS "Audit history viewable by super admin" ON public.admin_audit_history;
    DROP POLICY IF EXISTS "allow_all_admin_audit_history" ON public.admin_audit_history;
    DROP POLICY IF EXISTS "admin_audit_history_service_all" ON public.admin_audit_history;
    DROP POLICY IF EXISTS "admin_audit_history_admin_read" ON public.admin_audit_history;
    DROP POLICY IF EXISTS "admin_audit_history_staff_insert" ON public.admin_audit_history;

    REVOKE ALL ON public.admin_audit_history FROM PUBLIC, anon;
    GRANT SELECT, INSERT ON public.admin_audit_history TO authenticated;
    GRANT ALL ON public.admin_audit_history TO service_role;

    CREATE POLICY "admin_audit_history_service_all" ON public.admin_audit_history
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "admin_audit_history_admin_read" ON public.admin_audit_history
      FOR SELECT TO authenticated USING (public.current_admin_role() IS NOT NULL);
    CREATE POLICY "admin_audit_history_staff_insert" ON public.admin_audit_history
      FOR INSERT TO authenticated WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.manual_registration_audit_logs') IS NOT NULL THEN
    ALTER TABLE public.manual_registration_audit_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "manual_reg_audit_insert_all" ON public.manual_registration_audit_logs;
    DROP POLICY IF EXISTS "manual_reg_audit_select_all" ON public.manual_registration_audit_logs;
    DROP POLICY IF EXISTS "manual_reg_audit_service_all" ON public.manual_registration_audit_logs;
    DROP POLICY IF EXISTS "manual_reg_audit_admin_read" ON public.manual_registration_audit_logs;
    DROP POLICY IF EXISTS "manual_reg_audit_admin_insert" ON public.manual_registration_audit_logs;

    REVOKE ALL ON public.manual_registration_audit_logs FROM PUBLIC, anon;
    GRANT SELECT, INSERT ON public.manual_registration_audit_logs TO authenticated;
    GRANT ALL ON public.manual_registration_audit_logs TO service_role;

    CREATE POLICY "manual_reg_audit_service_all" ON public.manual_registration_audit_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "manual_reg_audit_admin_read" ON public.manual_registration_audit_logs
      FOR SELECT TO authenticated USING (public.current_admin_role() IS NOT NULL);
    CREATE POLICY "manual_reg_audit_admin_insert" ON public.manual_registration_audit_logs
      FOR INSERT TO authenticated WITH CHECK (public.current_admin_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.manual_registrations') IS NOT NULL THEN
    ALTER TABLE public.manual_registrations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "manual_registrations_select_all" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_write_all" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_service_all" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_admin_read" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_admin_insert" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_admin_update" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_admin_delete" ON public.manual_registrations;

    REVOKE ALL ON public.manual_registrations FROM PUBLIC, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_registrations TO authenticated;
    GRANT ALL ON public.manual_registrations TO service_role;

    CREATE POLICY "manual_registrations_service_all" ON public.manual_registrations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "manual_registrations_admin_read" ON public.manual_registrations
      FOR SELECT TO authenticated USING (public.current_admin_role() IS NOT NULL);
    CREATE POLICY "manual_registrations_admin_insert" ON public.manual_registrations
      FOR INSERT TO authenticated WITH CHECK (public.current_admin_role() IS NOT NULL);
    CREATE POLICY "manual_registrations_admin_update" ON public.manual_registrations
      FOR UPDATE TO authenticated USING (public.current_admin_role() IS NOT NULL) WITH CHECK (public.current_admin_role() IS NOT NULL);
    CREATE POLICY "manual_registrations_admin_delete" ON public.manual_registrations
      FOR DELETE TO authenticated USING (public.current_admin_role() IN ('super_admin', 'admin'));
  END IF;
END $$;

-- 2.3 Financial Transparency & Voucher tables
DO $$
BEGIN
  IF to_regclass('public.financial_audit_logs') IS NOT NULL THEN
    ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admin full control on financial audit logs" ON public.financial_audit_logs;
    DROP POLICY IF EXISTS "Public can view financial audit logs" ON public.financial_audit_logs;
    DROP POLICY IF EXISTS "financial_audit_logs_service_all" ON public.financial_audit_logs;
    DROP POLICY IF EXISTS "financial_audit_logs_admin_read" ON public.financial_audit_logs;
    DROP POLICY IF EXISTS "financial_audit_logs_finance_insert" ON public.financial_audit_logs;

    REVOKE ALL ON public.financial_audit_logs FROM PUBLIC, anon;
    GRANT SELECT, INSERT ON public.financial_audit_logs TO authenticated;
    GRANT ALL ON public.financial_audit_logs TO service_role;

    CREATE POLICY "financial_audit_logs_service_all" ON public.financial_audit_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "financial_audit_logs_admin_read" ON public.financial_audit_logs
      FOR SELECT TO authenticated USING (public.current_admin_role() IN ('super_admin', 'finance_manager', 'admin'));
    CREATE POLICY "financial_audit_logs_finance_insert" ON public.financial_audit_logs
      FOR INSERT TO authenticated WITH CHECK (public.current_admin_role() IN ('super_admin', 'finance_manager'));
  END IF;

  IF to_regclass('public.expenses') IS NOT NULL THEN
    ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admin full control on expenses" ON public.expenses;
    DROP POLICY IF EXISTS "Public can view approved expenses" ON public.expenses;
    DROP POLICY IF EXISTS "expenses_service_all" ON public.expenses;
    DROP POLICY IF EXISTS "expenses_public_read_approved" ON public.expenses;

    REVOKE ALL ON public.expenses FROM PUBLIC, anon;
    GRANT SELECT ON public.expenses TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
    GRANT ALL ON public.expenses TO service_role;

    CREATE POLICY "expenses_service_all" ON public.expenses
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "expenses_public_read_approved" ON public.expenses
      FOR SELECT TO anon, authenticated USING (status = 'approved' OR public.current_admin_role() IN ('super_admin', 'finance_manager', 'admin'));
  END IF;

  IF to_regclass('public.expense_categories') IS NOT NULL THEN
    ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admin full control on expense categories" ON public.expense_categories;
    DROP POLICY IF EXISTS "Public can view expense categories" ON public.expense_categories;
    DROP POLICY IF EXISTS "expense_categories_service_all" ON public.expense_categories;
    DROP POLICY IF EXISTS "expense_categories_public_read" ON public.expense_categories;
    DROP POLICY IF EXISTS "expense_categories_finance_write" ON public.expense_categories;

    REVOKE ALL ON public.expense_categories FROM PUBLIC, anon;
    GRANT SELECT ON public.expense_categories TO anon, authenticated;
    GRANT INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
    GRANT ALL ON public.expense_categories TO service_role;

    CREATE POLICY "expense_categories_service_all" ON public.expense_categories
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "expense_categories_public_read" ON public.expense_categories
      FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY "expense_categories_finance_write" ON public.expense_categories
      FOR ALL TO authenticated USING (public.current_admin_role() IN ('super_admin', 'finance_manager')) WITH CHECK (public.current_admin_role() IN ('super_admin', 'finance_manager'));
  END IF;

  IF to_regclass('public.financial_transactions') IS NOT NULL THEN
    ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admin full control on financial transactions" ON public.financial_transactions;
    DROP POLICY IF EXISTS "Public can view financial transactions" ON public.financial_transactions;
    DROP POLICY IF EXISTS "financial_transactions_service_all" ON public.financial_transactions;
    DROP POLICY IF EXISTS "financial_transactions_finance_read" ON public.financial_transactions;
    DROP POLICY IF EXISTS "financial_transactions_finance_write" ON public.financial_transactions;

    REVOKE ALL ON public.financial_transactions FROM PUBLIC, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated;
    GRANT ALL ON public.financial_transactions TO service_role;

    CREATE POLICY "financial_transactions_service_all" ON public.financial_transactions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "financial_transactions_finance_read" ON public.financial_transactions
      FOR SELECT TO authenticated USING (public.current_admin_role() IN ('super_admin', 'finance_manager', 'admin'));
    CREATE POLICY "financial_transactions_finance_write" ON public.financial_transactions
      FOR ALL TO authenticated USING (public.current_admin_role() IN ('super_admin', 'finance_manager')) WITH CHECK (public.current_admin_role() IN ('super_admin', 'finance_manager'));
  END IF;
END $$;

-- 2.4 Event Operations Tables (Gate, Food, Dress, Meal Controls, Scanner Logs)
DO $$
DECLARE
  v_tbl TEXT;
BEGIN
  IF to_regclass('public.food_distributions') IS NOT NULL THEN
    ALTER TABLE public.food_distributions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "food_distributions_all_access" ON public.food_distributions;
    DROP POLICY IF EXISTS "Public and staff can view food distribution" ON public.food_distributions;
    DROP POLICY IF EXISTS "Staff can insert food distribution" ON public.food_distributions;
    DROP POLICY IF EXISTS "Super admin can update food distributions" ON public.food_distributions;
    DROP POLICY IF EXISTS "food_distributions_service_all" ON public.food_distributions;
    DROP POLICY IF EXISTS "food_distributions_staff_rw" ON public.food_distributions;
    DROP POLICY IF EXISTS "food_distributions_admin_delete" ON public.food_distributions;

    REVOKE ALL ON public.food_distributions FROM PUBLIC, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_distributions TO authenticated;
    GRANT ALL ON public.food_distributions TO service_role;

    CREATE POLICY "food_distributions_service_all" ON public.food_distributions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "food_distributions_staff_rw" ON public.food_distributions
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.dress_distributions') IS NOT NULL THEN
    ALTER TABLE public.dress_distributions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "dress_distributions_all_access" ON public.dress_distributions;
    DROP POLICY IF EXISTS "Dress distributions viewable by staff" ON public.dress_distributions;
    DROP POLICY IF EXISTS "Dress staff can log dress distribution" ON public.dress_distributions;
    DROP POLICY IF EXISTS "dress_distributions_service_all" ON public.dress_distributions;
    DROP POLICY IF EXISTS "dress_distributions_staff_rw" ON public.dress_distributions;

    REVOKE ALL ON public.dress_distributions FROM PUBLIC, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.dress_distributions TO authenticated;
    GRANT ALL ON public.dress_distributions TO service_role;

    CREATE POLICY "dress_distributions_service_all" ON public.dress_distributions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "dress_distributions_staff_rw" ON public.dress_distributions
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.gate_events') IS NOT NULL THEN
    ALTER TABLE public.gate_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "gate_events_all_access" ON public.gate_events;
    DROP POLICY IF EXISTS "Gate events viewable by staff" ON public.gate_events;
    DROP POLICY IF EXISTS "Gate staff can log gate events" ON public.gate_events;
    DROP POLICY IF EXISTS "gate_events_service_all" ON public.gate_events;
    DROP POLICY IF EXISTS "gate_events_staff_rw" ON public.gate_events;

    REVOKE ALL ON public.gate_events FROM PUBLIC, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.gate_events TO authenticated;
    GRANT ALL ON public.gate_events TO service_role;

    CREATE POLICY "gate_events_service_all" ON public.gate_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "gate_events_staff_rw" ON public.gate_events
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.scanner_logs') IS NOT NULL THEN
    ALTER TABLE public.scanner_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admins can view scan logs" ON public.scanner_logs;
    DROP POLICY IF EXISTS "Allow logging scan events" ON public.scanner_logs;
    DROP POLICY IF EXISTS "scanner_logs_service_all" ON public.scanner_logs;
    DROP POLICY IF EXISTS "scanner_logs_staff_rw" ON public.scanner_logs;

    REVOKE ALL ON public.scanner_logs FROM PUBLIC, anon;
    GRANT SELECT, INSERT ON public.scanner_logs TO authenticated;
    GRANT ALL ON public.scanner_logs TO service_role;

    CREATE POLICY "scanner_logs_service_all" ON public.scanner_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "scanner_logs_staff_rw" ON public.scanner_logs
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.meal_scanner_controls') IS NOT NULL THEN
    ALTER TABLE public.meal_scanner_controls ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "meal_scanner_controls_select_all" ON public.meal_scanner_controls;
    DROP POLICY IF EXISTS "meal_scanner_controls_write_all" ON public.meal_scanner_controls;
    DROP POLICY IF EXISTS "meal_scanner_controls_service_all" ON public.meal_scanner_controls;
    DROP POLICY IF EXISTS "meal_scanner_controls_staff_read" ON public.meal_scanner_controls;
    DROP POLICY IF EXISTS "meal_scanner_controls_admin_write" ON public.meal_scanner_controls;

    REVOKE ALL ON public.meal_scanner_controls FROM PUBLIC, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_scanner_controls TO authenticated;
    GRANT ALL ON public.meal_scanner_controls TO service_role;

    CREATE POLICY "meal_scanner_controls_service_all" ON public.meal_scanner_controls
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "meal_scanner_controls_staff_read" ON public.meal_scanner_controls
      FOR SELECT TO authenticated
      USING (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
    CREATE POLICY "meal_scanner_controls_admin_write" ON public.meal_scanner_controls
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL);
  END IF;

  -- Guest & Staff Card pass tables
  FOREACH v_tbl IN ARRAY ARRAY[
    'guest_card_batches', 'guest_cards', 'guest_gate_activations', 'guest_food_collections',
    'staff_card_batches', 'staff_cards', 'staff_card_activations', 'staff_food_collections'
  ] LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow select ' || v_tbl, v_tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all ' || v_tbl, v_tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_tbl || '_service_all', v_tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_tbl || '_staff_rw', v_tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', v_tbl);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', v_tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', v_tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        v_tbl || '_service_all', v_tbl
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL) WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)',
        v_tbl || '_staff_rw', v_tbl
      );
    END IF;
  END LOOP;
END $$;

-- 2.5 Public CMS Read + Admin Write Tables (gallery_media, about_contact_content, inquiries)
DO $$
BEGIN
  IF to_regclass('public.gallery_media') IS NOT NULL THEN
    ALTER TABLE public.gallery_media ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admins full access to gallery media" ON public.gallery_media;
    DROP POLICY IF EXISTS "gallery_media_service_all" ON public.gallery_media;
    DROP POLICY IF EXISTS "gallery_media_admin_write" ON public.gallery_media;

    REVOKE INSERT, UPDATE, DELETE ON public.gallery_media FROM PUBLIC, anon;
    GRANT SELECT ON public.gallery_media TO anon, authenticated;
    GRANT INSERT, UPDATE, DELETE ON public.gallery_media TO authenticated;
    GRANT ALL ON public.gallery_media TO service_role;

    CREATE POLICY "gallery_media_service_all" ON public.gallery_media
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "gallery_media_admin_write" ON public.gallery_media
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.about_contact_content') IS NOT NULL THEN
    ALTER TABLE public.about_contact_content ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "about_contact_content_write_all" ON public.about_contact_content;
    DROP POLICY IF EXISTS "about_contact_content_service_all" ON public.about_contact_content;
    DROP POLICY IF EXISTS "about_contact_content_admin_write" ON public.about_contact_content;

    REVOKE INSERT, UPDATE, DELETE ON public.about_contact_content FROM PUBLIC, anon;
    GRANT SELECT ON public.about_contact_content TO anon, authenticated;
    GRANT INSERT, UPDATE, DELETE ON public.about_contact_content TO authenticated;
    GRANT ALL ON public.about_contact_content TO service_role;

    CREATE POLICY "about_contact_content_service_all" ON public.about_contact_content
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "about_contact_content_admin_write" ON public.about_contact_content
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.inquiries') IS NOT NULL THEN
    ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public visitors can submit inquiries" ON public.inquiries;
    DROP POLICY IF EXISTS "inquiries_public_insert" ON public.inquiries;
    DROP POLICY IF EXISTS "inquiries_admin_all" ON public.inquiries;

    REVOKE SELECT, UPDATE, DELETE ON public.inquiries FROM PUBLIC, anon;
    GRANT INSERT ON public.inquiries TO anon, authenticated;
    GRANT SELECT, UPDATE, DELETE ON public.inquiries TO authenticated;
    GRANT ALL ON public.inquiries TO service_role;

    CREATE POLICY "inquiries_public_insert" ON public.inquiries
      FOR INSERT TO anon, authenticated
      WITH CHECK (
        char_length(trim(COALESCE(name, ''))) >= 2
        AND char_length(trim(COALESCE(mobile_number, ''))) >= 10
        AND char_length(trim(COALESCE(message, ''))) >= 2
      );
    CREATE POLICY "inquiries_admin_all" ON public.inquiries
      FOR SELECT TO authenticated
      USING (public.current_admin_role() IS NOT NULL);
  END IF;
END $$;

-- 2.6 ID Card Management Tables
DO $$
BEGIN
  IF to_regclass('public.student_id_cards') IS NOT NULL THEN
    ALTER TABLE public.student_id_cards ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authorized staff can read and manage student ID cards" ON public.student_id_cards;
    DROP POLICY IF EXISTS "student_id_cards_service_all" ON public.student_id_cards;
    DROP POLICY IF EXISTS "student_id_cards_staff_rw" ON public.student_id_cards;
    REVOKE ALL ON public.student_id_cards FROM PUBLIC, anon;
    CREATE POLICY "student_id_cards_service_all" ON public.student_id_cards
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "student_id_cards_staff_rw" ON public.student_id_cards
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.batch_id_card_collections') IS NOT NULL THEN
    ALTER TABLE public.batch_id_card_collections ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authorized staff can read and manage batch collections" ON public.batch_id_card_collections;
    DROP POLICY IF EXISTS "batch_id_card_collections_service_all" ON public.batch_id_card_collections;
    DROP POLICY IF EXISTS "batch_id_card_collections_staff_rw" ON public.batch_id_card_collections;
    REVOKE ALL ON public.batch_id_card_collections FROM PUBLIC, anon;
    CREATE POLICY "batch_id_card_collections_service_all" ON public.batch_id_card_collections
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "batch_id_card_collections_staff_rw" ON public.batch_id_card_collections
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.id_card_download_jobs') IS NOT NULL THEN
    ALTER TABLE public.id_card_download_jobs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can manage their download jobs" ON public.id_card_download_jobs;
    DROP POLICY IF EXISTS "id_card_download_jobs_service_all" ON public.id_card_download_jobs;
    DROP POLICY IF EXISTS "id_card_download_jobs_staff_rw" ON public.id_card_download_jobs;
    REVOKE ALL ON public.id_card_download_jobs FROM PUBLIC, anon;
    CREATE POLICY "id_card_download_jobs_service_all" ON public.id_card_download_jobs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "id_card_download_jobs_staff_rw" ON public.id_card_download_jobs
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;

  IF to_regclass('public.id_card_download_logs') IS NOT NULL THEN
    ALTER TABLE public.id_card_download_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Append-only ID card audit logs" ON public.id_card_download_logs;
    DROP POLICY IF EXISTS "Super Admin can view ID card audit logs" ON public.id_card_download_logs;
    DROP POLICY IF EXISTS "id_card_download_logs_service_all" ON public.id_card_download_logs;
    DROP POLICY IF EXISTS "id_card_download_logs_admin_read" ON public.id_card_download_logs;
    DROP POLICY IF EXISTS "id_card_download_logs_staff_insert" ON public.id_card_download_logs;
    REVOKE ALL ON public.id_card_download_logs FROM PUBLIC, anon;
    CREATE POLICY "id_card_download_logs_service_all" ON public.id_card_download_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "id_card_download_logs_admin_read" ON public.id_card_download_logs
      FOR SELECT TO authenticated USING (public.current_admin_role() IS NOT NULL);
    CREATE POLICY "id_card_download_logs_staff_insert" ON public.id_card_download_logs
      FOR INSERT TO authenticated WITH CHECK (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL);
  END IF;
END $$;

-- 2.7 Lock down backup / pre-consolidation / legacy tables without deleting any data
DO $$
DECLARE
  v_bkp TEXT;
BEGIN
  FOREACH v_bkp IN ARRAY ARRAY[
    'backup_registrations_2026_pre_consolidation',
    'backup_registrations_2027_pre_consolidation',
    'registration_migration_conflicts',
    'donations_2026',
    'registrations_2026'
  ] LOOP
    IF to_regclass('public.' || v_bkp) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_bkp);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', v_bkp);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', v_bkp);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_bkp || '_service_only', v_bkp);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', v_bkp || '_service_only', v_bkp);
    END IF;
  END LOOP;

  IF to_regclass('public.donations_2026') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can manage donations" ON public.donations_2026;
    DROP POLICY IF EXISTS "Public can view donations count and general list" ON public.donations_2026;
  END IF;

  IF to_regclass('public.registrations_2026') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Super admins can delete registrations" ON public.registrations_2026;
    DROP POLICY IF EXISTS "public_delete_registration_2026" ON public.registrations_2026;
  END IF;
END $$;

COMMIT;
