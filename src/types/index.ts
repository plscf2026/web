export type StudentCategory = 'former' | 'current';

export type TShirtSize = 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL' | 'Oversize 50';

export type PaymentMethod = 'bkash' | 'nagad' | 'rocket' | 'card';

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export type Language = 'en' | 'bn';

export interface RegistrationRecord {
  id: string; // e.g. PLSCF-2026-F8941
  fullName: string;
  fullNameBn?: string;
  photoUrl: string;
  mobileNumber: string;
  email?: string | null; // Optional: attendees can register without an email address
  address: string;
  category: StudentCategory;
  studentId?: string | null; // Mandatory verified ID for current students
  passingYear?: string; // for former (e.g. 1998, 2012)
  lastClassAttended?: string | null; // optional for former students who left before SSC
  currentClass?: string; // for current (e.g. Class 9, Class 10, Class 11, Class 12)
  batchName: string; // e.g. SSC 2012, HSC 2014, Class 10 Section A
  groupOrSection?: string | null; // Section A/B for current students (Group removed from Alumni)
  rollNumber?: string;
  tShirtSize: TShirtSize;
  registrationFee: number;
  donationAmount: number;
  totalPaid: number;
  paymentStatus: PaymentStatus;
  transactionId: string;
  paymentMethod: PaymentMethod;
  registeredAt: string;
  qrToken: string;
  isTShirtCollected: boolean;
  notes?: string;
  year?: number;
  serverVerificationSignature?: string;
  verificationTimestamp?: string;
  verifiedBy?: string;
}

export interface ScanLog {
  id: string;
  registrationId: string;
  studentName: string;
  studentCategory: StudentCategory;
  scanType: 'entry' | 'exit';
  timestamp: string;
  staffId: string;
  staffName: string;
  gateId: string;
  status: 'approved' | 'rejected' | 'supervisor_review';
  failureReason?: string;
}

export interface DonationRecord {
  id: string;
  donorName: string;
  mobileNumber: string;
  email: string;
  amount: number;
  purpose: string;
  paymentMethod: PaymentMethod;
  transactionId: string;
  date: string;
  paymentStatus?: PaymentStatus;
  year?: number;
  createdAt?: string;
}

export interface NoticeItem {
  id: string;
  titleEn: string;
  titleBn: string;
  category: 'general' | 'registration' | 'event' | 'payment' | 'emergency';
  date: string;
  contentEn: string;
  contentBn: string;
  isPinned: boolean;
  attachmentName?: string;
}

export type StaffRole =
  | 'super_admin'
  | 'admin'
  | 'registration_mgr'
  | 'finance_mgr'
  | 'scanner_staff'
  | 'scanner_supervisor'
  | 'content_mgr';

export interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  role: StaffRole;
  gateAssigned: string;
}

export interface ExpenseRecord {
  id: string;
  category: string;
  amount: number;
  reason: string;
  date: string;
  responsiblePerson: string;
  receiptRef: string;
}

export interface FeeSettings {
  formerStudentFee: number;
  currentStudentFee: number;
  registrationOpen: boolean;
  startDate: string;
  endDate: string;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  closedMessageEn?: string;
  closedMessageBn?: string;
  eventTargetDate?: string;
  simulateEventCompleted?: boolean;
  homePageSections?: HomePageSectionSetting[];
}

export type HomePageSectionId =
  | 'hero'
  | 'countdown'
  | 'status'
  | 'fees'
  | 'notices'
  | 'gallery'
  | 'committee';

export interface HomePageSectionSetting {
  id: HomePageSectionId;
  visible: boolean;
}

export const DEFAULT_HOME_PAGE_SECTIONS: HomePageSectionSetting[] = [
  { id: 'hero', visible: true },
  { id: 'countdown', visible: true },
  { id: 'status', visible: true },
  { id: 'fees', visible: true },
  { id: 'notices', visible: true },
  { id: 'gallery', visible: true },
  { id: 'committee', visible: true },
];

export interface AdminAccount {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'super_admin' | 'registration_officer' | 'gate_scanner' | 'finance_manager';
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminUsername: string;
  adminRole: string;
  action:
    | 'ADMIN_LOGIN'
    | 'PAYMENT_VERIFIED_SERVER'
    | 'PAYMENT_STATUS_UPDATE'
    | 'FEE_SETTINGS_UPDATE'
    | 'STUDENT_RECORD_UPDATE'
    | 'STUDENT_RECORD_DELETE'
    | 'TSHIRT_DISTRIBUTED'
    | 'GATE_CHECKIN'
    | 'DATABASE_BACKUP_EXPORT'
    | 'SECURITY_AUDIT_EXECUTION';
  targetType: 'registration' | 'donation' | 'fee_settings' | 'admin_account' | 'system';
  targetId: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  checksum?: string;
}

export interface SecurityAuditItem {
  id: string;
  requirementNumber: number;
  title: string;
  description: string;
  status: 'passed' | 'warning' | 'failed' | 'in_progress';
  category: 'Access Control' | 'Data Protection' | 'Payment Integrity' | 'Infrastructure' | 'Compliance';
  verificationMethod: string;
  policyCode?: string;
  lastTestedAt?: string;
}

