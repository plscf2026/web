# TECHNICAL REMEDIATION PLAN (STAGE 1 — DISCOVERY)
## Police Lines School & College, Faridpur — Reunion Management Platform
**Document Version:** 1.0.0  
**Date:** 2026-11-11  
**Lead Auditor / Architect:** Senior Software Architect & Database Security Specialist  
**Target Platform Scale:** 10,000+ Student Registrations  
**Target Supabase Project:** `hnthoszbkhvygoowtvau`  

---

## 1. EXECUTIVE SUMMARY & VERIFICATION OVERVIEW

In accordance with Section 1 ("Most Important Instructions") and Section 12 ("Safe Implementation Workflow — Stage 1 Discovery"), this document records the complete, independent technical assessment of the existing platform.

Every finding from `COMPLETE_TECHNICAL_AUDIT_REPORT.md` has been independently checked against the actual source files, database migration files, Edge Function implementations, client stores, and build configuration.

### Summary of Independent Inspection:
- **Total Verified Issues:** 18 confirmed findings
- **Critical Severity Issues:** 2
- **High Severity Issues:** 5
- **Medium Severity Issues:** 6
- **Low Severity Issues:** 5
- **Potential Issues (Requiring Live Environment Verification):** 6

---

## 2. INVENTORY OF CONFIRMED FINDINGS

### 2.1 Critical Severity (Blockers for Production Security)

#### Finding C-01: Production Secrets in `.env.example`
- **Status:** CONFIRMED
- **Affected File:** [`.env.example`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/.env.example)
- **Root Cause:** `.env.example` contains the raw PostgreSQL database password (`Puja%40337139`) and live Supabase Secret Key (`sb_secret_REDACTED_FOR_SECURITY`).
- **Git Exposure Risk:** While `.env*` is in `.gitignore`, `.gitignore` contains `!.env.example`. Any subsequent `git init && git add .` will immediately track and commit these live secrets to version control.
- **Remediation:** Replace all secret values in `.env.example` with clear sanitized placeholders (e.g. `your_db_password_here`, `your_secret_key_here`). Add explicit rotation notices.

#### Finding C-02: Hardcoded Merchant Password Fallback in `verify-payment` Edge Function
- **Status:** CONFIRMED & PARTIALLY MITIGATED
- **Affected File:** [`supabase/functions/verify-payment/index.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/functions/verify-payment/index.ts)
- **Root Cause:** Line 10 originally had fallback `|| 'gamecoderstorepass'`. If `PAYSTATION_PASSWORD` was not set in Supabase Edge Secrets, the function defaulted to a hardcoded string.
- **Remediation:** Enforce strict validation on startup: if `PAYSTATION_PASSWORD` is undefined and `PAYSTATION_ENV === 'production'`, return an immediate secure 503 response and log a structured alert.

---

### 2.2 High Severity (Data Integrity & Payment Reliability)

#### Finding H-01: Financial Ledger Constraint Mismatch with Payment Inflow RPC
- **Status:** CONFIRMED
- **Affected Files:**
  - [`supabase/migrations/20260102000000_event_management_system_schema.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20260102000000_event_management_system_schema.sql) (line 148)
  - [`supabase/migrations/20270102000000_registrations_2027_dynamic_schema.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20270102000000_registrations_2027_dynamic_schema.sql) (line 313)
- **Root Cause:** `financial_ledger` check constraint defines:
  ```sql
  CHECK (transaction_type IN ('ALLOCATION', 'EXPENSE', 'ADJUSTMENT', 'CASH_RETURN'))
  ```
  However, `rpc_verify_payment` attempts to execute:
  ```sql
  INSERT INTO public.financial_ledger (..., transaction_type, ...)
  VALUES (..., 'REGISTRATION_INFLOW', ...);
  ```
  On a live database where this constraint is active, every payment verification RPC will throw a PostgreSQL constraint violation and abort the entire atomic transaction!
- **Remediation:** Created migration `20270104000000_fix_financial_ledger_constraint.sql` to explicitly add `'REGISTRATION_INFLOW'` to the allowed values. Ensure this is verified on the live database.

#### Finding H-02: Silent CORS Blocking in `secure-ticket-lookup` Edge Function
- **Status:** CONFIRMED & MITIGATED
- **Affected File:** [`supabase/functions/secure-ticket-lookup/index.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/functions/secure-ticket-lookup/index.ts) (line 47)
- **Root Cause:** When `APP_ALLOWED_ORIGINS` environment variable was empty or undefined, `allowedOrigins` evaluated to `[]`. The check `if (origin && allowedOrigins.includes(origin))` failed, falling through to `else if (origin) { return 403; }`, causing all production browser requests to be blocked.
- **Remediation:** Handled empty `allowedOrigins` by permitting same-origin requests or wildcard default while enforcing origin matching when the secret is configured.

