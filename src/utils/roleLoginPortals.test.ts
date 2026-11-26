import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTAL_ROLE_CONFIGS,
  normalizePortalRole,
  getPortalRoleFromSlug,
  getPortalConfigByRole,
  getPortalConfigBySlug,
} from '../types';
import { SupabaseService } from '../services/supabase';
import { EventStore } from '../services/eventStore';
import { getUrlForView } from './navigation';

// ==========================================
// TEST SUITE: ROLE-SPECIFIC LOGIN PORTALS & RBAC
// ==========================================

test('1. Exact Official Portal Titles for All 6 Roles', () => {
  // Requirement 1 & Prompt: Each role must display its official title prominently
  assert.equal(
    PORTAL_ROLE_CONFIGS.super_admin.titleEn,
    'Police Lines School & College Reunion Super Admin Portal'
  );
  assert.equal(
    PORTAL_ROLE_CONFIGS.admin.titleEn,
    'Police Lines School & College Reunion Admin Portal'
  );
  assert.equal(
    PORTAL_ROLE_CONFIGS.moderator.titleEn,
    'Police Lines School & College Reunion Moderator Portal'
  );
  assert.equal(
    PORTAL_ROLE_CONFIGS.finance_manager.titleEn,
    'Police Lines School & College Reunion Finance Portal'
  );
  assert.equal(
    PORTAL_ROLE_CONFIGS.registration_officer.titleEn,
    'Police Lines School & College Reunion Registration Portal'
  );
});

test('2. Role Slug Normalization and URL Resolution', () => {
  // Requirement 3: Each role must have its own login URL and role-specific slug
  assert.equal(getPortalRoleFromSlug('super-admin'), 'super_admin');
  assert.equal(getPortalRoleFromSlug('superadmin'), 'super_admin');
  assert.equal(getPortalRoleFromSlug('admin'), 'admin');
  assert.equal(getPortalRoleFromSlug('moderator'), 'moderator');
  assert.equal(getPortalRoleFromSlug('finance'), 'finance_manager');
  assert.equal(getPortalRoleFromSlug('registration'), 'registration_officer');

  // getUrlForView generates clean, dedicated admin URLs
  assert.equal(getUrlForView('admin', { role: 'super-admin' }), '/admin/super-admin');
  assert.equal(getUrlForView('admin', { role: 'admin' }), '/admin/admin');
  assert.equal(getUrlForView('admin', { role: 'moderator' }), '/admin/moderator');
  assert.equal(getUrlForView('admin', { role: 'finance' }), '/admin/finance');
  assert.equal(getUrlForView('admin', { role: 'registration' }), '/admin/registration');

  assert.equal(getUrlForView('dashboard', { role: 'finance' }), '/dashboard/finance');
  assert.equal(getUrlForView('dashboard', { role: 'super-admin' }), '/dashboard/super-admin');
});

test('3. Synonym Role Normalization across Database and API', () => {
  assert.equal(normalizePortalRole('super_admin'), 'super_admin');
  assert.equal(normalizePortalRole('superadmin'), 'super_admin');
  assert.equal(normalizePortalRole('admin'), 'admin');
  assert.equal(normalizePortalRole('administrator'), 'admin');
  assert.equal(normalizePortalRole('moderator'), 'moderator');
  assert.equal(normalizePortalRole('mod'), 'moderator');
  assert.equal(normalizePortalRole('finance'), 'finance_manager');
  assert.equal(normalizePortalRole('finance_manager'), 'finance_manager');
  assert.equal(normalizePortalRole('finance_team'), 'finance_manager');
  assert.equal(normalizePortalRole('registration'), 'registration_officer');
  assert.equal(normalizePortalRole('registration_officer'), 'registration_officer');
  assert.equal(normalizePortalRole('reg_team'), 'registration_officer');
  assert.equal(normalizePortalRole('unknown_role'), null);
});

test('4. Config Lookup By Role and By Slug', () => {
  const superCfg = getPortalConfigByRole('super_admin');
  assert.equal(superCfg.slug, 'super-admin');
  assert.equal(superCfg.themeColor, 'amber');
  assert.equal(superCfg.iconName, 'Crown');

  const financeCfg = getPortalConfigBySlug('finance');
  assert.ok(financeCfg);
  assert.equal(financeCfg?.role, 'finance_manager');
  assert.equal(financeCfg?.themeColor, 'amber');

  const regCfg = getPortalConfigBySlug('registration');
  assert.ok(regCfg);
  assert.equal(regCfg?.role, 'registration_officer');
  assert.equal(regCfg?.themeColor, 'cyan');
});

