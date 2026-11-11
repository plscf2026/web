# API Documentation & Service Integrations
## Police Lines High School & College, Faridpur Reunion 2027

---

## 1. Authentication & Security Headers
All administrative RMS endpoints require bearer token authentication or API secret validation:
```http
Authorization: Bearer <SUPABASE_SERVICE_OR_USER_TOKEN>
Content-Type: application/json
X-Client-Version: 2027.1.0
```

---

## 2. Public Registration & Ticketing Endpoints

### 2.1 Verify Current Student ID
- **Endpoint**: `POST /api/verify-student-id`
- **Description**: Validates that an entered student ID is registered and not already used.
- **Request Payload**:
```json
{
  "studentId": "PLSC-2024-0012",
  "batch": "Class 10 Section A"
}
```
- **Response**:
```json
{
  "status": "AVAILABLE",
  "valid": true,
  "studentName": "Tanvir Ahmed",
  "reservationExpiresIn": 600
}
```

### 2.2 Submit Attendee Registration
- **Endpoint**: `POST /api/register`
- **Request Payload**:
```json
{
  "fullName": "Mahmudul Hasan",
  "mobileNumber": "01711223344",
  "email": "mahmud@example.com",
  "category": "former",
  "passingYear": "2012",
  "batchName": "SSC 2012",
  "tShirtSize": "XL",
  "photoUrl": "data:image/jpeg;base64,...",
  "registrationFee": 1500,
  "donationAmount": 500
}
```
- **Response**:
```json
{
  "success": true,
  "registrationId": "PLSCF-2026-F8941",
  "totalPayable": 2000,
  "paymentStatus": "pending"
}
```

---

## 3. PayStation Payment Gateway API

### 3.1 Create Payment Intent
- **Endpoint**: `POST https://api.paystation.com.bd/grant-token` & `/create-payment`
- **Request Payload**:
```json
{
  "merchantId": "POLICE_LINES_2027",
  "orderId": "PLSCF-2026-F8941",
  "amount": 2000,
  "currency": "BDT",
  "customerName": "Mahmudul Hasan",
  "customerPhone": "01711223344",
  "callbackUrl": "https://reunion2027.policelines.edu.bd/api/payment/callback"
}
```
- **Response**:
```json
{
  "status": "success",
  "paymentUrl": "https://checkout.paystation.com.bd/process?token=xyz987"
}
```

---

## 4. RMS ERP Internal API Service (`RmsStore`)

### 4.1 Budget Request Submission
- **Method**: `RmsStore.submitBudgetRequest(requestData)`
- **Payload Schema**:
```typescript
{
  committeeId: string;
  committeeName: string;
  requestTitle: string;
  expenseCategory: string;
  requestedAmount: number;
  description: string;
  supportingDocuments: string[];
  requestedBy: string;
  requestedByName: string;
}
```

### 4.2 Financial Expense Reversal
- **Method**: `RmsStore.reverseExpense(expenseId, reversalReason, authorizedBy)`
- **Constraint**: `reversalReason.length >= 8`
- **Effect**: Updates voucher status to `REVERSED`, decrements `budgetSpent`, and records audit log.

### 4.3 Incident Dispatch Desk
- **Method**: `RmsStore.reportIncident(incidentData)`
- **Payload Schema**:
```typescript
{
  incidentType: 'SECURITY' | 'MEDICAL' | 'TECHNICAL' | 'CROWD_MANAGEMENT' | 'FOOD_BEVERAGE' | 'LOST_FOUND' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  location: string;
  description: string;
  reportedBy: string;
  reportedByName: string;
  assignedTeam: string;
}
```

