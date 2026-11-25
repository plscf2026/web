-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR — GRAND REUNION 2027
-- MIGRATION: 20270309000000_manual_registrations_separate_db_and_qr_security.sql
--
-- Dedicated Manual Registration Database, Payment Verification, Approval-Based
-- Synchronization to Main Registration Database (registrations_2027),
-- Staff Field-Level Authorization, Audit Trail, and Backend QR Enforcement.
-- ============================================================================

-- 1. ENSURE registrations_2027 ACCEPTS MANUAL PAYMENT METHODS & STATUSES
ALTER TABLE public.registrations_2027
  DROP CONSTRAINT IF EXISTS registrations_2027_payment_method_check;
ALTER TABLE public.registrations_2027
  ADD CONSTRAINT registrations_2027_payment_method_check
  CHECK (payment_method IS NULL OR lower(payment_method) = ANY (ARRAY[
    'bkash'::text,
    'nagad'::text,
    'rocket'::text,
    'card'::text,
    'amex'::text,
    'cash'::text,
    'bank_transfer'::text,
    'bank transfer'::text,
    'manual'::text,
    'other'::text
  ]));

ALTER TABLE public.registrations_2027
  DROP CONSTRAINT IF EXISTS registrations_2027_payment_status_check;
ALTER TABLE public.registrations_2027
  ADD CONSTRAINT registrations_2027_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'paid'::text,
    'pending'::text,
    'failed'::text,
    'refunded'::text,
    'paid_duplicate'::text,
    'rejected'::text
  ]));

