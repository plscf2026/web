# COMPREHENSIVE CYBERSECURITY & ACCESS CONTROL AUDIT REPORT

**Project:** Police Lines School & College, Faridpur — Grand Reunion 2026 / 2027 Management Platform  
**Audit Date:** November 12, 2026  
**Auditor Classification:** Senior Cybersecurity Auditor & Lead Software Architect  
**Methodology:** Static Application Security Testing (SAST), Source-Code Review, Cryptographic Verification, Database Policy Auditing, Threat Modeling  

---

## 1. Executive Security Summary

A rigorous, line-by-line security audit was performed across all frontend components, backend services, database migrations, Edge Functions, and configuration files of the reunion management platform. 

The website demonstrates **exceptionally sophisticated security hardening** in critical areas—specifically:
- Server-side cryptographic HMAC-SHA256 payment verification signatures.
- Anti-replay database constraints preventing duplicate transaction reuse.
- Strict multi-layered Row Level Security (RLS) denying anonymous PostgREST reading of attendee records.
- Robust DOMPurify XSS sanitization preventing stored and DOM-based cross-site scripting.
- Atomic PostgreSQL stored procedures (`rpc_verify_and_approve_service`) eliminating race conditions and double-spending across concurrent field scanners.
- Dual-factor, rate-limited public ticket lookups preventing enumeration attacks.

However, several **critical operational vulnerabilities** were discovered—most notably a client-side test account bypass (`isDevTestBypassAllowed()`) and universal development passwords (`admin@123`) bundled directly into the production code. If deployed without explicit environment flag override (`VITE_ENABLE_TEST_BYPASS="false"`), these allow unauthorized users to gain simulated super-admin access within client storage.

---

## 2. Vulnerability & Risk Classification Matrix

| Finding ID | Vulnerability Title | Domain | Risk Level | Implementation State |
|---|---|---|---|---|
| **SEC-01** | Universal Test Bypass & Hardcoded Admin Credentials in Production Bundle | Authentication | **CRITICAL** | IMPLEMENTED (Active in Dev/Default) |
| **SEC-02** | Client-Side LocalStorage Fallback Mutations without Server Authorization | Access Control | **HIGH** | IMPLEMENTED (Architectural Design) |
| **SEC-03** | Standalone ID Card Staff Management Unlinked from Supabase Auth | Identity / RBAC | **HIGH** | PARTIALLY IMPLEMENTED |
| **SEC-04** | Hardcoded Default HMAC Signing Secret in Payment Edge Function | Cryptography | **MEDIUM** | IMPLEMENTED (Config Fallback) |
| **SEC-05** | PayStation Sandbox Simulation Tokens in Edge Function Failure Mode | Payment Gateway | **MEDIUM** | IMPLEMENTED (Conditional on Sandbox) |
| **SEC-06** | In-Memory Sliding Window Rate Limiter Bypassed by Incognito / IP Rotation | Rate Limiting | **LOW** | IMPLEMENTED (Layer 1 Client Fallback) |
| **SEC-07** | Pre-seeded Demo Attendee PII Bundled in Client JavaScript Source | Data Exposure | **LOW** | IMPLEMENTED (Hardcoded Constants) |
| **SEC-08** | Client-Side Button Hiding as Secondary Role Guard | UI Access Control | **LOW** | PARTIALLY MITIGATED by Database RLS |

---

## 3. Detailed Security Findings & Evidence

### FINDING SEC-01: Universal Test Bypass & Hardcoded Admin Credentials in Production Bundle
- **Risk Level:** **CRITICAL**
- **OWASP Category:** A07:2021 — Identification and Authentication Failures
- **Vulnerability Description:**
  In `src/services/supabase.ts`, the helper function `isDevTestBypassAllowed()` evaluates whether test logins are permitted. By default, it returns `true` unless `VITE_ENABLE_TEST_BYPASS` is explicitly set to string `'false'`:
  ```ts
  export function isDevTestBypassAllowed(): boolean {
    const env = (import.meta as any).env || {};
    return env.VITE_ENABLE_TEST_BYPASS !== 'false';
  }
  ```
  When this condition evaluates to true, any user navigating to `/admin` or `/scanner` who inputs `admin@gmail.com` with password `admin@123` is granted a simulated `super_admin` session (`admin-master-001`) saved in `localStorage.setItem('plscf_test_admin_session', ...)`.
  Furthermore, the UI displays quick-fill helper pills (`admin@123`) in `AdminDashboard.tsx`, `ScannerPortal.tsx`, `AdminRmsSettings.tsx`, and `RmsManagementPortal.tsx`.
