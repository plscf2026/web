/**
 * Police Lines School and College, Faridpur - Grand Reunion 2026
 * Event Management Authoritative Store & Supabase Sync Engine
 * Manages:
 * - Staff Accounts & Authentication
 * - Food Distribution (Breakfast, Lunch, Dinner)
 * - Gate Entry & Exit Management
 * - Dress / T-shirt Distribution
 * - Central Budget, Staff Money Allocations, Financial Ledger & Expenses
 * - Authoritative Audit History
 */

import {
  StaffAccount,
  EventStaffRole,
  DepartmentType,
  StaffPermissionAction,
  FoodDistributionRecord,
  GateEventRecord,
  DressDistributionRecord,
  CentralBudget,
  StaffAllocation,
  StaffExpense,
  FinancialLedgerEntry,
  AdminAuditHistoryItem,
} from '../types';
import { supabase, isDevTestBypassAllowed } from './supabase';
import { safeRandomUUID } from '../utils/security';
import { findRegistrationByTokenOrId } from '../utils/tokenGenerator';
import { AppStore } from './store';

export const STAFF_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Maps default department for a staff role
 */
export function getDefaultDepartment(role: EventStaffRole): DepartmentType {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'ALL_SERVICES';
    case 'BREAKFAST_STAFF':
      return 'BREAKFAST';
    case 'LUNCH_STAFF':
      return 'LUNCH';
    case 'DINNER_STAFF':
      return 'DINNER';
    case 'DRESS_STAFF':
      return 'DRESS';
    case 'GATE_STAFF':
      return 'GATE';
    case 'FINANCE_STAFF':
      return 'FINANCE';
    default:
      return 'ALL_SERVICES';
  }
}

/**
 * Returns default granular permissions based on staff role
 */
export function getDefaultPermissions(role: EventStaffRole): StaffPermissionAction[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['VIEW', 'SCAN', 'VERIFY', 'APPROVE', 'REJECT', 'EXPORT', 'MANAGE'];
    case 'FINANCE_STAFF':
      return ['VIEW', 'VERIFY', 'APPROVE', 'EXPORT'];
    default:
      return ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'];
  }
}

/**
 * Authoritative Department Access Control Check:
 * Enforces "DEFAULT DENY - EXPLICITLY ALLOW" principle.
 * - Super admin has global bypass.
 * - Disabled staff are rejected immediately.
 * - Non-super admin can only access assigned department or ALL_SERVICES.
 * - Must have explicit action permission in permissions array.
 */
export function hasDepartmentPermission(
  staff: StaffAccount | null | undefined,
  targetDepartment: DepartmentType,
  requiredAction: StaffPermissionAction
): boolean {
  if (!staff) return false;
  if (staff.status !== 'ACTIVE') return false;
  if (staff.role === 'SUPER_ADMIN') return true;

  // Department Isolation: Department must match target or ALL_SERVICES
  if (staff.department !== 'ALL_SERVICES' && staff.department !== targetDepartment) {
    return false;
  }

  // Action Authorization: Must hold the required granular action permission
  if (!Array.isArray(staff.permissions) || !staff.permissions.includes(requiredAction)) {
    return false;
  }

  return true;
}
import {
  calculateStaffFinancialSummary,
  validateExpenseSubmission,
  isBreakfastCollectionOpen,
} from '../utils/eventRules';

// Storage Keys for Local Resilience
const KEY_FOOD_DISTRIBUTIONS = 'plscf_event_food_distributions_v2';
const KEY_GATE_EVENTS = 'plscf_event_gate_events_v2';
const KEY_DRESS_DISTRIBUTIONS = 'plscf_event_dress_distributions_v2';
const KEY_CENTRAL_BUDGET = 'plscf_event_central_budget_v2';
const KEY_STAFF_ALLOCATIONS = 'plscf_event_staff_allocations_v2';
const KEY_STAFF_EXPENSES = 'plscf_event_staff_expenses_v2';
const KEY_FINANCIAL_LEDGER = 'plscf_event_financial_ledger_v2';
const KEY_AUDIT_HISTORY = 'plscf_event_admin_audit_history_v2';

// Initial pre-configured seed staff accounts (Part 2 requirement)
// Universal test credentials: all staff can log in with password 'admin@123'
export const INITIAL_STAFF_ACCOUNTS: StaffAccount[] = [
  {
    "id": "STF-TEST-ADMIN",
    "authUserId": "admin-master-auth",
    "fullName": "System Administrator (Testing)",
    "username": "admin@gmail.com",
    "email": "admin@gmail.com",
    "role": "SUPER_ADMIN",
    "department": "ALL_SERVICES",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE",
      "REJECT",
      "EXPORT",
      "MANAGE"
    ],
    "status": "ACTIVE",
    "assignedGate": "All Gates / All Modules",
    "createdAt": "2026-01-01T00:00:00Z",
    "createdBy": "SYSTEM_INIT"
  },
  {
    "id": "STF-001",
    "authUserId": "gate-staff-auth",
    "fullName": "Tariqul Islam (Gate Lead)",
    "username": "gate@gmail.com",
    "email": "gate@gmail.com",
    "role": "GATE_STAFF",
    "department": "GATE",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE"
    ],
    "status": "ACTIVE",
    "assignedGate": "Gate 01 - Main Entrance",
    "createdAt": "2026-01-05T09:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-002",
    "authUserId": "food-staff-auth",
    "fullName": "Mohammad Faruk Hossain (Lunch Incharge)",
    "username": "food@gmail.com",
    "email": "food@gmail.com",
    "role": "LUNCH_STAFF",
    "department": "LUNCH",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE"
    ],
    "status": "ACTIVE",
    "assignedGate": "Food Pavilion A (Lunch)",
    "createdAt": "2026-01-05T09:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-003",
    "authUserId": "breakfast-staff-auth",
    "fullName": "Nasir Uddin (Breakfast Lead)",
    "username": "breakfast@gmail.com",
    "email": "breakfast@gmail.com",
    "role": "BREAKFAST_STAFF",
    "department": "BREAKFAST",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE"
    ],
    "status": "ACTIVE",
    "assignedGate": "Food Pavilion B (Breakfast)",
    "createdAt": "2026-01-05T09:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-004",
    "authUserId": "dress-staff-auth",
    "fullName": "Jamal Uddin Chowdhury (Kit & T-Shirt)",
    "username": "dress@gmail.com",
    "email": "dress@gmail.com",
    "role": "DRESS_STAFF",
    "department": "DRESS",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE"
    ],
    "status": "ACTIVE",
    "assignedGate": "Distribution Booth 01",
    "createdAt": "2026-01-05T09:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-005",
    "authUserId": "finance-staff-auth",
    "fullName": "Md. Shafiqul Alam (Finance Secretary)",
    "username": "finance@gmail.com",
    "email": "finance@gmail.com",
    "role": "FINANCE_STAFF",
    "department": "FINANCE",
    "permissions": [
      "VIEW",
      "VERIFY",
      "APPROVE",
      "EXPORT"
    ],
    "status": "ACTIVE",
    "assignedGate": "Central Accounts Office",
    "createdAt": "2026-01-05T09:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-006",
    "authUserId": "dinner-staff-auth",
    "fullName": "Abdur Rahim (Dinner Incharge)",
    "username": "dinner@gmail.com",
    "email": "dinner@gmail.com",
    "role": "DINNER_STAFF",
    "department": "DINNER",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE"
    ],
    "status": "ACTIVE",
    "assignedGate": "Food Pavilion C (Dinner)",
    "createdAt": "2026-01-06T10:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-007",
    "authUserId": "gate2-staff-auth",
    "fullName": "Tanvir Hasan (Gate 02 Officer)",
    "username": "gate2@gmail.com",
    "email": "gate2@gmail.com",
    "role": "GATE_STAFF",
    "department": "GATE",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE"
    ],
    "status": "ACTIVE",
    "assignedGate": "Gate 02 - East Campus",
    "createdAt": "2026-01-06T10:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-008",
    "authUserId": "dress2-staff-auth",
    "fullName": "Kazi Rayhan (Distribution Booth 02)",
    "username": "dress2@gmail.com",
    "email": "dress2@gmail.com",
    "role": "DRESS_STAFF",
    "department": "DRESS",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE"
    ],
    "status": "ACTIVE",
    "assignedGate": "Distribution Booth 02",
    "createdAt": "2026-01-07T11:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-009",
    "authUserId": "supervisor-staff-auth",
    "fullName": "Engr. Moniruzzaman (Floor Supervisor)",
    "username": "supervisor@gmail.com",
    "email": "supervisor@gmail.com",
    "role": "SUPER_ADMIN",
    "department": "ALL_SERVICES",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE",
      "REJECT",
      "EXPORT",
      "MANAGE"
    ],
    "status": "ACTIVE",
    "assignedGate": "All Gate & Floor Stations",
    "createdAt": "2026-01-07T11:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-010",
    "authUserId": "registration-staff-auth",
    "fullName": "Dr. Nusrat Jahan (Registration Lead)",
    "username": "registration@gmail.com",
    "email": "registration@gmail.com",
    "role": "SUPER_ADMIN",
    "department": "ALL_SERVICES",
    "permissions": [
      "VIEW",
      "SCAN",
      "VERIFY",
      "APPROVE",
      "EXPORT",
      "MANAGE"
    ],
    "status": "ACTIVE",
    "assignedGate": "Secretariat Registration Desk",
    "createdAt": "2026-01-08T09:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-011",
    "authUserId": "content-staff-auth",
    "fullName": "Farhana Yasmin (Souvenir & Media Lead)",
    "username": "content@gmail.com",
    "email": "content@gmail.com",
    "role": "SUPER_ADMIN",
    "department": "ALL_SERVICES",
    "permissions": [
      "VIEW",
      "VERIFY",
      "EXPORT",
      "MANAGE"
    ],
    "status": "ACTIVE",
    "assignedGate": "Media & Public Relations Room",
    "createdAt": "2026-01-08T09:00:00Z",
    "createdBy": "SUPER_ADMIN"
  },
  {
    "id": "STF-012",
    "authUserId": "idcard-staff-auth",
    "fullName": "Kamrul Hasan (ID Card Coordinator)",
    "username": "idcard.staff@gmail.com",
    "email": "idcard.staff@gmail.com",
    "role": "SUPER_ADMIN",
    "department": "ALL_SERVICES",
    "permissions": [
      "VIEW",
      "VERIFY",
      "APPROVE",
      "EXPORT",
      "MANAGE"
    ],
    "status": "ACTIVE",
    "assignedGate": "ID Card Production Center",
    "createdAt": "2026-01-09T10:00:00Z",
    "createdBy": "SUPER_ADMIN"
  }
];

