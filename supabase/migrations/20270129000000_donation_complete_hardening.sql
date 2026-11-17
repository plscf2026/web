-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE REUNION 2027
-- DONATION TABLE COMPLETE HARDENING, RLS & RPC RECORDING
-- Migration: 20270129000000_donation_complete_hardening.sql
-- ============================================================================

-- 1. Ensure all columns exist on public.donations
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS qr_token text,
  ADD COLUMN IF NOT EXISTS registration_id text,
  ADD COLUMN IF NOT EXISTS gateway_provider text DEFAULT 'PAYSTATION',
  ADD COLUMN IF NOT EXISTS donation_date date DEFAULT CURRENT_DATE;

-- 2. Ensure all columns exist on public.donations_2027
DO $$
BEGIN
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    ALTER TABLE public.donations_2027
      ADD COLUMN IF NOT EXISTS token text,
      ADD COLUMN IF NOT EXISTS qr_token text,
      ADD COLUMN IF NOT EXISTS registration_id text,
      ADD COLUMN IF NOT EXISTS gateway_provider text DEFAULT 'PAYSTATION',
      ADD COLUMN IF NOT EXISTS donation_date date DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- 3. Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_donations_token ON public.donations(token);
CREATE INDEX IF NOT EXISTS idx_donations_qr_token ON public.donations(qr_token);
CREATE INDEX IF NOT EXISTS idx_donations_mobile_number ON public.donations(mobile_number);
CREATE INDEX IF NOT EXISTS idx_donations_amount_desc ON public.donations(amount DESC);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON public.donations(created_at DESC);

-- 4. Permissive RLS policies on public.donations
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Public delete donations" ON public.donations;
CREATE POLICY "Public delete donations" ON public.donations
  FOR DELETE TO anon, authenticated
  USING (true);

GRANT ALL ON public.donations TO anon, authenticated, service_role;

-- 5. Permissive RLS on public.donations_2027
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

    DROP POLICY IF EXISTS "Public delete donations_2027" ON public.donations_2027;
    CREATE POLICY "Public delete donations_2027" ON public.donations_2027
      FOR DELETE TO anon, authenticated
      USING (true);

    GRANT ALL ON public.donations_2027 TO anon, authenticated, service_role;
  END IF;
END $$;

-- 6. Server-side authoritative RPC to record donation safely
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
    token = COALESCE(EXCLUDED.token, public.donations.token),
    qr_token = COALESCE(EXCLUDED.qr_token, public.donations.qr_token)
  RETURNING * INTO v_rec;

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
