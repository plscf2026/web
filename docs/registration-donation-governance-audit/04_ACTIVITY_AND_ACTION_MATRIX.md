# 04 — Complete Activity & Action Inventory

**Audit Classification:** Verified implementation (traced directly across UI handlers, services, Edge Functions, and SQL RPCs).  
**Total Documented Activities:** **22** verified activities (covering Governance Configuration, Registration Lifecycle, Manual Desk Approvals, Donation Lifecycle, and Reporting/Audit) plus **2 Missing/Planned Activities** explicitly noted.

---

## Activity Matrix Index

| ID | Activity Name | Allowed Role | Persistence Target | Classification |
|---|---|---|---|---|
| **ACT-01** | Enable / Disable Global Online Registration (`Governance Panel`) | Super Admin (UI role; `localStorage` only) | `localStorage` + local DOM Audit (`EventStore`) | Verified (`localStorage` split-brain!) |
| **ACT-02** | Enable / Disable Alumni Registration | Super Admin | `localStorage` + local DOM Audit (`EventStore`) | Verified (`localStorage` split-brain!) |
| **ACT-03** | Enable / Disable Current Student Registration | Super Admin | `localStorage` + local DOM Audit (`EventStore`) | Verified (`localStorage` split-brain!) |
| **ACT-04** | Enable / Disable Online Donation Portal | Super Admin | `localStorage` + local DOM Audit (`EventStore`) | Verified (`localStorage` split-brain!) |
| **ACT-05** | Edit Registration & Donation Closed Advisory Notices | Super Admin | `localStorage` + local DOM Audit (`EventStore`) | Verified (`localStorage` split-brain!) |
| **ACT-06** | Save Legacy Registration Status, Fees, Schedule & Sections | Super Admin (`feeSettings` tab legacy form) | `localStorage` ONLY (no audit log!) | Verified (`localStorage` split-brain!) |
| **ACT-07** | Toggle `Hide Donation Amounts` Privacy Flag | Super Admin (`isSuperAdminAccount`) | `localStorage` (`AppStore.saveFeeSettings`) | Verified (`localStorage` only) |
| **ACT-08** | Edit & Publish International Payment Details | Super Admin (`internationalPaymentManagement`) | `public.system_settings` (`international_payment_info`) + `localStorage` | Verified (true Supabase sync!) |
| **ACT-09** | Verify & Reserve Current Student ID | Public Visitor / Anonymous | `public.current_student_ids` (via RPC) | Verified |
| **ACT-10** | Initiate Online Registration Checkout (`PayStation`) | Public Visitor / Anonymous (when Global + Category + `paymentEnabled` open) | `public.pending_orders` (`upsert`) + PayStation Gateway | Verified |
| **ACT-11** | Finalize Online Registration on Return Redirect | Public Visitor / Edge `service_role` | `pending_orders`, `registrations_2027`, `payment_transactions`, `current_student_ids`, `admin_audit_logs` | Verified |
| **ACT-12** | Process PayStation IPN Webhook | External PayStation Server | `pending_orders` / `registrations_2027`, `financial_ledger`, `current_student_ids` | Verified |
| **ACT-13** | Create Manual Venue Registration | Admin / Registration Officer / Staff (`ManualRegistrationTab`) | `public.manual_registrations`, `manual_registration_audit_logs` | Verified |
| **ACT-14** | Edit Student Name/Mobile on Manual Registration | Admin / Staff (Restricted) | `public.manual_registrations`, `manual_registration_audit_logs` | Verified |
| **ACT-15** | Approve / Reject Manual Registration | Super Admin / Admin (`ManualApprovalTab`) | `manual_registrations` → `registrations_2027`, `financial_transactions`, `manual_registration_audit_logs` | Verified (bug on `current_student_ids` sync) |
| **ACT-16** | Approve / Reject Manual Registration Payment | Super Admin / Finance (`ManualApprovalTab`) | `manual_registrations`, `registrations_2027`, `financial_transactions`, `manual_registration_audit_logs` | Verified |
| **ACT-17** | Initiate Online Donation Checkout (`PayStation`) | Public Visitor / Anonymous (when `donationOpen` + `paymentEnabled` open) | `public.pending_orders` + PayStation Gateway | Verified |
| **ACT-18** | Finalize Online Donation (`record-donation`) | Returning Donor / Authenticated Admin | `public.donations`, `public.donations_2027` | Verified |
| **ACT-19** | Generate Registration Card / QR Ticket & Public Ticket Lookup | Registered User / Public (`TicketLookupModal`, `TicketView`) | Reads `registrations_2027` (`secure-ticket-lookup` Edge / `rpc_lookup_ticket`) + `ticket_lookup_rate_limit` | Verified |
| **ACT-20** | Delete Registration Record | Super Admin (UI) — *RPC also callable by `anon`!* | Deletes from `registrations_2027`, resets `current_student_ids`, inserts `admin_audit_history` | Verified |
| **ACT-21** | View Financial Transparency & Export CSV Reports | Public (`FinancialTransparencyDashboard`) & Admin (`AdminDashboard`) | Reads `registrations_2027`, `donations`, `expenses`, `staff_expenses` via `rpc_get_financial_transparency_summary()` | Verified |
| **ACT-22** | View Governance & System Audit Trail | Super Admin / Admin (`AuditHistoryTab`) | `admin_audit_history`, `admin_audit_logs`, `financial_audit_logs` via `rpc_fetch_unified_audit_trail()` | Verified |
| **MISS-01** | **MISSING:** Toggle `paymentEnabled` or Sync `portal_fee_settings` from UI | Super Admin (Planned / Missing) | `public.system_settings` (`portal_fee_settings`) | Missing Implementation |
| **MISS-02** | **MISSING:** Scheduled Reconcile (`rpc_reconcile_pending_orders`) | Edge Cron / Automated Job (Missing) | `public.pending_orders` | Orphaned SQL RPC (never called) |

