-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR — GRAND REUNION 2027
-- MIGRATION: 20270128000000_enable_current_student_ids_admin_policies.sql
-- PERMITS FULL INSERT, UPDATE, AND DELETE MANAGEMENT ON current_student_ids
-- ============================================================================

-- 1. Ensure table permissions are granted
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.current_student_ids TO anon, authenticated, service_role;

-- 2. Drop any legacy restrictive policies
DROP POLICY IF EXISTS "Public can insert current student ids" ON public.current_student_ids;
DROP POLICY IF EXISTS "Public can update current student ids" ON public.current_student_ids;
DROP POLICY IF EXISTS "Public can delete current student ids" ON public.current_student_ids;

-- 3. Create permissive policies for student ID administration
CREATE POLICY "Public can insert current student ids"
    ON public.current_student_ids
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Public can update current student ids"
    ON public.current_student_ids
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public can delete current student ids"
    ON public.current_student_ids
    FOR DELETE
    TO public
    USING (true);
