/**
 * Navigation & Route Management Utility
 * Preserves active views and handles in-place page refreshes across the entire application.
 */

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
] as const;

export type AppView = (typeof VALID_VIEWS)[number];

export interface ResolvedRoute {
  view: AppView;
  tab?: string;
  ticketQuery?: string;
  isPaymentReturn?: boolean;
}

export const STORAGE_KEY_CURRENT_VIEW = 'plscf_current_view';

/**
 * Resolves current route from window.location (pathname, query parameters, hash)
 * and falls back to session storage on refresh.
 */
export function resolveRouteFromLocation(): ResolvedRoute {
  if (typeof window === 'undefined') {
    return { view: 'home' };
  }

  try {
    const rawPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');
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

    // 2. Ticket verification deep-link (?token=... or ?id=...)
    const idParam = searchParams.get('id') || searchParams.get('verify') || searchParams.get('ticket');
    const tokenParam = searchParams.get('token');
    const ticketQuery = tokenParam || idParam;
    if (ticketQuery) {
      return {
        view: 'ticket',
        ticketQuery,
      };
    }

    // 3. Exact pathname match (HTML5 pushState / clean URLs)
    const cleanPath = rawPath.replace(/^\//, '');
    if (cleanPath && (VALID_VIEWS as readonly string[]).includes(cleanPath)) {
      return {
        view: cleanPath as AppView,
        tab: searchParams.get('tab') || undefined,
      };
    }

    // 4. Query param (?admin=true, ?view=scanner, etc.)
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

    // 5. Hash match (#admin, #scanner, etc.)
    const cleanHash = hash.split('?')[0];
    if (cleanHash && (VALID_VIEWS as readonly string[]).includes(cleanHash)) {
      return {
        view: cleanHash as AppView,
      };
    }

    // 6. Session route preservation (restores page on refresh if URL was at root or rewritten)
    const savedRoute = sessionStorage.getItem(STORAGE_KEY_CURRENT_VIEW);
    if (savedRoute && (VALID_VIEWS as readonly string[]).includes(savedRoute)) {
      return {
        view: savedRoute as AppView,
      };
    }
  } catch (err) {
    console.warn('[Navigation] Error resolving route:', err);
  }

  return { view: 'home' };
}

/**
 * Returns formatted URL for target view.
 */
export function getUrlForView(view: string, extraParams?: Record<string, string>): string {
  const basePath = view === 'home' ? '/' : `/${view}`;
  if (extraParams && Object.keys(extraParams).length > 0) {
    const sp = new URLSearchParams(extraParams);
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
