/**
 * Utility functions for parsing and validating cohort join codes from
 * deep-link URLs, QR code payloads, and universal links.
 */

/**
 * Parses a 6-character alphanumeric join code from a given raw URL or text payload.
 * Supports:
 * - Direct codes: "BSSE26", "xyz123"
 * - Universal URLs: "https://classsync.app/join?code=XYZ123"
 * - Deep Links: "classsync://join?code=XYZ123"
 * - Path-based links: "https://classsync.app/join/XYZ123" or "classsync://join/XYZ123"
 *
 * @param rawUrl The raw URL string or scanned QR payload
 * @returns 6-character uppercase alphanumeric join code, or null if invalid
 */
export function parseJoinCodeFromUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // 1. Direct 6-character alphanumeric code (e.g. from manual input or simple QR)
  if (/^[A-Za-z0-9]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    // 2. Query param search: ?code=XYZ123 or &code=XYZ123
    const queryMatch = trimmed.match(/[?&]code=([A-Za-z0-9]{6})(?:[&#]|$)/i);
    if (queryMatch && queryMatch[1]) {
      return queryMatch[1].toUpperCase();
    }

    // 3. Path parameter search: .../join/XYZ123
    const pathMatch = trimmed.match(/\/join\/([A-Za-z0-9]{6})(?:[/?&#]|$)/i);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1].toUpperCase();
    }

    // 4. Fallback URL object parsing for custom schemes (classsync://)
    const normalizedUrl = trimmed.startsWith('classsync://')
      ? trimmed.replace('classsync://', 'https://placeholder.internal/')
      : trimmed;

    const parsed = new URL(normalizedUrl);
    const codeParam = parsed.searchParams.get('code');
    if (codeParam && /^[A-Za-z0-9]{6}$/.test(codeParam.trim())) {
      return codeParam.trim().toUpperCase();
    }

    // Check pathname if URL object parsed successfully
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const joinIndex = pathParts.findIndex((p) => p.toLowerCase() === 'join');
    if (joinIndex !== -1 && pathParts[joinIndex + 1]) {
      const candidate = pathParts[joinIndex + 1].trim();
      if (/^[A-Za-z0-9]{6}$/.test(candidate)) {
        return candidate.toUpperCase();
      }
    }
  } catch {
    // URL constructor failed, attempt fuzzy regex fallback
    const fuzzyMatch = trimmed.match(/join[/?&=]+([A-Za-z0-9]{6})\b/i);
    if (fuzzyMatch && fuzzyMatch[1]) {
      return fuzzyMatch[1].toUpperCase();
    }
  }

  return null;
}
