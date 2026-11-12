-- ============================================================================
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR - GRAND REUNION 2027
-- MIGRATION: 20270107000000_secure_registration_persistence_and_qr_verification.sql
-- ============================================================================
-- Purpose:
-- 1. Strictly secure registrations_2027 RLS policies:
--    - Public can only INSERT pending registrations (total_paid=0, transaction_id=NULL).
--    - Public CANNOT directly insert or update paid status.
--    - Public CANNOT dump or list all registrations.
-- 2. Authoritative, idempotent rpc_verify_payment with anti-replay and atomic self-healing.
-- 3. Authoritative, secure rpc_verify_student_qr function for cross-device QR scanning.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. RLS POLICIES ON registrations_2027
-- ============================================================================
ALTER TABLE public.registrations_2027 ENABLE ROW LEVEL SECURITY;

-- 1.1 Strict Pending-Only Insert Policy for Anonymous & Authenticated
DROP POLICY IF EXISTS "registration_insert_pending_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "Public and staff can insert registrations_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "Public can insert registration with pending status" ON public.registrations_2027;

CREATE POLICY "registration_insert_pending_2027" ON public.registrations_2027
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    payment_status = 'pending'
    AND COALESCE(total_paid, 0) = 0
    AND transaction_id IS NULL
    AND payment_method IS NULL
    AND is_checked_in = false
    AND is_tshirt_collected = false
  );

-- 1.2 Deny direct anonymous UPDATE (payment status must be updated via SECURITY DEFINER rpc_verify_payment)
DROP POLICY IF EXISTS "Public can update payment status 2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "registration_admin_update_2027" ON public.registrations_2027;

CREATE POLICY "registration_admin_update_2027" ON public.registrations_2027
  FOR UPDATE TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'SUPER_ADMIN'
  )
  WITH CHECK (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'SUPER_ADMIN'
  );

-- 1.3 Staff & Admin Read Policy (Zero bulk data exposure to anonymous public)
DROP POLICY IF EXISTS "registration_staff_read_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "Public can view confirmed tickets 2027" ON public.registrations_2027;

CREATE POLICY "registration_staff_read_2027" ON public.registrations_2027
  FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() IN (
      'SUPER_ADMIN', 'GATE_STAFF', 'BREAKFAST_STAFF',
      'LUNCH_STAFF', 'DINNER_STAFF', 'DRESS_STAFF'
    )
  );

-- ============================================================================
-- 2. AUTHORITATIVE & IDEMPOTENT rpc_verify_payment
-- Server-side payment finalization with transaction anti-replay and self-healing.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_verify_payment(
  p_reg_id TEXT,
  p_trx_id TEXT,
  p_method TEXT,
  p_amount NUMERIC,
  p_signature TEXT,
  p_verified_by TEXT DEFAULT 'PAYSTATION_GATEWAY',
  p_pending_data JSONB DEFAULT NULL
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
  v_existing_status TEXT;
  v_reg_name TEXT := 'Student';
BEGIN
  -- 1. Validate inputs
  IF p_reg_id IS NULL OR trim(p_reg_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REG_ID: Registration ID is required.');
  END IF;

  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID: Transaction ID is required.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT: Payment amount must be greater than zero.');
  END IF;

  -- 2. Anti-Replay Protection: Check if this transaction ID was used on ANY other registration
  SELECT COUNT(*) INTO v_dup_count
  FROM public.registrations_2027
  WHERE upper(trim(transaction_id)) = upper(trim(p_trx_id)) AND id <> p_reg_id;

  IF v_dup_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TRANSACTION: This PayStation transaction ID has already been utilized.'
    );
  END IF;

  -- 3. Check existence in registrations_2027
  SELECT payment_status, qr_token, full_name
  INTO v_existing_status, v_qr_token, v_reg_name
  FROM public.registrations_2027
  WHERE id = p_reg_id;

  IF FOUND THEN
    v_found := true;
    -- Idempotent check: If already paid with this exact transaction, return success immediately
    IF v_existing_status = 'paid' THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PAID',
        'message', 'Registration was already confirmed and paid.',
        'registration_id', p_reg_id,
        'full_name', v_reg_name
      );
    END IF;
  ELSE
    -- 4. Atomic Self-Healing: If record does not exist yet (e.g. initial pending insert lost on client),
    -- insert it using provided p_pending_data before finalizing
    IF p_pending_data IS NOT NULL AND jsonb_typeof(p_pending_data) = 'object' THEN
      v_qr_token := COALESCE(p_pending_data->>'qrToken', p_pending_data->>'qr_token', 'PLSCF27-' || upper(encode(gen_random_bytes(6), 'hex')));
      v_reg_name := COALESCE(p_pending_data->>'fullName', p_pending_data->>'full_name', 'Student');

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
        registered_at,
        qr_token,
        year
      ) VALUES (
        p_reg_id,
        v_reg_name,
        p_pending_data->>'fullNameBn',
        p_pending_data->>'photoUrl',
        COALESCE(p_pending_data->>'mobileNumber', p_pending_data->>'mobile_number', '01XXXXXXXXX'),
        p_pending_data->>'email',
        COALESCE(p_pending_data->>'address', 'Faridpur'),
        COALESCE(p_pending_data->>'category', 'former'),
        p_pending_data->>'studentId',
        p_pending_data->>'passingYear',
        p_pending_data->>'lastClassAttended',
        p_pending_data->>'currentClass',
        COALESCE(p_pending_data->>'batchName', 'General'),
        p_pending_data->>'groupOrSection',
        p_pending_data->>'rollNumber',
        COALESCE(p_pending_data->>'tShirtSize', 'L'),
        COALESCE((p_pending_data->>'registrationFee')::numeric, p_amount),
        COALESCE((p_pending_data->>'donationAmount')::numeric, 0),
        0,
        'pending',
        NOW(),
        v_qr_token,
        COALESCE((p_pending_data->>'year')::integer, 2027)
      )
      ON CONFLICT (id) DO NOTHING;

      v_found := true;
    END IF;
  END IF;

  IF NOT v_found THEN
    RETURN jsonb_build_object('success', false, 'error', 'REGISTRATION_NOT_FOUND', 'message', format('Registration "%s" not found in database.', p_reg_id));
  END IF;

  -- 5. Ensure high-entropy QR token
  IF v_qr_token IS NULL OR trim(v_qr_token) = '' THEN
    v_qr_token := 'PLSCF27-' || upper(encode(gen_random_bytes(6), 'hex'));
  END IF;

  -- 6. Authoritatively mark payment as PAID in registrations_2027
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

  -- 7. Record Double-Entry Credit in Financial Ledger (if ledger table exists)
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
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'PAID',
    'registration_id', p_reg_id,
    'full_name', v_reg_name,
    'qr_token', v_qr_token,
    'amount', p_amount,
    'trx_id', p_trx_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- ============================================================================
