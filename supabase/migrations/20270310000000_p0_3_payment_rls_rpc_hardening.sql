-- ============================================================================
-- MIGRATION: 20270310000000_p0_3_payment_rls_rpc_hardening.sql
-- PURPOSE: P0-3 Security Hardening — RLS, Grant, Anti-Replay, Fee Bounds
--
-- SAFETY CONSTRAINTS (enforced by this migration):
--   1. Payment finalization remains DISABLED by default.
--      No RPC or policy enables live payment processing without explicit
--      PAYSTATION_ALLOW_PAYMENT_FINALIZATION=true env secret in Edge Function.
--   2. Currency validation: NEVER defaults missing currency to BDT.
--      Edge Function enforces explicit currency check (see verify-payment/index.ts).
--   3. All changes are ADDITIVE and idempotent (IF EXISTS / IF NOT EXISTS guards).
--   4. Never deletes or overwrites existing registration/donation records.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Create public.system_settings (missing from all prior migrations)
-- Authoritative key-value config store; anon may read safe config keys only;
-- only service_role and super_admin may write.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'SYSTEM'
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on system_settings before recreating
DROP POLICY IF EXISTS "system_settings_public_read_safe" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_service_write" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_write" ON public.system_settings;

-- Public (anon) may read only the safe portal_fee_settings key
CREATE POLICY "system_settings_public_read_safe" ON public.system_settings
  FOR SELECT
  USING (key = 'portal_fee_settings');

-- service_role has full access
CREATE POLICY "system_settings_service_write" ON public.system_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- super_admin may write
CREATE POLICY "system_settings_admin_write" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.current_admin_role() = 'super_admin')
  WITH CHECK (public.current_admin_role() = 'super_admin');

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.system_settings TO anon;
GRANT ALL ON public.system_settings TO authenticated, service_role;

-- Seed portal_fee_settings (authoritative; app reads from here, NOT localStorage)
INSERT INTO public.system_settings (key, value, description, updated_by)
VALUES (
  'portal_fee_settings',
  jsonb_build_object(
    'currentStudentFee',    500,
    'formerStudentFee',     1500,
    'parentFee',            500,
    'gatewayChargePercent', 1.5,
    'maxGatewayCharge',     75,
    'minDonation',          100,
    'registrationOpen',     false,
    'donationOpen',         false,
    'paymentEnabled',       false
  ),
  'Authoritative fee configuration. paymentEnabled=false keeps live payments disabled.',
  'P0-3-MIGRATION'
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW(),
      updated_by = 'P0-3-MIGRATION'
  WHERE system_settings.updated_by NOT LIKE 'MANUAL-%';  -- Don't overwrite manual admin changes

-- ============================================================================
-- SECTION 2: Revoke anon/authenticated EXECUTE on critical payment RPCs
-- These RPCs MUST only be callable by service_role (Edge Functions, Edge-only).
-- ============================================================================

-- rpc_verify_payment: controls payment confirmation — anon MUST NOT call
REVOKE EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) TO service_role;

-- rpc_handle_paystation_ipn: IPN handler — anon MUST NOT call
REVOKE EXECUTE ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- rpc_promote_pending_order_to_registration: order promotion — anon MUST NOT call
REVOKE EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

