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
import { AppStore } from './store';
import { safeRandomUUID } from '../utils/security';

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
      return window.localStorage.getItem(key);
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
  // Only paid and eligible registrations are processed.
  // ==========================================================================
  static syncWithRegistrations(): StudentIdCardRecord[] {
    const registrations = AppStore.getRegistrations();
    const paidRegistrations = registrations.filter((r) => r.paymentStatus === 'paid');
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

      const existing = existingMap.get(reg.id);

      if (existing) {
        // Update fields while preserving generation status and paths
        updatedCards.push({
          ...existing,
          studentName: reg.fullName,
          studentNameBn: reg.fullNameBn,
          contactNumber: reg.mobileNumber,
          photoUrl: reg.photoUrl || existing.photoUrl,
          hasPhoto: Boolean(reg.photoUrl || existing.photoUrl),
          batchYear: batchYear || existing.batchYear,
          batchName: reg.batchName,
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
        const verificationUrl = `https://plscf2026.reunion.org/verify-student-id?id=${encodeURIComponent(
          reg.id
        )}&token=${encodeURIComponent(reg.qrToken)}`;

        updatedCards.push({
          id: `IDC-${reg.id}`,
          registrationId: reg.id,
          eventYear: reg.year || 2026,
          studentName: reg.fullName,
          studentNameBn: reg.fullNameBn,
          batchYear: batchYear || 'REVIEW_REQUIRED',
          batchName: reg.batchName,
          idNumber: reg.id,
          contactNumber: reg.mobileNumber,
          photoUrl: reg.photoUrl,
          hasPhoto: Boolean(reg.photoUrl),
          qrToken: reg.qrToken,
          verificationUrl,
          cardStatus: isFlagged ? 'FLAGGED_REVIEW' : 'ELIGIBLE',
          reviewReason: isFlagged ? reviewReason : undefined,
          pdfStoragePath: `STUDENT_ID_CARDS/Batch_${batchYear || 'REVIEW'}/Individual_Cards/Student_${reg.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
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
      if (saved) return JSON.parse(saved);
      // Auto initial sync
      return this.syncWithRegistrations();
    } catch {
      return [];
    }
  }

  static saveIdCards(cards: StudentIdCardRecord[]): void {
    safeSetItem(KEY_ID_CARD_RECORDS, JSON.stringify(cards));
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
      b.batchYear.localeCompare(a.batchYear)
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
}
