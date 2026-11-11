# PAYMENT INTEGRITY & FINANCIAL VERIFICATION REPORT
## Police Lines School & College, Faridpur — Reunion Platform
**Payment Gateway:** PayStation (Bangladesh)  
**Edge Verification Endpoint:** `supabase/functions/verify-payment`  
**Database Procedure:** `public.rpc_verify_payment`  
**Ledger Table:** `public.financial_ledger`  

---

## 1. END-TO-END PAYMENT LIFECYCLE VERIFICATION

```mermaid
sequenceDiagram
    participant Student as Student Browser
    participant Client as PaymentModal.tsx
    participant Edge as verify-payment (Edge)
    participant Gateway as PayStation API
    participant RPC as rpc_verify_payment (PostgreSQL)
    participant Ledger as financial_ledger
    participant Audit as admin_audit_logs

    Student->>Client: Submit Registration (BDT 1,500)
    Client->>Edge: POST {action:'create-payment', order}
    Edge->>Gateway: POST /grant-token (server-side password)
    Gateway-->>Edge: grant_token
    Edge->>Gateway: POST /create-payment
    Gateway-->>Edge: {payment_url, trx_id}
    Edge-->>Client: {paymentUrl, trxId}
    Client->>Student: Open Secure Gateway Iframe
    Student->>Gateway: Complete Payment (bKash/Nagad/Rocket/Card)
    Gateway-->>Client: Callback Response
    Client->>Edge: POST {action:'verify-payment', trx_id, amount}
    Edge->>Gateway: POST /retrive-transaction (Double-check status)
    Gateway-->>Edge: {trx_status: 'Success', payment_amount: 1500}
    Edge->>Edge: Compute Server HMAC-SHA256 Signature
    Edge->>RPC: CALL rpc_verify_payment(reg_id, trx_id, method, amount, sig)
    RPC->>RPC: Anti-Replay Duplicate Trx Check across all years
    RPC->>RPC: UPDATE registrations SET payment_status='paid'
    RPC->>Ledger: INSERT INTO financial_ledger (type: 'REGISTRATION_INFLOW')
    RPC->>Audit: INSERT INTO admin_audit_logs (tamper-evident checksum)
    RPC-->>Edge: {success: true, status: 'paid'}
    Edge-->>Client: Authoritative Verified Ticket
    Client->>Student: Render Digital Pass with Scannable QR
```

---

## 2. FINANCIAL INTEGRITY SAFEGUARDS

1. **Zero Client Trust:**
   - Payment status is NEVER accepted directly from the client.
   - The browser cannot mark a registration as `paid`.
   - The `verify-payment` Edge Function queries PayStation's `/retrive-transaction` API server-to-server.
2. **Double-Spend & Anti-Replay Protection:**
   - `rpc_verify_payment` executes an anti-replay query checking both `registrations_2027` and `registrations_2026` for duplicate `transaction_id`.
   - Attempting to reuse an existing transaction reference results in an immediate `DUPLICATE_TRANSACTION` abort.
3. **Atomic Ledger Insertion:**
   - Every verified registration creates exactly one double-entry inflow in `financial_ledger` with `transaction_type = 'REGISTRATION_INFLOW'`.
   - Migration `20270104000000_fix_financial_ledger_constraint.sql` ensures PostgreSQL check constraints permit this value without transaction aborts.
4. **Server Cryptographic Signing:**
   - Every verified ticket receives an authoritative `SIG_HMAC256_<HASH>` stamp generated with `PAYMENT_SIGNING_SECRET`.
   - Scanners and ticket lookups verify this signature before issuing admittance.
