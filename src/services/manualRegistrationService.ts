/**
 * Manual Registration & Super Admin Approval Service
 * Police Lines School & College, Faridpur — Grand Reunion 2027
 *
 * Manages the dedicated Manual Registration Database (`manual_registrations`),
 * staff ownership & field-level financial protection, Super Admin payment
 * verification, and idempotent approval-based synchronization into the
 * Main Registration Database (`registrations_2027`) & Centralized Card System.
 */

import { RegistrationRecord, ManualRegistrationInput } from '../types';
import { AppStore } from './store';
import { supabase, fromRegistrationDbRow } from './supabase';
import { generateUniqueSixCharToken, isValidSixCharToken } from '../utils/tokenGenerator';
import { sanitizeInput } from '../utils/security';
import { isValidBangladeshiMobile, normalizeBangladeshiMobileNumber } from '../utils/rules';
import { FinancialService } from './financialService';
import {
  StudentPhotoStorageService,
  isBase64DataUrl,
  extractStoragePathFromPublicUrl,
} from './studentPhotoStorageService';
import { IdCardStore } from './idCardStore';

export const MANUAL_REG_STORAGE_KEY = 'plscf_manual_registrations_v1';
export const EVENT_MANUAL_REG_SYNC = 'plscf_manual_registrations_synced';

const PROTECTED_FINANCIAL_OR_APPROVAL_FIELDS = [
  'registrationFee',
  'parentFee',
  'donationAmount',
  'totalPaid',
  'financialAmount',
  'financialApprovalStatus',
  'financialApprovedBy',
  'financialApprovedAt',
  'financialRejectedBy',
  'financialRejectedAt',
  'paymentStatus',
  'registrationApprovalStatus',
  'approvedBy',
  'approvedAt',
  'rejectedBy',
  'rejectedAt',
  'qrToken',
] as const;

export interface ManualRegistrationResult {
  success: boolean;
  registration?: RegistrationRecord;
  error?: string;
}

export interface ManualApprovalResult {
  success: boolean;
  registration?: RegistrationRecord;
  error?: string;
}

export interface ManualFinancialBreakdown {
  totalApprovedCollection: number;
  totalPendingCollection: number;
  totalRejectedCollection: number;
  totalOnlineCollection: number;
  totalManualCollection: number;
}

export interface ManualRegistrationStats {
  total: number;
  pendingReg: number;
  approvedReg: number;
  rejectedReg: number;
  pendingPaymentCount: number;
  pendingPaymentAmount: number;
  approvedPaymentAmount: number;
  rejectedPaymentAmount: number;
}

const memoryManualStore: Record<string, string> = {};

function readManualStorage(): RegistrationRecord[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(MANUAL_REG_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as RegistrationRecord[]) : [];
    }
  } catch {}
  try {
    const raw = memoryManualStore[MANUAL_REG_STORAGE_KEY];
    return raw ? (JSON.parse(raw) as RegistrationRecord[]) : [];
  } catch {}
  return [];
}

function writeManualStorage(records: RegistrationRecord[]): void {
  const json = JSON.stringify(records);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(MANUAL_REG_STORAGE_KEY, json);
    }
  } catch {}
  memoryManualStore[MANUAL_REG_STORAGE_KEY] = json;
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(EVENT_MANUAL_REG_SYNC, { detail: records }));
    } catch {}
  }
}

function normalizePaymentMethodKey(method?: string): RegistrationRecord['paymentMethod'] {
  const m = (method || 'cash').trim().toLowerCase();
  if (m === 'bkash') return 'bkash';
  if (m === 'nagad') return 'nagad';
  if (m === 'rocket') return 'rocket';
  if (m === 'card' || m === 'amex') return 'card';
  if (m === 'bank transfer' || m === 'bank_transfer') return 'bank_transfer' as any;
  return 'cash' as any;
}

export class ManualRegistrationService {
  /**
   * Read all manual registrations from dedicated manual storage.
   * Also merges any legacy unmigrated manual rows if present in AppStore.
   */
  static getManualRegistrations(): RegistrationRecord[] {
    const dedicated = readManualStorage();
    const map = new Map<string, RegistrationRecord>();
    for (const r of dedicated) {
      map.set(r.id, r);
    }
    // Merge any legacy manual rows from AppStore that aren't already in dedicated storage
    for (const r of AppStore.getRegistrations()) {
      if (r.isManualRegistration && !map.has(r.id)) {
        map.set(r.id, r);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.registeredAt || 0).getTime() - new Date(a.registeredAt || 0).getTime()
    );
  }

  static saveManualRegistrations(records: RegistrationRecord[]): void {
    writeManualStorage(records);
  }

  static findManualRegistration(identifier: string): RegistrationRecord | undefined {
    const clean = (identifier || '').trim().toUpperCase();
    if (!clean) return undefined;
    const strippedId = clean.replace(/^PAR-/i, '');
    const strippedToken = clean.replace(/^P-/i, '');

    return this.getManualRegistrations().find((r) => {
      const id = (r.id || '').toUpperCase();
      const token = (r.qrToken || '').toUpperCase();
      const mobile = normalizeBangladeshiMobileNumber(r.mobileNumber || '');
      const sid = (r.studentId || '').toUpperCase();
      return (
        id === clean ||
        id === strippedId ||
        token === clean ||
        token === strippedToken ||
        (sid && sid === clean) ||
        (mobile && mobile === normalizeBangladeshiMobileNumber(clean))
      );
    });
  }

