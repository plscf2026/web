# Complete file and folder directory

Inventory excludes `.env` values, `node_modules/`, generated `dist/`, and `.aistudio/` image artifacts. Those excluded items are summarized at the end. Project-root paths below are relative to the repository root.

## Root files

| Path | Type | Responsibility / status |
|---|---|---|
| `README.md` | Markdown | Generic AI Studio/Vite local-running instructions; not a production deployment guide. |
| `package.json` | JSON | Package identity, scripts, dependencies and versions. |
| `bun.lock` | Lockfile | Bun dependency resolution lock. |
| `index.html` | HTML | Vite document shell, metadata, React mount. |
| `metadata.json` | JSON | AI Studio app description and declared camera permission. |
| `vite.config.ts` | TypeScript | Vite React/Tailwind plugins, alias, HMR behavior. |
| `tsconfig.json` | JSON | TypeScript compiler settings; excludes `dist` and `supabase`. |
| `.gitignore` | Config | Ignores dependencies/build/cache/logs and `.env*`, except `.env.example`. |
| `.env.example` | Environment template | Names browser/Supabase and Gemini/app URL variables; values are intentionally not reproduced. |

## `src/` application

### Entry, global shell and routes

| Path | Responsibility / dependencies |
|---|---|
| `src/main.tsx` | React DOM entry; mounts `App`, imports global CSS. |
| `src/App.tsx` | In-memory view/language/ticket/payment state and page composition; does not use a router. |
| `src/index.css` | Global styles and Tailwind CSS import. |
| `src/i18n/translations.ts` | English and Bangla UI strings; includes copy describing simulated email. |
| `src/types/index.ts` | Application-domain and UI TypeScript interfaces/enums; not generated database types. |

### Public and operational components

| Path | Responsibility / important links |
|---|---|
| `src/components/Header.tsx` | Main navigation, language selection, links into admin/scanner. |
| `src/components/Footer.tsx` | Site footer and navigation/contact copy. |
| `src/components/HomePage.tsx` | Landing page, event information, local/admin-fed data and ticket lookup trigger. |
| `src/components/RegistrationPage.tsx` | Registration form, local student-ID/mobile checks, image selection and payment handoff. |
| `src/components/PaymentModal.tsx` | Notice-only disabled checkout; no provider call. |
| `src/components/TicketLookupModal.tsx` | Calls `SupabaseService.lookupVerifiedTicket`; displays a found ticket. |
| `src/components/TicketView.tsx` | Printable ticket and client-generated QR; email-resend interaction is simulated. |
| `src/components/DonationPage.tsx` | Donation instructions/disabled notice; no payment submission. |
| `src/components/NoticeBoardPage.tsx` | Notice rendering and simulated local download behavior. |
| `src/components/GalleryPage.tsx` | Static event photo/video gallery UI. |
| `src/components/AboutContactPage.tsx` | About/contact UI; stores inquiries locally and attempts an insert to `inquiries`. |
| `src/components/AdminDashboard.tsx` | Admin authentication, tabs, registration/fee/audit/backup/security UI. |
| `src/components/ScannerPortal.tsx` | Staff Supabase Auth, linked staff profile, module selection. |
| `src/components/GateScannerModule.tsx` | Gate entry/exit workflow; camera display plus manual ID/token lookup. |
| `src/components/FoodScannerModule.tsx` | Meal distribution workflow. |
| `src/components/DressScannerModule.tsx` | T-shirt distribution workflow. |
| `src/components/StaffFinanceModule.tsx` | Staff expenses and receipt selection; local/remote data path. |

### Admin tabs

| Path | Responsibility |
|---|---|
| `src/components/admin/MasterEventOverview.tsx` | Overview of event, gate, food, dress and budget metrics. |
| `src/components/admin/BudgetManagementTab.tsx` | Central budget, allocations, expense decisions and ledger UI. |
| `src/components/admin/DailyAnalyticsTab.tsx` | Daily registration/payment analytics. |
| `src/components/admin/StaffManagementTab.tsx` | Staff account list and management. |
| `src/components/admin/StudentIdManagementTab.tsx` | Student-ID creation/import/edit/status UI. |
| `src/components/admin/AuditHistoryTab.tsx` | Local event audit-history view. |

### Services and utilities

| Path | Responsibility / status |
|---|---|
| `src/services/supabase.ts` | Supabase client/config, registration/donation helpers, ticket lookup, admin auth/audit, exports and embedded SQL generator. |
| `src/services/store.ts` | `AppStore` localStorage persistence and asynchronous Supabase sync for selected data. |
| `src/services/eventStore.ts` | Staff auth/profile, event operations, finance and localStorage with mostly best-effort Supabase writes. |
| `src/services/studentIdStore.ts` | Browser-local student-ID verification/reservation and attempted database writes. |
| `src/utils/rules.ts` | Registration, phone/email, fee and event rules. |
| `src/utils/eventRules.ts` | Role, food/gate/dress workflow and finance calculations. |
| `src/utils/security.ts` | Sanitization, transaction checks, hashing/checklist helpers; not a payment provider verifier. |
| `src/utils/fileValidation.ts` | Client image MIME, size and dimensions check; converts to data URL. |
| `src/utils/rules.test.ts` | Tests for general validation and finance rules; one current email assertion fails. |
| `src/utils/eventRules.test.ts` | Pure event and role rule tests. |
| `src/utils/security.test.ts` | Pure utility/checklist tests; not a live penetration test. |
| `src/utils/studentIdAndBookingRules.test.ts` | Phone/email/student-ID/registration tests. |

## `supabase/`

### Functions

