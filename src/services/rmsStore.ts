/**
 * Police Lines High School & College, Faridpur Reunion 2027
 * Reunion Management System (RMS) - Central Enterprise ERP Service Store
 */

import {
  RmsRole,
  RmsUser,
  CommitteeRecord,
  RmsTask,
  BudgetRequest,
  RmsExpense,
  RmsIncomeTransaction,
  RmsSponsor,
  RmsDocument,
  RmsMeeting,
  RmsNotification,
  RmsAnnouncement,
  VolunteerRecord,
  IncidentReport,
  WeeklyProgressReport,
  RmsAuditLog,
} from '../types/rms';
import { safeRandomUUID, sanitizeInput, sanitizeUrl } from '../utils/security';
import { supabase, isNetworkException } from './supabase';

// ==========================================
// SNAKE_CASE <-> CAMELCASE MAPPERS FOR SUPABASE POSTGRESQL
// ==========================================

export function toCommitteeDbRow(c: CommitteeRecord): Record<string, any> {
  return {
    id: c.id,
    name_en: c.nameEn,
    name_bn: c.nameBn,
    description_en: c.descriptionEn || '',
    description_bn: c.descriptionBn || '',
    director_id: c.directorId || '',
    director_name: c.directorName || '',
    director_phone: c.directorPhone || '',
    director_email: c.directorEmail || '',
    assistant_director_names: c.assistantDirectorNames || [],
    assigned_responsibilities: c.assignedResponsibilities || [],
    budget_total: Number(c.budgetTotal) || 0,
    budget_allocated: Number(c.budgetAllocated) || 0,
    budget_spent: Number(c.budgetSpent) || 0,
    is_active: Boolean(c.isActive),
    meeting_day: c.meetingDay || null,
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || new Date().toISOString(),
  };
}

