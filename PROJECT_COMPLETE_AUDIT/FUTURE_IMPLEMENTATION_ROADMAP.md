# Future implementation roadmap

This is a proposal only. No application, database, payment, authentication, or deployment changes were made as part of the audit.

## 1. Establish a safe baseline first

1. Use authorized, read-only Supabase access to record project identity, applied migration versions, actual schema, RLS policies, storage policies, deployed functions, and secret *presence* (never secret values).
2. Obtain a fresh database backup and verify a restore path before any migration.
3. Confirm which environment is Sandbox/staging/production and identify the current deployed frontend artifact. Do not infer this from local `dist/`.
4. Review the high-severity conditional RLS/storage findings before any operational data is collected.

**Likely files:** migration directory, `src/services/supabase.ts`, `supabase/functions/*`; deployment files/configuration may need to be added later.  
**Test:** compare live metadata with an approved schema inventory; no writes.

## 2. Reconcile schema and permissions

1. Resolve missing `current_student_ids` and `inquiries` table contracts and decide whether generic registration/donation tables are supported or should be removed.
2. Generate authoritative database TypeScript types from the confirmed schema.
3. Align app interfaces, embedded SQL generator and migrations; avoid maintaining multiple independently edited schema sources.
4. Replace broad storage policies with private bucket/path rules; scope every table policy to explicit Auth roles.
5. Add real FK constraints for registration/staff references after auditing and cleaning existing data; add indexes based on query evidence.
6. Preserve append-only/audit/finance invariants using database transactions/constraints rather than browser-only rules.
7. Verify donation insert policy and payment-related columns/constraints before re-enabling donation UI.

**Likely files:** new reviewed `supabase/migrations/*.sql`; `src/types/index.ts`; `src/services/supabase.ts`; `src/services/eventStore.ts`; `src/services/studentIdStore.ts`.  
**Safe tests:** apply migrations only to a disposable staging project; test RLS as anon, each role, and service role; test rollback/restore. Do not alter production until review/approval.

## 3. Make operational writes authoritative and observable

1. Replace localStorage as the authoritative source for registrations, student IDs, scanner events and finance.
2. Use server-side transactions for coupled events (expense + ledger + audit, allocation + ledger, reservation + registration).
3. Await writes and surface errors/retry state; never show success when persistence failed.
4. Make student-ID reservation atomic with a unique/locking mechanism and expiry enforced server-side.
5. Add idempotency keys and concurrency handling where clients can retry.
6. Define cache policy and minimize sensitive data in browser storage.

**Likely files:** `src/services/store.ts`, `eventStore.ts`, `studentIdStore.ts`, `src/components/ScannerPortal.tsx`, scanner modules, budget tabs; new Edge Function/RPC code and migrations as needed.  
**Safe tests:** unit tests, staging multi-client concurrency tests, simulated network failures, and explicit role-matrix checks.

## 4. Safely integrate PayStation Bangladesh (Sandbox first)

Do not implement from guesses or from a base URL/credential alone. Obtain PayStation’s current merchant-specific Sandbox guide and secure, rotated test credentials. Confirm API version, exact request/response fields, signing rules, test payment methods, callback validation, currency, expiry, and allowlisted origins with PayStation.

1. Add server-only Sandbox configuration/secrets and explicit environment selection; fail closed if mode is not Sandbox in the test deployment. Never put merchant password/secret in `VITE_*` or browser code.
2. Create and persist a pending registration/order server-side before initiation. Validate category/fee/donation on the server; do not accept client-calculated amount as authority.
3. Generate an unguessable, unique invoice/order number; bind it to registration ID, exact BDT amount, and `BDT` currency.
4. Implement a backend `payment-initiate` function that sends only PayStation-documented fields and returns a safe redirect/checkout URL.
5. Implement a signed callback/webhook or server-to-server verification path. Validate signature, merchant identity, invoice, amount/currency, transaction ID, terminal state and replay/idempotency before marking paid.
6. Treat browser redirect as a notification only; query provider server-to-server or validate provider signature before updating payment.
7. On verified success, transactionally update payment status, audit, consume student ID, then make the ticket available. On cancel/failure/timeout, retain unpaid status and allow safe retry/release.
8. Add redacted structured logs with correlation/request IDs and exact sanitized provider error messages; never log secrets, OTPs, PANs or full personal data.

**Likely files:** `src/components/PaymentModal.tsx`, `src/App.tsx`, `src/components/RegistrationPage.tsx`, `src/services/supabase.ts`, `supabase/functions/verify-payment/index.ts` (or dedicated initiate/notify functions), new migration(s) for order/invoice/idempotency fields, test suite and deployment secret configuration.

**Sandbox verification only:** use PayStation-issued test credentials and documented test instruments; check provider dashboard/logs; confirm unpaid/cancel/duplicate/amount-mismatch/bad-signature/replay cases do not create paid tickets. No real money or production endpoint. Keep a feature flag/kill switch and disable checkout on any verification/config error.

## 5. Finish uploads, ticket, scanner and email

- Upload images/receipts into private Storage with per-record ownership policies and signed URLs; avoid data URLs in database fields. Files: `RegistrationPage.tsx`, `StaffFinanceModule.tsx`, `fileValidation.ts`, upload service, Storage policies.
- Add a real QR decoder or use a manual-only UI without implying scanning; resolve opaque token server-side and enforce paid status/role. Files: scanner modules, ticket view, lookup function.
- Replace simulated email with a server-side provider after consent/privacy and secret handling review. Files: `TicketView.tsx`, new Edge Function, server config.
- Make contact submissions report actual persistence results and provision a reviewed `inquiries` schema/RLS if retained.

## 6. Build security/integration validation

1. Add API contract tests for the three Edge Functions and the payment Sandbox stubs.
2. Add DB migration/RLS tests to CI; tests should exercise policies under `anon`, `authenticated`, roles and service role.
3. Correct the existing empty-email test to match intended optional-email behavior or change the requirement deliberately.
4. Rename the client checklist so it does not claim live penetration testing; use a real authorized security assessment.
5. Add CI for lint, unit tests, Edge Function type-check, build, dependency audit and policy checks.
6. Run staging browser end-to-end flows and a verified deployment checklist before production.

## 7. Rollback and break-glass

- Keep changes in separate reviewed commits and versioned migrations; do not use destructive reset commands.
- Before schema deployment, backup and capture migration/policy state. Prepare a forward-fix or tested rollback migration for each additive change.
- Feature-flag payment initiation and uploads; default closed. Roll back frontend release independently from schema changes.
- Never roll back by deleting payment/order/audit records; reconcile with provider transaction history.
- Maintain a documented incident path to disable Sandbox checkout, rotate exposed credentials, restore from backup, and contact PayStation.

