-- ==============================================================================
-- DATABASE MIGRATION: 20270201000000_gate_status_and_record_back_sync.sql
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR — GRAND REUNION 2027
-- Fix Gate "Record Back" persistence and bi-directional sync with Admin Panel
-- ==============================================================================

-- 1. ADD gate_status COLUMN TO registrations_2027 IF NOT EXISTS
ALTER TABLE public.registrations_2027 
ADD COLUMN IF NOT EXISTS gate_status TEXT DEFAULT 'NOT_ENTERED';

CREATE INDEX IF NOT EXISTS idx_registrations_2027_gate_status 
ON public.registrations_2027(gate_status);

-- 2. BACKFILL gate_status FROM LATEST gate_events
DO $$
BEGIN
    WITH latest_events AS (
        SELECT DISTINCT ON (registration_id) 
            registration_id, 
            CASE WHEN upper(trim(event_type)) IN ('BACK', 'EXIT') THEN 'BACK' ELSE 'ENTRY' END AS norm_type
        FROM public.gate_events
        WHERE status = 'APPROVED'
        ORDER BY registration_id, timestamp DESC
    )
    UPDATE public.registrations_2027 r
    SET gate_status = le.norm_type,
        is_checked_in = (le.norm_type = 'ENTRY')
    FROM latest_events le
    WHERE r.id = le.registration_id;
END $$;

-- 3. AUTHORITATIVE CONCURRENCY-SAFE GATE CONFIRMATION RPC
CREATE OR REPLACE FUNCTION public.rpc_confirm_gate_event(
    p_registration_id TEXT,
    p_event_type TEXT,
    p_gate_id TEXT DEFAULT 'Gate 01 - Main Entrance',
    p_staff_id TEXT DEFAULT 'GATE_STAFF',
    p_staff_name TEXT DEFAULT 'Gate Staff'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_id TEXT := upper(trim(COALESCE(p_registration_id, '')));
    v_norm_type TEXT;
    v_student RECORD;
    v_last_event RECORD;
    v_new_event_id TEXT;
    v_is_inside BOOLEAN;
BEGIN
    -- Canonical event type: ENTRY or BACK
    IF upper(trim(COALESCE(p_event_type, ''))) IN ('BACK', 'EXIT') THEN
        v_norm_type := 'BACK';
    ELSE
        v_norm_type := 'ENTRY';
    END IF;

    -- 1. Find and lock registration row
    SELECT id, full_name, batch_name, photo_url, payment_status, registration_approval_status, is_checked_in, gate_status
    INTO v_student
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id OR upper(student_id) = v_clean_id OR upper(qr_token) = v_clean_id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND', 'message', 'Student registration not found.');
    END IF;

    -- Gate access requires paid or approved manual registration
    IF v_student.payment_status <> 'paid' AND v_student.registration_approval_status <> 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNPAID_REGISTRATION', 'message', 'Student registration is not paid.');
    END IF;

    -- 2. Inspect latest gate event to determine current inside status
    SELECT event_type, status INTO v_last_event
    FROM public.gate_events
    WHERE registration_id = v_student.id
      AND status = 'APPROVED'
    ORDER BY timestamp DESC
    LIMIT 1;

    IF FOUND THEN
        v_is_inside := (v_last_event.event_type = 'ENTRY');
    ELSE
        v_is_inside := (v_student.gate_status = 'ENTRY' OR v_student.is_checked_in IS TRUE);
    END IF;

    -- 3. Atomic event insertion
    v_new_event_id := 'GATE-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT;

    INSERT INTO public.gate_events (
        id, registration_id, student_name, batch_name, photo_url,
        event_type, gate_id, staff_id, staff_name, timestamp, status
    ) VALUES (
        v_new_event_id, v_student.id, v_student.full_name, v_student.batch_name,
        v_student.photo_url, v_norm_type, COALESCE(p_gate_id, 'Gate 01 - Main Entrance'),
        COALESCE(p_staff_id, 'GATE_STAFF'), COALESCE(p_staff_name, 'Gate Staff'), NOW(), 'APPROVED'
    );

    -- 4. ATOMICALLY UPDATE registrations_2027 TABLE WITH gate_status & is_checked_in
    UPDATE public.registrations_2027
    SET is_checked_in = (v_norm_type = 'ENTRY'),
        gate_status = v_norm_type
    WHERE id = v_student.id;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_new_event_id,
        'event_type', v_norm_type,
        'gate_status', v_norm_type,
        'student_id', v_student.id,
        'student_name', v_student.full_name,
        'batch_name', v_student.batch_name,
        'is_inside', (v_norm_type = 'ENTRY')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirm_gate_event(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. AUTHORITATIVE GATE ATTENDANCE TOGGLE RPC
CREATE OR REPLACE FUNCTION public.rpc_toggle_gate_attendance(
    p_reg_id TEXT,
    p_is_inside BOOLEAN,
    p_staff_id TEXT DEFAULT 'ADMIN',
    p_staff_name TEXT DEFAULT 'Admin',
    p_gate_id TEXT DEFAULT 'Gate 01 - Main Entrance'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_student RECORD;
    v_event_type TEXT;
    v_event_id TEXT;
BEGIN
    v_event_type := CASE WHEN p_is_inside IS TRUE THEN 'ENTRY' ELSE 'BACK' END;

    SELECT id, full_name, batch_name, photo_url INTO v_student
    FROM public.registrations_2027
    WHERE id = p_reg_id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration record not found');
    END IF;

    -- Update registrations_2027
    UPDATE public.registrations_2027
    SET is_checked_in = p_is_inside,
        gate_status = v_event_type
    WHERE id = p_reg_id;

    -- Insert into gate_events
    v_event_id := 'GATE-TOGGLE-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT;
    INSERT INTO public.gate_events (
        id, registration_id, student_name, batch_name, photo_url,
        event_type, gate_id, staff_id, staff_name, timestamp, status
    ) VALUES (
        v_event_id, v_student.id, v_student.full_name, v_student.batch_name,
        v_student.photo_url, v_event_type, COALESCE(p_gate_id, 'Gate 01 - Main Entrance'),
        COALESCE(p_staff_id, 'ADMIN'), COALESCE(p_staff_name, 'Admin'), NOW(), 'APPROVED'
    );

    RETURN jsonb_build_object(
        'success', true,
        'is_inside', p_is_inside,
        'gate_status', v_event_type,
        'event_id', v_event_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_toggle_gate_attendance(TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. UPDATE rpc_verify_student_qr TO RETURN LIVE gate_status AND isInside
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
    v_last_event_type text;
    v_live_gate_status text;
    v_live_is_inside boolean;
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

    -- Pending Manual Registration: QR Code is strictly deactivated
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

    -- Resolve authoritative gate status from gate_events and registrations_2027
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

    -- Success: Return safe verified information including gate status & inside flag
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
