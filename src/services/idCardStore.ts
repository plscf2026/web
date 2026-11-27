/**
 * Police Lines School and College, Faridpur - Grand Reunion 2026 / 2027
 * Student ID Card Management System Store & Database Sync Engine
 */

import {
  IdCardStaffAccount,
  StudentIdCardRecord,
  BatchIdCardCollection,
  IdCardDownloadJob,
  IdCardDownloadLog,
  IdCardSystemSettings,
  DEFAULT_ID_CARD_SETTINGS,
} from '../types/idcard';
import { RegistrationRecord } from '../types';
import { AppStore } from './store';
import { safeRandomUUID } from '../utils/security';
import { supabase, isNetworkException } from './supabase';

// ============================================================================
// SNAKE_CASE <-> CAMELCASE MAPPERS FOR SUPABASE POSTGRESQL
// ============================================================================

export function toStudentIdCardDbRow(card: StudentIdCardRecord): Record<string, any> {
  return {
    id: card.id,
    registration_id: card.registrationId,
    event_year: Number(card.eventYear) || 2027,
    student_name: card.studentName,
    student_name_bn: card.studentNameBn || null,
    batch_year: card.batchYear,
    batch_name: card.batchName,
    id_number: card.idNumber,
    contact_number: card.contactNumber,
    photo_url: card.photoUrl || null,
    has_photo: Boolean(card.hasPhoto),
    qr_token: card.qrToken,
    verification_url: card.verificationUrl,
    card_status: card.cardStatus || 'ELIGIBLE',
    review_reason: card.reviewReason || null,
    pdf_storage_path: card.pdfStoragePath || null,
    pdf_file_size_bytes: card.pdfFileSizeBytes || 0,
    card_dimensions: card.cardDimensions || '54x86mm',
    version: Number(card.version) || 1,
    generated_at: card.generatedAt || null,
    generated_by: card.generatedBy || null,
    created_at: card.createdAt || new Date().toISOString(),
    updated_at: card.updatedAt || new Date().toISOString(),
  };
}

