import { Source, VectorChunk, SearchResult, getSourceImages, getSourceSection } from '../types';

const DB_NAME = 'TruthAboutLove_LocalArchive_v5';
const DB_VERSION = 1;
const SOURCES_STORE = 'sources';
const CHUNKS_STORE = 'vector_chunks';
const EMBEDDING_DIM = 256;

// Common English stopwords to ignore in vector weights
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can\'t', 'cannot', 'could',
  'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s',
  'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m',
  'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t',
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves',
  'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they',
  'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
  'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

// Murmur-inspired fast string hash
function stringHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

/**
 * High-performance, private, zero-cloud local vector embedder.
 * Converts any passage into a 256-dimensional unit vector using subword n-grams,
 * term hashing, and L2 normalization.
 */
export function generateLocalEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  if (!text || text.trim().length === 0) return vector;

  const normalized = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w));

  // Word token weights
  for (const word of words) {
    const hash = stringHash(word);
    const idx = hash % EMBEDDING_DIM;
    const sign = (hash & 0x1000) === 0 ? 1 : -1;
    vector[idx] += sign * 1.5;

    // Subword character tri-grams for spelling variations and semantic morphology
    if (word.length >= 3) {
      for (let j = 0; j <= word.length - 3; j++) {
        const trigram = word.substring(j, j + 3);
        const triHash = stringHash(trigram);
        const triIdx = triHash % EMBEDDING_DIM;
        const triSign = (triHash & 0x2000) === 0 ? 0.6 : -0.6;
        vector[triIdx] += triSign;
      }
    }
  }

  // Word bigrams for syntactic context
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]}_${words[i + 1]}`;
    const hash = stringHash(bigram);
    const idx = hash % EMBEDDING_DIM;
    const sign = (hash & 0x4000) === 0 ? 1.0 : -1.0;
    vector[idx] += sign * 1.2;
  }

  // L2 Normalization so dotProduct equals Cosine Similarity
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

/**
 * Cosine similarity between two unit vectors: dot product
 */
export function cosineSimilarity(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return 0;
  let dot = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
  }
  return Math.max(0, Math.min(1, dot));
}

/**
 * Split long documents/chapters into semantic chunks (~180-240 words with 30-word overlap)
 */
export function chunkText(text: string, maxWords = 180, overlap = 35): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  let currentWords: string[] = [];

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/);

    if (currentWords.length + paraWords.length <= maxWords) {
      currentWords.push(...paraWords);
    } else {
      if (currentWords.length > 0) {
        chunks.push(currentWords.join(' '));
        // Keep overlap from end
        currentWords = currentWords.slice(-overlap);
      }

      // If a single paragraph is larger than maxWords, break it down
      if (paraWords.length > maxWords) {
        for (let i = 0; i < paraWords.length; i += (maxWords - overlap)) {
          chunks.push(paraWords.slice(i, i + maxWords).join(' '));
        }
        currentWords = [];
      } else {
        currentWords.push(...paraWords);
      }
    }
  }

  if (currentWords.length > 0) {
    chunks.push(currentWords.join(' '));
  }

  return chunks;
}

// IndexedDB Helper
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SOURCES_STORE)) {
        db.createObjectStore(SOURCES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunkStore = db.createObjectStore(CHUNKS_STORE, { keyPath: 'id' });
        chunkStore.createIndex('sourceId', 'sourceId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Ingest and index (or re-index on edit) a Source into local vector store
 */
export async function indexSource(source: Source): Promise<VectorChunk[]> {
  const fullTextToChunk = `${source.title}\n${source.summary}\n${source.content}`;
  const textChunks = chunkText(fullTextToChunk);

  const chunks: VectorChunk[] = textChunks.map((chunkText, idx) => {
    return {
      id: `${source.id}_chunk_${idx}`,
      sourceId: source.id,
      sourceTitle: source.title,
      sourceType: source.type,
      reference: source.reference,
      text: chunkText,
      vector: generateLocalEmbedding(chunkText),
      tokenCount: chunkText.split(/\s+/).length,
    };
  });

  try {
    const db = await openDB();
    return await new Promise<VectorChunk[]>((resolve) => {
      try {
        const tx = db.transaction([SOURCES_STORE, CHUNKS_STORE], 'readwrite');
        const sourceStore = tx.objectStore(SOURCES_STORE);
        const chunkStore = tx.objectStore(CHUNKS_STORE);

        sourceStore.put(source);

        // Remove any existing chunks for this sourceId before inserting updated chunks
        const index = chunkStore.index('sourceId');
        const req = index.openCursor(IDBKeyRange.only(source.id));
        req.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            chunkStore.delete(cursor.primaryKey);
            cursor.continue();
          } else {
            for (const chunk of chunks) {
              chunkStore.put(chunk);
            }
          }
        };
        req.onerror = () => {
          for (const chunk of chunks) {
            try {
              chunkStore.put(chunk);
            } catch {}
          }
        };

        tx.oncomplete = () => {
          try {
            db.close();
          } catch {}
          resolve(chunks);
        };
        tx.onerror = () => {
          try {
            db.close();
          } catch {}
          resolve(chunks);
        };
        tx.onabort = () => {
          try {
            db.close();
          } catch {}
          resolve(chunks);
        };
      } catch {
        try {
          db.close();
        } catch {}
        resolve(chunks);
      }
    });
  } catch (err) {
    console.warn('IndexedDB save failed, keeping in memory:', err);
    return chunks;
  }
}

/**
 * Search the local vector database with query embedding and cosine similarity
 */
export async function semanticSearch(
  query: string,
  allChunks: VectorChunk[],
  filterSourceIds?: string[],
  topK = 5
): Promise<SearchResult[]> {
  if (!query || !query.trim() || allChunks.length === 0) return [];

  const queryVector = generateLocalEmbedding(query);
  const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));

  const eligibleChunks = filterSourceIds && filterSourceIds.length > 0
    ? allChunks.filter(c => filterSourceIds.includes(c.sourceId))
    : allChunks;

  const results: SearchResult[] = [];

  for (const chunk of eligibleChunks) {
    const cosineSim = cosineSimilarity(queryVector, chunk.vector);

    // Boost exact keyword occurrences
    const lowerText = chunk.text.toLowerCase();
    const matchedTerms: string[] = [];
    let termBoost = 0;

    for (const term of queryTerms) {
      if (lowerText.includes(term)) {
        matchedTerms.push(term);
        termBoost += 0.08;
      }
    }

    // Hybrid score combining dense cosine similarity and lexical match
    const finalScore = Math.min(1.0, cosineSim * 0.75 + Math.min(0.25, termBoost));

    if (finalScore > 0.08) {
      results.push({
        chunk,
        similarity: finalScore,
        matchedTerms,
      });
    }
  }

  // Sort descending by similarity
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

const PURGED_SOURCE_PATTERNS = [
  'gemini_generated_image_njyn5bnjyn5bnjyn',
  'njyn5bnjyn5bnjyn',
];

const DELETED_SOURCES_STORAGE_KEY = 'TruthAboutLove_DeletedSourceIds_v1';

export function getDeletedSourceIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_SOURCES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export function markSourceDeleted(sourceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getDeletedSourceIds();
    current.add(sourceId);
    window.localStorage.setItem(
      DELETED_SOURCES_STORAGE_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {}
}

export function clearDeletedSourcesRegistry(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DELETED_SOURCES_STORAGE_KEY);
  } catch {}
}

export function isPurgedArchiveSource(source: Partial<Source>): boolean {
  if (source.id && getDeletedSourceIds().has(source.id)) {
    return true;
  }
  const haystack = [
    source.id || '',
    source.title || '',
    source.reference || '',
    source.summary || '',
    source.imageUrl || '',
  ]
    .join(' ')
    .toLowerCase();

  return PURGED_SOURCE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

const LEGACY_DB_NAMES = [
  'TruthAboutLove_LocalArchive_v4',
  'TruthAboutLove_LocalArchive_v3',
  'TruthAboutLove_LocalArchive_v2',
  'TruthAboutLove_LocalArchive_v1',
  'TruthAboutLove_LocalArchive',
];

function readLegacySourcesFromDBName(dbName: string): Promise<Source[]> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SOURCES_STORE)) {
          db.close();
          resolve([]);
          return;
        }
        try {
          const tx = db.transaction([SOURCES_STORE], 'readonly');
          const store = tx.objectStore(SOURCES_STORE);
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const list = Array.isArray(getAllReq.result) ? getAllReq.result : [];
            db.close();
            resolve(list);
          };
          getAllReq.onerror = () => {
            db.close();
            resolve([]);
          };
        } catch {
          db.close();
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function recoverLegacyIndexedDBSources(): Promise<Source[]> {
  if (typeof indexedDB === 'undefined') return [];
  const recovered: Source[] = [];
  try {
    let existingDbNames = new Set<string>(LEGACY_DB_NAMES);
    if (typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      const actualNames = new Set(
        dbs.map((d) => d.name).filter((n): n is string => Boolean(n))
      );
      existingDbNames = new Set(
        LEGACY_DB_NAMES.filter((name) => actualNames.has(name))
      );
    }

    for (const legacyName of existingDbNames) {
      const items = await readLegacySourcesFromDBName(legacyName);
      for (const item of items) {
        if (item && item.id) {
          recovered.push(item);
        }
      }
    }
  } catch {
    // Ignore errors on browsers that restrict indexedDB.databases()
  }
  return recovered;
}

/**
 * Load all stored sources and chunks from IndexedDB, automatically recovering
 * any legacy citations/photos and purging removed items
 */
export async function loadArchiveFromDB(): Promise<{ sources: Source[]; chunks: VectorChunk[] }> {
  try {
    const db = await openDB();
    const raw = await new Promise<{ sources: Source[]; chunks: VectorChunk[] }>((resolve) => {
      try {
        const tx = db.transaction([SOURCES_STORE, CHUNKS_STORE], 'readonly');
        const sourceStore = tx.objectStore(SOURCES_STORE);
        const chunkStore = tx.objectStore(CHUNKS_STORE);

        const sourcesReq = sourceStore.getAll();
        const chunksReq = chunkStore.getAll();

        tx.oncomplete = () => {
          try {
            db.close();
          } catch {}
          resolve({
            sources: sourcesReq.result || [],
            chunks: chunksReq.result || [],
          });
        };
        tx.onerror = () => {
          try {
            db.close();
          } catch {}
          resolve({ sources: [], chunks: [] });
        };
        tx.onabort = () => {
          try {
            db.close();
          } catch {}
          resolve({ sources: [], chunks: [] });
        };
      } catch {
        try {
          db.close();
        } catch {}
        resolve({ sources: [], chunks: [] });
      }
    });

    const deletedSet = getDeletedSourceIds();
    const purgedIds = new Set<string>(deletedSet);
    const byId = new Map<string, Source>();

    const mergeStoredSources = (older: Source, newer: Source): Source => {
      const olderImgs = getSourceImages(older);
      const newerImgs = getSourceImages(newer);
      const combinedImgs: string[] = [];
      for (const img of [...newerImgs, ...olderImgs]) {
        if (img && !combinedImgs.includes(img)) {
          combinedImgs.push(img);
        }
      }

      const olderModified = older.updatedAt || (older.createdAt > 1710000000000 ? older.createdAt : 0);
      const newerModified = newer.updatedAt || (newer.createdAt > 1710000000000 ? newer.createdAt : 0);
      const preferOlder =
        olderModified > newerModified ||
        (olderImgs.some((i) => i.startsWith('data:image/')) &&
          !newerImgs.some((i) => i.startsWith('data:image/')) &&
          !newer.updatedAt);

      const base = preferOlder ? { ...newer, ...older } : { ...older, ...newer };
      const finalImages = newer.updatedAt ? newerImgs : combinedImgs;

      return {
        ...base,
        section: getSourceSection(base),
        imageUrl: finalImages[0] || base.imageUrl,
        images: finalImages.length > 0 ? finalImages : undefined,
      };
    };

    // 1. First load any legacy DB sources so v5 overrides or enriches them
    const legacySources = await recoverLegacyIndexedDBSources();
    for (const leg of legacySources) {
      if (!leg || !leg.id || isPurgedArchiveSource(leg) || deletedSet.has(leg.id)) {
        continue;
      }
      if (!byId.has(leg.id)) {
        const imgs = getSourceImages(leg);
        byId.set(leg.id, {
          ...leg,
          section: getSourceSection(leg),
          imageUrl: imgs[0] || leg.imageUrl,
          images: imgs.length > 0 ? imgs : undefined,
        });
      } else {
        byId.set(leg.id, mergeStoredSources(byId.get(leg.id)!, leg));
      }
    }

    // 2. Merge current v5 sources on top
    for (const source of raw.sources) {
      if (isPurgedArchiveSource(source) || deletedSet.has(source.id)) {
        purgedIds.add(source.id);
        byId.delete(source.id);
      } else {
        const prev = byId.get(source.id);
        if (!prev) {
          const imgs = getSourceImages(source);
          byId.set(source.id, {
            ...source,
            section: getSourceSection(source),
            imageUrl: imgs[0] || source.imageUrl,
            images: imgs.length > 0 ? imgs : undefined,
          });
        } else {
          byId.set(source.id, mergeStoredSources(prev, source));
        }
      }
    }

    const validSources = Array.from(byId.values());

    // Also check chunks whose sourceTitle matches purged pattern
    for (const chunk of raw.chunks) {
      const chunkTitle = (chunk.sourceTitle || '').toLowerCase();
      if (PURGED_SOURCE_PATTERNS.some((p) => chunkTitle.includes(p)) || deletedSet.has(chunk.sourceId)) {
        purgedIds.add(chunk.sourceId);
      }
    }

    if (purgedIds.size > 0) {
      for (const id of purgedIds) {
        await removeSourceFromDB(id, false);
      }
    }

    const validChunks = raw.chunks.filter((c) => !purgedIds.has(c.sourceId));

    return {
      sources: validSources,
      chunks: validChunks,
    };
  } catch {
    return { sources: [], chunks: [] };
  }
}

/**
 * Delete a source and its vector chunks from IndexedDB
 */
export async function removeSourceFromDB(sourceId: string, recordDeleted = true): Promise<void> {
  if (recordDeleted) {
    markSourceDeleted(sourceId);
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([SOURCES_STORE, CHUNKS_STORE], 'readwrite');
        tx.objectStore(SOURCES_STORE).delete(sourceId);

        const chunkStore = tx.objectStore(CHUNKS_STORE);
        const index = chunkStore.index('sourceId');
        const req = index.openCursor(IDBKeyRange.only(sourceId));

        req.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            chunkStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };

        tx.oncomplete = () => {
          try {
            db.close();
          } catch {}
          resolve();
        };
        tx.onerror = () => {
          try {
            db.close();
          } catch {}
          resolve();
        };
        tx.onabort = () => {
          try {
            db.close();
          } catch {}
          resolve();
        };
      } catch {
        try {
          db.close();
        } catch {}
        resolve();
      }
    });
  } catch (err) {
    console.warn('Failed to remove source from IndexedDB', err);
  }
}

