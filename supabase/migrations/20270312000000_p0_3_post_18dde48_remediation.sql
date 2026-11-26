-- ============================================================================
-- MIGRATION: 20270312000000_p0_3_post_18dde48_remediation.sql
-- PURPOSE: Post-18dde48 Security Remediation (P1 & P2)
--   1. Donation lookup privacy (harden rpc_lookup_donation, REVOKE ALL on
--      donations/donations_2027 from anon/PUBLIC, narrow authenticated grants)
--   2. Drop legacy 1-arg rpc_lookup_ticket(text) & harden rpc_lookup_ticket
--      against unauthenticated sequential ID enumeration
--   3. Restore manual_registrations & registration_approval_status checks in
--      rpc_verify_student_qr while preserving minimal zero-PII output
--   4. Repair payment-to-registration lifecycle & remove fabricated fallbacks in
--      rpc_promote_pending_order_to_registration and rpc_verify_payment
--   5. Set explicit fixed search_path on reviewed older privileged RPCs
--
-- SAFETY: Keeps paymentEnabled=false and payment finalization disabled.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Ensure schema columns for manual/approval checks & safe defaults
-- ============================================================================

ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS is_manual_registration BOOLEAN DEFAULT false;

ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'online';

ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS registration_approval_status TEXT DEFAULT 'approved';

-- ============================================================================
-- SECTION 2: Donation & table privilege lockdown (P1)
-- ============================================================================

REVOKE ALL ON public.donations FROM anon, PUBLIC;
REVOKE ALL ON public.donations FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;

DO $$
BEGIN
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.donations_2027 FROM anon, PUBLIC';
    EXECUTE 'REVOKE ALL ON public.donations_2027 FROM authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.donations_2027 TO authenticated';
    EXECUTE 'GRANT ALL ON public.donations_2027 TO service_role';
  END IF;
  IF to_regclass('public.manual_registrations') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.manual_registrations FROM anon, PUBLIC';
    EXECUTE 'REVOKE ALL ON public.manual_registrations FROM authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_registrations TO authenticated';
    EXECUTE 'GRANT ALL ON public.manual_registrations TO service_role';
  END IF;
END $$;

REVOKE ALL ON public.registrations_2027 FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations_2027 TO authenticated;

REVOKE ALL ON public.current_student_ids FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.current_student_ids TO authenticated;

REVOKE ALL ON public.pending_orders FROM authenticated;
GRANT SELECT ON public.pending_orders TO authenticated;

REVOKE ALL ON public.system_settings FROM anon, PUBLIC;
GRANT SELECT ON public.system_settings TO anon;
REVOKE ALL ON public.system_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

