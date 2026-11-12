# WEBSITE DATA FLOW & SYSTEM INTERACTION DIAGRAMS

**System:** Police Lines School & College, Faridpur — Grand Reunion 2026 / 2027  
**Audit Document:** Data Movement & Interaction Flows  
**Auditor:** Senior Software Architect & Full-Stack Engineer  

---

## 1. Complete Website Architecture Diagram

The website operates as a high-performance Single Page Application (SPA) built with React 19 and Vite, deployed on Vercel CDN, backed by Supabase Cloud BaaS (PostgreSQL, PostgREST, Edge Functions) and PayStation Payment Gateway.

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Client Tier (Browser / Mobile PWA)"]
        UserBrowser["Attendee Mobile / Desktop"]
        AdminBrowser["Admin / Staff Dashboard"]
        ScannerPWA["Field Scanner / Turnstile Device"]
        LocalCache[("Client LocalStorage Cache\n(Offline Fallback)")]
        UserBrowser <--> LocalCache
        AdminBrowser <--> LocalCache
        ScannerPWA <--> LocalCache
    end

    subgraph EdgeCDN ["2. Edge & Hosting Tier (Vercel Global Edge)"]
        VercelCDN["Vercel CDN Edge Network\n(Static Assets, HTML, JS Bundles)"]
        ClientLayer -->|HTTPS GET Assets| VercelCDN
    end

    subgraph EdgeMicroservices ["3. Supabase Edge Functions (Deno Runtime)"]
        FnLookup["secure-ticket-lookup\n(Dual-factor, HMAC Rate Limit)"]
        FnVerifyPay["verify-payment\n(PayStation Callback, HMAC-SHA256)"]
        FnVerifyID["verify-student-id\n(Sanitized Public Badge)"]
        FnAudit["admin-audit\n(Tamper-Evident Hashing)"]
    end

    subgraph GatewayTier ["4. Payment Gateway Infrastructure"]
        PayStationAPI["PayStation Checkout & API\n(Bangladesh Bank Licensed)"]
        MFS["bKash / Nagad / Rocket / Visa / Mastercard"]
        PayStationAPI <--> MFS
    end

    subgraph DatabaseTier ["5. Supabase Database Tier (PostgreSQL 15)"]
        PostgREST["PostgREST API Engine\n(Row Level Security Enforcement)"]
        AuthService["Supabase Auth Service\n(GoTrue Identity)"]
        PgTables[("PostgreSQL Tables\n(registrations_2027, ledger, audit)")]
        PgRPC["Security Definer RPCs\n(rpc_verify_payment, rpc_approve_service)"]
        
        PostgREST --> PgTables
        PgRPC --> PgTables
        AuthService --> PgTables
    end

    %% Interactions
    UserBrowser -->|1. Submit Registration| PostgREST
    UserBrowser -->|2. Redirect to Checkout| PayStationAPI
    PayStationAPI -->|3. Webhook / Callback| FnVerifyPay
    FnVerifyPay -->|4. Execute Signature & Credit| PgRPC
    
    UserBrowser -->|Query Ticket| FnLookup
    FnLookup -->|Service Role Query| PgTables
    
    ScannerPWA -->|Scan QR Token| PgRPC
    AdminBrowser -->|Staff Authentication| AuthService
    AdminBrowser -->|Management Queries| PostgREST
    AdminBrowser -->|Audit Logging| FnAudit
```

---

## 2. User Registration & Enrollment Flow

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Student / Alumni
    participant UI as RegistrationPage.tsx
    participant Compressor as imageCompressor.ts
    participant Validator as rules.ts / fileValidation.ts
    participant LocalStore as AppStore (LocalStorage)
    participant PostgREST as Supabase registrations_2027
    participant PayModal as PaymentModal.tsx

    Attendee->>UI: Fills registration form & selects category
    Attendee->>UI: Uploads passport photo (File / Camera)
    UI->>Validator: Validates file type, magic bytes, dimensions
    UI->>Compressor: Compresses photo to target < 200 KB WebP/JPEG
    UI->>Validator: Validates 11-digit mobile, graduation year, sizes
    UI->>LocalStore: Caches form draft locally
    UI->>PostgREST: INSERT pending registration (total_paid=0, status='pending')
    Note over PostgREST: RLS Policy enforces status='pending'<br/>and blocks paid tampering.
    PostgREST-->>UI: Confirmed registration ID (e.g. PLSCF-2027-F1001)
    UI->>PayModal: Launches checkout modal with total payable amount
```