export function fromCommitteeDbRow(row: any): CommitteeRecord {
  return {
    id: row.id,
    nameEn: row.name_en || '',
    nameBn: row.name_bn || '',
    descriptionEn: row.description_en || '',
    descriptionBn: row.description_bn || '',
    directorId: row.director_id || '',
    directorName: row.director_name || '',
    directorPhone: row.director_phone || '',
    directorEmail: row.director_email || '',
    assistantDirectorIds: [],
    assistantDirectorNames: Array.isArray(row.assistant_director_names) ? row.assistant_director_names : [],
    members: [],
    assignedResponsibilities: Array.isArray(row.assigned_responsibilities) ? row.assigned_responsibilities : [],
    budgetTotal: Number(row.budget_total) || 0,
    budgetAllocated: Number(row.budget_allocated) || 0,
    budgetSpent: Number(row.budget_spent) || 0,
    isActive: row.is_active !== false,
    meetingDay: row.meeting_day || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function toTaskDbRow(t: RmsTask): Record<string, any> {
  return {
    id: t.id,
    title: t.title,
    description: t.description || '',
    committee_id: t.committeeId,
    committee_name: t.committeeName,
    assigned_member_id: t.assignedMemberId || null,
    assigned_member_name: t.assignedMemberName || null,
    created_by: t.createdBy,
    created_by_name: t.createdByName,
    start_date: t.startDate || new Date().toISOString().split('T')[0],
    deadline: t.deadline || new Date().toISOString().split('T')[0],
    priority: t.priority || 'MEDIUM',
    status: t.status || 'PENDING',
    completion_evidence: t.completionEvidence || null,
    rejection_reason: t.rejectionReason || null,
    reviewed_by: t.reviewedBy || null,
    reviewed_at: t.reviewedAt || null,
    created_at: t.createdAt || new Date().toISOString(),
    updated_at: t.updatedAt || new Date().toISOString(),
  };
}

export function fromTaskDbRow(row: any): RmsTask {
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    committeeId: row.committee_id || '',
    committeeName: row.committee_name || '',
    assignedMemberId: row.assigned_member_id || undefined,
    assignedMemberName: row.assigned_member_name || undefined,
    createdBy: row.created_by || '',
    createdByName: row.created_by_name || '',
    startDate: row.start_date || '',
    deadline: row.deadline || '',
    priority: row.priority || 'MEDIUM',
    status: row.status || 'PENDING',
    attachments: [],
    comments: [],
    completionEvidence: row.completion_evidence || undefined,
    rejectionReason: row.rejection_reason || undefined,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    history: [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function toBudgetRequestDbRow(b: BudgetRequest): Record<string, any> {
  return {
    id: b.id,
    committee_id: b.committeeId,
    committee_name: b.committeeName,
    request_title: b.requestTitle,
    expense_category: b.expenseCategory,
    requested_amount: Number(b.requestedAmount) || 0,
    description: b.description || '',
    supporting_documents: b.supportingDocuments || [],
    requested_by: b.requestedBy,
    requested_by_name: b.requestedByName,
    request_date: b.requestDate || new Date().toISOString().split('T')[0],
    status: b.status || 'SUBMITTED',
    finance_reviewer_id: b.financeReviewerId || null,
    finance_reviewer_name: b.financeReviewerName || null,
    finance_comments: b.financeComments || null,
    approved_by: b.approvedBy || null,
    approved_by_name: b.approvedByName || null,
    approved_amount: b.approvedAmount != null ? Number(b.approvedAmount) : null,
    approval_date: b.approvalDate || null,
    rejection_reason: b.rejectionReason || null,
    created_at: new Date().toISOString(),
  };
}

export function fromBudgetRequestDbRow(row: any): BudgetRequest {
  return {
    id: row.id,
    committeeId: row.committee_id || '',
    committeeName: row.committee_name || '',
    requestTitle: row.request_title || '',
    expenseCategory: row.expense_category || '',
    requestedAmount: Number(row.requested_amount) || 0,
    description: row.description || '',
    supportingDocuments: Array.isArray(row.supporting_documents) ? row.supporting_documents : [],
    requestedBy: row.requested_by || '',
    requestedByName: row.requested_by_name || '',
    requestDate: row.request_date || '',
    status: row.status || 'SUBMITTED',
    financeReviewerId: row.finance_reviewer_id || undefined,
    financeReviewerName: row.finance_reviewer_name || undefined,
    financeComments: row.finance_comments || undefined,
    approvedBy: row.approved_by || undefined,
    approvedByName: row.approved_by_name || undefined,
    approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : undefined,
    approvalDate: row.approval_date || undefined,
    rejectionReason: row.rejection_reason || undefined,
  };
}

export function toExpenseDbRow(e: RmsExpense): Record<string, any> {
  return {
    id: e.id,
    committee_id: e.committeeId,
    committee_name: e.committeeName,
    expense_title: e.expenseTitle,
    expense_category: e.expenseCategory,
    amount: Number(e.amount) || 0,
    payment_method: e.paymentMethod,
    vendor: e.vendor,
    expense_date: e.expenseDate || new Date().toISOString().split('T')[0],
    voucher_number: e.voucherNumber,
    voucher_url: e.voucherUrl || null,
    submitted_by: e.submittedBy,
    submitted_by_name: e.submittedByName,
    verification_status: e.verificationStatus || 'PENDING',
    verified_by: e.verifiedBy || null,
    verified_by_name: e.verifiedByName || null,
    reversal_reason: e.reversalReason || null,
    reversal_authorized_by: e.reversalAuthorizedBy || null,
    created_at: e.createdAt || new Date().toISOString(),
  };
}

export function fromExpenseDbRow(row: any): RmsExpense {
  return {
    id: row.id,
    committeeId: row.committee_id || '',
    committeeName: row.committee_name || '',
    expenseTitle: row.expense_title || '',
    expenseCategory: row.expense_category || '',
    amount: Number(row.amount) || 0,
    paymentMethod: row.payment_method || 'CASH',
    vendor: row.vendor || '',
    expenseDate: row.expense_date || '',
    voucherNumber: row.voucher_number || '',
    voucherUrl: row.voucher_url || undefined,
    submittedBy: row.submitted_by || '',
    submittedByName: row.submitted_by_name || '',
    verificationStatus: row.verification_status || 'PENDING',
    verifiedBy: row.verified_by || undefined,
    verifiedByName: row.verified_by_name || undefined,
    reversalReason: row.reversal_reason || undefined,
    reversalAuthorizedBy: row.reversal_authorized_by || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function toMeetingDbRow(m: RmsMeeting): Record<string, any> {
  return {
    id: m.id,
    title: m.title,
    committee_id: m.committeeId || null,
    committee_name: m.committeeName || null,
    is_central_meeting: Boolean(m.isCentralMeeting),
    meeting_date: m.meetingDate,
    start_time: m.startTime,
    end_time: m.endTime,
    venue: m.venue,
    agenda: m.agenda || [],
    attendees: m.attendees || [],
    meeting_minutes: m.meetingMinutes || null,
    decisions: m.decisions || [],
    follow_up_tasks: m.followUpTasks || [],
    minutes_document_url: m.minutesDocumentUrl || null,
    created_by: m.createdBy,
    created_at: m.createdAt || new Date().toISOString(),
  };
}

export function fromMeetingDbRow(row: any): RmsMeeting {
  return {
    id: row.id,
    title: row.title || '',
    committeeId: row.committee_id || undefined,
    committeeName: row.committee_name || undefined,
    isCentralMeeting: Boolean(row.is_central_meeting),
    meetingDate: row.meeting_date || '',
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    venue: row.venue || '',
    agenda: Array.isArray(row.agenda) ? row.agenda : [],
    attendees: Array.isArray(row.attendees) ? row.attendees : [],
    meetingMinutes: row.meeting_minutes || undefined,
    decisions: Array.isArray(row.decisions) ? row.decisions : [],
    followUpTasks: Array.isArray(row.follow_up_tasks) ? row.follow_up_tasks : [],
    minutesDocumentUrl: row.minutes_document_url || undefined,
    createdBy: row.created_by || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function toVolunteerDbRow(v: VolunteerRecord): Record<string, any> {
  return {
    id: v.id,
    full_name: v.fullName,
    phone: v.phone,
    email: v.email || null,
    assigned_committee_id: v.assignedCommitteeId,
    assigned_location: v.assignedLocation,
    assigned_date: v.assignedDate,
    duty_start_time: v.dutyStartTime,
    duty_end_time: v.dutyEndTime,
    supervisor_name: v.supervisorName,
    supervisor_phone: v.supervisorPhone,
    attendance_status: v.attendanceStatus || 'PENDING',
    check_in_time: v.checkInTime || null,
    check_out_time: v.checkOutTime || null,
    responsibilities: v.responsibilities || [],
    emergency_contact: v.emergencyContact || {},
    created_at: new Date().toISOString(),
  };
}

export function fromVolunteerDbRow(row: any): VolunteerRecord {
  return {
    id: row.id,
    fullName: row.full_name || '',
    phone: row.phone || '',
    email: row.email || undefined,
    assignedCommitteeId: row.assigned_committee_id || '',
    assignedLocation: row.assigned_location || '',
    assignedDate: row.assigned_date || '',
    dutyStartTime: row.duty_start_time || '',
    dutyEndTime: row.duty_end_time || '',
    supervisorName: row.supervisor_name || '',
    supervisorPhone: row.supervisor_phone || '',
    attendanceStatus: row.attendance_status || 'PENDING',
    checkInTime: row.check_in_time || undefined,
    checkOutTime: row.check_out_time || undefined,
    responsibilities: Array.isArray(row.responsibilities) ? row.responsibilities : [],
    emergencyContact: row.emergency_contact || { name: '', relation: '', phone: '' },
  };
}

export function toAnnouncementDbRow(a: RmsAnnouncement): Record<string, any> {
  return {
    id: a.id,
    title_en: a.titleEn,
    title_bn: a.titleBn,
    content_en: a.contentEn,
    content_bn: a.contentBn,
    priority: a.priority || 'NORMAL',
    target_audience: a.targetAudience || 'ALL',
    committee_id: a.committeeId || null,
    author_name: a.authorName,
    is_active: a.isActive !== false,
    created_at: a.createdAt || new Date().toISOString(),
  };
}

export function fromAnnouncementDbRow(row: any): RmsAnnouncement {
  return {
    id: row.id,
    titleEn: row.title_en || '',
    titleBn: row.title_bn || '',
    contentEn: row.content_en || '',
    contentBn: row.content_bn || '',
    priority: row.priority || 'NORMAL',
    targetAudience: row.target_audience || 'ALL',
    committeeId: row.committee_id || undefined,
    authorName: row.author_name || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function toSponsorDbRow(s: RmsSponsor): Record<string, any> {
  return {
    id: s.id,
    company_name: s.companyName,
    contact_person: s.contactPerson,
    phone: s.phone,
    email: s.email || null,
    address: s.address || null,
    category: s.category,
    proposed_amount: Number(s.proposedAmount) || 0,
    agreed_amount: Number(s.agreedAmount) || 0,
    received_amount: Number(s.receivedAmount) || 0,
    payment_status: s.paymentStatus || 'NOT_PAID',
    agreement_document_url: s.agreementDocumentUrl || null,
    assigned_member_id: s.assignedMemberId || null,
    assigned_member_name: s.assignedMemberName || null,
    benefits: s.benefits || [],
    contact_history: s.contactHistory || [],
    created_at: s.createdAt || new Date().toISOString(),
  };
}

export function fromSponsorDbRow(row: any): RmsSponsor {
  return {
    id: row.id,
    companyName: row.company_name || '',
    contactPerson: row.contact_person || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    category: row.category || 'OTHER_PARTNER',
    proposedAmount: Number(row.proposed_amount) || 0,
    agreedAmount: Number(row.agreed_amount) || 0,
    receivedAmount: Number(row.received_amount) || 0,
    paymentStatus: row.payment_status || 'NOT_PAID',
    agreementDocumentUrl: row.agreement_document_url || undefined,
    assignedMemberId: row.assigned_member_id || undefined,
    assignedMemberName: row.assigned_member_name || undefined,
    benefits: Array.isArray(row.benefits) ? row.benefits : [],
    contactHistory: Array.isArray(row.contact_history) ? row.contact_history : [],
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function toDocumentDbRow(d: RmsDocument): Record<string, any> {
  return {
    id: d.id,
    title: d.title,
    committee_id: d.committeeId,
    committee_name: d.committeeName,
    category: d.category,
    file_url: d.fileUrl,
    file_name: d.fileName,
    file_size_bytes: Number(d.fileSizeBytes) || 0,
    file_type: d.fileType || '',
    version: Number(d.version) || 1,
    uploaded_by: d.uploadedBy,
    uploaded_by_name: d.uploadedByName,
    access_permission: d.accessPermission || 'COMMITTEE_ONLY',
    uploaded_at: d.uploadedAt || new Date().toISOString(),
  };
}

export function fromDocumentDbRow(row: any): RmsDocument {
  return {
    id: row.id,
    title: row.title || '',
    committeeId: row.committee_id || '',
    committeeName: row.committee_name || '',
    category: row.category || 'OTHER',
    fileUrl: row.file_url || '',
    fileName: row.file_name || '',
    fileSizeBytes: Number(row.file_size_bytes) || 0,
    fileType: row.file_type || '',
    version: Number(row.version) || 1,
    uploadedBy: row.uploaded_by || '',
    uploadedByName: row.uploaded_by_name || '',
    accessPermission: row.access_permission || 'COMMITTEE_ONLY',
    uploadedAt: row.uploaded_at || new Date().toISOString(),
  };
}

export function toAuditLogDbRow(log: RmsAuditLog): Record<string, any> {
  return {
    id: log.id,
    user_id: log.userId,
    user_name: log.userName,
    user_role: log.userRole,
    action: log.action,
    entity_type: log.entityType,
    entity_id: log.entityId,
    previous_value: log.previousValue || null,
    new_value: log.newValue || null,
    details: log.details,
    timestamp: log.timestamp || new Date().toISOString(),
  };
}

function safeSupabaseUpsert(table: string, row: Record<string, any>): void {
  try {
    Promise.resolve(supabase.from(table).upsert(row))
      .then(({ error }: any) => {
        if (error) {
          console.warn(`[RMS Store] Background upsert to ${table} notice:`, error.message);
        }
      })
      .catch((err: any) => {
        if (!isNetworkException(err)) {
          console.warn(`[RMS Store] Background upsert exception on ${table}:`, err?.message || err);
        }
      });
  } catch (err: any) {
    if (!isNetworkException(err)) {
      console.warn(`[RMS Store] Failed to queue background upsert for ${table}:`, err?.message || err);
    }
  }
}

function safeSupabaseInsert(table: string, row: Record<string, any>): void {
  try {
    Promise.resolve(supabase.from(table).insert(row))
      .then(({ error }: any) => {
        if (error) {
          console.warn(`[RMS Store] Background insert to ${table} notice:`, error.message);
        }
      })
      .catch((err: any) => {
        if (!isNetworkException(err)) {
          console.warn(`[RMS Store] Background insert exception on ${table}:`, err?.message || err);
        }
      });
  } catch (err: any) {
    if (!isNetworkException(err)) {
      console.warn(`[RMS Store] Failed to queue background insert for ${table}:`, err?.message || err);
    }
  }
}

// In-memory fallback for environments without localStorage
const memoryStore: Record<string, string> = {};

function loadData<T>(key: string, defaultValue: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(key);
      if (val) return JSON.parse(val);
    } else if (memoryStore[key]) {
      return JSON.parse(memoryStore[key]);
    }
  } catch (err) {
    console.warn(`[RMS Store] Error loading key ${key}:`, err);
  }
  return defaultValue;
}

function saveData<T>(key: string, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, serialized);
    } else {
      memoryStore[key] = serialized;
    }
  } catch (err) {
    console.warn(`[RMS Store] Error saving key ${key}:`, err);
  }
}

// Storage Keys
const KEY_CURRENT_USER = 'plscf_rms_current_user_2027';
const KEY_COMMITTEES = 'plscf_rms_committees_2027';
const KEY_TASKS = 'plscf_rms_tasks_2027';
const KEY_BUDGET_REQUESTS = 'plscf_rms_budget_reqs_2027';
const KEY_EXPENSES = 'plscf_rms_expenses_2027';
const KEY_INCOME = 'plscf_rms_income_2027';
const KEY_SPONSORS = 'plscf_rms_sponsors_2027';
const KEY_DOCUMENTS = 'plscf_rms_documents_2027';
const KEY_MEETINGS = 'plscf_rms_meetings_2027';
const KEY_NOTIFICATIONS = 'plscf_rms_notifications_2027';
const KEY_ANNOUNCEMENTS = 'plscf_rms_announcements_2027';
const KEY_VOLUNTEERS = 'plscf_rms_volunteers_2027';
const KEY_INCIDENTS = 'plscf_rms_incidents_2027';
const KEY_WEEKLY_REPORTS = 'plscf_rms_weekly_reports_2027';
const KEY_AUDIT_LOGS = 'plscf_rms_audit_logs_2027';

// Default Seed Users (Leadership)
export const INITIAL_RMS_USERS: RmsUser[] = [
  {
    id: 'USR-SUPERADMIN',
    fullName: 'System Administrator',
    email: 'admin@gmail.com',
    mobileNumber: '01711000001',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'USR-CHIEF-ADVISER',
    fullName: 'Institution Principal',
    email: 'principal@policelines.edu.bd',
    mobileNumber: '01711000002',
    role: 'CHIEF_ADVISER',
    designation: 'Principal & Chief Patron',
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'USR-CONVENER',
    fullName: 'Monowar Shikder',
    email: 'monowar@policelines.edu.bd',
    mobileNumber: '01711000003',
    role: 'CONVENER',
    designation: 'Reunion Convener',
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'USR-SECRETARY',
    fullName: 'Siddiqur Rahman',
    email: 'siddiqur@policelines.edu.bd',
    mobileNumber: '01711000004',
    role: 'MEMBER_SECRETARY',
    designation: 'Member Secretary',
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'USR-DIR-REGISTRATION',
    fullName: 'Sagar',
    email: 'sagar@policelines.edu.bd',
    mobileNumber: '01711000005',
    role: 'COMMITTEE_DIRECTOR',
    committeeId: 'registration-database',
    committeeTitle: 'Registration & Database Committee',
    designation: 'Director, Registration & Database',
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'USR-FINANCE-OFFICER',
    fullName: 'Finance Desk Officer',
    email: 'finance@gmail.com',
    mobileNumber: '01711000006',
    role: 'FINANCE_OFFICER',
    committeeId: 'finance-accounts',
    committeeTitle: 'Finance & Accounts Committee',
    designation: 'Accounts Officer',
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
  },
];

// Initial 12 Dynamic Committees Configuration
export const INITIAL_COMMITTEES: CommitteeRecord[] = [
  {
    id: 'publicity-publication',
    nameEn: 'Publicity & Publication',
    nameBn: 'প্রচার ও প্রকাশনা উপকমিটি',
    descriptionEn: 'Responsible for souvenirs, press releases, social campaigns, hoardings, and printing collateral.',
    descriptionBn: 'স্মরণিকা প্রকাশনা, প্রেস রিলিজ, সামাজিক যোগাযোগ প্রচার এবং ব্যানার-ফেস্টুন ব্যবস্থাপনা।',
    directorId: 'DIR-PUB-01',
    directorName: 'Ashiqur Rahman',
    directorPhone: '01712111111',
    directorEmail: 'publicity@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-PUB-01'],
    assistantDirectorNames: ['Tanvir Ahmed'],
    members: [
      {
        id: 'MEM-PUB-01',
        userId: 'USR-PUB-01',
        fullName: 'Kamrul Hasan',
        email: 'kamrul@policelines.edu.bd',
        mobileNumber: '01712111112',
        role: 'MEMBER',
        assignedResponsibilities: ['Souvenir Editing', 'Press Coordination'],
        joinedDate: '2026-10-15',
        status: 'ACTIVE',
      },
    ],
    assignedResponsibilities: ['Souvenir printing', 'Brochures', 'Media press releases'],
    budgetTotal: 300000,
    budgetAllocated: 250000,
    budgetSpent: 75000,
    isActive: true,
    meetingDay: 'Every Tuesday 6:00 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'media-digital',
    nameEn: 'Media & Digital Communication',
    nameBn: 'মিডিয়া ও ডিজিটাল যোগাযোগ উপকমিটি',
    descriptionEn: 'Manages website, digital broadcasts, live streams, photography, and multimedia assets.',
    descriptionBn: 'ওয়েবসাইট ব্যবস্থাপনা, লাইভ স্ট্রিমিং, ফটোগ্রাফি ও মাল্টিমিডিয়া সমন্বয়।',
    directorId: 'DIR-MED-01',
    directorName: 'Fahim Morshed',
    directorPhone: '01712222222',
    directorEmail: 'media@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-MED-01'],
    assistantDirectorNames: ['Nayeem Islam'],
    members: [],
    assignedResponsibilities: ['Website uptime', 'Live camera stream', 'Social media broadcast'],
    budgetTotal: 250000,
    budgetAllocated: 200000,
    budgetSpent: 60000,
    isActive: true,
    meetingDay: 'Every Wednesday 7:00 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'rally-procession',
    nameEn: 'Rally & Procession',
    nameBn: 'বর্ণাঢ্য র‍্যালি ও শোভাযাত্রা উপকমিটি',
    descriptionEn: 'Organizes the grand morning alumni procession with festive carriages, bands, and security coordination.',
    descriptionBn: 'বর্ণাঢ্য শোভাযাত্রা, ব্যান্ড পার্টি, ঘোড়ার গাড়ি ও শোভাযাত্রা রুট সমন্বয়।',
    directorId: 'DIR-RAL-01',
    directorName: 'Mahbubur Rahman',
    directorPhone: '01712333333',
    directorEmail: 'rally@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-RAL-01'],
    assistantDirectorNames: ['Ariful Islam'],
    members: [],
    assignedResponsibilities: ['Rally route planning', 'Band party booking', 'Police route escort'],
    budgetTotal: 200000,
    budgetAllocated: 180000,
    budgetSpent: 40000,
    isActive: true,
    meetingDay: 'Every Thursday 5:30 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'registration-database',
    nameEn: 'Registration & Database',
    nameBn: 'রেজিস্ট্রেশন ও ডেটাবেজ উপকমিটি',
    descriptionEn: 'Headed by Sagar. Authoritative for online student intake, student ID verification, PayStation settlement, and QR passes.',
    descriptionBn: 'পরিচালক সাগর। অনলাইন রেজিস্ট্রেশন, স্টুডেন্ট আইডি যাচাই, পেস্টেশন লেনদেন ও ডিজিটাল টিকিট ডেটাবেজ।',
    directorId: 'USR-DIR-REGISTRATION',
    directorName: 'Sagar',
    directorPhone: '01711000005',
    directorEmail: 'sagar@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-REG-01'],
    assistantDirectorNames: ['Mustafa Kamal'],
    members: [
      {
        id: 'MEM-REG-01',
        userId: 'USR-REG-01',
        fullName: 'Shafiqul Islam',
        email: 'shafiq@policelines.edu.bd',
        mobileNumber: '01712444445',
        role: 'MEMBER',
        assignedResponsibilities: ['ID Card Printing Support', 'Batch Reconciliation'],
        joinedDate: '2026-10-10',
        status: 'ACTIVE',
      },
    ],
    assignedResponsibilities: ['Student validation', 'PayStation reconciliation', 'QR generation', 'ID cards'],
    budgetTotal: 400000,
    budgetAllocated: 350000,
    budgetSpent: 120000,
    isActive: true,
    meetingDay: 'Every Monday 6:30 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'finance-accounts',
    nameEn: 'Finance & Accounts',
    nameBn: 'অর্থ ও হিসাব উপকমিটি',
    descriptionEn: 'Maintains bank accounts, ledger entries, voucher audit, budget allocations, and transparent balance sheets.',
    descriptionBn: 'আয়-ব্যয় অডিট, বাজেট বরাদ্দ, ব্যাংক একাউন্ট ও ভাউচার সমন্বয়।',
    directorId: 'DIR-FIN-01',
    directorName: 'Zahirul Haque',
    directorPhone: '01712555555',
    directorEmail: 'finance@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-FIN-01'],
    assistantDirectorNames: ['Mizanur Rahman'],
    members: [],
    assignedResponsibilities: ['Voucher audit', 'Bank reconciliation', 'Budget approvals'],
    budgetTotal: 150000,
    budgetAllocated: 120000,
    budgetSpent: 30000,
    isActive: true,
    meetingDay: 'Every Saturday 11:00 AM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'sponsorship-partnership',
    nameEn: 'Sponsorship & Partnership',
    nameBn: 'স্পন্সরশিপ ও পার্টনারশিপ উপকমিটি',
    descriptionEn: 'Corporate outreach, title sponsors, partner stalls, merchandise co-branding, and donation drives.',
    descriptionBn: 'কর্পোরেট স্পন্সরশিপ সংগ্রহ, স্টল বরাদ্দ ও পার্টনারশিপ বেনিফিট তদারকি।',
    directorId: 'DIR-SPO-01',
    directorName: 'Nasir Uddin',
    directorPhone: '01712666666',
    directorEmail: 'sponsorship@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-SPO-01'],
    assistantDirectorNames: ['Rezaul Karim'],
    members: [],
    assignedResponsibilities: ['Corporate proposals', 'Sponsor benefit checklist', 'Donation outreach'],
    budgetTotal: 200000,
    budgetAllocated: 150000,
    budgetSpent: 45000,
    isActive: true,
    meetingDay: 'Every Sunday 5:00 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'food-catering',
    nameEn: 'Food & Catering',
    nameBn: 'আপ্যায়ন ও খাবার উপকমিটি',
    descriptionEn: 'Full hospitality for 10,000+ attendees: breakfast, grand lunch banquet, and evening refreshments.',
    descriptionBn: '১০,০০০+ অংশগ্রহণকারীর সকালের নাস্তা, ঐতিহ্যবাহী গ্র্যান্ড মধ্যাহ্নভোজ ও সান্ধ্যকালীন খাবার ব্যবস্থাপনা।',
    directorId: 'DIR-FOD-01',
    directorName: 'Anisur Rahman',
    directorPhone: '01712777777',
    directorEmail: 'catering@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-FOD-01'],
    assistantDirectorNames: ['Shahidul Islam'],
    members: [],
    assignedResponsibilities: ['Caterer contracts', 'Meal tokens', 'Hygiene oversight', 'Buffet flow'],
    budgetTotal: 1500000,
    budgetAllocated: 1200000,
    budgetSpent: 450000,
    isActive: true,
    meetingDay: 'Every Monday 5:00 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'cultural-affairs',
    nameEn: 'Cultural Affairs',
    nameBn: 'সাংস্কৃতিক বিষয়ক উপকমিটি',
    descriptionEn: 'Coordinates the Jan 28 evening Qawwali, musical band segments, drama, recitation, and sound engineering.',
    descriptionBn: '২৮ জানুয়ারি সান্ধ্যকালীন কাওয়ালি অনুষ্ঠান, ব্যান্ড সঙ্গীত ও সাংস্কৃতিক অনুষ্ঠান সমন্বয়।',
    directorId: 'DIR-CUL-01',
    directorName: 'Farhana Yasmin',
    directorPhone: '01712888888',
    directorEmail: 'culture@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-CUL-01'],
    assistantDirectorNames: ['Rashed Khan'],
    members: [],
    assignedResponsibilities: ['Qawwali artist booking', 'Band lineup', 'Sound check schedule'],
    budgetTotal: 600000,
    budgetAllocated: 500000,
    budgetSpent: 180000,
    isActive: true,
    meetingDay: 'Every Tuesday 7:30 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'event-production',
    nameEn: 'Event Management & Production',
    nameBn: 'ইভেন্ট ম্যানেজমেন্ট ও প্রোডাকশন উপকমিটি',
    descriptionEn: 'Oversees main stage construction, LED walls, acoustic rigging, drone coverage, and master schedule flow.',
    descriptionBn: 'মূল মঞ্চ নির্মাণ, বিশাল এলইডি স্ক্রিন, লাইটিং ও প্রোডাকশন সামগ্রী নিয়ন্ত্রণ।',
    directorId: 'DIR-PRO-01',
    directorName: 'Tariqul Islam',
    directorPhone: '01712999999',
    directorEmail: 'production@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-PRO-01'],
    assistantDirectorNames: ['Jahangir Alam'],
    members: [],
    assignedResponsibilities: ['Stage delivery', 'LED screens', 'Acoustic setup', 'Live production'],
    budgetTotal: 800000,
    budgetAllocated: 700000,
    budgetSpent: 280000,
    isActive: true,
    meetingDay: 'Every Wednesday 5:00 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'hospitality-protocol',
    nameEn: 'Hospitality & Protocol',
    nameBn: 'অতিথি আপ্যায়ন ও প্রটোকল উপকমিটি',
    descriptionEn: 'VIP reception, retired faculty escort, memorabilia kits, guest lounge, and transportation protocol.',
    descriptionBn: 'প্রধান অতিথি, বরেণ্য শিক্ষক ও ভিআইপিদের উষ্ণ সংবর্ধনা, প্রটোকল ও লজিস্টিকস সহায়তা।',
    directorId: 'DIR-HOS-01',
    directorName: 'Nazrul Islam',
    directorPhone: '01712000001',
    directorEmail: 'protocol@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-HOS-01'],
    assistantDirectorNames: ['Asaduzzaman'],
    members: [],
    assignedResponsibilities: ['VIP transportation', 'Faculty escort', 'VIP lounge'],
    budgetTotal: 300000,
    budgetAllocated: 250000,
    budgetSpent: 65000,
    isActive: true,
    meetingDay: 'Every Thursday 6:00 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'security-discipline',
    nameEn: 'Security & Discipline',
    nameBn: 'নিরাপত্তা ও শৃঙ্খলা উপকমিটি',
    descriptionEn: 'Police administration liaison, access gate security, CCTV grid, vehicle parking, and emergency protocols.',
    descriptionBn: 'জেলা পুলিশ প্রশাসন লিয়াজোঁ, প্রবেশপথ নিরাপত্তা, সিসিটিভি নজরদারি ও শৃঙ্খলা রক্ষা।',
    directorId: 'DIR-SEC-01',
    directorName: 'Inspector Golam Mostafa',
    directorPhone: '01712000002',
    directorEmail: 'security@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-SEC-01'],
    assistantDirectorNames: ['Sub-Inspector Rafiqul Islam'],
    members: [],
    assignedResponsibilities: ['Gate scanners security', 'CCTV monitoring', 'Parking control'],
    budgetTotal: 350000,
    budgetAllocated: 300000,
    budgetSpent: 90000,
    isActive: true,
    meetingDay: 'Every Friday 4:00 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'venue-decoration',
    nameEn: 'Venue & Decoration',
    nameBn: 'ভেন্যু প্রস্তুতি ও সাজসজ্জা উপকমিটি',
    descriptionEn: 'Campus illumination, grand entrance arch, alumni photo walls, shamiana canopy, and thematic branding.',
    descriptionBn: 'স্কুল ক্যাম্পাস ও পুলিশ লাইন্স মাঠের আলোকসজ্জা, তোরণ, ফটোজোন ও প্যান্ডেল নির্মাণ।',
    directorId: 'DIR-VEN-01',
    directorName: 'Khaled Saifullah',
    directorPhone: '01712000003',
    directorEmail: 'venue@policelines.edu.bd',
    assistantDirectorIds: ['ADIR-VEN-01'],
    assistantDirectorNames: ['Sajid Hasan'],
    members: [],
    assignedResponsibilities: ['Pandal canopy', 'Lighting design', 'Entrance archways'],
    budgetTotal: 500000,
    budgetAllocated: 450000,
    budgetSpent: 160000,
    isActive: true,
    meetingDay: 'Every Saturday 5:30 PM',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
];

