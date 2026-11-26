-- ============================================================================
-- Migration: Allow anon RLS evaluation of current_admin_role() & current_event_staff_role()
-- Fixes: "permission denied for function current_admin_role" during public
--        student registration photo uploads to storage.objects (`student-photos`).
-- Security: Both functions short-circuit on auth.uid() IS NOT NULL and return NULL
--           for anonymous visitors, identical to current_admin_id() and is_super_admin_caller().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role
  FROM public.admin_accounts
  WHERE auth.uid() IS NOT NULL
    AND auth_user_id = auth.uid()
    AND (status = 'ACTIVE' OR status IS NULL)
    AND is_locked IS NOT TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_event_staff_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role
  FROM public.staff_accounts
  WHERE auth.uid() IS NOT NULL
    AND auth_user_id = auth.uid()
    AND status = 'ACTIVE'
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_admin_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_event_staff_role() TO anon, authenticated, service_role;
