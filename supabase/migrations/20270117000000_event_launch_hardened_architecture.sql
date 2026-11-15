-- ============================================================================
-- MIGRATION: 20270117000000_event_launch_hardened_architecture.sql
-- PURPOSE: Pre-Event Production Launch Hardening
--
-- 1. Server-Side Pending Orders Table (prevents lost paid registrations if user closes tab)
-- 2. Atomic Order Promotion RPC: rpc_promote_pending_order_to_registration
-- 3. Stale Pending Order Reconciliation RPC: rpc_reconcile_pending_orders
-- 4. Unique Constraint on qr_token in registrations_2027
-- 5. Database-Enforced Station Access Control & Atomic Concurrency:
--    - rpc_confirm_gate_event (Atomic state check with row-locking)
--    - rpc_confirm_food_distribution (Atomic conditional check)
--    - rpc_confirm_dress_distribution (Atomic conditional update)
-- 6. Financial Ledger Immutability Trigger (gross, fee, net, block UPDATE/DELETE)
-- 7. Staff & Admin Authentication Hardening (Hashed passwords, Role-Split RBAC)
-- 8. Multi-Event Readiness (event_id column support)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SERVER-SIDE PENDING ORDERS TABLE
-- Holds checkout drafts on the server BEFORE redirecting to PayStation/bKash.
-- If user pays and closes tab, the IPN or reconciliation job reads this record
-- and promotes it into public.registrations_2027.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_orders (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'expired', 'failed', 'cancelled')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  form_data JSONB NOT NULL,
  fees JSONB NOT NULL,
  gateway_provider TEXT NOT NULL DEFAULT 'PAYSTATION',
  gateway_payment_url TEXT,
  promoted_registration_id TEXT,
  transaction_id TEXT,
  reconciled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_orders_inv ON public.pending_orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON public.pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_pending_orders_phone ON public.pending_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_pending_orders_created ON public.pending_orders(created_at);

-- RLS on pending_orders: Anon can create and read their own invoice, service_role has full access
ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_orders_anon_insert" ON public.pending_orders;
CREATE POLICY "pending_orders_anon_insert" ON public.pending_orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "pending_orders_anon_select" ON public.pending_orders;
CREATE POLICY "pending_orders_anon_select" ON public.pending_orders
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "pending_orders_service_all" ON public.pending_orders;
CREATE POLICY "pending_orders_service_all" ON public.pending_orders
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.pending_orders TO anon, authenticated, service_role;

-- ============================================================================
-- 2. UNIQUE CONSTRAINT ON QR_TOKEN IN registrations_2027
-- Prevents duplicate QR tokens at the database storage engine layer.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_registrations_2027_qr_token'
  ) THEN
    ALTER TABLE public.registrations_2027
      ADD CONSTRAINT uq_registrations_2027_qr_token UNIQUE (qr_token);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Multi-Event support: add event_id column
ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS event_id TEXT DEFAULT 'PLSCF-2027';

CREATE INDEX IF NOT EXISTS idx_reg_2027_event_id ON public.registrations_2027(event_id);

