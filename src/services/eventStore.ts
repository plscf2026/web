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
import { supabase, isDevTestBypassAllowed, SupabaseService } from './supabase';
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
export const INITIAL_GATE_EVENTS: GateEventRecord[] = [];

// Initial Food Distributions
export const INITIAL_FOOD_DISTRIBUTIONS: FoodDistributionRecord[] = [];

// Initial Dress / Kit Distributions
export const INITIAL_DRESS_DISTRIBUTIONS: DressDistributionRecord[] = [];

// Initial Audit History
export const INITIAL_AUDIT_HISTORY: AdminAuditHistoryItem[] = [];

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
export const INITIAL_STAFF_EXPENSES: StaffExpense[] = [];

// Initial Financial Ledger
export const INITIAL_FINANCIAL_LEDGER: FinancialLedgerEntry[] = [];

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

    try {
      // 1. Authoritative check with getSession (fast local token check)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      let user = session?.user;

      // 2. If token expired or not in memory, fallback to getUser
      if (!user && !sessionError) {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (!authError && userData?.user) {
          user = userData.user;
        }
      }

      if (!user) return null;

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

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'plscf_test_staff_session',
          JSON.stringify({ ...staff, expiresAt: Date.now() + STAFF_SESSION_TTL_MS })
        );
      }

      return staff;
    } catch (err) {
      console.warn('[Supabase] Failed to restore staff session:', err);
      return null;
    }
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

    let emailToAuth = normalized;
    if (!emailToAuth.includes('@') || emailToAuth.startsWith('@')) {
      const cleanUsername = emailToAuth.replace(/^@/, '');
      const { data: userLookup } = await supabase
        .from('staff_accounts')
        .select('email')
        .ilike('username', cleanUsername)
        .maybeSingle();
      if (userLookup?.email) {
        emailToAuth = userLookup.email;
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailToAuth,
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

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'plscf_test_staff_session',
        JSON.stringify({ ...staff, expiresAt: Date.now() + STAFF_SESSION_TTL_MS })
      );
    }

    return { success: true, staff };
  }

  static async logoutStaff(): Promise<void> {
    await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
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

    // 2.1 CRITICAL: Inactive QR Code check for manual registrations pending or rejected
    if (student.registrationApprovalStatus === 'pending') {
      return {
        valid: false,
        status: 'NOT_ELIGIBLE',
        message: 'REGISTRATION_PENDING_APPROVAL: Manual registration is pending Super Admin approval. QR code is inactive. No entry or services permitted.',
      };
    }
    if (student.registrationApprovalStatus === 'rejected') {
      return {
        valid: false,
        status: 'NOT_ELIGIBLE',
        message: 'REGISTRATION_REJECTED: Manual registration was rejected by Super Admin. QR code is inactive. No entry or services permitted.',
      };
    }

    // 3. Department Specific Status Evaluation
    let isCollected = false;
    let collectedAt: string | undefined;
    let details: string | undefined;

    const isStudentInsideVenue = this.isStudentCurrentlyInside(student.id) || Boolean(student.isCheckedIn);

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
      details = isStudentInsideVenue ? 'Currently Inside Venue' : 'Outside Venue';
    }

    const requiresGateCheck = (department === 'BREAKFAST' || department === 'LUNCH' || department === 'DINNER' || department === 'DRESS');
    const isGateSatisfied = !requiresGateCheck || isStudentInsideVenue;

    const canDistribute = student.paymentStatus === 'paid' && !isCollected && isGateSatisfied;

    let evalStatus: 'AUTHORIZED' | 'UNAUTHORIZED_DEPARTMENT' | 'STUDENT_NOT_FOUND' | 'ALREADY_COLLECTED' | 'NOT_ELIGIBLE' = 'AUTHORIZED';
    let evalMessage = 'Eligible for service distribution.';

    if (!isGateSatisfied) {
      evalStatus = 'NOT_ELIGIBLE';
      const gateStatus = this.getStudentGateStatus(student.id);
      if (gateStatus === 'BACK') {
        evalMessage =
          department === 'DRESS'
            ? 'Student has exited the event. T-shirt collection is currently blocked. Please ask the student to enter through the gate first.'
            : 'Student has exited the event. Food collection is not allowed. Please ask the student to enter through the gate first.';
      } else {
        evalMessage = 'Student has not entered the event. Please complete gate entry first.';
      }
    } else if (isCollected) {
      evalStatus = 'ALREADY_COLLECTED';
      evalMessage = `Service already collected at ${collectedAt ? new Date(collectedAt).toLocaleTimeString() : ''}.`;
    }

    return {
      valid: true,
      status: evalStatus,
      message: evalMessage,
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
          details: !isGateSatisfied ? 'Outside Venue - Gate Scan Required' : details,
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

    // Inactive QR Code check for pending/rejected manual registrations
    const studentCheck = AppStore.getRegistrations().find((r) => r.id === registrationId);
    if (studentCheck && studentCheck.registrationApprovalStatus === 'pending') {
      return {
        success: false,
        error: 'REGISTRATION_PENDING_APPROVAL: Registration is awaiting Super Admin approval. QR code is inactive.',
      };
    }
    if (studentCheck && studentCheck.registrationApprovalStatus === 'rejected') {
      return {
        success: false,
        error: 'REGISTRATION_REJECTED: Registration was rejected by Super Admin. Facility access denied.',
      };
    }

    // Gate entry check: Student must have ENTRY status to receive food
    if (studentCheck) {
      const gateStatus = this.getStudentGateStatus(registrationId);
      if (gateStatus !== 'ENTRY') {
        const errorMsg =
          gateStatus === 'BACK'
            ? 'Student has exited the event. Food collection is not allowed. Please ask the student to enter through the gate first.'
            : 'Student has not entered the event. Please complete gate entry first.';
        return {
          success: false,
          error: errorMsg,
        };
      }
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

    // Sync to Supabase with snake_case columns
    supabase.from('food_distributions').insert({
      id: newRecord.id,
      registration_id: newRecord.registrationId,
      student_name: newRecord.studentName,
      batch_name: newRecord.batchName,
      meal_type: newRecord.mealType,
      status: newRecord.status,
      collected_at: newRecord.collectedAt,
      staff_id: newRecord.staffId,
      staff_name: newRecord.staffName,
      notes: newRecord.notes || null,
    }).then(undefined, (err) => {
      console.warn('[EventStore] Supabase food distribution insert notice:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_food_sync', { detail: newRecord }));
    }

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
    }).eq('id', distributionId).then(undefined, (err) => {
      console.warn('[EventStore] Supabase food update notice:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_food_sync', { detail: item }));
    }

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

  static getStudentGateStatus(registrationId: string): 'NOT_ENTERED' | 'ENTRY' | 'BACK' {
    const events = this.getGateEvents().filter(
      (e) =>
        (e.registrationId === registrationId || (e as any).studentId === registrationId) &&
        e.status === 'APPROVED'
    );
    if (events.length > 0) {
      // events are saved newest first
      const latestType = events[0].eventType;
      if (latestType === 'ENTRY') return 'ENTRY';
      if (latestType === 'BACK' || latestType === 'EXIT') return 'BACK';
    }
    const student = AppStore.getRegistrations().find(
      (r) => r.id === registrationId || r.studentId === registrationId
    );
    if (student) {
      if (student.gateStatus === 'BACK') return 'BACK';
      if (student.gateStatus === 'ENTRY' || student.isCheckedIn) return 'ENTRY';
      if (student.gateStatus === 'NOT_ENTERED') return 'NOT_ENTERED';
    }
    return 'NOT_ENTERED';
  }

  static isStudentCurrentlyInside(registrationId: string): boolean {
    return this.getStudentGateStatus(registrationId) === 'ENTRY';
  }

  static recordGateEvent(
    registrationId: string,
    studentName: string,
    batchName: string,
    photoUrl: string | undefined,
    eventType: 'ENTRY' | 'EXIT' | 'BACK',
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

    // Inactive QR Code check for pending/rejected manual registrations
    const studentCheck = AppStore.getRegistrations().find((r) => r.id === registrationId);
    if (studentCheck && studentCheck.registrationApprovalStatus === 'pending') {
      return {
        success: false,
        error: 'REGISTRATION_PENDING_APPROVAL: Registration is awaiting Super Admin approval. QR code is inactive.',
      };
    }
    if (studentCheck && studentCheck.registrationApprovalStatus === 'rejected') {
      return {
        success: false,
        error: 'REGISTRATION_REJECTED: Registration was rejected by Super Admin. Venue entry denied.',
      };
    }

    const inside = this.isStudentCurrentlyInside(registrationId);
    const isEntry = eventType === 'ENTRY';

    if (isEntry && inside) {
      return {
        success: false,
        error: 'DUPLICATE ENTRY ALERT: Student is already marked as INSIDE the venue!',
      };
    }
    if (!isEntry && !inside) {
      return {
        success: false,
        error: 'EXIT MISMATCH ALERT: Student does not have an active entry record!',
      };
    }

    const canonicalEventType: 'ENTRY' | 'BACK' = isEntry ? 'ENTRY' : 'BACK';

    const newEvent: GateEventRecord = {
      id: `GATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      registrationId,
      studentName,
      batchName,
      photoUrl,
      eventType: canonicalEventType,
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

    // Sync to Supabase gate_events table with snake_case columns
    supabase
      .from('gate_events')
      .insert({
        id: newEvent.id,
        registration_id: newEvent.registrationId,
        student_name: newEvent.studentName,
        batch_name: newEvent.batchName,
        photo_url: newEvent.photoUrl || null,
        event_type: newEvent.eventType,
        gate_id: newEvent.gateId,
        scanner_id: newEvent.scannerId || null,
        staff_id: newEvent.staffId,
        staff_name: newEvent.staffName,
        timestamp: newEvent.timestamp,
        status: newEvent.status,
      })
      .then(undefined, (err) => {
        console.warn('[EventStore] Supabase gate event insert notice:', err);
      });

    // Atomically synchronize attendance flag and gate status in Supabase database
    supabase
      .from('registrations_2027')
      .update({
        is_checked_in: isEntry,
        gate_status: canonicalEventType,
      })
      .eq('id', registrationId)
      .then(undefined, (err) => {
        console.warn('[EventStore] Supabase registration gate_status update notice:', err);
      });

    SupabaseService.clearRegistrationCache(2027);

    // Atomically synchronize attendance check-in status on student registration
    AppStore.updateRegistration(
      registrationId,
      { isCheckedIn: isEntry, gateStatus: canonicalEventType },
      2027
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_gate_sync', { detail: newEvent }));
      window.dispatchEvent(new Event('plscf_registration_updated'));
    }

    this.broadcastStationEvent('plscf_gate_sync', {
      regId: registrationId,
      isInside: isEntry,
      gateStatus: canonicalEventType,
      event: newEvent,
    });

    return { success: true, event: newEvent };
  }

  /**
   * Concurrency-safe database-enforced Gate Scan
   * Executes atomic rpc_confirm_gate_event with FOR UPDATE row-locking in PostgreSQL,
   * preventing duplicate entries across multiple turnstiles and scanners.
   * Seamlessly falls back to local cached store if venue internet is temporarily degraded.
   */
  static async confirmGateScanAsync(
    registrationId: string,
    studentName: string,
    batchName: string,
    photoUrl: string | undefined,
    eventType: 'ENTRY' | 'EXIT' | 'BACK',
    gateId: string,
    scannerId: string | undefined,
    staffId: string,
    staffName: string,
    staffUser?: StaffAccount
  ): Promise<{ success: boolean; event?: GateEventRecord; error?: string }> {
    const isEntry = eventType === 'ENTRY';
    const canonicalEventType: 'ENTRY' | 'BACK' = isEntry ? 'ENTRY' : 'BACK';

    try {
      const { data, error } = await supabase.rpc('rpc_confirm_gate_event', {
        p_registration_id: registrationId,
        p_event_type: canonicalEventType,
        p_gate_id: gateId,
        p_staff_id: staffId,
        p_staff_name: staffName,
      });

      if (!error && data?.success) {
        const newEvent: GateEventRecord = {
          id: data.event_id || `GATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          registrationId,
          studentName,
          batchName,
          photoUrl,
          eventType: canonicalEventType,
          gateId,
          scannerId,
          staffId,
          staffName,
          timestamp: new Date().toISOString(),
          status: 'APPROVED',
        };
        const existing = this.getGateEvents();
        this.saveGateEvents([newEvent, ...existing]);
        SupabaseService.clearRegistrationCache(2027);
        AppStore.updateRegistration(
          registrationId,
          { isCheckedIn: isEntry, gateStatus: canonicalEventType },
          2027
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('plscf_gate_sync', { detail: newEvent }));
          window.dispatchEvent(new Event('plscf_registration_updated'));
        }
        this.broadcastStationEvent('plscf_gate_sync', {
          regId: registrationId,
          isInside: isEntry,
          gateStatus: canonicalEventType,
          event: newEvent,
        });
        return { success: true, event: newEvent };
      }

      if (data && !data.success) {
        return { success: false, error: data.message || data.error };
      }
    } catch (e) {
      console.warn('[EventStore] Offline fallback for gate scan:', e);
    }

    return this.recordGateEvent(
      registrationId,
      studentName,
      batchName,
      photoUrl,
      canonicalEventType,
      gateId,
      scannerId,
      staffId,
      staffName,
      staffUser
    );
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

    // If entry is denied or rejected, reset attendance flag so student can be scanned again!
    if (item.eventType === 'ENTRY' && newStatus === 'DENIED') {
      AppStore.updateRegistration(item.registrationId, { isCheckedIn: false }, 2027);
    }

    // Sync to Supabase
    supabase.from('gate_events').update({
      status: newStatus,
      corrected_by: adminName,
      correction_reason: reason,
      corrected_at: item.correctedAt,
    }).eq('id', eventId).then(undefined, (err) => {
      console.warn('[EventStore] Supabase gate update notice:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_gate_sync', { detail: item }));
    }

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

    // Inactive QR Code check for pending/rejected manual registrations
    const studentCheck = AppStore.getRegistrations().find((r) => r.id === registrationId);
    if (studentCheck && studentCheck.registrationApprovalStatus === 'pending') {
      return {
        success: false,
        error: 'REGISTRATION_PENDING_APPROVAL: Registration is awaiting Super Admin approval. QR code is inactive.',
      };
    }
    if (studentCheck && studentCheck.registrationApprovalStatus === 'rejected') {
      return {
        success: false,
        error: 'REGISTRATION_REJECTED: Registration was rejected by Super Admin. Facility access denied.',
      };
    }

    // Gate entry check: Student must have ENTRY status to receive dress kit
    if (studentCheck) {
      const gateStatus = this.getStudentGateStatus(registrationId);
      if (gateStatus !== 'ENTRY') {
        const errorMsg =
          gateStatus === 'BACK'
            ? 'Student has exited the event. T-shirt collection is currently blocked. Please ask the student to enter through the gate first.'
            : 'Student has not entered the event. Please complete gate entry first.';
        return {
          success: false,
          error: errorMsg,
        };
      }
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

    // Sync to Supabase dress_distributions table with snake_case columns
    supabase.from('dress_distributions').insert({
      id: newRecord.id,
      registration_id: newRecord.registrationId,
      student_name: newRecord.studentName,
      item_type: newRecord.itemType,
      registered_size: newRecord.registeredSize,
      status: newRecord.status,
      received_at: newRecord.receivedAt,
      staff_id: newRecord.staffId,
      staff_name: newRecord.staffName,
      notes: newRecord.notes || null,
    }).then(undefined, (err) => {
      console.warn('[EventStore] Supabase dress insert notice:', err);
    });

    // Atomically update student registration in AppStore and registrations_2027
    AppStore.updateRegistration(registrationId, { isTShirtCollected: true }, 2027);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_dress_sync', { detail: newRecord }));
    }

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

    // If marked as RETURNED or CANCELLED, reset isTShirtCollected flag so student can be scanned again!
    const isCollected = newStatus === 'RECEIVED';
    AppStore.updateRegistration(item.registrationId, { isTShirtCollected: isCollected }, 2027);

    // Sync to Supabase
    supabase.from('dress_distributions').update({
      status: newStatus,
      registered_size: item.registeredSize,
      corrected_by: adminName,
      correction_reason: reason,
      corrected_at: item.correctedAt,
    }).eq('id', distributionId).then(undefined, (err) => {
      console.warn('[EventStore] Supabase dress update notice:', err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_dress_sync', { detail: item }));
    }

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

    // Persist to Supabase database with snake_case and camelCase compatibility
    const dbRow = {
      id: newEntry.id,
      admin_id: newEntry.adminId,
      admin_name: newEntry.adminName,
      entity_type: newEntry.entityType,
      entity_id: newEntry.entityId,
      action: newEntry.action,
      previous_value: newEntry.previousValue || null,
      new_value: newEntry.newValue || null,
      reason: newEntry.reason,
      timestamp: newEntry.timestamp,
      adminId: newEntry.adminId,
      adminName: newEntry.adminName,
      entityType: newEntry.entityType,
      entityId: newEntry.entityId,
      previousValue: newEntry.previousValue || null,
      newValue: newEntry.newValue || null,
    };

    supabase
      .from('admin_audit_history')
      .insert(dbRow)
      .then(
        (res) => {
          if (res.error) {
            console.warn('[EventStore] admin_audit_history insert notice:', res.error);
          }
        },
        (err: unknown) => {
          console.warn('[EventStore] admin_audit_history insert error:', err);
        }
      );

    // Also mirror to admin_audit_logs for global system trace
    supabase
      .from('admin_audit_logs')
      .insert({
        id: `AUDIT-${newEntry.id}`,
        admin_id: newEntry.adminId,
        admin_username: newEntry.adminName,
        admin_role: 'admin',
        action: newEntry.action,
        target_type: newEntry.entityType,
        target_id: newEntry.entityId,
        details: `${newEntry.action} on ${newEntry.entityType} (${newEntry.entityId}): ${newEntry.reason}`,
        created_at: newEntry.timestamp,
      })
      .then(undefined, () => {});

    return newEntry;
  }

  /**
   * Authoritatively fetch and synchronize audit trail from Supabase database.
   * Calls rpc_fetch_unified_audit_trail to pull unified events from
   * admin_audit_history, admin_audit_logs, and financial_audit_logs.
   */
  static async syncAuditHistoryWithSupabase(_forceRefresh = false): Promise<AdminAuditHistoryItem[]> {
    try {
      // 1. Authoritative RPC query
      const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_fetch_unified_audit_trail', {
        p_limit: 400,
      });

      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        const unified: AdminAuditHistoryItem[] = rpcData.map((d: any) => ({
          id: d.id,
          adminId: d.adminId || d.admin_id || 'ADMIN',
          adminName: d.adminName || d.admin_name || 'Administrator',
          entityType: (d.entityType || d.entity_type || 'REGISTRATION') as any,
          entityId: d.entityId || d.entity_id || 'ID',
          action: d.action || 'OPERATION',
          previousValue: d.previousValue || d.previous_value || undefined,
          newValue: d.newValue || d.new_value || undefined,
          reason: d.reason || '',
          timestamp: d.timestamp || new Date().toISOString(),
        }));

        // Merge with local uncommitted records if any
        const local = this.getAuditHistory();
        const dbIds = new Set(unified.map((u) => u.id));
        const merged = [...unified];
        for (const loc of local) {
          if (!dbIds.has(loc.id)) {
            merged.push(loc);
            // Backfill to database
            supabase.from('admin_audit_history').insert({
              id: loc.id,
              admin_id: loc.adminId,
              admin_name: loc.adminName,
              entity_type: loc.entityType,
              entity_id: loc.entityId,
              action: loc.action,
              previous_value: loc.previousValue || null,
              new_value: loc.newValue || null,
              reason: loc.reason,
              timestamp: loc.timestamp,
            }).then(undefined, () => {});
          }
        }

        saveData(KEY_AUDIT_HISTORY, merged.slice(0, 500));
        return merged;
      }

      // 2. Direct table fallback if RPC fails
      const { data: rows, error: tblErr } = await supabase
        .from('admin_audit_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(300);

      if (!tblErr && Array.isArray(rows) && rows.length > 0) {
        const mapped: AdminAuditHistoryItem[] = rows.map((r: any) => ({
          id: r.id,
          adminId: r.admin_id || r.adminId || 'ADMIN',
          adminName: r.admin_name || r.adminName || 'Administrator',
          entityType: (r.entity_type || r.entityType || 'REGISTRATION') as any,
          entityId: r.entity_id || r.entityId || 'ID',
          action: r.action || 'OPERATION',
          previousValue: r.previous_value || r.previousValue || undefined,
          newValue: r.new_value || r.newValue || undefined,
          reason: r.reason || '',
          timestamp: r.timestamp || new Date().toISOString(),
        }));

        saveData(KEY_AUDIT_HISTORY, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[EventStore] syncAuditHistoryWithSupabase notice:', err);
    }

    return this.getAuditHistory();
  }

  // ==========================================
  // 7. REAL-TIME MULTI-STATION SYNCHRONIZATION
  // ==========================================

  private static realtimeChannel: any = null;
  private static stationBroadcast: any = null;
  private static registrationSyncTimer: any = null;

  /**
   * Debounced cloud sync to avoid flooding Supabase /rest/v1/registrations_2027 during rapid scans
   */
  private static debouncedRegistrationSync(): void {
    if (this.registrationSyncTimer) {
      clearTimeout(this.registrationSyncTimer);
    }
    this.registrationSyncTimer = setTimeout(() => {
      this.registrationSyncTimer = null;
      SupabaseService.clearRegistrationCache(2027);
      AppStore.syncWithSupabase(2027).catch((err) => {
        console.warn('[EventStore] Debounced registration sync notice:', err);
      });
    }, 400);
  }

  /**
   * Broadcast station events across all tabs/windows in the same browser instantly (<5ms)
   */
  static broadcastStationEvent(eventType: string, payload?: any): void {
    if (typeof window === 'undefined') return;
    try {
      if (!this.stationBroadcast && 'BroadcastChannel' in window) {
        this.stationBroadcast = new (window as any).BroadcastChannel('plscf_realtime_events');
      }
      this.stationBroadcast?.postMessage({ type: eventType, payload, timestamp: Date.now() });
    } catch (_) {}
  }

  /**
   * Authoritative Cloud Distribution Sync
   * Fetches latest food distributions, dress distributions, and gate events from Supabase
   * and merges them into local memory and localStorage.
   */
  static async syncDistributionsWithSupabase(): Promise<void> {
    try {
      const [foodRes, dressRes, gateRes] = await Promise.all([
        supabase.from('food_distributions').select('*').order('collected_at', { ascending: false }).limit(2000),
        supabase.from('dress_distributions').select('*').order('received_at', { ascending: false }).limit(2000),
        supabase.from('gate_events').select('*').order('timestamp', { ascending: false }).limit(2000),
      ]);

      if (foodRes.data && foodRes.data.length > 0) {
        const mappedFood: FoodDistributionRecord[] = foodRes.data.map((r: any) => ({
          id: r.id,
          registrationId: r.registration_id,
          studentName: r.student_name,
          batchName: r.batch_name,
          mealType: r.meal_type,
          status: r.status,
          collectedAt: r.collected_at,
          staffId: r.staff_id,
          staffName: r.staff_name,
          notes: r.notes || undefined,
          correctedBy: r.corrected_by || undefined,
          correctionReason: r.correction_reason || undefined,
          correctedAt: r.corrected_at || undefined,
        }));
        this.saveFoodDistributions(mappedFood);
      }

      if (dressRes.data && dressRes.data.length > 0) {
        const mappedDress: DressDistributionRecord[] = dressRes.data.map((r: any) => ({
          id: r.id,
          registrationId: r.registration_id,
          studentName: r.student_name,
          itemType: r.item_type,
          registeredSize: r.registered_size,
          status: r.status,
          receivedAt: r.received_at,
          staffId: r.staff_id,
          staffName: r.staff_name,
          notes: r.notes || undefined,
          correctedBy: r.corrected_by || undefined,
          correctionReason: r.correction_reason || undefined,
          correctedAt: r.corrected_at || undefined,
        }));
        this.saveDressDistributions(mappedDress);
      }

      if (gateRes.data && gateRes.data.length > 0) {
        const mappedGate: GateEventRecord[] = gateRes.data.map((r: any) => ({
          id: r.id,
          registrationId: r.registration_id,
          studentName: r.student_name,
          batchName: r.batch_name,
          photoUrl: r.photo_url || undefined,
          eventType: r.event_type,
          gateId: r.gate_id,
          scannerId: r.scanner_id || undefined,
          staffId: r.staff_id,
          staffName: r.staff_name,
          timestamp: r.timestamp,
          status: r.status,
          correctedBy: r.corrected_by || undefined,
          correctionReason: r.correction_reason || undefined,
          correctedAt: r.corrected_at || undefined,
        }));
        this.saveGateEvents(mappedGate);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plscf_all_stations_synced'));
      }
    } catch (e) {
      console.warn('[EventStore] syncDistributionsWithSupabase notice:', e);
    }
  }

  /**
   * Initializes Supabase Realtime broadcast listener for all stations
   */
  static initRealtimeSync(): void {
    if (typeof window === 'undefined') return;

    // 1. Cross-tab instant communication via BroadcastChannel
    if (!this.stationBroadcast && 'BroadcastChannel' in window) {
      try {
        this.stationBroadcast = new (window as any).BroadcastChannel('plscf_realtime_events');
        this.stationBroadcast.onmessage = (event: any) => {
          const { type, payload } = event.data || {};
          if (type) {
            window.dispatchEvent(new CustomEvent(type, { detail: payload }));
          }
        };
      } catch (_) {}
    }

    if (this.realtimeChannel) return;
    try {
      this.realtimeChannel = supabase
        .channel('plscf_realtime_stations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'food_distributions' }, () => {
          this.syncDistributionsWithSupabase();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('plscf_food_sync'));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dress_distributions' }, () => {
          this.syncDistributionsWithSupabase();
          this.debouncedRegistrationSync();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('plscf_dress_sync'));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gate_events' }, () => {
          this.syncDistributionsWithSupabase();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('plscf_gate_sync'));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations_2027' }, () => {
          this.debouncedRegistrationSync();
        })
        .subscribe();
    } catch (err) {
      console.warn('[EventStore] Realtime channel subscription notice:', err);
    }
  }
}
