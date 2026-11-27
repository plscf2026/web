# PLSCF 2027 Reunion Portal — Complete Step-by-Step Go-Live Guide

**Project ID:** `hnthoszbkhvygoowtvau`  
**Live Website Domain:** `https://plscf65.vercel.app` (replace with your custom domain if you attached one)  
**Backend URL:** `https://hnthoszbkhvygoowtvau.supabase.co`

---

## Quick One-Page Checklist (Follow In Exact Order)

Print or keep this top list open and check off each box only after completing that part:

- [ ] **Part 1:** Check / create a Database Backup in Supabase before touching anything.
- [ ] **Part 2:** Run the Read-Only Check SQL (`supabase/verification/readonly_checks.sql`) and note the results.
- [ ] **Part 3:** Run SQL Migration 1 (`supabase/migrations/20270322000000_security_rpc_and_rls_hardening.sql`) in Supabase.
- [ ] **Part 4:** Run SQL Migration 2 (`supabase/migrations/20270322010000_donation_ipn_promotion_and_logs.sql`) in Supabase and re-check with the Read-Only SQL.
- [ ] **Part 5:** Set Edge Function Secrets and deploy all 4 Supabase Edge Functions (`verify-payment`, `verify-student-id`, `secure-ticket-lookup`, `admin-audit`).
- [ ] **Part 6:** Check and update Frontend Environment Variables in Vercel.
- [ ] **Part 7:** Commit/push any remaining local edits (including the Tailwind CSS fix) and deploy Frontend on Vercel.
- [ ] **Part 8:** Set the Merchant IPN URL inside the PayStation Dashboard.
- [ ] **Part 9:** Update Supabase Authentication Settings (Password length + Custom SMTP email).
- [ ] **Part 10:** Verify your real Super Admin login works first, then safely remove old demo accounts.
- [ ] **Part 11:** Update International Bank Details, check Fee Settings in Super Admin, and run `npm audit` online.
- [ ] **Part 12:** Run the Live Site Test Checklist (public pages, registration with & without parent pass, small donation, ticket lookup, admin login, scanner login).

---

## Important Note: What I Could Not Check Directly

Because this workspace runs offline and does not connect to your private cloud dashboards, **I could not inspect or verify your live accounts**. Please check these yourself during the steps below:
- Whether Supabase Daily Backups are turned on in your billing plan (**Part 1**)
- Live values inside your production `system_settings` and `pending_orders` tables (**Part 2**)
- What secrets are currently saved inside Supabase Edge Function Secrets (**Part 5**)
- Live environment variables inside your Vercel project (**Part 6**)
- The IPN URL saved inside your PayStation Merchant Panel (**Part 8**)
- Live email (SMTP) and password length settings inside Supabase Auth (**Part 9**)
- Which `@gmail.com` demo admin/staff accounts still exist in your live database (**Part 10**)
- Live online `npm audit` vulnerability scan (**Part 11**) and live end-to-end payment flow (**Part 12**)

---

## Part 1: Make a Safety Backup in Supabase First

Before changing anything in your database, make sure you have a safe copy to fall back on.

1. Open your browser and go to **https://supabase.com/dashboard**.
2. Sign in and click your **PLSCF 2027** project (`hnthoszbkhvygoowtvau`).
3. On the left sidebar, click **Database**.
4. Under Database in the left menu, click **Backups**.
5. Look at the **Scheduled backups** list:
   - **If you are on a paid Pro plan:** Confirm today's or a recent automatic backup is listed. If your plan has **Point-in-Time Recovery (PITR)**, note the exact current clock time (`HH:MM`).
   - **If you are on the Free plan (no automatic backups shown):** Click **Table Editor** on the left sidebar and export your most important tables (`registrations_2027`, `donations`, `donations_2027`, `pending_orders`, `system_settings`, `admin_accounts`, `staff_accounts`) as CSV (`Export -> Download CSV`) into a safe folder on your computer, or run `pg_dump` if you have your database password.
6. **Do not continue to Part 3 until you know you have a backup or CSV export.**

---

## Part 2: Run the Read-Only Database Health Check

