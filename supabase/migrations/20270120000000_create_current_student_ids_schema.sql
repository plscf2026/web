-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR — GRAND REUNION 2027
-- MIGRATION: 20270120000000_create_current_student_ids_schema.sql
-- AUTHORITATIVE SCHEMA FOR CURRENT STUDENT ROLL & ID VERIFICATION
-- ============================================================================

-- 1. Create table public.current_student_ids
CREATE TABLE IF NOT EXISTS public.current_student_ids (
    id TEXT PRIMARY KEY DEFAULT ('SID-' || substr(gen_random_uuid()::text, 1, 10)),
    student_id TEXT UNIQUE NOT NULL,
    student_name TEXT,
    class_name TEXT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2026',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    verification_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (verification_status IN ('AVAILABLE', 'RESERVED', 'USED', 'ALREADY_USED')),
    used_registration_id TEXT,
    reserved_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast verification lookup and status filtering
CREATE INDEX IF NOT EXISTS idx_current_student_ids_lookup ON public.current_student_ids(student_id);
CREATE INDEX IF NOT EXISTS idx_current_student_ids_status ON public.current_student_ids(status, verification_status);
CREATE INDEX IF NOT EXISTS idx_current_student_ids_used_reg ON public.current_student_ids(used_registration_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.current_student_ids ENABLE ROW LEVEL SECURITY;

-- 3.1 Public read access for student roll validation during registration
DROP POLICY IF EXISTS "Public can view current student ids" ON public.current_student_ids;
CREATE POLICY "Public can view current student ids"
    ON public.current_student_ids
    FOR SELECT
    USING (true);

-- 3.2 Public reservation update (only for active, available student IDs)
DROP POLICY IF EXISTS "Public can update reservation on current student ids" ON public.current_student_ids;
CREATE POLICY "Public can update reservation on current student ids"
    ON public.current_student_ids
    FOR UPDATE
    USING (status = 'ACTIVE')
    WITH CHECK (status = 'ACTIVE');

-- 3.3 Full management access for authenticated administrative accounts
DROP POLICY IF EXISTS "Authenticated admins full access on current_student_ids" ON public.current_student_ids;
CREATE POLICY "Authenticated admins full access on current_student_ids"
    ON public.current_student_ids
    FOR ALL
    TO authenticated, service_role
    USING (public.current_admin_role() = 'super_admin')
    WITH CHECK (public.current_admin_role() = 'super_admin');

-- 3.4 Service role full access (Edge functions, background workers)
DROP POLICY IF EXISTS "Service role full access on current_student_ids" ON public.current_student_ids;
CREATE POLICY "Service role full access on current_student_ids"
    ON public.current_student_ids
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Grant table permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, UPDATE (verification_status, reserved_until, used_registration_id, updated_at) ON public.current_student_ids TO anon;
GRANT ALL ON public.current_student_ids TO authenticated, service_role;

-- 5. Seed initial official student records (Idempotent seed)
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status)
VALUES
    ('STU-REC-101', 'PLSC-2026-101', 'Samiul Islam', 'Class 10', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-102', 'PLSC-2026-102', 'Mehedi Hasan', 'Class 10', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-103', 'PLSC-2026-103', 'Fatema Tuj Zohra', 'Class 10', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-104', 'PLSC-2026-104', 'Ayesha Siddiqua', 'Class 12', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-105', 'PLSC-2026-105', 'Nafis Fuad', 'Class 9', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-106', 'PLSC-2026-106', 'Sadia Afrin', 'Class 11', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-107', 'PLSC-2026-107', 'Rifat Hossain', 'Class 11', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-108', 'PLSC-2026-108', 'Nusrat Binte Alam', 'Class 12', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-109', 'PLSC-2026-109', 'Tahsin Ahmed', 'Class 9', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-110', 'PLSC-2026-110', 'Farzana Akter', 'Class 10', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-111', 'PLSC-2026-111', 'Tanvir Mahmud', 'Class 12', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-112', 'PLSC-2026-112', 'Mahira Khan', 'Class 8', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-113', 'PLSC-2026-113', 'Zubair Rahman', 'Class 7', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-114', 'PLSC-2026-114', 'Samia Sultana', 'Class 6', '2026', 'ACTIVE', 'AVAILABLE'),
    ('STU-REC-115', 'PLSC-2026-115', 'Rayhan Kabir', 'Class 11', '2026', 'ACTIVE', 'AVAILABLE')
ON CONFLICT (student_id) DO UPDATE SET
    student_name = EXCLUDED.student_name,
    class_name = EXCLUDED.class_name,
    status = EXCLUDED.status,
    academic_year = EXCLUDED.academic_year;
