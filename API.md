# API Specifications & Contracts (API.md)
## Police Lines School & College Faridpur — Reunion 2026 Platform
### Runtime: Next.js 15 Route Handlers (Edge & Node.js) + Supabase RPC
### Authentication: Supabase Auth JWT / Service-Role Webhook HMAC

---

## 1. Global API Standards & Conventions

- **Protocol**: HTTPS (TLS 1.3 enforced).
- **Format**: JSON (`Content-Type: application/json`).
- **Standard Error Response**:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human-readable explanation (bilingual aware)",
      "details": null
    }
  }
  ```
- **Standard Success Response**:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```

---

## 2. Public Endpoints

### 2.1. PayStation Gateway Direct APIs (Official Reference: https://paystation.com.bd/documentation)

#### A. Grant Token (`/grant-token`)
- **Endpoint**: `POST {BASE_URL}/grant-token` (Sandbox: `https://sandbox.paystation.com.bd`, Live: `https://api.paystation.com.bd`)
- **Headers**:
  ```http
  merchantId: 104-1653730183
  password: gamecoderstorepass
  Content-Type: application/json
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "status_code": "200",
    "status": "success",
    "message": "Token generated successfully.",
    "token": "sb_token_lGxWsAwfLa1oHuTAWQOhubunmZmmpVQltKJJoznC"
  }
  ```

#### B. Create Payment Session (`/create-payment`)
- **Endpoint**: `POST {BASE_URL}/create-payment`
- **Headers**:
  ```http
  token: <grant_token>
  merchantId: 104-1653730183
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "invoice_number": "PLSCF26-INV-89124",
    "currency": "BDT",
    "payment_amount": 1500,
    "reference": "ALUMNI",
    "cust_name": "Shahriar Ahmed",
    "cust_phone": "01712345678",
    "cust_email": "shahriar@example.com",
    "cust_address": "Faridpur Sadar, Faridpur",
    "callback_url": "https://plscf2026.edu.bd/api/checkout/callback"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "status_code": "200",
    "status": "success",
    "message": "Payment url generated.",
    "payment_url": "https://sandbox.paystation.com.bd/checkout/pay?token=...",
    "trx_id": "PST-SBX-882194",
    "invoice_number": "PLSCF26-INV-89124"
  }
  ```

#### C. Retrieve & Verify Transaction (`/retrive-transaction`)
- **Endpoint**: `POST {BASE_URL}/retrive-transaction`
- **Headers**:
  ```http
  merchantId: 104-1653730183
  password: gamecoderstorepass
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "invoice_number": "PLSCF26-INV-89124",
    "trx_id": "PST-SBX-882194"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "status_code": "200",
    "status": "success",
    "data": {
      "invoice_number": "PLSCF26-INV-89124",
      "trx_status": "Success",
      "trx_id": "PST-SBX-882194",
      "payment_amount": 1500,
      "payment_method": "bKash",
      "payer_mobile_no": "01712345678",
      "order_date_time": "2026-11-11 03:40:00"
    }
  }
  ```

---

### 2.2. Supabase Server-Side Payment Verification Edge Function (`verify-payment`)
- **Method & Route**: `POST /functions/v1/verify-payment`
- **Payload**:
  ```json
  {
    "registration_id": "PLSCF-2026-F8941",
    "invoice_number": "PLSCF26-INV-89124",
    "trx_id": "PST-SBX-882194",
    "payment_amount": 1500,
    "payment_method": "bkash"
  }
  ```
- **Fulfillment**:
  1. Queries PayStation gateway `/retrive-transaction` for confirmation.
  2. Executes PostgreSQL RPC `rpc_verify_payment` with service-role token.
  3. Writes double-entry credit to `financial_ledger`.
  4. Returns `{ success: true, verified: true, qr_token: "..." }`.

---

### 2.2. PayStation Webhook / IPN Callback
Webhook invoked exclusively by the PayStation payment gateway server upon successful or failed payment completion.

- **Method & Route**: `POST /api/checkout/callback`
- **Auth**: HMAC-SHA256 Signature Verification (`x-paystation-signature` header)
- **Request Body**:
  ```json
  {
    "merchant_id": "PLSCF_MERCHANT_2026",
    "order_id": "PLSCF26-ORD-98214",
    "trx_id": "TRX-BANK-8829104",
    "amount": "3000.00",
    "currency": "BDT",
    "status": "Successful",
    "payment_method": "bKash",
    "signature": "d41d8cd98f00b204e9800998ecf8427e..."
  }
  ```
- **Verification Routine**:
  $$\text{Expected Signature} = \text{HMAC\_SHA256}(\text{merchant\_id} + \text{order\_id} + \text{trx\_id} + \text{amount}, \text{GATEWAY\_SECRET})$$
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Payment verified and ticket provisioned",
    "registrationId": "REG-2026-0412",
    "qrToken": "a8f9c102e3b4d56789abcdef0123456789abcdef0123456789abcdef01234567"
  }
  ```

---

### 2.3. Secure Public Ticket Retrieval
Allows an attendee to retrieve their digital ticket pass using Registration ID or verified Mobile Number.

- **Method & Route**: `POST /api/tickets/lookup`
- **Auth**: Public (Enforced by Database Rate Limiting)
- **Request Body**:
  ```json
  {
    "registrationId": "REG-2026-0412",
    "mobileNumber": "01712345678",
    "year": 2026
  }
  ```
- **Rate Limit Constraints**:
  - Max 20 requests/minute per client IP.
  - Max 5 lookups/minute per targeted phone number or registration ID.
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "ticket": {
        "registrationId": "REG-2026-0412",
        "fullName": "Shahriar Ahmed",
        "fullNameBn": "শাহরিয়ার আহমেদ",
        "category": "ALUMNI",
        "batchName": "Golden Batch 2012",
        "tShirtSize": "XL",
        "photoUrl": "https://.../student-photos/.../uuid.webp",
        "paymentStatus": "paid",
        "qrToken": "a8f9c102e3b4d56789...",
        "gateAssigned": "Gate A (Main Campus Entrance)",
        "isCheckedIn": false,
        "isTshirtCollected": false
      }
    }
  }
  ```