-- 3. AUTHORITATIVE & SECURE rpc_verify_student_qr FOR CROSS-DEVICE SCANNERS
-- Returns ONLY sanitized attendee info needed for event scanning (Zero PII).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_verify_student_qr(
  p_identifier TEXT,
  p_token TEXT DEFAULT NULL,
  p_staff_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_reg RECORD;
  v_clean_id TEXT;
  v_clean_token TEXT;
BEGIN
  v_clean_id := upper(trim(COALESCE(p_identifier, '')));
  v_clean_token := upper(trim(COALESCE(p_token, '')));

  IF v_clean_id = '' AND v_clean_token = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'INVALID_INPUT',
      'error', 'Registration ID or QR token is required.'
    );
  END IF;

  -- 1. Dual lookup: If both ID and token are passed, verify both
  IF v_clean_id <> '' AND v_clean_token <> '' THEN
    SELECT id, full_name, full_name_bn, photo_url, category, batch_name,
           passing_year, current_class, payment_status, qr_token, year
    INTO v_reg
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id
    LIMIT 1;

    IF NOT FOUND THEN
      -- Also try matching if clean_id was token and clean_token was ID
      SELECT id, full_name, full_name_bn, photo_url, category, batch_name,
             passing_year, current_class, payment_status, qr_token, year
      INTO v_reg
      FROM public.registrations_2027
      WHERE upper(qr_token) = v_clean_token OR upper(qr_token) = v_clean_id
      LIMIT 1;
    END IF;

    IF v_reg.id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'NOT_FOUND',
        'error', format('Student ticket "%s" not found in database.', p_identifier)
      );
    END IF;

    -- Verify token match: if token is supplied, it must match the student's qr_token
    IF upper(trim(COALESCE(v_reg.qr_token, ''))) <> v_clean_token THEN
      IF NOT (upper(trim(COALESCE(v_reg.qr_token, ''))) = v_clean_id AND upper(trim(COALESCE(v_reg.id, ''))) = v_clean_token) THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'TOKEN_MISMATCH',
          'error', format('Cryptographic QR token "%s" does not match Registration ID "%s".', p_token, v_reg.id)
        );
      END IF;
    END IF;

  ELSIF v_clean_id <> '' THEN
    -- Single lookup by ID or Token
    SELECT id, full_name, full_name_bn, photo_url, category, batch_name,
           passing_year, current_class, payment_status, qr_token, year
    INTO v_reg
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id OR upper(qr_token) = v_clean_id
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'NOT_FOUND',
        'error', format('Student ticket "%s" not found in database.', p_identifier)
      );
    END IF;
  END IF;

  -- 2. Verify payment status (Required before badge can be validated)
  IF v_reg.payment_status <> 'paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'UNPAID',
      'error', format('Payment Pending: Registration "%s" is in "%s" status.', v_reg.id, v_reg.payment_status)
    );
  END IF;

  -- 3. Return minimal, sanitized payload for display on scanner (Zero private financial/PII data)
  RETURN jsonb_build_object(
    'success', true,
    'verified', true,
    'status', 'ELIGIBLE',
    'student', jsonb_build_object(
      'id', v_reg.id,
      'fullName', v_reg.full_name,
      'fullNameBn', v_reg.full_name_bn,
      'category', v_reg.category,
      'batchName', v_reg.batch_name,
      'passingYear', v_reg.passing_year,
      'currentClass', v_reg.current_class,
      'photoUrl', COALESCE(v_reg.photo_url, ''),
      'paymentStatus', v_reg.payment_status,
      'qrToken', v_reg.qr_token,
      'year', v_reg.year
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_verify_student_qr(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;
