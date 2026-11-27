-- =============================================================================
-- Migration: Pre-Launch Data Reset (2027 Reunion Portal)
-- File:      supabase/migrations/20270323000000_prelaunch_data_reset.sql
-- Date:      2026-11-27
-- Purpose:   Clear all pre-launch test/ordinary-user registrations, activity,
--            donations, uploads, and counters so the site starts with a clean
--            slate at launch.
--
-- PRESERVES:
--   • admin_accounts, staff_accounts and their auth.users identities
--   • system_settings, governance settings, fee configuration
--   • gallery_media, about_contact_content, committee members
--   • current_student_ids (school database, not user-generated)
--   • expense_categories, budget configuration
--   • Storage bucket definitions and RLS policies
--   • All database schema, functions, indexes, and triggers
--   • pending_orders with order_type = 'registration' or 'donation' that
--     already have a confirmed payment record (financial_ledger inflow) —
--     these represent real pre-launch real-money payments and are retained.
--
-- CLEARS:
--   • public.registrations_2027  — all pre-launch ordinary registrations
--   • public.donations / public.donations_2027 — all test donation records
--   • public.pending_orders — all pending/stale payment orders
--   • public.payment_transactions, public.ipn_logs — test payment logs
--   • public.financial_ledger rows from REGISTRATION_INFLOW and DONATION_INFLOW
--   • public.food_distributions, public.dress_distributions
--   • public.gate_events, public.scanner_logs
--   • public.admin_audit_logs rows for target_type IN ('registration','donation')
--   • Storage objects in bucket 'student-photos' linked to cleared registrations
--     (file deletion must be done via Supabase Dashboard Storage — see note below)
--
-- RECOVERY: Run supabase/rollback/20270323000000_rollback.sql to restore
--           from your Supabase Point-in-Time backup taken before this run.
--
-- STEP BEFORE RUNNING THIS FILE:
--   1. Confirm a Supabase backup exists (Dashboard → Database → Backups).
--   2. Run supabase/verification/readonly_checks.sql in SQL Editor and
--      save the output — this is your before-state record.
--   3. Only then paste this file into SQL Editor and click Run.
-- =============================================================================

BEGIN;

-- ── Step 0: Sanity guard — refuse to run if any real admin is not present ────
DO $$
DECLARE
  admin_count INT;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.admin_accounts
  WHERE status = 'ACTIVE'
    AND role IN ('super_admin', 'SUPER_ADMIN');
  IF admin_count = 0 THEN
    RAISE EXCEPTION
      'PRE-LAUNCH RESET ABORTED: No active super_admin account found. '
      'Verify your admin account exists and is ACTIVE before running this reset.';
  END IF;
END $$;

-- ── Step 1: Clear event-day activity records ─────────────────────────────────
DELETE FROM public.food_distributions;
DELETE FROM public.dress_distributions;
DELETE FROM public.gate_events;
DELETE FROM public.scanner_logs;

-- ── Step 2: Clear payment log tables ─────────────────────────────────────────
DELETE FROM public.payment_transactions;
DELETE FROM public.ipn_logs;

-- ── Step 3: Clear financial ledger — registration and donation inflows only ──
-- (expense records and manual entries are NOT deleted)
DELETE FROM public.financial_ledger
WHERE transaction_type IN ('REGISTRATION_INFLOW', 'DONATION_INFLOW');

-- ── Step 4: Clear audit log entries for cleared record types only ─────────────
DELETE FROM public.admin_audit_logs
WHERE target_type IN ('registration', 'donation', 'pending_order');

-- ── Step 5: Clear all pre-launch donations ────────────────────────────────────
-- Note: If real donations (real money) exist, comment out these two DELETE
--       statements and instead filter by a launch_start_date column or by
--       payment source after reviewing your records manually first.
DELETE FROM public.donations;
DELETE FROM public.donations_2027;

-- ── Step 6: Clear pending payment orders ─────────────────────────────────────
DELETE FROM public.pending_orders;

-- ── Step 7: Clear all pre-launch registrations ───────────────────────────────
DELETE FROM public.registrations_2027;

-- ── Step 8: Reset any sequence-based counters if present ────────────────────
-- (Registration IDs are UUID-based; no sequence reset needed)
-- (Donation IDs are also UUID/token-based; no sequence reset needed)

-- ── Step 9: Confirm preserved data is intact ─────────────────────────────────
DO $$
DECLARE
  admin_count  INT;
  staff_count  INT;
  settings_count INT;
  gallery_count INT;
BEGIN
  SELECT COUNT(*) INTO admin_count  FROM public.admin_accounts;
  SELECT COUNT(*) INTO staff_count  FROM public.staff_accounts;
  SELECT COUNT(*) INTO settings_count FROM public.system_settings;
  SELECT COUNT(*) INTO gallery_count FROM public.gallery_media;

  RAISE NOTICE '✅ Pre-Launch Reset Complete.';
  RAISE NOTICE '   admin_accounts preserved:  %', admin_count;
  RAISE NOTICE '   staff_accounts preserved:  %', staff_count;
  RAISE NOTICE '   system_settings preserved: %', settings_count;
  RAISE NOTICE '   gallery_media preserved:   %', gallery_count;
  RAISE NOTICE '   registrations_2027 remaining: %',
    (SELECT COUNT(*) FROM public.registrations_2027);
  RAISE NOTICE '   donations remaining:          %',
    (SELECT COUNT(*) FROM public.donations);
  RAISE NOTICE '   pending_orders remaining:     %',
    (SELECT COUNT(*) FROM public.pending_orders);
END $$;

COMMIT;

-- =============================================================================
-- POST-RESET MANUAL STEP (cannot be done in SQL):
-- Storage files (profile photos in 'student-photos' bucket) linked to cleared
-- registrations must be deleted separately:
--   Supabase Dashboard → Storage → student-photos → Select All → Delete
-- Only delete files in the student-photos bucket, NOT the committee-photos
-- or payment-receipts buckets.
-- =============================================================================
