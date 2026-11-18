-- ============================================================================
-- Migration: 20270130000000_manual_registration_approval_and_parent_pass_sync.sql
-- Description:
-- 1. Ensure all columns for manual venue registrations and financial approvals exist on registrations_2027.
-- 2. Deploy SECURITY DEFINER RPCs for manual registration lifecycle:
--    - rpc_create_manual_registration
--    - rpc_approve_manual_registration (sets registration_approval_status='approved', payment_status='paid')
--    - rpc_reject_manual_registration
--    - rpc_approve_manual_financial
--    - rpc_reject_manual_financial
-- 3. Enhance rpc_verify_student_qr and rpc_lookup_ticket:
--    - Support parent passes with 'PAR-' and 'P-' prefixes.
--    - Return guardian details (hasParent, parentName, parentRelation, parentPhone, isGuardianPass).
--    - Strictly enforce deactivated QR code for unapproved manual tickets (PENDING_APPROVAL).
-- 4. Grant all necessary RPC permissions to anon, authenticated, and service_role.
-- ============================================================================

-- 1. ENSURE COLUMNS EXIST ON registrations_2027
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'is_manual_registration') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN is_manual_registration boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'registration_type') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN registration_type text DEFAULT 'online';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'registration_approval_status') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN registration_approval_status text DEFAULT 'approved';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'approval_notes') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN approval_notes text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'approved_by') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN approved_by text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'approved_at') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN approved_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'rejected_by') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN rejected_by text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'rejected_at') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN rejected_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'rejection_reason') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN rejection_reason text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'created_by_admin_id') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN created_by_admin_id text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'created_by_admin_name') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN created_by_admin_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_amount') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_amount numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_description') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_description text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_method') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_method text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_reference') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_reference text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_notes') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_notes text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_approval_status') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_approval_status text DEFAULT 'none';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_approved_by') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_approved_by text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_approved_at') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_approved_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_rejected_by') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_rejected_by text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'financial_rejected_at') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN financial_rejected_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'document_url') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN document_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations_2027' AND column_name = 'document_name') THEN
        ALTER TABLE public.registrations_2027 ADD COLUMN document_name text;
    END IF;
END $$;

-- 2. BACKFILL DEFAULTS FOR LEGACY / EXISTING ROWS
UPDATE public.registrations_2027
SET registration_approval_status = 'approved'
WHERE registration_approval_status IS NULL;

UPDATE public.registrations_2027
SET financial_approval_status = 'approved'
WHERE financial_approval_status IS NULL;

UPDATE public.registrations_2027
SET is_manual_registration = false
WHERE is_manual_registration IS NULL;

-- 3. STORED PROCEDURE: rpc_create_manual_registration
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
    v_financial_amount numeric := COALESCE((p_data->>'financial_amount')::numeric, 0);
    v_fin_status text := 'none';
