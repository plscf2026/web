# 02 — Complete Control Inventory

**Audit Classification:** Verified implementation (every control below verified directly in `src/`, `supabase/functions/`, `supabase/migrations/`, and live PostgreSQL `system_settings`)  
**Total Inventoried Governance & Related Controls:** **20 controls** across 4 tiers (`FeeSettings` governance switches, fee/gateway rules, `FeeSettings` UI/unused controls, and companion/backend-only controls).

---

## 1. Master Governance Switches (Core Tier)

| Control ID | Name | Storage Key (Client) | Storage Key (Server DB) | Default (Client `INITIAL_FEE_SETTINGS`) | Live DB Value (`2026-11-26`) | Enforced Where? |
|---|---|---|---|---|---|---|
| **GOV-01** | **Global Online Registration** | `FeeSettings.registrationOpen` | `portal_fee_settings.registrationOpen` | `true` | `true` | Client UI (`Header`, `Footer`, `HomePage`, `RegistrationPage`, `PayStationService`) + Edge `executeInitiatePayment` (`L126`) |
| **GOV-02** | **Alumni Registration** | `FeeSettings.alumniRegistrationOpen` | `portal_fee_settings.alumniRegistrationOpen` | `true` | `true` | Client UI (`HomePage`, `RegistrationPage`, `PayStationService`) + Edge `executeInitiatePayment` (`L132`) |
| **GOV-03** | **Current Student Registration** | `FeeSettings.currentStudentRegistrationOpen` | `portal_fee_settings.currentStudentRegistrationOpen` | `true` | `true` | Client UI (`HomePage`, `RegistrationPage`, `PayStationService`) + Edge `executeInitiatePayment` (`L138`) |
| **GOV-04** | **Donation Portal Control** | `FeeSettings.donationOpen` | `portal_fee_settings.donationOpen` | `true` | `true` | Client UI (`Header`, `Footer`, `HomePage`, `DonationPage`, `FinancialTransparencyDashboard`, `PayStationService`) + Edge `executeInitiatePayment` (`L149`) |

> **Important Semantics Distinction:**
> - **Fail-Closed Checks (Backend `initiationHandler.ts`):** `paymentEnabled !== true`, `registrationOpen !== true`, and `donationOpen !== true` all **fail closed** (must be boolean `true`).
> - **Opt-Out Checks:** On backend (`initiationHandler.ts:132, 138`) `alumniRegistrationOpen === false` and `currentStudentRegistrationOpen === false` only block on explicit `false`; on client (`rules.ts:471, 480, 502`) `alumniRegistrationOpen !== false`, `currentStudentRegistrationOpen !== false`, and `donationOpen !== false` default to open when `undefined` (if `settings` object exists).

---

## 2. Backend-Only & Server Environment Governance Controls

| Control ID | Name | Config Location | Default / Live Value | Enforced Where? | UI Exposure |
|---|---|---|---|---|---|
| **GOV-05** | **Master Online Payment Gate** (`paymentEnabled`) | `portal_fee_settings.paymentEnabled` (DB) & `(settings as any)?.paymentEnabled` (client check in `paystation.ts:247`) | Live DB: `true` (`INITIAL_FEE_SETTINGS`: **missing**) | Client (`paystation.ts:247` — checks `=== false`) + Edge `executeInitiatePayment` (`initiationHandler.ts:95` — requires `=== true` or returns `403 PAYMENT_DISABLED`) | **MISSING:** Not in `FeeSettings` TypeScript interface (`src/types/index.ts:236-255`), not rendered in any Admin panel |
| **GOV-06** | **Live Payment Finalization Kill-Switch** (`PAYSTATION_ALLOW_PAYMENT_FINALIZATION`) | Supabase Edge Function env secret `PAYSTATION_ALLOW_PAYMENT_FINALIZATION` (`supabase/functions/verify-payment/index.ts:36`) | `'true'` to allow finalization | Edge `verify-payment/index.ts` on `record-donation` (`L299`), `ipn` (`L416`), and `verify-payment` (`L486`) | **MISSING (Server-only secret):** Returns `403 PAYMENT_FINALIZATION_DISABLED` (`verify-payment`, `record-donation`) or `200 note: 'finalization_disabled'` (`ipn`) |
| **GOV-07** | **Gateway Origin & Callback Allowlist** (`APP_ALLOWED_ORIGINS`) | Supabase Edge Function env `APP_ALLOWED_ORIGINS` | Server-configured origins | All 4 Edge Functions (`verify-payment`, `secure-ticket-lookup`, `verify-student-id`, `admin-audit`) + `callbackUrl.ts` | Server-only config |

---

## 3. Financial Fee, Limit & Gateway Charge Controls

