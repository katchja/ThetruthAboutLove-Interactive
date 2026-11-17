/**
 * Decode-First Browser Image Normalization & Content-Addressed Asset Hashing
 * Converts AVIF, HEIC, WebP, PNG, BMP, and oversized JPEGs via HTML5 Canvas
 * into clean, deterministic JPEG assets strictly under Firestore's 1 MiB ceiling.
 */

export interface NormalizedImageAsset {
  assetId: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml';
  dataUrl: string;
  dataBase64: string;
  byteLength: number;
  width?: number;
  height?: number;
}

const MAX_FIRESTORE_BASE64_CHARS = 760000; // Safely below 850,000 rules ceiling & 1 MiB doc limit

function fallbackHexHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part3 = input.length.toString(16).padStart(8, '0');
  return `${part1}${part2}${part3}`.slice(0, 24);
}

export async function computeAssetIdFromBase64(base64Payload: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const binary = atob(base64Payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `asset-${hex.slice(0, 24)}`;
    }
  } catch {
    // Fall back to deterministic hash below
  }
  return `asset-${fallbackHexHash(base64Payload)}`;
}

export function extractAssetIdFromUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.split('?')[0].trim();
  const apiMatch = clean.match(/^\/api\/assets\/([a-zA-Z0-9_-]{1,128})$/);
  if (apiMatch) return apiMatch[1];
  const cardMatch = clean.match(/^\/assets\/cards\/(asset-[a-zA-Z0-9_-]{1,120})\.[a-z0-9]+$/i);
  if (cardMatch) return cardMatch[1];
  return null;
}

function estimateBase64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(1, Math.floor((base64.length * 3) / 4) - padding);
}

function renderDrawableToJpegDataUrl(
  drawable: CanvasImageSource,
  rawWidth: number,
  rawHeight: number,
  maxDim = 1280,
  initialQuality = 0.84
): { dataUrl: string; width: number; height: number } | null {
  if (typeof document === 'undefined') return null;
  let width = rawWidth;
  let height = rawHeight;
  if (!width || !height) return null;

  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxDim) / width));
      width = maxDim;
    } else {
      width = Math.max(1, Math.round((width * maxDim) / height));
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Warm editorial gallery backing for transparent PNG/AVIF/WebP layers
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(drawable, 0, 0, width, height);

  let quality = initialQuality;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);

  // Step down quality or dimensions if still above Firestore's comfortable document threshold
  while (dataUrl.length > MAX_FIRESTORE_BASE64_CHARS && quality > 0.5) {
    quality = Math.round((quality - 0.1) * 100) / 100;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrl.length > MAX_FIRESTORE_BASE64_CHARS) {
    const scaledW = Math.max(1, Math.round(width * 0.75));
    const scaledH = Math.max(1, Math.round(height * 0.75));
    const smallerCanvas = document.createElement('canvas');
    smallerCanvas.width = scaledW;
    smallerCanvas.height = scaledH;
    const sCtx = smallerCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#FFFFFF';
      sCtx.fillRect(0, 0, scaledW, scaledH);
      sCtx.drawImage(canvas, 0, 0, scaledW, scaledH);
      dataUrl = smallerCanvas.toDataURL('image/jpeg', 0.72);
      return { dataUrl, width: scaledW, height: scaledH };
    }
  }

  return { dataUrl, width, height };
}

async function decodeBlobViaCanvas(
  blob: Blob,
  maxDim = 1280,
  quality = 0.84
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  // 1. Try createImageBitmap first (handles AVIF, WebP, PNG, JPEG reliably in modern browsers)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const rendered = renderDrawableToJpegDataUrl(
        bitmap,
        bitmap.width,
        bitmap.height,
        maxDim,
        quality
      );
      if (typeof bitmap.close === 'function') {
        bitmap.close();
      }
      if (rendered) return rendered;
    } catch {
      // Fall through to HTMLImageElement
    }
  }

  // 2. Fallback to HTMLImageElement + Object URL
  if (typeof Image !== 'undefined' && typeof URL !== 'undefined') {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const rendered = await new Promise<{
        dataUrl: string;
        width: number;
        height: number;
      } | null>((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => resolve(null), 6000);
        img.onload = () => {
          clearTimeout(timer);
          resolve(
            renderDrawableToJpegDataUrl(
              img,
              img.naturalWidth || img.width,
              img.naturalHeight || img.height,
              maxDim,
              quality
            )
          );
        };
        img.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        img.src = objectUrl;
      });
      return rendered;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return null;
}

/**
 * Reads an uploaded File (including .avif, .heic, .webp, .png, .jpg, .svg) and returns
 * a clean data:image/jpeg;base64,... (or safe SVG data URI) ready for preview and cloud sync.
 */
