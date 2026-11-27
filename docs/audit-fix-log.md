# PLSCF 2027 Pre-Launch Audit — Fix Log & Traceability Matrix

**Target Baseline Commit:** `f3a051ec3f5fd9658bfc9bb6a11e626d684a7b98` (`main`)  
**Completion Date:** 2026-11-27  
**Mode:** Autonomous Remediation (`F-01` through `F-33`)

---

## SQL Migrations & Rollbacks (Must Be Run in Order in Supabase SQL Editor)

1. `supabase/migrations/20270322000000_security_rpc_and_rls_hardening.sql` (Rollback: `supabase/rollback/20270322000000_rollback.sql`)
   - **F-01:** Revoked `PUBLIC`/`anon` execute and added internal `current_admin_role()` / `current_event_staff_role()` / `service_role` checks on all privileged/staff `SECURITY DEFINER` RPCs (`rpc_admin_get_registrations`, `get_paid_registrations`, `rpc_delete_registration`, `rpc_fetch_unified_audit_trail`, `rpc_update_student_photo`, all manual registration RPCs, all gate/food/dress RPCs, all guest/staff card RPCs, `rpc_update_meal_schedule`, `get_staff_remaining_balance`, `verify_student_token_for_department`, `rpc_authenticate_portal_role`, `consume_ticket_lookup_rate_limit`, and trigger helpers). Fixed runtime JSONB/BOOLEAN mismatch in `rpc_collect_staff_food` calling `check_meal_scanner_active`. Preserved all safe public RPCs (`rpc_get_public_governance_settings`, `rpc_get_public_reunion_stats`, `rpc_lookup_ticket`, `rpc_lookup_donation`, `rpc_verify_student_qr`, `rpc_verify_student_id`, `rpc_reserve_student_id`, `rpc_release_student_id_reservation`, `rpc_get_financial_transparency_summary`, `rpc_verify_personal_donation_history`, `rpc_resolve_login_email`, `current_admin_role`, `current_event_staff_role`).
   - **F-02:** Replaced active `USING (true)` / `WITH CHECK (true)` RLS policies across audit logs, `manual_registrations`, financial/voucher tables, event operations tables, guest/staff pass tables, ID card tables, `gallery_media`, `about_contact_content`, `inquiries` (preserving public `SELECT` where needed and non-empty public `INSERT` on `inquiries`), dropped leftover legacy policy names on `admin_accounts`, `staff_accounts`, `staff_expenses`, `financial_ledger`, and `donations`, and enabled RLS + locked down legacy/backup tables without deleting any data.

2. `supabase/migrations/20270322010000_donation_ipn_promotion_and_logs.sql` (Rollback: `supabase/rollback/20270322010000_rollback.sql`)
   - **F-07:** Updated `rpc_promote_pending_order_to_registration` so `v_order.order_type = 'donation'` idempotently promotes paid standalone donations into `public.donations`, `public.donations_2027` (and `public.financial_ledger`), recovering net principal donation amount and preventing duplicate transaction replay even if the donor closed their browser before returning.
   - **F-23:** Restored non-blocking `public.ipn_logs` audit inserts inside `rpc_handle_paystation_ipn`.

3. `supabase/verification/readonly_checks.sql`
   - Read-only verification queries to check live `portal_fee_settings`, detect any prior paid standalone donation `pending_orders` lacking `public.donations` rows, verify `pg_proc` grants, RLS coverage, remaining `(true)` policies, table grants, demo emails, and storage policies.

---

## Finding Disposition Log (`F-01` – `F-33`)

