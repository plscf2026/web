-- MIGRATION: 20270116000000_fix_payment_status_and_duplicate_handling.sql
-- Fixes: Eliminates 'paid_duplicate' status so that all verified student registrations
-- have payment_status = 'paid' with active QR tokens and valid digital tickets.

BEGIN;

-- 1. Ensure CHECK constraint permits 'paid', 'pending', 'failed', 'refunded'
ALTER TABLE public.registrations_2027 DROP CONSTRAINT IF EXISTS registrations_2027_payment_status_check;
ALTER TABLE public.registrations_2027 ADD CONSTRAINT registrations_2027_payment_status_check
  CHECK (payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'failed'::text, 'refunded'::text, 'paid_duplicate'::text]));

-- 2. Clean up any existing records that were previously marked as 'paid_duplicate' -> promote to 'paid'
UPDATE public.registrations_2027
SET payment_status = 'paid'
WHERE payment_status = 'paid_duplicate';

-- 3. Explicitly drop functions before replacing to allow signature parameter adjustments
DROP FUNCTION IF EXISTS public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB);

-- 4. Replace rpc_verify_payment to ALWAYS set payment_status = 'paid'
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
  v_mobile         TEXT;
  v_category       TEXT := 'former';
  v_student_id     TEXT;
  v_batch_name     TEXT := 'General';
  v_existing_paid_id TEXT;
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

  -- 2. Anti-Replay: Prevent reuse of transaction ID on a DIFFERENT registration
  SELECT COUNT(*) INTO v_dup_count
  FROM public.registrations_2027
  WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    AND id <> p_reg_id;

  IF v_dup_count > 0 THEN
    -- If this exact transaction was already confirmed for this student under another ID, return idempotent success
    SELECT id, qr_token, full_name INTO v_existing_paid_id, v_qr_token, v_reg_name
    FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'ALREADY_PAID',
      'message', 'Transaction already confirmed authoritatively.',
      'registration_id', v_existing_paid_id,
      'full_name', v_reg_name,
      'qr_token', v_qr_token
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

  -- 5. Ensure high-entropy 6-character or secure QR token
  IF v_qr_token IS NULL OR trim(v_qr_token) = '' THEN
    v_qr_token := 'PLSCF27-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
  END IF;

  -- 6. Authoritatively mark payment as PAID (ALWAYS 'paid', never 'paid_duplicate')
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
    jsonb_build_object('signature', p_signature, 'verified_by', p_verified_by, 'method', p_method),
    clock_timestamp()
  )
  ON CONFLICT DO NOTHING;

  -- 8. Record in financial_ledger
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
        'Online Payment Inflow: ' || v_reg_name || ' (' || p_reg_id || ') via ' || upper(COALESCE(p_method, 'BKASH')),
        p_verified_by
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- 9. If current student, mark student ID permanently USED
  IF v_student_id IS NOT NULL AND trim(v_student_id) <> '' THEN
    IF to_regclass('public.current_student_ids') IS NOT NULL THEN
      BEGIN
        UPDATE public.current_student_ids
        SET verification_status    = 'USED',
            used_registration_id   = p_reg_id,
            reserved_until         = NULL,
            updated_at             = clock_timestamp()
        WHERE upper(trim(student_id)) = upper(trim(v_student_id));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  -- 10. Record in admin_audit_logs
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.admin_audit_logs (
        admin_id, admin_username, admin_role, action,
        target_type, target_id, details
      ) VALUES (
        'SYSTEM_GATEWAY', 'PAYSTATION_VERIFIER', 'SUPER_ADMIN',
        'ONLINE_PAYMENT_VERIFIED', 'registration', p_reg_id,
        'Payment verified: ' || p_trx_id || ' amount ' || p_amount || ' via ' || upper(COALESCE(p_method, 'BKASH'))
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

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

-- 5. Replace rpc_handle_paystation_ipn
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
BEGIN
  -- Validate mandatory IPN parameters
  IF p_invoice_number IS NULL OR trim(p_invoice_number) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INVOICE', 'message', 'Invoice number is required');
  END IF;

  IF p_trx_id IS NULL OR trim(p_trx_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRX_ID', 'message', 'Transaction ID is required');
  END IF;

  -- Match registration in registrations_2027 by invoice number
  SELECT * INTO v_reg
  FROM public.registrations_2027
  WHERE gateway_invoice_number = p_invoice_number
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVOICE_NOT_FOUND', 'message', 'No registration found for this invoice');
  END IF;

  -- Mark payment as 'paid'
  UPDATE public.registrations_2027
  SET payment_status         = 'paid',
      transaction_id         = p_trx_id,
      payment_method         = lower(trim(COALESCE(p_method, 'bkash'))),
      total_paid             = p_amount,
      verification_timestamp = clock_timestamp(),
      verified_by            = 'PAYSTATION_IPN'
  WHERE id = v_reg.id;

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

  RETURN jsonb_build_object('success', true, 'status', 'PAID', 'registration_id', v_reg.id);
END;
$$;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

COMMIT;
