# Security audit

## Scope and confidence

Read-only source/migration review. No live database, function logs, HTTP security headers, deployed bundle, remote app, or credentials were tested. Findings about migration policies are conditional on those migrations having been applied. Severity reflects potential impact in the source-defined design, not confirmed exploitation.

## Findings

| ID | Severity | Evidence and impact | Recommended action |
|---|---|---|---|
| S1 | **HIGH (latent)** | `src/utils/security.ts:8-11,133-169` contains a hardcoded payment-signing fallback and a custom 32-bit arithmetic hash described as a server signature. It is not invoked in the current payment flow, but if used to attest tickets/payments, the secret is recoverable from source/bundle and the hash is not a cryptographic MAC. | Remove client-side signing secret and helper as an authority. Generate/verify any signature only on a server with a real cryptographic MAC; rotate the exposed value if it has ever been trusted. |
| S2 | **HIGH (conditional)** | Initial Storage migration grants every authenticated user `FOR ALL` on `storage.objects` with `USING (true)` and `WITH CHECK (true)` (`supabase/migrations/20260101000000_critical_security_hardened_schema.sql:170-174`). The later hardening file does not replace these policies. If applied, authenticated users may manage objects outside intended ownership. | Replace with bucket-specific, role/ownership-aware policies in a separately reviewed migration. Verify exact deployed storage policies before use. |
| S3 | **HIGH (conditional)** | Baseline migration includes permissive registration/donation/admin policies. In particular, initial anonymous registration policy permits `payment_status` to be either pending or paid (`supabase/migrations/20260101000000_critical_security_hardened_schema.sql:221-227`). Nov. hardening narrows registration inserts if applied. Do not treat source history as live state. | Verify deployed migration/policy state read-only. Keep paid-state changes server-only and maintain tests for exact grants/RLS. |
| S4 | **HIGH (conditional)** | Admin UI’s generated SQL drops policy names that do not consistently match original policy names; RLS policies are permissive-combined, so legacy broad policies may survive when that script is run over baseline (`src/services/supabase.ts:944-998`; baseline policies around 187-264). | Stop using generated SQL as a substitute for reviewed versioned migrations. Reconcile policy names and write idempotent tests/queries for effective RLS. |
| S5 | **MEDIUM** | Ticket lookup response spreads a database row and includes mobile, photo, batch/class, payment transaction/method and QR token (`supabase/functions/secure-ticket-lookup/index.ts:126-174`). A valid ID+phone lookup exposes more personal/payment data than a minimal ticket requires. | Build an explicit minimal response object; consider a narrowly scoped opaque QR credential, privacy review, and response logging without PII. |
| S6 | **MEDIUM (deployment-dependent)** | Rate limit IP derives from forwarded/proxy headers, including `x-forwarded-for` fallback (`supabase/functions/secure-ticket-lookup/index.ts:88-95`). If untrusted input is accepted by the deployment, clients may vary it and evade IP throttling. | Use only platform-provided trusted client IP metadata; confirm edge proxy behavior and add abuse testing. |
| S7 | **MEDIUM** | Student-ID decisions/reservations are localStorage-authoritative and remote updates ignore failures (`src/services/studentIdStore.ts:11-28,80-114`); no supplied migration defines `current_student_ids`. Concurrent clients can race or disagree. | Move verification/reservation to an atomic server/database operation with constraints and observable errors. |
| S8 | **MEDIUM** | `AppStore`/`EventStore` frequently write locally then silently ignore Supabase errors (`src/services/store.ts:135-167`; `src/services/eventStore.ts:518-546,634-659,739-766,798-1171`). Admin/scanner/finance UI can appear successful while remote persistence failed, causing audit and operational divergence. | Await and surface persistence results; use server transactions for linked ledger/audit updates and clearly label local-only state. |
| S9 | **MEDIUM** | Browser localStorage holds registration, event, finance, student-ID and contact data. It is not encrypted at rest and is exposed to same-origin script compromise/device users (`src/services/store.ts`, `src/services/eventStore.ts`, `src/services/studentIdStore.ts`). | Minimize and clear PII locally; prefer server authority and short-lived caches; enforce CSP and protect devices. |
| S10 | **MEDIUM** | Uploaded photos/receipts are client data URLs; no object-storage upload code exists. The registration table stores `photo_url`, while the generated schema creates private buckets. This can inflate rows/local storage and avoids private-object access controls. | Upload to private, per-record paths with server-validated type/size and signed access URLs; keep only object key in DB. |
| S11 | **MEDIUM** | Contact form attempts `inquiries` insert (table absent in supplied migrations) and ignores returned Supabase `{error}`. It sets success even if the request fails (`src/components/AboutContactPage.tsx:55-84`). Contact data may be lost while user sees “sent.” | Define schema/RLS and inspect SDK error response; only report success after confirmed insert, otherwise give explicit retry/error. |
| S12 | **MEDIUM / latent** | Legacy `rpc_verify_payment` updates registration to paid based on arguments without contacting provider or comparing the expected amount (`supabase/migrations/20260101000000_critical_security_hardened_schema.sql:298-348`). Later migration restricts execute to service role; current payment function is disabled. | Keep unexposed. Only call from backend after authoritative provider verification, expected amount/currency/invoice checks and idempotency. |
| S13 | **LOW** | Auth browser client uses `persistSession: false` (`src/services/supabase.ts:38-42`), so admin/staff authentication may not survive refresh. This is mostly availability/UX but can cause inconsistent navigation states. | Choose and document session lifecycle deliberately; preserve secure refresh and server-enforced authorization. |
| S14 | **LOW** | `TicketView` QR JSON includes attendee name/category/batch plus token (`src/components/TicketView.tsx:35-52`); anyone scanning can read these fields. | Prefer an opaque signed ticket reference and resolve necessary details securely. |
| S15 | **LOW** | A frontend “penetration audit” includes local static checks and marks some controls passed without testing live policy/API behavior (`src/services/supabase.ts:649-707`). It can create false assurance. | Rename it as a local checklist or implement authenticated, read-only verified checks with explicit unknown status. |
| S16 | **LOW** | Form and SQL/app types drift (including optional app email vs required database email); API error handling may hide mismatches. | Generate database types and add integration contract tests after schema is confirmed. |
| S17 | **LOW** | `SupabaseService.testConnection()` returns `connected: true` for query errors other than thrown transport failures (`src/services/supabase.ts:709-725`), so the admin status check can report connectivity without a successful query. | Set connected only when a request succeeds or a narrowly understood response proves the service is reachable; show authorization/query errors separately. |
| S18 | **LOW (conditional)** | `AdminDashboard` imports `hasRolePermission` but renders all admin tabs for any linked admin session (`src/components/AdminDashboard.tsx:73,1008-1078`). If a non-super-admin profile is provisioned, the UI does not hide role-inappropriate actions; RLS is the real protection for remote data, but local-only actions may still mutate browser state. | Enforce role checks in UI for clarity and retain server-side RLS/authorization as the actual control. |

## Positive controls observed

- Public admin self-registration is disabled in current helper; admin/staff sign-in uses Supabase Auth and linked profiles.
- Later RLS migration defines role helper functions and narrows operation table policies.
- Public ticket lookup has input shape checks, a request body limit, per-IP/subject throttles and reveals only paid records with QR token.
- The current payment function cannot mark anything paid; it returns 503.
- Browser client uses publishable key config, not an observed service-role key. Secret values were not included in this report.
- Image file client checks restrict MIME, size and dimensions; this is useful UX validation but must be repeated server-side.

## Other checks

- No `dangerouslySetInnerHTML` or dynamic `eval` use was found by source search.
- SQL query values use Supabase query-builder filters in the inspected code; dynamic table names are derived from a year argument and should still be bounded server-side.
- CORS allowlists protect browser response access, not authorization. Function access must rely on auth/RLS/business checks.
- Tests are utility tests, not database RLS/API/security integration tests.

## Required follow-up before production use

Verify live RLS/storage policies, secrets and function settings through authorized read-only access. Rotate credentials that were exposed in chat. Do not enable payments until server-side provider verification and the security items above are addressed.