| Control ID | Name | Client Source (`store.ts` / `rules.ts`) | Server DB Source (`portal_fee_settings`) | Live DB Value | Client-Server Parity Status |
|---|---|---|---|---|---|
| **FIN-01** | **Former Student (Alumni) Fee** | `FeeSettings.formerStudentFee` (`1500`) | `portal_fee_settings.formerStudentFee` | `1500` BDT | **Split-brain risk:** Editable in legacy `AdminDashboard` form (`localStorage` only); server uses DB `1500` |
| **FIN-02** | **Current Student Fee** | `FeeSettings.currentStudentFee` (`500`) | `portal_fee_settings.currentStudentFee` | `500` BDT | **Split-brain risk:** Editable in legacy `AdminDashboard` form (`localStorage` only); server uses DB `500` |
| **FIN-03** | **Accompanying Parent Fee** | **Hardcoded `1500`** (`rules.ts:315`, `ManualRegistrationTab.tsx:1539`) | `portal_fee_settings.parentFee` | `500` BDT | **ACTIVE MISMATCH BUG:** Client `calculateTotalFee` adds `1500`; `PaymentModal.tsx:134` / `paystation.ts:881` default `500`; server (`feeValidation.ts` & `rpc_compute_expected_order_amount`) rejects `1500` with `FEE_DECOMPOSITION_MISMATCH` |
| **FIN-04** | **Donation Min / Max Limits** | `DonationPage.tsx:291` enforces `< 10` BDT | `portal_fee_settings.minDonation`, `maxDonation` | `minDonation: 100`, `maxDonation: 50000` | **ACTIVE MISMATCH BUG:** UI allows `10–99` BDT and `>50,000` BDT; backend (`feeValidation.ts:138, 169`) rejects `< 100` (`INVALID_DONATION_AMOUNT`) or `> 50000` (`DONATION_LIMIT_EXCEEDED`) |
| **FIN-05** | **Maximum Total Payable Cap** | Not enforced in client UI | `portal_fee_settings.maxTotalPayable` | `100000` BDT | Enforced in `feeValidation.ts:182` & `rpc_compute_expected_order_amount` (`AMOUNT_OVERFLOW`) |
| **FIN-06** | **Uniform Gateway Charge Rate** | `UNIFORM_GATEWAY_CHARGE_RATE = 0.018` (`rules.ts:328`) | `gatewayChargePercent: 1.8`, `gatewayChargeRates: { ... 0.018 }` (12 channels) | `1.8%` (`0.018`) | Synchronized at `0.018` across client, Edge Function, and SQL (note: `maxGatewayCharge: 75` in live DB JSON is **not enforced** by `feeValidation.ts` or `rpc_compute_expected_order_amount`) |

---

## 4. Advisory Notice & Presentation Controls (`FeeSettings` / `system_settings`)

| Control ID | Name | Key / Field | Component Editor | Consumers | Persistence |
|---|---|---|---|---|---|
| **ADV-01** | **Registration Closed Notice (EN/BN)** | `closedMessageEn`, `closedMessageBn` | `RegistrationDonationControlPanel` (`L553-573`) & `AdminDashboard` (`L3494-3513`) | `HomePage.tsx`, `RegistrationPage.tsx`, `rules.ts:508-539` | `localStorage` ONLY |
| **ADV-02** | **Donation Closed Notice (EN/BN)** | `donationClosedMessageEn`, `donationClosedMessageBn` | `RegistrationDonationControlPanel` (`L578-598`) ONLY | `DonationPage.tsx`, `rules.ts:544-558` | `localStorage` ONLY |
| **ADV-03** | **Hide Donation Amounts Toggle** | `FeeSettings.hideDonationAmounts` (`false`) | `AdminDashboard.tsx:568-576, 3883-3905` (`Donations` tab header) | Donors Hall of Fame privacy display (`AdminDashboard` / public view if checked) | `localStorage` ONLY (**Bug:** `syncLocalState` at `L664-694` omits syncing `hideDonationAmountsInput`) |
| **ADV-04** | **International Payment CMS Page** | `system_settings.key = 'international_payment_info'` (`isEnabled`, bank/SWIFT/routing/contact/bilingual texts) | `InternationalPaymentManagementTab.tsx` via `InternationalPaymentService.saveToSupabase()` | `InternationalPaymentPage.tsx`, `DonationPage.tsx:565` (CTA visibility check) | **Synced to Supabase `system_settings` + `localStorage`** |
| **ADV-05** | **Home Page Section Visibility & Order** | `FeeSettings.homePageSections` (10 sections incl. `fees`, `financials`, `status`) | `AdminDashboard.tsx:3623-3680` | `HomePage.tsx` | `localStorage` ONLY |
| **ADV-06** | **Event Target Date & Post-Event Simulation** | `eventTargetDate` (`2027-01-29T09:00:00`), `simulateEventCompleted` (`false`) | `AdminDashboard.tsx:3545-3621` | `HomePage` countdown, `AppStore.getActiveEventYear()` | `localStorage` ONLY |

---

## 5. Dead / Unused Configuration Fields (`FeeSettings`)

| Control ID | Field Name | Default Value | Editable in UI? | Runtime Enforcement Status |
|---|---|---|---|---|
| **UNUSED-01** | `FeeSettings.startDate` | `'2026-01-01'` (`store.ts:125`) | **No** (no input in UI) | **Missing / Unused** — Never read in `rules.ts`, `RegistrationPage.tsx`, Edge Functions, or SQL |
| **UNUSED-02** | `FeeSettings.endDate` | `'2027-01-20'` (`store.ts:126`) | **Yes** (`AdminDashboard.tsx:3578-3587` "Registration Deadline", badge preview `L3474`) | **Missing / Cosmetic Only** — Never auto-closes registration on deadline |
| **UNUSED-03** | `FeeSettings.lateFeeEnabled` & `lateFeeAmount` | `false`, `300` (`store.ts:127-128`) | **No** | **Missing / Unused** — Never added to fees anywhere in client or backend |
| **UNUSED-04** | `portal_fee_settings.maxGatewayCharge` | `75` (`audit_db_summary.txt:53`) | **No** | **Unused in Active Code** — Present in DB JSON; both `feeValidation.ts:179` and `rpc_compute_expected_order_amount` (`20270315` L180) apply un-capped flat `round(subtotal * 0.018, 2)` |
