-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR — GRAND REUNION 2027
-- MIGRATION: 20270121000000_create_inquiries_schema.sql
-- AUTHORITATIVE SCHEMA FOR PUBLIC CONTACT & GENERAL INQUIRIES
-- ============================================================================

-- 1. Create table public.inquiries
CREATE TABLE IF NOT EXISTS public.inquiries (
    id TEXT PRIMARY KEY DEFAULT ('INQ-' || substr(gen_random_uuid()::text, 1, 10)),
    name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'REVIEWED', 'RESOLVED', 'ARCHIVED')),
    admin_notes TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for efficient administration and filtering
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_mobile ON public.inquiries(mobile_number);

-- 3. Row Level Security (RLS)
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 3.1 Public visitors can submit contact inquiries (INSERT ONLY)
DROP POLICY IF EXISTS "Public visitors can submit inquiries" ON public.inquiries;
CREATE POLICY "Public visitors can submit inquiries"
    ON public.inquiries
    FOR INSERT
    WITH CHECK (true);

-- 3.2 Authenticated admins can view, review, and manage all inquiries
DROP POLICY IF EXISTS "Authenticated admins can view inquiries" ON public.inquiries;
CREATE POLICY "Authenticated admins can view inquiries"
    ON public.inquiries
    FOR SELECT
    TO authenticated, service_role
    USING (public.current_admin_role() = 'super_admin');

DROP POLICY IF EXISTS "Authenticated admins can update inquiries" ON public.inquiries;
CREATE POLICY "Authenticated admins can update inquiries"
    ON public.inquiries
    FOR UPDATE
    TO authenticated, service_role
    USING (public.current_admin_role() = 'super_admin')
    WITH CHECK (public.current_admin_role() = 'super_admin');

DROP POLICY IF EXISTS "Authenticated admins can delete inquiries" ON public.inquiries;
CREATE POLICY "Authenticated admins can delete inquiries"
    ON public.inquiries
    FOR DELETE
    TO authenticated, service_role
    USING (public.current_admin_role() = 'super_admin');

-- 3.3 Service role full access
DROP POLICY IF EXISTS "Service role full access on inquiries" ON public.inquiries;
CREATE POLICY "Service role full access on inquiries"
    ON public.inquiries
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT INSERT ON public.inquiries TO anon;
GRANT ALL ON public.inquiries TO authenticated, service_role;
