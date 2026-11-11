# External services audit

## Service matrix

| Service | Purpose / code path | Configuration names | Status and verification |
|---|---|---|---|
| Supabase project/API | Postgres/PostgREST, Auth, Edge Functions, intended Storage. Browser JS client in `src/services/supabase.ts`; Edge clients in function files. | Browser: `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Edge: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ALLOWED_ORIGINS`, `AUDIT_SIGNING_SECRET`, `RATE_LIMIT_HMAC_SECRET`. | Configured in source/environment naming. No live connectivity or live schema was tested. |
| Supabase Auth | Admin/staff password login and bearer-token validation by `admin-audit`. | Uses Supabase project config; no separate OAuth provider demonstrated. | Implemented in source, not live-verified. Client session persistence is disabled. |
| Supabase Edge Functions | Ticket lookup, audit insert, disabled payment verifier. | Supabase server env vars above. | Source exists; deployment and function settings unknown. |
| Supabase Storage | Migrations create private photo/receipt buckets and policies. | Supabase-managed Storage. | Schema intended only; UI code does not call `storage.from(...).upload()`. Live buckets/policies unverified. |
| PayStation Bangladesh | No integration found. | No PayStation variable/config in repo. | Not implemented. No credentials were used. |
| Email provider | No SMTP/email SDK or server function. | No mail configuration found. | Not implemented; ticket resend UI is simulated. |
| Gemini / Google AI | `@google/genai` dependency and `GEMINI_API_KEY` template/README mention. | `GEMINI_API_KEY` in `.env.example`/README. | No app import or API call found; unused/unverified. |
| Unsplash | Remote illustrative/page images. | URLs embedded in page/components and fallback display data. | Static image links in source; remote availability not tested. |
| Deno standard library / `esm.sh` | Edge Function runtime imports. | Remote module URLs embedded in function source. | Source dependencies; deployed runtime resolution not tested. |
| Hosting / domain | Vite app, README mentions AI Studio; no hosting manifest. | `APP_URL` template name, not used in app source. | Unknown. Domain/DNS/TLS/provider not verifiable from repository. |
| Analytics | Admin dashboard computes domain analytics from application records. | None found for third-party analytics. | No external analytics integration found. |

## Environment name handling

This report lists variable names only. Environment values, including local `.env`, were not read into documentation. The `.env.example` includes names for Gemini and app URL as well as browser Supabase settings. The Edge Functions additionally reference server-only keys/secrets; they are not browser variables and must remain in a server secret store.

## Integration gaps

- The Supabase client has fallback configuration embedded in browser source; public key configuration is not proof of connectivity and RLS remains critical.
- Contact and student ID code refer to database tables absent from supplied migrations.
- Private Storage buckets are not used by current upload paths; images/receipts are converted to data URLs.
- No PayStation, email, OAuth provider configuration, Google Drive, or external ticket service integration was found.
- No provider/host status was checked remotely.