---

## 3. Payment Processing & Gateways Flow

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Attendee
    participant Modal as PaymentModal.tsx
    participant PayService as paystation.ts
    participant Gateway as PayStation Checkout
    participant EdgeFn as verify-payment Edge Function
    participant RPC as rpc_verify_payment (Postgres)
    participant Badge as StudentIdCardBadge.tsx

    Attendee->>Modal: Selects payment channel & clicks "Pay via PayStation"
    Modal->>PayService: createPayment({ invoice, amount, callbackUrl })
    PayService->>Gateway: POST /initiate-payment (Merchant Credentials)
    Gateway-->>PayService: Returns paymentURL & checkout session
    Modal->>Gateway: Redirects browser to hosted payment checkout
    Attendee->>Gateway: Authenticates bKash/Nagad OTP & PIN
    Gateway-->>Modal: Redirects to return URL with ?trx_id=...&status=success
    Modal->>EdgeFn: POST /verify-payment with transaction telemetry
    EdgeFn->>Gateway: Server-to-server transaction status inquiry
    Gateway-->>EdgeFn: Confirms transaction status = 'Successful'
    EdgeFn->>EdgeFn: Computes HMAC-SHA256 signature
    EdgeFn->>RPC: Executes rpc_verify_payment()
    Note over RPC: Checks duplicate transaction ID,<br/>sets payment_status='paid',<br/>credits financial_ledger,<br/>writes admin_audit_logs.
    RPC-->>Modal: Returns verified status = 'paid' & 6-char QR token
    Modal->>Badge: Displays official Student ID Card preview
    Modal->>Attendee: Provides "Download PDF" and "Download Photo" buttons
```

---

## 4. Admin Authentication & Role Verification Flow

```mermaid
flowchart TD
    StartAdmin([Admin opens /admin]) --> CheckSession{Check active session?}
    CheckSession -->|Session Found| VerifyRole{Check Role in DB}
    CheckSession -->|No Session| LoginForm[Display Login Dialog]

    LoginForm --> SubmitCredentials[Admin enters Username & Password]
    SubmitCredentials --> CheckBypass{Test Bypass Active?\nisDevTestBypassAllowed}
    
    CheckBypass -->|Yes: admin@123| LocalMockSession[Create Local Test Session\nsuper_admin: admin-master-001]
    LocalMockSession --> AdminDashboard[Access Admin Dashboard]

    CheckBypass -->|No / Production| SupabaseAuth[Supabase Auth signInWithPassword]
    SupabaseAuth -->|Invalid| AuthError[Display 'Invalid credentials']
    SupabaseAuth -->|Valid UID| QueryAdminProfile[SELECT role FROM public.admin_accounts\nWHERE auth_user_id = auth.uid]
    
    QueryAdminProfile -->|Not Found| AccessDenied[Deny Access: Not an Admin]
    QueryAdminProfile -->|Found| CheckRoleType{Admin Role?}
    
    CheckRoleType -->|super_admin| FullControl[Grant Full Management Portal]
    CheckRoleType -->|registration_mgr| RegModule[Grant Registration Desk Only]
    CheckRoleType -->|finance_mgr| FinModule[Grant Financial Accounts Only]
    CheckRoleType -->|scanner_staff| ScannerModule[Redirect to Station Scanner Portal]
```

---

## 5. Event Day Department Verification & Service Approval Flow

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Attendee
    actor Staff as Scanner Staff (e.g. Breakfast)
    participant Scanner as MultiStationDesk.tsx / ScannerPortal.tsx
    participant RPC as rpc_verify_and_approve_service (Postgres)
    participant DB as food_distributions / registrations_2027

    Attendee->>Staff: Presents Digital Ticket QR or ID Card
    Staff->>Scanner: Scans QR code or enters 6-character token (e.g. A7K9M2)
    Scanner->>RPC: Invokes rpc_verify_and_approve_service(token, 'BREAKFAST', staff_id)
    
    Note over RPC: Step 1: Verify Staff Status & Department Isolation.<br/>Rejects if Breakfast staff attempts Lunch or Dress.
    Note over RPC: Step 2: Resolve Student by Token across 2026/2027 tables.
    Note over RPC: Step 3: Verify Payment Status = 'paid'.
    Note over RPC: Step 4: Atomic Check for duplicate collection.
    
    alt Already Collected
        RPC-->>Scanner: Returns ALREADY_DISTRIBUTED (Time: 08:35 AM)
        Scanner->>Staff: Visual Red Alert & Audio Warning Chime
    else Valid First-Time Collection
        RPC->>DB: INSERT INTO food_distributions (COLLECTED, timestamp, staff_id)
        RPC-->>Scanner: Returns APPROVED with attendee name & batch
        Scanner->>Staff: Visual Green Confirmation & Audio Success Chime
    end
```

