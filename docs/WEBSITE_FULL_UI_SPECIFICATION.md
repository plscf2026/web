# PLSCF 2027 Reunion Portal — Full Website Info & UI Remake Specification

**Purpose:** Complete, current-state UI, UX, layout, copy, design-token, routing, business-rule, and backend-integration specification so a designer, developer, or AI builder can remake the entire website faithfully from scratch without reading source files.  
**Last Verified Against Codebase:** 2026-11-27 (`main` branch, Vite + React 19 + TypeScript + Tailwind CSS v4 + Supabase + PayStation + Vercel)  
**Primary Source File:** `src/` (`HomePage`, `RegistrationPage`, `DonationPage`, `AdminDashboard`, `ScannerPortal`, etc.)

---

## 1. Brand Identity, Event Constants & Tech Stack

### 1.1 Institution & Event Identity
| Property | English (`en`) | Bengali (`bn`) |
|---|---|---|
| **Institution Name** | `Police Lines School and College, Faridpur` | `পুলিশ লাইনস স্কুল অ্যান্ড কলেজ, ফরিদপুর` |
| **Tagline (Header)** | `Est. 1962 • Faridpur` | `স্থাপিত ১৯৬২ • ফরিদপুর` |
| **Hero Script Tagline** | `Once a PLSian, Always a PLSian...` | `একবার পিএলসিয়ান, চিরকাল পিএলসিয়ান...` |
| **Event Title** | `Grand Reunion 2027` | `গ্র্যান্ড রিইউনিয়ন ২০২৭` / `গ্র্যান্ড পুনর্মিলনী ২০২৭` |
| **Event Dates** | `January 28 - 29, 2027` *(Countdown target: Jan 29, 2027)* | `২৮ - ২৯ জানুয়ারি, ২০২৭` |
| **Venue** | `School Campus, Large Field, Faridpur` | `স্কুল ক্যাম্পাস, বড় মাঠ, ফরিদপুর` |
| **Hero Subtitle** | `Let's come together to relive our memories, celebrate our bond and build new connections!` | `আসুন আমরা সবাই মিলে শৈশবের স্মৃতি রোমন্থন করি, আমাদের বন্ধনকে উদযাপন করি এবং নতুন সম্পর্কের মেলবন্ধন গড়ি!` |
| **Patronage** | `District Police Administration, Faridpur` | `জেলা পুলিশ প্রশাসন, ফরিদপুর` |
| **Default Helpline Address** | `Police Lines area in Kamlapur, Faridpur Sadar, Faridpur-7800` | `পুলিশ লাইনস এলাকা, কমলাপুর, ফরিদপুর সদর, ফরিদপুর-৭৮০০` |
| **Default Language** | `'bn'` *(persisted in `localStorage` key `'plscf_lang'`)* | Default on first load |

> **Important Note on Legacy Year Copy in `src/i18n/translations.ts`:** Some strings in `translations.ts` still reference `2026` (e.g., `eventCompletedHeading`, `regPageTitle`, `ticketDate`, `committeeHeading`, `adminHeading`). When remaking the UI cleanly, standardize all visible titles and event dates to **2027 (January 28 - 29, 2027)** while keeping component/CMS overrides intact.

### 1.2 Verified Technology Stack (`package.json`)
- **Framework:** React `^19.0.1` + React DOM `^19.0.1`
- **Language:** TypeScript `^7.0.2`
- **Build Tool:** Vite `^8.3.0` (`@vitejs/plugin-react` `^6.1.1`)
- **Styling:** Tailwind CSS `^4.3.3` via `@tailwindcss/vite`
- **Icons:** `lucide-react` `^0.546.0`
- **Backend & Auth:** `@supabase/supabase-js` `^2.119.0` + `@supabase/ssr` + `@supabase/server`
- **PDF / ID Card Generation:** `jspdf` `^4.2.1` + `jszip` `^3.10.2`
- **QR Encode / Decode:** `qrcode` `^1.5.4` + `jsqr` `^1.4.0`
- **XSS Sanitization:** `dompurify` `^3.4.17`
- **Hosting:** Vercel (SPA fallback + CSP / HSTS / Permissions-Policy headers in `vercel.json`)
- **Payment Gateway:** PayStation (Bangladesh), orchestrated via Supabase Edge Function `verify-payment`

---

## 2. Design System, Typography & Responsive Spec

### 2.1 Color System ("Raw Form // Light Sky Edition" + "Obsidian Dark Portals")
| Token Name | Hex / Value | Usage |
|---|---|---|
| `--color-raw-base` | `#F0F6FA` | Global page background, sticky header frosted glass (`bg-[#F0F6FA]/95`), mobile drawer |
| `--color-raw-obsidian` | `#0F172A` | Primary dark headings, active nav pills, hero Reunion badge, countdown digit cards, order summary cards, fixed mobile bottom bar (`rgba(15, 23, 42, 0.95)`) |
| `--color-raw-electric` | `#0284C7` | Primary CTA buttons (`Register Now`, `Proceed to Payment`), active borders, icons, crest ring |
| `--color-raw-cyan` | `#0EA5E9` | CTA hover states (`hover:bg-[#0EA5E9]`), secondary category badge (`Current Student`), secondary digits |
| `--color-raw-soft` | `#38BDF8` | Highlight `2027` accent text on dark backgrounds, active tab glow, active bottom-nav text |
| `--color-raw-tint` | `#E2EEF8` | Secondary pill buttons, date/venue pills, card hairline borders (`border-[#E2EEF8]`), info badges |
| **Mobile Stat Tile Tint** | `#F8FBFE` | Soft tint background for 2×2 stat cells on mobile |
| **Role Accent Themes** | `amber` (Super Admin / Finance), `blue` (Admin), `emerald` (Moderator / Verified), `cyan` (Registration Officer), `rose` (Scanner Portal) | Portal login pages (`/portal`, `/admin/:role`) and badges |
| **Guardian Pass Theme** | `#24040F` → `#450A1A` maroon gradient + `amber-500` borders | Dedicated Parent/Guardian pass card showcase |

