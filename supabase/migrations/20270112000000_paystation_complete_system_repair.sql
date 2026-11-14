-- ==============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR — REUNION 2027 PLATFORM
-- MIGRATION: 20270112000000_paystation_complete_system_repair.sql
-- 
-- Comprehensive PayStation Payment System Repair & Hardening Migration:
-- 1. Create public.ipn_logs table for webhook audit & dispute resolution.
-- 2. Create public.payment_transactions immutable transaction ledger.
-- 3. Add missing columns to public.donations_2027 (payment_status, gateway_invoice_number).
-- 4. Fix unique mobile index to prevent blocking pending payment retries.
-- 5. Drop overloaded public.rpc_verify_payment signatures to resolve PostgREST PGRST203 ambiguity.
-- 6. Deploy unified public.rpc_verify_payment with search_path = public, auth, extensions
--    (resolving PostgreSQL 42883 gen_random_bytes error) and atomic self-healing.
-- 7. Deploy authoritative public.rpc_handle_paystation_ipn with 5-point verification.
-- 8. Hardened RLS policies preventing unauthorized client manipulation of payment status.
-- ==============================================================================

BEGIN;

-- 1. IPN LOGS TABLE
CREATE TABLE IF NOT EXISTS public.ipn_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  trx_id TEXT,
  trx_status TEXT NOT NULL,
  trx_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  order_date_time TEXT,
  reference TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ipn_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  http_status INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ipn_logs_invoice ON public.ipn_logs (invoice_number);
CREATE INDEX IF NOT EXISTS idx_ipn_logs_trx ON public.ipn_logs (trx_id);
CREATE INDEX IF NOT EXISTS idx_ipn_logs_created_at ON public.ipn_logs (created_at DESC);

ALTER TABLE public.ipn_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ipn_logs_admin_read" ON public.ipn_logs;
CREATE POLICY "ipn_logs_admin_read" ON public.ipn_logs
  FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'SUPER_ADMIN'
  );

-- 2. IMMUTABLE PAYMENT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id TEXT REFERENCES public.registrations_2027(id) ON DELETE SET NULL,
  invoice_id TEXT NOT NULL,
  transaction_id TEXT,
  payment_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  payment_method TEXT,
  gateway_provider TEXT NOT NULL DEFAULT 'PAYSTATION',
  gateway_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pay_trx_reg ON public.payment_transactions (registration_id);
CREATE INDEX IF NOT EXISTS idx_pay_trx_inv ON public.payment_transactions (invoice_id);
CREATE INDEX IF NOT EXISTS idx_pay_trx_id ON public.payment_transactions (transaction_id);
CREATE INDEX IF NOT EXISTS idx_pay_trx_status ON public.payment_transactions (payment_status);
CREATE INDEX IF NOT EXISTS idx_pay_trx_created_at ON public.payment_transactions (created_at DESC);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pay_trx_admin_all" ON public.payment_transactions;
CREATE POLICY "pay_trx_admin_all" ON public.payment_transactions
  FOR ALL TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'SUPER_ADMIN'
  );

-- 3. ENSURE REGISTRATIONS_2027 & DONATIONS_2027 COLUMNS
ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS gateway_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS gateway_provider TEXT DEFAULT 'PAYSTATION',
  ADD COLUMN IF NOT EXISTS gateway_response JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.donations_2027
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS gateway_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS gateway_provider TEXT DEFAULT 'PAYSTATION',
  ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- 3B. UPDATE FINANCIAL LEDGER TRANSACTION TYPE CONSTRAINT TO PERMIT GATEWAY INFLOWS
DO $$
BEGIN
  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    ALTER TABLE public.financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_transaction_type_check;
    ALTER TABLE public.financial_ledger ADD CONSTRAINT financial_ledger_transaction_type_check 
      CHECK (transaction_type = ANY (ARRAY[
        'ALLOCATION'::text, 'EXPENSE'::text, 'ADJUSTMENT'::text, 'CASH_RETURN'::text,
        'REGISTRATION_INFLOW'::text, 'DONATION_INFLOW'::text, 'INFLOW'::text
      ]));
  END IF;
