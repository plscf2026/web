# Missing features and technical issues

## Priority summary

Priorities reflect readiness and potential user/data impact. Database and deployment conditions remain unverified.

| Priority | Issue | Evidence / impact |
|---|---|---|
| **P0 — launch blocker** | Registration checkout is disabled, does not initiate payment, and does not persist the submitted registration. | `RegistrationPage` hands form data to `App`; `PaymentModal` only displays an unavailable notice. `verify-payment` always returns 503. |
| **P0 — launch blocker** | No PayStation integration, provider verification, callback, or merchant configuration is present. | No PayStation source references, endpoint configuration, or successful payment path found. |
| **P1 — data integrity/security** | Migration state is unknown; baseline payment/RLS policies are more permissive, and the admin SQL generator can leave old policy names in place. | Initial migrations vs Nov hardening and generated SQL policy names diverge. |
| **P1 — data integrity/security** | Storage policy grants authenticated users broad all-object control if baseline migration is applied; client does not use storage. | `20260101000000_critical_security_hardened_schema.sql:162-176`; no replacement in later hardening file. |
| **P1 — security** | A hardcoded fallback payment-signing secret and non-cryptographic 32-bit hash are in frontend utility source. The helper is not wired into current payment flow, but cannot be treated as server-side proof. | `src/utils/security.ts:8-11,133-169`. |
| **P1 — operations** | Event/finance/student data is local-first with best-effort or swallowed remote errors. | Device/browser state can diverge from Supabase without an error visible to the user. |
| **P1 — database readiness** | Application references `current_student_ids` and `inquiries`, absent from checked-in migrations; generic fallback tables also are not defined. | Student-ID/contact/registration helper operations can fail unless objects exist outside repository migrations. |
| **P1 — privacy** | Registration photos and receipt images are data URLs and are stored locally/in row-oriented data, despite private buckets in SQL. | No `storage.from(...).upload()` call; large base64 images inflate browser/database payloads. |
| **P1 — business logic** | Student-ID validation and reservation are local browser operations, not atomic/server authoritative. | Concurrent users/devices may reserve/use the same identifier or see stale records. |
| **P2 — ticketing** | Scanner camera does not decode QR codes; modules rely on manual input and local registration state. | No QR decoder dependency/use found; independent devices can have incomplete/stale attendees. |
| **P2 — privacy** | Public ticket response contains excess PII and payment metadata; QR itself encodes readable attendee details. | `secure-ticket-lookup` returns the selected row spread; `TicketView` embeds name/category/batch. |
| **P2 — communication** | No actual email service; “resend” success is simulated. | No mail provider/config/function. |
| **P2 — donations** | Donation UI is informational only; no online donation/payment path. | `DonationPage` shows disabled notice. Migration hardening removes public insert policy, while existing helper attempts upsert. |
| **P2 — contact** | Contact form reports success even when Supabase insert returns an error; referenced table absent from migrations. | `AboutContactPage.tsx:55-84`. |
| **P2 — auth UX** | Supabase browser auth persistence is disabled. | Admin/staff may need to authenticate again after refresh. |
| **P2 — diagnostics** | Admin connection check can label a failed database query “connected.” | `SupabaseService.testConnection()` returns `connected: true` for query error responses. |
| **P2 — admin UX/security** | Admin tabs are not role-filtered in the UI despite a role-permission helper being imported; remote RLS remains the security boundary. | Relevant if non-super-admin admin profiles are provisioned. |
| **P2 — type/schema drift** | Application types, SQL and generated schema disagree on required/null fields and some columns/policies. | Increases runtime failures and makes schema changes less safe. |
| **P3 — quality** | Existing test set has one failing assertion. | Empty email is expected false by `rules.test.ts`, but `rules.ts` intentionally considers empty optional email valid. |
| **P3 — deployment** | No deployment/hosting manifest, CI, Supabase CLI config or runbook. | Live hosting and migration/function setup cannot be reproduced from repository evidence. |
| **P3 — maintenance** | Some declared dependencies are not imported by the application; README still points to a Gemini key that is unused. | Supply-chain surface and developer setup ambiguity. |
| **P3 — assurance** | Admin “penetration audit” is mostly client-side checks and can mark untested items passed. | It is not a live penetration or database policy audit. |

## Duplicated or potentially obsolete source

- Embedded SQL generator in `src/services/supabase.ts` duplicates migration schema and policy setup with naming/constraint differences. Treat as drift-prone; do not assume generated SQL equals migration state.
- `rpc_secure_ticket_lookup` exists in legacy SQL but current ticket lookup uses the Edge Function’s direct query and rate-limit RPC.
- `rpc_verify_payment` and client transaction/signature helpers are legacy/unwired while payment is disabled.
- `@google/genai`, Express, Motion and `canvas-confetti` appear unused in first-party source.
- `dist/` and AI Studio screenshots are present but their deployment/runtime role is unverified.

## Test evidence

`npm run lint` passed. Existing utility tests produced 26 passes and 1 failure, specifically the empty-email assertion. No build, live API test, database integration test, browser automation, email test, or payment test was performed.