- **Evidence:**
  - `src/services/supabase.ts:51-54`, `547-565`, `584-602`
  - `src/services/eventStore.ts:118`, `1232-1240`
  - `src/components/AdminDashboard.tsx:588-615`
  - `src/components/ScannerPortal.tsx:215-225`
- **Impact:**
  Anyone visiting the public site can log in as Super Administrator in their browser's local state, view pre-seeded demo records, inspect administration interfaces, and issue local mutations. While Supabase server-side RLS prevents actual database alterations if unauthenticated against Supabase Auth, the client exposure is a major reputation and operational risk.
- **Remediation:**
  1. Default `isDevTestBypassAllowed()` to strictly `false` unless `process.env.NODE_ENV === 'test'`.
  2. Strip all hardcoded test accounts (`admin@123`, `food@123`, etc.) and quick-fill helper buttons from production builds.
  3. Enforce that all administrative logins authenticate exclusively through Supabase Auth (`supabase.auth.signInWithPassword`).

---

### FINDING SEC-02: Client-Side LocalStorage Fallback Mutations without Server Authorization
- **Risk Level:** **HIGH**
- **OWASP Category:** A01:2021 — Broken Access Control
- **Vulnerability Description:**
  The platform utilizes a dual-state architecture: `AppStore` in `src/services/store.ts` reads from and writes to `localStorage` (`plscf_reunion_registrations_v1`). When an admin updates an attendee record via `AppStore.updateRegistration(id, updates)` or deletes a record via `AppStore.deleteRegistration(id)`, the mutation occurs immediately in client storage, followed by an asynchronous background promise to Supabase:
  ```ts
  static updateRegistration(id: string, updates: Partial<RegistrationRecord>, year: number = 2026): RegistrationRecord | null {
    const list = this.getRegistrations();
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...updates };
    this.saveRegistrations(list);
    // Background sync to Supabase (fails silently if unauthenticated)
    SupabaseService.saveRegistration(list[index], year).catch(() => { });
    return list[index];
  }
  ```
- **Evidence:**
  - `src/services/store.ts:1451-1474`
  - `src/services/eventStore.ts:1180-1250`
- **Impact:**
  If a malicious user tampers with their browser's localStorage or executes client script, they can artificially mark their registration as `paid`, modify their T-shirt size, or alter ticket details in their local view. While they cannot modify the remote Supabase database without valid credentials, local verification at offline desks could be deceived if staff laptops do not enforce authoritative server-side checks.
- **Remediation:**
  Require that offline scanner laptops sync an authenticated, read-only cache from Supabase, and disallow any client-side state elevation from overriding server-validated records.

---

### FINDING SEC-03: Standalone ID Card Staff Management Unlinked from Supabase Auth
- **Risk Level:** **HIGH**
- **OWASP Category:** A07:2021 — Identification and Authentication Failures
- **Vulnerability Description:**
  In `src/services/idCardStore.ts`, the ID Card management subsystem stores staff accounts in `localStorage` (`plscf_idcard_staff_accounts_v1`). Password hashes are stored locally or mocked, and staff creation in `IdCardManagementPortal.tsx` assigns local passwords without provisioning a corresponding Supabase Auth user.
- **Evidence:**
  - `src/services/idCardStore.ts:18`, `46-85`, `107-120`
  - `src/components/admin/idcard/IdCardManagementPortal.tsx:1600-1635`
- **Impact:**
  Access control for ID card generation and bulk PDF/ZIP printing is governed primarily in client storage rather than through database-enforced session tokens.
- **Remediation:**
  Migrate `id_card_staff_accounts` into Supabase `auth.users` with linked profiles, matching the hardened pattern implemented in `20261110000000_auth_and_rls_hardening.sql`.

---