export interface PaymentVerificationResponse {
  valid: boolean;
  code: 'VERIFIED' | 'INVALID_FORMAT' | 'DUPLICATE_REPLAY' | 'AMOUNT_MISMATCH' | 'GATEWAY_ERROR';
  message: string;
  transactionId: string;
  paymentMethod: PaymentMethod;
  verifiedAmount: number;
  serverVerificationSignature?: string;
  verificationTimestamp?: string;
}

// ==========================================
// EVENT MANAGEMENT SYSTEM TYPES (PARTS 2 - 10)
// ==========================================

export type EventStaffRole =
  | 'SUPER_ADMIN'
  | 'BREAKFAST_STAFF'
  | 'LUNCH_STAFF'
  | 'DINNER_STAFF'
  | 'GATE_STAFF'
  | 'DRESS_STAFF'
  | 'FINANCE_STAFF';

export type DepartmentType =
  | 'BREAKFAST'
  | 'LUNCH'
  | 'DINNER'
  | 'DRESS'
  | 'GATE'
  | 'FINANCE'
  | 'ALL_SERVICES';

export type StaffPermissionAction =
  | 'VIEW'
  | 'SCAN'
  | 'VERIFY'
  | 'APPROVE'
  | 'REJECT'
  | 'EXPORT'
  | 'MANAGE';

export interface StaffAccount {
  id: string; // STF-001, etc.
  authUserId: string;
  fullName: string;
  username: string;
  email: string;
  role: EventStaffRole;
  department: DepartmentType;
  permissions: StaffPermissionAction[];
  status: 'ACTIVE' | 'DISABLED';
  assignedGate?: string;
  createdAt: string;
  createdBy?: string;
}

export interface FoodDistributionRecord {
  id: string;
  registrationId: string;
  studentName: string;
  batchName: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  status: 'COLLECTED' | 'CANCELLED';
  collectedAt: string;
  staffId: string;
  staffName: string;
  notes?: string;
  correctedBy?: string;
  correctionReason?: string;
  correctedAt?: string;
}

export interface GateEventRecord {
  id: string;
  registrationId: string;
  studentName: string;
  batchName: string;
  photoUrl?: string;
  eventType: 'ENTRY' | 'EXIT';
  gateId: string;
  scannerId?: string;
  staffId: string;
  staffName: string;
  timestamp: string;
  status: 'APPROVED' | 'DENIED' | 'REVISED';
  correctionReason?: string;
  correctedBy?: string;
  correctedAt?: string;
}

export interface DressDistributionRecord {
  id: string;
  registrationId: string;
  studentName: string;
  itemType: string; // 'reunion_tshirt'
  registeredSize: TShirtSize | 'XS';
  status: 'RECEIVED' | 'RETURNED' | 'CORRECTED';
  receivedAt: string;
  staffId: string;
  staffName: string;
  notes?: string;
  correctedBy?: string;
  correctionReason?: string;
  correctedAt?: string;
}

export interface CentralBudget {
  id: string;
  academicYear: number;
  totalBudget: number;
  description?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface StaffAllocation {
  id: string;
  staffId: string;
  staffName: string;
  allocatedAmount: number;
  academicYear: number;
  status: 'ACTIVE' | 'CLOSED' | 'VOIDED';
  allocatedAt: string;
  allocatedBy: string;
  notes?: string;
}

export interface StaffExpense {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  category: string;
  description: string;
  expenseDate: string;
  expenseTime: string;
  vendorName?: string;
  receiptUrl?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'VOIDED';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  voidReason?: string;
  createdAt: string;
}

export interface FinancialLedgerEntry {
  id: string;
  staffId: string;
  transactionType: 'ALLOCATION' | 'EXPENSE' | 'ADJUSTMENT' | 'CASH_RETURN' | 'REGISTRATION_INFLOW';
  amount: number;
  referenceId: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

export interface AdminAuditHistoryItem {
  id: string;
  adminId: string;
  adminName: string;
  entityType: 'REGISTRATION' | 'PAYMENT' | 'FOOD' | 'GATE' | 'DRESS' | 'BUDGET' | 'EXPENSE' | 'STAFF' | 'STUDENT_ID' | 'MEAL';
  entityId: string;
  action: string;
  previousValue?: string;
  newValue?: string;
  reason: string;
  timestamp: string;
}

// Current Student ID Verification System Types
export type StudentIdStatus = 'ACTIVE' | 'INACTIVE';
export type StudentIdVerificationStatus = 'AVAILABLE' | 'RESERVED' | 'USED';

export interface CurrentStudentIdRecord {
  id: string; // Database ID or student ID
  studentId: string; // e.g. PLSCF-STU-2026-101 (Unique)
  studentName?: string;
  className: string; // e.g. 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11 (HSC)', 'Class 12 (HSC)'
  academicYear: string; // e.g. '2026'
  status: StudentIdStatus;
  verificationStatus: StudentIdVerificationStatus;
  usedRegistrationId?: string | null;
  reservedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentIdVerificationResult {
  success: boolean;
  status: 'AVAILABLE' | 'NOT_FOUND' | 'ALREADY_USED' | 'INACTIVE' | 'RESERVED';
  messageEn: string;
  messageBn: string;
  record?: {
    studentId: string;
    studentName?: string;
    className?: string;
  };
}

export interface ContactInquiry {
  id: string;
  name: string;
  mobileNumber: string;
  message: string;
  subject?: string;
  createdAt: string;
  status: 'NEW' | 'RESOLVED';
}

export * from './rms';
