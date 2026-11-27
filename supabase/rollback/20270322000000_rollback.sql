-- ============================================================================
-- ROLLBACK: 20270322000000_rollback.sql
-- Reverses grants and policy changes from
--   20270322000000_security_rpc_and_rls_hardening.sql
-- NOTE: Only run this if an unexpected regression occurs after applying
--       Migration 1. Preserves all production rows cleanly.
-- ============================================================================

BEGIN;

-- Restore prior EXECUTE grants on RPCs (emergency rollback only)
GRANT EXECUTE ON FUNCTION public.rpc_admin_get_registrations(int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_paid_registrations() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_delete_registration(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_fetch_unified_audit_trail(int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_update_student_photo(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_manual_registration(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_staff_update_manual_registration(text, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_registration(text, text, text, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_registration(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_approve_manual_financial(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_reject_manual_financial(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_gate_event(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_toggle_gate_attendance(TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_food_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_toggle_food_distribution(TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_dress_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_toggle_tshirt_distribution(TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_generate_guest_card_batch(INT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_activate_guest_card(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_collect_guest_food(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_guest_card(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_update_meal_schedule(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_generate_staff_card_batch(INT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_activate_staff_card(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_collect_staff_food(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_staff_remaining_balance(TEXT) TO anon, authenticated, service_role;

-- Drop strict policies created in 20270322000000 and restore previous permissive policies where needed
DO $$
BEGIN
  IF to_regclass('public.food_distributions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "food_distributions_service_all" ON public.food_distributions;
    DROP POLICY IF EXISTS "food_distributions_staff_rw" ON public.food_distributions;
    GRANT ALL ON public.food_distributions TO anon, authenticated, service_role;
    CREATE POLICY "food_distributions_all_access" ON public.food_distributions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF to_regclass('public.dress_distributions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "dress_distributions_service_all" ON public.dress_distributions;
    DROP POLICY IF EXISTS "dress_distributions_staff_rw" ON public.dress_distributions;
    GRANT ALL ON public.dress_distributions TO anon, authenticated, service_role;
    CREATE POLICY "dress_distributions_all_access" ON public.dress_distributions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF to_regclass('public.gate_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "gate_events_service_all" ON public.gate_events;
    DROP POLICY IF EXISTS "gate_events_staff_rw" ON public.gate_events;
    GRANT ALL ON public.gate_events TO anon, authenticated, service_role;
    CREATE POLICY "gate_events_all_access" ON public.gate_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF to_regclass('public.manual_registrations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "manual_registrations_service_all" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_admin_read" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_admin_insert" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_admin_update" ON public.manual_registrations;
    DROP POLICY IF EXISTS "manual_registrations_admin_delete" ON public.manual_registrations;
    GRANT ALL ON public.manual_registrations TO anon, authenticated, service_role;
    CREATE POLICY "manual_registrations_select_all" ON public.manual_registrations FOR SELECT TO anon, authenticated, service_role USING (true);
    CREATE POLICY "manual_registrations_write_all" ON public.manual_registrations FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
  END IF;

  IF to_regclass('public.inquiries') IS NOT NULL THEN
    DROP POLICY IF EXISTS "inquiries_public_insert" ON public.inquiries;
    DROP POLICY IF EXISTS "inquiries_admin_all" ON public.inquiries;
    CREATE POLICY "Public visitors can submit inquiries" ON public.inquiries FOR INSERT WITH CHECK (true);
  END IF;
END $$;

COMMIT;