### FINDING SEC-04: Hardcoded Default HMAC Signing Secret in Payment Edge Function
- **Risk Level:** **MEDIUM**
- **OWASP Category:** A02:2021 — Cryptographic Failures
- **Vulnerability Description:**
  In `supabase/functions/verify-payment/index.ts`, the HMAC signing secret defaults to a hardcoded string if the environment variable `PAYMENT_SIGNING_SECRET` is unset:
  ```ts
  const PAYMENT_SIGNING_SECRET = Deno.env.get('PAYMENT_SIGNING_SECRET') || 'PLSCF_SECURE_PAYMENT_HMAC_SALT_2027';
  ```
- **Evidence:**
  - `supabase/functions/verify-payment/index.ts:15`
- **Impact:**
  If the hosting administrator deploys the Edge Function without explicitly setting `PAYMENT_SIGNING_SECRET` in Supabase Secrets, an adversary who reads the open-source repository could compute valid `server_verification_signature` strings.
- **Remediation:**
  Terminate the Edge Function on startup with an explicit error if `Deno.env.get('PAYMENT_SIGNING_SECRET')` is missing or shorter than 32 characters, exactly as implemented for `RATE_LIMIT_HMAC_SECRET` in `secure-ticket-lookup/index.ts:60`.

---

### FINDING SEC-05: PayStation Sandbox Simulation Tokens in Edge Function Failure Mode
- **Risk Level:** **MEDIUM**
- **OWASP Category:** A05:2021 — Security Misconfiguration
- **Vulnerability Description:**
  In `supabase/functions/verify-payment/index.ts`, when `PAYSTATION_ENV === 'sandbox'` and `PAYSTATION_PASSWORD` is absent or the endpoint fails, the function returns a simulated token (`sb_edge_sim_token_...`).
- **Evidence:**
  - `supabase/functions/verify-payment/index.ts:58-63`, `81-86`
- **Impact:**
  In staging or sandbox environments, payment checks may pass even if credentials are broken.
- **Remediation:**
  In production (`PAYSTATION_ENV === 'production'`), this code path is inactive; however, all simulated tokens should be completely excised from serverless functions.

---

### FINDING SEC-06: In-Memory Sliding Window Rate Limiter Bypassed by Client Reconnects
- **Risk Level:** **LOW**
- **OWASP Category:** A04:2021 — Insecure Design
- **Vulnerability Description:**
  In `src/utils/security.ts`, `rateLimiter.isAllowed(key, limit, windowMs)` uses an in-memory JavaScript `Map<string, number[]>`:
  ```ts
  class ClientRateLimiter {
    private requests: Map<string, number[]> = new Map();
    // Cleared on page refresh or browser restart
  }
  ```
- **Evidence:**
  - `src/utils/security.ts:285-320`
- **Impact:**
  Client-side rate limiting is easily reset by reloading the page or using private browsing.
- **Mitigating Factor:**
  The serverless Edge Function `secure-ticket-lookup` enforces database-backed rate limiting using `private.ticket_lookup_rate_limits` with hashed IP addresses. The client-side rate limiter is merely a first-line UX throttle.

---

### FINDING SEC-07: Pre-seeded Demo Attendee PII Bundled in Client JavaScript Source
- **Risk Level:** **LOW**
- **OWASP Category:** A01:2021 — Sensitive Data Exposure
- **Vulnerability Description:**
  `INITIAL_REGISTRATIONS` in `src/services/store.ts` contains 3 mock attendee profiles with realistic Bangladeshi names, phone numbers (`01711223344`, `01819887766`), and addresses bundled directly into the compiled JavaScript bundle.
- **Evidence:**
  - `src/services/store.ts:131-205`
- **Impact:**
  While these appear to be synthetic demo records, real phone numbers could receive inadvertent calls or SMS.
- **Remediation:**
  Remove mock seed records from production bundle and initialize client storage with empty arrays `[]`.

---

### FINDING SEC-08: Client-Side Button Hiding as Secondary Role Guard
- **Risk Level:** **LOW**
- **OWASP Category:** A01:2021 — Broken Access Control
- **Vulnerability Description:**
  In `AdminDashboard.tsx`, tabs such as `finances`, `staffManagement`, and `reunionManagement` are conditionally rendered based on `adminSession.role === 'super_admin'`.
- **Evidence:**
  - `src/components/AdminDashboard.tsx:280-320`
- **Impact:**
  If client-side button hiding were the sole defense, an attacker could manipulate React state to view the UI.
