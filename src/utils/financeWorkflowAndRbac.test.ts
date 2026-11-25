import test from 'node:test';
import assert from 'node:assert/strict';
import { UserManagementService } from '../services/userManagementService';
import { EventStore } from '../services/eventStore';
import { FinancialService } from '../services/financialService';
import {
  calculateStaffFinancialSummary,
  calculateCentralBudgetOverview,
} from './eventRules';
import { AdminAccount, StaffAccount, StaffAllocation, StaffExpense } from '../types';

const financeManagerSession: AdminAccount = {
  id: 'ADM-FIN-MGR-1',
  username: 'fin_mgr_1',
  fullName: 'Finance Manager One',
  email: 'fin_mgr_1@plscf.edu.bd',
  role: 'finance_manager',
  createdAt: new Date().toISOString(),
};

const regularAdminSession: AdminAccount = {
  id: 'ADM-OPS-1',
  username: 'ops_admin',
  fullName: 'Operations Admin',
  email: 'ops@plscf.edu.bd',
  role: 'admin',
  createdAt: new Date().toISOString(),
};

test('1. Only Super Admin can create, modify, deactivate, reset passwords, or revoke sessions', async () => {
  for (const nonSuper of [financeManagerSession, regularAdminSession]) {
    const createRes = await UserManagementService.createSystemUser(
      {
        userType: 'STAFF',
        fullName: 'Unauthorized Staff',
        username: 'unauth_staff',
        email: 'unauth_staff@plscf.edu.bd',
        role: 'FINANCE_STAFF',
        department: 'FINANCE',
        permissions: ['VIEW'],
        initialPassword: 'TempPassword123',
        assignedManagerId: nonSuper.id,
      },
      nonSuper
    );
    assert.equal(createRes.success, false);
    assert.match(createRes.error || '', /ONLY SUPER ADMIN|UNAUTHORIZED/i);

    const statusRes = await UserManagementService.updateUserStatus(
      'STF-FIN-01',
      'STAFF',
      'INACTIVE',
      nonSuper,
      'Unauthorized toggle'
    );
    assert.equal(statusRes.success, false);
    assert.match(statusRes.error || '', /ONLY SUPER ADMIN|UNAUTHORIZED/i);

    const pwRes = await UserManagementService.setUserPassword(
      'staff@plscf.edu.bd',
      'NewSecret123',
      nonSuper
    );
    assert.equal(pwRes.success, false);
    assert.match(pwRes.error || '', /ONLY SUPER ADMIN|UNAUTHORIZED/i);

    const revokeRes = await UserManagementService.revokeUserSessions(
      'STF-FIN-01',
      'STAFF',
      nonSuper,
      'Unauthorized revoke'
    );
    assert.equal(revokeRes.success, false);
    assert.match(revokeRes.error || '', /ONLY SUPER ADMIN|UNAUTHORIZED/i);
  }
});

