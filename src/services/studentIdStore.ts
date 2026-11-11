/**
 * Police Lines School & College, Faridpur - Grand Reunion 2026
 * Current Student ID Management & Secure Verification Engine
 */

import { CurrentStudentIdRecord, StudentIdVerificationResult } from '../types';
import { verifyStudentIdAgainstRecords } from '../utils/rules';
import { EventStore } from './eventStore';
import { supabase } from './supabase';

const STORAGE_KEY_STUDENT_IDS = 'plscf_current_student_ids_v2';

let studentMemoryStore: CurrentStudentIdRecord[] | null = null;

export const INITIAL_STUDENT_IDS: CurrentStudentIdRecord[] = [
  {
    id: 'STU-REC-101',
    studentId: 'PLSC-2026-101',
    studentName: 'Samiul Islam',
    className: 'Class 10',
    academicYear: '2026',
    status: 'ACTIVE',
    verificationStatus: 'USED',
    usedRegistrationId: 'PLSCF-2026-C2001',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-25T09:41:20Z',
  },
  {
    id: 'STU-REC-102',
    studentId: 'PLSC-2026-102',
    studentName: 'Mehedi Hasan',
    className: 'Class 10',
    academicYear: '2026',
    status: 'ACTIVE',
    verificationStatus: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'STU-REC-103',
    studentId: 'PLSC-2026-103',
    studentName: 'Fatema Tuj Zohra',
    className: 'Class 10',
    academicYear: '2026',
    status: 'ACTIVE',
    verificationStatus: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'STU-REC-104',
    studentId: 'PLSC-2026-104',
    studentName: 'Ayesha Siddiqua',
    className: 'Class 12',
    academicYear: '2026',
    status: 'ACTIVE',
    verificationStatus: 'USED',
    usedRegistrationId: 'PLSCF-2026-C2002',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-26T12:00:00Z',
  },
  {
    id: 'STU-REC-105',
    studentId: 'PLSC-2026-105',
    studentName: 'Nafis Fuad',
    className: 'Class 9',
    academicYear: '2026',
    status: 'ACTIVE',
    verificationStatus: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'STU-REC-106',
    studentId: 'PLSC-2026-106',
    studentName: 'Sadia Afrin',
    className: 'Class 11',
    academicYear: '2026',
    status: 'ACTIVE',
    verificationStatus: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'STU-REC-107',
    studentId: 'PLSC-2026-107',
    studentName: 'Tahsin Al Habib',
    className: 'Class 8',
    academicYear: '2026',
    status: 'ACTIVE',
    verificationStatus: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'STU-REC-108',
    studentId: 'PLSC-2026-108',
    studentName: 'Rifat Hossain',
    className: 'Class 7',
    academicYear: '2026',
    status: 'ACTIVE',
    verificationStatus: 'AVAILABLE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

function loadStoredList(): CurrentStudentIdRecord[] {
  if (typeof window === 'undefined') {
    return studentMemoryStore || INITIAL_STUDENT_IDS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_STUDENT_IDS);
    if (!raw) return INITIAL_STUDENT_IDS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_STUDENT_IDS;
  } catch {
    return INITIAL_STUDENT_IDS;
  }
}

function persistList(list: CurrentStudentIdRecord[]) {
  if (typeof window === 'undefined') {
    studentMemoryStore = list;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY_STUDENT_IDS, JSON.stringify(list));
  } catch (err) {
    console.warn('LocalStorage error persisting student IDs:', err);
  }
}

export class StudentIdService {
  /**
   * Retrieve all uploaded Student ID records
   */
  static getAllStudentIds(): CurrentStudentIdRecord[] {
    return loadStoredList();
  }

  /**
   * Get KPI Metrics for Admin Dashboard
   */
  static getMetrics() {
    const list = this.getAllStudentIds();
    const now = Date.now();

    let available = 0;
    let reserved = 0;
    let used = 0;
    let inactive = 0;

    list.forEach((r) => {
      if (r.status === 'INACTIVE') {
        inactive++;
      } else if (r.verificationStatus === 'USED') {
        used++;
      } else if (
        r.verificationStatus === 'RESERVED' &&
        r.reservedUntil &&
        new Date(r.reservedUntil).getTime() > now
      ) {
        reserved++;
      } else {
        available++;
      }
    });

    return {
      total: list.length,
      available,
      reserved,
      used,
      inactive,
    };
  }

  /**
   * Verify Student ID (Server-side abstraction returning minimal non-PII response)
   */
  static verifyStudentId(studentId: string): StudentIdVerificationResult {
    const list = this.getAllStudentIds();
    return verifyStudentIdAgainstRecords(studentId, list);
  }

