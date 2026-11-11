# DATABASE ACCESS CONTROL MATRIX (RLS POLICIES)
## Police Lines School & College, Faridpur — Reunion Platform
**Security Standard:** Principle of Least Privilege & Zero Trust  
**RLS Status:** ENABLED ON ALL 25+ TABLES  

---

## 1. ACCESS CONTROL MATRIX BY ROLE

| Table Name | Anonymous Visitor | Authenticated Student | Event Staff | Super Admin |
| :--- | :--- | :--- | :--- | :--- |
| `registrations_2027` | **INSERT** (pending only, total_paid=0) | **NO SELECT** (direct) / **LOOKUP** via Edge Fn | **SELECT** (active staff) | **ALL** (SELECT, UPDATE, DELETE) |
| `registrations_2026` | **NO ACCESS** | **LOOKUP** via Edge Fn | **SELECT** (active staff) | **ALL** (SELECT, UPDATE, DELETE) |
| `admin_accounts` | **NO ACCESS** | **NO ACCESS** | **NO ACCESS** | **SELECT** (own auth_user_id) |
| `admin_audit_logs` | **INSERT** (system audit events) | **NO ACCESS** | **NO ACCESS** | **SELECT** (read-only audit trail) |
| `food_distributions` | **NO ACCESS** | **NO ACCESS** | **INSERT / SELECT** (Meal staff role only) | **ALL** |
| `gate_events` | **NO ACCESS** | **NO ACCESS** | **INSERT / SELECT** (GATE_STAFF role only) | **ALL** |
| `dress_distributions` | **NO ACCESS** | **NO ACCESS** | **INSERT / SELECT** (DRESS_STAFF role only) | **ALL** |
| `financial_ledger` | **NO ACCESS** | **NO ACCESS** | **SELECT** (FINANCE_STAFF role only) | **ALL** |
| `central_budget` | **NO ACCESS** | **NO ACCESS** | **NO ACCESS** | **ALL** |
| `staff_expenses` | **NO ACCESS** | **NO ACCESS** | **INSERT / SELECT** (FINANCE_STAFF) | **ALL** (Approve / Reject) |
| `student_id_cards` | **NO ACCESS** | **NO ACCESS** | **SELECT / UPDATE** (ID_CARD_STAFF) | **ALL** |
| `id_card_download_logs`| **INSERT** (append-only) | **NO ACCESS** | **NO ACCESS** | **SELECT** |
| `storage.objects (photos)` | **INSERT** (own upload only) | **NO LIST** | **SELECT** | **ALL** |
| `storage.objects (receipts)`| **INSERT** (jpg, png, pdf) | **NO LIST** | **SELECT** (Finance) | **ALL** |

---

## 2. ROW LEVEL SECURITY ENFORCEMENT RULES

1. **Deny Anonymous Directory Enumeration:** No anonymous or unauthenticated client can issue a `SELECT * FROM registrations_2027` query. Any attempt returns an empty set.
2. **Strict Verification Channeling:** Legitimate attendees access their ticket exclusively through the `secure-ticket-lookup` Edge Function, which enforces:
   - Registration ID validation
   - Exact mobile number matching
   - Cryptographic server signature
   - IP and subject rate-limiting
   - Selective field redaction (address, mobile, roll numbers removed from response)
3. **Immutable Audit Logs:** `admin_audit_logs` enforces:
   - `UPDATE` is strictly DENIED for all roles.
   - `DELETE` is strictly DENIED for all roles.
   - Every log row carries an HMAC-SHA256 checksum calculated server-side.
4. **Time-Locked Staff Operations:**
   - Breakfast collection is rejected at the database level after 13:00 (1:00 PM) Asia/Dhaka time.
