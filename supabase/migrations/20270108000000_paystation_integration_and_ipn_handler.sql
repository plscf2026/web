-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR — REUNION 2027 PLATFORM
-- MIGRATION: 20270108000000_paystation_integration_and_ipn_handler.sql
-- 
-- OBJECTIVES:
-- 1. Create dedicated public.ipn_logs table for PayStation IPN audit and disputes.
-- 2. Ensure gateway_invoice_number, gateway_provider, gateway_response in registrations_2027.
-- 3. Create authoritative SECURITY DEFINER rpc_handle_paystation_ipn function with
--    5-point verification, idempotency guard, financial ledger credit, and audit logs.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. IPN LOGS TABLE FOR WEBHOOK AUDIT & RECONCILIATION
-- ============================================================================
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

-- ============================================================================
-- 2. ENSURE REGISTRATIONS_2027 INVOICE COLUMNS & INDEXES
-- ============================================================================
ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS gateway_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS gateway_provider TEXT DEFAULT 'PAYSTATION',
  ADD COLUMN IF NOT EXISTS gateway_response JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reg_2027_gateway_inv
  ON public.registrations_2027 (gateway_invoice_number)
  WHERE gateway_invoice_number IS NOT NULL;

-- ============================================================================
-- 3. AUTHORITATIVE IPN WEBHOOK RPC (rpc_handle_paystation_ipn)
-- ============================================================================
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
SET search_path = public, auth
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
  WHERE upper(trim(transaction_id)) = upper(trim(p_trx_id))
    AND gateway_invoice_number <> p_invoice_number
    AND id <> p_invoice_number;

  IF v_dup_count > 0 THEN
    v_res := jsonb_build_object('success', false, 'error', 'DUPLICATE_TRANSACTION', 'message', 'Transaction ID already utilized');
    INSERT INTO public.ipn_logs (invoice_number, trx_id, trx_status, trx_amount, raw_payload, ipn_response, http_status)
    VALUES (p_invoice_number, p_trx_id, 'DUPLICATE', COALESCE(p_amount, 0), p_raw_payload, v_res, 409);
    RETURN v_res;
  END IF;

  -- 3. Lookup registration by gateway_invoice_number or id
  SELECT * INTO v_reg
  FROM public.registrations_2027
  WHERE gateway_invoice_number = p_invoice_number OR id = p_invoice_number
  LIMIT 1;

  IF NOT FOUND THEN
    v_res := jsonb_build_object('success', false, 'error', 'REGISTRATION_NOT_FOUND', 'message', 'Invoice not found in registrations_2027');
    INSERT INTO public.ipn_logs (invoice_number, trx_id, trx_status, trx_amount, raw_payload, ipn_response, http_status)
    VALUES (p_invoice_number, p_trx_id, 'NOT_FOUND', COALESCE(p_amount, 0), p_raw_payload, v_res, 404);
    RETURN v_res;
  END IF;

  -- 4. Idempotency: If already marked as paid with this transaction, return success without duplicate processing
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

  -- 5. Amount validation: Allow small tolerance (e.g. 5 BDT delta) for rounding/gateway charges
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

  -- 6. QR token preservation or generation
  IF v_reg.qr_token IS NOT NULL AND trim(v_reg.qr_token) <> '' THEN
    v_qr_token := v_reg.qr_token;
  ELSE
    v_qr_token := 'PLSCF27-' || upper(encode(gen_random_bytes(6), 'hex'));
  END IF;

  -- 7. Cryptographic server signature
  v_sig := 'SIG_IPN_' || upper(encode(digest('PLSCF:' || v_reg.id || ':' || trim(p_trx_id) || ':' || p_amount, 'sha256'), 'hex'));

  -- 8. Mark payment as paid in registrations_2027
  UPDATE public.registrations_2027
  SET payment_status = 'paid',
      transaction_id = p_trx_id,
      payment_method = lower(trim(COALESCE(p_method, 'bkash'))),
      total_paid = p_amount,
      gateway_invoice_number = p_invoice_number,
      gateway_provider = 'PAYSTATION',
      gateway_response = p_raw_payload,
      qr_token = v_qr_token,
      server_verification_signature = v_sig,
      verification_timestamp = clock_timestamp(),
      verified_by = 'PAYSTATION_IPN'
  WHERE id = v_reg.id;

  -- 9. Double-entry financial ledger entry
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
      'PayStation IPN Inflow: ' || v_reg.full_name || ' (' || v_reg.id || ') via ' || upper(COALESCE(p_method, 'ONLINE')),
      'PAYSTATION_IPN'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- 10. Admin Audit Log
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    INSERT INTO public.admin_audit_logs (
      admin_id,
      admin_username,
      admin_role,
      action,
      target_type,
      target_id,
      details,
      severity
    ) VALUES (
      'SYSTEM_GATEWAY',
      'PAYSTATION_IPN',
      'SUPER_ADMIN',
      'CONFIRM_PAYMENT',
      'registration',
      v_reg.id,
      jsonb_build_object(
        'invoice_number', p_invoice_number,
        'trx_id', p_trx_id,
        'amount', p_amount,
        'method', p_method,
        'order_date_time', p_order_date_time
      ),
      'INFO'
    );
  END IF;

  -- 11. Record successful IPN Log
  v_res := jsonb_build_object(
    'success', true,
    'status', 'PAID',
    'registration_id', v_reg.id,
    'full_name', v_reg.full_name,
    'qr_token', v_qr_token,
    'trx_id', p_trx_id,
    'amount', p_amount
  );

  INSERT INTO public.ipn_logs (
    invoice_number,
    trx_id,
    trx_status,
    trx_amount,
    payment_method,
    order_date_time,
    reference,
    raw_payload,
    ipn_response,
    http_status
  ) VALUES (
    p_invoice_number,
    p_trx_id,
    'Success',
    p_amount,
    p_method,
    p_order_date_time,
    p_reference,
    p_raw_payload,
    v_res,
    200
  );

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

COMMIT;

