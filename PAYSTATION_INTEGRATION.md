# PayStation Payment Gateway Integration Specification
**Police Lines High School & College, Faridpur — Grand Reunion 2027**  
**Document Version:** 2.0.0 (Production & Sandbox Verified)  
**Last Updated:** November 2026  

---

## 1. Executive Summary & Architecture Overview

This document specifies the end-to-end integration of the **PayStation Payment Gateway** with the **Reunion Management System (RMS)** of Police Lines High School & College, Faridpur.

PayStation acts as the authoritative payment processor for alumni and student reunion registrations, donations, and merchandise fees. The integration implements a **dual-track verification model**:

```
                         ┌────────────────────────────────────────────────────────┐
                         │                 Customer Web Browser                   │
                         └───────┬────────────────────────────────────────▲───────┘
                                 │ 1. Initiates Checkout                  │ 4. Browser Redirect
                                 ▼                                        │ (callback_url)
 ┌────────────────────────────────────────────────────────┐               │
 │            Plscf2027 Web Platform & API Proxy          ├───────────────┤
 └───────┬────────────────────────────────────────▲───────┘               │
         │ 2. POST /initiate-payment              │ 3. payment_url        │
         ▼                                        │                       │
 ┌────────────────────────────────────────────────┴───────────────────────┴───────┐
 │               PayStation Hosted Checkout Gateway                               │
 │   • bKash, Nagad, Rocket, Upay, Visa, Mastercard, AMEX, Internet Banking       │
 └───────┬────────────────────────────────────────────────────────────────────────┘
         │
         │ 5. Server-to-Server IPN (Instant Payment Notification)
         │    POST https://<domain>/api/payment/ipn or Edge Function
         ▼
 ┌────────────────────────────────────────────────────────────────────────────────┐
 │        Supabase PostgreSQL & Edge Function (Authoritative Finalization)         │
 │   • rpc_handle_paystation_ipn (SECURITY DEFINER)                                │
 │   • Update registrations_2027 status to 'paid'                                 │
 │   • Generate cryptographic HMAC signature                                      │
 │   • Double-entry credit to financial_ledger                                    │
 │   • Audit log to admin_audit_logs & ipn_logs                                   │
 └────────────────────────────────────────────────────────────────────────────────┘
```

### Dual-Track Verification:
1. **Track A (Synchronous Browser Redirect)**: Upon completing checkout, the customer's browser is redirected to the platform's `callback_url`. The frontend inspects the returned parameters and calls `/transaction-status` (v1 or v2) to verify payment completion and display the live Ticket Pass.
2. **Track B (Asynchronous Server-to-Server IPN)**: Concurrently, PayStation issues a direct HTTP `POST` webhook to our IPN endpoint. This guarantees payment capture even if the user closes their browser or loses connectivity immediately after entering their OTP/PIN.

---

## 2. Environment Configuration & Credentials

Separate environments are maintained for sandbox simulation and live payment routing. **Store passwords and secret keys must NEVER be exposed in client bundles or public repositories.**

| Environment | Base URL | Purpose |
| :--- | :--- | :--- |
| **Sandbox (Test)** | `https://sandbox.paystation.com.bd` | Building, verifying, mock payment simulations, IPN testing. |
| **Production (Live)** | `https://api.paystation.com.bd` | Routing live customer cards and clearing real funds. |

### 2.1 Sandbox Test Credentials
- **Merchant ID:** `104-1653730183`
- **Password:** `gamecoderstorepass`
- **Base URL:** `https://sandbox.paystation.com.bd`

### 2.2 Sandbox Test Wallets
In the PayStation sandbox environment, personal mobile numbers return `"The input wallet is not eligible"`. Testers must use the official test numbers:

