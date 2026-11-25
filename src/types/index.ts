export type StudentCategory = 'former' | 'current';

export type TShirtSize = 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL' | 'Oversize 50';

export type PaymentMethod = 'bkash' | 'nagad' | 'rocket' | 'card' | 'amex';

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export type Language = 'en' | 'bn';

export type GateStatus = 'NOT_ENTERED' | 'ENTRY' | 'BACK';

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
  gatewayInvoiceNumber?: string;
  gatewayProvider?: string;
  registeredAt: string;
  qrToken: string;
  isTShirtCollected: boolean;
  isCheckedIn?: boolean;
  gateStatus?: GateStatus;
  gender?: 'male' | 'female';
  bloodGroup?: string;
  hasParent?: boolean;
  parentName?: string;
  parentAge?: number | string;
  parentPhone?: string;
  parentRelation?: string;
  parentFee?: number;
  parentPhotoUrl?: string;
  gatewayCharge?: number;
  notes?: string;
  year?: number;
  isDemo?: boolean;
  isLegacy?: boolean;
  migrationSource?: string;
  legacySourceYear?: number;
  serverVerificationSignature?: string;
  verificationTimestamp?: string;
  verifiedBy?: string;
  // Admin-Assisted Manual Registration & Super Admin Approval System
  isManualRegistration?: boolean;
  registrationType?: 'online' | 'manual_venue' | 'manual_admin';
  registrationApprovalStatus?: 'approved' | 'pending' | 'rejected';
  approvalNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdByAdminId?: string;
  createdByAdminName?: string;
  financialAmount?: number;
  financialDescription?: string;
  financialMethod?: string;
  financialReference?: string;
  financialNotes?: string;
  financialApprovalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  financialApprovedBy?: string;
  financialApprovedAt?: string;
  financialRejectedBy?: string;
  financialRejectedAt?: string;
  documentUrl?: string;
  documentName?: string;
  // Supabase Storage Bucket photo metadata
  photoStoragePath?: string | null;
  parentPhotoStoragePath?: string | null;
  photoUpdatedAt?: string;
  photoUpdatedBy?: string;
}

export type RegistrationApprovalStatus = 'approved' | 'pending' | 'rejected';
export type FinancialApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type ManualRegistrationType = 'online' | 'manual_venue' | 'manual_admin';