- **Mitigating Factor:**
  The PostgreSQL database strictly enforces Row Level Security (RLS) on all underlying tables (`financial_ledger`, `staff_accounts`, `admin_audit_logs`). Even if an attacker unhides the tab, database queries return empty arrays or permission errors (`403 Forbidden`).

---

## 4. Specific Cross-User & Cross-Role Attack Tests

### Test 1: Can Student A access Student B's private information?
- **Result:** **PASSED / PROTECTED**
- **Verification Details:**
  1. Direct PostgREST query: `SELECT * FROM registrations_2027` with `anon` public key is rejected by RLS (`registration_staff_read` policy requires `authenticated` role and staff privileges).
  2. Public ticket lookup: Public attendees must call `/functions/v1/secure-ticket-lookup`. The endpoint requires BOTH the exact registration ID (e.g. `PLSCF-2027-F1001`) AND the verified 11-digit mobile number (`01711223344`). An attacker cannot guess records. Furthermore, requests exceeding 5 attempts per 15 minutes are blocked by IP HMAC rate limiting.
  3. Public Student ID QR verification: Scanning an ID badge opens `/functions/v1/verify-student-id`. The endpoint returns only public badge data (Name, Batch, Class, Photo, Paid Status) and explicitly redacts mobile number, email, address, total paid amount, and payment method (`verify-student-id/index.ts:88`).

### Test 2: Can an admin/staff member access data outside their assigned role?
- **Result:** **PASSED / PROTECTED**
- **Verification Details:**
  1. Department isolation: `rpc_verify_and_approve_service` verifies `v_staff.department`. If Breakfast staff attempts to approve Dinner or Dress distribution, the database function aborts with `'PERMISSION_DENIED: Staff assigned to BREAKFAST cannot approve services in DINNER'` (`migration 20270105000000:142-148`).
  2. Financial modifications: Updating or inserting records into `financial_ledger` requires `super_admin` role; `anon` and field staff are restricted.
  3. Registration deletions: Deleting records requires `public.current_admin_role() = 'super_admin'`.

### Test 3: SQL Injection Vulnerability Assessment
- **Result:** **PASSED / PROTECTED**
- **Verification Details:**
  1. Frontend sanitization in `src/utils/security.ts:160-200` utilizes regex filters (`hasSqlInjectionPattern`) that reject SQL keywords (`UNION`, `SELECT`, `DROP`, `--`, `/*`).
  2. All Supabase queries use parameterized PostgREST endpoints (zero raw string concatenation).
  3. PostgreSQL stored procedures use strictly typed parameters (`TEXT`, `NUMERIC`, `TIMESTAMPTZ`) and parameterized SQL statements.

### Test 4: Cross-Site Scripting (XSS) Vulnerability Assessment
- **Result:** **PASSED / PROTECTED**
- **Verification Details:**
  1. All user-supplied inputs (names, addresses, notes) are sanitized through DOMPurify (`src/utils/security.ts:25-50`).
  2. Inline event handlers (`onerror`, `onload`, `onclick`), `javascript:` pseudo-protocols, and nested SVG attack vectors are neutralized.
  3. All 10 XSS test scenarios in `src/utils/xssSecurity.test.ts` pass with 100% assertions.
  4. Content Security Policy (CSP) in `nginx.conf` and `index.html` restricts script sources to `'self'` and trusted origins.

---

## 5. Security Recommendations & Immediate Action Plan

1. **IMMEDIATE (Priority 1): Disable Test Bypass in Production**
   Ensure that in Vercel / Netlify environment variables, `VITE_ENABLE_TEST_BYPASS` is explicitly set to `"false"`.
2. **IMMEDIATE (Priority 2): Rotate & Enforce Server Secrets**
   Set `PAYMENT_SIGNING_SECRET`, `RATE_LIMIT_HMAC_SECRET`, `AUDIT_SIGNING_SECRET`, and `PAYSTATION_PASSWORD` in Supabase Edge Secrets (`supabase secrets set`). Remove all default fallback strings.
3. **SHORT TERM (Priority 3): Eliminate Client Demo Seeds**
   Clear `INITIAL_REGISTRATIONS` from `src/services/store.ts` so that no synthetic attendee data or realistic phone numbers are compiled into production bundles.
4. **MEDIUM TERM (Priority 4): Unified Supabase Auth for ID Card Staff**
   Link `id_card_staff_accounts` directly to Supabase Auth `auth_user_id` to eliminate local unhashed password validation.