### 2.2 Typography & CSS Accessibility Rules (`src/index.css`)
- **Font Stack:** `-apple-system, BlinkMacSystemFont, "SF Pro", "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (system UI stack across sans/heading; `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` for `.font-mono`, ticket IDs, amounts, QR tokens).
- **Root Font Scaling (`html`):** `16px` mobile (`<768px`), `16.5px` (`>=768px`), `17px` (`>=1280px`).
- **Optical Readability Elevations (IMPORTANT for exact visual remake):**
  - `.text-[9px]` → `0.72rem` (~11.5px)
  - `.text-[10px]` → `0.78rem` (~12.5px)
  - `.text-[11px]` → `0.84rem` (~13.5px)
  - `.text-xs` → `0.875rem` (14px)
  - `.text-sm` → `0.95rem` (~15.2px)
- **Dense Mobile Exceptions (`src/index.css`):**
  - `.mobile-nav-label` → `0.65rem !important` (~10.4px) so all 5–6 mobile bottom bar labels stay single-line without wrapping/truncating awkwardly.
  - `.countdown-unit-label` → `0.625rem !important` (mobile) and `0.75rem !important` (`>=640px`) so the 4-column phone countdown unit names (`SECONDS`, `সেকেন্ড`) fit cleanly on one line.
- **iOS Auto-Zoom Prevention (`<768px`):** Every `<input>`, `<select>`, and `<textarea>` is forced to `font-size: max(16px, 1rem) !important` so Safari does not zoom when typing.
- **Non-Breaking Money & Stats:** `.currency-amount`, `.amount-nowrap`, `.numeric-nowrap`, `.currency-val` enforce `white-space: nowrap` + `tabular-nums`.

### 2.3 Mobile / Phone Layout & Touch Spec (`< 640px`)
- **Overflow & Sticky Header:** `html` and `body` use `overflow-x: clip` (NOT `overflow-x: hidden`, which would break `position: sticky` on mobile `<header>`).
- **Safe Area & Bottom Nav Clearance:**
  - `index.html` viewport: `width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, viewport-fit=cover`
  - Below `640px`, `body` adds `padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px))` so page & footer content scrolls clearly above the fixed bottom bar.
  - Touch controls on coarse pointers / phones (`@media (max-width: 639.98px)`) use `min-height: 44px; min-width: 44px`.
- **Print Rules (`@media print`):** Elements with `.no-print` (Header, Footer, MobileBottomNav, action strips) are hidden; `.print-ticket-container` prints centered at `max-width: 190mm` on A4 portrait with a crisp `2px solid #0f172a` border.

### 2.4 Custom Animations (`src/index.css`)
- `qrLaserScan` / `qrLaserScanSm`: Vertical GPU `translate3d` glowing beam inside live QR camera scanner frame.
- `slideUpEntrance` (`.animate-slide-up`): `translateY(28px) -> 0`, `800ms cubic-bezier(0.16, 1, 0.3, 1)`.
- `modalPopIn` (`.animate-pop-in`): `scale(0.94) translateY(14px) -> 1`, `220ms`.
- `validation-error-pulse`: `1.1s infinite` rose border/glow pulse when `aria-invalid="true"` is set on invalid form fields.
- `.btn-brutalist`, `.btn-raw-electric`, `.btn-raw-obsidian`, `.btn-raw-pill`, `.badge-raw-obsidian`, `.badge-raw-sky`.

---

## 3. Assets & Vector Templates Inventory

### 3.1 Public Static Assets (`public/`)
- `/assets/school_logo.png` — Primary school crest (Header crest, Footer emblem, Ticket header, Admin header, About crest)
- `/assets/school_logo.jpg` — Secondary JPG school logo
- `/assets/Thank_You_Card_Reunion.svg` — Patron Thank You card background artwork
- `/assets/homepage/hero_panorama.jpg` — Full-bleed Home Hero campus & Shaheed Minar panorama background
- `/assets/homepage/campus_hero.jpg` — Default campus image fallback (About page)
- `/assets/homepage/memory_1.jpg`, `memory_2.jpg`, `memory_3.jpg` — Three square preview thumbnails in Home `Our Memories` card
- `/assets/homepage/video_thumb.jpg` — Official Promo video card thumbnail + Video modal backdrop
- `/assets/id_card/campus_footer.png` — Watermark campus illustration in Home Navy Pillars Ribbon & ID card artwork
- `/assets/id_card/school_crest.png` — ID card header emblem
- `/data/committee_members.json` — Default/fallback Organizing Committee members
- `/data/gallery_media.json` — Default/fallback gallery photos & videos
- `/favicon.png`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/ai-catalog.json`

### 3.2 Embedded Card SVG Templates (`src/assets/cards/`)
- `Alumni_Card_template.svg` / `alumniCardSvgRaw.ts`
- `Student_Card.svg` / `studentCardSvgRaw.ts`
- `parents_card.svg` / `parentCardSvgRaw.ts`
- `Thank_You_Card_Reunion.svg` / `thankYouCardSvgRaw.ts`
- **Physical Print Size (`src/utils/officialCardTemplates.ts`):** `60 × 90 mm` PDF (`aspect-[60/90]` screen preview at `max-w-[300px] sm:max-w-[320px]`), `900 × 1350 px` PNG export, `15.5 × 18.0 mm` (`31:36`, `620 × 720 px` output canvas) portrait slot, centered `154 × 154` QR image inside card.

---

## 4. Complete Route Map, Aliases & Deep Links (`src/utils/navigation.ts`)

| URL Path / Pattern | Resolved View | Who Can Access | Notes & Behavior |
|---|---|---|---|
| `/` | `home` | Public | Also checks `#hash`, `?view=`, `?<view>=true`, `sessionStorage.plscf_current_view` |
| `/register` | `register` | Public | Category can be passed via URL |
| `/register/alumni` or `/register/former` | `register` (`former`) | Public | Pre-selects Alumni category |
| `/register/current` or `/register/student` | `register` (`current`) | Public | Pre-selects Current Student category |
| `/registration` *(alias)* | `register` | Public | Supports `?category=former\|current` |
| `/donate` or `/donation` *(alias)* | `donate` | Public | Supports `?payment_return=1&type=donation&invoice=...` |
| `/international-payment` or `/international` or `/remittance` | `international-payment` | Public | Live bank/wire details from `system_settings` |
| `/find-ticket` or `/lookup` *(alias)* | `find-ticket` | Public | Search by mobile OR ID/token |
| `/ticket` or `/profile` | `ticket` | Public (if ticket active) / falls back to `TicketLookupModal` | `?id=...`, `?verify=...`, `?ticket=...`, `?token=...` |
| `/ticket/:idOrToken` | `ticket` | Public | Direct deep-link (`ticketQuery` uppercased) |
| `/notices` | `notices` | Public | Filterable circulars & attachments |
| `/gallery` | `gallery` | Public | Photos & videos archive |
| `/about` or `/contact` *(alias)* | `about` | Public | History, campus photo, objectives, helpline, contact form |
| `/portal` | `portal` | Public (`RoleDirectoryPortal`) | Directory of 5 admin roles + Field Scanner |
| `/admin` | `admin` | Admin session or `RoleDirectoryPortal` | Redirects to login gate if unauthenticated |
| `/admin/super-admin`, `/admin/admin`, `/admin/moderator`, `/admin/finance`, `/admin/registration` | `admin` / `dashboard` | Role-gated Admin Auth | Also accepts `/dashboard/:role`, `/super-admin`, `/finance`, `/moderator` shortcuts |
| `/admin/:tab` or `/dashboard/:role/:tab` | `admin` / `dashboard` | Authenticated Admin | Deep-links into specific tab (`allBookings`, `feeSettings`, etc.) |
| `/scanner` or `/scanner/:module` | `scanner` | Authenticated Event Staff / Super Admin | Modules: `multi_station`, `gate_scanner`, `food_breakfast`, `food_lunch`, `food_dinner`, `dress_distribution`, `staff_finance` |
| *PayStation Return:* `/?payment_return=1&type=registration\|donation&invoice_number=...` | `register` or `donate` | Public | Highest routing priority; opens verification flow |
| `/*` (any unknown path) | `404` | Public | Renders `NotFoundPage` preserving requested path |

