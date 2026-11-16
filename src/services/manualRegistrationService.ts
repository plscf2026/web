/**
 * Manual Registration & Super Admin Approval Service
 * Police Lines High School & College, Faridpur — Grand Reunion 2027
 * Handles Admin-Assisted Venue Registration, Independent Financial Approvals & QR Code Activation
 */

import { RegistrationRecord, ManualRegistrationInput } from '../types';
import { AppStore } from './store';
import { supabase, SupabaseService } from './supabase';
import { generateUniqueSixCharToken, isValidSixCharToken } from '../utils/tokenGenerator';
import { sanitizeInput } from '../utils/security';
import { isValidBangladeshiMobile, normalizeBangladeshiMobileNumber } from '../utils/rules';
import { FinancialService } from './financialService';
import { StudentPhotoStorageService, isBase64DataUrl, extractStoragePathFromPublicUrl } from './studentPhotoStorageService';

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

export class ManualRegistrationService {
  /**
   * Generates a collision-resistant Registration ID for manual student registrations
   */
  static generateUniqueManualRegId(category: 'former' | 'current'): string {
    const registrations = AppStore.getRegistrations();
    const existingIds = new Set(registrations.map((r) => r.id.toUpperCase()));
    const prefix = category === 'current' ? 'PLSCF-2027-C' : 'PLSCF-2027-F';

    for (let i = 0; i < 50; i++) {
      const candidate = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
      if (!existingIds.has(candidate)) {
        return candidate;
      }
    }
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }

