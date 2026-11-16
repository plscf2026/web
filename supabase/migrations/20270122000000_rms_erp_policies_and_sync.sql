-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE REUNION 2027
-- RMS ERP ACCESS & SYNC POLICIES
-- Migration: 20270122000000_rms_erp_policies_and_sync.sql
-- ============================================================================

-- Ensure authenticated staff and administrators can manage RMS committees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rms_committees' AND policyname = 'Staff manage committees'
  ) THEN
    CREATE POLICY "Staff manage committees" ON public.rms_committees
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rms_announcements' AND policyname = 'Staff manage announcements'
  ) THEN
    CREATE POLICY "Staff manage announcements" ON public.rms_announcements
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