| ID | Status | Summary of Action Taken |
|---|---|---|
| `F-01` | Fixed (SQL Migration 1) | Privileged RPCs locked to `authenticated`/`service_role` + internal role checks; public RPCs preserved. |
| `F-02` | Fixed (SQL Migration 1) | Permissive `(true)` & legacy policies replaced; backup tables RLS-locked without data loss. |
| `F-03` | Fixed (`supabase/functions/verify-student-id/index.ts`) | Requires active admin/staff Bearer JWT, sanitized exact `.eq()` lookups, mandatory QR token verification, `qrToken` omitted from response. |
| `F-04` | Fixed (`src/services/supabase.ts`, `src/services/eventStore.ts`) | `localStorage` test session cache (`plscf_test_admin_session`, `plscf_test_staff_session`) rejected & cleared when `isDevTestBypassAllowed()` is false. |
| `F-05` | Fixed (`src/utils/rules.ts`, `src/components/PaymentModal.tsx`, `src/services/manualRegistrationService.ts`, `src/utils/rules.test.ts`) | Replaced hardcoded `1500` parent fee with dynamic `feeSettings.parentFee` (seeded `500`). |
| `F-06` | Fixed (`src/components/admin/GalleryManagementTab.tsx`, `src/components/GalleryPage.tsx`) | Replaced permissive `image/*` upload check (which allowed SVGs) with `readValidatedImage()` and applied `sanitizeImageUrl()` / `sanitizeUrl()` in lightbox rendering. |
| `F-07` | Fixed (SQL Migration 2 + `readonly_checks.sql`) | `rpc_promote_pending_order_to_registration` now creates `donations` / `donations_2027` records on IPN/promotion even if the donor closes the browser. |
| `F-08` | Fixed (`src/components/TicketView.tsx`) | Removed the simulated `"Resend to My Email"` button/modal that falsely reported email dispatch. |
| `F-09` | Fixed (`supabase/functions/verify-payment/feeValidation.ts`, `supabase/functions/verify-payment/index.ts`) | Added `resolveAuthoritativeDonationPrincipal()` so `record-donation` validates paid totals against net donation + 1.8% without charging 1.8% twice and syncs `pending_orders`. |
| `F-10` | Fixed (`vercel.json`, `netlify.toml`) | Added `media-src 'self' blob: data: mediastream:;` to Content-Security-Policy header. |
| `F-11` | Fixed (`src/types/index.ts`, `src/components/auth/RoleLoginPage.tsx`, `src/components/admin/idcard/IdCardManagementPortal.tsx`) | Stripped hardcoded `'admin@123'` demo credentials from non-DEV builds and removed the hardcoded `Fill: admin@123` reset button. |
| `F-12` | Manual Dashboard Step | Edge routing confirmed in code; live PayStation merchant dashboard IPN URL verification documented for user. |
| `F-13` | Fixed (`src/utils/navigation.ts`, `src/components/AdminDashboard.tsx`, `src/components/admin/MasterEventOverview.tsx`, `src/types/index.ts`) | Routed `/portal` cleanly to `admin`, allowed `finance_manager` to open `ManualApprovalTab`, repointed dead `foodManagement`/`dressManagement` buttons, and removed nonexistent `securityAudit`/`reunionManagement` entries. |
| `F-14` | Fixed (`src/components/HomePage.tsx`) | Mounted `<CommitteeSection />` on the Home Page so Organizing Committee CMS edits display live. |
| `F-15` | Fixed (`src/components/DonationPage.tsx`) | Enforced dynamic `feeSettings.minDonation` (100) and `feeSettings.maxDonation` (50,000) instead of hardcoded 10 BDT. |
| `F-16` | Fixed (`supabase/functions/verify-payment/index.ts`) | Rejected disallowed browser `Origin` headers with `403` while allowing origin-less server-to-server PayStation IPN, sanitized HTTP `500`/`502` error messages, and redacted payer PII (`payer_mobile_no`) from unauthenticated status proxy responses. |
| `F-17` | Partially Fixed (`index.html`, `officialCardTemplates.ts`, `thankYouCardGenerator.ts`) | Removed inline `onload="..."` handler in `index.html` and inline `<script>` inside print iframes (`F-30`); kept `'unsafe-inline'` in `script-src` only to avoid breaking host script compatibility (noted for post-launch tightening). |
| `F-18` | Fixed (`src/App.tsx`) | Preserved `resolved.portalRole` query slug on initial deep-link mount. |
| `F-19` | Intentionally Deferred (Documented) | Kept `rpc_resolve_login_email` so username-based admin/staff login keeps working safely until an Edge login proxy replaces it. |
| `F-20` | Manual Check / Preserved | Preserved existing test-verified >=6 character reset guard (`userAccessManagement.test.ts`); documented Auth password policy & demo user cleanup in dashboard steps. |
| `F-21` | Fixed (`src/App.tsx`, `src/components/HomePage.tsx`, `src/components/TicketLookupModal.tsx`, `src/components/RegistrationPage.tsx`, `src/components/GalleryPage.tsx`) | Gated `🧪 Quick Test` banners & public admin shortcut behind `isDevTestBypassAllowed()`, and gated bKash sandbox wallet test hints behind `PayStationService.getConfig().isSandbox`. |
| `F-22` | Fixed (`src/services/studentPhotoStorageService.ts`) | Required strict `RIFF....WEBP` / JPEG / PNG magic bytes and valid MIME, failing closed on buffer errors. |
| `F-23` | Fixed (SQL Migration 2 + Manual Check) | Restored `ipn_logs` insertion in `rpc_handle_paystation_ipn`; live `international_payment_info` placeholder update listed in Admin manual steps. |
| `F-24` | Fixed (`src/App.tsx`, `supabase/functions/secure-ticket-lookup/index.ts`) | Cross-browser `payment_return=1` without local session now routes cleanly to `/find-ticket`; validated client IP string formatting in `secure-ticket-lookup`. |
| `F-25` | Fixed (`src/components/AdminDashboard.tsx`, `src/components/ScannerPortal.tsx`, `src/App.tsx`) | Fixed `(r.year ?? 2027)` filter in T-shirt counts, updated T-shirt grid to 7 columns, styled dynamic payment status badge colors, and connected `initialModule` + `gate_scanner` in `ScannerPortal`. |
| `F-26` | Fixed (`src/components/AboutContactPage.tsx`, `src/components/DonationPage.tsx`, `src/components/TicketLookupModal.tsx`) | Surfaced Supabase error in Contact form instead of showing false success; cleared `localStorage` & `PayStationService` pending session after donations; read `GovernanceSettingsService` in `TicketLookupModal`. |
| `F-27` | Manual Step (Offline Env) | Offline sandbox blocks `npm audit` and live browser checks; included `npm audit` & verification steps in Final Checklist. |
| `F-28` | Fixed (`index.html`, `public/llms.txt`, `public/ai-catalog.json`, `public/robots.txt`, `src/components/TicketView.tsx`, `src/components/NoticeBoardPage.tsx`, `src/services/committeeService.ts`) | Updated stale `Reunion 2026` copy/metadata to `Reunion 2027`. |
| `F-29` | Fixed (`supabase/functions/admin-audit/index.ts`) | Added `status = 'ACTIVE'` and `is_locked` enforcement on `admin_accounts` verification. |
| `F-30` | Fixed (`src/utils/security.ts`, `src/utils/officialCardTemplates.ts`, `src/utils/thankYouCardGenerator.ts`, `src/components/ThankYouCardBadge.tsx`, `src/components/idcard/OfficialCardBadge.tsx`) | Added `sanitizeSvg()` before `dangerouslySetInnerHTML`, enforced `sanitizeImageUrl()` on card `photoUrl`, and removed inline `<script>` tags from print iframes. |
| `F-31` | Fixed (`src/components/Header.tsx`, `src/components/common/MobileBottomNav.tsx`) | Converted logo `<div>` to accessible `<button>`, added `aria-expanded`, and terminated privileged sessions when using MobileBottomNav to return Home. |
| `F-32` | Fixed (`.env.example`) | Replaced merchant ID example with placeholder `"your_paystation_merchant_id_here"`. |
| `F-33` | Documented | Vercel production routing preserved untouched; unused Netlify/Nginx files noted for awareness. |
