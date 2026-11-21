import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRouteFromLocation,
  getUrlForView,
  syncRouteHistory,
  VALID_VIEWS,
  ROUTE_ALIASES,
  STORAGE_KEY_CURRENT_VIEW,
} from './navigation';

test('1. Navigation: getUrlForView formats URLs correctly', () => {
  assert.equal(getUrlForView('home'), '/');
  assert.equal(getUrlForView('admin'), '/admin');
  assert.equal(getUrlForView('scanner'), '/scanner');
  assert.equal(getUrlForView('portal'), '/portal');
  assert.equal(getUrlForView('register'), '/register');
  assert.equal(getUrlForView('donate'), '/donate');
  assert.equal(getUrlForView('dashboard'), '/dashboard');
  assert.equal(getUrlForView('profile'), '/profile');
  assert.equal(getUrlForView('admin', { tab: 'allBookings' }), '/admin?tab=allBookings');
  assert.equal(getUrlForView('admin', { role: 'super-admin' }), '/admin/super-admin');
});

test('2. Navigation: resolveRouteFromLocation resolves from standard pathnames', () => {
  const originalWindow = globalThis.window;
  const mockStorage: Record<string, string> = {};

  (globalThis as any).window = {
    location: {
      pathname: '/admin',
      search: '',
      hash: '',
    },
    history: {
      pushState: () => {},
      replaceState: () => {},
    },
  };
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
  };

  try {
    const routeAdmin = resolveRouteFromLocation();
    assert.equal(routeAdmin.view, 'admin');

    (globalThis as any).window.location.pathname = '/scanner';
    assert.equal(resolveRouteFromLocation().view, 'scanner');

    (globalThis as any).window.location.pathname = '/portal';
    assert.equal(resolveRouteFromLocation().view, 'portal');

    (globalThis as any).window.location.pathname = '/register';
    assert.equal(resolveRouteFromLocation().view, 'register');

    (globalThis as any).window.location.pathname = '/donate';
    assert.equal(resolveRouteFromLocation().view, 'donate');

    (globalThis as any).window.location.pathname = '/notices';
    assert.equal(resolveRouteFromLocation().view, 'notices');

    (globalThis as any).window.location.pathname = '/gallery';
    assert.equal(resolveRouteFromLocation().view, 'gallery');

    (globalThis as any).window.location.pathname = '/about';
    assert.equal(resolveRouteFromLocation().view, 'about');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('3. Navigation: resolveRouteFromLocation handles route aliases (dashboard, profile, contact) and deleted login route returns 404', () => {
  const originalWindow = globalThis.window;
  const mockStorage: Record<string, string> = {};

  (globalThis as any).window = {
    location: {
      pathname: '/login',
      search: '',
      hash: '',
    },
    history: {
      pushState: () => {},
      replaceState: () => {},
    },
  };
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
  };

  try {
    // /login has been deleted and must return 404
    assert.equal(resolveRouteFromLocation().view, '404');
    assert.equal(resolveRouteFromLocation().notFoundPath, '/login');

    (globalThis as any).window.location.pathname = '/login/super-admin';
    assert.equal(resolveRouteFromLocation().view, '404');

    (globalThis as any).window.location.pathname = '/dashboard';
    assert.equal(resolveRouteFromLocation().view, 'dashboard');

    (globalThis as any).window.location.pathname = '/profile';
    assert.equal(resolveRouteFromLocation().view, 'profile');

    (globalThis as any).window.location.pathname = '/contact';
    assert.equal(resolveRouteFromLocation().view, 'about');

    assert.equal(ROUTE_ALIASES['registration'], 'register');
    assert.equal(ROUTE_ALIASES['donation'], 'donate');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('4. Navigation: resolveRouteFromLocation resolves nested routes & dynamic parameters', () => {
  const originalWindow = globalThis.window;
  const mockStorage: Record<string, string> = {};

  (globalThis as any).window = {
    location: {
      pathname: '/admin/reports',
      search: '',
      hash: '',
    },
    history: {
      pushState: () => {},
      replaceState: () => {},
    },
  };
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
  };

  try {
    // Nested admin route
    const adminReports = resolveRouteFromLocation();
    assert.equal(adminReports.view, 'admin');
    assert.equal(adminReports.tab, 'reports');

    // Nested scanner route
    (globalThis as any).window.location.pathname = '/scanner/food';
    const scannerFood = resolveRouteFromLocation();
    assert.equal(scannerFood.view, 'scanner');
    assert.equal(scannerFood.tab, 'food');

    // Nested portal route
    (globalThis as any).window.location.pathname = '/portal/tasks';
    const portalTasks = resolveRouteFromLocation();
    assert.equal(portalTasks.view, 'portal');
    assert.equal(portalTasks.tab, 'tasks');

    // Dynamic ticket route
    (globalThis as any).window.location.pathname = '/ticket/PLSCF-2027-F1001';
    const dynamicTicket = resolveRouteFromLocation();
    assert.equal(dynamicTicket.view, 'ticket');
    assert.equal(dynamicTicket.ticketQuery, 'PLSCF-2027-F1001');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('5. Navigation: Invalid routes correctly return 404 instead of silent home redirect', () => {
  const originalWindow = globalThis.window;
  const mockStorage: Record<string, string> = {};

  (globalThis as any).window = {
    location: {
      pathname: '/random-non-existent-page',
      search: '',
      hash: '',
    },
    history: {
      pushState: () => {},
      replaceState: () => {},
    },
  };
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
  };

  try {
    const notFoundRes = resolveRouteFromLocation();
    assert.equal(notFoundRes.view, '404');
    assert.equal(notFoundRes.notFoundPath, '/random-non-existent-page');

    (globalThis as any).window.location.pathname = '/foo/bar/baz';
    const deepNotFound = resolveRouteFromLocation();
    assert.equal(deepNotFound.view, '404');
    assert.equal(deepNotFound.notFoundPath, '/foo/bar/baz');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('6. Navigation: resolveRouteFromLocation falls back to query param and sessionStorage', () => {
  const originalWindow = globalThis.window;
  const mockStorage: Record<string, string> = {};

  (globalThis as any).window = {
    location: {
      pathname: '/',
      search: '?admin=true',
      hash: '',
    },
    history: {
      pushState: () => {},
      replaceState: () => {},
    },
  };
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
  };

  try {
    // Query param ?admin=true
    assert.equal(resolveRouteFromLocation().view, 'admin');

    // Query param ?view=scanner
    (globalThis as any).window.location.search = '?view=scanner';
    assert.equal(resolveRouteFromLocation().view, 'scanner');

    // Root URL with session fallback
    (globalThis as any).window.location.pathname = '/';
    (globalThis as any).window.location.search = '';
    mockStorage[STORAGE_KEY_CURRENT_VIEW] = 'portal';
    assert.equal(resolveRouteFromLocation().view, 'portal');

    // Test VALID_VIEWS
    assert.ok(VALID_VIEWS.includes('admin'));
    assert.ok(VALID_VIEWS.includes('scanner'));
    assert.ok(VALID_VIEWS.includes('home'));
    assert.equal((VALID_VIEWS as readonly string[]).includes('login'), false);
    assert.ok(VALID_VIEWS.includes('dashboard'));
    assert.ok(VALID_VIEWS.includes('profile'));
    assert.ok(VALID_VIEWS.includes('404'));

    // Test syncRouteHistory
    let pushedUrl = '';
    (globalThis as any).window.history.pushState = (_: any, __: any, url: string) => { pushedUrl = url; };
    syncRouteHistory('admin', false, { tab: 'settings' });
    assert.equal(pushedUrl, '/admin?tab=settings');
    assert.equal(mockStorage[STORAGE_KEY_CURRENT_VIEW], 'admin');
  } finally {
    globalThis.window = originalWindow;
  }
});