// Initial Gate Entry & Exit Events
export const INITIAL_GATE_EVENTS: GateEventRecord[] = [
  {
    "id": "GATE-EVT-001",
    "registrationId": "PLSCF-2026-F1001",
    "studentName": "Tanvir Ahmed",
    "batchName": "SSC 1998",
    "photoUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 01 - Main Entrance",
    "scannerId": "SCAN-GATE-01",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "timestamp": "2026-02-15T08:15:22Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-002",
    "registrationId": "PLSCF-2026-F1002",
    "studentName": "Dr. Nusrat Jahan",
    "batchName": "SSC 2005",
    "photoUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 01 - Main Entrance",
    "scannerId": "SCAN-GATE-01",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "timestamp": "2026-02-15T08:24:45Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-003",
    "registrationId": "PLSCF-2026-F1003",
    "studentName": "Md. Asaduzzaman",
    "batchName": "SSC 2012",
    "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 02 - East Gate",
    "scannerId": "SCAN-GATE-02",
    "staffId": "STF-007",
    "staffName": "Tanvir Hasan (Gate 02 Officer)",
    "timestamp": "2026-02-15T08:35:10Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-004",
    "registrationId": "PLSCF-2026-C2002",
    "studentName": "Ayesha Siddiqua",
    "batchName": "HSC 2026 Science",
    "photoUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 01 - Main Entrance",
    "scannerId": "SCAN-GATE-01",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "timestamp": "2026-02-15T08:42:10Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-005",
    "registrationId": "PLSCF-2026-F1004",
    "studentName": "Kazi Mahfuzur Rahman",
    "batchName": "SSC 1986",
    "photoUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 01 - Main Entrance",
    "scannerId": "SCAN-GATE-01",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "timestamp": "2026-02-15T08:50:30Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-006",
    "registrationId": "PLSCF-2026-C2001",
    "studentName": "Samiul Islam",
    "batchName": "Class 10 Section A",
    "photoUrl": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 02 - East Gate",
    "scannerId": "SCAN-GATE-02",
    "staffId": "STF-007",
    "staffName": "Tanvir Hasan (Gate 02 Officer)",
    "timestamp": "2026-02-15T08:55:00Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-007",
    "registrationId": "PLSCF-2026-F1006",
    "studentName": "Engr. Moniruzzaman",
    "batchName": "SSC 1975",
    "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 01 - Main Entrance",
    "scannerId": "SCAN-GATE-01",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "timestamp": "2026-02-15T09:05:15Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-008",
    "registrationId": "PLSCF-2026-F1008",
    "studentName": "Prof. Anisur Rahman",
    "batchName": "SSC 1983",
    "photoUrl": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 01 - Main Entrance",
    "scannerId": "SCAN-GATE-01",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "timestamp": "2026-02-15T09:12:40Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-009",
    "registrationId": "PLSCF-2026-F1010",
    "studentName": "Golam Mostafa",
    "batchName": "SSC 1991",
    "photoUrl": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 02 - East Gate",
    "scannerId": "SCAN-GATE-02",
    "staffId": "STF-007",
    "staffName": "Tanvir Hasan (Gate 02 Officer)",
    "timestamp": "2026-02-15T09:20:10Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-010",
    "registrationId": "PLSCF-2026-F1011",
    "studentName": "Farhana Yasmin",
    "batchName": "SSC 1995",
    "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 01 - Main Entrance",
    "scannerId": "SCAN-GATE-01",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "timestamp": "2026-02-15T09:30:00Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-011",
    "registrationId": "PLSCF-2026-F1001",
    "studentName": "Tanvir Ahmed",
    "batchName": "SSC 1998",
    "photoUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "eventType": "EXIT",
    "gateId": "Gate 01 - Main Entrance",
    "scannerId": "SCAN-GATE-01",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "timestamp": "2026-02-15T12:30:00Z",
    "status": "APPROVED"
  },
  {
    "id": "GATE-EVT-012",
    "registrationId": "PLSCF-2026-F1001",
    "studentName": "Tanvir Ahmed",
    "batchName": "SSC 1998",
    "photoUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "eventType": "ENTRY",
    "gateId": "Gate 01 - Main Entrance",
    "scannerId": "SCAN-GATE-01",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "timestamp": "2026-02-15T12:55:00Z",
    "status": "APPROVED"
  }
];

// Initial Food Distribution Records (Breakfast & Lunch)
export const INITIAL_FOOD_DISTRIBUTIONS: FoodDistributionRecord[] = [
  {
    "id": "FOOD-DIST-001",
    "registrationId": "PLSCF-2026-F1001",
    "studentName": "Tanvir Ahmed",
    "batchName": "SSC 1998",
    "mealType": "breakfast",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T08:30:15Z",
    "staffId": "STF-003",
    "staffName": "Nasir Uddin (Breakfast Lead)",
    "notes": "Breakfast packet verified"
  },
  {
    "id": "FOOD-DIST-002",
    "registrationId": "PLSCF-2026-F1002",
    "studentName": "Dr. Nusrat Jahan",
    "batchName": "SSC 2005",
    "mealType": "breakfast",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T08:40:00Z",
    "staffId": "STF-003",
    "staffName": "Nasir Uddin (Breakfast Lead)"
  },
  {
    "id": "FOOD-DIST-003",
    "registrationId": "PLSCF-2026-C2002",
    "studentName": "Ayesha Siddiqua",
    "batchName": "HSC 2026 Science",
    "mealType": "breakfast",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T08:52:10Z",
    "staffId": "STF-003",
    "staffName": "Nasir Uddin (Breakfast Lead)"
  },
  {
    "id": "FOOD-DIST-004",
    "registrationId": "PLSCF-2026-F1001",
    "studentName": "Tanvir Ahmed",
    "batchName": "SSC 1998",
    "mealType": "lunch",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T13:05:40Z",
    "staffId": "STF-002",
    "staffName": "Mohammad Faruk Hossain (Lunch Incharge)",
    "notes": "Buffet token redeemed"
  },
  {
    "id": "FOOD-DIST-005",
    "registrationId": "PLSCF-2026-F1002",
    "studentName": "Dr. Nusrat Jahan",
    "batchName": "SSC 2005",
    "mealType": "lunch",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T13:12:00Z",
    "staffId": "STF-002",
    "staffName": "Mohammad Faruk Hossain (Lunch Incharge)"
  },
  {
    "id": "FOOD-DIST-006",
    "registrationId": "PLSCF-2026-F1004",
    "studentName": "Kazi Mahfuzur Rahman",
    "batchName": "SSC 1986",
    "mealType": "breakfast",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T09:00:15Z",
    "staffId": "STF-003",
    "staffName": "Nasir Uddin (Breakfast Lead)"
  },
  {
    "id": "FOOD-DIST-007",
    "registrationId": "PLSCF-2026-F1006",
    "studentName": "Engr. Moniruzzaman",
    "batchName": "SSC 1975",
    "mealType": "breakfast",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T09:15:00Z",
    "staffId": "STF-003",
    "staffName": "Nasir Uddin (Breakfast Lead)"
  },
  {
    "id": "FOOD-DIST-008",
    "registrationId": "PLSCF-2026-F1008",
    "studentName": "Prof. Anisur Rahman",
    "batchName": "SSC 1983",
    "mealType": "lunch",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T13:25:30Z",
    "staffId": "STF-002",
    "staffName": "Mohammad Faruk Hossain (Lunch Incharge)"
  },
  {
    "id": "FOOD-DIST-009",
    "registrationId": "PLSCF-2026-F1010",
    "studentName": "Golam Mostafa",
    "batchName": "SSC 1991",
    "mealType": "lunch",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T13:30:10Z",
    "staffId": "STF-002",
    "staffName": "Mohammad Faruk Hossain (Lunch Incharge)"
  },
  {
    "id": "FOOD-DIST-010",
    "registrationId": "PLSCF-2026-F1011",
    "studentName": "Farhana Yasmin",
    "batchName": "SSC 1995",
    "mealType": "lunch",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T13:40:00Z",
    "staffId": "STF-002",
    "staffName": "Mohammad Faruk Hossain (Lunch Incharge)"
  },
  {
    "id": "FOOD-DIST-011",
    "registrationId": "PLSCF-2026-F1006",
    "studentName": "Engr. Moniruzzaman",
    "batchName": "SSC 1975",
    "mealType": "dinner",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T19:30:00Z",
    "staffId": "STF-006",
    "staffName": "Abdur Rahim (Dinner Incharge)",
    "notes": "VIP Dinner pass redeemed"
  },
  {
    "id": "FOOD-DIST-012",
    "registrationId": "PLSCF-2026-F1008",
    "studentName": "Prof. Anisur Rahman",
    "batchName": "SSC 1983",
    "mealType": "dinner",
    "status": "COLLECTED",
    "collectedAt": "2026-02-15T19:45:00Z",
    "staffId": "STF-006",
    "staffName": "Abdur Rahim (Dinner Incharge)"
  }
];