---

## Detailed 16-Attribute Specifications

### ACT-01 to ACT-05 — Save Governance Toggles & Closed Notices (`RegistrationDonationControlPanel`)
1. **Activity Name:** Save Global, Alumni, Current Student, Donation Switches & Bilingual Closed Notices
2. **Purpose:** Enable or pause online registration categories, online donations, and customize bilingual closed-state banners.
3. **Trigger Location:** Admin Portal → tab `feeSettings` (or deep-link `?tab=registrationControl`) → **"Save Governance Controls"** (`RegistrationDonationControlPanel.tsx:614-629`).
4. **User Role Allowed:** Super Admin / roles granted `'feeSettings'` tab (`PORTAL_ROLE_CONFIGS` in `AdminDashboard.tsx`).
5. **Frontend Component:** `RegistrationDonationControlPanel` (`src/components/admin/RegistrationDonationControlPanel.tsx:31-634`).
6. **Function / Handler:** `handleSave()` (`L85-127`).
7. **Backend Service / API:** Calls `AppStore.saveFeeSettings(updated)` (`src/services/store.ts:748-760`) and `EventStore.recordAuditHistory(...)` (`src/services/eventStore.ts:2306`). **No backend API or Supabase call.**
8. **Database Table:** **NONE** for settings persistence; `public.admin_audit_history` (best-effort async fire-and-forget inside `EventStore.recordAuditHistory`).
9. **Database Operation:** Client `localStorage.setItem('plscf_reunion_settings_v1', ...)` + DOM `window.dispatchEvent(new CustomEvent('plscf_fee_settings_updated'))`.
10. **Required Permissions:** Admin UI tab access only (not checked by DB because DB is never called).
11. **Validation Rules:** Coerces booleans (`Boolean(globalOpen)`, etc.) and `.trim()` on closed notices (`L91-98`).
12. **Success Behavior:** Updates `settings` React state, notifies `onSettingsChanged(updated)` callback to parent `AdminDashboard`, shows emerald success banner (`L198-207`) for `3500ms`.
13. **Failure Behavior:** Audit failure is swallowed (`try { ... } catch (_) {}` `L106-122`); `localStorage` failures fail silently inside `setStored`.
14. **Side Effects:** Immediately updates `Header`, `Footer`, `HomePage`, `RegistrationPage`, `DonationPage` **in the same browser session only**. **Zero effect on other users or Edge Function checks.**
15. **Related Controls:** `GOV-01`, `GOV-02`, `GOV-03`, `GOV-04`, `ADV-01`, `ADV-02`.
16. **Related Modules:** `App.tsx`, `Header.tsx`, `Footer.tsx`, `HomePage.tsx`, `RegistrationPage.tsx`, `DonationPage.tsx`, `PayStationService`.

