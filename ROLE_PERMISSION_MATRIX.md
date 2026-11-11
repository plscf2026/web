# Role & Permission Matrix (RBAC Specification)
## Sylhet Police Lines High School & College Reunion 2027

---

## 1. Governance Principles
The RMS security architecture enforces the **Principle of Least Privilege (PoLP)** and **Separation of Concerns**:
1. **Advisory Oversight**: The Chief Adviser (Institution Principal) possesses transparent read-only visibility over all operations, budgets, and audit logs without modification authority.
2. **Dual-Key Financial Authority**: Budget requests must be vetted by the Finance Officer before the Convener or Super Admin can grant formal approval.
3. **Immutability of Financial Disbursements**: Direct deletion of approved expenses is programmatically blocked. Reversals must be authorized by an executive officer and accompanied by an audit reason.
4. **Director Approval of Task Deliverables**: Committee members may transition tasks from `IN_PROGRESS` to `REVIEW_REQUESTED`, but only Committee Directors, the Convener, or the Super Admin can verify deliverables and mark tasks `COMPLETED`.

---

## 2. Comprehensive RBAC Matrix

| ERP Functional Module | Super Admin | Chief Adviser (Principal) | Convener (Monowar Shikder) | Member Secretary (Siddiqur Rahman) | Committee Director (Sagar & 11) | Assistant Director | Committee Member | Finance Officer | Field Volunteer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Executive Overview** | Full | View Only | Full | Full | Own Comm. | Own Comm. | Own Comm. | View Only | View Only |
| **Committee Config** | Full | View Only | Full | Full | View Only | View Only | View Only | View Only | No |
| **Add / Transfer Members** | Full | View Only | Full | Full | Own Comm. | No | No | No | No |
| **Create Task** | Full | View Only | Full | Full | Own Comm. | Own Comm. | No | No | No |
| **Submit Task Evidence** | Yes | No | Yes | Yes | Yes | Yes | Yes | No | No |
| **Approve Task Deliverables**| Yes | No | Yes | Yes | Own Comm. | No | No | No | No |
| **Submit Budget Request** | Yes | No | Yes | Yes | Own Comm. | Own Comm. | No | No | No |
| **Finance Vetting / Recommend**| Yes | No | No | No | No | No | No | **Full** | No |
| **Final Budget Approval** | **Full** | No | **Full** | **Full** | No | No | No | No | No |
| **Record Expense / Voucher**| Yes | No | Yes | Yes | Own Comm. | Own Comm. | No | Yes | No |
| **Verify Expense Voucher** | Yes | No | No | No | No | No | No | **Full** | No |
| **Reverse Expense (Audit)** | **Yes** | No | **Yes** | **Yes** | No | No | No | No | No |
| **Sponsorship CRM** | Full | View Only | Full | Full | View Only | View Only | No | View Only | No |
| **Deliverable Checklists** | Full | View Only | Full | Full | Assigned | Assigned | No | No | No |
| **Upload Documents** | Full | View Only | Full | Full | Own Comm. | Own Comm. | Own Comm. | Finance Docs| No |
| **Schedule Meetings** | Full | View Only | Full | Full | Own Comm. | Own Comm. | No | No | No |
| **Record Meeting Minutes** | Full | View Only | Full | Full | Own Comm. | No | No | No | No |
| **Publish Announcements** | Full | View Only | Full | Full | No | No | No | No | No |
| **Enlist Volunteers** | Full | View Only | Full | Full | Own Comm. | Own Comm. | No | No | No |
| **Volunteer Check-In/Out** | Full | View Only | Full | Full | Own Comm. | Own Comm. | No | No | Self / Desk |
| **Report Field Incident** | Full | View Only | Full | Full | Full | Full | Full | Full | Full |
| **Resolve Incident** | Full | View Only | Full | Full | Assigned | Assigned | No | No | No |
| **Submit Weekly Report** | Yes | No | Yes | Yes | **Own Comm.** | No | No | No | No |
| **Approve Weekly Report** | **Full** | View Only | **Full** | **Full** | No | No | No | No | No |
| **Audit Log Inspection** | Full | View Only | Full | Full | Own Action | No | No | Financials | No |
| **Audit Log CSV Export** | **Full** | View Only | **Full** | **Full** | No | No | No | Financials | No |

---

## 3. Universal Test Credentials

All personas can be tested locally using the unified authentication credential:
- **Universal PIN / Password**: `admin@123`

### Pre-Configured Test Personas
1. **Super Admin**: `admin@gmail.com`
2. **Chief Adviser (Principal)**: `principal@policelines.edu.bd`
3. **Convener**: `monowar@policelines.edu.bd`
4. **Member Secretary**: `siddiqur@policelines.edu.bd`
5. **Registration Director (Sagar)**: `sagar@policelines.edu.bd`
6. **Finance Desk Officer**: `finance@gmail.com`

