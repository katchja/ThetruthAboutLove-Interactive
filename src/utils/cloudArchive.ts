import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import {
  db,
  auth,
  OperationType,
  handleFirestoreError,
  isVerifiedAuthorUser,
} from '../firebase';
import {
  Source,
  SourceType,
  ArchiveSection,
  BookMetadata,
  getSourceImages,
  getSourceSection,
} from '../types';
import { sanitizeExternalUrl, sanitizeImageSrc } from './security';
import {
  normalizeDataUrlToCloudAsset,
  extractAssetIdFromUrl,
} from './imagePipeline';

const VALID_SOURCE_TYPES = new Set<SourceType>([
  'chapter',
  'article',
  'note',
  'scan',
  'citation',
  'book',
]);

const PENDING_QUEUE_KEY = 'TruthAboutLove_PendingCloudMutations_v1';
const DELETED_ASSETS_STORAGE_KEY = 'TruthAboutLove_DeletedAssetIds_v1';

export interface PendingCloudMutation {
  kind: 'upsert_source' | 'delete_source' | 'save_metadata';
  targetId: string;
  timestamp: number;
  purgedAssetIds?: string[];
}

export interface CloudArchiveSnapshot {
  sources: Source[];
  deletedSourceIds: string[];
  deletedAssetIds: string[];
  bookMetadata?: BookMetadata;
  hasCloudData: boolean;
}

function clampStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function normalizeCloudId(rawId: string, fallbackPrefix = 'src'): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return cleaned || `${fallbackPrefix}-${Date.now()}`;
}

function timestampToMillis(val: unknown, fallback = Date.now()): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  return fallback;
}

export function getLocalDeletedAssetIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_ASSETS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export function recordLocalDeletedAssetId(assetId: string): void {
  if (!assetId || typeof window === 'undefined') return;
  try {
    const set = getLocalDeletedAssetIds();
    set.add(assetId);
    window.localStorage.setItem(
      DELETED_ASSETS_STORAGE_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch {}
}

export function getPendingCloudMutations(): PendingCloudMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enqueuePendingCloudMutation(mutation: PendingCloudMutation): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getPendingCloudMutations().filter(
      (m) => !(m.targetId === mutation.targetId && m.kind !== 'save_metadata') &&
        !(m.kind === 'save_metadata' && mutation.kind === 'save_metadata')
    );
    current.push(mutation);
    window.localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(current));
  } catch {}
}

export function clearPendingCloudMutation(targetId: string, kind?: PendingCloudMutation['kind']): void {
  if (typeof window === 'undefined') return;
  try {
    const next = getPendingCloudMutations().filter((m) =>
      kind ? !(m.targetId === targetId && m.kind === kind) : m.targetId !== targetId
    );
    window.localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(next));
  } catch {}
}

export function clearAllPendingCloudMutations(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_QUEUE_KEY);
  } catch {}
}

/**
 * Fetches published archive sources, tombstones, and book metadata from Firestore.
 * If includePrivateForAuthor is true and the verified author is signed in,
 * merges protected raw chapter content from private_content/full.
 */
