/**
 * Navigation & Route Management Utility
 * Preserves active views, handles nested routes, and provides reliable in-place page refreshes across the entire application.
 */

import { PortalRole, getPortalRoleFromSlug } from '../types';

export const VALID_VIEWS = [
  'home',
  'register',
  'donate',
  'find-ticket',
  'ticket',
  'notices',
  'gallery',
  'about',
  'scanner',
  'admin',
  'portal',
  'login',
  'dashboard',
  'profile',
  '404',
] as const;

export type AppView = (typeof VALID_VIEWS)[number];

export interface ResolvedRoute {
  view: AppView;
  portalRole?: PortalRole;
  tab?: string;
  ticketQuery?: string;
  isPaymentReturn?: boolean;
  notFoundPath?: string;
}

export const STORAGE_KEY_CURRENT_VIEW = 'plscf_current_view';

/**
 * Route aliases mapping common friendly paths to existing application views
 */
export const ROUTE_ALIASES: Record<string, AppView> = {
  'contact': 'about',
  'registration': 'register',
  'donation': 'donate',
  'lookup': 'find-ticket',
  'login': 'login',
  'dashboard': 'dashboard',
  'profile': 'profile',
};

/**
 * Resolves current route from window.location (pathname, nested path, query parameters, hash)
 * and falls back to session storage on refresh. Invalid routes return a 404 view.
 */
