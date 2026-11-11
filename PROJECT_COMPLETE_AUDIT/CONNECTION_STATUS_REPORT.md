# Connection status report

## Status legend

- **VERIFIED WORKING** — successful live request evidence available.
- **CONFIGURED BUT NOT VERIFIED** — source/config present; no successful live test.
- **PARTIALLY IMPLEMENTED** — code path exists but important parts are missing or best-effort.
- **BROKEN** — observed code contract does not work as designed or points to a source-missing object.
- **NOT CONFIGURED** — no credentials/endpoint/configuration found.
- **NOT IMPLEMENTED** — no code path found.
- **UNKNOWN** — requires live/deployment facts unavailable in this read-only audit.

No connection received **VERIFIED WORKING** status because no live endpoint or database request was made.

## Matrix

| Source | Destination | Method / related files | Status | Evidence / limitation |
|---|---|---|---|---|
| Browser frontend | Supabase API | Supabase JS client; `src/services/supabase.ts` | CONFIGURED BUT NOT VERIFIED | Source config and `.env` variable names exist; no live request performed. |
| Browser frontend | Supabase Auth | Supabase JS `auth.signInWithPassword`; `supabase.ts`, `eventStore.ts` | CONFIGURED BUT NOT VERIFIED | Admin/staff auth code exists; no credentials/session used. |
| Browser frontend | `secure-ticket-lookup` | `functions.invoke`; `supabase.ts:309-327` | PARTIALLY IMPLEMENTED | Function and client call exist; deployment, origin list, server secrets and database unknown. |
| Browser frontend | `admin-audit` | `functions.invoke`; `supabase.ts:483-520` | PARTIALLY IMPLEMENTED | Auth/role/signature logic exists; deployed settings unknown. |
| Browser frontend | `verify-payment` | No client invocation | NOT IMPLEMENTED | Function is a disabled 503 stub, not connected to checkout. |
| Browser registration form | Registration persistence | `App.tsx`, `RegistrationPage.tsx`, `PaymentModal.tsx` | NOT IMPLEMENTED | Flow stops at disabled notice; no save call on submit. |
| Browser client | Registration/donation tables | `SupabaseService` upsert/fetch | PARTIALLY IMPLEMENTED | Helpers exist, but actual checkout/donation UI does not use them; generic fallback tables not in migrations. |
| Browser client | `current_student_ids` | `StudentIdService` table writes | BROKEN / UNKNOWN | Table not defined by supplied migrations; local data is authoritative and remote errors ignored. Could exist out of band. |
| Browser contact form | `inquiries` table | `AboutContactPage.tsx:70-84` | BROKEN / UNKNOWN | No table in supplied migrations; returned SDK error is ignored. Could exist out of band. |
| Browser event stores | Event/finance tables | `EventStore`, localStorage plus direct Supabase mutations | PARTIALLY IMPLEMENTED | Mutation attempts exist, often fire-and-forget with ignored errors; live schema/access unknown. |
| Browser upload forms | Supabase Storage | `readValidatedImage`; no Storage SDK call | NOT IMPLEMENTED | Image/receipt becomes data URL; migration bucket does not mean connected upload. |
| Supabase Edge Function | Supabase DB | service-role query/RPC in `secure-ticket-lookup`, `admin-audit` | CONFIGURED BUT NOT VERIFIED | Source uses secrets and DB; function deployment/secrets/schema unavailable. |
| PayStation | Backend payment initiation | No source file/config | NOT CONFIGURED | No provider request, base URL, merchant configuration, or initiation code. |
| PayStation | Backend callback/webhook | No endpoint | NOT IMPLEMENTED | No webhook/IPN/return validation. |
| Backend | Email service | No provider code/config | NOT IMPLEMENTED | Ticket “email sent” interaction is simulated. |
| Frontend | Unsplash | Embedded HTTPS image URLs | CONFIGURED BUT NOT VERIFIED | URLs appear in source; no availability test. |
| Build output | Hosting platform/domain | No hosting manifest | UNKNOWN | Existing `dist/` is present, deployment target and current live artifact unknown. |

## How to reach verified status safely

Use authorized read-only checks for Supabase connectivity, deployed migration versions, effective RLS/storage policies, Edge Function deployments and environment secret *presence* (never secret contents). Test provider only after a dedicated Sandbox integration and test account are set up; no production payment or credential-sharing is needed for code review.

