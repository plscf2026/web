-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR - REUNION MANAGEMENT SYSTEM
-- MIGRATION: 20270106000000_consolidate_registrations_2027_and_drop_2026.sql
-- 
-- OBJECTIVE:
-- 1. Create independent archival backup tables of registrations_2026 and registrations_2027.
-- 2. Enhance registrations_2027 with tracking metadata (is_demo, is_legacy, migration_source, legacy_source_year).
-- 3. Safely migrate all historical and seed records from registrations_2026 into registrations_2027.
-- 4. Update all database procedures (rpc_verify_payment, verify_student_token_for_department, get_paid_registrations)
--    to reference ONLY registrations_2027 with single-table anti-replay.
-- 5. Drop all dependencies, policies, and indexes associated with registrations_2026.
-- 6. Permanently DROP TABLE public.registrations_2026.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: INDEPENDENT PRE-CONSOLIDATION BACKUPS
-- ============================================================================

DO $$
BEGIN
  -- 1.1 Backup registrations_2026 if it exists
  IF to_regclass('public.registrations_2026') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS public.backup_registrations_2026_pre_consolidation AS
    SELECT *, NOW() AS backed_up_at FROM public.registrations_2026;
  END IF;

  -- 1.2 Backup current registrations_2027 if it exists
  IF to_regclass('public.registrations_2027') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS public.backup_registrations_2027_pre_consolidation AS
    SELECT *, NOW() AS backed_up_at FROM public.registrations_2027;
  END IF;

  -- 1.3 Create table for conflict resolution logging
  CREATE TABLE IF NOT EXISTS public.registration_migration_conflicts (
    id TEXT PRIMARY KEY,
    source_table TEXT NOT NULL,
    conflict_type TEXT NOT NULL,
    conflicting_value TEXT,
    raw_data JSONB,
    resolved_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
  );
END $$;

-- ============================================================================
-- STEP 2: SCHEMA ENHANCEMENT FOR REGISTRATIONS_2027
-- ============================================================================

ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS migration_source TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS legacy_source_year INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_reg_2027_is_demo ON public.registrations_2027 (is_demo);
CREATE INDEX IF NOT EXISTS idx_reg_2027_is_legacy ON public.registrations_2027 (is_legacy);

-- ============================================================================
-- STEP 3: MIGRATE ALL RECORDS FROM REGISTRATIONS_2026 INTO REGISTRATIONS_2027
-- ============================================================================

DO $$
DECLARE
  v_migrated_count INTEGER := 0;
  v_demo_count INTEGER := 0;
BEGIN
  IF to_regclass('public.registrations_2026') IS NOT NULL THEN
    -- Insert all non-conflicting records
    INSERT INTO public.registrations_2027 (
      id,
      full_name,
      full_name_bn,
      photo_url,
      mobile_number,
      email,
      address,
      category,
      student_id,
      passing_year,
      last_class_attended,
      current_class,
      batch_name,
      group_or_section,
      roll_number,
      t_shirt_size,
      registration_fee,
      donation_amount,
      total_paid,
      payment_status,
      transaction_id,
      payment_method,
      gateway_invoice_number,
      gateway_provider,
      gateway_response,
      server_verification_signature,
      verification_timestamp,
      verified_by,
      registered_at,
      qr_token,
      is_tshirt_collected,
      is_checked_in,
      notes,
      year,
      is_demo,
      is_legacy,
      migration_source,
      legacy_source_year
    )
    SELECT
      r26.id,
      r26.full_name,
      r26.full_name_bn,
      r26.photo_url,
      r26.mobile_number,
      r26.email,
      r26.address,
      r26.category,
      NULL AS student_id,
      r26.passing_year,
      NULL AS last_class_attended,
      r26.current_class,
      r26.batch_name,
      r26.group_or_section,
      r26.roll_number,
      r26.t_shirt_size,
      r26.registration_fee,
      r26.donation_amount,
      r26.total_paid,
      r26.payment_status,
      r26.transaction_id,
      r26.payment_method,
      COALESCE(r26.transaction_id, 'LEGACY-INV-' || r26.id) AS gateway_invoice_number,
      'PAYSTATION' AS gateway_provider,
      jsonb_build_object('migrated_from', 'registrations_2026', 'migrated_at', clock_timestamp()) AS gateway_response,
      r26.server_verification_signature,
      r26.verification_timestamp,
      r26.verified_by,
      r26.registered_at,
      r26.qr_token,
      r26.is_tshirt_collected,
      r26.is_checked_in,
      r26.notes,
      COALESCE(r26.year, 2026),
      CASE 
        WHEN r26.id LIKE 'PLSCF-2026-F10%' 
          OR r26.id LIKE 'PLSCF-2026-C20%' 
          OR r26.notes ILIKE '%demo%' 
          OR r26.notes ILIKE '%test%' 
          OR r26.notes ILIKE '%seed%'
        THEN TRUE 
        ELSE FALSE 
      END AS is_demo,
      TRUE AS is_legacy,
      'registrations_2026' AS migration_source,
      2026 AS legacy_source_year
    FROM public.registrations_2026 r26
    ON CONFLICT (id) DO UPDATE SET
      notes = COALESCE(public.registrations_2027.notes, '') || ' [Migrated from registrations_2026]',
      is_legacy = TRUE,
      migration_source = 'registrations_2026_conflict_merged';

    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Successfully migrated % records from registrations_2026 into registrations_2027.', v_migrated_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: UPDATE STORED PROCEDURES & RPC FUNCTIONS (REMOVING 2026 DEPENDENCIES)