// Initial Tasks
export const INITIAL_TASKS: RmsTask[] = [
  {
    id: 'TSK-2027-01',
    title: 'Finalize Souvenir Content & Editorial Proofreading',
    description: 'Collect write-ups from former teachers, principal speech, and historic photographs for the 65-year memorial book.',
    committeeId: 'publicity-publication',
    committeeName: 'Publicity & Publication',
    assignedMemberId: 'MEM-PUB-01',
    assignedMemberName: 'Kamrul Hasan',
    createdBy: 'USR-CONVENER',
    createdByName: 'Monowar Shikder',
    startDate: '2026-11-01',
    deadline: '2026-12-15',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    attachments: [],
    comments: [],
    history: [
      {
        id: 'HIS-01',
        taskId: 'TSK-2027-01',
        action: 'TASK_CREATED',
        performedBy: 'Monowar Shikder',
        timestamp: '2026-11-01T10:00:00Z',
      },
    ],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  },
  {
    id: 'TSK-2027-02',
    title: 'Complete PayStation Gateway Integration & Anti-Replay Testing',
    description: 'Verify HMAC server verification, safeRandomUUID generation, and sandbox payment reconciliation for online tickets.',
    committeeId: 'registration-database',
    committeeName: 'Registration & Database',
    assignedMemberId: 'USR-DIR-REGISTRATION',
    assignedMemberName: 'Sagar',
    createdBy: 'USR-SECRETARY',
    createdByName: 'Siddiqur Rahman',
    startDate: '2026-11-05',
    deadline: '2026-11-20',
    priority: 'CRITICAL',
    status: 'COMPLETED',
    completionEvidence: 'PayStation sandbox credentials active; 38/38 automated test cases passing.',
    reviewedBy: 'Monowar Shikder',
    reviewedAt: '2026-11-10T14:00:00Z',
    attachments: [],
    comments: [],
    history: [],
    createdAt: '2026-11-05T09:00:00Z',
    updatedAt: '2026-11-10T14:00:00Z',
  },
  {
    id: 'TSK-2027-03',
    title: 'Confirm Traditional Qawwali Troupe for January 28 Evening',
    description: 'Draft artist performance contract, arrange sound system requirements, and secure guest hospitality for Qawwali Night.',
    committeeId: 'cultural-affairs',
    committeeName: 'Cultural Affairs',
    assignedMemberId: 'DIR-CUL-01',
    assignedMemberName: 'Farhana Yasmin',
    createdBy: 'USR-CONVENER',
    createdByName: 'Monowar Shikder',
    startDate: '2026-11-10',
    deadline: '2026-12-10',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    attachments: [],
    comments: [],
    history: [],
    createdAt: '2026-11-10T11:00:00Z',
    updatedAt: '2026-11-10T11:00:00Z',
  },
  {
    id: 'TSK-2027-04',
    title: 'Inspect Police Lines Large Field Ground Condition & Pandal Map',
    description: 'Perform joint inspection with venue decoration team and District Police Administration for security barricades and tent anchors.',
    committeeId: 'venue-decoration',
    committeeName: 'Venue & Decoration',
    assignedMemberId: 'DIR-VEN-01',
    assignedMemberName: 'Khaled Saifullah',
    createdBy: 'USR-SECRETARY',
    createdByName: 'Siddiqur Rahman',
    startDate: '2026-11-15',
    deadline: '2026-12-01',
    priority: 'MEDIUM',
    status: 'ASSIGNED',
    attachments: [],
    comments: [],
    history: [],
    createdAt: '2026-11-15T10:00:00Z',
    updatedAt: '2026-11-15T10:00:00Z',
  },
];