// Initial Dress / Kit Distributions
export const INITIAL_DRESS_DISTRIBUTIONS: DressDistributionRecord[] = [
  {
    "id": "DRS-DIST-001",
    "registrationId": "PLSCF-2026-F1002",
    "studentName": "Dr. Nusrat Jahan",
    "itemType": "reunion_tshirt",
    "registeredSize": "M",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T08:20:00Z",
    "staffId": "STF-004",
    "staffName": "Jamal Uddin Chowdhury (Kit & T-Shirt)",
    "notes": "Kits & Souvenir Bag delivered"
  },
  {
    "id": "DRS-DIST-002",
    "registrationId": "PLSCF-2026-C2002",
    "studentName": "Ayesha Siddiqua",
    "itemType": "reunion_tshirt",
    "registeredSize": "S",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T08:45:00Z",
    "staffId": "STF-004",
    "staffName": "Jamal Uddin Chowdhury (Kit & T-Shirt)",
    "notes": "Verified against current student registration"
  },
  {
    "id": "DRS-DIST-003",
    "registrationId": "PLSCF-2026-F1006",
    "studentName": "Engr. Moniruzzaman",
    "itemType": "reunion_tshirt",
    "registeredSize": "XL",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T09:10:00Z",
    "staffId": "STF-004",
    "staffName": "Jamal Uddin Chowdhury (Kit & T-Shirt)"
  },
  {
    "id": "DRS-DIST-004",
    "registrationId": "PLSCF-2026-F1008",
    "studentName": "Prof. Anisur Rahman",
    "itemType": "reunion_tshirt",
    "registeredSize": "M",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T09:20:00Z",
    "staffId": "STF-004",
    "staffName": "Jamal Uddin Chowdhury (Kit & T-Shirt)"
  },
  {
    "id": "DRS-DIST-005",
    "registrationId": "PLSCF-2026-F1010",
    "studentName": "Golam Mostafa",
    "itemType": "reunion_tshirt",
    "registeredSize": "XL",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T09:35:00Z",
    "staffId": "STF-008",
    "staffName": "Kazi Rayhan (Distribution Booth 02)"
  },
  {
    "id": "DRS-DIST-006",
    "registrationId": "PLSCF-2026-F1011",
    "studentName": "Farhana Yasmin",
    "itemType": "reunion_tshirt",
    "registeredSize": "M",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T09:45:00Z",
    "staffId": "STF-008",
    "staffName": "Kazi Rayhan (Distribution Booth 02)"
  },
  {
    "id": "DRS-DIST-007",
    "registrationId": "PLSCF-2026-F1014",
    "studentName": "Zubair Hossain",
    "itemType": "reunion_tshirt",
    "registeredSize": "XXL",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T10:05:00Z",
    "staffId": "STF-008",
    "staffName": "Kazi Rayhan (Distribution Booth 02)"
  },
  {
    "id": "DRS-DIST-008",
    "registrationId": "PLSCF-2026-F1015",
    "studentName": "Mahbuba Akter",
    "itemType": "reunion_tshirt",
    "registeredSize": "M",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T10:20:00Z",
    "staffId": "STF-004",
    "staffName": "Jamal Uddin Chowdhury (Kit & T-Shirt)"
  },
  {
    "id": "DRS-DIST-009",
    "registrationId": "PLSCF-2026-C2005",
    "studentName": "Fatema Tuj Zohra",
    "itemType": "reunion_tshirt",
    "registeredSize": "S",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T10:40:00Z",
    "staffId": "STF-004",
    "staffName": "Jamal Uddin Chowdhury (Kit & T-Shirt)"
  },
  {
    "id": "DRS-DIST-010",
    "registrationId": "PLSCF-2026-C2006",
    "studentName": "Sadia Afrin",
    "itemType": "reunion_tshirt",
    "registeredSize": "M",
    "status": "RECEIVED",
    "receivedAt": "2026-02-15T10:55:00Z",
    "staffId": "STF-008",
    "staffName": "Kazi Rayhan (Distribution Booth 02)"
  }
];

// Initial Audit History
export const INITIAL_AUDIT_HISTORY: AdminAuditHistoryItem[] = [
  {
    id: 'HIST-001',
    adminId: 'SUPER_ADMIN',
    adminName: 'System Administrator (Testing)',
    entityType: 'BUDGET',
    entityId: 'BUDGET-2026',
    action: 'INIT_CENTRAL_BUDGET',
    newValue: 'BDT 5,00,000 allocated for Grand Reunion 2026',
    reason: 'Initial central budget provisioning',
    timestamp: '2026-01-01T00:00:00Z',
  },
  {
    id: 'HIST-002',
    adminId: 'SUPER_ADMIN',
    adminName: 'System Administrator (Testing)',
    entityType: 'STAFF',
    entityId: 'STF-005',
    action: 'CREATE_STAFF',
    newValue: 'Md. Shafiqul Alam (FINANCE_STAFF)',
    reason: 'Provisioned Finance Officer account',
    timestamp: '2026-01-05T09:00:00Z',
  },
  {
    id: 'HIST-003',
    adminId: 'SUPER_ADMIN',
    adminName: 'System Administrator (Testing)',
    entityType: 'BUDGET',
    entityId: 'ALC-001',
    action: 'STAFF_MONEY_ALLOCATION',
    newValue: 'Allocated BDT 1,50,000 to Md. Shafiqul Alam',
    reason: 'Treasury operations, vendor settlements, and emergency liquidity',
    timestamp: '2026-01-10T10:00:00Z',
  },
  {
    id: 'HIST-004',
    adminId: 'PAYSTATION_GATEWAY',
    adminName: 'PayStation Authoritative Gateway',
    entityType: 'PAYMENT',
    entityId: 'PLSCF-2026-F1001',
    action: 'VERIFY_PAYMENT',
    newValue: 'BDT 2,000 verified (Trx: PST-BK-8821901)',
    reason: 'Digital automated transaction confirmation via PayStation',
    timestamp: '2026-01-16T10:32:15Z',
  },
  {
    id: 'HIST-005',
    adminId: 'STF-001',
    adminName: 'Tariqul Islam (Gate Lead)',
    entityType: 'GATE',
    entityId: 'GATE-EVT-001',
    action: 'APPROVE_ENTRY',
    newValue: 'Approved Entry for Tanvir Ahmed (SSC 1998)',
    reason: 'Gate 01 Main Entrance scan verified',
    timestamp: '2026-02-15T08:15:22Z',
  },
];

// Initial Central Budget
export const INITIAL_CENTRAL_BUDGET: CentralBudget = {
  id: 'BUDGET-2026',
  academicYear: 2026,
  totalBudget: 500000, // BDT 5,00,000
  description: 'Grand Reunion 2026 Central Allocated Fund',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'Dr. M. A. Kashem (Convenor)',
};

