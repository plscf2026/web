# 14 — Master System Reference: Registration & Donation Governance Control

**Repository:** `PLSCF-2027` (`Police Lines School & College, Faridpur` 65th Anniversary Reunion Portal)  
**Audit Nature:** Strictly Read-Only Full-Stack Architecture, Database, Security & Data-Flow Audit  
**Documentation Suite Location:** `docs/registration-donation-governance-audit/`

---

## 1. Documentation Index (All 14 Deliverables)

1. [01_SYSTEM_OVERVIEW.md](./01_SYSTEM_OVERVIEW.md) — Executive summary, four-tier split-brain architecture, and behavior of Global, Alumni, Current Student, and Donation governance controls.
2. [02_CONTROL_INVENTORY.md](./02_CONTROL_INVENTORY.md) — Complete inventory of all **20** switches, fee rules, gateway limits, advisory notices, CMS toggles, and unused fields (`GOV-*`, `FIN-*`, `ADV-*`, `UNUSED-*`).
3. [03_CONTROL_DEPENDENCY_MAP.md](./03_CONTROL_DEPENDENCY_MAP.md) — Complete parent-child & peer dependency matrix, effective state truth table, and Mermaid dependency graph.
4. [04_ACTIVITY_AND_ACTION_MATRIX.md](./04_ACTIVITY_AND_ACTION_MATRIX.md) — 16-attribute breakdown of **22** verified activities plus **2** missing/planned activities.
5. [05_FRONTEND_ARCHITECTURE.md](./05_FRONTEND_ARCHITECTURE.md) — React component hierarchy, hooks, duplicate-form state bugs, exact file/line references across admin and public components.
6. [06_BACKEND_SERVICE_ARCHITECTURE.md](./06_BACKEND_SERVICE_ARCHITECTURE.md) — Client services (`AppStore`, `PayStationService`, `SupabaseService`, `InternationalPaymentService`, `StudentIdService`, `ManualRegistrationService`), all 4 Edge Functions, PostgreSQL RPCs, and Mermaid call map.
7. [07_DATABASE_SCHEMA_AND_RELATIONSHIPS.md](./07_DATABASE_SCHEMA_AND_RELATIONSHIPS.md) — Live PostgreSQL catalog specs (`39` tables, `98` RLS policies, `62` RPCs, `13` triggers), live `portal_fee_settings` snapshot, constraints, indexes, and ER diagram.
8. [08_SECURITY_AND_RLS_AUDIT.md](./08_SECURITY_AND_RLS_AUDIT.md) — Role helper functions, Edge security boundaries, table grant/RLS matrix, storage bucket policies, and critical `anon` RPC/RLS vulnerabilities.
9. [09_DATA_FLOW_DIAGRAMS.md](./09_DATA_FLOW_DIAGRAMS.md) — End-to-end Mermaid sequence & flow diagrams for all 7 core governance, checkout, IPN, donation, manual desk, and closure scenarios.
10. [10_CROSS_MODULE_DEPENDENCIES.md](./10_CROSS_MODULE_DEPENDENCIES.md) — Coupling map across Navigation, Ticket Lookup, Student IDs, Manual Desk, Transparency Dashboard, International Payment, Scanners, ID Cards, Financial Ledger, and Audit Trail.
11. [11_CHANGE_IMPACT_AND_RISK_MATRIX.md](./11_CHANGE_IMPACT_AND_RISK_MATRIX.md) — Safe modification blast-radius & risk matrix before changing code, DB settings, or RLS.
12. [12_KNOWN_ISSUES_AND_GAPS.md](./12_KNOWN_ISSUES_AND_GAPS.md) — Prioritized catalog of all confirmed architectural bugs, security vulnerabilities, and missing implementations.
13. [13_FUTURE_DEVELOPER_GUIDE.md](./13_FUTURE_DEVELOPER_GUIDE.md) — Pre-change verification checklist and step-by-step remediation playbooks (`Playbooks A–D`).
14. **14_MASTER_SYSTEM_REFERENCE.md** — Quick reference cheat sheet and consolidated executive map (this document).

---

## 2. Architecture At-a-Glance Cheat Sheet

### Single Source of Truth vs Client Cache
| Setting / Domain | What Public UI Reads | What Admin Governance UI Writes | What Backend (`verify-payment` + SQL) Enforces |
|---|---|---|---|
| **Global / Alumni / Current / Donation Open Switches** | `localStorage['plscf_reunion_settings_v1']` (`AppStore.getFeeSettings`) | `localStorage['plscf_reunion_settings_v1']` ONLY (`AppStore.saveFeeSettings`) | `public.system_settings WHERE key = 'portal_fee_settings'` |
| **Registration & Parent Fees** | `localStorage` (`1500`/`500`) + **hardcoded `1500` Parent fee in `rules.ts:315`** | `localStorage` only (`AdminDashboard` legacy form) | `portal_fee_settings` (`1500` / `500` / **`parentFee: 500`**) |
| **Donation Limits & Gateway Charge** | `DonationPage.tsx:291` (`>= 10` BDT), `UNIFORM_GATEWAY_CHARGE_RATE = 0.018` | No UI inputs exist for donation limits, gateway rate, or `paymentEnabled` | `portal_fee_settings` (`minDonation: 100`, `maxDonation: 50000`, `maxTotalPayable: 100000`, `0.018` across 12 channels, `paymentEnabled: true`) |
| **International Payment Page** | `system_settings.international_payment_info` + `localStorage` | `InternationalPaymentManagementTab` → **syncs to `public.system_settings`** | Read-only public page (`system_settings_public_read_safe`) |

### Key Verified Invariants for Future Development
1. **Master Switch Hierarchy:** `Global Registration` (`registrationOpen`) overrides `Alumni` (`alumniRegistrationOpen`) and `Current Student` (`currentStudentRegistrationOpen`), whereas `Donation` (`donationOpen`) is independent of `Global Registration`.
2. **Checkout Initiation vs Finalization:** Gate new sessions with `paymentEnabled === true` and `registrationOpen` / `donationOpen`; **never** block in-flight PayStation return/IPN finalization on `registrationOpen`/`donationOpen` after money has already been collected (`PAYSTATION_ALLOW_PAYMENT_FINALIZATION` controls emergency kill-switch).
3. **Storage RLS Role Helper Contract:** `public.current_admin_role()` and `public.current_event_staff_role()` must keep `EXECUTE` granted to `anon` (`20270319`) while returning `NULL` when `auth.uid() IS NULL`, otherwise anonymous registration photo uploads fail with `permission denied for function current_admin_role`.
4. **Canonical Tables:** All active registrations belong in `public.registrations_2027`; manual venue entries stage in `public.manual_registrations` before approval sync; canonical donations belong in `public.donations` (synced by trigger from `donations_2027`). `manual_registrations_2027` does not exist.
5. **Security Debt Baseline:** Remediate `anon` `EXECUTE` grants (`rpc_admin_get_registrations`, `rpc_delete_registration`, `rpc_update_student_photo`, `get_paid_registrations`, `rpc_*_manual_*`) and permissive `USING (true)` policies (`admin_audit_logs`, `admin_audit_history`, `manual_registrations`, `manual_registration_audit_logs`, `dress_distributions`, `food_distributions`, `gate_events`, `financial_transactions`, `guest_*`, `registrations_2026`) before production launch.
