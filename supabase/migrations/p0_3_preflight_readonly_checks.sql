-- ============================================================================
-- P0-3 READ-ONLY PREFLIGHT / DUPLICATE DETECTION SQL
-- Run this on your Supabase/remote staging database BEFORE applying the
-- P0-3 migration. This script is 100% read-only: no INSERT, UPDATE, DELETE.
-- If any check reports duplicates or anomalies, STOP and report before migrating.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== P0-3 READ-ONLY PREFLIGHT CHECKS ==='
\echo ''

-- ── 1. Check for duplicate transaction_id in registrations_2027 ─────────────
\echo '1. Duplicate transaction_id in registrations_2027:'
SELECT
  upper(trim(transaction_id)) AS normalized_trx_id,
  COUNT(*) AS occurrences,
  array_agg(id ORDER BY registered_at) AS registration_ids
FROM public.registrations_2027
WHERE transaction_id IS NOT NULL AND trim(transaction_id) <> ''
GROUP BY upper(trim(transaction_id))
HAVING COUNT(*) > 1;

\echo '   (0 rows = CLEAN)'
\echo ''

-- ── 2. Check for duplicate gateway_invoice_number in registrations_2027 ─────
\echo '2. Duplicate gateway_invoice_number in registrations_2027:'
SELECT
  gateway_invoice_number,
  COUNT(*) AS occurrences,
  array_agg(id ORDER BY registered_at) AS registration_ids
FROM public.registrations_2027
WHERE gateway_invoice_number IS NOT NULL AND trim(gateway_invoice_number) <> ''
GROUP BY gateway_invoice_number
HAVING COUNT(*) > 1;

\echo '   (0 rows = CLEAN)'
\echo ''

-- ── 3. Check for duplicate qr_token in registrations_2027 ───────────────────
\echo '3. Duplicate qr_token in registrations_2027:'
SELECT
  qr_token,
  COUNT(*) AS occurrences,
  array_agg(id ORDER BY registered_at) AS registration_ids
FROM public.registrations_2027
WHERE qr_token IS NOT NULL AND trim(qr_token) <> ''
GROUP BY qr_token
HAVING COUNT(*) > 1;

\echo '   (0 rows = CLEAN)'
\echo ''

-- ── 4. Check for transaction_id anti-replay violations (trx on different regs) ─
\echo '4. Same transaction_id used on multiple different registration IDs:'
SELECT
  upper(trim(transaction_id)) AS normalized_trx_id,
  COUNT(DISTINCT id) AS distinct_registrations,
  array_agg(DISTINCT id ORDER BY id) AS ids
FROM public.registrations_2027
WHERE transaction_id IS NOT NULL AND trim(transaction_id) <> ''
GROUP BY upper(trim(transaction_id))
HAVING COUNT(DISTINCT id) > 1;

\echo '   (0 rows = CLEAN — no anti-replay violations)'
\echo ''

-- ── 5. Check for duplicate mobile numbers in registrations_2027 ─────────────
\echo '5. Duplicate mobile numbers (normalized) in registrations_2027:'
SELECT
  CASE
    WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') LIKE '880%'
      THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 4)
    ELSE regexp_replace(mobile_number, '[^0-9]', '', 'g')
  END AS normalized_mobile,
  COUNT(*) AS registrations,
  array_agg(id ORDER BY registered_at) AS ids,
  array_agg(payment_status ORDER BY registered_at) AS statuses
FROM public.registrations_2027
WHERE mobile_number IS NOT NULL AND trim(mobile_number) <> ''
GROUP BY normalized_mobile
HAVING COUNT(*) > 1
ORDER BY registrations DESC;

\echo '   (review — duplicates may be parent+student; check statuses)'
\echo ''

-- ── 6. Paid registrations with NULL or empty transaction_id ─────────────────
\echo '6. Paid registrations with missing transaction_id (data integrity check):'
SELECT id, full_name, payment_status, total_paid, gateway_invoice_number, registered_at
FROM public.registrations_2027
WHERE payment_status = 'paid'
  AND (transaction_id IS NULL OR trim(transaction_id) = '')
ORDER BY registered_at DESC;

\echo '   (0 rows = CLEAN; rows here indicate incomplete payment records)'
\echo ''

-- ── 7. Paid registrations with NULL qr_token ────────────────────────────────
\echo '7. Paid registrations with missing qr_token:'
SELECT id, full_name, payment_status, registered_at
FROM public.registrations_2027
WHERE payment_status = 'paid'
  AND (qr_token IS NULL OR trim(qr_token) = '')
ORDER BY registered_at DESC;

\echo '   (0 rows = CLEAN)'
\echo ''

-- ── 8. current_student_ids data integrity ───────────────────────────────────
\echo '8. current_student_ids with inconsistent state (USED but no used_registration_id):'
SELECT id, student_id, verification_status, used_registration_id, reserved_until
FROM public.current_student_ids
WHERE verification_status = 'USED' AND used_registration_id IS NULL;

\echo '   (0 rows = CLEAN)'
\echo ''

-- ── 9. Orphaned pending_orders (paid but no matching registration) ───────────
\echo '9. Orphaned pending_orders (status=paid but promoted_registration_id missing or not in registrations_2027):'
SELECT
  po.id,
  po.invoice_number,
  po.amount,
  po.status,
  po.promoted_registration_id,
  po.created_at
FROM public.pending_orders po
WHERE po.status = 'paid'
  AND (
    po.promoted_registration_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.registrations_2027 r WHERE r.id = po.promoted_registration_id
    )
  )
ORDER BY po.created_at DESC;

\echo '   (0 rows = CLEAN; rows here indicate orphaned paid orders needing manual review)'
\echo ''

-- ── 10. Check if system_settings table already exists ───────────────────────
\echo '10. system_settings table existence check:'
SELECT
  CASE
    WHEN to_regclass('public.system_settings') IS NOT NULL
    THEN 'EXISTS (migration will UPDATE existing portal_fee_settings)'
    ELSE 'DOES NOT EXIST (migration will CREATE it fresh)'
  END AS status;

\echo ''

-- ── 11. Summary counts ───────────────────────────────────────────────────────
\echo '=== SUMMARY COUNTS ==='
SELECT
  (SELECT COUNT(*) FROM public.registrations_2027) AS total_registrations,
  (SELECT COUNT(*) FROM public.registrations_2027 WHERE payment_status = 'paid') AS paid_registrations,
  (SELECT COUNT(*) FROM public.registrations_2027 WHERE payment_status = 'pending') AS pending_registrations,
  (SELECT COUNT(*) FROM public.pending_orders) AS total_pending_orders,
  (SELECT COUNT(*) FROM public.current_student_ids) AS total_student_ids,
  (SELECT COUNT(*) FROM public.current_student_ids WHERE verification_status = 'AVAILABLE') AS available_student_ids,
  (SELECT COUNT(*) FROM public.current_student_ids WHERE verification_status = 'USED') AS used_student_ids;

\echo ''
\echo '=== PREFLIGHT COMPLETE — Review all results above before applying P0-3 migration ==='
