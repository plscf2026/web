# DEPLOYMENT AND ENVIRONMENT CONFIGURATION GUIDE
## Police Lines School & College, Faridpur — Reunion Platform
**Frontend Host:** Vercel  
**Backend & Database:** Supabase Cloud (Project: `hnthoszbkhvygoowtvau`)  
**Gateway:** PayStation  

---

## 1. ENVIRONMENT VARIABLES MATRIX

### Frontend (Vercel Project Settings)
| Variable Name | Required | Example / Description |
|---|---|---|
| `VITE_SUPABASE_PROJECT_ID` | YES | `hnthoszbkhvygoowtvau` |
| `VITE_SUPABASE_URL` | YES | `https://hnthoszbkhvygoowtvau.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | YES | Publishable anon key (safe for browser) |
| `VITE_PAYSTATION_MERCHANT_ID`| YES | `104-1653730183` |
| `VITE_PAYSTATION_ENV` | YES | `production` (or `sandbox` for staging) |
| `VITE_ENABLE_TEST_BYPASS` | YES | **MUST BE `false` IN PRODUCTION** |

### Supabase Edge Function Secrets (`supabase secrets set`)
| Secret Name | Required | Description |
|---|---|---|
| `SUPABASE_URL` | YES | `https://hnthoszbkhvygoowtvau.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | YES | Supabase service_role secret key |
| `PAYSTATION_MERCHANT_ID` | YES | Merchant ID issued by PayStation |
| `PAYSTATION_PASSWORD` | YES | Merchant API Password issued by PayStation |
| `PAYSTATION_ENV` | YES | `production` |
| `PAYMENT_SIGNING_SECRET` | YES | High-entropy random salt for ticket signatures (min 32 chars) |
| `RATE_LIMIT_HMAC_SECRET` | YES | Secret key for IP rate limiter hashing (min 32 chars) |
| `AUDIT_SIGNING_SECRET` | YES | Secret key for audit checksum signing (min 32 chars) |
| `APP_ALLOWED_ORIGINS` | YES | Comma-separated allowed web origins (e.g. `https://plscf2026.reunion.org,https://reunion.plscf.edu.bd`) |

---

## 2. DATABASE MIGRATION DEPLOYMENT PROCEDURE

All database migrations are stored under `supabase/migrations/` in chronological order:
1. `20260101000000_critical_security_hardened_schema.sql`
2. `20260102000000_event_management_system_schema.sql`
3. `20261110000000_auth_and_rls_hardening.sql`
4. `20261111000000_ticket_lookup_rate_limit.sql`
5. `20261111020000_paystation_payment_gateway.sql`
6. `20270101000000_reunion_management_erp_schema.sql`
7. `20270102000000_registrations_2027_dynamic_schema.sql`
8. `20270103000000_student_id_card_management_schema.sql`
9. `20270104000000_fix_financial_ledger_constraint.sql` (Latest)

### Deploying via Supabase CLI:
```bash
# Link project
supabase link --project-ref hnthoszbkhvygoowtvau

# Push all unapplied migrations
supabase db push

# Deploy all Edge Functions
supabase functions deploy verify-payment
supabase functions deploy secure-ticket-lookup
supabase functions deploy verify-student-id
supabase functions deploy admin-audit
```

---

## 3. ROLLBACK INSTRUCTIONS

If rollback is required for migration `20270104000000`:
```sql
-- Rollback constraint
ALTER TABLE public.financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_transaction_type_check;
ALTER TABLE public.financial_ledger ADD CONSTRAINT financial_ledger_transaction_type_check
  CHECK (transaction_type IN ('ALLOCATION', 'EXPENSE', 'ADJUSTMENT', 'CASH_RETURN'));

-- Drop performance indexes
DROP INDEX IF EXISTS public.idx_reg_2027_batch_name;
DROP INDEX IF EXISTS public.idx_reg_2027_passing_year;
DROP INDEX IF EXISTS public.idx_reg_2027_registered_at_desc;
DROP INDEX IF EXISTS public.idx_student_id_cards_year_status;
DROP INDEX IF EXISTS public.idx_admin_audit_logs_admin_date;
DROP INDEX IF EXISTS public.idx_staff_expenses_staff_status;
```