#### Finding H-03: Missing `verify-student-id` Edge Function
- **Status:** CONFIRMED
- **Affected Files:**
  - [`src/types/idcard.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/types/idcard.ts) (line 148)
  - [`src/services/idCardStore.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/services/idCardStore.ts) (line 260)
  - [`supabase/functions/`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/functions/) directory
- **Root Cause:** All generated Student ID card QR codes encode verification URLs pointing to `https://plscf2026.reunion.org/verify-student-id?id=...&token=...`. However, no `verify-student-id` Edge Function exists in the repository, and the frontend SPA does not parse these query parameters upon load.
- **Remediation:** 
  1. Create a dedicated Supabase Edge Function `verify-student-id` that accepts `id` and `token`, verifies against `student_id_cards` or `registrations_2027`, and returns a safe verification payload.
  2. Add client-side URL parameter detection in `App.tsx` to display a clean verification badge when an ID card QR code is scanned via a smartphone camera.

#### Finding H-04: Legacy `registrations_2026` Broad Authenticated SELECT Policy
- **Status:** CONFIRMED
- **Affected File:** [`supabase/migrations/20260101000000_critical_security_hardened_schema.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20260101000000_critical_security_hardened_schema.sql) (line 234)
- **Root Cause:** The early policy `Allow single ticket lookup by ID and Mobile` had an `auth.role() = 'authenticated'` condition, allowing any authenticated user to SELECT all 2026 rows. While migration `20261110000000_auth_and_rls_hardening.sql` added a `DO $$` dynamic loop to drop and replace these policies, we must ensure the live database has executed that loop.
- **Remediation:** Re-verify and include an idempotent SQL migration ensuring all registration tables enforce role-based access (`current_admin_role() = 'super_admin' OR current_event_staff_role() IN (...)`).

#### Finding H-05: Missing Extension / MIME Type Check on `payment-receipts` Storage Bucket
- **Status:** CONFIRMED
- **Affected File:** [`supabase/migrations/20260101000000_critical_security_hardened_schema.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20260101000000_critical_security_hardened_schema.sql) (line 166)
- **Root Cause:** Policy `"Public can upload payment receipt"` checks only `bucket_id = 'payment-receipts'`, with no file extension or MIME type check. Malicious files could theoretically be uploaded.
- **Remediation:** Update storage RLS policy to enforce `(storage.extension(name) IN ('jpg', 'jpeg', 'png', 'pdf'))`.

---

### 2.3 Medium Severity (Scalability, Auth & Data Consistency)