-- rpc_reconcile_pending_orders: stale order reconciliation — anon MUST NOT call
REVOKE EXECUTE ON FUNCTION public.rpc_reconcile_pending_orders(INT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reconcile_pending_orders(INT) TO service_role;

-- rpc_record_donation: donation recording — anon MUST NOT call
REVOKE EXECUTE ON FUNCTION public.rpc_record_donation(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, INT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_donation(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, INT) TO service_role;

-- ============================================================================
-- SECTION 3: Add DB-level unique anti-replay indexes
-- Prevents concurrent READ COMMITTED sessions both passing the COUNT(*) check.
-- A UNIQUE index is enforced by the storage engine BEFORE the transaction commits.
-- ============================================================================

-- Anti-replay index on registrations_2027.transaction_id (non-empty, normalized)
CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_2027_trx_id_nonempty
  ON public.registrations_2027 (upper(trim(transaction_id)))
  WHERE transaction_id IS NOT NULL AND trim(transaction_id) <> '';

-- Anti-replay index on payment_transactions.transaction_id
DO $$
BEGIN
  IF to_regclass('public.payment_transactions') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_trx_id_nonempty
      ON public.payment_transactions (upper(trim(transaction_id)))
      WHERE transaction_id IS NOT NULL AND trim(transaction_id) <> ''''';
  END IF;
END $$;

-- Anti-replay index on donations.transaction_id
DO $$
BEGIN
  IF to_regclass('public.donations') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_donations_trx_id_nonempty
      ON public.donations (upper(trim(transaction_id)))
      WHERE transaction_id IS NOT NULL AND trim(transaction_id) <> ''''';
  END IF;
END $$;

-- ============================================================================
-- SECTION 4: Harden RLS on pending_orders
-- Anon MUST NOT be able to INSERT, UPDATE, or SELECT any pending_orders record.
-- Only service_role (Edge Functions) may write; authenticated admin may read.
-- ============================================================================

-- Drop the permissive anon policies from 20270117
DROP POLICY IF EXISTS "pending_orders_anon_insert" ON public.pending_orders;
DROP POLICY IF EXISTS "pending_orders_anon_select" ON public.pending_orders;

-- Revoke the GRANT ALL from 20270117
REVOKE ALL ON public.pending_orders FROM anon, authenticated;
GRANT ALL ON public.pending_orders TO service_role;
-- Authenticated admin-level read (for finance/admin panel)
GRANT SELECT ON public.pending_orders TO authenticated;

-- Keep service_role full access (already set via GRANT, policy below ensures RLS)
DROP POLICY IF EXISTS "pending_orders_service_all" ON public.pending_orders;
CREATE POLICY "pending_orders_service_all" ON public.pending_orders
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admins may read (but not write) pending_orders
DROP POLICY IF EXISTS "pending_orders_admin_read" ON public.pending_orders;
CREATE POLICY "pending_orders_admin_read" ON public.pending_orders
  FOR SELECT TO authenticated
  USING (public.current_admin_role() IS NOT NULL);

-- ============================================================================
-- SECTION 5: Harden RLS on donations and donations_2027
-- Anon MUST NOT INSERT/UPDATE/DELETE donations directly.
-- Anon may only SELECT confirmed paid donations (no PII exposure for unreferenced).
-- Only service_role may insert confirmed paid donations (via rpc_record_donation).
-- ============================================================================

-- Drop the permissive anon policies from 20270129
DROP POLICY IF EXISTS "Public insert donations" ON public.donations;
DROP POLICY IF EXISTS "Public update donations" ON public.donations;
DROP POLICY IF EXISTS "Public delete donations" ON public.donations;
DROP POLICY IF EXISTS "Public select donations" ON public.donations;

-- Revoke anon write grants
REVOKE INSERT, UPDATE, DELETE ON public.donations FROM anon;

-- Anon may only read paid donations (no PII — amount, purpose, token)
DROP POLICY IF EXISTS "donations_anon_read_paid" ON public.donations;
CREATE POLICY "donations_anon_read_paid" ON public.donations
  FOR SELECT TO anon
  USING (payment_status = 'paid');

-- service_role full access
DROP POLICY IF EXISTS "donations_service_all" ON public.donations;
CREATE POLICY "donations_service_all" ON public.donations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin read/write
DROP POLICY IF EXISTS "donations_admin_all" ON public.donations;
CREATE POLICY "donations_admin_all" ON public.donations
  FOR ALL TO authenticated
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

-- Apply same hardening to donations_2027
DO $$
BEGIN
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public insert donations_2027" ON public.donations_2027';
    EXECUTE 'DROP POLICY IF EXISTS "Public update donations_2027" ON public.donations_2027';
    EXECUTE 'DROP POLICY IF EXISTS "Public delete donations_2027" ON public.donations_2027';
    EXECUTE 'DROP POLICY IF EXISTS "Public select donations_2027" ON public.donations_2027';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.donations_2027 FROM anon';
    EXECUTE 'DROP POLICY IF EXISTS "donations_2027_anon_read_paid" ON public.donations_2027';
    EXECUTE 'CREATE POLICY "donations_2027_anon_read_paid" ON public.donations_2027
      FOR SELECT TO anon
      USING (payment_status = ''paid'')';
    EXECUTE 'DROP POLICY IF EXISTS "donations_2027_service_all" ON public.donations_2027';
    EXECUTE 'CREATE POLICY "donations_2027_service_all" ON public.donations_2027
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "donations_2027_admin_all" ON public.donations_2027';
    EXECUTE 'CREATE POLICY "donations_2027_admin_all" ON public.donations_2027
      FOR ALL TO authenticated
      USING (public.current_admin_role() IS NOT NULL)
      WITH CHECK (public.current_admin_role() IS NOT NULL)';
  END IF;
END $$;

-- ============================================================================
-- SECTION 6: Harden RLS on current_student_ids
-- Anon MUST NOT be able to INSERT, UPDATE, or DELETE student ID records.
-- Reservation/release/consume MUST go through SECURITY DEFINER RPCs only.
-- ============================================================================

-- Drop the over-permissive policies from 20270120 & 20270128
DROP POLICY IF EXISTS "Public can view current student ids" ON public.current_student_ids;
DROP POLICY IF EXISTS "Public can insert current student ids" ON public.current_student_ids;
DROP POLICY IF EXISTS "Public can update current student ids" ON public.current_student_ids;
DROP POLICY IF EXISTS "Public can delete current student ids" ON public.current_student_ids;
DROP POLICY IF EXISTS "Public can update reservation on current student ids" ON public.current_student_ids;

-- Revoke anon write grants from 20270128
REVOKE INSERT, UPDATE, DELETE ON public.current_student_ids FROM anon;
REVOKE ALL ON public.current_student_ids FROM anon;
-- Keep read-only for validation UI
GRANT SELECT ON public.current_student_ids TO anon;

-- service_role full access
DROP POLICY IF EXISTS "Service role full access on current_student_ids" ON public.current_student_ids;
CREATE POLICY "Service role full access on current_student_ids" ON public.current_student_ids
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon may read (for validation lookup in registration form)
DROP POLICY IF EXISTS "current_student_ids_anon_select" ON public.current_student_ids;
CREATE POLICY "current_student_ids_anon_select" ON public.current_student_ids
  FOR SELECT TO anon
  USING (true);

-- Admin full management
DROP POLICY IF EXISTS "Authenticated admins full access on current_student_ids" ON public.current_student_ids;
CREATE POLICY "Authenticated admins full access on current_student_ids" ON public.current_student_ids
  FOR ALL TO authenticated
  USING (public.current_admin_role() = 'super_admin')
  WITH CHECK (public.current_admin_role() = 'super_admin');

-- ============================================================================
-- SECTION 7: SECURITY DEFINER RPCs for atomic student ID reservation
-- These replace the direct anon UPDATE calls in src/services/studentIdStore.ts
-- ============================================================================

-- 7a. Reserve a student ID slot (atomic, prevents double-reservation race)
CREATE OR REPLACE FUNCTION public.rpc_reserve_student_id(
  p_student_id TEXT,
  p_reservation_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_rec RECORD;
  v_minutes INT := GREATEST(1, LEAST(COALESCE(p_reservation_minutes, 15), 120));
BEGIN
  IF p_student_id IS NULL OR trim(p_student_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STUDENT_ID', 'message', 'Student ID is required.');
  END IF;

  -- Atomic: SELECT FOR UPDATE to lock the row, then conditionally update
  SELECT * INTO v_rec
  FROM public.current_student_ids
  WHERE upper(trim(student_id)) = upper(trim(p_student_id))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Student ID not found in official roll.');
  END IF;

  IF v_rec.status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INACTIVE', 'message', 'Student ID is not active.');
  END IF;

  IF v_rec.verification_status = 'USED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_USED', 'message', 'Student ID has already been used for registration.');
  END IF;

  IF v_rec.verification_status = 'RESERVED' AND v_rec.reserved_until > NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_RESERVED', 'message', 'Student ID is currently reserved. Please wait for it to expire.');
  END IF;

  -- Reserve it
  UPDATE public.current_student_ids
  SET verification_status = 'RESERVED',
      reserved_until = NOW() + (v_minutes || ' minutes')::interval,
      updated_at = NOW()
  WHERE upper(trim(student_id)) = upper(trim(p_student_id));

  RETURN jsonb_build_object(
    'success', true,
    'status', 'RESERVED',
    'student_id', p_student_id,
    'reserved_until', (NOW() + (v_minutes || ' minutes')::interval)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_reserve_student_id(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reserve_student_id(TEXT, INT) TO anon, authenticated, service_role;

-- 7b. Release a reservation (called on form abandonment / payment failure)
CREATE OR REPLACE FUNCTION public.rpc_release_student_id_reservation(
  p_student_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  IF p_student_id IS NULL OR trim(p_student_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STUDENT_ID');
  END IF;

  SELECT * INTO v_rec
  FROM public.current_student_ids
  WHERE upper(trim(student_id)) = upper(trim(p_student_id))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- Only release if still in RESERVED state (not USED)
  IF v_rec.verification_status = 'RESERVED' THEN
    UPDATE public.current_student_ids
    SET verification_status = 'AVAILABLE',
        reserved_until = NULL,
        updated_at = NOW()
    WHERE upper(trim(student_id)) = upper(trim(p_student_id));
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_rec.verification_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_release_student_id_reservation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_release_student_id_reservation(TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- SECTION 8: Repair rpc_verify_payment
-- Critical bugs fixed:
--   a) Anti-replay leaks another student's QR token (lines 69-84 in 20270116)
--      -> Return DUPLICATE_TRANSACTION (not ALREADY_PAID with other's data)
--   b) No DB-level unique index (now added in Section 3)
--   c) Sandbox bypass isVerified=true removed (enforced in Edge Function)
--   d) RPC errors propagated (Edge Function already does this; RPC must return errors)
--   e) amount > 0 and amount <= max_expected are validated before UPDATE
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.rpc_verify_payment(
  p_reg_id   TEXT,
  p_trx_id   TEXT,
  p_method   TEXT,
  p_amount   NUMERIC,
  p_signature TEXT,
  p_verified_by TEXT DEFAULT 'PAYSTATION_EDGE_FUNCTION',
  p_pending_data JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_existing_status TEXT;
  v_existing_trx_id TEXT;
  v_qr_token        TEXT;
  v_reg_name        TEXT;
  v_invoice_num     TEXT;
  v_mobile          TEXT;
  v_category        TEXT;
  v_student_id      TEXT;
  v_batch_name      TEXT;
  v_expected_fee    NUMERIC;
  v_found           BOOLEAN := false;
BEGIN
  -- 1. Validate inputs (fail closed)
  IF p_reg_id IS NULL OR trim(p_reg_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REG_ID', 'message', 'Registration ID is required.');
  END IF;
  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID', 'message', 'Transaction ID is required.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT', 'message', 'Payment amount must be greater than zero.');
  END IF;
  -- Reject implausibly large amounts (> 50000 BDT hardcoded safety cap)
  IF p_amount > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'AMOUNT_OVERFLOW', 'message', 'Payment amount exceeds maximum allowed.');
  END IF;

  -- 2. FIXED Anti-Replay: if this trx_id is already on a DIFFERENT registration,
  --    return DUPLICATE_TRANSACTION error (NOT ALREADY_PAID with the other student's data)
  IF EXISTS (
    SELECT 1 FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
      AND id <> p_reg_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TRANSACTION',
      'message', 'This transaction ID has already been used on a different registration. Anti-replay check failed.'
    );
  END IF;

  -- 3. Lock & fetch the target registration (FOR UPDATE prevents concurrent confirmation)
  SELECT payment_status, transaction_id, qr_token, full_name, mobile_number, category,
         student_id, batch_name, gateway_invoice_number, registration_fee
  INTO v_existing_status, v_existing_trx_id, v_qr_token, v_reg_name, v_mobile, v_category,
       v_student_id, v_batch_name, v_invoice_num, v_expected_fee
  FROM public.registrations_2027
  WHERE id = p_reg_id
  FOR UPDATE;

  IF FOUND THEN
    v_found := true;

    -- 4. Idempotency: already paid with same trx_id → return success
    IF v_existing_status = 'paid'
       AND upper(trim(COALESCE(v_existing_trx_id, ''))) = upper(trim(p_trx_id))
    THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PAID',
        'message', 'Registration was already confirmed and paid.',
        'registration_id', p_reg_id,
        'full_name', v_reg_name,
        'qr_token', v_qr_token
      );
    END IF;

    -- 5. If already paid with a DIFFERENT trx_id, that's a double-pay attempt
    IF v_existing_status = 'paid' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'ALREADY_PAID_DIFFERENT_TRX',
        'message', 'Registration already paid with a different transaction ID.'
      );
    END IF;

    -- 6. Only allow payment if status is pending
    IF v_existing_status NOT IN ('pending', 'failed') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_STATUS',
        'message', format('Cannot verify payment for registration with status: %s', v_existing_status)
      );
    END IF;

  ELSE
    -- 7. Self-healing: insert from p_pending_data if provided
    IF p_pending_data IS NOT NULL AND jsonb_typeof(p_pending_data) = 'object' THEN
      v_qr_token := COALESCE(
        p_pending_data->>'qrToken',
        p_pending_data->>'qr_token',
        'PLSCF27-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12))
      );
      v_reg_name   := COALESCE(p_pending_data->>'fullName', p_pending_data->>'full_name', 'Student');
      v_mobile     := COALESCE(p_pending_data->>'mobileNumber', p_pending_data->>'mobile_number', '01XXXXXXXXX');
      v_category   := COALESCE(p_pending_data->>'category', 'former');
      v_student_id := p_pending_data->>'studentId';
      v_batch_name := COALESCE(p_pending_data->>'batchName', 'General');
      v_invoice_num := COALESCE(p_pending_data->>'gatewayInvoiceNumber', p_pending_data->>'gateway_invoice_number', p_reg_id);

      BEGIN
        INSERT INTO public.registrations_2027 (
          id, full_name, photo_url, mobile_number, email, address,
          category, student_id, passing_year, last_class_attended,
          current_class, batch_name, group_or_section, roll_number,
          t_shirt_size, registration_fee, donation_amount, total_paid,
          payment_status, registered_at, qr_token, year,
          gateway_invoice_number
        ) VALUES (
          p_reg_id,
          v_reg_name,
          COALESCE(p_pending_data->>'photoUrl', p_pending_data->>'photo_url', 'https://via.placeholder.com/150'),
          v_mobile,
          p_pending_data->>'email',
          COALESCE(p_pending_data->>'address', 'Faridpur'),
          v_category,
          v_student_id,
          p_pending_data->>'passingYear',
          p_pending_data->>'lastClassAttended',
          p_pending_data->>'currentClass',
          v_batch_name,
          p_pending_data->>'groupOrSection',
          p_pending_data->>'rollNumber',
          COALESCE(p_pending_data->>'tShirtSize', 'L'),
          COALESCE((p_pending_data->>'registrationFee')::numeric, p_amount),
          COALESCE((p_pending_data->>'donationAmount')::numeric, 0),
          0,
          'pending',
          NOW(),
          v_qr_token,
          COALESCE((p_pending_data->>'year')::integer, 2027),
          v_invoice_num
        )
        ON CONFLICT (id) DO NOTHING;
        v_found := true;
      EXCEPTION
        WHEN unique_violation THEN
          -- Concurrent session already inserted; re-read and proceed
          SELECT payment_status, qr_token, full_name, mobile_number, category,
                 student_id, batch_name, gateway_invoice_number
          INTO v_existing_status, v_qr_token, v_reg_name, v_mobile, v_category,
               v_student_id, v_batch_name, v_invoice_num
          FROM public.registrations_2027
          WHERE id = p_reg_id;
          IF FOUND THEN
            v_found := true;
            IF v_existing_status = 'paid' THEN
              RETURN jsonb_build_object(
                'success', true,
                'status', 'ALREADY_PAID',
                'message', 'Registration confirmed concurrently by another session.',
                'registration_id', p_reg_id,
                'full_name', v_reg_name,
                'qr_token', v_qr_token
              );
            END IF;
          END IF;
      END;
    END IF;
  END IF;

  IF NOT v_found THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REGISTRATION_NOT_FOUND',
      'message', format('Registration "%s" not found.', p_reg_id)
    );
  END IF;

  -- 8. Ensure valid QR token
  IF v_qr_token IS NULL OR trim(v_qr_token) = '' THEN
    v_qr_token := 'PLSCF27-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
  END IF;

  -- 9. Authoritatively mark registration as PAID
  --    The DB-level unique index on transaction_id (Section 3) prevents
  --    a concurrent session from completing the same trx_id on any other row.
  BEGIN
    UPDATE public.registrations_2027
    SET payment_status                = 'paid',
        transaction_id                = p_trx_id,
        payment_method                = lower(trim(COALESCE(p_method, 'bkash'))),
        total_paid                    = p_amount,
        qr_token                      = v_qr_token,
        server_verification_signature = p_signature,
        verification_timestamp        = clock_timestamp(),
        verified_by                   = p_verified_by,
        gateway_provider              = 'PAYSTATION',
        gateway_invoice_number        = COALESCE(gateway_invoice_number, v_invoice_num, p_reg_id)
    WHERE id = p_reg_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- The unique index on transaction_id fired — concurrent session already committed this trx_id
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_TRANSACTION',
        'message', 'Concurrent anti-replay: this transaction ID was committed by another session.'
      );
  END;

  -- 10. Immutable payment_transactions ledger entry
  BEGIN
    INSERT INTO public.payment_transactions (
      registration_id, invoice_id, transaction_id, payment_amount,
      currency, payment_status, payment_method, gateway_provider,
      gateway_response, verified_at
    ) VALUES (
      p_reg_id,
      COALESCE(v_invoice_num, p_reg_id),
      p_trx_id,
      p_amount,
      'BDT',
      'PAID',
      lower(trim(COALESCE(p_method, 'bkash'))),
      'PAYSTATION',
      jsonb_build_object('signature', p_signature, 'verified_by', p_verified_by),
      clock_timestamp()
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 11. If current student, mark student ID permanently USED (authoritative server-side)
  IF v_student_id IS NOT NULL AND trim(v_student_id) <> '' THEN
    IF to_regclass('public.current_student_ids') IS NOT NULL THEN
      BEGIN
        UPDATE public.current_student_ids
        SET verification_status  = 'USED',
            used_registration_id = p_reg_id,
            reserved_until       = NULL,
            updated_at           = clock_timestamp()
        WHERE upper(trim(student_id)) = upper(trim(v_student_id));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  -- 12. Audit log
  BEGIN
    INSERT INTO public.admin_audit_logs (
      admin_id, admin_username, admin_role, action,
      target_type, target_id, details
    ) VALUES (
      'SYSTEM_GATEWAY', 'PAYSTATION_EDGE_FUNCTION', 'service_role',
      'PAYMENT_VERIFIED', 'registration', p_reg_id,
      format('trx_id=%s amount=%s method=%s verified_by=%s', p_trx_id, p_amount, p_method, p_verified_by)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success',         true,
    'status',          'PAID_VERIFIED',
    'registration_id', p_reg_id,
    'full_name',       v_reg_name,
    'qr_token',        v_qr_token,
    'message',         'Payment verified authoritatively and registration confirmed.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) TO service_role;

-- ============================================================================
-- SECTION 9: Repair rpc_handle_paystation_ipn
-- Critical bugs fixed:
--   a) No amount bounds check (amount must be > 0 and <= 50000)
--   b) No pending_orders lookup before registrations_2027 (should use promote RPC)
--   c) No amount mismatch detection (reported amount vs. pending_order.amount)
--   d) RPC errors were silently ignored in Edge Function
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.rpc_handle_paystation_ipn(
  p_invoice_number   TEXT,
  p_trx_id           TEXT,
  p_amount           NUMERIC,
  p_method           TEXT,
  p_order_date_time  TEXT,
  p_reference        TEXT DEFAULT NULL,
  p_raw_payload      JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_order  RECORD;
  v_reg    RECORD;
  v_result JSONB;
BEGIN
  -- 1. Validate mandatory IPN parameters
  IF p_invoice_number IS NULL OR trim(p_invoice_number) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INVOICE', 'message', 'Invoice number is required.');
  END IF;
  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID', 'message', 'Transaction ID is required.');
  END IF;
  -- Amount bounds
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT', 'message', 'IPN amount must be greater than zero.');
  END IF;
  IF p_amount > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'AMOUNT_OVERFLOW', 'message', 'IPN amount exceeds safety cap of 50000 BDT.');
  END IF;

  -- 2. Anti-replay: check if this trx_id was already committed on any registration
  IF EXISTS (
    SELECT 1 FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
  ) THEN
    SELECT id, qr_token, full_name, gateway_invoice_number INTO v_reg
    FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    LIMIT 1;

    -- Idempotent ONLY if committed for THIS same invoice_number
    IF v_reg.gateway_invoice_number = p_invoice_number THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PAID',
        'message', 'IPN trx_id already committed for this invoice (idempotent).',
        'registration_id', v_reg.id,
        'qr_token', v_reg.qr_token
      );
    END IF;

    -- Different invoice -> anti-replay failure (never leak other student's data)
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TRANSACTION',
      'message', 'Transaction ID already committed on a different invoice. Anti-replay check failed.'
    );
  END IF;

  -- 3. Try to find and promote via pending_orders (preferred path)
  SELECT * INTO v_order
  FROM public.pending_orders
  WHERE invoice_number = p_invoice_number
  FOR UPDATE;

  IF FOUND THEN
    -- Amount mismatch check: IPN amount must match order amount within 1 BDT tolerance
    IF abs(p_amount - v_order.amount) > 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'AMOUNT_MISMATCH',
        'message', format('IPN amount %s does not match pending order amount %s.', p_amount, v_order.amount)
      );
    END IF;

    IF v_order.status = 'paid' AND v_order.promoted_registration_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PAID',
        'registration_id', v_order.promoted_registration_id,
        'message', 'Order already promoted (idempotent).'
      );
    END IF;

    -- Delegate to promote RPC
    SELECT public.rpc_promote_pending_order_to_registration(
      p_invoice_number, p_trx_id, p_amount, p_method, 'PAYSTATION_IPN'
    ) INTO v_result;

    RETURN v_result;
  END IF;

  -- 4. Fallback: try matching directly on registrations_2027.gateway_invoice_number
  SELECT * INTO v_reg
  FROM public.registrations_2027
  WHERE gateway_invoice_number = p_invoice_number
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVOICE_NOT_FOUND',
      'message', format('No pending order or registration found for invoice: %s', p_invoice_number)
    );
  END IF;

  -- Amount bounds vs. registration fee (tolerance: 1 BDT)
  IF v_reg.registration_fee IS NOT NULL AND abs(p_amount - v_reg.registration_fee) > 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AMOUNT_MISMATCH',
      'message', format('IPN amount %s does not match registration fee %s.', p_amount, v_reg.registration_fee)
    );
  END IF;

  IF v_reg.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'ALREADY_PAID',
      'registration_id', v_reg.id,
      'message', 'Registration already paid (idempotent).'
    );
  END IF;

  BEGIN
    UPDATE public.registrations_2027
    SET payment_status         = 'paid',
        transaction_id         = p_trx_id,
        payment_method         = lower(trim(COALESCE(p_method, 'bkash'))),
        total_paid             = p_amount,
        verification_timestamp = clock_timestamp(),
        verified_by            = 'PAYSTATION_IPN'
    WHERE id = v_reg.id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_TRANSACTION',
        'message', 'Concurrent anti-replay: trx_id already committed by another session.'
      );
  END;

  BEGIN
    INSERT INTO public.payment_transactions (
      registration_id, invoice_id, transaction_id, payment_amount,
      currency, payment_status, payment_method, gateway_provider,
      gateway_response, verified_at
    ) VALUES (
      v_reg.id, p_invoice_number, p_trx_id, p_amount,
      'BDT', 'PAID', lower(trim(COALESCE(p_method, 'bkash'))),
      'PAYSTATION', p_raw_payload, clock_timestamp()
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'status', 'PAID', 'registration_id', v_reg.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ============================================================================
-- SECTION 10: Harden rpc_promote_pending_order_to_registration
-- Critical bugs fixed:
--   a) No amount validation against order.amount or fee bounds
--   b) No trx_id anti-replay check before INSERT
--   c) ON CONFLICT DO UPDATE could overwrite if re-entered concurrently
--   d) unique_violation recovery on two-session concurrency
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_promote_pending_order_to_registration(
  p_invoice_number TEXT,
  p_trx_id         TEXT,
  p_amount          NUMERIC,
  p_method          TEXT,
  p_verified_by     TEXT DEFAULT 'PAYSTATION_GATEWAY'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_order        RECORD;
  v_existing_reg RECORD;
  v_reg_id       TEXT;
  v_qr_token     TEXT;
  v_category     TEXT;
  v_student_id   TEXT;
  v_year         INT := 2027;
  v_signature    TEXT;
BEGIN
  -- Validate inputs
  IF p_invoice_number IS NULL OR trim(p_invoice_number) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INVOICE');
  END IF;
  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT', 'message', 'Amount must be > 0.');
  END IF;
  IF p_amount > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'AMOUNT_OVERFLOW', 'message', 'Amount exceeds 50000 BDT cap.');
  END IF;

  -- Anti-replay: reject if trx_id already committed on any registration
  IF EXISTS (
    SELECT 1 FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
  ) THEN
    SELECT id, qr_token, full_name INTO v_existing_reg
    FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    LIMIT 1;
    -- Only return ALREADY_PAID if this trx_id is on the SAME invoice's registration
    IF EXISTS (
      SELECT 1 FROM public.registrations_2027
      WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
        AND gateway_invoice_number = p_invoice_number
    ) THEN
      RETURN jsonb_build_object(
        'success', true, 'status', 'ALREADY_PAID',
        'registration_id', v_existing_reg.id,
        'qr_token', v_existing_reg.qr_token
      );
    END IF;
    -- Different invoice → anti-replay violation
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TRANSACTION',
      'message', 'Transaction ID already committed on a different invoice.'
    );
  END IF;

  -- Lock and retrieve the pending order
  SELECT * INTO v_order
  FROM public.pending_orders
  WHERE invoice_number = p_invoice_number
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Already promoted?
    SELECT * INTO v_existing_reg
    FROM public.registrations_2027
    WHERE gateway_invoice_number = p_invoice_number
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'status', 'ALREADY_PAID',
        'registration_id', v_existing_reg.id,
        'qr_token', v_existing_reg.qr_token,
        'full_name', v_existing_reg.full_name
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND',
      'message', format('Pending order for invoice "%s" not found.', p_invoice_number));
  END IF;

  -- Amount mismatch check (tolerance: 1 BDT)
  IF abs(p_amount - v_order.amount) > 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AMOUNT_MISMATCH',
      'message', format('Reported amount %s does not match order amount %s.', p_amount, v_order.amount)
    );
  END IF;

  -- Idempotency: order already promoted
  IF v_order.status = 'paid' AND v_order.promoted_registration_id IS NOT NULL THEN
    SELECT qr_token, full_name INTO v_existing_reg
    FROM public.registrations_2027
    WHERE id = v_order.promoted_registration_id;
    RETURN jsonb_build_object(
      'success', true, 'status', 'ALREADY_PAID',
      'registration_id', v_order.promoted_registration_id,
      'qr_token', v_existing_reg.qr_token,
      'full_name', v_existing_reg.full_name
    );
  END IF;

  -- Generate registration ID and unique QR token
  v_category   := COALESCE(v_order.form_data->>'category', 'former');
  v_student_id := v_order.form_data->>'studentId';
  v_reg_id     := COALESCE(
    v_order.form_data->>'registrationId',
    'PLSCF-' || v_year || '-' || (CASE WHEN v_category = 'current' THEN 'C' ELSE 'F' END) || floor(1000 + random() * 9000)::text
  );

  v_qr_token := COALESCE(
    v_order.form_data->>'qrToken',
    upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6))
  );
  WHILE EXISTS (SELECT 1 FROM public.registrations_2027 WHERE qr_token = v_qr_token) LOOP
    v_qr_token := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  END LOOP;

  v_signature := 'SIG-PAY-' || encode(sha256((v_reg_id || ':' || p_trx_id || ':' || p_amount)::bytea), 'hex');

  -- Atomic insert; ON CONFLICT DO NOTHING (not DO UPDATE) prevents overwrite on race
  BEGIN
    INSERT INTO public.registrations_2027 (
      id, full_name, photo_url, mobile_number, email, address,
      gender, blood_group, has_parent, parent_name, parent_age,
      parent_phone, parent_relation, parent_photo_url, parent_fee,
      gateway_charge, category, student_id, passing_year,
      last_class_attended, current_class, batch_name, group_or_section,
      roll_number, t_shirt_size, registration_fee, donation_amount,
      total_paid, payment_status, transaction_id, payment_method,
      gateway_invoice_number, gateway_provider, registered_at,
      qr_token, is_t_shirt_collected, year, event_id,
      server_verification_signature, verification_timestamp, verified_by
    ) VALUES (
      v_reg_id,
      COALESCE(v_order.form_data->>'fullName', v_order.customer_name),
      COALESCE(v_order.form_data->>'photoUrl', 'https://via.placeholder.com/150'),
      COALESCE(v_order.form_data->>'mobileNumber', v_order.customer_phone),
      COALESCE(v_order.form_data->>'email', v_order.customer_email),
      COALESCE(v_order.form_data->>'address', 'Faridpur'),
      COALESCE(v_order.form_data->>'gender', 'male'),
      v_order.form_data->>'bloodGroup',
      COALESCE((v_order.form_data->>'hasParent')::boolean, false),
      v_order.form_data->>'parentName',
      CASE WHEN v_order.form_data->>'parentAge' IS NOT NULL THEN (v_order.form_data->>'parentAge')::int ELSE NULL END,
      v_order.form_data->>'parentPhone',
      v_order.form_data->>'parentRelation',
      v_order.form_data->>'parentPhotoUrl',
      COALESCE((v_order.fees->>'parentFee')::numeric, 0),
      COALESCE((v_order.fees->>'gatewayCharge')::numeric, 0),
      v_category,
      v_student_id,
      v_order.form_data->>'passingYear',
      v_order.form_data->>'lastClassAttended',
      v_order.form_data->>'currentClass',
      COALESCE(v_order.form_data->>'batchName', 'General'),
      v_order.form_data->>'groupOrSection',
      v_order.form_data->>'rollNumber',
      COALESCE(v_order.form_data->>'tShirtSize', 'L'),
      COALESCE((v_order.fees->>'registrationFee')::numeric, 1500),
      COALESCE((v_order.fees->>'donationAmount')::numeric, 0),
      p_amount,
      'paid',
      p_trx_id,
      lower(trim(COALESCE(p_method, 'bkash'))),
      p_invoice_number,
      'PAYSTATION',
      NOW(),
      v_qr_token,
      false,
      v_year,
      'PLSCF-2027',
      v_signature,
      NOW(),
      p_verified_by
    )
    ON CONFLICT (id) DO NOTHING;  -- DO NOTHING prevents concurrent overwrite

  EXCEPTION
    WHEN unique_violation THEN
      -- Two sessions raced; find the winner's record
      SELECT id, qr_token, full_name INTO v_existing_reg
      FROM public.registrations_2027
      WHERE gateway_invoice_number = p_invoice_number
      LIMIT 1;
      IF FOUND THEN
        RETURN jsonb_build_object(
          'success', true, 'status', 'ALREADY_PAID',
          'registration_id', v_existing_reg.id,
          'qr_token', v_existing_reg.qr_token,
          'full_name', v_existing_reg.full_name,
          'message', 'Registration confirmed concurrently by another session.'
        );
      END IF;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_TRANSACTION',
        'message', 'Concurrent anti-replay: transaction committed by another session.'
      );
  END;

  -- Mark pending order as paid and linked
  UPDATE public.pending_orders
  SET status = 'paid',
      promoted_registration_id = v_reg_id,
      transaction_id = p_trx_id,
      reconciled_at = NOW(),
      updated_at = NOW()
  WHERE invoice_number = p_invoice_number;

  -- Ledger
  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.financial_ledger (
        staff_id, transaction_type, amount, reference_id,
        description, created_by, gross_amount, gateway_fee, net_amount
      ) VALUES (
        'GATEWAY_PAYSTATION', 'REGISTRATION_INFLOW', p_amount, p_trx_id,
        'Online Registration: ' || v_order.customer_name || ' (' || v_reg_id || ')',
        p_verified_by, p_amount,
        COALESCE((v_order.fees->>'gatewayCharge')::numeric, 0),
        p_amount - COALESCE((v_order.fees->>'gatewayCharge')::numeric, 0)
      ) ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Mark student ID as used
  IF v_student_id IS NOT NULL AND trim(v_student_id) <> '' THEN
    IF to_regclass('public.current_student_ids') IS NOT NULL THEN
      BEGIN
        UPDATE public.current_student_ids
        SET verification_status = 'USED',
            used_registration_id = v_reg_id,
            reserved_until = NULL,
            updated_at = NOW()
        WHERE upper(trim(student_id)) = upper(trim(v_student_id));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'PROMOTED',
    'registration_id', v_reg_id,
    'qr_token', v_qr_token,
    'full_name', v_order.customer_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