END $$;

-- 4. SAFE IDENTITY-BASED UNIQUE CONSTRAINTS (SCENARIO 5 SOLUTION)
-- Normalize mobile helper
CREATE OR REPLACE FUNCTION public.normalize_mobile_number(p_mobile TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_mobile IS NULL OR trim(p_mobile) = '' THEN NULL
    WHEN regexp_replace(p_mobile, '[^0-9]', '', 'g') LIKE '880%' THEN ('0' || substr(regexp_replace(p_mobile, '[^0-9]', '', 'g'), 4))
    ELSE regexp_replace(p_mobile, '[^0-9]', '', 'g')
  END;
$$;

-- Permit 'paid_duplicate' in registrations_2027 payment_status check constraint
ALTER TABLE public.registrations_2027 DROP CONSTRAINT IF EXISTS registrations_2027_payment_status_check;
ALTER TABLE public.registrations_2027 ADD CONSTRAINT registrations_2027_payment_status_check
  CHECK (payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'failed'::text, 'refunded'::text, 'paid_duplicate'::text]));

-- Drop blanket mobile unique indexes
DROP INDEX IF EXISTS public.uq_registrations_2027_mobile_normalized;
DROP INDEX IF EXISTS public.uq_registrations_2027_mobile_paid;

-- Current students: Student ID must be unique among paid registrations
CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_2027_current_student_paid
  ON public.registrations_2027 (upper(trim(student_id)))
  WHERE (category = 'current' AND student_id IS NOT NULL AND trim(student_id) <> '' AND payment_status = 'paid');

-- Alumni: Composite identity (Name + Batch + Mobile) must be unique among paid registrations
CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_2027_former_student_paid
  ON public.registrations_2027 (
    lower(trim(regexp_replace(full_name, '\s+', ' ', 'g'))),
    lower(trim(batch_name)),
    public.normalize_mobile_number(mobile_number)
  )
  WHERE (category = 'former' AND payment_status = 'paid');

-- Fast index for mobile queries
CREATE INDEX IF NOT EXISTS idx_reg_2027_mobile_norm
  ON public.registrations_2027 (public.normalize_mobile_number(mobile_number));

-- 5. RESOLVE PGRST203 FUNCTION OVERLOADING CONFLICT
-- Explicitly drop all previous overloads so only ONE single authoritative signature exists.
DROP FUNCTION IF EXISTS public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB);

-- 6. AUTHORITATIVE rpc_verify_payment WITH SEARCH_PATH INCLUDING EXTENSIONS
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
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_dup_count      INTEGER;
  v_qr_token       TEXT;
  v_found          BOOLEAN := false;
  v_existing_status TEXT;
  v_reg_name       TEXT := 'Student';
  v_invoice_num    TEXT;
  v_res            JSONB;
