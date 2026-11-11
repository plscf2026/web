# User & System Flows Specification (Flow.md)
## Police Lines School & College Faridpur — Reunion 2026 Platform
### Architecture: Next.js 15 + Supabase + PayStation Merchant Gateway

---

## 1. Public Registration & Payment Checkout Flow

```mermaid
sequenceDiagram
  autonumber
  actor User as Attendee (Alumni/Student)
  participant Client as Next.js Web App (Browser)
  participant Storage as Supabase Storage ('student-photos')
  participant Server as Next.js API (/api/checkout)
  participant DB as Supabase PostgreSQL
  participant Gateway as PayStation Payment Gateway
  participant Mail as Transactional Email Service

  User->>Client: Visits /register & fills multi-step form
  User->>Client: Selects portrait photo
  Client->>Storage: Direct upload compressed photo (max 2MB)
  Storage-->>Client: Returns public/signed photo URL
  User->>Client: Clicks "PROCEED TO SECURE CHECKOUT"
  
  Client->>Server: POST /api/checkout/initiate (Payload + Photo URL)
  Note over Server: Server validates Bangladeshi mobile,<br/>recalculates fee, checks Student ID uniqueness
  Server->>DB: INSERT INTO registrations_2026 (status: 'pending')
  Server->>Gateway: POST /api/payment/create (orderId, amount, merchantCredentials)
  Gateway-->>Server: Returns { payment_url: "https://paystation.../pay" }
  Server-->>Client: Returns payment redirection URL
  Client->>Gateway: Browser redirects to PayStation Hosted Checkout
  
  User->>Gateway: Selects bKash / Nagad / Visa & enters PIN/OTP
  Gateway->>Server: POST /api/checkout/callback (Webhook with HMAC signature)
  Note over Server: Verifies HMAC-SHA256 signature,<br/>checks amount, confirms orderId
  Server->>DB: UPDATE registrations_2026 SET payment_status='paid', qr_token=gen_token()
  Server->>DB: INSERT INTO financial_ledger (transaction_type: 'REGISTRATION_INFLOW')
  Server-->>Gateway: HTTP 200 OK
  Server-)Mail: Dispatches Ticket Confirmation Email + PDF Pass
  
  Gateway-->>Client: Redirects user back to /ticket/{registrationId}
  Client->>DB: Fetches paid ticket & renders Brutalist Pass with QR Code
```

---

## 2. Public Digital Ticket Lookup Flow

```mermaid
flowchart TD
  Start([Attendee arrives at /ticket]) --> InputForm[Enters Registration ID or Mobile Number]
  InputForm --> Submit[Clicks 'FIND MY PASS']
  Submit --> RateLimitCheck{Rate Limit Check<br/>Max 20/IP/min<br/>Max 5/Subject/min}
  
  RateLimitCheck -- Exceeded --> ThrottleAlert[Display HTTP 429: 'Too Many Attempts. Please wait 60s']
  RateLimitCheck -- Allowed --> QueryDB[Execute RPC: Lookup Paid Registration]
  
  QueryDB --> Found{Record Found & Paid?}
  Found -- No / Unpaid --> NotFoundAlert[Display Alert: 'No verified paid ticket found. Please check credentials or complete payment.']
  Found -- Yes --> RenderTicket[Render Boarding Pass TicketView]
  
  RenderTicket --> Actions{User Action}
  Actions --> Print[Print A4 / Thermal Badge Pass]
  Actions --> SavePDF[Download Digital PDF Pass]
  Actions --> SaveWallet[Save to Smartphone Apple/Google Wallet]
```

---

## 3. On-Site Gate Check-In Flow

```mermaid
flowchart TD
  Arrival([Attendee arrives at Campus Entrance]) --> ScanAction[Gate Volunteer scans QR code with camera stream]
  ScanAction --> Decode[ZXing/HTML5-QRCode decodes qr_token]
  Decode --> APICall[POST /api/scanner/verify-gate]
  
  APICall --> DBCheck{Evaluate Ticket Status in PostgreSQL}
  DBCheck -- Invalid Token --> RedInvalid[RED SCREEN: 'INVALID / UNRECOGNIZED PASS' + Buzz Chime]
  DBCheck -- Unpaid --> RedUnpaid[RED SCREEN: 'UNPAID REGISTRATION' + Contact Finance Desk]
  DBCheck -- Already Checked In --> YellowDup[RED/YELLOW SCREEN: 'ALREADY CHECKED IN'<br/>Displays first scanned gate, staff ID, and time + Buzz Chime]
  
  DBCheck -- Valid & Not Scanned --> GreenSuccess[GREEN SCREEN: 'ENTRY APPROVED'<br/>Displays Photo, Name, Category, Batch + High Chime]
  GreenSuccess --> LogEvent[Atomic INSERT INTO gate_events<br/>UPDATE is_checked_in = TRUE]
  LogEvent --> RealtimePush[Supabase Realtime notifies all Gate Terminals in < 150ms]
```