- **File name and path:** `supabase/verification/readonly_checks.sql`
- **What it does:** Reads and displays your current live settings, any unrecorded paid donations, security permissions, and old demo email accounts without changing anything.
- **Safe to run on live data?** **Yes, 100% safe.** It only contains `SELECT` (read-only) commands and changes zero data or tables.
- **Rollback file:** None needed (it makes zero changes).

### Steps:
1. On your computer, open the file `supabase/verification/readonly_checks.sql` in your editor, select all (`Cmd + A`), and copy (`Cmd + C`).
2. Go to **https://supabase.com/dashboard** -> your project -> left sidebar -> click **SQL Editor**.
3. Click **+ New query** (top left or top right button).
4. Paste the copied SQL (`Cmd + V`) into the blank editor box.
5. Click the green **Run** button (bottom right).
6. If Supabase asks `"Are you sure?"` or shows multiple result tabs, look through each numbered query result carefully:

### What to Look For in the Results (9 Checks):
1. **Query 1 (`system_settings`):** Check `payment_enabled`, `registration_open`, `donation_open`, `former_student_fee`, `current_student_fee`, `parent_fee` (should match your intended amount, e.g. `500`), `min_donation` (`100`), `max_donation` (`50000`). If any setting looks wrong, note it to fix in Super Admin later.
2. **Query 2 (Unrecorded Paid Donations):** **Must ideally show `0 rows`.** If any rows appear here, those donors already paid via PayStation earlier and closed their browser before our fix. Save those invoice numbers so you can manually record or inspect them.
3. **Query 3 (`pg_proc` Security Functions):** *Before* running Part 3, many admin/staff functions will show `anon_can_execute = true`. Remember this list—you will re-run this file in Part 4 to verify those become `false`.
4. **Query 4 (Table RLS Status):** Look for any row with `rls_enabled = false`. Note especially backup tables (`backup_registrations_...`) which may currently say `false`.
5. **Query 5 (`USING (true)` Open Policies):** Shows any tables still open to everyone. After Part 3, open admin/finance/staff policies will disappear from this list.
6. **Query 6 (`anon_privileges`):** Shows which tables anonymous visitors can currently touch.
7. **Query 7 (`auth.users` Triggers):** Confirms Super Admin lock triggers are enabled (`tgenabled = O` means active).
8. **Query 8 (Demo Email Accounts):** Shows if old `@gmail.com` demo accounts (`admin@gmail.com`, `venue.admin@gmail.com`, `moderator@gmail.com`, `finance@gmail.com`, `registration@gmail.com`) are still in `admin_accounts`, `staff_accounts`, or `auth.users`. Save this list for **Part 10**.
9. **Query 9 (Storage Buckets):** Confirms `student-photos` and `committee-photos` buckets exist cleanly.

- **If there is an error running this check:** Do not panic—no data was touched. Copy the red error message and stop before running Part 3.

---

## Part 3: Run SQL Migration 1 (Lock Down Admin & Staff Security)

- **File name and path:** `supabase/migrations/20270322000000_security_rpc_and_rls_hardening.sql`
- **What it does:** Locks down all admin, finance, staff scanner, and backup tables/functions so anonymous visitors cannot read or edit private data, while keeping public registration, ticket verification, stats, gallery, and contact forms working.
- **Safe to run on live data?** **Yes.** Wrapped in `BEGIN; ... COMMIT;`. Deletes zero rows, drops zero tables, and keeps all public pages working.
- **Rollback file that undoes it:** `supabase/rollback/20270322000000_rollback.sql`

### Steps:
1. Open `supabase/migrations/20270322000000_security_rpc_and_rls_hardening.sql` on your computer, select all (`Cmd + A`), and copy (`Cmd + C`).
2. In **Supabase Dashboard -> SQL Editor**, click **+ New query**.
3. Paste the entire file (`Cmd + V`) into the query editor.
4. Click **Run**.
5. **What message means success:** `Success. No rows returned`.
6. **If there is an error:** Because the file uses `BEGIN; ... COMMIT;`, Supabase automatically cancels the partial run so nothing is half-changed. Copy the exact error message, do **not** run Part 4, and check if an older migration failed earlier in your project.

---

