-- ============================================================================
-- PRODUCTION DATABASE INTEGRITY, CONSTRAINT REPAIR & HIGH-SCALE INDEXING
-- Migration: 20270104000000_fix_financial_ledger_constraint.sql
-- Target Project: hnthoszbkhvygoowtvau
-- ============================================================================

-- 1. FIX FINANCIAL LEDGER CONSTRAINT FOR REGISTRATION INFLOW
-- The rpc_verify_payment function logs online payment inflows with
-- transaction_type = 'REGISTRATION_INFLOW'.
-- The initial check constraint only permitted ('ALLOCATION', 'EXPENSE', 'ADJUSTMENT', 'CASH_RETURN').
-- This updates the constraint to permit 'REGISTRATION_INFLOW'.

ALTER TABLE IF EXISTS public.financial_ledger
  DROP CONSTRAINT IF EXISTS financial_ledger_transaction_type_check;

ALTER TABLE IF EXISTS public.financial_ledger
  ADD CONSTRAINT financial_ledger_transaction_type_check
  CHECK (transaction_type IN ('ALLOCATION', 'EXPENSE', 'ADJUSTMENT', 'CASH_RETURN', 'REGISTRATION_INFLOW'));

-- 2. HIGH-SCALE PERFORMANCE INDEXES (FOR 10,000+ REGISTRATIONS)
-- Optimizes batch grouping, year filtering, date-range analytics, and audit lookups.

CREATE INDEX IF NOT EXISTS idx_reg_2027_batch_name 
  ON public.registrations_2027 (batch_name);

CREATE INDEX IF NOT EXISTS idx_reg_2027_passing_year 
  ON public.registrations_2027 (passing_year) 
  WHERE passing_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reg_2027_registered_at_desc 
  ON public.registrations_2027 (registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_id_cards_year_status 
  ON public.student_id_cards (event_year, card_status);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_date 
  ON public.admin_audit_logs (admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_expenses_staff_status 
  ON public.staff_expenses (staff_id, status);

-- 3. HARDEN PAYMENT-RECEIPTS STORAGE BUCKET RLS POLICY
-- Ensures only safe image and document extensions can be uploaded to payment-receipts.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can upload payment receipt') THEN
    DROP POLICY "Public can upload payment receipt" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "Public can upload payment receipt"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-receipts' 
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'pdf'))
  );