export async function fetchPublishedCloudArchive(
  includePrivateForAuthor = false
): Promise<CloudArchiveSnapshot> {
  let deletedSourceIds: string[] = [];
  let deletedAssetIds: string[] = [];
  let bookMetadata: BookMetadata | undefined;
  const sources: Source[] = [];

  // 1. Read published tombstones
  try {
    const tombQuery = query(
      collection(db, 'archive_tombstones'),
      where('isPublished', '==', true)
    );
    const tombSnap = await getDocs(tombQuery);
    tombSnap.forEach((docSnap) => {
      const d = docSnap.data();
      const targetId = clampStr(d.targetId || docSnap.id, 128);
      if (!targetId) return;
      if (d.kind === 'source') {
        deletedSourceIds.push(targetId);
      } else if (d.kind === 'asset') {
        deletedAssetIds.push(targetId);
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'archive_tombstones');
  }

  const deletedSourceSet = new Set(deletedSourceIds);
  const deletedAssetSet = new Set([
    ...deletedAssetIds,
    ...Array.from(getLocalDeletedAssetIds()),
  ]);

  // 2. Read book_metadata config
  try {
    const cfgSnap = await getDoc(doc(db, 'archive_config', 'book_metadata'));
    if (cfgSnap.exists()) {
      const c = cfgSnap.data();
      if (c.isPublished) {
        bookMetadata = {
          title: clampStr(c.title, 240) || 'The Truth About Love',
          subtitle: clampStr(c.subtitle, 320),
          author: clampStr(c.author, 160) || 'Catalina Butnaru',
          authorRole: clampStr(c.authorRole, 200),
          authorBio: clampStr(c.authorBio, 4000),
          isbn: clampStr(c.isbn, 64) || undefined,
          publisher: clampStr(c.publisher, 160) || undefined,
          publicationYear: clampStr(c.publicationYear, 32) || '2026',
          description: clampStr(c.description, 4000),
          coverAccent: clampStr(c.coverAccent, 64) || '#C83E0B',
          purchaseUrl: sanitizeExternalUrl(c.purchaseUrl),
        };
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'archive_config/book_metadata');
  }

  // 3. Read published archive_sources
  let rawDocs: { id: string; data: Record<string, any> }[] = [];
  try {
    const srcQuery = query(
      collection(db, 'archive_sources'),
      where('isPublished', '==', true)
    );
    const srcSnap = await getDocs(srcQuery);
    rawDocs = srcSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'archive_sources');
  }

  // 4. Optionally hydrate private_content/full for verified Studio Author
  const canReadPrivate =
    includePrivateForAuthor && isVerifiedAuthorUser(auth.currentUser);
  const privateMap = new Map<
    string,
    { rawContent?: string; rawTranscription?: string }
  >();

  if (canReadPrivate && rawDocs.length > 0) {
    await Promise.all(
      rawDocs.map(async ({ id }) => {
        if (deletedSourceSet.has(id)) return;
        const privPath = `archive_sources/${id}/private_content/full`;
        try {
          const privSnap = await getDoc(
            doc(db, 'archive_sources', id, 'private_content', 'full')
          );
          if (privSnap.exists()) {
            const p = privSnap.data();
            privateMap.set(id, {
              rawContent:
                typeof p.rawContent === 'string' ? p.rawContent : undefined,
              rawTranscription:
                typeof p.rawTranscription === 'string'
                  ? p.rawTranscription
                  : undefined,
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, privPath);
        }
      })
    );
  }

  for (const { id, data } of rawDocs) {
    if (deletedSourceSet.has(id)) continue;
    const rawType = clampStr(data.type, 16) as SourceType;
    const type: SourceType = VALID_SOURCE_TYPES.has(rawType)
      ? rawType
      : 'article';
    const section: ArchiveSection =
      data.section === 'references' || type === 'citation' || type === 'book'
        ? 'references'
        : 'authored';

    const rawImgs: string[] = Array.isArray(data.images)
      ? data.images
          .map((u: unknown) => sanitizeImageSrc(typeof u === 'string' ? u : ''))
          .filter((u): u is string => {
            if (!u) return false;
            const aid = extractAssetIdFromUrl(u);
            return !(aid && deletedAssetSet.has(aid));
          })
      : [];

    const safePrimary = sanitizeImageSrc(data.imageUrl);
    if (safePrimary) {
      const aid = extractAssetIdFromUrl(safePrimary);
      if (!(aid && deletedAssetSet.has(aid)) && !rawImgs.includes(safePrimary)) {
        rawImgs.unshift(safePrimary);
      }
    }

    const priv = privateMap.get(id);
    const summary = clampStr(data.summary, 4000);
    const publicContent = clampStr(data.content, 250000);
    const effectiveContent =
      priv?.rawContent || publicContent || summary || clampStr(data.title, 320);

    const hasOcr =
      Boolean(priv?.rawTranscription) ||
      Boolean(data.ocrDetectedPage) ||
      Boolean(data.ocrDocumentType);

    sources.push({
      id,
      title: clampStr(data.title, 320) || id,
      type,
      section,
      author: clampStr(data.author, 160) || undefined,
      year: clampStr(data.year, 32) || undefined,
      reference: clampStr(data.reference, 240) || undefined,
      summary,
      content: effectiveContent,
      externalUrl: sanitizeExternalUrl(data.externalUrl),
      imageUrl: rawImgs[0] || undefined,
      images: rawImgs.length > 0 ? rawImgs : undefined,
      coverAssetId: clampStr(data.coverAssetId, 128) || undefined,
      assetIds: Array.isArray(data.assetIds)
        ? data.assetIds.map((a: unknown) => clampStr(a, 128)).filter(Boolean)
        : undefined,
      ocrData: hasOcr
        ? {
            rawTranscription:
              priv?.rawTranscription || effectiveContent,
            detectedPage: clampStr(data.ocrDetectedPage, 40) || undefined,
            documentType: clampStr(data.ocrDocumentType, 80) || undefined,
            confidence: 0.95,
          }
        : undefined,
      tags: Array.isArray(data.tags)
        ? data.tags.map((t: unknown) => clampStr(t, 60)).filter(Boolean).slice(0, 25)
        : [],
      isProtected: Boolean(data.isProtected),
      createdAt: timestampToMillis(data.createdAt),
      updatedAt: timestampToMillis(data.updatedAt),
    });
  }

  // Preserve stable editorial ordering (createdAt ascending for seed chapters, newest custom entries respected)
  sources.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  return {
    sources,
    deletedSourceIds,
    deletedAssetIds: Array.from(deletedAssetSet),
    bookMetadata,
    hasCloudData: rawDocs.length > 0 || deletedSourceIds.length > 0 || Boolean(bookMetadata),
  };
}

async function upsertCloudAsset(
  assetId: string,
  sourceId: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml',
  dataBase64: string,
  byteLength: number,
  width?: number,
  height?: number
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !isVerifiedAuthorUser(user)) {
    throw new Error('Verified Studio Author authentication is required to upload cloud assets.');
  }

  const safeAssetId = normalizeCloudId(assetId, 'asset');
  const safeSourceId = normalizeCloudId(sourceId, 'src');
  const assetPath = `archive_assets/${safeAssetId}`;
  const assetRef = doc(db, 'archive_assets', safeAssetId);

  let existingSnap;
  try {
    existingSnap = await getDoc(assetRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, assetPath);
  }

  if (existingSnap.exists()) {
    const updatePayload: Record<string, any> = {
      sourceId: safeSourceId,
      mimeType,
      dataBase64,
      byteLength,
      isPublished: true,
      updatedAt: serverTimestamp(),
    };
    if (typeof width === 'number' && width >= 1) updatePayload.width = Math.round(width);
    if (typeof height === 'number' && height >= 1) updatePayload.height = Math.round(height);

    try {
      await updateDoc(assetRef, updatePayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, assetPath);
    }
  } else {
    const createPayload: Record<string, any> = {
      assetId: safeAssetId,
      sourceId: safeSourceId,
      mimeType,
      dataBase64,
      byteLength,
      isPublished: true,
      authorUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (typeof width === 'number' && width >= 1) createPayload.width = Math.round(width);
    if (typeof height === 'number' && height >= 1) createPayload.height = Math.round(height);

    try {
      await setDoc(assetRef, createPayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, assetPath);
    }
  }

  // If this assetId was previously tombstoned, remove its tombstone
  const tombPath = `archive_tombstones/${safeAssetId}`;
  try {
    const tombRef = doc(db, 'archive_tombstones', safeAssetId);
    const tombSnap = await getDoc(tombRef);
    if (tombSnap.exists()) {
      await deleteDoc(tombRef);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, tombPath);
  }
}

export async function purgeCloudAssetById(assetId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !isVerifiedAuthorUser(user)) return;
  const safeAssetId = normalizeCloudId(assetId, 'asset');
  if (!safeAssetId) return;

  recordLocalDeletedAssetId(safeAssetId);

  const assetPath = `archive_assets/${safeAssetId}`;
  try {
    const assetRef = doc(db, 'archive_assets', safeAssetId);
    const snap = await getDoc(assetRef);
    if (snap.exists()) {
      await deleteDoc(assetRef);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, assetPath);
  }

  const tombPath = `archive_tombstones/${safeAssetId}`;
  const tombRef = doc(db, 'archive_tombstones', safeAssetId);
  try {
    const tombSnap = await getDoc(tombRef);
    if (tombSnap.exists()) {
      await updateDoc(tombRef, {
        kind: 'asset',
        isPublished: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(tombRef, {
        targetId: safeAssetId,
        kind: 'asset',
        isPublished: true,
        authorUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, tombPath);
  }
}

/**
 * Atomically saves a chapter or literature entry to Firestore:
 * 1. Converts any data:image/* or legacy /assets/cards/* cover into archive_assets/{assetId}
 * 2. Writes public metadata to archive_sources/{sourceId} and protected raw text to private_content/full
 * 3. Immediately purges any superseded cover/gallery assetIds that were replaced or removed
 */
export async function saveSourceToCloud(
  source: Source,
  previousSource?: Source | null,
  allOtherSources: Source[] = []
): Promise<{ persistedSource: Source; purgedAssetIds: string[] }> {
  const user = auth.currentUser;
  if (!user || !isVerifiedAuthorUser(user)) {
    throw new Error('Verified Studio Author authentication is required to write to Firestore.');
  }

  const safeId = normalizeCloudId(source.id, 'src');
  const rawImages = getSourceImages(source);
  const resolvedUrls: string[] = [];
  const resolvedAssetIds: string[] = [];

  for (const img of rawImages.slice(0, 24)) {
    const existingCloudAssetId = extractAssetIdFromUrl(img);
    if (existingCloudAssetId) {
      const canonicalUrl = `/api/assets/${existingCloudAssetId}`;
      if (!resolvedUrls.includes(canonicalUrl)) {
        resolvedUrls.push(canonicalUrl);
      }
      if (!resolvedAssetIds.includes(existingCloudAssetId)) {
        resolvedAssetIds.push(existingCloudAssetId);
      }
      continue;
    }

    if (img.startsWith('data:image/') || img.startsWith('/assets/cards/')) {
      const normalizedAsset = await normalizeDataUrlToCloudAsset(img);
      if (normalizedAsset) {
        await upsertCloudAsset(
          normalizedAsset.assetId,
          safeId,
          normalizedAsset.mimeType,
          normalizedAsset.dataBase64,
          normalizedAsset.byteLength,
          normalizedAsset.width,
          normalizedAsset.height
        );
        const canonicalUrl = `/api/assets/${normalizedAsset.assetId}`;
        if (!resolvedUrls.includes(canonicalUrl)) {
          resolvedUrls.push(canonicalUrl);
        }
        if (!resolvedAssetIds.includes(normalizedAsset.assetId)) {
          resolvedAssetIds.push(normalizedAsset.assetId);
        }
        continue;
      }
    }

    const safeUrl = sanitizeImageSrc(img);
    if (safeUrl && !safeUrl.startsWith('data:') && safeUrl.length <= 2048) {
      if (!resolvedUrls.includes(safeUrl)) {
        resolvedUrls.push(safeUrl);
      }
    }
  }

  const sourcePath = `archive_sources/${safeId}`;
  const sourceRef = doc(db, 'archive_sources', safeId);
  const privateRef = doc(db, 'archive_sources', safeId, 'private_content', 'full');

  let existingSourceSnap;
  let existingPrivateSnap;
  try {
    [existingSourceSnap, existingPrivateSnap] = await Promise.all([
      getDoc(sourceRef),
      getDoc(privateRef),
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, sourcePath);
  }

  // Collect old asset IDs from both previousSource and existing Firestore doc so replaced covers are purged
  const oldAssetCandidates = new Set<string>();
  if (previousSource) {
    if (previousSource.coverAssetId) oldAssetCandidates.add(previousSource.coverAssetId);
    for (const a of previousSource.assetIds || []) oldAssetCandidates.add(a);
    for (const u of getSourceImages(previousSource)) {
      const aid = extractAssetIdFromUrl(u);
      if (aid) oldAssetCandidates.add(aid);
    }
  }
  if (existingSourceSnap.exists()) {
    const ex = existingSourceSnap.data();
    if (typeof ex.coverAssetId === 'string') oldAssetCandidates.add(ex.coverAssetId);
    if (Array.isArray(ex.assetIds)) {
      for (const a of ex.assetIds) {
        if (typeof a === 'string') oldAssetCandidates.add(a);
      }
    }
    if (Array.isArray(ex.images)) {
      for (const u of ex.images) {
        const aid = extractAssetIdFromUrl(u);
        if (aid) oldAssetCandidates.add(aid);
      }
    }
  }

  // Never purge an assetId that is still referenced by another active card in the archive
  const referencedElsewhere = new Set<string>();
  for (const other of allOtherSources) {
    if (!other || other.id === source.id || other.id === safeId) continue;
    if (other.coverAssetId) referencedElsewhere.add(other.coverAssetId);
    for (const a of other.assetIds || []) referencedElsewhere.add(a);
    for (const u of getSourceImages(other)) {
      const aid = extractAssetIdFromUrl(u);
      if (aid) referencedElsewhere.add(aid);
    }
  }

  const nextAssetSet = new Set(resolvedAssetIds);
  const purgedAssetIds = Array.from(oldAssetCandidates).filter(
    (aid) => aid && !nextAssetSet.has(aid) && !referencedElsewhere.has(aid)
  );

  // Sanitize all ArchiveSource fields strictly to blueprint limits
  const title = clampStr(source.title, 320) || 'Untitled Entry';
  const type: SourceType = VALID_SOURCE_TYPES.has(source.type)
    ? source.type
    : 'article';
  const section: ArchiveSection = getSourceSection({ ...source, type });
  const author = clampStr(source.author, 160);
  const year = clampStr(source.year, 32);
  const reference = clampStr(source.reference, 240);
  const summary = clampStr(source.summary, 4000);
  const rawContent = clampStr(source.content, 300000) || summary || title;
  const isProtected = Boolean(source.isProtected);
  // Shield raw copyrighted manuscript body from public archive_sources doc when protected
  const publicSafeContent = isProtected
    ? summary
    : clampStr(rawContent, 250000);
  const externalUrl = sanitizeExternalUrl(source.externalUrl);
  const cleanExternalUrl =
    externalUrl && externalUrl.length <= 2048 ? externalUrl : '';
  const ocrDetectedPage = clampStr(source.ocrData?.detectedPage, 40);
  const ocrDocumentType = clampStr(source.ocrData?.documentType, 80);
  const rawTranscription = clampStr(source.ocrData?.rawTranscription, 250000);
  const tags = (Array.isArray(source.tags) ? source.tags : [])
    .map((t) => clampStr(t, 60))
    .filter((t) => t.length >= 1)
    .slice(0, 25);

  const primaryImageUrl = resolvedUrls[0] || '';
  const coverAssetId = resolvedAssetIds[0] || '';

  const batch = writeBatch(db);

  if (existingSourceSnap.exists()) {
    const updateSourceData: Record<string, any> = {
      title,
      type,
      section,
      author: author ? author : deleteField(),
      year: year ? year : deleteField(),
      reference: reference ? reference : deleteField(),
      summary,
      content: publicSafeContent,
      externalUrl: cleanExternalUrl ? cleanExternalUrl : deleteField(),
      imageUrl: primaryImageUrl ? primaryImageUrl : deleteField(),
      images: resolvedUrls.length > 0 ? resolvedUrls : deleteField(),
      coverAssetId: coverAssetId ? coverAssetId : deleteField(),
      assetIds: resolvedAssetIds.length > 0 ? resolvedAssetIds : deleteField(),
      ocrDetectedPage: ocrDetectedPage ? ocrDetectedPage : deleteField(),
      ocrDocumentType: ocrDocumentType ? ocrDocumentType : deleteField(),
      tags,
      isProtected,
      isPublished: true,
      updatedAt: serverTimestamp(),
    };
    batch.update(sourceRef, updateSourceData);
  } else {
    const createSourceData: Record<string, any> = {
      id: safeId,
      title,
      type,
      section,
      summary,
      content: publicSafeContent,
      tags,
      isProtected,
      isPublished: true,
      authorUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (author) createSourceData.author = author;
    if (year) createSourceData.year = year;
    if (reference) createSourceData.reference = reference;
    if (cleanExternalUrl) createSourceData.externalUrl = cleanExternalUrl;
    if (primaryImageUrl) createSourceData.imageUrl = primaryImageUrl;
    if (resolvedUrls.length > 0) createSourceData.images = resolvedUrls;
    if (coverAssetId) createSourceData.coverAssetId = coverAssetId;
    if (resolvedAssetIds.length > 0) createSourceData.assetIds = resolvedAssetIds;
    if (ocrDetectedPage) createSourceData.ocrDetectedPage = ocrDetectedPage;
    if (ocrDocumentType) createSourceData.ocrDocumentType = ocrDocumentType;

    batch.set(sourceRef, createSourceData);
  }

  if (existingPrivateSnap.exists()) {
    batch.update(privateRef, {
      rawContent,
      rawTranscription: rawTranscription ? rawTranscription : deleteField(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const createPrivateData: Record<string, any> = {
      sourceId: safeId,
      rawContent,
      authorUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (rawTranscription) createPrivateData.rawTranscription = rawTranscription;
    batch.set(privateRef, createPrivateData);
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, sourcePath);
  }

  // Remove any prior source tombstone if an ID was restored
  try {
    const tombRef = doc(db, 'archive_tombstones', safeId);
    const tombSnap = await getDoc(tombRef);
    if (tombSnap.exists()) {
      await deleteDoc(tombRef);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `archive_tombstones/${safeId}`);
  }

  // Purge all superseded cover/gallery assets immediately
  for (const oldAssetId of purgedAssetIds) {
    await purgeCloudAssetById(oldAssetId);
  }

  clearPendingCloudMutation(safeId, 'upsert_source');

  const persistedSource: Source = {
    ...source,
    id: safeId,
    title,
    type,
    section,
    author: author || undefined,
    year: year || undefined,
    reference: reference || undefined,
    summary,
    content: rawContent,
    externalUrl: cleanExternalUrl || undefined,
    imageUrl: primaryImageUrl || undefined,
    images: resolvedUrls.length > 0 ? resolvedUrls : undefined,
    coverAssetId: coverAssetId || undefined,
    assetIds: resolvedAssetIds.length > 0 ? resolvedAssetIds : undefined,
    tags,
    isProtected,
    updatedAt: Date.now(),
  };

  return { persistedSource, purgedAssetIds };
}

/**
 * Permanently deletes a chapter/literature entry from Firestore, purges its image assets,
 * and writes a permanent tombstone so seed data never resurrects it.
 */
export async function deleteSourceFromCloud(
  sourceId: string,
  previousSource?: Source | null,
  allOtherSources: Source[] = []
): Promise<string[]> {
  const user = auth.currentUser;
  if (!user || !isVerifiedAuthorUser(user)) {
    throw new Error('Verified Studio Author authentication is required to delete entries.');
  }

  const safeId = normalizeCloudId(sourceId, 'src');
  const sourcePath = `archive_sources/${safeId}`;
  const sourceRef = doc(db, 'archive_sources', safeId);
  const privateRef = doc(db, 'archive_sources', safeId, 'private_content', 'full');

  const assetsToPurge = new Set<string>();
  if (previousSource) {
    if (previousSource.coverAssetId) assetsToPurge.add(previousSource.coverAssetId);
    for (const a of previousSource.assetIds || []) assetsToPurge.add(a);
    for (const u of getSourceImages(previousSource)) {
      const aid = extractAssetIdFromUrl(u);
      if (aid) assetsToPurge.add(aid);
    }
  }

  try {
    const [srcSnap, privSnap] = await Promise.all([
      getDoc(sourceRef),
      getDoc(privateRef),
    ]);
    if (srcSnap.exists()) {
      const d = srcSnap.data();
      if (typeof d.coverAssetId === 'string') assetsToPurge.add(d.coverAssetId);
      if (Array.isArray(d.assetIds)) {
        for (const a of d.assetIds) {
          if (typeof a === 'string') assetsToPurge.add(a);
        }
      }
    }
    if (privSnap.exists()) {
      await deleteDoc(privateRef);
    }
    if (srcSnap.exists()) {
      await deleteDoc(sourceRef);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, sourcePath);
  }

  // Record permanent source tombstone
  const tombPath = `archive_tombstones/${safeId}`;
  const tombRef = doc(db, 'archive_tombstones', safeId);
  try {
    const tombSnap = await getDoc(tombRef);
    if (tombSnap.exists()) {
      await updateDoc(tombRef, {
        kind: 'source',
        isPublished: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(tombRef, {
        targetId: safeId,
        kind: 'source',
        isPublished: true,
        authorUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, tombPath);
  }

  const referencedElsewhere = new Set<string>();
  for (const other of allOtherSources) {
    if (!other || other.id === sourceId || other.id === safeId) continue;
    if (other.coverAssetId) referencedElsewhere.add(other.coverAssetId);
    for (const a of other.assetIds || []) referencedElsewhere.add(a);
    for (const u of getSourceImages(other)) {
      const aid = extractAssetIdFromUrl(u);
      if (aid) referencedElsewhere.add(aid);
    }
  }

  const purged: string[] = [];
  for (const aid of assetsToPurge) {
    if (aid && !referencedElsewhere.has(aid)) {
      await purgeCloudAssetById(aid);
      purged.push(aid);
    }
  }

  clearPendingCloudMutation(safeId, 'delete_source');
  return purged;
}

export async function saveBookMetadataToCloud(metadata: BookMetadata): Promise<void> {
  const user = auth.currentUser;
  if (!user || !isVerifiedAuthorUser(user)) {
    throw new Error('Verified Studio Author authentication is required to update book metadata.');
  }

  const configPath = 'archive_config/book_metadata';
  const configRef = doc(db, 'archive_config', 'book_metadata');

  const title = clampStr(metadata.title, 240) || 'The Truth About Love';
  const subtitle = clampStr(metadata.subtitle, 320);
  const author = clampStr(metadata.author, 160) || 'Catalina Butnaru';
  const authorRole = clampStr(metadata.authorRole, 200);
  const authorBio = clampStr(metadata.authorBio, 4000);
  const isbn = clampStr(metadata.isbn, 64);
  const publisher = clampStr(metadata.publisher, 160);
  const publicationYear = clampStr(metadata.publicationYear, 32) || '2026';
  const description = clampStr(metadata.description, 4000);
  const coverAccent = clampStr(metadata.coverAccent, 64) || '#C83E0B';
  const purchaseUrl = sanitizeExternalUrl(metadata.purchaseUrl) || '';

  try {
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      await updateDoc(configRef, {
        title,
        subtitle,
        author,
        authorRole,
        authorBio,
        isbn: isbn ? isbn : deleteField(),
        publisher: publisher ? publisher : deleteField(),
        publicationYear,
        description,
        coverAccent,
        purchaseUrl: purchaseUrl ? purchaseUrl : deleteField(),
        isPublished: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      const createData: Record<string, any> = {
        configId: 'book_metadata',
        title,
        subtitle,
        author,
        authorRole,
        authorBio,
        publicationYear,
        description,
        coverAccent,
        isPublished: true,
        authorUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (isbn) createData.isbn = isbn;
      if (publisher) createData.publisher = publisher;
      if (purchaseUrl) createData.purchaseUrl = purchaseUrl;
      await setDoc(configRef, createData);
    }
    clearPendingCloudMutation('book_metadata', 'save_metadata');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, configPath);
  }
}

/**
 * Bootstraps Cloud Firestore on first author connection so all existing chapters,
 * literature entries, deleted tombstones, and local card artworks are permanently migrated.
 */
export async function bootstrapCloudArchiveFromExisting(
  sources: Source[],
  deletedSourceIds: string[],
  bookMetadata: BookMetadata
): Promise<Source[]> {
  const user = auth.currentUser;
  if (!user || !isVerifiedAuthorUser(user)) {
    return sources;
  }

  await saveBookMetadataToCloud(bookMetadata);

  for (const deletedId of deletedSourceIds) {
    if (deletedId) {
      await deleteSourceFromCloud(deletedId, null, sources);
    }
  }

  const migrated: Source[] = [];
  for (const src of sources) {
    const { persistedSource } = await saveSourceToCloud(src, null, sources);
    migrated.push(persistedSource);
  }
  return migrated;
}