  /**
   * Admin-assisted manual registration creation at event desk/venue.
   * Generates ticket with QR code immediately, set to PENDING_APPROVAL.
   */
  static async createManualRegistration(
    input: ManualRegistrationInput,
    adminUser: { id: string; name: string }
  ): Promise<ManualRegistrationResult> {
    try {
      // 1. Validation
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

      // 2. Duplicate Check (Requirement 7: Do not create duplicate student records)
      const existing = AppStore.getRegistrations();
      if (input.studentId && input.studentId.trim()) {
        const cleanStudentId = input.studentId.trim().toUpperCase();
        const dupStudentId = existing.find(
          (r) => r.studentId && r.studentId.trim().toUpperCase() === cleanStudentId
        );
        if (dupStudentId) {
          return {
            success: false,
            error: `DUPLICATE_RECORD: Student ID "${cleanStudentId}" is already registered (${dupStudentId.fullName}, ID: ${dupStudentId.id}).`,
          };
        }
      }

      // Check duplicate mobile for same student category
      const dupMobile = existing.find(
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

      // 3. ID and Token Generation
      const regId = this.generateUniqueManualRegId(input.category);
      const existingTokens = new Set(
        existing.map((r) => r.qrToken).filter((t) => isValidSixCharToken(t))
      );
      const qrToken = generateUniqueSixCharToken(existingTokens);

      // 4. Financial Section (Requirement 4: Optional Financial Amount)
      const finAmt = Math.max(0, Number(input.financialAmount) || 0);
      const finStatus = finAmt > 0 ? 'pending' : 'none';

      const defaultFee = input.category === 'current' ? 500 : 1500;

      // 4b. Upload student photo to dedicated Supabase Storage bucket 'student-photos'
      let photoStoragePath: string | null = input.photoStoragePath || extractStoragePathFromPublicUrl(input.photoUrl) || null;
      let finalPhotoUrl =
        input.photoUrl && !input.photoUrl.includes('images.unsplash.com')
          ? input.photoUrl
          : '';

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
          if (uploadRes.success && uploadRes.storagePath) {
            photoStoragePath = uploadRes.storagePath;
            finalPhotoUrl = uploadRes.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('[ManualRegistration] Student photo upload warning:', uploadErr);
        }
      }

      // 5. Construct Record
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
        totalPaid: 0, // Not counted in official total until Super Admin approves
        paymentStatus: 'pending',
        transactionId: input.financialReference ? sanitizeInput(input.financialReference).trim() : '',
        paymentMethod: (input.financialMethod?.toLowerCase() as any) || 'bkash',
        registeredAt: new Date().toISOString(),
        qrToken,
        isTShirtCollected: false,
        isCheckedIn: false,
        gender: input.gender || 'male',
        bloodGroup: input.bloodGroup ? sanitizeInput(input.bloodGroup).trim() : undefined,
        hasParent: Boolean(input.hasParent),
        parentName: input.parentName ? sanitizeInput(input.parentName).trim() : undefined,
        parentRelation: input.parentRelation ? sanitizeInput(input.parentRelation).trim() : undefined,
        parentPhone: input.parentPhone ? sanitizeInput(input.parentPhone).trim() : undefined,
        notes: input.notes ? sanitizeInput(input.notes).trim() : undefined,
        year: 2027,
        // Manual Registration Metadata
        isManualRegistration: true,
        registrationType: 'manual_venue',
        registrationApprovalStatus: 'pending', // PENDING_APPROVAL
        createdByAdminId: adminUser.id,
        createdByAdminName: adminUser.name,
        // Optional Financial fields
        financialAmount: finAmt,
        financialDescription: input.financialDescription ? sanitizeInput(input.financialDescription).trim() : undefined,
        financialMethod: input.financialMethod ? sanitizeInput(input.financialMethod).trim() : undefined,
        financialReference: input.financialReference ? sanitizeInput(input.financialReference).trim() : undefined,
        financialNotes: input.financialNotes ? sanitizeInput(input.financialNotes).trim() : undefined,
        financialApprovalStatus: finStatus,
        documentUrl: input.documentUrl || undefined,
        documentName: input.documentName ? sanitizeInput(input.documentName).trim() : undefined,
      };

      // 6. Save locally in AppStore
      AppStore.addRegistration(newRecord, 2027);

      // 7. Save to Supabase registrations_2027
      try {
        await SupabaseService.saveRegistration(newRecord, 2027);
      } catch (err) {
        console.warn('[ManualRegistrationService] Supabase cloud sync notice:', err);
      }

      // 8. Record Audit Log
      await FinancialService.recordAuditLog({
        entity_type: 'expense',
        entity_id: regId,
        action: 'create',
        updated_amount: finAmt,
        reason: `Admin manual registration created by ${adminUser.name}. Registration Status: PENDING_APPROVAL. Financial Amount: BDT ${finAmt} (${finStatus}).`,
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
   * Super Admin approves student registration.
   * Activates QR code and marks registration VERIFIED/APPROVED.
   */
  static async approveRegistration(
    registrationId: string,
    superAdminUser: { id: string; name: string },
    notes: string = 'Approved by Super Admin'
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const existing = AppStore.getRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const updates: Partial<RegistrationRecord> = {
        registrationApprovalStatus: 'approved',
        approvedBy: superAdminUser.name,
        approvedAt: new Date().toISOString(),
        approvalNotes: sanitizeInput(notes),
      };

      const updated = AppStore.updateRegistration(existing.id, updates, 2027);

      // Cloud RPC
      try {
        await supabase.rpc('rpc_approve_manual_registration', {
          p_registration_id: existing.id,
          p_admin_name: superAdminUser.name,
          p_notes: notes,
        });
      } catch (e) {
        console.warn('[ManualRegistrationService] rpc_approve_manual_registration notice:', e);
      }

      await FinancialService.recordAuditLog({
        entity_type: 'category',
        entity_id: existing.id,
        action: 'update',
        reason: `Registration "${existing.id}" APPROVED by Super Admin ${superAdminUser.name}. QR code activated.`,
        performed_by: superAdminUser.id,
        performed_by_name: superAdminUser.name,
      });

      return { success: true, registration: updated || undefined };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to approve registration.' };
    }
  }

  /**
   * Super Admin rejects student registration.
   * Deactivates QR code permanently.
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

      const existing = AppStore.getRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const updates: Partial<RegistrationRecord> = {
        registrationApprovalStatus: 'rejected',
        rejectedBy: superAdminUser.name,
        rejectedAt: new Date().toISOString(),
        rejectionReason: cleanReason,
      };

      const updated = AppStore.updateRegistration(existing.id, updates, 2027);

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

      return { success: true, registration: updated || undefined };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to reject registration.' };
    }
  }

  /**
   * Super Admin approves financial amount independently.
   * Immediately adds the amount to official collection.
   */
  static async approveFinancial(
    registrationId: string,
    superAdminUser: { id: string; name: string },
    notes: string = 'Financial amount approved'
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const existing = AppStore.getRegistrations().find((r) => r.id.toUpperCase() === cleanId);
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

      const updated = AppStore.updateRegistration(existing.id, updates, 2027);

      // Cloud RPC
      try {
        await supabase.rpc('rpc_approve_manual_financial', {
          p_registration_id: existing.id,
          p_admin_name: superAdminUser.name,
          p_notes: notes,
        });
      } catch (e) {
        console.warn('[ManualRegistrationService] rpc_approve_manual_financial notice:', e);
      }

      // Record transaction
      try {
        await supabase.from('financial_transactions').insert({
          id: `FTX-MAN-${existing.id}`,
          transaction_type: 'income',
          source_type: 'registration_fee',
          reference_id: existing.id,
          amount,
          payment_method: existing.financialMethod || 'Cash',
          gateway_trx_id: existing.financialReference,
          description: `Manual registration payment approved for ${existing.fullName} (${existing.id})`,
          transaction_date: new Date().toISOString().split('T')[0],
          created_by: superAdminUser.name,
        });
      } catch {}

      await FinancialService.recordAuditLog({
        entity_type: 'budget',
        entity_id: existing.id,
        action: 'update',
        updated_amount: amount,
        reason: `Financial amount of BDT ${amount} APPROVED by Super Admin ${superAdminUser.name} for ${existing.id}. Added to official collection.`,
        performed_by: superAdminUser.id,
        performed_by_name: superAdminUser.name,
      });

      return { success: true, registration: updated || undefined };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to approve financial amount.' };
    }
  }

  /**
   * Super Admin rejects financial amount independently.
   * Excluded from official collection.
   */
  static async rejectFinancial(
    registrationId: string,
    superAdminUser: { id: string; name: string },
    reason: string = 'Rejected by Super Admin'
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const existing = AppStore.getRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const updates: Partial<RegistrationRecord> = {
        financialApprovalStatus: 'rejected',
        financialRejectedBy: superAdminUser.name,
        financialRejectedAt: new Date().toISOString(),
      };

      const updated = AppStore.updateRegistration(existing.id, updates, 2027);

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

      return { success: true, registration: updated || undefined };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to reject financial amount.' };
    }
  }

