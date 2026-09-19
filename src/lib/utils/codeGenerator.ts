/**
 * Character set for enrollment codes.
 * Omits easily confused glyphs:
 * - '0' and 'O'
 * - '1', 'I', and 'L'
 */
const UNAMBIGUOUS_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates a secure, human-friendly uppercase alphanumeric join code.
 *
 * @param length Length of the code to generate (defaults to 6)
 * @returns 6-character uppercase alphanumeric code (e.g. "K7M9P2")
 */
export function generateJoinCode(length: number = 6): string {
  if (length <= 0) {
    throw new Error('Join code length must be greater than 0');
  }

  let code = '';
  const charsLength = UNAMBIGUOUS_CHARS.length;

  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const randomBytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(randomBytes);
    for (let i = 0; i < length; i++) {
      code += UNAMBIGUOUS_CHARS[randomBytes[i] % charsLength];
    }
  } else {
    // Fallback for environments where crypto is unavailable
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charsLength);
      code += UNAMBIGUOUS_CHARS[randomIndex];
    }
  }

  return code;
}

/**
 * Normalizes user-input join codes by removing whitespace/hyphens and converting to uppercase.
 */
export function normalizeJoinCode(input: string): string {
  return input.replace(/[\s-]/g, '').trim().toUpperCase();
}

/**
 * Validates whether a provided string matches the expected join code format.
 */
export function isValidJoinCode(input: string, length: number = 6): boolean {
  const normalized = normalizeJoinCode(input);
  if (normalized.length !== length) {
    return false;
  }
  const regex = new RegExp(`^[${UNAMBIGUOUS_CHARS}]{${length}}$`);
  return regex.test(normalized);
}

/**
 * Generates a valid RFC4122 v4 UUID string across both web and native runtimes.
 */
export function generateUUID(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback RFC4122 v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