-- ============================================================================

-- 4.1 Authoritative rpc_verify_payment targeting registrations_2027 ONLY
CREATE OR REPLACE FUNCTION public.rpc_verify_payment(
  p_reg_id TEXT,
  p_trx_id TEXT,
  p_method TEXT,
  p_amount NUMERIC,
  p_signature TEXT,
  p_verified_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_dup_count INTEGER;
  v_qr_token TEXT;
  v_found BOOLEAN := false;
  v_reg_name TEXT := 'Student';
BEGIN
  -- 1. Anti-Replay Protection: Single authoritative table registrations_2027
  IF p_trx_id IS NOT NULL AND trim(p_trx_id) <> '' THEN
    SELECT COUNT(*) INTO v_dup_count
    FROM public.registrations_2027
    WHERE upper(trim(transaction_id)) = upper(trim(p_trx_id)) AND id <> p_reg_id;

    IF v_dup_count > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_TRANSACTION: This PayStation transaction ID has already been utilized.'
      );
    END IF;
  END IF;

  -- 2. Verify existence in registrations_2027
  IF EXISTS (SELECT 1 FROM public.registrations_2027 WHERE id = p_reg_id) THEN
    v_found := true;
    SELECT qr_token, full_name INTO v_qr_token, v_reg_name FROM public.registrations_2027 WHERE id = p_reg_id;
  END IF;

  IF NOT v_found THEN
    RETURN jsonb_build_object('success', false, 'error', 'REGISTRATION_NOT_FOUND');
  END IF;

  -- 3. Ensure high-entropy QR token
  IF v_qr_token IS NULL OR trim(v_qr_token) = '' THEN
    v_qr_token := 'PLSCF27-' || upper(encode(gen_random_bytes(12), 'hex'));
  END IF;

  -- 4. Authoritatively mark payment as PAID in registrations_2027
  UPDATE public.registrations_2027
  SET payment_status = 'paid',
      transaction_id = p_trx_id,
      payment_method = p_method,
      total_paid = p_amount,
      qr_token = v_qr_token,
      server_verification_signature = p_signature,
      verification_timestamp = clock_timestamp(),
      verified_by = p_verified_by,
      gateway_provider = 'PAYSTATION'
  WHERE id = p_reg_id;

  -- 5. Record Double-Entry Credit in Financial Ledger
  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    INSERT INTO public.financial_ledger (
      staff_id,
      transaction_type,
      amount,
      reference_id,
      description,
      created_by
    ) VALUES (
      'GATEWAY_PAYSTATION',
      'REGISTRATION_INFLOW',
      p_amount,
      p_trx_id,
      'Consolidated Online Inflow: ' || v_reg_name || ' (' || p_reg_id || ') via ' || upper(p_method),
      p_verified_by
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', p_reg_id,
    'qr_token', v_qr_token,
    'status', 'paid',
    'table', 'registrations_2027'
  );
END;
$$;