## Part 4: Run SQL Migration 2 (Fix Closed-Browser Donations & IPN Logs)

- **File name and path:** `supabase/migrations/20270322010000_donation_ipn_promotion_and_logs.sql`
- **What it does:** Fixes PayStation payment confirmation so standalone donations save automatically even if the donor closes their browser, and restores webhook audit logging in `ipn_logs`.
- **Safe to run on live data?** **Yes.** Wrapped in `BEGIN; ... COMMIT;`. Only updates two database functions without touching existing rows.
- **Rollback file that undoes it:** `supabase/rollback/20270322010000_rollback.sql`

### Steps:
1. Open `supabase/migrations/20270322010000_donation_ipn_promotion_and_logs.sql` on your computer, select all (`Cmd + A`), and copy (`Cmd + C`).
2. In **Supabase Dashboard -> SQL Editor**, click **+ New query**.
3. Paste the entire file (`Cmd + V`) and click **Run**.
4. **What message means success:** `Success. No rows returned`.
5. **Re-Verify with Read-Only Checks:**
   - Open `supabase/verification/readonly_checks.sql` again, paste into a **New query**, and click **Run**.
   - Confirm:
     - **Query 3:** Admin/staff functions (`rpc_admin_get_registrations`, `rpc_delete_registration`, `rpc_fetch_unified_audit_trail`, `rpc_create_manual_registration`, `rpc_confirm_gate_event`, `rpc_toggle_food_distribution`, `rpc_toggle_tshirt_distribution`, `rpc_generate_guest_card_batch`, `rpc_generate_staff_card_batch`, `rpc_collect_staff_food`, etc.) now show **`anon_can_execute = false`**.
     - **Query 3:** Public functions (`rpc_get_public_governance_settings`, `rpc_get_public_reunion_stats`, `rpc_lookup_ticket`, `rpc_lookup_donation`, `rpc_verify_student_qr`, `rpc_verify_student_id`, `rpc_reserve_student_id`, `rpc_release_student_id_reservation`, `rpc_get_financial_transparency_summary`, `rpc_verify_personal_donation_history`, `rpc_resolve_login_email`, `current_admin_role`, `current_event_staff_role`) still show **`anon_can_execute = true`**.
     - **Query 4:** All public tables (including any backup tables) show **`rls_enabled = true`**.
     - **Query 5:** Only intentional public read tables (`gallery_media` SELECT, `about_contact_content` SELECT, `expense_categories` SELECT, `current_student_ids` SELECT) and `service_role` internal policies appear.
6. **If there is an error in Part 4:** Because it runs inside `BEGIN; ... COMMIT;`, nothing half-applied. If you ever need to undo Part 4 after it ran, run `supabase/rollback/20270322010000_rollback.sql` in SQL Editor.

---

## Part 5: Set Secrets & Redeploy All 4 Supabase Edge Functions

Your project has **4 Edge Functions**:
1. `verify-payment` *(must allow public checkout + PayStation IPN calls -> deploy with `--no-verify-jwt`)*
2. `secure-ticket-lookup` *(used by public visitors on `/find-ticket` -> deploy with `--no-verify-jwt`)*
3. `verify-student-id` *(requires logged-in Admin or Staff)*
4. `admin-audit` *(requires logged-in active Super Admin)*

### Step 5A: Check Edge Function Secrets in Supabase Dashboard
1. Go to **Supabase Dashboard -> Project (`hnthoszbkhvygoowtvau`) -> Edge Functions** (left sidebar) -> **Secrets** (or **Manage Secrets**).
2. Confirm **every single secret below** is added and spelled **exactly**:

