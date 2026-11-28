-- ============================================================================
-- Migration: 20270402000000_fix_guardian_registration_id_and_mobile_persistence.sql
-- Purpose:
--   Fix missing column mappings in guardian_registrations_2027 INSERTs inside
--   rpc_promote_pending_order_to_registration and rpc_verify_payment:
--     - registration_id = v_guard_id (previously omitted -> NULL)
--     - mobile_number = v_parent_phone (previously omitted -> NULL)
--     - relation = v_parent_rel (previously omitted -> default 'Guardian')
--     - guardian_fee = parent_fee (previously omitted -> default 0)
--   Also harden rpc_lookup_ticket direct guardian lookup to check
--   registration_id and COALESCE(guardian_phone, mobile_number).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_promote_pending_order_to_registration(p_invoice_number text, p_trx_id text, p_amount numeric, p_method text, p_verified_by text DEFAULT 'PAYSTATION_GATEWAY'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_order          RECORD;
  v_existing_reg   RECORD;
  v_existing_guard RECORD;
  v_existing_don   RECORD;
  v_reg_id         TEXT;
  v_qr_token       TEXT;
  v_guard_id       TEXT := NULL;
  v_guard_token    TEXT := NULL;
  v_has_parent     BOOLEAN := false;
  v_gender         TEXT;
  v_current_class  TEXT;
  v_parent_name    TEXT;
  v_parent_phone   TEXT;
  v_parent_rel     TEXT;
  v_parent_age     TEXT;
  v_parent_photo   TEXT;
  v_don_id         TEXT;
  v_don_token      TEXT;
  v_don_net        NUMERIC := 0;
  v_donor_name     TEXT;
  v_donor_mobile   TEXT;
  v_donor_email    TEXT;
  v_donor_purpose  TEXT;
  v_norm_method    TEXT := public.rpc_normalize_payment_method(p_method);
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

  -- Idempotency check by transaction_id
  IF EXISTS (
    SELECT 1 FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
  ) THEN
    SELECT id, qr_token, full_name, gateway_invoice_number INTO v_existing_reg
    FROM public.registrations_2027
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    LIMIT 1;
    IF v_existing_reg.gateway_invoice_number = p_invoice_number THEN
      SELECT id, qr_token INTO v_existing_guard
      FROM public.guardian_registrations_2027
      WHERE student_registration_id = v_existing_reg.id
      LIMIT 1;
      RETURN jsonb_build_object(
        'success', true, 'status', 'ALREADY_PAID',
        'registration_id', v_existing_reg.id,
        'qr_token', v_existing_reg.qr_token,
        'full_name', v_existing_reg.full_name,
        'guardian_id', v_existing_guard.id,
        'guardian_qr_token', v_existing_guard.qr_token
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TRANSACTION',
      'message', 'Transaction ID already committed on a different invoice.'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.donations
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
  ) THEN
    SELECT id, COALESCE(token, qr_token) AS tok, donor_name, gateway_invoice_number
    INTO v_existing_don
    FROM public.donations
    WHERE upper(trim(COALESCE(transaction_id, ''))) = upper(trim(p_trx_id))
    LIMIT 1;
    IF v_existing_don.gateway_invoice_number = p_invoice_number THEN
      RETURN jsonb_build_object(
        'success', true, 'status', 'ALREADY_PAID',
        'donation_id', v_existing_don.id,
        'token', v_existing_don.tok,
        'invoice_number', p_invoice_number
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_TRANSACTION',
      'message', 'Transaction ID already committed on a different donation.'
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
      SELECT id, qr_token INTO v_existing_guard
      FROM public.guardian_registrations_2027
      WHERE student_registration_id = v_existing_reg.id
      LIMIT 1;
      RETURN jsonb_build_object(
        'success', true, 'status', 'ALREADY_PAID',
        'registration_id', v_existing_reg.id,
        'qr_token', v_existing_reg.qr_token,
        'full_name', v_existing_reg.full_name,
        'guardian_id', v_existing_guard.id,
        'guardian_qr_token', v_existing_guard.qr_token
      );
    END IF;

    SELECT id, COALESCE(token, qr_token) AS tok INTO v_existing_don
    FROM public.donations
    WHERE gateway_invoice_number = p_invoice_number
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'status', 'ALREADY_PAID',
        'donation_id', v_existing_don.id,
        'token', v_existing_don.tok,
        'invoice_number', p_invoice_number
      );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND',
      'message', format('Pending order for invoice "%s" not found.', p_invoice_number));
  END IF;

  IF v_order.status = 'paid' AND v_order.order_type <> 'donation' AND v_order.promoted_registration_id IS NOT NULL THEN
    SELECT qr_token, full_name INTO v_existing_reg
    FROM public.registrations_2027
    WHERE id = v_order.promoted_registration_id;
    SELECT id, qr_token INTO v_existing_guard
    FROM public.guardian_registrations_2027
    WHERE student_registration_id = v_order.promoted_registration_id
    LIMIT 1;
    RETURN jsonb_build_object(
      'success', true, 'status', 'ALREADY_PAID',
      'registration_id', v_order.promoted_registration_id,
      'qr_token', v_existing_reg.qr_token,
      'full_name', v_existing_reg.full_name,
      'guardian_id', v_existing_guard.id,
      'guardian_qr_token', v_existing_guard.qr_token
    );
  END IF;

  v_category     := v_order.form_data->>'category';
  v_has_parent   := COALESCE((v_order.form_data->>'hasParent')::boolean, false);
  v_gender       := COALESCE(NULLIF(trim(v_order.form_data->>'gender'), ''), 'male');
  v_current_class := v_order.form_data->>'currentClass';
  v_pay_with_chg := CASE WHEN COALESCE((v_order.fees->>'gatewayCharge')::numeric, 0) > 0 THEN 1 ELSE 0 END;

  -- Server-side guardian eligibility enforcement
  IF v_order.order_type <> 'donation' AND v_has_parent IS TRUE THEN
    IF NOT public.is_guardian_eligible(v_category, v_gender, v_current_class) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'GUARDIAN_NOT_ELIGIBLE',
        'message', 'Only current female students or current male students below Class 6 are eligible to add a guardian.'
      );
    END IF;
  END IF;

  v_fee_eval     := public.rpc_compute_expected_order_amount(
    COALESCE(v_order.order_type, 'registration'),
    v_category,
    v_has_parent,
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

  -- Donation promotion path (preserved)
  IF v_order.order_type = 'donation' THEN
    SELECT id, COALESCE(token, qr_token) AS tok
    INTO v_existing_don
    FROM public.donations
    WHERE gateway_invoice_number = p_invoice_number
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.pending_orders
      SET status = 'paid',
          promoted_registration_id = COALESCE(promoted_registration_id, v_existing_don.id),
          transaction_id = COALESCE(NULLIF(trim(transaction_id), ''), p_trx_id),
          reconciled_at = COALESCE(reconciled_at, NOW()),
          updated_at = NOW()
      WHERE invoice_number = p_invoice_number;

      RETURN jsonb_build_object(
        'success', true,
        'status', 'DONATION_CONFIRMED',
        'invoice_number', p_invoice_number,
        'donation_id', v_existing_don.id,
        'token', v_existing_don.tok
      );
    END IF;

    v_don_net := COALESCE(
      NULLIF((v_fee_eval->>'donation_amount')::numeric, 0),
      NULLIF((v_order.fees->>'donationAmount')::numeric, 0),
      p_amount
    );
    v_donor_name := COALESCE(
      NULLIF(trim(COALESCE(v_order.form_data->>'donorName', v_order.form_data->>'fullName', v_order.customer_name, '')), ''),
      'Anonymous Donor'
    );
    v_donor_mobile := COALESCE(
      NULLIF(trim(COALESCE(v_order.form_data->>'mobileNumber', v_order.customer_phone, '')), ''),
      ''
    );
    v_donor_email := NULLIF(trim(COALESCE(v_order.form_data->>'email', v_order.customer_email, '')), '');
    v_donor_purpose := COALESCE(
      NULLIF(trim(COALESCE(v_order.form_data->>'purpose', '')), ''),
      'General Reunion Fund'
    );
    v_year := COALESCE(NULLIF(v_order.form_data->>'year', '')::int, 2027);
    v_don_id := COALESCE(
      NULLIF(trim(v_order.form_data->>'donationId'), ''),
      'DON-' || v_year || '-' || floor(1000 + random() * 9000)::text
    );
    v_don_token := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

    INSERT INTO public.donations (
      id, donor_name, mobile_number, email, amount, purpose,
      payment_method, transaction_id, gateway_invoice_number,
      token, qr_token, donation_date, year, payment_status, created_at
    ) VALUES (
      v_don_id, v_donor_name, v_donor_mobile, v_donor_email, v_don_net, v_donor_purpose,
      v_norm_method, p_trx_id, p_invoice_number,
      v_don_token, v_don_token, CURRENT_DATE, v_year, 'paid', NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      amount = EXCLUDED.amount,
      payment_status = 'paid',
      transaction_id = COALESCE(public.donations.transaction_id, EXCLUDED.transaction_id),
      token = COALESCE(public.donations.token, EXCLUDED.token),
      qr_token = COALESCE(public.donations.qr_token, EXCLUDED.qr_token);

    IF to_regclass('public.donations_2027') IS NOT NULL THEN
      BEGIN
        INSERT INTO public.donations_2027 (
          id, donor_name, mobile_number, email, amount, purpose,
          payment_method, transaction_id, gateway_invoice_number,
          token, qr_token, date, year, payment_status, created_at
        ) VALUES (
          v_don_id, v_donor_name, v_donor_mobile, v_donor_email, v_don_net, v_donor_purpose,
          v_norm_method, p_trx_id, p_invoice_number,
          v_don_token, v_don_token, CURRENT_DATE, v_year, 'paid', NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          payment_status = 'paid',
          transaction_id = COALESCE(public.donations_2027.transaction_id, EXCLUDED.transaction_id),
          token = COALESCE(public.donations_2027.token, EXCLUDED.token),
          qr_token = COALESCE(public.donations_2027.qr_token, EXCLUDED.qr_token);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    UPDATE public.pending_orders
    SET status = 'paid',
        promoted_registration_id = v_don_id,
        transaction_id = p_trx_id,
        reconciled_at = NOW(),
        updated_at = NOW()
    WHERE invoice_number = p_invoice_number;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'DONATION_CONFIRMED',
      'invoice_number', p_invoice_number,
      'donation_id', v_don_id,
      'token', v_don_token
    );
  END IF;

  -- Registration promotion path (Student + Optional Guardian in 1 atomic TX)
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

  IF v_has_parent THEN
    v_parent_name  := NULLIF(trim(COALESCE(v_order.form_data->>'parentName', '')), '');
    v_parent_phone := NULLIF(trim(COALESCE(v_order.form_data->>'parentPhone', '')), '');
    v_parent_rel   := COALESCE(NULLIF(trim(COALESCE(v_order.form_data->>'parentRelation', '')), ''), 'Guardian');
    v_parent_age   := NULLIF(trim(COALESCE(v_order.form_data->>'parentAge', '')), '');
    v_parent_photo := NULLIF(trim(COALESCE(v_order.form_data->>'parentPhotoUrl', '')), '');

    IF v_parent_name IS NULL OR v_parent_phone IS NULL OR v_parent_photo IS NULL OR v_parent_photo ILIKE '%via.placeholder.com%' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'MISSING_GUARDIAN_DATA',
        'message', 'Guardian name, phone, and photo are required when adding a guardian.'
      );
    END IF;
  END IF;

  v_year   := COALESCE(NULLIF(v_order.form_data->>'year', '')::int, 2027);
  v_reg_id := COALESCE(
    NULLIF(trim(v_order.form_data->>'registrationId'), ''),
    'PLSCF-' || v_year || '-' || (CASE WHEN v_category = 'current' THEN 'C' ELSE 'F' END) || floor(1000 + random() * 9000)::text
  );

  v_qr_token := NULLIF(trim(v_order.form_data->>'qrToken'), '');
  IF v_qr_token IS NULL
     OR EXISTS (SELECT 1 FROM public.registrations_2027 WHERE upper(qr_token) = upper(v_qr_token) AND id <> v_reg_id)
     OR EXISTS (SELECT 1 FROM public.guardian_registrations_2027 WHERE upper(qr_token) = upper(v_qr_token))
  THEN
    v_qr_token := public.generate_unique_participant_qr_token();
  END IF;

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
      v_gender,
      v_order.form_data->>'bloodGroup',
      v_has_parent,
      v_parent_name,
      v_parent_age,
      v_parent_phone,
      v_parent_rel,
      v_parent_photo,
      v_order.form_data->>'parentPhotoStoragePath',
      (v_fee_eval->>'parent_fee')::numeric,
      (v_fee_eval->>'gateway_charge')::numeric,
      v_category,
      v_student_id,
      v_order.form_data->>'passingYear',
      v_order.form_data->>'lastClassAttended',
      v_current_class,
      v_batch_name,
      v_order.form_data->>'groupOrSection',
      v_order.form_data->>'rollNumber',
      v_tshirt_size,
      (v_fee_eval->>'registration_fee')::numeric,
      (v_fee_eval->>'donation_amount')::numeric,
      p_amount,
      'paid',
      p_trx_id,
      v_norm_method,
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

    -- Insert independent guardian record in the same transaction if hasParent = true
    IF v_has_parent THEN
      SELECT id, qr_token INTO v_existing_guard
      FROM public.guardian_registrations_2027
      WHERE student_registration_id = v_reg_id
        AND event_id = 'PLSCF-2027'
      LIMIT 1;

      IF FOUND THEN
        v_guard_id := v_existing_guard.id;
        v_guard_token := v_existing_guard.qr_token;
      ELSE
        v_guard_id := NULLIF(trim(v_order.form_data->>'guardianRegistrationId'), '');
        IF v_guard_id IS NULL
           OR upper(v_guard_id) = upper(v_reg_id)
           OR EXISTS (SELECT 1 FROM public.guardian_registrations_2027 WHERE upper(id) = upper(v_guard_id))
           OR EXISTS (SELECT 1 FROM public.registrations_2027 WHERE upper(id) = upper(v_guard_id))
        THEN
          v_guard_id := public.generate_unique_guardian_reg_id(v_year);
        END IF;

        v_guard_token := NULLIF(trim(v_order.form_data->>'guardianQrToken'), '');
        IF v_guard_token IS NULL
           OR upper(v_guard_token) = upper(v_qr_token)
           OR EXISTS (SELECT 1 FROM public.registrations_2027 WHERE upper(qr_token) = upper(v_guard_token))
           OR EXISTS (SELECT 1 FROM public.guardian_registrations_2027 WHERE upper(qr_token) = upper(v_guard_token))
        THEN
          v_guard_token := public.generate_unique_participant_qr_token();
        END IF;

        INSERT INTO public.guardian_registrations_2027 (
          id, registration_id, student_registration_id, event_id, year,
          guardian_name, mobile_number, relation, guardian_phone, guardian_relation, guardian_age,
          photo_url, photo_storage_path, qr_token,
          registration_fee, guardian_fee, total_paid, payment_status, registration_approval_status,
          transaction_id, payment_method, gateway_invoice_number, gateway_provider,
          is_checked_in, gate_status, registered_at
        ) VALUES (
          v_guard_id,
          v_guard_id,
          v_reg_id,
          'PLSCF-2027',
          v_year,
          v_parent_name,
          v_parent_phone,
          v_parent_rel,
          v_parent_phone,
          v_parent_rel,
          v_parent_age,
          v_parent_photo,
          v_order.form_data->>'parentPhotoStoragePath',
          v_guard_token,
          COALESCE((v_fee_eval->>'parent_fee')::numeric, 0),
          COALESCE((v_fee_eval->>'parent_fee')::numeric, 0),
          COALESCE((v_fee_eval->>'parent_fee')::numeric, 0),
          'paid',
          'approved',
          p_trx_id,
          v_norm_method,
          p_invoice_number,
          'PAYSTATION',
          false,
          'NOT_ENTERED',
          NOW()
        );
      END IF;
    END IF;

  EXCEPTION
    WHEN unique_violation THEN
      SELECT id, qr_token, full_name INTO v_existing_reg
      FROM public.registrations_2027
      WHERE gateway_invoice_number = p_invoice_number
      LIMIT 1;
      IF FOUND THEN
        SELECT id, qr_token INTO v_existing_guard
        FROM public.guardian_registrations_2027
        WHERE student_registration_id = v_existing_reg.id
        LIMIT 1;
        RETURN jsonb_build_object(
          'success', true, 'status', 'ALREADY_PAID',
          'registration_id', v_existing_reg.id,
          'qr_token', v_existing_reg.qr_token,
          'full_name', v_existing_reg.full_name,
          'guardian_id', v_existing_guard.id,
          'guardian_qr_token', v_existing_guard.qr_token,
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
      promoted_guardian_id = v_guard_id,
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
        'Online Registration: ' || v_full_name || ' (' || v_reg_id || ')' ||
          CASE WHEN v_guard_id IS NOT NULL THEN ' + Guardian (' || v_guard_id || ')' ELSE '' END,
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
    'full_name', v_full_name,
    'guardian_id', v_guard_id,
    'guardian_qr_token', v_guard_token
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_verify_payment(p_reg_id text, p_trx_id text, p_method text, p_amount numeric, p_signature text, p_verified_by text DEFAULT 'PAYSTATION_GATEWAY'::text, p_pending_data jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_invoice_hint TEXT := NULLIF(trim(COALESCE(p_pending_data->>'gatewayInvoiceNumber', p_pending_data->>'gateway_invoice_number', '')), '');
  v_order_inv    TEXT;
  v_promote_res  JSONB;
  v_reg          RECORD;
  v_guard        RECORD;
  v_guard_id     TEXT;
  v_guard_token  TEXT;
  v_qr_token     TEXT;
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

  -- Prefer authoritative pending_orders promotion when matching pending order exists
  SELECT invoice_number INTO v_order_inv
  FROM public.pending_orders
  WHERE (v_invoice_hint IS NOT NULL AND invoice_number = v_invoice_hint)
     OR invoice_number = p_reg_id
     OR promoted_registration_id = p_reg_id
     OR (form_data->>'registrationId') = p_reg_id
  LIMIT 1;

  IF v_order_inv IS NOT NULL THEN
    v_promote_res := public.rpc_promote_pending_order_to_registration(
      v_order_inv, p_trx_id, p_amount, p_method, p_verified_by
    );
    RETURN v_promote_res;
  END IF;

  -- Fallback: check registrations_2027 directly
  SELECT * INTO v_reg
  FROM public.registrations_2027
  WHERE id = p_reg_id OR gateway_invoice_number = COALESCE(v_invoice_hint, p_reg_id)
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REGISTRATION_NOT_FOUND',
      'message', format('Registration "%s" not found in central database.', p_reg_id)
    );
  END IF;

  IF v_reg.payment_status = 'paid' THEN
    SELECT id, qr_token INTO v_guard
    FROM public.guardian_registrations_2027
    WHERE student_registration_id = v_reg.id
    LIMIT 1;
    RETURN jsonb_build_object(
      'success', true,
      'status', 'ALREADY_PAID',
      'registration_id', v_reg.id,
      'full_name', v_reg.full_name,
      'qr_token', v_reg.qr_token,
      'guardian_id', v_guard.id,
      'guardian_qr_token', v_guard.qr_token
    );
  END IF;

  v_qr_token := COALESCE(NULLIF(trim(v_reg.qr_token), ''), public.generate_unique_participant_qr_token());

  UPDATE public.registrations_2027
  SET payment_status = 'paid',
      transaction_id = p_trx_id,
      payment_method = public.rpc_normalize_payment_method(p_method),
      total_paid = p_amount,
      qr_token = v_qr_token,
      server_verification_signature = p_signature,
      verification_timestamp = clock_timestamp(),
      verified_by = p_verified_by,
      gateway_provider = 'PAYSTATION'
  WHERE id = v_reg.id;

  IF COALESCE(v_reg.has_parent, false) IS TRUE THEN
    SELECT id, qr_token INTO v_guard
    FROM public.guardian_registrations_2027
    WHERE student_registration_id = v_reg.id
    LIMIT 1;

    IF NOT FOUND THEN
      v_guard_id := public.generate_unique_guardian_reg_id(COALESCE(v_reg.year, 2027));
      v_guard_token := public.generate_unique_participant_qr_token();
      INSERT INTO public.guardian_registrations_2027 (
        id, registration_id, student_registration_id, event_id, year,
        guardian_name, mobile_number, relation, guardian_phone, guardian_relation, guardian_age,
        photo_url, photo_storage_path, qr_token,
        registration_fee, guardian_fee, total_paid, payment_status, registration_approval_status,
        transaction_id, payment_method, gateway_invoice_number, gateway_provider
      ) VALUES (
        v_guard_id, v_guard_id, v_reg.id, COALESCE(v_reg.event_id, 'PLSCF-2027'), COALESCE(v_reg.year, 2027),
        COALESCE(NULLIF(trim(v_reg.parent_name), ''), 'Guardian of ' || v_reg.full_name),
        COALESCE(NULLIF(trim(v_reg.parent_phone), ''), v_reg.mobile_number),
        COALESCE(NULLIF(trim(v_reg.parent_relation), ''), 'Guardian'),
        COALESCE(NULLIF(trim(v_reg.parent_phone), ''), v_reg.mobile_number),
        COALESCE(NULLIF(trim(v_reg.parent_relation), ''), 'Guardian'),
        v_reg.parent_age,
        COALESCE(v_reg.parent_photo_url, ''),
        v_reg.parent_photo_storage_path,
        v_guard_token,
        COALESCE(v_reg.parent_fee, 0),
        COALESCE(v_reg.parent_fee, 0),
        COALESCE(v_reg.parent_fee, 0),
        'paid',
        'approved',
        p_trx_id,
        public.rpc_normalize_payment_method(p_method),
        v_reg.gateway_invoice_number,
        'PAYSTATION'
      );
    ELSE
      v_guard_id := v_guard.id;
      v_guard_token := v_guard.qr_token;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'PAID',
    'registration_id', v_reg.id,
    'full_name', v_reg.full_name,
    'qr_token', v_qr_token,
    'guardian_id', v_guard_id,
    'guardian_qr_token', v_guard_token,
    'amount', p_amount,
    'trx_id', p_trx_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_lookup_ticket(p_identifier text DEFAULT ''::text, p_mobile text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_clean           TEXT := upper(trim(COALESCE(p_identifier, '')));
  v_clean_mobile    TEXT := regexp_replace(COALESCE(p_mobile, ''), '[^0-9]', '', 'g');
  v_mobile_supplied BOOLEAN := false;
  v_student         RECORD;
  v_guardian        RECORD;
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

  -- A) Student Lookup
  IF v_clean <> '' AND v_mobile_supplied AND v_clean <> v_clean_mobile THEN
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in,
           has_parent, parent_name, parent_phone, parent_relation, parent_photo_url
    INTO v_student
    FROM public.registrations_2027
    WHERE (upper(id) = v_clean OR upper(qr_token) = v_clean)
      AND regexp_replace(mobile_number, '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    LIMIT 1;
  ELSIF v_mobile_supplied THEN
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in,
           has_parent, parent_name, parent_phone, parent_relation, parent_photo_url
    INTO v_student
    FROM public.registrations_2027
    WHERE regexp_replace(mobile_number, '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    ORDER BY (payment_status = 'paid') DESC, registered_at DESC
    LIMIT 1;
  ELSE
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in,
           has_parent, parent_name, parent_phone, parent_relation, parent_photo_url
    INTO v_student
    FROM public.registrations_2027
    WHERE upper(qr_token) = v_clean
    LIMIT 1;
  END IF;

  IF FOUND THEN
    SELECT g.id, g.student_registration_id, g.guardian_name, g.guardian_phone,
           g.guardian_relation, g.photo_url, g.qr_token, g.payment_status,
           g.is_checked_in, g.gate_status, g.year
    INTO v_guardian
    FROM public.guardian_registrations_2027 g
    WHERE g.student_registration_id = v_student.id
      AND g.payment_status = 'paid'
    LIMIT 1;

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
        'qr_token', v_student.qr_token,
        'has_parent', COALESCE(v_student.has_parent, false),
        'guardian_registration_id', v_guardian.id,
        'guardian_qr_token', v_guardian.qr_token
      ),
      'guardian', CASE WHEN v_guardian.id IS NOT NULL THEN jsonb_build_object(
        'id', v_guardian.id,
        'student_registration_id', v_guardian.student_registration_id,
        'guardian_name', v_guardian.guardian_name,
        'guardian_relation', v_guardian.guardian_relation,
        'qr_token', v_guardian.qr_token,
        'payment_status', v_guardian.payment_status,
        'is_checked_in', v_guardian.is_checked_in,
        'gate_status', v_guardian.gate_status,
        'year', v_guardian.year
      ) ELSE NULL END
    );
  END IF;

  -- B) Direct Guardian Lookup by Guardian ID / Guardian QR Token / Guardian Phone
  IF v_clean <> '' AND v_mobile_supplied AND v_clean <> v_clean_mobile THEN
    SELECT g.*, s.batch_name, s.current_class, s.category, s.full_name AS student_name
    INTO v_guardian
    FROM public.guardian_registrations_2027 g
    JOIN public.registrations_2027 s ON s.id = g.student_registration_id
    WHERE (upper(g.id) = v_clean OR upper(COALESCE(g.registration_id, '')) = v_clean OR upper(g.qr_token) = v_clean)
      AND regexp_replace(COALESCE(g.guardian_phone, g.mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    LIMIT 1;
  ELSIF v_mobile_supplied THEN
    SELECT g.*, s.batch_name, s.current_class, s.category, s.full_name AS student_name
    INTO v_guardian
    FROM public.guardian_registrations_2027 g
    JOIN public.registrations_2027 s ON s.id = g.student_registration_id
    WHERE regexp_replace(COALESCE(g.guardian_phone, g.mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
    ORDER BY (g.payment_status = 'paid') DESC, g.registered_at DESC
    LIMIT 1;
  ELSE
    SELECT g.*, s.batch_name, s.current_class, s.category, s.full_name AS student_name
    INTO v_guardian
    FROM public.guardian_registrations_2027 g
    JOIN public.registrations_2027 s ON s.id = g.student_registration_id
    WHERE upper(g.qr_token) = v_clean
    LIMIT 1;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'type', 'guardian',
      'guardian', jsonb_build_object(
        'id', v_guardian.id,
        'student_registration_id', v_guardian.student_registration_id,
        'student_name', v_guardian.student_name,
        'batch_name', v_guardian.batch_name,
        'current_class', v_guardian.current_class,
        'guardian_name', v_guardian.guardian_name,
        'guardian_relation', v_guardian.guardian_relation,
        'qr_token', v_guardian.qr_token,
        'payment_status', v_guardian.payment_status,
        'is_checked_in', v_guardian.is_checked_in,
        'gate_status', v_guardian.gate_status,
        'year', v_guardian.year
      )
    );
  END IF;

  -- C) Donation lookup (preserved)
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

  RETURN jsonb_build_object('success', false, 'error', 'No verified ticket or donation matched those details.');
END;
$function$
;

COMMIT;