export function fromStudentIdCardDbRow(row: any): StudentIdCardRecord {
  return {
    id: row.id,
    registrationId: row.registration_id,
    eventYear: Number(row.event_year) || 2027,
    studentName: row.student_name || 'Student',
    studentNameBn: row.student_name_bn || undefined,
    batchYear: row.batch_year || '2027',
    batchName: row.batch_name || 'Batch',
    idNumber: row.id_number || row.registration_id,
    contactNumber: row.contact_number || 'N/A',
    photoUrl: row.photo_url || undefined,
    hasPhoto: Boolean(row.has_photo),
    qrToken: row.qr_token || 'TOKEN',
    verificationUrl: row.verification_url || '',
    cardStatus: row.card_status || 'ELIGIBLE',
    reviewReason: row.review_reason || undefined,
    pdfStoragePath: row.pdf_storage_path || undefined,
    pdfFileSizeBytes: Number(row.pdf_file_size_bytes) || 0,
    cardDimensions: row.card_dimensions || '54x86mm',
    version: Number(row.version) || 1,
    generatedAt: row.generated_at || undefined,
    generatedBy: row.generated_by || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function toDownloadJobDbRow(job: IdCardDownloadJob): Record<string, any> {
  return {
    id: job.id,
    requested_by_id: job.requestedById,
    requested_by_name: job.requestedByName,
    job_type: job.jobType,
    target_batch_year: job.targetBatchYear || null,
    total_cards: Number(job.totalCards) || 0,
    processed_cards: Number(job.processedCards) || 0,
    progress_percentage: Number(job.progressPercentage) || 0,
    status: job.status || 'QUEUED',
    archive_filename: job.archiveFilename || null,
    archive_storage_path: job.archiveStoragePath || null,
    archive_file_size_bytes: Number(job.archiveFileSizeBytes) || 0,
    error_message: job.errorMessage || null,
    started_at: job.startedAt || null,
    completed_at: job.completedAt || null,
    created_at: job.createdAt || new Date().toISOString(),
  };
}

export function fromDownloadJobDbRow(row: any): IdCardDownloadJob {
  return {
    id: row.id,
    requestedById: row.requested_by_id || '',
    requestedByName: row.requested_by_name || '',
    jobType: row.job_type,
    targetBatchYear: row.target_batch_year || undefined,
    totalCards: Number(row.total_cards) || 0,
    processedCards: Number(row.processed_cards) || 0,
    progressPercentage: Number(row.progress_percentage) || 0,
    status: row.status || 'QUEUED',
    archiveFilename: row.archive_filename || undefined,
    archiveStoragePath: row.archive_storage_path || undefined,
    archiveFileSizeBytes: Number(row.archive_file_size_bytes) || 0,
    errorMessage: row.error_message || undefined,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function toDownloadLogDbRow(log: IdCardDownloadLog): Record<string, any> {
  return {
    id: log.id,
    user_id: log.userId,
    user_name: log.userName,
    user_role: log.userRole,
    download_type: log.downloadType,
    batch_year: log.batchYear,
    registration_id: log.registrationId || null,
    card_count: Number(log.cardCount) || 1,
    ip_address: log.ipAddress || null,
    status: log.status || 'SUCCESS',
    details: log.details || null,
    timestamp: log.timestamp || new Date().toISOString(),
  };
}

export function fromDownloadLogDbRow(row: any): IdCardDownloadLog {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    downloadType: row.download_type,
    batchYear: row.batch_year,
    registrationId: row.registration_id || undefined,
    cardCount: Number(row.card_count) || 1,
    ipAddress: row.ip_address || undefined,
    status: row.status || 'SUCCESS',
    details: row.details || undefined,
    timestamp: row.timestamp || new Date().toISOString(),
  };
}

function getBaseVerificationUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return 'https://plscf2026.reunion.org';
}

function safeSupabaseUpsert(table: string, row: Record<string, any>): void {
  try {
    Promise.resolve(supabase.from(table).upsert(row))
      .then(({ error }: any) => {
        if (error) {
          console.warn(`[IdCardStore] Background upsert to ${table} notice:`, error.message);
        }
      })
      .catch((err: any) => {
        if (!isNetworkException(err)) {
          console.warn(`[IdCardStore] Background upsert exception on ${table}:`, err?.message || err);
        }
      });
  } catch (err: any) {
    if (!isNetworkException(err)) {
      console.warn(`[IdCardStore] Failed to queue background upsert for ${table}:`, err?.message || err);
    }
  }
}

function safeSupabaseInsert(table: string, row: Record<string, any>): void {
  try {
    Promise.resolve(supabase.from(table).insert(row))
      .then(({ error }: any) => {
        if (error) {
          console.warn(`[IdCardStore] Background insert to ${table} notice:`, error.message);
        }
      })
      .catch((err: any) => {
        if (!isNetworkException(err)) {
          console.warn(`[IdCardStore] Background insert exception on ${table}:`, err?.message || err);
        }
      });
  } catch (err: any) {
    if (!isNetworkException(err)) {
      console.warn(`[IdCardStore] Failed to queue background insert for ${table}:`, err?.message || err);
    }
  }
}

const KEY_ID_CARD_STAFF = 'plscf_idcard_staff_accounts_v1';
const KEY_ID_CARD_RECORDS = 'plscf_student_id_cards_v1';
const KEY_ID_CARD_JOBS = 'plscf_idcard_download_jobs_v1';
const KEY_ID_CARD_LOGS = 'plscf_idcard_download_logs_v1';
const KEY_ID_CARD_SETTINGS = 'plscf_idcard_settings_v1';

// In-memory fallback for Node.js / SSR / Unit Tests
const memoryStorage = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const lsVal = window.localStorage.getItem(key);
      if (lsVal !== null) return lsVal;
    }
  } catch {}
  return memoryStorage.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {}
  memoryStorage.set(key, value);
}