-- Replace rpc_lookup_donation: strictly minimal non-PII output + ownership proof
DROP FUNCTION IF EXISTS public.rpc_lookup_donation(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_lookup_donation(
  p_identifier TEXT,
  p_mobile TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean         TEXT := upper(trim(COALESCE(p_identifier, '')));
  v_clean_mobile  TEXT := regexp_replace(COALESCE(p_mobile, ''), '[^0-9]', '', 'g');
  v_mobile_ok     BOOLEAN := false;
  v_token_match   BOOLEAN := false;
  v_don           RECORD;
BEGIN
  IF v_clean_mobile LIKE '880%' AND length(v_clean_mobile) >= 13 THEN
    v_clean_mobile := '0' || substr(v_clean_mobile, 4);
  END IF;
  IF v_clean_mobile = '' AND v_clean ~ '^01[0-9]{9}$' THEN
    v_clean_mobile := v_clean;
  END IF;
  v_mobile_ok := length(v_clean_mobile) >= 10;

  IF v_clean = '' AND NOT v_mobile_ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'Donation identifier or registered mobile number is required.');
  END IF;

  IF v_clean <> '' AND v_mobile_ok AND v_clean <> v_clean_mobile THEN
    SELECT id, donor_name, amount, purpose, payment_status, token, qr_token, year, donation_date
    INTO v_don
    FROM public.donations
    WHERE (upper(id) = v_clean OR upper(COALESCE(token, '')) = v_clean OR upper(COALESCE(qr_token, '')) = v_clean)
      AND regexp_replace(COALESCE(mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF v_mobile_ok THEN
    SELECT id, donor_name, amount, purpose, payment_status, token, qr_token, year, donation_date
    INTO v_don
    FROM public.donations
    WHERE regexp_replace(COALESCE(mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    -- Token-only lookup allowed ONLY when matching cryptographic token/qr_token (prevents sequential DON- ID enumeration)
    SELECT id, donor_name, amount, purpose, payment_status, token, qr_token, year, donation_date
    INTO v_don
    FROM public.donations
    WHERE upper(COALESCE(token, '')) = v_clean
       OR upper(COALESCE(qr_token, '')) = v_clean
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    IF NOT v_mobile_ok AND v_clean ~* '^DON-' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'OWNERSHIP_VERIFICATION_REQUIRED',
        'message', 'Please enter your registered mobile number or 6-character thank-you token.'
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'No verified donation matched those details.');
  END IF;

  v_token_match := (
    v_clean <> ''
    AND (
      upper(COALESCE(v_don.token, '')) = v_clean
      OR upper(COALESCE(v_don.qr_token, '')) = v_clean
    )
  );

  -- Minimal non-PII response ONLY: zero mobile_number, zero email, zero transaction_id, zero gateway_invoice_number
  RETURN jsonb_build_object(
    'success', true,
    'donation', jsonb_build_object(
      'id', v_don.id,
      'donor_name', v_don.donor_name,
      'amount', v_don.amount,
      'purpose', v_don.purpose,
      'payment_status', v_don.payment_status,
      'year', v_don.year,
      'donation_date', v_don.donation_date,
      'token', CASE WHEN v_mobile_ok OR v_token_match THEN COALESCE(v_don.token, v_don.qr_token) ELSE NULL END
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_lookup_donation(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_lookup_donation(TEXT, TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- SECTION 3: Drop legacy 1-arg rpc_lookup_ticket overload & prevent ID enumeration
-- ============================================================================

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
  v_clean           TEXT := upper(trim(COALESCE(p_identifier, '')));
  v_clean_mobile    TEXT := regexp_replace(COALESCE(p_mobile, ''), '[^0-9]', '', 'g');
  v_mobile_supplied BOOLEAN := false;
  v_student         RECORD;
  v_donation        RECORD;
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
    -- Without mobile number, only allow cryptographic qr_token match (prevents sequential ID enumeration)
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in
    INTO v_student
    FROM public.registrations_2027
    WHERE upper(qr_token) = v_clean
    LIMIT 1;
  END IF;

  IF FOUND THEN
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
        'qr_token', v_student.qr_token
      )
    );
  END IF;

  -- Narrowly scoped non-PII donation status lookup
  IF v_clean <> '' AND v_mobile_supplied AND v_clean <> v_clean_mobile THEN
    SELECT id, donor_name, amount, purpose, payment_status, token, qr_token, year, donation_date
    INTO v_donation
    FROM public.donations
    WHERE (upper(id) = v_clean OR upper(COALESCE(token, '')) = v_clean OR upper(COALESCE(qr_token, '')) = v_clean)
      AND regexp_replace(COALESCE(mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF v_mobile_supplied THEN
    SELECT id, donor_name, amount, purpose, payment_status, token, qr_token, year, donation_date
    INTO v_donation
    FROM public.donations
    WHERE regexp_replace(COALESCE(mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT id, donor_name, amount, purpose, payment_status, token, qr_token, year, donation_date
    INTO v_donation
    FROM public.donations
    WHERE upper(COALESCE(token, '')) = v_clean
       OR upper(COALESCE(qr_token, '')) = v_clean
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
        'token', COALESCE(v_donation.token, v_donation.qr_token)
      )
    );
  END IF;

  IF NOT v_mobile_supplied AND EXISTS (
    SELECT 1 FROM public.registrations_2027 WHERE upper(id) = v_clean
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OWNERSHIP_VERIFICATION_REQUIRED',
      'message', 'Please enter your registered mobile number or 6-character QR token to view ticket details.'
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'No verified ticket or donation matched those details.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_lookup_ticket(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_lookup_ticket(TEXT, TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- SECTION 4: Restore manual_registrations & approval status in rpc_verify_student_qr
-- Preserves minimal zero-PII output and existing RLS protections.
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
  v_raw_id        TEXT := upper(trim(COALESCE(p_identifier, '')));
  v_raw_tok       TEXT := upper(trim(COALESCE(p_token, '')));
  v_clean_id      TEXT := regexp_replace(v_raw_id, '^PAR-', '', 'i');
  v_clean_tok     TEXT := regexp_replace(v_raw_tok, '^P-', '', 'i');
  v_is_guardian   BOOLEAN := (v_raw_id ~* '^PAR-') OR (v_raw_tok ~* '^P-');
  v_student       RECORD;
  v_manual_status TEXT;
  v_last_gate     TEXT;
  v_gate_status   TEXT;
  v_token_matched BOOLEAN := false;
BEGIN
  IF v_clean_id = '' AND v_clean_tok = '' THEN
    RETURN jsonb_build_object('success', false, 'status', 'INVALID_INPUT', 'error', 'Registration ID or QR token is required.');
  END IF;

  SELECT
    id, full_name, full_name_bn, category, batch_name, passing_year, current_class,
    payment_status, registration_approval_status, COALESCE(is_manual_registration, false) AS is_manual_registration,
    qr_token, has_parent, is_checked_in
  INTO v_student
  FROM public.registrations_2027
  WHERE upper(id) = v_clean_id
     OR upper(id) = v_raw_id
     OR upper(qr_token) = v_clean_id
     OR (v_clean_tok <> '' AND upper(qr_token) = v_clean_tok)
  LIMIT 1;

  IF NOT FOUND THEN
    IF to_regclass('public.manual_registrations') IS NOT NULL THEN
      v_manual_status := NULL;
      EXECUTE $sql$
        SELECT COALESCE(registration_approval_status, 'pending')
        FROM public.manual_registrations
        WHERE upper(id) = $1
           OR upper(id) = $2
           OR upper(qr_token) = $1
           OR ($3 <> '' AND upper(qr_token) = $3)
        LIMIT 1
      $sql$
      INTO v_manual_status
      USING v_clean_id, v_raw_id, v_clean_tok;

      IF v_manual_status IS NOT NULL THEN
        IF v_manual_status = 'rejected' THEN
          RETURN jsonb_build_object(
            'success', false,
            'status', 'REGISTRATION_REJECTED',
            'error', 'ID Card Not Approved by Admin: Registration has been rejected by Super Admin.'
          );
        END IF;
        RETURN jsonb_build_object(
          'success', false,
          'status', 'PENDING_APPROVAL',
          'error', 'ID Card Not Approved by Admin: Pending Super Admin approval & payment verification.'
        );
      END IF;
    END IF;

    RETURN jsonb_build_object('success', false, 'status', 'NOT_FOUND', 'error', 'Registration record not found.');
  END IF;

  IF v_is_guardian AND COALESCE(v_student.has_parent, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'status', 'GUARDIAN_NOT_REGISTERED', 'error', 'Parent/Guardian pass not registered.');
  END IF;

  IF v_student.registration_approval_status = 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'PENDING_APPROVAL',
      'error', 'ID Card Not Approved by Admin: Pending Super Admin approval & payment verification.'
    );
  END IF;

  IF v_student.registration_approval_status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REGISTRATION_REJECTED',
      'error', 'ID Card Not Approved by Admin: Registration has been rejected by Super Admin.'
    );
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

  -- Strictly non-PII response (zero phone, email, address, photoUrl, parent PII, trx_id)
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
      'registrationApprovalStatus', COALESCE(v_student.registration_approval_status, 'approved'),
      'isManualRegistration', v_student.is_manual_registration,
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

-- ============================================================================
-- SECTION 5: Strict pending_orders -> registrations_2027 promotion (zero fabricated fallbacks)
-- ============================================================================

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
  v_full_name      TEXT;
  v_mobile_number  TEXT;
  v_photo_url      TEXT;
  v_address        TEXT;
  v_batch_name     TEXT;
  v_tshirt_size    TEXT;
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
        'qr_token', v_existing_reg.qr_token,
        'full_name', v_existing_reg.full_name
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

  -- Fail closed on incomplete registration payload (NEVER fabricate placeholder defaults)
  v_full_name     := NULLIF(trim(COALESCE(v_order.form_data->>'fullName', v_order.customer_name, '')), '');
  v_mobile_number := NULLIF(trim(COALESCE(v_order.form_data->>'mobileNumber', v_order.customer_phone, '')), '');
  v_photo_url     := NULLIF(trim(COALESCE(v_order.form_data->>'photoUrl', '')), '');
  v_address       := NULLIF(trim(COALESCE(v_order.form_data->>'address', '')), '');
  v_batch_name    := NULLIF(trim(COALESCE(v_order.form_data->>'batchName', '')), '');
  v_tshirt_size   := NULLIF(trim(COALESCE(v_order.form_data->>'tShirtSize', '')), '');
  v_student_id    := NULLIF(trim(COALESCE(v_order.form_data->>'studentId', '')), '');

  IF v_full_name IS NULL
     OR v_mobile_number IS NULL
     OR v_photo_url IS NULL
     OR v_photo_url ILIKE '%via.placeholder.com%'
     OR v_address IS NULL
     OR v_batch_name IS NULL
     OR v_tshirt_size IS NULL
     OR (v_category = 'current' AND v_student_id IS NULL)
  THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_REGISTRATION_DATA',
      'message', 'Pending order lacks complete authoritative registration fields; refusing to fabricate fallback defaults.'
    );
  END IF;

  IF v_tshirt_size NOT IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_REGISTRATION_DATA',
      'message', format('Invalid T-shirt size in pending order: %s', v_tshirt_size)
    );
  END IF;

  v_year   := COALESCE(NULLIF(v_order.form_data->>'year', '')::int, 2027);
  v_reg_id := COALESCE(
    NULLIF(trim(v_order.form_data->>'registrationId'), ''),
    'PLSCF-' || v_year || '-' || (CASE WHEN v_category = 'current' THEN 'C' ELSE 'F' END) || floor(1000 + random() * 9000)::text
  );

  v_qr_token := COALESCE(
    NULLIF(trim(v_order.form_data->>'qrToken'), ''),
    upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6))
  );
  WHILE EXISTS (SELECT 1 FROM public.registrations_2027 WHERE qr_token = v_qr_token) LOOP
    v_qr_token := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  END LOOP;

  v_signature := 'SIG-PAY-' || encode(sha256((v_reg_id || ':' || p_trx_id || ':' || p_amount)::bytea), 'hex');

  BEGIN
    INSERT INTO public.registrations_2027 (
      id, full_name, full_name_bn, photo_url, photo_storage_path, mobile_number, email, address,
      gender, blood_group, has_parent, parent_name, parent_age,
      parent_phone, parent_relation, parent_photo_url, parent_photo_storage_path,
      parent_fee, gateway_charge, category, student_id, passing_year,
      last_class_attended, current_class, batch_name, group_or_section,
      roll_number, t_shirt_size, registration_fee, donation_amount,
      total_paid, payment_status, transaction_id, payment_method,
      gateway_invoice_number, gateway_provider, registered_at,
      qr_token, is_tshirt_collected, is_manual_registration, registration_type,
      registration_approval_status, year, event_id,
      server_verification_signature, verification_timestamp, verified_by
    ) VALUES (
      v_reg_id,
      v_full_name,
      v_order.form_data->>'fullNameBn',
      v_photo_url,
      v_order.form_data->>'photoStoragePath',
      v_mobile_number,
      COALESCE(NULLIF(trim(v_order.form_data->>'email'), ''), v_order.customer_email),
      v_address,
      COALESCE(NULLIF(trim(v_order.form_data->>'gender'), ''), 'male'),
      v_order.form_data->>'bloodGroup',
      COALESCE((v_order.form_data->>'hasParent')::boolean, false),
      v_order.form_data->>'parentName',
      NULLIF(trim(COALESCE(v_order.form_data->>'parentAge', '')), ''),
      v_order.form_data->>'parentPhone',
      v_order.form_data->>'parentRelation',
      v_order.form_data->>'parentPhotoUrl',
      v_order.form_data->>'parentPhotoStoragePath',
      (v_fee_eval->>'parent_fee')::numeric,
      (v_fee_eval->>'gateway_charge')::numeric,
      v_category,
      v_student_id,
      v_order.form_data->>'passingYear',
      v_order.form_data->>'lastClassAttended',
      v_order.form_data->>'currentClass',
      v_batch_name,
      v_order.form_data->>'groupOrSection',
      v_order.form_data->>'rollNumber',
      v_tshirt_size,
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
      false,
      'online',
      'approved',
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
        'Online Registration: ' || v_full_name || ' (' || v_reg_id || ')',
        p_verified_by, p_amount,
        (v_fee_eval->>'gateway_charge')::numeric,
        p_amount - (v_fee_eval->>'gateway_charge')::numeric
      ) ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF v_student_id IS NOT NULL AND to_regclass('public.current_student_ids') IS NOT NULL THEN
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
    'full_name', v_full_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

-- ============================================================================
-- SECTION 6: Converge rpc_verify_payment with pending_orders promotion + zero fallbacks
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
  v_address         TEXT;
  v_tshirt_size     TEXT;
  v_photo_url       TEXT;
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
  v_hint_invoice    TEXT := NULLIF(trim(COALESCE(p_pending_data->>'gatewayInvoiceNumber', p_pending_data->>'gateway_invoice_number', '')), '');
  v_promo_res       JSONB;
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
      AND (v_hint_invoice IS NULL OR COALESCE(gateway_invoice_number, '') <> v_hint_invoice)
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
     OR (v_hint_invoice IS NOT NULL AND gateway_invoice_number = v_hint_invoice)
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
    -- Converge with authoritative pending_orders when online registration wasn't pre-inserted in registrations_2027
    SELECT * INTO v_order
    FROM public.pending_orders
    WHERE invoice_number = COALESCE(v_hint_invoice, p_reg_id)
       OR invoice_number = p_reg_id
       OR (form_data->>'registrationId') = p_reg_id
    FOR UPDATE
    LIMIT 1;

    IF FOUND THEN
      SELECT public.rpc_promote_pending_order_to_registration(
        v_order.invoice_number,
        p_trx_id,
        p_amount,
        p_method,
        p_verified_by
      ) INTO v_promo_res;
      RETURN v_promo_res;
    END IF;

    -- Self-heal from p_pending_data ONLY when complete authoritative registration data is present
    IF p_pending_data IS NOT NULL AND jsonb_typeof(p_pending_data) = 'object' THEN
      v_qr_token    := NULLIF(trim(COALESCE(p_pending_data->>'qrToken', p_pending_data->>'qr_token', '')), '');
      v_reg_name    := NULLIF(trim(COALESCE(p_pending_data->>'fullName', p_pending_data->>'full_name', '')), '');
      v_mobile      := NULLIF(trim(COALESCE(p_pending_data->>'mobileNumber', p_pending_data->>'mobile_number', '')), '');
      v_category    := p_pending_data->>'category';
      v_student_id  := NULLIF(trim(COALESCE(p_pending_data->>'studentId', '')), '');
      v_batch_name  := NULLIF(trim(COALESCE(p_pending_data->>'batchName', p_pending_data->>'batch_name', '')), '');
      v_address     := NULLIF(trim(COALESCE(p_pending_data->>'address', '')), '');
      v_tshirt_size := NULLIF(trim(COALESCE(p_pending_data->>'tShirtSize', p_pending_data->>'t_shirt_size', '')), '');
      v_photo_url   := NULLIF(trim(COALESCE(p_pending_data->>'photoUrl', p_pending_data->>'photo_url', '')), '');
      v_invoice_num := COALESCE(v_hint_invoice, p_reg_id);
      v_has_parent  := COALESCE((p_pending_data->>'hasParent')::boolean, false);
      v_don_stored  := COALESCE((p_pending_data->>'donationAmount')::numeric, 0);
      v_gw_charge   := COALESCE((p_pending_data->>'gatewayCharge')::numeric, 0);

      IF v_reg_name IS NULL OR v_mobile IS NULL OR v_batch_name IS NULL
         OR v_address IS NULL OR v_tshirt_size IS NULL OR v_photo_url IS NULL
      THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'REGISTRATION_NOT_FOUND',
          'message', format('Registration or complete pending order for "%s" not found.', p_reg_id)
        );
      END IF;
    END IF;
  END IF;

  IF NOT v_found AND (p_pending_data IS NULL OR jsonb_typeof(p_pending_data) <> 'object') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REGISTRATION_NOT_FOUND',
      'message', format('Registration "%s" not found.', p_reg_id)
    );
  END IF;

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

  IF NOT v_found THEN
    IF v_qr_token IS NULL THEN
      v_qr_token := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    END IF;
    BEGIN
      INSERT INTO public.registrations_2027 (
        id, full_name, photo_url, mobile_number, email, address,
        category, student_id, passing_year, last_class_attended,
        current_class, batch_name, group_or_section, roll_number,
        t_shirt_size, has_parent, registration_fee, donation_amount, gateway_charge, total_paid,
        payment_status, registration_approval_status, registered_at, qr_token, year,
        gateway_invoice_number
      ) VALUES (
        p_reg_id,
        v_reg_name,
        v_photo_url,
        v_mobile,
        p_pending_data->>'email',
        v_address,
        v_category,
        v_student_id,
        p_pending_data->>'passingYear',
        p_pending_data->>'lastClassAttended',
        p_pending_data->>'currentClass',
        v_batch_name,
        p_pending_data->>'groupOrSection',
        p_pending_data->>'rollNumber',
        v_tshirt_size,
        v_has_parent,
        v_expected_base,
        v_don_stored,
        (v_fee_eval->>'gateway_charge')::numeric,
        0,
        'pending',
        'approved',
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
    v_qr_token := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  END IF;

  BEGIN
    UPDATE public.registrations_2027
    SET payment_status                = 'paid',
        registration_approval_status  = COALESCE(registration_approval_status, 'approved'),
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

-- ============================================================================
-- SECTION 7: Fix search_path on reviewed older privileged SECURITY DEFINER RPCs (P2)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
        )
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, auth, extensions', r.sig);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.rpc_secure_ticket_lookup(text, text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rpc_secure_ticket_lookup(TEXT, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_secure_ticket_lookup(TEXT, TEXT) TO service_role';
  END IF;
END $$;

COMMIT;