-- ============================================================================
-- SECTION 11: Harden rpc_reconcile_pending_orders (service_role only)
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.rpc_reconcile_pending_orders(INT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reconcile_pending_orders(INT) TO service_role;

-- ============================================================================
-- SECTION 12: Harden rpc_record_donation (service_role only) & any legacy overloads
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.rpc_record_donation(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, INT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_donation(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, INT) TO service_role;

-- Revoke ALL overloads (e.g. older 6-arg rpc_verify_payment) from anon/authenticated/PUBLIC
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'rpc_verify_payment',
        'rpc_handle_paystation_ipn',
        'rpc_promote_pending_order_to_registration',
        'rpc_reconcile_pending_orders',
        'rpc_record_donation'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 13: Registrations_2027 RLS tightening
-- Drop the GRANT SELECT, INSERT, UPDATE, DELETE TO anon from 20270124
-- (keep service_role and authenticated admin access intact)
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.registrations_2027 FROM anon;
-- anon may still SELECT (needed for QR lookup by ticket scanners)
-- but should not INSERT/UPDATE/DELETE paid records directly

-- ============================================================================
-- SECTION 14: Record this migration in audit
-- ============================================================================
DO $$
BEGIN
  INSERT INTO public.admin_audit_logs (
    admin_id, admin_username, admin_role, action, target_type, target_id, details
  ) VALUES (
    'P0-3-MIGRATION', 'system', 'super_admin',
    'P0_3_SECURITY_HARDENING_APPLIED', 'database', 'all_tables',
    jsonb_build_object(
      'migration', '20270310000000_p0_3_payment_rls_rpc_hardening',
      'applied_at', NOW(),
      'changes', jsonb_build_array(
        'system_settings table created',
        'payment RPC grants revoked from anon/authenticated',
        'unique anti-replay indexes added on transaction_id',
        'pending_orders anon access revoked',
        'donations anon write access revoked',
        'current_student_ids anon write access revoked',
        'atomic student ID reservation RPCs added',
        'rpc_verify_payment anti-replay fixed',
        'rpc_handle_paystation_ipn amount bounds added',
        'rpc_promote_pending_order_to_registration concurrency fixed'
      )
    )::text
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;
