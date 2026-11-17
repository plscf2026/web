-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE REUNION 2027
-- DONATION TOKEN, THANK YOU CARD & UNIFIED LOOKUP MIGRATION
-- Migration: 20270127000000_donation_token_and_lookup.sql
-- ============================================================================

-- 1. Ensure token column exists on canonical donations and donations_2027
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS qr_token text;

DO $$
BEGIN
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    ALTER TABLE public.donations_2027
      ADD COLUMN IF NOT EXISTS token text,
      ADD COLUMN IF NOT EXISTS qr_token text;
  END IF;
END $$;

-- 2. Indexes for fast lookup by token, mobile number, and amount (for Hall of Fame)
CREATE INDEX IF NOT EXISTS idx_donations_token ON public.donations(token);
CREATE INDEX IF NOT EXISTS idx_donations_qr_token ON public.donations(qr_token);
CREATE INDEX IF NOT EXISTS idx_donations_mobile_number ON public.donations(mobile_number);
CREATE INDEX IF NOT EXISTS idx_donations_amount_desc ON public.donations(amount DESC);

-- 3. Comprehensive RLS policies on public.donations (SELECT, INSERT, UPDATE)
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view confirmed donations" ON public.donations;
DROP POLICY IF EXISTS "Public can view donations" ON public.donations;
DROP POLICY IF EXISTS "Public select donations" ON public.donations;
CREATE POLICY "Public select donations" ON public.donations
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public insert donations" ON public.donations;
CREATE POLICY "Public insert donations" ON public.donations
  FOR INSERT TO anon, authenticated
  WITH CHECK (amount > 0);

DROP POLICY IF EXISTS "Public update donations" ON public.donations;
CREATE POLICY "Public update donations" ON public.donations
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (amount > 0);

GRANT SELECT, INSERT, UPDATE ON public.donations TO anon, authenticated, service_role;

-- Repeat RLS grants on donations_2027 if present
DO $$
BEGIN
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    ALTER TABLE public.donations_2027 ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Public select donations_2027" ON public.donations_2027;
    CREATE POLICY "Public select donations_2027" ON public.donations_2027
      FOR SELECT TO anon, authenticated
      USING (true);

    DROP POLICY IF EXISTS "Public insert donations_2027" ON public.donations_2027;
    CREATE POLICY "Public insert donations_2027" ON public.donations_2027
      FOR INSERT TO anon, authenticated
      WITH CHECK (amount > 0);

    DROP POLICY IF EXISTS "Public update donations_2027" ON public.donations_2027;
    CREATE POLICY "Public update donations_2027" ON public.donations_2027
      FOR UPDATE TO anon, authenticated
      USING (true)
      WITH CHECK (amount > 0);

    GRANT SELECT, INSERT, UPDATE ON public.donations_2027 TO anon, authenticated, service_role;
  END IF;
END $$;

-- 4. Authoritative RPC to record donation with server-side security
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
  v_token text := COALESCE(p_token, upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6)));
  v_rec record;
BEGIN
  INSERT INTO public.donations (
    id,
    donor_name,
    mobile_number,
    email,
    amount,
    purpose,
    payment_method,
    transaction_id,
    gateway_invoice_number,
    token,
    qr_token,
    donation_date,
    date,
    year,
    payment_status,
    created_at
  )
  VALUES (
    p_id,
    p_donor_name,
    p_mobile_number,
    COALESCE(p_email, ''),
    p_amount,
    COALESCE(p_purpose, 'General Reunion Fund'),
    COALESCE(p_payment_method, 'bkash'),
    COALESCE(p_transaction_id, 'TRX'),
    p_gateway_invoice_number,
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
    token = COALESCE(EXCLUDED.token, public.donations.token)
  RETURNING * INTO v_rec;

  -- Also sync to donations_2027 if table exists
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    INSERT INTO public.donations_2027 (
      id, donor_name, mobile_number, email, amount, purpose,
      payment_method, transaction_id, gateway_invoice_number,
      token, qr_token, date, year, payment_status, created_at
    )
    VALUES (
      v_rec.id, v_rec.donor_name, v_rec.mobile_number, v_rec.email, v_rec.amount, v_rec.purpose,
      v_rec.payment_method, v_rec.transaction_id, v_rec.gateway_invoice_number,
      v_rec.token, v_rec.token, v_rec.date, v_rec.year, 'paid', now()
    )
    ON CONFLICT (id) DO UPDATE SET
      amount = EXCLUDED.amount,
      payment_status = 'paid',
      token = COALESCE(EXCLUDED.token, public.donations_2027.token);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'donation', row_to_json(v_rec)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_record_donation(text, text, text, text, numeric, text, text, text, text, text, int) TO anon, authenticated, service_role;

-- 5. Dedicated RPC to lookup donation by ID, Token, or Mobile
CREATE OR REPLACE FUNCTION public.rpc_lookup_donation(
  p_identifier text,
  p_mobile text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_donation record;
  v_clean text := upper(trim(COALESCE(p_identifier, '')));
  v_clean_mobile text := regexp_replace(COALESCE(p_mobile, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_clean_mobile != '' THEN
    SELECT * INTO v_donation
    FROM public.donations
    WHERE (upper(id) = v_clean OR upper(token) = v_clean OR upper(qr_token) = v_clean)
      AND (mobile_number LIKE '%' || v_clean_mobile OR v_clean_mobile LIKE '%' || mobile_number)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_donation
    FROM public.donations
    WHERE upper(id) = v_clean
       OR upper(token) = v_clean
       OR upper(qr_token) = v_clean
       OR mobile_number = v_clean
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No donation record found matching criteria.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'donation', row_to_json(v_donation)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lookup_donation(text, text) TO anon, authenticated, service_role;

-- 6. Flexible dual-purpose rpc_lookup_ticket (supports registrations & donations)
CREATE OR REPLACE FUNCTION public.rpc_lookup_ticket(
  p_identifier text,
  p_mobile text DEFAULT NULL
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
  -- 1. Try finding student registration first
  IF v_clean_mobile != '' THEN
    SELECT * INTO v_student
    FROM public.registrations_2027
    WHERE (upper(id) = v_clean OR upper(qr_token) = v_clean)
      AND (mobile_number LIKE '%' || v_clean_mobile OR v_clean_mobile LIKE '%' || mobile_number)
    LIMIT 1;
  ELSE
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

  -- 2. If no student found, search in donations
  IF v_clean_mobile != '' THEN
    SELECT * INTO v_donation
    FROM public.donations
    WHERE (upper(id) = v_clean OR upper(token) = v_clean OR upper(qr_token) = v_clean)
      AND (mobile_number LIKE '%' || v_clean_mobile OR v_clean_mobile LIKE '%' || mobile_number)
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
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