| Exact Secret Name | Production Go-Live Value | Notes |
|---|---|---|
| `PAYSTATION_ENV` | `production` | Use `sandbox` only while still testing sandbox; switch to `production` for real money. |
| `PAYSTATION_MERCHANT_ID` | *(Your Live PayStation Merchant ID)* | From your PayStation merchant account. |
| `PAYSTATION_PASSWORD` | *(Your Live PayStation Password)* | Keep secret here ONLY; never put in Vercel. |
| `PAYSTATION_ALLOW_PAYMENT_FINALIZATION` | `true` | Must be lowercase `true` so payments confirm in the DB. |
| `PAYMENT_SIGNING_SECRET` | *(Random 32+ character secret)* | Any long random string you generate; keep it saved privately. |
| `APP_ALLOWED_ORIGINS` | `https://plscf65.vercel.app` | Exact live URL (no trailing slash). If you use a custom domain too, separate with a comma: `https://plscf65.vercel.app,https://yourcustomdomain.com` |
| `RATE_LIMIT_HMAC_SECRET` | *(Random 32+ character secret)* | Required by `secure-ticket-lookup`. |
| `AUDIT_SIGNING_SECRET` | *(Random 32+ character secret)* | Required by `admin-audit`. |
| `PAYSTATION_ALLOW_ORDER_BOUND_CURRENCY_ATTESTATION` | `false` *(or omit)* | Leave `false` in production unless PayStation confirms BDT currency omission. |

*(Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically provided by Supabase to every Edge Function.)*

### Step 5B: Deploy the Edge Functions (Option 1 — Recommended: Terminal)
Open your Terminal inside your project folder (`/Users/sagarkumarsaha/Desktop/1 plsc2027/plscf65`) and run these commands **one by one**:

```bash
# 1. Log in to Supabase CLI (opens browser once)
supabase login

# 2. Link this folder to your live Supabase project
supabase link --project-ref hnthoszbkhvygoowtvau

# 3. Deploy all 4 Edge Functions (note --no-verify-jwt on public payment/lookup functions!)
supabase functions deploy verify-payment --no-verify-jwt
supabase functions deploy secure-ticket-lookup --no-verify-jwt
supabase functions deploy verify-student-id
supabase functions deploy admin-audit
```

- **What means success:** Each command ends with `Deployed Function ...`.

### Option 2 (No-Terminal Way — Supabase Dashboard Web Editor)
1. Go to **Supabase Dashboard -> Edge Functions**.
2. Click on each function (`verify-student-id`, `secure-ticket-lookup`, `admin-audit`), click **Details / Code / Edit**, paste the updated `index.ts` from your local folder, and click **Deploy**.
3. **Important limitation for `verify-payment`:** Because `supabase/functions/verify-payment/` uses **multiple files** (`index.ts`, `feeValidation.ts`, `callbackUrl.ts`, `currencyStrategy.ts`, `initiationHandler.ts`, `statusClient.ts`), the simple single-file browser editor cannot always upload helper files properly. **Use Option 1 (Terminal CLI)** for `verify-payment` whenever possible.
4. For `verify-payment` and `secure-ticket-lookup`, click the function's **Settings** tab in Supabase Dashboard and make sure **Enforce JWT Verification** is turned **OFF** (`false`), because `verify-payment` receives unauthenticated PayStation IPN webhooks and public visitors use `sb_publishable_...` keys.

---

## Part 6: Check & Set Vercel Environment Variables

1. Go to **https://vercel.com** and log in.
2. Click your **plscf65** web project.
3. Click **Settings** (top menu) -> **Environment Variables** (left sidebar).
4. Make sure these exact variables exist for **Production** (check the Production box on each):

| Exact Variable Name | Value for Production |
|---|---|
| `VITE_SUPABASE_PROJECT_ID` | `hnthoszbkhvygoowtvau` |
| `VITE_SUPABASE_URL` | `https://hnthoszbkhvygoowtvau.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_yEnHiM0NTIxuKNQnNHQu3Q_IRJ7zfur` *(or copy exact `anon` / `publishable` key from Supabase -> Project Settings -> API)* |
| `VITE_PAYSTATION_MERCHANT_ID` | *(Your Live PayStation Merchant ID — must match Supabase secret `PAYSTATION_MERCHANT_ID`)* |
| `VITE_PAYSTATION_ENV` | `production` |
| `VITE_ENABLE_TEST_BYPASS` | `false` *(or delete this variable completely)* |

5. **Security Check:** Make sure there is **NO** `VITE_PAYSTATION_PASSWORD` and **NO** `SUPABASE_SECRET_KEY` / `SERVICE_ROLE_KEY` starting with `VITE_` in Vercel.
6. Click **Save** after any changes.

---

