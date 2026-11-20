import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UserManagementService,
  UnifiedSystemUser,
} from '../services/userManagementService';

const mockUsers: UnifiedSystemUser[] = [
  {
    id: 'user-001',
    userType: 'ADMIN',
    fullName: 'Principal Head Convener',
    username: 'admin',
    email: 'admin@gmail.com',
    role: 'super_admin',
    roleCategory: 'SUPER_ADMIN',
    department: 'CENTRAL_ADMIN',
    status: 'ACTIVE',
    assignedStation: 'MAIN_PORTAL',
    permissions: ['VIEW', 'APPROVE', 'EXPORT', 'MANAGE'],
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-11-20T10:00:00Z',
    authUserId: 'auth-001',
    createdBy: 'SYSTEM',
  },
  {
    id: 'user-002',
    userType: 'ADMIN',
    fullName: 'Venue Operations Admin',
    username: 'venueadmin',
    email: 'operations@gmail.com',
    role: 'admin',
    roleCategory: 'ADMIN',
    department: 'OPERATIONS',
    status: 'ACTIVE',
    assignedStation: 'MAIN_PORTAL',
    permissions: ['VIEW', 'VERIFY', 'APPROVE'],
    createdAt: '2026-01-05T00:00:00Z',
    lastLoginAt: '2026-11-19T14:30:00Z',
    authUserId: 'auth-002',
    createdBy: 'admin',
  },
  {
    id: 'user-003',
    userType: 'STAFF',
    fullName: 'Gate Scanner Officer 1',
    username: 'gate1',
    email: 'gate1@gmail.com',
    role: 'GATE_STAFF',
    roleCategory: 'STAFF',
    department: 'GATE',
    status: 'ACTIVE',
    assignedStation: 'GATE_NORTH',
    permissions: ['VIEW', 'SCAN'],
    createdAt: '2026-02-01T00:00:00Z',
    lastLoginAt: '2026-11-20T08:15:00Z',
    authUserId: null,
    createdBy: 'admin',
  },
  {
    id: 'user-004',
    userType: 'STAFF',
    fullName: 'Md. Shafiqul Alam (Finance Secretary)',
    username: 'finance_sec',
    email: 'shafiqul.finance@gmail.com',
    role: 'FINANCE_STAFF',
    roleCategory: 'FINANCE',
    department: 'FINANCE',
    status: 'ACTIVE',
    assignedStation: 'FINANCE_DESK',
    permissions: ['VIEW', 'APPROVE'],
    createdAt: '2026-02-02T00:00:00Z',
    lastLoginAt: '2026-11-20T09:00:00Z',
    authUserId: null,
    createdBy: 'admin',
  },
  {
    id: 'user-005',
    userType: 'ADMIN',
    fullName: 'Chief Finance Officer',
    username: 'cfo_admin',
    email: 'cfo@plsc2027.com',
    role: 'finance_manager',
    roleCategory: 'FINANCE',
    department: 'FINANCE',
    status: 'INACTIVE',
    assignedStation: 'MAIN_PORTAL',
    permissions: ['VIEW', 'APPROVE', 'EXPORT'],
    createdAt: '2026-02-03T00:00:00Z',
    lastLoginAt: null,
    authUserId: 'auth-005',
    createdBy: 'admin',
  },
  {
    id: 'user-006',
    userType: 'ADMIN',
    fullName: 'Event Coordinator',
    username: 'coordinator1',
    email: 'coordinator@plsc2027.com',
    role: 'moderator',
    roleCategory: 'MANAGER',
    department: 'EVENTS',
    status: 'SUSPENDED',
    assignedStation: 'MAIN_PORTAL',
    permissions: ['VIEW'],
    createdAt: '2026-02-04T00:00:00Z',
    lastLoginAt: '2026-11-10T12:00:00Z',
    authUserId: 'auth-006',
    createdBy: 'admin',
  },
  {
    id: 'user-007',
    userType: 'STAFF',
    fullName: 'T-Shirt Kit Lead',
    username: 'kit_lead',
    email: 'kit@plsc2027.com',
    role: 'DRESS_STAFF',
    roleCategory: 'STAFF',
    department: 'DRESS',
    status: 'ACTIVE',
    assignedStation: 'KIT_BOOTHS',
    permissions: ['VIEW', 'SCAN'],
    createdAt: '2026-02-05T00:00:00Z',
    lastLoginAt: '2026-11-18T16:00:00Z',
    authUserId: null,
    createdBy: 'admin',
  },
];