export interface ManualRegistrationInput {
  fullName: string;
  fullNameBn?: string;
  photoUrl?: string;
  photoStoragePath?: string;
  mobileNumber: string;
  email?: string;
  category: StudentCategory;
  studentId?: string;
  passingYear?: string;
  lastClassAttended?: string;
  currentClass?: string;
  batchName: string;
  groupOrSection?: string;
  rollNumber?: string;
  tShirtSize: TShirtSize;
  address?: string;
  gender?: 'male' | 'female';
  bloodGroup?: string;
  hasParent?: boolean;
  parentName?: string;
  parentRelation?: string;
  parentPhone?: string;
  notes?: string;
  documentUrl?: string;
  documentName?: string;
  // Optional Financial Section
  financialAmount?: number;
  financialDescription?: string;
  financialMethod?: string;
  financialReference?: string;
  financialNotes?: string;
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
  gatewayInvoiceNumber?: string;
  gatewayProvider?: string;
  transactionId: string;
  date: string;
  paymentStatus?: PaymentStatus;
  year?: number;
  createdAt?: string;
  token?: string;
  qrToken?: string;
  registrationId?: string;
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

export interface CommitteeMember {
  id: string;
  name: string;
  nameBn?: string;
  role: string;
  roleBn?: string;
  desc: string;
  descBn?: string;
  batch?: string;
  img: string;
  order: number;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommitteeSettings {
  displayMode: 'carousel' | 'grid';
  autoScrollSpeedMs: number;
  sectionTitleEn: string;
  sectionTitleBn: string;
  sectionSubtitleEn: string;
  sectionSubtitleBn: string;
}

export interface FeeSettings {
  formerStudentFee: number;
  currentStudentFee: number;
  registrationOpen: boolean;
  alumniRegistrationOpen?: boolean;
  currentStudentRegistrationOpen?: boolean;
  donationOpen?: boolean;
  startDate: string;
  endDate: string;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  closedMessageEn?: string;
  closedMessageBn?: string;
  donationClosedMessageEn?: string;
  donationClosedMessageBn?: string;
  eventTargetDate?: string;
  simulateEventCompleted?: boolean;
  homePageSections?: HomePageSectionSetting[];
  hideDonationAmounts?: boolean;
}

export type HomePageSectionId =
  | 'hero'
  | 'featureCards'
  | 'pillarsRibbon'
  | 'countdown'
  | 'status'
  | 'fees'
  | 'financials'
  | 'notices'
  | 'gallery'
  | 'committee';

export interface HomePageSectionSetting {
  id: HomePageSectionId;
  visible: boolean;
}

export const DEFAULT_HOME_PAGE_SECTIONS: HomePageSectionSetting[] = [
  { id: 'hero', visible: true },
  { id: 'featureCards', visible: true },
  { id: 'pillarsRibbon', visible: true },
  { id: 'countdown', visible: true },
  { id: 'status', visible: true },
  { id: 'fees', visible: true },
  { id: 'financials', visible: true },
  { id: 'notices', visible: true },
  { id: 'gallery', visible: true },
  { id: 'committee', visible: true },
];

export function reconcileHomePageSections(
  saved?: HomePageSectionSetting[] | null
): HomePageSectionSetting[] {
  if (!Array.isArray(saved) || saved.length === 0) {
    return [...DEFAULT_HOME_PAGE_SECTIONS];
  }
  const knownIds = new Set<HomePageSectionId>();
  const reconciled: HomePageSectionSetting[] = [];

  for (const item of saved) {
    if (item && DEFAULT_HOME_PAGE_SECTIONS.some((def) => def.id === item.id)) {
      if (!knownIds.has(item.id)) {
        reconciled.push({ id: item.id, visible: item.visible !== false });
        knownIds.add(item.id);
      }
    }
  }

  for (const def of DEFAULT_HOME_PAGE_SECTIONS) {
    if (!knownIds.has(def.id)) {
      reconciled.push({ id: def.id, visible: true });
      knownIds.add(def.id);
    }
  }

  return reconciled;
}

export type PortalRole =
  | 'super_admin'
  | 'admin'
  | 'moderator'
  | 'finance_manager'
  | 'registration_officer';

export interface PortalRoleConfig {
  role: PortalRole;
  slug: string;
  titleEn: string;
  titleBn: string;
  taglineEn: string;
  taglineBn: string;
  descriptionEn: string;
  descriptionBn: string;
  badgeLabelEn: string;
  badgeLabelBn: string;
  themeColor: string;
  bgGradient: string;
  headerBg: string;
  accentBorder: string;
  accentText: string;
  accentButton: string;
  iconName: 'Crown' | 'Shield' | 'UserCheck' | 'DollarSign' | 'UserPlus' | 'Users';
  defaultTab: string;
  allowedTabs: string[];
  demoCredentials: {
    email: string;
    password: string;
    fullName: string;
  };
}

export const PORTAL_ROLE_CONFIGS: Record<PortalRole, PortalRoleConfig> = {
  super_admin: {
    role: 'super_admin',
    slug: 'super-admin',
    titleEn: 'Police Lines School & College Reunion Super Admin Portal',
    titleBn: 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ পুনর্মিলনী সুপার অ্যাডমিন পোর্টাল',
    taglineEn: 'Master Executive Governance & Full Control Center',
    taglineBn: 'সার্বভৌম নির্বাহী প্রশাসন ও কেন্দ্রীয় নিয়ন্ত্রণ কেন্দ্র',
    descriptionEn: 'Unrestricted master access for institution principals, head conveners, and system architects. Full authority over budgets, approvals, audit logs, and security infrastructure.',
    descriptionBn: 'প্রতিষ্ঠানের অধ্যক্ষ, প্রধান আহ্বায়ক ও সিস্টেম অ্যাডমিনের জন্য পূর্ণ নিয়ন্ত্রণ ও পরিচালনা পোর্টাল।',
    badgeLabelEn: 'SUPER ADMIN PORTAL',
    badgeLabelBn: 'সুপার অ্যাডমিন পোর্টাল',
    themeColor: 'amber',
    bgGradient: 'from-slate-950 via-slate-900 to-amber-950',
    headerBg: 'bg-slate-900 border-amber-500/30',
    accentBorder: 'border-amber-500',
    accentText: 'text-amber-500',
    accentButton: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-amber-500/20',
    iconName: 'Crown',
    defaultTab: 'masterOverview',
    allowedTabs: [
      'userAccessManagement',
      'guestManagement',
      'staffCardManagement',
      'masterOverview',
      'gateManagement',
      'manualApproval',
      'allBookings',
      'staffManagement',
      'budgetManagement',
      'dailyAnalytics',
      'securityAudit',
      'auditHistory',
      'studentIds',
      'idCardManagement',
      'reunionManagement',
      'feeSettings',
      'mealControl',
      'payments',
      'donations',
      'tshirts',
      'tickets',
      'staff',
      'finances',
      'notices',
      'galleryManagement',
      'reports',
    ],
    demoCredentials: {
      email: 'admin@gmail.com',
      password: 'admin@123',
      fullName: 'Principal / Head Convener',
    },
  },
  admin: {
    role: 'admin',
    slug: 'admin',
    titleEn: 'Police Lines School & College Reunion Admin Portal',
    titleBn: 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ পুনর্মিলনী অ্যাডমিন পোর্টাল',
    taglineEn: 'General Venue Operations & Event Management Console',
    taglineBn: 'সাধারণ ভেন্যু পরিচালনা ও ইভেন্ট ম্যানেজমেন্ট কনসোল',
    descriptionEn: 'Operational oversight for campus venue supervisors, attendance tracking, student bookings, ID badges, kit collections, and analytical event reports.',
    descriptionBn: 'ক্যাম্পাস ভেন্যু সুপারভাইজার, উপস্থিতি পর্যবেক্ষণ, বুকিং ও কিট বিতরণের অফিসিয়াল পোর্টাল।',
    badgeLabelEn: 'ADMIN PORTAL',
    badgeLabelBn: 'অ্যাডমিন পোর্টাল',
    themeColor: 'blue',
    bgGradient: 'from-slate-950 via-slate-900 to-blue-950',
    headerBg: 'bg-slate-900 border-blue-500/30',
    accentBorder: 'border-blue-500',
    accentText: 'text-blue-500',
    accentButton: 'bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-blue-500/20',
    iconName: 'Shield',
    defaultTab: 'allBookings',
    allowedTabs: [
      'guestManagement',
      'allBookings',
      'gateManagement',
      'manualRegistration',
      'studentIds',
      'idCardManagement',
      'donations',
      'tshirts',
      'tickets',
      'dailyAnalytics',
      'notices',
      'galleryManagement',
      'reports',
    ],
    demoCredentials: {
      email: 'venue.admin@gmail.com',
      password: 'admin@123',
      fullName: 'Venue Operations Administrator',
    },
  },
  moderator: {
    role: 'moderator',
    slug: 'moderator',
    titleEn: 'Police Lines School & College Reunion Moderator Portal',
    titleBn: 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ পুনর্মিলনী মডারেটর পোর্টাল',
    taglineEn: 'Verification, Security Oversight & Event Gate Supervision',
    taglineBn: 'যাচাইকরণ, নিরাপত্তা তদারকি ও গেইট সুপারভিশন',
    descriptionEn: 'Supervisory access for field moderators, security officers, and floor leads to verify attendee credentials, monitor gate check-ins, and inspect digital tickets.',
    descriptionBn: 'ফিল্ড মডারেটর ও নিরাপত্তা কর্মকর্তাদের জন্য টিকিট যাচাই ও উপস্থিতি তদারকি পোর্টাল।',
    badgeLabelEn: 'MODERATOR PORTAL',
    badgeLabelBn: 'মডারেটর পোর্টাল',
    themeColor: 'emerald',
    bgGradient: 'from-slate-950 via-slate-900 to-emerald-950',
    headerBg: 'bg-slate-900 border-emerald-500/30',
    accentBorder: 'border-emerald-500',
    accentText: 'text-emerald-500',
    accentButton: 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-emerald-500/20',
    iconName: 'UserCheck',
    defaultTab: 'allBookings',
    allowedTabs: ['allBookings', 'tickets', 'idCardManagement', 'notices', 'masterOverview'],
    demoCredentials: {
      email: 'moderator@gmail.com',
      password: 'admin@123',
      fullName: 'Campus Security & Floor Moderator',
    },
  },
  finance_manager: {
    role: 'finance_manager',
    slug: 'finance',
    titleEn: 'Police Lines School & College Reunion Finance Portal',
    titleBn: 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ পুনর্মিলনী ফাইন্যান্স পোর্টাল',
    taglineEn: 'Treasury Management, Accounts & Financial Transparency',
    taglineBn: 'ট্রেজারি ব্যবস্থাপনা, হিসাব ও আর্থিক স্বচ্ছতা',
    descriptionEn: 'Dedicated financial portal for the Reunion Finance Committee, accounting team, and treasurers. Manage revenue streams, verify expenditures, vouchers, and donation ledgers.',
    descriptionBn: 'পুনর্মিলনী অর্থ কমিটি, অডিট ও হিসাব রক্ষকদের জন্য বাজেট ও তহবিল ব্যবস্থাপনা পোর্টাল।',
    badgeLabelEn: 'FINANCE PORTAL',
    badgeLabelBn: 'ফাইন্যান্স পোর্টাল',
    themeColor: 'amber',
    bgGradient: 'from-stone-950 via-stone-900 to-amber-950',
    headerBg: 'bg-stone-900 border-amber-600/30',
    accentBorder: 'border-amber-600',
    accentText: 'text-amber-500',
    accentButton: 'bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-amber-600/20',
    iconName: 'DollarSign',
    defaultTab: 'budgetManagement',
    allowedTabs: [
      'budgetManagement',
      'finances',
      'payments',
      'donations',
      'manualApproval',
      'dailyAnalytics',
      'reports',
    ],
    demoCredentials: {
      email: 'finance@gmail.com',
      password: 'admin@123',
      fullName: 'Treasurer / Finance Secretary',
    },
  },
  registration_officer: {
    role: 'registration_officer',
    slug: 'registration',
    titleEn: 'Police Lines School & College Reunion Registration Portal',
    titleBn: 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ পুনর্মিলনী রেজিস্ট্রেশন পোর্টাল',
    taglineEn: 'On-Site Venue Helpdesk & Attendee Enrollment Desk',
    taglineBn: 'অন-সাইট ভেন্যু হেল্পডেস্ক ও শিক্ষার্থী নিবন্ধন ডেস্ক',
    descriptionEn: 'Front-desk registration station for creating manual student entries, taking student photos, verifying alumni passing years, issuing ID cards, and handing out kits.',
    descriptionBn: 'সরাসরি ভেন্যুতে উপস্থিত শিক্ষার্থীদের অন-স্পট নিবন্ধন ও আইডি কার্ড ইস্যু পোর্টাল।',
    badgeLabelEn: 'REGISTRATION PORTAL',
    badgeLabelBn: 'রেজিস্ট্রেশন পোর্টাল',
    themeColor: 'cyan',
    bgGradient: 'from-slate-950 via-slate-900 to-sky-950',
    headerBg: 'bg-slate-900 border-sky-500/30',
    accentBorder: 'border-sky-500',
    accentText: 'text-sky-400',
    accentButton: 'bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-sky-500/20',
    iconName: 'UserPlus',
    defaultTab: 'manualRegistration',
    allowedTabs: [
      'manualRegistration',
      'allBookings',
      'studentIds',
      'idCardManagement',
      'tshirts',
      'tickets',
    ],
    demoCredentials: {
      email: 'registration@gmail.com',
      password: 'admin@123',
      fullName: 'Registration Desk Officer',
    },
  },
};

/**
 * Normalizes input role string or slug into a validated PortalRole
 */
export function normalizePortalRole(raw: string | undefined | null): PortalRole | null {
  if (!raw) return null;
  const clean = raw.toLowerCase().trim().replace(/[-_\s]+/g, '_');
  if (clean === 'super_admin' || clean === 'superadmin') return 'super_admin';
  if (clean === 'admin' || clean === 'administrator') return 'admin';
  if (clean === 'moderator' || clean === 'mod') return 'moderator';
  if (clean === 'finance' || clean === 'finance_manager' || clean === 'finance_team') return 'finance_manager';
  if (clean === 'registration' || clean === 'registration_officer' || clean === 'reg_team') return 'registration_officer';
  return null;
}

/**
 * Normalizes URL slug to a validated PortalRole
 */
export function getPortalRoleFromSlug(slug: string | undefined | null): PortalRole | null {
  if (!slug) return null;
  const clean = slug.toLowerCase().trim().replace(/[_]+/g, '-');
  if (clean === 'super-admin' || clean === 'superadmin') return 'super_admin';
  if (clean === 'admin') return 'admin';
  if (clean === 'moderator') return 'moderator';
  if (clean === 'finance') return 'finance_manager';
  if (clean === 'registration') return 'registration_officer';
  return null;
}

export function getPortalConfigByRole(role: PortalRole): PortalRoleConfig {
  return PORTAL_ROLE_CONFIGS[role] || PORTAL_ROLE_CONFIGS.super_admin;
}

export function getPortalConfigBySlug(slug: string): PortalRoleConfig | null {
  const role = getPortalRoleFromSlug(slug);
  return role ? PORTAL_ROLE_CONFIGS[role] : null;
}

export interface AdminAccount {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: PortalRole | 'gate_scanner';
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
  isActive?: boolean;
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
  eventType: 'ENTRY' | 'EXIT' | 'BACK';
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
    academicYear?: string;
    phone?: string;
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

export * from './mealControl';
export * from './staffCard';