## Part 7: Push Code & Deploy Frontend on Vercel

*(Note: After our previous `commit all`, we also fixed 6 Tailwind CSS warnings in `src/components/admin/RegistrationDonationControlPanel.tsx` and are saving this guide. Push those latest files to GitHub before deploying Vercel so the live site includes the CSS fix.)*

1. If you have uncommitted edits locally (`RegistrationDonationControlPanel.tsx` and `docs/GO-LIVE-GUIDE.md`), commit and push them from VS Code Source Control or Terminal:
   ```bash
   git add -A && git commit -m "Fix Tailwind cssConflict warnings and add go-live guide" && git push
   ```
2. Open **https://vercel.com** -> your **plscf65** project -> **Deployments**.
3. Wait for the newest deployment from `main` to finish, **OR** if you changed Vercel Environment Variables in Part 6 after the last build, click the **`...`** three dots next to the latest `Production` deployment and click **Redeploy** (leave "Use existing Build Cache" **unchecked** so new `VITE_` variables bake into the bundle).
4. **Success check:** Status turns green **Ready**. Open your live URL (`https://plscf65.vercel.app`) to verify it loads cleanly.

---

## Part 8: Set Your Merchant IPN URL in PayStation

1. Log in to your **PayStation Merchant Dashboard** (production portal).
2. Open **Settings** / **Developer Settings** / **Store Configuration** (exact label depends on your PayStation portal layout).
3. Find the **IPN URL** (Instant Payment Notification / Webhook URL) box.
4. Enter this **exact URL**:
   `https://hnthoszbkhvygoowtvau.supabase.co/functions/v1/verify-payment`
5. Make sure you do **not** use `/api/paystation/ipn` (old Vercel `/api/*` endpoints are disabled).
6. Save your settings in PayStation.
7. Confirm PayStation's Merchant ID matches `PAYSTATION_MERCHANT_ID` (Part 5) and `VITE_PAYSTATION_MERCHANT_ID` (Part 6).

---

## Part 9: Strengthen Supabase Auth Settings (Password & Email)

1. Go to **Supabase Dashboard** -> your project -> left sidebar -> **Authentication**.
2. Click **Sign In / Providers** (under Configuration) -> expand **Email**:
   - Set **Minimum password length** to at least **`8`** (recommended: **`10`** or **`12`**).
   - If your plan shows **"Prevent use of leaked passwords"**, turn it **ON**.
   - Click **Save**.
3. Check **Authentication -> URL Configuration**:
   - **Site URL:** Set to `https://plscf65.vercel.app` (your live URL).
   - **Redirect URLs:** Add `https://plscf65.vercel.app/**`.
   - Click **Save**.
4. Check **Project Settings -> Authentication -> SMTP Settings** (or **Authentication -> Emails -> SMTP**):
   - By default, Supabase's built-in mailer only sends **2–4 emails per hour** and often lands in spam.
   - Turn on **Enable Custom SMTP** and enter your real SMTP credentials (for example, Resend, Brevo, SendGrid, or your school domain email SMTP) so admin/staff password reset emails work reliably.

---

## Part 10: Safely Remove Old Demo Admin & Staff Accounts

**CRITICAL RULE: Verify your REAL Super Admin login works FIRST before deleting anything!**

1. Open an **Incognito / Private browser window**.
2. Go to **`https://plscf65.vercel.app/admin/super-admin`**.
3. Log in with your **real** Super Admin email/username and strong password (NOT `admin@gmail.com`).
4. Confirm the dashboard loads, you see registrations, and you can open tabs cleanly. **Do not proceed if your real Super Admin login fails.**
5. Once your real Super Admin login is confirmed working, look at the **Query 8 results from Part 2** (`readonly_checks.sql`):
   - Check if any of these test emails appeared:
     - `admin@gmail.com`
     - `venue.admin@gmail.com`
     - `moderator@gmail.com`
     - `finance@gmail.com`
     - `registration@gmail.com`