- **Error Codes**:
  - `429 TOO_MANY_REQUESTS`: Rate limit exceeded.
  - `404 NOT_FOUND`: No matching paid registration found.

---

## 3. Operational Scanner Endpoints (Staff Protected)

Requires a valid Supabase Auth bearer session from an active staff account (`staff_accounts.status = 'active'`).

> [!NOTE]
> **Testing Environment Credentials**:
> - **Email / Identifier**: `admin@gmail.com`
> - **Password / Access PIN**: `admin@123`
> Automatically grants Super Admin access for evaluating Gate, Food, Dress, and Finance endpoints.

### 3.1. Gate Check-In Verification
- **Method & Route**: `POST /api/scanner/verify-gate`
- **Auth**: Staff Bearer Token (`role IN ('gate_staff', 'super_admin')`)
- **Request Body**:
  ```json
  {
    "qrToken": "a8f9c102e3b4d56789abcdef...",
    "gateId": "GATE-01-NORTH",
    "scannerId": "SCANNER-DEVICE-MOBILE-04"
  }
  ```
- **Response (`200 OK` - Success)**:
  ```json
  {
    "success": true,
    "status": "APPROVED",
    "attendee": {
      "registrationId": "REG-2026-0412",
      "fullName": "Shahriar Ahmed",
      "batchName": "Golden Batch 2012",
      "category": "ALUMNI",
      "photoUrl": "https://.../uuid.webp"
    },
    "scannedAt": "2026-12-25T08:15:30Z"
  }
  ```
- **Response (`409 Conflict` - Duplicate Scan Alert)**:
  ```json
  {
    "success": false,
    "status": "ALREADY_CHECKED_IN",
    "message": "Attendee was already checked in at 08:04 AM by Gate-02 Staff.",
    "firstScannedAt": "2026-12-25T08:04:12Z",
    "firstGateId": "GATE-02-SOUTH"
  }
  ```

---

### 3.2. Meal & Food Distribution Scan
- **Method & Route**: `POST /api/scanner/verify-food`
- **Auth**: Staff Bearer Token (`role IN ('food_staff', 'super_admin')`)
- **Request Body**:
  ```json
  {
    "qrToken": "a8f9c102e3b4d56789abcdef...",
    "mealType": "BREAKFAST"
  }
  ```
- **Enforced Business Checks**:
  1. If `mealType == 'BREAKFAST'` and Dhaka Time $> 13:00$, returns `403 FORBIDDEN` (`"Breakfast service closed"`).
  2. If a record already exists in `food_distributions` for `(registration_id, mealType)`, returns `409 CONFLICT` (`"Meal already collected"`).
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "status": "MEAL_DISPENSED",
    "mealType": "BREAKFAST",
    "attendeeName": "Shahriar Ahmed",
    "collectedAt": "2026-12-25T09:30:15Z"
  }
  ```

---

### 3.3. Dress & Merchandise Distribution Scan
- **Method & Route**: `POST /api/scanner/verify-dress`
- **Auth**: Staff Bearer Token (`role IN ('dress_staff', 'super_admin')`)
- **Request Body**:
  ```json
  {
    "qrToken": "a8f9c102e3b4d56789abcdef...",
    "itemType": "T_SHIRT"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "status": "DRESS_DISPENSED",
    "tShirtSize": "XL",
    "attendeeName": "Shahriar Ahmed",
    "dispensedAt": "2026-12-25T10:15:00Z"
  }
  ```

---

## 4. Finance & Budget Endpoints

### 4.1. Submit Volunteer Expense
- **Method & Route**: `POST /api/finance/expense/submit`
- **Auth**: Authenticated Staff Member
- **Request Body**:
  ```json
  {
    "amount": 2450.00,
    "category": "CATERING_WATER",
    "description": "Purchased 50 cases of mineral water for volunteer camp",
    "vendorName": "Faridpur Beverage Depot",
    "expenseDate": "2026-12-24",
    "receiptUrl": "https://.../payment-receipts/vouchers/rcpt-992.webp"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "expenseId": "EXP-2026-081",
    "status": "pending",
    "message": "Expense logged and awaiting finance approval"
  }
  ```

---

## 5. Supabase Stored Procedures (RPC Functions)

### 5.1. `rpc_verify_payment`
Atomic function executing payment verification inside PostgreSQL with `SECURITY DEFINER` (granted only to service-role):
```sql
SELECT rpc_verify_payment(
  p_registration_id := 'REG-2026-0412',
  p_transaction_id  := 'TRX-BANK-8829104',
  p_payment_method  := 'bKash',
  p_amount_paid     := 3000.00,
  p_server_sig      := 'd41d8cd98f00...',
  p_verified_by     := 'PAYSTATION_WEBHOOK'
);
```

### 5.2. `consume_ticket_lookup_rate_limit`
Atomic rate limit bucket consumer preventing concurrent brute-forcing of attendee mobile numbers:
```sql
SELECT private.consume_ticket_lookup_rate_limit(
  p_subject_hash   := 'sha256(ip + subject)',
  p_max_attempts   := 5,
  p_window_seconds := 60
);
-- Returns TRUE if within quota; FALSE if rate limit exceeded.
```