BEGIN
    -- Check duplicate by verified Student ID (if provided)
    IF v_student_id <> '' THEN
        IF EXISTS (SELECT 1 FROM public.registrations_2027 WHERE upper(student_id) = v_student_id) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'DUPLICATE_STUDENT_ID: A registration already exists for Student ID: ' || v_student_id
            );
        END IF;
    END IF;

    -- Generate Registration ID if not provided
    v_id := COALESCE(p_data->>'id', 'PLSCF-2027-' || CASE WHEN p_data->>'category' = 'current' THEN 'C' ELSE 'F' END || (floor(random() * 9000 + 1000))::text);
    v_qr_token := COALESCE(p_data->>'qr_token', upper(substring(md5(random()::text) from 1 for 6)));

    -- Financial initial status
    IF v_financial_amount > 0 THEN
        v_fin_status := 'pending';
    END IF;

    INSERT INTO public.registrations_2027 (
        id,
        full_name,
        full_name_bn,
        photo_url,
        photo_storage_path,
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
        payment_method,
        registered_at,
        qr_token,
        notes,
        gender,
        blood_group,
        has_parent,
        parent_name,
        parent_age,
        parent_phone,
        parent_relation,
        parent_photo_url,
        parent_photo_storage_path,
        parent_fee,
        is_manual_registration,
        registration_type,
        registration_approval_status,
        created_by_admin_id,
        created_by_admin_name,
        financial_amount,
        financial_description,
        financial_method,
        financial_reference,
        financial_notes,
        financial_approval_status,
        document_url,
        document_name,
        year
    ) VALUES (
        v_id,
        COALESCE(p_data->>'full_name', 'Student'),
        p_data->>'full_name_bn',
        COALESCE(p_data->>'photo_url', ''),
        p_data->>'photo_storage_path',
        COALESCE(p_data->>'mobile_number', ''),
        p_data->>'email',
        COALESCE(p_data->>'address', ''),
        COALESCE(p_data->>'category', 'former'),
        NULLIF(v_student_id, ''),
        p_data->>'passing_year',
        p_data->>'last_class_attended',
        p_data->>'current_class',
        COALESCE(p_data->>'batch_name', 'General'),
        p_data->>'group_or_section',
        p_data->>'roll_number',
        COALESCE(p_data->>'t_shirt_size', 'L'),
        COALESCE((p_data->>'registration_fee')::numeric, CASE WHEN p_data->>'category' = 'current' THEN 500 ELSE 1500 END),
        0,
        0,
        'pending',
        COALESCE(p_data->>'financial_method', 'cash'),
        now(),
        v_qr_token,
        p_data->>'notes',
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
        true,
        COALESCE(p_data->>'registration_type', 'manual_venue'),
        'pending',
        p_data->>'created_by_admin_id',
        p_data->>'created_by_admin_name',
        v_financial_amount,
        p_data->>'financial_description',
        p_data->>'financial_method',
        p_data->>'financial_reference',
        p_data->>'financial_notes',
        v_fin_status,
        p_data->>'document_url',
        p_data->>'document_name',
        2027
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        full_name_bn = EXCLUDED.full_name_bn,
        photo_url = EXCLUDED.photo_url,
        photo_storage_path = EXCLUDED.photo_storage_path,
        mobile_number = EXCLUDED.mobile_number,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        category = EXCLUDED.category,
        batch_name = EXCLUDED.batch_name,
        t_shirt_size = EXCLUDED.t_shirt_size,
        has_parent = EXCLUDED.has_parent,
        parent_name = EXCLUDED.parent_name,
        parent_relation = EXCLUDED.parent_relation,
        parent_phone = EXCLUDED.parent_phone,
        is_manual_registration = true,
        registration_approval_status = 'pending';

    RETURN jsonb_build_object(
        'success', true,
        'id', v_id,
        'qr_token', v_qr_token,
        'registration_approval_status', 'pending',
        'financial_approval_status', v_fin_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_manual_registration(jsonb) TO anon, authenticated, service_role;

-- 4. STORED PROCEDURE: rpc_approve_manual_registration
-- Sets registration_approval_status = 'approved' AND payment_status = 'paid' so that QR code is activated!
CREATE OR REPLACE FUNCTION public.rpc_approve_manual_registration(
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
    v_rec record;
    v_paid_amt numeric;
BEGIN
    SELECT * INTO v_rec
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found: ' || p_registration_id);
    END IF;

    -- Calculate paid amount: financial amount if given, or registration fee, minimum 500
    v_paid_amt := CASE 
        WHEN v_rec.financial_amount > 0 AND (v_rec.financial_approval_status = 'pending' OR v_rec.financial_approval_status = 'rejected') THEN 0
        WHEN v_rec.total_paid > 0 THEN v_rec.total_paid
        WHEN COALESCE(v_rec.financial_amount, 0) > 0 THEN v_rec.financial_amount
        WHEN COALESCE(v_rec.registration_fee, 0) > 0 THEN v_rec.registration_fee
        WHEN v_rec.category = 'current' THEN 500
        ELSE 1500
    END;

    UPDATE public.registrations_2027
    SET 
        registration_approval_status = 'approved',
        payment_status = 'paid',
        total_paid = v_paid_amt,
        approved_by = p_admin_name,
        approved_at = now(),
        approval_notes = NULLIF(trim(p_notes), '')
    WHERE upper(id) = v_clean_id;

    -- Record Audit Log in admin_audit_logs if present
    BEGIN
        INSERT INTO public.admin_audit_logs (
            id, user_id, action, entity_type, entity_id, notes, created_at
        ) VALUES (
            'AUD-APP-' || substring(md5(random()::text) from 1 for 8),
            p_admin_name,
            'MANUAL_REG_APPROVED',
            'registration',
            v_clean_id,
            'Approved by Super Admin ' || p_admin_name || '. QR Code activated. Status set to PAID. ' || COALESCE(p_notes, ''),
            now()
        );
    EXCEPTION WHEN OTHERS THEN
        -- Continue gracefully if admin_audit_logs schema varies
    END;

    -- Record Audit Log in financial_audit_logs if present
    BEGIN
        INSERT INTO public.financial_audit_logs (
            id, entity_type, entity_id, action, reason, performed_by, performed_by_name, created_at
        ) VALUES (
            'LOG-APP-' || substring(md5(random()::text) from 1 for 8),
            'registration',
            v_clean_id,
            'update',
            'Manual student registration approved by Super Admin ' || p_admin_name || '. QR activated. Amount: BDT ' || v_paid_amt,
            'super_admin',
            p_admin_name,
            now()
        );
    EXCEPTION WHEN OTHERS THEN
        -- Continue gracefully
    END;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_clean_id,
        'status', 'approved',
        'payment_status', 'paid',
        'total_paid', v_paid_amt
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_registration(text, text, text) TO anon, authenticated, service_role;

-- 5. STORED PROCEDURE: rpc_reject_manual_registration
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
    UPDATE public.registrations_2027
    SET 
        registration_approval_status = 'rejected',
        payment_status = 'rejected',
        rejected_by = p_admin_name,
        rejected_at = now(),
        rejection_reason = p_reason
    WHERE upper(id) = v_clean_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found: ' || p_registration_id);
    END IF;

    BEGIN
        INSERT INTO public.admin_audit_logs (
            id, user_id, action, entity_type, entity_id, notes, created_at
        ) VALUES (
            'AUD-REJ-' || substring(md5(random()::text) from 1 for 8),
            p_admin_name,
            'MANUAL_REG_REJECTED',
            'registration',
            v_clean_id,
            'Manual registration rejected by Super Admin. Reason: ' || p_reason,
            now()
        );
    EXCEPTION WHEN OTHERS THEN
    END;

    RETURN jsonb_build_object('success', true, 'id', v_clean_id, 'status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_registration(text, text, text) TO anon, authenticated, service_role;

-- 6. STORED PROCEDURE: rpc_approve_manual_financial
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
    v_rec record;
BEGIN
    SELECT * INTO v_rec
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found: ' || p_registration_id);
    END IF;

    UPDATE public.registrations_2027
    SET 
        financial_approval_status = 'approved',
        financial_approved_by = p_admin_name,
        financial_approved_at = now(),
        total_paid = CASE WHEN total_paid > 0 THEN total_paid ELSE COALESCE(financial_amount, registration_fee, 1500) END
    WHERE upper(id) = v_clean_id;

    -- Insert into financial_ledger if table exists
    BEGIN
        INSERT INTO public.financial_ledger (
            id, entry_type, category, amount, payment_method, reference_id, description, status, created_by, created_at
        ) VALUES (
            'LED-FIN-' || substring(md5(random()::text) from 1 for 8),
            'inflow',
            'registration_fee',
            COALESCE(v_rec.financial_amount, v_rec.registration_fee, 1500),
            COALESCE(v_rec.financial_method, 'cash'),
            v_clean_id,
            'Manual registration fee confirmed for student ' || v_rec.full_name || ' (' || v_clean_id || ')',
            'verified',
            p_admin_name,
            now()
        );
    EXCEPTION WHEN OTHERS THEN
    END;

    RETURN jsonb_build_object('success', true, 'id', v_clean_id, 'financial_approval_status', 'approved');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_financial(text, text, text) TO anon, authenticated, service_role;

-- 7. STORED PROCEDURE: rpc_reject_manual_financial
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
    UPDATE public.registrations_2027
    SET 
        financial_approval_status = 'rejected',
        financial_rejected_by = p_admin_name,
        financial_rejected_at = now(),
        total_paid = 0
    WHERE upper(id) = v_clean_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found: ' || p_registration_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_clean_id, 'financial_approval_status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_financial(text, text, text) TO anon, authenticated, service_role;

-- 8. AUTHORITATIVE rpc_verify_student_qr (WITH PARENT PASS SUPPORT & DEACTIVATED QR ENFORCEMENT)
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
BEGIN
    -- Determine if scanning guardian/parent pass
    IF v_raw_id LIKE 'PAR-%' OR v_raw_token LIKE 'P-%' THEN
        v_is_guardian_pass := true;
    END IF;

    -- Strip prefixes for database lookup
    v_clean_id := regexp_replace(v_raw_id, '^PAR-', '', 'i');
    v_clean_token := regexp_replace(v_raw_token, '^P-', '', 'i');

    -- Search by cleaned id, raw id, token, or substring
    SELECT * INTO v_student
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id
       OR upper(id) = v_raw_id
       OR (v_clean_token <> '' AND upper(qr_token) = v_clean_token)
       OR (v_raw_token <> '' AND upper(qr_token) = v_raw_token)
       OR upper(qr_token) = v_clean_id
       OR (v_clean_id <> '' AND upper(id) LIKE '%' || v_clean_id || '%')
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'NOT_FOUND',
            'error', 'Student ticket not found in database.'
        );
    END IF;

    -- If scanned as a guardian pass, verify that parent was registered
    IF v_is_guardian_pass AND (v_student.has_parent IS NOT TRUE) THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'GUARDIAN_NOT_REGISTERED',
            'error', 'Parent/Guardian pass not registered for this student (' || v_student.id || ').'
        );
    END IF;

    -- Pending Manual Registration: QR Code is strictly deactivated!
    IF v_student.registration_approval_status = 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'PENDING_APPROVAL',
            'error', 'PENDING APPROVAL: Manual registration is awaiting Super Admin approval. QR Code is currently inactive.'
        );
    END IF;

    -- Rejected Registration: Entry denied
    IF v_student.registration_approval_status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'REGISTRATION_REJECTED',
            'error', 'REGISTRATION REJECTED: Registration has been rejected by Super Admin. Facility access denied.'
        );
    END IF;

    -- Check payment status (must be 'paid' or manual 'approved')
    IF v_student.payment_status <> 'paid' AND v_student.registration_approval_status <> 'approved' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'UNPAID',
            'error', 'Payment Pending: Registration is unpaid.'
        );
    END IF;

    -- Token mismatch check (only if token is explicitly provided)
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

    -- Success: Return safe verified information including guardian data
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

-- 9. AUTHORITATIVE rpc_lookup_ticket (STRIPS PAR- / P-)
CREATE OR REPLACE FUNCTION public.rpc_lookup_ticket(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student record;
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

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No registration found.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'student', row_to_json(v_student)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lookup_ticket(text) TO anon, authenticated, service_role;
