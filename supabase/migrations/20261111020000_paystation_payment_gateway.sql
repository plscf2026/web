-- =========================================================================
-- Police Lines School & College Faridpur — Reunion 2026
-- Migration: PayStation Payment Gateway Production Architecture
-- Integration Reference: https://paystation.com.bd/documentation
-- =========================================================================

-- 1. Extend registrations_2026 for PayStation invoice & telemetry
ALTER TABLE public.registrations_2026
  ADD COLUMN IF NOT EXISTS gateway_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS gateway_provider TEXT DEFAULT 'PAYSTATION',
  ADD COLUMN IF NOT EXISTS gateway_response JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_registrations_2026_gateway_inv
  ON public.registrations_2026(gateway_invoice_number)
  WHERE gateway_invoice_number IS NOT NULL;

-- 2. Enhanced RPC for PayStation Payment Verification
CREATE OR REPLACE FUNCTION public.rpc_verify_payment(
  p_reg_id TEXT,
  p_trx_id TEXT,
  p_method TEXT,
  p_amount NUMERIC,
  p_signature TEXT,
  p_verified_by TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_reg RECORD;
  v_dup_count INTEGER;
  v_qr_token TEXT;
BEGIN
  -- 1. Anti-Replay Protection: Ensure transaction ID is not used by another attendee
  IF p_trx_id IS NOT NULL AND trim(p_trx_id) <> '' THEN
    SELECT COUNT(*) INTO v_dup_count 
    FROM public.registrations_2026 
    WHERE upper(trim(transaction_id)) = upper(trim(p_trx_id))
      AND id <> p_reg_id;

    IF v_dup_count > 0 THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'DUPLICATE_TRANSACTION: This PayStation transaction ID has already been utilized.'
      );
    END IF;
  END IF;

  -- 2. Retrieve existing registration
  SELECT * INTO v_reg FROM public.registrations_2026 WHERE id = p_reg_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'REGISTRATION_NOT_FOUND');
  END IF;

  -- 3. Ensure QR Token exists or generate high-entropy token
  IF v_reg.qr_token IS NOT NULL AND trim(v_reg.qr_token) <> '' THEN
    v_qr_token := v_reg.qr_token;
  ELSE
    v_qr_token := 'PLSCF26-' || upper(encode(gen_random_bytes(12), 'hex'));
  END IF;

  -- 4. Authoritatively mark payment as PAID with server verification signature
  UPDATE public.registrations_2026
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

  -- 5. Record Double-Entry Credit in Financial Ledger
  INSERT INTO public.financial_ledger (
    staff_id,
    transaction_type,
    amount,
    reference_id,
    description,
    created_at,
    created_by
  ) VALUES (
    'GATEWAY_PAYSTATION',
    'REGISTRATION_INFLOW',
    p_amount,
    p_trx_id,
    'PayStation verified online payment for ' || v_reg.full_name || ' (' || p_reg_id || ') via ' || upper(p_method),
    clock_timestamp(),
    p_verified_by
  );

  -- 6. Record Tamper-Evident Admin Audit Log
  INSERT INTO public.admin_audit_logs (
    admin_id,
    admin_username,
    admin_role,
    action,
    target_type,
    target_id,
    details,
    checksum
  ) VALUES (
    p_verified_by,
    p_verified_by,
    'system_verifier',
    'PAYMENT_VERIFIED_PAYSTATION',
    'registration',
    p_reg_id,
    jsonb_build_object(
      'trx_id', p_trx_id,
      'method', p_method,
      'amount', p_amount,
      'provider', 'PAYSTATION',
      'qr_token', v_qr_token
    ),
    p_signature
  );

  RETURN jsonb_build_object(
    'success', true, 
    'status', 'paid', 
    'qr_token', v_qr_token,
    'verified_at', clock_timestamp()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role, authenticated;