  /**
   * Edit registration details before or after approval
   */
  static async updateRegistrationDetails(
    registrationId: string,
    updates: Partial<RegistrationRecord>,
    adminUser: { id: string; name: string }
  ): Promise<ManualApprovalResult> {
    try {
      const cleanId = registrationId.trim().toUpperCase();
      const existing = AppStore.getRegistrations().find((r) => r.id.toUpperCase() === cleanId);
      if (!existing) {
        return { success: false, error: `Registration "${cleanId}" not found.` };
      }

      const updated = AppStore.updateRegistration(existing.id, updates, 2027);

      await FinancialService.recordAuditLog({
        entity_type: 'category',
        entity_id: existing.id,
        action: 'update',
        reason: `Registration details updated by Admin ${adminUser.name}`,
        performed_by: adminUser.id,
        performed_by_name: adminUser.name,
      });

      return { success: true, registration: updated || undefined };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to update registration.' };
    }
  }

  /**
   * Calculate financial breakdown directly from records (Requirement 8)
   */
  static getFinancialBreakdown(): ManualFinancialBreakdown {
    const registrations = AppStore.getRegistrations();

    let onlineCollection = 0;
    let manualApprovedCollection = 0;
    let manualPendingCollection = 0;
    let manualRejectedCollection = 0;

    for (const r of registrations) {
      if (r.isManualRegistration) {
        const amt = Number(r.financialAmount) || 0;
        if (r.financialApprovalStatus === 'approved') {
          manualApprovedCollection += amt;
        } else if (r.financialApprovalStatus === 'pending') {
          manualPendingCollection += amt;
        } else if (r.financialApprovalStatus === 'rejected') {
          manualRejectedCollection += amt;
        }
      } else {
        if (r.paymentStatus === 'paid') {
          onlineCollection += Number(r.totalPaid) || Number(r.registrationFee) || 0;
        }
      }
    }

    const totalApproved = onlineCollection + manualApprovedCollection;

    return {
      totalApprovedCollection: totalApproved,
      totalPendingCollection: manualPendingCollection,
      totalRejectedCollection: manualRejectedCollection,
      totalOnlineCollection: onlineCollection,
      totalManualCollection: manualApprovedCollection,
    };
  }
}