// Seed initial super admin for the ID Card system
export const INITIAL_ID_CARD_STAFF: IdCardStaffAccount[] = [
  {
    id: 'IDC-STF-ADMIN',
    fullName: 'System Super Administrator',
    username: 'admin@gmail.com',
    email: 'admin@gmail.com',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    permissions: {
      canGenerate: true,
      canDownloadSingle: true,
      canDownloadBatch: true,
      canDownloadAll: true,
    },
    assignedBatchYears: [],
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'SYSTEM_INIT',
    approvedAt: '2026-01-01T00:00:00Z',
    approvedBy: 'SYSTEM_INIT',
  },
  {
    id: 'IDC-STF-001',
    fullName: 'Kamrul Hasan (ID Card Coordinator)',
    username: 'idcard.staff@gmail.com',
    email: 'idcard.staff@gmail.com',
    role: 'ID_CARD_STAFF',
    status: 'APPROVED',
    permissions: {
      canGenerate: true,
      canDownloadSingle: true,
      canDownloadBatch: true,
      canDownloadAll: true,
    },
    assignedBatchYears: [],
    createdAt: '2026-01-10T09:00:00Z',
    createdBy: 'admin@gmail.com',
    approvedAt: '2026-01-10T10:00:00Z',
    approvedBy: 'admin@gmail.com',
  },
];

