-- Migration: Flexible Ticket and Donation Lookup by Registered Mobile Number OR Registration ID / Token
-- Allows users to find tickets using either their registered mobile number alone, their registration ID / token alone, or both.

CREATE OR REPLACE FUNCTION public.rpc_lookup_ticket(
  p_identifier text DEFAULT '',
  p_mobile text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student record;
  v_donation record;
  v_clean text := upper(trim(COALESCE(p_identifier, '')));
  v_clean_mobile text := regexp_replace(COALESCE(p_mobile, ''), '[^0-9]', '', 'g');
BEGIN
  -- If p_identifier contains digits only (11 digits BD phone) and p_mobile is empty, treat as mobile
  IF v_clean_mobile = '' AND v_clean ~ '^01[0-9]{9}$' THEN
    v_clean_mobile := v_clean;
  END IF;

  -- 1. Try finding student registration
  IF v_clean != '' AND v_clean_mobile != '' AND v_clean != v_clean_mobile THEN
    -- Both ID and Mobile provided: match both
    SELECT * INTO v_student
    FROM public.registrations_2027
    WHERE (upper(id) = v_clean OR upper(qr_token) = v_clean)
      AND (mobile_number LIKE '%' || v_clean_mobile OR v_clean_mobile LIKE '%' || mobile_number)
    LIMIT 1;
  ELSIF v_clean_mobile != '' THEN
    -- Mobile provided alone
    SELECT * INTO v_student
    FROM public.registrations_2027
    WHERE (mobile_number LIKE '%' || v_clean_mobile OR v_clean_mobile LIKE '%' || mobile_number)
    ORDER BY (payment_status = 'paid') DESC, registered_at DESC
    LIMIT 1;
  ELSIF v_clean != '' THEN
    -- Identifier provided alone
    SELECT * INTO v_student
    FROM public.registrations_2027
    WHERE upper(id) = v_clean
       OR upper(qr_token) = v_clean
       OR mobile_number = v_clean
    LIMIT 1;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'type', 'registration',
      'student', row_to_json(v_student),
      'ticket', row_to_json(v_student)
    );
  END IF;

  -- 2. Try finding donation record
  IF v_clean != '' AND v_clean_mobile != '' AND v_clean != v_clean_mobile THEN
    SELECT * INTO v_donation
    FROM public.donations
    WHERE (upper(id) = v_clean OR upper(token) = v_clean OR upper(qr_token) = v_clean)
      AND (mobile_number LIKE '%' || v_clean_mobile OR v_clean_mobile LIKE '%' || mobile_number)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF v_clean_mobile != '' THEN
    SELECT * INTO v_donation
    FROM public.donations
    WHERE (mobile_number LIKE '%' || v_clean_mobile OR v_clean_mobile LIKE '%' || mobile_number)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF v_clean != '' THEN
    SELECT * INTO v_donation
    FROM public.donations
    WHERE upper(id) = v_clean
       OR upper(token) = v_clean
       OR upper(qr_token) = v_clean
       OR mobile_number = v_clean
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'type', 'donation',
      'donation', row_to_json(v_donation)
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'No registration or donation record found.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lookup_ticket(text, text) TO anon, authenticated, service_role;
