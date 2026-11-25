# PayStation Critical Security Remediation — Implementation Plan

**Project:** PLSCF Reunion 2027 Portal (React 19, TypeScript, Vite, Supabase PostgreSQL & Edge Functions, Vercel Serverless Functions)  
**Plan Date:** November 25, 2026  
**Status:** PLANNING ONLY — Awaiting Explicit Approval Before Any Code, Migration, Environment, or Deployment Changes  
**PayStation API Reference:** https://paystation.com.bd/documentation  

> **Audit Source Verification Note:**  
> A file literally named `PAYSTATION_PAYMENT_ARCHITECTURE_AUDIT.md` was **not present** in the repository at the time of inspection. All findings and planned changes below were directly verified against the repository source code (`src/`, `api/`, `supabase/functions/`, `supabase/migrations/`, `vercel.json`, `netlify.toml`, `vite.config.ts`, `.env.example`, `.gitignore`, `dist/assets/*.js`, and key-only metadata inspection of `.env` and `.env.local`), cross-referenced with [`PAYSTATION_INTEGRATION.md`](./PAYSTATION_INTEGRATION.md), [`DEPLOYMENT_AND_ENVIRONMENT_GUIDE.md`](./DEPLOYMENT_AND_ENVIRONMENT_GUIDE.md), [`COMPLETE_WEBSITE_SYSTEM_AUDIT.md`](./COMPLETE_WEBSITE_SYSTEM_AUDIT.md), and the prior session audit report.  
> **Items Unverified from Local Source Alone (Runtime / External Dashboards):**  
> - Live PayStation Merchant Portal IPN URL and merchant account credentials/whitelist configuration.  
> - Live Supabase Cloud Edge Function Secrets currently configured on project `hnthoszbkhvygoowtvau`.  
> - Live Vercel Project Environment Variables and whether Vercel or Netlify is the active production DNS target.  
> - Which migrations in `supabase/migrations/` have already been executed against the live remote Supabase database.

---

## A. Executive Summary

The PLSCF Reunion 2027 payment system has a solid structural intent—server-side `pending_orders` snapshots, `ipn_logs`, an immutable `payment_transactions` ledger, and idempotent `SECURITY DEFINER` RPCs—but **must remain disabled for live payments** until the critical vulnerabilities documented below are resolved:

