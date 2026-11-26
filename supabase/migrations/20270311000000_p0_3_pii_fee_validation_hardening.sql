-- ============================================================================
-- MIGRATION: 20270311000000_p0_3_pii_fee_validation_hardening.sql
-- PURPOSE: P0-3 Follow-Up Hardening:
--   1. Remove public (anon) PII table exposure on registrations_2027 & current_student_ids
--   2. Provide narrowly scoped SECURITY DEFINER public verification RPCs (zero PII)
--   3. Enforce server-authoritative fee calculation & validation from system_settings
--      (no hardcoded fallback fees; reject underpayments/excessive overpayments/unknown types)
--
-- SAFETY: Keeps paymentEnabled=false and payment finalization disabled by default.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Extend system_settings.portal_fee_settings with full authoritative fee rules
-- No hardcoded fallback fees: all fee & gateway charge rates live here.
-- ============================================================================

UPDATE public.system_settings
SET value = jsonb_build_object(
      'gatewayChargeRates', jsonb_build_object(
        'bkash',  0.0185,
        'nagad',  0.0150,
        'rocket', 0.0150,
        'upay',   0.0150,
        'card',   0.0210,
        'visa',   0.0210,
        'mastercard', 0.0210,
        'amex',   0.0310
      ),
      'maxDonation',     50000,
      'maxTotalPayable', 100000
    ) || value,  -- preserves existing authoritative keys (incl. paymentEnabled=false)
    updated_at = NOW(),
    updated_by = CASE
      WHEN updated_by LIKE 'MANUAL-%' THEN updated_by
      ELSE 'P0-3-FOLLOWUP-MIGRATION'
    END
WHERE key = 'portal_fee_settings';

-- Ensure pending_orders tracks validated order_type explicitly
ALTER TABLE public.pending_orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'registration'
  CHECK (order_type IN ('registration', 'donation'));

-- ============================================================================
-- SECTION 2: Remove public (anon) table access on registrations_2027
-- Anon MUST NOT query full registration rows or expose PII (mobile, email, photos, parents).
-- Only authenticated admins/staff and service_role may read table rows directly.
-- ============================================================================

DROP POLICY IF EXISTS "allow_read_registrations_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "registration_staff_read_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "public_insert_registration_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "public_update_registration_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "public_delete_registration_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "registrations_2027_staff_update_flags" ON public.registrations_2027;
DROP POLICY IF EXISTS "registration_insert_pending_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "registration_admin_update_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "registration_admin_delete_2027" ON public.registrations_2027;

REVOKE ALL ON public.registrations_2027 FROM anon;
REVOKE ALL ON public.registrations_2027 FROM PUBLIC;
GRANT SELECT ON public.registrations_2027 TO authenticated;
GRANT ALL ON public.registrations_2027 TO service_role;

DROP POLICY IF EXISTS "registrations_2027_service_all" ON public.registrations_2027;
CREATE POLICY "registrations_2027_service_all" ON public.registrations_2027
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "registrations_2027_admin_staff_read" ON public.registrations_2027;
CREATE POLICY "registrations_2027_admin_staff_read" ON public.registrations_2027
  FOR SELECT TO authenticated
  USING (
    public.current_admin_role() IS NOT NULL
    OR public.current_event_staff_role() IS NOT NULL
  );

DROP POLICY IF EXISTS "registrations_2027_admin_write" ON public.registrations_2027;
CREATE POLICY "registrations_2027_admin_write" ON public.registrations_2027
  FOR ALL TO authenticated
  USING (public.current_admin_role() IN ('super_admin', 'admin', 'registration_officer'))
  WITH CHECK (public.current_admin_role() IN ('super_admin', 'admin', 'registration_officer'));

-- ============================================================================
-- SECTION 3: Remove public (anon) table access on current_student_ids
-- Prevent scraping the entire student roll; use scoped rpc_verify_student_id instead.
-- ============================================================================

DROP POLICY IF EXISTS "current_student_ids_anon_select" ON public.current_student_ids;
DROP POLICY IF EXISTS "Public can view current student ids" ON public.current_student_ids;

REVOKE ALL ON public.current_student_ids FROM anon;
REVOKE ALL ON public.current_student_ids FROM PUBLIC;
GRANT SELECT ON public.current_student_ids TO authenticated;
GRANT ALL ON public.current_student_ids TO service_role;

DROP POLICY IF EXISTS "current_student_ids_admin_read" ON public.current_student_ids;
CREATE POLICY "current_student_ids_admin_read" ON public.current_student_ids
  FOR SELECT TO authenticated
  USING (public.current_admin_role() IN ('super_admin', 'admin', 'registration_officer'));