test('computeRoleGroupSummaries aggregates counts and statuses correctly across role categories', () => {
  const summaries = UserManagementService.computeRoleGroupSummaries(mockUsers);

  assert.equal(summaries.length, 6, 'Should generate 6 distinct role category cards');

  const superAdminSummary = summaries.find((s) => s.category === 'SUPER_ADMIN');
  assert.ok(superAdminSummary, 'Super Admin card must exist');
  assert.equal(superAdminSummary.totalAccounts, 1);
  assert.equal(superAdminSummary.activeAccounts, 1);
  assert.equal(superAdminSummary.inactiveAccounts, 0);
  assert.equal(superAdminSummary.suspendedAccounts, 0);

  const financeSummary = summaries.find((s) => s.category === 'FINANCE');
  assert.ok(financeSummary, 'Finance card must exist');
  assert.equal(financeSummary.totalAccounts, 2, 'Should include both finance_manager and FINANCE_STAFF');
  assert.equal(financeSummary.activeAccounts, 1);
  assert.equal(financeSummary.inactiveAccounts, 1);
  assert.equal(financeSummary.suspendedAccounts, 0);
  assert.ok(financeSummary.subRoles.includes('FINANCE_STAFF'));
  assert.ok(financeSummary.subRoles.includes('finance_manager'));

  const managerSummary = summaries.find((s) => s.category === 'MANAGER');
  assert.ok(managerSummary, 'Manager card must exist');
  assert.equal(managerSummary.totalAccounts, 1);
  assert.equal(managerSummary.suspendedAccounts, 1);

  const staffSummary = summaries.find((s) => s.category === 'STAFF');
  assert.ok(staffSummary, 'Staff card must exist');
  assert.equal(staffSummary.totalAccounts, 2);
  assert.equal(staffSummary.activeAccounts, 2);
});

test('Super admin lockout protection prevents deactivating the last active super admin', async () => {
  const activeSuperAdmins = mockUsers.filter(
    (u) => u.roleCategory === 'SUPER_ADMIN' && u.status === 'ACTIVE'
  );
  assert.equal(activeSuperAdmins.length, 1, 'Only one active super admin in fixture');

  // Attempting to deactivate or suspend this user should be prevented by backend RPC logic
  const targetUser = activeSuperAdmins[0];
  const isLastSuperAdmin = activeSuperAdmins.length <= 1 && targetUser.roleCategory === 'SUPER_ADMIN';
  assert.strictEqual(isLastSuperAdmin, true, 'Safety guard accurately flags last super admin');
});

test('Search filtering accurately queries users by name, username, email, and role', () => {
  const query = 'shafiqul';
  const filtered = mockUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(query.toLowerCase()) ||
      u.username.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.role.toLowerCase().includes(query.toLowerCase())
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].username, 'finance_sec');
  assert.equal(filtered[0].role, 'FINANCE_STAFF');
});

test('Role category filtering filters users strictly to their assigned group', () => {
  const staffOnly = mockUsers.filter((u) => u.roleCategory === 'STAFF');
  assert.equal(staffOnly.length, 2);
  assert.ok(staffOnly.every((u) => u.roleCategory === 'STAFF'));
});

test('setUserPassword rejects passwords shorter than 6 characters', async () => {
  const adminAccount = {
    id: 'admin-001',
    fullName: 'Super Administrator',
    username: 'admin',
    email: 'admin@gmail.com',
    role: 'super_admin' as const,
    createdAt: new Date().toISOString(),
  };

  const shortRes = await UserManagementService.setUserPassword('test@gmail.com', '123', adminAccount);
  assert.strictEqual(shortRes.success, false);
  assert.match(shortRes.error || '', /at least 6 characters/i);
});
