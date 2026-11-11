/**
 * Police Lines High School & College, Faridpur Reunion 2027
 * Reunion Management System (RMS) - Authoritative Rules & Permissions Engine
 */

import {
  RmsRole,
  TaskStatus,
  BudgetStatus,
  RmsExpense,
  VolunteerRecord,
  IncidentReport,
} from '../types/rms';

export type RmsPermissionAction =
  | 'VIEW_ALL_COMMITTEES'
  | 'EDIT_COMMITTEE'
  | 'ASSIGN_COMMITTEE_DIRECTOR'
  | 'CREATE_COMMITTEE'
  | 'DELETE_COMMITTEE'
  | 'MANAGE_COMMITTEE_MEMBERS'
  | 'CREATE_TASK'
  | 'ASSIGN_TASK'
  | 'UPDATE_OWN_TASK'
  | 'APPROVE_TASK'
  | 'SUBMIT_BUDGET_REQUEST'
  | 'REVIEW_BUDGET_REQUEST'
  | 'APPROVE_BUDGET_REQUEST'
  | 'SUBMIT_EXPENSE'
  | 'VERIFY_EXPENSE'
  | 'REVERSE_EXPENSE'
  | 'MANAGE_SPONSORS'
  | 'UPLOAD_DOCUMENTS'
  | 'SCHEDULE_MEETINGS'
  | 'MANAGE_VOLUNTEERS'
  | 'RESOLVE_INCIDENTS'
  | 'SUBMIT_WEEKLY_REPORT'
  | 'APPROVE_WEEKLY_REPORT'
  | 'VIEW_FINANCIAL_REPORTS'
  | 'VIEW_AUDIT_LOGS';

/**
 * 1. Role-Based Access Control (RBAC) Matrix
 */
export function hasRmsPermission(role: RmsRole, action: RmsPermissionAction): boolean {
  switch (role) {
    case 'SUPER_ADMIN':
      return true; // Unrestricted access

    case 'CHIEF_ADVISER':
      // Read-only by default across high-level operations
      return [
        'VIEW_ALL_COMMITTEES',
        'VIEW_FINANCIAL_REPORTS',
        'VIEW_AUDIT_LOGS',
      ].includes(action);

    case 'CONVENER':
      return [
        'VIEW_ALL_COMMITTEES',
        'EDIT_COMMITTEE',
        'CREATE_TASK',
        'ASSIGN_TASK',
        'APPROVE_TASK',
        'REVIEW_BUDGET_REQUEST',
        'APPROVE_BUDGET_REQUEST',
        'REVERSE_EXPENSE',
        'MANAGE_SPONSORS',
        'UPLOAD_DOCUMENTS',
        'SCHEDULE_MEETINGS',
        'MANAGE_VOLUNTEERS',
        'RESOLVE_INCIDENTS',
        'APPROVE_WEEKLY_REPORT',
        'VIEW_FINANCIAL_REPORTS',
        'VIEW_AUDIT_LOGS',
      ].includes(action);

    case 'MEMBER_SECRETARY':
      return [
        'VIEW_ALL_COMMITTEES',
        'EDIT_COMMITTEE',
        'MANAGE_COMMITTEE_MEMBERS',
        'CREATE_TASK',
        'ASSIGN_TASK',
        'APPROVE_TASK',
        'REVIEW_BUDGET_REQUEST',
        'MANAGE_SPONSORS',
        'UPLOAD_DOCUMENTS',
        'SCHEDULE_MEETINGS',
        'MANAGE_VOLUNTEERS',
        'RESOLVE_INCIDENTS',
        'APPROVE_WEEKLY_REPORT',
        'VIEW_FINANCIAL_REPORTS',
        'VIEW_AUDIT_LOGS',
      ].includes(action);

    case 'COMMITTEE_DIRECTOR':
      return [
        'MANAGE_COMMITTEE_MEMBERS',
        'CREATE_TASK',
        'ASSIGN_TASK',
        'APPROVE_TASK',
        'SUBMIT_BUDGET_REQUEST',
        'SUBMIT_EXPENSE',
        'UPLOAD_DOCUMENTS',
        'SCHEDULE_MEETINGS',
        'SUBMIT_WEEKLY_REPORT',
        'RESOLVE_INCIDENTS',
      ].includes(action);

    case 'ASSISTANT_DIRECTOR':
      return [
        'CREATE_TASK',
        'ASSIGN_TASK',
        'UPDATE_OWN_TASK',
        'SUBMIT_EXPENSE',
        'UPLOAD_DOCUMENTS',
        'SCHEDULE_MEETINGS',
      ].includes(action);

    case 'COMMITTEE_MEMBER':
      return [
        'UPDATE_OWN_TASK',
        'UPLOAD_DOCUMENTS',
      ].includes(action);

    case 'FINANCE_OFFICER':
      return [
        'VIEW_ALL_COMMITTEES',
        'REVIEW_BUDGET_REQUEST',
        'SUBMIT_EXPENSE',
        'VERIFY_EXPENSE',
        'REVERSE_EXPENSE',
        'MANAGE_SPONSORS',
        'UPLOAD_DOCUMENTS',
        'VIEW_FINANCIAL_REPORTS',
      ].includes(action);

    case 'EVENT_VOLUNTEER':
      return [
        'UPDATE_OWN_TASK',
      ].includes(action);

    default:
      return false;
  }
}

