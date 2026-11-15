import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRouteFromLocation,
  getUrlForView,
  syncRouteHistory,
  VALID_VIEWS,
  STORAGE_KEY_CURRENT_VIEW,
} from './navigation';

test('1. Navigation: getUrlForView formats URLs correctly', () => {
  assert.equal(getUrlForView('home'), '/');
  assert.equal(getUrlForView('admin'), '/admin');
  assert.equal(getUrlForView('scanner'), '/scanner');
  assert.equal(getUrlForView('portal'), '/portal');
  assert.equal(getUrlForView('register'), '/register');
  assert.equal(getUrlForView('donate'), '/donate');
  assert.equal(getUrlForView('admin', { tab: 'allBookings' }), '/admin?tab=allBookings');
});

test('2. Navigation: resolveRouteFromLocation resolves from pathname', () => {
  // Mock window and location
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
  } finally {
    globalThis.window = originalWindow;
  }
});

test('3. Navigation: resolveRouteFromLocation falls back to query param and sessionStorage', () => {
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
