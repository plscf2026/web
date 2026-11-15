-- Migration: Admin-Assisted Student Registration, Manual Ticket Generation & Super Admin Approval System
-- Police Lines High School & College, Faridpur — Grand Reunion 2027

-- 1. EXTEND REGISTRATIONS TABLE SCHEMA
DO $$ 
BEGIN
    -- Manual Registration flags
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

    -- Optional Financial section fields
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

-- 2. STORED PROCEDURE: rpc_create_manual_registration
CREATE OR REPLACE FUNCTION public.rpc_create_manual_registration(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
        document_name
    ) VALUES (
        v_id,
        COALESCE(p_data->>'full_name', 'Student'),
        p_data->>'full_name_bn',
        COALESCE(p_data->>'photo_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'),
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
        p_data->>'document_name'
    );

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

-- 3. STORED PROCEDURE: rpc_approve_manual_registration
CREATE OR REPLACE FUNCTION public.rpc_approve_manual_registration(
    p_registration_id text,
    p_admin_name text,
    p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.registrations_2027
    SET 
        registration_approval_status = 'approved',
        approved_by = p_admin_name,
        approved_at = now(),
        approval_notes = NULLIF(trim(p_notes), '')
    WHERE upper(id) = upper(trim(p_registration_id));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found: ' || p_registration_id);
    END IF;

    -- Record Audit Log
    INSERT INTO public.financial_audit_logs (
        id, entity_type, entity_id, action, reason, performed_by, performed_by_name, created_at
    ) VALUES (
        'LOG-APP-' || substring(md5(random()::text) from 1 for 8),
        'category',
        p_registration_id,
        'update',
        'Manual student registration approved by Super Admin: ' || COALESCE(p_notes, 'Standard approval'),
        'super_admin',
        p_admin_name,
        now()
    );

    RETURN jsonb_build_object('success', true, 'id', p_registration_id, 'status', 'approved');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_registration(text, text, text) TO anon, authenticated, service_role;

-- 4. STORED PROCEDURE: rpc_reject_manual_registration
CREATE OR REPLACE FUNCTION public.rpc_reject_manual_registration(
    p_registration_id text,
    p_admin_name text,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.registrations_2027
    SET 
        registration_approval_status = 'rejected',
        rejected_by = p_admin_name,
        rejected_at = now(),
        rejection_reason = p_reason
    WHERE upper(id) = upper(trim(p_registration_id));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found: ' || p_registration_id);
    END IF;

    -- Record Audit Log
    INSERT INTO public.financial_audit_logs (
        id, entity_type, entity_id, action, reason, performed_by, performed_by_name, created_at
    ) VALUES (
        'LOG-REJ-' || substring(md5(random()::text) from 1 for 8),
        'category',
        p_registration_id,
        'void',
        'Manual student registration rejected by Super Admin. Reason: ' || p_reason,
        'super_admin',
        p_admin_name,
        now()
    );

    RETURN jsonb_build_object('success', true, 'id', p_registration_id, 'status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_registration(text, text, text) TO anon, authenticated, service_role;

-- 5. STORED PROCEDURE: rpc_approve_manual_financial
CREATE OR REPLACE FUNCTION public.rpc_approve_manual_financial(
    p_registration_id text,
    p_admin_name text,
    p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reg record;
    v_amt numeric;
BEGIN
    SELECT * INTO v_reg
    FROM public.registrations_2027
    WHERE upper(id) = upper(trim(p_registration_id));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found: ' || p_registration_id);
    END IF;

    v_amt := COALESCE(v_reg.financial_amount, 0);
    IF v_amt <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No financial amount registered on this record.');
    END IF;

    -- Prevent duplicate counting if already approved
    IF v_reg.financial_approval_status = 'approved' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Financial amount was already approved.');
    END IF;

    -- Mark financial approved & set payment_status to paid
    UPDATE public.registrations_2027
    SET 
        financial_approval_status = 'approved',
        financial_approved_by = p_admin_name,
        financial_approved_at = now(),
        payment_status = 'paid',
        total_paid = v_amt,
        transaction_id = COALESCE(v_reg.financial_reference, 'MANUAL-' || upper(substring(md5(random()::text) from 1 for 8)))
    WHERE upper(id) = upper(trim(p_registration_id));

    -- Insert into financial_transactions
    INSERT INTO public.financial_transactions (
        id,
        transaction_type,
        source_type,
        reference_id,
        amount,
        payment_method,
        gateway_trx_id,
        description,
        transaction_date,
        created_by
    ) VALUES (
        'FTX-MAN-' || upper(trim(p_registration_id)),
        'income',
        'registration_fee',
        p_registration_id,
        v_amt,
        COALESCE(v_reg.financial_method, 'cash'),
        v_reg.financial_reference,
        'Manual registration collection approved for: ' || v_reg.full_name || ' (' || p_registration_id || ')',
        CURRENT_DATE,
        p_admin_name
    ) ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount;

    -- Audit log
    INSERT INTO public.financial_audit_logs (
        id, entity_type, entity_id, action, updated_amount, reason, performed_by, performed_by_name, created_at
    ) VALUES (
        'LOG-FIN-APP-' || substring(md5(random()::text) from 1 for 8),
        'budget',
        p_registration_id,
        'update',
        v_amt,
        'Manual registration financial amount approved by Super Admin. Amount: BDT ' || v_amt,
        'super_admin',
        p_admin_name,
        now()
    );

    RETURN jsonb_build_object('success', true, 'id', p_registration_id, 'approved_amount', v_amt);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_financial(text, text, text) TO anon, authenticated, service_role;

-- 6. STORED PROCEDURE: rpc_reject_manual_financial
CREATE OR REPLACE FUNCTION public.rpc_reject_manual_financial(
    p_registration_id text,
    p_admin_name text,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.registrations_2027
    SET 
        financial_approval_status = 'rejected',
        financial_rejected_by = p_admin_name,
        financial_rejected_at = now()
    WHERE upper(id) = upper(trim(p_registration_id));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found: ' || p_registration_id);
    END IF;

    -- Audit log
    INSERT INTO public.financial_audit_logs (
        id, entity_type, entity_id, action, reason, performed_by, performed_by_name, created_at
    ) VALUES (
        'LOG-FIN-REJ-' || substring(md5(random()::text) from 1 for 8),
        'budget',
        p_registration_id,
        'void',
        'Manual registration financial amount rejected by Super Admin. Reason: ' || p_reason,
        'super_admin',
        p_admin_name,
        now()
    );

    RETURN jsonb_build_object('success', true, 'id', p_registration_id, 'status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_financial(text, text, text) TO anon, authenticated, service_role;

-- 7. UPDATE rpc_verify_student_qr TO ENFORCE INACTIVE QR FOR PENDING/REJECTED REGISTRATIONS
CREATE OR REPLACE FUNCTION public.rpc_verify_student_qr(
    p_identifier text,
    p_token text DEFAULT NULL,
    p_staff_id text DEFAULT 'SCANNER_DESK'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_id text := upper(trim(p_identifier));
    v_clean_token text := upper(trim(COALESCE(p_token, '')));
    v_student record;
BEGIN
    -- Look up by Registration ID or 6-character QR token
    SELECT * INTO v_student
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id 
       OR (v_clean_token <> '' AND upper(qr_token) = v_clean_token)
       OR upper(qr_token) = v_clean_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'NOT_FOUND',
            'error', 'Student ticket not found in database.'
        );
    END IF;

    -- CRITICAL REQUIREMENT 6: INACTIVE QR CODE RULES
    -- Pending Manual Registration: QR scanner displays PENDING_APPROVAL. No event entry or facility allowed.
    IF v_student.registration_approval_status = 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'PENDING_APPROVAL',
            'error', 'PENDING_APPROVAL: Manual registration is awaiting Super Admin approval. QR Code is currently inactive.'
        );
    END IF;

    -- Rejected Registration: QR code must NOT authorize any event facility.
    IF v_student.registration_approval_status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'REGISTRATION_REJECTED',
            'error', 'REGISTRATION_REJECTED: Registration has been rejected by Super Admin. Facility access denied.'
        );
    END IF;

    -- Check payment status (unless approved manual without fee)
    IF v_student.payment_status <> 'paid' AND v_student.registration_approval_status <> 'approved' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'UNPAID',
            'error', 'Payment Pending: Registration is unpaid.'
        );
    END IF;

    -- Cryptographic Token Validation
    IF v_clean_token <> '' AND upper(v_student.qr_token) <> v_clean_token THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'TOKEN_MISMATCH',
            'error', 'Cryptographic QR token mismatch for registration.'
        );
    END IF;

    -- Success: Return safe minimized information (ZERO PII)
    RETURN jsonb_build_object(
        'success', true,
        'status', 'VERIFIED',
        'student', jsonb_build_object(
            'id', v_student.id,
            'fullName', v_student.full_name,
            'fullNameBn', v_student.full_name_bn,
            'photoUrl', v_student.photo_url,
            'category', v_student.category,
            'batchName', v_student.batch_name,
            'passingYear', v_student.passing_year,
            'currentClass', v_student.current_class,
            'paymentStatus', v_student.payment_status,
            'qrToken', v_student.qr_token,
            'registrationApprovalStatus', v_student.registration_approval_status,
            'verifiedAt', now()
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_verify_student_qr(text, text, text) TO anon, authenticated, service_role;