// Initial Sponsors
export const INITIAL_SPONSORS: RmsSponsor[] = [
  {
    id: 'SPN-01',
    companyName: 'Meghna Group of Industries (MGI)',
    contactPerson: 'Mr. Zahirul Islam',
    phone: '01819000111',
    email: 'zahid@mgi.org',
    address: 'Gulshan 1, Dhaka',
    category: 'TITLE_SPONSOR',
    proposedAmount: 1500000,
    agreedAmount: 1500000,
    receivedAmount: 1000000,
    paymentStatus: 'PARTIAL',
    contactHistory: [
      {
        date: '2026-10-20',
        communicator: 'Monowar Shikder',
        summary: 'Agreement signed for title presentation and main stage backdrop branding.',
      },
    ],
    benefits: [
      { id: 'BEN-01', name: 'Title Branding on Main Stage LED Backdrop', category: 'STAGE', isDelivered: true },
      { id: 'BEN-02', name: 'Exclusive 20x20 Pavilion Stall at Field Entrance', category: 'BOOTH', isDelivered: false },
      { id: 'BEN-03', name: 'Logo on 10,000 Souvenir Covers & ID Card Lanyards', category: 'LOGO', isDelivered: true },
      { id: 'BEN-04', name: 'Prime Time Speech Slot during Jan 29 Inauguration', category: 'VIP_PASS', isDelivered: false },
    ],
    createdAt: '2026-10-20T00:00:00Z',
  },
  {
    id: 'SPN-02',
    companyName: 'City Bank PLC',
    contactPerson: 'Ms. Nusrat Jahan',
    phone: '01713000222',
    email: 'nusrat@thecitybank.com',
    address: 'Motijheel, Dhaka',
    category: 'PLATINUM',
    proposedAmount: 800000,
    agreedAmount: 800000,
    receivedAmount: 800000,
    paymentStatus: 'PAID_FULL',
    contactHistory: [],
    benefits: [
      { id: 'BEN-05', name: 'Full Page Color Ad in Reunion Souvenir', category: 'LOGO', isDelivered: true },
      { id: 'BEN-06', name: 'Banner Displays on Entrance Archway & Procession', category: 'BANNER', isDelivered: false },
    ],
    createdAt: '2026-10-25T00:00:00Z',
  },
];

// Initial Budget Requests
export const INITIAL_BUDGET_REQUESTS: BudgetRequest[] = [
  {
    id: 'BGT-01',
    committeeId: 'food-catering',
    committeeName: 'Food & Catering',
    requestTitle: 'Advance Booking for 10,000 Lunch Banquets',
    expenseCategory: 'Catering',
    requestedAmount: 500000,
    description: 'Contract advance payment for raw materials and chef mobilization for 10,000 attendees.',
    supportingDocuments: ['Vendor_Quotation_Bhai_Bhai_Catering.pdf'],
    requestedBy: 'DIR-FOD-01',
    requestedByName: 'Anisur Rahman',
    requestDate: '2026-11-05',
    status: 'RECOMMENDED',
    financeReviewerId: 'USR-FINANCE-OFFICER',
    financeReviewerName: 'Finance Desk Officer',
    financeComments: 'Verified with market rates. Recommended for approval.',
    approvedBy: 'USR-CONVENER',
    approvedByName: 'Monowar Shikder',
    approvedAmount: 500000,
    approvalDate: '2026-11-08T12:00:00Z',
  },
  {
    id: 'BGT-02',
    committeeId: 'cultural-affairs',
    committeeName: 'Cultural Affairs',
    requestTitle: 'Artist Booking Fee for Jan 28 Qawwali Night',
    expenseCategory: 'Artists & Honorarium',
    requestedAmount: 200000,
    description: 'Advance honorarium for guest Qawwali ensemble from Old Dhaka.',
    supportingDocuments: ['Qawwali_Troupe_Agreement.pdf'],
    requestedBy: 'DIR-CUL-01',
    requestedByName: 'Farhana Yasmin',
    requestDate: '2026-11-08',
    status: 'APPROVED',
    approvedBy: 'USR-CONVENER',
    approvedByName: 'Monowar Shikder',
    approvedAmount: 200000,
    approvalDate: '2026-11-10T16:00:00Z',
  },
];