  /**
   * Scope manual registrations by logged-in Desk Staff ownership unless Super Admin
   */
  static getRegistrationsForStaff(staffId: string, isSuperAdmin: boolean): RegistrationRecord[] {
    const all = this.getManualRegistrations();
    if (isSuperAdmin) return all;
    return all.filter((r) => (r.createdByAdminId || '') === staffId);
  }

  /**
   * Compute dynamic counters for Staff Dashboard & Super Admin Approval Dashboard
   */
  static getStats(records: RegistrationRecord[]): ManualRegistrationStats {
    let pendingReg = 0;
    let approvedReg = 0;
    let rejectedReg = 0;
    let pendingPaymentCount = 0;
    let pendingPaymentAmount = 0;
    let approvedPaymentAmount = 0;
    let rejectedPaymentAmount = 0;

    for (const r of records) {
      const regStatus = r.registrationApprovalStatus || 'pending';
      if (regStatus === 'approved') approvedReg++;
      else if (regStatus === 'rejected') rejectedReg++;
      else pendingReg++;

      const amt = Number(r.financialAmount) || 0;
      const finStatus = r.financialApprovalStatus || (amt > 0 ? 'pending' : 'none');

      if (finStatus === 'pending' || (regStatus === 'pending' && r.paymentStatus === 'pending' && amt > 0)) {
        pendingPaymentCount++;
        pendingPaymentAmount += amt;
      } else if (finStatus === 'approved') {
        approvedPaymentAmount += Number(r.totalPaid) || amt;
      } else if (finStatus === 'rejected') {
        rejectedPaymentAmount += amt;
      }
    }

    return {
      total: records.length,
      pendingReg,
      approvedReg,
      rejectedReg,
      pendingPaymentCount,
      pendingPaymentAmount,
      approvedPaymentAmount,
      rejectedPaymentAmount,
    };
  }