---

## 5. Global App Shell Structure (`src/App.tsx`)

```
┌────────────────────────────────────────────────────────┐
│ Sticky Top Header (Header.tsx, .no-print)              │  <- Logo crest + Institution name + Desk links + Lang switch / Mobile hamburger
├────────────────────────────────────────────────────────┤
│ Main Content Viewport (<main className="flex-1">)      │  <- ErrorBoundary + Suspense Lazy Pages
├────────────────────────────────────────────────────────┤
│ Universal Footer (Footer.tsx, .no-print)               │  <- 4 Columns (About crest, Quick Links, Portals, Helpdesk) + Bottom Strip
├────────────────────────────────────────────────────────┤
│ Mobile Bottom Nav (MobileBottomNav.tsx, <640px fixed)  │  <- 5–6 Quick Buttons, safe-area inset bottom padding
└────────────────────────────────────────────────────────┘
  + Global Modal Overlay: PaymentModal (when checkout is active)
```

### 5.1 Header (`src/components/Header.tsx`)
- **Left Branding Button (returns to `/`):** Circular crest (`/assets/school_logo.png`), title (`institutionName`), subtitle (`Est. 1962 • Faridpur`). Flexible min-height (`min-h-[4.25rem]`) on phones; `h-20` on `sm:+`.
- **Desktop Nav (`lg+`):** Pill buttons for:
  1. `Home`
  2. `Register` *(only shown when `governanceStatus === 'ready'` AND `isGlobalRegistrationOpen(feeSettings)` is true)*
  3. `Donate` *(shown when `governanceStatus === 'ready'`; appends `(Closed)` / `(বন্ধ)` if `donationOpen === false`)*
  4. `Find My Ticket`
  5. `Notices`
  6. `Gallery`
  7. `About & Contact`
  8. **Bilingual Toggle Button:** Globe icon + `"বাংলা"` (when `en`) / `"English"` (when `bn`).
- **Mobile Controls (`< lg`):** Compact Language switcher pill + Hamburger menu (`Menu` / `X`), opening a scrollable slide-down drawer (`max-h-[calc(100vh-4.5rem)] overflow-y-auto`) with full-width pill nav items (plus `"Join"` badge on Register).

### 5.2 Mobile Bottom Navigation (`src/components/common/MobileBottomNav.tsx`)
- Visible strictly `< 640px` (`sm:hidden`), fixed bottom dark frosted pill bar (`bg-slate-900/95 backdrop-blur`).
- Contains up to 6 equal-width icon+label tabs (`min-h-[44px]`):
  1. `Home` / `হোম` (`Home` icon)
  2. `Register` / `নিবন্ধন` (`UserPlus` icon + pulsing blue dot badge when inactive — shown only if governance ready & global registration open)
  3. `Donate` / `অনুদান` (`HeartHandshake` icon — shown when governance ready)
  4. `Ticket` / `টিকিট` (`Ticket` icon — highlighted when on `find-ticket` or `ticket`)
  5. `Scanner` / `স্ক্যানার` (`QrCode` icon — goes to `/scanner`)
  6. `Admin` / `অ্যাডমিন` (`Shield` icon — goes to `/admin`)
- Clicking `Home` while leaving `admin`, `dashboard`, or `scanner` terminates any local administrative session cleanly (`SupabaseService.terminateAdministrativeSession({ forceLocal: true })`).

### 5.3 Footer (`src/components/Footer.tsx`)
- Dark Obsidian `bg-slate-900` (`pt-14 pb-10`), 4-column desktop / 1-column mobile grid:
  1. **Institution Block:** School emblem, name, `"Established: 1962"`, 65th anniversary description, Patronage badge (`District Police Administration, Faridpur`).
  2. **Quick Links:** Register (if open), Find My Ticket, Donate, Notices, Gallery.
  3. **Event Operations:** Two high-contrast rounded button cards — **All Staff Portal** (`All Staff` emerald pill badge → navigates to `/scanner` after clearing any prior admin session) and **Admin Portal** (`Admin` sky badge → navigates to `/admin` after clearing session) — plus a Security Notice card stating QR verification is required at gates.
  4. **Secretariat Contact:** Live CMS-driven title, address, helpline phone(s), and email from `AboutContactService`.
- **Bottom Copyright Strip:** `© 2027 <institutionName>. All Rights Reserved.` + `Celebrating 65 Years with ❤️ Alumni & Students`.

---

## 6. Page-by-Page Public UI Specification

### 6.1 Home Page (`/` — `src/components/HomePage.tsx`)
Sections are ordered and visibility-toggled dynamically via `feeSettings.homePageSections` (`DEFAULT_HOME_PAGE_SECTIONS`: `hero`, `featureCards`, `pillarsRibbon`, `countdown`, `status`, `fees`, `financials`, `notices`, `gallery`, `committee`).

1. **Hero Section (`hero`):**
   - Full-bleed panoramic image (`/assets/homepage/hero_panorama.jpg`) with frosted white gradient overlay (`bg-gradient-to-r from-white/95 via-white/80` desktop; `bg-white/90` mobile).
   - Left-aligned content stack: Italic serif tagline → Large `h1` Institution Title → Dark Navy pill (`Grand Reunion` + cyan `2027`) → Invitation paragraph → Two Sky-tinted Date & Venue pills → Optional Global Closure Warning box (if registration closed) → Primary CTA buttons (`Register Now` solid `#0284C7` pill, `Contribute / Donate` `#E2EEF8` pill with `(Closed)` chip if paused).