test('5. Strict Role Authentication - Allowed vs Unauthorized Mismatch', async () => {
  // Explicitly opt into dev testing mode for this local unit test (fail-closed by default post P0-3)
  const prevFlag = process.env.VITE_ENABLE_TEST_BYPASS;
  const prevUrl = process.env.VITE_SUPABASE_URL;
  process.env.VITE_ENABLE_TEST_BYPASS = 'true';
  process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
  try {
    // 5.1 Correct role login succeeds
    const financeLogin = await SupabaseService.loginAdmin('finance@gmail.com', 'admin@123', 'finance_manager');
    assert.equal(financeLogin.success, true);
    assert.equal(financeLogin.account?.role, 'finance_manager');

    const regLogin = await SupabaseService.loginAdmin('registration@gmail.com', 'admin@123', 'registration_officer');
    assert.equal(regLogin.success, true);
    assert.equal(regLogin.account?.role, 'registration_officer');

    const modLogin = await SupabaseService.loginAdmin('moderator@gmail.com', 'admin@123', 'moderator');
    assert.equal(modLogin.success, true);
    assert.equal(modLogin.account?.role, 'moderator');

    // 5.2 Mismatched role is strictly REJECTED (Requirement 6: prevent accessing another portal)
    const rejectedAttempt1 = await SupabaseService.loginAdmin('finance@gmail.com', 'admin@123', 'super_admin');
    assert.equal(rejectedAttempt1.success, false);
    assert.ok(rejectedAttempt1.error?.includes('Access Denied'));
    assert.ok(rejectedAttempt1.error?.includes('Super Admin Portal'));

    const rejectedAttempt2 = await SupabaseService.loginAdmin('moderator@gmail.com', 'admin@123', 'finance_manager');
    assert.equal(rejectedAttempt2.success, false);
    assert.ok(rejectedAttempt2.error?.includes('Access Denied'));
    assert.ok(rejectedAttempt2.error?.includes('Finance Portal'));

    // 5.3 Super Admin account can access any portal view (global oversight)
    const superOnFinance = await SupabaseService.loginAdmin('admin@gmail.com', 'admin@123', 'finance_manager');
    assert.equal(superOnFinance.success, true);
    assert.equal(superOnFinance.account?.role, 'super_admin');
  } finally {
    if (prevFlag === undefined) delete process.env.VITE_ENABLE_TEST_BYPASS;
    else process.env.VITE_ENABLE_TEST_BYPASS = prevFlag;
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
  }
});

test('6. Role Module Permission Isolation (Allowed Tabs)', () => {
  // Requirement 4: Users must only access the dashboard and permissions assigned to their role
  const financeTabs = PORTAL_ROLE_CONFIGS.finance_manager.allowedTabs;
  assert.ok(financeTabs.includes('budgetManagement'));
  assert.ok(financeTabs.includes('dailyAnalytics'));
  assert.ok(financeTabs.includes('manualApproval'));
  assert.equal(financeTabs.includes('tickets'), false);

  const regTabs = PORTAL_ROLE_CONFIGS.registration_officer.allowedTabs;
  assert.ok(regTabs.includes('manualRegistration'));
  assert.ok(regTabs.includes('idCardManagement'));
  assert.ok(regTabs.includes('allBookings'));
  assert.equal(regTabs.includes('budgetManagement'), false);
  assert.equal(regTabs.includes('dailyAnalytics'), false);

  const modTabs = PORTAL_ROLE_CONFIGS.moderator.allowedTabs;
  assert.ok(modTabs.includes('tickets'));
  assert.ok(modTabs.includes('allBookings'));
  assert.equal(modTabs.includes('manualApproval'), false);
  assert.equal(modTabs.includes('budgetManagement'), false);
});

test('7. Staff Portal Type Filtering Validates Matching vs Mismatched Staff Types and Allows All-Staff Auto-Detect', async () => {
  const prevFlag = process.env.VITE_ENABLE_TEST_BYPASS;
  const prevUrl = process.env.VITE_SUPABASE_URL;
  process.env.VITE_ENABLE_TEST_BYPASS = 'true';
  process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
  try {
    const autoGate = await EventStore.authenticateStaff('gate@gmail.com', 'admin@123', 'ALL');
    assert.equal(autoGate.success, true);
    assert.equal(autoGate.staff?.role, 'GATE_STAFF');

    const exactGate = await EventStore.authenticateStaff('gate@gmail.com', 'admin@123', 'GATE_STAFF');
    assert.equal(exactGate.success, true);
    assert.equal(exactGate.staff?.role, 'GATE_STAFF');

    const wrongType = await EventStore.authenticateStaff('gate@gmail.com', 'admin@123', 'DINNER_STAFF');
    assert.equal(wrongType.success, false);
    assert.ok(wrongType.error?.includes('Role mismatch'));

    const superOverride = await EventStore.authenticateStaff('admin@gmail.com', 'admin@123', 'GATE_STAFF');
    assert.equal(superOverride.success, true);
    assert.equal(superOverride.staff?.role, 'SUPER_ADMIN');
  } finally {
    if (prevFlag === undefined) delete process.env.VITE_ENABLE_TEST_BYPASS;
    else process.env.VITE_ENABLE_TEST_BYPASS = prevFlag;
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
  }
});
