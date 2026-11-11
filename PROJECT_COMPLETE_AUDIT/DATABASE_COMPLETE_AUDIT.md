# Database complete audit

## Verification boundary

This is an audit of four repository SQL migrations, the embedded SQL generator, application queries, and TypeScript interfaces. **No live database connection or metadata query was performed.** The tables below are source-inferred schema, not a verified description of the current Supabase project. Migration application status is unknown.

## Source-defined tables

Types below are SQL declaration types. A check/default is noted where important. Unless stated otherwise, each table has a text `id` primary key.

| Table | Columns (type) | Keys, indexes and notes |
|---|---|---|
| `public.admin_accounts` | `id TEXT`, `username TEXT`, `password_hash TEXT` (dropped in hardening), `full_name TEXT`, `email TEXT`, `role TEXT`, `is_locked BOOLEAN`, `failed_attempts INTEGER`, `last_login_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ`; later `auth_user_id UUID` | `username` unique; role check; later FK `auth_user_id → auth.users(id) ON DELETE CASCADE`, partial unique index. |
| `public.admin_audit_logs` | `id TEXT`, `admin_id TEXT`, `admin_username TEXT`, `admin_role TEXT`, `action TEXT`, `target_type TEXT`, `target_id TEXT`, `details TEXT`, `ip_address TEXT`, `user_agent TEXT`, `checksum TEXT`, `created_at TIMESTAMPTZ` | No declared FK or secondary index. |
| `public.registrations_2026` | `id TEXT`, `full_name TEXT`, `full_name_bn TEXT`, `photo_url TEXT`, `mobile_number TEXT`, `email TEXT`, `address TEXT`, `category TEXT`, `passing_year TEXT`, `current_class TEXT`, `batch_name TEXT`, `group_or_section TEXT`, `roll_number TEXT`, `t_shirt_size TEXT`, `registration_fee NUMERIC`, `donation_amount NUMERIC`, `total_paid NUMERIC`, `payment_status TEXT`, `transaction_id TEXT`, `payment_method TEXT`, `server_verification_signature TEXT`, `verification_timestamp TIMESTAMPTZ`, `verified_by TEXT`, `registered_at TIMESTAMPTZ`, `qr_token TEXT`, `is_tshirt_collected BOOLEAN`, `is_checked_in BOOLEAN`, `notes TEXT`, `year INTEGER` | `qr_token` unique; category/size/payment state/method and nonnegative amount checks. Indexes on mobile, transaction ID, QR token, payment status; hardening adds unique expression index for normalized nonempty mobile. |
| `public.donations_2026` | `id TEXT`, `donor_name TEXT`, `mobile_number TEXT`, `email TEXT`, `amount NUMERIC`, `purpose TEXT`, `payment_method TEXT`, `transaction_id TEXT`, `payment_status TEXT`, `date TEXT`, `year INTEGER`, `created_at TIMESTAMPTZ` | Amount > 0; method/state checks; initial migration requires method and transaction ID; index on transaction ID. |
| `public.scanner_logs` | `id TEXT`, `registration_id TEXT`, `student_name TEXT`, `student_category TEXT`, `scan_type TEXT`, `staff_id TEXT`, `staff_name TEXT`, `gate_id TEXT`, `status TEXT`, `failure_reason TEXT`, `timestamp TIMESTAMPTZ` | Scan/status checks; no declared FK/index other than PK. |
| `public.staff_accounts` | `id TEXT`, `full_name TEXT`, `username TEXT`, `email TEXT`, `password_hash TEXT` (dropped in hardening), `role TEXT`, `status TEXT`, `assigned_gate TEXT`, `created_at TIMESTAMPTZ`, `created_by TEXT`; later `auth_user_id UUID` | Username/email unique; role/status checks; indexes on username/role; later FK to `auth.users(id) ON DELETE CASCADE` and partial unique auth-user index. |
| `public.food_distributions` | `id TEXT`, `registration_id TEXT`, `student_name TEXT`, `batch_name TEXT`, `meal_type TEXT`, `status TEXT`, `collected_at TIMESTAMPTZ`, `staff_id TEXT`, `staff_name TEXT`, `notes TEXT`, `corrected_by TEXT`, `correction_reason TEXT`, `corrected_at TIMESTAMPTZ` | Unique `(registration_id, meal_type)`; meal/status checks; indexes `(registration_id, meal_type)` and `meal_type`. |
| `public.gate_events` | `id TEXT`, `registration_id TEXT`, `student_name TEXT`, `batch_name TEXT`, `photo_url TEXT`, `event_type TEXT`, `gate_id TEXT`, `scanner_id TEXT`, `staff_id TEXT`, `staff_name TEXT`, `timestamp TIMESTAMPTZ`, `status TEXT`, `correction_reason TEXT`, `corrected_by TEXT`, `corrected_at TIMESTAMPTZ` | Event/status checks; indexes on registration ID and descending timestamp. |
| `public.dress_distributions` | `id TEXT`, `registration_id TEXT`, `student_name TEXT`, `item_type TEXT`, `registered_size TEXT`, `status TEXT`, `received_at TIMESTAMPTZ`, `staff_id TEXT`, `staff_name TEXT`, `notes TEXT`, `corrected_by TEXT`, `correction_reason TEXT`, `corrected_at TIMESTAMPTZ` | Unique `(registration_id, item_type)`; size/status checks; index on registration ID. Hardening adds `Oversize 50` size. |
| `public.central_budget` | `id TEXT`, `academic_year INTEGER`, `total_budget NUMERIC`, `description TEXT`, `updated_at TIMESTAMPTZ`, `updated_by TEXT` | Nonnegative budget check; no secondary index. |
| `public.staff_allocations` | `id TEXT`, `staff_id TEXT`, `staff_name TEXT`, `allocated_amount NUMERIC`, `academic_year INTEGER`, `status TEXT`, `allocated_at TIMESTAMPTZ`, `allocated_by TEXT`, `notes TEXT` | Positive amount/status checks; index on `staff_id`. |
| `public.staff_expenses` | `id TEXT`, `staff_id TEXT`, `staff_name TEXT`, `amount NUMERIC`, `category TEXT`, `description TEXT`, `expense_date TEXT`, `expense_time TEXT`, `vendor_name TEXT`, `receipt_url TEXT`, `status TEXT`, `approved_by TEXT`, `approved_at TIMESTAMPTZ`, `rejection_reason TEXT`, `void_reason TEXT`, `created_at TIMESTAMPTZ` | Positive amount/status checks; indexes on staff ID and status. |
| `public.financial_ledger` | `id TEXT`, `staff_id TEXT`, `transaction_type TEXT`, `amount NUMERIC`, `reference_id TEXT`, `description TEXT`, `created_at TIMESTAMPTZ`, `created_by TEXT` | Transaction-type check; index on staff ID. |
| `public.admin_audit_history` | `id TEXT`, `admin_id TEXT`, `admin_name TEXT`, `entity_type TEXT`, `entity_id TEXT`, `action TEXT`, `previous_value TEXT`, `new_value TEXT`, `reason TEXT`, `timestamp TIMESTAMPTZ` | Entity-type check; index `(entity_type, entity_id)`. |
| `private.ticket_lookup_rate_limits` | `subject_hash TEXT`, `window_started_at TIMESTAMPTZ`, `attempt_count INTEGER` | `subject_hash` primary key; attempt count > 0; private schema/table revoked from public, anon and authenticated. |