---

## 4. Food & Meal Distribution Flow

```mermaid
flowchart TD
  MealQueue([Attendee queues at Meal Distribution Desk]) --> ScanMeal[Volunteer scans attendee QR pass]
  ScanMeal --> SelectMeal{Active Meal Selection}
  
  SelectMeal -- Breakfast --> TimeCheck{Current Dhaka Time <= 13:00?}
  TimeCheck -- No (Past 1:00 PM) --> CloseAlert[REJECT: 'Breakfast distribution ended at 13:00' + Audio Alert]
  TimeCheck -- Yes --> UniqueMealCheck
  
  SelectMeal -- Lunch / Dinner --> UniqueMealCheck{Check food_distributions table for (reg_id, meal_type)}
  
  UniqueMealCheck -- Record Exists --> DupMeal[RED ALERT: 'MEAL ALREADY COLLECTED'<br/>Collected at HH:MM by Staff X]
  UniqueMealCheck -- No Record --> ApproveMeal[GREEN SCREEN: 'MEAL APPROVED'<br/>Dispense Meal Box to Attendee]
  
  ApproveMeal --> PersistMeal[INSERT INTO food_distributions<br/>Status: 'COLLECTED']
```

---

## 5. Dress & Merchandise Distribution Flow

```mermaid
sequenceDiagram
  autonumber
  actor User as Attendee
  participant Staff as Dress Desk Volunteer (Mobile)
  participant API as Scanner API (/api/scanner/verify-dress)
  participant DB as Supabase PostgreSQL

  User->>Staff: Presents Digital Ticket QR
  Staff->>API: Scans QR code (itemType: 'T_SHIRT')
  API->>DB: Query registrations_2026 & dress_distributions
  alt Already Collected
    DB-->>API: Record exists in dress_distributions
    API-->>Staff: RED ALERT: "T-Shirt already dispensed at [Time]"
  else Not Yet Collected
    DB-->>API: Unclaimed (Registered Size: 'XL')
    API-->>Staff: GREEN SCREEN: "DISPENSE SIZE: XL" (Shows Attendee Name & Photo)
    Staff->>User: Hands over Size XL Polo T-Shirt & Souvenir Bag
    Staff->>API: Taps "CONFIRM HANDOVER"
    API->>DB: INSERT INTO dress_distributions (status: 'DELIVERED')
    API->>DB: UPDATE registrations_2026 SET is_tshirt_collected = TRUE
  end
```

---

## 6. Staff Expense Logging & Financial Reconciliation Flow

```mermaid
sequenceDiagram
  autonumber
  actor Staff as Field Volunteer / Logistics Lead
  participant App as Staff Finance Portal
  participant Storage as Supabase Storage ('payment-receipts')
  participant DB as Supabase PostgreSQL
  actor Admin as Finance Steering Committee Lead

  Staff->>App: Clicks "LOG EXPENSE"
  Staff->>App: Enters vendor name, category, BDT amount, description
  Staff->>App: Captures photo of paper cash memo / receipt
  App->>Storage: Direct upload to 'payment-receipts/vouchers/{uuid}.webp'
  Storage-->>App: Returns signed receipt URL
  App->>DB: INSERT INTO staff_expenses (status: 'pending')
  
  Admin->>App: Opens Admin Finance Review Queue
  Admin->>App: Inspects expense line item & receipt photo
  alt Approved
    Admin->>DB: UPDATE staff_expenses SET status = 'approved', approved_by = Admin.id
    DB->>DB: INSERT INTO financial_ledger (transaction_type: 'EXPENSE_OUTFLOW')
    DB-->>App: Re-evaluates get_staff_remaining_balance(staff_id)
  else Rejected
    Admin->>App: Enters Rejection Reason
    Admin->>DB: UPDATE staff_expenses SET status = 'rejected', rejection_reason = '...'
  end
```