// Initial Seed Allocations
export const INITIAL_STAFF_ALLOCATIONS: StaffAllocation[] = [
  {
    "id": "ALC-001",
    "staffId": "STF-005",
    "staffName": "Md. Shafiqul Alam (Finance Secretary)",
    "allocatedAmount": 150000,
    "academicYear": 2026,
    "status": "ACTIVE",
    "allocatedAt": "2026-01-10T10:00:00Z",
    "allocatedBy": "SUPER_ADMIN",
    "notes": "Treasury operations, vendor settlements, and emergency liquidity"
  },
  {
    "id": "ALC-002",
    "staffId": "STF-004",
    "staffName": "Jamal Uddin Chowdhury (Kit & T-Shirt)",
    "allocatedAmount": 100000,
    "academicYear": 2026,
    "status": "ACTIVE",
    "allocatedAt": "2026-01-12T11:00:00Z",
    "allocatedBy": "SUPER_ADMIN",
    "notes": "T-shirt logistics, packaging, and kit distribution booth setup"
  },
  {
    "id": "ALC-003",
    "staffId": "STF-003",
    "staffName": "Nasir Uddin (Breakfast Lead)",
    "allocatedAmount": 40000,
    "academicYear": 2026,
    "status": "ACTIVE",
    "allocatedAt": "2026-01-15T09:00:00Z",
    "allocatedBy": "SUPER_ADMIN",
    "notes": "Breakfast mineral water, morning refreshments procurement"
  },
  {
    "id": "ALC-004",
    "staffId": "STF-002",
    "staffName": "Mohammad Faruk Hossain (Lunch Incharge)",
    "allocatedAmount": 120000,
    "academicYear": 2026,
    "status": "ACTIVE",
    "allocatedAt": "2026-01-18T10:00:00Z",
    "allocatedBy": "SUPER_ADMIN",
    "notes": "Grand Buffet catering booking, serving personnel & disposable ware"
  },
  {
    "id": "ALC-005",
    "staffId": "STF-006",
    "staffName": "Abdur Rahim (Dinner Incharge)",
    "allocatedAmount": 60000,
    "academicYear": 2026,
    "status": "ACTIVE",
    "allocatedAt": "2026-01-20T11:00:00Z",
    "allocatedBy": "SUPER_ADMIN",
    "notes": "Evening cultural show buffet and tea session logistics"
  },
  {
    "id": "ALC-006",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "allocatedAmount": 30000,
    "academicYear": 2026,
    "status": "ACTIVE",
    "allocatedAt": "2026-01-22T09:30:00Z",
    "allocatedBy": "SUPER_ADMIN",
    "notes": "Gate metal detectors, barricades, and wireless QR scanners"
  }
];

// Initial Seed Expenses
export const INITIAL_STAFF_EXPENSES: StaffExpense[] = [
  {
    "id": "EXP-2026-01",
    "staffId": "STF-005",
    "staffName": "Md. Shafiqul Alam (Finance Secretary)",
    "amount": 50000,
    "category": "Stage & Sound Fabrication",
    "description": "Advance payment for main sound setup and lighting rig",
    "expenseDate": "2026-01-20",
    "expenseTime": "11:30",
    "vendorName": "Faridpur Acoustic Engineering",
    "status": "APPROVED",
    "approvedBy": "Dr. M. A. Kashem (Convenor)",
    "approvedAt": "2026-01-20T14:00:00Z",
    "createdAt": "2026-01-20T11:30:00Z"
  },
  {
    "id": "EXP-2026-02",
    "staffId": "STF-004",
    "staffName": "Jamal Uddin Chowdhury (Kit & T-Shirt)",
    "amount": 35000,
    "category": "T-Shirt Packaging & Badges",
    "description": "Cotton fabric inspection and packaging box advance",
    "expenseDate": "2026-01-25",
    "expenseTime": "15:00",
    "vendorName": "Bengal Knitwear Faridpur",
    "status": "APPROVED",
    "approvedBy": "Dr. M. A. Kashem (Convenor)",
    "approvedAt": "2026-01-25T16:00:00Z",
    "createdAt": "2026-01-25T15:00:00Z"
  },
  {
    "id": "EXP-2026-03",
    "staffId": "STF-003",
    "staffName": "Nasir Uddin (Breakfast Lead)",
    "amount": 8000,
    "category": "Mineral Water Jars",
    "description": "Advance booking for 200 high-grade filtered water dispensers",
    "expenseDate": "2026-02-01",
    "expenseTime": "09:00",
    "vendorName": "Padma Pure Water Co.",
    "status": "APPROVED",
    "approvedBy": "Md. Shafiqul Alam (Finance)",
    "approvedAt": "2026-02-01T11:00:00Z",
    "createdAt": "2026-02-01T09:00:00Z"
  },
  {
    "id": "EXP-2026-04",
    "staffId": "STF-002",
    "staffName": "Mohammad Faruk Hossain (Lunch Incharge)",
    "amount": 45000,
    "category": "Buffet Crockery & Disposable Box",
    "description": "Procurement of eco-friendly cutlery and lunch boxes",
    "expenseDate": "2026-02-03",
    "expenseTime": "14:20",
    "vendorName": "Faridpur Catering Supplies Ltd.",
    "status": "APPROVED",
    "approvedBy": "Md. Shafiqul Alam (Finance)",
    "approvedAt": "2026-02-03T16:00:00Z",
    "createdAt": "2026-02-03T14:20:00Z"
  },
  {
    "id": "EXP-2026-05",
    "staffId": "STF-001",
    "staffName": "Tariqul Islam (Gate Lead)",
    "amount": 12000,
    "category": "Gate Signage & Canopy",
    "description": "Weatherproof entrance arches and scanner stands",
    "expenseDate": "2026-02-04",
    "expenseTime": "10:00",
    "vendorName": "Modern Sign & Print",
    "status": "APPROVED",
    "approvedBy": "Md. Shafiqul Alam (Finance)",
    "approvedAt": "2026-02-04T12:00:00Z",
    "createdAt": "2026-02-04T10:00:00Z"
  },
  {
    "id": "EXP-2026-06",
    "staffId": "STF-006",
    "staffName": "Abdur Rahim (Dinner Incharge)",
    "amount": 15000,
    "category": "Evening Snacks & Tea",
    "description": "Traditional sweets and high tea logistics",
    "expenseDate": "2026-02-05",
    "expenseTime": "16:00",
    "vendorName": "Faridpur Sweet Bakery",
    "status": "SUBMITTED",
    "createdAt": "2026-02-05T16:00:00Z"
  }
];

// Initial Financial Ledger (authoritative double-entry records)
export const INITIAL_FINANCIAL_LEDGER: FinancialLedgerEntry[] = [
  {
    id: 'LDG-001',
    staffId: 'STF-007',
    transactionType: 'ALLOCATION',
    amount: 150000,
    referenceId: 'ALC-001',
    description: 'Central budget allocation to Finance Secretary',
    createdAt: '2026-01-10T10:00:00Z',
    createdBy: 'SUPER_ADMIN',
  },
  {
    id: 'LDG-002',
    staffId: 'STF-006',
    transactionType: 'ALLOCATION',
    amount: 100000,
    referenceId: 'ALC-002',
    description: 'Central budget allocation to Logistics Incharge',
    createdAt: '2026-01-12T11:00:00Z',
    createdBy: 'SUPER_ADMIN',
  },
  {
    id: 'LDG-003',
    staffId: 'STF-003',
    transactionType: 'ALLOCATION',
    amount: 30000,
    referenceId: 'ALC-003',
    description: 'Central budget allocation to Breakfast Counter',
    createdAt: '2026-01-15T09:00:00Z',
    createdBy: 'SUPER_ADMIN',
  },
  {
    id: 'LDG-004',
    staffId: 'STF-007',
    transactionType: 'EXPENSE',
    amount: 50000,
    referenceId: 'EXP-2026-01',
    description: 'Stage & Sound Fabrication advance payment',
    createdAt: '2026-01-20T14:00:00Z',
    createdBy: 'STF-007',
  },
  {
    id: 'LDG-005',
    staffId: 'STF-006',
    transactionType: 'EXPENSE',
    amount: 35000,
    referenceId: 'EXP-2026-02',
    description: 'T-Shirt Packaging & Badges payment',
    createdAt: '2026-01-25T16:00:00Z',
    createdBy: 'STF-006',
  },
];

// In-memory fallback when window.localStorage is not available (SSR / Node / Tests)
const eventMemoryStore: Record<string, string> = {};

// Safe storage getter and setter
function loadData<T>(key: string, fallback: T): T {
  try {
    let parsed: any = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      parsed = JSON.parse(raw);
    } else {
      const raw = eventMemoryStore[key];
      if (!raw) return fallback;
      parsed = JSON.parse(raw);
    }
    // If fallback is a non-empty array and parsed is empty (e.g. initial empty array saved before), fallback to seed data
    if (Array.isArray(fallback) && fallback.length > 0 && Array.isArray(parsed) && parsed.length === 0) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function saveData<T>(key: string, data: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(data));
      return;
    }
    eventMemoryStore[key] = JSON.stringify(data);
  } catch (err) {
    console.warn(`Storage write notice for ${key}:`, err);
  }
}

