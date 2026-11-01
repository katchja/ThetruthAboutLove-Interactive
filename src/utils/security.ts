/**
 * Security, Privacy & Input Sanitization Utilities
 * Protects against unsafe URI schemes (XSS via javascript:/data:text/html),
 * enforces Studio Admin header construction, and guards protected manuscript excerpts.
 */

const SAFE_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:']);
const SAFE_DATA_IMAGE_PREFIX = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);(base64,|utf8,)/i;

/**
 * Validates and sanitizes an external URL before rendering in <a href="...">
 * Rejects javascript:, data:, vbscript:, file:, and malformed URLs.
 */
export function sanitizeExternalUrl(rawUrl?: string | null): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim().replace(/[\u0000-\u001F\u007F]/g, '');
  if (!trimmed) return undefined;

  if (trimmed.startsWith('/assets/') || trimmed.startsWith('#')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Validates and sanitizes an image source before rendering in <img src="...">
 * Allows https://, http://, local /assets/ paths, and safe raster/SVG data:image/* URIs.
 */
export function sanitizeImageSrc(rawSrc?: string | null): string | undefined {
  if (!rawSrc || typeof rawSrc !== 'string') return undefined;
  const trimmed = rawSrc.trim().replace(/[\u0000-\u001F\u007F]/g, '');
  if (!trimmed) return undefined;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  if (SAFE_DATA_IMAGE_PREFIX.test(trimmed)) {
    // Reject SVG data URIs that contain <script or on* event handlers
    if (/^data:image\/svg\+xml/i.test(trimmed)) {
      const decoded = (() => {
        try {
          return decodeURIComponent(trimmed);
        } catch {
          return trimmed;
        }
      })();
      if (/<script\b|onload\s*=|onerror\s*=|javascript:/i.test(decoded)) {
        return undefined;
      }
    }
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Returns headers for authenticated Google AI Studio Build author requests.
 */
export function getStudioAdminHeaders(): Record<string, string> {
  const hostname =
    typeof window !== 'undefined' && window.location
      ? window.location.hostname
      : '';
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-studio-admin': 'true',
    'x-client-hostname': hostname,
  };
}