| Provider | Test Mobile Numbers | Test OTP | Test PIN | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **bKash** | `01770618575`<br>`01770618576`<br>`01929918378`<br>`01877722345`<br>`01619777282` | `123456` | `12121` | Simulates instant bKash checkout. |
| **Nagad** | `01619777282`<br>`01619777283` | `123456` | `12121` | Simulates Nagad MFS payment. |
| **Rocket / Upay** | `01770618575` | `123456` | `12121` | Simulates DBBL Rocket & Upay. |

---

## 3. Complete API Specifications

### 3.1 Initiate Payment API (Hosted Checkout)
Creates a hosted checkout session and returns a secure `payment_url` for customer redirection.

- **Method:** `POST`
- **Endpoint:** `https://api.paystation.com.bd/initiate-payment` (Production)  
  `https://sandbox.paystation.com.bd/initiate-payment` (Sandbox)
- **Content-Type:** `multipart/form-data` or `application/x-www-form-urlencoded`

#### Request Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `merchantId` | string | **Yes** | Your assigned PayStation Merchant ID | `104-1653730183` |
| `password` | string | **Yes** | Your assigned PayStation Store Password | `gamecoderstorepass` |
| `invoice_number` | string | **Yes** | Unique invoice number generated by system | `INV-2027-10492` |
| `currency` | string | Optional | Currency code (defaults to BDT) | `BDT` |
| `payment_amount` | integer/numeric | **Yes** | Total payable amount in BDT | `1500` |
| `pay_with_charge` | integer | Optional | `1` = customer pays gateway charge; `0` = merchant pays (default: `0`) | `0` |
| `reference` | string | Optional | Internal reference (e.g. Student ID or Batch) | `PLSCF-2027-F1042` |
| `cust_name` | string | **Yes** | Customer full name | `Shakil Ahmed` |
| `cust_phone` | string | **Yes** | 11-digit Bangladeshi mobile number | `01712345678` |
| `cust_email` | string | **Yes** | Customer email address | `student@plscf.org` |
| `cust_address` | string | Optional | Customer physical address | `Faridpur Sadar` |
| `callback_url` | string | **Yes** | Redirect URL after customer completes payment | `https://plscf.org/?payment_return=1` |
| `checkout_items` | string/JSON | Optional | Item description or JSON line-items | `Alumni Reunion 2027 Registration` |
| `opt_a` | string | Optional | Custom payload metadata | `Batch 2012` |
| `opt_b` | string | Optional | Custom payload metadata | `T-Shirt Size XL` |
| `opt_c` | string | Optional | Custom payload metadata | `Donation: 500` |
| `emi` | integer | Optional | Set to `1` for EMI transactions | `0` |

#### Success Response (HTTP 200)
```json
{
  "status_code": "200",
  "status": "success",
  "message": "Payment Link Created Successfully.",
  "payment_amount": "1500",
  "invoice_number": "INV-2027-10492",
  "payment_url": "https://sandbox.paystation.com.bd/checkout/12117397758013220/ZzHkhjalJ1ulsjuJOdx1mCSN1nj5AGPAvr1BlBjpccTFlC02hX"
}
```

#### Duplicate Invoice Response (HTTP 200 / Error)
```json
{
  "status_code": "1008",
  "status": "failed",
  "message": "Duplicate invoice number."
}
```

---

### 3.2 Transaction Status v1 (Query by `invoice_number`)
Query payment status server-to-server using the unique invoice number generated during payment initiation.

- **Method:** `POST`
- **Endpoint:** `https://api.paystation.com.bd/transaction-status` (Production)  
  `https://sandbox.paystation.com.bd/transaction-status` (Sandbox)
- **Headers:** `merchantId: 104-1653730183`, `Content-Type: application/x-www-form-urlencoded`
- **Body:** `invoice_number=INV-2027-10492`

#### Success Response
```json
{
  "status_code": "200",
  "status": "success",
  "message": "Transaction found.",
  "data": {
    "invoice_number": "INV-2027-10492",
    "trx_status": "Success",
    "trx_id": "PST89201948",
    "payment_amount": "1500.00",
    "order_date_time": "2026-11-13 05:30:15",
    "payer_mobile_no": "01770618575",
    "payment_method": "bkash",
    "reference": "PLSCF-2027-F1042",
    "checkout_items": "Alumni Reunion 2027 Registration"
  }
}
```

