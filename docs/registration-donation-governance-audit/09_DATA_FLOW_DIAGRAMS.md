# 09 — End-to-End System Data Flow Diagrams

**Audit Classification:** Verified implementation (every step matches observed code paths across `src/`, `supabase/functions/`, and `supabase/migrations/`).

---

## Flow 1: Super Admin Governance Toggle & UI Update (Current Split-Brain Behavior)

```mermaid
sequenceDiagram
  autonumber
  actor SA as "Super Admin"
  participant UI as "RegistrationDonationControlPanel"
  participant Store as "AppStore (store.ts)"
  participant LS as "Browser localStorage"
  participant Ev as "EventStore.recordAuditHistory()"
  participant TabUI as "Public Components (Same Browser Tab)"
  participant Edge as "Edge: verify-payment"
  participant DB as "Supabase: system_settings"

  SA->>UI: Toggle switches / notices & click Save Governance Controls
  UI->>Store: saveFeeSettings(updated)
  Store->>LS: setItem('plscf_reunion_settings_v1', normalized)
  Store->>TabUI: dispatchEvent('plscf_fee_settings_updated')
  UI->>Ev: recordAuditHistory(UPDATE_SETTINGS)
  Note over Store,DB: GAP — No call to Supabase! portal_fee_settings is NEVER updated
  TabUI-->>SA: Public routes reflect new toggles in SAME browser only
  Edge->>DB: Other users' checkouts still read untouched DB portal_fee_settings
```

---

## Flow 2: Public Visitor Registration Flow (Alumni & Current Student)

```mermaid
sequenceDiagram
  autonumber
  actor User as "Visitor (Alumni or Current Student)"
  participant RegUI as "RegistrationPage.tsx"
  participant Rules as "rules.ts (validate + fees)"
  participant SID as "StudentIdService / RPC"
  participant Pay as "PayStationService.createPayment"
  participant Edge as "Edge: verify-payment (create-payment)"
  participant DB as "Supabase (system_settings, pending_orders)"
  participant GW as "PayStation Hosted Gateway"

  User->>RegUI: Select category ('former' or 'current')
  alt category == 'current'
    User->>RegUI: Enter Student ID & click Verify
    RegUI->>SID: rpc_verify_student_id(studentId)
    SID-->>RegUI: Returns AVAILABLE + className (evaluates below Class 6 rule)
    RegUI->>SID: rpc_reserve_student_id(studentId, 15m)
  end
  RegUI->>Rules: calculateTotalFee() + calculateGatewayCharge(0.018)
  Note over RegUI,Rules: BUG — rules.ts uses parentFee=1500 if hasParent=true
  User->>RegUI: Submit form (photo uploaded to student-photos bucket)
  RegUI->>Pay: createPayment(order)
  Pay->>Edge: POST action='create-payment'
  Edge->>DB: SELECT value FROM system_settings WHERE key='portal_fee_settings'
  Edge->>Edge: Check paymentEnabled===true, registrationOpen===true, category open
  Edge->>Edge: computeAuthoritativeOrderAmount() checks DB parentFee=500
  alt Client vs DB Fee Mismatch or Switch Closed
    Edge-->>Pay: HTTP 400 FEE_DECOMPOSITION_MISMATCH or HTTP 403 REGISTRATION_CLOSED
    Pay-->>RegUI: Show error; draft preserved in localStorage
  else Valid & Open
    Edge->>DB: service_role UPSERT pending_orders (expires_at = +2h)
    Edge->>GW: POST /v2/create-payment (with server-allowlisted callbackUrl)
    GW-->>Edge: Returns payment_url
    Edge-->>Pay: { success: true, paymentUrl }
    Pay-->>User: Redirect browser to PayStation checkout
  end
```

---

## Flow 3: Payment Return & IPN Promotion Lifecycle

```mermaid
sequenceDiagram
  autonumber
  participant User as "User Browser (?payment_return=1)"
  participant App as "App.tsx & PaymentModal"
  participant Edge as "Edge: verify-payment"
  participant GW as "PayStation Status API (v2/v1)"
  participant RPC as "rpc_verify_payment / rpc_handle_paystation_ipn"
  participant Promote as "rpc_promote_pending_order_to_registration"
  participant DB as "pending_orders / registrations_2027 / financial_ledger / current_student_ids"

  par Browser Return Redirect
    User->>App: Redirect from PayStation (type, invoice, trx_id)
    App->>App: Cancel/Fail param -> Payment Failed modal (draft preserved)
    App->>Edge: POST action='verify-payment' (trx_id, invoice_number)
  and Async Server Webhook
    GW->>Edge: POST PayStation IPN payload
  end
  Edge->>Edge: Require PAYSTATION_ALLOW_PAYMENT_FINALIZATION === 'true'
  Edge->>GW: Server-to-server verifyPayStationTransaction() (BDT + 'success')
  Edge->>RPC: service_role RPC (verify-payment or ipn)
  RPC->>Promote: Delegate if pending_orders matches invoice_number
  Promote->>RPC: Call rpc_compute_expected_order_amount()
  Promote->>DB: Anti-replay check -> INSERT registrations_2027 (status='paid')
  Promote->>DB: UPDATE pending_orders (status='paid', promoted_registration_id)
  Promote->>DB: INSERT financial_ledger (REGISTRATION_INFLOW)
  Promote->>DB: UPDATE current_student_ids SET verification_status='USED'
  Promote-->>Edge: { success: true, registration_id, qr_token }
  Edge-->>App: Display TicketView with QR code
```

