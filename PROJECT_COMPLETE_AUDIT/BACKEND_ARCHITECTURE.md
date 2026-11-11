# Backend architecture

## Overview

There is no project-owned Node/Express server. Browser components use Supabase JS directly for database/Auth access, plus three Supabase Edge Functions. Functions are Deno TypeScript files importing dependencies from `deno.land` and `esm.sh`. Whether those functions, settings, or secrets are deployed is unknown.

## Edge Function contracts

| Function and path | Input / output | Data/services and authorization | Errors |
|---|---|---|---|
| `admin-audit` — `supabase/functions/admin-audit/index.ts` | `POST` JSON `{action,targetType,targetId,details}`; JSON success `{success,id,checksum,timestamp,actor}`. `OPTIONS` preflight. | Requires bearer Supabase Auth access token, then linked `admin_accounts` profile with `role = super_admin`. Reads `admin_accounts`; inserts `admin_audit_logs` with service-role client. HMAC-SHA256 uses server secret. | 403 origin, 405 method, 401 missing/invalid token, 403 role, 503 missing secrets, 400 input, 500 lookup/insert/parse failure. CORS allowlist uses `APP_ALLOWED_ORIGINS`. |
| `secure-ticket-lookup` — `supabase/functions/secure-ticket-lookup/index.ts` | `POST` `{registrationId,mobileNumber,year?}`; response success includes `ticket`, failures include generic error. `OPTIONS` preflight. | No user login required. Validates registration ID, normalized Bangladesh mobile and year (2026–2100); max body 4 KB. HMAC-hashes IP and IP+registration ID; rate limits 20/IP and 5/subject per 60 seconds. Calls `consume_ticket_lookup_rate_limit`, then service-role selects `registrations_<year>`. Returns only payment-verified record. | 403 origin, 405 method, 503 missing config/query/rate limit, 413 body size, 400 invalid JSON/input, 429 limited, 404 mismatch/unpaid/no QR. |
| `verify-payment` — `supabase/functions/verify-payment/index.ts` | `POST` has no accepted body contract and always returns `{success:false,error:"Payment verification is unavailable until a payment provider is configured."}` with HTTP 503; `OPTIONS` 204. | No Supabase call, provider call, database table, or auth requirement implemented. CORS only. | 403 disallowed origin, 405 non-POST, 503 for all POST. |

Function-gateway JWT settings cannot be confirmed: no `supabase/config.toml` is present.

## Browser service layer

- `SupabaseService` in `src/services/supabase.ts`: browser client setup; registration/donation upsert/fetch; `secure-ticket-lookup` and `admin-audit` invocation; Supabase Auth admin methods; local audit cache; export/check functions; runtime SQL schema string.
- `AppStore` in `src/services/store.ts`: local persistence and background sync for registrations/donations; some sync failures are logged, and some writes are swallowed.
- `EventStore` in `src/services/eventStore.ts`: staff Auth/profile management and event/finance operations. Most mutations write localStorage first and invoke Supabase asynchronously with rejection handlers that discard errors.
- `StudentIdService` in `src/services/studentIdStore.ts`: local student-ID verification/reservation and unobserved background writes to `current_student_ids`.

Client code is not a trusted security boundary. Server-side RLS/function authorization must enforce all privileged operations.

## Authentication and authorization

- Admin: Supabase `signInWithPassword`, then lookup in `admin_accounts` by `auth_user_id`. Public admin creation returns an explicit disabled error; provisioning is intended to be performed through Supabase Auth and profile linkage.
- Staff: Supabase Auth sign-in, then lookup in `staff_accounts`; account must be active. Client checks roles to choose modules.
- Edge audit: independently validates the bearer token and `super_admin` profile.
- Ticket lookup: public endpoint protected by ID/mobile matching and database-backed rate limiting, not a login.
- Payment: no authentication or verification flow because the endpoint is a stub.

The compiled browser key is publishable/anon by design; privileges rely on RLS. Auth session persistence is disabled in the shared browser client configuration.

## Data flow and gaps

Registration/donation persistence helpers exist, but the live UI does not call them from checkout/donation. Event data has local-first writes; error handling may show success while remote operations failed. `current_student_ids` and `inquiries` are referenced by application code but absent from the four supplied migrations. The former creates registration/staff workflows dependencies; the latter affects contact inquiry persistence.

No mail provider, payment provider, webhook, callback, or object-storage upload service exists in first-party code. QR generation occurs in the browser, not in a server endpoint.

## Logs and errors

Functions return mostly generic client errors and log selected internal Supabase errors to `console.error`; logs from a deployed instance were not inspected. `verify-payment` returns an exact static 503 response. Frontend local-first stores often suppress remote write failures; this prevents reliable operational error reporting.