### ACT-06 — Save Legacy Fee & Event Configuration Form (`AdminDashboard`)
1. **Activity Name:** Legacy Registration Status, Fees, Schedule, & Homepage Sections Save
2. **Purpose:** Update `formerStudentFee`, `currentStudentFee`, legacy `registrationOpen`, `closedMessageEn/Bn`, `eventTargetDate`, `simulateEventCompleted`, `endDate`, `homePageSections`, `hideDonationAmounts`.
3. **Trigger Location:** Admin Portal → `feeSettings` tab → second card form submit (`AdminDashboard.tsx:3430`).
4. **User Role Allowed:** Super Admin / `feeSettings` tab roles.
5. **Frontend Component:** `AdminDashboard` (`src/components/AdminDashboard.tsx:3407-3744`).
6. **Function / Handler:** `handleSaveFeeSettings()` (`AdminDashboard.tsx:930-956`).
7. **Backend Service / API:** `AppStore.saveFeeSettings(updated)` (`localStorage` only). **Does NOT call Supabase or `EventStore.recordAuditHistory`.**
8. **Database Table:** **NONE**.
9. **Database Operation:** `localStorage.setItem` only.
10. **Required Permissions:** Admin UI tab access.
11. **Validation Rules:** HTML `required` on fee/date inputs; `Number(formerFeeInput)`, `Number(currentFeeInput)`.
12. **Success Behavior:** Sets `settingsSuccessNotice` (`L954`) for `3000ms`.
13. **Failure Behavior:** Overwrites local state if stale (`...currentLatest, ...feeSettings`).
14. **Side Effects:** Emits `plscf_fee_settings_updated`; however `AdminDashboard` itself has no listener to re-sync legacy inputs when `RegistrationDonationControlPanel` saves (`L3395` only calls `setFeeSettings` and `setRegistrationOpenInput`).
15. **Related Controls:** `GOV-01`, `FIN-01`, `FIN-02`, `ADV-01`, `ADV-03`, `ADV-05`, `ADV-06`, `UNUSED-02`.
16. **Related Modules:** `RegistrationPage.tsx`, `HomePage.tsx`.

### ACT-07 — Toggle Hide Donation Amounts (`AdminDashboard`)
1. **Activity Name:** Show / Hide Donation Amounts in Hall of Fame
2. **Purpose:** Super Admin privacy toggle (`hideDonationAmounts`).
3. **Trigger Location:** Admin Portal → `Donations` tab header button (`AdminDashboard.tsx:3883-3906`).
4. **User Role Allowed:** `isSuperAdminAccount` only (`L3883`).
5. **Frontend Component:** `AdminDashboard.tsx`.
6. **Function / Handler:** `handleToggleHideDonationAmounts()` (`AdminDashboard.tsx:568-576`).
7. **Backend Service / API:** `AppStore.saveFeeSettings()` (`localStorage` only).
8. **Database Table:** **NONE**.
9. **Database Operation:** `localStorage` update + DOM event.
10. **Required Permissions:** `isSuperAdminAccount` check in React UI.
11. **Validation Rules:** Toggles `!feeSettings.hideDonationAmounts`.
12. **Success Behavior:** Updates `feeSettings` & `hideDonationAmountsInput`.
13. **Failure Behavior:** Cleared if user runs `syncLocalState()` (`L664-694` omits `setHideDonationAmountsInput`), causing legacy form submit to revert it!
14. **Side Effects:** Updates `localStorage` (`hideDonationAmounts`), affecting only components reading it in the same browser.
15. **Related Controls:** `ADV-03`.
16. **Related Modules:** `Donations` tab.

### ACT-08 — Save International Payment Configuration
1. **Activity Name:** Update International Wire/Remittance Page Content
2. **Purpose:** Manage bank details, SWIFT, routing, contacts, bilingual copy, and `isEnabled` toggle.
3. **Trigger Location:** Admin Portal → `internationalPaymentManagement` tab (`InternationalPaymentManagementTab.tsx`).
4. **User Role Allowed:** Super Admin / permitted roles.
5. **Frontend Component:** `InternationalPaymentManagementTab`.
6. **Function / Handler:** `handleSave` (`L70-90`) → `InternationalPaymentService.saveToSupabase(form, adminName)`.
7. **Backend Service / API:** PostgREST `upsert` on `system_settings`.
8. **Database Table:** `public.system_settings` (`key = 'international_payment_info'`).
9. **Database Operation:** `INSERT / UPDATE (UPSERT)` + `localStorage` cache + event notification.
10. **Required Permissions:** Authenticated Super Admin (`system_settings_admin_write`: `current_admin_role() = 'super_admin'`).
11. **Validation Rules:** String normalization via `normalizeInternationalPaymentInfo`.
12. **Success Behavior:** Displays live sync banner (`L77-82`) and updates subscribers (`InternationalPaymentPage`, `DonationPage`).
13. **Failure Behavior:** Displays error banner (`L84-87`).
14. **Side Effects:** Public readers (`anon`) immediately fetch via RLS `system_settings_public_read_safe`.
15. **Related Controls:** `ADV-04`.
16. **Related Modules:** `DonationPage.tsx`, `InternationalPaymentPage.tsx`.