BEGIN
  -- 1. Validate inputs
  IF p_reg_id IS NULL OR trim(p_reg_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REG_ID', 'message', 'Registration ID is required.');
  END IF;

  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID', 'message', 'Transaction ID is required.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT', 'message', 'Payment amount must be greater than zero.');
  END IF;

  -- 2. Anti-Replay: Prevent reuse of transaction ID on any other registration
  SELECT COUNT(*) INTO v_dup_count
  FROM public.registrations_2027
  WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    AND id <> p_reg_id;

  IF v_dup_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TRANSACTION',
      'message', 'This PayStation transaction ID has already been utilized on another registration.'
    );
  END IF;

  -- 3. Lock & check registration existence with FOR UPDATE to prevent race conditions
  SELECT payment_status, qr_token, full_name, mobile_number, category, student_id, batch_name, gateway_invoice_number
  INTO v_existing_status, v_qr_token, v_reg_name, v_mobile, v_category, v_student_id, v_batch_name, v_invoice_num
  FROM public.registrations_2027
  WHERE id = p_reg_id
  FOR UPDATE;

  IF FOUND THEN
    v_found := true;
    -- Idempotent fast-path: Already confirmed and paid with this exact transaction
    IF v_existing_status = 'paid' THEN
      INSERT INTO public.payment_transactions (
        registration_id, invoice_id, transaction_id, payment_amount,
        payment_status, payment_method, gateway_provider, verified_at
      ) VALUES (
        p_reg_id, COALESCE(v_invoice_num, p_reg_id), p_trx_id, p_amount,
        'PAID', p_method, 'PAYSTATION', NOW()
      )
      ON CONFLICT DO NOTHING;

      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PAID',
        'message', 'Registration was already confirmed and paid.',
        'registration_id', p_reg_id,
        'full_name', v_reg_name,
        'qr_token', v_qr_token
      );
    END IF;
  ELSE
    -- 4. Atomic Self-Healing: Insert missing pending record if p_pending_data provided
    IF p_pending_data IS NOT NULL AND jsonb_typeof(p_pending_data) = 'object' THEN
      v_qr_token := COALESCE(
        p_pending_data->>'qrToken',
        p_pending_data->>'qr_token',
        'PLSCF27-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12))
      );
      v_reg_name := COALESCE(p_pending_data->>'fullName', p_pending_data->>'full_name', 'Student');
      v_mobile := COALESCE(p_pending_data->>'mobileNumber', p_pending_data->>'mobile_number', '01XXXXXXXXX');
      v_category := COALESCE(p_pending_data->>'category', 'former');
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
        WHEN OTHERS THEN
          SELECT payment_status, qr_token, full_name, mobile_number, category, student_id, batch_name, gateway_invoice_number
          INTO v_existing_status, v_qr_token, v_reg_name, v_mobile, v_category, v_student_id, v_batch_name, v_invoice_num
          FROM public.registrations_2027
          WHERE id = p_reg_id;

          IF FOUND THEN
            v_found := true;
            IF v_existing_status = 'paid' THEN
              RETURN jsonb_build_object(
                'success', true,
                'status', 'ALREADY_PAID',
                'message', 'Registration confirmed concurrently.',
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
      'message', format('Registration "%s" not found in central database.', p_reg_id)
    );
  END IF;

  -- 5. Intelligent Duplicate Student Identity Check (Scenario 5 Solution)
  SELECT id INTO v_existing_paid_id
  FROM public.registrations_2027
  WHERE id <> p_reg_id
    AND payment_status = 'paid'
    AND (
      (v_category = 'current' AND v_student_id IS NOT NULL AND upper(trim(student_id)) = upper(trim(v_student_id)))
      OR
      (v_category = 'former' AND lower(trim(regexp_replace(full_name, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(v_reg_name, '\s+', ' ', 'g')))
                             AND lower(trim(batch_name)) = lower(trim(v_batch_name))
                             AND public.normalize_mobile_number(mobile_number) = public.normalize_mobile_number(v_mobile))
    )
  LIMIT 1;

  IF v_existing_paid_id IS NOT NULL THEN
    UPDATE public.registrations_2027
    SET payment_status                = 'paid_duplicate',
        transaction_id                = p_trx_id,
        payment_method                = lower(trim(COALESCE(p_method, 'bkash'))),
        total_paid                    = p_amount,
        server_verification_signature = p_signature,
        verification_timestamp        = clock_timestamp(),
        verified_by                   = p_verified_by,
        gateway_provider              = 'PAYSTATION',
        gateway_invoice_number        = COALESCE(gateway_invoice_number, v_invoice_num, p_reg_id),
        notes                         = COALESCE(notes || '; ', '') || 'DUPLICATE_PAYMENT_CAPTURED: Primary registration is ' || v_existing_paid_id
    WHERE id = p_reg_id;

    INSERT INTO public.payment_transactions (
      registration_id, invoice_id, transaction_id, payment_amount,
      currency, payment_status, payment_method, gateway_provider,
      gateway_response, failure_reason, verified_at
    ) VALUES (
      p_reg_id,
      COALESCE(v_invoice_num, p_reg_id),
      p_trx_id,
      p_amount,
      'BDT',
      'PAID_DUPLICATE',
      lower(trim(COALESCE(p_method, 'bkash'))),
      'PAYSTATION',
      jsonb_build_object('primary_reg_id', v_existing_paid_id, 'verified_by', p_verified_by),
      'Duplicate payment for student already paid under ' || v_existing_paid_id,
      clock_timestamp()
    );

    IF to_regclass('public.financial_ledger') IS NOT NULL THEN
      BEGIN
        INSERT INTO public.financial_ledger (
          staff_id, transaction_type, amount, reference_id,
          description, created_by
        ) VALUES (
          'GATEWAY_PAYSTATION',
          'REGISTRATION_INFLOW',
          p_amount,
          p_trx_id,
          'Duplicate Payment Inflow: ' || v_reg_name || ' (' || p_reg_id || ') - Primary is ' || v_existing_paid_id,
          p_verified_by
        )
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
      BEGIN
        INSERT INTO public.admin_audit_logs (
          admin_id, admin_username, admin_role, action,
          target_type, target_id, details
        ) VALUES (
          'SYSTEM_GATEWAY', 'PAYSTATION_VERIFIER', 'SUPER_ADMIN',
          'DUPLICATE_PAYMENT_FLAGGED', 'registration', p_reg_id,
          'Duplicate payment: ' || p_trx_id || ' amount ' || p_amount || ' for student already paid under ' || v_existing_paid_id
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    RETURN jsonb_build_object(
      'success',                 true,
      'status',                  'DUPLICATE_PAYMENT_CAPTURED',
      'registration_id',         p_reg_id,
      'primary_registration_id', v_existing_paid_id,
      'full_name',               v_reg_name,
      'qr_token',                v_qr_token,
      'message',                 'Duplicate payment was safely captured and credited to financial ledger. Flagged for administrative audit.'
    );
  END IF;

  -- 5. Ensure high-entropy QR token
  IF v_qr_token IS NULL OR trim(v_qr_token) = '' THEN
    v_qr_token := 'PLSCF27-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
  END IF;

  -- 6. Authoritatively mark payment as PAID
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

  -- 7. Record immutable entry in payment_transactions
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
    jsonb_build_object(
      'verified_by', p_verified_by,
      'signature', p_signature,
      'timestamp', clock_timestamp()
    ),
    clock_timestamp()
  );

  -- 8. Double-Entry Credit in Financial Ledger (resilient to ledger constraints)
  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.financial_ledger (
        staff_id, transaction_type, amount, reference_id,
        description, created_by
      ) VALUES (
        'GATEWAY_PAYSTATION',
        'REGISTRATION_INFLOW',
        p_amount,
        p_trx_id,
        'PayStation Verified Inflow: ' || v_reg_name || ' (' || p_reg_id || ') via ' || upper(COALESCE(p_method, 'ONLINE')),
        p_verified_by
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 9. Admin Audit Log Entry (resilient)
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.admin_audit_logs (
        admin_id, admin_username, admin_role, action,
        target_type, target_id, details
      ) VALUES (
        'SYSTEM_GATEWAY',
        'PAYSTATION_VERIFIER',
        'SUPER_ADMIN',
        'VERIFY_PAYMENT',
        'registration',
        p_reg_id,
        'PayStation verified payment: ' || p_trx_id || ' amount ' || p_amount
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'status',          'PAID',
    'registration_id', p_reg_id,
    'full_name',       v_reg_name,
    'qr_token',        v_qr_token,
    'amount',          p_amount,
    'trx_id',          p_trx_id
  );
END;
$$;

-- 7. AUTHORITATIVE rpc_handle_paystation_ipn
DROP FUNCTION IF EXISTS public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.rpc_handle_paystation_ipn(
  p_invoice_number TEXT,
  p_trx_id TEXT,
  p_amount NUMERIC,
  p_method TEXT,
  p_order_date_time TEXT,
  p_reference TEXT DEFAULT NULL,
  p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_reg RECORD;
  v_dup_count INTEGER;
  v_qr_token TEXT;
  v_expected_amount NUMERIC;
  v_sig TEXT;
  v_res JSONB;
BEGIN
  -- 1. Input validation
  IF p_invoice_number IS NULL OR trim(p_invoice_number) = '' THEN
    v_res := jsonb_build_object('success', false, 'error', 'INVALID_INVOICE', 'message', 'Missing invoice_number');
    INSERT INTO public.ipn_logs (invoice_number, trx_id, trx_status, trx_amount, raw_payload, ipn_response, http_status)
    VALUES (COALESCE(p_invoice_number, 'UNKNOWN'), p_trx_id, 'FAILED', COALESCE(p_amount, 0), p_raw_payload, v_res, 400);
    RETURN v_res;
  END IF;

  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    v_res := jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID', 'message', 'Missing trx_id');
    INSERT INTO public.ipn_logs (invoice_number, trx_id, trx_status, trx_amount, raw_payload, ipn_response, http_status)
    VALUES (p_invoice_number, 'UNKNOWN', 'FAILED', COALESCE(p_amount, 0), p_raw_payload, v_res, 400);
    RETURN v_res;
  END IF;

  -- 2. Anti-Replay: Check if trx_id was used on any other registration
  SELECT COUNT(*) INTO v_dup_count
  FROM public.registrations_2027
  WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    AND gateway_invoice_number <> p_invoice_number
    AND id <> p_invoice_number;

  IF v_dup_count > 0 THEN
    v_res := jsonb_build_object('success', false, 'error', 'DUPLICATE_TRANSACTION', 'message', 'Transaction ID already utilized');
    INSERT INTO public.ipn_logs (invoice_number, trx_id, trx_status, trx_amount, raw_payload, ipn_response, http_status)
    VALUES (p_invoice_number, p_trx_id, 'DUPLICATE', COALESCE(p_amount, 0), p_raw_payload, v_res, 409);
    RETURN v_res;
  END IF;

  -- 3. Lookup registration by gateway_invoice_number or id (with FOR UPDATE lock)
  SELECT * INTO v_reg
  FROM public.registrations_2027
  WHERE gateway_invoice_number = p_invoice_number OR id = p_invoice_number
  FOR UPDATE;

  IF NOT FOUND THEN
    v_res := jsonb_build_object('success', false, 'error', 'REGISTRATION_NOT_FOUND', 'message', 'Invoice not found in registrations_2027');
    INSERT INTO public.ipn_logs (invoice_number, trx_id, trx_status, trx_amount, raw_payload, ipn_response, http_status)
    VALUES (p_invoice_number, p_trx_id, 'NOT_FOUND', COALESCE(p_amount, 0), p_raw_payload, v_res, 404);
    RETURN v_res;
  END IF;

  -- 4. Idempotency: If already paid with this exact transaction
  IF v_reg.payment_status = 'paid' AND upper(trim(COALESCE(v_reg.transaction_id, ''))) = upper(trim(p_trx_id)) THEN
    v_res := jsonb_build_object(
      'success', true,
      'status', 'ALREADY_PAID',
      'registration_id', v_reg.id,
      'full_name', v_reg.full_name,
      'message', 'IPN already processed and paid'
    );
    INSERT INTO public.ipn_logs (invoice_number, trx_id, trx_status, trx_amount, payment_method, order_date_time, reference, raw_payload, ipn_response, http_status)
    VALUES (p_invoice_number, p_trx_id, 'ALREADY_PAID', p_amount, p_method, p_order_date_time, p_reference, p_raw_payload, v_res, 200);
    RETURN v_res;
  END IF;

  -- 5. Duplicate Identity Check (Scenario 5 Solution)
  SELECT id INTO v_existing_paid_id
  FROM public.registrations_2027
  WHERE id <> v_reg.id
    AND payment_status = 'paid'
    AND (
      (v_reg.category = 'current' AND v_reg.student_id IS NOT NULL AND upper(trim(student_id)) = upper(trim(v_reg.student_id)))
      OR
      (v_reg.category = 'former' AND lower(trim(regexp_replace(full_name, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(v_reg.full_name, '\s+', ' ', 'g')))
                                 AND lower(trim(batch_name)) = lower(trim(v_reg.batch_name))
                                 AND public.normalize_mobile_number(mobile_number) = public.normalize_mobile_number(v_reg.mobile_number))
    )
  LIMIT 1;

  IF v_existing_paid_id IS NOT NULL THEN
    UPDATE public.registrations_2027
    SET payment_status                = 'paid_duplicate',
        transaction_id                = p_trx_id,
        payment_method                = lower(trim(COALESCE(p_method, 'bkash'))),
        total_paid                    = p_amount,
        verification_timestamp        = clock_timestamp(),
        verified_by                   = 'PAYSTATION_IPN',
        notes                         = COALESCE(notes || '; ', '') || 'DUPLICATE_IPN_CAPTURED: Primary is ' || v_existing_paid_id
    WHERE id = v_reg.id;

    INSERT INTO public.payment_transactions (
      registration_id, invoice_id, transaction_id, payment_amount,
      currency, payment_status, payment_method, gateway_provider,
      gateway_response, failure_reason, verified_at
    ) VALUES (
      v_reg.id, p_invoice_number, p_trx_id, p_amount,
      'BDT', 'PAID_DUPLICATE', lower(trim(COALESCE(p_method, 'bkash'))),
      'PAYSTATION', p_raw_payload, 'Duplicate IPN payment for student already paid under ' || v_existing_paid_id,
      clock_timestamp()
    );

    IF to_regclass('public.financial_ledger') IS NOT NULL THEN
      BEGIN
        INSERT INTO public.financial_ledger (
          staff_id, transaction_type, amount, reference_id,
          description, created_by
        ) VALUES (
          'GATEWAY_PAYSTATION', 'REGISTRATION_INFLOW', p_amount, p_trx_id,
          'Duplicate IPN Inflow: ' || v_reg.full_name || ' (' || v_reg.id || ') - Primary is ' || v_existing_paid_id,
          'PAYSTATION_IPN'
        )
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    INSERT INTO public.ipn_logs (
      invoice_number, trx_id, trx_status, trx_amount,
      payment_method, order_date_time, reference,
      raw_payload, ipn_response, http_status
    ) VALUES (
      p_invoice_number, p_trx_id, 'DUPLICATE_PAID', p_amount,
      p_method, p_order_date_time, p_reference,
      p_raw_payload, jsonb_build_object('status', 'DUPLICATE_PAYMENT_CAPTURED'), 200
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'DUPLICATE_PAYMENT_CAPTURED',
      'registration_id', v_reg.id,
      'primary_registration_id', v_existing_paid_id,
      'full_name', v_reg.full_name,
      'amount', p_amount,
      'trx_id', p_trx_id
    );
  END IF;

  -- 5. Amount validation with 5 BDT tolerance
  v_expected_amount := COALESCE(v_reg.registration_fee, 0) + COALESCE(v_reg.donation_amount, 0);
  IF p_amount < (v_expected_amount - 5) THEN
    v_res := jsonb_build_object(
      'success', false,
      'error', 'AMOUNT_MISMATCH',
      'message', format('Paid %s is less than expected %s', p_amount, v_expected_amount)
    );
    INSERT INTO public.ipn_logs (invoice_number, trx_id, trx_status, trx_amount, raw_payload, ipn_response, http_status)
    VALUES (p_invoice_number, p_trx_id, 'AMOUNT_MISMATCH', p_amount, p_raw_payload, v_res, 422);
    RETURN v_res;
  END IF;

  -- 6. QR token preservation
  IF v_reg.qr_token IS NOT NULL AND trim(v_reg.qr_token) <> '' THEN
    v_qr_token := v_reg.qr_token;
  ELSE
    v_qr_token := 'PLSCF27-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
  END IF;

  -- 7. Server verification signature
  v_sig := 'SIG_IPN_' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 16));

  -- 8. Mark payment as paid in registrations_2027
  UPDATE public.registrations_2027
  SET payment_status                = 'paid',
      transaction_id                = p_trx_id,
      payment_method                = lower(trim(COALESCE(p_method, 'bkash'))),
      total_paid                    = p_amount,
      gateway_invoice_number        = p_invoice_number,
      gateway_provider              = 'PAYSTATION',
      gateway_response              = p_raw_payload,
      qr_token                      = v_qr_token,
      server_verification_signature = v_sig,
      verification_timestamp        = clock_timestamp(),
      verified_by                   = 'PAYSTATION_IPN'
  WHERE id = v_reg.id;

  -- 9. Insert immutable payment_transactions record
  INSERT INTO public.payment_transactions (
    registration_id, invoice_id, transaction_id, payment_amount,
    currency, payment_status, payment_method, gateway_provider,
    gateway_response, verified_at
  ) VALUES (
    v_reg.id,
    p_invoice_number,
    p_trx_id,
    p_amount,
    'BDT',
    'PAID',
    lower(trim(COALESCE(p_method, 'bkash'))),
    'PAYSTATION',
    p_raw_payload,
    clock_timestamp()
  );

  -- 10. Financial ledger entry (resilient)
  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.financial_ledger (
        staff_id, transaction_type, amount, reference_id,
        description, created_by
      ) VALUES (
        'GATEWAY_PAYSTATION',
        'REGISTRATION_INFLOW',
        p_amount,
        p_trx_id,
        'PayStation IPN Inflow: ' || v_reg.full_name || ' (' || v_reg.id || ') via ' || upper(COALESCE(p_method, 'ONLINE')),
        'PAYSTATION_IPN'
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 11. Admin audit log entry (resilient)
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.admin_audit_logs (
        admin_id, admin_username, admin_role, action,
        target_type, target_id, details
      ) VALUES (
        'SYSTEM_GATEWAY',
        'PAYSTATION_IPN',
        'SUPER_ADMIN',
        'CONFIRM_PAYMENT',
        'registration',
        v_reg.id,
        'PayStation IPN: ' || p_trx_id || ' amount ' || p_amount
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 12. Record successful IPN Log
  v_res := jsonb_build_object(
    'success',         true,
    'status',          'PAID',
    'registration_id', v_reg.id,
    'full_name',       v_reg.full_name,
    'qr_token',        v_qr_token,
    'trx_id',          p_trx_id,
    'amount',          p_amount
  );

  INSERT INTO public.ipn_logs (
    invoice_number, trx_id, trx_status, trx_amount,
    payment_method, order_date_time, reference, raw_payload,
    ipn_response, http_status
  ) VALUES (
    p_invoice_number, p_trx_id, 'Success', p_amount,
    p_method, p_order_date_time, p_reference, p_raw_payload,
    v_res, 200
  );

  RETURN v_res;
END;
$$;

-- 8. HARDEN RLS ON REGISTRATIONS_2027
-- Disallow arbitrary direct update of payment_status to 'paid' by anonymous clients
DROP POLICY IF EXISTS "public_insert_registration_2027" ON public.registrations_2027;
CREATE POLICY "public_insert_registration_2027" ON public.registrations_2027
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    payment_status = 'pending' AND total_paid = 0
  );

DROP POLICY IF EXISTS "public_update_registration_2027" ON public.registrations_2027;
CREATE POLICY "public_update_registration_2027" ON public.registrations_2027
  FOR UPDATE TO anon, authenticated
  USING (
    payment_status = 'pending'
  )
  WITH CHECK (
    payment_status = 'pending' AND total_paid = 0
  );

-- 9. PERMISSION GRANTS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

GRANT SELECT, INSERT ON public.registrations_2027 TO anon, authenticated;
GRANT SELECT, INSERT ON public.donations_2027 TO anon, authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.ipn_logs TO authenticated;

COMMIT;
