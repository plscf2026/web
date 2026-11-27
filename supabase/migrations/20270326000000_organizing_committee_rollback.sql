-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR — GRAND REUNION 2027
-- ROLLBACK: 20270326000000_organizing_committee_rollback.sql
-- DESCRIPTION: Safely roll back Organizing Committee CMS database tables.
-- ============================================================================

-- 1. Remove from Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.organizing_committee_members;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.organizing_committee_settings;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;

-- 2. Drop RLS policies
DROP POLICY IF EXISTS "organizing_committee_members_select_all" ON public.organizing_committee_members;
DROP POLICY IF EXISTS "organizing_committee_members_write_all" ON public.organizing_committee_members;
DROP POLICY IF EXISTS "organizing_committee_settings_select_all" ON public.organizing_committee_settings;
DROP POLICY IF EXISTS "organizing_committee_settings_write_all" ON public.organizing_committee_settings;

-- 3. Drop tables
DROP TABLE IF EXISTS public.organizing_committee_members CASCADE;
DROP TABLE IF EXISTS public.organizing_committee_settings CASCADE;
