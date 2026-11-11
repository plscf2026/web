/**
 * Police Lines High School & College, Faridpur Reunion 2027
 * Reunion Management System (RMS) - Authoritative Type Definitions
 */

export type RmsRole =
  | 'SUPER_ADMIN'
  | 'CHIEF_ADVISER'
  | 'CONVENER'
  | 'MEMBER_SECRETARY'
  | 'COMMITTEE_DIRECTOR'
  | 'ASSISTANT_DIRECTOR'
  | 'COMMITTEE_MEMBER'
  | 'FINANCE_OFFICER'
  | 'EVENT_VOLUNTEER';

export type CommitteeId =
  | 'publicity-publication'
  | 'media-digital'
  | 'rally-procession'
  | 'registration-database'
  | 'finance-accounts'
  | 'sponsorship-partnership'
  | 'food-catering'
  | 'cultural-affairs'
  | 'event-production'
  | 'hospitality-protocol'
  | 'security-discipline'
  | 'venue-decoration'
  | string;

export interface RmsUser {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: RmsRole;
  committeeId?: CommitteeId;
  committeeTitle?: string;
  designation?: string;
  avatarUrl?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  lastLogin?: string;
}

export interface CommitteeMemberRecord {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: 'DIRECTOR' | 'ASSISTANT_DIRECTOR' | 'MEMBER' | 'COORDINATOR';
  assignedResponsibilities: string[];
  joinedDate: string;
  status: 'ACTIVE' | 'TRANSFERRED' | 'INACTIVE';
}