-- 2. CREATE DEDICATED MANUAL REGISTRATIONS DATABASE TABLE
CREATE TABLE IF NOT EXISTS public.manual_registrations (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  full_name_bn TEXT,
  photo_url TEXT NOT NULL DEFAULT '',
  photo_storage_path TEXT,
  mobile_number TEXT NOT NULL,
  email TEXT,
  address TEXT DEFAULT 'Faridpur',
  category TEXT NOT NULL CHECK (category IN ('former', 'current')),
  student_id TEXT,
  passing_year TEXT,
  last_class_attended TEXT,
  current_class TEXT,
  batch_name TEXT NOT NULL,
  group_or_section TEXT,
  roll_number TEXT,
  t_shirt_size TEXT NOT NULL DEFAULT 'L',
  gender TEXT DEFAULT 'male',
  blood_group TEXT,
  has_parent BOOLEAN NOT NULL DEFAULT FALSE,
  parent_name TEXT,
  parent_age TEXT,
  parent_phone TEXT,
  parent_relation TEXT,
  parent_photo_url TEXT,
  parent_photo_storage_path TEXT,
  parent_fee NUMERIC NOT NULL DEFAULT 0,
  registration_fee NUMERIC NOT NULL DEFAULT 1500,
  donation_amount NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'rejected', 'failed', 'refunded')),
  payment_method TEXT DEFAULT 'cash',
  transaction_id TEXT,
  qr_token TEXT NOT NULL UNIQUE,
  notes TEXT,
  year INTEGER NOT NULL DEFAULT 2027,

  -- Manual Registration Ownership & Approval Workflow
  is_manual_registration BOOLEAN NOT NULL DEFAULT TRUE,
  registration_type TEXT NOT NULL DEFAULT 'manual_venue',
  registration_approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (registration_approval_status IN ('pending', 'approved', 'rejected')),
  approval_notes TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by_admin_id TEXT NOT NULL,
  created_by_admin_name TEXT NOT NULL,

  -- Manual Payment Submission & Verification
  financial_amount NUMERIC NOT NULL DEFAULT 0,
  financial_description TEXT,
  financial_method TEXT DEFAULT 'Cash',
  financial_reference TEXT,
  financial_notes TEXT,
  financial_approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (financial_approval_status IN ('none', 'pending', 'approved', 'rejected')),
  financial_approved_by TEXT,
  financial_approved_at TIMESTAMPTZ,
  financial_rejected_by TEXT,
  financial_rejected_at TIMESTAMPTZ,
  document_url TEXT,
  document_name TEXT,

  -- Main Database Sync Tracking
  synced_to_main_at TIMESTAMPTZ,
  main_registration_id TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_reg_staff_id ON public.manual_registrations (created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_manual_reg_status ON public.manual_registrations (registration_approval_status, financial_approval_status);
CREATE INDEX IF NOT EXISTS idx_manual_reg_qr_token ON public.manual_registrations (qr_token);
CREATE INDEX IF NOT EXISTS idx_manual_reg_student_id ON public.manual_registrations (student_id);
CREATE INDEX IF NOT EXISTS idx_manual_reg_mobile ON public.manual_registrations (mobile_number);
CREATE INDEX IF NOT EXISTS idx_manual_reg_trx ON public.manual_registrations (financial_reference);

-- 3. IMMUTABLE AUDIT LOGS FOR MANUAL REGISTRATIONS
CREATE TABLE IF NOT EXISTS public.manual_registration_audit_logs (
  id TEXT PRIMARY KEY DEFAULT ('MAUD-' || substr(gen_random_uuid()::text, 1, 10)),
  registration_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'staff',
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  previous_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_audit_reg_id ON public.manual_registration_audit_logs (registration_id, created_at DESC);

-- 4. ROW LEVEL SECURITY & REALTIME
ALTER TABLE public.manual_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_registration_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_registrations_select_all" ON public.manual_registrations;
CREATE POLICY "manual_registrations_select_all"
  ON public.manual_registrations FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "manual_registrations_write_all" ON public.manual_registrations;
CREATE POLICY "manual_registrations_write_all"
  ON public.manual_registrations FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "manual_reg_audit_select_all" ON public.manual_registration_audit_logs;
CREATE POLICY "manual_reg_audit_select_all"
  ON public.manual_registration_audit_logs FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "manual_reg_audit_insert_all" ON public.manual_registration_audit_logs;
CREATE POLICY "manual_reg_audit_insert_all"
  ON public.manual_registration_audit_logs FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.manual_registrations TO anon, authenticated, service_role;
GRANT ALL ON public.manual_registration_audit_logs TO anon, authenticated, service_role;

ALTER TABLE public.manual_registrations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_registrations;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;

-- 5. MIGRATE EXISTING MANUAL RECORDS CLEANLY:
-- Copy all historical manual registrations into manual_registrations (retain ownership/audit),
-- and remove any unapproved (pending/rejected) manual rows from registrations_2027 so
-- registrations_2027 remains strictly the single source of truth for approved registrations.
INSERT INTO public.manual_registrations (
  id, full_name, full_name_bn, photo_url, photo_storage_path, mobile_number, email, address,
  category, student_id, passing_year, last_class_attended, current_class, batch_name,
  group_or_section, roll_number, t_shirt_size, gender, blood_group,
  has_parent, parent_name, parent_age, parent_phone, parent_relation, parent_photo_url, parent_photo_storage_path, parent_fee,
  registration_fee, donation_amount, total_paid, payment_status, payment_method, transaction_id, qr_token, notes, year,
  is_manual_registration, registration_type, registration_approval_status, approval_notes, approved_by, approved_at,
  rejected_by, rejected_at, rejection_reason, created_by_admin_id, created_by_admin_name,
  financial_amount, financial_description, financial_method, financial_reference, financial_notes,
  financial_approval_status, financial_approved_by, financial_approved_at, financial_rejected_by, financial_rejected_at,
  document_url, document_name, synced_to_main_at, main_registration_id, registered_at
)
SELECT
  id, full_name, full_name_bn, COALESCE(photo_url, ''), photo_storage_path, mobile_number, email, COALESCE(address, 'Faridpur'),
  category, student_id, passing_year, last_class_attended, current_class, batch_name,
  group_or_section, roll_number, COALESCE(t_shirt_size, 'L'), COALESCE(gender, 'male'), blood_group,
  COALESCE(has_parent, false), parent_name, parent_age::text, parent_phone, parent_relation, parent_photo_url, parent_photo_storage_path, COALESCE(parent_fee, 0),
  COALESCE(registration_fee, 1500), COALESCE(donation_amount, 0), COALESCE(total_paid, 0),
  CASE WHEN payment_status IN ('pending', 'paid', 'rejected', 'failed', 'refunded') THEN payment_status ELSE 'pending' END,
  COALESCE(payment_method, 'cash'), transaction_id, qr_token, notes, COALESCE(year, 2027),
  TRUE, COALESCE(registration_type, 'manual_venue'),
  CASE WHEN registration_approval_status IN ('pending', 'approved', 'rejected') THEN registration_approval_status ELSE 'pending' END,
  approval_notes, approved_by, approved_at,
  rejected_by, rejected_at, rejection_reason,
  COALESCE(created_by_admin_id, 'VENUE_DESK'), COALESCE(created_by_admin_name, 'Venue Desk Staff'),
  COALESCE(financial_amount, 0), financial_description, COALESCE(financial_method, 'Cash'), financial_reference, financial_notes,
  CASE WHEN financial_approval_status IN ('none', 'pending', 'approved', 'rejected') THEN financial_approval_status ELSE 'pending' END,
  financial_approved_by, financial_approved_at, financial_rejected_by, financial_rejected_at,
  document_url, document_name,
  CASE WHEN registration_approval_status = 'approved' THEN COALESCE(approved_at, registered_at, now()) ELSE NULL END,
  CASE WHEN registration_approval_status = 'approved' THEN id ELSE NULL END,
  COALESCE(registered_at, now())
FROM public.registrations_2027
WHERE is_manual_registration IS TRUE
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.registrations_2027
WHERE is_manual_registration IS TRUE
  AND COALESCE(registration_approval_status, 'pending') <> 'approved';

-- 6. RPC: rpc_create_manual_registration (Saves ONLY to manual_registrations; NEVER to registrations_2027)
CREATE OR REPLACE FUNCTION public.rpc_create_manual_registration(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_id text;
  v_qr_token text;
  v_student_id text := trim(upper(COALESCE(p_data->>'student_id', '')));
  v_mobile text := regexp_replace(trim(COALESCE(p_data->>'mobile_number', '')), '\D', '', 'g');
  v_full_name text := trim(COALESCE(p_data->>'full_name', ''));
  v_financial_amount numeric := GREATEST(0, COALESCE((p_data->>'financial_amount')::numeric, 0));
  v_financial_method text := trim(COALESCE(p_data->>'financial_method', 'Cash'));
  v_financial_ref text := trim(COALESCE(p_data->>'financial_reference', ''));
  v_fin_status text := 'pending';
  v_pay_method_norm text;
  v_staff_id text := COALESCE(NULLIF(trim(COALESCE(p_data->>'created_by_admin_id', '')), ''), 'VENUE_DESK');
  v_staff_name text := COALESCE(NULLIF(trim(COALESCE(p_data->>'created_by_admin_name', '')), ''), 'Registration Desk Staff');
BEGIN
  IF v_full_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student Full Name is required.');
  END IF;

  IF length(v_mobile) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A valid 11-digit Bangladeshi mobile number is required.');
  END IF;

  -- Normalize Bangladeshi mobile (strip 88 prefix if present)
  IF v_mobile LIKE '880%' THEN
    v_mobile := '0' || substr(v_mobile, 4);
  ELSIF length(v_mobile) = 10 AND v_mobile LIKE '1%' THEN
    v_mobile := '0' || v_mobile;
  END IF;

  -- Validate manual payment method rules
  IF lower(v_financial_method) = 'cash' THEN
    IF v_financial_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cash amount received must be greater than 0.');
    END IF;
  ELSIF lower(v_financial_method) IN ('bkash', 'bank transfer', 'bank_transfer') THEN
    IF v_financial_ref = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Transaction ID or Payment Token ID is mandatory for ' || v_financial_method || '.');
    END IF;
  END IF;

  IF v_financial_amount > 0 THEN
    v_fin_status := 'pending';
  ELSE
    v_fin_status := 'pending';
  END IF;

  -- Check duplicates across BOTH registrations_2027 AND manual_registrations
  IF v_student_id <> '' THEN
    IF EXISTS (SELECT 1 FROM public.registrations_2027 WHERE upper(student_id) = v_student_id)
       OR EXISTS (SELECT 1 FROM public.manual_registrations WHERE upper(student_id) = v_student_id AND registration_approval_status <> 'rejected') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_STUDENT_ID: Student ID ' || v_student_id || ' is already registered.'
      );
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.registrations_2027 WHERE mobile_number = v_mobile)
     OR EXISTS (SELECT 1 FROM public.manual_registrations WHERE mobile_number = v_mobile AND registration_approval_status <> 'rejected') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_MOBILE: Mobile number ' || v_mobile || ' is already registered.'
    );
  END IF;

  v_id := COALESCE(
    NULLIF(trim(COALESCE(p_data->>'id', '')), ''),
    'PLSCF-2027-' || CASE WHEN p_data->>'category' = 'current' THEN 'C' ELSE 'F' END || (floor(random() * 9000 + 1000))::text
  );
  v_qr_token := COALESCE(
    NULLIF(trim(COALESCE(p_data->>'qr_token', '')), ''),
    upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6))
  );

  v_pay_method_norm := CASE
    WHEN lower(v_financial_method) IN ('bank transfer', 'bank_transfer') THEN 'bank_transfer'
    WHEN lower(v_financial_method) = 'bkash' THEN 'bkash'
    ELSE 'cash'
  END;

  INSERT INTO public.manual_registrations (
    id, full_name, full_name_bn, photo_url, photo_storage_path, mobile_number, email, address,
    category, student_id, passing_year, last_class_attended, current_class, batch_name,
    group_or_section, roll_number, t_shirt_size, gender, blood_group,
    has_parent, parent_name, parent_age, parent_phone, parent_relation, parent_photo_url, parent_photo_storage_path, parent_fee,
    registration_fee, donation_amount, total_paid, payment_status, payment_method, transaction_id, qr_token, notes, year,
    is_manual_registration, registration_type, registration_approval_status,
    created_by_admin_id, created_by_admin_name,
    financial_amount, financial_description, financial_method, financial_reference, financial_notes, financial_approval_status,
    document_url, document_name, registered_at, updated_at
  ) VALUES (
    v_id,
    v_full_name,
    p_data->>'full_name_bn',
    COALESCE(p_data->>'photo_url', ''),
    p_data->>'photo_storage_path',
    v_mobile,
    NULLIF(trim(COALESCE(p_data->>'email', '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_data->>'address', '')), ''), 'Faridpur'),
    COALESCE(p_data->>'category', 'former'),
    NULLIF(v_student_id, ''),
    p_data->>'passing_year',
    p_data->>'last_class_attended',
    p_data->>'current_class',
    COALESCE(NULLIF(trim(COALESCE(p_data->>'batch_name', '')), ''), 'General'),
    p_data->>'group_or_section',
    p_data->>'roll_number',
    COALESCE(p_data->>'t_shirt_size', 'L'),
    COALESCE(p_data->>'gender', 'male'),
    p_data->>'blood_group',
    COALESCE((p_data->>'has_parent')::boolean, false),
    p_data->>'parent_name',
    p_data->>'parent_age',
    p_data->>'parent_phone',
    p_data->>'parent_relation',
    p_data->>'parent_photo_url',
    p_data->>'parent_photo_storage_path',
    COALESCE((p_data->>'parent_fee')::numeric, 0),
    COALESCE((p_data->>'registration_fee')::numeric, CASE WHEN p_data->>'category' = 'current' THEN 500 ELSE 1500 END),
    0,
    0,
    'pending',
    v_pay_method_norm,
    NULLIF(v_financial_ref, ''),
    v_qr_token,
    p_data->>'notes',
    2027,
    TRUE,
    COALESCE(p_data->>'registration_type', 'manual_venue'),
    'pending',
    v_staff_id,
    v_staff_name,
    v_financial_amount,
    p_data->>'financial_description',
    v_financial_method,
    NULLIF(v_financial_ref, ''),
    p_data->>'financial_notes',
    v_fin_status,
    p_data->>'document_url',
    p_data->>'document_name',
    now(),
    now()
  );

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details, new_data
  ) VALUES (
    v_id, v_staff_id, v_staff_name, 'registration_officer', 'CREATE_MANUAL_REGISTRATION',
    'Manual registration submitted by ' || v_staff_name || ' (' || v_staff_id || '). Status: pending approval. Payment: ' || v_financial_method || ' BDT ' || v_financial_amount,
    p_data
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'qr_token', v_qr_token,
    'registration_approval_status', 'pending',
    'financial_approval_status', v_fin_status,
    'payment_status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_manual_registration(jsonb) TO anon, authenticated, service_role;

-- 7. RPC: rpc_staff_update_manual_registration
-- Enforces strict backend ownership & field-level authorization (ONLY Name & Mobile editable by desk staff)
CREATE OR REPLACE FUNCTION public.rpc_staff_update_manual_registration(
  p_registration_id text,
  p_staff_id text,
  p_staff_role text,
  p_full_name text,
  p_mobile_number text,
  p_full_name_bn text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
  v_rec record;
  v_clean_name text := trim(COALESCE(p_full_name, ''));
  v_clean_mobile text := regexp_replace(trim(COALESCE(p_mobile_number, '')), '\D', '', 'g');
  v_is_super boolean := (lower(trim(COALESCE(p_staff_role, ''))) = 'super_admin');
BEGIN
  IF v_clean_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student full name cannot be empty.');
  END IF;

  IF v_clean_mobile LIKE '880%' THEN
    v_clean_mobile := '0' || substr(v_clean_mobile, 4);
  ELSIF length(v_clean_mobile) = 10 AND v_clean_mobile LIKE '1%' THEN
    v_clean_mobile := '0' || v_clean_mobile;
  END IF;

  IF v_clean_mobile !~ '^01[3-9]\d{8}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid 11-digit Bangladeshi mobile number.');
  END IF;

  SELECT * INTO v_rec
  FROM public.manual_registrations
  WHERE upper(id) = v_clean_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration record not found.');
  END IF;

  -- Ownership check: Staff can ONLY edit their own records
  IF NOT v_is_super AND COALESCE(v_rec.created_by_admin_id, '') <> COALESCE(p_staff_id, '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED_OWNERSHIP: You can only edit registrations you personally created.'
    );
  END IF;

  -- Protected financial & approval fields remain untouched
  UPDATE public.manual_registrations
  SET
    full_name = v_clean_name,
    full_name_bn = COALESCE(NULLIF(trim(COALESCE(p_full_name_bn, '')), ''), full_name_bn),
    mobile_number = v_clean_mobile,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  -- If already approved & synced to main registrations_2027, keep name/mobile synchronized
  UPDATE public.registrations_2027
  SET
    full_name = v_clean_name,
    full_name_bn = COALESCE(NULLIF(trim(COALESCE(p_full_name_bn, '')), ''), full_name_bn),
    mobile_number = v_clean_mobile
  WHERE upper(id) = v_clean_id;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details, previous_data, new_data
  ) VALUES (
    v_clean_id,
    COALESCE(p_staff_id, 'STAFF'),
    COALESCE(v_rec.created_by_admin_name, 'Staff'),
    COALESCE(p_staff_role, 'registration_officer'),
    'STAFF_EDIT_CONTACT_ONLY',
    'Updated allowed contact fields only (full_name, mobile_number). Financial & approval fields protected.',
    jsonb_build_object('full_name', v_rec.full_name, 'mobile_number', v_rec.mobile_number),
    jsonb_build_object('full_name', v_clean_name, 'mobile_number', v_clean_mobile)
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_clean_id,
    'full_name', v_clean_name,
    'mobile_number', v_clean_mobile
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_staff_update_manual_registration(text, text, text, text, text, text) TO anon, authenticated, service_role;

-- 8. RPC: rpc_approve_manual_registration
-- Approves registration (and optionally verifies payment), idempotently transfers to registrations_2027,
-- activates QR code, and preserves audit history.
CREATE OR REPLACE FUNCTION public.rpc_approve_manual_registration(
  p_registration_id text,
  p_admin_name text,
  p_notes text DEFAULT '',
  p_approve_payment boolean DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
  v_rec public.manual_registrations%ROWTYPE;
  v_paid_amt numeric;
  v_fin_status text;
  v_pay_status text;
BEGIN
  SELECT * INTO v_rec
  FROM public.manual_registrations
  WHERE upper(id) = v_clean_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration not found: ' || p_registration_id);
  END IF;

  IF p_approve_payment THEN
    v_fin_status := CASE WHEN COALESCE(v_rec.financial_amount, 0) > 0 THEN 'approved' ELSE 'approved' END;
    v_paid_amt := CASE
      WHEN COALESCE(v_rec.financial_amount, 0) > 0 THEN v_rec.financial_amount
      WHEN COALESCE(v_rec.registration_fee, 0) > 0 THEN v_rec.registration_fee
      WHEN v_rec.category = 'current' THEN 500
      ELSE 1500
    END;
    v_pay_status := 'paid';
  ELSE
    v_fin_status := v_rec.financial_approval_status;
    v_paid_amt := CASE
      WHEN v_rec.financial_approval_status = 'approved' THEN COALESCE(v_rec.financial_amount, v_rec.registration_fee, 0)
      WHEN COALESCE(v_rec.financial_amount, 0) = 0 THEN COALESCE(v_rec.registration_fee, 500)
      ELSE 0
    END;
    v_pay_status := CASE WHEN v_fin_status IN ('pending', 'rejected') AND COALESCE(v_rec.financial_amount, 0) > 0 THEN 'pending' ELSE 'paid' END;
  END IF;

  UPDATE public.manual_registrations
  SET
    registration_approval_status = 'approved',
    payment_status = v_pay_status,
    total_paid = v_paid_amt,
    financial_approval_status = v_fin_status,
    financial_approved_by = CASE WHEN p_approve_payment THEN COALESCE(financial_approved_by, p_admin_name) ELSE financial_approved_by END,
    financial_approved_at = CASE WHEN p_approve_payment THEN COALESCE(financial_approved_at, now()) ELSE financial_approved_at END,
    approved_by = p_admin_name,
    approved_at = COALESCE(approved_at, now()),
    approval_notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
    synced_to_main_at = now(),
    main_registration_id = v_rec.id,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  -- Idempotent synchronization / transfer into main registrations_2027 table (single source of truth)
  INSERT INTO public.registrations_2027 (
    id, full_name, full_name_bn, photo_url, photo_storage_path, mobile_number, email, address,
    category, student_id, passing_year, last_class_attended, current_class, batch_name,
    group_or_section, roll_number, t_shirt_size, gender, blood_group,
    has_parent, parent_name, parent_age, parent_phone, parent_relation, parent_photo_url, parent_photo_storage_path, parent_fee,
    registration_fee, donation_amount, total_paid, payment_status, transaction_id, payment_method,
    verified_by, verification_timestamp, registered_at, qr_token, notes, year,
    is_manual_registration, registration_type, registration_approval_status, approval_notes, approved_by, approved_at,
    created_by_admin_id, created_by_admin_name,
    financial_amount, financial_description, financial_method, financial_reference, financial_notes,
    financial_approval_status, financial_approved_by, financial_approved_at,
    document_url, document_name
  ) VALUES (
    v_rec.id, v_rec.full_name, v_rec.full_name_bn, COALESCE(v_rec.photo_url, ''), v_rec.photo_storage_path,
    v_rec.mobile_number, v_rec.email, COALESCE(v_rec.address, 'Faridpur'),
    v_rec.category, v_rec.student_id, v_rec.passing_year, v_rec.last_class_attended, v_rec.current_class, v_rec.batch_name,
    v_rec.group_or_section, v_rec.roll_number, COALESCE(v_rec.t_shirt_size, 'L'), COALESCE(v_rec.gender, 'male'), v_rec.blood_group,
    COALESCE(v_rec.has_parent, false), v_rec.parent_name,
    CASE WHEN v_rec.parent_age ~ '^\d+$' THEN v_rec.parent_age::integer ELSE NULL END,
    v_rec.parent_phone, v_rec.parent_relation, v_rec.parent_photo_url, v_rec.parent_photo_storage_path, COALESCE(v_rec.parent_fee, 0),
    COALESCE(v_rec.registration_fee, 1500), 0, v_paid_amt, v_pay_status,
    COALESCE(v_rec.financial_reference, v_rec.transaction_id, 'MANUAL-' || v_rec.id),
    COALESCE(v_rec.payment_method, 'cash'),
    p_admin_name, now(), COALESCE(v_rec.registered_at, now()), v_rec.qr_token, v_rec.notes, COALESCE(v_rec.year, 2027),
    TRUE, COALESCE(v_rec.registration_type, 'manual_venue'), 'approved', NULLIF(trim(COALESCE(p_notes, '')), ''), p_admin_name, now(),
    v_rec.created_by_admin_id, v_rec.created_by_admin_name,
    COALESCE(v_rec.financial_amount, 0), v_rec.financial_description, v_rec.financial_method, v_rec.financial_reference, v_rec.financial_notes,
    v_fin_status, CASE WHEN p_approve_payment THEN p_admin_name ELSE v_rec.financial_approved_by END,
    CASE WHEN p_approve_payment THEN now() ELSE v_rec.financial_approved_at END,
    v_rec.document_url, v_rec.document_name
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    full_name_bn = EXCLUDED.full_name_bn,
    photo_url = EXCLUDED.photo_url,
    photo_storage_path = EXCLUDED.photo_storage_path,
    mobile_number = EXCLUDED.mobile_number,
    registration_approval_status = 'approved',
    payment_status = EXCLUDED.payment_status,
    total_paid = EXCLUDED.total_paid,
    financial_approval_status = EXCLUDED.financial_approval_status,
    financial_approved_by = EXCLUDED.financial_approved_by,
    financial_approved_at = EXCLUDED.financial_approved_at,
    approved_by = EXCLUDED.approved_by,
    approved_at = EXCLUDED.approved_at,
    approval_notes = EXCLUDED.approval_notes;

  -- Mark current_student_ids as registered if applicable
  IF v_rec.category = 'current' AND COALESCE(v_rec.student_id, '') <> '' THEN
    BEGIN
      UPDATE public.current_student_ids
      SET
        registration_status = 'REGISTERED',
        registered_by_reg_id = v_rec.id,
        updated_at = now()
      WHERE upper(student_id) = upper(v_rec.student_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Record financial ledger & transaction idempotently if paid
  IF p_approve_payment AND v_paid_amt > 0 THEN
    BEGIN
      INSERT INTO public.financial_transactions (
        id, transaction_type, source_type, reference_id, amount, payment_method,
        gateway_trx_id, description, transaction_date, created_by
      ) VALUES (
        'FTX-MAN-' || v_rec.id, 'income', 'registration_fee', v_rec.id, v_paid_amt,
        COALESCE(v_rec.financial_method, 'Cash'), v_rec.financial_reference,
        'Manual registration payment approved for ' || v_rec.full_name || ' (' || v_rec.id || ')',
        CURRENT_DATE, p_admin_name
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details
  ) VALUES (
    v_clean_id, 'SUPER_ADMIN', p_admin_name, 'super_admin', 'APPROVE_AND_SYNC_TO_MAIN',
    'Approved by Super Admin ' || p_admin_name || '. Transferred to registrations_2027 & QR activated. Payment approved: ' || p_approve_payment::text || ', Total Paid: BDT ' || v_paid_amt
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_clean_id,
    'status', 'approved',
    'payment_status', v_pay_status,
    'financial_approval_status', v_fin_status,
    'total_paid', v_paid_amt
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_registration(text, text, text, boolean) TO anon, authenticated, service_role;

-- 9. RPC: rpc_reject_manual_registration
CREATE OR REPLACE FUNCTION public.rpc_reject_manual_registration(
  p_registration_id text,
  p_admin_name text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
BEGIN
  UPDATE public.manual_registrations
  SET
    registration_approval_status = 'rejected',
    payment_status = 'rejected',
    rejected_by = p_admin_name,
    rejected_at = now(),
    rejection_reason = p_reason,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration not found: ' || p_registration_id);
  END IF;

  -- Ensure rejected manual registrations are never active in registrations_2027
  DELETE FROM public.registrations_2027
  WHERE upper(id) = v_clean_id AND is_manual_registration IS TRUE;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details
  ) VALUES (
    v_clean_id, 'SUPER_ADMIN', p_admin_name, 'super_admin', 'REJECT_MANUAL_REGISTRATION',
    'Rejected by Super Admin ' || p_admin_name || '. Reason: ' || COALESCE(p_reason, '')
  );

  RETURN jsonb_build_object('success', true, 'id', v_clean_id, 'status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_registration(text, text, text) TO anon, authenticated, service_role;

-- 10. RPC: rpc_approve_manual_financial & rpc_reject_manual_financial
CREATE OR REPLACE FUNCTION public.rpc_approve_manual_financial(
  p_registration_id text,
  p_admin_name text,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
  v_rec public.manual_registrations%ROWTYPE;
  v_amt numeric;
BEGIN
  SELECT * INTO v_rec FROM public.manual_registrations WHERE upper(id) = v_clean_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration not found: ' || p_registration_id);
  END IF;

  v_amt := GREATEST(0, COALESCE(v_rec.financial_amount, v_rec.registration_fee, 0));

  UPDATE public.manual_registrations
  SET
    financial_approval_status = 'approved',
    financial_approved_by = p_admin_name,
    financial_approved_at = now(),
    payment_status = 'paid',
    total_paid = v_amt,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  UPDATE public.registrations_2027
  SET
    financial_approval_status = 'approved',
    financial_approved_by = p_admin_name,
    financial_approved_at = now(),
    payment_status = 'paid',
    total_paid = v_amt
  WHERE upper(id) = v_clean_id;

  BEGIN
    INSERT INTO public.financial_transactions (
      id, transaction_type, source_type, reference_id, amount, payment_method,
      gateway_trx_id, description, transaction_date, created_by
    ) VALUES (
      'FTX-MAN-' || v_rec.id, 'income', 'registration_fee', v_rec.id, v_amt,
      COALESCE(v_rec.financial_method, 'Cash'), v_rec.financial_reference,
      'Manual registration payment approved for ' || v_rec.full_name || ' (' || v_rec.id || ')',
      CURRENT_DATE, p_admin_name
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details
  ) VALUES (
    v_clean_id, 'SUPER_ADMIN', p_admin_name, 'super_admin', 'APPROVE_MANUAL_PAYMENT',
    'Payment BDT ' || v_amt || ' verified & approved by ' || p_admin_name || '. ' || COALESCE(p_notes, '')
  );

  RETURN jsonb_build_object('success', true, 'id', v_clean_id, 'financial_approval_status', 'approved', 'total_paid', v_amt);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_financial(text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_reject_manual_financial(
  p_registration_id text,
  p_admin_name text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id text := upper(trim(COALESCE(p_registration_id, '')));
BEGIN
  UPDATE public.manual_registrations
  SET
    financial_approval_status = 'rejected',
    financial_rejected_by = p_admin_name,
    financial_rejected_at = now(),
    total_paid = 0,
    updated_at = now()
  WHERE upper(id) = v_clean_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual registration not found: ' || p_registration_id);
  END IF;

  UPDATE public.registrations_2027
  SET
    financial_approval_status = 'rejected',
    financial_rejected_by = p_admin_name,
    financial_rejected_at = now(),
    total_paid = 0
  WHERE upper(id) = v_clean_id;

  INSERT INTO public.manual_registration_audit_logs (
    registration_id, actor_id, actor_name, actor_role, action, details
  ) VALUES (
    v_clean_id, 'SUPER_ADMIN', p_admin_name, 'super_admin', 'REJECT_MANUAL_PAYMENT',
    'Payment rejected by ' || p_admin_name || '. Reason: ' || COALESCE(p_reason, '')
  );

  RETURN jsonb_build_object('success', true, 'id', v_clean_id, 'financial_approval_status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_financial(text, text, text) TO anon, authenticated, service_role;

-- 11. AUTHORITATIVE rpc_verify_student_qr:
-- Checks registrations_2027 (approved normal + approved manual) AND manual_registrations (unapproved).
-- Strictly returns "ID Card Not Approved by Admin" if found pending/rejected in manual_registrations.
CREATE OR REPLACE FUNCTION public.rpc_verify_student_qr(
  p_identifier text,
  p_token text DEFAULT NULL,
  p_staff_id text DEFAULT 'SCANNER_DESK'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_raw_id text := upper(trim(COALESCE(p_identifier, '')));
  v_raw_token text := upper(trim(COALESCE(p_token, '')));
  v_is_guardian_pass boolean := false;
  v_clean_id text;
  v_clean_token text;
  v_student record;
  v_manual record;
  v_last_event_type text;
  v_live_gate_status text;
  v_live_is_inside boolean;
BEGIN
  IF v_raw_id LIKE 'PAR-%' OR v_raw_token LIKE 'P-%' THEN
    v_is_guardian_pass := true;
  END IF;

  v_clean_id := regexp_replace(v_raw_id, '^PAR-', '', 'i');
  v_clean_token := regexp_replace(v_raw_token, '^P-', '', 'i');

  -- 1. Check authoritative Main Registration database (registrations_2027)
  SELECT * INTO v_student
  FROM public.registrations_2027
  WHERE upper(id) = v_clean_id
     OR upper(id) = v_raw_id
     OR (v_clean_token <> '' AND upper(qr_token) = v_clean_token)
     OR (v_raw_token <> '' AND upper(qr_token) = v_raw_token)
     OR upper(qr_token) = v_clean_id
     OR (v_clean_id <> '' AND upper(id) LIKE '%' || v_clean_id || '%')
  LIMIT 1;

  -- 2. If not in main DB (or if unapproved), check dedicated manual_registrations DB
  IF NOT FOUND THEN
    SELECT * INTO v_manual
    FROM public.manual_registrations
    WHERE upper(id) = v_clean_id
       OR upper(id) = v_raw_id
       OR (v_clean_token <> '' AND upper(qr_token) = v_clean_token)
       OR (v_raw_token <> '' AND upper(qr_token) = v_raw_token)
       OR upper(qr_token) = v_clean_id
    LIMIT 1;

    IF FOUND THEN
      IF v_manual.registration_approval_status = 'rejected' THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REGISTRATION_REJECTED',
          'error', 'ID Card Not Approved by Admin: Registration has been rejected by Super Admin.'
        );
      END IF;
      RETURN jsonb_build_object(
        'success', false,
        'status', 'PENDING_APPROVAL',
        'error', 'ID Card Not Approved by Admin: Pending Super Admin approval & payment verification.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'status', 'NOT_FOUND',
      'error', 'Student ticket not found in database.'
    );
  END IF;

  IF v_is_guardian_pass AND (v_student.has_parent IS NOT TRUE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'GUARDIAN_NOT_REGISTERED',
      'error', 'Parent/Guardian pass not registered for this student (' || v_student.id || ').'
    );
  END IF;

  IF v_student.registration_approval_status = 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'PENDING_APPROVAL',
      'error', 'ID Card Not Approved by Admin: Pending Super Admin approval & payment verification.'
    );
  END IF;

  IF v_student.registration_approval_status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REGISTRATION_REJECTED',
      'error', 'ID Card Not Approved by Admin: Registration has been rejected by Super Admin.'
    );
  END IF;

  IF v_student.payment_status <> 'paid' AND v_student.registration_approval_status <> 'approved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'UNPAID',
      'error', 'Payment Pending: Registration is unpaid.'
    );
  END IF;

  IF v_clean_token <> ''
     AND upper(v_student.qr_token) <> v_clean_token
     AND upper(v_student.id) <> v_clean_token
     AND upper(v_student.qr_token) <> v_raw_token THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'TOKEN_MISMATCH',
      'error', 'Cryptographic QR token mismatch for registration.'
    );
  END IF;

  SELECT event_type INTO v_last_event_type
  FROM public.gate_events
  WHERE registration_id = v_student.id
    AND status = 'APPROVED'
  ORDER BY timestamp DESC
  LIMIT 1;

  IF v_last_event_type IS NOT NULL THEN
    v_live_gate_status := v_last_event_type;
  ELSIF v_student.gate_status IS NOT NULL AND v_student.gate_status <> '' THEN
    v_live_gate_status := v_student.gate_status;
  ELSIF v_student.is_checked_in IS TRUE THEN
    v_live_gate_status := 'ENTRY';
  ELSE
    v_live_gate_status := 'NOT_ENTERED';
  END IF;

  v_live_is_inside := (v_live_gate_status = 'ENTRY');

  RETURN jsonb_build_object(
    'success', true,
    'status', 'VERIFIED',
    'student', jsonb_build_object(
      'id', v_student.id,
      'fullName', v_student.full_name,
      'fullNameBn', v_student.full_name_bn,
      'photoUrl', v_student.photo_url,
      'photoStoragePath', v_student.photo_storage_path,
      'category', v_student.category,
      'batchName', v_student.batch_name,
      'passingYear', v_student.passing_year,
      'currentClass', v_student.current_class,
      'paymentStatus', v_student.payment_status,
      'qrToken', v_student.qr_token,
      'registrationApprovalStatus', v_student.registration_approval_status,
      'isManualRegistration', COALESCE(v_student.is_manual_registration, false),
      'isCheckedIn', v_live_is_inside,
      'isInside', v_live_is_inside,
      'gateStatus', v_live_gate_status,
      'hasParent', COALESCE(v_student.has_parent, false),
      'parentName', v_student.parent_name,
      'parentRelation', v_student.parent_relation,
      'parentPhone', v_student.parent_phone,
      'parentPhotoUrl', v_student.parent_photo_url,
      'isGuardianPass', v_is_guardian_pass,
      'guardianPassId', 'PAR-' || v_student.id,
      'guardianToken', 'P-' || v_student.qr_token,
      'verifiedAt', now()
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_verify_student_qr(text, text, text) TO anon, authenticated, service_role;

-- 12. AUTHORITATIVE rpc_lookup_ticket (Checks registrations_2027 then manual_registrations)
CREATE OR REPLACE FUNCTION public.rpc_lookup_ticket(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student record;
  v_manual record;
  v_raw text := upper(trim(COALESCE(p_identifier, '')));
  v_clean text := regexp_replace(v_raw, '^PAR-', '', 'i');
  v_token_clean text := regexp_replace(v_raw, '^P-', '', 'i');
BEGIN
  SELECT * INTO v_student
  FROM public.registrations_2027
  WHERE upper(id) = v_clean
     OR upper(id) = v_raw
     OR upper(qr_token) = v_token_clean
     OR upper(qr_token) = v_clean
     OR upper(mobile_number) = v_raw
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'student', row_to_json(v_student));
  END IF;

  SELECT * INTO v_manual
  FROM public.manual_registrations
  WHERE upper(id) = v_clean
     OR upper(id) = v_raw
     OR upper(qr_token) = v_token_clean
     OR upper(qr_token) = v_clean
     OR upper(mobile_number) = v_raw
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'student', row_to_json(v_manual));
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'No registration found.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lookup_ticket(text) TO anon, authenticated, service_role;