### ACT-09 — Verify & Reserve Student ID
1. **Activity Name:** Current Student ID Verification & 15-Minute Checkout Reservation
2. **Purpose:** Confirm `student_id` is `ACTIVE` and `AVAILABLE`, then temporarily lock it during payment.
3. **Trigger Location:** `RegistrationPage.tsx` (Verify ID button / checkout prep).
4. **User Role Allowed:** Public visitor (`anon` / `authenticated`).
5. **Frontend Component:** `RegistrationPage.tsx`.
6. **Function / Handler:** `StudentIdService.verifyStudentId()` & `reserveStudentId()` (`src/services/studentIdStore.ts:654, 734`).
7. **Backend Service / API:** `supabase.rpc('rpc_verify_student_id')` & `supabase.rpc('rpc_reserve_student_id')`.
8. **Database Table:** `public.current_student_ids`.
9. **Database Operation:** `SELECT` (`rpc_verify_student_id`); `SELECT ... FOR UPDATE` + `UPDATE` (`rpc_reserve_student_id` sets `verification_status = 'RESERVED'`, `reserved_until = NOW() + 15 min`).
10. **Required Permissions:** `EXECUTE` granted to `anon, authenticated, service_role` (`SECURITY DEFINER`).
11. **Validation Rules:** Active status, not `USED` (`rpc_reserve_student_id` has a bug omitting `'ALREADY_USED'`), reservation expiry check.
12. **Success Behavior:** Returns class & student name; unlocks parent-below-class-6 eligibility check (`RegistrationPage.tsx:349-355`).
13. **Failure Behavior:** Displays bilingual error (`NOT_FOUND`, `INACTIVE`, `RESERVED`, `ALREADY_USED`).
14. **Side Effects:** `reserved_until` released on cancel (`rpc_release_student_id_reservation`) or marked `'USED'` after verified payment.
15. **Related Controls:** `GOV-01`, `GOV-03`.
16. **Related Modules:** `StudentIdManagementTab`, `RegistrationPage`.

### ACT-10 — Initiate Online Registration Payment
1. **Activity Name:** Create Pending Order & PayStation Checkout Session for Registration
2. **Purpose:** Validate governance switches, registration fields, and fees on both client and server; persist `pending_orders`; obtain PayStation `payment_url`.
3. **Trigger Location:** `RegistrationPage.tsx` Submit (`L631`) → `PaymentModal.tsx` **"Pay with PayStation"**.
4. **User Role Allowed:** Public (`anon` / `authenticated`) when `Global`, category (`former`/`current`), and `paymentEnabled` are open.
5. **Frontend Component:** `RegistrationPage` + `PaymentModal`.
6. **Function / Handler:** `PayStationService.createPayment()` (`src/services/paystation.ts:235-315`) after `validateRegistrationData()`.
7. **Backend Service / API:** Edge Function `verify-payment` (`action: 'create-payment'`) → `executeInitiatePayment` (`initiationHandler.ts:75-351`) → PayStation `/v2/create-payment`.
8. **Database Table:** Reads `public.system_settings` (`portal_fee_settings`); writes `public.pending_orders`.
9. **Database Operation:** `SELECT` (`system_settings`), `UPSERT` (`pending_orders` via `service_role`).
10. **Required Permissions:** Edge Function uses `SUPABASE_SERVICE_ROLE_KEY`; PayStation calls use `PAYSTATION_MERCHANT_ID` + `PAYSTATION_PASSWORD`.
11. **Validation Rules:** Server validates `paymentEnabled === true`, `registrationOpen === true`, category flag `!== false`, `validateAndBuildPendingRegistrationData` (`registrationPayload.ts`), `computeAuthoritativeOrderAmount` (`feeValidation.ts`), origin allowlist (`callbackUrl.ts`).
12. **Success Behavior:** Stores pending session locally (`PayStationService.savePendingSession`) and redirects browser to PayStation hosted URL.
13. **Failure Behavior:** Returns HTTP `400/403/502/503` (e.g., `PAYMENT_DISABLED`, `REGISTRATION_CLOSED`, `FEE_DECOMPOSITION_MISMATCH`); preserves draft in `localStorage`.
14. **Side Effects:** `pending_orders` expires in `2 hours` (`expires_at`).
15. **Related Controls:** `GOV-01`, `GOV-02`, `GOV-03`, `GOV-05`, `GOV-06`, `GOV-07`, `FIN-01..06`.
16. **Related Modules:** `PayStationService`, `PaymentModal`, `App.tsx`.

