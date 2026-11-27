-- ============================================================================
-- MIGRATION: 20270325000000_final_db_storage_and_idempotency_hardening.sql
-- PURPOSE:
--   1. Make public.rpc_record_donation strictly idempotent across
--      transaction_id and gateway_invoice_number so concurrent IPN + client
--      return calls never fail with unique_violation (409 / 23505), and lock
--      EXECUTE strictly to service_role.
--   2. Harden public.rpc_lookup_ticket to only return verified paid and
--      approved registrations (and paid donations), keeping PII stripped.
--   3. Narrow committee-photos Storage admin write policies from {public} to
--      {authenticated} (preserving current_admin_role() IS NOT NULL check).
--   4. Fix minor double-plus phone typo ('++880' -> '+880') in
--      international_payment_info.instructionsBn if present.
-- ============================================================================

BEGIN;

-- 1. Idempotent rpc_record_donation (service_role only)
DROP FUNCTION IF EXISTS public.rpc_record_donation(text, text, text, text, numeric, text, text, text, text, text, int) CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_record_donation(
  p_id text,
  p_donor_name text,
  p_mobile_number text,
  p_email text DEFAULT '',
  p_amount numeric DEFAULT 0,
  p_purpose text DEFAULT 'General Reunion Fund',
  p_payment_method text DEFAULT 'bkash',
  p_transaction_id text DEFAULT '',
  p_gateway_invoice_number text DEFAULT NULL,
  p_token text DEFAULT NULL,
  p_year int DEFAULT 2027
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_token text := COALESCE(NULLIF(trim(COALESCE(p_token, '')), ''), upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6)));
  v_trx text := NULLIF(trim(COALESCE(p_transaction_id, '')), '');
  v_inv text := NULLIF(trim(COALESCE(p_gateway_invoice_number, '')), '');
  v_rec record;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') <> 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: service_role required for donation recording.'
      USING ERRCODE = '42501';
  END IF;

  -- Check if already promoted by IPN or earlier return callback
  IF v_inv IS NOT NULL OR v_trx IS NOT NULL THEN
    SELECT * INTO v_rec
    FROM public.donations
    WHERE (v_inv IS NOT NULL AND gateway_invoice_number = v_inv)
       OR (v_trx IS NOT NULL AND upper(trim(COALESCE(transaction_id, ''))) = upper(v_trx))
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'donation', row_to_json(v_rec)
      );
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.donations (
      id, donor_name, mobile_number, email, amount, purpose,
      payment_method, transaction_id, gateway_invoice_number,
      token, qr_token, donation_date, date, year, payment_status, created_at
    )
    VALUES (
      p_id,
      p_donor_name,
      p_mobile_number,
      COALESCE(p_email, ''),
      p_amount,
      COALESCE(NULLIF(trim(COALESCE(p_purpose, '')), ''), 'General Reunion Fund'),
      COALESCE(NULLIF(trim(COALESCE(p_payment_method, '')), ''), 'bkash'),
      COALESCE(v_trx, 'TRX'),
      v_inv,
      v_token,
      v_token,
      CURRENT_DATE,
      CURRENT_DATE,
      COALESCE(p_year, 2027),
      'paid',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      amount = EXCLUDED.amount,
      payment_status = 'paid',
      transaction_id = EXCLUDED.transaction_id,
      gateway_invoice_number = COALESCE(public.donations.gateway_invoice_number, EXCLUDED.gateway_invoice_number),
      token = COALESCE(public.donations.token, EXCLUDED.token),
      qr_token = COALESCE(public.donations.qr_token, EXCLUDED.qr_token)
    RETURNING * INTO v_rec;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_rec
      FROM public.donations
      WHERE (v_inv IS NOT NULL AND gateway_invoice_number = v_inv)
         OR (v_trx IS NOT NULL AND upper(trim(COALESCE(transaction_id, ''))) = upper(v_trx))
         OR id = p_id
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE;
      END IF;
  END;

  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    INSERT INTO public.donations_2027 (
      id, donor_name, mobile_number, email, amount, purpose,
      payment_method, transaction_id, gateway_invoice_number,
      token, qr_token, date, year, payment_status, created_at
    )
    VALUES (
      v_rec.id, v_rec.donor_name, v_rec.mobile_number, v_rec.email, v_rec.amount, v_rec.purpose,
      v_rec.payment_method, v_rec.transaction_id, v_rec.gateway_invoice_number,
      v_rec.token, COALESCE(v_rec.token, v_rec.qr_token), v_rec.date, v_rec.year, 'paid', now()
    )
    ON CONFLICT (id) DO UPDATE SET
      amount = EXCLUDED.amount,
      payment_status = 'paid',
      gateway_invoice_number = COALESCE(public.donations_2027.gateway_invoice_number, EXCLUDED.gateway_invoice_number),
      token = COALESCE(public.donations_2027.token, EXCLUDED.token);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'donation', row_to_json(v_rec)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_record_donation(text, text, text, text, numeric, text, text, text, text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_record_donation(text, text, text, text, numeric, text, text, text, text, text, int) TO service_role;

-- 2. Harden public.rpc_lookup_ticket (strictly paid + approved registrations, zero PII)
DROP FUNCTION IF EXISTS public.rpc_lookup_ticket(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_lookup_ticket(
  p_identifier TEXT DEFAULT '',
  p_mobile TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean           TEXT := upper(trim(COALESCE(p_identifier, '')));
  v_clean_mobile    TEXT := regexp_replace(COALESCE(p_mobile, ''), '[^0-9]', '', 'g');
  v_mobile_supplied BOOLEAN := false;
  v_student         RECORD;
  v_donation        RECORD;
BEGIN
  IF v_clean_mobile LIKE '880%' AND length(v_clean_mobile) >= 13 THEN
    v_clean_mobile := '0' || substr(v_clean_mobile, 4);
  END IF;
  IF v_clean_mobile = '' AND v_clean ~ '^01[0-9]{9}$' THEN
    v_clean_mobile := v_clean;
  END IF;

  v_mobile_supplied := length(v_clean_mobile) >= 10;

  IF v_clean = '' AND NOT v_mobile_supplied THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration identifier or registered mobile is required.');
  END IF;

  IF v_clean <> '' AND v_mobile_supplied AND v_clean <> v_clean_mobile THEN
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in
    INTO v_student
    FROM public.registrations_2027
    WHERE (upper(id) = v_clean OR upper(qr_token) = v_clean)
      AND regexp_replace(mobile_number, '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
      AND payment_status = 'paid'
      AND COALESCE(registration_approval_status, 'approved') = 'approved'
    LIMIT 1;
  ELSIF v_mobile_supplied THEN
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in
    INTO v_student
    FROM public.registrations_2027
    WHERE regexp_replace(mobile_number, '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
      AND payment_status = 'paid'
      AND COALESCE(registration_approval_status, 'approved') = 'approved'
    ORDER BY registered_at DESC
    LIMIT 1;
  ELSE
    -- Without mobile number, only match exact cryptographic qr_token for paid+approved tickets
    SELECT id, full_name, category, batch_name, passing_year, current_class,
           payment_status, qr_token, total_paid, year, registered_at, is_tshirt_collected, is_checked_in
    INTO v_student
    FROM public.registrations_2027
    WHERE upper(qr_token) = v_clean
      AND payment_status = 'paid'
      AND COALESCE(registration_approval_status, 'approved') = 'approved'
    LIMIT 1;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'type', 'registration',
      'ticket', jsonb_build_object(
        'id', v_student.id,
        'full_name', v_student.full_name,
        'category', v_student.category,
        'batch_name', v_student.batch_name,
        'passing_year', v_student.passing_year,
        'current_class', v_student.current_class,
        'payment_status', v_student.payment_status,
        'total_paid', v_student.total_paid,
        'year', v_student.year,
        'registered_at', v_student.registered_at,
        'is_tshirt_collected', v_student.is_tshirt_collected,
        'is_checked_in', v_student.is_checked_in,
        'qr_token', v_student.qr_token
      )
    );
  END IF;

  -- Narrowly scoped non-PII paid donation status lookup
  IF v_clean <> '' AND v_mobile_supplied AND v_clean <> v_clean_mobile THEN
    SELECT id, donor_name, amount, purpose, payment_status, token, qr_token, year, donation_date
    INTO v_donation
    FROM public.donations
    WHERE (upper(id) = v_clean OR upper(COALESCE(token, '')) = v_clean OR upper(COALESCE(qr_token, '')) = v_clean)
      AND regexp_replace(COALESCE(mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
      AND payment_status = 'paid'
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF v_mobile_supplied THEN
    SELECT id, donor_name, amount, purpose, payment_status, token, qr_token, year, donation_date
    INTO v_donation
    FROM public.donations
    WHERE regexp_replace(COALESCE(mobile_number, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_mobile, 10)
      AND payment_status = 'paid'
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT id, donor_name, amount, purpose, payment_status, token, qr_token, year, donation_date
    INTO v_donation
    FROM public.donations
    WHERE (upper(COALESCE(token, '')) = v_clean OR upper(COALESCE(qr_token, '')) = v_clean)
      AND payment_status = 'paid'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'type', 'donation',
      'donation', jsonb_build_object(
        'id', v_donation.id,
        'donor_name', v_donation.donor_name,
        'amount', v_donation.amount,
        'purpose', v_donation.purpose,
        'payment_status', v_donation.payment_status,
        'year', v_donation.year,
        'donation_date', v_donation.donation_date,
        'token', COALESCE(v_donation.token, v_donation.qr_token)
      )
    );
  END IF;

  IF NOT v_mobile_supplied AND EXISTS (
    SELECT 1
    FROM public.registrations_2027
    WHERE upper(id) = v_clean
      AND payment_status = 'paid'
      AND COALESCE(registration_approval_status, 'approved') = 'approved'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OWNERSHIP_VERIFICATION_REQUIRED',
      'message', 'Registered mobile number is required to retrieve this digital ticket.'
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'No verified ticket or donation matched those details.');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_lookup_ticket(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_lookup_ticket(TEXT, TEXT) TO anon, authenticated, service_role;

-- 3. Restrict committee-photos admin storage write policies to authenticated role
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can upload committee photos" ON storage.objects;
  CREATE POLICY "Admins can upload committee photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'committee-photos'
    AND public.current_admin_role() IS NOT NULL
    AND storage.extension(name) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp'])
  );

  DROP POLICY IF EXISTS "Admins can update committee photos" ON storage.objects;
  CREATE POLICY "Admins can update committee photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'committee-photos'
    AND public.current_admin_role() IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'committee-photos'
    AND public.current_admin_role() IS NOT NULL
  );

  DROP POLICY IF EXISTS "Admins can delete committee photos" ON storage.objects;
  CREATE POLICY "Admins can delete committee photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'committee-photos'
    AND public.current_admin_role() IS NOT NULL
  );
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipped storage.objects policy tightening due to non-owner role; verify via Supabase Storage Dashboard.';
END $$;

-- 4. Fix double-plus phone typo in international_payment_info.instructionsBn if present
UPDATE public.system_settings
SET value = jsonb_set(
      value,
      '{instructionsBn}',
      to_jsonb(replace(value->>'instructionsBn', '++880', '+880'))
    ),
    updated_at = NOW()
WHERE key = 'international_payment_info'
  AND value ? 'instructionsBn'
  AND (value->>'instructionsBn') LIKE '%++880%';

-- 5. Lock leftover 3-arg overload of rpc_approve_manual_registration from PUBLIC/anon
DO $$
BEGIN
  IF to_regprocedure('public.rpc_approve_manual_registration(text, text, text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_approve_manual_registration(text, text, text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_registration(text, text, text) TO service_role';
  END IF;
END $$;

-- 6. Drop remaining legacy true policies on registrations_2026 & revoke excess anon grants
DO $$
DECLARE
  v_priv_table TEXT;
  v_sensitive_tables TEXT[] := ARRAY[
    'admin_accounts',
    'staff_accounts',
    'ipn_logs',
    'payment_transactions',
    'financial_ledger',
    'central_budget',
    'id_card_staff_accounts',
    'staff_allocations',
    'staff_expenses'
  ];
BEGIN
  IF to_regclass('public.registrations_2026') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can update registrations" ON public.registrations_2026;
    DROP POLICY IF EXISTS "public_select_registration_2026" ON public.registrations_2026;
    DROP POLICY IF EXISTS "public_update_registration_2026" ON public.registrations_2026;
  END IF;

  FOREACH v_priv_table IN ARRAY v_sensitive_tables
  LOOP
    IF to_regclass('public.' || v_priv_table) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', v_priv_table);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', v_priv_table);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', v_priv_table);
    END IF;
  END LOOP;

  IF to_regclass('public.about_contact_content') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.about_contact_content FROM PUBLIC, anon;
    GRANT SELECT ON public.about_contact_content TO anon, authenticated;
  END IF;

  IF to_regclass('public.inquiries') IS NOT NULL THEN
    REVOKE SELECT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.inquiries FROM PUBLIC, anon;
    GRANT INSERT ON public.inquiries TO anon, authenticated;
  END IF;
END $$;

COMMIT;
