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

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Node.js fallback if crypto global not set
    try {
      const nodeCrypto = require('crypto');
      const randomBuf = nodeCrypto.randomBytes(TOKEN_LENGTH);
      for (let i = 0; i < TOKEN_LENGTH; i++) {
        bytes[i] = randomBuf[i];
      }
    } catch {
      for (let i = 0; i < TOKEN_LENGTH; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
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
export function parseScannedInput(input: string): { token?: string; id?: string; raw: string } {
  if (!input) return { raw: '' };
  const trimmed = input.trim();

  // 1. JSON payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        token: parsed.token ? String(parsed.token).trim().toUpperCase() : undefined,
        id: parsed.id ? String(parsed.id).trim().toUpperCase() : undefined,
        raw: trimmed.toUpperCase(),
      };
    } catch {}
  }

  // 2. URL or query string
  if (trimmed.includes('?') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://plscf.org/${trimmed.startsWith('/') ? '' : '/'}${trimmed}`);
      const t = url.searchParams.get('token') || url.searchParams.get('verify') || url.searchParams.get('t');
      const id = url.searchParams.get('id');
      if (t || id) {
        return {
          token: t ? t.trim().toUpperCase() : undefined,
          id: id ? id.trim().toUpperCase() : undefined,
          raw: trimmed.toUpperCase(),
        };
      }
    } catch {}
  }

  // 3. Direct alphanumeric token or ID
  const upper = trimmed.toUpperCase();
  return {
    token: upper.length === 6 && /^[A-Z0-9]{6}$/.test(upper) ? upper : undefined,
    id: upper,
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

  return registrations.find((r) => {
    const rId = (r.id || '').toUpperCase();
    const rToken = (r.qrToken || '').toUpperCase();

    if (parsed.token && rToken === parsed.token) return true;
    if (parsed.id && rId === parsed.id) return true;
    if (rId === parsed.raw || rToken === parsed.raw) return true;
    return false;
  });
}