### ACT-11 — Verify & Promote Registration on Gateway Return Redirect
1. **Activity Name:** Complete Registration After PayStation Redirect
2. **Purpose:** Server-to-server verification of PayStation transaction status and atomic promotion of `pending_orders` into `registrations_2027`.
3. **Trigger Location:** Gateway return URL `?payment_callback=true` handled by `App.tsx:225-288` → `PaymentModal` (`verifying` step).
4. **User Role Allowed:** Returning browser (`anon` / `authenticated`) while `PAYSTATION_ALLOW_PAYMENT_FINALIZATION === 'true'`.
5. **Frontend Component:** `App.tsx` + `PaymentModal.tsx:118-180`.
6. **Function / Handler:** `PaymentModal.finalizeRegistration` → `PayStationService.completeRegistrationAfterPayment` (`L725+`) → `SupabaseService` / `verify-payment` (`action: 'verify-payment'`).
7. **Backend Service / API:** Edge Function `verify-payment` (`index.ts:481-571`) → `verifyGatewayTransactionStatus` (`statusClient.ts`) → `supabase.rpc('rpc_verify_payment')` → delegates to `rpc_promote_pending_order_to_registration`.
8. **Database Table:** `pending_orders`, `registrations_2027`, `payment_transactions` or `financial_ledger`, `current_student_ids`, `admin_audit_logs`.
9. **Database Operation:** `SELECT ... FOR UPDATE`, `INSERT` (`registrations_2027`, `financial_ledger`), `UPDATE` (`pending_orders.status = 'paid'`, `current_student_ids.verification_status = 'USED'`).
10. **Required Permissions:** `service_role` ONLY on `rpc_verify_payment` and `rpc_promote_pending_order_to_registration`.
11. **Validation Rules:** Anti-replay `transaction_id` uniqueness, server-to-server gateway status `'success'|'successful'`, HMAC signature, `abs(order.amount - expectedTotal) <= 0.01`, full field validation (no placeholder URLs/addresses).
12. **Success Behavior:** Generates 6-char unique `qr_token`, marks paid, shows digital `TicketView` modal.
13. **Failure Behavior:** Returns `402/500`; UI shows retry / ticket recovery fallback.
14. **Side Effects:** **Note split behavior:** If promoted from `pending_orders` (`20270312`), writes `financial_ledger` but skips `payment_transactions` and `admin_audit_logs`; if verified directly against `registrations_2027` (`20270315`), writes `payment_transactions` & `admin_audit_logs` but skips `financial_ledger`!
15. **Related Controls:** `GOV-06`, `FIN-01..06`.
16. **Related Modules:** Gate/Food/Dress scanners, `AdminDashboard`, `TicketLookupModal`.

### ACT-12 — Process PayStation IPN Callback
1. **Activity Name:** Asynchronous PayStation Instant Payment Notification (IPN)
2. **Purpose:** Server-to-server fulfillment even if donor/student closes browser before redirect completes.
3. **Trigger Location:** HTTP `POST` from PayStation webhook to `verify-payment` Edge Function (`index.ts:406-478`).
4. **User Role Allowed:** External webhook (no JWT; strictly verified server-to-server against PayStation Status API!).
5. **Frontend Component:** None (server webhook).
6. **Function / Handler:** Edge `index.ts:406-478` → `verifyGatewayTransactionStatus` → `supabase.rpc('rpc_handle_paystation_ipn')`.
7. **Backend Service / API:** `verify-payment` Edge Function + `rpc_handle_paystation_ipn` (`20270311` L1178-1337).
8. **Database Table:** `pending_orders` → `registrations_2027`, `financial_ledger`, `current_student_ids` (if `pending_orders` registration); `pending_orders` only (if donation).
9. **Database Operation:** `SELECT ... FOR UPDATE`, delegates to `rpc_promote_pending_order_to_registration` or falls back to updating `registrations_2027`.
10. **Required Permissions:** `service_role` ONLY.
11. **Validation Rules:** `PAYSTATION_ALLOW_PAYMENT_FINALIZATION`, `currency === 'BDT'`, gateway status re-query, amount tolerance `<= 0.01`, anti-replay `trx_id`.
12. **Success Behavior:** Returns `{ status: 'success', result: ipnRes }`.
13. **Failure Behavior:** Returns `{ status: 'error' }` HTTP `400/402/500/503`.
14. **Side Effects:** **Gap:** `20270310`/`20270311` stopped writing to `public.ipn_logs`; IPN delegation to `rpc_promote_pending_order_to_registration` passes raw `p_method` without calling `rpc_normalize_payment_method`; donation IPNs do NOT insert into `public.donations`.
15. **Related Controls:** `GOV-06`, `FIN-01..06`.
16. **Related Modules:** Same as ACT-11.