// Initial Expenses
export const INITIAL_EXPENSES: RmsExpense[] = [
  {
    id: 'EXP-2027-01',
    committeeId: 'registration-database',
    committeeName: 'Registration & Database',
    expenseTitle: 'Server Infrastructure & SMS Gateway Credits',
    expenseCategory: 'Technology & Cloud',
    amount: 35000,
    paymentMethod: 'BKASH',
    vendor: 'Cloud Host Bangladesh',
    expenseDate: '2026-11-02',
    voucherNumber: 'VOUCHER-REG-101',
    submittedBy: 'USR-DIR-REGISTRATION',
    submittedByName: 'Sagar',
    verificationStatus: 'VERIFIED',
    verifiedBy: 'USR-FINANCE-OFFICER',
    verifiedByName: 'Finance Desk Officer',
    createdAt: '2026-11-02T10:00:00Z',
  },
  {
    id: 'EXP-2027-02',
    committeeId: 'publicity-publication',
    committeeName: 'Publicity & Publication',
    expenseTitle: 'Printing of 500 Promo Posters & Roadside Hoardings',
    expenseCategory: 'Print & Media',
    amount: 45000,
    paymentMethod: 'CASH',
    vendor: 'Faridpur Modern Press',
    expenseDate: '2026-11-04',
    voucherNumber: 'VOUCHER-PUB-202',
    submittedBy: 'DIR-PUB-01',
    submittedByName: 'Ashiqur Rahman',
    verificationStatus: 'VERIFIED',
    verifiedBy: 'USR-FINANCE-OFFICER',
    verifiedByName: 'Finance Desk Officer',
    createdAt: '2026-11-04T12:00:00Z',
  },
];

// Initial Documents
export const INITIAL_DOCUMENTS: RmsDocument[] = [
  {
    id: 'DOC-01',
    title: 'District Police Administration Venue Permission Approval',
    committeeId: 'security-discipline',
    committeeName: 'Security & Discipline',
    category: 'PERMISSION_DOCUMENTS',
    fileUrl: 'https://example.com/docs/police_permission_2027.pdf',
    fileName: 'Police_Administration_Venue_Permission_2027.pdf',
    fileSizeBytes: 1420500,
    fileType: 'application/pdf',
    version: 1,
    uploadedBy: 'DIR-SEC-01',
    uploadedByName: 'Inspector Golam Mostafa',
    uploadedAt: '2026-10-18T10:00:00Z',
    accessPermission: 'PUBLIC',
  },
  {
    id: 'DOC-02',
    title: 'Central Organizing Committee Meeting Minutes #01',
    committeeId: 'registration-database',
    committeeName: 'Registration & Database',
    category: 'MEETING_MINUTES',
    fileUrl: 'https://example.com/docs/minutes_01.pdf',
    fileName: 'Reunion2027_Executive_Minutes_01.pdf',
    fileSizeBytes: 850000,
    fileType: 'application/pdf',
    version: 1,
    uploadedBy: 'USR-SECRETARY',
    uploadedByName: 'Siddiqur Rahman',
    uploadedAt: '2026-10-22T14:00:00Z',
    accessPermission: 'COMMITTEE_ONLY',
  },
];

// Initial Meetings
export const INITIAL_MEETINGS: RmsMeeting[] = [
  {
    id: 'MTG-01',
    title: 'Grand Reunion 2027 Central Steering Committee Meeting',
    isCentralMeeting: true,
    meetingDate: '2026-11-20',
    startTime: '16:00',
    endTime: '18:30',
    venue: 'School Auditorium & Conference Hall',
    agenda: [
      'Registration progress update (Director Sagar)',
      'Sponsorship collection status (Convener Monowar Shikder)',
      'Security grid and gate scanner deployment (Inspector Mostafa)',
      'Qawwali program artist lineup (Farhana Yasmin)',
    ],
    attendees: [
      { userId: 'USR-CHIEF-ADVISER', userName: 'Institution Principal', role: 'Chief Adviser', attended: true },
      { userId: 'USR-CONVENER', userName: 'Monowar Shikder', role: 'Convener', attended: true },
      { userId: 'USR-SECRETARY', userName: 'Siddiqur Rahman', role: 'Member Secretary', attended: true },
      { userId: 'USR-DIR-REGISTRATION', userName: 'Sagar', role: 'Director Registration', attended: true },
    ],
    decisions: [
      'Reunion date confirmed: Friday, January 29, 2027; Qawwali on January 28 evening.',
      'Target registration capacity confirmed at 10,000 attendees.',
    ],
    followUpTasks: [
      { description: 'Review weekly progress report format', assignedTo: 'Siddiqur Rahman', deadline: '2026-11-25' },
    ],
    createdBy: 'USR-SECRETARY',
    createdAt: '2026-11-01T00:00:00Z',
  },
];

// Initial Announcements
export const INITIAL_ANNOUNCEMENTS: RmsAnnouncement[] = [
  {
    id: 'ANN-01',
    titleEn: 'Official Notice: Police Lines High School & College, Faridpur Reunion 2027 Confirmed',
    titleBn: 'অফিসিয়াল বিজ্ঞপ্তি: সিলেট পুলিশ লাইন্স উচ্চ বিদ্যালয় ও কলেজ পুনর্মিলনী ২০২৭ চূড়ান্ত',
    contentEn: 'The Central Steering Committee has confirmed the Grand Reunion 2027 dates for January 28-29, 2027 at the School Campus and Police Lines Large Field.',
    contentBn: 'কেন্দ্রীয় ব্যবস্থাপনা কমিটির সর্বসম্মত সিদ্ধান্তে আগামী ২৮-২৯ জানুয়ারি ২০২৭ তারিখে স্কুল ক্যাম্পাস ও পুলিশ লাইন্স মাঠে পুনর্মিলনী ২০২৭ উদযাপিত হবে।',
    priority: 'URGENT',
    targetAudience: 'ALL',
    authorName: 'Monowar Shikder (Convener)',
    createdAt: '2026-11-01T00:00:00Z',
    isActive: true,
  },
];

// Initial Volunteers
export const INITIAL_VOLUNTEERS: VolunteerRecord[] = [
  {
    id: 'VOL-01',
    fullName: 'Tanvir Ahmed',
    phone: '01711223344',
    email: 'tanvir@gmail.com',
    assignedCommitteeId: 'registration-database',
    assignedLocation: 'Gate 01 Registration & ID Desk',
    assignedDate: '2027-01-28',
    dutyStartTime: '08:00',
    dutyEndTime: '14:00',
    supervisorName: 'Sagar',
    supervisorPhone: '01711000005',
    attendanceStatus: 'PENDING',
    responsibilities: ['Assist attendees with digital QR pass verification', 'Distribute ID cards and kits'],
    emergencyContact: {
      name: 'Rahim Ahmed',
      relation: 'Brother',
      phone: '01911223344',
    },
  },
  {
    id: 'VOL-02',
    fullName: 'Sumi Akter',
    phone: '01722334455',
    email: 'sumi@gmail.com',
    assignedCommitteeId: 'food-catering',
    assignedLocation: 'Food Pavilion 02',
    assignedDate: '2027-01-29',
    dutyStartTime: '12:00',
    dutyEndTime: '17:00',
    supervisorName: 'Anisur Rahman',
    supervisorPhone: '01712777777',
    attendanceStatus: 'PENDING',
    responsibilities: ['Assist buffet token queue', 'Guide senior alumni to reserved dining section'],
    emergencyContact: {
      name: 'Mrs. Rokeya',
      relation: 'Mother',
      phone: '01822334455',
    },
  },
];

// Initial Incidents
export const INITIAL_INCIDENTS: IncidentReport[] = [
  {
    id: 'INC-01',
    incidentType: 'LOST_FOUND',
    severity: 'LOW',
    location: 'Registration Counter 03',
    description: 'A student wallet and ID card found near Gate 01',
    reportedBy: 'VOL-01',
    reportedByName: 'Tanvir Ahmed (Volunteer)',
    reportedAt: '2026-11-10T11:30:00Z',
    assignedTeam: 'Lost & Found Booth',
    resolutionStatus: 'RESOLVED',
    resolutionNotes: 'Owner identified and wallet safely returned.',
    resolvedAt: '2026-11-10T12:15:00Z',
  },
];

// Initial Weekly Reports
export const INITIAL_WEEKLY_REPORTS: WeeklyProgressReport[] = [
  {
    id: 'WPR-01',
    committeeId: 'registration-database',
    committeeName: 'Registration & Database',
    directorId: 'USR-DIR-REGISTRATION',
    directorName: 'Sagar',
    reportWeekNumber: 1,
    reportDate: '2026-11-10',
    workCompleted: [
      'Configured online student registration portal with photo compression under 200KB',
      'Configured PayStation payment gateway with instant scannable QR ticket generation',
      'Seeded student ID verification inventory for current students',
    ],
    workInProgress: [
      'Testing thermal printer connectivity for event day spot registration',
      'Reconciling batch-wise registration figures with alumni coordinators',
    ],
    workPending: [
      'Procure 10,000 plastic ID card holders and branded lanyards',
    ],
    problemsEncountered: 'None. Database response time and payment callbacks verified.',
    budgetSpent: 35000,
    upcomingActivities: [
      'Deploy volunteer shift schedule for January 28 ID card distribution desk',
    ],
    supportRequired: 'Central approval for ID card lanyard printing design.',
    status: 'APPROVED',
    reviewerComments: 'Excellent progress. Approved without reservations.',
    reviewedBy: 'Monowar Shikder (Convener)',
    reviewedAt: '2026-11-11T09:00:00Z',
  },
];