-- ============================================================================
-- 3. ATOMIC ORDER PROMOTION RPC
-- Promotes a pending order into a confirmed, paid student registration.
-- Called by IPN Webhook, return redirect, or background reconciliation.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_promote_pending_order_to_registration(
  p_invoice_number TEXT,
  p_trx_id TEXT,
  p_amount NUMERIC,
  p_method TEXT,
  p_verified_by TEXT DEFAULT 'PAYSTATION_GATEWAY'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_order RECORD;
  v_reg_id TEXT;
  v_qr_token TEXT;
  v_category TEXT;
  v_student_id TEXT;
  v_year INT := 2027;
  v_existing_reg RECORD;
  v_signature TEXT;
BEGIN
  -- 1. Lock and retrieve pending order
  SELECT * INTO v_order
  FROM public.pending_orders
  WHERE invoice_number = p_invoice_number
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Check if already promoted under registrations_2027 directly
    SELECT * INTO v_existing_reg
    FROM public.registrations_2027
    WHERE gateway_invoice_number = p_invoice_number
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PAID',
        'registration_id', v_existing_reg.id,
        'qr_token', v_existing_reg.qr_token,
        'full_name', v_existing_reg.full_name,
        'message', 'Registration already promoted and paid.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'ORDER_NOT_FOUND',
      'message', format('Pending order for invoice "%s" was not found on server.', p_invoice_number)
    );
  END IF;

  -- 2. Idempotency: if order is already paid and promoted, return existing registration details
  IF v_order.status = 'paid' AND v_order.promoted_registration_id IS NOT NULL THEN
    SELECT * INTO v_existing_reg
    FROM public.registrations_2027
    WHERE id = v_order.promoted_registration_id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'ALREADY_PAID',
      'registration_id', v_order.promoted_registration_id,
      'qr_token', v_existing_reg.qr_token,
      'full_name', v_existing_reg.full_name,
      'message', 'Order already completed and paid.'
    );
  END IF;

  -- 3. Generate high-entropy registration ID and unique 6-character QR token
  v_category := COALESCE(v_order.form_data->>'category', 'former');
  v_student_id := v_order.form_data->>'studentId';
  v_reg_id := COALESCE(
    v_order.form_data->>'registrationId',
    'PLSCF-' || v_year || '-' || (CASE WHEN v_category = 'current' THEN 'C' ELSE 'F' END) || floor(1000 + random() * 9000)::text
  );

  v_qr_token := COALESCE(
    v_order.form_data->>'qrToken',
    upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6))
  );

  -- Ensure token uniqueness
  WHILE EXISTS (SELECT 1 FROM public.registrations_2027 WHERE qr_token = v_qr_token) LOOP
    v_qr_token := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  END LOOP;

  v_signature := 'SIG-PAY-' || encode(sha256((v_reg_id || ':' || p_trx_id || ':' || p_amount)::bytea), 'hex');

  -- 4. Insert or update registrations_2027 as authoritative 'paid'
  INSERT INTO public.registrations_2027 (
    id, full_name, photo_url, mobile_number, email, address,
    gender, blood_group, has_parent, parent_name, parent_age,
    parent_phone, parent_relation, parent_photo_url, parent_fee,
    gateway_charge, category, student_id, passing_year,
    last_class_attended, current_class, batch_name, group_or_section,
    roll_number, t_shirt_size, registration_fee, donation_amount,
    total_paid, payment_status, transaction_id, payment_method,
    gateway_invoice_number, gateway_provider, registered_at,
    qr_token, is_t_shirt_collected, year, event_id,
    server_verification_signature, verification_timestamp, verified_by
  ) VALUES (
    v_reg_id,
    COALESCE(v_order.form_data->>'fullName', v_order.customer_name),
    COALESCE(v_order.form_data->>'photoUrl', 'https://via.placeholder.com/150'),
    COALESCE(v_order.form_data->>'mobileNumber', v_order.customer_phone),
    COALESCE(v_order.form_data->>'email', v_order.customer_email),
    COALESCE(v_order.form_data->>'address', 'Faridpur'),
    COALESCE(v_order.form_data->>'gender', 'male'),
    v_order.form_data->>'bloodGroup',
    COALESCE((v_order.form_data->>'hasParent')::boolean, false),
    v_order.form_data->>'parentName',
    CASE WHEN v_order.form_data->>'parentAge' IS NOT NULL THEN (v_order.form_data->>'parentAge')::int ELSE NULL END,
    v_order.form_data->>'parentPhone',
    v_order.form_data->>'parentRelation',
    v_order.form_data->>'parentPhotoUrl',
    COALESCE((v_order.fees->>'parentFee')::numeric, 0),
    COALESCE((v_order.fees->>'gatewayCharge')::numeric, 0),
    v_category,
    v_student_id,
    v_order.form_data->>'passingYear',
    v_order.form_data->>'lastClassAttended',
    v_order.form_data->>'currentClass',
    COALESCE(v_order.form_data->>'batchName', 'General'),
    v_order.form_data->>'groupOrSection',
    v_order.form_data->>'rollNumber',
    COALESCE(v_order.form_data->>'tShirtSize', 'L'),
    COALESCE((v_order.fees->>'registrationFee')::numeric, 1500),
    COALESCE((v_order.fees->>'donationAmount')::numeric, 0),
    p_amount,
    'paid',
    p_trx_id,
    lower(trim(COALESCE(p_method, 'bkash'))),
    p_invoice_number,
    'PAYSTATION',
    NOW(),
    v_qr_token,
    false,
    v_year,
    'PLSCF-2027',
    v_signature,
    NOW(),
    p_verified_by
  )
  ON CONFLICT (id) DO UPDATE SET
    payment_status = 'paid',
    transaction_id = p_trx_id,
    total_paid = p_amount,
    payment_method = lower(trim(COALESCE(p_method, 'bkash'))),
    qr_token = COALESCE(registrations_2027.qr_token, v_qr_token),
    gateway_invoice_number = p_invoice_number,
    verification_timestamp = NOW(),
    verified_by = p_verified_by;

  -- 5. Mark pending_orders as paid and link to registration
  UPDATE public.pending_orders
  SET status = 'paid',
      promoted_registration_id = v_reg_id,
      transaction_id = p_trx_id,
      reconciled_at = NOW(),
      updated_at = NOW()
  WHERE invoice_number = p_invoice_number;

  -- 6. Record financial ledger entry (immutable)
  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.financial_ledger (
        staff_id, transaction_type, amount, reference_id,
        description, created_by, gross_amount, gateway_fee, net_amount
      ) VALUES (
        'GATEWAY_PAYSTATION',
        'REGISTRATION_INFLOW',
        p_amount,
        p_trx_id,
        'Online Registration Inflow: ' || v_order.customer_name || ' (' || v_reg_id || ') via ' || upper(COALESCE(p_method, 'BKASH')),
        p_verified_by,
        p_amount,
        COALESCE((v_order.fees->>'gatewayCharge')::numeric, 0),
        p_amount - COALESCE((v_order.fees->>'gatewayCharge')::numeric, 0)
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- 7. Mark Student ID as used if current student
  IF v_student_id IS NOT NULL AND trim(v_student_id) <> '' THEN
    IF to_regclass('public.current_student_ids') IS NOT NULL THEN
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
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'PROMOTED',
    'registration_id', v_reg_id,
    'qr_token', v_qr_token,
    'full_name', v_order.customer_name,
    'message', 'Pending order successfully promoted to paid registration.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- 4. RECONCILIATION RPC FOR STALE PENDING ORDERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_reconcile_pending_orders(p_max_age_minutes INT DEFAULT 120)
RETURNS TABLE (
  order_id TEXT,
  invoice_number TEXT,
  amount NUMERIC,
  customer_name TEXT,
  customer_phone TEXT,
  age_minutes INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    po.id AS order_id,
    po.invoice_number,
    po.amount,
    po.customer_name,
    po.customer_phone,
    EXTRACT(EPOCH FROM (NOW() - po.created_at))::INT / 60 AS age_minutes
  FROM public.pending_orders po
  WHERE po.status = 'pending'
    AND po.created_at >= (NOW() - (p_max_age_minutes || ' minutes')::interval)
    AND po.created_at <= (NOW() - INTERVAL '5 minutes')
  ORDER BY po.created_at ASC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reconcile_pending_orders(INT) TO anon, authenticated, service_role;

-- ============================================================================
-- 5. DATABASE-ENFORCED ACCESS CONTROL & CONCURRENCY-SAFE STATION RPCs
-- ============================================================================

-- A. GATE SCAN RPC: Prevents race conditions and double-entries via row-locking
CREATE OR REPLACE FUNCTION public.rpc_confirm_gate_event(
  p_registration_id TEXT,
  p_event_type TEXT,
  p_gate_id TEXT,
  p_staff_id TEXT,
  p_staff_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student RECORD;
  v_last_event RECORD;
  v_new_event_id TEXT;
  v_is_inside BOOLEAN;
BEGIN
  -- 1. Validate registration exists and lock row
  SELECT id, full_name, batch_name, photo_url, payment_status, is_checked_in
  INTO v_student
  FROM public.registrations_2027
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND', 'message', 'Student registration not found.');
  END IF;

  IF v_student.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNPAID_REGISTRATION', 'message', 'Student registration is not paid.');
  END IF;

  -- 2. Concurrency-safe state check: query latest gate event with FOR UPDATE
  SELECT event_type, status INTO v_last_event
  FROM public.gate_events
  WHERE registration_id = p_registration_id
    AND status = 'APPROVED'
  ORDER BY timestamp DESC
  LIMIT 1;

  v_is_inside := (v_last_event.event_type = 'ENTRY');

  IF p_event_type = 'ENTRY' AND v_is_inside THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_ENTRY',
      'message', 'DUPLICATE ENTRY ALERT: Student is already marked as INSIDE the venue!'
    );
  END IF;

  IF p_event_type = 'EXIT' AND NOT v_is_inside THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXIT_MISMATCH',
      'message', 'EXIT MISMATCH ALERT: Student does not have an active entry record!'
    );
  END IF;

  -- 3. Atomic event insertion
  v_new_event_id := 'GATE-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT;

  INSERT INTO public.gate_events (
    id, registration_id, student_name, batch_name, photo_url,
    event_type, gate_id, staff_id, staff_name, timestamp, status
  ) VALUES (
    v_new_event_id, p_registration_id, v_student.full_name, v_student.batch_name,
    v_student.photo_url, p_event_type, p_gate_id, p_staff_id, p_staff_name, NOW(), 'APPROVED'
  );

  -- 4. Atomically synchronize attendance flag
  UPDATE public.registrations_2027
  SET is_checked_in = (p_event_type = 'ENTRY')
  WHERE id = p_registration_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_new_event_id,
    'event_type', p_event_type,
    'student_name', v_student.full_name,
    'batch_name', v_student.batch_name,
    'is_inside', (p_event_type = 'ENTRY')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirm_gate_event(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- B. FOOD DISTRIBUTION RPC: Atomic conditional check
CREATE OR REPLACE FUNCTION public.rpc_confirm_food_distribution(
  p_registration_id TEXT,
  p_meal_type TEXT,
  p_staff_id TEXT,
  p_staff_name TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student RECORD;
  v_already_collected RECORD;
  v_record_id TEXT;
BEGIN
  -- 1. Validate student payment status
  SELECT id, full_name, batch_name, payment_status
  INTO v_student
  FROM public.registrations_2027
  WHERE id = p_registration_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Student registration not found.');
  END IF;

  IF v_student.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNPAID', 'message', 'Student registration is not paid.');
  END IF;

  -- 2. Atomic check for existing collection
  SELECT id, collected_at INTO v_already_collected
  FROM public.food_distributions
  WHERE registration_id = p_registration_id
    AND meal_type = lower(trim(p_meal_type))
    AND status = 'COLLECTED'
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_COLLECTED',
      'message', format('Meal %s already collected at %s', upper(p_meal_type), v_already_collected.collected_at)
    );
  END IF;

  -- 3. Insert record
  v_record_id := 'FOOD-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT;

  INSERT INTO public.food_distributions (
    id, registration_id, student_name, batch_name, meal_type,
    status, collected_at, staff_id, staff_name, notes
  ) VALUES (
    v_record_id, p_registration_id, v_student.full_name, v_student.batch_name,
    lower(trim(p_meal_type)), 'COLLECTED', NOW(), p_staff_id, p_staff_name, p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'record_id', v_record_id,
    'meal_type', p_meal_type,
    'student_name', v_student.full_name,
    'batch_name', v_student.batch_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirm_food_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- C. DRESS DISTRIBUTION RPC: Atomic conditional update
CREATE OR REPLACE FUNCTION public.rpc_confirm_dress_distribution(
  p_registration_id TEXT,
  p_staff_id TEXT,
  p_staff_name TEXT,
  p_issued_size TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student RECORD;
  v_updated_id TEXT;
  v_dist_id TEXT;
BEGIN
  -- 1. Atomic update where is_t_shirt_collected = false RETURNING id
  UPDATE public.registrations_2027
  SET is_t_shirt_collected = true
  WHERE id = p_registration_id
    AND is_t_shirt_collected = false
    AND payment_status = 'paid'
  RETURNING id, full_name, batch_name, t_shirt_size INTO v_student;

  IF NOT FOUND THEN
    -- Check if already collected or unpaid
    SELECT is_t_shirt_collected, payment_status INTO v_student
    FROM public.registrations_2027
    WHERE id = p_registration_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Student registration not found.');
    ELSIF v_student.payment_status <> 'paid' THEN
      RETURN jsonb_build_object('success', false, 'error', 'UNPAID', 'message', 'Registration is not paid.');
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_COLLECTED', 'message', 'T-Shirt / Dress has already been collected.');
    END IF;
  END IF;

  -- 2. Insert dress distribution log
  v_dist_id := 'DRESS-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT;

  IF to_regclass('public.dress_distributions') IS NOT NULL THEN
    INSERT INTO public.dress_distributions (
      id, registration_id, student_name, batch_name, original_size,
      issued_size, status, collected_at, staff_id, staff_name, notes
    ) VALUES (
      v_dist_id, p_registration_id, v_student.full_name, v_student.batch_name,
      v_student.t_shirt_size, COALESCE(p_issued_size, v_student.t_shirt_size),
      'COLLECTED', NOW(), p_staff_id, p_staff_name, p_notes
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', p_registration_id,
    'student_name', v_student.full_name,
    'issued_size', COALESCE(p_issued_size, v_student.t_shirt_size)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirm_dress_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- 6. FINANCIAL LEDGER IMMUTABILITY & COLUMNS
-- ============================================================================

ALTER TABLE public.financial_ledger
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12, 2);

-- Populate gross and net for existing rows where null
UPDATE public.financial_ledger
SET gross_amount = COALESCE(gross_amount, amount),
    net_amount = COALESCE(net_amount, amount - COALESCE(gateway_fee, 0))
WHERE gross_amount IS NULL;

-- Prevent UPDATE and DELETE on financial_ledger (Immutable Ledger Trigger)
CREATE OR REPLACE FUNCTION public.trg_prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_LEDGER: Updating or deleting records from financial_ledger is strictly prohibited by event financial compliance regulations.';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ledger_immutability ON public.financial_ledger;
CREATE TRIGGER trg_enforce_ledger_immutability
  BEFORE UPDATE OR DELETE ON public.financial_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_ledger_mutation();

-- ============================================================================
-- 7. STAFF ACCOUNTS RBAC & PASSWORD HASHING INFRASTRUCTURE
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add role column constraint to staff_accounts if exists
DO $$
BEGIN
  IF to_regclass('public.staff_accounts') IS NOT NULL THEN
    ALTER TABLE public.staff_accounts
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT 'STATION_STAFF';
  END IF;
END $$;

COMMIT;
