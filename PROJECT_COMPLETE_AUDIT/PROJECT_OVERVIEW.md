# Project overview

## Scope and evidence

Read-only source audit of the existing Reunion Registration Website for Sylhet Police Lines High School & College, Faridpur. These reports describe repository evidence, not the live deployment. No database connection, secret environment value, personal record, payment, email, migration, or deployment was accessed or changed.

## Purpose and current behavior

The project is a bilingual (Bangla/English) Reunion 2026 website with event information, registration UI, ticket lookup and printing, admin and staff operations, scanner workflows, event finance/budget tools, notices, gallery, and contact form. Navigation and main state are a React single-page application. Registration and donations are not currently completing: payment UI is explicitly disabled, and the payment-verification function always returns 503.

## Technologies actually evidenced

| Area | Evidence |
|---|---|
| Language/UI | TypeScript, React 19, React DOM, JSX/TSX; `src/` |
| Build/dev | Vite 8, React and Tailwind Vite plugins; `vite.config.ts`, `package.json` |
| Styling | Tailwind CSS 4 and project CSS; `src/index.css` |
| Backend/data | Supabase JS client in browser; PostgreSQL/Supabase migrations and three Deno Edge Functions; `src/services/`, `supabase/` |
| Auth | Supabase Auth password sign-in for admin/staff, plus profile/role lookup; no app-owned server |
| Browser persistence | `localStorage` used for most UI/domain state, language and operational caches |
| QR | `qrcode` library creates a QR canvas in `TicketView.tsx`; scanner screens do not decode camera QR |
| Languages | English and Bangla strings in `src/i18n/translations.ts` |
| Tests | Node test API via TypeScript test files; no test script in `package.json` |
| Runtime function imports | Deno standard library and Supabase JS imported from remote URLs by Edge Functions |

`@google/genai`, Express, Motion, and `canvas-confetti` appear as dependencies but have no direct imports in `src/`. The README mentions Gemini, and `.env.example` names `GEMINI_API_KEY`, but no Gemini call is implemented. No email SDK or PayStation SDK/client exists.

## Architecture summary

- The browser hosts UI and calls Supabase directly using a publishable/anon key configured by `VITE_SUPABASE_*` (with source defaults). RLS is therefore an essential authorization boundary.
- `AppStore`, `EventStore`, and `StudentIdService` mix browser-local state with asynchronous Supabase writes. Several writes are best effort and discard errors.
- `secure-ticket-lookup` is an unauthenticated, rate-limited Edge Function that uses a service-role client to retrieve a paid ticket after ID/mobile matching.
- `admin-audit` authenticates a bearer token, checks a linked super-admin profile, HMAC-signs an event and persists it with a service-role client.
- `verify-payment` is a stub. It has no PayStation request, payment callback, or successful verification path.
- Migrations describe a Supabase/PostgreSQL schema, RLS and storage buckets. The live schema, applied migration versions and secrets were not queried.

## Deployment and service facts

The source is configured for Vite and references Supabase. The local project also has existing `dist/` output, but its source, freshness, and hosting are unknown. No hosting manifest, Dockerfile, CI workflow, Supabase CLI configuration, or server entry point was found in the first-party file inventory. The current local folder path is not evidence of production hosting.

## Validation performed

- `npm run lint` (`tsc --noEmit`): passed.
- `./node_modules/.bin/tsx --test src/utils/*.test.ts`: 26 passed, 1 failed. The failure is an assertion that empty email is invalid, while the implementation intentionally accepts empty email as optional.
- No build was run (it writes `dist/`); no live service/database test was attempted.

## Key caveats

See [CONNECTION_STATUS_REPORT.md](./CONNECTION_STATUS_REPORT.md), [DATABASE_COMPLETE_AUDIT.md](./DATABASE_COMPLETE_AUDIT.md), [PAYMENT_SYSTEM_AUDIT.md](./PAYMENT_SYSTEM_AUDIT.md), and [SECURITY_AUDIT.md](./SECURITY_AUDIT.md). In particular, project source is not proof of deployed schema, connectivity, merchant activation, or service health.
