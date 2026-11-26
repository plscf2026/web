-- ============================================================================
-- Migration: Fix rpc_verify_payment Pending Order Lookup & Gateway Method Mapping
-- 1. Ensures Card/CyberSource and other PayStation channel strings map cleanly
--    to the uniform 1.8% gatewayChargeRates instead of failing INVALID_PAYMENT_METHOD.
-- 2. Prioritizes exact invoice_number lookup in pending_orders when
--    gatewayInvoiceNumber is supplied so a retried order is never mismatched
--    against an earlier aborted pending_order sharing the same draft registrationId.
-- ============================================================================

ALTER TABLE public.registrations_2027
  DROP CONSTRAINT IF EXISTS registrations_2027_payment_method_check;
ALTER TABLE public.registrations_2027
  ADD CONSTRAINT registrations_2027_payment_method_check
  CHECK (payment_method IS NULL OR lower(payment_method) = ANY (ARRAY[
    'bkash'::text,
    'nagad'::text,
    'rocket'::text,
    'upay'::text,
    'card'::text,
    'amex'::text,
    'visa'::text,
    'mastercard'::text,
    'cybersource'::text,
    'sslcommerz'::text,
    'paystation'::text,
    'cash'::text,
    'bank_transfer'::text,
    'bank transfer'::text,
    'manual'::text,
    'other'::text
  ]));

UPDATE public.system_settings
SET value = jsonb_set(
  value,
  '{gatewayChargeRates}',
  COALESCE(value->'gatewayChargeRates', '{}'::jsonb) || jsonb_build_object(
    'cybersource', 0.018,
    'sslcommerz',  0.018,
    'paystation',  0.018,
    'card',        0.018,
    'visa',        0.018,
    'mastercard',  0.018,
    'amex',        0.018,
    'bkash',       0.018,
    'nagad',       0.018,
    'rocket',      0.018,
    'upay',        0.018,
    'other',       0.018
  ),
  true
),
updated_at = NOW()
WHERE key = 'portal_fee_settings';

