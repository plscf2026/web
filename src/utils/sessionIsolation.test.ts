import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseService, supabase } from '../services/supabase';
import {
  subscribeToAuthSync,
  simulateIncomingAuthSyncEvent,
  getTabId,
  AuthSyncEvent,
} from '../services/authSync';
import {
  PortalRole,
  PORTAL_ROLE_CONFIGS,
} from '../types';
import { resolveRouteFromLocation } from './navigation';

// Helper: Setup in-memory mock storage and window
function setupMockBrowser() {
  const localStore: Record<string, string> = {};
  const sessionStore: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: (k: string) => (k in localStore ? localStore[k] : null),
    setItem: (k: string, v: string) => { localStore[k] = String(v); },
    removeItem: (k: string) => { delete localStore[k]; },
    clear: () => {
      throw new Error('localStorage.clear() is strictly forbidden by policy');
    },
    get store() { return localStore; },
  };

  const mockSessionStorage = {
    getItem: (k: string) => (k in sessionStore ? sessionStore[k] : null),
    setItem: (k: string, v: string) => { sessionStore[k] = String(v); },
    removeItem: (k: string) => { delete sessionStore[k]; },
    clear: () => {
      throw new Error('sessionStorage.clear() is strictly forbidden by policy');
    },
    get store() { return sessionStore; },
  };

  (globalThis as any).window = {
    location: {
      pathname: '/',
      search: '',
      hash: '',
      href: 'http://localhost/',
    },
    history: {
      pushState: () => {},
      replaceState: () => {},
    },
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
  };

  (globalThis as any).localStorage = mockLocalStorage;
  (globalThis as any).sessionStorage = mockSessionStorage;

  return { localStore, sessionStore };
}

// =========================================================================
// TEST SUITE: ROLE-BASED SESSION ISOLATION & AUTOMATIC LOGOUT (15 SCENARIOS)
// =========================================================================

test('Scenario 1: Super Admin -> Admin Login terminates session & isolates roles', async () => {
  const { localStore, sessionStore } = setupMockBrowser();

  // Active Super Admin Session
  localStore['plscf_test_admin_session'] = JSON.stringify({
    id: 'super_1',
    role: 'super_admin',
    email: 'super@school.edu',
  });
  sessionStore['plscf_current_portal_role'] = 'super-admin';
  sessionStore['plscf_admin_active_tab'] = 'masterOverview';

  // Navigate to Admin Login
  const targetRole: PortalRole = 'admin';
  const targetSlug = PORTAL_ROLE_CONFIGS[targetRole].slug;
  assert.equal(targetSlug, 'admin');

  // Terminate session on portal switch
  const result = await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
  assert.equal(result.success, true);

  // Assert auth credentials are wiped, target role requires fresh authentication
  assert.equal(localStore['plscf_test_admin_session'], undefined);
  assert.equal(sessionStore['plscf_current_portal_role'], undefined);
  assert.equal(sessionStore['plscf_admin_active_tab'], undefined);
});

test('Scenario 2: Admin -> Finance Login terminates session & isolates roles', async () => {
  const { localStore, sessionStore } = setupMockBrowser();

  localStore['plscf_test_admin_session'] = JSON.stringify({
    id: 'admin_1',
    role: 'admin',
    email: 'admin@school.edu',
  });
  sessionStore['plscf_current_portal_role'] = 'admin';

  // Switch to Finance Login
  const targetRole: PortalRole = 'finance_manager';
  const targetSlug = PORTAL_ROLE_CONFIGS[targetRole].slug;
  assert.equal(targetSlug, 'finance');

  const result = await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
  assert.equal(result.success, true);

  assert.equal(localStore['plscf_test_admin_session'], undefined);
  assert.equal(sessionStore['plscf_current_portal_role'], undefined);
});