1. **PayStation Password & Signing Secret Exposed in Public Frontend Bundle (`dist/assets/*.js`):**  
   `.env` sets `VITE_PAYSTATION_PASSWORD`, and [`src/services/paystation.ts`](./src/services/paystation.ts#L227-L243) unconditionally reads `VITE_PAYSTATION_PASSWORD` with a hardcoded password literal fallback even in `production` mode. In addition, [`src/utils/security.ts`](./src/utils/security.ts#L10-L12) embeds a hardcoded fallback `SERVER_PAYMENT_SECRET` in browser JavaScript. Inspection of the compiled `dist/assets/*.js` chunks confirmed that the PayStation merchant password literal, merchant ID literal, and client signing secret fallback are all present in the production browser bundle.
2. **Vercel Rewrite Precedence Bypasses Serverless Payment Handlers:**  
   [`vercel.json`](./vercel.json#L82-L93) evaluates `/api/paystation/:path*` → `https://sandbox.paystation.com.bd/:path*` **before** `/api/:path*` → `/api/:path*`. On Vercel, requests to `/api/paystation/initiate-payment`, `/api/paystation/transaction-status`, and `/api/paystation/ipn` skip [`api/paystation/*.ts`](./api/paystation/initiate-payment.ts) completely and proxy directly to PayStation sandbox—meaning an IPN configured at `/api/paystation/ipn` would bounce back to PayStation instead of updating Supabase.
3. **Anonymous (`anon`) Browser Clients Can Mark Registrations & Donations Paid Without Paying:**  
   Database migrations grant `EXECUTE` on `rpc_verify_payment`, `rpc_handle_paystation_ipn`, `rpc_promote_pending_order_to_registration`, and `rpc_record_donation` to `anon`, and grant `anon` permissive `INSERT`/`UPDATE`/`DELETE` policies on `public.donations` and `public.donations_2027` plus `SELECT USING (true)` on `public.pending_orders`. Because `SupabaseService.verifyPayment()` and `DonationPage.tsx` call these RPCs from the browser, anyone holding the public `VITE_SUPABASE_ANON_KEY` can forge a paid registration or donation without interacting with PayStation.
4. **Unverified IPN Webhooks & Forged Client Signatures:**  
   Neither [`supabase/functions/verify-payment/index.ts`](./supabase/functions/verify-payment/index.ts#L277-L338) nor [`api/paystation/ipn.ts`](./api/paystation/ipn.ts#L19-L56) verifies incoming IPN payloads against PayStation's `/transaction-status` API before marking orders `paid`. Meanwhile, [`verify-payment/index.ts`](./supabase/functions/verify-payment/index.ts#L11-L17) contains hardcoded sandbox fallback credentials and silently sets `isVerified = true` on errors whenever `PAYSTATION_ENV` defaults to `'sandbox'`.
5. **Financial Accounting & Parameter Integrity Defects:**  
   Gateway surcharges (`1.50%`–`3.10%`) are added to `payment_amount` in `PaymentModal.tsx` but omitted when computing `donationAmount` in `PayStationService.completeRegistrationAfterPayment()` and `App.tsx`, inflating recorded donations. Donations do not persist a server-side `pending_orders` row before redirect (losing closed-tab donations), `api/paystation/initiate-payment.ts` mismatches `opt_a`/`opt_b` values, and migration `20270116` stripped amount validation, anti-replay checks, `ipn_logs`, and `financial_ledger` writes from `rpc_handle_paystation_ipn`.

Live real-money transactions **must not be enabled** until all **P0** and **P1** items in this plan are implemented, tested, and verified after credential rotation.

---

## B. Prioritized Remediation Plan

### P0 — Critical Security Vulnerabilities (Production Blockers)

| ID | Issue | Target Area |
| :--- | :--- | :--- |
| **P0-1** | Remove `VITE_PAYSTATION_PASSWORD`, hardcoded PayStation password/merchant fallbacks, client `SERVER_PAYMENT_SECRET`, and browser-direct PayStation API calls (`initiate-payment`, `transaction-status`, `v2/transaction-status`). | `.env`, `src/services/paystation.ts`, `src/utils/security.ts`, `api/paystation/*.ts`, `supabase/functions/verify-payment/index.ts` |
| **P0-2** | Fix `vercel.json` rewrite rules so `/api/paystation/initiate-payment`, `/api/paystation/transaction-status`, and `/api/paystation/ipn` never get shadowed by raw proxy rewrites (and select a single canonical backend gateway path). | `vercel.json`, `vite.config.ts`, `netlify.toml` |
| **P0-3** | Revoke `PUBLIC` and `anon` `EXECUTE` permissions on `rpc_verify_payment`, `rpc_handle_paystation_ipn`, `rpc_promote_pending_order_to_registration`, `rpc_record_donation`, and `rpc_reconcile_pending_orders`; harden RLS on `pending_orders`, `donations`, and `donations_2027`. | New SQL migration + `src/services/supabase.ts`, `src/services/paystation.ts`, `src/services/store.ts` |
| **P0-4** | Enforce mandatory server-to-server PayStation `/transaction-status` verification before any payment confirmation or IPN finalization; validate invoice, `trx_id`, expected server-stored amount, currency (`BDT`), status, order type/ownership, and anti-replay uniqueness. | `supabase/functions/verify-payment/index.ts`, `api/paystation/ipn.ts`, `src/components/PaymentModal.tsx`, `src/components/DonationPage.tsx` |
| **P0-5** | Remove hardcoded sandbox credentials and signing-secret fallbacks from backend/Edge code; enforce fail-closed behavior when required production secrets are missing; lock down `VITE_ENABLE_TEST_BYPASS` and `isDevTestBypassAllowed()`. | `supabase/functions/verify-payment/index.ts`, `api/paystation/*.ts`, `src/services/supabase.ts`, `src/components/DonationPage.tsx`, `src/components/PaymentModal.tsx` |

### P1 — Payment Correctness & Financial Integrity

| ID | Issue | Target Area |
| :--- | :--- | :--- |
| **P1-1** | Recompute payable amounts (registration fee, parent pass fee, donation, gateway surcharge) on the server from `portal_fee_settings` during payment initiation instead of trusting client-submitted `payment_amount`. | `supabase/functions/verify-payment/index.ts`, `api/paystation/initiate-payment.ts` |
| **P1-2** | Fix `opt_a` / `opt_b` parameter mismatches (`'DONATION'` vs `'donation'`, `category` on `opt_a` vs `opt_b`) in `api/paystation/initiate-payment.ts`. | `api/paystation/initiate-payment.ts`, `src/components/DonationPage.tsx`, `src/components/PaymentModal.tsx` |
| **P1-3** | Fix `gatewayCharge` / `parentFee` / `donationAmount` double-counting and decomposition across `PaymentModal.tsx`, `PayStationService.completeRegistrationAfterPayment()`, and `App.tsx`. | `src/services/paystation.ts`, `src/components/PaymentModal.tsx`, `src/App.tsx` |
| **P1-4** | Persist pending donation drafts in `public.pending_orders` (`order_type = 'donation'`) before gateway redirect and support donation promotion inside IPN/verification flows. | `src/components/DonationPage.tsx`, `src/services/paystation.ts`, `supabase/functions/verify-payment/index.ts`, New SQL migration |
| **P1-5** | Restore `rpc_handle_paystation_ipn` validation & accounting lost in migration `20270116` (amount tolerance check including `parent_fee` & `gateway_charge`, `trx_id` anti-replay, `ipn_logs`, `financial_ledger`, `admin_audit_logs`, and `pending_orders` sync) while keeping `'paid'` status unification. | New SQL migration |
| **P1-6** | Fix `verify-payment` Edge Function `verify-payment` action so it promotes via `pending_orders` (or uses server-stored `pending_orders.form_data`) instead of failing with `REGISTRATION_NOT_FOUND` when `registrations_2027` has no pre-inserted `pending` row. | `supabase/functions/verify-payment/index.ts`, `src/services/paystation.ts` |

### P2 — Reliability, Diagnostics & Documentation Cleanup

| ID | Issue | Target Area |
| :--- | :--- | :--- |
| **P2-1** | Schedule/wire `rpc_reconcile_pending_orders` via a server-side Edge/Cron endpoint (`service_role`), and ensure `rpc_verify_payment` marks matching `pending_orders` rows as `'paid'` so settled orders are not re-polled. | `supabase/functions/verify-payment/index.ts` (or dedicated cron Edge Function), New SQL migration, `src/services/paystation.ts` |
| **P2-2** | Fix `DonationPage.tsx` `isSandboxSim` detection (`&simulated=true`), add missing `'amex'` label in `PaymentModal.tsx` Sandbox Guide (`L928-933`), and update `runSupabaseDiagnostic()` in `src/services/supabase.ts` so it does not expect `anon` to write `'paid'` rows or invoke restricted RPCs. | `src/components/DonationPage.tsx`, `src/components/PaymentModal.tsx`, `src/services/supabase.ts` |
| **P2-3** | Update unit tests (`paystation.test.ts`, `security.test.ts`, `crossDeviceQrVerification.test.ts`) to match server-only signing & server-authoritative verification without mocking `anon` privilege bypasses, and reconcile stale docs (`DEPLOYMENT_AND_ENVIRONMENT_GUIDE.md`, `COMPLETE_WEBSITE_SYSTEM_AUDIT.md`, `PAYSTATION_INTEGRATION.md`). | `src/utils/*.test.ts`, `*.md` |

---

## C. File-by-File Change Plan

> **Canonical Backend Architecture Decision (Prerequisite):**  
> The repo currently splits logic across two server layers: **Supabase Edge Function** (`supabase/functions/verify-payment/index.ts`) and **Vercel Serverless Functions** (`api/paystation/*.ts`).  
> **Recommended Pattern:** Standardize on **Supabase Edge Function `verify-payment`** as the primary server gateway (since it already has direct `SUPABASE_SERVICE_ROLE_KEY`, WebCrypto HMAC-SHA256, and works identically regardless of whether the frontend is hosted on Vercel, Netlify, or static CDN), **and** fix `vercel.json` + harden `api/paystation/*.ts` (or retire `api/paystation/initiate-payment.ts` and `transaction-status.ts` cleanly if Vercel serverless is not used) so no unhardened or shadowed endpoints remain.

### 1. `.env`, `.env.local`, and `.env.example`

- **Exact File Paths:** `.env`, `.env.local`, [`.env.example`](./.env.example)
- **Current Behavior:** `.env` defines `VITE_PAYSTATION_MERCHANT_ID`, `VITE_PAYSTATION_ENV=sandbox`, and `VITE_PAYSTATION_PASSWORD` (18-char sandbox password), while lacking unprefixed `PAYSTATION_PASSWORD`. `.env.local` defines only Supabase and `VITE_ENABLE_TEST_BYPASS`. `.env.example` correctly excludes `VITE_PAYSTATION_PASSWORD`.
- **Identified Problem:** `VITE_PAYSTATION_PASSWORD` in `.env` causes Vite to inline the password into `dist/assets/*.js` during `vite build`.
- **Proposed Change:**
  - Remove `VITE_PAYSTATION_PASSWORD` from `.env` completely (and never set it in Vercel frontend env or `.env.local`).
  - Keep only non-secret client flags (`VITE_PAYSTATION_ENV`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ENABLE_TEST_BYPASS=false`) in frontend env, and remove `VITE_PAYSTATION_MERCHANT_ID` if not needed in UI footer (or keep as non-secret display ID only if desired; server must use `PAYSTATION_MERCHANT_ID`).
  - Configure `PAYSTATION_MERCHANT_ID`, `PAYSTATION_PASSWORD`, `PAYSTATION_ENV`, and `PAYMENT_SIGNING_SECRET` exclusively in Supabase Edge Secrets (and Vercel Server Env if `api/paystation/*.ts` remains active).
- **Dependencies:** `src/services/paystation.ts`, `supabase/functions/verify-payment/index.ts`, `api/paystation/*.ts`.
- **Expected Result:** Zero PayStation passwords or signing secrets bundled into `dist/assets/*.js`.
- **Risk Level:** **High** (removing `VITE_PAYSTATION_PASSWORD` breaks direct browser initiation in dev unless local dev routes through the Edge Function or hardened local/Vercel server handler).

### 2. [`src/services/paystation.ts`](./src/services/paystation.ts)

- **Exact File Path:** `src/services/paystation.ts`
- **Current Behavior:**
  - `getConfig()` (`L227-L243`) populates `merchantId` with a hardcoded fallback and `password` from `env.VITE_PAYSTATION_PASSWORD || <hardcoded fallback>` regardless of `isProduction`.
  - `createPayment()` (`L316-L382`) tries Edge Function `verify-payment` only when `!config.isSandbox`, and **always falls back** to sending `merchantId` + `password` directly from the browser to `${config.proxyBaseUrl}/initiate-payment` and `${config.baseUrl}/initiate-payment`.
  - `getTransactionStatusV1()` (`L412-L514`) and `getTransactionStatusV2()` (`L522-L576`) fall back to browser-direct calls to PayStation and mock success in sandbox (`L489-L511`).
  - `completeRegistrationAfterPayment()` (`L1093`, `L1099`, `L1197`, `L1301`) computes a client-side signature via `generateServerPaymentSignature()`, computes `donation = payment.amount - totalBaseWithParent` without subtracting `gatewayCharge`, calls `SupabaseService.verifyPayment()` (which triggers `anon` `rpc_verify_payment`), and fires an unawaited `void this.verifyWithSupabaseEdge(...)` afterward.
  - `createPendingRegistration()` (`L1018`) writes `pending_orders` fire-and-forget without awaiting confirmation, and `completeDonationAfterPayment()` (`L1377`) writes donations directly via `SupabaseService.saveDonation()`.
- **Identified Problem:** Exposes PayStation password & signing logic in browser JS, allows client-controlled confirmation bypassing PayStation verification, miscalculates `donationAmount` by `gatewayCharge`, and risks race conditions when `pending_orders` insert isn't awaited before redirect.
- **Proposed Change:**
  - Remove `password` from `PayStationConfig` and `getConfig()`; remove hardcoded `merchantId` and `password` fallbacks; remove `buildFormBody()` credential injection from client code.
  - Route `createPayment()` exclusively through the trusted backend (`supabase.functions.invoke('verify-payment', { body: { action: 'create-payment', ... } })` or `/api/paystation/initiate-payment` server endpoint—no browser-direct PayStation `fetch()` fallback).
  - Gate sandbox simulation strictly behind explicit non-production/test checks (`!import.meta.env.PROD` and server-side `PAYSTATION_ENV === 'sandbox'`), never silently succeeding in production.
  - Await `public.pending_orders` creation (via a hardened server/RPC endpoint that also validates fees) **before** initiating PayStation checkout and redirecting, for **both** registrations and donations (`createPendingDonation()`).
  - Replace `completeRegistrationAfterPayment()`'s client-side signature + `anon` `rpc_verify_payment` call with a single authoritative server call (`verifyWithSupabaseEdge` / `/api/paystation/verify-and-finalize`) that verifies PayStation status server-to-server, writes to Supabase via `service_role`, and returns the finalized ticket + server HMAC signature.
  - Fix `donation` calculation (`L1095-L1099`) to subtract `parentFee` **and** `gatewayCharge` (`const expectedSubtotal = Math.max(0, payment.amount - totalBaseWithParent - gatewayCharge)`).
  - Remove `handleIpnWebhook()` client fallback from calling `rpc_handle_paystation_ipn` directly from browser (`L619-L698`) except in isolated unit-test mocks; real IPN webhooks must be server-only.
- **Dependencies:** `supabase/functions/verify-payment/index.ts`, `api/paystation/*.ts`, `src/components/PaymentModal.tsx`, `src/components/DonationPage.tsx`, `src/services/supabase.ts`, `src/utils/paystation.test.ts`.
- **Expected Result:** Frontend holds zero payment secrets and cannot self-confirm unpaid orders; `pending_orders` always exists prior to redirect; donation amounts exclude gateway fees.
- **Risk Level:** **High** (core checkout path—requires coordinated deployment with Edge Function and DB migration).

### 3. [`src/utils/security.ts`](./src/utils/security.ts)

- **Exact File Path:** `src/utils/security.ts`
- **Current Behavior:** `SERVER_PAYMENT_SECRET` (`L10-L12`) has a hardcoded fallback string; `generateServerPaymentSignature()` (`L401-L418`) uses a weak 32-bit shift hash in client JS; `verifyServerPaymentSignature()` (`L423-L437`) blindly trusts any string starting with `SIG_HMAC256_` or `SIG_SERVER_` of length `>= 20` (`L432-L434`) without server verification.
- **Identified Problem:** Hardcoded secret is compiled into `dist/assets/*.js`, weak hash is trivially forged, and client verification accepts arbitrary `SIG_HMAC256_*` strings.
- **Proposed Change:**
  - Remove `SERVER_PAYMENT_SECRET` hardcoded fallback and remove client-side production signature generation from `src/utils/security.ts`.
  - Authoritative payment signatures (`SIG_HMAC256_...`) must be generated exclusively inside `supabase/functions/verify-payment/index.ts` (using `PAYMENT_SIGNING_SECRET`) or PostgreSQL `pgcrypto` (using a server-only secret).
  - For offline/unit-test compatibility in `security.test.ts` / `paystation.test.ts`, either restrict `generateServerPaymentSignature` to explicit test-only helper inputs (never reading/embedding a production secret fallback) or verify ticket authenticity via server RPC (`rpc_verify_student_qr`), while keeping `verifyServerPaymentSignature()` honest (no false sense of cryptographic verification in browser).
- **Dependencies:** `src/services/paystation.ts`, `src/utils/security.test.ts`, `src/utils/paystation.test.ts`.
- **Expected Result:** No signing secret embedded in client JS bundle; tickets carry authentic server-generated HMAC-SHA256 signatures.
- **Risk Level:** **Medium** (requires updating `security.test.ts` and `paystation.test.ts` assertions that expect `SIG_V2_` client signatures).

### 4. [`vercel.json`](./vercel.json), [`vite.config.ts`](./vite.config.ts), and [`netlify.toml`](./netlify.toml)

- **Exact File Paths:** `vercel.json`, `vite.config.ts`, `netlify.toml`
- **Current Behavior:**
  - `vercel.json` (`L82-L93`) defines `/api/paystation/:path*` → `https://sandbox.paystation.com.bd/:path*` and `/api/paystation-live/:path*` → `https://api.paystation.com.bd/:path*` **above** `/api/:path*` → `/api/:path*`.
  - `vite.config.ts` (`L54-L67`) proxies `/api/paystation` and `/api/paystation-live` to PayStation directly during local Vite dev.
  - `netlify.toml` (`L15-L18`) redirects `/api/*` → `/api/:splat` (`200`), which does not invoke Vercel `api/*.ts` handlers on Netlify.
- **Identified Problem:** `vercel.json` shadows `api/paystation/initiate-payment.ts`, `transaction-status.ts`, and `ipn.ts` so they never execute on Vercel. Raw browser-to-PayStation proxying forces the browser to supply `password`.
- **Proposed Change:**
  - In `vercel.json`, **remove** the `/api/paystation/:path*` and `/api/paystation-live/:path*` proxy rewrite entries (`L82-L89`), preserving `/rest/v1/:path*`, `/api/:path*`, static routes, CSP/security headers, and the SPA fallback (`L94-L97`).
  - Check CSP `connect-src` / `frame-src` / `form-action` in `vercel.json`, `netlify.toml`, and `index.html`: keep `https://api.paystation.com.bd` and `https://sandbox.paystation.com.bd` in `form-action`/`frame-src` if needed for hosted checkout redirects, while ensuring all API calls from browser go only to `self` or Supabase Edge Functions.
  - In `vite.config.ts`, remove raw credential-requiring PayStation proxies (or point local dev `/api/paystation/*` to a local Node/Vercel dev server or Supabase local Edge Functions).
  - In `netlify.toml`, document clearly if Netlify is unused, or remove misleading `/api/*` passthrough if Vercel/Supabase Edge is the sole runtime.
- **Dependencies:** `api/paystation/*.ts`, `src/services/paystation.ts`.
- **Expected Result:** `/api/paystation/initiate-payment`, `/api/paystation/transaction-status`, and `/api/paystation/ipn` route reliably to their backend serverless handlers on Vercel instead of bypassing them.
- **Risk Level:** **Medium** (must deploy updated frontend alongside `vercel.json` so the browser no longer expects raw PayStation responses at `/api/paystation/*` without backend handlers).

### 5. [`supabase/functions/verify-payment/index.ts`](./supabase/functions/verify-payment/index.ts)

- **Exact File Path:** `supabase/functions/verify-payment/index.ts`
- **Current Behavior:**
  - `L11-L17`: Hardcodes fallback values for `PAYSTATION_MERCHANT_ID`, `PAYSTATION_PASSWORD`, `PAYSTATION_ENV` (`'sandbox'`), and `PAYMENT_SIGNING_SECRET`.
  - `L102-L198` (`create-payment` / `initiate-payment`): Forwards client-supplied `payment_amount` and `callback_url` to PayStation without verifying fee settings or `pending_orders`; in `sandbox` error paths (`L163-L195`), fabricates a `Successful` callback URL automatically.
  - `L277-L338` (`ipn`): Trusts incoming `trx_status` and `trx_amount` without calling PayStation `/transaction-status`; calls `rpc_handle_paystation_ipn` without checking `pending_orders` (donations or uninserted registrations).
  - `L343-L413` (`verify-payment`): In `sandbox`, sets `isVerified = true` on API errors or missing `trx_id` (`L365-L373`); calls `rpc_verify_payment` **without** `p_pending_data` (`L394-L401`) even though `registrations_2027` has no pending row! Also ignores `rpc_verify_payment` errors (doesn't check `{ data, error }`).
- **Identified Problem:** Fail-open fallbacks, unverified IPN webhooks, unvalidated client amounts, and inability to finalize registrations/donations when `registrations_2027` has no pre-inserted `pending` row.
- **Proposed Change:**
  - **Fail-closed configuration:** Remove all hardcoded credential and signing-secret fallbacks (`L11-L14`). Require `PAYSTATION_MERCHANT_ID`, `PAYSTATION_PASSWORD`, `PAYMENT_SIGNING_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; if missing (especially when `PAYSTATION_ENV === 'production'`), return HTTP `500` `{ success: false, error: 'PAYMENT_GATEWAY_MISCONFIGURED' }` immediately. Require `PAYSTATION_ENV` explicitly (`'production'` or `'sandbox'`).
  - **Server-authoritative `create-payment`:**
    1. Validate `APP_ALLOWED_ORIGINS` strictly (reject unknown browser `Origin` on client actions; allow server-to-server `POST` only for `ipn` when `origin` is absent, subject to PayStation API verification).
    2. Check `system_settings` (`portal_fee_settings`) on the server for `registrationOpen`, `alumniRegistrationOpen`, `currentStudentRegistrationOpen`, and `donationOpen`.
    3. Recompute/verify expected `payment_amount` on the server from `portal_fee_settings` + `parentFee` + `donationAmount` + `gatewayCharge` (and for donations enforce `amount >= 10`), validate `callback_url` origin against `APP_ALLOWED_ORIGINS`, and persist the `pending_orders` row via `service_role` **before** calling PayStation `/initiate-payment`.
  - **Hardened `verify-payment` & `ipn` actions:**
    1. For `ipn`: Require `invoice_number` and `trx_id`; immediately query PayStation `/transaction-status` (by `invoice_number`, header `merchantId`) and/or `/v2/transaction-status` (by `trxId`, header `merchantId`) server-to-server. Never trust the inbound IPN body alone!
    2. For `verify-payment`: Require `invoice_number` (and optional `trx_id`); query PayStation `/transaction-status` server-to-server. Remove `L365-L373` blind `isVerified = true` sandbox bypasses (only allow simulated mode if `PAYSTATION_ENV === 'sandbox'` AND `PAYSTATION_ALLOW_SIMULATION === 'true'` AND explicitly marked simulated).
    3. Cross-check PayStation's response (`status_code === '200'`, `trx_status` is success and not `processing`, `trx_id` matches, `currency === 'BDT'` if present, and `Number(payment_amount || trx_amount) >= expected_amount` from `pending_orders.amount` within tolerance, rejecting underpayments).
    4. Generate authoritative HMAC-SHA256 signature using `PAYMENT_SIGNING_SECRET`.
    5. Finalize atomically via `service_role`: call `rpc_promote_pending_order_to_registration` (for registration `pending_orders`) or a hardened `rpc_promote_pending_order_to_donation` / `rpc_record_donation` (for donation `pending_orders`), and return the confirmed ticket/donation record + server signature to the client. Inspect and propagate RPC errors (`{ data, error }`), never ignoring failures.
- **Dependencies:** `src/services/paystation.ts`, New SQL migration, Supabase Edge Secrets.
- **Expected Result:** Single authoritative, fail-closed, zero-trust server gateway for initiation, verification, and IPN.
- **Risk Level:** **High** (must be tested thoroughly in sandbox before switching to production).

### 6. [`api/paystation/initiate-payment.ts`](./api/paystation/initiate-payment.ts), [`api/paystation/transaction-status.ts`](./api/paystation/transaction-status.ts), and [`api/paystation/ipn.ts`](./api/paystation/ipn.ts)

- **Exact File Paths:** `api/paystation/initiate-payment.ts`, `api/paystation/transaction-status.ts`, `api/paystation/ipn.ts`
- **Current Behavior:**
  - `initiate-payment.ts`: Hardcoded fallbacks (`L12`, `L16`, `L56`), checks `VITE_PAYSTATION_*` env vars, fails open on Supabase `try/catch` (`L101`), checks `opt_a === 'DONATION'` (uppercase) while `DonationPage.tsx` sends `'donation'`, and checks `opt_b === 'former'/'current'` while `PaymentModal.tsx` sends `category` in `opt_a` and `batchName` in `opt_b`.
  - `transaction-status.ts`: Hardcoded merchant fallback (`L12`), checks `VITE_PAYSTATION_*`.
  - `ipn.ts`: Uses `VITE_SUPABASE_ANON_KEY` fallback (`L11`), does NOT verify IPN payload against PayStation `/transaction-status`, and calls `rpc_handle_paystation_ipn` (which fails for donations and drops if `rpc_handle_paystation_ipn` is restricted to `service_role` when `SUPABASE_SECRET_KEY` is absent).
- **Identified Problem:** Hardcoded secrets, broken governance checks, unauthenticated IPN acceptance, and duplicate maintenance surface vs Supabase Edge Function.
- **Proposed Change (Two Options — Recommend Option A):**
  - **Option A (Recommended — Consolidate on Edge Function):** Replace `api/paystation/*.ts` with thin server-to-server forwarders to the `verify-payment` Edge Function (or remove client-callable duplicates and keep `/api/paystation/ipn.ts` purely as a verified forwarder / `service_role` handler), removing all PayStation/Supabase credential fallbacks (`L12`, `L16`, `L56`).
  - **Option B (If keeping Vercel handlers active):** Remove all hardcoded fallbacks (`L12`, `L16`, `L56`), stop reading `VITE_PAYSTATION_*` for server secrets, require `SUPABASE_SECRET_KEY` (`service_role`) in `ipn.ts` (never `VITE_SUPABASE_ANON_KEY`), fix `opt_a`/`opt_b` checks (normalize case and pass explicit `order_type` / `category`), fail closed if `system_settings` cannot be checked, and add mandatory PayStation `/transaction-status` verification inside `ipn.ts`.
- **Dependencies:** `vercel.json`, `supabase/functions/verify-payment/index.ts`.
- **Expected Result:** No unhardened serverless entrypoints or parameter mismatches.
- **Risk Level:** **Medium**.

### 7. [`src/services/supabase.ts`](./src/services/supabase.ts) and [`src/services/store.ts`](./src/services/store.ts)

- **Exact File Paths:** `src/services/supabase.ts`, `src/services/store.ts`
- **Current Behavior:**
  - `isDevTestBypassAllowed()` (`supabase.ts:81-84`) returns `env.VITE_ENABLE_TEST_BYPASS !== 'false'` (enabled by default whenever unset!).
  - `runSupabaseDiagnostic()` (`supabase.ts:102-255`) attempts to write a `'paid'` row directly from `anon` (`L173-L208`) and calls `rpc_verify_payment` directly from `anon` (`L211-L230`).
  - `verifyPayment()` (`supabase.ts:985-1142`) prioritizes direct client `rpc_verify_payment` (`Strategy 1`), then Edge Function (`Strategy 2`), then direct table `UPDATE`/`UPSERT` (`Strategy 3`).
  - `saveDonation()` (`supabase.ts:1149-1235`) calls `rpc_record_donation` directly from `anon` and falls back to direct `donations` upsert.
  - `AppStore.addRegistration()` (`store.ts:328-352`) and `AppStore.addDonation()` (`store.ts:685-695`) asynchronously invoke `SupabaseService.saveRegistration()` / `saveDonation()` even when the caller already verified payment on the server.
- **Identified Problem:** `anon` clients cannot continue calling `rpc_verify_payment`, `rpc_record_donation`, or writing `paid` rows directly once DB permissions are locked down. Also `isDevTestBypassAllowed()` defaults to `true` when `VITE_ENABLE_TEST_BYPASS` is omitted.
- **Proposed Change:**
  - Change `isDevTestBypassAllowed()` (`supabase.ts:81-84`) to `return env.VITE_ENABLE_TEST_BYPASS === 'true' && !env.PROD;` (strict opt-in, impossible in production build).
  - Reorder `SupabaseService.verifyPayment()` so online gateway verification calls the `verify-payment` Edge Function as the sole remote verification path (removing client `anon` `rpc_verify_payment` and direct `registrations_2027` `paid` upsert fallbacks in browser production mode, while preserving test-mock hooks for `crossDeviceQrVerification.test.ts` or updating the test).
  - Refactor `AppStore.addRegistration()` / `addDonation()` (or pass `{ skipRemoteSync: true }`) so already-server-verified PayStation records update local cache without re-invoking restricted DB write RPCs from the browser. Keep manual registration approval (`rpc_approve_manual_registration`) and admin `updateRegistration` paths untouched.
  - Update `runSupabaseDiagnostic()` (`supabase.ts:171-250`) so it verifies `Edge Function` (`health-check`) and expected RLS protection (`canWritePaid === false` for `anon` is **healthy**, not an error!).
- **Dependencies:** `src/services/paystation.ts`, `src/services/manualRegistrationService.ts`, `src/components/AdminDashboard.tsx`, `src/utils/crossDeviceQrVerification.test.ts`.
- **Expected Result:** Zero `anon` attempts to mutate `paid` state; diagnostic checks accurately reflect hardened security posture.
- **Risk Level:** **Medium**.

### 8. [`src/components/PaymentModal.tsx`](./src/components/PaymentModal.tsx), [`src/components/DonationPage.tsx`](./src/components/DonationPage.tsx), and [`src/App.tsx`](./src/App.tsx)

- **Exact File Paths:** `src/components/PaymentModal.tsx`, `src/components/DonationPage.tsx`, `src/App.tsx`
- **Current Behavior:**
  - `PaymentModal.tsx` (`L153`) recalculates `effectiveDonation = payment.amount - currentSubtotal - effectiveCharge`, then `PayStationService.completeRegistrationAfterPayment()` (`L1099`) recomputes `donation = payment.amount - totalBaseWithParent` (adding `gatewayCharge` back into `donationAmount`).
  - `PaymentModal.tsx` (`L376-L379`) intercepts sandbox payments locally without calling PayStation API unless `forceHostedExternal=true`, and (`L928-L933`) omits an `amex` title in the Sandbox Guide header.
  - `DonationPage.tsx` (`L147-L174`, `L253-L281`) allows client-side completion via `VITE_ENABLE_TEST_BYPASS`, skips `pending_orders` server persistence (`L360-L380`), sends lowercase `opt_a: 'donation'` (`L395`), checks non-matching URL string `checkout/pay?invoice=` (`L404`), and omits gateway surcharge disclosure/handling.
  - `App.tsx` (`L233-L234`) computes `donAmt = Math.max(0, sessionAmount - regFee)` on payment return without accounting for `parentFee` or `gatewayCharge`.
- **Identified Problem:** Accounting drift (`donationAmount` inflated by `gatewayCharge`), lost donations if browser closes during checkout, client-side bypass paths in `DonationPage`, and broken sandbox simulation branch detection.
- **Proposed Change:**
  - In `PaymentModal.tsx`: Ensure `handlePayStationHostedCheckout()` uses server-verified finalization (`verify-payment` Edge Function) in live mode; gate `handleInstantSandboxPayment()` strictly behind `!import.meta.env.PROD && config.isSandbox`; add `selectedMethod === 'amex'` label at `L928-L933`.
  - In `DonationPage.tsx`: Persist pending donation to `public.pending_orders` via server initiation endpoint before redirect; remove `VITE_ENABLE_TEST_BYPASS` client completion from production builds; fix `isSandboxSim` check (`createRes.paymentUrl.includes('simulated=true')`); enforce server-verified finalization on callback return (`verifyReturnedPayment` → Edge `verify-payment`).
  - In `App.tsx` (`L230-L243`): Preserve `parentFee`, `gatewayCharge`, and `donationAmount` directly from `pendingSession.fees` (or server `pending_orders` lookup) instead of subtracting only `regFee` from `sessionAmount`.
- **Dependencies:** `src/services/paystation.ts`, `supabase/functions/verify-payment/index.ts`.
- **Expected Result:** Exact reconciliation between `total_paid`, `registration_fee`, `parent_fee`, `gateway_charge`, and `donation_amount`; zero lost closed-tab donations.
- **Risk Level:** **Medium**.

### 9. Unit Tests & Documentation Files

- **Exact File Paths:** [`src/utils/paystation.test.ts`](./src/utils/paystation.test.ts), [`src/utils/security.test.ts`](./src/utils/security.test.ts), [`src/utils/crossDeviceQrVerification.test.ts`](./src/utils/crossDeviceQrVerification.test.ts), [`PAYSTATION_INTEGRATION.md`](./PAYSTATION_INTEGRATION.md), [`DEPLOYMENT_AND_ENVIRONMENT_GUIDE.md`](./DEPLOYMENT_AND_ENVIRONMENT_GUIDE.md), [`COMPLETE_WEBSITE_SYSTEM_AUDIT.md`](./COMPLETE_WEBSITE_SYSTEM_AUDIT.md)
- **Current Behavior:**
  - `paystation.test.ts:15-20` asserts `config.password === ''` in production (which currently passes only because tests run in sandbox); `L90` asserts `SIG_V2_` prefix.
  - `security.test.ts:85-101` tests client-side `generateServerPaymentSignature` with `SIG_V2_`.
  - `PAYSTATION_INTEGRATION.md:58-61, 88` prints literal sandbox credentials in documentation, and `COMPLETE_WEBSITE_SYSTEM_AUDIT.md:572` references nonexistent `PAYSTATION_LIVE=true`.
- **Proposed Change:** Update tests to cover new server-only verification contracts and security invariants (Section F), remove hardcoded credential literals from `PAYSTATION_INTEGRATION.md`, and fix `PAYSTATION_LIVE` → `PAYSTATION_ENV=production` in `COMPLETE_WEBSITE_SYSTEM_AUDIT.md`.
- **Dependencies:** Completion of P0/P1 code changes.
- **Expected Result:** Passing test suite and accurate deployment documentation.
- **Risk Level:** **Low**.

---

## D. Database Migration Plan

> **Rule Compliance:** No migration files will be created or executed until approved. Existing rows in `registrations_2027`, `donations`, `donations_2027`, `payment_transactions`, `financial_ledger`, `ipn_logs`, and `admin_audit_logs` will remain completely untouched.

### Proposed Migration Strategy (`supabase/migrations/<timestamp>_paystation_security_hardening.sql`)

1. **Extend `public.pending_orders` for Donations & Order Type Safety**
   - Add column `order_type TEXT NOT NULL DEFAULT 'registration' CHECK (order_type IN ('registration', 'donation'))` and `promoted_donation_id TEXT` (non-destructive `ADD COLUMN IF NOT EXISTS`).
   - **Lock down `pending_orders` RLS:**
     - Drop permissive `pending_orders_anon_select` (`USING (true)`) and `pending_orders_anon_insert` / `GRANT ALL ON public.pending_orders TO anon`.
     - Grant `ALL` only to `service_role`. (Edge Function `verify-payment` creates and reads `pending_orders` using `SUPABASE_SERVICE_ROLE_KEY`, preventing anonymous scanning of customer phones, drafts, and invoice numbers.)

2. **Harden `public.donations` and `public.donations_2027` RLS**
   - Drop permissive `anon` write policies introduced in `20270129000000_donation_complete_hardening.sql`:
     - Drop `"Public insert donations"`, `"Public update donations"`, `"Public delete donations"` on `public.donations` and `public.donations_2027`.
     - Revoke `INSERT, UPDATE, DELETE` from `anon` on `public.donations` and `public.donations_2027`; restrict `SELECT` for `anon` to `payment_status = 'paid'` (while preserving authenticated `super_admin` / `finance_manager` management policies if used in Admin Dashboard).

3. **Revoke `PUBLIC` / `anon` Execution on Payment-Finalization RPCs**
   - `REVOKE ALL ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;` → `GRANT EXECUTE ... TO service_role;`
   - `REVOKE ALL ON FUNCTION public.rpc_handle_paystation_ipn(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;` → `GRANT EXECUTE ... TO service_role;`
   - `REVOKE ALL ON FUNCTION public.rpc_promote_pending_order_to_registration(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;` → `GRANT EXECUTE ... TO service_role;`
   - `REVOKE ALL ON FUNCTION public.rpc_record_donation(text, text, text, text, numeric, text, text, text, text, text, int) FROM PUBLIC, anon, authenticated;` → `GRANT EXECUTE ... TO service_role;` (or `service_role` + authenticated `super_admin` check if admins ever invoke it).
   - `REVOKE ALL ON FUNCTION public.rpc_reconcile_pending_orders(INT) FROM PUBLIC, anon;` → `GRANT EXECUTE ... TO service_role;`

4. **Repair `rpc_handle_paystation_ipn` & `rpc_promote_pending_order_to_registration` & Add `rpc_promote_pending_order_to_donation`**
   - Restore the 5-point verification & accounting safeguards dropped in `20270116`:
     - Anti-replay `trx_id` uniqueness check across `registrations_2027` and `donations`.
     - Lookup in `pending_orders` first (if `order_type = 'donation'`, promote via `rpc_promote_pending_order_to_donation`; if `order_type = 'registration'`, promote via `rpc_promote_pending_order_to_registration`), otherwise lookup `registrations_2027` by `gateway_invoice_number` or `id`.
     - **Authoritative amount validation:** Require `p_amount >= (v_expected_amount - 5)` where `v_expected_amount = COALESCE(v_order.amount, registration_fee + parent_fee + donation_amount + gateway_charge)`. Reject underpayments with HTTP `422` logged to `ipn_logs`.
     - Write immutable `ipn_logs`, `payment_transactions`, `financial_ledger` (`gross_amount`, `gateway_fee`, `net_amount`), and `admin_audit_logs` (`ON CONFLICT DO NOTHING` / idempotent guard so re-delivered IPNs never double-credit `financial_ledger`).
     - Ensure `rpc_verify_payment` also updates matching `public.pending_orders` (`status = 'paid'`, `promoted_registration_id = p_reg_id`, `transaction_id = p_trx_id`, `reconciled_at = NOW()`).
   - Add `public.rpc_promote_pending_order_to_donation(p_invoice_number, p_trx_id, p_amount, p_method, p_verified_by, p_signature)` (`SECURITY DEFINER`, `service_role` only) to atomically insert/confirm `public.donations` (and `donations_2027`), write `financial_ledger` (`DONATION_INFLOW` or `REGISTRATION_INFLOW` matching existing ledger constraint), mark `pending_orders.status = 'paid'`, and generate unique 6-character `token`/`qr_token`.

5. **Preserve Existing Data & Portal Flows**
   - Do **not** alter or delete existing rows in `registrations_2027`, `donations`, `payment_transactions`, `financial_ledger`, or `admin_audit_logs`.
   - Do **not** alter `rpc_approve_manual_registration` (`20270309`) or Finance Manager/Staff RBAC (`20270305`).

---

## E. Secure Payment Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / Donor Browser
    participant FE as Frontend SPA (No Secrets)
    participant Edge as Supabase Edge Function (verify-payment)
    participant DB as Supabase PostgreSQL (service_role RPCs)
    participant PS as PayStation Gateway (api.paystation.com.bd)

    User->>FE: Fill Registration / Donation & choose payment channel
    FE->>Edge: POST action="create-payment" (formData / donationData + method)
    Note over Edge,DB: Edge reads system_settings (open/closed & fees)
    Edge->>Edge: Recompute subtotal + parentFee + gatewayCharge server-side
    Edge->>DB: Upsert public.pending_orders (status="pending", amount, order_type)
    Edge->>PS: POST /initiate-payment (PAYSTATION_MERCHANT_ID + PAYSTATION_PASSWORD)
    PS-->>Edge: Return payment_url + invoice_number
    Edge-->>FE: Return paymentUrl + invoiceNumber (credentials never leave server)
    FE->>PS: Browser redirects user to PayStation hosted checkout

    par Asynchronous Webhook (Track B)
        PS->>Edge: POST IPN (invoice_number, trx_id, trx_amount, trx_status)
        Edge->>PS: Server-to-Server POST /transaction-status (verify trx_id, status, amount, currency)
        PS-->>Edge: Authoritative status="Success", payment_amount, trx_id
        Edge->>Edge: Validate amount >= pending_orders.amount & generate HMAC-SHA256 sig
        Edge->>DB: service_role RPC (promote pending_orders -> registrations_2027 / donations + ledger + ipn_logs)
    and Browser Return Callback (Track A)
        PS-->>FE: Redirect ?payment_return=1&invoice=...
        FE->>Edge: POST action="verify-payment" (invoice_number only; ignore URL amount/status)
        Edge->>PS: Server-to-Server POST /transaction-status (invoice_number)
        PS-->>Edge: Authoritative status="Success", payment_amount, trx_id
        Edge->>Edge: Validate amount >= pending_orders.amount & generate HMAC-SHA256 sig
        Edge->>DB: service_role RPC (idempotent promote/confirm -> activate 6-char QR token)
        DB-->>Edge: Confirmed registration / donation record
        Edge-->>FE: Return verified ticket / receipt + server signature
    end
```

---

## F. Testing Plan

All tests must be executed against **local/sandbox mock & staging** environments before production deployment:

| # | Test Scenario | Expected Verification Outcome |
| :--- | :--- | :--- |
| **1** | **Payment Initiation (Registration & Donation)** | Browser calls Edge `verify-payment` (`create-payment`); server computes fee from `portal_fee_settings`, writes `pending_orders`, calls PayStation `/initiate-payment`, returns `paymentUrl`; browser bundle & network payloads contain zero `password` or `PAYMENT_SIGNING_SECRET`. |
| **2** | **Successful Payment (Redirect + Edge Verify)** | Redirect back with `?payment_return=1&invoice=...` queries Edge `verify-payment`; Edge queries PayStation `/transaction-status`, verifies `trx_status` + `amount`, generates `SIG_HMAC256_*`, promotes `pending_orders` → `registrations_2027` (`payment_status='paid'`), activates 6-char `qr_token`. |
| **3** | **Failed / Cancelled / Processing Payment** | PayStation returning `Failed`, `Cancelled`, or `Processing` (or missing `trx_id`) returns HTTP `402` / `verified: false`; `registrations_2027` receives no `paid` row; form data remains preserved for retry. |
| **4** | **Incorrect / Underpaid Amount** | Gateway status or IPN returning `payment_amount < expected_amount - 5` is rejected (`422` / `AMOUNT_MISMATCH`), logged in `ipn_logs`, and never marks registration or donation as `paid`. |
| **5** | **Invalid / Tampered Transaction ID** | Submitting fabricated or empty `trx_id` fails PayStation `/transaction-status` check; reusing an existing `trx_id` on a different registration/donation is blocked (`DUPLICATE_TRANSACTION`). |
| **6** | **Forged IPN Attack** | Sending a forged POST directly to `/api/paystation/ipn` or Edge `verify-payment` (`action='ipn'`) triggers server-to-server PayStation `/transaction-status` lookup, detects non-existent/unpaid transaction, rejects promotion, and leaves DB untouched. |
| **7** | **Duplicate IPN Delivery (Idempotency)** | Replaying the exact same valid IPN 2–3 times returns HTTP `200 { "status": "success" }` without creating duplicate `registrations_2027`, `donations`, `payment_transactions`, or `financial_ledger` rows. |
| **8** | **Unauthorized `anon` RPC Execution** | Direct `supabase.rpc('rpc_verify_payment', ...)`, `rpc_handle_paystation_ipn`, `rpc_promote_pending_order_to_registration`, `rpc_record_donation`, and direct `anon` `UPDATE`/`INSERT` on `donations` or `paid` registrations fail with PostgreSQL permission denied (`42501`). |
| **9** | **Missing Production Credentials (Fail-Closed)** | Setting `PAYSTATION_ENV=production` while omitting `PAYSTATION_MERCHANT_ID`, `PAYSTATION_PASSWORD`, or `PAYMENT_SIGNING_SECRET` causes HTTP `500` configuration error on Edge/server and never falls back to sandbox URLs or `isVerified = true`. |
| **10** | **Sandbox vs. Production Isolation** | Production build (`vite build` with `VITE_PAYSTATION_ENV=production`, `VITE_ENABLE_TEST_BYPASS=false`) contains no `VITE_PAYSTATION_PASSWORD`, no signing secret literal, and disables `handleInstantSandboxPayment` / Donation test bypass UI. |
| **11** | **Registration & Donation End-to-End Parity** | Registration with parent pass + donation + gateway surcharge accurately separates `registrationFee`, `parentFee`, `gatewayCharge`, and `donationAmount` (no surcharge inflation); closed-tab donation is recovered via IPN from `pending_orders`. |
| **12** | **Ledger & Audit Trail Integrity** | Every verified payment creates one `payment_transactions` row, one immutable `financial_ledger` inflow (`gross_amount`, `gateway_fee`, `net_amount`), one `admin_audit_logs` entry, and an `ipn_logs` entry (for IPNs), while leaving `financial_ledger` update/delete triggers enforced. |

---

## G. Credential Rotation Plan

Because `.env` contained `VITE_PAYSTATION_PASSWORD`, `dist/assets/*.js` bundled the password fallback literal and client `SERVER_PAYMENT_SECRET` fallback string, and source files contained hardcoded defaults, **treat all previously hardcoded/client-exposed secrets as compromised**:

1. **PayStation Merchant API Password (`PAYSTATION_PASSWORD`) & Merchant ID (`PAYSTATION_MERCHANT_ID`):**
   - If the values previously in `.env` or source files were ever live/production credentials (or shared outside PayStation's public sandbox), request an immediate password rotation via the **PayStation Merchant Dashboard / Support**.
   - Store the new live `PAYSTATION_MERCHANT_ID` and `PAYSTATION_PASSWORD` **only** in:
     - Supabase Edge Function Secrets (`supabase secrets set PAYSTATION_MERCHANT_ID=... PAYSTATION_PASSWORD=... PAYSTATION_ENV=production`)
     - Vercel Server Environment Variables (if any `api/paystation/*.ts` route remains active — unprefixed, never `VITE_*`).
   - Do **not** store `PAYSTATION_PASSWORD` in `.env`, `.env.local`, `VITE_*`, or any Markdown/code file.
2. **Payment Signing Secret (`PAYMENT_SIGNING_SECRET`):**
   - Generate a fresh cryptographically random secret (`openssl rand -hex 32` — minimum 64 hex chars / 256-bit entropy).
   - Set **only** in Supabase Edge Function Secrets (`supabase secrets set PAYMENT_SIGNING_SECRET=...`).
   - Note: Existing historical registrations keep their stored `server_verification_signature` values in `registrations_2027`; new signatures use `SIG_HMAC256_*` signed with the rotated secret.
3. **Supabase Keys (`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY`):**
   - Audit confirmed `SUPABASE_SERVICE_ROLE_KEY` is NOT in `src/` or `dist/assets/*.js` (only `VITE_SUPABASE_ANON_KEY` publishable key is in client). Keep `SUPABASE_SERVICE_ROLE_KEY` exclusively in Supabase Edge Secrets / Vercel Server Env (never `VITE_*`). If `SUPABASE_SECRET_KEY` was ever shared insecurely, rotate it in **Supabase Dashboard → Project Settings → API** and update Vercel + Edge Secrets simultaneously.
4. **Build Cache Verification:**
   - Run `npm run clean && npm run build` after rotation and verify via static grep that `dist/` contains zero PayStation passwords, signing salts, or service-role keys.

---

## H. Rollback and Deployment Plan

### 1. Pre-Deployment Sequencing
1. **Local Development Testing:** Implement fixes on a feature branch; verify `npm run lint`, `npm test` (including new Section F tests), and `npm run clean && npm run build` (confirm zero secret literals in `dist/`).
2. **Sandbox End-to-End Testing:** Deploy migration + updated Edge Function `verify-payment` to a staging Supabase branch/project (or test against PayStation `sandbox` with `PAYSTATION_ENV=sandbox`), testing real redirect checkout with PayStation sandbox test wallets, simulated IPN `POST`, underpayment rejection, and forged `anon` RPC rejection (`42501`).

### 2. Production Deployment Order (Zero-Downtime Safe Order)
> **Important:** Deploy the server/Edge changes **before** revoking `anon` RPC permissions if live traffic is active—or put `registrationOpen = false` and `donationOpen = false` temporarily via Super Admin settings during the maintenance window!

1. **Step 1 — Pause Online Payments Briefly:** Set `registrationOpen = false` and `donationOpen = false` in Admin Settings (`system_settings`) so no customer enters checkout mid-cutover.
2. **Step 2 — Configure Supabase Secrets & Deploy Edge Function:**
   - Set `PAYSTATION_ENV=production`, `PAYSTATION_MERCHANT_ID`, `PAYSTATION_PASSWORD`, `PAYMENT_SIGNING_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ALLOWED_ORIGINS`.
   - Deploy `supabase functions deploy verify-payment`.
   - Test `health-check` and confirm fail-closed behavior if a test call omits verification.
3. **Step 3 — Apply Hardening Database Migration:**
   - Push the migration (`supabase db push`) revoking `anon` execute permissions on payment finalization RPCs, hardening `pending_orders` & `donations` RLS, and updating `rpc_handle_paystation_ipn` / `rpc_promote_pending_order_to_donation`.
   - Verify existing `registrations_2027`, `donations`, `financial_ledger`, and `admin_audit_logs` counts are unchanged and manual registration approval + Finance Portal tabs work normally.
4. **Step 4 — Deploy Frontend + `vercel.json` to Vercel:**
   - Ensure Vercel Environment Variables have `VITE_PAYSTATION_ENV=production` and `VITE_ENABLE_TEST_BYPASS=false`, with **zero** `VITE_PAYSTATION_PASSWORD`.
   - Deploy the build to Vercel (`git push` / `vercel --prod`).
5. **Step 5 — Configure PayStation Merchant Portal IPN URL:**
   - Point PayStation's IPN webhook to your authoritative Edge Function endpoint (`https://hnthoszbkhvygoowtvau.supabase.co/functions/v1/verify-payment`) or verified Vercel `/api/paystation/ipn`.
6. **Step 6 — Post-Deployment Production Verification:**
   - Run an authenticated Admin diagnostic check; verify `anon` calls to `rpc_verify_payment` return `permission denied`.
   - Re-enable `registrationOpen` / `donationOpen` and run one controlled low-value (or verified) live test registration & donation, confirming: PayStation redirect → callback verify → `ipn_logs` entry → `payment_transactions` row → `financial_ledger` entry → QR code scan works in Gate/Food/Dress scanners.

### 3. Rollback Strategy
- **Frontend / `vercel.json` Rollback:** Instantly promote the previous Vercel deployment from the Vercel Dashboard if UI or routing regression occurs (note: keep `registrationOpen=false` if rolling back before DB compatibility is restored).
- **Edge Function Rollback:** Re-deploy the previous tagged `verify-payment/index.ts` version via `supabase functions deploy verify-payment` (while keeping fail-closed credentials and never re-introducing `VITE_PAYSTATION_PASSWORD`).
- **Database Migration Rollback:** Because the migration does **not** drop tables or delete data, rollback is non-destructive: keep a down-script ready to restore prior function definitions (`rpc_handle_paystation_ipn`, `rpc_verify_payment`) only if a regression breaks legitimate server-side `service_role` calls—**do not** re-grant `anon` `EXECUTE` on payment-finalization RPCs in production; instead keep checkout paused until patched cleanly.
