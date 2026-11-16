-- ============================================================================
-- Migration: 20270124000000_fix_registration_read_rls_and_qr_verification_rpc.sql
-- Description: 
-- 1. Add missing photo_storage_path and status columns to registrations_2027.
-- 2. Open SELECT on registrations_2027 to anon and authenticated so Admin Dashboard,
--    ID Card Portal, Financial reports, and ticket verification can fetch records.
-- 3. Deploy authoritative rpc_verify_student_qr with SECURITY DEFINER for cross-device QR scanning.
-- 4. Deploy rpc_admin_get_registrations and flexible rpc_lookup_ticket.
-- ============================================================================

-- 1. ADD MISSING COLUMNS
ALTER TABLE public.registrations_2027 ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;
ALTER TABLE public.registrations_2027 ADD COLUMN IF NOT EXISTS parent_photo_storage_path TEXT;
ALTER TABLE public.registrations_2027 ADD COLUMN IF NOT EXISTS photo_updated_at TIMESTAMPTZ;
ALTER TABLE public.registrations_2027 ADD COLUMN IF NOT EXISTS photo_updated_by TEXT;
ALTER TABLE public.registrations_2027 ADD COLUMN IF NOT EXISTS registration_approval_status TEXT DEFAULT 'approved';
ALTER TABLE public.registrations_2027 ADD COLUMN IF NOT EXISTS financial_approval_status TEXT DEFAULT 'approved';
ALTER TABLE public.registrations_2027 ADD COLUMN IF NOT EXISTS is_manual_registration BOOLEAN DEFAULT FALSE;

-- 2. BACKFILL photo_storage_path FROM EXISTING photo_url IF APPLICABLE
UPDATE public.registrations_2027
SET photo_storage_path = substring(photo_url from '/student-photos/(.*)')
WHERE photo_url LIKE '%/student-photos/%' 
  AND (photo_storage_path IS NULL OR photo_storage_path = '');

-- 3. FIX RLS POLICIES FOR SELECT ON registrations_2027
DROP POLICY IF EXISTS "registration_staff_read_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "public_read_registrations_2027" ON public.registrations_2027;
DROP POLICY IF EXISTS "allow_read_registrations_2027" ON public.registrations_2027;

CREATE POLICY "allow_read_registrations_2027"
  ON public.registrations_2027
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Ensure table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations_2027 TO anon, authenticated, service_role;

-- 4. AUTHORITATIVE rpc_verify_student_qr
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
    v_clean_id text := upper(trim(COALESCE(p_identifier, '')));
    v_clean_token text := upper(trim(COALESCE(p_token, '')));
    v_student record;
BEGIN
    -- Search by exact registration id, or qr_token, or case-insensitive match
    SELECT * INTO v_student
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id
       OR (v_clean_token <> '' AND upper(qr_token) = v_clean_token)
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

    -- Pending Manual Registration
    IF v_student.registration_approval_status = 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'PENDING_APPROVAL',
            'error', 'PENDING_APPROVAL: Manual registration is awaiting Super Admin approval. QR Code is currently inactive.'
        );
    END IF;

    -- Rejected Registration
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

    -- Token mismatch check: only if token provided and does not match
    IF v_clean_token <> '' AND upper(v_student.qr_token) <> v_clean_token AND upper(v_student.id) <> v_clean_token THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'TOKEN_MISMATCH',
            'error', 'Cryptographic QR token mismatch for registration.'
        );
    END IF;

    -- Success: Return safe verified information
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
            'verifiedAt', now()
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_verify_student_qr(text, text, text) TO anon, authenticated, service_role;

-- 5. rpc_admin_get_registrations
CREATE OR REPLACE FUNCTION public.rpc_admin_get_registrations(p_year int DEFAULT 2027)
RETURNS SETOF public.registrations_2027
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
  SELECT * FROM public.registrations_2027
  WHERE (p_year IS NULL OR year = p_year)
  ORDER BY registered_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_get_registrations(int) TO anon, authenticated, service_role;

-- 6. Flexible rpc_lookup_ticket
CREATE OR REPLACE FUNCTION public.rpc_lookup_ticket(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student record;
  v_clean text := upper(trim(COALESCE(p_identifier, '')));
BEGIN
  SELECT * INTO v_student
  FROM public.registrations_2027
  WHERE upper(id) = v_clean
     OR upper(qr_token) = v_clean
     OR upper(mobile_number) = v_clean
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