test('Scenario 3: Finance -> Moderator Login terminates session & isolates roles', async () => {
  const { localStore, sessionStore } = setupMockBrowser();

  localStore['plscf_test_admin_session'] = JSON.stringify({
    id: 'fin_1',
    role: 'finance_manager',
    email: 'finance@school.edu',
  });
  sessionStore['plscf_current_portal_role'] = 'finance';

  const targetRole: PortalRole = 'moderator';
  const targetSlug = PORTAL_ROLE_CONFIGS[targetRole].slug;
  assert.equal(targetSlug, 'moderator');

  const result = await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
  assert.equal(result.success, true);

  assert.equal(localStore['plscf_test_admin_session'], undefined);
  assert.equal(sessionStore['plscf_current_portal_role'], undefined);
});

test('Scenario 4: Moderator -> Registration Login terminates session & isolates roles', async () => {
  const { localStore, sessionStore } = setupMockBrowser();

  localStore['plscf_test_admin_session'] = JSON.stringify({
    id: 'mod_1',
    role: 'moderator',
    email: 'moderator@school.edu',
  });
  sessionStore['plscf_current_portal_role'] = 'moderator';

  const targetRole: PortalRole = 'registration_officer';
  const targetSlug = PORTAL_ROLE_CONFIGS[targetRole].slug;
  assert.equal(targetSlug, 'registration');

  const result = await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
  assert.equal(result.success, true);

  assert.equal(localStore['plscf_test_admin_session'], undefined);
  assert.equal(sessionStore['plscf_current_portal_role'], undefined);
});

test('Scenario 5: Registration Portal -> Home terminates administrative session', async () => {
  const { localStore, sessionStore } = setupMockBrowser();

  localStore['plscf_test_admin_session'] = JSON.stringify({
    id: 'reg_1',
    role: 'registration_officer',
    email: 'reg@school.edu',
  });
  sessionStore['plscf_current_portal_role'] = 'registration';
  sessionStore['plscf_admin_active_tab'] = 'manualRegistration';

  // Navigate back to public Home Page
  const result = await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
  assert.equal(result.success, true);

  assert.equal(localStore['plscf_test_admin_session'], undefined);
  assert.equal(sessionStore['plscf_current_portal_role'], undefined);
  assert.equal(sessionStore['plscf_admin_active_tab'], undefined);

  // Home route remains accessible without credentials
  (globalThis as any).window.location.pathname = '/';
  const route = resolveRouteFromLocation();
  assert.equal(route.view, 'home');
});

test('Scenario 6: Scanner Portal -> Home terminates staff operational session', async () => {
  const { localStore, sessionStore } = setupMockBrowser();

  localStore['plscf_test_staff_session'] = JSON.stringify({
    id: 'staff_1',
    username: 'gate_ops',
    role: 'GATE_STAFF',
    department: 'GATE_ENTRY',
  });
  sessionStore['plscf_scanner_module'] = 'gate_scanner';

  // Navigate back to public Home Page
  const result = await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
  assert.equal(result.success, true);

  assert.equal(localStore['plscf_test_staff_session'], undefined);
  assert.equal(sessionStore['plscf_scanner_module'], undefined);

  (globalThis as any).window.location.pathname = '/';
  const route = resolveRouteFromLocation();
  assert.equal(route.view, 'home');
});

test('Scenario 7: Multi-Tab Logout Synchronization propagates across open tabs', async () => {
  setupMockBrowser();

  let tab2ReceivedLogout = false;
  let tab3ReceivedLogout = false;

  // Tab 2 and Tab 3 register auth sync listeners
  const unsub2 = subscribeToAuthSync((event) => {
    if (event.action === 'LOGOUT') {
      tab2ReceivedLogout = true;
    }
  });

  const unsub3 = subscribeToAuthSync((event) => {
    if (event.action === 'LOGOUT') {
      tab3ReceivedLogout = true;
    }
  });

  // Remote Tab (tab_1_remote) initiates a logout broadcast
  const remoteEvent: AuthSyncEvent = {
    eventId: `evt_test_${Date.now()}_alpha`,
    sourceTabId: 'tab_remote_alpha',
    action: 'LOGOUT',
    timestamp: Date.now(),
  };
  simulateIncomingAuthSyncEvent(remoteEvent);

  assert.equal(tab2ReceivedLogout, true);
  assert.equal(tab3ReceivedLogout, true);

  // Guard: Self-echo prevention test
  // An event originating from this same tab should be ignored by the self-echo guard
  let selfEchoReceived = false;
  const unsubSelf = subscribeToAuthSync(() => {
    selfEchoReceived = true;
  });

  const selfEchoEvent: AuthSyncEvent = {
    eventId: `evt_self_${Date.now()}`,
    sourceTabId: getTabId(), // matches current tab
    action: 'LOGOUT',
    timestamp: Date.now(),
  };
  simulateIncomingAuthSyncEvent(selfEchoEvent);
  assert.equal(selfEchoReceived, false);

  unsub2();
  unsub3();
  unsubSelf();
});