---

## Flow 4: Public Donation & International Payment Flow

```mermaid
sequenceDiagram
  autonumber
  actor Donor as "Donor"
  participant DonUI as "DonationPage.tsx"
  participant IntlUI as "InternationalPaymentPage.tsx"
  participant Pay as "PayStationService"
  participant Edge as "Edge: verify-payment"
  participant DB as "system_settings / pending_orders / donations / donations_2027"

  alt International Wire Path
    Donor->>DonUI: Click International Payment CTA (if intlPaymentInfo.isEnabled)
    DonUI->>IntlUI: Navigate to InternationalPaymentPage (no donationOpen check!)
    IntlUI->>DB: Fetch system_settings.international_payment_info
  else Domestic PayStation Donation
    Donor->>DonUI: Select amount & donor details (client min >=10 vs server >=100)
    Donor->>DonUI: Submit Donation
    DonUI->>Pay: createPayment(opt_a='DONATION')
    Pay->>Edge: action='create-payment' (requires paymentEnabled===true & donationOpen===true)
    Edge->>DB: UPSERT pending_orders (order_type='donation') -> PayStation redirect
    Note over Edge,DB: On Gateway Return
    Donor->>DonUI: Return with ?pay_type=donation
    DonUI->>Edge: SupabaseService.saveDonation -> action='record-donation'
    Edge->>Edge: Server verifyPayStationTransaction (does NOT re-check donationOpen!)
    Edge->>DB: rpc_record_donation() -> UPSERT donations & donations_2027
  end
```

---

## Flow 5: Manual Venue Registration & Dual-Stage Approval Lifecycle

```mermaid
flowchart LR
  Desk["Venue Staff / Admin (ManualRegistrationTab)"] -->|"Ignores online registrationOpen switches"| CreateRPC["rpc_create_manual_registration"]
  CreateRPC -->|"Inserts staging record"| ManTable["public.manual_registrations (reg=pending, fin=pending)"]
  CreateRPC --> ManLog["public.manual_registration_audit_logs"]
  ManTable --> ApproveUI["Admin (ManualApprovalTab)"]
  ApproveUI -->|"Approve Registration"| AppRegRPC["rpc_approve_manual_registration"]
  ApproveUI -->|"Approve Payment Only"| AppFinRPC["rpc_approve_manual_financial"]
  AppRegRPC -->|"Promotes / Syncs"| MainReg["public.registrations_2027"]
  AppRegRPC -->|"Writes FTX-MAN-..."| FinTrx["public.financial_transactions (NOT financial_ledger!)"]
  AppRegRPC -.->|"BROKEN: non-existent columns"| SID["public.current_student_ids (silently skipped!)"]
  AppFinRPC --> MainReg
  AppFinRPC --> FinTrx
```

---

## Flow 6: Registration Closure State Propagation Across Views

```mermaid
flowchart TD
  Toggle["Global=OFF or Alumni=OFF or Current=OFF"] --> Helpers["rules.ts Governance Helpers"]
  Helpers -->|"Global=OFF"| NavHide["Header & Footer hide Register link; Home Hero hides Register CTA"]
  Helpers -->|"Global=OFF"| PageLock["HomePage Fees + RegistrationPage show Closed Advisory Banner & disable form"]
  Helpers -->|"Global=ON, One Category=OFF"| PartialLock["Category button shows Closed Lock; form auto-switches to open category"]
  Helpers -->|"Global=ON, Both Categories=OFF"| BothPause["RegistrationPage & HomePage show All Categories Paused; Header link stays visible!"]
  Helpers -->|"Manual Desk Unaffected"| DeskOpen["ManualRegistrationTab continues working normally"]
  Helpers -->|"Paid Tickets Unaffected"| TicketOpen["TicketLookupModal / verify-student-id / Scanners continue working normally"]
```

---

## Flow 7: Donation Closure & Ongoing Transaction Handling

```mermaid
flowchart TD
  DonOff["donationOpen = false"] --> UIEffects["UI Effects"]
  DonOff --> BackendEffects["Backend Effects"]

  UIEffects --> HideNav["Header, Footer, Home Hero & Transparency Dashboard hide Donate links/CTAs"]
  UIEffects --> PauseForm["DonationPage shows Paused Notice & disables PayStation submit button"]
  UIEffects --> Bypass1["GAP: DonationPage International Payment CTA still clickable"]
  UIEffects --> Bypass2["GAP: RegistrationPage optional donation field still active!"]

  BackendEffects --> BlockInit["executeInitiatePayment (order_type='donation') returns HTTP 403 DONATION_CLOSED"]
  BackendEffects --> AllowFinish["GAP: In-flight record-donation callback still completes if gateway paid"]
  BackendEffects --> HistSafe["FinancialTransparencyDashboard, Hall of Fame, & existing donations rows remain intact"]
```