// Initial Audit Logs
export const INITIAL_AUDIT_LOGS: RmsAuditLog[] = [
  {
    id: 'LOG-001',
    userId: 'USR-SUPERADMIN',
    userName: 'System Administrator',
    userRole: 'SUPER_ADMIN',
    action: 'INITIALIZE_RMS_PLATFORM',
    entityType: 'SYSTEM',
    entityId: 'RMS-2027',
    details: 'Reunion Management ERP initialized for Police Lines High School & College, Faridpur Reunion 2027.',
    timestamp: '2026-10-01T00:00:00Z',
  },
  {
    id: 'LOG-002',
    userId: 'USR-CONVENER',
    userName: 'Monowar Shikder',
    userRole: 'CONVENER',
    action: 'APPROVE_WEEKLY_REPORT',
    entityType: 'REPORT',
    entityId: 'WPR-01',
    details: 'Approved Week 1 progress report for Registration & Database Committee (Director: Sagar).',
    timestamp: '2026-11-11T09:00:00Z',
  },
];

/**
 * Enterprise ERP Service Class
 */
export class RmsStore {
  // Current Active User
  static getCurrentUser(): RmsUser {
    return loadData<RmsUser>(KEY_CURRENT_USER, INITIAL_RMS_USERS[0]);
  }

  static setCurrentUser(user: RmsUser): void {
    saveData(KEY_CURRENT_USER, user);
    this.recordAuditLog({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: 'USER_LOGIN_SWITCH',
      entityType: 'AUTH',
      entityId: user.id,
      details: `Switched active portal persona to ${user.fullName} (${user.role})`,
    });
  }

  static getUsers(): RmsUser[] {
    return INITIAL_RMS_USERS;
  }

  // ==========================================
  // 1. COMMITTEES
  // ==========================================
  static getCommittees(): CommitteeRecord[] {
    return loadData<CommitteeRecord[]>(KEY_COMMITTEES, INITIAL_COMMITTEES);
  }

  static saveCommittees(committees: CommitteeRecord[]): void {
    saveData(KEY_COMMITTEES, committees);
  }

  static createCommittee(comm: Omit<CommitteeRecord, 'id' | 'createdAt' | 'updatedAt'>): CommitteeRecord {
    const committees = this.getCommittees();
    const id = comm.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newComm: CommitteeRecord = {
      ...comm,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    committees.push(newComm);
    this.saveCommittees(committees);
    safeSupabaseUpsert('rms_committees', toCommitteeDbRow(newComm));

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'CREATE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: id,
      details: `Created committee: ${newComm.nameEn} (Director: ${newComm.directorName})`,
    });