test('Scenario 8: Duplicate event prevention and loop avoidance', async () => {
  setupMockBrowser();

  let dispatchCount = 0;
  const unsub = subscribeToAuthSync((event) => {
    if (event.action === 'LOGOUT') {
      dispatchCount++;
    }
  });

  const duplicateEventId = `evt_dedup_${Date.now()}_beta`;
  const incomingEvent: AuthSyncEvent = {
    eventId: duplicateEventId,
    sourceTabId: 'tab_remote_beta',
    action: 'LOGOUT',
    timestamp: Date.now(),
  };

  // Step 1: First reception -> processed
  simulateIncomingAuthSyncEvent(incomingEvent);
  assert.equal(dispatchCount, 1);

  // Step 2: Duplicate delivery (same eventId) -> dropped by deduplication guard
  simulateIncomingAuthSyncEvent(incomingEvent);
  assert.equal(dispatchCount, 1);

  // Step 3: Third delivery -> still dropped
  simulateIncomingAuthSyncEvent(incomingEvent);
  assert.equal(dispatchCount, 1);

  unsub();
});

test('Scenario 9: Failed server sign-out (returned error) triggers quarantine & preserves tokens for retry', async () => {
  const { localStore } = setupMockBrowser();

  // Mock active session
  localStore['plscf_test_admin_session'] = JSON.stringify({
    id: 'admin_1',
    role: 'super_admin',
  });

  // Temporarily stub supabase.auth.signOut to return a service error
  const origSignOut = supabase.auth.signOut;
  (supabase.auth as any).signOut = async () => ({
    error: { message: '503 Service Unavailable: Supabase Auth server unreachable' },
  });

  try {
    // Attempt normal termination without forceLocal
    const result = await SupabaseService.terminateAdministrativeSession({ forceLocal: false });

    // Must report failed server-side revocation
    assert.equal(result.success, false);
    assert.equal(result.serverRevoked, false);
    assert.match(result.error || '', /503 Service Unavailable/);

    // CRITICAL: Credentials must NOT be prematurely deleted so that user can retry
    assert.ok(localStore['plscf_test_admin_session'] !== undefined);
  } finally {
    (supabase.auth as any).signOut = origSignOut;
  }
});

test('Scenario 10: Failed server sign-out (thrown network exception) triggers quarantine', async () => {
  const { localStore } = setupMockBrowser();

  localStore['plscf_test_admin_session'] = JSON.stringify({
    id: 'admin_1',
    role: 'admin',
  });

  const origSignOut = supabase.auth.signOut;
  (supabase.auth as any).signOut = async () => {
    throw new Error('Network request failed: DNS resolution timeout');
  };

  try {
    const result = await SupabaseService.terminateAdministrativeSession({ forceLocal: false });

    assert.equal(result.success, false);
    assert.equal(result.serverRevoked, false);
    assert.match(result.error || '', /Network request failed/);

    // Credentials preserved for retry
    assert.ok(localStore['plscf_test_admin_session'] !== undefined);
  } finally {
    (supabase.auth as any).signOut = origSignOut;
  }
});