export interface CommitteeRecord {
  id: CommitteeId;
  nameEn: string;
  nameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  directorId: string;
  directorName: string;
  directorPhone: string;
  directorEmail: string;
  assistantDirectorIds: string[];
  assistantDirectorNames: string[];
  members: CommitteeMemberRecord[];
  assignedResponsibilities: string[];
  budgetTotal: number;
  budgetAllocated: number;
  budgetSpent: number;
  isActive: boolean;
  meetingDay?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorRole: RmsRole;
  content: string;
  timestamp: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TaskHistoryItem {
  id: string;
  taskId: string;
  action: string;
  performedBy: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface RmsTask {
  id: string;
  title: string;
  description: string;
  committeeId: CommitteeId;
  committeeName: string;
  assignedMemberId?: string;
  assignedMemberName?: string;
  createdBy: string;
  createdByName: string;
  startDate: string;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  attachments: TaskAttachment[];
  comments: TaskComment[];
  completionEvidence?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  history: TaskHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export type BudgetStatus =
  | 'SUBMITTED'
  | 'FINANCE_REVIEWED'
  | 'RECOMMENDED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED';

export interface BudgetRequest {
  id: string;
  committeeId: CommitteeId;
  committeeName: string;
  requestTitle: string;
  expenseCategory: string;
  requestedAmount: number;
  description: string;
  supportingDocuments: string[];
  requestedBy: string;
  requestedByName: string;
  requestDate: string;
  status: BudgetStatus;
  financeReviewerId?: string;
  financeReviewerName?: string;
  financeComments?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAmount?: number;
  approvalDate?: string;
  rejectionReason?: string;
}

export interface RmsExpense {
  id: string;
  committeeId: CommitteeId;
  committeeName: string;
  expenseTitle: string;
  expenseCategory: string;
  amount: number;
  paymentMethod: 'CASH' | 'BKASH' | 'NAGAD' | 'BANK_TRANSFER' | 'CHEQUE';
  vendor: string;
  expenseDate: string;
  voucherNumber: string;
  voucherUrl?: string;
  submittedBy: string;
  submittedByName: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVERSED';
  verifiedBy?: string;
  verifiedByName?: string;
  reversalReason?: string;
  reversalAuthorizedBy?: string;
  createdAt: string;
}

export interface RmsIncomeTransaction {
  id: string;
  source: 'REGISTRATION' | 'SPONSORSHIP' | 'DONATION' | 'OTHER';
  sourceTitle: string;
  referenceId: string;
  amount: number;
  receivedDate: string;
  paymentMethod: string;
  recordedBy: string;
  status: 'CONFIRMED' | 'PENDING' | 'REVERSED';
  createdAt: string;
}

export type SponsorTier =
  | 'TITLE_SPONSOR'
  | 'PLATINUM'
  | 'GOLD'
  | 'SILVER'
  | 'SUPPORTING'
  | 'MEDIA_PARTNER'
  | 'OTHER_PARTNER';

export interface SponsorBenefit {
  id: string;
  name: string;
  category: 'LOGO' | 'STAGE' | 'BANNER' | 'SOCIAL' | 'BOOTH' | 'VIP_PASS';
  isDelivered: boolean;
  notes?: string;
}

export interface RmsSponsor {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  category: SponsorTier;
  proposedAmount: number;
  agreedAmount: number;
  receivedAmount: number;
  paymentStatus: 'NOT_PAID' | 'PARTIAL' | 'PAID_FULL';
  agreementDocumentUrl?: string;
  contactHistory: Array<{
    date: string;
    communicator: string;
    summary: string;
    nextFollowUp?: string;
  }>;
  assignedMemberId?: string;
  assignedMemberName?: string;
  benefits: SponsorBenefit[];
  createdAt: string;
}

export interface RmsDocument {
  id: string;
  title: string;
  committeeId: CommitteeId;
  committeeName: string;
  category:
    | 'OFFICIAL_LETTERS'
    | 'PERMISSION_DOCUMENTS'
    | 'MEETING_MINUTES'
    | 'BUDGET_PROPOSALS'
    | 'BILLS_VOUCHERS'
    | 'SPONSORSHIP_AGREEMENTS'
    | 'EVENT_DESIGNS'
    | 'VENDOR_AGREEMENTS'
    | 'PHOTOS_VIDEOS'
    | 'OTHER';
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: string;
  version: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  accessPermission: 'PUBLIC' | 'COMMITTEE_ONLY' | 'CENTRAL_ONLY';
}

export interface RmsMeeting {
  id: string;
  title: string;
  committeeId?: CommitteeId;
  committeeName?: string;
  isCentralMeeting: boolean;
  meetingDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  agenda: string[];
  attendees: Array<{
    userId: string;
    userName: string;
    role: string;
    attended: boolean;
  }>;
  meetingMinutes?: string;
  decisions: string[];
  followUpTasks: Array<{
    description: string;
    assignedTo: string;
    deadline: string;
  }>;
  minutesDocumentUrl?: string;
  createdBy: string;
  createdAt: string;
}

export interface RmsNotification {
  id: string;
  userId?: string;
  targetRole?: RmsRole;
  targetCommitteeId?: CommitteeId;
  title: string;
  message: string;
  actionUrl?: string;
  isRead: boolean;
  type: 'TASK' | 'BUDGET' | 'MEETING' | 'ALERT' | 'ANNOUNCEMENT';
  timestamp: string;
}

export interface RmsAnnouncement {
  id: string;
  titleEn: string;
  titleBn: string;
  contentEn: string;
  contentBn: string;
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  targetAudience: 'ALL' | 'COMMITTEE_HEADS' | 'VOLUNTEERS' | 'PUBLIC';
  committeeId?: CommitteeId;
  authorName: string;
  createdAt: string;
  isActive: boolean;
}

export interface VolunteerRecord {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  assignedCommitteeId: CommitteeId;
  assignedLocation: string;
  assignedDate: string;
  dutyStartTime: string;
  dutyEndTime: string;
  supervisorName: string;
  supervisorPhone: string;
  attendanceStatus: 'PENDING' | 'CHECKED_IN' | 'COMPLETED' | 'ABSENT';
  checkInTime?: string;
  checkOutTime?: string;
  responsibilities: string[];
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
}

export interface IncidentReport {
  id: string;
  incidentType:
    | 'MEDICAL'
    | 'SECURITY'
    | 'TECHNICAL'
    | 'CROWD_MANAGEMENT'
    | 'FOOD_BEVERAGE'
    | 'LOST_FOUND'
    | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  location: string;
  description: string;
  reportedBy: string;
  reportedByName: string;
  reportedAt: string;
  assignedTeam: string;
  assignedResponder?: string;
  resolutionStatus: 'REPORTED' | 'DISPATCHED' | 'IN_PROGRESS' | 'RESOLVED';
  resolutionNotes?: string;
  resolvedAt?: string;
}

export interface WeeklyProgressReport {
  id: string;
  committeeId: CommitteeId;
  committeeName: string;
  directorId: string;
  directorName: string;
  reportWeekNumber: number;
  reportDate: string;
  workCompleted: string[];
  workInProgress: string[];
  workPending: string[];
  problemsEncountered: string;
  budgetSpent: number;
  upcomingActivities: string[];
  supportRequired: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REVISION_REQUESTED';
  reviewerComments?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface RmsAuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: RmsRole;
  action: string;
  entityType:
    | 'COMMITTEE'
    | 'TASK'
    | 'BUDGET'
    | 'EXPENSE'
    | 'SPONSOR'
    | 'DOCUMENT'
    | 'MEETING'
    | 'VOLUNTEER'
    | 'INCIDENT'
    | 'REPORT'
    | 'AUTH'
    | 'SYSTEM';
  entityId: string;
  previousValue?: string;
  newValue?: string;
  details: string;
  timestamp: string;
}