export async function readUploadedImageFileAsDataUrl(file: File): Promise<string> {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    const svgText = await file.text();
    if (/<script\b|onload\s*=|onerror\s*=|javascript:/i.test(svgText)) {
      throw new Error('Unsafe SVG script content rejected.');
    }
    const encoded = btoa(unescape(encodeURIComponent(svgText)));
    return `data:image/svg+xml;base64,${encoded}`;
  }

  const decoded = await decodeBlobViaCanvas(file, 1280, 0.84);
  if (decoded?.dataUrl) {
    return decoded.dataUrl;
  }

  // Fallback FileReader if Canvas is unavailable
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve((ev.target?.result as string) || '');
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Converts any data:image/* URI (including AVIF/HEIC/WebP/PNG/JPEG) or local /assets/cards/* path
 * into a content-addressed NormalizedImageAsset suitable for Firestore archive_assets storage.
 */
export async function normalizeDataUrlToCloudAsset(
  rawSrc: string,
  maxDim = 1280,
  quality = 0.84
): Promise<NormalizedImageAsset | null> {
  if (!rawSrc || typeof rawSrc !== 'string') return null;
  const trimmed = rawSrc.trim();

  // Handle safe SVG data URIs
  if (/^data:image\/svg\+xml;/i.test(trimmed)) {
    let base64 = '';
    if (/^data:image\/svg\+xml;base64,/i.test(trimmed)) {
      base64 = trimmed.replace(/^data:image\/svg\+xml;base64,/i, '');
    } else {
      const rawSvg = decodeURIComponent(trimmed.replace(/^data:image\/svg\+xml;utf8,/i, ''));
      if (/<script\b|onload\s*=|onerror\s*=|javascript:/i.test(rawSvg)) return null;
      base64 = btoa(unescape(encodeURIComponent(rawSvg)));
    }
    if (!base64 || base64.length > MAX_FIRESTORE_BASE64_CHARS) return null;
    const assetId = await computeAssetIdFromBase64(base64);
    return {
      assetId,
      mimeType: 'image/svg+xml',
      dataUrl: `data:image/svg+xml;base64,${base64}`,
      dataBase64: base64,
      byteLength: estimateBase64Bytes(base64),
    };
  }

  // Handle legacy local /assets/cards/* files during initial cloud migration
  if (trimmed.startsWith('/assets/cards/') && typeof fetch === 'function') {
    try {
      const resp = await fetch(trimmed);
      if (resp.ok) {
        const blob = await resp.blob();
        const decoded = await decodeBlobViaCanvas(blob, maxDim, quality);
        if (decoded?.dataUrl) {
          const base64 = decoded.dataUrl.replace(/^data:image\/jpeg;base64,/i, '');
          const assetId = await computeAssetIdFromBase64(base64);
          return {
            assetId,
            mimeType: 'image/jpeg',
            dataUrl: decoded.dataUrl,
            dataBase64: base64,
            byteLength: estimateBase64Bytes(base64),
            width: decoded.width,
            height: decoded.height,
          };
        }
      }
    } catch {
      return null;
    }
  }

  if (!trimmed.startsWith('data:image/')) {
    return null;
  }

  // Decode raster data URI via fetch->Blob->Canvas so AVIF, HEIC, WebP, PNG, and large JPEGs
  // are all normalized to crisp image/jpeg under Firestore's size limit
  try {
    const resp = await fetch(trimmed);
    const blob = await resp.blob();
    const decoded = await decodeBlobViaCanvas(blob, maxDim, quality);
    if (decoded?.dataUrl) {
      const base64 = decoded.dataUrl.replace(/^data:image\/jpeg;base64,/i, '');
      const assetId = await computeAssetIdFromBase64(base64);
      return {
        assetId,
        mimeType: 'image/jpeg',
        dataUrl: decoded.dataUrl,
        dataBase64: base64,
        byteLength: estimateBase64Bytes(base64),
        width: decoded.width,
        height: decoded.height,
      };
    }
  } catch {
    // Fallback if already a compact jpeg/png/webp base64 URI
  }

  const directMatch = trimmed.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (directMatch && directMatch[2].length <= MAX_FIRESTORE_BASE64_CHARS) {
    const rawMime = directMatch[1].toLowerCase();
    const mimeType =
      rawMime === 'image/jpg'
        ? 'image/jpeg'
        : (rawMime as 'image/jpeg' | 'image/png' | 'image/webp');
    const base64 = directMatch[2];
    const assetId = await computeAssetIdFromBase64(base64);
    return {
      assetId,
      mimeType,
      dataUrl: `data:${mimeType};base64,${base64}`,
      dataBase64: base64,
      byteLength: estimateBase64Bytes(base64),
    };
  }

  return null;
}