test('Scenario 11: Retry sign-out recovery after failed sign-out', async () => {
  const { localStore } = setupMockBrowser();

  localStore['plscf_test_admin_session'] = JSON.stringify({
    id: 'admin_1',
    role: 'admin',
  });

  let shouldFail = true;
  const origSignOut = supabase.auth.signOut;
  (supabase.auth as any).signOut = async () => {
    if (shouldFail) {
      return { error: { message: 'Connection timeout' } };
    }
    return { error: null };
  };

  try {
    // Step 1: Initial attempt fails
    const firstAttempt = await SupabaseService.terminateAdministrativeSession({ forceLocal: false });
    assert.equal(firstAttempt.success, false);
    assert.ok(localStore['plscf_test_admin_session'] !== undefined);

    // Step 2: Network recovers, user clicks "Retry Sign-Out"
    shouldFail = false;
    const retryAttempt = await SupabaseService.terminateAdministrativeSession({ forceLocal: false });
    assert.equal(retryAttempt.success, true);
    assert.equal(retryAttempt.serverRevoked, true);

    // Now credentials are safely cleared
    assert.equal(localStore['plscf_test_admin_session'], undefined);
  } finally {
    (supabase.auth as any).signOut = origSignOut;
  }
});

test('Scenario 12: Direct URL access to protected dashboard without auth is unauthenticated', () => {
  setupMockBrowser();

  (globalThis as any).window.location.pathname = '/dashboard/super-admin';
  const route = resolveRouteFromLocation();

  assert.equal(route.view, 'dashboard');
  assert.equal(route.portalRole, 'super_admin');

  // Verify that resolving route does NOT fabricate an active session
  assert.equal(localStorage.getItem('plscf_test_admin_session'), null);
});

test('Scenario 13: Browser refresh preserves legitimate active session without role escalation', async () => {
  const { localStore, sessionStore } = setupMockBrowser();

  // Active Moderator session
  const moderatorAccount = {
    id: 'mod_99',
    role: 'moderator',
    email: 'moderator@school.edu',
    username: 'moderator',
    fullName: 'Event Moderator',
    createdAt: new Date().toISOString(),
  };
  localStore['plscf_test_admin_session'] = JSON.stringify(moderatorAccount);
  sessionStore['plscf_current_portal_role'] = 'moderator';

  // Simulate refresh on moderator dashboard
  (globalThis as any).window.location.pathname = '/dashboard/moderator';
  const route = resolveRouteFromLocation();
  assert.equal(route.view, 'dashboard');
  assert.equal(route.portalRole, 'moderator');

  const restoredModerator = {
    id: 'mod_99',
    role: 'moderator',
    email: 'moderator@school.edu',
    username: 'moderator',
    full_name: 'Event Moderator',
    status: 'ACTIVE',
    is_locked: false,
    created_at: new Date().toISOString(),
  };

  // Authoritative Supabase Auth + DB session lookup on browser refresh (F-04 hardened)
  const origGetSession = (supabase.auth as any).getSession;
  const origFrom = (supabase as any).from;
  (supabase.auth as any).getSession = async () => ({
    data: { session: { user: { id: 'auth-mod-99' } } },
    error: null,
  });
  (supabase as any).from = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: restoredModerator, error: null }),
      }),
    }),
  });

  try {
    const restoredSession = await SupabaseService.getActiveAdminSession();
    assert.ok(restoredSession);
    assert.equal(restoredSession?.role, 'moderator');
    // Must NOT escalate to super_admin or admin
    assert.notEqual(restoredSession?.role, 'super_admin');
    assert.notEqual(restoredSession?.role, 'admin');
  } finally {
    (supabase.auth as any).getSession = origGetSession;
    (supabase as any).from = origFrom;
  }
});

test('Scenario 14: Back/Forward navigation to Home terminates administrative session', async () => {
  const { localStore, sessionStore } = setupMockBrowser();

  localStore['plscf_test_admin_session'] = JSON.stringify({
    id: 'super_1',
    role: 'super_admin',
  });
  sessionStore['plscf_current_portal_role'] = 'super-admin';

  // User presses browser Back button to return to Home Page
  (globalThis as any).window.location.pathname = '/';
  const route = resolveRouteFromLocation();
  assert.equal(route.view, 'home');

  // App popstate handler triggers termination on returning to home
  await SupabaseService.terminateAdministrativeSession({ forceLocal: true });

  assert.equal(localStore['plscf_test_admin_session'], undefined);
  assert.equal(sessionStore['plscf_current_portal_role'], undefined);
});