Supabase-managed objects referenced: `auth.users`, `storage.buckets`, and `storage.objects`. Migrations configure private `student-photos` and `payment-receipts` buckets; bucket/object content was not queried.

## Relationships and integrity

The only declared application foreign keys are `admin_accounts.auth_user_id` and `staff_accounts.auth_user_id` to `auth.users(id)` with cascade delete. `registration_id`, `staff_id`, audit entity IDs, `verified_by`, and ledger `reference_id` are not declared FKs. Therefore registration-to-event/donation and staff-to-finance relationships are logical conventions, not enforced relational constraints. The SQL does not define `current_student_ids` or `inquiries`, although application code references both.

## RLS and migration state

RLS is enabled in the baseline/event migrations, and the Nov. 10 hardening migration replaces policies for registrations, donations, admin/staff profiles, event operation, budget and audit tables. The last policy state is conditional on successful migration application. The earlier baseline includes more permissive public/authenticated policies; the Nov. 10 migration narrows these. It also removes old donation policies and creates only super-admin read/update/delete policies, with no insert policy. Thus the donation upsert helper has no source-defined anon/authenticated insert policy in the intended hardened state.

Storage policies from the baseline are not visibly replaced by the hardening migration. One policy grants authenticated users `FOR ALL` on `storage.objects` with unconditional `USING`/`WITH CHECK`. Public insert policies exist for photo and receipt buckets. Treat that as a source-defined risk; actual deployed policy state is unknown.

### Table-by-table intended RLS (if all migrations applied)