2. **Floating Stats Bar (overlaps bottom of Hero via `-mt-12 sm:-mt-16`):**
   - White `rounded-3xl` floating card (`2×2` grid on mobile with subtle `#F8FBFE` tile cards, `4`-column horizontal divided bar on `md+`), live synced via `ReunionStatsService` (Supabase RPC `rpc_get_public_reunion_stats` + Realtime):
     - Total Registered (`Users` icon)
     - Former Students (`GraduationCap` icon)
     - Current Students (`User` icon)
     - Batches Represented (`Users` icon)
3. **Three Main Feature Cards (`featureCards` — `grid-cols-1 md:grid-cols-3`):**
   - **Card 1 — Latest Notices:** Obsidian header + `"View All"`, 3 clickable preview rows with Date tiles (`Nov 15`) → links to `/notices`.
   - **Card 2 — Our Memories:** Obsidian header + `"View Gallery"`, 3 square photo previews (`memory_1..3.jpg`) → links to `/gallery`.
   - **Card 3 — Our Videos:** Obsidian header + `"View All"`, clickable promo video thumbnail (`video_thumb.jpg`) with centered Play icon & `1:57` duration chip → opens Promo Video Modal.
4. **Bottom Navy Wave Ribbon (`pillarsRibbon`):**
   - Dark Obsidian `rounded-3xl` card with subtle right-aligned `/assets/id_card/campus_footer.png` silhouette.
   - Displays 3 core pillars (`Reconnect with Friends`, `Celebrate Our Legacy`, `Strengthen Our Bond`) + `"Join the Reunion Journey →"` CTA button (if registration is open).
5. **Countdown Timer / Post-Event Celebration (`countdown`):**
   - **Active Mode:** White `rounded-3xl` card with `"Countdown to Grand Reunion 2027"` badge, event date/venue subtitle, and **4 solid Obsidian cards** (`Days`, `Hours`, `Minutes`, `Seconds`) counting down to `feeSettings.eventTargetDate` (default `2027-01-29`).
   - **Completed Mode (`timeLeft.isOver` or `simulateEventCompleted`):** Dark Obsidian celebration banner with Browse Photos, Watch Videos, and Explore Souvenir buttons.
6. **Check Registration Status & Ticket Widget (`status`):**
   - Centered card (`#check-status-section`) with `"Online Verification Portal"` badge.
   - 2-input + Submit row: `Registered Mobile Number` (`Enough` badge) + `OR Reg ID / Token` + `Verify Status` button. *(Calls `SupabaseService.lookupVerifiedTicket` — never leaks raw DB internals; supports both Registrations and Donations).*
   - Found Student card (avatar, ID pill, verified check, batch, T-shirt, payment total, `"View & Print Digital Ticket"` button) OR Found Patron card (amber gold theme + `"View Thank You Card"` button opening `ThankYouCardModal`) OR Not-Found alert with `"Register as New Attendee →"` link.
7. **Registration Fees & Categories (`fees`):**
   - Handles `loading`, `error` (with Retry button), and `!registrationOpen` (`GovernanceClosureNoticeCard`).
   - When open: `2-column` card grid comparing:
     - **Former Students (Alumni):** Sky border highlight, top-right corner ribbon (`Alumni` / `Temporarily Closed`), live `৳ <formerStudentFee> BDT`, 3 bullet perks, `"Register as Alumni →"` CTA (`/register/former`).
     - **Current Students:** Clean card, live `৳ <currentStudentFee> BDT`, 3 bullet perks, `"Register as Current Student →"` CTA (`/register/current`).
8. **Financial Transparency Dashboard (`financials` — `FinancialTransparencyDashboard.tsx`):**
   - Public audit banner + Header action buttons (`Refresh`, `Download CSV`, `Contribute / Donate`).
   - **Top 4 Metric Cards:** Total Money Collected, Total Donations Received, Total Verified Expenses, Remaining Fund Balance.
   - **Audit Collection Breakdown Strip (Dark card):** Approved Collection *(2-col span on mobile)*, Online Registrations, Manual (Approved), Pending Review *(excluded)*, Rejected *(excluded)*.
   - **3 Interactive Tabs:**
     1. *Expense Breakdown & Vouchers:* Clickable category progress bar cards + 2-col voucher cards opening `VoucherModal` (zoomable receipt + print/download).
     2. *Donation Transparency Ledger:* Search bar + Top 10 total badge + Top 3 Gold/Silver/Bronze Podium cards + Paginated cumulative leaderboard + privacy mask (`Hidden`) if `hideDonationAmounts` is ON.
     3. *Check My Donation History:* Personal lookup form (`rpc_verify_personal_donation_history`) returning cumulative & individual donor receipts + `ThankYouCardModal`.
9. **Latest Notices Preview (`notices`):** 3-card preview strip → links to `/notices`.
10. **Historical Photo Archive (`gallery`):** Full-bleed `bg-slate-900` dark section with 4 visual showcase cards (`2×2` mobile, `4`-col desktop) → links to `/gallery`.
11. **Organizing Committee (`committee` — `CommitteeSection.tsx`):**
    - Driven live by Supabase/CMS `CommitteeService`. Automatically hides if 0 active members.
    - Desktop (`md+`): 3–4 column grid of portrait cards (avatar + black SSC batch pill + Name + Role + 2-line Bio).
    - Mobile (`< 768px`): Touch-scrollable horizontal snap rail (`260px` card width) with left/right arrow controls and swipe counter hint (`1 - N`).

---

### 6.2 Student Registration Page (`/register` — `src/components/RegistrationPage.tsx`)
- **Persistence:** Saves and restores incomplete form state via `localStorage.plscf_registration_draft` and `PayStationService.getPendingSession()` across PayStation redirects, cancellations, or page reloads.
- **Post-Payment Success Banner:** Displayed when returning after a completed registration (`lastRegisteredName` + `"🎫 View Ticket"` button) while clearing the form for registering another family member/friend.
- **Category Selector (Top 2-Column Card):** Switch between **Former Student (Alumni)** (`৳ formerStudentFee`) and **Current Student** (`৳ currentStudentFee` — displays `Closed` lock pill if category switch is OFF). If selected category is paused, displays `GovernanceClosureNoticeCard` with optional button to switch to the other open category.
- **Current Student Gate (shown only when `category === 'current'`):**
  1. **Academic Verification Card:** Student ID input + `"Verify ID"` button (calls `StudentIdService` / `rpc_verify_student_id`).
  2. **Unverified Gate:** Locks personal/t-shirt/payment sections behind a dashed placeholder until verified against the institutional `current_student_ids` table (`AVAILABLE` status reserves the ID for the session).
  3. **Verified Read-Only Profile Card:** Green gradient card locking Student Name, Student ID, Enrolled Class, and Academic Year so students cannot tamper with institutional data (includes `"Change Student ID"` reset link).