---

### 3.3 Transaction Status v2 (Query by `trxId`)
Query payment status server-to-server using the unique `trxId` returned by PayStation after checkout.

- **Method:** `POST`
- **Endpoint:** `https://api.paystation.com.bd/v2/transaction-status` (Production)  
  `https://sandbox.paystation.com.bd/v2/transaction-status` (Sandbox)
- **Headers:** `merchantId: 104-1653730183`, `Content-Type: application/json`
- **Body:** `{"trxId": "CG20D8AYB4"}`

#### Success Response
```json
{
  "status_code": "200",
  "status": "success",
  "message": "Transaction found",
  "data": {
    "invoice_number": "INV-2027-10492",
    "trx_status": "success",
    "trx_id": "CG20D8AYB4",
    "trx_amount": 1500,
    "trx_date": "2026-11-13",
    "request_amount": "1500.00",
    "payment_amount": "1500.00",
    "order_date_time": "2026-11-13 05:30:15",
    "payer_mobile_no": "01770618575",
    "payment_method": "bKash",
    "reference": "PLSCF-2027-F1042"
  }
}
```

---

### 3.4 Merchant Instant Payment Notification (IPN) Webhook API
After every successful transaction, PayStation sends a server-to-server POST request with a flat JSON body directly to our IPN endpoint.

- **Trigger:** Fired automatically after transaction completes with `trx_status = "Success"`.
- **Method:** `POST`
- **URL:** Configured in PayStation Merchant Dashboard (e.g. `https://plscf.org/api/payment/ipn` or `https://<supabase-id>.supabase.co/functions/v1/verify-payment`)
- **Content-Type:** `application/json`
- **Authentication:** Server-to-server webhook

#### IPN Request Payload Schema
```json
{
  "invoice_number": "INV-2027-10492",
  "trx_status": "Success",
  "trx_id": "PST89201948",
  "trx_amount": 1500,
  "order_date_time": "2026-11-13 05:30:15",
  "payment_method": "bKash",
  "reference": "PLSCF-2027-F1042"
}
```

#### IPN Field Definitions
| Field | Type | Description |
| :--- | :--- | :--- |
| `invoice_number` | string | Unique order/invoice reference generated when initiated. Used to resolve student record. |
| `trx_status` | string | Transaction status. Always `"Success"` for delivered IPNs. |
| `trx_id` | string | Gateway transaction ID. Recorded for disputes, reconciliation, and anti-replay. |
| `trx_amount` | number | Paid transaction amount in BDT (numeric). Must match order amount. |
| `order_date_time` | string | Gateway timestamp formatted as `YYYY-MM-DD HH:mm:ss`. |
| `payment_method` | string | Gateway payment channel (e.g. `bKash`, `Nagad`, `Rocket`, `Visa`, `Mastercard`). |
| `reference` | string | Optional reference information supplied during initiation. |

#### Mandatory Response (Acknowledge Immediately)
Your endpoint must respond with HTTP `200 OK` fast. If any response other than `2xx` is returned, or if the server times out, PayStation retries the webhook with exponential backoff.

```json
{
  "status": "success"
}
```

---

## 4. Security & Idempotency Rules

### 4.1 Five-Point IPN Verification Checklist
1. **Invoice Existence:** Confirm that `invoice_number` exists in `registrations_2027` (via column `gateway_invoice_number`). Reject unknown invoices.
2. **Transaction Status Check:** Confirm that `trx_status` is `"Success"` (case-insensitive check: `success`, `Success`, `successful`).
3. **Amount Match:** Verify that `trx_amount` numerically matches `registration_fee + donation_amount`. Reject underpaid transactions.
4. **Idempotency Guard:** If the registration is already marked `payment_status = 'paid'` and `transaction_id = trx_id`, return HTTP `200 { "status": "success" }` immediately without double-crediting.
5. **Anti-Replay Protection:** Verify that `trx_id` has never been utilized on another attendee record. Reject reused transaction IDs.

