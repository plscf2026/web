# Police Lines School & College Reunion 2027
## Comprehensive Authentication, Password & Staff Account Management Guide

**Document Version:** 1.0.0  
**Target Event:** 64-Year Grand Reunion 2027, Police Lines School & College Faridpur (PLSCF)  
**Scope:** Architectural Analysis, Identity Governance, Credential Workflows, Database Structures, and Operations Manual  
**Safety Classification:** Sensitive Operational Documentation (Contains no plaintext secrets, service keys, or private credentials)

---

## Table of Contents
1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Dual-Tier Authentication Model](#2-dual-tier-authentication-model)
3. [Login Portal Mapping & Directory](#3-login-portal-mapping--directory)
4. [Account Creation & Provisioning Workflows](#4-account-creation--provisioning-workflows)
5. [Password Management & Credential Lifecycle](#5-password-management--credential-lifecycle)
6. [Admin Control Panel & User Management Interface](#6-admin-control-panel--user-management-interface)
7. [Database Architecture & Security Policies](#7-database-architecture--security-policies)
8. [Supabase Dashboard Step-by-Step Operations Guide](#8-supabase-dashboard-step-by-step-operations-guide)
9. [Source Code & File Reference Matrix](#9-source-code--file-reference-matrix)
10. [Audit & Discrepancy Findings (Existing vs. Missing)](#10-audit--discrepancy-findings-existing-vs-missing)
11. [Maintenance Checklist & Future Roadmap](#11-maintenance-checklist--future-roadmap)

---

## 1. Executive Summary & System Architecture

The Police Lines School & College Reunion Web Application enforces an enterprise-grade, role-isolated identity architecture. It manages two distinct user echelons:

1. **Executive Administration & Portal Roles:**
   - Super Administrator (Master Oversight)
   - Venue Administrator (Operations & Registrations)
   - Floor Moderator (Attendee & Ticket Verification)
   - Finance Secretary (Treasury & Financial Approvals)
   - Registration Lead (Manual Venue Registrations & ID Card Issuance)
   - Committee Members (RMS Tasks, Meetings & Coordination)
2. **Operational Field Staff Stations:**
   - Gate Staff (Gate 01, Gate 02 Check-in & Security)
   - Food Service Staff (Breakfast, Lunch, Dinner Verification)
   - Kit & Dress Distribution Staff (T-Shirt Distribution)
   - ID Card Operations Staff (Plastic Badge Production & Printing)

### High-Level Authentication Architecture Diagram

```
+--------------------------------------------------------------------------------------------------+
|                                    CLIENT BROWSER (Vite / React)                                 |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   +-----------------------+     +-----------------------+     +------------------------------+   |
|   |  Role Login Portals   |     |  Role Directory       |     |  Scanner Portal              |   |
|   |  /login/:role         |     |  /login or /roles     |     |  /scanner                    |   |
|   +-----------+-----------+     +-----------+-----------+     +--------------+---------------+   |
|               |                             |                                |                   |
|               +-----------------------------+--------------------------------+                   |
|                                             |                                                    |
|                                             v                                                    |
|                              [ SupabaseService.loginAdmin ]                                      |
|                              [ EventStore.authenticateStaff ]                                    |
+---------------------------------------------+----------------------------------------------------+
                                              |
                                              | HTTPS / WSS
                                              v
+--------------------------------------------------------------------------------------------------+
|                                    SUPABASE BACKEND CLOUD                                        |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   +------------------------------------------------------------------------------------------+   |
|   |  SUPABASE AUTH SYSTEM (auth.users)                                                       |   |
|   |  - Authenticates Email & Password via Argon2id / Bcrypt password hashing                 |   |
|   |  - Issues Cryptographic JWT Access Tokens & Refresh Tokens                               |   |
|   |  - Authoritative source of user identity and email verification                          |   |
|   +---------------------------------------------+--------------------------------------------+   |
|                                                 |                                                |
|                                                 | auth_user_id (UUID Foreign Key)                |
|                                                 v                                                |
|   +------------------------------------------------------------------------------------------+   |
|   |  POSTGRESQL RBAC TABLES (public schema)                                                  |   |
|   |                                                                                          |   |
|   |  +-------------------------------------+    +-----------------------------------------+  |   |
|   |  | public.admin_accounts               |    | public.staff_accounts                   |  |   |
|   |  | - Links auth_user_id                |    | - Links auth_user_id                    |  |   |
|   |  | - Stores portal role                |    | - Stores department, permissions, gate  |  |   |
|   |  | - Enforces role constraint          |    | - Enforces status (ACTIVE/DISABLED)     |  |   |
|   |  +-------------------------------------+    +-----------------------------------------+  |   |
|   |                                                                                          |   |
|   |  +-------------------------------------+    +-----------------------------------------+  |   |
|   |  | public.admin_audit_logs             |    | public.id_card_staff_accounts           |  |   |
|   |  | - Immutable cryptographic trail     |    | - Sub-station ID badge accounts         |  |   |
|   |  +-------------------------------------+    +-----------------------------------------+  |   |
|   +------------------------------------------------------------------------------------------+   |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Dual-Tier Authentication Model

Authentication in this application operates through two coordinated tiers:

### Tier 1: Supabase Managed Identity (`auth.users`)
- **Engine:** Built-in GoTrue auth server managed by Supabase.
- **Credential Storage:** User passwords are encrypted and hashed inside the private database schema `auth.users`. Passwords are **never** stored in plaintext and **never** stored in the public PostgreSQL schema.
- **Hashing Algorithm:** Adaptive cryptographic hashing (Bcrypt / Argon2id).
- **Session Tokens:** Issues standard OAuth2 JSON Web Tokens (JWT) containing user UUID, expiry timestamp, and authorization metadata.
- **Verification Call:**
  ```typescript
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: passwordAttempt,
  });
  ```

### Tier 2: Public Schema Role-Based Access Control (`public.admin_accounts` & `public.staff_accounts`)
Once Supabase Auth confirms valid email and password credentials, the application evaluates the authenticated user's profile in the database:
1. **For Executive Administrators:** Queries `public.admin_accounts` matching `auth_user_id = authData.user.id`.
2. **For Field Staff:** Queries `public.staff_accounts` matching `auth_user_id = authData.user.id`.
3. **Status Check:** If the account is marked `DISABLED` or `is_locked = TRUE`, the session is immediately terminated via `supabase.auth.signOut()`.
4. **Portal Authorization Check:** Validates that the account's assigned role matches the specific portal being accessed. If mismatched, the session is cleared, and an `Access Denied` error is returned.

### Development & Staging Testing Bypass Mode
To facilitate offline verification and continuous integration without live internet credentials, the application includes a sandbox bypass mechanism:
- **Flag:** Controlled by environment variable `VITE_ENABLE_TEST_BYPASS`.
- **Condition:** Evaluated in `src/services/supabase.ts` via `isDevTestBypassAllowed()`.
- **Behavior:** When enabled and password `admin@123` is provided for pre-configured test emails (`admin@gmail.com`, `venue.admin@gmail.com`, `finance@gmail.com`, `registration@gmail.com`, `moderator@gmail.com`, `committee@gmail.com`), the application constructs a verified mock session stored in browser `localStorage` under `plscf_test_admin_session`.
- **Production Safety:** When deploying to production, setting `VITE_ENABLE_TEST_BYPASS="false"` in Vercel or production `.env` completely disables this bypass, forcing all requests through live Supabase Auth.

---

## 3. Login Portal Mapping & Directory

Every user role has a unique, dedicated login portal featuring bespoke institutional branding, role badge, theme colors, and restricted navigation.

### Official Portal Directory Matrix

| # | Role | Official Portal Title | Login URL | Theme & Accent | Default Module | Allowed Modules / Tabs |
|---|---|---|---|---|---|---|
| **1** | **Super Admin** | *Police Lines School & College Reunion Super Admin Portal* | `/login/super-admin` | Gold / Purple (`amber`) | Master Overview (`masterOverview`) | Full Master Access (All 13 Modules + DB Root Approvals) |
| **2** | **Admin** | *Police Lines School & College Reunion Admin Portal* | `/login/admin` | Institutional Navy (`sky`) | Master Overview (`masterOverview`) | Bookings, Registry, Manual Reg Desk, ID Cards, Notices, Reports |
| **3** | **Moderator** | *Police Lines School & College Reunion Moderator Portal* | `/login/moderator` | Emerald Green (`emerald`) | Tickets Verification (`tickets`) | Tickets, All Bookings, Notices, ID Card Lookup |
| **4** | **Finance Team** | *Police Lines School & College Reunion Finance Portal* | `/login/finance` | Amber Gold (`amber`) | Budget & Expenses (`budgetManagement`) | Central Budget, Daily Analytics, Manual Financial Approvals, Fee Settings, Reports |
| **5** | **Registration Team** | *Police Lines School & College Reunion Registration Portal* | `/login/registration` | Cyan Blue (`cyan`) | Venue Manual Reg (`manualRegistration`) | Manual Reg Desk, All Bookings, Student IDs, ID Cards, T-Shirts, Tickets |
| **6** | **Committee Member** | *Police Lines School & College Reunion Committee Portal* | `/login/committee` | Royal Purple (`purple`) | Reunion ERP (`reunionManagement`) | Reunion Management (RMS Tasks, Meetings, Sponsors), Notices, Reports |
| **7** | **Field Scanner Staff** | *Police Lines School & College Reunion QR Verification Portal* | `/scanner` | Slate Rose (`rose`) | Assigned Station | Gate 01/02, Breakfast, Lunch, Dinner, Dress/T-shirt |
| **8** | **Role Directory** | *Police Lines School & College Reunion Executive Portals* | `/login` or `/roles` | Deep Navy (`blue`) | Directory Hub | One-click directory to all 6 executive login portals |

### URL Tampering Protection (Security Guard Gate)
If an authenticated user attempts to change the URL from their authorized portal to a higher-privilege portal (for example, a `moderator` attempting to open `/dashboard/super-admin` or `/dashboard/finance`):
1. The routing layer detects the role mismatch.
2. The component short-circuits to render `AccessDeniedGate.tsx`.
3. An institutional **403 Forbidden** security screen appears, displaying:
   - Current Account Name and Role
   - Target Restricted Portal
   - Specific Security Explanation
   - Quick action buttons: *"Go to My Authorized Portal"*, *"Switch Account / Log Out"*, or *"Return Home"*.

---

## 4. Account Creation & Provisioning Workflows

Because passwords are maintained strictly within Supabase Auth, creating an account requires a two-step provisioning process.

### Workflow A: Creating a New Field Staff Account (Gate, Meal, Kit Distribution)

Field Staff accounts can be linked using the frontend Admin Dashboard once the user is created in Supabase Auth.

```
+--------------------------------------------------------------------------------------------------+
| STEP 1: SUPABASE DASHBOARD                                                                       |
| 1. Open Supabase Dashboard -> Authentication -> Users.                                           |
| 2. Click "Add User" -> "Create User".                                                            |
| 3. Enter Email: (e.g., gate3@plscf.edu.bd) and a temporary password.                           |
| 4. Confirm auto-confirm email is checked.                                                         |
| 5. Copy the generated User UID (e.g., `4a5c6d7e-8899-44aa-bb22-112233445566`).                  |
+---------------------------------------------+----------------------------------------------------+
                                              |
                                              v
+--------------------------------------------------------------------------------------------------+
| STEP 2: REUNION ADMIN DASHBOARD                                                                  |
| 1. Sign in to the Super Admin Portal (`/login/super-admin`).                                     |
| 2. Navigate to "Staff & Roles" in the left sidebar.                                              |
| 3. Click the "+ Create Staff Account" button.                                                    |
| 4. Complete the form:                                                                            |
|    - Full Name: Officer Monir Hossain                                                            |
|    - Username: gate3                                                                             |
|    - Email Address: gate3@plscf.edu.bd                                                           |
|    - Supabase Auth User ID: [Paste the copied User UID from Step 1]                             |
|    - Assigned Role: GATE_STAFF (or BREAKFAST_STAFF, LUNCH_STAFF, DRESS_STAFF)                    |
|    - Assigned Department: GATE                                                                   |
|    - Assigned Station: Gate 01 - Main Academic Gate                                              |
| 5. Click "Create Staff Account".                                                                 |
| 6. The account is immediately active in `public.staff_accounts` and can log in at `/scanner`.    |
+--------------------------------------------------------------------------------------------------+
```

### Workflow B: Creating a New Executive Admin / Portal Account

Because there is currently **no website UI for direct `admin_accounts` table editing**, executive accounts are provisioned via Supabase Auth and linked via the Supabase SQL Editor.

#### Step 1: Create the User in Supabase Auth
1. Go to the **Supabase Dashboard** -> **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Enter the official email (e.g., `finance.officer@plscf.edu.bd`) and set a strong temporary password.
4. Click **Create User**.
5. Copy the **User UID** string.

#### Step 2: Link the Account in PostgreSQL (`public.admin_accounts`)
1. Go to the **Supabase Dashboard** -> **SQL Editor**.
2. Run the following parameterized SQL query:

```sql
INSERT INTO public.admin_accounts (
  id,
  auth_user_id,
  username,
  full_name,
  email,
  role,
  created_at
) VALUES (
  'ADMIN-' || substr(gen_random_uuid()::text, 1, 8),
  'PASTE_SUPABASE_USER_UID_HERE'::uuid,
  'finance.officer@plscf.edu.bd',
  'Md. Shafiqul Alam',
  'finance.officer@plscf.edu.bd',
  'finance_manager',
  NOW()
)
ON CONFLICT (auth_user_id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email;
```

> [!IMPORTANT]
> **Allowed Portal Roles in `public.admin_accounts`:**
> - `super_admin` (Master Access)
> - `admin` (Venue Operations)
> - `moderator` (Floor Verification)
> - `finance_manager` or `finance` (Treasury & Financial Approvals)
> - `registration_officer` or `registration` (Venue Student Registration)
> - `committee_member` or `committee` (RMS ERP)
> - `gate_scanner` (Gate Supervisor)

---

## 5. Password Management & Credential Lifecycle

### Where Are Passwords Stored?
- Passwords are **never** stored in public tables.
- In earlier legacy schemas (migration `20260101000000`), a column named `password_hash` existed in `admin_accounts`.
- Under migration `20261110000000_auth_and_rls_hardening.sql`, `password_hash` was **permanently dropped** from both `public.admin_accounts` and `public.staff_accounts`.
- All password hashes reside exclusively inside Supabase Auth's private schema (`auth.users.encrypted_password`).

### How to Change or Reset a User Password

Because client-side password reset forms are not exposed on the frontend, password changes are executed through the Supabase Dashboard:

#### Method 1: Direct Password Reset by Administrator
1. Navigate to **Supabase Dashboard** -> **Authentication** -> **Users**.
2. Locate the user by email or username in the search box.
3. Click on the user's row or click the three dots (`...`) on the right.
4. Select **Reset Password** or **Edit User**.
5. Type the new secure password and click **Save**.
6. The user can immediately log in with the new password.

#### Method 2: Sending a Password Reset Email
1. In **Supabase Dashboard** -> **Authentication** -> **Users**.
2. Click the three dots (`...`) next to the user.
3. Select **Send Password Reset Email**.
4. The user receives an automated recovery link via email (requires SMTP configuration under Authentication -> Email Settings).

### Status of "Forgot Password" on the Website
- **Current Status:** **MISSING / NOT IMPLEMENTED**.
- There is currently no public "Forgot Password" or "Self-Service Reset" button on the login forms (`/login/:role` or `/scanner`).
- Users who lose their password must contact the website Super Administrator to have their password updated in the Supabase Dashboard.

---

## 6. Admin Control Panel & User Management Interface

### Feature Audit Matrix

| User Management Feature | Staff Accounts (`staff_accounts`) | Executive Accounts (`admin_accounts`) | ID Card Staff (`id_card_staff`) | Notes / Location |
|---|---|---|---|---|
| **View All Accounts** | ✅ Supported | ❌ MISSING in UI | ✅ Supported | Admin Dashboard -> *Staff & Roles* tab |
| **Search Accounts** | ✅ Supported | ❌ MISSING in UI | ✅ Supported | Live search by name, username, email, ID |
| **Filter by Role** | ✅ Supported | ❌ MISSING in UI | ❌ N/A | Filter by Gate, Meal, Dress, Finance |
| **Filter by Status** | ✅ Supported | ❌ MISSING in UI | ✅ Supported | Filter Active vs. Disabled |
| **Add New Account** | ⚠️ Partial (Requires UID) | ❌ MISSING in UI | ⚠️ Partial (Local store) | Links pre-created Supabase Auth UID |
| **Edit User Info** | ❌ MISSING in UI | ❌ MISSING in UI | ❌ MISSING in UI | Must update via SQL or Supabase |
| **Change Role / Dept** | ❌ MISSING in UI | ❌ MISSING in UI | ✅ Supported | Requires SQL query for Admin accounts |
| **Toggle Active/Disabled** | ✅ Supported | ❌ MISSING in UI | ✅ Supported | 1-click toggle with mandatory reason |
| **Delete Account** | ✅ Supported | ❌ MISSING in UI | ✅ Supported | Deletes from table with audit reason |
| **Reset Password in UI** | ❌ MISSING in UI | ❌ MISSING in UI | ⚠️ Mock only | Must be performed in Supabase Dashboard |

### How to Use the Staff Management Tab (Screens & Controls)
1. Log in to `/login/super-admin`.
2. In the navigation sidebar, click **Staff & Roles** (icon: `Users`).
3. **Search & Filter:**
   - Type in the search box to find staff by full name, `@username`, or email.
   - Use the **Role** dropdown to isolate specific stations (e.g., `GATE_STAFF`, `LUNCH_STAFF`).
   - Use the **Status** dropdown to review active or disabled accounts.
4. **Deactivating / Reactivating an Account:**
   - Click the **Lock / Unlock** icon in the Actions column.
   - A modal prompt will appear requiring an **Audit Reason** (e.g., *"Shift ended for Gate 01"*).
   - Enter the reason and confirm. The account is immediately blocked from logging in.
5. **Deleting an Account:**
   - Click the **Trash** icon next to any non-Super Admin staff member.
   - Enter the mandatory audit justification and confirm deletion.
   - The profile is removed from `public.staff_accounts` and recorded in the audit history.

---

## 7. Database Architecture & Security Policies

### Table Schemas

#### 1. `public.admin_accounts`
Stores administrative profiles for the 6 executive portal roles.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | Unique ID format: `ADMIN-XXXXXXXX` |
| `auth_user_id` | `UUID` | `UNIQUE, REFERENCES auth.users(id)` | Foreign key to Supabase Auth |
| `username` | `TEXT` | `UNIQUE, NOT NULL` | Login username or identifier |
| `full_name` | `TEXT` | `NOT NULL` | Display name for badges and headers |
| `email` | `TEXT` | `NOT NULL` | Administrative notification email |
| `role` | `TEXT` | `NOT NULL, CHECK (role IN (...))` | Role identifier (`super_admin`, `admin`, etc.) |
| `is_locked` | `BOOLEAN` | `DEFAULT FALSE` | Lock flag for failed logins |
| `failed_attempts`| `INTEGER` | `DEFAULT 0` | Consecutive failed attempt counter |
| `last_login_at` | `TIMESTAMPTZ`| `NULLABLE` | Timestamp of most recent session |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT NOW()` | Record creation timestamp |

#### 2. `public.staff_accounts`
Stores operational accounts for on-site gate and food scanners.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | Format: `STF-XXXXXXXX` |
| `auth_user_id` | `UUID` | `UNIQUE, REFERENCES auth.users(id)` | Foreign key to Supabase Auth |
| `username` | `TEXT` | `UNIQUE, NOT NULL` | Staff station username (e.g., `gate1`) |
| `full_name` | `TEXT` | `NOT NULL` | Staff member's official name |
| `email` | `TEXT` | `NOT NULL` | Staff contact email |
| `role` | `TEXT` | `NOT NULL` | `GATE_STAFF`, `LUNCH_STAFF`, etc. |
| `department` | `TEXT` | `NOT NULL` | `GATE`, `FOOD`, `DRESS`, `FINANCE` |
| `permissions` | `TEXT[]` | `NOT NULL` | Array of actions: `['VIEW', 'SCAN', ...]` |
| `status` | `TEXT` | `DEFAULT 'ACTIVE'` | `'ACTIVE'` or `'DISABLED'` |
| `assigned_gate` | `TEXT` | `NULLABLE` | Physical gate or station location |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT NOW()` | Record creation timestamp |
| `created_by` | `TEXT` | `NULLABLE` | Admin email who provisioned account |

#### 3. `public.admin_audit_logs`
Cryptographic, immutable ledger recording every administrative login and configuration update.

| Column | Data Type | Description |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` | Format: `LOG-XXXXXXXX` |
| `admin_id` | `TEXT` | ID of acting administrator |
| `admin_username` | `TEXT` | Username of administrator |
| `admin_role` | `TEXT` | Portal role at time of action |
| `action` | `TEXT` | E.g., `ADMIN_LOGIN`, `FEE_SETTINGS_UPDATE` |
| `target_type` | `TEXT` | Target entity (`admin_account`, `registration`, etc.) |
| `target_id` | `TEXT` | Identifier of affected record |
| `details` | `TEXT` | Detailed context or reason |
| `checksum` | `TEXT` | SHA-256 tamper-evident integrity hash |
| `timestamp` | `TIMESTAMPTZ` | Wall-clock timestamp |

### Database Functions & Triggers

1. **`public.rpc_authenticate_portal_role(p_user_email TEXT, p_required_role TEXT)`**
   - Validates if a user account exists in `admin_accounts` and possesses the required role.
   - Super Admin accounts (`super_admin`) automatically receive universal access to all portals.
   - Normalizes role synonyms (`finance` <-> `finance_manager`, `committee` <-> `committee_member`).
2. **`public.current_admin_role()`**
   - Returns the active role of the currently authenticated JWT (`auth.uid()`).
   - Marked `SECURITY DEFINER` and granted only to `authenticated` and `service_role`.
3. **`public.current_event_staff_role()`**
   - Returns the active role of an operational staff member (`auth.uid()`) where `status = 'ACTIVE'`.
4. **`public.check_single_admin_slot()` & `trg_enforce_single_admin_slot`**
   - *Legacy Constraint Notice:* In early security hardening, a trigger was created on `public.admin_accounts` blocking insertion if `COUNT(*) >= 1`.
   - When provisioning multiple roles in production, this trigger must be replaced with a per-role uniqueness trigger or removed to allow one administrator per designated portal.

### Row Level Security (RLS) Policies

All authentication tables enforce PostgreSQL Row Level Security:

```sql
-- 1. admin_accounts: Only authenticated users can read their own profile
CREATE POLICY admin_profile_read_own
  ON public.admin_accounts FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- 2. staff_accounts: Staff can read own profile; Super Admins can read all profiles
CREATE POLICY staff_profile_read_own_or_admin
  ON public.staff_accounts FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid() OR
    public.current_admin_role() = 'super_admin'
  );

-- 3. admin_audit_logs: Only Super Admin can read administrative audit history
CREATE POLICY admin_audit_read_admin
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.current_admin_role() = 'super_admin');
```

---

## 8. Supabase Dashboard Step-by-Step Operations Guide

This section is for the website owner to perform maintenance using the Supabase Web Console (`app.supabase.com`).

```
+--------------------------------------------------------------------------------------------------+
| SUPABASE DASHBOARD NAVIGATION SITEMAP                                                            |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   [Project Home]                                                                                 |
|       |                                                                                          |
|       +--> [Authentication] (Key icon)                                                           |
|       |        |                                                                                 |
|       |        +--> Users: List of registered auth accounts, Add User, Reset Password           |
|       |        +--> Providers: Email/Password toggle (Keep enabled)                              |
|       |        +--> Email Templates: Password reset template, confirmation template              |
|       |                                                                                          |
|       +--> [Table Editor] (Table icon)                                                           |
|       |        |                                                                                 |
|       |        +--> admin_accounts: View administrative staff, roles, locked status              |
|       |        +--> staff_accounts: View field station staff, departments, active status         |
|       |        +--> admin_audit_logs: Inspect audit trail of logins and system changes          |
|       |                                                                                          |
|       +--> [SQL Editor] (Terminal icon)                                                          |
|                |                                                                                 |
|                +--> Run migration scripts, link auth users to admin accounts                     |
+--------------------------------------------------------------------------------------------------+
```

### Action 1: Disabling an Account Immediately (Emergency Revocation)
If an admin or staff credential is compromised:
1. Open **Supabase Dashboard** -> **Authentication** -> **Users**.
2. Find the user's email.
3. Click the three dots (`...`) -> **Ban User** or **Delete User**.
4. The user's active JWT will be invalidated, preventing further access.
5. In **Table Editor** -> `staff_accounts`, set `status = 'DISABLED'`.

### Action 2: Resetting a Forgotten Administrator Password
1. Open **Supabase Dashboard** -> **Authentication** -> **Users**.
2. Click the user's row.
3. Under the User Details panel, enter a new password in the **Password** field.
4. Click **Save Changes**.
5. Inform the administrator to sign in at their designated portal URL.

### Action 3: Inspecting Authentication Security Logs
1. Open **Table Editor** -> `public.admin_audit_logs`.
2. Look for records where `action = 'ADMIN_LOGIN'`.
3. Check the `timestamp`, `admin_username`, and `admin_role`.
4. Check for any failed attempts or unauthorized access alerts.

---

## 9. Source Code & File Reference Matrix

| File Path | Functional Purpose |
|---|---|
| [`src/types/index.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/types/index.ts) | Role definitions (`PortalRole`), `PORTAL_ROLE_CONFIGS` registry, allowed tabs mapping, normalization helpers (`normalizePortalRole`, `getPortalRoleFromSlug`). |
| [`src/services/supabase.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/services/supabase.ts) | Core authentication methods: `loginAdmin()`, `logoutAdmin()`, `getActiveAdminSession()`, test bypass handler, audit log recording. |
| [`src/services/eventStore.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/services/eventStore.ts) | Staff station methods: `authenticateStaff()`, `fetchStaffAccounts()`, `createStaffAccount()`, `updateStaffAccount()`, `deleteStaffAccount()`. |
| [`src/components/auth/RoleLoginPage.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/auth/RoleLoginPage.tsx) | Visual login page component for the 6 executive portals. Displays title, branding, credentials form, and language toggle. |
| [`src/components/auth/RoleDirectoryPortal.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/auth/RoleDirectoryPortal.tsx) | Directory hub displayed at `/login` or `/roles` listing cards for all 6 portals. |
| [`src/components/auth/AccessDeniedGate.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/auth/AccessDeniedGate.tsx) | Institutional 403 Forbidden security gate blocking URL tampering across different role dashboards. |
| [`src/components/AdminDashboard.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/AdminDashboard.tsx) | Central dashboard router, active portal state management, allowed tabs filtering, and navigation rendering. |
| [`src/components/admin/StaffManagementTab.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/admin/StaffManagementTab.tsx) | UI for managing `staff_accounts`: search, filter, provision with Auth User ID, activate/deactivate, delete. |
| [`src/components/ScannerPortal.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/ScannerPortal.tsx) | Gate, Meal, and Dress scanner station portal. Enforces staff department authorization and time-window rules. |
| [`src/components/Footer.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/Footer.tsx) | Universal footer containing one-click shortcuts to the 6 official role portals and field scanner stations popover. |
| [`src/utils/navigation.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/utils/navigation.ts) | Route resolver handling `/login/:role`, `/dashboard/:role`, direct shortcuts (`/super-admin`, `/finance`, etc.), and URL generation. |
| [`src/utils/roleLoginPortals.test.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/utils/roleLoginPortals.test.ts) | Automated test suite verifying portal titles, slug resolution, RBAC isolation, and access rejection. |
| [`supabase/migrations/20270119000000_separate_role_login_portals_and_rbac.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20270119000000_separate_role_login_portals_and_rbac.sql) | SQL migration updating role check constraints, indexes, and stored procedure `rpc_authenticate_portal_role`. |

---

## 10. Audit & Discrepancy Findings (Existing vs. Missing)

### Existing & Fully Operational Features
1. **Dedicated Role Portals:** All 6 roles have individual URLs, branding, icons, and official titles.
2. **Strict URL Guarding:** Unauthorized attempts to access higher-privilege portals via URL manipulation are blocked by `AccessDeniedGate.tsx`.
3. **Module Isolation:** Navigation menus and views dynamically restrict features to only the tabs permitted for the authenticated role.
4. **Field Staff Management UI:** Admins can view, search, paginate, provision, deactivate, and delete scanner staff accounts inside the website UI.
5. **Secure Authentication Service:** Real Supabase Auth integration linking `auth.users` to `admin_accounts` and `staff_accounts` via UUID foreign keys.
6. **Immutable Audit Logs:** Administrative logins and privileged actions are recorded in PostgreSQL with cryptographic SHA-256 checksums.

### Missing Features & System Limitations (Explicitly Identified)
1. **No In-App Admin Account Management:**
   - There is currently **no frontend UI** to view, add, or edit `admin_accounts` (Super Admin, Moderator, Finance, etc.).
   - Admin accounts must be created directly in the Supabase Dashboard and linked via SQL.
2. **No "Forgot Password" or Self-Service Reset:**
   - There is **no client-side "Forgot Password" link** or password recovery form.
   - If a staff member or administrator forgets their password, they cannot reset it themselves on the website.
3. **No Direct User Password Modification in UI:**
   - Neither the Staff Management tab nor the Admin Dashboard allows an admin to type a new password for a user and save it to Supabase Auth.
   - Password changes must be executed within the Supabase Dashboard under Authentication -> Users.
4. **Single Admin Slot Trigger Legacy Restriction:**
   - Migration `20260101000000` instituted `check_single_admin_slot()`, which throws an exception if `COUNT(*) >= 1` on `admin_accounts`.
   - To have multiple active admin accounts across different portals in production, this database trigger must be replaced with a per-role constraint.

---

## 11. Maintenance Checklist & Future Roadmap

### Routine Operational Checklist for System Owner

- [ ] **Pre-Event (1 Week Before Reunion):**
  - Verify all 6 executive portal accounts in Supabase Auth.
  - Test login on each portal (`/login/super-admin`, `/login/admin`, `/login/finance`, etc.).
  - Verify field scanner staff accounts (`gate1`, `gate2`, `lunch1`, `dress1`) in the "Staff & Roles" tab.
  - Confirm `VITE_ENABLE_TEST_BYPASS="false"` in the production deployment environment.
- [ ] **Event Day Operations:**
  - Keep the Supabase Dashboard open on an administrator laptop for immediate password resets or account unbanning if needed.
  - Monitor `public.admin_audit_logs` for failed login bursts or unauthorized access attempts.
  - Review the Staff Management tab to deactivate staff members whose shifts have concluded.
- [ ] **Post-Event (Wrap-Up):**
  - Deactivate all field scanner staff accounts via the Staff & Roles tab to prevent unauthorized scanning after event closure.
  - Export audit logs from `public.admin_audit_logs` for permanent archival.

### Recommended Future Enhancements (When Development Resumes)
1. **Self-Service Password Recovery:** Add a "Forgot Password?" link on `RoleLoginPage.tsx` calling `supabase.auth.resetPasswordForEmail()`.
2. **In-App Admin Accounts Management:** Build a dedicated "Executive Accounts" sub-tab in the Super Admin dashboard allowing Super Admins to view and change portal assignments.
3. **Supabase Edge Function for User Provisioning:** Create a secure Edge Function using the Supabase `service_role` key to allow Super Admins to create both the Supabase Auth user and the database profile in a single form submit without needing to manually copy-paste UUIDs.
4. **Two-Factor Authentication (2FA / MFA):** Enable Supabase TOTP (Authenticator App) 2FA for Super Admin and Finance accounts to provide enhanced protection for treasury and approval features.

---
*Documentation compiled and verified against the Police Lines School & College Reunion codebase.*