export function resolveRouteFromLocation(): ResolvedRoute {
  if (typeof window === 'undefined') {
    return { view: 'home' };
  }

  try {
    const rawPath = window.location.pathname.replace(/\/+$/, '');
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();

    // 1. PayStation Payment Return takes top priority
    const isPaymentReturn =
      searchParams.get('payment_return') === '1' ||
      searchParams.has('invoice_number') ||
      searchParams.has('trx_status') ||
      searchParams.has('status');

    if (isPaymentReturn) {
      const payType = searchParams.get('type');
      return {
        view: payType === 'donation' ? 'donate' : 'register',
        isPaymentReturn: true,
      };
    }

    // 2. Ticket verification deep-link via query parameter (?token=... or ?id=...)
    const idParam = searchParams.get('id') || searchParams.get('verify') || searchParams.get('ticket');
    const tokenParam = searchParams.get('token');
    const ticketQuery = tokenParam || idParam;
    if (ticketQuery) {
      return {
        view: 'ticket',
        ticketQuery: ticketQuery.trim().toUpperCase(),
      };
    }

    // 3. Root URL access
    if (!rawPath || rawPath === '' || rawPath === '/') {
      // Check query param fallbacks (?admin=true, ?view=scanner, etc.)
      const viewParam = searchParams.get('view')?.toLowerCase();
      if (viewParam && (VALID_VIEWS as readonly string[]).includes(viewParam)) {
        return {
          view: viewParam as AppView,
          tab: searchParams.get('tab') || undefined,
        };
      }

      for (const v of VALID_VIEWS) {
        if (searchParams.get(v) === 'true') {
          return {
            view: v,
            tab: searchParams.get('tab') || undefined,
          };
        }
      }

      // Hash match (#admin, #scanner, etc.)
      const cleanHash = hash.split('?')[0];
      if (cleanHash && (VALID_VIEWS as readonly string[]).includes(cleanHash)) {
        return {
          view: cleanHash as AppView,
        };
      }

      // Session route preservation on root URL reload
      const savedRoute = sessionStorage.getItem(STORAGE_KEY_CURRENT_VIEW);
      if (savedRoute && savedRoute !== '404' && (VALID_VIEWS as readonly string[]).includes(savedRoute)) {
        return {
          view: savedRoute as AppView,
        };
      }

      return { view: 'home' };
    }

    // 4. Nested pathname resolution (e.g. /ticket/PLSCF-2027-F1001, /admin/reports, /scanner/food)
    const cleanPath = rawPath.replace(/^\//, '');
    const segments = cleanPath.split('/').filter(Boolean);
    const primarySegment = segments[0]?.toLowerCase() || '';
    const subSegment = segments[1] || '';
    const cleanPathLower = cleanPath.toLowerCase();

    // Nested login role route: /login/:role (e.g. /login/super-admin, /login/finance)
    if (primarySegment === 'login') {
      const parsedRole = subSegment ? getPortalRoleFromSlug(subSegment) : null;
      return {
        view: 'login',
        portalRole: parsedRole || undefined,
        tab: searchParams.get('tab') || undefined,
      };
    }

    // Nested dashboard role route: /dashboard/:role (e.g. /dashboard/super-admin, /dashboard/finance)
    if (primarySegment === 'dashboard') {
      const parsedRole = subSegment ? getPortalRoleFromSlug(subSegment) : null;
      return {
        view: 'dashboard',
        portalRole: parsedRole || undefined,
        tab: segments[2] || searchParams.get('tab') || undefined,
      };
    }

    // Direct role portals shortcuts
    if (primarySegment === 'super-admin') {
      return {
        view: 'dashboard',
        portalRole: 'super_admin',
        tab: subSegment || searchParams.get('tab') || undefined,
      };
    }
    if (primarySegment === 'finance') {
      return {
        view: 'dashboard',
        portalRole: 'finance_manager',
        tab: subSegment || searchParams.get('tab') || undefined,
      };
    }
    if (primarySegment === 'moderator') {
      return {
        view: 'dashboard',
        portalRole: 'moderator',
        tab: subSegment || searchParams.get('tab') || undefined,
      };
    }

    // Dynamic ticket route: /ticket/:idOrToken
    if (primarySegment === 'ticket') {
      const dynamicId = subSegment || searchParams.get('id') || undefined;
      return {
        view: 'ticket',
        ticketQuery: dynamicId ? dynamicId.trim().toUpperCase() : undefined,
      };
    }

    // Nested admin route: /admin/:tab
    if (primarySegment === 'admin') {
      return {
        view: 'admin',
        tab: subSegment || searchParams.get('tab') || undefined,
      };
    }

    // Nested scanner route: /scanner/:module
    if (primarySegment === 'scanner') {
      return {
        view: 'scanner',
        tab: subSegment || searchParams.get('tab') || undefined,
      };
    }

    // Nested portal route: /portal/:tab
    if (primarySegment === 'portal') {
      return {
        view: 'portal',
        tab: subSegment || searchParams.get('tab') || undefined,
      };
    }

    // Direct match against valid views
    if ((VALID_VIEWS as readonly string[]).includes(cleanPathLower)) {
      return {
        view: cleanPathLower as AppView,
        tab: searchParams.get('tab') || undefined,
      };
    }

    // Route alias match (e.g. /contact -> about, /registration -> register)
    if (ROUTE_ALIASES[cleanPathLower]) {
      return {
        view: ROUTE_ALIASES[cleanPathLower],
        tab: searchParams.get('tab') || undefined,
      };
    }

    if (ROUTE_ALIASES[primarySegment]) {
      return {
        view: ROUTE_ALIASES[primarySegment],
        tab: subSegment || searchParams.get('tab') || undefined,
      };
    }

    // 5. Query param override if present on non-matching path
    const viewParam = searchParams.get('view')?.toLowerCase();
    if (viewParam && (VALID_VIEWS as readonly string[]).includes(viewParam)) {
      return {
        view: viewParam as AppView,
        tab: searchParams.get('tab') || undefined,
      };
    }

    // 6. Session route fallback (only if URL was rewritten to root or ambiguous)
    const savedRoute = sessionStorage.getItem(STORAGE_KEY_CURRENT_VIEW);
    if (savedRoute && savedRoute !== '404' && (VALID_VIEWS as readonly string[]).includes(savedRoute) && rawPath === '/') {
      return {
        view: savedRoute as AppView,
      };
    }

    // 7. Route does not exist: return 404 view while preserving requested URL
    return {
      view: '404',
      notFoundPath: window.location.pathname,
    };
  } catch (err) {
    console.warn('[Navigation] Error resolving route:', err);
  }

  return { view: 'home' };
}

/**
 * Returns formatted URL for target view.
 */
export function getUrlForView(view: string, extraParams?: Record<string, string>): string {
  if (view === '404') {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      return window.location.pathname + window.location.search;
    }
    return '/404';
  }

  let basePath = view === 'home' ? '/' : `/${view}`;
  const queryParams: Record<string, string> = { ...(extraParams || {}) };

  // Format dedicated role login and dashboard URLs cleanly (e.g. /login/super-admin, /dashboard/finance)
  if ((view === 'login' || view === 'dashboard') && queryParams.role) {
    const roleSlug = queryParams.role.replace(/_/g, '-');
    delete queryParams.role;
    basePath = `/${view}/${roleSlug}`;
  }

  if (Object.keys(queryParams).length > 0) {
    const sp = new URLSearchParams(queryParams);
    return `${basePath}?${sp.toString()}`;
  }
  return basePath;
}

/**
 * Updates browser history and persistent session route.
 */
export function syncRouteHistory(view: string, replace = false, extraParams?: Record<string, string>): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(STORAGE_KEY_CURRENT_VIEW, view);

    // If currently rendering 404, preserve the original invalid pathname so user sees what failed
    if (view === '404') return;

    const targetUrl = getUrlForView(view, extraParams);
    const currentUrl = window.location.pathname + window.location.search;

    if (currentUrl !== targetUrl && !window.location.search.includes('payment_return')) {
      if (replace) {
        window.history.replaceState({ view }, '', targetUrl);
      } else {
        window.history.pushState({ view }, '', targetUrl);
      }
    }
  } catch (err) {
    console.warn('[Navigation] History update failed:', err);
  }
}