### 4.2 Cryptographic Verification Signature
When a payment is finalized, the system computes an authoritative HMAC-SHA256 signature:
$$\text{Signature} = \text{HMAC-SHA256}(\text{Key}, \text{"PLSCF:"} + \text{RegistrationID} + \text{":"} + \text{TrxID} + \text{":"} + \text{Amount})$$
The prefix `SIG_V2_...` or `SIG_HMAC256_...` is stored alongside the record to provide tamper evidence against direct database tampering.

---

## 5. Database Schema & RPC Integration

### 5.1 `registrations_2027` Mapping
The PostgreSQL table `registrations_2027` stores PayStation payment metadata:
- `gateway_invoice_number TEXT`: The unique PayStation invoice number.
- `gateway_provider TEXT DEFAULT 'PAYSTATION'`: Payment provider identifier.
- `gateway_response JSONB`: Complete gateway audit payload.
- `payment_status TEXT CHECK (payment_status IN ('paid', 'pending', 'failed', 'refunded'))`.
- `transaction_id TEXT`: PayStation gateway transaction ID.
- `payment_method TEXT`: Normalized payment method (`bkash`, `nagad`, `rocket`, `card`).
- `total_paid NUMERIC`: Authoritative paid amount.
- `server_verification_signature TEXT`: Cryptographic proof of server confirmation.

### 5.2 Dedicated IPN Audit Log Table (`ipn_logs`)
Maintains an immutable historical record of every IPN request received for auditing, financial reconciliation, and dispute resolution:

```sql
CREATE TABLE IF NOT EXISTS public.ipn_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  trx_id TEXT,
  trx_status TEXT NOT NULL,
  trx_amount NUMERIC NOT NULL,
  payment_method TEXT,
  order_date_time TEXT,
  reference TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ipn_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  http_status INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ipn_logs_invoice ON public.ipn_logs (invoice_number);
CREATE INDEX IF NOT EXISTS idx_ipn_logs_trx ON public.ipn_logs (trx_id);
```

### 5.3 Authoritative IPN RPC (`rpc_handle_paystation_ipn`)
Executed with `SECURITY DEFINER` privileges. Atomically updates the registration, creates double-entry financial ledger entries, and writes to audit logs.

---

## 6. Implementation Files Checklist

| File Path | Description | Status |
| :--- | :--- | :--- |
| `PAYSTATION_INTEGRATION.md` | Comprehensive integration reference & documentation | **Active** |
| `src/services/paystation.ts` | Frontend PayStation client, session management & helpers | **Active** |
| `src/services/supabase.ts` | Database bridge & pending registration synchronization | **Active** |
| `src/types/index.ts` | TypeScript definitions including `gatewayInvoiceNumber` | **Active** |
| `supabase/functions/verify-payment/index.ts` | Edge Function supporting `initiate-payment`, `transaction-status`, and `ipn` | **Active** |
| `supabase/migrations/20270108000000_paystation_integration_and_ipn_handler.sql` | SQL migration for `ipn_logs` and `rpc_handle_paystation_ipn` | **Active** |
| `src/utils/paystation.test.ts` | Automated unit tests covering all PayStation operations & IPN | **Active** |

---

## 7. Operational Troubleshooting & Error Codes

| Status Code | Meaning | Action / Resolution |
| :--- | :--- | :--- |
| `200` | Success | Request authenticated and executed cleanly. |
| `1008` | Duplicate Invoice | Invoice number already exists. System automatically generates a fresh timestamped invoice on retry. |
| `2001` | Invalid Token / Not Found | Transaction cannot be found or merchant password mismatch. Verify environment credentials. |
| `422` | IPN Validation Failed | Amount mismatch or invalid status in IPN. Logged in `ipn_logs` for review. |

