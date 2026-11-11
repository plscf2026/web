# REMAINING MANUAL PRODUCTION ACTIONS & SECRETS ROTATION GUIDE
## Police Lines School & College, Faridpur — Reunion Platform
**Auditor Instruction Checklist:** Critical one-time manual steps required by the site owner in the cloud dashboard  

---

## 1. MANDATORY PRODUCTION ACTIONS

### ⚠️ Action 1: Rotate PostgreSQL Database Password & Supabase Service Key
- **Why:** During initial setup, the database password (`Puja@337139`) and service role key (`sb_secret_...`) were stored in unencrypted `.env` files. Even though `.env` was never pushed to a public git repo, best practice requires rotating them before going live with 10,000+ attendees.
- **How to execute:**
  1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/hnthoszbkhvygoowtvau).
  2. Navigate to **Project Settings** → **Database** → **Database password** → Click **Reset database password**.
  3. Navigate to **Project Settings** → **API** → Click **Generate new service_role secret**.
  4. Update your local `.env.local` and your Supabase Edge Function Secrets with the new credentials.

### ⚠️ Action 2: Set Supabase Edge Function Secrets
- **Command to run in terminal:**
  ```bash
  supabase secrets set \
    PAYSTATION_MERCHANT_ID="104-1653730183" \
    PAYSTATION_PASSWORD="<YOUR_PRODUCTION_PAYSTATION_PASSWORD>" \
    PAYSTATION_ENV="production" \
    PAYMENT_SIGNING_SECRET="<GENERATE_RANDOM_32_CHAR_STRING>" \
    RATE_LIMIT_HMAC_SECRET="<GENERATE_RANDOM_32_CHAR_STRING>" \
    AUDIT_SIGNING_SECRET="<GENERATE_RANDOM_32_CHAR_STRING>" \
    APP_ALLOWED_ORIGINS="https://your-production-domain.com,https://reunion.plscf.edu.bd"
  ```

### ⚠️ Action 3: Apply Latest Database Migrations
- Run migration `20270104000000_fix_financial_ledger_constraint.sql` in the Supabase SQL Editor:
  1. Open **Supabase Dashboard** → **SQL Editor**.
  2. Copy and paste the contents of [`supabase/migrations/20270104000000_fix_financial_ledger_constraint.sql`](supabase/migrations/20270104000000_fix_financial_ledger_constraint.sql).
  3. Click **Run**.
  4. Confirm output: `Success. No rows returned.`

### ⚠️ Action 4: Deploy All 4 Edge Functions
- Deploy the updated functions from the terminal using Supabase CLI:
  ```bash
  supabase functions deploy verify-payment
  supabase functions deploy secure-ticket-lookup
  supabase functions deploy verify-student-id
  supabase functions deploy admin-audit
  ```

### ⚠️ Action 5: Verify Production Environment Flags on Vercel
- Under **Vercel Project Settings** → **Environment Variables**:
  - Ensure `VITE_ENABLE_TEST_BYPASS` is set to `false`.
  - Ensure `VITE_PAYSTATION_ENV` is set to `production`.