- **Form Sections (visible for Alumni or verified Current Student):**
  1. **Personal Information:**
     - `Full Name` *(Alumni editable; Current Student locked from DB)* — min 2 chars, required
     - `Gender` (`Male` / `Female` pill toggle) — required *(unlocks Parent Pass if `female`)*
     - `Blood Group` (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`) — required
     - **Profile Photo (`<= 200 KB` auto-compression + Supabase `student-photos` upload):** `"📷 Take Photo"` (opens `SynchronizedCameraCardModal` with live card framing preview & `15.5:18` crop guide) OR `"📁 Upload Photo"` (`JPEG/PNG/WEBP`), preview thumbnail + compressed KB badge + `"Verified Cloud Storage"` chip.
     - `Mobile Number` (BD 11-digit `01[3-9]XXXXXXXX` live validator + `0/11` counter badge, must be unique) — required
     - `Email Address` *(Explicitly Optional — validated only if typed)*
     - `Current Address / City`
  2. **Accompanying Parent / Guardian Pass (`isParentEligible`):**
     - **Eligibility Rule:** Automatically shown if `gender === 'female'` OR (`category === 'current'` AND `isStudentBelowClass6(currentClass)` — Play/Nursery/KG or Classes 1–5).
     - Toggle checkbox (`hasParent`) adds `+ ৳ parentFee` (live from Supabase `system_settings`, e.g., `৳500` or `৳1,500`) and displays warning that T-shirts are NOT issued for guardians.
     - Conditional Parent Fields (all mandatory if checked): `Parent Full Name`, `Relation` (`Guardian` default, `Father`, `Mother`, `Sister`, `Brother`), `Parent Photo` (Camera/Upload + 200KB compressor + Supabase upload), `Parent Age` (`18–100`), `Parent 11-digit Mobile`.
  3. **Academic Details (`category === 'former'` only):**
     - `Passing Year` (`1962–2025` dropdown) + `Last Class Attended` (`SSC`, `HSC`, `Class 10`, `Class 8`, `Class 5`, `Class 3`, `Other`).
  4. **T-Shirt Selection (`grid-cols-3 sm:grid-cols-4 md:grid-cols-7`):**
     - Choices: `S`, `M`, `L`, `XL`, `XXL`, `XXXL`, `Oversize 50` *(spans full row on 3-col mobile)*.
     - `"View Size Chart"` button opens Size Guide modal (`Chest` 36"–46", `Length` 26"–31").
  5. **Optional Additional Donation (omitted automatically if `donationOpen === false`):**
     - Quick presets (`+ ৳500`, `+ ৳1000`, `+ ৳2000`, `+ ৳5000`, `Clear`) + numeric custom input.
  6. **Order Summary & Submit Card (Dark Obsidian card):**
     - Itemized breakdown: Registration Fee + Accompanying Parent Fee (if enabled) + Optional Donation + **Gateway Charge (1.8%)** = **Total Payable Amount (BDT)**.
     - Terms acceptance notice/checkbox & `"Proceed to Secure Payment"` primary CTA button → creates PayStation hosted checkout session and opens `PaymentModal`.

---

### 6.3 Payment Checkout & Verification Modal (`src/components/PaymentModal.tsx`)
- **States (`ModalStep`):**
  1. `processing`: Spinner while calling `verify-payment` Edge Function to create a `pending_orders` row and get signed `https://*.paystation.com.bd` checkout URL (domain-validated before redirect).
  2. `waiting`: Polling status every 5 s (up to 24 attempts / 2 min) while PayStation checkout is open in new tab, with manual `"Verify Payment Status"` & `"Re-open Payment Page"` buttons.
  3. `verifying`: Triggered automatically when user returns from PayStation (`?payment_return=1&invoice_number=...`). Calls server verification and promotes order into `registrations_2027` (+ optional `donations`).
  4. `success`: Shows transaction summary, tabbed **Student ID Card** (`StudentIdCardBadge`) & **Parent Entry Pass** (`ParentIdCardBadge`, if `hasParent`), plus `"Download / Print Full Ticket"` button.
  5. `failed`: Shows server error message, preserves form draft, allows retry or cancellation.

---

### 6.4 Donation Page (`/donate` — `src/components/DonationPage.tsx`)
- **Hero Header:** `"Grand Reunion Patronage & Welfare Fund"` badge, title, and Dark Obsidian live metric pill showing `Total Patronage Raised` (`৳`) + `Verified Donors` count.
- **Active Checkout Layout (`lg:grid-cols-12` — 8 cols Form / 4 cols Leaderboard):**
  - **Optional Top Banner:** `"International Payment (Overseas Bank Transfer)"` dark card (shown when `intlPaymentInfo.isEnabled`) linking to `/international-payment`.
  - **Step 1 — Amount Selector:** 6 preset pills (`৳500`, `৳1,000`, `৳2,500`, `৳5,000`, `৳10,000`, `৳25,000` in 3-col phone / 6-col desktop grid) + numeric custom BDT input validated against live `minDonation` (`100`) and `maxDonation` (`50000`).
  - **Step 2 — Donor Info:** 2-column form (`Full Name / Organization *`, `Batch / Affiliation`, `Mobile Number (11 Digits) *`, `Email Address`) + Checkbox `"Display my name as Well-Wisher / Anonymous on public roll"`.
  - **Step 3 — PayStation Checkout Summary:** Shows Donation Amount + `Gateway Charge (1.8%)` + `Total Payable BDT` and `"Donate ৳... via PayStation"` submit button.
  - **Pending Payment Box:** Amber live-polling banner if checkout opened in another window, with manual verify & cancel.
- **Completed Receipt View:** Replaces form after payment verification — shows Green Verified badge, interactive **`ThankYouCardBadge`** (`10:14` vector award card with PNG Image / PDF File / SVG / Print actions), itemized Voucher Summary, Print Official Receipt, and `"Make Another Donation"` button.
- **Right Sidebar — Donors Hall of Fame (TOP 10):** Dark card listing Top 10 patrons with 🥇🥈🥉 / `#4–#10` rank badges, respecting `hideDonationAmounts` privacy toggle.

---

### 6.5 International Payment Page (`/international-payment` — `src/components/InternationalPaymentPage.tsx`)
- Dynamic content synced from Supabase `system_settings.key = 'international_payment_info'` via `InternationalPaymentService`:
  - Back button → `/donate`
  - Dark hero card with Global badge, headline, subtitle, and event date pill
  - **Bank & Wire Details Grid (2 cols):** Bank Name, Branch & Address, Account Name, Bank Account Number, Routing Number, SWIFT/BIC Code — every card has a 1-click Copy-to-Clipboard button with green check feedback
  - **Helpline Cards (2 cols):** WhatsApp/Mobile helpline + Official Email (`mailto:`) with Copy buttons
  - **Transfer Instructions Card:** Numbered line-by-line remittance guidance

---

### 6.6 Ticket Lookup (`/find-ticket`) & Digital Ticket View (`/ticket` / `/ticket/:id`)
- **`TicketLookupModal` (`src/components/TicketLookupModal.tsx`):**
  - Centered search card calling Edge Function `secure-ticket-lookup` (`--no-verify-jwt`, HMAC IP/device rate-limited).
  - Accepts **Registered Mobile Number** (`Enough` badge) **OR** **Registration ID / Donation ID / 6-char Token**.
  - Renders either Student Match Card (`"View & Print Ticket"`) or Honored Donor Card (opens `ThankYouCardModal`). *Note: Simulated "Resend Email" UI was removed for production accuracy.*
- **`TicketView` (`src/components/TicketView.tsx`):**
  - Status Pill Banner: distinguishes Paid/Verified (Sky blue), Manual Pending Super Admin Approval (pulsing Amber lock banner — QR overlaid as `QR INACTIVE`), Rejected (Rose lock banner), and Unpaid.
  - Action Bar (`.no-print`): `"Register Another Student"`, `"Print / Save PDF"`, `"Back to Home"`.
  - **Official ID Card Showcase Boxes (for `paid` records):**
    1. *Student / Alumni ID Card Dark Sky Box* wrapping `StudentIdCardBadge` (`60 × 90 mm` PDF, PNG, SVG, Print).
    2. *Parent / Guardian Pass Dark Maroon Box* (if `hasParent`) wrapping `ParentIdCardBadge` + guardian details.
  - **A4 Printable Digital Entry Pass (`.print-ticket-container`):** Institutional crest header + verification badge + 3-column body (`Photo & Batch`, `Credential Box: Reg ID / Year / Class / T-shirt / Event Dates`, and `170px QR Code Canvas` + `TOKEN: XXXXXX`) + dark footer tear-off bar.

---

### 6.7 Notice Board (`/notices`), Gallery (`/gallery`), About & Contact (`/about`) & 404 (`/*`)
- **Notice Board (`NoticeBoardPage.tsx`):** Category tabs (`All`, `General`, `Registration`, `Event Schedule`, `Emergency`) + search bar + pinned blue-bordered cards + `GlobalPagination` + downloadable circular attachment.
- **Gallery (`GalleryPage.tsx`):** `Photo Gallery` / `Video Memories` toggle + 6 album filter pills (`All`, `1962–1980`, `1981–2000`, `2001–2025`, `Campus`, `Cultural`) + 1–4 col responsive cards + full Lightbox modal supporting photos, YouTube/Vimeo embeds, and direct `<video>` streams.
- **About & Contact (`AboutContactPage.tsx`):** School Crest + dynamic CMS History (`AboutContactService`), 3 Objectives cards, campus photo, Helpdesk card (`map-pin`, `phone`, `email`), and Contact Inquiry form (`Name`, strict 11-digit `01[3-9]XXXXXXXX` Mobile input, `Message`) inserting directly into Supabase `inquiries`.
- **404 Page (`NotFoundPage.tsx`):** Clean card displaying requested URL badge, `Return to Home`, `Registration Page`, `Find Ticket`, `About & Help`, and `Go Back` actions.

---

## 7. Role Portals, Admin Command & Field Scanner UI

### 7.1 Role Access Architecture (`src/types/index.ts`, `RoleDirectoryPortal`, `RoleLoginPage`)
- **`/portal` (`RoleDirectoryPortal.tsx`):** Dark obsidian showcase (`bg-slate-950`) presenting 6 distinct portal launch cards (5 admin/management roles + 1 Field Scanner card), language toggle, and Back to Main Site button.
- **5 Admin Portal Roles (`PORTAL_ROLE_CONFIGS`):**
  1. **Super Admin (`/admin/super-admin`):** Amber/Gold theme — unrestricted access across all sidebar & inline admin modules (`27` listed `allowedTabs` + all super-admin controls).
  2. **Admin (`/admin/admin`):** Blue theme — venue ops, manual registration, guest passes, bookings, IDs/cards, donations, t-shirts, tickets, analytics, notices, gallery, reports (`13` `allowedTabs`).
  3. **Moderator (`/admin/moderator`):** Emerald theme — read/verify oversight: bookings, tickets, ID cards, notices, master overview (`5` `allowedTabs`).
  4. **Finance Manager (`/admin/finance`):** Stone/Amber theme — budget, finances, payments, donations, manual registration approvals, daily analytics, reports (`7` `allowedTabs`).
  5. **Registration Officer (`/admin/registration`):** Cyan theme — venue registration desk, bookings, student IDs, ID cards, t-shirts, tickets (`6` `allowedTabs`).
- **Security Gates:**
  - `RoleLoginPage`: Authenticates against Supabase Auth (`signInWithPassword` + `rpc_resolve_login_email` username/email lookup + `admin_accounts` active/unlocked check). *Dev quick-fill buttons only appear if `isDevTestBypassAllowed()` (strictly `false` in production).*
  - `AccessDeniedGate`: Shown if an authenticated user visits a different role's URL (`/admin/...`), offering Navigate to Authorized Portal or Clean Logout & Switch.
  - `ForcePasswordChangeGate`: Blocks workspace access until temporary passwords (`mustChangePassword`) are replaced with a new password (`minLength=6`; dashboard auth settings can enforce `8–12+`).

### 7.2 Admin Dashboard (`src/components/AdminDashboard.tsx`)
- **Header Banner:** User pill (`@username`), active role badge, Supabase project indicator, Super Admin `"Edit About & Contact"` quick button, `"Refresh"` (re-syncs all stores from Supabase), and `"Log Out"`.
- **Responsive Navigation:**
  - *Desktop (`lg+`):* Sticky `w-72 xl:w-80` left sidebar with live module search input + 5 collapsible/labeled category groups.
  - *Mobile (`< lg`):* Current Section quick-selector bar + `"All Modules"` button opening full-height slide-out navigation drawer.
- **24 Sidebar Navigation Modules Across 5 Categories** *(plus 5 direct/inline views in `AdminDashboard`: `payments`, `tshirts`, `staff`, `finances`, `overview`)*:
  1. **Operations & Gate (`operations`):**
     - `masterOverview` (*Event Master Overview* — `MasterEventOverview.tsx`)
     - `gateManagement` (*Gate Entry & Scanner* `LIVE` badge — live inside/outside counters & inline gate log table)
     - `manualRegistration` (*Venue Registration Desk* `Desk` badge — `ManualRegistrationTab.tsx` for on-spot creation)
     - `manualApproval` (*Registration Approvals* `Admin` badge — `ManualApprovalTab.tsx` for Super Admin / Finance Manager approving/rejecting pending venue entries & financial inflows)
     - `mealControl` (*Meal Time & Scanner Control* `Food` badge — `MealTimeScannerControlPanel.tsx`)
     - `allBookings` (*All Bookings Database* — searchable, filterable, paginated attendee table + CSV export + edit photo `AdminStudentPhotoModal` + delete `rpc_delete_registration` + mobile card rows)
  2. **Credentials & Passes (`credentials`):**
     - `idCardManagement` (*Student ID Cards* `Cards` badge — `IdCardManagementPortal.tsx`: bulk PDF, 8-card A4 gang sheets, batch ZIP export, `IdCardPreviewModal`)
     - `studentIds` (*Student ID Database* — `StudentIdManagementTab.tsx`: CSV bulk import/CRUD for `current_student_ids`)
     - `guestManagement` (*VIP Guest Pass & Meals* `VIP` badge — `GuestManagementTab.tsx`)
     - `staffCardManagement` (*Staff Pass & Meal Suite* `Staff` badge — `StaffCardManagementTab.tsx`)
     - `tickets` (*QR Ticket Verification* — inline admin ticket lookup & verification)
  3. **Finance & Analytics (`finance`):**
     - `budgetManagement` (*Budget & Expenses* — `BudgetManagementTab.tsx`: central budget, staff allocations, expense voucher approvals)
     - `donations` (*Donations & Patrons* `Patrons` badge — inline donation management & manual records)
     - `dailyAnalytics` (*Daily Analytics* — `DailyAnalyticsTab.tsx`: time-series registration & inflow charts)
     - `reports` (*Export & Reports* — bulk Excel/CSV/JSON data exports)
  4. **Security & Access (`admin`):**
     - `userAccessManagement` (*User & Access Control* `RBAC` badge — `UserAccessManagementTab.tsx`: unified `admin_accounts` + `staff_accounts` provisioning, lock/unlock, password reset, session revocation)
     - `staffManagement` (*Staff Accounts & Roles* — `StaffManagementTab.tsx`)
     - `auditHistory` (*Security Audit Trail* — `AuditHistoryTab.tsx`: signed unified audit trail via `admin-audit` Edge Function)
     - `feeSettings` (*Registration, Donation & Settings* `Controls` badge — `RegistrationDonationControlPanel.tsx`: base fees, `parentFee`, `minDonation`, `maxDonation`, global/alumni/current/donation toggles, custom bilingual closure notices, homepage section ordering & visibility toggle, `hideDonationAmounts`, `simulateEventCompleted`)
  5. **Media & Content (`media`):**
     - `galleryManagement` (*Photo & Video Gallery* `CMS` badge — `GalleryManagementTab.tsx`)
     - `committeeManagement` (*Executive Committee (16)* `16 Cards` badge — `CommitteeManagementTab.tsx`)
     - `aboutContactManagement` (*Edit About & Contact Page* `Edit` badge — `AboutContactManagementTab.tsx` + Inquiries inbox)
     - `internationalPaymentManagement` (*International Payment Page* `Global` badge — `InternationalPaymentManagementTab.tsx`)
     - `notices` (*Notices & Media* — notice publisher CRUD)

### 7.3 Staff Scanner Portal (`/scanner` — `src/components/ScannerPortal.tsx`)
- **Login View:** Role selector (`ALL`, `GATE_STAFF`, `BREAKFAST_STAFF`, `LUNCH_STAFF`, `DINNER_STAFF`, `DRESS_STAFF`, `FINANCE_STAFF`, `SUPER_ADMIN`), Username/Email, Password/PIN.
- **Authenticated Operational Header:** Shows logged-in Staff name, role badge, Station/Gate, `"Sync Database"` button with live registration count, and `"Sign Out"`. Super Admin gets a 7-tab module switcher strip:
  1. `MultiStationDesk` (`multi_station`) — Unified gate + meals + T-shirt check-in desk on one screen.
  2. `GateScannerModule` (`gate_scanner`) — `QrCameraScanner` (rear/front toggle + hardware flashlight torch + Web Audio success/error beeps) + manual ID/Token entry supporting Student, Staff, and VIP Guest passes (`ENTRY` / `EXIT` / `BACK` anti-duplicate rules) + visual face-match photo check.
  3. `FoodScannerModule` (`food_breakfast`, `food_lunch`, `food_dinner`) — Enforces meal time-window governance (`MealTimeScannerControlPanel`) and marks one-time collection for Student, Accompanying Parent, Staff, and VIP Guest passes (`rpc_toggle_food_distribution`, `rpc_collect_guest_food`, `rpc_collect_staff_food`).
  4. `DressScannerModule` (`dress_distribution`) — Verifies paid student (blocks guardian passes from T-shirts!) and marks registered size collection (`rpc_toggle_tshirt_distribution`).
  5. `StaffFinanceModule` (`staff_finance`) — Field expense submission with receipt image upload and balance ledger tracking against staff allocations.

> **Production Security Rule:** All `"Quick Test"` / `"Auto-fill"` helper panels in `ScannerPortal`, `GateScannerModule`, `FoodScannerModule`, `DressScannerModule`, `HomePage`, `RegistrationPage`, `TicketLookupModal`, and `RoleLoginPage` MUST remain gated behind `isDevTestBypassAllowed()` (strictly `false` in production).

---

## 8. Core Business Rules & Fee Math (`src/utils/rules.ts`)

- **Bangladeshi Mobile Rule:** Regex `/^(?:\+?88)?01[3-9]\d{8}$/`, normalized to 11 digits starting with `01`.
- **Total Fee Formula (`calculateTotalFee` & `calculateGatewayCharge`):**
  - `baseFee` = `formerStudentFee` (default `1500`) OR `currentStudentFee` (default `500`) from `system_settings.portal_fee_settings`.
  - `parentFee` = `hasParent ? configuredParentFee : 0` (live from `system_settings`, e.g. `500`).
  - `subtotal = baseFee + parentFee + validDonation`.
  - `gatewayCharge = Math.round(subtotal * 0.018 * 100) / 100` (**flat 1.8% uniform gateway charge**).
  - `totalPayableWithCharge = subtotal + gatewayCharge`.
  - PayStation receives `pay_with_charge: 0` with `payment_amount: totalPayableWithCharge` because 1.8% is already explicitly itemized and added.
- **QR Code Safe Payload (`formatSafeQrPayload`):** Encodes **only** Registration ID and 6-char QR token (`fn_generate_six_char_token`) — **zero PII** (no phone, email, or address inside the QR payload).
- **Photo Upload Compression (`compressImageTo200KB` + `readValidatedImage`):** Client validates MIME/magic bytes (`JPEG/PNG/WEBP`), crops portrait to `31:36` (`620×720px`) when using camera modal, compresses to `<= 200 KB`, and uploads to Supabase Storage bucket `student-photos`.

---

## 9. Supabase Backend, Storage & Edge Functions Contract

### 9.1 Supabase Storage Buckets
1. **`student-photos`** (`public: true`, max `5 MB`, `image/jpeg | image/png | image/webp`) — Public can upload registration photos (`INSERT`), authenticated admins can update/delete.
2. **`committee-photos`** (`public: true`, max `5 MB`, `image/jpeg | image/png | image/webp`) — Public read (`SELECT`), admin write (`current_admin_role() IS NOT NULL`).
3. **`payment-receipts`** (`public: false`, max `5 MB`, `image/jpeg | image/png | application/pdf`) — Public insert (manual deposit slips), admin-only manage/read.

### 9.2 Key `system_settings` Keys
- `'portal_fee_settings'` — `FeeSettings` JSON (fees, parentFee, min/max donation, `gatewayChargePercent`, open switches, `closureNotices`, `homePageSections`, `hideDonationAmounts`, `eventTargetDate`, `simulateEventCompleted`).
- `'international_payment_info'` — Bank name, branch, account name/number, routing, SWIFT, helpline phone/email, bilingual transfer instructions.

### 9.3 Edge Functions (`supabase/functions/`)
| Function | Auth / JWT Flag | Purpose & Secrets Required |
|---|---|---|
| `verify-payment` | `--no-verify-jwt` *(public + IPN)* | Initiates PayStation sessions, validates server-side fees from `system_settings`, receives PayStation Merchant IPN callbacks (`https://<project>.supabase.co/functions/v1/verify-payment`), runs `rpc_promote_pending_order_to_registration` idempotently. Secrets: `PAYSTATION_MERCHANT_ID`, `PAYSTATION_PASSWORD`, `PAYSTATION_ENV`, `PAYSTATION_ALLOW_PAYMENT_FINALIZATION`, `PAYMENT_SIGNING_SECRET`, `APP_ALLOWED_ORIGINS`. |
| `secure-ticket-lookup` | `--no-verify-jwt` *(public)* | Public `/find-ticket` & Home status verification with HMAC IP/device rate limiting (`RATE_LIMIT_HMAC_SECRET`, `APP_ALLOWED_ORIGINS`). |
| `verify-student-id` | JWT Required (`authenticated`) | Admin/staff institutional Student ID verification/management. |
| `admin-audit` | JWT Required (`authenticated`) | Super Admin audit log retrieval & cryptographic integrity (`AUDIT_SIGNING_SECRET`). |

### 9.4 Core Authoritative Tables & RPCs
- **Primary Authoritative Tables:** `registrations_2027`, `donations`, `donations_2027`, `pending_orders`, `payment_transactions`, `ipn_logs`, `current_student_ids`, `admin_accounts`, `staff_accounts`, `system_settings`, `gallery_media`, `about_contact_content`, `inquiries`, `food_distributions`, `dress_distributions`, `gate_events`, `scanner_logs`, `guest_cards`, `guest_card_batches`, `guest_food_collections`, `staff_cards`, `staff_card_batches`, `staff_card_activations`, `staff_food_collections`, `central_budget`, `staff_allocations`, `staff_expenses`, `financial_ledger`, `expense_categories`, `meal_scanner_controls`, `manual_registrations`, `admin_audit_logs`. *(Note: Legacy `rms_*` and `committee_members` tables were dropped in migration `20270301000000` — committee data is managed via CMS JSON / `about_contact_content` / `CommitteeService`.)*
- **Public Anon-Callable RPCs:** `rpc_get_public_governance_settings`, `rpc_get_public_reunion_stats`, `rpc_lookup_ticket`, `rpc_lookup_donation`, `rpc_verify_student_qr`, `rpc_verify_student_id`, `rpc_reserve_student_id`, `rpc_release_student_id_reservation`, `rpc_get_financial_transparency_summary`, `rpc_verify_personal_donation_history`, `rpc_resolve_login_email`, `current_admin_role`, `current_event_staff_role`.
- **Restricted Admin / Staff / Service-Role RPCs:** All mutations (`rpc_delete_registration`, `rpc_create_manual_registration`, `rpc_approve_manual_registration`, `rpc_confirm_gate_event`, `rpc_toggle_food_distribution`, `rpc_toggle_tshirt_distribution`, `rpc_promote_pending_order_to_registration`, `rpc_verify_payment`, etc.) have `EXECUTE` revoked from `anon` and `PUBLIC`.

---

## 10. Checklist for UI Remake Parity

If rebuilding this UI from scratch:
- [ ] Preserve exact **Light Sky Edition** tokens (`#F0F6FA`, `#0F172A`, `#0284C7`, `#0EA5E9`, `#38BDF8`, `#E2EEF8`) for public pages and dark slate/role gradients for `/portal` & `/scanner`.
- [ ] Preserve **full Bangla (`bn`) + English (`en`) switchability** with default `'bn'` and `16px+` mobile inputs.
- [ ] Include **sticky Header + mobile hamburger drawer + fixed `< 640px` frosted Bottom Nav** with `overflow-x: clip` and safe-area bottom inset clearance.
- [ ] Build **4-card live stats bar**, **3-card Notices/Memories/Videos strip**, **Pillars ribbon**, **4-unit Countdown timer**, **Verification widget**, **2-tier Fee cards**, **Financial Transparency Portal**, **3-card Notices strip**, **4-card Archive**, and **CMS Organizing Committee horizontal mobile carousel / desktop grid**.
- [ ] Keep **Current Student ID database lock**, **Accompanying Parent Pass rules**, **`<= 200 KB` photo compression + live card camera preview**, **`1.8%` gateway charge breakdown**, **`60×90 mm` vector ID cards**, and **`10:14` vector Thank You Card** intact.
- [ ] Enforce **zero test UI / quick-fill credentials in production** and route all payments strictly through Supabase Edge Function `verify-payment`.