test('2. Finance Manager Staff Directory strictly isolates staff by assignedManagerId', async () => {
  const staffFixtures: StaffAccount[] = [
    {
      id: 'STF-M1-A',
      authUserId: 'uid-m1-a',
      fullName: 'Staff Assigned to Manager 1',
      username: 'stf_m1_a',
      email: 'stf_m1_a@plscf.edu.bd',
      mobileNumber: '01711111111',
      staffCode: 'REG-FIN-101',
      assignedManagerId: 'ADM-FIN-MGR-1',
      assignedManagerName: 'Finance Manager One',
      role: 'FINANCE_STAFF',
      department: 'FINANCE',
      permissions: ['VIEW', 'SCAN', 'VERIFY'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'STF-M2-B',
      authUserId: 'uid-m2-b',
      fullName: 'Staff Assigned to Manager 2',
      username: 'stf_m2_b',
      email: 'stf_m2_b@plscf.edu.bd',
      mobileNumber: '01822222222',
      staffCode: 'REG-FIN-202',
      assignedManagerId: 'ADM-FIN-MGR-2',
      assignedManagerName: 'Finance Manager Two',
      role: 'FINANCE_STAFF',
      department: 'FINANCE',
      permissions: ['VIEW', 'SCAN', 'VERIFY'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    },
  ];

  const prev = EventStore.getStaffAccounts();
  EventStore.saveStaffAccounts(staffFixtures);
  try {
    const mgr1Staff = await EventStore.fetchAssignedFinanceStaff('ADM-FIN-MGR-1', false);
    assert.equal(mgr1Staff.length, 1);
    assert.equal(mgr1Staff[0].id, 'STF-M1-A');
    assert.equal(mgr1Staff[0].mobileNumber, '01711111111');

    const mgr2Staff = await EventStore.fetchAssignedFinanceStaff('ADM-FIN-MGR-2', false);
    assert.equal(mgr2Staff.length, 1);
    assert.equal(mgr2Staff[0].id, 'STF-M2-B');

    const superAll = await EventStore.fetchAssignedFinanceStaff('ADM-SUPER', true);
    assert.ok(superAll.some((s) => s.id === 'STF-M1-A'));
    assert.ok(superAll.some((s) => s.id === 'STF-M2-B'));
  } finally {
    EventStore.saveStaffAccounts(prev);
  }
});

test('3. Financial data integrity: SUBMITTED/REJECTED/VOIDED staff expenses never count as APPROVED totals', async () => {
  const prevExps = EventStore.getStaffExpenses();
  const allocations: StaffAllocation[] = [
    {
      id: 'ALC-WF-1',
      staffId: 'STF-WF-1',
      staffName: 'Workflow Finance Staff',
      allocatedAmount: 20000,
      academicYear: 2026,
      status: 'ACTIVE',
      allocatedAt: new Date().toISOString(),
      allocatedBy: 'Finance Manager One',
    },
  ];

  const baseDate = new Date().toISOString().split('T')[0];
  const expenses: StaffExpense[] = [
    {
      id: 'EXP-WF-APPROVED',
      staffId: 'STF-WF-1',
      staffName: 'Workflow Finance Staff',
      amount: 4000,
      category: 'Logistics & Transport',
      description: 'Approved transport voucher',
      expenseDate: baseDate,
      expenseTime: '10:00',
      status: 'APPROVED',
      approvedBy: 'Finance Manager One',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'EXP-WF-SUBMITTED',
      staffId: 'STF-WF-1',
      staffName: 'Workflow Finance Staff',
      amount: 3500,
      category: 'Printing, Badges & Souvenirs',
      description: 'Pending banner receipt',
      expenseDate: baseDate,
      expenseTime: '11:00',
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'EXP-WF-REJECTED',
      staffId: 'STF-WF-1',
      staffName: 'Workflow Finance Staff',
      amount: 1500,
      category: 'Miscellaneous Supplies',
      description: 'Rejected unverified slip',
      expenseDate: baseDate,
      expenseTime: '12:00',
      rejectionReason: 'Missing vendor receipt',
      status: 'REJECTED',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'EXP-WF-VOIDED',
      staffId: 'STF-WF-1',
      staffName: 'Workflow Finance Staff',
      amount: 1000,
      category: 'Volunteer Refreshments',
      description: 'Voided duplicate claim',
      expenseDate: baseDate,
      expenseTime: '13:00',
      voidReason: 'Duplicate entry',
      status: 'VOIDED',
      createdAt: new Date().toISOString(),
    },
  ];

  EventStore.saveStaffExpenses(expenses);
  try {
    const staffSummary = calculateStaffFinancialSummary(
      'STF-WF-1',
      'Workflow Finance Staff',
      allocations,
      expenses,
      []
    );
    assert.equal(staffSummary.totalApprovedExpenses, 4000);
    assert.equal(staffSummary.totalSubmittedExpenses, 3500);
    assert.equal(staffSummary.totalRejectedExpenses, 1500);
    assert.equal(staffSummary.totalVoidedExpenses, 1000);

    const central = calculateCentralBudgetOverview(100000, allocations, expenses, []);
    assert.equal(central.totalApprovedExpenses, 4000, 'Approved total excludes SUBMITTED/REJECTED/VOIDED');
    assert.equal(central.totalExpensesRecorded, 7500, 'Submitted (3500) + Approved (4000)');

    // Local transparency summary (used by Main Dashboard financial summary offline/fallback)
    const transparency = await FinancialService.getFinancialTransparencySummary();
    const recentIds = new Set(transparency.recent_expenses.map((e) => e.id));
    assert.equal(recentIds.has('EXP-WF-APPROVED'), true, 'Approved staff expense appears in Main Dashboard summary');
    assert.equal(recentIds.has('EXP-WF-SUBMITTED'), false, 'Submitted expense must NOT appear as approved');
    assert.equal(recentIds.has('EXP-WF-REJECTED'), false, 'Rejected expense must NOT appear as approved');
    assert.equal(recentIds.has('EXP-WF-VOIDED'), false, 'Voided expense must NOT appear as approved');
  } finally {
    EventStore.saveStaffExpenses(prevExps);
  }
});

test('4. Forced password rotation rejects short temporary passwords (< 6 chars)', async () => {
  const shortRes = await UserManagementService.completeForcedPasswordChange('123');
  assert.equal(shortRes.success, false);
  assert.match(shortRes.error || '', /at least 6 characters/i);
});
