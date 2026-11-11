# Police Lines School & College Faridpur — Grand Reunion 2026

Official bilingual (বাংলা ও English) digital reunion management platform for Police Lines School and College, Faridpur (Est. 1962).

## Key Features

- **Public Portals**: Home, Registration with live webcam photo capture & auto 200KB compression, Ticket Lookup & Download, Donation, Notice Board, Media Gallery, Contact & Secretariat.
- **PayStation Payment Gateway**: Full integration with PayStation ([Documentation](https://paystation.com.bd/documentation)) for bKash, Nagad, Rocket, Upay, Cards, and Internet Banking.
- **Operational QR Desks**: Multi-station scanner portal covering Gate 01/02, Breakfast, Lunch, Dinner, and T-shirt distribution desks with resilient camera fallback & QR image upload.
- **Role-Based Access Control (RBAC)**: Distinct login credentials per operational desk and strict login-protected Admin Command Dashboard.
- **Backend & Database**: Supabase PostgreSQL database schemas, row-level security (RLS), and anti-replay payment verification Edge Functions.

## Testing Credentials

Unified Password across all test accounts: **`admin@123`**

- **Super Admin**: `admin@gmail.com`
- **Gate Staff**: `gate@gmail.com`
- **Food Staff**: `food@gmail.com`
- **Breakfast Staff**: `breakfast@gmail.com`
- **Dress Staff**: `dress@gmail.com`
- **Finance Staff**: `finance@gmail.com`

## Development & Verification Commands

```bash
# Run local development server
npm run dev

# Run unit test suite (32 tests across RBAC, state machines, PayStation, security)
npm test

# Run strict TypeScript compiler verification (0 unused variables / imports)
npm run lint

# Build optimized production bundle
npm run build
```

