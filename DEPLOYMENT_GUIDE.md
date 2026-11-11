# Deployment & Production Setup Guide
## Police Lines High School & College, Faridpur Reunion 2027

---

## 1. System Requirements & Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **Package Manager**: npm v9.0.0 or higher.
- **Database**: Supabase PostgreSQL 15+ instance.
- **Hosting Targets**: Vercel, Netlify, Cloudflare Pages, or custom Linux VPS (Nginx).

---

## 2. Environment Variables Configuration
Create a `.env` file in the project root:
```ini
# Supabase Backend Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret

# PayStation Bangladesh Gateway Configuration
VITE_PAYSTATION_BASE_URL=https://api.paystation.com.bd
VITE_PAYSTATION_MERCHANT_ID=your_merchant_id
VITE_PAYSTATION_PASSWORD=your_merchant_password

# Application Settings
VITE_APP_NAME="Police Lines High School & College, Faridpur Reunion 2027"
VITE_ADMIN_PIN="admin@123"
```

---

## 3. Database Migration Execution
Apply the comprehensive RMS migration schema in the Supabase SQL editor:
```bash
# Using Supabase CLI:
supabase db push
# Or execute supabase/migrations/20270101000000_reunion_management_erp_schema.sql directly in the Supabase Dashboard
```

---

## 4. Build & Deployment Commands

### 4.1 Production Build
```bash
# 1. Install dependencies cleanly
npm ci

# 2. Run TypeScript strict verification
npm run lint

# 3. Run all automated unit tests
npm test

# 4. Generate optimized production bundle
npm run build
```
Output directory: `dist/` (contains optimized single-page bundle with asset hashing).

### 4.2 Deploying to Vercel
```bash
npm install -g vercel
vercel --prod
```
Ensure Single-Page Application (SPA) routing is configured via `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 5. Post-Deployment Verification Checklist
1. Access the homepage at production domain and verify "Police Lines High School & College, Faridpur Reunion 2027" branding and countdown to Jan 29, 2027.
2. Complete a test student registration with photo capture and PayStation sandbox checkout.
3. Access the **RMS Portal** (`/portal` or header button) and log in as `Convener Monowar Shikder` using test PIN `admin@123`.
4. Submit a test budget request and approve it to verify balance propagation.
5. Check-in a volunteer on the roster to confirm attendance telemetry.

