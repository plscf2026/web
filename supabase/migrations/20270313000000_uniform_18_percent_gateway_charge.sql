-- ============================================================================
-- Migration: Uniform 1.8% Gateway Charge Across All Online Payments
-- Updates portal_fee_settings to flat 1.8% (0.018) across every payment method
-- and aligns rpc_compute_expected_order_amount to always apply the configured
-- percentage fee on subtotal. Preserves paymentEnabled / open flags as-is.
-- ============================================================================

UPDATE public.system_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{gatewayChargePercent}',
    '1.8'::jsonb,
    true
  ),
  '{gatewayChargeRates}',
  jsonb_build_object(
    'paystation', 0.018,
    'bkash',      0.018,
    'nagad',      0.018,
    'rocket',     0.018,
    'upay',       0.018,
    'card',       0.018,
    'visa',       0.018,
    'mastercard', 0.018,
    'amex',       0.018
  ),
  true
),
updated_at = NOW()
WHERE key = 'portal_fee_settings';

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
  v_method           TEXT := COALESCE(NULLIF(lower(trim(p_method)), ''), 'paystation');
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
  IF v_rate_text IS NULL AND v_method = 'paystation' AND (v_cfg ? 'gatewayChargePercent') THEN
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

  -- Uniform 1.8% gateway charge applies on every payment subtotal
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
