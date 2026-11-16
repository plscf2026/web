# PLSCF-2027 — POST-REMEDIATION INDEPENDENT VERIFICATION REPORT
**Project:** Police Lines School & College, Faridpur — Grand Reunion 2027  
**Verification Date:** November 16, 2026  
**Auditor:** Senior Security Architect, Database Auditor & Full-Stack Systems Engineer  
**Audit Scope:** Independent, Read-Only Technical Verification of All 7 Remediated Issues  
**Enforcement Rule:** Strict Read-Only Verification (No code changes, no database alterations, no live payment transactions)

---

## 1. Executive Verification Summary

An independent, live read-only verification was conducted against the local code repository, edge functions, test suites, and the **live remote Supabase PostgreSQL database** (`postgresql://postgres.hnthoszbkhvygoowtvau...`).

### Crucial Architectural Discovery: Local Code vs. Remote Database Disconnect
While the previous remediation session authored correct local SQL migration files and updated frontend TypeScript service stores, **none of the new migration files have been applied to the live remote Supabase PostgreSQL database**. 
Furthermore, the previous schema migration for student ID cards (`20270103000000`) and registration consolidation (`20270118000000`) were also never executed on the remote database.

Consequently:
- The application currently functions in **optimistic local cache mode (`localStorage`)**.
- Background writes to non-existent remote tables fail silently with Postgrest `PGRST205` ("Could not find the table in the schema cache").
- **Multi-device administrative data synchronization cannot function** until database migrations are officially deployed.
- Critical RLS policy vulnerabilities inherited from earlier schemas remain active on the remote database.

### Overall Status Breakdown of the 7 Issues

| Issue Code | Priority | Module | Status | Core Finding |
| :--- | :--- | :--- | :--- | :--- |
| **H-1** | High | `current_student_ids` | **PARTIALLY VERIFIED** | TypeScript mappers & sync logic implemented; table missing from remote DB (PGRST205). |
| **M-1** | Medium | `inquiries` (Contact Form) | **PARTIALLY VERIFIED** | Frontend validation & local store work; table missing from remote DB (PGRST205). |
| **M-2** | Medium | `secure-ticket-lookup` | **PARTIALLY VERIFIED** | Source code pinned to `registrations_2027`; remote Edge Function is not deployed (404 NOT_FOUND). |
| **M-3** | Medium | RMS ERP Modules | **PARTIALLY VERIFIED** | 10 entity mappers verified; all 15 tables exist on remote DB but have 0 rows; missing RLS write policies on `rms_committees`. No offline retry queue. |
| **M-4** | Medium | ID Card Download Jobs | **PARTIALLY VERIFIED** | Mappers & local store verified; tables `student_id_cards`, `id_card_download_jobs`, `id_card_download_logs` missing from remote DB. |
| **L-1** | Low | Obsolete `registrations_2026` | **VERIFIED** | Codebase cleaned of active queries; empty table remains in remote DB without impact. |
| **M-5** | Medium | Duplicate Donation Tables | **PARTIALLY VERIFIED** | Client write path routed to `donations`; remote `donations` table missing `date`/`year` columns and sync trigger; remote RLS is over-permissive. |

---

## 2. Migration Verification (Local vs. Remote Database)

A direct query to the remote PostgreSQL database (`aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`) was executed to inspect all user tables and migration schemas.