---

## 6. Student ID Card Generation & Bulk Download Flow

```mermaid
flowchart TD
    Trigger([Admin / Attendee requests ID Card]) --> Decision{Who is downloading?}
    
    Decision -->|Single Attendee: Web/Modal| SingleGen[Single Card Generator]
    Decision -->|Admin: Bulk Production| BatchGen[Batch ID Card Portal]

    subgraph SingleCardPipeline ["Single Card Pipeline (Client-Side High Fidelity)"]
        SingleGen --> Choice{Output Format?}
        Choice -->|PDF Document| CallJsPdf[jspdf drawIdCardOnPdf\n54 x 86 mm CR80 Dimensions]
        CallJsPdf --> DownloadPdf[Browser triggers Student_ID_XXXX.pdf]
        
        Choice -->|Photo Image| CallCanvas[HTML5 Canvas Render\n1080 x 1720 px at 300 DPI]
        CallCanvas --> DrawAssets[Draw Crest, Gold Lines, Photo,\nMiddle Data, QR Box, Campus Footer]
        DrawAssets --> CanvasBlob[canvas.toBlob 'image/png']
        CanvasBlob --> DownloadPng[Browser triggers Student_ID_XXXX.png]
    end

    subgraph BulkPackagingPipeline ["Bulk Batch Pipeline (Admin Portal)"]
        BatchGen --> SelectBatch[Select Batch Year e.g. SSC 1998]
        SelectBatch --> FormatChoice{Packaging Type?}
        
        FormatChoice -->|A4 Gang-Run Sheet| LayoutA4[generateBatchCombinedA4Pdf\n9 Cards per Page with Cutting Marks]
        LayoutA4 --> SaveA4Pdf[Batch_1998_Print_Sheets.pdf]
        
        FormatChoice -->|Hierarchical ZIP| ZipEngine[JSZip Multi-Directory Packaging]
        ZipEngine --> PackIndividual[Individual_Cards/Student_*.pdf]
        ZipEngine --> PackCombined[Combined_A4_Sheets/Batch_*.pdf]
        ZipEngine --> PackManifest[Manifest_Verification.json]
        PackIndividual & PackCombined & PackManifest --> SaveZip[Batch_1998_Complete.zip]
    end
```

---

## 7. Ticket Lookup & Identity Minimization Flow

```mermaid
sequenceDiagram
    autonumber
    actor PublicUser as Public Attendee
    participant LookupModal as TicketLookupModal.tsx
    participant EdgeFn as secure-ticket-lookup Edge Function
    participant RateLimitDB as private.ticket_lookup_rate_limits
    participant RegTable as public.registrations_2027

    PublicUser->>LookupModal: Inputs Registration ID & 11-digit Mobile Number
    LookupModal->>EdgeFn: POST /secure-ticket-lookup
    EdgeFn->>EdgeFn: Computes client IP HMAC & subject HMAC
    EdgeFn->>RateLimitDB: Verifies rate limit (< 5 attempts per 15 minutes)
    alt Rate Limit Exceeded
        EdgeFn-->>LookupModal: 429 Too Many Requests (Blocked)
    else Under Rate Limit
        EdgeFn->>RegTable: Query WHERE id = :id AND mobile_number = :mobile
        alt Match Found
            RegTable-->>EdgeFn: Raw Student Record
            EdgeFn->>EdgeFn: Redacts internal metadata (retains only verified ticket info)
            EdgeFn-->>LookupModal: Returns sanitized digital ticket record
            LookupModal->>PublicUser: Opens TicketView.tsx
        else No Match
            EdgeFn-->>LookupModal: 404 No registration matched ID & Mobile pair
        end
    end
```

