# Existing API Documentation & Service Layer
## Police Lines High School & College, Faridpur Reunion Platform

---

## 1. Overview
The platform integrates client-side services, Supabase database bindings, and third-party payment APIs to execute event registration, verification, and administrative operations.

---

## 2. Service Layer Breakdown

### 2.1 `SupabaseService` (`src/services/supabase.ts`)
Interacts with Supabase PostgreSQL tables and authentication mechanisms:
- `fetchRegistrations(year?: number): Promise<{ data: RegistrationRecord[], tableUsed: string }>`: Fetches all confirmed registrations from the year-partitioned table.
- `saveRegistration(reg: RegistrationRecord): Promise<{ success: boolean, data?: RegistrationRecord, error?: string }>`: Upserts attendee record into Supabase.
- `deleteRegistration(id: string, reason: string): Promise<boolean>`: Removes an erroneous record after recording mandatory justification.
- `loginAdmin(username, password): Promise<{ success: boolean, account?: AdminAccount, error?: string }>`: Validates credentials and claims the single-slot session token.
- `getActiveAdminSession(): Promise<AdminAccount | null>`: Validates session token heartbeat.
- `logoutAdmin(): Promise<void>`: Releases the active session lock.

### 2.2 `PayStationService` (`src/services/paystation.ts`)
Official API client for PayStation Bangladesh payment gateway:
- `grantToken(): Promise<string>`: Authenticates with PayStation using merchant credentials and retrieves bearer token.
- `createPayment(params): Promise<{ status: string, payment_url: string }>`: Generates a hosted checkout redirect URL for bKash, Nagad, Rocket, cards.
- `retrieveTransaction(trxId): Promise<PayStationTransaction>`: Retrieves verified settlement status directly from the gateway server.
- `completeRegistrationWithPayStation(registrationData, paymentResponse)`: Finalizes registration, stamps HMAC verification signature, marks payment status as `paid`, and issues QR token.

### 2.3 `AppStore` (`src/services/store.ts`)
Authoritative local data store with dual-sync capability:
- `getRegistrations(): RegistrationRecord[]`: Returns cached registration records.
- `addRegistration(reg): void`: Appends verified attendee record.
- `updateRegistration(id, updates): void`: Modifies attendee attributes (e.g. t-shirt collected).
- `getDonations(): DonationRecord[]`: Retrieves voluntary donations.
- `getExpenses(): ExpenseRecord[]`: Retrieves local operational expenses.
- `getScanLogs(): ScanLog[]`: Returns gate and meal barcode scan history.
- `isStudentInside(regId): boolean`: Evaluates scan logs to determine if an attendee is currently inside the venue.

### 2.4 `StudentIdService` (`src/services/studentIdStore.ts`)
Atomic validation and reservation of current student identification cards:
- `verifyStudentId(studentId, batch): { status, valid, studentName }`: Checks student status against inventory.
- `reserveStudentId(studentId, ttlSeconds)`: Locks the student ID for 10 minutes during payment checkout.
- `confirmStudentIdUsed(studentId, regId)`: Permanently binds the student ID to a completed registration.
- `releaseReservation(studentId)`: Frees the reserved ID if payment checkout is cancelled.

### 2.5 `RmsStore` (`src/services/rmsStore.ts`)
Reunion Management System persistence engine:
- `getCommittees()`, `createCommittee()`, `updateCommittee()`: Dynamic committee management.
- `getTasks()`, `createTask()`, `updateTaskStatus()`: Task lifecycle state machine.
- `getBudgetRequests()`, `submitBudgetRequest()`, `updateBudgetRequestStatus()`: 3-step budget approvals.
- `getExpenses()`, `recordExpense()`, `reverseExpense()`: Voucher tracking and zero-silent-deletion reversals.
- `getSponsors()`, `saveSponsor()`: Corporate partner CRM and branding delivery checklists.
- `getDocuments()`, `uploadDocument()`: Document repository with role permissions.
- `getMeetings()`, `scheduleMeeting()`: Agenda, attendance roll call, and minutes archiving.
- `getVolunteers()`, `saveVolunteer()`, `volunteerCheckIn()`, `volunteerCheckOut()`: Duty rosters and shift telemetry.
- `getIncidents()`, `reportIncident()`, `updateIncidentStatus()`: Event day incident dispatch desk.
- `getWeeklyReports()`, `submitWeeklyReport()`, `reviewWeeklyReport()`: Committee progress reporting.
- `getAuditLogs()`: Tamper-evident system audit trail.