### Query Evidence: Remote Tables in `public` Schema
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
```
**Actual Remote Tables (39 tables):**
`admin_accounts`, `admin_audit_history`, `admin_audit_logs`, `central_budget`, `donations`, `donations_2026`, `donations_2027`, `dress_distributions`, `expense_categories`, `expenses`, `financial_audit_logs`, `financial_ledger`, `financial_transactions`, `food_distributions`, `gate_events`, `ipn_logs`, `payment_transactions`, `pending_orders`, `registrations_2026`, `registrations_2027`, `rms_announcements`, `rms_audit_logs`, `rms_budget_requests`, `rms_committee_members`, `rms_committees`, `rms_documents`, `rms_event_incidents`, `rms_expenses`, `rms_income_transactions`, `rms_meetings`, `rms_sponsors`, `rms_task_comments`, `rms_tasks`, `rms_volunteers`, `rms_weekly_reports`, `scanner_logs`, `staff_accounts`, `staff_allocations`, `staff_expenses`.

### Migration Comparison Matrix

| Migration File in Repository | Object(s) Defined | Applied to Remote DB? | Evidence from Remote Database |
| :--- | :--- | :--- | :--- |
| `20270101000000_reunion_management_erp_schema.sql` | 15 RMS tables | **YES** | All 15 `rms_%` tables exist in `public`. |
| `20270102000000_registrations_2027_dynamic_schema.sql` | `registrations_2027`, `donations_2027` | **YES** | Both tables exist in `public`. |
| `20270103000000_student_id_card_management_schema.sql` | `student_id_cards`, `id_card_download_jobs`, `id_card_download_logs` | **NO** | Tables do not exist in `information_schema.tables`. |
| `20270110000000_financial_transparency_dashboard_schema.sql` | `public.donations`, RPC `rpc_get_financial_transparency_summary` | **YES** | Table and function exist in remote DB. |
| `20270118000000_consolidate_registrations_to_2027.sql` | `DROP TABLE registrations_2026` | **NO** | `registrations_2026` still exists in remote DB. |
| `20270120000000_create_current_student_ids_schema.sql` | `public.current_student_ids` | **NO** | Table missing from remote DB. REST API returns `PGRST205`. |
| `20270121000000_create_inquiries_schema.sql` | `public.inquiries` | **NO** | Table missing from remote DB. REST API returns `PGRST205`. |
| `20270122000000_rms_erp_policies_and_sync.sql` | Staff policies on `rms_committees` & `rms_announcements` | **NO** | Policies missing from `pg_policies`. |
| `20270123000000_consolidate_donation_tables.sql` | `date`/`year` on `donations`, sync trigger | **NO** | Columns and trigger missing from remote DB. |

---

## 3. RLS Security Verification

A thorough inspection of `pg_policies` was performed across all tables.

### Finding 1: Unprotected Student Data in `registrations_2027` (CRITICAL)
- **Policy on Remote DB:**
  ```sql
  CREATE POLICY "public_select_registration_2027" ON public.registrations_2027
    FOR SELECT TO public USING (true);
  ```
- **Live Test Evidence via REST API (Anon Key):**
  ```bash
  curl -s "https://hnthoszbkhvygoowtvau.supabase.co/rest/v1/registrations_2027?select=id,payment_status&limit=2" \
    -H "apikey: sb_publishable_yEnHiM0NTIxuKNQnNHQu3Q_IRJ7zfur"
  ```
  **Response:**
  ```json
  [{"id":"PLSCF-2027-F9647","payment_status":"paid"}, {"id":"PLSCF-2027-F4505","payment_status":"paid"}]
  ```
- **Security Assessment:** **VIOLATION.** Anonymous clients holding the publishable anon key can directly query and dump student registration records via the REST API.
- **Additional Risk:** The remote database also has:
  ```sql
  POLICY "public_delete_registration_2027" ON public.registrations_2027 FOR DELETE TO anon, authenticated USING (true);
  POLICY "registrations_2027_staff_update_flags" ON public.registrations_2027 FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  ```
  This allows unauthenticated users to execute DELETE or arbitrary UPDATE requests directly against `registrations_2027`.

### Finding 2: Over-Permissive Policies on `public.donations` and `public.expenses` (HIGH)
- **Policies on Remote DB:**
  ```sql
  POLICY "Admin full control on donations" ON public.donations FOR ALL TO public USING (true) WITH CHECK (true);
  POLICY "Admin full control on expenses" ON public.expenses FOR ALL TO public USING (true) WITH CHECK (true);
  ```
- **Security Assessment:** In PostgreSQL, `TO public` grants permissions to all roles including `anon`. Anonymous users currently have `ALL` (INSERT, UPDATE, DELETE, SELECT) permissions on both tables.

### Finding 3: Contact Inquiries Isolation
- On the local migration (`20270121000000`), policies correctly restrict `SELECT`, `UPDATE`, and `DELETE` to authenticated administrators.
- However, on the remote database, the table does not exist yet.

### Finding 4: RMS Records Isolation
- Remote policies on `rms_tasks`, `rms_budget_requests`, `rms_expenses` require `auth.role() = 'authenticated'`.
- Remote policy on `rms_audit_logs` requires `current_admin_role() = 'super_admin'`.
- Anonymous users cannot modify or read private RMS records. Verified.

---

## 4. Donation Integrity & Synchronization Verification

### Database State Inspection
A direct query across all three donation tables was executed:
```sql
SELECT 'donations' AS tbl, count(*), COALESCE(sum(amount), 0) FROM public.donations
UNION ALL
SELECT 'donations_2026' AS tbl, count(*), COALESCE(sum(amount), 0) FROM public.donations_2026
UNION ALL
SELECT 'donations_2027' AS tbl, count(*), COALESCE(sum(amount), 0) FROM public.donations_2027;
```
**Result:**
- `donations`: 0 rows
- `donations_2026`: 0 rows
- `donations_2027`: 0 rows

### Code Path Verification:
1. **Canonical Writes:** `src/services/supabase.ts` (`saveDonation()`) routes writes to `public.donations`.
   - **Remaining Defect:** `canonicalRow` contains fields `date` and `year`. Because migration `20270123000000` has not been applied to the remote database, executing `saveDonation()` against the live remote database will fail with `column "date" of relation "donations" does not exist`.
2. **Replication Trigger:** The trigger `trg_sync_donations_2027_to_canonical` is defined in migration `20270123000000`, but **does not exist** on the remote database.
3. **Double-Counting Prevention:** In `rpc_get_financial_transparency_summary()`, standalone donations are filtered by `WHERE payment_status = 'paid' AND (registration_id IS NULL OR registration_id = '')`. Registration-linked donations are taken from `registrations_2027.donation_amount`. This mathematically prevents double-counting. Verified in SQL and via `financialTransparency.test.ts`.
4. **Idempotency:** Payment verification (`rpc_verify_payment`) enforces idempotency by checking `payment_status = 'paid'` before updating, returning existing verified records without duplicate ledger entries. Verified in `paystation.test.ts`.

---

## 5. RMS Synchronization Verification

### 10 Entity Mappers Audit (`src/services/rmsStore.ts`)
Each mapper was cross-checked against actual column definitions in `information_schema.columns`:

| Entity | Mapper Function | DB Columns Checked | Result |
| :--- | :--- | :--- | :--- |
| **Committees** | `toCommitteeDbRow` / `fromCommitteeDbRow` | 17 columns (`name_en`, `director_id`, `budget_total`, etc.) | **Match** |
| **Tasks** | `toTaskDbRow` / `fromTaskDbRow` | 17 columns (`committee_id`, `assigned_member_id`, `priority`, etc.) | **Match** |
| **Budget Requests**| `toBudgetRequestDbRow` / `fromBudgetRequestDbRow` | 19 columns (`requested_amount`, `finance_comments`, etc.) | **Match** |
| **Expenses** | `toExpenseDbRow` / `fromExpenseDbRow` | 17 columns (`voucher_number`, `verification_status`, etc.) | **Match** |
| **Meetings** | `toMeetingDbRow` / `fromMeetingDbRow` | 16 columns (`is_central_meeting`, `agenda`, `decisions`, etc.) | **Match** |
| **Volunteers** | `toVolunteerDbRow` / `fromVolunteerDbRow` | 16 columns (`assigned_committee_id`, `attendance_status`, etc.)| **Match** |
| **Announcements** | `toAnnouncementDbRow` / `fromAnnouncementDbRow`| 11 columns (`target_audience`, `is_active`, etc.) | **Match** |
| **Sponsors** | `toSponsorDbRow` / `fromSponsorDbRow` | 16 columns (`proposed_amount`, `agreed_amount`, `benefits`, etc.) | **Match** |
| **Documents** | `toDocumentDbRow` / `fromDocumentDbRow` | 13 columns (`file_url`, `access_permission`, etc.) | **Match** |
| **Audit Logs** | `toAuditLogDbRow` | 11 columns (`entity_type`, `previous_value`, `new_value`, etc.) | **Match** |

### Critical Behavioral Findings:
1. **Foreign Key Dependency:**
   - In PostgreSQL: `rms_tasks`, `rms_budget_requests`, `rms_expenses`, and `rms_documents` have `REFERENCES public.rms_committees(id)`.
   - On the remote database, `rms_committees` currently has **0 rows**.
   - If an admin creates a task or expense in the app, the remote insert will fail with a foreign key violation (`Key (committee_id)=(...) is not present in table "rms_committees"`) until initial committees are seeded into the remote database.
2. **Missing Write Policy on `rms_committees`:**
   - On the remote DB, `rms_committees` only has `Public read approved committees (SELECT)`.
   - Authenticated users cannot INSERT or UPDATE committees on the live DB until migration `20270122000000` is applied.
3. **Offline Queue Mechanism (No Automatic Retry):**
   - In `safeSupabaseUpsert()` and `safeSupabaseInsert()`, failed writes simply catch the error and log a notice to `console.warn`.
   - **There is no persistent offline queue, retry daemon, or conflict resolution table.**
   - If an administrator performs an action while offline, the action is saved only to `localStorage` on that specific device; it will **not** automatically sync to Supabase when reconnected unless the record is re-saved or manually synced.

---

## 6. ID Card Synchronization Verification

### Remote Database Reality:
Tables `student_id_cards`, `id_card_download_jobs`, `id_card_download_logs`, `batch_id_card_collections`, and `id_card_staff_accounts` **do not exist** in the live remote Supabase database.
- **Direct REST Check:**
  ```bash
  curl -s "https://hnthoszbkhvygoowtvau.supabase.co/rest/v1/id_card_download_jobs?select=*" \
    -H "apikey: sb_publishable_yEnHiM0NTIxuKNQnNHQu3Q_IRJ7zfur"
  ```
  **Response:**
  `{"code":"PGRST205","message":"Could not find the table 'public.id_card_download_jobs' in the schema cache"}`

### Client-Side Execution (`src/services/idCardStore.ts`):
- Functions `createDownloadJob()`, `updateJobProgress()`, `markCardGenerated()`, and `logDownload()` update `localStorage` successfully.
- Background calls to Supabase fail gracefully without unhandled exceptions.
- **Cross-Admin Device Visibility:** Fails on live deployment until migration `20270103000000` is executed on the remote database.

---

## 7. Student ID Verification

### Remote Database Reality:
- `public.current_student_ids` **does not exist** on the remote database.
- REST API queries return `PGRST205`.

### Client Logic & Rules (`src/utils/studentIdAndBookingRules.ts`):
- **Lookup & Validation:** `StudentIdService.verifyStudentId()` validates student ID against available cached records.
- **Reservation & 15-Minute Expiration:** `StudentIdStatus.RESERVED` holds a 15-minute TTL (`RESERVATION_TTL_MS = 15 * 60 * 1000`). If `reservedUntil` expires, status returns to `AVAILABLE`.
- **Used Status & Deduplication:** When registration is confirmed, status transitions to `USED` with associated `registrationId`. Duplicate attempts are rejected with `StudentIdStatus.ALREADY_USED`. Verified via `studentIdAndBookingRules.test.ts` (5/5 tests passing).

---

## 8. Ticket Lookup Edge Function

### Inspection of `supabase/functions/secure-ticket-lookup/index.ts`:
- **Table Construction:**
  ```ts
  const rawYear = body.year !== undefined && body.year !== null ? Number(body.year) : 2027;
  const year = Number.isInteger(rawYear) && rawYear >= 2027 && rawYear <= 2030 ? rawYear : 2027;
  const targetTable = 'registrations_2027';
  ...
  await supabase.from(targetTable).select(...)
  ```
  - `targetTable` is strictly pinned to `'registrations_2027'`.
  - Dynamic table construction from user-supplied input has been completely eliminated.
- **Live Deployment Check:**
  ```bash
  curl -s -X POST "https://hnthoszbkhvygoowtvau.supabase.co/functions/v1/secure-ticket-lookup" \
    -H "apikey: sb_publishable_yEnHiM0NTIxuKNQnNHQu3Q_IRJ7zfur" \
    -H "Content-Type: application/json" \
    -d '{"registrationId":"PLSCF-2027-F9647","mobileNumber":"01776777676"}'
  ```
  **Response:**
  `{"code":"NOT_FOUND","message":"Requested function was not found"}`
- **Finding:** The source code in the repository is fully secured, but the function **has not been deployed** to the live Supabase project.

---

## 9. Contact Form

### Inspection of `src/components/AboutContactPage.tsx`:
- **Validation:** Mobile numbers are strictly validated against Bangladeshi regex (`/^01[3-9]\d{8}$/`).
- **Persistence:** Submissions are saved to `localStorage` (`plscf_contact_inquiries`).
- **Remote Persistence:** The call `await supabase.from('inquiries').insert(...)` fails with Postgrest error `PGRST205` because `public.inquiries` has not been migrated to the remote database.
- **Admin Access:** In local migration `20270121000000`, RLS policies correctly restrict inquiries viewing to `current_admin_role() = 'super_admin'`.

---

## 10. Financial Reconciliation

A rigorous reconciliation query was run against the live database:

```sql
SELECT 
  'registrations_2027 (paid)' as entity,
  count(*) as record_count,
  COALESCE(sum(registration_fee), 0) as reg_fee_total,
  COALESCE(sum(donation_amount), 0) as donation_total,
  COALESCE(sum(total_paid), 0) as total_paid