let staffAccountsCache: StaffAccount[] = [...INITIAL_STAFF_ACCOUNTS];

export class EventStore {
  // ==========================================
  // 1. STAFF AUTHENTICATION & MANAGEMENT (PART 2)
  // ==========================================

  static getStaffAccounts(): StaffAccount[] {
    const rawList = staffAccountsCache || [];
    const map = new Map<string, StaffAccount>();
    for (const s of INITIAL_STAFF_ACCOUNTS) {
      map.set(s.id, s);
    }
    for (const s of rawList) {
      map.set(s.id, s);
    }
    staffAccountsCache = Array.from(map.values());
    return staffAccountsCache;
  }

  static async fetchStaffAccounts(): Promise<StaffAccount[]> {
    const { data, error } = await supabase
      .from('staff_accounts')
      .select('id, auth_user_id, full_name, username, email, role, status, assigned_gate, created_at, created_by')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const accounts: StaffAccount[] = (data || []).map((row) => ({
      id: row.id,
      authUserId: row.auth_user_id,
      fullName: row.full_name,
      username: row.username,
      email: row.email,
      role: row.role,
      department: ((row as any).department as DepartmentType) || getDefaultDepartment(row.role),
      permissions: ((row as any).permissions as StaffPermissionAction[]) || getDefaultPermissions(row.role),
      status: row.status,
      assignedGate: row.assigned_gate || undefined,
      createdAt: row.created_at,
      createdBy: row.created_by || undefined,
    }));
    staffAccountsCache = accounts;
    return accounts;
  }

  static saveStaffAccounts(accounts: StaffAccount[]): void {
    staffAccountsCache = accounts;
  }

