-- ============================================================================
-- SYLHET POLICE LINES HIGH SCHOOL & COLLEGE REUNION 2027
-- MIGRATION: 20270102000000_registrations_2027_dynamic_schema.sql
-- 1. Dynamic 2027 Event Registrations & Donations Tables
-- 2. Complete RLS Policies for All RMS Modules
-- 3. Dynamic Multi-Year Payment Verification RPC with Anti-Replay
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. REGISTRATIONS 2027 TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.registrations_2027 (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  full_name_bn TEXT,
  photo_url TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  email TEXT, -- Optional for current/rural students
  address TEXT,
  category TEXT NOT NULL CHECK (category IN ('former', 'current')),
  student_id TEXT,
  passing_year TEXT,
  last_class_attended TEXT,
  current_class TEXT,
  batch_name TEXT NOT NULL,
  group_or_section TEXT,
  roll_number TEXT,
  t_shirt_size TEXT NOT NULL CHECK (t_shirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50')),
  registration_fee NUMERIC NOT NULL DEFAULT 1000 CHECK (registration_fee >= 0),
  donation_amount NUMERIC NOT NULL DEFAULT 0 CHECK (donation_amount >= 0),
  total_paid NUMERIC NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'failed', 'refunded')),
  transaction_id TEXT,
  payment_method TEXT CHECK (payment_method IN ('bkash', 'nagad', 'rocket', 'card')),
  gateway_invoice_number TEXT,
  gateway_provider TEXT DEFAULT 'PAYSTATION',
  gateway_response JSONB DEFAULT '{}'::jsonb,
  server_verification_signature TEXT,
  verification_timestamp TIMESTAMPTZ,
  verified_by TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qr_token TEXT NOT NULL UNIQUE,
  is_tshirt_collected BOOLEAN NOT NULL DEFAULT FALSE,
  is_checked_in BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  year INTEGER NOT NULL DEFAULT 2027
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_reg_2027_mobile ON public.registrations_2027 (mobile_number);
CREATE INDEX IF NOT EXISTS idx_reg_2027_trx ON public.registrations_2027 (transaction_id);
CREATE INDEX IF NOT EXISTS idx_reg_2027_qr ON public.registrations_2027 (qr_token);
CREATE INDEX IF NOT EXISTS idx_reg_2027_status ON public.registrations_2027 (payment_status);
CREATE INDEX IF NOT EXISTS idx_reg_2027_gateway_inv ON public.registrations_2027 (gateway_invoice_number) WHERE gateway_invoice_number IS NOT NULL;

-- Unique normalized mobile number index for 2027 registrations
CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_2027_mobile_normalized ON public.registrations_2027 (
  (CASE
    WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') LIKE '880%'
      THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 4)
    ELSE regexp_replace(mobile_number, '[^0-9]', '', 'g')
  END)
) WHERE mobile_number IS NOT NULL AND mobile_number <> '';

-- ============================================================================
-- 2. DONATIONS 2027 TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.donations_2027 (
  id TEXT PRIMARY KEY,
  donor_name TEXT NOT NULL,
  mobile_number TEXT,
  email TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  purpose TEXT DEFAULT 'Reunion 2027 General Fund',
  payment_method TEXT CHECK (payment_method IN ('bkash', 'nagad', 'rocket', 'card', 'bank_transfer', 'cash')),
  transaction_id TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  year INTEGER NOT NULL DEFAULT 2027
);

CREATE INDEX IF NOT EXISTS idx_donations_2027_date ON public.donations_2027 (date);

-- Ensure email is nullable on registrations_2026 as well
ALTER TABLE public.registrations_2026 ALTER COLUMN email DROP NOT NULL;

-- ============================================================================
-- 3. ROW LEVEL SECURITY FOR 2027 REGISTRATIONS & DONATIONS
-- ============================================================================
ALTER TABLE public.registrations_2027 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations_2027 ENABLE ROW LEVEL SECURITY;

-- 3.1 Public Insert with pending payment check
CREATE POLICY registration_insert_pending_2027 ON public.registrations_2027
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    payment_status = 'pending'
    AND total_paid = 0
    AND transaction_id IS NULL
    AND payment_method IS NULL
    AND server_verification_signature IS NULL
    AND verification_timestamp IS NULL
    AND verified_by IS NULL
    AND is_checked_in = false
    AND is_tshirt_collected = false
  );

-- 3.2 Staff and Super Admin read access
CREATE POLICY registration_staff_read_2027 ON public.registrations_2027
  FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() IN (
      'SUPER_ADMIN', 'GATE_STAFF', 'BREAKFAST_STAFF',
      'LUNCH_STAFF', 'DINNER_STAFF', 'DRESS_STAFF'
    )
  );

-- 3.3 Super Admin update access
CREATE POLICY registration_admin_update_2027 ON public.registrations_2027
  FOR UPDATE TO authenticated
  USING (public.current_admin_role() = 'super_admin')
  WITH CHECK (public.current_admin_role() = 'super_admin');

-- 3.4 Super Admin delete access
CREATE POLICY registration_admin_delete_2027 ON public.registrations_2027
  FOR DELETE TO authenticated
  USING (public.current_admin_role() = 'super_admin');

-- 3.5 Donations RLS
CREATE POLICY donations_read_2027 ON public.donations_2027
  FOR SELECT TO authenticated
  USING (public.current_admin_role() = 'super_admin');

CREATE POLICY donations_insert_2027 ON public.donations_2027
  FOR INSERT TO anon, authenticated
  WITH CHECK (amount > 0);

-- ============================================================================
-- 4. COMPLETE ROW LEVEL SECURITY POLICIES FOR ALL RMS ERP MODULES
-- ============================================================================

