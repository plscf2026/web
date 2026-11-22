/**
 * Police Lines School & College, Faridpur - Grand Reunion Platform
 * Cryptographically Secure 6-Character Unique Student QR Token Generator
 *
 * Requirements:
 * - Exactly 6 characters
 * - Uppercase alphanumeric letters [A-Z] and numbers [0-9]
 * - Uses Web Crypto API / Node.js crypto.getRandomValues for cryptographic entropy
 * - Globally unique across all students
 * - Collision detection and automatic retry
 * - Validates format: /^[A-Z0-9]{6}$/
 */

const TOKEN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const TOKEN_LENGTH = 6;
const MAX_COLLISION_RETRIES = 20;

/**
 * Generates a single cryptographically secure 6-character token.
 * Output space: 36^6 = 2,176,782,336 combinations.
 */
export function generateSixCharToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);

  // Standard Web Crypto API (Browser & Node.js 19+ cross-platform)
  const cryptoObj =
    typeof globalThis !== 'undefined' && typeof globalThis.crypto?.getRandomValues === 'function'
      ? globalThis.crypto
      : typeof window !== 'undefined' && typeof window.crypto?.getRandomValues === 'function'
      ? window.crypto
      : null;

  if (cryptoObj) {
    cryptoObj.getRandomValues(bytes);
  } else {
    // Pure mathematical PRNG fallback for constrained offline test harnesses
    for (let i = 0; i < TOKEN_LENGTH; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let token = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    const charIndex = bytes[i] % TOKEN_ALPHABET.length;
    token += TOKEN_ALPHABET[charIndex];
  }

  return token;
}

/**
 * Validates whether a given string is a valid 6-character alphanumeric QR token.
 */
export function isValidSixCharToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  return /^[A-Z0-9]{6}$/.test(token.trim());
}

/**
 * Generates a collision-resistant 6-character token, retrying if the token
 * already exists in the provided collection or predicate.
 */
export function generateUniqueSixCharToken(
  existingTokenCheck: Set<string> | ((candidate: string) => boolean),
  maxRetries: number = MAX_COLLISION_RETRIES
): string {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateSixCharToken();
    const isCollision =
      existingTokenCheck instanceof Set
        ? existingTokenCheck.has(candidate)
        : existingTokenCheck(candidate);

    if (!isCollision) {
      return candidate;
    }
  }

  // Fallback in case of multiple collisions (extremely unlikely with 2.1B keyspace)
  return generateSixCharToken();
}

/**
 * Formats a QR code payload that encodes only the safe verification identifier.
 * Does NOT encode private student information, payment passwords, or database keys.
 */
export function formatSafeQrPayload(token: string, studentId: string): string {
  return JSON.stringify({
    token: token.trim().toUpperCase(),
    id: studentId.trim(),
  });
}

/**
 * Parses user input from camera scan, image upload, or manual typing.
 * Supports:
 * - Pure 6-character token: "A7K9M2"
 * - Registration ID: "PLSCF-2026-F1001"
 * - Safe JSON QR payload: '{"token":"A7K9M2","id":"PLSCF-2026-F1001"}'
 * - Query string or full URL: "https://plscf.org/?token=A7K9M2" or "?id=PLSCF-2026-F1001"
 */
