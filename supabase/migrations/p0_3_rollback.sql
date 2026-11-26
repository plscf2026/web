-- ============================================================================
-- SAFE & EXPLICIT P0-3 ROLLBACK SQL
-- ============================================================================
-- SECURITY POLICY (P2):
--   Routine rollback reverts P0-3 schema additions (unique anti-replay indexes
--   and newly added helper RPCs) while KEEPING fail-closed PII protections and
--   service_role-only payment execution in place.
--
--   This script intentionally DOES NOT restore legacy anonymous `GRANT ALL`,
--   broad `SELECT USING (true)` PII table policies, or `anon` EXECUTE grants on
--   payment RPCs (`rpc_verify_payment`, `rpc_handle_paystation_ipn`,
--   `rpc_promote_pending_order_to_registration`, `rpc_record_donation`,
--   `rpc_reconcile_pending_orders`).
--
--   Run only on a disposable/staging database during rollback validation.
-- ============================================================================

BEGIN;

-- 1. Enforce fail-closed payment RPC grants even after rollback
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'rpc_verify_payment',
        'rpc_handle_paystation_ipn',
        'rpc_promote_pending_order_to_registration',
        'rpc_reconcile_pending_orders',
        'rpc_record_donation',
        'rpc_secure_ticket_lookup'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- 2. Remove P0-3 anti-replay indexes (can be re-applied cleanly by 20270310)
DROP INDEX IF EXISTS public.uq_reg_2027_trx_id_nonempty;
DROP INDEX IF EXISTS public.uq_payment_trx_id_nonempty;
DROP INDEX IF EXISTS public.uq_donations_trx_id_nonempty;

-- 3. Drop P0-3 helper RPCs added by 20270310 / 20270311
DROP FUNCTION IF EXISTS public.rpc_reserve_student_id(TEXT, INT);
DROP FUNCTION IF EXISTS public.rpc_release_student_id_reservation(TEXT);
DROP FUNCTION IF EXISTS public.rpc_verify_student_id(TEXT);
DROP FUNCTION IF EXISTS public.rpc_compute_expected_order_amount(TEXT, TEXT, BOOLEAN, NUMERIC, TEXT, INT);

-- 4. Maintain safe non-PII table isolation on rollback (fallback secure policies)
--    Pending orders & donations & student IDs & registrations remain blocked for anon.
REVOKE ALL ON public.pending_orders FROM anon, PUBLIC;
REVOKE ALL ON public.donations FROM anon, PUBLIC;
REVOKE ALL ON public.current_student_ids FROM anon, PUBLIC;
REVOKE ALL ON public.registrations_2027 FROM anon, PUBLIC;

DO $$
BEGIN
  IF to_regclass('public.donations_2027') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.donations_2027 FROM anon, PUBLIC';
  END IF;
END $$;

COMMIT;

-- Note: Restoring pre-P0-3 broad public reads/writes is prohibited in routine
-- rollbacks because it immediately exposes registration PII and opens payment
-- RPC fraud. Re-apply 20270310 + 20270311 + 20270312 after rollback testing.