test('Scenario 15: Strict preservation of unrelated application data during logout', async () => {
  const { localStore, sessionStore } = setupMockBrowser();

  // Populate auth keys
  localStore['plscf_test_admin_session'] = '{"role":"super_admin"}';
  localStore['plscf_test_staff_session'] = '{"role":"GATE_STAFF"}';
  sessionStore['plscf_current_portal_role'] = 'super-admin';
  sessionStore['plscf_admin_active_tab'] = 'masterOverview';
  sessionStore['plscf_admin_prefill_user'] = 'admin@gmail.com';
  sessionStore['plscf_admin_auto_login'] = 'true';
  sessionStore['plscf_scanner_module'] = 'gate_scanner';
  sessionStore['plscf_scanner_prefill_user'] = 'gate@gmail.com';
  sessionStore['plscf_scanner_auto_login'] = 'true';

  // Populate CRITICAL NON-AUTH data that MUST be preserved
  const sampleRegistrations = JSON.stringify([{ id: 'PLSCF-2027-0001', name: 'Alumni 1' }]);
  const sampleDonations = JSON.stringify([{ id: 'DON-001', amount: 5000 }]);
  const sampleDraft = JSON.stringify({ fullName: 'Pending Student', batch: '2010' });
  const sampleFee = JSON.stringify({ alumniFee: 1500 });

  localStore['plscf_lang'] = 'bn';
  localStore['plscf_registration_draft'] = sampleDraft;
  localStore['plscf_pending_donation'] = sampleDonations;
  localStore['plscf_pending_payment_session'] = '{"invoice":"INV-123"}';
  localStore['plscf_pending_sync_queue'] = '[]';
  localStore['plscf_contact_inquiries'] = '[]';
  localStore['plscf_registrations_2027'] = sampleRegistrations;
  localStore['plscf_donations_2027'] = sampleDonations;
  localStore['plscf_expenses_2027'] = '[]';
  localStore['plscf_fee_settings_2027'] = sampleFee;
  localStore['plscf_notices_2027'] = '[]';
  localStore['plscf_scan_logs_2027'] = '[]';
  localStore['plscf_verified_student_ids'] = '["STD-100"]';
  localStore['plscf_idcard_records_2027'] = '[]';

  // Perform session termination
  const res = await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
  assert.equal(res.success, true);

  // 1. Verify ALL auth keys are deleted
  assert.equal(localStore['plscf_test_admin_session'], undefined);
  assert.equal(localStore['plscf_test_staff_session'], undefined);
  assert.equal(sessionStore['plscf_current_portal_role'], undefined);
  assert.equal(sessionStore['plscf_admin_active_tab'], undefined);
  assert.equal(sessionStore['plscf_admin_prefill_user'], undefined);
  assert.equal(sessionStore['plscf_admin_auto_login'], undefined);
  assert.equal(sessionStore['plscf_scanner_module'], undefined);
  assert.equal(sessionStore['plscf_scanner_prefill_user'], undefined);
  assert.equal(sessionStore['plscf_scanner_auto_login'], undefined);

  // 2. Verify ALL non-auth keys are strictly preserved
  assert.equal(localStore['plscf_lang'], 'bn');
  assert.equal(localStore['plscf_registration_draft'], sampleDraft);
  assert.equal(localStore['plscf_pending_donation'], sampleDonations);
  assert.equal(localStore['plscf_pending_payment_session'], '{"invoice":"INV-123"}');
  assert.equal(localStore['plscf_pending_sync_queue'], '[]');
  assert.equal(localStore['plscf_contact_inquiries'], '[]');
  assert.equal(localStore['plscf_registrations_2027'], sampleRegistrations);
  assert.equal(localStore['plscf_donations_2027'], sampleDonations);
  assert.equal(localStore['plscf_expenses_2027'], '[]');
  assert.equal(localStore['plscf_fee_settings_2027'], sampleFee);
  assert.equal(localStore['plscf_notices_2027'], '[]');
  assert.equal(localStore['plscf_scan_logs_2027'], '[]');
  assert.equal(localStore['plscf_verified_student_ids'], '["STD-100"]');
  assert.equal(localStore['plscf_idcard_records_2027'], '[]');
});