| Relation | RLS / source-defined policy behavior |
|---|---|
| `admin_accounts` | Enabled. `admin_profile_read_own` permits authenticated users to read their linked profile only. No client-side insert/update/delete policy in the final hardening block. |
| `admin_audit_logs` | Enabled. `admin_audit_read_admin` permits super-admin reads; write is intended through service-role Edge Function. |
| `registrations_2026` and any pre-existing `registrations`/`registrations_YYYY` | Enabled. Anonymous/authenticated insert is constrained to unpaid/pending state and null verification fields; authenticated role-based reads; super-admin update/delete. |
| `donations_2026` and any pre-existing `donations`/`donations_YYYY` | Enabled by the dynamic migration when table exists. Final migration policies allow super-admin select/update/delete only; no insert policy is recreated. |
| `scanner_logs` | Enabled. Authenticated event staff/super-admin insert; reads restricted to super-admin/admin role condition (the policy does not grant read to ordinary gate staff). |
| `staff_accounts` | Enabled. Own-profile or super-admin read; super-admin insert/update/delete. |
| `food_distributions` | Enabled. Super-admin or matching breakfast/lunch/dinner staff insert; breakfast insert only before 13:00 Dhaka time; meal staff/super-admin read; super-admin update. |
| `gate_events` | Enabled. Gate staff/super-admin insert and read. |
| `dress_distributions` | Enabled. Dress staff/super-admin insert and read. |
| `central_budget` | Enabled. Super-admin read and all writes. |
| `staff_allocations` | Enabled. Super-admin/finance read; super-admin all writes. |
| `staff_expenses` | Enabled. Super-admin/finance read and insert; super-admin update. |
| `financial_ledger` | Enabled. Super-admin/finance read; super-admin insert. |
| `admin_audit_history` | Enabled. Super-admin read/insert. |
| `private.ticket_lookup_rate_limits` | Private schema/table privileges revoked from public, anon and authenticated; RPC execution granted only to service role. RLS itself is not enabled by these migrations. |
| `storage.objects` (Supabase-managed) | Baseline adds public photo/receipt insert policies and authenticated `FOR ALL` with unconditional predicates. No replacement is visible in the hardening migration. |

## Functions and triggers

| SQL routine | Purpose / access notes |
|---|---|
| `check_single_admin_slot()` + `trg_enforce_single_admin_slot` | Before-insert trigger intended to limit `admin_accounts` to one account. |
| `current_admin_role()` | `SECURITY DEFINER` role lookup by `auth.uid()`, granted to authenticated/service role. |
| `current_event_staff_role()` | `SECURITY DEFINER` active-staff role lookup, granted to authenticated/service role. |
| `rpc_secure_ticket_lookup(TEXT,TEXT)` | Legacy ID/mobile query; later migration revokes execution from public/anon/authenticated and grants service role. |
| `rpc_verify_payment(TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT)` | Checks duplicate transaction then marks registration paid and logs; does not contact PayStation or verify provider proof itself. Later restricted to service role. |
| `get_staff_remaining_balance(TEXT)` | Computes allocations less submitted/approved expenses and cash returns; later restricted to service role. |
| `consume_ticket_lookup_rate_limit(TEXT,INTEGER,INTEGER)` | Atomic time-window attempt counter; service-role only. |

No SQL views are declared. There are no explicit table `GRANT` statements in the four migrations.

## Drift and data-integrity findings

1. `current_student_ids` and `inquiries` are missing from supplied migrations; remote operations may fail unless created out of band.
2. Source uses fallbacks to generic `registrations` and `donations`, but the checked-in migrations define only year-specific tables.
3. App types do not match SQL exactly: `email` optional in app but required in registration SQL; app `transactionId` and payment method are generally strings while SQL fields can be null; app student ID/last attended class are not columns in registration table.
4. Embedded SQL generator in `src/services/supabase.ts` differs from migrations, including donation nullability and policy/drop-policy names. Applying it can leave older permissive policies if names do not match.
5. Food/dress uniqueness is on registration IDs but without FK links to registration. Staff and finance references are also unconstrained.
6. Several date/time fields are `TEXT` rather than date/time SQL types, constraining validation/querying.
7. Scanner logs and admin audit logs have no secondary indexes in the migrations; add indexes only if observed query plans/workload justify them.
8. No live catalog comparison is possible; do not treat any listed schema as confirmed deployed state.

## Source evidence

- Initial schema/RLS/functions/storage: `supabase/migrations/20260101000000_critical_security_hardened_schema.sql`
- Event schema: `supabase/migrations/20260102000000_event_management_system_schema.sql`
- Auth/RLS hardening: `supabase/migrations/20261110000000_auth_and_rls_hardening.sql`
- Rate limiting: `supabase/migrations/20261111000000_ticket_lookup_rate_limit.sql`
- Client and generated schema: `src/services/supabase.ts:729-1002`