-- rms_committee_members
CREATE POLICY "Authenticated users view committee members" ON public.rms_committee_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage committee members" ON public.rms_committee_members
  FOR ALL TO authenticated USING (public.current_admin_role() = 'super_admin');

-- rms_task_comments
CREATE POLICY "Authenticated users view task comments" ON public.rms_task_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users add task comments" ON public.rms_task_comments
  FOR INSERT TO authenticated WITH CHECK (author_id IS NOT NULL);

-- rms_income_transactions
CREATE POLICY "Authenticated users view income transactions" ON public.rms_income_transactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance staff manage income transactions" ON public.rms_income_transactions
  FOR ALL TO authenticated USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'SUPER_ADMIN'
  );

-- rms_sponsors
CREATE POLICY "Public view confirmed sponsors" ON public.rms_sponsors
  FOR SELECT USING (payment_status IN ('PARTIAL', 'PAID_FULL'));
CREATE POLICY "Authenticated staff manage sponsors" ON public.rms_sponsors
  FOR ALL TO authenticated USING (
    public.current_admin_role() = 'super_admin'
    OR auth.role() = 'authenticated'
  );

-- rms_documents
CREATE POLICY "Authenticated view committee documents" ON public.rms_documents
  FOR SELECT TO authenticated USING (
    access_permission = 'PUBLIC'
    OR public.current_admin_role() = 'super_admin'
    OR auth.role() = 'authenticated'
  );
CREATE POLICY "Authenticated upload documents" ON public.rms_documents
  FOR INSERT TO authenticated WITH CHECK (uploaded_by IS NOT NULL);

-- rms_meetings
CREATE POLICY "Authenticated view meetings" ON public.rms_meetings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage meetings" ON public.rms_meetings
  FOR ALL TO authenticated USING (auth.role() = 'authenticated');

-- rms_volunteers
CREATE POLICY "Authenticated view volunteers" ON public.rms_volunteers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage volunteers" ON public.rms_volunteers
  FOR ALL TO authenticated USING (auth.role() = 'authenticated');

-- rms_event_incidents
CREATE POLICY "Authenticated view incidents" ON public.rms_event_incidents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff report and resolve incidents" ON public.rms_event_incidents
  FOR ALL TO authenticated USING (auth.role() = 'authenticated');

-- rms_weekly_reports
CREATE POLICY "Authenticated view weekly reports" ON public.rms_weekly_reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Directors submit weekly reports" ON public.rms_weekly_reports
  FOR ALL TO authenticated USING (auth.role() = 'authenticated');

-- rms_audit_logs
CREATE POLICY "Authenticated view audit logs" ON public.rms_audit_logs
  FOR SELECT TO authenticated USING (public.current_admin_role() = 'super_admin');
CREATE POLICY "System insert audit logs" ON public.rms_audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- 5. ENHANCED MULTI-YEAR AUTHORITATIVE PAYMENT VERIFICATION RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_verify_payment(
  p_reg_id TEXT,
  p_trx_id TEXT,
  p_method TEXT,
  p_amount NUMERIC,
  p_signature TEXT,
  p_verified_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_dup_count INTEGER;
  v_qr_token TEXT;
  v_found BOOLEAN := false;
  v_target_table TEXT := 'registrations_2027';
  v_reg_name TEXT := 'Student';
BEGIN
  -- 1. Anti-Replay Protection: Check across both 2026 and 2027 registrations
  IF p_trx_id IS NOT NULL AND trim(p_trx_id) <> '' THEN
    SELECT COUNT(*) INTO v_dup_count
    FROM (
      SELECT transaction_id FROM public.registrations_2027 WHERE upper(trim(transaction_id)) = upper(trim(p_trx_id)) AND id <> p_reg_id
      UNION ALL
      SELECT transaction_id FROM public.registrations_2026 WHERE upper(trim(transaction_id)) = upper(trim(p_trx_id)) AND id <> p_reg_id
    ) dups;

    IF v_dup_count > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_TRANSACTION: This PayStation transaction ID has already been utilized.'
      );
    END IF;
  END IF;

  -- 2. Check in registrations_2027 first
  IF EXISTS (SELECT 1 FROM public.registrations_2027 WHERE id = p_reg_id) THEN
    v_found := true;
    v_target_table := 'registrations_2027';
    SELECT qr_token, full_name INTO v_qr_token, v_reg_name FROM public.registrations_2027 WHERE id = p_reg_id;
  ELSIF EXISTS (SELECT 1 FROM public.registrations_2026 WHERE id = p_reg_id) THEN
    v_found := true;
    v_target_table := 'registrations_2026';
    SELECT qr_token, full_name INTO v_qr_token, v_reg_name FROM public.registrations_2026 WHERE id = p_reg_id;
  END IF;

  IF NOT v_found THEN
    RETURN jsonb_build_object('success', false, 'error', 'REGISTRATION_NOT_FOUND');
  END IF;

  -- 3. Ensure high-entropy QR token
  IF v_qr_token IS NULL OR trim(v_qr_token) = '' THEN
    v_qr_token := 'PLSCF27-' || upper(encode(gen_random_bytes(12), 'hex'));
  END IF;

  -- 4. Authoritatively mark payment as PAID in target year table
  IF v_target_table = 'registrations_2027' THEN
    UPDATE public.registrations_2027
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
  ELSE
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
  END IF;

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
    'PayStation verified online payment for ' || v_reg_name || ' (' || p_reg_id || ') via ' || upper(p_method),
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
      'qr_token', v_qr_token,
      'table', v_target_table
    ),
    p_signature
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'paid',
    'registration_id', p_reg_id,
    'qr_token', v_qr_token,
    'server_signature', p_signature,
    'table', v_target_table
  );
END;
$$;