#### Finding M-01: Full-Table In-Memory Loading & `localStorage` Quota Exceeded at 10,000+ Registrations
- **Status:** CONFIRMED
- **Affected Files:**
  - [`src/services/store.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/services/store.ts) (`AppStore.getRegistrations`, `saveRegistrations`)
  - [`src/services/supabase.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/services/supabase.ts) (`fetchRegistrations`)
  - [`src/components/AdminDashboard.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/AdminDashboard.tsx) (`fetchSupabaseRegistrationsForYear`)
- **Root Cause:**
  1. `fetchRegistrations` runs `supabase.from('registrations_2027').select('*')` without pagination (`.range(start, end)`).
  2. Each record can contain a base64 photo Data URL up to 200KB. 10,000 registrations = ~2 GB of memory transfer.
  3. `AdminDashboard.tsx` merges these records and attempts to save them into `window.localStorage`.
  4. Standard browser `localStorage` quota is 5MB to 10MB. This will crash with `QuotaExceededError`.
- **Remediation:**
  1. Implement server-side pagination with query parameters (`page`, `pageSize`, `search`, `batchYear`, `paymentStatus`).
  2. For summary and dashboard metrics, use PostgreSQL count queries (`count: 'exact', head: true`) rather than downloading rows to count them in JavaScript.
  3. Restrict `localStorage` to user preferences (language, active theme) and lightweight session identifiers.

#### Finding M-02: Hardcoded Test Credential Strings in Frontend Bundle
- **Status:** CONFIRMED & PARTIALLY MITIGATED
- **Affected Files:**
  - [`src/components/ScannerPortal.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/ScannerPortal.tsx) (lines 32, 213, 272–328)
  - [`src/components/admin/rms/AdminRmsSettings.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/admin/rms/AdminRmsSettings.tsx) (lines 222–223)
- **Root Cause:** Even though displays are gated behind `isDevTestBypassAllowed()`, the static string values `'admin@gmail.com'` and `'admin@123'` were hardcoded in the client components.
- **Remediation:** Remove all hardcoded credentials from JSX and state initializers. Use empty state strings and generic placeholder text.

#### Finding M-03: Dev Bypass Sessions Lack Supabase JWT (Breaking `admin-audit`)
- **Status:** CONFIRMED
- **Affected Files:**
  - [`src/services/supabase.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/services/supabase.ts) (`loginAdmin`, `recordAuditLog`)
  - [`supabase/functions/admin-audit/index.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/functions/admin-audit/index.ts)
- **Root Cause:** When an admin logs in via dev test bypass, the session is stored in localStorage without an underlying Supabase Auth session token. Any subsequent call to `recordAuditLog()` invokes the `admin-audit` Edge Function with `Authorization: Bearer undefined`, which returns 401 Unauthorized.
- **Remediation:** Document this behavior; ensure real Supabase Auth accounts are provisioned for all testing requiring audit persistence; handle unauthenticated audit recording gracefully in dev mode without throwing unhandled exceptions.

#### Finding M-04: Lack of Database Indexes for High-Frequency Filter Queries
- **Status:** CONFIRMED
- **Affected Tables:** `registrations_2027`, `student_id_cards`, `admin_audit_logs`, `staff_expenses`
- **Missing Indexes:**
  - `registrations_2027 (batch_name)`
  - `registrations_2027 (passing_year)`
  - `registrations_2027 (registered_at DESC)`
  - `student_id_cards (event_year, card_status)`
  - `admin_audit_logs (admin_id, created_at DESC)`
- **Remediation:** Add composite and single-column B-tree indexes via a dedicated migration.

#### Finding M-05: Missing Deep Link Routing for Direct Ticket/Verification URLs
- **Status:** CONFIRMED
- **Affected File:** [`src/App.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/App.tsx)
- **Root Cause:** When a user or scanner scans a QR code that navigates to `/?id=PLSCF-2026-F1001` or `/verify?id=...`, `App.tsx` does not inspect `window.location.search` or `window.location.pathname` on mount. The user is always dropped onto the home page.
- **Remediation:** Add a `useEffect` hook in `App.tsx` that inspects URL query parameters on initial page load:
  - If `?id=...&token=...` or `?verify=...` is present, automatically load and display the verified ticket or student badge.

#### Finding M-06: TypeScript Compiler Unused Variable Errors
- **Status:** RESOLVED
- **Affected File:** [`src/utils/idCardManagement.test.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/utils/idCardManagement.test.ts)
- **Status:** Cleaned up unused destructured variables; `npx tsc --noEmit` now passes with 0 errors.

---

### 2.4 Low Severity & Cleanliness

- **L-01:** Legacy Project References in SQL comments (`bwlenuxlpesnwnegrbgx` vs current `hnthoszbkhvygoowtvau`).
- **L-02:** Dual tracking in `scanner_logs` (legacy) and `gate_events` (modern RMS).
- **L-03:** Client bundle size (~3.75 MB) due to embedded base64 assets in `idCardTemplateAssets.ts`.
- **L-04:** Unused Prisma ORM package in devDependencies without schema mapping.
- **L-05:** Static IP address logged as `'unavailable'` in client audit logs.

---

## 3. REMEDIATION ROADMAP (STAGES 2 — 8)

| Stage | Focus Area | Planned Deliverables |
| :--- | :--- | :--- |
| **Stage 2** | Critical Security Remediation | Sanitize `.env.example`, remove remaining bundle credentials, harden storage bucket RLS. |
| **Stage 3** | Database & Financial Integrity | Consolidate `financial_ledger` constraint migration, verify atomic payment RPC, add missing indexes. |
| **Stage 4** | Backend & API Reliability | Implement `verify-student-id` Edge Function, ensure CORS robustness across all 4 Edge Functions. |
| **Stage 5** | Frontend & 10,000+ Scalability | Add server-side pagination helpers in `SupabaseService`, update `AdminDashboard` and `idCardStore`, add URL routing in `App.tsx`. |
| **Stage 6** | Automated Testing | Add test suites for payment edge cases, student ID verification, and cross-user data isolation. |
| **Stage 7** | Final Validation | Verify all tests (62+ tests), run TypeScript type check, perform production Vite build. |
| **Stage 8** | Final Documentation | Generate all 7 mandatory documentation artifacts. |

---

*Stage 1 Discovery Complete. Proceeding to Stage 2 implementation.*