export class IdCardStore {
  // ==========================================================================
  // 1. SETTINGS & INITIALIZATION
  // ==========================================================================
  static getSettings(): IdCardSystemSettings {
    try {
      const saved = safeGetItem(KEY_ID_CARD_SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_ID_CARD_SETTINGS;
    } catch {
      return DEFAULT_ID_CARD_SETTINGS;
    }
  }

  static saveSettings(settings: IdCardSystemSettings): void {
    safeSetItem(KEY_ID_CARD_SETTINGS, JSON.stringify(settings));
  }

  // ==========================================================================
  // 2. STAFF ACCOUNTS & RBAC AUTHORIZATION
  // ==========================================================================
  static getStaffAccounts(): IdCardStaffAccount[] {
    try {
      const saved = safeGetItem(KEY_ID_CARD_STAFF);
      if (saved) return JSON.parse(saved);
      safeSetItem(KEY_ID_CARD_STAFF, JSON.stringify(INITIAL_ID_CARD_STAFF));
      return INITIAL_ID_CARD_STAFF;
    } catch {
      return INITIAL_ID_CARD_STAFF;
    }
  }

  static saveStaffAccounts(accounts: IdCardStaffAccount[]): void {
    safeSetItem(KEY_ID_CARD_STAFF, JSON.stringify(accounts));
  }

  static createStaffAccount(data: {
    fullName: string;
    username: string;
    email: string;
    role: IdCardStaffAccount['role'];
    assignedBatchYears?: string[];
    createdBy: string;
  }): IdCardStaffAccount {
    const list = this.getStaffAccounts();
    const cleanUsername = data.username.trim().toLowerCase();
    const cleanEmail = data.email.trim().toLowerCase();

    if (list.some((s) => s.username.toLowerCase() === cleanUsername)) {
      throw new Error(`A staff account with username "${data.username}" already exists.`);
    }

    const newAccount: IdCardStaffAccount = {
      id: `IDC-STF-${Math.floor(100 + Math.random() * 900)}`,
      fullName: data.fullName.trim(),
      username: cleanUsername,
      email: cleanEmail,
      role: data.role,
      status: 'PENDING_APPROVAL', // Mandatory Super Admin approval required
      permissions: {
        canGenerate: true,
        canDownloadSingle: true,
        canDownloadBatch: data.role !== 'ID_CARD_STAFF',
        canDownloadAll: false,
      },
      assignedBatchYears: data.assignedBatchYears || [],
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy,
    };

    list.push(newAccount);
    this.saveStaffAccounts(list);
    return newAccount;
  }

  static updateStaffStatus(
    staffId: string,
    status: IdCardStaffAccount['status'],
    approvedBy: string
  ): void {
    const list = this.getStaffAccounts();
    const idx = list.findIndex((s) => s.id === staffId);
    if (idx === -1) throw new Error('Staff account not found.');

    list[idx].status = status;
    if (status === 'APPROVED' || status === 'ACTIVE') {
      list[idx].approvedAt = new Date().toISOString();
      list[idx].approvedBy = approvedBy;
    }
    this.saveStaffAccounts(list);
  }

  static updateStaffPermissions(
    staffId: string,
    permissions: Partial<IdCardStaffAccount['permissions']>
  ): void {
    const list = this.getStaffAccounts();
    const idx = list.findIndex((s) => s.id === staffId);
    if (idx === -1) throw new Error('Staff account not found.');

    list[idx].permissions = {
      ...list[idx].permissions,
      ...permissions,
    };
    this.saveStaffAccounts(list);
  }

  static deleteStaffAccount(staffId: string): void {
    const list = this.getStaffAccounts().filter((s) => s.id !== staffId);
    this.saveStaffAccounts(list);
  }

  // ==========================================================================
  // 3. STUDENT REGISTRATION INTEGRATION & ID CARD RECORDS
  // Pure on-the-fly dynamic ID card generation.
  // Note: ID cards are NOT saved in the database; only student data is saved.
  // ==========================================================================
  static getOrBuildCardForRegistration(reg: RegistrationRecord): StudentIdCardRecord {
    let batchYear = '';
    let isFlagged = false;
    let reviewReason = '';

    if (reg.category === 'former') {
      batchYear = reg.passingYear?.trim() || '';
      if (!batchYear) {
        isFlagged = true;
        reviewReason = 'Missing graduation/passing year for alumni record';
      }
    } else {
      batchYear = '2026';
      if (reg.currentClass) {
        batchYear = `Class_${reg.currentClass.replace(/\s+/g, '_')}`;
      }
    }

    if (!reg.photoUrl) {
      isFlagged = true;
      reviewReason = reviewReason
        ? `${reviewReason}; Missing student photograph`
        : 'Missing student photograph';
    }

    const defaultBatchName =
      reg.batchName?.trim() ||
      (reg.category === 'former'
        ? `SSC ${reg.passingYear || 'Alumni'}`
        : `Class ${reg.currentClass || 'Current'}`);

    const safeId = reg.id || 'IDC-CARD';
    const safeToken = reg.qrToken || 'TOKEN';

    const verificationUrl = `${getBaseVerificationUrl()}/verify-student-id?id=${encodeURIComponent(
      safeId
    )}&token=${encodeURIComponent(safeToken)}`;

    return {
      id: `IDC-${safeId}`,
      registrationId: safeId,
      eventYear: reg.year || 2026,
      studentName: reg.fullName || 'Student',
      studentNameBn: reg.fullNameBn,
      batchYear: batchYear || '2026',
      batchName: defaultBatchName,
      idNumber: safeId,
      contactNumber: reg.mobileNumber || 'N/A',
      photoUrl: reg.photoUrl,
      hasPhoto: Boolean(reg.photoUrl),
      qrToken: safeToken,
      verificationUrl,
      cardStatus: isFlagged ? 'FLAGGED_REVIEW' : 'ELIGIBLE',
      category: reg.category,
      reviewReason: isFlagged ? reviewReason : undefined,
      gender: reg.gender,
      bloodGroup: reg.bloodGroup,
      hasParent: reg.hasParent,
      parentName: reg.parentName,
      parentAge: reg.parentAge,
      parentPhone: reg.parentPhone,
      parentRelation: reg.parentRelation,
      parentPhotoUrl: reg.parentPhotoUrl,
      guardianRegistrationId: reg.guardianRegistrationId,
      guardianQrToken: reg.guardianQrToken,
      pdfStoragePath: `STUDENT_ID_CARDS/Batch_${batchYear || 'REVIEW'}/Individual_Cards/Student_${safeId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
      cardDimensions: '54x86mm',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  static syncWithRegistrations(sourceRegistrations?: RegistrationRecord[]): StudentIdCardRecord[] {
    const registrations =
      Array.isArray(sourceRegistrations) && sourceRegistrations.length > 0
        ? sourceRegistrations
        : AppStore.getRegistrations();
    const paidRegistrations = registrations.filter(
      (r) =>
        r.paymentStatus === 'paid' &&
        r.registrationApprovalStatus !== 'pending' &&
        r.registrationApprovalStatus !== 'rejected'
    );
    const existingCards = this.getIdCards();
    const existingMap = new Map(existingCards.map((c) => [c.registrationId, c]));

    const updatedCards: StudentIdCardRecord[] = [];

    for (const reg of paidRegistrations) {
      // Determine batch year
      let batchYear = '';
      let isFlagged = false;
      let reviewReason = '';

      if (reg.category === 'former') {
        batchYear = reg.passingYear?.trim() || '';
        if (!batchYear) {
          isFlagged = true;
          reviewReason = 'Missing graduation/passing year for alumni record';
        }
      } else {
        // Current students
        batchYear = '2026';
        if (reg.currentClass) {
          batchYear = `Class_${reg.currentClass.replace(/\s+/g, '_')}`;
        }
      }

      if (!reg.photoUrl) {
        isFlagged = true;
        reviewReason = reviewReason
          ? `${reviewReason}; Missing student photograph`
          : 'Missing student photograph';
      }

      const defaultBatchName =
        reg.batchName?.trim() ||
        (reg.category === 'former'
          ? `SSC ${reg.passingYear || 'Alumni'}`
          : `Class ${reg.currentClass || 'Current'}`);

      const safeId = reg.id || 'IDC-CARD';
      const safeToken = reg.qrToken || 'TOKEN';

      const existing = existingMap.get(reg.id);

      if (existing) {
        // Update fields while preserving generation status and paths
        updatedCards.push({
          ...existing,
          studentName: reg.fullName || existing.studentName || 'Student',
          studentNameBn: reg.fullNameBn || existing.studentNameBn,
          contactNumber: reg.mobileNumber || existing.contactNumber || 'N/A',
          photoUrl: reg.photoUrl || existing.photoUrl,
          hasPhoto: Boolean(reg.photoUrl || existing.photoUrl),
          batchYear: batchYear || existing.batchYear || '2026',
          batchName: defaultBatchName || existing.batchName || 'General',
          cardStatus: isFlagged
            ? 'FLAGGED_REVIEW'
            : existing.cardStatus === 'FLAGGED_REVIEW'
            ? 'ELIGIBLE'
            : existing.cardStatus,
          reviewReason: isFlagged ? reviewReason : undefined,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new ID card record
        const verificationUrl = `${getBaseVerificationUrl()}/verify-student-id?id=${encodeURIComponent(
          safeId
        )}&token=${encodeURIComponent(safeToken)}`;

        updatedCards.push({
          id: `IDC-${safeId}`,
          registrationId: safeId,
          eventYear: reg.year || 2026,
          studentName: reg.fullName || 'Student',
          studentNameBn: reg.fullNameBn,
          batchYear: batchYear || 'REVIEW_REQUIRED',
          batchName: defaultBatchName,
          idNumber: safeId,
          contactNumber: reg.mobileNumber || 'N/A',
          photoUrl: reg.photoUrl,
          hasPhoto: Boolean(reg.photoUrl),
          qrToken: safeToken,
          verificationUrl,
          cardStatus: isFlagged ? 'FLAGGED_REVIEW' : 'ELIGIBLE',
          reviewReason: isFlagged ? reviewReason : undefined,
          pdfStoragePath: `STUDENT_ID_CARDS/Batch_${batchYear || 'REVIEW'}/Individual_Cards/Student_${safeId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          cardDimensions: '54x86mm',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    this.saveIdCards(updatedCards);
    return updatedCards;
  }

  static getIdCards(): StudentIdCardRecord[] {
    try {
      const saved = safeGetItem(KEY_ID_CARD_RECORDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((card) => ({
            ...card,
            studentName: card.studentName || 'Student',
            batchName: card.batchName || card.batchYear || 'Batch',
            batchYear: card.batchYear || '2026',
            idNumber: card.idNumber || card.registrationId || 'ID',
            contactNumber: card.contactNumber || 'N/A',
            qrToken: card.qrToken || 'TOKEN',
            verificationUrl:
              card.verificationUrl && !card.verificationUrl.includes('plscf2026.reunion.org')
                ? card.verificationUrl
                : `${getBaseVerificationUrl()}/verify-student-id?id=${encodeURIComponent(
                    card.idNumber || card.registrationId || 'ID'
                  )}&token=${encodeURIComponent(card.qrToken || 'TOKEN')}`,
          }));
        }
      }
      // Auto initial sync
      return this.syncWithRegistrations();
    } catch {
      return [];
    }
  }

  static saveIdCards(cards: StudentIdCardRecord[]): void {
    safeSetItem(KEY_ID_CARD_RECORDS, JSON.stringify(cards));
  }

  static removeCardByRegistrationId(registrationId: string): void {
    const list = this.getIdCards();
    const updated = list.filter((c) => c.registrationId !== registrationId);
    this.saveIdCards(updated);
  }

  static markCardGenerated(
    registrationId: string,
    data: {
      pdfDataUri?: string;
      pdfStoragePath?: string;
      fileSizeBytes?: number;
      generatedBy: string;
    }
  ): void {
    const list = this.getIdCards();
    const idx = list.findIndex((c) => c.registrationId === registrationId);
    if (idx === -1) return;

    list[idx].cardStatus = 'GENERATED';
    list[idx].pdfDataUri = data.pdfDataUri;
    list[idx].pdfStoragePath = data.pdfStoragePath || list[idx].pdfStoragePath;
    list[idx].pdfFileSizeBytes = data.fileSizeBytes;
    list[idx].generatedAt = new Date().toISOString();
    list[idx].generatedBy = data.generatedBy;
    list[idx].version += 1;
    list[idx].updatedAt = new Date().toISOString();

    this.saveIdCards(list);
    safeSupabaseUpsert('student_id_cards', toStudentIdCardDbRow(list[idx]));
  }

  // ==========================================================================
  // 4. YEAR-WISE BATCH COLLECTIONS & AGGREGATIONS
  // Dynamically creates batches from actual student records (no hardcoding).
  // ==========================================================================
  static getBatchCollections(): BatchIdCardCollection[] {
    const cards = this.getIdCards();
    const batchMap = new Map<string, BatchIdCardCollection>();

    for (const card of cards) {
      const year = card.batchYear || 'REVIEW_REQUIRED';
      let coll = batchMap.get(year);
      if (!coll) {
        coll = {
          id: `BATCH-COLL-${year}`,
          batchYear: year,
          totalEligibleStudents: 0,
          totalGeneratedCards: 0,
          totalPendingCards: 0,
          hasMissingInfoCount: 0,
          combinedPdfPath: `STUDENT_ID_CARDS/Batch_${year}/Batch_${year}_All_Cards.pdf`,
          batchZipPath: `STUDENT_ID_CARDS/Batch_${year}/Batch_${year}.zip`,
          status: 'PENDING',
        };
        batchMap.set(year, coll);
      }

      coll.totalEligibleStudents += 1;
      if (card.cardStatus === 'GENERATED' || card.cardStatus === 'REGENERATED') {
        coll.totalGeneratedCards += 1;
      } else {
        coll.totalPendingCards += 1;
      }

      if (card.cardStatus === 'FLAGGED_REVIEW' || !card.hasPhoto) {
        coll.hasMissingInfoCount += 1;
      }
    }

    const result = Array.from(batchMap.values()).sort((a, b) =>
      (b.batchYear || '').localeCompare(a.batchYear || '')
    );
    return result;
  }

  // Group cards by batch year
  static getCardsByBatch(): Record<string, StudentIdCardRecord[]> {
    const cards = this.getIdCards();
    const grouped: Record<string, StudentIdCardRecord[]> = {};

    for (const card of cards) {
      const y = card.batchYear || 'REVIEW_REQUIRED';
      if (!grouped[y]) grouped[y] = [];
      grouped[y].push(card);
    }

    return grouped;
  }

  // ==========================================================================
  // 5. DOWNLOAD JOBS & ASYNCHRONOUS PROGRESS TRACKING
  // ==========================================================================
  static getDownloadJobs(): IdCardDownloadJob[] {
    try {
      const saved = safeGetItem(KEY_ID_CARD_JOBS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  static saveDownloadJobs(jobs: IdCardDownloadJob[]): void {
    safeSetItem(KEY_ID_CARD_JOBS, JSON.stringify(jobs));
  }

  static createDownloadJob(data: {
    requestedById: string;
    requestedByName: string;
    jobType: IdCardDownloadJob['jobType'];
    targetBatchYear?: string;
    totalCards: number;
    archiveFilename: string;
  }): IdCardDownloadJob {
    const jobs = this.getDownloadJobs();
    const newJob: IdCardDownloadJob = {
      id: `JOB-ZIP-${safeRandomUUID().slice(0, 8)}`,
      requestedById: data.requestedById,
      requestedByName: data.requestedByName,
      jobType: data.jobType,
      targetBatchYear: data.targetBatchYear,
      totalCards: data.totalCards,
      processedCards: 0,
      progressPercentage: 0,
      status: 'QUEUED',
      archiveFilename: data.archiveFilename,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    jobs.unshift(newJob);
    this.saveDownloadJobs(jobs);
    safeSupabaseUpsert('id_card_download_jobs', toDownloadJobDbRow(newJob));
    return newJob;
  }

  static updateJobProgress(
    jobId: string,
    processed: number,
    progressPercentage: number,
    status?: IdCardDownloadJob['status'],
    archiveBlobUrl?: string
  ): void {
    const jobs = this.getDownloadJobs();
    const idx = jobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return;

    jobs[idx].processedCards = processed;
    jobs[idx].progressPercentage = Math.min(100, Math.max(0, progressPercentage));
    if (status) jobs[idx].status = status;
    if (archiveBlobUrl) jobs[idx].archiveBlobUrl = archiveBlobUrl;
    if (status === 'COMPLETED' || status === 'FAILED') {
      jobs[idx].completedAt = new Date().toISOString();
    }

    this.saveDownloadJobs(jobs);
    safeSupabaseUpsert('id_card_download_jobs', toDownloadJobDbRow(jobs[idx]));
  }

  // ==========================================================================
  // 6. DOWNLOAD HISTORY & AUDIT LOGS
  // ==========================================================================
  static getDownloadLogs(): IdCardDownloadLog[] {
    try {
      const saved = safeGetItem(KEY_ID_CARD_LOGS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  static logDownload(entry: Omit<IdCardDownloadLog, 'id' | 'timestamp'>): void {
    try {
      const logs = this.getDownloadLogs();
      const newLog: IdCardDownloadLog = {
        ...entry,
        id: `LOG-DL-${safeRandomUUID().slice(0, 10)}`,
        timestamp: new Date().toISOString(),
      };
      logs.unshift(newLog);
      safeSetItem(KEY_ID_CARD_LOGS, JSON.stringify(logs.slice(0, 500)));
      safeSupabaseInsert('id_card_download_logs', toDownloadLogDbRow(newLog));
    } catch (err) {
      console.error('[IdCardStore] Failed to record download audit log:', err);
    }
  }

  // ==========================================================================
  // 7. OVERALL SYSTEM METRICS
  // ==========================================================================
  static getMetrics() {
    const cards = this.getIdCards();
    const batches = this.getBatchCollections();

    const totalEligible = cards.length;
    const totalGenerated = cards.filter(
      (c) => c.cardStatus === 'GENERATED' || c.cardStatus === 'REGENERATED'
    ).length;
    const totalPending = cards.filter((c) => c.cardStatus === 'ELIGIBLE').length;
    const totalFlagged = cards.filter((c) => c.cardStatus === 'FLAGGED_REVIEW').length;

    return {
      totalEligible,
      totalGenerated,
      totalPending,
      totalFlagged,
      totalBatches: batches.length,
      downloadablePdfsCount: totalGenerated,
    };
  }

  // ==========================================================================
  // 8. SUPABASE BACKGROUND SYNCHRONIZATION
  // ==========================================================================
  static async syncWithSupabase(): Promise<{
    success: boolean;
    syncedJobs: number;
    syncedLogs: number;
    syncedCards: number;
    error?: string;
  }> {
    try {
      let syncedJobs = 0;
      let syncedLogs = 0;
      let syncedCards = 0;

      // 1. Sync download jobs
      const { data: jobRows, error: jobErr } = await supabase
        .from('id_card_download_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!jobErr && Array.isArray(jobRows) && jobRows.length > 0) {
        const dbJobs = jobRows.map(fromDownloadJobDbRow);
        const localJobs = this.getDownloadJobs();
        const dbIds = new Set(dbJobs.map((j) => j.id));
        const mergedJobs = [...dbJobs];
        for (const local of localJobs) {
          if (!dbIds.has(local.id)) mergedJobs.push(local);
        }
        this.saveDownloadJobs(mergedJobs);
        syncedJobs = dbJobs.length;
      }

      // 2. Sync download logs
      const { data: logRows, error: logErr } = await supabase
        .from('id_card_download_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (!logErr && Array.isArray(logRows) && logRows.length > 0) {
        const dbLogs = logRows.map(fromDownloadLogDbRow);
        const localLogs = this.getDownloadLogs();
        const dbIds = new Set(dbLogs.map((l) => l.id));
        const mergedLogs = [...dbLogs];
        for (const local of localLogs) {
          if (!dbIds.has(local.id)) mergedLogs.push(local);
        }
        safeSetItem(KEY_ID_CARD_LOGS, JSON.stringify(mergedLogs.slice(0, 500)));
        syncedLogs = dbLogs.length;
      }

      // 3. Sync student ID cards
      const { data: cardRows, error: cardErr } = await supabase
        .from('student_id_cards')
        .select('*')
        .limit(1000);

      if (!cardErr && Array.isArray(cardRows) && cardRows.length > 0) {
        const dbCards = cardRows.map(fromStudentIdCardDbRow);
        const localCards = this.getIdCards();
        const dbMap = new Map(dbCards.map((c) => [c.registrationId, c]));
        const mergedCards = localCards.map((c) => {
          const dbCard = dbMap.get(c.registrationId);
          if (dbCard) {
            return {
              ...c,
              cardStatus: dbCard.cardStatus || c.cardStatus,
              generatedAt: dbCard.generatedAt || c.generatedAt,
              generatedBy: dbCard.generatedBy || c.generatedBy,
              pdfStoragePath: dbCard.pdfStoragePath || c.pdfStoragePath,
            };
          }
          return c;
        });
        this.saveIdCards(mergedCards);
        syncedCards = dbCards.length;
      }

      return { success: true, syncedJobs, syncedLogs, syncedCards };
    } catch (err: any) {
      if (!isNetworkException(err)) {
        console.warn('[IdCardStore] Supabase sync encountered non-blocking notice:', err?.message || err);
      }
      return { success: false, syncedJobs: 0, syncedLogs: 0, syncedCards: 0, error: err?.message || 'Sync failed' };
    }
  }
}
