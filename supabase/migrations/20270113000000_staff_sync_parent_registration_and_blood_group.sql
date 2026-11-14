-- ==============================================================================
-- Police Lines School & College, Faridpur — Reunion 2027 Platform
-- Migration: 20270113000000_staff_sync_parent_registration_and_blood_group.sql
-- Description:
--   1. Adds parent registration columns, blood group, gender, gateway charge to registrations_2027
--   2. Enables realtime bidirectional synchronization for staff distribution & gate check-in
--   3. Configures RLS policies for instant scanner station <-> admin dashboard sync
-- ==============================================================================

-- 1. EXTEND REGISTRATIONS_2027 WITH PARENT, GENDER, BLOOD GROUP & GATEWAY CHARGE
ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male',
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS has_parent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_age TEXT,
  ADD COLUMN IF NOT EXISTS parent_phone TEXT,
  ADD COLUMN IF NOT EXISTS parent_relation TEXT,
  ADD COLUMN IF NOT EXISTS parent_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_charge NUMERIC DEFAULT 0;

-- 2. GRANT RLS PERMISSIONS FOR REALTIME STAFF SYNC
DROP POLICY IF EXISTS "food_distributions_all_access" ON public.food_distributions;
CREATE POLICY "food_distributions_all_access" ON public.food_distributions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dress_distributions_all_access" ON public.dress_distributions;
CREATE POLICY "dress_distributions_all_access" ON public.dress_distributions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gate_events_all_access" ON public.gate_events;
CREATE POLICY "gate_events_all_access" ON public.gate_events
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Allow staff stations to update attendance and collection flags on registrations_2027
DROP POLICY IF EXISTS "registrations_2027_staff_update_flags" ON public.registrations_2027;
CREATE POLICY "registrations_2027_staff_update_flags" ON public.registrations_2027
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.food_distributions TO anon, authenticated;
GRANT ALL ON public.dress_distributions TO anon, authenticated;
GRANT ALL ON public.gate_events TO anon, authenticated;
GRANT SELECT, UPDATE ON public.registrations_2027 TO anon, authenticated;

-- 3. ENABLE REALTIME PUBLICATION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.food_distributions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dress_distributions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.gate_events;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations_2027;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
