# 13 — Future Developer Guide: How to Safely Modify This System

**Audience:** AI coding assistants & engineers maintaining the PLSCF-2027 Reunion Portal.  
**Rule #1:** Always inspect BOTH client `src/` AND server (`supabase/functions/` + `supabase/migrations/` + live PostgreSQL `system_settings`) before changing any governance rule, toggle, or fee. Changing only React code creates silent client-server mismatches (`400`/`403` errors).

---

## 1. Pre-Change Verification Checklist

Before modifying any governance, fee, payment, or RLS logic:
1. Check `public.system_settings` row `key = 'portal_fee_settings'` for the active DB JSON schema (`formerStudentFee`, `currentStudentFee`, `parentFee`, `minDonation`, `maxDonation`, `maxTotalPayable`, `gatewayChargeRates`, `gatewayChargePercent`, `paymentEnabled`, `registrationOpen`, `alumniRegistrationOpen`, `currentStudentRegistrationOpen`, `donationOpen`).
2. Check Edge Function `supabase/functions/verify-payment/feeValidation.ts` and `initiationHandler.ts` — verify every JSON key required by `computeAuthoritativeOrderAmount()`.
3. Check PostgreSQL RPC `public.rpc_compute_expected_order_amount` (`20270315` latest) — fee math must stay identical across `rules.ts`, `feeValidation.ts`, and PostgreSQL.
4. Preserve all existing security invariants (`PAYSTATION_ALLOW_PAYMENT_FINALIZATION`, origin allowlist `APP_ALLOWED_ORIGINS`, fail-closed server verification, `current_admin_role()`/`current_event_staff_role()` `anon` grants for `student-photos` upload policy).
5. **Never** write `service_role`, PayStation credentials, or signing secrets into `src/` client bundles.

---

## 2. How to Safely Fix the Priority Architectural Gaps (Playbooks)

### Playbook A: Sync Super Admin Controls (`RegistrationDonationControlPanel`) with `system_settings.portal_fee_settings`
1. Create a public bootstrap fetch (similar to `InternationalPaymentService.fetchFromSupabase()` in `src/services/internationalPaymentService.ts`): on `App.tsx` mount, fetch `system_settings WHERE key = 'portal_fee_settings'` via `anon` `SELECT` (already allowed by live RLS `system_settings_public_read_safe`), merge authoritative keys into `FeeSettings` state / `localStorage`, and dispatch `plscf_fee_settings_updated`.
2. **CRITICAL MERGE RULE on Save:** When Super Admin saves in `RegistrationDonationControlPanel` or `AdminDashboard`, **READ-MODIFY-WRITE** the full `portal_fee_settings` JSONB object (`paymentEnabled`, `minDonation`, `maxDonation`, `maxTotalPayable`, `parentFee`, `gatewayChargeRates`, `gatewayChargePercent` MUST be preserved!) or use PostgreSQL `jsonb || $patch` / merge inside a dedicated `SECURITY DEFINER` RPC guarded by `current_admin_role() = 'super_admin'` so UI saves never delete backend-only fee limits.
3. Also consolidate or sync the duplicate form in `AdminDashboard.tsx:3407-3744` so only one source updates governance flags and every save logs an audit entry.

### Playbook B: Resolve the `parentFee` (`1500` vs `500`) & Donation Min (`10` vs `100`) Mismatches
1. Decide the authoritative business fee for Accompanying Parent (`500` or `1500` BDT).
2. Read `feeSettings.parentFee` dynamically in `calculateTotalFee()` (`src/utils/rules.ts:307-322`) instead of hardcoding `1500` (`L315`), and update labels in `ManualRegistrationTab.tsx:1539, 1556` to use `feeSettings.parentFee`.
3. Update `DonationPage.tsx:291` minimum donation check from `10` to `feeSettings.minDonation ?? 100` and cap check `<= maxDonation` (`50000`).

### Playbook C: Safely Harden the Open RLS & `anon` RPC Vulnerabilities
1. Before revoking `anon` `EXECUTE` on manual/admin RPCs (`rpc_admin_get_registrations`, `rpc_delete_registration`, `rpc_update_student_photo`, `get_paid_registrations`, all 6 `rpc_*_manual_*` functions):
   - First fix `supabase/functions/admin-audit/index.ts:77` (allow all valid active `admin_accounts` roles, not only `'super_admin'`) so non-super-admin portal logins succeed cleanly without triggering `supabase.auth.signOut()`.
   - Verify all admin/officer/desk flows carry an authenticated Supabase Auth JWT (`auth.uid() IS NOT NULL`), NOT only a local `isDevBypass` mock object.
2. Add explicit `IF public.current_admin_role() NOT IN (...) THEN RAISE EXCEPTION` checks inside every admin `SECURITY DEFINER` RPC **before** dropping `anon` grants and cleaning up the duplicate 3-arg `rpc_approve_manual_registration` overload.
3. Drop the legacy `USING (true)` policies on `admin_audit_logs`, `admin_audit_history`, `manual_registrations`, `manual_registration_audit_logs`, `dress_distributions`, `food_distributions`, `gate_events`, `financial_transactions`, `financial_audit_logs`, `guest_*`, and `registrations_2026`.
4. **DO NOT** revoke `anon` `EXECUTE` on `current_admin_role()`, `current_event_staff_role()`, `rpc_verify_student_id`, `rpc_reserve_student_id`, `rpc_release_student_id_reservation`, `rpc_lookup_ticket`, `rpc_lookup_donation`, `rpc_verify_student_qr`, or `rpc_get_financial_transparency_summary` (these are intentionally required by public visitors or storage upload RLS checks!).

### Playbook D: Fix Manual Approval Student ID Sync & IPN Donation/Method Normalization
1. In `rpc_approve_manual_registration` (`20270309` L607-612), fix column names on `current_student_ids` from `registration_status`/`registered_by_reg_id` to `verification_status = 'USED'`, `used_registration_id = v_rec.id`, `reserved_until = NULL`.
2. In `rpc_reserve_student_id` (`20270310` L306), check `verification_status IN ('USED', 'ALREADY_USED')`.
3. In `rpc_promote_pending_order_to_registration` (`20270312` L623-636 & L734), normalize `p_method` via `rpc_normalize_payment_method(p_method)` and handle `order_type = 'donation'` by inserting into `public.donations` (idempotent on `transaction_id`/`gateway_invoice_number`) + `financial_ledger`.