### ACT-13 to ACT-16 — Manual Desk Registration & Super Admin Approval Workflow
1. **Activity Name:** Manual Registration Creation (`ACT-13`), Restricted Staff Edit (`ACT-14`), Registration Approval/Rejection (`ACT-15`), & Financial Approval/Rejection (`ACT-16`)
2. **Purpose:** Offline/desk onboarding and dual-stage approval (`registration_approval_status` + `financial_approval_status`) isolated in `manual_registrations` until approved into `registrations_2027`.
3. **Trigger Location:** `AdminDashboard` tabs `manualRegistration` & `manualApproval`.
4. **User Role Allowed:** Station staff / Officers (`manualRegistration`), Super Admin / Admin (`manualApproval`).
5. **Frontend Component:** `ManualRegistrationTab.tsx` & `ManualApprovalTab.tsx`.
6. **Function / Handler:** `ManualRegistrationService.createManualRegistration`, `updateManualRegistrationBasicDetails`, `approveManualRegistration`, `rejectManualRegistration`, `approveManualFinancial`, `rejectManualFinancial`.
7. **Backend Service / API:** PostgreSQL RPCs `rpc_create_manual_registration`, `rpc_staff_update_manual_registration`, `rpc_approve_manual_registration`, `rpc_reject_manual_registration`, `rpc_approve_manual_financial`, `rpc_reject_manual_financial` (`20270309`).
8. **Database Table:** `manual_registrations`, `manual_registration_audit_logs`, `registrations_2027`, `financial_transactions` (and attempted `current_student_ids`).
9. **Database Operation:** `INSERT` / `UPDATE` across tables.
10. **Required Permissions:** **CRITICAL SECURITY GAP:** All 6 RPCs remain granted `TO anon` with zero `auth.uid()` checks, and `manual_registrations` RLS has `USING (true)` for `authenticated`.
11. **Validation Rules:** 11-digit BD mobile, duplicate mobile/student_id check across both `registrations_2027` & `manual_registrations`, mandatory reference for bKash/Bank Transfer. **By-passes `registrationOpen`, `alumniRegistrationOpen`, `currentStudentRegistrationOpen`.**
12. **Success Behavior:** Generates `PLSCF-2027-F/Cxxxx`, promotes row to `registrations_2027` on approval, creates `FTX-MAN-...` row in `financial_transactions`.
13. **Failure Behavior:** Returns `{ success: false, error }`.
14. **Side Effects:** **Bug:** `rpc_approve_manual_registration` (`20270309` L607-612) tries to update non-existent `current_student_ids` columns and fails silently; `ManualRegistrationTab` uses hardcoded `parentFee = 1500` in UI label (`L1539, L1556`).
15. **Related Controls:** Isolated from `GOV-01..03`.
16. **Related Modules:** `Registrations`, `FinancialTransparency`, `Scanners`.

