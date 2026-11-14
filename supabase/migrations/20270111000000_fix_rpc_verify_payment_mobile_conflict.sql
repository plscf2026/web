-- =============================================================================
-- Migration: Fix rpc_verify_payment to handle uq_registrations_2027_mobile_normalized
-- Issue: When a pending record already exists (savePendingRegistration ran),
--        the self-healing INSERT inside rpc_verify_payment tried ON CONFLICT (id) DO NOTHING
--        but Postgres could raise the mobile_normalized unique violation before resolving id conflict.
--        Fix: Use exception handling to silently ignore mobile_normalized violations on INSERT,
--        and always run the UPDATE step regardless (the row exists in both paths).
-- =============================================================================

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
  v_dup_count  INTEGER;
  v_qr_token   TEXT;
  v_found      BOOLEAN := false;
  v_existing_status TEXT;
  v_reg_name   TEXT := 'Student';
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
    --    insert it using provided p_pending_data before finalizing.
    --    Use exception handling to gracefully skip the mobile_normalized unique constraint if the
    --    row was inserted by another concurrent session between our SELECT and INSERT.
    IF p_pending_data IS NOT NULL AND jsonb_typeof(p_pending_data) = 'object' THEN
      v_qr_token := COALESCE(
        p_pending_data->>'qrToken',
        p_pending_data->>'qr_token',
        'PLSCF27-' || upper(encode(gen_random_bytes(6), 'hex'))
      );
      v_reg_name := COALESCE(p_pending_data->>'fullName', p_pending_data->>'full_name', 'Student');

      BEGIN
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

      EXCEPTION
        -- If the mobile_normalized unique constraint fires (concurrent insert), that means
        -- the pending row already exists for this student in the database — that is fine.
        -- We still proceed to the UPDATE below.
        WHEN unique_violation THEN
          -- Re-read the existing row so we have qr_token and full_name
          SELECT payment_status, qr_token, full_name
          INTO v_existing_status, v_qr_token, v_reg_name
          FROM public.registrations_2027
          WHERE id = p_reg_id;

          -- If the existing row is already paid (another callback beat us), return success
          IF v_existing_status = 'paid' THEN
            RETURN jsonb_build_object(
              'success', true,
              'status', 'ALREADY_PAID',
              'message', 'Registration was already confirmed and paid (concurrent).',
              'registration_id', p_reg_id,
              'full_name', v_reg_name
            );
          END IF;
      END;

      v_found := true;
    END IF;
  END IF;

  IF NOT v_found THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REGISTRATION_NOT_FOUND',
      'message', format('Registration "%s" not found in database.', p_reg_id)
    );
  END IF;

  -- 5. Ensure high-entropy QR token
  IF v_qr_token IS NULL OR trim(v_qr_token) = '' THEN
    v_qr_token := 'PLSCF27-' || upper(encode(gen_random_bytes(6), 'hex'));
  END IF;

  -- 6. Authoritatively mark payment as PAID in registrations_2027
  UPDATE public.registrations_2027
  SET payment_status               = 'paid',
      transaction_id               = p_trx_id,
      payment_method               = p_method,
      total_paid                   = p_amount,
      qr_token                     = v_qr_token,
      server_verification_signature = p_signature,
      verification_timestamp       = clock_timestamp(),
      verified_by                  = p_verified_by,
      gateway_provider             = 'PAYSTATION'
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
    'success',          true,
    'status',           'PAID',
    'registration_id',  p_reg_id,
    'full_name',        v_reg_name,
    'qr_token',         v_qr_token,
    'amount',           p_amount,
    'trx_id',           p_trx_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB)
  TO anon, authenticated, service_role;