  static async getActiveStaffSession(): Promise<StaffAccount | null> {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('plscf_test_staff_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
            localStorage.removeItem('plscf_test_staff_session');
          } else if (!isDevTestBypassAllowed() && parsed.id?.startsWith('staff-001')) {
            localStorage.removeItem('plscf_test_staff_session');
          } else {
            return parsed;
          }
        }
      } catch (_) { }
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data, error } = await supabase
      .from('staff_accounts')
      .select('id, auth_user_id, full_name, username, email, role, status, assigned_gate, created_at, created_by')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error || !data || data.status !== 'ACTIVE') return null;
    const staff: StaffAccount = {
      id: data.id,
      authUserId: data.auth_user_id,
      fullName: data.full_name,
      username: data.username,
      email: data.email,
      role: data.role,
      department: ((data as any).department as DepartmentType) || getDefaultDepartment(data.role),
      permissions: ((data as any).permissions as StaffPermissionAction[]) || getDefaultPermissions(data.role),
      status: data.status,
      assignedGate: data.assigned_gate || undefined,
      createdAt: data.created_at,
      createdBy: data.created_by || undefined,
    };
    return staff;
  }

  /**
   * Authenticate staff by username or email and password
   */
  static async authenticateStaff(
    identifier: string,
    passwordAttempt: string
  ): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
    const normalized = identifier.trim().toLowerCase();

    // Testing credentials support restricted strictly to dev environment
    if (isDevTestBypassAllowed() && passwordAttempt === 'admin@123') {
      const allStaff = this.getStaffAccounts();
      const match = allStaff.find(
        (a) =>
          a.username.toLowerCase() === normalized ||
          a.email.toLowerCase() === normalized ||
          (normalized === 'admin' && a.username === 'admin@gmail.com')
      );
      if (match) {
        if (match.status !== 'ACTIVE') {
          return { success: false, error: 'Access denied: this staff account is disabled.' };
        }
        const sessionWithExpiry = { ...match, expiresAt: Date.now() + STAFF_SESSION_TTL_MS };
        if (typeof window !== 'undefined') {
          localStorage.setItem('plscf_test_staff_session', JSON.stringify(sessionWithExpiry));
        }
        return { success: true, staff: match };
      }
      if (normalized === 'admin@gmail.com' || normalized === 'admin') {
        const testStaff = { ...INITIAL_STAFF_ACCOUNTS[0], expiresAt: Date.now() + STAFF_SESSION_TTL_MS };
        if (typeof window !== 'undefined') {
          localStorage.setItem('plscf_test_staff_session', JSON.stringify(testStaff));
        }
        return { success: true, staff: testStaff };
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalized,
      password: passwordAttempt,
    });

    if (authError || !authData.user) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const { data, error } = await supabase
      .from('staff_accounts')
      .select('id, auth_user_id, full_name, username, email, role, status, assigned_gate, created_at, created_by')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (error || !data) {
      await supabase.auth.signOut();
      return { success: false, error: 'This account is not authorized for staff access.' };
    }

    if (data.status !== 'ACTIVE') {
      await supabase.auth.signOut();
      return { success: false, error: 'Access denied: this staff account is disabled.' };
    }

    if (data.role === 'BREAKFAST_STAFF' && !isBreakfastCollectionOpen()) {
      await supabase.auth.signOut();
      return { success: false, error: 'Breakfast staff login is closed after 1:00 PM Bangladesh time.' };
    }

    const staff: StaffAccount = {
      id: data.id,
      authUserId: data.auth_user_id,
      fullName: data.full_name,
      username: data.username,
      email: data.email,
      role: data.role,
      department: ((data as any).department as DepartmentType) || getDefaultDepartment(data.role),
      permissions: ((data as any).permissions as StaffPermissionAction[]) || getDefaultPermissions(data.role),
      status: data.status,
      assignedGate: data.assigned_gate || undefined,
      createdAt: data.created_at,
      createdBy: data.created_by || undefined,
    };
    return { success: true, staff };
  }

  static async logoutStaff(): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('plscf_test_staff_session');
      } catch (_) { }
    }
    const { error } = await supabase.auth.signOut();
    if (error) console.warn('Supabase staff logout:', error);
  }

  /**
   * Super Admin only: Create a new Staff Account
   */
  static async createStaffAccount(account: Omit<StaffAccount, 'id' | 'createdAt'>): Promise<StaffAccount> {
    const accounts = this.getStaffAccounts();
    const department = account.department || getDefaultDepartment(account.role);
    const permissions = account.permissions || getDefaultPermissions(account.role);

    const newStaff: StaffAccount = {
      ...account,
      department,
      permissions,
      id: `STF-${safeRandomUUID()}`,
      createdAt: new Date().toISOString(),
    };

    const { error } = await supabase.from('staff_accounts').insert({
      id: newStaff.id,
      auth_user_id: newStaff.authUserId,
      full_name: newStaff.fullName,
      username: newStaff.username,
      email: newStaff.email,
      role: newStaff.role,
      department: newStaff.department,
      permissions: newStaff.permissions,
      status: newStaff.status,
      assigned_gate: newStaff.assignedGate,
      created_at: newStaff.createdAt,
      created_by: newStaff.createdBy,
    });
    if (error) throw error;
    this.saveStaffAccounts([...accounts, newStaff]);

    this.recordAuditHistory({
      adminId: 'SUPER_ADMIN',
      adminName: 'Super Administrator',
      entityType: 'STAFF',
      entityId: newStaff.id,
      action: 'CREATE_STAFF',
      newValue: `${newStaff.fullName} (${newStaff.role} - Dept: ${newStaff.department})`,
      reason: 'Staff account provisioned by Super Admin with department permissions',
    });

    return newStaff;
  }

  /**
   * Super Admin only: Update staff account status, role, department or permissions
   */
  static async updateStaffAccount(
    staffId: string,
    updates: Partial<StaffAccount>,
    reason: string
  ): Promise<StaffAccount | null> {
    const accounts = this.getStaffAccounts();
    const index = accounts.findIndex((a) => a.id === staffId);
    if (index === -1) return null;

    const previous = { ...accounts[index] };
    const updated = { ...accounts[index], ...updates };
    const dbUpdates: Record<string, unknown> = {};
    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.department !== undefined) dbUpdates.department = updates.department;
    if (updates.permissions !== undefined) dbUpdates.permissions = updates.permissions;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.assignedGate !== undefined) dbUpdates.assigned_gate = updates.assignedGate;
    if (updates.authUserId !== undefined) dbUpdates.auth_user_id = updates.authUserId;
    const { error } = await supabase.from('staff_accounts').update(dbUpdates).eq('id', staffId);
    if (error) throw error;
    accounts[index] = updated;
    this.saveStaffAccounts(accounts);

    this.recordAuditHistory({
      adminId: 'SUPER_ADMIN',
      adminName: 'Super Administrator',
      entityType: 'STAFF',
      entityId: staffId,
      action: 'UPDATE_STAFF',
      previousValue: JSON.stringify(previous),
      newValue: JSON.stringify(updated),
      reason,
    });

    return updated;
  }

  /**
   * Super Admin only: Delete staff account
   */
  static async deleteStaffAccount(staffId: string, reason: string): Promise<boolean> {
    const accounts = this.getStaffAccounts();
    const filtered = accounts.filter((a) => a.id !== staffId);
    if (filtered.length === accounts.length) return false;

    const { error } = await supabase.from('staff_accounts').delete().eq('id', staffId);
    if (error) throw error;
    this.saveStaffAccounts(filtered);

    this.recordAuditHistory({
      adminId: 'SUPER_ADMIN',
      adminName: 'Super Administrator',
      entityType: 'STAFF',
      entityId: staffId,
      action: 'DELETE_STAFF',
      reason,
    });

    return true;
  }

  /**
   * Safe, Information-Minimized Student Verification for Department Stations.
   * Enforces:
   * 1. Staff permission check for target department
   * 2. Information minimization: strips phone, email, address, financial secrets
   * 3. Look up by 6-character token, registration ID, or scanned QR payload
   */
  static verifyStudentTokenForDepartment(
    tokenOrId: string,
    department: DepartmentType,
    staffUser?: StaffAccount
  ): {
    valid: boolean;
    status: 'AUTHORIZED' | 'UNAUTHORIZED_DEPARTMENT' | 'STUDENT_NOT_FOUND' | 'ALREADY_COLLECTED' | 'NOT_ELIGIBLE';
    message: string;
    student?: {
      id: string;
      fullName: string;
      photoUrl?: string;
      batchName: string;
      category: string;
      qrToken: string;
      departmentStatus: {
        department: DepartmentType;
        canDistribute: boolean;
        isCollected: boolean;
        collectedAt?: string;
        details?: string;
      };
    };
  } {
    // 1. Staff Department Permission Verification
    if (staffUser && !hasDepartmentPermission(staffUser, department, 'VERIFY')) {
      return {
        valid: false,
        status: 'UNAUTHORIZED_DEPARTMENT',
        message: `PERMISSION_DENIED: Staff member is not authorized to verify students in ${department} department.`,
      };
    }

    // 2. Student Lookup via 6-character token, ID, or parsed QR payload
    const registrations = AppStore.getRegistrations();
    const student = findRegistrationByTokenOrId(registrations, tokenOrId);
    if (!student) {
      return {
        valid: false,
        status: 'STUDENT_NOT_FOUND',
        message: `No registration found matching token or ID "${tokenOrId}".`,
      };
    }

    // 3. Department Specific Status Evaluation
    let isCollected = false;
    let collectedAt: string | undefined;
    let details: string | undefined;

    if (department === 'BREAKFAST' || department === 'LUNCH' || department === 'DINNER') {
      const meal = department.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
      const foodRec = this.getMealStatus(student.id, meal);
      if (foodRec) {
        isCollected = true;
        collectedAt = foodRec.collectedAt;
      }
      details = `Meal: ${department}`;
    } else if (department === 'DRESS') {
      const dressRec = this.getDressStatus(student.id, 'reunion_tshirt');
      if (dressRec) {
        isCollected = true;
        collectedAt = dressRec.receivedAt;
      }
      details = `Size: ${student.tShirtSize}`;
    } else if (department === 'GATE') {
      const isInside = this.isStudentCurrentlyInside(student.id);
      details = isInside ? 'Currently Inside Venue' : 'Outside Venue';
    }

    const canDistribute = student.paymentStatus === 'paid' && !isCollected;

    return {
      valid: true,
      status: isCollected ? 'ALREADY_COLLECTED' : 'AUTHORIZED',
      message: isCollected
        ? `Service already collected at ${collectedAt ? new Date(collectedAt).toLocaleTimeString() : ''}.`
        : 'Eligible for service distribution.',
      student: {
        id: student.id,
        fullName: student.fullName,
        photoUrl: student.photoUrl,
        batchName: student.batchName,
        category: student.category,
        qrToken: student.qrToken,
        departmentStatus: {
          department,
          canDistribute,
          isCollected,
          collectedAt,
          details,
        },
      },
    };
  }

  /**
   * Cloud-resilient async scanner validation.
   * If student is not found in local memory, checks Supabase backend before rejecting.
   */
  static async verifyStudentTokenForDepartmentAsync(
    tokenOrId: string,
    department: DepartmentType,
    staffUser?: StaffAccount
  ): Promise<ReturnType<typeof EventStore.verifyStudentTokenForDepartment>> {
    const localRes = this.verifyStudentTokenForDepartment(tokenOrId, department, staffUser);
    if (localRes.valid || localRes.status !== 'STUDENT_NOT_FOUND') {
      return localRes;
    }

    // Try cloud lookup
    const student = await AppStore.findRegistrationAsync(tokenOrId);
    if (student) {
      return this.verifyStudentTokenForDepartment(tokenOrId, department, staffUser);
    }

    return localRes;
  }

  // ==========================================
  // 2. FOOD DISTRIBUTION MANAGEMENT (PART 3)
  // ==========================================

  static getFoodDistributions(): FoodDistributionRecord[] {
    return loadData<FoodDistributionRecord[]>(KEY_FOOD_DISTRIBUTIONS, INITIAL_FOOD_DISTRIBUTIONS);
  }

  static saveFoodDistributions(items: FoodDistributionRecord[]): void {
    saveData(KEY_FOOD_DISTRIBUTIONS, items);
  }

  static getMealStatus(
    registrationId: string,
    mealType: 'breakfast' | 'lunch' | 'dinner'
  ): FoodDistributionRecord | undefined {
    return this.getFoodDistributions().find(
      (d) => d.registrationId === registrationId && d.mealType === mealType && d.status === 'COLLECTED'
    );
  }

  /**
   * Confirm meal distribution (Breakfast, Lunch, or Dinner)
   */
  static confirmFoodDistribution(
    registrationId: string,
    studentName: string,
    batchName: string,
    mealType: 'breakfast' | 'lunch' | 'dinner',
    staffId: string,
    staffName: string,
    notes?: string,
    staffUser?: StaffAccount
  ): { success: boolean; record?: FoodDistributionRecord; error?: string } {
    // 1. Department Access Control Verification
    const staff = staffUser || this.getStaffAccounts().find((s) => s.id === staffId);
    const targetDept: DepartmentType = mealType.toUpperCase() as DepartmentType;
    if (staff && !hasDepartmentPermission(staff, targetDept, 'APPROVE')) {
      return {
        success: false,
        error: `PERMISSION_DENIED: Staff member "${staff.fullName}" is not authorized to approve ${mealType.toUpperCase()} distribution.`,
      };
    }

    if (mealType === 'breakfast' && !isBreakfastCollectionOpen()) {
      return {
        success: false,
        error: 'Breakfast service is closed after 1:00 PM Bangladesh time.',
      };
    }

    const existing = this.getFoodDistributions();
    const already = existing.find(
      (d) => d.registrationId === registrationId && d.mealType === mealType && d.status === 'COLLECTED'
    );

    if (already) {
      return {
        success: false,
        error: `ALREADY COLLECTED: ${mealType.toUpperCase()} was already received on ${new Date(already.collectedAt).toLocaleTimeString()}.`,
      };
    }

    const newRecord: FoodDistributionRecord = {
      id: `FOOD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      registrationId,
      studentName,
      batchName,
      mealType,
      status: 'COLLECTED',
      collectedAt: new Date().toISOString(),
      staffId,
      staffName,
      notes,
    };

    const updated = [newRecord, ...existing];
    this.saveFoodDistributions(updated);

    // Sync to Supabase
    supabase.from('food_distributions').insert(newRecord).then(undefined, () => { });

    return { success: true, record: newRecord };
  }

  /**
   * Super Admin only: Correct food collection record with mandatory reason
   */
  static adminCorrectFoodDistribution(
    distributionId: string,
    newStatus: 'COLLECTED' | 'CANCELLED',
    reason: string,
    adminId: string,
    adminName: string
  ): boolean {
    const list = this.getFoodDistributions();
    const item = list.find((d) => d.id === distributionId);
    if (!item) return false;

    const previousStatus = item.status;
    item.status = newStatus;
    item.correctedBy = adminName;
    item.correctionReason = reason;
    item.correctedAt = new Date().toISOString();

    this.saveFoodDistributions(list);

    // Sync to Supabase
    supabase.from('food_distributions').update({
      status: newStatus,
      corrected_by: adminName,
      correction_reason: reason,
      corrected_at: item.correctedAt,
    }).eq('id', distributionId).then(undefined, () => { });

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'FOOD',
      entityId: distributionId,
      action: 'CORRECT_FOOD_STATUS',
      previousValue: previousStatus,
      newValue: newStatus,
      reason,
    });

    return true;
  }

  // ==========================================
  // 3. GATE ENTRY & EXIT MANAGEMENT (PART 4)
  // ==========================================

  static getGateEvents(): GateEventRecord[] {
    return loadData<GateEventRecord[]>(KEY_GATE_EVENTS, INITIAL_GATE_EVENTS);
  }

  static saveGateEvents(events: GateEventRecord[]): void {
    saveData(KEY_GATE_EVENTS, events);
  }

  static isStudentCurrentlyInside(registrationId: string): boolean {
    const events = this.getGateEvents().filter(
      (e) => e.registrationId === registrationId && e.status === 'APPROVED'
    );
    if (events.length === 0) return false;
    // events are saved newest first
    return events[0].eventType === 'ENTRY';
  }

  static recordGateEvent(
    registrationId: string,
    studentName: string,
    batchName: string,
    photoUrl: string | undefined,
    eventType: 'ENTRY' | 'EXIT',
    gateId: string,
    scannerId: string | undefined,
    staffId: string,
    staffName: string,
    staffUser?: StaffAccount
  ): { success: boolean; event?: GateEventRecord; error?: string } {
    // Department Access Control Verification
    const staff = staffUser || this.getStaffAccounts().find((s) => s.id === staffId);
    if (staff && !hasDepartmentPermission(staff, 'GATE', 'APPROVE')) {
      return {
        success: false,
        error: `PERMISSION_DENIED: Staff member "${staff.fullName}" is not authorized for gate entry/exit approval.`,
      };
    }

    const inside = this.isStudentCurrentlyInside(registrationId);

    if (eventType === 'ENTRY' && inside) {
      return {
        success: false,
        error: 'DUPLICATE ENTRY ALERT: Student is already marked as INSIDE the venue!',
      };
    }
    if (eventType === 'EXIT' && !inside) {
      return {
        success: false,
        error: 'EXIT MISMATCH ALERT: Student does not have an active entry record!',
      };
    }

    const newEvent: GateEventRecord = {
      id: `GATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      registrationId,
      studentName,
      batchName,
      photoUrl,
      eventType,
      gateId,
      scannerId,
      staffId,
      staffName,
      timestamp: new Date().toISOString(),
      status: 'APPROVED',
    };

    const existing = this.getGateEvents();
    const updated = [newEvent, ...existing];
    this.saveGateEvents(updated);

    // Sync to Supabase
    supabase.from('gate_events').insert(newEvent).then(undefined, () => { });

    return { success: true, event: newEvent };
  }

  static adminCorrectGateEvent(
    eventId: string,
    newStatus: 'APPROVED' | 'DENIED' | 'REVISED',
    reason: string,
    adminId: string,
    adminName: string
  ): boolean {
    const list = this.getGateEvents();
    const item = list.find((e) => e.id === eventId);
    if (!item) return false;

    const previousStatus = item.status;
    item.status = newStatus;
    item.correctedBy = adminName;
    item.correctionReason = reason;
    item.correctedAt = new Date().toISOString();

    this.saveGateEvents(list);

    // Sync to Supabase
    supabase.from('gate_events').update({
      status: newStatus,
      corrected_by: adminName,
      correction_reason: reason,
      corrected_at: item.correctedAt,
    }).eq('id', eventId).then(undefined, () => { });

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'GATE',
      entityId: eventId,
      action: 'CORRECT_GATE_EVENT',
      previousValue: previousStatus,
      newValue: newStatus,
      reason,
    });

    return true;
  }

  // ==========================================
  // 4. DRESS / T-SHIRT DISTRIBUTION (PART 5)
  // ==========================================

  static getDressDistributions(): DressDistributionRecord[] {
    return loadData<DressDistributionRecord[]>(KEY_DRESS_DISTRIBUTIONS, INITIAL_DRESS_DISTRIBUTIONS);
  }

  static saveDressDistributions(items: DressDistributionRecord[]): void {
    saveData(KEY_DRESS_DISTRIBUTIONS, items);
  }

  static getDressStatus(
    registrationId: string,
    itemType: string = 'reunion_tshirt'
  ): DressDistributionRecord | undefined {
    return this.getDressDistributions().find(
      (d) => d.registrationId === registrationId && d.itemType === itemType && d.status === 'RECEIVED'
    );
  }

  static confirmDressDistribution(
    registrationId: string,
    studentName: string,
    itemType: string,
    registeredSize: any,
    staffId: string,
    staffName: string,
    notes?: string,
    staffUser?: StaffAccount
  ): { success: boolean; record?: DressDistributionRecord; error?: string } {
    // Department Access Control Verification
    const staff = staffUser || this.getStaffAccounts().find((s) => s.id === staffId);
    if (staff && !hasDepartmentPermission(staff, 'DRESS', 'APPROVE')) {
      return {
        success: false,
        error: `PERMISSION_DENIED: Staff member "${staff.fullName}" is not authorized for dress kit distribution approval.`,
      };
    }

    const existing = this.getDressDistributions();
    const already = existing.find(
      (d) => d.registrationId === registrationId && d.itemType === itemType && d.status === 'RECEIVED'
    );

    if (already) {
      return {
        success: false,
        error: `ALREADY RECEIVED: Size ${already.registeredSize} was received at ${new Date(already.receivedAt).toLocaleTimeString()}.`,
      };
    }

    const newRecord: DressDistributionRecord = {
      id: `DRS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      registrationId,
      studentName,
      itemType,
      registeredSize,
      status: 'RECEIVED',
      receivedAt: new Date().toISOString(),
      staffId,
      staffName,
      notes,
    };

    const updated = [newRecord, ...existing];
    this.saveDressDistributions(updated);

    // Sync to Supabase
    supabase.from('dress_distributions').insert(newRecord).then(undefined, () => { });

    return { success: true, record: newRecord };
  }

  static adminCorrectDressDistribution(
    distributionId: string,
    newStatus: 'RECEIVED' | 'RETURNED' | 'CORRECTED',
    newSize: any,
    reason: string,
    adminId: string,
    adminName: string
  ): boolean {
    const list = this.getDressDistributions();
    const item = list.find((d) => d.id === distributionId);
    if (!item) return false;

    const previousVal = `${item.status} (Size ${item.registeredSize})`;
    item.status = newStatus;
    if (newSize) item.registeredSize = newSize;
    item.correctedBy = adminName;
    item.correctionReason = reason;
    item.correctedAt = new Date().toISOString();

    this.saveDressDistributions(list);

    // Sync to Supabase
    supabase.from('dress_distributions').update({
      status: newStatus,
      registered_size: item.registeredSize,
      corrected_by: adminName,
      correction_reason: reason,
      corrected_at: item.correctedAt,
    }).eq('id', distributionId).then(undefined, () => { });

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'DRESS',
      entityId: distributionId,
      action: 'CORRECT_DRESS_DISTRIBUTION',
      previousValue: previousVal,
      newValue: `${newStatus} (Size ${item.registeredSize})`,
      reason,
    });

    return true;
  }

  // ==========================================
  // 5. BUDGET, ALLOCATION & EXPENSES (PART 8)
  // ==========================================

  static getCentralBudget(_year: number = 2026): CentralBudget {
    return loadData<CentralBudget>(KEY_CENTRAL_BUDGET, INITIAL_CENTRAL_BUDGET);
  }

  static saveCentralBudget(budget: CentralBudget): void {
    saveData(KEY_CENTRAL_BUDGET, budget);
    supabase.from('central_budget').upsert(budget).then(undefined, () => { });
  }

  static updateCentralBudget(
    newAmount: number,
    adminId: string,
    adminName: string,
    reason: string
  ): CentralBudget {
    const current = this.getCentralBudget();
    const prev = current.totalBudget;
    current.totalBudget = newAmount;
    current.updatedAt = new Date().toISOString();
    current.updatedBy = adminName;

    this.saveCentralBudget(current);

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'BUDGET',
      entityId: current.id,
      action: 'UPDATE_CENTRAL_BUDGET',
      previousValue: `BDT ${prev}`,
      newValue: `BDT ${newAmount}`,
      reason,
    });

    return current;
  }

  static getStaffAllocations(): StaffAllocation[] {
    return loadData<StaffAllocation[]>(KEY_STAFF_ALLOCATIONS, INITIAL_STAFF_ALLOCATIONS);
  }

  static saveStaffAllocations(allocations: StaffAllocation[]): void {
    saveData(KEY_STAFF_ALLOCATIONS, allocations);
  }

  static allocateMoneyToStaff(
    staffId: string,
    staffName: string,
    amount: number,
    adminId: string,
    adminName: string,
    notes?: string
  ): StaffAllocation {
    const allocations = this.getStaffAllocations();
    const newAlloc: StaffAllocation = {
      id: `ALC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      staffId,
      staffName,
      allocatedAmount: Number(amount),
      academicYear: 2026,
      status: 'ACTIVE',
      allocatedAt: new Date().toISOString(),
      allocatedBy: adminName,
      notes,
    };

    this.saveStaffAllocations([newAlloc, ...allocations]);
    supabase.from('staff_allocations').insert(newAlloc).then(undefined, () => { });

    // Write to authoritative financial ledger
    this.addLedgerEntry({
      staffId,
      transactionType: 'ALLOCATION',
      amount: Number(amount),
      referenceId: newAlloc.id,
      description: `Staff Budget Allocation: ${notes || 'Event Operational Fund'}`,
      createdBy: adminName,
    });

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'BUDGET',
      entityId: newAlloc.id,
      action: 'STAFF_MONEY_ALLOCATION',
      newValue: `Allocated BDT ${amount} to ${staffName}`,
      reason: notes || 'Allocated operational funds for event execution',
    });

    return newAlloc;
  }

  static getStaffExpenses(): StaffExpense[] {
    return loadData<StaffExpense[]>(KEY_STAFF_EXPENSES, INITIAL_STAFF_EXPENSES);
  }

  static saveStaffExpenses(expenses: StaffExpense[]): void {
    saveData(KEY_STAFF_EXPENSES, expenses);
  }

  static getFinancialLedger(): FinancialLedgerEntry[] {
    return loadData<FinancialLedgerEntry[]>(KEY_FINANCIAL_LEDGER, INITIAL_FINANCIAL_LEDGER);
  }

  static saveFinancialLedger(entries: FinancialLedgerEntry[]): void {
    saveData(KEY_FINANCIAL_LEDGER, entries);
  }

  static addLedgerEntry(entry: Omit<FinancialLedgerEntry, 'id' | 'createdAt'>): FinancialLedgerEntry {
    const list = this.getFinancialLedger();
    const newEntry: FinancialLedgerEntry = {
      ...entry,
      id: `LDG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    this.saveFinancialLedger([newEntry, ...list]);
    supabase.from('financial_ledger').insert(newEntry).then(undefined, () => { });
    return newEntry;
  }

  /**
   * Submit an expense by a staff member.
   * STRICT OVERSPENDING CHECK: Prevents submission if amount > remaining balance!
   */
  static submitStaffExpense(
    staffId: string,
    staffName: string,
    amount: number,
    category: string,
    description: string,
    expenseDate: string,
    expenseTime: string,
    vendorName?: string,
    receiptUrl?: string
  ): { success: boolean; expense?: StaffExpense; error?: string } {
    const allocations = this.getStaffAllocations();
    const expenses = this.getStaffExpenses();
    const ledger = this.getFinancialLedger();

    const summary = calculateStaffFinancialSummary(
      staffId,
      staffName,
      allocations,
      expenses,
      ledger
    );

    const check = validateExpenseSubmission(amount, summary.remainingSpendableBalance);
    if (!check.allowed) {
      return { success: false, error: check.error };
    }

    const newExpense: StaffExpense = {
      id: `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      staffId,
      staffName,
      amount: Number(amount),
      category,
      description,
      expenseDate,
      expenseTime,
      vendorName,
      receiptUrl,
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
    };

    const updated = [newExpense, ...expenses];
    this.saveStaffExpenses(updated);
    supabase.from('staff_expenses').insert(newExpense).then(undefined, () => { });

    // Record ledger entry
    this.addLedgerEntry({
      staffId,
      transactionType: 'EXPENSE',
      amount: Number(amount),
      referenceId: newExpense.id,
      description: `Expense submitted: ${category} - ${description}`,
      createdBy: staffName,
    });

    return { success: true, expense: newExpense };
  }

  static approveStaffExpense(expenseId: string, adminId: string, adminName: string): boolean {
    const list = this.getStaffExpenses();
    const exp = list.find((e) => e.id === expenseId);
    if (!exp) return false;

    exp.status = 'APPROVED';
    exp.approvedBy = adminName;
    exp.approvedAt = new Date().toISOString();
    this.saveStaffExpenses(list);

    supabase.from('staff_expenses').update({
      status: 'APPROVED',
      approved_by: adminName,
      approved_at: exp.approvedAt,
    }).eq('id', expenseId).then(undefined, () => { });

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'EXPENSE',
      entityId: expenseId,
      action: 'APPROVE_EXPENSE',
      newValue: `Approved BDT ${exp.amount}`,
      reason: 'Expense verified with invoice/receipt',
    });

    return true;
  }

  static rejectStaffExpense(
    expenseId: string,
    reason: string,
    adminId: string,
    adminName: string
  ): boolean {
    const list = this.getStaffExpenses();
    const exp = list.find((e) => e.id === expenseId);
    if (!exp) return false;

    exp.status = 'REJECTED';
    exp.rejectionReason = reason;
    this.saveStaffExpenses(list);

    supabase.from('staff_expenses').update({
      status: 'REJECTED',
      rejection_reason: reason,
    }).eq('id', expenseId).then(undefined, () => { });

    // Create reversing ledger adjustment so staff gets their spendable balance back
    this.addLedgerEntry({
      staffId: exp.staffId,
      transactionType: 'ADJUSTMENT',
      amount: exp.amount,
      referenceId: expenseId,
      description: `Reversal for rejected expense: ${reason}`,
      createdBy: adminName,
    });

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'EXPENSE',
      entityId: expenseId,
      action: 'REJECT_EXPENSE',
      newValue: `Rejected BDT ${exp.amount}`,
      reason,
    });

    return true;
  }

  static voidStaffExpense(
    expenseId: string,
    reason: string,
    adminId: string,
    adminName: string
  ): boolean {
    const list = this.getStaffExpenses();
    const exp = list.find((e) => e.id === expenseId);
    if (!exp) return false;

    const prevStatus = exp.status;
    exp.status = 'VOIDED';
    exp.voidReason = reason;
    this.saveStaffExpenses(list);

    supabase.from('staff_expenses').update({
      status: 'VOIDED',
      void_reason: reason,
    }).eq('id', expenseId).then(undefined, () => { });

    // If was approved or submitted, restore balance
    this.addLedgerEntry({
      staffId: exp.staffId,
      transactionType: 'ADJUSTMENT',
      amount: exp.amount,
      referenceId: expenseId,
      description: `Reversal for voided expense: ${reason}`,
      createdBy: adminName,
    });

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'EXPENSE',
      entityId: expenseId,
      action: 'VOID_EXPENSE',
      previousValue: prevStatus,
      newValue: 'VOIDED',
      reason,
    });

    return true;
  }

  /**
   * Record returned unused cash from a staff member
   */
  static recordCashReturned(
    staffId: string,
    staffName: string,
    amount: number,
    adminId: string,
    adminName: string,
    reason: string
  ): FinancialLedgerEntry {
    const entry = this.addLedgerEntry({
      staffId,
      transactionType: 'CASH_RETURN',
      amount: Number(amount),
      referenceId: `RET-${Date.now()}`,
      description: `Cash returned by ${staffName}: ${reason}`,
      createdBy: adminName,
    });

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'BUDGET',
      entityId: entry.id,
      action: 'CASH_RETURN_SETTLEMENT',
      newValue: `Returned BDT ${amount} from ${staffName}`,
      reason,
    });

    return entry;
  }

  /**
   * Super Admin only: Close a staff member's financial account after event
   */
  static closeStaffFinancialAccount(
    staffId: string,
    staffName: string,
    adminId: string,
    adminName: string,
    reason: string
  ): boolean {
    const allocations = this.getStaffAllocations();
    const staffAllocs = allocations.filter((a) => a.staffId === staffId);
    staffAllocs.forEach((a) => {
      a.status = 'CLOSED';
    });
    this.saveStaffAllocations(allocations);

    this.recordAuditHistory({
      adminId,
      adminName,
      entityType: 'STAFF',
      entityId: staffId,
      action: 'CLOSE_FINANCIAL_ACCOUNT',
      newValue: 'CLOSED',
      reason: `Staff ${staffName} financial account closed. Reason: ${reason}`,
    });

    return true;
  }

  // ==========================================
  // 6. ADMIN AUDIT HISTORY (PART 10)
  // ==========================================

  static getAuditHistory(): AdminAuditHistoryItem[] {
    return loadData<AdminAuditHistoryItem[]>(KEY_AUDIT_HISTORY, INITIAL_AUDIT_HISTORY);
  }

  static recordAuditHistory(item: Omit<AdminAuditHistoryItem, 'id' | 'timestamp'>): AdminAuditHistoryItem {
    const history = this.getAuditHistory();
    const newEntry: AdminAuditHistoryItem = {
      ...item,
      id: `HIST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newEntry, ...history].slice(0, 500);
    saveData(KEY_AUDIT_HISTORY, updated);
    supabase.from('admin_audit_history').insert(newEntry).then(undefined, () => { });
    return newEntry;
  }
}
