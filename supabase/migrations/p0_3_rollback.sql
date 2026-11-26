-- ============================================================================
-- P0-3 ROLLBACK SQL
-- Apply this script to undo the P0-3 migration (20270310000000_p0_3_...).
-- Run only on staging/disposable DB. Never against production.
-- ============================================================================

BEGIN;

-- 1. Restore rpc_verify_payment grants to anon/authenticated
GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) TO anon, authenticated;

-- 2. Restore rpc_handle_paystation_ipn grants
GRANT EXECUTE ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- 3. Restore rpc_promote_pending_order_to_registration grants
GRANT EXECUTE ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated;

-- 4. Restore rpc_reconcile_pending_orders grants
GRANT EXECUTE ON FUNCTION public.rpc_reconcile_pending_orders(INT) TO anon, authenticated;

-- 5. Restore rpc_record_donation grants
GRANT EXECUTE ON FUNCTION public.rpc_record_donation(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, INT) TO anon, authenticated;

-- 6. Remove anti-replay indexes
DROP INDEX IF EXISTS public.uq_reg_2027_trx_id_nonempty;
DROP INDEX IF EXISTS public.uq_payment_trx_id_nonempty;
DROP INDEX IF EXISTS public.uq_donations_trx_id_nonempty;

-- 7. Restore pending_orders anon access
DROP POLICY IF EXISTS "pending_orders_admin_read" ON public.pending_orders;
DROP POLICY IF EXISTS "pending_orders_service_all" ON public.pending_orders;
CREATE POLICY "pending_orders_anon_insert" ON public.pending_orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "pending_orders_anon_select" ON public.pending_orders
  FOR SELECT TO anon, authenticated USING (true);
GRANT ALL ON public.pending_orders TO anon, authenticated;

-- 8. Restore donations & donations_2027 anon write access
DROP POLICY IF EXISTS "donations_anon_read_paid" ON public.donations;
DROP POLICY IF EXISTS "donations_service_all" ON public.donations;
DROP POLICY IF EXISTS "donations_admin_all" ON public.donations;
CREATE POLICY "Public select donations" ON public.donations
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert donations" ON public.donations
  FOR INSERT TO anon, authenticated WITH CHECK (amount > 0);
CREATE POLICY "Public update donations" ON public.donations
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (amount > 0);
CREATE POLICY "Public delete donations" ON public.donations
  FOR DELETE TO anon, authenticated USING (true);
GRANT ALL ON public.donations TO anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "donations_2027_anon_read_paid" ON public.donations_2027';
    EXECUTE 'DROP POLICY IF EXISTS "donations_2027_service_all" ON public.donations_2027';
    EXECUTE 'DROP POLICY IF EXISTS "donations_2027_admin_all" ON public.donations_2027';
    EXECUTE 'CREATE POLICY "Public select donations_2027" ON public.donations_2027 FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "Public insert donations_2027" ON public.donations_2027 FOR INSERT TO anon, authenticated WITH CHECK (amount > 0)';
    EXECUTE 'CREATE POLICY "Public update donations_2027" ON public.donations_2027 FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (amount > 0)';
    EXECUTE 'CREATE POLICY "Public delete donations_2027" ON public.donations_2027 FOR DELETE TO anon, authenticated USING (true)';
    EXECUTE 'GRANT ALL ON public.donations_2027 TO anon, authenticated, service_role';
  END IF;
END $$;

-- 9. Restore current_student_ids anon write access
DROP POLICY IF EXISTS "current_student_ids_anon_select" ON public.current_student_ids;
DROP POLICY IF EXISTS "Service role full access on current_student_ids" ON public.current_student_ids;
CREATE POLICY "Public can insert current student ids" ON public.current_student_ids
  FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can update current student ids" ON public.current_student_ids
  FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete current student ids" ON public.current_student_ids
  FOR DELETE TO public USING (true);
GRANT ALL ON public.current_student_ids TO anon, authenticated;

-- 10. Restore registrations_2027 anon INSERT/UPDATE/DELETE (from 20270124)
GRANT INSERT, UPDATE, DELETE ON public.registrations_2027 TO anon;

-- 11. Drop reservation RPCs
DROP FUNCTION IF EXISTS public.rpc_reserve_student_id(TEXT, INT);
DROP FUNCTION IF EXISTS public.rpc_release_student_id_reservation(TEXT);

-- 12. Drop system_settings table (only if no manual admin changes were made)
-- WARNING: This drops the portal_fee_settings. Only run if you are sure.
-- DROP TABLE IF EXISTS public.system_settings;

COMMIT;

-- Note: To fully revert rpc_verify_payment, rpc_handle_paystation_ipn,
-- and rpc_promote_pending_order_to_registration to their pre-P0-3 definitions,
-- re-run migrations 20270116 and 20270117 manually.
