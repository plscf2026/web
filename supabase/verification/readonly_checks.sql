-- ============================================================================
-- PLSCF 2027 Reunion Portal — Read-Only Verification Checks (NO WRITES)
-- Paste into Supabase SQL Editor BEFORE and AFTER running the new migrations.
-- Contains strictly SELECT queries; modifies zero data or schema.
-- ============================================================================

-- 1. Check live `portal_fee_settings` (Verify paymentEnabled, parentFee, minDonation, maxDonation, open switches)
SELECT
  key,
  value->>'paymentEnabled' AS payment_enabled,
  value->>'registrationOpen' AS registration_open,
  value->>'alumniRegistrationOpen' AS alumni_open,
  value->>'currentStudentRegistrationOpen' AS current_student_open,
  value->>'donationOpen' AS donation_open,
  value->>'formerStudentFee' AS former_student_fee,
  value->>'currentStudentFee' AS current_student_fee,
  value->>'parentFee' AS parent_fee,
  value->>'minDonation' AS min_donation,
  value->>'maxDonation' AS max_donation,
  value->>'gatewayChargePercent' AS gateway_charge_percent,
  updated_at,
  updated_by
FROM public.system_settings
WHERE key IN ('portal_fee_settings', 'international_payment_info');

-- 2. Find any paid PayStation donations in pending_orders that were NOT yet recorded in public.donations
--    (Closed-browser donation cases prior to F-07 migration)
SELECT
  po.id AS pending_order_id,
  po.invoice_number,
  po.amount AS paid_total,
  po.fees->>'donationAmount' AS net_donation_amount,
  po.transaction_id,
  po.customer_name,
  right(regexp_replace(COALESCE(po.customer_phone, ''), '\D', '', 'g'), 4) AS phone_last4,
  po.status AS pending_order_status,
  po.reconciled_at,
  po.created_at
FROM public.pending_orders po
WHERE po.order_type = 'donation'
  AND lower(COALESCE(po.status, '')) = 'paid'
  AND NOT EXISTS (
    SELECT 1
    FROM public.donations d
    WHERE (po.invoice_number IS NOT NULL AND d.gateway_invoice_number = po.invoice_number)
       OR (po.transaction_id IS NOT NULL AND upper(trim(d.transaction_id)) = upper(trim(po.transaction_id)))
  )
ORDER BY po.created_at DESC;

-- 3. Check all SECURITY DEFINER RPCs still executable by PUBLIC or anon
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_execute,
  p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY anon_can_execute DESC, p.proname;

-- 4. Check RLS enabled status on all public tables (including backup tables)
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname;

-- 5. Check all active RLS policies using (true)
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    COALESCE(qual, '') ~* '\(\s*true\s*\)|^true$'
    OR COALESCE(with_check, '') ~* '\(\s*true\s*\)|^true$'
  )
ORDER BY tablename, policyname;

-- 6. Check anon table privileges across public schema
SELECT
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS anon_privileges
FROM information_schema.role_table_grants
WHERE grantee IN ('anon', 'PUBLIC')
  AND table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

-- 7. Check auth.users triggers (Verify whether Super Admin immutability trigger is active)
SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  n.nspname AS schema_name,
  t.tgenabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT t.tgisinternal
  AND (
    (n.nspname = 'auth' AND c.relname = 'users')
    OR (n.nspname = 'public' AND c.relname IN ('admin_accounts', 'staff_accounts'))
  )
ORDER BY n.nspname, c.relname, t.tgname;

-- 8. Check for any seeded demo/test emails still present in admin_accounts, staff_accounts, or auth.users
SELECT 'admin_accounts' AS source, id, username, role, status, email
FROM public.admin_accounts
WHERE lower(email) IN (
  'admin@gmail.com',
  'venue.admin@gmail.com',
  'moderator@gmail.com',
  'finance@gmail.com',
  'registration@gmail.com'
)
UNION ALL
SELECT 'staff_accounts' AS source, id, username, role, status, email
FROM public.staff_accounts
WHERE lower(email) IN (
  'admin@gmail.com',
  'venue.admin@gmail.com',
  'moderator@gmail.com',
  'finance@gmail.com',
  'registration@gmail.com'
);

SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE lower(email) IN (
  'admin@gmail.com',
  'venue.admin@gmail.com',
  'moderator@gmail.com',
  'finance@gmail.com',
  'registration@gmail.com'
)
   OR lower(email) LIKE 'test%@%';

-- 9. Check live Storage buckets and storage.objects policies
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
ORDER BY id;

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;
