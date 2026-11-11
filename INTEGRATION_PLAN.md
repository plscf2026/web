# Reunion Management System (RMS) Integration Plan
## Inside Existing Admin Panel (`AdminDashboard.tsx`)

---

## 1. Integration Objective
Embed the complete Reunion Management System (RMS) directly inside the existing **Admin Panel** (`src/components/AdminDashboard.tsx`) without altering or breaking any existing administrative features, database schemas, registration records, or payment gateway workflows.

---

## 2. Core Architectural Principles
1. **Zero Data Duplication**: Attendee, batch, and financial metrics in the RMS modules will query existing registration and payment records directly from `AppStore.getRegistrations()` and `SupabaseService`.
2. **Unified Admin Interface**: Rather than isolating RMS to an external portal, administrators will access RMS directly inside `AdminDashboard.tsx` under a dedicated sidebar / section group named **REUNION MANAGEMENT**.
3. **Preserve All Existing Tabs**: The existing tabs (`Master Overview`, `Budget & Expenses`, `Daily Analytics`, `Staff & Roles`, `Audit Trail`, `All Bookings (Supabase)`, `Student ID Management`, `Fee Settings`, `Tickets`, `Notices`, `Reports`) will remain completely intact.
4. **Consistent Design Language**: The new RMS sub-modules will adopt the existing admin design tokens:
   - Primary Navy: `#172554`
   - Accent Gold: `#C5A45D`
   - Status Emerald: `#059669`
   - Background: Slate `#F8FAFC`

---

## 3. Specification of the 12 New RMS Modules

| Module # | Module Name | Core Functionality | Existing Data Integrated |
|:---:|---|---|---|
| **1** | **Central Dashboard** | Executive reunion countdown, real-time confirmed vs pending counts, verified collection totals, committee health matrix | `registrations`, `donations`, `RmsStore.getCommittees()` |
| **2** | **Batch Management** | Batch-wise participant counts, graduation year filters, batch representative assignments, batch financial totals | `registrations` grouped by `batchName` & `passingYear` |
| **3** | **Committee Management** | Dynamic committee creation, Director & Assistant Director assignment, responsibilities, budget allocation | `RmsStore.getCommittees()` |
| **4** | **Member Management** | Centralized member directory, role assignment, contact info, cross-committee assignments | Reuses `registrations` + committee assignments |
| **5** | **Task Management** | Multi-view task board (Kanban, List, Calendar), deliverable proof submission, Director approval | `RmsStore.getTasks()` |
| **6** | **Event & Program Management** | January 28-29 timeline, stage readiness monitors, cultural program & Qawwali artist coordination | Event schedule & milestones |
| **7** | **Finance Management** | Verified registration income + sponsorships vs approved expenses, 3-step requisitions, mandatory reversal audit | Verified payments + `RmsStore.getExpenses()` |
| **8** | **Document Management** | Categorized archive of permission letters, vendor contracts, meeting minutes, venue diagrams | `RmsStore.getDocuments()` |
| **9** | **QR Check-in Management** | Multi-station QR scanner (Gate, Food, Kit bag), duplicate check-in prevention, live check-in telemetry | `scanLogs` + `registrations` |
| **10** | **Reports & Analytics** | Batch summaries, committee KPIs, financial balance sheets, CSV and print exports | Real aggregated database numbers |
| **11** | **Activity Logs** | Immutable system-wide administrative audit trail | `RmsStore.getAuditLogs()` |
| **12** | **Settings** | Event target dates, registration fee settings, online registration toggles, committee policies | `FeeSettings` + `AppStore.getFeeSettings()` |

---

## 4. Phased Implementation Roadmap
- **Phase 1**: System audit and schema documentation (Completed).
- **Phase 2**: Admin Panel navigation integration: Add `REUNION MANAGEMENT` section in `AdminDashboard.tsx`.
- **Phase 3**: Connect the 12 dedicated sub-views using existing database tables and `RmsStore`.
- **Phase 4**: Verification & QA testing: Ensure 0 TypeScript errors, 100% passing tests, and sub-second production builds.