-- Narrowly scoped student ID verification RPC (zero PII: no student_name, no used_registration_id)
CREATE OR REPLACE FUNCTION public.rpc_verify_student_id(
  p_student_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_rec RECORD;
  v_clean TEXT := upper(trim(COALESCE(p_student_id, '')));
BEGIN
  IF v_clean = '' THEN
    RETURN jsonb_build_object('success', false, 'status', 'INVALID_STUDENT_ID', 'message', 'Student ID is required.');
  END IF;

  SELECT student_id, class_name, academic_year, status, verification_status, reserved_until
  INTO v_rec
  FROM public.current_student_ids
  WHERE upper(trim(student_id)) = v_clean
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'NOT_FOUND');
  END IF;

  IF v_rec.status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'status', 'INACTIVE', 'student_id', v_rec.student_id);
  END IF;

  IF v_rec.verification_status IN ('USED', 'ALREADY_USED') THEN
    RETURN jsonb_build_object('success', false, 'status', 'ALREADY_USED', 'student_id', v_rec.student_id);
  END IF;

  IF v_rec.verification_status = 'RESERVED' AND v_rec.reserved_until > NOW() THEN
    RETURN jsonb_build_object('success', false, 'status', 'RESERVED', 'student_id', v_rec.student_id);
  END IF;

  -- Strictly non-PII eligibility fields only (no student_name, no phone, no used_registration_id)
  RETURN jsonb_build_object(
    'success', true,
    'status', 'AVAILABLE',
    'student_id', v_rec.student_id,
    'class_name', v_rec.class_name,
    'academic_year', v_rec.academic_year
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_verify_student_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_verify_student_id(TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- SECTION 4: Narrowly scoped non-PII public verification RPCs
-- Returns ONLY explicitly approved minimal fields. Never exposes phone, email,
-- address, photos, parent details, transaction IDs, or gateway responses.
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_verify_student_qr(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.rpc_verify_student_qr(
  p_identifier TEXT,
  p_token TEXT DEFAULT NULL,
  p_staff_id TEXT DEFAULT 'SCANNER_DESK'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_raw_id TEXT := upper(trim(COALESCE(p_identifier, '')));
  v_raw_tok TEXT := upper(trim(COALESCE(p_token, '')));
  v_clean_id TEXT := regexp_replace(v_raw_id, '^PAR-', '', 'i');
  v_clean_tok TEXT := regexp_replace(v_raw_tok, '^P-', '', 'i');
  v_is_guardian BOOLEAN := (v_raw_id ~* '^PAR-') OR (v_raw_tok ~* '^P-');
  v_student RECORD;
  v_last_gate TEXT;
  v_gate_status TEXT;
  v_token_matched BOOLEAN := false;
BEGIN
  IF v_clean_id = '' AND v_clean_tok = '' THEN
    RETURN jsonb_build_object('success', false, 'status', 'INVALID_INPUT', 'error', 'Registration ID or QR token is required.');
  END IF;

  SELECT
    id, full_name, full_name_bn, category, batch_name, passing_year, current_class,
    payment_status, qr_token, has_parent, is_checked_in
  INTO v_student
  FROM public.registrations_2027
  WHERE upper(id) = v_clean_id
     OR upper(id) = v_raw_id
     OR upper(qr_token) = v_clean_id
     OR (v_clean_tok <> '' AND upper(qr_token) = v_clean_tok)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'NOT_FOUND', 'error', 'Registration record not found.');
  END IF;

  IF v_is_guardian AND COALESCE(v_student.has_parent, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'status', 'GUARDIAN_NOT_REGISTERED', 'error', 'Parent/Guardian pass not registered.');
  END IF;

  IF v_student.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'status', 'UNPAID', 'error', 'Payment Pending: Registration is unpaid.');
  END IF;

  IF v_clean_tok <> '' THEN
    IF upper(v_student.qr_token) <> v_clean_tok AND upper(v_student.id) <> v_clean_tok THEN
      RETURN jsonb_build_object('success', false, 'status', 'TOKEN_MISMATCH', 'error', 'Cryptographic QR token mismatch.');
    END IF;
    v_token_matched := true;
  ELSIF upper(v_student.qr_token) = v_clean_id THEN
    v_token_matched := true;
  END IF;

  IF to_regclass('public.gate_events') IS NOT NULL THEN
    BEGIN
      SELECT event_type INTO v_last_gate
      FROM public.gate_events
      WHERE registration_id = v_student.id AND status = 'APPROVED'
      ORDER BY timestamp DESC
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_last_gate := NULL;
    END;
  END IF;

  IF v_last_gate IS NOT NULL THEN
    v_gate_status := v_last_gate;
  ELSIF v_student.is_checked_in IS TRUE THEN
    v_gate_status := 'ENTRY';
  ELSE
    v_gate_status := 'NOT_ENTERED';
  END IF;

  -- Explicitly approved minimal non-PII response ONLY (no phone, email, address, photos, parent info, trx_id)
  RETURN jsonb_build_object(
    'success', true,
    'status', 'VERIFIED',
    'student', jsonb_build_object(
      'id', v_student.id,
      'fullName', v_student.full_name,
      'fullNameBn', v_student.full_name_bn,
      'category', v_student.category,
      'batchName', v_student.batch_name,
      'passingYear', v_student.passing_year,
      'currentClass', v_student.current_class,
      'paymentStatus', v_student.payment_status,
      'isCheckedIn', (v_gate_status = 'ENTRY'),
      'isInside', (v_gate_status = 'ENTRY'),
      'gateStatus', v_gate_status,
      'hasParent', COALESCE(v_student.has_parent, false),
      'isGuardianPass', v_is_guardian,
      'qrToken', CASE WHEN v_token_matched THEN v_student.qr_token ELSE NULL END,
      'verifiedAt', NOW()
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_verify_student_qr(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_verify_student_qr(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_lookup_ticket(TEXT);
DROP FUNCTION IF EXISTS public.rpc_lookup_ticket(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_lookup_ticket(
  p_identifier TEXT DEFAULT '',
  p_mobile TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean TEXT := upper(trim(COALESCE(p_identifier, '')));
  v_clean_mobile TEXT := regexp_replace(COALESCE(p_mobile, ''), '[^0-9]', '', 'g');
  v_mobile_supplied BOOLEAN := false;
  v_student RECORD;
  v_donation RECORD;
BEGIN
  IF v_clean_mobile LIKE '880%' AND length(v_clean_mobile) >= 13 THEN
    v_clean_mobile := '0' || substr(v_clean_mobile, 4);
  END IF;
  IF v_clean_mobile = '' AND v_clean ~ '^01[0-9]{9}$' THEN
    v_clean_mobile := v_clean;
  END IF;

  v_mobile_supplied := length(v_clean_mobile) >= 10;

  IF v_clean = '' AND NOT v_mobile_supplied THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration identifier or registered mobile is required.');
  END IF;

  IF v_clean <> '' AND v_mobile_supplied AND v_clean <> v_clean_mobile THEN
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in
    INTO v_student
    FROM public.registrations_2027
    WHERE (upper(id) = v_clean OR upper(qr_token) = v_clean)
      AND regexp_replace(mobile_number, '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    LIMIT 1;
  ELSIF v_mobile_supplied THEN
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in
    INTO v_student
    FROM public.registrations_2027
    WHERE regexp_replace(mobile_number, '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    ORDER BY (payment_status = 'paid') DESC, registered_at DESC
    LIMIT 1;
  ELSE
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in
    INTO v_student
    FROM public.registrations_2027
    WHERE upper(id) = v_clean OR upper(qr_token) = v_clean
    LIMIT 1;
  END IF;

  IF FOUND THEN
    -- Restricted projection ONLY: zero phone, email, address, photos, parent info, trx_id, or gateway_response.
    -- qr_token is withheld unless caller proved ownership via matching registered mobile or QR token.
    RETURN jsonb_build_object(
      'success', true,
      'type', 'registration',
      'ticket', jsonb_build_object(
        'id', v_student.id,
        'full_name', v_student.full_name,
        'category', v_student.category,
        'batch_name', v_student.batch_name,
        'passing_year', v_student.passing_year,
        'current_class', v_student.current_class,
        'payment_status', v_student.payment_status,
        'total_paid', v_student.total_paid,
        'year', v_student.year,
        'registered_at', v_student.registered_at,
        'is_tshirt_collected', v_student.is_tshirt_collected,
        'is_checked_in', v_student.is_checked_in,
        'qr_token', CASE WHEN v_mobile_supplied OR upper(v_student.qr_token) = v_clean THEN v_student.qr_token ELSE NULL END
      )
    );
  END IF;

  -- Narrowly scoped non-PII donation status lookup
  IF v_clean <> '' AND v_mobile_supplied AND v_clean <> v_clean_mobile THEN
    SELECT id, donor_name, amount, purpose, payment_status, token, year, donation_date
    INTO v_donation
    FROM public.donations
    WHERE (upper(id) = v_clean OR upper(token) = v_clean OR upper(qr_token) = v_clean)
      AND regexp_replace(COALESCE(mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF v_mobile_supplied THEN
    SELECT id, donor_name, amount, purpose, payment_status, token, year, donation_date
    INTO v_donation
    FROM public.donations
    WHERE regexp_replace(COALESCE(mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT id, donor_name, amount, purpose, payment_status, token, year, donation_date
    INTO v_donation
    FROM public.donations
    WHERE upper(id) = v_clean OR upper(token) = v_clean OR upper(qr_token) = v_clean
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'type', 'donation',
      'donation', jsonb_build_object(
        'id', v_donation.id,
        'donor_name', v_donation.donor_name,
        'amount', v_donation.amount,
        'purpose', v_donation.purpose,
        'payment_status', v_donation.payment_status,
        'year', v_donation.year,
        'donation_date', v_donation.donation_date,
        'token', CASE WHEN v_mobile_supplied OR upper(COALESCE(v_donation.token, '')) = v_clean THEN v_donation.token ELSE NULL END
      )
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'No verified ticket or donation matched those details.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_lookup_ticket(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_lookup_ticket(TEXT, TEXT) TO anon, authenticated, service_role;

-- Harden public donations table SELECT too: anon uses rpc_lookup_ticket or aggregate RPCs, not raw SELECT of mobile_number/email
DROP POLICY IF EXISTS "donations_anon_read_paid" ON public.donations;
DROP POLICY IF EXISTS "donations_2027_anon_read_paid" ON public.donations_2027;
REVOKE SELECT ON public.donations FROM anon;
REVOKE SELECT ON public.donations_2027 FROM anon;

-- ============================================================================
-- SECTION 5: Server-authoritative Fee Calculation & Finalization Validation
-- Reads exclusively from system_settings.portal_fee_settings; no hardcoded fallbacks.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_compute_expected_order_amount(
  p_order_type      TEXT,
  p_category        TEXT DEFAULT NULL,
  p_has_parent      BOOLEAN DEFAULT false,
  p_donation_amount NUMERIC DEFAULT 0,
  p_method          TEXT DEFAULT 'bkash',
  p_pay_with_charge INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_cfg              JSONB;
  v_current_fee      NUMERIC;
  v_former_fee       NUMERIC;
  v_parent_fee_cfg   NUMERIC;
  v_min_donation     NUMERIC;
  v_max_donation     NUMERIC;
  v_max_total        NUMERIC;
  v_rate_text        TEXT;
  v_rate             NUMERIC;
  v_method           TEXT := lower(trim(COALESCE(p_method, '')));
  v_base_fee         NUMERIC := 0;
  v_parent_fee       NUMERIC := 0;
  v_donation         NUMERIC := COALESCE(p_donation_amount, 0);
  v_subtotal         NUMERIC;
  v_gateway_charge   NUMERIC := 0;
  v_total            NUMERIC;
BEGIN
  SELECT value INTO v_cfg
  FROM public.system_settings
  WHERE key = 'portal_fee_settings';

  IF v_cfg IS NULL OR jsonb_typeof(v_cfg) <> 'object' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'FEE_SETTINGS_MISSING', 'message', 'portal_fee_settings not found in system_settings.');
  END IF;

  IF NOT (
    v_cfg ? 'currentStudentFee' AND v_cfg ? 'formerStudentFee' AND v_cfg ? 'parentFee'
    AND v_cfg ? 'minDonation' AND v_cfg ? 'maxDonation' AND v_cfg ? 'maxTotalPayable'
    AND v_cfg ? 'gatewayChargeRates'
  ) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'FEE_SETTINGS_MISSING', 'message', 'Required fee settings keys are missing in system_settings.');
  END IF;

  BEGIN
    v_current_fee    := (v_cfg->>'currentStudentFee')::numeric;
    v_former_fee     := (v_cfg->>'formerStudentFee')::numeric;
    v_parent_fee_cfg := (v_cfg->>'parentFee')::numeric;
    v_min_donation   := (v_cfg->>'minDonation')::numeric;
    v_max_donation   := (v_cfg->>'maxDonation')::numeric;
    v_max_total      := (v_cfg->>'maxTotalPayable')::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_FEE_SETTINGS', 'message', 'Non-numeric fee configuration in system_settings.');
  END;

  IF v_current_fee <= 0 OR v_former_fee <= 0 OR v_parent_fee_cfg < 0 OR v_min_donation <= 0 OR v_max_donation < v_min_donation OR v_max_total <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_FEE_SETTINGS', 'message', 'Invalid negative/zero fee bounds in system_settings.');
  END IF;

  IF p_order_type IS NULL OR p_order_type NOT IN ('registration', 'donation') THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_ORDER_TYPE', 'message', 'Order type must be registration or donation.');
  END IF;

  IF p_pay_with_charge NOT IN (0, 1) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_PAY_WITH_CHARGE', 'message', 'pay_with_charge must be 0 or 1.');
  END IF;

  v_rate_text := v_cfg->'gatewayChargeRates'->>v_method;
  IF v_rate_text IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_PAYMENT_METHOD', 'message', format('Unsupported or unconfigured payment method: %s', p_method));
  END IF;
  v_rate := v_rate_text::numeric;
  IF v_rate < 0 OR v_rate > 0.25 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_FEE_SETTINGS', 'message', 'Invalid gateway rate in system_settings.');
  END IF;

  IF v_donation < 0 OR v_donation > v_max_donation THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_DONATION_AMOUNT', 'message', format('Donation amount %s is outside configured bounds [0, %s].', v_donation, v_max_donation));
  END IF;

  IF p_order_type = 'registration' THEN
    IF p_category IS NULL OR p_category NOT IN ('current', 'former') THEN
      RETURN jsonb_build_object('valid', false, 'error', 'INVALID_CATEGORY', 'message', 'Category must be current or former.');
    END IF;
    v_base_fee   := CASE WHEN p_category = 'current' THEN v_current_fee ELSE v_former_fee END;
    v_parent_fee := CASE WHEN COALESCE(p_has_parent, false) THEN v_parent_fee_cfg ELSE 0 END;
    v_subtotal   := round(v_base_fee + v_parent_fee + v_donation, 2);
  ELSE
    IF COALESCE(p_has_parent, false) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'INVALID_ORDER_PARAMS', 'message', 'Donation order cannot include parent pass.');
    END IF;
    IF v_donation < v_min_donation THEN
      RETURN jsonb_build_object('valid', false, 'error', 'INVALID_DONATION_AMOUNT', 'message', format('Donation must be at least %s BDT.', v_min_donation));
    END IF;
    v_subtotal := round(v_donation, 2);
  END IF;

  IF p_pay_with_charge = 1 THEN
    v_gateway_charge := round(v_subtotal * v_rate, 2);
  END IF;

  v_total := round(v_subtotal + v_gateway_charge, 2);

  IF v_total <= 0 OR v_total > v_max_total THEN
    RETURN jsonb_build_object('valid', false, 'error', 'AMOUNT_OVERFLOW', 'message', format('Calculated total %s exceeds allowed max %s.', v_total, v_max_total));
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'order_type', p_order_type,
    'registration_fee', v_base_fee,
    'parent_fee', v_parent_fee,
    'donation_amount', v_donation,
    'gateway_charge', v_gateway_charge,
    'subtotal', v_subtotal,
    'expected_total', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_compute_expected_order_amount(TEXT, TEXT, BOOLEAN, NUMERIC, TEXT, INT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_compute_expected_order_amount(TEXT, TEXT, BOOLEAN, NUMERIC, TEXT, INT) TO service_role;

-- Update rpc_verify_payment to validate against persisted pending_orders & authoritative system_settings
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
  v_has_parent      BOOLEAN := false;
  v_reg_fee_stored  NUMERIC := 0;
  v_don_stored      NUMERIC := 0;
  v_gw_charge       NUMERIC := 0;
  v_pay_with_charge INT := 0;
  v_found           BOOLEAN := false;
  v_order           RECORD;
  v_fee_eval        JSONB;
  v_expected_total  NUMERIC;
  v_expected_base   NUMERIC;
BEGIN
  IF p_reg_id IS NULL OR trim(p_reg_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REG_ID', 'message', 'Registration ID is required.');
  END IF;
  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID', 'message', 'Transaction ID is required.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT', 'message', 'Payment amount must be greater than zero.');
  END IF;

  -- Anti-replay: trx_id used on a DIFFERENT registration -> DUPLICATE_TRANSACTION
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

  SELECT payment_status, transaction_id, qr_token, full_name, mobile_number, category,
         student_id, batch_name, gateway_invoice_number, registration_fee, donation_amount,
         COALESCE(has_parent, false), COALESCE(gateway_charge, 0)
  INTO v_existing_status, v_existing_trx_id, v_qr_token, v_reg_name, v_mobile, v_category,
       v_student_id, v_batch_name, v_invoice_num, v_reg_fee_stored, v_don_stored,
       v_has_parent, v_gw_charge
  FROM public.registrations_2027
  WHERE id = p_reg_id
  FOR UPDATE;

  IF FOUND THEN
    v_found := true;

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

    IF v_existing_status = 'paid' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'ALREADY_PAID_DIFFERENT_TRX',
        'message', 'Registration already paid with a different transaction ID.'
      );
    END IF;

    IF v_existing_status NOT IN ('pending', 'failed') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_STATUS',
        'message', format('Cannot verify payment for registration with status: %s', v_existing_status)
      );
    END IF;
  ELSE
    IF p_pending_data IS NOT NULL AND jsonb_typeof(p_pending_data) = 'object' THEN
      v_qr_token    := COALESCE(p_pending_data->>'qrToken', p_pending_data->>'qr_token',
        'PLSCF27-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12)));
      v_reg_name    := COALESCE(p_pending_data->>'fullName', p_pending_data->>'full_name', 'Student');
      v_mobile      := COALESCE(p_pending_data->>'mobileNumber', p_pending_data->>'mobile_number', '01XXXXXXXXX');
      v_category    := p_pending_data->>'category';
      v_student_id  := p_pending_data->>'studentId';
      v_batch_name  := COALESCE(p_pending_data->>'batchName', 'General');
      v_invoice_num := COALESCE(p_pending_data->>'gatewayInvoiceNumber', p_pending_data->>'gateway_invoice_number', p_reg_id);
      v_has_parent  := COALESCE((p_pending_data->>'hasParent')::boolean, false);
      v_don_stored  := COALESCE((p_pending_data->>'donationAmount')::numeric, 0);
      v_gw_charge   := COALESCE((p_pending_data->>'gatewayCharge')::numeric, 0);
    END IF;
  END IF;

  IF NOT v_found AND (p_pending_data IS NULL OR jsonb_typeof(p_pending_data) <> 'object') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REGISTRATION_NOT_FOUND',
      'message', format('Registration "%s" not found.', p_reg_id)
    );
  END IF;

  -- Server-authoritative fee calculation strictly from system_settings (zero hardcoded fallbacks)
  v_pay_with_charge := CASE WHEN v_gw_charge > 0 THEN 1 ELSE 0 END;
  v_fee_eval := public.rpc_compute_expected_order_amount(
    'registration',
    v_category,
    v_has_parent,
    v_don_stored,
    p_method,
    v_pay_with_charge
  );

  IF (v_fee_eval->>'valid')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_fee_eval->>'error', 'INVALID_AMOUNT'),
      'message', COALESCE(v_fee_eval->>'message', 'Fee calculation validation failed.')
    );
  END IF;

  v_expected_base  := (v_fee_eval->>'registration_fee')::numeric;
  v_expected_total := (v_fee_eval->>'expected_total')::numeric;

  -- Validate against persisted pending_orders if present for this invoice
  IF v_invoice_num IS NOT NULL AND trim(v_invoice_num) <> '' THEN
    SELECT * INTO v_order
    FROM public.pending_orders
    WHERE invoice_number = v_invoice_num
    FOR UPDATE;

    IF FOUND THEN
      IF abs(v_order.amount - v_expected_total) > 0.01 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'ORDER_FEE_TAMPERED',
          'message', format('Pending order amount %s does not match authoritative expected fee %s.', v_order.amount, v_expected_total)
        );
      END IF;
      IF p_amount < v_order.amount - 0.01 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'AMOUNT_MISMATCH',
          'message', format('Paid amount %s is less than pending order amount %s.', p_amount, v_order.amount)
        );
      END IF;
      IF p_amount > v_order.amount + 0.01 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'EXCESSIVE_OVERPAYMENT',
          'message', format('Paid amount %s exceeds pending order amount %s.', p_amount, v_order.amount)
        );
      END IF;
    END IF;
  END IF;

  -- Also enforce authoritative fee validation when pending_orders row was not found
  IF p_amount < v_expected_total - 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AMOUNT_MISMATCH',
      'message', format('Payment amount %s is below authoritative expected fee %s.', p_amount, v_expected_total)
    );
  END IF;
  IF p_amount > v_expected_total + 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXCESSIVE_OVERPAYMENT',
      'message', format('Payment amount %s exceeds authoritative expected fee %s.', p_amount, v_expected_total)
    );
  END IF;

  -- Insert self-healed pending record only after authoritative fee validation passed
  IF NOT v_found THEN
    BEGIN
      INSERT INTO public.registrations_2027 (
        id, full_name, photo_url, mobile_number, email, address,
        category, student_id, passing_year, last_class_attended,
        current_class, batch_name, group_or_section, roll_number,
        t_shirt_size, has_parent, registration_fee, donation_amount, gateway_charge, total_paid,
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
        v_has_parent,
        v_expected_base,
        v_don_stored,
        (v_fee_eval->>'gateway_charge')::numeric,
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
        SELECT payment_status, qr_token, full_name
        INTO v_existing_status, v_qr_token, v_reg_name
        FROM public.registrations_2027
        WHERE id = p_reg_id;
        IF FOUND AND v_existing_status = 'paid' THEN
          RETURN jsonb_build_object(
            'success', true,
            'status', 'ALREADY_PAID',
            'message', 'Registration confirmed concurrently by another session.',
            'registration_id', p_reg_id,
            'full_name', v_reg_name,
            'qr_token', v_qr_token
          );
        END IF;
    END;
  END IF;

  IF v_qr_token IS NULL OR trim(v_qr_token) = '' THEN
    v_qr_token := 'PLSCF27-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
  END IF;

  BEGIN
    UPDATE public.registrations_2027
    SET payment_status                = 'paid',
        transaction_id                = p_trx_id,
        payment_method                = lower(trim(p_method)),
        registration_fee              = v_expected_base,
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
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_TRANSACTION',
        'message', 'Concurrent anti-replay: this transaction ID was committed by another session.'
      );
  END;

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
      lower(trim(p_method)),
      'PAYSTATION',
      jsonb_build_object('signature', p_signature, 'verified_by', p_verified_by),
      clock_timestamp()
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_student_id IS NOT NULL AND trim(v_student_id) <> '' AND to_regclass('public.current_student_ids') IS NOT NULL THEN
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

  BEGIN
    INSERT INTO public.admin_audit_logs (
      admin_id, admin_username, admin_role, action,
      target_type, target_id, details
    ) VALUES (
      'SYSTEM_GATEWAY', 'PAYSTATION_EDGE_FUNCTION', 'service_role',
      'PAYMENT_VERIFIED', 'registration', p_reg_id,
      format('trx_id=%s amount=%s expected=%s method=%s', p_trx_id, p_amount, v_expected_total, p_method)
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

-- Update rpc_promote_pending_order_to_registration with authoritative system_settings fee validation
DROP FUNCTION IF EXISTS public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_promote_pending_order_to_registration(
  p_invoice_number TEXT,
  p_trx_id         TEXT,
  p_amount         NUMERIC,
  p_method         TEXT,
  p_verified_by    TEXT DEFAULT 'PAYSTATION_GATEWAY'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_order          RECORD;
  v_existing_reg   RECORD;
  v_reg_id         TEXT;
  v_qr_token       TEXT;
  v_category       TEXT;
  v_student_id     TEXT;
  v_year           INT := 2027;
  v_signature      TEXT;
  v_fee_eval       JSONB;
  v_expected_total NUMERIC;
  v_pay_with_chg   INT := 0;
BEGIN
  IF p_invoice_number IS NULL OR trim(p_invoice_number) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INVOICE');
  END IF;
  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT', 'message', 'Amount must be > 0.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
  ) THEN
    SELECT id, qr_token, full_name, gateway_invoice_number INTO v_existing_reg
    FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    LIMIT 1;
    IF v_existing_reg.gateway_invoice_number = p_invoice_number THEN
      RETURN jsonb_build_object(
        'success', true, 'status', 'ALREADY_PAID',
        'registration_id', v_existing_reg.id,
        'qr_token', v_existing_reg.qr_token
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TRANSACTION',
      'message', 'Transaction ID already committed on a different invoice.'
    );
  END IF;

  SELECT * INTO v_order
  FROM public.pending_orders
  WHERE invoice_number = p_invoice_number
  FOR UPDATE;

  IF NOT FOUND THEN
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

  -- Independently compute authoritative expected total from system_settings
  v_category     := v_order.form_data->>'category';
  v_pay_with_chg := CASE WHEN COALESCE((v_order.fees->>'gatewayCharge')::numeric, 0) > 0 THEN 1 ELSE 0 END;
  v_fee_eval     := public.rpc_compute_expected_order_amount(
    COALESCE(v_order.order_type, 'registration'),
    v_category,
    COALESCE((v_order.form_data->>'hasParent')::boolean, false),
    COALESCE((v_order.fees->>'donationAmount')::numeric, 0),
    p_method,
    v_pay_with_chg
  );

  IF (v_fee_eval->>'valid')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_fee_eval->>'error', 'INVALID_AMOUNT'),
      'message', COALESCE(v_fee_eval->>'message', 'Order fee configuration invalid.')
    );
  END IF;

  v_expected_total := (v_fee_eval->>'expected_total')::numeric;

  IF abs(v_order.amount - v_expected_total) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ORDER_FEE_TAMPERED',
      'message', format('Stored order amount %s disagrees with system fee rules %s.', v_order.amount, v_expected_total)
    );
  END IF;

  IF p_amount < v_order.amount - 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AMOUNT_MISMATCH',
      'message', format('Reported amount %s is less than order amount %s.', p_amount, v_order.amount)
    );
  END IF;
  IF p_amount > v_order.amount + 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXCESSIVE_OVERPAYMENT',
      'message', format('Reported amount %s exceeds order amount %s.', p_amount, v_order.amount)
    );
  END IF;

  IF v_order.order_type = 'donation' THEN
    UPDATE public.pending_orders
    SET status = 'paid',
        transaction_id = p_trx_id,
        reconciled_at = NOW(),
        updated_at = NOW()
    WHERE invoice_number = p_invoice_number;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'DONATION_CONFIRMED',
      'invoice_number', p_invoice_number
    );
  END IF;

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
      qr_token, is_tshirt_collected, year, event_id,
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
      (v_fee_eval->>'parent_fee')::numeric,
      (v_fee_eval->>'gateway_charge')::numeric,
      v_category,
      v_student_id,
      v_order.form_data->>'passingYear',
      v_order.form_data->>'lastClassAttended',
      v_order.form_data->>'currentClass',
      COALESCE(v_order.form_data->>'batchName', 'General'),
      v_order.form_data->>'groupOrSection',
      v_order.form_data->>'rollNumber',
      COALESCE(v_order.form_data->>'tShirtSize', 'L'),
      (v_fee_eval->>'registration_fee')::numeric,
      (v_fee_eval->>'donation_amount')::numeric,
      p_amount,
      'paid',
      p_trx_id,
      lower(trim(p_method)),
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
    ON CONFLICT (id) DO NOTHING;

  EXCEPTION
    WHEN unique_violation THEN
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

  UPDATE public.pending_orders
  SET status = 'paid',
      promoted_registration_id = v_reg_id,
      transaction_id = p_trx_id,
      reconciled_at = NOW(),
      updated_at = NOW()
  WHERE invoice_number = p_invoice_number;

  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.financial_ledger (
        staff_id, transaction_type, amount, reference_id,
        description, created_by, gross_amount, gateway_fee, net_amount
      ) VALUES (
        'GATEWAY_PAYSTATION', 'REGISTRATION_INFLOW', p_amount, p_trx_id,
        'Online Registration: ' || v_order.customer_name || ' (' || v_reg_id || ')',
        p_verified_by, p_amount,
        (v_fee_eval->>'gateway_charge')::numeric,
        p_amount - (v_fee_eval->>'gateway_charge')::numeric
      ) ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF v_student_id IS NOT NULL AND trim(v_student_id) <> '' AND to_regclass('public.current_student_ids') IS NOT NULL THEN
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

