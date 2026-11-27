-- ============================================================================
-- ROLLBACK: 20270322010000_rollback.sql
-- Restores rpc_promote_pending_order_to_registration (20270312) and
-- rpc_handle_paystation_ipn (20270311) without deleting promoted records.
-- ============================================================================

BEGIN;

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
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_TRANSACTION', 'message', 'Transaction ID already committed on a different invoice.');
  END IF;

  SELECT * INTO v_order FROM public.pending_orders WHERE invoice_number = p_invoice_number FOR UPDATE;
  IF NOT FOUND THEN
    SELECT * INTO v_existing_reg FROM public.registrations_2027 WHERE gateway_invoice_number = p_invoice_number LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'status', 'ALREADY_PAID', 'registration_id', v_existing_reg.id, 'qr_token', v_existing_reg.qr_token, 'full_name', v_existing_reg.full_name);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', format('Pending order for invoice "%s" not found.', p_invoice_number));
  END IF;

  IF v_order.status = 'paid' AND v_order.promoted_registration_id IS NOT NULL THEN
    SELECT qr_token, full_name INTO v_existing_reg FROM public.registrations_2027 WHERE id = v_order.promoted_registration_id;
    RETURN jsonb_build_object('success', true, 'status', 'ALREADY_PAID', 'registration_id', v_order.promoted_registration_id, 'qr_token', v_existing_reg.qr_token, 'full_name', v_existing_reg.full_name);
  END IF;

  v_category     := v_order.form_data->>'category';
  v_pay_with_chg := CASE WHEN COALESCE((v_order.fees->>'gatewayCharge')::numeric, 0) > 0 THEN 1 ELSE 0 END;
  v_fee_eval     := public.rpc_compute_expected_order_amount(COALESCE(v_order.order_type, 'registration'), v_category, COALESCE((v_order.form_data->>'hasParent')::boolean, false), COALESCE((v_order.fees->>'donationAmount')::numeric, 0), p_method, v_pay_with_chg);

  IF (v_fee_eval->>'valid')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_fee_eval->>'error', 'INVALID_AMOUNT'), 'message', COALESCE(v_fee_eval->>'message', 'Order fee configuration invalid.'));
  END IF;

  v_expected_total := (v_fee_eval->>'expected_total')::numeric;
  IF abs(v_order.amount - v_expected_total) > 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_FEE_TAMPERED');
  END IF;
  IF p_amount < v_order.amount - 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'AMOUNT_MISMATCH');
  END IF;
  IF p_amount > v_order.amount + 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'EXCESSIVE_OVERPAYMENT');
  END IF;

  IF v_order.order_type = 'donation' THEN
    UPDATE public.pending_orders SET status = 'paid', transaction_id = p_trx_id, reconciled_at = NOW(), updated_at = NOW() WHERE invoice_number = p_invoice_number;
    RETURN jsonb_build_object('success', true, 'status', 'DONATION_CONFIRMED', 'invoice_number', p_invoice_number);
  END IF;

  v_full_name     := NULLIF(trim(COALESCE(v_order.form_data->>'fullName', v_order.customer_name, '')), '');
  v_mobile_number := NULLIF(trim(COALESCE(v_order.form_data->>'mobileNumber', v_order.customer_phone, '')), '');
  v_photo_url     := NULLIF(trim(COALESCE(v_order.form_data->>'photoUrl', '')), '');
  v_address       := NULLIF(trim(COALESCE(v_order.form_data->>'address', '')), '');
  v_batch_name    := NULLIF(trim(COALESCE(v_order.form_data->>'batchName', '')), '');
  v_tshirt_size   := NULLIF(trim(COALESCE(v_order.form_data->>'tShirtSize', '')), '');
  v_student_id    := NULLIF(trim(COALESCE(v_order.form_data->>'studentId', '')), '');

  IF v_full_name IS NULL OR v_mobile_number IS NULL OR v_photo_url IS NULL OR v_photo_url ILIKE '%via.placeholder.com%' OR v_address IS NULL OR v_batch_name IS NULL OR v_tshirt_size IS NULL OR (v_category = 'current' AND v_student_id IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_REGISTRATION_DATA', 'message', 'Pending order lacks complete authoritative registration fields; refusing to fabricate fallback defaults.');
  END IF;

  IF v_tshirt_size NOT IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REGISTRATION_DATA', 'message', format('Invalid T-shirt size in pending order: %s', v_tshirt_size));
  END IF;

  v_year   := COALESCE(NULLIF(v_order.form_data->>'year', '')::int, 2027);
  v_reg_id := COALESCE(NULLIF(trim(v_order.form_data->>'registrationId'), ''), 'PLSCF-' || v_year || '-' || (CASE WHEN v_category = 'current' THEN 'C' ELSE 'F' END) || floor(1000 + random() * 9000)::text);
  v_qr_token := COALESCE(NULLIF(trim(v_order.form_data->>'qrToken'), ''), upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6)));
  WHILE EXISTS (SELECT 1 FROM public.registrations_2027 WHERE qr_token = v_qr_token) LOOP
    v_qr_token := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  END LOOP;
  v_signature := 'SIG-PAY-' || encode(sha256((v_reg_id || ':' || p_trx_id || ':' || p_amount)::bytea), 'hex');

  BEGIN
    INSERT INTO public.registrations_2027 (
      id, full_name, full_name_bn, photo_url, photo_storage_path, mobile_number, email, address,
      gender, blood_group, has_parent, parent_name, parent_age, parent_phone, parent_relation,
      parent_photo_url, parent_photo_storage_path, parent_fee, gateway_charge, category, student_id,
      passing_year, last_class_attended, current_class, batch_name, group_or_section, roll_number,
      t_shirt_size, registration_fee, donation_amount, total_paid, payment_status, transaction_id,
      payment_method, gateway_invoice_number, gateway_provider, registered_at, qr_token,
      is_tshirt_collected, is_manual_registration, registration_type, registration_approval_status,
      year, event_id, server_verification_signature, verification_timestamp, verified_by
    ) VALUES (
      v_reg_id, v_full_name, v_order.form_data->>'fullNameBn', v_photo_url, v_order.form_data->>'photoStoragePath',
      v_mobile_number, COALESCE(NULLIF(trim(v_order.form_data->>'email'), ''), v_order.customer_email), v_address,
      COALESCE(NULLIF(trim(v_order.form_data->>'gender'), ''), 'male'), v_order.form_data->>'bloodGroup',
      COALESCE((v_order.form_data->>'hasParent')::boolean, false), v_order.form_data->>'parentName',
      NULLIF(trim(COALESCE(v_order.form_data->>'parentAge', '')), ''), v_order.form_data->>'parentPhone',
      v_order.form_data->>'parentRelation', v_order.form_data->>'parentPhotoUrl', v_order.form_data->>'parentPhotoStoragePath',
      (v_fee_eval->>'parent_fee')::numeric, (v_fee_eval->>'gateway_charge')::numeric, v_category, v_student_id,
      v_order.form_data->>'passingYear', v_order.form_data->>'lastClassAttended', v_order.form_data->>'currentClass',
      v_batch_name, v_order.form_data->>'groupOrSection', v_order.form_data->>'rollNumber', v_tshirt_size,
      (v_fee_eval->>'registration_fee')::numeric, (v_fee_eval->>'donation_amount')::numeric, p_amount, 'paid',
      p_trx_id, lower(trim(p_method)), p_invoice_number, 'PAYSTATION', NOW(), v_qr_token, false, false,
      'online', 'approved', v_year, 'PLSCF-2027', v_signature, NOW(), p_verified_by
    ) ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    SELECT id, qr_token, full_name INTO v_existing_reg FROM public.registrations_2027 WHERE gateway_invoice_number = p_invoice_number LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'status', 'ALREADY_PAID', 'registration_id', v_existing_reg.id, 'qr_token', v_existing_reg.qr_token, 'full_name', v_existing_reg.full_name, 'message', 'Registration confirmed concurrently by another session.');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_TRANSACTION', 'message', 'Concurrent anti-replay: transaction committed by another session.');
  END;

  UPDATE public.pending_orders SET status = 'paid', promoted_registration_id = v_reg_id, transaction_id = p_trx_id, reconciled_at = NOW(), updated_at = NOW() WHERE invoice_number = p_invoice_number;

  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.financial_ledger (staff_id, transaction_type, amount, reference_id, description, created_by, gross_amount, gateway_fee, net_amount)
      VALUES ('GATEWAY_PAYSTATION', 'REGISTRATION_INFLOW', p_amount, p_trx_id, 'Online Registration: ' || v_full_name || ' (' || v_reg_id || ')', p_verified_by, p_amount, (v_fee_eval->>'gateway_charge')::numeric, p_amount - (v_fee_eval->>'gateway_charge')::numeric)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF v_student_id IS NOT NULL AND to_regclass('public.current_student_ids') IS NOT NULL THEN
    BEGIN
      UPDATE public.current_student_ids SET verification_status = 'USED', used_registration_id = v_reg_id, reserved_until = NULL, updated_at = NOW() WHERE upper(trim(student_id)) = upper(trim(v_student_id));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'PROMOTED', 'registration_id', v_reg_id, 'qr_token', v_qr_token, 'full_name', v_full_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

COMMIT;