    return newComm;
  }

  static updateCommittee(id: string, updates: Partial<CommitteeRecord>): boolean {
    const committees = this.getCommittees();
    const idx = committees.findIndex((c) => c.id === id);
    if (idx === -1) return false;

    committees[idx] = {
      ...committees[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveCommittees(committees);
    safeSupabaseUpsert('rms_committees', toCommitteeDbRow(committees[idx]));

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'UPDATE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: id,
      details: `Updated committee details for ${committees[idx].nameEn}`,
    });

    return true;
  }

  // ==========================================
  // 2. TASKS
  // ==========================================
  static getTasks(): RmsTask[] {
    return loadData<RmsTask[]>(KEY_TASKS, INITIAL_TASKS);
  }

  static saveTasks(tasks: RmsTask[]): void {
    saveData(KEY_TASKS, tasks);
  }

  static createTask(taskData: Omit<RmsTask, 'id' | 'createdAt' | 'updatedAt' | 'history'>): RmsTask {
    const tasks = this.getTasks();
    const id = `TSK-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTask: RmsTask = {
      ...taskData,
      title: sanitizeInput(taskData.title),
      description: sanitizeInput(taskData.description),
      assignedMemberName: taskData.assignedMemberName ? sanitizeInput(taskData.assignedMemberName) : undefined,
      id,
      history: [
        {
          id: safeRandomUUID(),
          taskId: id,
          action: 'CREATED',
          performedBy: sanitizeInput(taskData.createdByName),
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.unshift(newTask);
    this.saveTasks(tasks);
    safeSupabaseUpsert('rms_tasks', toTaskDbRow(newTask));

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'CREATE_TASK',
      entityType: 'TASK',
      entityId: id,
      details: `Created task "${newTask.title}" for committee ${newTask.committeeName}`,
    });

    return newTask;
  }

  static updateTaskStatus(
    taskId: string,
    status: RmsTask['status'],
    performedBy: string,
    evidence?: string,
    rejectionReason?: string
  ): boolean {
    const tasks = this.getTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;

    const prevStatus = task.status;
    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (evidence) task.completionEvidence = evidence;
    if (rejectionReason) task.rejectionReason = rejectionReason;

    task.history.push({
      id: safeRandomUUID(),
      taskId,
      action: `STATUS_CHANGE_TO_${status}`,
      performedBy,
      previousValue: prevStatus,
      newValue: status,
      timestamp: new Date().toISOString(),
    });

    this.saveTasks(tasks);
    safeSupabaseUpsert('rms_tasks', toTaskDbRow(task));

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'UPDATE_TASK_STATUS',
      entityType: 'TASK',
      entityId: taskId,
      previousValue: prevStatus,
      newValue: status,
      details: `Changed task ${taskId} status from ${prevStatus} to ${status}`,
    });

    return true;
  }

  static addTaskComment(taskId: string, authorId: string, authorName: string, authorRole: RmsRole, content: string): boolean {
    const tasks = this.getTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;

    task.comments.push({
      id: safeRandomUUID(),
      taskId,
      authorId,
      authorName: sanitizeInput(authorName),
      authorRole,
      content: sanitizeInput(content),
      timestamp: new Date().toISOString(),
    });
    task.updatedAt = new Date().toISOString();
    this.saveTasks(tasks);
    safeSupabaseUpsert('rms_tasks', toTaskDbRow(task));
    return true;
  }

  // ==========================================
  // 3. BUDGET & EXPENSES
  // ==========================================
  static getBudgetRequests(): BudgetRequest[] {
    return loadData<BudgetRequest[]>(KEY_BUDGET_REQUESTS, INITIAL_BUDGET_REQUESTS);
  }

  static saveBudgetRequests(reqs: BudgetRequest[]): void {
    saveData(KEY_BUDGET_REQUESTS, reqs);
  }

  static submitBudgetRequest(req: Omit<BudgetRequest, 'id' | 'requestDate' | 'status'>): BudgetRequest {
    const reqs = this.getBudgetRequests();
    const id = `BGT-${Math.floor(100 + Math.random() * 900)}`;
    const newReq: BudgetRequest = {
      ...req,
      id,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'SUBMITTED',
    };
    reqs.unshift(newReq);
    this.saveBudgetRequests(reqs);
    safeSupabaseUpsert('rms_budget_requests', toBudgetRequestDbRow(newReq));

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'SUBMIT_BUDGET_REQUEST',
      entityType: 'BUDGET',
      entityId: id,
      details: `Submitted budget request of ৳${newReq.requestedAmount} for ${newReq.committeeName}`,
    });

    return newReq;
  }

  static updateBudgetRequestStatus(
    reqId: string,
    status: BudgetRequest['status'],
    reviewerName: string,
    approvedAmount?: number,
    comments?: string
  ): boolean {
    const reqs = this.getBudgetRequests();
    const req = reqs.find((r) => r.id === reqId);
    if (!req) return false;

    const prevStatus = req.status;
    req.status = status;
    if (status === 'RECOMMENDED') {
      req.financeReviewerName = reviewerName;
      if (comments) req.financeComments = comments;
    } else if (status === 'APPROVED') {
      req.approvedByName = reviewerName;
      req.approvedAmount = approvedAmount ?? req.requestedAmount;
      req.approvalDate = new Date().toISOString();

      // Reflect in committee budget allocation
      const committees = this.getCommittees();
      const comm = committees.find((c) => c.id === req.committeeId);
      if (comm) {
        comm.budgetAllocated += req.approvedAmount;
        this.saveCommittees(committees);
        safeSupabaseUpsert('rms_committees', toCommitteeDbRow(comm));
      }
    } else if (status === 'REJECTED') {
      req.rejectionReason = comments || 'Request declined by central authority.';
    }

    this.saveBudgetRequests(reqs);
    safeSupabaseUpsert('rms_budget_requests', toBudgetRequestDbRow(req));

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: `BUDGET_${status}`,
      entityType: 'BUDGET',
      entityId: reqId,
      previousValue: prevStatus,
      newValue: status,
      details: `Budget request ${reqId} transitioned to ${status}`,
    });

    return true;
  }

  static getExpenses(): RmsExpense[] {
    return loadData<RmsExpense[]>(KEY_EXPENSES, INITIAL_EXPENSES);
  }

  static saveExpenses(expenses: RmsExpense[]): void {
    saveData(KEY_EXPENSES, expenses);
  }

  static recordExpense(exp: Omit<RmsExpense, 'id' | 'createdAt' | 'verificationStatus'>): RmsExpense {
    const expenses = this.getExpenses();
    const id = `EXP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newExp: RmsExpense = {
      ...exp,
      expenseTitle: sanitizeInput(exp.expenseTitle),
      vendor: sanitizeInput(exp.vendor),
      voucherUrl: exp.voucherUrl ? sanitizeUrl(exp.voucherUrl) : undefined,
      id,
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString(),
    };
    expenses.unshift(newExp);
    this.saveExpenses(expenses);
    safeSupabaseUpsert('rms_expenses', toExpenseDbRow(newExp));

    // Update committee spent balance
    const committees = this.getCommittees();
    const comm = committees.find((c) => c.id === exp.committeeId);
    if (comm) {
      comm.budgetSpent += exp.amount;
      this.saveCommittees(committees);
      safeSupabaseUpsert('rms_committees', toCommitteeDbRow(comm));
    }

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'RECORD_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      details: `Recorded expense ৳${newExp.amount} for ${newExp.committeeName} (${newExp.expenseTitle})`,
    });

    return newExp;
  }

  static reverseExpense(expenseId: string, reversalReason: string, authorizedBy: string): boolean {
    const expenses = this.getExpenses();
    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp || exp.verificationStatus === 'REVERSED') return false;

    exp.verificationStatus = 'REVERSED';
    exp.reversalReason = reversalReason;
    exp.reversalAuthorizedBy = authorizedBy;
    this.saveExpenses(expenses);
    safeSupabaseUpsert('rms_expenses', toExpenseDbRow(exp));

    // Deduct from committee spent balance
    const committees = this.getCommittees();
    const comm = committees.find((c) => c.id === exp.committeeId);
    if (comm) {
      comm.budgetSpent = Math.max(0, comm.budgetSpent - exp.amount);
      this.saveCommittees(committees);
      safeSupabaseUpsert('rms_committees', toCommitteeDbRow(comm));
    }

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'REVERSE_EXPENSE',
      entityType: 'EXPENSE',
      entityId: expenseId,
      details: `Reversed expense ৳${exp.amount}. Reason: ${reversalReason}`,
    });

    return true;
  }

  static getIncomeTransactions(): RmsIncomeTransaction[] {
    return loadData<RmsIncomeTransaction[]>(KEY_INCOME, [
      {
        id: 'INC-01',
        source: 'SPONSORSHIP',
        sourceTitle: 'Meghna Group Title Sponsorship First Tranche',
        referenceId: 'SPN-01',
        amount: 1000000,
        receivedDate: '2026-10-25',
        paymentMethod: 'Bank Wire',
        recordedBy: 'Zahirul Haque',
        status: 'CONFIRMED',
        createdAt: '2026-10-25T00:00:00Z',
      },
      {
        id: 'INC-02',
        source: 'SPONSORSHIP',
        sourceTitle: 'City Bank Platinum Partner Full Settlement',
        referenceId: 'SPN-02',
        amount: 800000,
        receivedDate: '2026-10-28',
        paymentMethod: 'Pay Order',
        recordedBy: 'Zahirul Haque',
        status: 'CONFIRMED',
        createdAt: '2026-10-28T00:00:00Z',
      },
    ]);
  }

  // ==========================================
  // 4. SPONSORSHIP CRM
  // ==========================================
  static getSponsors(): RmsSponsor[] {
    return loadData<RmsSponsor[]>(KEY_SPONSORS, INITIAL_SPONSORS);
  }

  static saveSponsors(sponsors: RmsSponsor[]): void {
    saveData(KEY_SPONSORS, sponsors);
  }

  static saveSponsor(sponsor: RmsSponsor): void {
    const list = this.getSponsors();
    const sanitizedSponsor: RmsSponsor = {
      ...sponsor,
      companyName: sanitizeInput(sponsor.companyName),
      contactPerson: sanitizeInput(sponsor.contactPerson),
      email: sanitizeInput(sponsor.email),
      phone: sanitizeInput(sponsor.phone),
      address: sanitizeInput(sponsor.address),
      agreementDocumentUrl: sponsor.agreementDocumentUrl ? sanitizeUrl(sponsor.agreementDocumentUrl) : undefined,
    };
    const idx = list.findIndex((s) => s.id === sponsor.id);
    if (idx >= 0) {
      list[idx] = sanitizedSponsor;
    } else {
      list.unshift(sanitizedSponsor);
    }
    this.saveSponsors(list);
    safeSupabaseUpsert('rms_sponsors', toSponsorDbRow(sanitizedSponsor));
  }

  // ==========================================
  // 5. DOCUMENTS
  // ==========================================
  static getDocuments(): RmsDocument[] {
    return loadData<RmsDocument[]>(KEY_DOCUMENTS, INITIAL_DOCUMENTS);
  }

  static saveDocuments(docs: RmsDocument[]): void {
    saveData(KEY_DOCUMENTS, docs);
  }

  static uploadDocument(doc: Omit<RmsDocument, 'id' | 'uploadedAt' | 'version'>): RmsDocument {
    const docs = this.getDocuments();
    const id = `DOC-${Math.floor(100 + Math.random() * 900)}`;
    const newDoc: RmsDocument = {
      ...doc,
      title: sanitizeInput(doc.title),
      fileName: sanitizeInput(doc.fileName),
      fileUrl: sanitizeUrl(doc.fileUrl),
      id,
      version: 1,
      uploadedAt: new Date().toISOString(),
    };
    docs.unshift(newDoc);
    this.saveDocuments(docs);
    safeSupabaseUpsert('rms_documents', toDocumentDbRow(newDoc));

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'UPLOAD_DOCUMENT',
      entityType: 'DOCUMENT',
      entityId: id,
      details: `Uploaded document "${newDoc.title}" for ${newDoc.committeeName}`,
    });

    return newDoc;
  }

  // ==========================================
  // 6. MEETINGS & CALENDAR
  // ==========================================
  static getMeetings(): RmsMeeting[] {
    return loadData<RmsMeeting[]>(KEY_MEETINGS, INITIAL_MEETINGS);
  }

  static saveMeetings(meetings: RmsMeeting[]): void {
    saveData(KEY_MEETINGS, meetings);
  }

  static scheduleMeeting(meetingData: Omit<RmsMeeting, 'id' | 'createdAt'>): RmsMeeting {
    const meetings = this.getMeetings();
    const id = `MTG-${Math.floor(100 + Math.random() * 900)}`;
    const newMeeting: RmsMeeting = {
      ...meetingData,
      title: sanitizeInput(meetingData.title),
      venue: sanitizeInput(meetingData.venue),
      minutesDocumentUrl: meetingData.minutesDocumentUrl ? sanitizeUrl(meetingData.minutesDocumentUrl) : undefined,
      meetingMinutes: meetingData.meetingMinutes ? sanitizeInput(meetingData.meetingMinutes) : undefined,
      agenda: (meetingData.agenda || []).map((item) => sanitizeInput(item)),
      decisions: (meetingData.decisions || []).map((item) => sanitizeInput(item)),
      id,
      createdAt: new Date().toISOString(),
    };
    meetings.unshift(newMeeting);
    this.saveMeetings(meetings);
    safeSupabaseUpsert('rms_meetings', toMeetingDbRow(newMeeting));

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'SCHEDULE_MEETING',
      entityType: 'MEETING',
      entityId: id,
      details: `Scheduled meeting "${newMeeting.title}" on ${newMeeting.meetingDate}`,
    });

    return newMeeting;
  }

  // ==========================================
  // 7. ANNOUNCEMENTS & NOTIFICATIONS
  // ==========================================
  static getAnnouncements(): RmsAnnouncement[] {
    return loadData<RmsAnnouncement[]>(KEY_ANNOUNCEMENTS, INITIAL_ANNOUNCEMENTS);
  }

  static saveAnnouncements(anns: RmsAnnouncement[]): void {
    saveData(KEY_ANNOUNCEMENTS, anns);
  }

  static createAnnouncement(annData: Omit<RmsAnnouncement, 'id' | 'createdAt' | 'isActive'>): RmsAnnouncement {
    const anns = this.getAnnouncements();
    const id = `ANN-${Math.floor(100 + Math.random() * 900)}`;
    const newAnn: RmsAnnouncement = {
      ...annData,
      titleEn: sanitizeInput(annData.titleEn),
      titleBn: sanitizeInput(annData.titleBn),
      contentEn: sanitizeInput(annData.contentEn),
      contentBn: sanitizeInput(annData.contentBn),
      id,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    anns.unshift(newAnn);
    this.saveAnnouncements(anns);
    safeSupabaseUpsert('rms_announcements', toAnnouncementDbRow(newAnn));
    return newAnn;
  }

  static getNotifications(): RmsNotification[] {
    return loadData<RmsNotification[]>(KEY_NOTIFICATIONS, [
      {
        id: 'NOTIF-01',
        title: 'New Budget Approval',
        message: 'Advance of ৳500,000 for Food & Catering has been approved by Convener.',
        actionUrl: '#finance',
        isRead: false,
        type: 'BUDGET',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'NOTIF-02',
        title: 'Steering Committee Meeting',
        message: 'Upcoming Central Committee meeting scheduled on Nov 20, 4:00 PM at School Auditorium.',
        actionUrl: '#meetings',
        isRead: false,
        type: 'MEETING',
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  static markNotificationRead(id: string): void {
    const list = this.getNotifications();
    const target = list.find((n) => n.id === id);
    if (target) {
      target.isRead = true;
      saveData(KEY_NOTIFICATIONS, list);
    }
  }

  // ==========================================
  // 8. VOLUNTEERS
  // ==========================================
  static getVolunteers(): VolunteerRecord[] {
    return loadData<VolunteerRecord[]>(KEY_VOLUNTEERS, INITIAL_VOLUNTEERS);
  }

  static saveVolunteers(volunteers: VolunteerRecord[]): void {
    saveData(KEY_VOLUNTEERS, volunteers);
  }

  static saveVolunteer(vol: VolunteerRecord): void {
    const list = this.getVolunteers();
    const sanitizedVol: VolunteerRecord = {
      ...vol,
      fullName: sanitizeInput(vol.fullName),
      phone: sanitizeInput(vol.phone),
      assignedLocation: sanitizeInput(vol.assignedLocation),
      supervisorName: sanitizeInput(vol.supervisorName),
    };
    const idx = list.findIndex((v) => v.id === vol.id);
    if (idx >= 0) {
      list[idx] = sanitizedVol;
    } else {
      list.unshift(sanitizedVol);
    }
    this.saveVolunteers(list);
    safeSupabaseUpsert('rms_volunteers', toVolunteerDbRow(sanitizedVol));
  }

  static volunteerCheckIn(volunteerId: string): boolean {
    const list = this.getVolunteers();
    const vol = list.find((v) => v.id === volunteerId);
    if (!vol) return false;
    vol.attendanceStatus = 'CHECKED_IN';
    vol.checkInTime = new Date().toISOString();
    this.saveVolunteers(list);
    safeSupabaseUpsert('rms_volunteers', toVolunteerDbRow(vol));
    return true;
  }

  static volunteerCheckOut(volunteerId: string): boolean {
    const list = this.getVolunteers();
    const vol = list.find((v) => v.id === volunteerId);
    if (!vol) return false;
    vol.attendanceStatus = 'COMPLETED';
    vol.checkOutTime = new Date().toISOString();
    this.saveVolunteers(list);
    safeSupabaseUpsert('rms_volunteers', toVolunteerDbRow(vol));
    return true;
  }

  // ==========================================
  // 9. EVENT DAY CONTROL & INCIDENTS
  // ==========================================
  static getIncidents(): IncidentReport[] {
    return loadData<IncidentReport[]>(KEY_INCIDENTS, INITIAL_INCIDENTS);
  }

  static saveIncidents(incidents: IncidentReport[]): void {
    saveData(KEY_INCIDENTS, incidents);
  }

  static reportIncident(inc: Omit<IncidentReport, 'id' | 'reportedAt' | 'resolutionStatus'>): IncidentReport {
    const list = this.getIncidents();
    const id = `INC-${Math.floor(100 + Math.random() * 900)}`;
    const newInc: IncidentReport = {
      ...inc,
      description: sanitizeInput(inc.description),
      location: sanitizeInput(inc.location),
      reportedByName: sanitizeInput(inc.reportedByName),
      id,
      resolutionStatus: 'REPORTED',
      reportedAt: new Date().toISOString(),
    };
    list.unshift(newInc);
    this.saveIncidents(list);
    return newInc;
  }

  static updateIncidentStatus(
    incidentId: string,
    status: IncidentReport['resolutionStatus'],
    notes?: string
  ): boolean {
    const list = this.getIncidents();
    const inc = list.find((i) => i.id === incidentId);
    if (!inc) return false;
    inc.resolutionStatus = status;
    if (notes) inc.resolutionNotes = notes;
    if (status === 'RESOLVED') inc.resolvedAt = new Date().toISOString();
    this.saveIncidents(list);
    return true;
  }

  // ==========================================
  // 10. WEEKLY REPORTS
  // ==========================================
  static getWeeklyReports(): WeeklyProgressReport[] {
    return loadData<WeeklyProgressReport[]>(KEY_WEEKLY_REPORTS, INITIAL_WEEKLY_REPORTS);
  }

  static saveWeeklyReports(reports: WeeklyProgressReport[]): void {
    saveData(KEY_WEEKLY_REPORTS, reports);
  }

  static submitWeeklyReport(reportData: Omit<WeeklyProgressReport, 'id' | 'reportDate' | 'status'>): WeeklyProgressReport {
    const list = this.getWeeklyReports();
    const id = `WPR-${Math.floor(100 + Math.random() * 900)}`;
    const newReport: WeeklyProgressReport = {
      ...reportData,
      workCompleted: (reportData.workCompleted || []).map((w) => sanitizeInput(w)),
      workInProgress: (reportData.workInProgress || []).map((w) => sanitizeInput(w)),
      workPending: (reportData.workPending || []).map((w) => sanitizeInput(w)),
      problemsEncountered: sanitizeInput(reportData.problemsEncountered || ''),
      supportRequired: sanitizeInput(reportData.supportRequired || ''),
      id,
      reportDate: new Date().toISOString().split('T')[0],
      status: 'SUBMITTED',
    };
    list.unshift(newReport);
    this.saveWeeklyReports(list);

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: 'SUBMIT_WEEKLY_REPORT',
      entityType: 'REPORT',
      entityId: id,
      details: `Submitted Week ${newReport.reportWeekNumber} report for ${newReport.committeeName}`,
    });

    return newReport;
  }

  static reviewWeeklyReport(
    reportId: string,
    action: 'APPROVE' | 'REQUEST_REVISION',
    reviewerName: string,
    comments?: string
  ): boolean {
    const list = this.getWeeklyReports();
    const rep = list.find((r) => r.id === reportId);
    if (!rep) return false;

    rep.status = action === 'APPROVE' ? 'APPROVED' : 'REVISION_REQUESTED';
    rep.reviewedBy = reviewerName;
    rep.reviewedAt = new Date().toISOString();
    if (comments) rep.reviewerComments = comments;
    this.saveWeeklyReports(list);

    const currentUser = this.getCurrentUser();
    this.recordAuditLog({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action: `REPORT_${action}`,
      entityType: 'REPORT',
      entityId: reportId,
      details: `${action === 'APPROVE' ? 'Approved' : 'Requested revision on'} weekly report ${reportId} for ${rep.committeeName}`,
    });

    return true;
  }

  // ==========================================
  // 11. AUDIT LOGS
  // ==========================================
  static getAuditLogs(): RmsAuditLog[] {
    return loadData<RmsAuditLog[]>(KEY_AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }

  static saveAuditLogs(logs: RmsAuditLog[]): void {
    saveData(KEY_AUDIT_LOGS, logs);
  }

  static recordAuditLog(entry: Omit<RmsAuditLog, 'id' | 'timestamp'>): void {
    const logs = this.getAuditLogs();
    const newEntry: RmsAuditLog = {
      ...entry,
      id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    this.saveAuditLogs(logs);
    safeSupabaseInsert('rms_audit_logs', toAuditLogDbRow(newEntry));
  }

  // ==========================================
  // 12. SUPABASE BACKGROUND SYNCHRONIZATION
  // ==========================================
  static async syncWithSupabase(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    try {
      let syncedCount = 0;

      // 1. Committees
      const { data: commRows, error: commErr } = await supabase.from('rms_committees').select('*');
      if (!commErr && Array.isArray(commRows) && commRows.length > 0) {
        const dbComms = commRows.map(fromCommitteeDbRow);
        const localComms = this.getCommittees();
        const localMap = new Map(localComms.map((c) => [c.id, c]));
        const mergedComms = dbComms.map((c) => {
          const local = localMap.get(c.id);
          return {
            ...c,
            members: local?.members && local.members.length > 0 ? local.members : c.members,
          };
        });
        const dbIds = new Set(dbComms.map((c) => c.id));
        for (const local of localComms) {
          if (!dbIds.has(local.id)) mergedComms.push(local);
        }
        this.saveCommittees(mergedComms);
        syncedCount += dbComms.length;
      }

      // 2. Tasks
      const { data: taskRows, error: taskErr } = await supabase.from('rms_tasks').select('*');
      if (!taskErr && Array.isArray(taskRows) && taskRows.length > 0) {
        const dbTasks = taskRows.map(fromTaskDbRow);
        const localTasks = this.getTasks();
        const localMap = new Map(localTasks.map((t) => [t.id, t]));
        const mergedTasks = dbTasks.map((t) => {
          const local = localMap.get(t.id);
          return {
            ...t,
            comments: local?.comments && local.comments.length > 0 ? local.comments : t.comments,
            history: local?.history && local.history.length > 0 ? local.history : t.history,
          };
        });
        const dbIds = new Set(dbTasks.map((t) => t.id));
        for (const local of localTasks) {
          if (!dbIds.has(local.id)) mergedTasks.push(local);
        }
        this.saveTasks(mergedTasks);
        syncedCount += dbTasks.length;
      }

      // 3. Budget Requests
      const { data: bgtRows, error: bgtErr } = await supabase.from('rms_budget_requests').select('*');
      if (!bgtErr && Array.isArray(bgtRows) && bgtRows.length > 0) {
        const dbBgts = bgtRows.map(fromBudgetRequestDbRow);
        const localBgts = this.getBudgetRequests();
        const dbIds = new Set(dbBgts.map((b) => b.id));
        const mergedBgts = [...dbBgts];
        for (const local of localBgts) {
          if (!dbIds.has(local.id)) mergedBgts.push(local);
        }
        this.saveBudgetRequests(mergedBgts);
        syncedCount += dbBgts.length;
      }

      // 4. Expenses
      const { data: expRows, error: expErr } = await supabase.from('rms_expenses').select('*');
      if (!expErr && Array.isArray(expRows) && expRows.length > 0) {
        const dbExps = expRows.map(fromExpenseDbRow);
        const localExps = this.getExpenses();
        const dbIds = new Set(dbExps.map((e) => e.id));
        const mergedExps = [...dbExps];
        for (const local of localExps) {
          if (!dbIds.has(local.id)) mergedExps.push(local);
        }
        this.saveExpenses(mergedExps);
        syncedCount += dbExps.length;
      }

      // 5. Sponsors
      const { data: spnRows, error: spnErr } = await supabase.from('rms_sponsors').select('*');
      if (!spnErr && Array.isArray(spnRows) && spnRows.length > 0) {
        const dbSpns = spnRows.map(fromSponsorDbRow);
        const localSpns = this.getSponsors();
        const dbIds = new Set(dbSpns.map((s) => s.id));
        const mergedSpns = [...dbSpns];
        for (const local of localSpns) {
          if (!dbIds.has(local.id)) mergedSpns.push(local);
        }
        this.saveSponsors(mergedSpns);
        syncedCount += dbSpns.length;
      }

      // 6. Meetings
      const { data: mtgRows, error: mtgErr } = await supabase.from('rms_meetings').select('*');
      if (!mtgErr && Array.isArray(mtgRows) && mtgRows.length > 0) {
        const dbMtgs = mtgRows.map(fromMeetingDbRow);
        const localMtgs = this.getMeetings();
        const dbIds = new Set(dbMtgs.map((m) => m.id));
        const mergedMtgs = [...dbMtgs];
        for (const local of localMtgs) {
          if (!dbIds.has(local.id)) mergedMtgs.push(local);
        }
        this.saveMeetings(mergedMtgs);
        syncedCount += dbMtgs.length;
      }

      // 7. Volunteers
      const { data: volRows, error: volErr } = await supabase.from('rms_volunteers').select('*');
      if (!volErr && Array.isArray(volRows) && volRows.length > 0) {
        const dbVols = volRows.map(fromVolunteerDbRow);
        const localVols = this.getVolunteers();
        const dbIds = new Set(dbVols.map((v) => v.id));
        const mergedVols = [...dbVols];
        for (const local of localVols) {
          if (!dbIds.has(local.id)) mergedVols.push(local);
        }
        this.saveVolunteers(mergedVols);
        syncedCount += dbVols.length;
      }

      // 8. Announcements
      const { data: annRows, error: annErr } = await supabase.from('rms_announcements').select('*');
      if (!annErr && Array.isArray(annRows) && annRows.length > 0) {
        const dbAnns = annRows.map(fromAnnouncementDbRow);
        const localAnns = this.getAnnouncements();
        const dbIds = new Set(dbAnns.map((a) => a.id));
        const mergedAnns = [...dbAnns];
        for (const local of localAnns) {
          if (!dbIds.has(local.id)) mergedAnns.push(local);
        }
        this.saveAnnouncements(mergedAnns);
        syncedCount += dbAnns.length;
      }

      return { success: true, syncedCount };
    } catch (err: any) {
      if (!isNetworkException(err)) {
        console.warn('[RMS Store] Supabase sync encountered non-blocking notice:', err?.message || err);
      }
      return { success: false, syncedCount: 0, error: err?.message || 'Sync failed' };
    }
  }
}