CREATE OR REPLACE FUNCTION public.rpc_normalize_payment_method(p_method TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN NULLIF(lower(trim(COALESCE(p_method, ''))), '') IS NULL THEN 'paystation'
    WHEN lower(trim(p_method)) LIKE '%bkash%' THEN 'bkash'
    WHEN lower(trim(p_method)) LIKE '%nagad%' THEN 'nagad'
    WHEN lower(trim(p_method)) LIKE '%rocket%' OR lower(trim(p_method)) LIKE '%dbbl%' THEN 'rocket'
    WHEN lower(trim(p_method)) LIKE '%upay%' THEN 'upay'
    WHEN lower(trim(p_method)) LIKE '%amex%' THEN 'amex'
    WHEN lower(trim(p_method)) LIKE '%cybersource%'
      OR lower(trim(p_method)) LIKE '%visa%'
      OR lower(trim(p_method)) LIKE '%master%'
      OR lower(trim(p_method)) LIKE '%sslcommerz%'
      OR lower(trim(p_method)) LIKE '%card%' THEN 'card'
    WHEN lower(trim(p_method)) IN ('cash', 'bank_transfer', 'bank transfer', 'manual', 'other', 'paystation')
      THEN lower(trim(p_method))
    ELSE 'paystation'
  END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_compute_expected_order_amount(
  p_order_type TEXT,
  p_category TEXT DEFAULT NULL,
  p_has_parent BOOLEAN DEFAULT false,
  p_donation_amount NUMERIC DEFAULT 0,
  p_method TEXT DEFAULT 'paystation',
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
  v_raw_method       TEXT := COALESCE(NULLIF(lower(trim(p_method)), ''), 'paystation');
  v_method           TEXT;
  v_base_fee         NUMERIC := 0;
  v_parent_fee       NUMERIC := 0;
  v_donation         NUMERIC := COALESCE(p_donation_amount, 0);
  v_subtotal         NUMERIC;
  v_gateway_charge   NUMERIC := 0;
  v_total            NUMERIC;
BEGIN
  -- Normalize gateway channel labels returned by PayStation status/IPN APIs
  v_method := CASE
    WHEN v_raw_method LIKE '%bkash%' THEN 'bkash'
    WHEN v_raw_method LIKE '%nagad%' THEN 'nagad'
    WHEN v_raw_method LIKE '%rocket%' OR v_raw_method LIKE '%dbbl%' THEN 'rocket'
    WHEN v_raw_method LIKE '%upay%' THEN 'upay'
    WHEN v_raw_method LIKE '%amex%' THEN 'amex'
    WHEN v_raw_method LIKE '%cybersource%'
      OR v_raw_method LIKE '%visa%'
      OR v_raw_method LIKE '%master%'
      OR v_raw_method LIKE '%sslcommerz%'
      OR v_raw_method LIKE '%card%' THEN 'card'
    ELSE v_raw_method
  END;

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

  v_rate_text := COALESCE(v_cfg->'gatewayChargeRates'->>v_method, v_cfg->'gatewayChargeRates'->>'paystation');
  IF v_rate_text IS NULL AND (v_cfg ? 'gatewayChargePercent') THEN
    v_rate := (v_cfg->>'gatewayChargePercent')::numeric / 100.0;
  ELSIF v_rate_text IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_PAYMENT_METHOD', 'message', format('Unsupported or unconfigured payment method: %s', p_method));
  ELSE
    v_rate := v_rate_text::numeric;
  END IF;

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

  v_gateway_charge := round(v_subtotal * v_rate, 2);
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
  v_order_found     BOOLEAN := false;
  v_fee_eval        JSONB;
  v_expected_total  NUMERIC;
  v_expected_base   NUMERIC;
  v_norm_method     TEXT := public.rpc_normalize_payment_method(p_method);
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

  -- Prioritize exact invoice match first when v_hint_invoice is provided
  IF v_hint_invoice IS NOT NULL THEN
    SELECT payment_status, transaction_id, qr_token, full_name, mobile_number, category,
           student_id, batch_name, gateway_invoice_number, registration_fee, donation_amount,
           COALESCE(has_parent, false), COALESCE(gateway_charge, 0)
    INTO v_existing_status, v_existing_trx_id, v_qr_token, v_reg_name, v_mobile, v_category,
         v_student_id, v_batch_name, v_invoice_num, v_reg_fee_stored, v_don_stored,
         v_has_parent, v_gw_charge
    FROM public.registrations_2027
    WHERE gateway_invoice_number = v_hint_invoice
    FOR UPDATE;
    v_found := FOUND;
  END IF;

  IF NOT v_found THEN
    SELECT payment_status, transaction_id, qr_token, full_name, mobile_number, category,
           student_id, batch_name, gateway_invoice_number, registration_fee, donation_amount,
           COALESCE(has_parent, false), COALESCE(gateway_charge, 0)
    INTO v_existing_status, v_existing_trx_id, v_qr_token, v_reg_name, v_mobile, v_category,
         v_student_id, v_batch_name, v_invoice_num, v_reg_fee_stored, v_don_stored,
         v_has_parent, v_gw_charge
    FROM public.registrations_2027
    WHERE id = p_reg_id
    FOR UPDATE;
    v_found := FOUND;
  END IF;

  IF v_found THEN
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
    -- Strictly match exact pending_orders.invoice_number first when gatewayInvoiceNumber is provided
    IF v_hint_invoice IS NOT NULL THEN
      SELECT * INTO v_order
      FROM public.pending_orders
      WHERE invoice_number = v_hint_invoice
      FOR UPDATE
      LIMIT 1;
      v_order_found := FOUND;
    END IF;

    IF NOT v_order_found THEN
      SELECT * INTO v_order
      FROM public.pending_orders
      WHERE invoice_number = p_reg_id
         OR (form_data->>'registrationId') = p_reg_id
      ORDER BY (invoice_number = p_reg_id) DESC, created_at DESC
      FOR UPDATE
      LIMIT 1;
      v_order_found := FOUND;
    END IF;

    IF v_order_found THEN
      SELECT public.rpc_promote_pending_order_to_registration(
        v_order.invoice_number,
        p_trx_id,
        p_amount,
        v_norm_method,
        p_verified_by
      ) INTO v_promo_res;
      RETURN v_promo_res;
    END IF;

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
    v_norm_method,
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
        payment_method                = v_norm_method,
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
      v_norm_method,
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
