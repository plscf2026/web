/**
 * Police Lines School and College, Faridpur - Reunion 2026 / 2027
 * Student ID Card Management System Types
 */

export type IdCardStaffRole = 'SUPER_ADMIN' | 'ID_CARD_SUPERVISOR' | 'ID_CARD_STAFF';

export type IdCardStaffStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'DISABLED';

export interface IdCardStaffPermissions {
  canGenerate: boolean;
  canDownloadSingle: boolean;
  canDownloadBatch: boolean;
  canDownloadAll: boolean;
  assignedBatchYears?: string[]; // Empty means all years
}

export interface IdCardStaffAccount {
  id: string; // IDC-STF-001
  fullName: string;
  username: string;
  email: string;
  passwordHash?: string;
  role: IdCardStaffRole;
  status: IdCardStaffStatus;
  permissions: IdCardStaffPermissions;
  assignedBatchYears: string[];
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  lastLoginAt?: string;
}

export type StudentIdCardStatus =
  | 'ELIGIBLE'          // Paid & ready for generation
  | 'GENERATED'         // PDF generated & saved
  | 'REGENERATED'       // Updated/regenerated after info update
  | 'FLAGGED_REVIEW';   // Missing photo or graduation year

export interface StudentIdCardRecord {
  id: string; // IDC-PLSCF-2026-F1001
  registrationId: string; // Primary reference
  eventYear: number; // 2026 or 2027
  studentName: string;
  studentNameBn?: string;
  batchYear: string; // e.g. "1998", "2014", or "REVIEW_REQUIRED"
  batchName: string; // e.g. "SSC 1998", "Class 10 Section A"
  idNumber: string; // Registration ID
  contactNumber: string; // Registered mobile
  photoUrl?: string;
  hasPhoto: boolean;
  qrToken: string; // Secure unique verification token
  verificationUrl: string;
  cardStatus: StudentIdCardStatus;
  reviewReason?: string; // If flagged for review
  pdfStoragePath?: string; // Relative storage path
  pdfDataUri?: string; // Cached client-side data URI
  pdfFileSizeBytes?: number;
  pdfChecksum?: string;
  cardDimensions: '54x86mm';
  version: number;
  generatedAt?: string;
  generatedBy?: string;
  regeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchIdCardCollection {
  id: string;
  batchYear: string;
  totalEligibleStudents: number;
  totalGeneratedCards: number;
  totalPendingCards: number;
  hasMissingInfoCount: number;
  combinedPdfPath?: string;
  combinedPdfSize?: number;
  batchZipPath?: string;
  batchZipSize?: number;
  status: 'PENDING' | 'GENERATING' | 'READY' | 'ERROR';
  lastGeneratedAt?: string;
}

export type IdCardDownloadType =
  | 'INDIVIDUAL_PDF'
  | 'BATCH_COMBINED_PDF'
  | 'BATCH_ZIP'
  | 'ALL_CARDS_BULK_ZIP';

export interface IdCardDownloadJob {
  id: string;
  requestedById: string;
  requestedByName: string;
  jobType: IdCardDownloadType;
  targetBatchYear?: string;
  totalCards: number;
  processedCards: number;
  progressPercentage: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  archiveFilename: string;
  archiveStoragePath?: string;
  archiveBlobUrl?: string;
  archiveFileSizeBytes?: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface IdCardDownloadLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  downloadType: IdCardDownloadType;
  batchYear: string;
  registrationId?: string;
  cardCount: number;
  ipAddress?: string;
  status: 'SUCCESS' | 'FAILED';
  details?: string;
  timestamp: string;
}

export interface IdCardSystemSettings {
  autoGenerateOnPayment: boolean;
  pdfQualityDpi: 300 | 600;
  a4CardsPerRow: number; // default 3
  a4CardsPerColumn: number; // default 3
  includeCuttingMarks: boolean;
  verificationEndpoint: string;
  organizationName: string;
  eventTitle: string;
}

export const DEFAULT_ID_CARD_SETTINGS: IdCardSystemSettings = {
  autoGenerateOnPayment: true,
  pdfQualityDpi: 300,
  a4CardsPerRow: 3,
  a4CardsPerColumn: 3,
  includeCuttingMarks: true,
  verificationEndpoint: 'https://plscf2026.reunion.org/verify-student-id',
  organizationName: 'Police Lines School & College, Faridpur',
  eventTitle: 'Grand Reunion 2026 / 2027',
};