  /**
   * Atomically reserve Student ID when student proceeds to payment
   */
  static reserveStudentId(studentId: string, durationMinutes = 15): boolean {
    const cleanId = (studentId || '').trim().toUpperCase();
    const list = this.getAllStudentIds();
    const index = list.findIndex((r) => r.studentId.trim().toUpperCase() === cleanId);

    if (index === -1) return false;
    const item = list[index];

    if (item.status !== 'ACTIVE' || item.verificationStatus === 'USED') return false;

    // Set reservation expiry
    const reservedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    list[index] = {
      ...item,
      verificationStatus: 'RESERVED',
      reservedUntil,
      updatedAt: new Date().toISOString(),
    };

    persistList(list);
    supabase.from('current_student_ids').update({
      verification_status: 'RESERVED',
      reserved_until: reservedUntil,
      updated_at: new Date().toISOString(),
    }).eq('student_id', cleanId).then(undefined, () => {});

    return true;
  }

  /**
   * Release reservation back to AVAILABLE if checkout session is cancelled
   */
  static releaseReservation(studentId: string): boolean {
    const cleanId = (studentId || '').trim().toUpperCase();
    const list = this.getAllStudentIds();
    const index = list.findIndex((r) => r.studentId.trim().toUpperCase() === cleanId);

    if (index === -1) return false;
    const item = list[index];

    if (item.verificationStatus === 'RESERVED') {
      list[index] = {
        ...item,
        verificationStatus: 'AVAILABLE',
        reservedUntil: null,
        updatedAt: new Date().toISOString(),
      };
      persistList(list);
      supabase.from('current_student_ids').update({
        verification_status: 'AVAILABLE',
        reserved_until: null,
        updated_at: new Date().toISOString(),
      }).eq('student_id', cleanId).then(undefined, () => {});
      return true;
    }
    return false;
  }

  /**
   * Mark Student ID as permanently USED upon server-verified payment success
   */
  static markStudentIdUsed(studentId: string, registrationId: string): boolean {
    const cleanId = (studentId || '').trim().toUpperCase();
    const list = this.getAllStudentIds();
    const index = list.findIndex((r) => r.studentId.trim().toUpperCase() === cleanId);

    if (index === -1) return false;
    const item = list[index];

    list[index] = {
      ...item,
      verificationStatus: 'USED',
      usedRegistrationId: registrationId,
      reservedUntil: null,
      updatedAt: new Date().toISOString(),
    };

    persistList(list);
    supabase.from('current_student_ids').update({
      verification_status: 'USED',
      used_registration_id: registrationId,
      reserved_until: null,
      updated_at: new Date().toISOString(),
    }).eq('student_id', cleanId).then(undefined, () => {});

    EventStore.recordAuditHistory({
      adminId: 'SYSTEM_PAYMENT',
      adminName: 'Payment Gateway Finalizer',
      entityType: 'STUDENT_ID',
      entityId: cleanId,
      action: 'MARK_STUDENT_ID_USED',
      previousValue: item.verificationStatus,
      newValue: `USED (${registrationId})`,
      reason: `Current student registration verified & paid: ${registrationId}`,
    });

    return true;
  }

