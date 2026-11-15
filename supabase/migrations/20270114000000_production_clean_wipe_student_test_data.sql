-- =============================================================================
-- Migration: Production Clean Wipe of Student Test Data
-- Applied on: 2026-11-15
-- Objective: Purge all pre-production test registrations, mock payment
--            transactions, test financial ledger inflows, and distribution
--            records to ensure a 100% fresh, clean database for live launch.
-- =============================================================================

BEGIN;

-- 1. Purge station distributions and gate logs
DELETE FROM public.food_distributions;
DELETE FROM public.dress_distributions;
DELETE FROM public.gate_events;
DELETE FROM public.scanner_logs;

-- 2. Purge payment transactions and IPN logs
DELETE FROM public.payment_transactions;
DELETE FROM public.ipn_logs;

-- 3. Purge financial ledger registration inflows from tests
DELETE FROM public.financial_ledger WHERE transaction_type = 'REGISTRATION_INFLOW';

-- 4. Purge registration audit log traces
DELETE FROM public.admin_audit_logs WHERE target_type = 'registration';

-- 5. Purge test student registrations
DELETE FROM public.registrations_2027;
DELETE FROM public.registrations_2026;

COMMIT;