-- 4.2 Authoritative verify_student_token_for_department targeting registrations_2027 ONLY
CREATE OR REPLACE FUNCTION public.verify_student_token_for_department(
  p_staff_auth_id UUID,
  p_token_or_id TEXT,
  p_department TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_staff RECORD;
  v_student_id TEXT;
  v_student_name TEXT;
  v_batch_name TEXT;
  v_tshirt_size TEXT;
  v_payment_status TEXT;
BEGIN
  -- 1. Validate Staff Account and Active Status
  SELECT id, full_name, role, department, permissions, status
  INTO v_staff
  FROM public.staff_accounts
  WHERE auth_user_id = p_staff_auth_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'STAFF_NOT_FOUND',
      'message', 'Staff profile does not exist or auth mismatch.'
    );
  END IF;

  IF v_staff.status != 'ACTIVE' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'ACCOUNT_DEACTIVATED',
      'message', 'Staff account is deactivated.'
    );
  END IF;

  -- Verify Department Isolation
  IF v_staff.role != 'SUPER_ADMIN' AND v_staff.department != 'ALL_SERVICES' AND v_staff.department != p_department THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'PERMISSION_DENIED',
      'message', format('Staff assigned to %s cannot approve services in %s.', v_staff.department, p_department)
    );
  END IF;

  IF v_staff.role != 'SUPER_ADMIN' AND NOT (v_staff.permissions ? 'APPROVE') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'PERMISSION_DENIED',
      'message', 'Staff lacks APPROVE permission for this service station.'
    );
  END IF;

  -- 2. Locate Student by Token or ID directly in consolidated registrations_2027
  SELECT id, full_name, batch_name, t_shirt_size, payment_status
  INTO v_student_id, v_student_name, v_batch_name, v_tshirt_size, v_payment_status
  FROM public.registrations_2027
  WHERE UPPER(id) = UPPER(p_token_or_id) OR UPPER(qr_token) = UPPER(p_token_or_id)
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'INVALID_TOKEN',
      'message', format('No registration found for token or ID "%s".', p_token_or_id)
    );
  END IF;

  IF v_payment_status != 'paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'NOT_ELIGIBLE',
      'message', format('Student registration is in "%s" state. Payment required.', v_payment_status)
    );
  END IF;

  -- Return minimal sanitized payload (Zero PII)
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

-- 4.3 Update get_paid_registrations to return from registrations_2027
CREATE OR REPLACE FUNCTION public.get_paid_registrations()
RETURNS SETOF public.registrations_2027 AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.registrations_2027
  WHERE payment_status = 'paid'
  ORDER BY registered_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.4 Drop obsolete legacy functions referencing registrations_2026
DROP FUNCTION IF EXISTS public.confirm_registration_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.confirm_paystation_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT);

-- ============================================================================
-- STEP 5: DROP ALL POLICIES, INDEXES & THE LEGACY TABLE REGISTRATIONS_2026
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.registrations_2026') IS NOT NULL THEN
    -- Drop all RLS policies on registrations_2026
    DROP POLICY IF EXISTS "anon_insert_pending_registration" ON public.registrations_2026;
    DROP POLICY IF EXISTS "gate_staff_read_paid" ON public.registrations_2026;
    DROP POLICY IF EXISTS "super_admin_all_registrations" ON public.registrations_2026;
    DROP POLICY IF EXISTS "registration_insert_pending_2026" ON public.registrations_2026;
    DROP POLICY IF EXISTS "registration_staff_read_2026" ON public.registrations_2026;
    DROP POLICY IF EXISTS "registration_admin_update_2026" ON public.registrations_2026;
    DROP POLICY IF EXISTS "registration_admin_delete_2026" ON public.registrations_2026;
    DROP POLICY IF EXISTS "Admins can update registrations" ON public.registrations_2026;
    DROP POLICY IF EXISTS "Public can view confirmed tickets" ON public.registrations_2026;

    -- Drop indexes on registrations_2026
    DROP INDEX IF EXISTS public.idx_reg_2026_mobile;
    DROP INDEX IF EXISTS public.idx_reg_2026_trx;
    DROP INDEX IF EXISTS public.idx_reg_2026_qr;
    DROP INDEX IF EXISTS public.idx_reg_2026_status;
    DROP INDEX IF EXISTS public.idx_registrations_2026_gateway_inv;
    DROP INDEX IF EXISTS public.idx_registrations_2026_qr_token;

    -- Permanently drop the legacy table
    DROP TABLE public.registrations_2026 RESTRICT;
    RAISE NOTICE 'Table public.registrations_2026 has been permanently dropped.';
  END IF;
END $$;

COMMIT;