| Path | Responsibility / status |
|---|---|
| `supabase/functions/admin-audit/index.ts` | Authenticated super-admin audit insert with HMAC checksum. |
| `supabase/functions/secure-ticket-lookup/index.ts` | Rate-limited ID/mobile lookup for paid tickets, service-role database read. |
| `supabase/functions/verify-payment/index.ts` | Disabled payment verification stub; all POST requests return 503. |

### Migrations

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260101000000_critical_security_hardened_schema.sql` | Initial admin/audit/registration/donation/scanner schema, storage buckets, RLS and legacy RPCs. |
| `supabase/migrations/20260102000000_event_management_system_schema.sql` | Staff/event distribution/budget/expense/ledger/audit-history schema and initial RLS. |
| `supabase/migrations/20261110000000_auth_and_rls_hardening.sql` | Supabase Auth profile links, role functions, revised RLS and normalized-phone uniqueness. |
| `supabase/migrations/20261111000000_ticket_lookup_rate_limit.sql` | Private rate-limit table and service-role-only rate-limit RPC. |

No Supabase project `config.toml` appears in the inventory.

## Generated, dependency and local configuration directories

- `node_modules/`: installed third-party dependencies; intentionally not enumerated file by file.
- `dist/`: pre-existing Vite output; provenance/freshness unknown. It was not rebuilt.
- `.aistudio/artifacts/brain/.../.tempmediaStorage/`: nine image assets (screenshots) excluded from the technical inventory.
- `.env`: local ignored environment file. Its values were not read or reproduced; only variable names were checked.
- No first-party server folder, public asset tree, hosting manifest, CI workflow, or Supabase CLI config was found.

## Dependency direction

`main.tsx` → `App.tsx` → page/components → services (`AppStore`, `EventStore`, `StudentIdService`, `SupabaseService`) → Supabase JS / browser storage. Edge Functions separately use Deno remote imports and server-side environment variables. SQL migrations describe intended PostgreSQL state.

### Important direct dependency and consumer map

| File/group | Depends on | Direct consumers |
|---|---|---|
| `src/main.tsx` | React DOM, `App.tsx`, `index.css` | Browser entry/runtime. |
| `src/App.tsx` | Header/Footer, public pages, admin/scanner components, domain types, `AppStore`, validation types, `StudentIdService` | Root rendering and page callbacks. |
| `Header.tsx`, `Footer.tsx` | React, icons/translations and navigation props | `App.tsx`. |
| `HomePage.tsx` | `SupabaseService`, `AppStore`, types/translations | `App.tsx`. |
| `RegistrationPage.tsx` | `rules.ts`, `StudentIdService`, `fileValidation.ts`, `AppStore`, translations/types | `App.tsx`; callback opens `PaymentModal`. |
| `PaymentModal.tsx` | React, icons, language type | `App.tsx`; no payment service. |
| `TicketLookupModal.tsx` | `SupabaseService.lookupVerifiedTicket`, ticket/types/translations | `App.tsx`. |
| `TicketView.tsx` | `qrcode`, ticket types/translations, browser print APIs | `App.tsx` after a ticket is selected. |
| `DonationPage.tsx`, `NoticeBoardPage.tsx`, `GalleryPage.tsx`, `AboutContactPage.tsx` | React, translations/types; AboutContact additionally imports `supabase` | `App.tsx`. |
| `AdminDashboard.tsx` | Supabase service/Auth, `AppStore`, `EventStore`, `StudentIdService`, security utilities, all admin tab components | `App.tsx`. |
| `src/components/admin/*` | React, domain types, and the relevant event/student-ID services | `AdminDashboard.tsx`. |
| `ScannerPortal.tsx` | `EventStore` staff authentication/session, role rules and scanner modules | `App.tsx`. |
| `GateScannerModule.tsx`, `FoodScannerModule.tsx`, `DressScannerModule.tsx` | `EventStore`, `AppStore`, event rules/types and browser camera APIs | `ScannerPortal.tsx`. |
| `StaffFinanceModule.tsx` | `EventStore`, `fileValidation.ts`, finance types/rules | `ScannerPortal.tsx`. |
| `src/services/store.ts` | `SupabaseService`, domain types and localStorage | Public/admin/dashboard components. |
| `src/services/eventStore.ts` | `supabase.ts`, `rules.ts`/`eventRules.ts`, types and localStorage | Admin tabs, scanner modules, finance module, student-ID service. |
| `src/services/studentIdStore.ts` | `supabase.ts`, `EventStore`, student-ID rules and localStorage | Registration form, App checkout cancel/reserve, student-ID admin tab. |
| `src/services/supabase.ts` | Supabase JS, domain types and `security.ts` | App stores, ticket components, dashboard and contact form. |
| `src/utils/rules.ts`, `eventRules.ts`, `security.ts`, `fileValidation.ts` | Pure checks/browser primitives | Registration, event, admin, finance and upload UI plus unit tests. |
| `supabase/functions/admin-audit/index.ts` | Deno standard library, Supabase JS from `esm.sh`, Edge secrets | Invoked by `SupabaseService.recordAuditLog`. |
| `supabase/functions/secure-ticket-lookup/index.ts` | Deno standard library, Supabase JS from `esm.sh`, rate-limit RPC/secrets | Invoked by ticket lookup service. |
| `supabase/functions/verify-payment/index.ts` | Deno standard library and allowed-origin env | No frontend consumer found. |
| `supabase/migrations/*.sql` | Supabase/PostgreSQL and Supabase-managed Auth/Storage schemas | Intended to define schema/RLS/functions for services and Edge Functions; live application unknown. |

These are source-level dependency paths, not a guarantee of runtime reachability or successful service calls.