FROM public.registrations_2027 WHERE payment_status = 'paid'
UNION ALL
SELECT 'donations (paid)', count(*), 0, COALESCE(sum(amount), 0), COALESCE(sum(amount), 0)
FROM public.donations WHERE payment_status = 'paid'
UNION ALL
SELECT 'expenses (approved)', count(*), 0, 0, COALESCE(sum(amount), 0)
FROM public.expenses WHERE status = 'approved';
```

### Reconciliation Findings:

| Ledger / Source | Count | Total Amount (BDT) | Notes / Variance Analysis |
| :--- | :--- | :--- | :--- |
| **`registrations_2027` (Paid)** | **6** | **৳ 14,768.25** | 6 verified paid student registrations (`PLSCF-2027-F9647`, `F4505`, `F9953`, `F9547`, `F3348`, `F4089`). |
| **`donations` (Paid)** | **0** | **৳ 0.00** | No standalone donations currently recorded in remote DB. |
| **`expenses` (Approved)** | **0** | **৳ 0.00** | No expenses approved in remote DB. |
| **`rpc_get_financial_transparency_summary`** | **6** | **৳ 14,768.25** | **MATCHES EXACTLY** with `registrations_2027` paid fees. |
| **`financial_ledger`** | **98** | **৳ 415,022.35** | **MAJOR MISMATCH.** Contains 98 entries generated by test/simulator scripts (`PAYSTATION_GATEWAY`). |
| **`payment_transactions`** | **229** | **৳ 724,499.22** | 221 PAID, 8 PAID_DUPLICATE. 217 transactions have `registration_id IS NULL` (test/mock payments). |

### Key Variance Explanation:
1. **Financial Transparency Dashboard vs. Event Staff Cash Ledger:**
   - The **Public Financial Transparency Tab** calls `rpc_get_financial_transparency_summary()`, which reads directly from verified registrations (`registrations_2027`). It accurately reports **৳ 14,768.25** (6 students, 0 donations, 0 expenses).
   - The **Staff Event Ledger** reads from `financial_ledger`, which currently includes 98 development test transactions totaling **৳ 415,022.35**.
   - Before event day production launch, the simulated entries in `financial_ledger` and `payment_transactions` must be cleaned or truncated by the database administrator.

---

## 11. Final Verification Verdicts & Required Action Items

| Issue | Verification Verdict | Immediate Required Action |
| :--- | :--- | :--- |
| **1. `current_student_ids` (H-1)** | **PARTIALLY VERIFIED** | Apply migration `20270120000000_create_current_student_ids_schema.sql` to remote Supabase DB. |
| **2. `inquiries` (M-1)** | **PARTIALLY VERIFIED** | Apply migration `20270121000000_create_inquiries_schema.sql` to remote Supabase DB. |
| **3. `secure-ticket-lookup` (M-2)** | **PARTIALLY VERIFIED** | Deploy Edge Function via `supabase functions deploy secure-ticket-lookup`. |
| **4. RMS ERP (M-3)** | **PARTIALLY VERIFIED** | Apply migration `20270122000000_rms_erp_policies_and_sync.sql` and seed initial committees into `rms_committees`. |
| **5. ID Card Jobs (M-4)** | **PARTIALLY VERIFIED** | Apply migration `20270103000000_student_id_card_management_schema.sql` to remote Supabase DB. |
| **6. Obsolete `registrations_2026` (L-1)**| **VERIFIED** | None required. Active application code is fully cleaned. |
| **7. Duplicate Donation Tables (M-5)** | **PARTIALLY VERIFIED** | Apply migration `20270123000000_consolidate_donation_tables.sql` to align schema, trigger, and fix overly permissive RLS. |

### Critical Security Vulnerabilities Requiring Fix on Remote DB:
1. **Drop over-permissive RLS policies on `registrations_2027`:**
   - Remove `public_select_registration_2027` (exposing student PII to anon REST queries).
   - Remove `public_delete_registration_2027` (allowing anonymous deletions).
   - Remove `registrations_2027_staff_update_flags` (allowing anonymous updates).
2. **Restrict `public.donations` and `public.expenses`:**
   - Change `Admin full control on donations` from `TO public` to `TO authenticated USING (current_admin_role() = 'super_admin')`.
   - Change `Admin full control on expenses` from `TO public` to `TO authenticated USING (current_admin_role() = 'super_admin')`.