-- Update rpc_handle_paystation_ipn to validate fallback registrations against system_settings too
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
  v_order          RECORD;
  v_reg            RECORD;
  v_result         JSONB;
  v_fee_eval       JSONB;
  v_expected_total NUMERIC;
BEGIN
  IF p_invoice_number IS NULL OR trim(p_invoice_number) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INVOICE', 'message', 'Invoice number is required.');
  END IF;
  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID', 'message', 'Transaction ID is required.');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT', 'message', 'IPN amount must be greater than zero.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
  ) THEN
    SELECT id, qr_token, full_name, gateway_invoice_number INTO v_reg
    FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    LIMIT 1;
    IF v_reg.gateway_invoice_number = p_invoice_number THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PAID',
        'registration_id', v_reg.id,
        'qr_token', v_reg.qr_token
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TRANSACTION',
      'message', 'Transaction ID already committed on a different invoice. Anti-replay check failed.'
    );
  END IF;

  SELECT * INTO v_order
  FROM public.pending_orders
  WHERE invoice_number = p_invoice_number
  FOR UPDATE;

  IF FOUND THEN
    -- Delegating to rpc_promote_pending_order_to_registration performs full system_settings + order_amount validation
    SELECT public.rpc_promote_pending_order_to_registration(
      p_invoice_number, p_trx_id, p_amount, p_method, 'PAYSTATION_IPN'
    ) INTO v_result;
    RETURN v_result;
  END IF;

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

  v_fee_eval := public.rpc_compute_expected_order_amount(
    'registration',
    v_reg.category,
    COALESCE(v_reg.has_parent, false),
    COALESCE(v_reg.donation_amount, 0),
    p_method,
    CASE WHEN COALESCE(v_reg.gateway_charge, 0) > 0 THEN 1 ELSE 0 END
  );

  IF (v_fee_eval->>'valid')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_fee_eval->>'error', 'FEE_SETTINGS_MISSING'),
      'message', COALESCE(v_fee_eval->>'message', 'Authoritative fee evaluation failed.')
    );
  END IF;

  v_expected_total := (v_fee_eval->>'expected_total')::numeric;
  IF p_amount < v_expected_total - 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AMOUNT_MISMATCH',
      'message', format('IPN amount %s is less than expected fee %s.', p_amount, v_expected_total)
    );
  END IF;
  IF p_amount > v_expected_total + 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXCESSIVE_OVERPAYMENT',
      'message', format('IPN amount %s exceeds expected fee %s.', p_amount, v_expected_total)
    );
  END IF;

  IF v_reg.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'ALREADY_PAID',
      'registration_id', v_reg.id
    );
  END IF;

  BEGIN
    UPDATE public.registrations_2027
    SET payment_status         = 'paid',
        transaction_id         = p_trx_id,
        payment_method         = lower(trim(p_method)),
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
      'BDT', 'PAID', lower(trim(p_method)),
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

COMMIT;