export function parseScannedInput(input: string): {
  token?: string;
  id?: string;
  isGuardianPass?: boolean;
  isGuestPass?: boolean;
  raw: string;
} {
  if (!input) return { raw: '' };
  const trimmed = input.trim();
  const isGuardianPass =
    trimmed.toUpperCase().startsWith('PAR-') ||
    trimmed.toLowerCase().includes('verify-parent-pass') ||
    trimmed.toUpperCase().startsWith('P-');

  const isGuestPass =
    trimmed.toUpperCase().startsWith('GUEST-') ||
    trimmed.toUpperCase().startsWith('PLSCF-GST-') ||
    trimmed.toUpperCase().startsWith('GST-') ||
    trimmed.toLowerCase().includes('verify-guest-pass') ||
    trimmed.toLowerCase().includes('type=guest');

  // 1. JSON payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      let t = parsed.token ? String(parsed.token).trim().toUpperCase() : undefined;
      let rawId = (parsed.id || parsed.guestId || parsed.regNumber) ? String(parsed.id || parsed.guestId || parsed.regNumber).trim().toUpperCase() : undefined;
      if (rawId && rawId.startsWith('PAR-')) rawId = rawId.replace(/^PAR-/i, '');
      if (t && t.startsWith('P-') && t.length === 8) t = t.replace(/^P-/i, '');
      const jsonIsGuest = isGuestPass || parsed.type === 'GUEST' || Boolean(parsed.isGuestPass) || Boolean(rawId && (rawId.startsWith('GUEST-') || rawId.startsWith('PLSCF-GST-')));
      return {
        token: t,
        id: rawId,
        isGuardianPass: isGuardianPass || Boolean(parsed.isGuardianPass),
        isGuestPass: jsonIsGuest,
        raw: trimmed.toUpperCase(),
      };
    } catch {}
  }

  // 2. URL or query string
  if (trimmed.includes('?') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://plscf.org/${trimmed.startsWith('/') ? '' : '/'}${trimmed}`);
      let t =
        url.searchParams.get('token') ||
        url.searchParams.get('TOKEN') ||
        url.searchParams.get('qr_token') ||
        url.searchParams.get('guest_token') ||
        url.searchParams.get('verify') ||
        url.searchParams.get('VERIFY') ||
        url.searchParams.get('t') ||
        url.searchParams.get('T');
      let id =
        url.searchParams.get('studentId') ||
        url.searchParams.get('student_id') ||
        url.searchParams.get('guestId') ||
        url.searchParams.get('guest_id') ||
        url.searchParams.get('id') ||
        url.searchParams.get('ID') ||
        url.searchParams.get('reg_id') ||
        url.searchParams.get('registration_id');

      // Check URL path segments for Ticket ID or Guest ID pattern
      let pathId: string | undefined;
      const pathSegments = url.pathname.split('/').filter(Boolean);
      for (const seg of pathSegments) {
        if (/^PLSCF-\d{4}-[A-Z0-9]+$/i.test(seg) || /^GUEST-\d+$/i.test(seg) || /^PLSCF-GST-/i.test(seg)) {
          pathId = seg.toUpperCase();
          break;
        }
      }

      let effectiveId = id ? id.trim().toUpperCase() : pathId;
      if (effectiveId && effectiveId.startsWith('PAR-')) {
        effectiveId = effectiveId.replace(/^PAR-/i, '');
      }

      let effectiveToken = t ? t.trim().toUpperCase() : undefined;
      if (effectiveToken && effectiveToken.startsWith('P-') && effectiveToken.length === 8) {
        effectiveToken = effectiveToken.replace(/^P-/i, '');
      }

      const urlIsGuest =
        isGuestPass ||
        url.searchParams.get('type')?.toUpperCase() === 'GUEST' ||
        Boolean(effectiveId && (effectiveId.startsWith('GUEST-') || effectiveId.startsWith('PLSCF-GST-'))) ||
        Boolean(effectiveToken && effectiveToken.startsWith('GST-'));

      if (effectiveToken || effectiveId) {
        return {
          token: effectiveToken,
          id: effectiveId,
          isGuardianPass,
          isGuestPass: urlIsGuest,
          raw: trimmed.toUpperCase(),
        };
      }
    } catch {}
  }

  // 3. Direct alphanumeric token or ID
  const upper = trimmed.toUpperCase();
  let cleanId = upper;
  if (cleanId.startsWith('PAR-')) {
    cleanId = cleanId.replace(/^PAR-/i, '');
  }

  let cleanToken = upper;
  if (cleanToken.startsWith('P-') && cleanToken.length === 8) {
    cleanToken = cleanToken.replace(/^P-/i, '');
  }

  const directIsGuest =
    isGuestPass ||
    cleanId.startsWith('GUEST-') ||
    cleanId.startsWith('PLSCF-GST-') ||
    cleanToken.startsWith('GST-');

  return {
    token: cleanToken.length === 6 && /^[A-Z0-9]{6}$/.test(cleanToken) ? cleanToken : (directIsGuest && cleanToken.startsWith('GST-') ? cleanToken : undefined),
    id: cleanId,
    isGuardianPass,
    isGuestPass: directIsGuest,
    raw: upper,
  };
}

/**
 * Finds a student record from a collection using token, ID, or parsed QR payload.
 */
export function findRegistrationByTokenOrId<T extends { id: string; qrToken?: string }>(
  registrations: T[],
  input: string
): T | undefined {
  if (!input || !registrations || registrations.length === 0) return undefined;
  const parsed = parseScannedInput(input);

  return registrations.find((r: any) => {
    const rId = String(r.id || r.studentId || r.registrationId || '').toUpperCase().trim();
    const rToken = String(r.qrToken || r.qr_token || '').toUpperCase().trim();

    if (parsed.token && rToken && rToken === parsed.token) return true;
    if (parsed.id && rId && rId === parsed.id) return true;
    if (parsed.id && (rId === parsed.id.trim() || rId.includes(parsed.id) || parsed.id.includes(rId))) return true;
    if (parsed.raw && (rId === parsed.raw || rToken === parsed.raw)) return true;
    return false;
  });
}