6. Note that migration `20270314` protects designated immutable super admin identities in SQL (`is_protected_super_admin_identity`). If your real account IS one of those emails, **do NOT delete it—instead change its password to a strong unique password and update its email cleanly**, OR only remove unused test/demo rows:
   - In **Supabase Dashboard -> Authentication -> Users**: find each unused demo account -> click the **`...`** menu -> **Delete user** (never delete your own active Super Admin login!).
   - In **Supabase Dashboard -> Table Editor -> `admin_accounts`** and **`staff_accounts`**: verify none of the unused demo emails remain, or set `status = 'INACTIVE'` / remove unused test rows while leaving your real admin and staff rows untouched.

---

## Part 11: Update International Bank Details, Fees & Run Online Audit

1. Log in as **Super Admin** on your live site (`https://plscf65.vercel.app/admin/super-admin`).
2. In the left sidebar, click **International Payment Management** (`internationalPaymentManagement`):
   - Currently the defaults say `Update from Super Admin Portal` for Account Number and Routing Number.
   - Enter the **real bank account number, routing number, branch details, mobile banking contact, and official email**, then click **Save**.
3. In the left sidebar, click **Fee & Governance Settings** (`feeSettings`):
   - Confirm:
     - `Former Student Fee` (e.g. `1500`)
     - `Current Student Fee` (e.g. `500`)
     - `Parent Fee` (currently `500` in database — set to your committee's approved amount)
     - `Min Donation` (`100`) and `Max Donation` (`50000`)
     - `Online Registration` / `Alumni` / `Current Student` / `Donations` / `Payments` switches are **ON** (only when you are ready to accept live entries).
4. **Online Package Security Check (`npm audit`):**
   - In Terminal on an internet-connected computer inside your project folder, run:
     ```bash
     npm audit --omit=dev
     ```
   - Review if any critical runtime dependency advisories appear.

---

## Part 12: Live Site Verification Checklist

Test every item below in a **fresh Incognito/Private browser window** on your live domain (`https://plscf65.vercel.app`):

1. **Public Pages (`/`, `/gallery`, `/notices`, `/about`):**
   - **Should see:** Home stats load from Supabase, Organizing Committee displays your CMS members, gallery photos/videos open cleanly, Contact form sends and shows confirmation (or a clear error if offline), **zero** `"🧪 Quick Test"` boxes or `Auto-fill` buttons appear anywhere, and `"2027"` branding shows instead of `"2026"`.
   - **If it fails:** Check browser Console (`Cmd + Option + J`) for CSP/API errors; confirm Part 3 SQL and Part 6 Vercel vars (`VITE_ENABLE_TEST_BYPASS=false`) and redeploy Vercel without build cache.
2. **Registration WITHOUT Parent Pass (`/register`):**
   - **Should see:** Fee summary matches `Fee Settings` (`Former: ৳1,500` or `Current: ৳500` + `1.8%` gateway fee). Upload a JPG/PNG/WebP photo -> PayStation page opens -> after completing payment, digital ticket & QR ID card render cleanly.
   - **If it fails:** Check `verify-payment` Edge logs in Supabase Dashboard (**Edge Functions -> verify-payment -> Logs**); confirm `PAYSTATION_MERCHANT_ID`, `PAYSTATION_PASSWORD`, `PAYSTATION_ALLOW_PAYMENT_FINALIZATION=true`, and `APP_ALLOWED_ORIGINS` match.
3. **Registration WITH Parent Pass (`/register`):**
   - **Should see:** Enabling **Accompanying Parent** adds the exact `parentFee` configured in Supabase (`system_settings`), NOT a stale `1500`, and both Student ID Card and Parent Pass appear after verification.
   - **If it fails:** Re-check `parentFee` in **Fee Settings** and clear browser cache / refresh.
4. **Small Donation (`/donate`):**
   - **Should see:** Amounts below `minDonation` (`100`) or above `maxDonation` (`50000`) show clear validation messages; completing a valid donation (try `৳100` or `৳500`, and even test closing/not auto-returning once if using sandbox) creates a confirmed entry in `donations`, shows in **Donors Hall of Fame**, and lets you print/download the Thank You Card.
   - **If it fails:** Check Part 4 SQL migration ran cleanly and `verify-payment` Logs show no errors.
5. **Ticket Lookup (`/find-ticket`):**
   - **Should see:** Searching by Registration ID + mobile OR mobile OR Donation ID finds verified paid tickets/donations; Print/PDF card works; `"Resend to My Email"` fake button is gone.
   - **If it fails:** Confirm `secure-ticket-lookup` deployed with `--no-verify-jwt` and `RATE_LIMIT_HMAC_SECRET` is set in Edge Secrets.
6. **Admin Login (`/admin/super-admin`, `/portal`, `/admin/finance`):**
   - **Should see:** Real Supabase login works cleanly; Finance Manager can open **Registration Approvals** (`ManualApprovalTab`); clicking Home signs out the admin session. Trying `/admin/super-admin` without logging in does NOT grant access even if someone puts test data in `localStorage`.
   - **If it fails:** Confirm user exists in both `auth.users` and `admin_accounts` with `status = 'ACTIVE'` and `is_locked = false`.
7. **Staff Scanner Login (`/scanner` and `/scanner/gate_scanner`):**
   - **Should see:** Active staff login works, webcam permission works cleanly (no CSP video/media error), scanning a paid ticket shows verified status, and recording Entry/Meal/T-shirt succeeds.
   - **If it fails:** Confirm `vercel.json` CSP (`media-src`) deployed cleanly (Part 7) and Part 3 SQL ran cleanly so `authenticated` staff can call scanner RPCs.

---

## Part 13: If Something Goes Wrong (Exact Undo Steps)

Follow these calm, reverse-order steps to undo any part cleanly without losing live data:

- **Undo Part 4 (SQL Migration 2 — Donation IPN / `ipn_logs`):**
  1. Open **Supabase Dashboard -> SQL Editor -> + New query**.
  2. Open `supabase/rollback/20270322010000_rollback.sql`, copy all, paste, and click **Run**.
  *(Restores the previous `rpc_promote_pending_order_to_registration` function without deleting any recorded donations.)*

- **Undo Part 3 (SQL Migration 1 — RPC & RLS Security Hardening):**
  1. Open **Supabase Dashboard -> SQL Editor -> + New query**.
  2. Open `supabase/rollback/20270322000000_rollback.sql`, copy all, paste, and click **Run**.
  *(Restores previous RPC grants and open policies if any feature unexpectedly stopped reading/writing.)*

- **Undo Part 1 (Full Database Restore from Before You Started):**
  1. Go to **Supabase Dashboard -> Database -> Backups**.
  2. Pick the backup created before you started (or use PITR timestamp before Part 3) and click **Restore**.
  *(Only use this in a true emergency, because it rolls back any new registrations/donations created after that backup timestamp.)*

- **Undo Part 5 (Edge Functions):**
  1. In Terminal, check out the previous commit on a temporary branch or run `git checkout f3a051ec -- supabase/functions/` and redeploy `verify-payment`, `verify-student-id`, `secure-ticket-lookup`, and `admin-audit`.
  2. Or adjust any mistyped secret in **Supabase Dashboard -> Edge Functions -> Secrets** immediately (secret updates take effect right away without redeploying code).

- **Undo Part 6 & Part 7 (Vercel Environment Variables & Frontend Deploy):**
  1. Go to **Vercel -> Deployments**.
  2. Find the previous working green deployment before today -> click **`...`** -> **Instant Rollback** (or **Promote to Production**).
  3. Revert any changed variable in **Settings -> Environment Variables** if needed.

- **Undo Part 8 (PayStation IPN):**
  1. Log in to **PayStation Merchant Dashboard -> IPN Settings** and restore your previous working URL or temporarily set `PAYSTATION_ALLOW_PAYMENT_FINALIZATION=false` in Supabase Edge Secrets to pause processing while debugging.

- **Undo Part 9 & Part 10 (Auth / Locked-Out Admin):**
  1. If you accidentally deleted or broke an admin login, go to **Supabase Dashboard -> Authentication -> Users -> Add user -> Create new user**, then go to **Table Editor -> `admin_accounts`** and update that admin's `auth_user_id` column to the new User UUID (`id` from `auth.users`).

- **Undo Part 11 (Bank Details / Fee Settings):**
  1. Log in to **Super Admin -> Fee Settings** or **International Payment Management**, fix the numbers, and click **Save** again.
