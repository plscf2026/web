# 08 — Supabase Security, Authentication & RLS Audit

**Audit Classification:** Verified implementation (cross-verified directly against live PostgreSQL `pg_policies`, `information_schema.role_table_grants`, `pg_proc.proacl`/`prosecdef`, Edge Functions, and `supabase/migrations/`).

---

## 1. Authentication & Role Helper Architecture

| Function | Live Signature & Attrs | Live `proacl` Execute Grants | Purpose & Safety |
|---|---|---|---|
| `current_admin_role()` | `() -> text`, `SECURITY DEFINER`, `STABLE` | `postgres, anon, authenticated, service_role, supabase_auth_admin` | Returns active, unlocked `admin_accounts.role` matching `auth.uid()`. Returns `NULL` if `auth.uid() IS NULL`. **Updated in `20270319`** to restore `anon` `EXECUTE` after `permission denied for function current_admin_role` broke public registration photo uploads to `student-photos` storage bucket! |
| `current_event_staff_role()` | `() -> text`, `SECURITY DEFINER`, `STABLE` | `postgres, anon, authenticated, service_role, supabase_auth_admin` | Returns active `staff_accounts.role` matching `auth.uid()`, or `NULL` when `auth.uid() IS NULL`. |
| `current_admin_id()` | `() -> text`, `SECURITY DEFINER` | `PUBLIC (default), anon, authenticated, service_role` | Returns `admin_accounts.id` matching `auth.uid()`. |
| `is_super_admin_caller()` | `() -> boolean`, `SECURITY DEFINER` | `PUBLIC (default), anon, authenticated, service_role` | Checks `lower(trim(role)) IN ('super_admin','superadmin')` for `auth.uid()`. |

---

## 2. Edge Function Security Boundaries

- **All secrets kept server-side (`Deno.env.get`):** `PAYSTATION_MERCHANT_ID`, `PAYSTATION_PASSWORD`, `PAYMENT_SIGNING_SECRET`, `PAYSTATION_ALLOW_PAYMENT_FINALIZATION`, `PAYSTATION_ALLOW_ORDER_BOUND_CURRENCY_ATTESTATION`, `AUDIT_SIGNING_SECRET`, `RATE_LIMIT_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ALLOWED_ORIGINS`.
- **Fail-Closed Payment Verification (`verify-payment`):**
  1. Never relies on client redirect status or unverified IPN body fields alone — performs mandatory server-to-server `verifyPayStationTransaction` (`v2` then `v1` fallback with expected invoice).
  2. Never defaults missing currency to `'BDT'` unless `PAYSTATION_ALLOW_ORDER_BOUND_CURRENCY_ATTESTATION === 'true'` and pending order binds `'BDT'`.
  3. Enforces `PAYSTATION_ALLOW_PAYMENT_FINALIZATION === 'true'` across `verify-payment`, `ipn`, and `record-donation`.
  4. Enforces `system_settings.portal_fee_settings` switches and fee bounds on `create-payment` / `initiate-payment`.
- **`admin-audit` Auth Bug:** Verifies Bearer JWT + `admin_accounts` row (`L62-79`), **but rejects all non-`super_admin` roles with HTTP `403` (`L77`)**, while `SupabaseService.loginAdmin` (`src/services/supabase.ts:1971-1986`) requires `recordAuditLog()` to succeed for all 5 admin portal roles or signs them out!
- **`secure-ticket-lookup` & `verify-student-id`:** Restrict origin via `APP_ALLOWED_ORIGINS`; omit `photoUrl` in `verify-student-id`; apply HMAC IP/subject rate limiting via `consume_ticket_lookup_rate_limit` in `secure-ticket-lookup`.

---

## 3. PostgreSQL Table Grants & RLS Posture (Verified Live DB)

### 3.1 Properly Hardened Governance & Payment Tables
| Table | `anon` Table Grants | `authenticated` Grants | Effective RLS Posture |
|---|---|---|---|
| `system_settings` | `SELECT` ONLY | `DELETE, INSERT, SELECT, UPDATE` | `anon`/`public` can ONLY read `key IN ('portal_fee_settings', 'international_payment_info')`. Writes restricted strictly to `current_admin_role() = 'super_admin'` or `service_role`. |
| `pending_orders` | **NONE** | `SELECT` ONLY | Reads restricted to `current_admin_role() IS NOT NULL`. Writes strictly `service_role`. |
| `registrations_2027` | **NONE** | `DELETE, INSERT, SELECT, UPDATE` | Reads require active admin or staff (`registrations_2027_admin_staff_read`). Full writes require `('super_admin','admin','registration_officer')`; distribution flags updatable by specific station staff roles. |
| `donations` | **NONE** | `DELETE, INSERT, SELECT, UPDATE` | Reads/writes restricted to `current_admin_role() IS NOT NULL` / `super_admin` / `service_role`. |
| `current_student_ids` | **NONE** | `DELETE, INSERT, SELECT, UPDATE` | Reads for `('super_admin','admin','registration_officer')`; writes for `super_admin`. Public lookup uses non-PII RPCs only. |
| `admin_accounts` / `staff_accounts` | Wait — `anon` retains table-level `GRANT ALL` (`audit_db_summary.txt:121, 162`), protected ONLY by RLS! | `ALL` | RLS restricts all actions to `authenticated` (`auth_user_id = auth.uid()` or `is_super_admin_caller()` or assigned `finance_manager`), plus immutability triggers on super admin. *Defense-in-depth improvement recommended: revoke `anon` table privileges.* |

