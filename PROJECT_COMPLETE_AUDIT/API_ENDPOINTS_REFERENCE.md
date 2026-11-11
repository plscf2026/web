# API endpoints reference

## Scope

The project has no application-owned REST server. It has three Supabase Edge Function endpoints, plus Supabase REST/Auth/Storage access through the official JS client. Function URLs are Supabase project function routes, but the project ID is intentionally not repeated here. No endpoint was contacted during this audit.

## Supabase Edge Functions

### `secure-ticket-lookup`

- **Method/path:** `POST /functions/v1/secure-ticket-lookup`; `OPTIONS` is supported.
- **File:** `supabase/functions/secure-ticket-lookup/index.ts`
- **Request JSON:** `registrationId: string`, `mobileNumber: string`, optional `year: integer` (default 2026; allowed 2026–2100); maximum raw request size 4 KB.
- **Response:** On success `{success:true,ticket:{...}}`; failure `{success:false,error:string}` or `{error:string}`. Ticket is only returned if row exists, normalized phone matches, status is `paid`, and QR token is present.
- **Auth:** No user login is required. CORS allowlist is not authorization. Rate limit is 20 attempts per derived IP and 5 per IP+registration ID in a 60-second window.
- **Database/services:** Service-role client reads `registrations_<year>` and calls `consume_ticket_lookup_rate_limit` twice. Requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_HMAC_SECRET`; CORS uses `APP_ALLOWED_ORIGINS`.
- **Status/errors:** 204 preflight; 400 malformed/invalid body; 403 origin; 404 unmatched/unpaid; 405 method; 413 oversized; 429 rate limited; 503 missing configuration/query/RPC issue.
- **Concern:** Response includes more fields than a minimal ticket (phone, photo, batch/class, payment transaction/method, QR token). Proxy/IP header trust depends on deployment.

### `admin-audit`

- **Method/path:** `POST /functions/v1/admin-audit`; `OPTIONS` supported.
- **File:** `supabase/functions/admin-audit/index.ts`
- **Request JSON:** `{action:string,targetType:string,targetId:string,details:string}`. Action/type regexes; ID max 200 chars; details max 2,000 chars.
- **Response:** `{success:true,id,checksum,timestamp,actor:{id,username,role}}`.
- **Auth:** Requires `Authorization: Bearer <Supabase access token>`, validated by Supabase Auth, plus linked `admin_accounts` row with `super_admin`.
- **Database/services:** Reads `admin_accounts`; inserts `admin_audit_logs` with service-role key and signs canonical event payload using `AUDIT_SIGNING_SECRET` (minimum 32 chars). Also requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; CORS uses `APP_ALLOWED_ORIGINS`.
- **Status/errors:** 204 preflight; 400 invalid body/event; 401 missing/invalid auth; 403 origin/role; 405 method; 503 missing config; 500 DB/processing error.
- **Note:** Malformed JSON reaches catch and returns 500. No explicit body-size limit is visible.

### `verify-payment`

- **Method/path:** `POST /functions/v1/verify-payment`; `OPTIONS` supported.
- **File:** `supabase/functions/verify-payment/index.ts`
- **Request/response:** Request body ignored; every valid POST returns HTTP 503 and JSON error: `Payment verification is unavailable until a payment provider is configured.`
- **Auth/database/provider:** None implemented; no table access, payment service, merchant configuration, callback or webhook.
- **Other status:** 204 preflight, 403 disallowed origin, 405 unsupported method.

## Browser-side Supabase calls (not custom API routes)

`src/services/supabase.ts` uses Supabase JS for PostgREST operations:

- Registration upsert/fetch: `registrations_<year>` with fallback to `registrations`.
- Donation upsert/fetch: `donations_<year>` with fallback to `donations`.
- Admin profile read and Supabase Auth sign-in/sign-out.
- Function invocations: `secure-ticket-lookup`, `admin-audit`.
- Contact component inserts to `inquiries`.
- `EventStore` and `StudentIdService` call table APIs directly for operations and student IDs.

Browser request schemas are determined by these code helpers, not documented OpenAPI. Direct table calls are subject to database privileges/RLS.

## Endpoint gaps and consistency

- No client calls the payment verification function and no initiation endpoint exists.
- Contact and student ID table names are missing from supplied migrations.
- Registration/donation generic fallback tables are not defined by the checked-in migrations.
- No webhook/IPN/callback endpoints, email API, or upload endpoint exist.
- The RLS history has conditional policy differences; database results cannot be inferred solely from HTTP response behavior.

