/**
 * Cross-Tab Authentication Synchronization Service
 * Provides reliable multi-tab logout notification using BroadcastChannel with localStorage storage-event fallback.
 * Includes unique tab IDs, unique event IDs, deduplication, and loop-prevention guards.
 */

export interface AuthSyncEvent {
  eventId: string;
  sourceTabId: string;
  action: 'LOGOUT';
  timestamp: number;
}

type AuthSyncListener = (event: AuthSyncEvent) => void;

// Generate a unique identifier for this specific browser tab/window
const TAB_ID =
  typeof window !== 'undefined'
    ? `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    : 'tab_server';

const CHANNEL_NAME = 'plscf_auth_sync';
const STORAGE_EVENT_KEY = 'plscf_auth_sync_event';
const MAX_PROCESSED_EVENTS = 100;

const listeners = new Set<AuthSyncListener>();
const processedEventIds = new Set<string>();

let broadcastChannel: BroadcastChannel | null = null;

function recordProcessed(eventId: string): void {
  processedEventIds.add(eventId);
  if (processedEventIds.size > MAX_PROCESSED_EVENTS) {
    const oldest = Array.from(processedEventIds).slice(0, 50);
    oldest.forEach((id) => processedEventIds.delete(id));
  }
}

function handleIncomingEvent(event: AuthSyncEvent): void {
  // 1. Guard against self-echo: ignore events originating from this tab
  if (!event || event.sourceTabId === TAB_ID) return;

  // 2. Guard against duplicate processing
  if (processedEventIds.has(event.eventId)) return;

  // 3. Mark event as processed
  recordProcessed(event.eventId);

  // 4. Dispatch to all active in-tab listeners (without re-broadcasting)
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.warn('[AuthSync] Listener error:', err);
    }
  });
}

// Initialize channel and storage listeners if running in browser
if (typeof window !== 'undefined') {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      broadcastChannel.onmessage = (msg: MessageEvent<AuthSyncEvent>) => {
        if (msg.data?.action === 'LOGOUT') {
          handleIncomingEvent(msg.data);
        }
      };
    }
  } catch (err) {
    console.warn('[AuthSync] BroadcastChannel initialization failed, falling back to storage events:', err);
  }

  // Storage event fallback for cross-tab notifications
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_EVENT_KEY && e.newValue) {
      try {
        const parsed: AuthSyncEvent = JSON.parse(e.newValue);
        if (parsed?.action === 'LOGOUT') {
          handleIncomingEvent(parsed);
        }
      } catch (_) {}
    }
  });
}

/**
 * Returns the unique ID of the current browser tab
 */
export function getTabId(): string {
  return TAB_ID;
}

/**
 * Broadcasts an authoritative LOGOUT event to all other open tabs.
 * Does NOT trigger listeners in the calling tab.
 */
export function broadcastLogout(): void {
  if (typeof window === 'undefined') return;

  const event: AuthSyncEvent = {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    sourceTabId: TAB_ID,
    action: 'LOGOUT',
    timestamp: Date.now(),
  };

  // Self-record so calling tab ignores any bounce-back
  recordProcessed(event.eventId);

  // 1. Primary: BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(event);
    } catch (err) {
      console.warn('[AuthSync] broadcastChannel.postMessage failed:', err);
    }
  }

  // 2. Fallback: localStorage storage event
  try {
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(event));
    // Clean up key immediately so next event can fire properly
    setTimeout(() => {
      try {
        if (localStorage.getItem(STORAGE_EVENT_KEY) === JSON.stringify(event)) {
          localStorage.removeItem(STORAGE_EVENT_KEY);
        }
      } catch (_) {}
    }, 100);
  } catch (_) {}
}

/**
 * Subscribes a React component or service to cross-tab logout events.
 * Returns an unsubscribe callback for useEffect cleanup.
 */
export function subscribeToAuthSync(listener: AuthSyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Simulates receiving an incoming cross-tab auth event (used for automated testing and simulation).
 */
export function simulateIncomingAuthSyncEvent(event: AuthSyncEvent): void {
  handleIncomingEvent(event);
}