### ACT-17 & ACT-18 — Initiate & Finalize Online Donation
1. **Activity Name:** Initiate Online Donation (`ACT-17`) & Record Donation (`ACT-18`)
2. **Purpose:** Collect independent welfare/patronage donations via PayStation and record donor entries with 6-char tokens.
3. **Trigger Location:** `DonationPage.tsx` (`handleInitiateDonation`, `L268`) → return redirect `?pay_type=donation` (`DonationPage` pending verifier / `App.tsx:279-283`).
4. **User Role Allowed:** Public (`anon` / `authenticated`).
5. **Frontend Component:** `DonationPage.tsx`.
6. **Function / Handler:** `PayStationService.createPayment` (`opt_a: 'DONATION'`) → on return: `SupabaseService.saveDonation()` (`supabase.ts:1062-1146`).
7. **Backend Service / API:** Initiation via Edge `verify-payment` (`action: 'create-payment'`, checks `paymentEnabled === true` & `donationOpen === true`); finalization via Edge `verify-payment` (`action: 'record-donation'`, `index.ts:298-359`) → `rpc_record_donation`.
8. **Database Table:** `system_settings` (read), `pending_orders` (`order_type = 'donation'`), `donations`, `donations_2027`.
9. **Database Operation:** `UPSERT` (`pending_orders`, `donations`, `donations_2027`).
10. **Required Permissions:** `service_role` ONLY on `rpc_record_donation` (`20270310` L1130); Edge Function validates PayStation gateway status server-to-server.
11. **Validation Rules:** Server requires `100 <= amount <= 50000` (vs client `>= 10` bug!) and `paymentEnabled === true` + `donationOpen === true` on initiation (**not** re-checked on `record-donation`).
12. **Success Behavior:** Issues 6-char donor `token`, displays confirmation receipt and updates Hall of Fame.
13. **Failure Behavior:** Error banner; client no longer falls back to `anon` table writes post-P0-3 (`supabase.ts:1113-1118`).
14. **Side Effects:** Note `donations_2027` trigger `trg_sync_donations_2027_to_canonical` mirrors `donations_2027` → `donations`.
15. **Related Controls:** `GOV-04`, `GOV-05`, `GOV-06`, `FIN-04`, `FIN-05`, `FIN-06`.
16. **Related Modules:** `FinancialTransparencyDashboard`, `AdminDashboard` (`donations` tab).

### ACT-19 — Ticket Lookup & Digital Card Verification
1. **Activity Name:** Public Registration Card / Ticket Retrieval & QR Verification
2. **Purpose:** Allow paid registrants to download their QR digital ticket without exposing PII to unauthenticated scraping.
3. **Trigger Location:** `find-ticket` page / `TicketLookupModal.tsx` & QR verification links `/verify-student-id`.
4. **User Role Allowed:** Public (`anon` / `authenticated`).
5. **Frontend Component:** `TicketLookupModal.tsx`, `TicketView.tsx`.
6. **Function / Handler:** `SupabaseService` invoking Edge Functions `secure-ticket-lookup` and `verify-student-id` (or `rpc_lookup_ticket` / `rpc_lookup_donation`).
7. **Backend Service / API:** Edge Functions `secure-ticket-lookup/index.ts` (rate-limited via `consume_ticket_lookup_rate_limit`), `verify-student-id/index.ts` (non-PII verification, omits `photoUrl`).
8. **Database Table:** `registrations_2027`, `manual_registrations`, `donations`.
9. **Database Operation:** `SELECT` via `service_role` or restricted non-PII `SECURITY DEFINER` RPCs.
10. **Required Permissions:** Rate-limited + mobile number or QR token match required.
11. **Validation Rules:** Regex checks on registration ID (`^[A-Za-z0-9-]{3,60}$`) & BD mobile (`^0\d{10}$`); origin allowlist (`APP_ALLOWED_ORIGINS`).
12. **Success Behavior:** Renders digital ticket with QR code.
13. **Failure Behavior:** HTTP `400/403/404/429`.
14. **Side Effects:** **Unaffected when registration switches are OFF** (existing paid users can still access tickets).
15. **Related Controls:** Independent of `GOV-01..04`.
16. **Related Modules:** Gate / Food / Dress scanners (`rpc_verify_student_qr`).

### ACT-20 — Delete Registration Record
1. **Activity Name:** Delete Paid or Pending Registration
2. **Purpose:** Remove an erroneous registration and release any linked `current_student_ids`.
3. **Trigger Location:** `AdminDashboard` registration table action.
4. **User Role Allowed:** Admin UI (`super_admin` / permitted roles) — **CRITICAL SECURITY BUG: RPC `rpc_delete_registration` is executable by `anon`!**
5. **Frontend Component:** `AdminDashboard.tsx`.
6. **Function / Handler:** Calls `supabase.rpc('rpc_delete_registration', ...)`.
7. **Backend Service / API:** `public.rpc_delete_registration` (`20270115` L8-117).
8. **Database Table:** `registrations_2027` (`registrations_2026` ref in SQL), `current_student_ids`, `admin_audit_history`.
9. **Database Operation:** `DELETE`, `UPDATE` (`current_student_ids`), `INSERT` (`admin_audit_history`).
10. **Required Permissions:** **MISSING SERVER CHECK:** Granted to `anon, authenticated, service_role` with zero caller role check!
11. **Validation Rules:** Checks `p_reg_id`.
12. **Success Behavior:** Deletes row; sets `current_student_ids.verification_status = 'AVAILABLE'`.
13. **Failure Behavior:** Returns `{ success: false }`.
14. **Side Effects:** Leaves `current_student_ids.used_registration_id` non-null; does not delete from `manual_registrations`.
15. **Related Controls:** Indirectly frees `current_student_ids` for `GOV-03`.
16. **Related Modules:** `StudentIdManagementTab`, `AuditHistoryTab`.

