-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE REUNION 2027
-- CANONICAL DONATIONS TABLE CONSOLIDATION & SYNCHRONIZATION
-- Migration: 20270123000000_consolidate_donation_tables.sql
-- ============================================================================

-- 1. Ensure public.donations schema supports all required fields
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT 2027;

CREATE INDEX IF NOT EXISTS idx_donations_payment_status ON public.donations(payment_status);
CREATE INDEX IF NOT EXISTS idx_donations_mobile ON public.donations(mobile_number);
CREATE INDEX IF NOT EXISTS idx_donations_reg_id ON public.donations(registration_id);

-- 2. Ensure RLS policies allow public donation submissions and admin management
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'donations' AND policyname = 'Public insert donations'
  ) THEN
    CREATE POLICY "Public insert donations" ON public.donations
      FOR INSERT TO anon, authenticated
      WITH CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'donations' AND policyname = 'Public view confirmed donations'
  ) THEN
    CREATE POLICY "Public view confirmed donations" ON public.donations
      FOR SELECT TO anon, authenticated
      USING (payment_status = 'paid');
  END IF;
END $$;

GRANT SELECT, INSERT ON public.donations TO anon, authenticated;

-- 3. Backfill any historical records from public.donations_2027 into canonical public.donations
DO $$
BEGIN
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    INSERT INTO public.donations (
      id,
      donor_name,
      mobile_number,
      email,
      amount,
      purpose,
      payment_method,
      transaction_id,
      donation_date,
      date,
      year,
      payment_status,
      created_at
    )
    SELECT
      d.id,
      d.donor_name,
      d.mobile_number,
      d.email,
      d.amount,
      d.purpose,
      d.payment_method,
      d.transaction_id,
      d.date AS donation_date,
      d.date AS date,
      d.year,
      COALESCE(d.payment_status, 'paid') AS payment_status,
      COALESCE(d.created_at, now()) AS created_at
    FROM public.donations_2027 d
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 4. Bidirectional safety trigger: Replicate any writes to donations_2027 into public.donations
CREATE OR REPLACE FUNCTION public.sync_donations_2027_to_canonical()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    donation_date,
    date,
    year,
    payment_status,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.donor_name,
    NEW.mobile_number,
    NEW.email,
    NEW.amount,
    NEW.purpose,
    NEW.payment_method,
    NEW.transaction_id,
    NEW.date,
    NEW.date,
    NEW.year,
    COALESCE(NEW.payment_status, 'paid'),
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    amount = EXCLUDED.amount,
    payment_status = EXCLUDED.payment_status,
    transaction_id = EXCLUDED.transaction_id;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_sync_donations_2027_to_canonical ON public.donations_2027;
    CREATE TRIGGER trg_sync_donations_2027_to_canonical
      AFTER INSERT OR UPDATE ON public.donations_2027
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_donations_2027_to_canonical();
  END IF;
END $$;