  /**
   * Sync dedicated manual_registrations table from Supabase
   */
  static async syncFromSupabase(): Promise<RegistrationRecord[]> {
    try {
      const { data, error } = await supabase
        .from('manual_registrations')
        .select('*')
        .order('registered_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data.map((row) => ({
          ...fromRegistrationDbRow(row),
          isManualRegistration: true,
        }));
        const existingLocal = readManualStorage();
        const merged = new Map<string, RegistrationRecord>();
        for (const r of mapped) merged.set(r.id, r);
        for (const local of existingLocal) {
          if (!merged.has(local.id)) {
            merged.set(local.id, local);
          }
        }
        const list = Array.from(merged.values());
        writeManualStorage(list);
        return list;
      }
    } catch (err) {
      console.warn('[ManualRegistrationService] syncFromSupabase notice:', err);
    }
    return this.getManualRegistrations();
  }

  /**
   * Generates a collision-resistant Registration ID checked against both databases
   */
  static generateUniqueManualRegId(category: 'former' | 'current'): string {
    const existingIds = new Set([
      ...AppStore.getRegistrations().map((r) => r.id.toUpperCase()),
      ...this.getManualRegistrations().map((r) => r.id.toUpperCase()),
    ]);
    const prefix = category === 'current' ? 'PLSCF-2027-C' : 'PLSCF-2027-F';

    for (let i = 0; i < 60; i++) {
      const candidate = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
      if (!existingIds.has(candidate)) {
        return candidate;
      }
    }
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }

  /**
   * Desk Staff manual registration submission.
   * Saves ONLY to the dedicated Manual Registration database (`manual_registrations`).
   * Does NOT insert into the main approved registrations database (`registrations_2027`) until Super Admin approves.
   */
  static async createManualRegistration(
    input: ManualRegistrationInput,
    adminUser: { id: string; name: string }
  ): Promise<ManualRegistrationResult> {
    try {
      // 1. Validate core student fields
      const cleanName = sanitizeInput(input.fullName || '').trim();
      if (!cleanName) {
        return { success: false, error: 'Student Full Name is required.' };
      }

      const cleanMobile = (input.mobileNumber || '').trim();
      if (!cleanMobile || !isValidBangladeshiMobile(cleanMobile)) {
        return {
          success: false,
          error: 'Please enter a valid 11-digit Bangladeshi mobile number starting with 01.',
        };
      }
      const normalizedMobile = normalizeBangladeshiMobileNumber(cleanMobile);

      const cleanBatch = sanitizeInput(input.batchName || '').trim();
      if (!cleanBatch) {
        return { success: false, error: 'Batch or Passing Year is required.' };
      }

      // 2. Manual payment validation (Cash / bKash / Bank Transfer)
      const methodLabel = (input.financialMethod || '').trim();
      const finAmt = Math.max(0, Number(input.financialAmount) || 0);
      const cleanRef = sanitizeInput(input.financialReference || '').trim();

      if (methodLabel.toLowerCase() === 'bkash' || methodLabel.toLowerCase() === 'bank transfer') {
        if (!cleanRef) {
          return {
            success: false,
            error: `Transaction ID or Payment Token ID is mandatory for ${methodLabel} payments.`,
          };
        }
      } else if (methodLabel.toLowerCase() === 'cash' && input.financialAmount !== undefined && finAmt <= 0) {
        return {
          success: false,
          error: 'Please enter the cash amount received (must be greater than ৳0).',
        };
      }

      // 3. Duplicate checks across BOTH Main Database (registrations_2027) AND Manual Database (manual_registrations)
      const allMain = AppStore.getRegistrations();
      const allManual = this.getManualRegistrations().filter((r) => r.registrationApprovalStatus !== 'rejected');
      const combined = [...allMain, ...allManual];

      if (input.studentId && input.studentId.trim()) {
        const cleanStudentId = input.studentId.trim().toUpperCase();
        const dupStudentId = combined.find(
          (r) => r.studentId && r.studentId.trim().toUpperCase() === cleanStudentId
        );
        if (dupStudentId) {
          return {
            success: false,
            error: `DUPLICATE_RECORD: Student ID "${cleanStudentId}" is already registered (${dupStudentId.fullName}, ID: ${dupStudentId.id}).`,
          };
        }
      }

      const dupMobile = combined.find(
        (r) =>
          normalizeBangladeshiMobileNumber(r.mobileNumber) === normalizedMobile &&
          r.fullName.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (dupMobile) {
        return {
          success: false,
          error: `DUPLICATE_RECORD: Student "${cleanName}" with mobile ${cleanMobile} is already registered (ID: ${dupMobile.id}).`,
        };
      }

      // 4. ID and Token Generation (unique across both tables)
      const regId = this.generateUniqueManualRegId(input.category);
      const existingTokens = new Set(
        combined.map((r) => r.qrToken).filter((t) => isValidSixCharToken(t))
      );
      const qrToken = generateUniqueSixCharToken(existingTokens);

      // 5. Financial statuses: NEVER auto-verified!
      const finStatus = finAmt > 0 ? 'pending' : 'none';
      const defaultFee = Number(input.registrationFee) || (input.category === 'current' ? 500 : 1500);
      const configuredParentFee = AppStore.getFeeSettings().parentFee ?? 500;
      const parentFee = input.hasParent ? Number(input.parentFee ?? configuredParentFee) : 0;

      // 6. Upload photos to Supabase Storage if data URLs
      let photoStoragePath: string | null =
        input.photoStoragePath || extractStoragePathFromPublicUrl(input.photoUrl) || null;
      let finalPhotoUrl =
        input.photoUrl && !input.photoUrl.includes('images.unsplash.com') ? input.photoUrl : '';

      if (input.photoUrl && isBase64DataUrl(input.photoUrl)) {
        try {
          const uploadRes = await StudentPhotoStorageService.uploadStudentPhoto({
            fileOrDataUrl: input.photoUrl,
            registrationId: regId,
            batchYear: input.passingYear,
            category: input.category,
            currentClass: input.currentClass,
            isParent: false,
          });
          if (uploadRes.success && uploadRes.publicUrl) {
            photoStoragePath = uploadRes.storagePath;
            finalPhotoUrl = uploadRes.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('[ManualRegistration] Student photo upload warning:', uploadErr);
        }
      }

      let parentPhotoStoragePath: string | null =
        input.parentPhotoStoragePath || extractStoragePathFromPublicUrl(input.parentPhotoUrl) || null;
      let finalParentPhotoUrl = input.parentPhotoUrl || '';

      if (input.hasParent && input.parentPhotoUrl && isBase64DataUrl(input.parentPhotoUrl)) {
        try {
          const uploadParentRes = await StudentPhotoStorageService.uploadStudentPhoto({
            fileOrDataUrl: input.parentPhotoUrl,
            registrationId: regId,
            batchYear: input.passingYear,
            category: input.category,
            currentClass: input.currentClass,
            isParent: true,
          });
          if (uploadParentRes.success && uploadParentRes.publicUrl) {
            parentPhotoStoragePath = uploadParentRes.storagePath;
            finalParentPhotoUrl = uploadParentRes.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('[ManualRegistration] Parent photo upload warning:', uploadErr);
        }
      }

      // 7. Build Manual Registration record (Pending Approval & Pending Verification)
      const newRecord: RegistrationRecord = {
        id: regId,
        fullName: cleanName,
        fullNameBn: input.fullNameBn ? sanitizeInput(input.fullNameBn).trim() : undefined,
        photoUrl: finalPhotoUrl,
        photoStoragePath: photoStoragePath || undefined,
        mobileNumber: normalizedMobile,
        email: input.email ? sanitizeInput(input.email).trim() : null,
        address: sanitizeInput(input.address || 'Faridpur'),
        category: input.category,
        studentId: input.studentId ? sanitizeInput(input.studentId).trim().toUpperCase() : undefined,
        passingYear: input.passingYear ? sanitizeInput(input.passingYear).trim() : undefined,
        lastClassAttended: input.lastClassAttended ? sanitizeInput(input.lastClassAttended).trim() : undefined,
        currentClass: input.currentClass ? sanitizeInput(input.currentClass).trim() : undefined,
        batchName: cleanBatch,
        groupOrSection: input.groupOrSection ? sanitizeInput(input.groupOrSection).trim() : undefined,
        rollNumber: input.rollNumber ? sanitizeInput(input.rollNumber).trim() : undefined,
        tShirtSize: input.tShirtSize || 'L',
        registrationFee: defaultFee,
        donationAmount: 0,
        totalPaid: 0, // Strictly 0 until Super Admin verifies payment & approves
        paymentStatus: 'pending',
        transactionId: cleanRef,
        paymentMethod: normalizePaymentMethodKey(methodLabel || 'Cash'),
        registeredAt: new Date().toISOString(),
        qrToken,
        isTShirtCollected: false,
        isCheckedIn: false,
        gender: input.gender || 'male',
        bloodGroup: input.bloodGroup ? sanitizeInput(input.bloodGroup).trim() : undefined,
        hasParent: Boolean(input.hasParent),
        parentName: input.hasParent && input.parentName ? sanitizeInput(input.parentName).trim() : undefined,
        parentAge: input.hasParent && input.parentAge !== undefined ? input.parentAge : undefined,
        parentRelation: input.hasParent && input.parentRelation ? sanitizeInput(input.parentRelation).trim() : undefined,
        parentPhone: input.hasParent && input.parentPhone ? sanitizeInput(input.parentPhone).trim() : undefined,
        parentPhotoUrl: input.hasParent ? finalParentPhotoUrl || undefined : undefined,
        parentPhotoStoragePath: input.hasParent ? parentPhotoStoragePath || undefined : undefined,
        parentFee,
        notes: input.notes ? sanitizeInput(input.notes).trim() : undefined,
        year: 2027,
        isManualRegistration: true,
        registrationType: 'manual_venue',
        registrationApprovalStatus: 'pending',
        createdByAdminId: adminUser.id,
        createdByAdminName: adminUser.name,
        financialAmount: finAmt,
        financialDescription: input.financialDescription ? sanitizeInput(input.financialDescription).trim() : undefined,
        financialMethod: methodLabel ? sanitizeInput(methodLabel).trim() : undefined,
        financialReference: cleanRef || undefined,
        financialNotes: input.financialNotes ? sanitizeInput(input.financialNotes).trim() : undefined,
        financialApprovalStatus: finStatus,
        documentUrl: input.documentUrl || undefined,
        documentName: input.documentName ? sanitizeInput(input.documentName).trim() : undefined,
      };

      // 8. Save ONLY to dedicated Manual Registrations storage (NOT AppStore/registrations_2027!)
      const currentManualList = readManualStorage();
      writeManualStorage([newRecord, ...currentManualList]);

      // 9. Persist ONLY to Supabase `manual_registrations` via SECURITY DEFINER RPC
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_create_manual_registration', {
          p_data: {
            id: newRecord.id,
            qr_token: newRecord.qrToken,
            full_name: newRecord.fullName,
            full_name_bn: newRecord.fullNameBn,
            photo_url: newRecord.photoUrl,
            photo_storage_path: newRecord.photoStoragePath,
            mobile_number: newRecord.mobileNumber,
            email: newRecord.email,
            address: newRecord.address,
            category: newRecord.category,
            student_id: newRecord.studentId,
            passing_year: newRecord.passingYear,
            last_class_attended: newRecord.lastClassAttended,
            current_class: newRecord.currentClass,
            batch_name: newRecord.batchName,
            group_or_section: newRecord.groupOrSection,
            roll_number: newRecord.rollNumber,
            t_shirt_size: newRecord.tShirtSize,
            gender: newRecord.gender,
            blood_group: newRecord.bloodGroup,
            has_parent: newRecord.hasParent,
            parent_name: newRecord.parentName,
            parent_age: newRecord.parentAge ? String(newRecord.parentAge) : null,
            parent_phone: newRecord.parentPhone,
            parent_relation: newRecord.parentRelation,
            parent_photo_url: newRecord.parentPhotoUrl,
            parent_photo_storage_path: newRecord.parentPhotoStoragePath,
            parent_fee: newRecord.parentFee || 0,
            registration_fee: newRecord.registrationFee,
            notes: newRecord.notes,
            registration_type: newRecord.registrationType,
            created_by_admin_id: newRecord.createdByAdminId,
            created_by_admin_name: newRecord.createdByAdminName,
            financial_amount: newRecord.financialAmount,
            financial_description: newRecord.financialDescription,
            financial_method: newRecord.financialMethod || 'Cash',
            financial_reference: newRecord.financialReference || '',
            financial_notes: newRecord.financialNotes,
            document_url: newRecord.documentUrl,
            document_name: newRecord.documentName,
          },
        });
        if (rpcErr || rpcRes?.success === false) {
          console.warn('[ManualRegistrationService] Cloud save notice:', rpcErr?.message || rpcRes?.error);
        }
      } catch (err) {
        console.warn('[ManualRegistrationService] Supabase cloud sync notice:', err);
      }

      // 10. Record Audit Log
      await FinancialService.recordAuditLog({
        entity_type: 'expense',
        entity_id: regId,
        action: 'create',
        updated_amount: finAmt,
        reason: `Manual registration created by ${adminUser.name} (${adminUser.id}). Stored in Manual Database with PENDING_APPROVAL. Payment: ${methodLabel || 'N/A'} BDT ${finAmt} (${finStatus}).`,
        performed_by: adminUser.id,
        performed_by_name: adminUser.name,
      });

      return { success: true, registration: newRecord };
    } catch (error: any) {
      console.error('[ManualRegistrationService] Error creating registration:', error);
      return { success: false, error: error.message || 'Failed to create manual registration.' };
    }
  }

  /**
   * Restricted Desk Staff Update:
   * Enforces role & registration ownership. Desk staff may edit ONLY Student Name & Mobile Number.
   * Rejects any attempt to modify financial fields, approval status, or QR state.
   */
  static async staffUpdateStudentDetails(
    registrationId: string,
    updates: Record<string, any>,
    actor: { id: string; name: string; role?: string }
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const isSuperAdmin = (actor.role || '').toLowerCase() === 'super_admin';
      const existing = this.getManualRegistrations().find((r) => r.id.toUpperCase() === cleanId);

      if (!existing) {
        return { success: false, error: `Manual registration "${cleanId}" not found.` };
      }

      // 1. Ownership check
      if (!isSuperAdmin && (existing.createdByAdminId || '') !== actor.id) {
        return {
          success: false,
          error: 'UNAUTHORIZED_OWNERSHIP: You can only view and edit registrations you personally created.',
        };
      }

      // 2. Reject any attempt by non-Super-Admin to modify financial / approval / QR fields
      if (!isSuperAdmin) {
        for (const forbiddenKey of PROTECTED_FINANCIAL_OR_APPROVAL_FIELDS) {
          if (forbiddenKey in updates && updates[forbiddenKey] !== undefined) {
            return {
              success: false,
              error: `FORBIDDEN_FINANCIAL_EDIT: Registration Desk Staff are not authorized to modify "${forbiddenKey}".`,
            };
          }
        }
      }

      const cleanName = sanitizeInput(updates.fullName ?? existing.fullName).trim();
      const cleanNameBn =
        updates.fullNameBn !== undefined
          ? sanitizeInput(updates.fullNameBn || '').trim() || undefined
          : existing.fullNameBn;
      const rawMobile = (updates.mobileNumber ?? existing.mobileNumber).trim();

      if (!cleanName || cleanName.length < 2) {
        return { success: false, error: 'Student full name must be at least 2 characters.' };
      }
      if (!isValidBangladeshiMobile(rawMobile)) {
        return { success: false, error: 'Please enter a valid 11-digit Bangladeshi mobile number starting with 01.' };
      }
      const normalizedMobile = normalizeBangladeshiMobileNumber(rawMobile);

      // Check duplicate mobile across other records
      const duplicateMobile = [...AppStore.getRegistrations(), ...this.getManualRegistrations()].find(
        (r) =>
          r.id.toUpperCase() !== cleanId &&
          r.registrationApprovalStatus !== 'rejected' &&
          normalizeBangladeshiMobileNumber(r.mobileNumber) === normalizedMobile
      );
      if (duplicateMobile) {
        return {
          success: false,
          error: `Mobile number ${normalizedMobile} is already used by ${duplicateMobile.fullName} (${duplicateMobile.id}).`,
        };
      }

      const nextRecord: RegistrationRecord = {
        ...existing,
        fullName: cleanName,
        fullNameBn: cleanNameBn,
        mobileNumber: normalizedMobile,
      };

      // Update dedicated manual storage
      const list = this.getManualRegistrations().map((r) =>
        r.id.toUpperCase() === cleanId ? nextRecord : r
      );
      writeManualStorage(list);

      // Sync AppStore if already transferred/approved
      if (AppStore.getRegistrations().some((r) => r.id.toUpperCase() === cleanId)) {
        AppStore.updateRegistration(existing.id, { fullName: cleanName, fullNameBn: cleanNameBn, mobileNumber: normalizedMobile }, 2027);
        IdCardStore.syncWithRegistrations();
      }

      // Enforce backend RPC
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_staff_update_manual_registration', {
          p_registration_id: existing.id,
          p_staff_id: actor.id,
          p_staff_role: actor.role || 'registration_officer',
          p_full_name: cleanName,
          p_mobile_number: normalizedMobile,
          p_full_name_bn: cleanNameBn || null,
        });
        if (!rpcErr && rpcRes?.success === false) {
          return { success: false, error: rpcRes.error || 'Server rejected update.' };
        }
      } catch (err) {
        console.warn('[ManualRegistrationService] rpc_staff_update_manual_registration notice:', err);
      }

      await FinancialService.recordAuditLog({
        entity_type: 'category',
        entity_id: existing.id,
        action: 'update',
        reason: `Contact details updated by ${actor.name} (${actor.role || 'staff'}): Name="${cleanName}", Mobile="${normalizedMobile}". Financial fields protected.`,
        performed_by: actor.id,
        performed_by_name: actor.name,
      });

      return { success: true, registration: nextRecord };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to update registration contact details.' };
    }
  }

  /**
   * Unified Super Admin Verification & Approval:
   * Verifies manual payment + approves registration + activates QR + transfers idempotently
   * into Main Registration Database (`registrations_2027`) + syncs Centralized Card Management.
   */
  static async verifyPaymentAndApproveRegistration(
    registrationId: string,
    superAdminUser: { id: string; name: string },
    notes: string = 'Payment verified & registration approved by Super Admin'
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const existing = this.getManualRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const verifiedAmount =
        Number(existing.financialAmount) > 0
          ? Number(existing.financialAmount)
          : Number(existing.registrationFee) || (existing.category === 'current' ? 500 : 1500);

      const nowIso = new Date().toISOString();
      const approvedRecord: RegistrationRecord = {
        ...existing,
        registrationApprovalStatus: 'approved',
        paymentStatus: 'paid',
        totalPaid: verifiedAmount,
        financialApprovalStatus: 'approved',
        financialApprovedBy: existing.financialApprovedBy || superAdminUser.name,
        financialApprovedAt: existing.financialApprovedAt || nowIso,
        approvedBy: existing.approvedBy || superAdminUser.name,
        approvedAt: existing.approvedAt || nowIso,
        approvalNotes: sanitizeInput(notes),
        transactionId:
          existing.financialReference ||
          existing.transactionId ||
          `MANUAL-${existing.id}`,
      };

      // 1. Update dedicated manual database record (retains history & ownership)
      const nextManual = this.getManualRegistrations().map((r) =>
        r.id.toUpperCase() === cleanId ? approvedRecord : r
      );
      writeManualStorage(nextManual);

      // 2. Idempotently transfer/synchronize into Main Registration Store (AppStore -> registrations_2027)
      this.syncApprovedRecordToMainAndCards(approvedRecord);

      // 3. Authoritative Supabase RPC transaction (updates manual_registrations & upserts into registrations_2027)
      try {
        await supabase.rpc('rpc_approve_manual_registration', {
          p_registration_id: existing.id,
          p_admin_name: superAdminUser.name,
          p_notes: notes,
          p_approve_payment: true,
        });
      } catch (e) {
        console.warn('[ManualRegistrationService] rpc_approve_manual_registration notice:', e);
      }

      await FinancialService.recordAuditLog({
        entity_type: 'budget',
        entity_id: existing.id,
        action: 'update',
        updated_amount: verifiedAmount,
        reason: `Payment verified (BDT ${verifiedAmount}) & Registration "${existing.id}" APPROVED by Super Admin ${superAdminUser.name}. Synced to Main Database & Centralized Card Management; QR activated.`,
        performed_by: superAdminUser.id,
        performed_by_name: superAdminUser.name,
      });

      return { success: true, registration: approvedRecord };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to verify payment and approve registration.' };
    }
  }

  /**
   * Helper: Idempotently upsert approved manual registration into AppStore & IdCardStore
   */
  private static syncApprovedRecordToMainAndCards(approvedRecord: RegistrationRecord): void {
    const mainList = AppStore.getRegistrations();
    const existsInMain = mainList.some(
      (r) => r.id.toUpperCase() === approvedRecord.id.toUpperCase()
    );
    if (existsInMain) {
      AppStore.updateRegistration(approvedRecord.id, approvedRecord, 2027);
    } else {
      AppStore.saveRegistrations([approvedRecord, ...mainList]);
    }
    IdCardStore.syncWithRegistrations();
  }

  /**
   * Super Admin approves student registration.
   * Activates QR code, transfers into Main Registration DB, and updates Centralized Card Management.
   */
  static async approveRegistration(
    registrationId: string,
    superAdminUser: { id: string; name: string },
    notes: string = 'Approved by Super Admin'
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const existing = this.getManualRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const hasPendingOrRejectedFin =
        Number(existing.financialAmount) > 0 &&
        (existing.financialApprovalStatus === 'pending' || existing.financialApprovalStatus === 'rejected');
      const paidAmt = hasPendingOrRejectedFin
        ? 0
        : existing.totalPaid > 0
        ? existing.totalPaid
        : existing.registrationFee || (existing.category === 'current' ? 500 : 1500);

      const updates: Partial<RegistrationRecord> = {
        registrationApprovalStatus: 'approved',
        paymentStatus: 'paid',
        totalPaid: paidAmt,
        approvedBy: superAdminUser.name,
        approvedAt: new Date().toISOString(),
        approvalNotes: sanitizeInput(notes),
      };

      const updatedRecord: RegistrationRecord = { ...existing, ...updates };

      // 1. Update dedicated manual storage
      writeManualStorage(
        this.getManualRegistrations().map((r) => (r.id.toUpperCase() === cleanId ? updatedRecord : r))
      );

      // 2. Transfer into Main Registration Store + Centralized Card Store
      this.syncApprovedRecordToMainAndCards(updatedRecord);

      // 3. Cloud RPC (transfers to registrations_2027)
      try {
        await supabase.rpc('rpc_approve_manual_registration', {
          p_registration_id: existing.id,
          p_admin_name: superAdminUser.name,
          p_notes: notes,
          p_approve_payment: false,
        });
      } catch (e) {
        console.warn('[ManualRegistrationService] rpc_approve_manual_registration notice:', e);
      }

      await FinancialService.recordAuditLog({
        entity_type: 'category',
        entity_id: existing.id,
        action: 'update',
        reason: `Registration "${existing.id}" APPROVED by Super Admin ${superAdminUser.name}. Synced to Main DB & QR code activated.`,
        performed_by: superAdminUser.id,
        performed_by_name: superAdminUser.name,
      });

      return { success: true, registration: updatedRecord };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to approve registration.' };
    }
  }

  /**
   * Super Admin rejects student registration.
   * Keeps record out of Main Registration DB and permanently deactivates QR code.
   */
  static async rejectRegistration(
    registrationId: string,
    superAdminUser: { id: string; name: string },
    reason: string
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const cleanReason = sanitizeInput(reason || '').trim();
      if (!cleanReason) {
        return { success: false, error: 'A rejection reason is mandatory for audit integrity.' };
      }

      const existing = this.getManualRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const updates: Partial<RegistrationRecord> = {
        registrationApprovalStatus: 'rejected',
        paymentStatus: 'rejected' as any,
        rejectedBy: superAdminUser.name,
        rejectedAt: new Date().toISOString(),
        rejectionReason: cleanReason,
        totalPaid: 0,
      };

      const updatedRecord: RegistrationRecord = { ...existing, ...updates };

      writeManualStorage(
        this.getManualRegistrations().map((r) => (r.id.toUpperCase() === cleanId ? updatedRecord : r))
      );

      // Ensure rejected registration is removed from Main AppStore & Centralized Cards if ever present
      const mainList = AppStore.getRegistrations();
      if (mainList.some((r) => r.id.toUpperCase() === cleanId)) {
        AppStore.saveRegistrations(
          mainList.filter((r) => r.id.toUpperCase() !== cleanId)
        );
        IdCardStore.syncWithRegistrations();
      }

      try {
        await supabase.rpc('rpc_reject_manual_registration', {
          p_registration_id: existing.id,
          p_admin_name: superAdminUser.name,
          p_reason: cleanReason,
        });
      } catch (e) {
        console.warn('[ManualRegistrationService] rpc_reject_manual_registration notice:', e);
      }

      await FinancialService.recordAuditLog({
        entity_type: 'category',
        entity_id: existing.id,
        action: 'void',
        reason: `Registration "${existing.id}" REJECTED by Super Admin ${superAdminUser.name}. Reason: ${cleanReason}`,
        performed_by: superAdminUser.id,
        performed_by_name: superAdminUser.name,
      });

      return { success: true, registration: updatedRecord };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to reject registration.' };
    }
  }

  /**
   * Super Admin approves submitted manual payment amount independently.
   * Immediately adds the amount to official treasury collection (idempotent).
   */
  static async approveFinancial(
    registrationId: string,
    superAdminUser: { id: string; name: string },
    notes: string = 'Financial amount approved'
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const existing = this.getManualRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const amount = Number(existing.financialAmount) || 0;
      if (amount <= 0) {
        return { success: false, error: 'No financial amount registered on this record.' };
      }

      if (existing.financialApprovalStatus === 'approved') {
        return { success: true, registration: existing }; // Idempotent
      }

      const updates: Partial<RegistrationRecord> = {
        financialApprovalStatus: 'approved',
        financialApprovedBy: superAdminUser.name,
        financialApprovedAt: new Date().toISOString(),
        paymentStatus: 'paid',
        totalPaid: amount,
        transactionId: existing.financialReference || `MANUAL-${Date.now().toString(36).toUpperCase()}`,
      };

      const updatedRecord: RegistrationRecord = { ...existing, ...updates };

      writeManualStorage(
        this.getManualRegistrations().map((r) => (r.id.toUpperCase() === cleanId ? updatedRecord : r))
      );

      if (AppStore.getRegistrations().some((r) => r.id.toUpperCase() === cleanId)) {
        AppStore.updateRegistration(existing.id, updates, 2027);
        IdCardStore.syncWithRegistrations();
      }

      try {
        await supabase.rpc('rpc_approve_manual_financial', {
          p_registration_id: existing.id,
          p_admin_name: superAdminUser.name,
          p_notes: notes,
        });
      } catch (e) {
        console.warn('[ManualRegistrationService] rpc_approve_manual_financial notice:', e);
      }

      await FinancialService.recordAuditLog({
        entity_type: 'budget',
        entity_id: existing.id,
        action: 'update',
        updated_amount: amount,
        reason: `Financial amount of BDT ${amount} APPROVED by Super Admin ${superAdminUser.name} for ${existing.id}. Added to official collection.`,
        performed_by: superAdminUser.id,
        performed_by_name: superAdminUser.name,
      });

      return { success: true, registration: updatedRecord };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to approve financial amount.' };
    }
  }

  /**
   * Super Admin rejects financial amount independently (excluded from official treasury).
   */
  static async rejectFinancial(
    registrationId: string,
    superAdminUser: { id: string; name: string },
    reason: string = 'Rejected by Super Admin'
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const existing = this.getManualRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const updates: Partial<RegistrationRecord> = {
        financialApprovalStatus: 'rejected',
        financialRejectedBy: superAdminUser.name,
        financialRejectedAt: new Date().toISOString(),
        totalPaid: 0,
      };

      const updatedRecord: RegistrationRecord = { ...existing, ...updates };

      writeManualStorage(
        this.getManualRegistrations().map((r) => (r.id.toUpperCase() === cleanId ? updatedRecord : r))
      );

      if (AppStore.getRegistrations().some((r) => r.id.toUpperCase() === cleanId)) {
        AppStore.updateRegistration(existing.id, updates, 2027);
      }

      try {
        await supabase.rpc('rpc_reject_manual_financial', {
          p_registration_id: existing.id,
          p_admin_name: superAdminUser.name,
          p_reason: reason,
        });
      } catch (e) {
        console.warn('[ManualRegistrationService] rpc_reject_manual_financial notice:', e);
      }

      await FinancialService.recordAuditLog({
        entity_type: 'budget',
        entity_id: existing.id,
        action: 'void',
        reason: `Financial amount for "${existing.id}" REJECTED by Super Admin ${superAdminUser.name}. Reason: ${reason}`,
        performed_by: superAdminUser.id,
        performed_by_name: superAdminUser.name,
      });

      return { success: true, registration: updatedRecord };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to reject financial amount.' };
    }
  }

  /**
   * Super Admin full edit (protected from non-super-admin roles via role check)
   */
  static async updateRegistrationDetails(
    registrationId: string,
    updates: Partial<RegistrationRecord>,
    adminUser: { id: string; name: string; role?: string }
  ): Promise<ManualApprovalResult> {
    try {
      // Enforce staff restriction if caller is explicitly non-super-admin
      if (adminUser.role && adminUser.role.toLowerCase() !== 'super_admin') {
        return this.staffUpdateStudentDetails(registrationId, updates, adminUser);
      }

      const cleanId = registrationId.trim().toUpperCase();
      const existing = this.getManualRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const updatedRecord: RegistrationRecord = { ...existing, ...updates };
      writeManualStorage(
        this.getManualRegistrations().map((r) => (r.id.toUpperCase() === cleanId ? updatedRecord : r))
      );

      if (AppStore.getRegistrations().some((r) => r.id.toUpperCase() === cleanId)) {
        AppStore.updateRegistration(existing.id, updates, 2027);
        IdCardStore.syncWithRegistrations();
      }

      try {
        await supabase
          .from('manual_registrations')
          .update({
            full_name: updatedRecord.fullName,
            mobile_number: updatedRecord.mobileNumber,
            email: updatedRecord.email,
            batch_name: updatedRecord.batchName,
            student_id: updatedRecord.studentId,
            t_shirt_size: updatedRecord.tShirtSize,
            notes: updatedRecord.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } catch {}

      await FinancialService.recordAuditLog({
        entity_type: 'category',
        entity_id: existing.id,
        action: 'update',
        reason: `Registration details updated by Admin ${adminUser.name}`,
        performed_by: adminUser.id,
        performed_by_name: adminUser.name,
      });

      return { success: true, registration: updatedRecord };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to update registration.' };
    }
  }

  /**
   * Calculate financial breakdown cleanly across online & manual databases (zero double counting)
   */
  static getFinancialBreakdown(): ManualFinancialBreakdown {
    const mainRegistrations = AppStore.getRegistrations();
    const manualRegistrations = this.getManualRegistrations();

    let onlineCollection = 0;
    for (const r of mainRegistrations) {
      if (!r.isManualRegistration && r.paymentStatus === 'paid') {
        onlineCollection += Number(r.totalPaid) || Number(r.registrationFee) || 0;
      }
    }

    let manualApprovedCollection = 0;
    let manualPendingCollection = 0;
    let manualRejectedCollection = 0;

    for (const r of manualRegistrations) {
      const amt = Number(r.financialAmount) || 0;
      if (r.financialApprovalStatus === 'approved') {
        manualApprovedCollection += Number(r.totalPaid) || amt;
      } else if (r.financialApprovalStatus === 'pending') {
        manualPendingCollection += amt;
      } else if (r.financialApprovalStatus === 'rejected') {
        manualRejectedCollection += amt;
      }
    }

    return {
      totalApprovedCollection: onlineCollection + manualApprovedCollection,
      totalPendingCollection: manualPendingCollection,
      totalRejectedCollection: manualRejectedCollection,
      totalOnlineCollection: onlineCollection,
      totalManualCollection: manualApprovedCollection,
    };
  }
}

AppStore.registerManualLookup((id) => ManualRegistrationService.findManualRegistration(id));
AppStore.registerManualListProvider(() => ManualRegistrationService.getManualRegistrations());
