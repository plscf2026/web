-- ==============================================================================
-- Migration: 20270109000000_grant_rpc_verify_payment_to_anon.sql
-- Description: Grant execute permission on rpc_verify_payment and
--              rpc_handle_paystation_ipn to anon, authenticated, and service_role.
--              This allows anonymous guests registering online to authoritatively
--              verify and complete their registration payments.
-- ==============================================================================

-- 1. Ensure public schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant execute on 6-parameter rpc_verify_payment if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'rpc_verify_payment'
      AND pronargs = 6
  ) THEN
    GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;
    RAISE NOTICE 'Granted EXECUTE on 6-arg rpc_verify_payment to anon, authenticated, service_role';
  END IF;
END $$;

-- 3. Grant execute on 7-parameter rpc_verify_payment if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'rpc_verify_payment'
      AND pronargs = 7
  ) THEN
    GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
    RAISE NOTICE 'Granted EXECUTE on 7-arg rpc_verify_payment to anon, authenticated, service_role';
  END IF;
END $$;

-- 4. Grant execute on rpc_handle_paystation_ipn if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'rpc_handle_paystation_ipn'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
    RAISE NOTICE 'Granted EXECUTE on rpc_handle_paystation_ipn to anon, authenticated, service_role';
  END IF;
END $$;

-- 5. Fallback wildcard grant on public functions for rpc_verify_payment
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname IN ('rpc_verify_payment', 'rpc_handle_paystation_ipn', 'rpc_secure_ticket_lookup')
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', func_record.func_sig);
  END LOOP;
END $$;