/**
 * 2. Task Lifecycle State Machine
 */
export function canTransitionTaskStatus(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus,
  role: RmsRole
): { allowed: boolean; reason?: string } {
  if (role === 'SUPER_ADMIN' || role === 'CONVENER' || role === 'MEMBER_SECRETARY') {
    return { allowed: true };
  }

  // Committee Directors can approve, reject, or assign
  if (role === 'COMMITTEE_DIRECTOR') {
    return { allowed: true };
  }

  // Members can transition from PENDING/ASSIGNED to IN_PROGRESS, and to UNDER_REVIEW
  if (role === 'COMMITTEE_MEMBER' || role === 'ASSISTANT_DIRECTOR' || role === 'EVENT_VOLUNTEER') {
    if (currentStatus === 'ASSIGNED' && targetStatus === 'IN_PROGRESS') {
      return { allowed: true };
    }
    if (currentStatus === 'IN_PROGRESS' && targetStatus === 'UNDER_REVIEW') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Members may only move assigned tasks to In Progress or submit for Under Review.',
    };
  }

  return { allowed: false, reason: 'Unauthorized task status transition.' };
}

/**
 * 3. Budget Request Approval Pipeline
 */
export function canTransitionBudgetStatus(
  _currentStatus: BudgetStatus,
  targetStatus: BudgetStatus,
  role: RmsRole
): { allowed: boolean; reason?: string } {
  if (role === 'SUPER_ADMIN') {
    return { allowed: true };
  }

  if (targetStatus === 'FINANCE_REVIEWED' || targetStatus === 'RECOMMENDED') {
    if (role === 'FINANCE_OFFICER') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Only Finance Officers can review and recommend budget requests.' };
  }

  if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') {
    if (role === 'CONVENER' || role === 'MEMBER_SECRETARY') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Only Convener or Member Secretary can issue final budget approvals.' };
  }

  if (targetStatus === 'DISBURSED') {
    if (role === 'FINANCE_OFFICER') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Only Finance Officers can mark approved budgets as disbursed.' };
  }

  return { allowed: false, reason: 'Invalid budget transition.' };
}

/**
 * 4. Authoritative Financial Reversal Rule
 * Transactions cannot be deleted; they must be reversed with a mandatory audit reason.
 */
export function validateExpenseReversal(
  expense: RmsExpense,
  reversalReason: string,
  userRole: RmsRole
): { valid: boolean; error?: string } {
  if (!['SUPER_ADMIN', 'CONVENER', 'FINANCE_OFFICER'].includes(userRole)) {
    return { valid: false, error: 'Unauthorized: Only Finance Officer, Convener, or Super Admin can reverse expenses.' };
  }

  if (expense.verificationStatus === 'REVERSED') {
    return { valid: false, error: 'Expense has already been reversed.' };
  }

  if (!reversalReason || reversalReason.trim().length < 8) {
    return { valid: false, error: 'A mandatory audit reason (minimum 8 characters) is required for financial reversal.' };
  }

  return { valid: true };
}

/**
 * 5. Volunteer Attendance Check
 */
export function canVolunteerCheckIn(
  volunteer: VolunteerRecord,
  action: 'CHECK_IN' | 'CHECK_OUT'
): { allowed: boolean; message: string } {
  if (action === 'CHECK_IN') {
    if (volunteer.attendanceStatus === 'CHECKED_IN') {
      return { allowed: false, message: 'Volunteer has already checked in.' };
    }
    if (volunteer.attendanceStatus === 'COMPLETED') {
      return { allowed: false, message: 'Volunteer duty has already been marked completed.' };
    }
    return { allowed: true, message: 'Check-in approved.' };
  }

  if (action === 'CHECK_OUT') {
    if (volunteer.attendanceStatus !== 'CHECKED_IN') {
      return { allowed: false, message: 'Volunteer must be checked in before checking out.' };
    }
    return { allowed: true, message: 'Check-out completed.' };
  }

  return { allowed: false, message: 'Invalid action.' };
}

/**
 * 6. Incident Severity & Priority Score
 */
export function calculateIncidentPriorityScore(incident: IncidentReport): number {
  let score = 0;
  switch (incident.severity) {
    case 'CRITICAL':
      score += 100;
      break;
    case 'HIGH':
      score += 70;
      break;
    case 'MEDIUM':
      score += 40;
      break;
    case 'LOW':
      score += 10;
      break;
  }

  if (incident.incidentType === 'MEDICAL' || incident.incidentType === 'SECURITY') {
    score += 30;
  }

  if (incident.resolutionStatus === 'REPORTED') {
    score += 20;
  }

  return score;
}