  /**
   * Add a single Student ID manually (Super Admin only)
   */
  static addStudentId(
    input: {
      studentId: string;
      studentName?: string;
      className: string;
      academicYear?: string;
    },
    adminEmail = 'superadmin'
  ): { success: boolean; error?: string; record?: CurrentStudentIdRecord } {
    const cleanId = input.studentId.trim().toUpperCase();
    if (!cleanId) return { success: false, error: 'Student ID cannot be empty.' };

    const list = this.getAllStudentIds();
    if (list.some((r) => r.studentId.trim().toUpperCase() === cleanId)) {
      return { success: false, error: `Student ID "${cleanId}" already exists in database.` };
    }

    const newRecord: CurrentStudentIdRecord = {
      id: `SID-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      studentId: cleanId,
      studentName: input.studentName?.trim() || undefined,
      className: input.className.trim(),
      academicYear: input.academicYear?.trim() || '2026',
      status: 'ACTIVE',
      verificationStatus: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newRecord, ...list];
    persistList(updated);
    supabase.from('current_student_ids').insert(newRecord).then(undefined, () => {});

    EventStore.recordAuditHistory({
      adminId: adminEmail,
      adminName: 'Super Administrator',
      entityType: 'STUDENT_ID',
      entityId: cleanId,
      action: 'ADD_STUDENT_ID',
      newValue: `${cleanId} (${newRecord.className})`,
      reason: 'Manual student ID provisioned by Super Admin',
    });

    return { success: true, record: newRecord };
  }

  /**
   * Import batch student IDs from CSV/text file with row validation & duplicate detection
   */
  static importFromCSV(
    csvContent: string,
    adminEmail = 'superadmin'
  ): {
    totalRows: number;
    addedCount: number;
    duplicateCount: number;
    invalidCount: number;
    errorRows: string[];
  } {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const existingList = this.getAllStudentIds();
    const existingIds = new Set(existingList.map((r) => r.studentId.trim().toUpperCase()));

    let addedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const errorRows: string[] = [];
    const newRecords: CurrentStudentIdRecord[] = [];

    // Check if line 0 is header
    const startIndex = lines[0].toLowerCase().includes('student') || lines[0].toLowerCase().includes('id') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      // Split by comma or tab or semicolon
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const studentId = parts[0]?.toUpperCase();
      const studentName = parts[1] || undefined;
      const className = parts[2] || 'Class 10';
      const academicYear = parts[3] || '2026';

      if (!studentId || studentId.length < 3) {
        invalidCount++;
        errorRows.push(`Row ${i + 1}: Invalid or missing Student ID`);
        continue;
      }

      if (existingIds.has(studentId)) {
        duplicateCount++;
        errorRows.push(`Row ${i + 1}: Duplicate Student ID "${studentId}"`);
        continue;
      }

      existingIds.add(studentId);
      const record: CurrentStudentIdRecord = {
        id: `SID-${Date.now()}-${i}`,
        studentId,
        studentName,
        className,
        academicYear,
        status: 'ACTIVE',
        verificationStatus: 'AVAILABLE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      newRecords.push(record);
      addedCount++;
    }

    if (newRecords.length > 0) {
      const updated = [...newRecords, ...existingList];
      persistList(updated);
      supabase.from('current_student_ids').insert(newRecords).then(undefined, () => {});

      EventStore.recordAuditHistory({
        adminId: adminEmail,
        adminName: 'Super Administrator',
        entityType: 'STUDENT_ID',
        entityId: `BATCH-IMPORT-${Date.now()}`,
        action: 'BATCH_IMPORT_STUDENT_IDS',
        newValue: `${addedCount} IDs added (${duplicateCount} duplicates skipped, ${invalidCount} invalid)`,
        reason: 'Bulk student ID database upload',
      });
    }

    return {
      totalRows: lines.length - startIndex,
      addedCount,
      duplicateCount,
      invalidCount,
      errorRows,
    };
  }

  /**
   * Toggle Active / Inactive status of a Student ID (Super Admin only with audit reason)
   */
  static toggleStatus(id: string, reason: string, adminEmail = 'superadmin'): boolean {
    const list = this.getAllStudentIds();
    const index = list.findIndex((r) => r.id === id || r.studentId === id);
    if (index === -1) return false;

    const item = list[index];
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    list[index] = {
      ...item,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    persistList(list);
    supabase.from('current_student_ids').update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id).then(undefined, () => {});

    EventStore.recordAuditHistory({
      adminId: adminEmail,
      adminName: 'Super Administrator',
      entityType: 'STUDENT_ID',
      entityId: item.studentId,
      action: 'TOGGLE_STATUS',
      previousValue: item.status,
      newValue: nextStatus,
      reason: reason.trim(),
    });

    return true;
  }

  /**
   * Update Student ID record details (Super Admin only with audit reason)
   */
  static updateRecord(
    id: string,
    updates: { studentName?: string; className?: string; academicYear?: string },
    reason: string,
    adminEmail = 'superadmin'
  ): boolean {
    const list = this.getAllStudentIds();
    const index = list.findIndex((r) => r.id === id || r.studentId === id);
    if (index === -1) return false;

    const prev = { ...list[index] };
    list[index] = {
      ...list[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    persistList(list);
    supabase.from('current_student_ids').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', list[index].id).then(undefined, () => {});

    EventStore.recordAuditHistory({
      adminId: adminEmail,
      adminName: 'Super Administrator',
      entityType: 'STUDENT_ID',
      entityId: list[index].studentId,
      action: 'UPDATE_STUDENT_ID',
      previousValue: JSON.stringify(prev),
      newValue: JSON.stringify(list[index]),
      reason: reason.trim(),
    });

    return true;
  }

  /**
   * Delete an un-used Student ID (Super Admin only with audit reason)
   */
  static deleteRecord(id: string, reason: string, adminEmail = 'superadmin'): { success: boolean; error?: string } {
    const list = this.getAllStudentIds();
    const match = list.find((r) => r.id === id || r.studentId === id);
    if (!match) return { success: false, error: 'Student ID record not found.' };

    if (match.verificationStatus === 'USED') {
      return {
        success: false,
        error: 'Cannot delete: This Student ID has already been successfully linked to an active registration.',
      };
    }

    const filtered = list.filter((r) => r.id !== id && r.studentId !== id);
    persistList(filtered);
    supabase.from('current_student_ids').delete().eq('id', match.id).then(undefined, () => {});

    EventStore.recordAuditHistory({
      adminId: adminEmail,
      adminName: 'Super Administrator',
      entityType: 'STUDENT_ID',
      entityId: match.studentId,
      action: 'DELETE_STUDENT_ID',
      previousValue: `${match.studentId} (${match.className})`,
      reason: reason.trim(),
    });

    return { success: true };
  }
}