### ACT-21 — View Financial Transparency & Export CSV Reports
1. **Activity Name:** View Live Financial Summary, Donor Roll & Export CSV
2. **Purpose:** Provide public financial accountability and Super Admin CSV reporting.
3. **Trigger Location:** Home/Header Financial Transparency route (`FinancialTransparencyDashboard.tsx`) & Admin `payments` / `donations` / `budgetManagement` tabs.
4. **User Role Allowed:** Public (`FinancialTransparencyDashboard`) & Admin (`AdminDashboard`).
5. **Frontend Component:** `FinancialTransparencyDashboard.tsx`, `AdminDashboard.tsx`.
6. **Function / Handler:** Calls `supabase.rpc('rpc_get_financial_transparency_summary')` and `exportToCSV()`.
7. **Backend Service / API:** `rpc_get_financial_transparency_summary()` (`20270305` L1234-1398).
8. **Database Table:** Aggregates `registrations_2027` (`paid`), `donations`, `expenses` (`approved`), `staff_expenses` (`APPROVED`).
9. **Database Operation:** `SELECT` aggregation.
10. **Required Permissions:** Public (`anon, authenticated, service_role`).
11. **Validation Rules:** Server filters paid/approved status.
12. **Success Behavior:** Displays aggregate cards, donor list, expense breakdown; downloads CSV.
13. **Failure Behavior:** Fallback/empty UI state.
14. **Side Effects:** Only the top `"Contribute / Donate"` CTA button (`FinancialTransparencyDashboard.tsx:271`) respects `isDonationOpen(feeSettings)`.
15. **Related Controls:** `GOV-04` (button only), `ADV-03`.
16. **Related Modules:** `DonationPage`, `BudgetManagementTab`.

### ACT-22 — Governance & Security Audit Trail
1. **Activity Name:** Record & View Governance/Admin Audit Logs
2. **Purpose:** Maintain traceable history of settings, login, payment, and manual actions.
3. **Trigger Location:** Automatic on `RegistrationDonationControlPanel` save (`EventStore.recordAuditHistory`), `loginAdmin` (`admin-audit` Edge Function), payment verification (`rpc_verify_payment`), manual actions (`manual_registration_audit_logs`); viewed in `AuditHistoryTab.tsx`.
4. **User Role Allowed:** Super Admin / `auditHistory` tab. **BUG:** `loginAdmin` calls `admin-audit` Edge Function for ALL 5 portal roles (`supabase.ts:1971`), while `admin-audit/index.ts:77` rejects any role `!== 'super_admin'` with `403`, causing `loginAdmin` to sign out non-super-admin roles (`L1981`)! **SECURITY BUG:** `admin_audit_history` (`ALL`) and `admin_audit_logs` (`SELECT/INSERT`) have open `anon` policies from `20270131`.
5. **Frontend Component:** `AuditHistoryTab.tsx`.
6. **Function / Handler:** `SupabaseService.recordAuditLog()`, `EventStore.recordAuditHistory()`, `rpc_fetch_unified_audit_trail()`.
7. **Backend Service / API:** `admin-audit/index.ts` (HMAC-SHA256 signed with `AUDIT_SIGNING_SECRET`), `rpc_fetch_unified_audit_trail`.
8. **Database Table:** `admin_audit_logs`, `admin_audit_history`, `financial_audit_logs`, `manual_registration_audit_logs`.
9. **Database Operation:** `INSERT`, `SELECT`.
10. **Required Permissions:** `admin-audit` Edge enforces `super_admin`; direct PostgREST on `admin_audit_logs` & `admin_audit_history` currently wide open to `anon`!
11. **Validation Rules:** Strict regex checks in `admin-audit/index.ts:87-91`.
12. **Success Behavior:** Unified audit entries visible in `AuditHistoryTab`.
13. **Failure Behavior:** `admin-audit` `403` blocks non-super-admin logins.
14. **Side Effects:** Legacy `AdminDashboard.handleSaveFeeSettings` (`L930-956`) fails to write any audit log at all.
15. **Related Controls:** `GOV-01..04`.
16. **Related Modules:** `AdminDashboard`, `UserAccessManagementTab`.