### 3.2 CRITICAL RLS & Privilege Vulnerabilities (Verified Live DB + Migrations)

| Finding ID | Affected Object(s) | Exact Live Vulnerability | Severity | Source Evidence |
|---|---|---|---|---|
| **SEC-CRIT-01** | `public.rpc_admin_get_registrations(integer)`, `public.get_paid_registrations()` | Both `SECURITY DEFINER` RPCs are executable by **`anon`** (`audit_db_summary.txt:184`, `20270124` L135, `20270106` L361) and execute `SELECT * FROM registrations_2027` with zero caller authorization check — **completely bypassing RLS PII protection!** | **CRITICAL** | `audit_db_summary.txt:184`; `20270124` L135–146; `20270106` L361–369 |
| **SEC-CRIT-02** | `public.rpc_delete_registration(...)`, `public.rpc_update_student_photo(...)` | Both `SECURITY DEFINER` write/delete RPCs remain granted to **`anon`** (`audit_db_summary.txt:197`, `20270115` L8, `20270118` L151) with zero `auth.uid()` or role checks, allowing anonymous callers to delete paid registrations or alter student photos. | **CRITICAL** | `audit_db_summary.txt:197`; `20270115` L8–117; `20270118` L77–151 |
| **SEC-CRIT-03** | All 6 Manual Registration RPCs (`rpc_create_manual_registration`, `rpc_staff_update_manual_registration`, `rpc_approve_manual_registration` [2 overloads], `rpc_reject_manual_registration`, `rpc_approve_manual_financial`, `rpc_reject_manual_financial`) | All 6 `SECURITY DEFINER` RPCs remain granted to **`anon`** (`audit_db_summary.txt:185-187, 195, 212-213, 221`) and trust caller-supplied `p_admin_name`/`p_staff_id`/`p_staff_role` without checking `auth.uid()` or `current_admin_role()`. Any anonymous caller can create, approve, or inject manual registrations straight into `registrations_2027`! | **CRITICAL** | `audit_db_summary.txt:185-187, 195, 212-213, 221`; `20270309` L228–813 |
| **SEC-CRIT-04** | `public.admin_audit_history` & `public.admin_audit_logs` | Live policies `allow_all_admin_audit_history` (`ALL` `roles="{anon,authenticated,service_role}"`, `qual=true`, `with_check=true`) and `allow_read/insert_admin_audit_logs` (`anon` `SELECT/INSERT`, `true`), plus `anon` table grants (`audit_db_summary.txt:124-129, 238-240`). Anonymous users can read/forge/delete governance audit logs! | **CRITICAL** | `audit_db_summary.txt:124-129, 238-240`; `20270131` L49–85 |
| **SEC-CRIT-05** | `public.manual_registrations`, `public.manual_registration_audit_logs` | `manual_registrations_select_all` and `manual_registrations_write_all` (`qual=true`, `with_check=true`) allow **any `authenticated` user** (not just authorized admins) full SELECT/INSERT/UPDATE/DELETE; `manual_registration_audit_logs` retains `anon` SELECT/INSERT (`qual=true`). | **HIGH** | `audit_db_summary.txt:303-306`; `20270309` L138–168 |
| **SEC-HIGH-01** | `public.dress_distributions`, `public.food_distributions`, `public.gate_events`, `public.guest_*`, `public.financial_transactions`, `public.financial_audit_logs`, `public.expense_categories`, `public.about_contact_content`, `public.registrations_2026` | Legacy permissive `USING (true) WITH CHECK (true)` policies (`dress_distributions_all_access`, `food_distributions_all_access`, `gate_events_all_access`, `Allow all guest_*`, `Admin full control on financial_*` `TO public`, `public_select/update/delete_registration_2026` `TO public/anon`) OR overlapping `anon` table grants override stricter staff policies in `audit_db_summary.txt:258-316`! *(Because PostgreSQL RLS combines permissive policies with `OR`, one `qual=true` policy negates every stricter policy on the same table/role.)* | **HIGH / CRITICAL** | `audit_db_summary.txt:134-156, 258-316` |
| **SEC-MED-01** | `public.rpc_verify_personal_donation_history` | Callable by **`anon`** (`audit_db_summary.txt:226`); authorizes only via last 4 phone digits (`p_phone_suffix`) and returns `transaction_id` & `total_paid`. | **MEDIUM** | `audit_db_summary.txt:226`; `20270110` L346–441 |

---

## 4. Storage Bucket RLS (`student-photos` & `payment-receipts`)

Verified in `supabase/migrations/20270304000000_harden_student_photos_storage_rls.sql`:
- **`student-photos` (public CDN bucket):**
  - `INSERT` (`Public can upload registration photo`): Allowed to `public` with `bucket_id = 'student-photos' AND storage.extension(name) IN ('jpg','jpeg','png','webp')`.
  - **No broad `SELECT` policy** (prevents `.list()` enumeration of all uploaded photos, while public CDN URLs remain directly servable).
  - `UPDATE`/`DELETE` restricted to `authenticated` where `current_admin_role() IS NOT NULL OR current_event_staff_role() IS NOT NULL`.
  - *(This policy check calling `current_admin_role()` as `anon` during public registration photo upload caused the resolved `permission denied for function current_admin_role` incident, fixed in `20270319000000_grant_anon_execute_rls_role_helpers.sql`.)*
- **`payment-receipts` (private bucket):** All operations scoped to `authenticated` admins/staff.
