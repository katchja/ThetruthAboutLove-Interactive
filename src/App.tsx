import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { CloudUpload, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Header } from './components/Header';
import { SourceDetailModal } from './components/SourceDetailModal';
import { AddSourceModal } from './components/AddSourceModal';
import { EditSourceModal } from './components/EditSourceModal';
import { SemanticSearchPanel } from './components/SemanticSearchPanel';
import { LandingPageView } from './components/LandingPageView';
import { ArchivePageView } from './components/ArchivePageView';
import { ConversationalPopupWindow } from './components/ConversationalPopupWindow';
import { BookSettingsModal } from './components/BookSettingsModal';
import { SafetyDisclosureModal } from './components/SafetyDisclosureModal';
import { PitchPageView } from './components/PitchPageView';
import { WhatsAppCompanionModal } from './components/WhatsAppCompanionModal';
import {
  Source,
  VectorChunk,
  ChatMessage,
  BookMetadata,
  Citation,
  AppView,
  ArchiveSection,
  SearchResult,
  ChatModelTier,
  GuardrailCategory,
  getSourceImages,
  getSourceSection,
} from './types';
import { defaultBookMetadata, seedSources } from './data/seedData';
import { evaluateQueryGuardrails } from './utils/chatGuardrails';
import {
  computeChunksForSource,
  indexSource,
  indexSourcesBatch,
  loadArchiveFromDB,
  removeSourceFromDB,
  semanticSearch,
  clearDeletedSourcesRegistry,
  getDeletedSourceIds,
  isPurgedArchiveSource,
  syncDeletedSourceIdsFromServer,
  syncDeletedAssetIdsFromServer,
} from './utils/vectorStore';
import {
  auth,
  AUTHOR_EMAIL,
  testFirestoreConnection,
  isVerifiedAuthorUser,
  signInStudioAuthor,
  signOutStudioAuthor,
} from './firebase';
import {
  fetchPublishedCloudArchive,
  saveSourceToCloud,
  deleteSourceFromCloud,
  saveBookMetadataToCloud,
  bootstrapCloudArchiveFromExisting,
  getPendingCloudMutations,
  enqueuePendingCloudMutation,
  clearAllPendingCloudMutations,
  getLocalDeletedAssetIds,
  recordLocalDeletedAssetId,
} from './utils/cloudArchive';
import {
  normalizeDataUrlToCloudAsset,
  extractAssetIdFromUrl,
} from './utils/imagePipeline';

function synthesizeGroundedResponse(
  query: string,
  searchResults: SearchResult[],
  allSources: Source[] = [],
  isStudioAdmin = false
): string {
  if (searchResults.length === 0) {
    return `Love is not an emotion—it is a fundamental life force and the unifying field of consciousness. No direct passage matched "${query}" in the selected filter; try selecting all archive sources to search the full manuscript.`;
  }

  const top = searchResults[0];
  const second = searchResults[1];

  const getSafeSynthesisSnippet = (sr: SearchResult, maxLen = 190) => {
    const parent = allSources.find((s) => s.id === sr.chunk.sourceId);
    const rawText =
      parent?.isProtected && !isStudioAdmin
        ? parent.summary || sr.chunk.sourceTitle
        : sr.chunk.text;

    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          !l.startsWith('Chapter ') &&
          !l.startsWith('By Catalina')
      );
    const joined = lines.join(' ');
    return joined.length > maxLen
      ? joined.substring(0, maxLen).trim() + '...'
      : joined;
  };

  let response = `In **${top.chunk.sourceTitle}** [Source 1], ${getSafeSynthesisSnippet(top, 195)}`;
  if (second) {
    response += ` This connects to **${second.chunk.sourceTitle}** [Source 2], showing how love acts as a syntropic life force rather than ego projection.`;
  } else {
    response += ` Love never wounds—only power distortions and ego projections create suffering [Source 1].`;
  }

  return response;
}

function collectSourceAssetIds(source?: Source | null): string[] {
  if (!source) return [];
  const ids = new Set<string>();
  if (source.coverAssetId) ids.add(source.coverAssetId);
  for (const a of source.assetIds || []) {
    if (a) ids.add(a);
  }
  for (const img of getSourceImages(source)) {
    const aid = extractAssetIdFromUrl(img);
    if (aid) ids.add(aid);
  }
  return Array.from(ids);
}

function computeSupersededAssetIds(
  previousSource: Source | null | undefined,
  nextSource: Source,
  otherSources: Source[]
): string[] {
  const prevAssets = collectSourceAssetIds(previousSource);
  if (prevAssets.length === 0) return [];

  const nextAssets = new Set(collectSourceAssetIds(nextSource));
  const usedElsewhere = new Set<string>();
  for (const other of otherSources) {
    if (!other || other.id === nextSource.id) continue;
    for (const aid of collectSourceAssetIds(other)) {
      usedElsewhere.add(aid);
    }
  }

  return prevAssets.filter((aid) => !nextAssets.has(aid) && !usedElsewhere.has(aid));
}

export default function App() {
  // Core application views: 'landing' (default homepage) | 'archive'
  const [currentView, setCurrentView] = useState<AppView>('landing');

  // Archive & Vector states — pre-populated synchronously from seed corpus so chat & counts work at t=0ms
  const [initialSeedSources] = useState<Source[]>(() => {
    const deleted = getDeletedSourceIds();
    return seedSources.filter((s) => !deleted.has(s.id) && !isPurgedArchiveSource(s));
  });
  const [sources, setSources] = useState<Source[]>(() => initialSeedSources);
  const sourcesRef = useRef<Source[]>(initialSeedSources);
  const [vectorChunks, setVectorChunks] = useState<VectorChunk[]>(() =>
    initialSeedSources.flatMap((s) => computeChunksForSource(s))
  );
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    initialSeedSources.map((s) => s.id)
  );
  const [, setIsLoadingArchive] = useState(true);

  // Conversational Chat state (locked exclusively to Gemini Flash-Lite)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatModel: ChatModelTier = 'gemini-3.1-flash-lite';
  const [isSemanticSearchOpen, setIsSemanticSearchOpen] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);

  // Book Metadata
  const [bookMetadata, setBookMetadata] =
    useState<BookMetadata>(defaultBookMetadata);
  const bookMetadataRef = useRef<BookMetadata>(defaultBookMetadata);

  // Modals
  const [activeSourceDetail, setActiveSourceDetail] = useState<Source | null>(
    null
  );
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [defaultAddSection, setDefaultAddSection] =
    useState<ArchiveSection>('authored');
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [completedDimensions, setCompletedDimensions] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('voicebook_completed_dimensions_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const handleCompleteDimension = useCallback((dimensionId: string) => {
    setCompletedDimensions((prev) => {
      if (prev.includes(dimensionId)) return prev;
      const next = [...prev, dimensionId];
      try {
        localStorage.setItem('voicebook_completed_dimensions_v1', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      fetch('/api/traction/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'dimensionsCompleted' }),
      }).catch(() => {});
      return next;
    });
  }, []);

  // Strict Google AI Studio Author & Admin detection:
  // Active only in Google AI Studio Build environment (ais-dev-* / localhost), hidden on public shared URLs (ais-pre-*)
  const isStudioBuildMode =
    typeof window !== 'undefined' &&
    !window.location.hostname.startsWith('ais-pre-') &&
    (window.location.hostname.startsWith('ais-dev-') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const [cloudAuthState, setCloudAuthState] = useState<
    'checking' | 'connected' | 'unauthenticated'
  >(isStudioBuildMode ? 'checking' : 'connected');
  const [pendingCloudCount, setPendingCloudCount] = useState<number>(() =>
    isStudioBuildMode ? getPendingCloudMutations().length : 0
  );
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const [syncedStats, setSyncedStats] = useState<{
    totalSources: number;
    photoCount: number;
    citationCount: number;
  }>({
    totalSources: 0,
    photoCount: 0,
    citationCount: 0,
  });

  const cloudBootstrappedRef = useRef(false);
  const initCompletedRef = useRef(false);
  const isFlushingCloudRef = useRef(false);

  const updateSourcesAndRef = useCallback(
    (updater: Source[] | ((prev: Source[]) => Source[])) => {
      setSources((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        sourcesRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    bookMetadataRef.current = bookMetadata;
  }, [bookMetadata]);

  const getAdminHeaders = () => ({
    'Content-Type': 'application/json',
    'x-studio-admin': 'true',
    'x-studio-author': 'true',
    'x-client-hostname':
      typeof window !== 'undefined' ? window.location.hostname : '',
  });

  const computeLocalStats = (list: Source[]) => {
    let photoCount = 0;
    let citationCount = 0;
    for (const s of list) {
      const imgs = getSourceImages(s);
      photoCount += imgs.length;
      if (getSourceSection(s) === 'references') {
        citationCount += 1;
      }
    }
    return {
      totalSources: list.length,
      photoCount,
      citationCount,
    };
  };

  const normalizeSourceImagesForClient = async (source: Source): Promise<Source> => {
    const rawImages = getSourceImages(source);
    const resolvedSection = getSourceSection(source);
    if (rawImages.length === 0) {
      return {
        ...source,
        section: resolvedSection,
        imageUrl: undefined,
        images: undefined,
      };
    }

    const normalized: string[] = [];
    for (const img of rawImages.slice(0, 24)) {
      if (!img) continue;
      if (img.startsWith('data:image/')) {
        const asset = await normalizeDataUrlToCloudAsset(img);
        const finalUrl = asset?.dataUrl || img;
        if (finalUrl && !normalized.includes(finalUrl)) {
          normalized.push(finalUrl);
        }
      } else if (!normalized.includes(img)) {
        normalized.push(img);
      }
    }

    return {
      ...source,
      section: resolvedSection,
      imageUrl: normalized[0] || undefined,
      images: normalized.length > 0 ? normalized : undefined,
    };
  };

  /**
   * Mirrors the current canonical archive snapshot to the Express server's local cache
   * so SSR/SEO routes (/sitemap.xml, /llms-full.txt) and /api/archive reflect changes immediately.
   */
  const mirrorFullArchiveToServer = async (
    targetSources: Source[],
    targetDeletedIds: string[],
    targetMetadata: BookMetadata
  ): Promise<void> => {
    if (!isStudioBuildMode) return;
    const deletedAssetIds = Array.from(getLocalDeletedAssetIds());
    const syncRes = await fetch('/api/archive/sync', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({
        sources: targetSources,
        deletedIds: targetDeletedIds,
        deletedAssetIds,
        bookMetadata: targetMetadata,
      }),
    });
    if (!syncRes.ok) {
      throw new Error(`Server mirror sync failed (${syncRes.status})`);
    }
  };

  /**
   * Flushes pending local mutations or bootstraps Cloud Firestore when the verified
   * Studio Author (butnaru.catalina@gmail.com) is authenticated.
   */
  const syncCloudForVerifiedAuthor = useCallback(
    async (forceFullSync = false): Promise<void> => {
      if (!isStudioBuildMode || !isVerifiedAuthorUser(auth.currentUser)) {
        return;
      }
      if (isFlushingCloudRef.current) return;
      isFlushingCloudRef.current = true;
      setSyncStatus('syncing');
      setSyncErrorMessage(null);

      try {
        const cloudSnap = await fetchPublishedCloudArchive(true);

        if (!cloudSnap.hasCloudData || forceFullSync) {
          // Migrate all active chapters, literature references, tombstones, and card artworks to Firestore
          const migrated = await bootstrapCloudArchiveFromExisting(
            sourcesRef.current,
            Array.from(getDeletedSourceIds()),
            bookMetadataRef.current
          );
          cloudBootstrappedRef.current = true;
          clearAllPendingCloudMutations();
          setPendingCloudCount(0);

          const indexedChunks = await indexSourcesBatch(migrated);
          updateSourcesAndRef(migrated);
          setVectorChunks(indexedChunks);
          setSelectedSourceIds(migrated.map((s) => s.id));
          setSyncedStats(computeLocalStats(migrated));

          await mirrorFullArchiveToServer(
            migrated,
            Array.from(getDeletedSourceIds()),
            bookMetadataRef.current
          );
          setSyncStatus('synced');
          return;
        }

        cloudBootstrappedRef.current = true;
        const queue = getPendingCloudMutations();

        if (queue.length > 0) {
          for (const item of queue) {
            if (item.kind === 'save_metadata') {
              await saveBookMetadataToCloud(bookMetadataRef.current);
            } else if (item.kind === 'delete_source') {
              await deleteSourceFromCloud(item.targetId, null, sourcesRef.current);
            } else if (item.kind === 'upsert_source') {
              const target = sourcesRef.current.find((s) => s.id === item.targetId);
              if (target) {
                const others = sourcesRef.current.filter((s) => s.id !== target.id);
                const { persistedSource, purgedAssetIds } = await saveSourceToCloud(
                  target,
                  null,
                  others
                );
                updateSourcesAndRef((prev) =>
                  prev.map((s) => (s.id === persistedSource.id ? persistedSource : s))
                );
                await fetch('/api/archive/source', {
                  method: 'POST',
                  headers: getAdminHeaders(),
                  body: JSON.stringify({
                    source: persistedSource,
                    purgedAssetIds: [
                      ...(item.purgedAssetIds || []),
                      ...purgedAssetIds,
                    ],
                  }),
                }).catch(() => {});
              }
            }
          }
          clearAllPendingCloudMutations();
          setPendingCloudCount(0);
        }

        // Refresh full cloud state (including private_content/full for verified author)
        const refreshed = await fetchPublishedCloudArchive(true);
        if (refreshed.hasCloudData) {
          syncDeletedSourceIdsFromServer(refreshed.deletedSourceIds);
          syncDeletedAssetIdsFromServer(refreshed.deletedAssetIds);
          if (refreshed.bookMetadata) {
            setBookMetadata(refreshed.bookMetadata);
            bookMetadataRef.current = refreshed.bookMetadata;
          }
          const indexedChunks = await indexSourcesBatch(refreshed.sources);
          updateSourcesAndRef(refreshed.sources);
          setVectorChunks(indexedChunks);
          setSelectedSourceIds(refreshed.sources.map((s) => s.id));
          setSyncedStats(computeLocalStats(refreshed.sources));
          await mirrorFullArchiveToServer(
            refreshed.sources,
            refreshed.deletedSourceIds,
            refreshed.bookMetadata || bookMetadataRef.current
          ).catch(() => {});
        }

        setSyncStatus('synced');
      } catch (err) {
        const rawMsg = err instanceof Error ? err.message : String(err);
        console.error('Cloud archive synchronization error:', rawMsg);
        setSyncErrorMessage(
          'Cloud save encountered an error. Click Retry to sync changes to Firestore.'
        );
        setSyncStatus('error');
      } finally {
        isFlushingCloudRef.current = false;
      }
    },
    [isStudioBuildMode, updateSourcesAndRef]
  );

  const handleConnectCloudAuthor = useCallback(async (): Promise<boolean> => {
    if (!isStudioBuildMode) return false;
    setSyncErrorMessage(null);
    try {
      const user = await signInStudioAuthor();
      if (!isVerifiedAuthorUser(user)) {
        await signOutStudioAuthor().catch(() => {});
        setCloudAuthState('unauthenticated');
        setSyncErrorMessage(
          `Please sign in with the verified author account (${AUTHOR_EMAIL}) to write to Cloud Firestore.`
        );
        setSyncStatus('error');
        return false;
      }
      setCloudAuthState('connected');
      await syncCloudForVerifiedAuthor(false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignore benign popup-closed-by-user / blocked notices while keeping honest unauthenticated banner
      if (
        msg.includes('popup-closed-by-user') ||
        msg.includes('popup-blocked') ||
        msg.includes('cancelled-popup-request')
      ) {
        setCloudAuthState('unauthenticated');
        return false;
      }
      setSyncErrorMessage(
        'Author Google sign-in could not complete. Click Connect Cloud Auto-Save to try again.'
      );
      setSyncStatus('error');
      return false;
    }
  }, [isStudioBuildMode, syncCloudForVerifiedAuthor]);

  /**
   * Explicit manual Cloud Sync / Retry action from Studio toolbar
   */
  const publishArchiveToPublic = async () => {
    if (!isStudioBuildMode) return;
    if (!isVerifiedAuthorUser(auth.currentUser)) {
      await handleConnectCloudAuthor();
      return;
    }
    await syncCloudForVerifiedAuthor(true);
  };

  // Subscribe to Firebase Auth state inside Studio preview only
  useEffect(() => {
    if (!isStudioBuildMode) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isVerifiedAuthorUser(user)) {
        setCloudAuthState('connected');
        if (initCompletedRef.current) {
          syncCloudForVerifiedAuthor(false).catch(() => {});
        }
      } else {
        setCloudAuthState('unauthenticated');
      }
    });
    return () => unsubscribe();
  }, [isStudioBuildMode, syncCloudForVerifiedAuthor]);

  // 1. Initialize Archive: Reconcile Cloud Firestore + Express Mirror + IndexedDB
  useEffect(() => {
    async function init() {
      setIsLoadingArchive(true);
      testFirestoreConnection().catch(() => {});

      try {
        // Wait briefly for Firebase Auth persistence restoration in Studio
        if (isStudioBuildMode && typeof auth.authStateReady === 'function') {
          await Promise.race([
            auth.authStateReady(),
            new Promise((resolve) => setTimeout(resolve, 2000)),
          ]);
        }

        if (isStudioBuildMode) {
          setCloudAuthState(
            isVerifiedAuthorUser(auth.currentUser) ? 'connected' : 'unauthenticated'
          );
        }

        const [cloudResult, serverResponse, stored] = await Promise.all([
          Promise.race([
            fetchPublishedCloudArchive(isStudioBuildMode),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Cloud Firestore read timed out')), 5000)
            ),
          ]).catch((err) => {
            console.warn('Cloud Firestore initial read fallback:', err);
            return {
              sources: [] as Source[],
              deletedSourceIds: [] as string[],
              deletedAssetIds: [] as string[],
              bookMetadata: undefined,
              hasCloudData: false,
            };
          }),
          fetch(`/api/archive?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          })
            .then(async (res) => (res.ok ? res.json() : null))
            .catch(() => null),
          loadArchiveFromDB(),
        ]);

        const serverSources: Source[] = Array.isArray(serverResponse?.sources)
          ? serverResponse.sources
          : [];
        const serverDeletedIds: string[] = Array.isArray(serverResponse?.deletedIds)
          ? serverResponse.deletedIds
          : [];
        const serverDeletedAssetIds: string[] = Array.isArray(
          serverResponse?.deletedAssetIds
        )
          ? serverResponse.deletedAssetIds
          : [];
        const serverMetadata: BookMetadata | undefined =
          serverResponse?.bookMetadata && typeof serverResponse.bookMetadata === 'object'
            ? serverResponse.bookMetadata
            : undefined;

        const localDeletedIds = isStudioBuildMode
          ? Array.from(getDeletedSourceIds())
          : [];
        const localDeletedAssets = isStudioBuildMode
          ? Array.from(getLocalDeletedAssetIds())
          : [];

        const combinedDeletedSources = new Set<string>([
          ...cloudResult.deletedSourceIds,
          ...serverDeletedIds,
          ...localDeletedIds,
        ]);
        const combinedDeletedAssets = new Set<string>([
          ...cloudResult.deletedAssetIds,
          ...serverDeletedAssetIds,
          ...localDeletedAssets,
        ]);

        syncDeletedSourceIdsFromServer(Array.from(combinedDeletedSources));
        syncDeletedAssetIdsFromServer(Array.from(combinedDeletedAssets));

        const resolvedMetadata =
          cloudResult.bookMetadata || serverMetadata || defaultBookMetadata;
        setBookMetadata(resolvedMetadata);
        bookMetadataRef.current = resolvedMetadata;

        const cleanSourceAssets = (s: Source): Source => {
          const validImgs = getSourceImages(s).filter((u) => {
            const aid = extractAssetIdFromUrl(u);
            return !(aid && combinedDeletedAssets.has(aid));
          });
          return {
            ...s,
            section: getSourceSection(s),
            imageUrl: validImgs[0] || undefined,
            images: validImgs.length > 0 ? validImgs : undefined,
          };
        };

        const byId = new Map<string, Source>();

        if (cloudResult.hasCloudData) {
          cloudBootstrappedRef.current = true;
          for (const cSrc of cloudResult.sources) {
            if (
              cSrc &&
              cSrc.id &&
              !combinedDeletedSources.has(cSrc.id) &&
              !isPurgedArchiveSource(cSrc)
            ) {
              byId.set(cSrc.id, cleanSourceAssets(cSrc));
            }
          }
          // Include newly added bundled/seed references that have never been tombstoned
          // and enqueue them for automatic Firestore persistence in Studio
          for (const candidate of [...serverSources, ...seedSources]) {
            if (
              candidate &&
              candidate.id &&
              !byId.has(candidate.id) &&
              !combinedDeletedSources.has(candidate.id) &&
              !isPurgedArchiveSource(candidate)
            ) {
              byId.set(candidate.id, cleanSourceAssets(candidate));
              if (isStudioBuildMode) {
                enqueuePendingCloudMutation({
                  kind: 'upsert_source',
                  targetId: candidate.id,
                  timestamp: candidate.updatedAt || Date.now(),
                });
              }
            }
          }
        } else if (serverSources.length > 0) {
          for (const srv of serverSources) {
            if (
              srv &&
              srv.id &&
              !combinedDeletedSources.has(srv.id) &&
              !isPurgedArchiveSource(srv)
            ) {
              byId.set(srv.id, cleanSourceAssets(srv));
            }
          }
        } else {
          for (const seed of seedSources) {
            if (
              !combinedDeletedSources.has(seed.id) &&
              !isPurgedArchiveSource(seed)
            ) {
              byId.set(seed.id, cleanSourceAssets(seed));
            }
          }
        }

        // Preserve any pending local Studio edits that haven't flushed to Cloud Firestore yet
        if (isStudioBuildMode) {
          const pendingMutations = getPendingCloudMutations();
          const pendingUpsertIds = new Set(
            pendingMutations
              .filter((m) => m.kind === 'upsert_source')
              .map((m) => m.targetId)
          );
          const pendingDeleteIds = new Set(
            pendingMutations
              .filter((m) => m.kind === 'delete_source')
              .map((m) => m.targetId)
          );

          for (const delId of pendingDeleteIds) {
            byId.delete(delId);
          }

          for (const loc of stored.sources) {
            if (
              !loc ||
              !loc.id ||
              combinedDeletedSources.has(loc.id) ||
              pendingDeleteIds.has(loc.id) ||
              isPurgedArchiveSource(loc)
            ) {
              continue;
            }

            const existing = byId.get(loc.id);
            const locUpdated = loc.updatedAt || 0;
            const exUpdated = existing?.updatedAt || 0;

            const shouldKeepLocal =
              pendingUpsertIds.has(loc.id) ||
              (!cloudResult.hasCloudData && (!existing || locUpdated > exUpdated));

            if (shouldKeepLocal) {
              byId.set(loc.id, cleanSourceAssets(loc));
              if (!pendingUpsertIds.has(loc.id)) {
                enqueuePendingCloudMutation({
                  kind: 'upsert_source',
                  targetId: loc.id,
                  timestamp: locUpdated || Date.now(),
                });
              }
            }
          }

          setPendingCloudCount(getPendingCloudMutations().length);
        }

        const finalSources = Array.from(byId.values());
        const allIndexedChunks = await indexSourcesBatch(finalSources);

        updateSourcesAndRef(finalSources);
        setVectorChunks(allIndexedChunks);
        setSelectedSourceIds(finalSources.map((s) => s.id));
        setSyncedStats(computeLocalStats(finalSources));
        initCompletedRef.current = true;

        if (isStudioBuildMode) {
          if (isVerifiedAuthorUser(auth.currentUser)) {
            await syncCloudForVerifiedAuthor(false);
          } else if (cloudResult.hasCloudData && getPendingCloudMutations().length === 0) {
            setSyncStatus('synced');
          } else {
            setSyncStatus('idle');
          }
        }
      } catch (err) {
        console.warn('Archive initialization fallback:', err);
        const deletedSet = getDeletedSourceIds();
        const activeSeeds = seedSources.filter((s) => !deletedSet.has(s.id));
        const fallbackChunks = activeSeeds.flatMap((s) => computeChunksForSource(s));
        updateSourcesAndRef(activeSeeds);
        setVectorChunks(fallbackChunks);
        setSelectedSourceIds(activeSeeds.map((s) => s.id));
        initCompletedRef.current = true;
      } finally {
        setIsLoadingArchive(false);
      }
    }

    init().catch(() => {});
  }, [isStudioBuildMode, syncCloudForVerifiedAuthor, updateSourcesAndRef]);

  // Create new chapter or literature entry with automatic Cloud Firestore persistence
  const handleAddSource = async (newSource: Source) => {
    if (!isStudioBuildMode) return;
    setSyncStatus('syncing');
    setSyncErrorMessage(null);

    try {
      const prepared = await normalizeSourceImagesForClient({
        ...newSource,
        createdAt: newSource.createdAt || Date.now(),
        updatedAt: Date.now(),
      });

      // Optimistic local state + vector indexing
      const optimisticChunks = await indexSource(prepared);
      const otherSources = sourcesRef.current.filter((s) => s.id !== prepared.id);
      const optimisticList = [prepared, ...otherSources];
      updateSourcesAndRef(optimisticList);
      setVectorChunks((prev) => [
        ...optimisticChunks,
        ...prev.filter((c) => c.sourceId !== prepared.id),
      ]);
      setSelectedSourceIds((prev) =>
        prev.includes(prepared.id) ? prev : [prepared.id, ...prev]
      );

      if (isVerifiedAuthorUser(auth.currentUser)) {
        const { persistedSource, purgedAssetIds } = await saveSourceToCloud(
          prepared,
          null,
          otherSources
        );
        const finalChunks = await indexSource(persistedSource);
        updateSourcesAndRef((prev) =>
          prev.map((s) => (s.id === prepared.id ? persistedSource : s))
        );
        setVectorChunks((prev) => [
          ...finalChunks,
          ...prev.filter(
            (c) => c.sourceId !== prepared.id && c.sourceId !== persistedSource.id
          ),
        ]);
        setSyncedStats(computeLocalStats(sourcesRef.current));

        await fetch('/api/archive/source', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({ source: persistedSource, purgedAssetIds }),
        }).catch(() => {});

        setSyncStatus('synced');
      } else {
        await fetch('/api/archive/source', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({ source: prepared }),
        }).catch(() => {});

        enqueuePendingCloudMutation({
          kind: 'upsert_source',
          targetId: prepared.id,
          timestamp: Date.now(),
        });
        setPendingCloudCount(getPendingCloudMutations().length);
        setSyncedStats(computeLocalStats(sourcesRef.current));
        setSyncStatus('idle');
        await handleConnectCloudAuthor();
      }
    } catch (err) {
      console.error('Failed to add source to cloud archive:', err);
      setSyncErrorMessage('Failed to save new entry to Cloud Firestore. Click Retry.');
      setSyncStatus('error');
    }
  };

  // Update existing chapter / literature entry, purge any replaced cover assets, and auto-save to Cloud Firestore
  const handleUpdateSource = async (updatedSource: Source) => {
    if (!isStudioBuildMode) return;
    setSyncStatus('syncing');
    setSyncErrorMessage(null);

    const previousSource =
      sourcesRef.current.find((s) => s.id === updatedSource.id) || null;
    const otherSources = sourcesRef.current.filter(
      (s) => s.id !== updatedSource.id
    );

    try {
      const prepared = await normalizeSourceImagesForClient({
        ...updatedSource,
        updatedAt: Date.now(),
      });

      const localPurgedAssetIds = computeSupersededAssetIds(
        previousSource,
        prepared,
        otherSources
      );
      for (const aid of localPurgedAssetIds) {
        recordLocalDeletedAssetId(aid);
      }

      // Immediate UI & local vector update (using functional state + ref, never stale closures)
      const optimisticChunks = await indexSource(prepared);
      updateSourcesAndRef((prev) =>
        prev.map((s) => (s.id === prepared.id ? prepared : s))
      );
      setVectorChunks((prev) => [
        ...prev.filter((c) => c.sourceId !== prepared.id),
        ...optimisticChunks,
      ]);
      setActiveSourceDetail((prev) =>
        prev && prev.id === prepared.id ? prepared : prev
      );
      setEditingSource((prev) =>
        prev && prev.id === prepared.id ? prepared : prev
      );

      if (isVerifiedAuthorUser(auth.currentUser)) {
        const { persistedSource, purgedAssetIds } = await saveSourceToCloud(
          prepared,
          previousSource,
          otherSources
        );
        const allPurged = Array.from(
          new Set([...localPurgedAssetIds, ...purgedAssetIds])
        );

        const finalChunks = await indexSource(persistedSource);
        updateSourcesAndRef((prev) =>
          prev.map((s) =>
            s.id === prepared.id || s.id === persistedSource.id
              ? persistedSource
              : s
          )
        );
        setVectorChunks((prev) => [
          ...prev.filter(
            (c) =>
              c.sourceId !== prepared.id && c.sourceId !== persistedSource.id
          ),
          ...finalChunks,
        ]);
        setActiveSourceDetail((prev) =>
          prev && (prev.id === prepared.id || prev.id === persistedSource.id)
            ? persistedSource
            : prev
        );
        setSyncedStats(computeLocalStats(sourcesRef.current));

        await fetch('/api/archive/source', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            source: persistedSource,
            purgedAssetIds: allPurged,
          }),
        }).catch(() => {});

        setSyncStatus('synced');
      } else {
        // Mirror to preview server immediately and queue permanent cloud write
        const srvRes = await fetch('/api/archive/source', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            source: prepared,
            purgedAssetIds: localPurgedAssetIds,
          }),
        }).catch(() => null);

        if (srvRes && srvRes.ok) {
          const srvJson = await srvRes.json().catch(() => null);
          if (srvJson?.source) {
            const hydratedSrv: Source = {
              ...prepared,
              imageUrl: srvJson.source.imageUrl || undefined,
              images:
                Array.isArray(srvJson.source.images) &&
                srvJson.source.images.length > 0
                  ? srvJson.source.images
                  : undefined,
            };
            await indexSource(hydratedSrv);
            updateSourcesAndRef((prev) =>
              prev.map((s) => (s.id === hydratedSrv.id ? hydratedSrv : s))
            );
            setActiveSourceDetail((prev) =>
              prev && prev.id === hydratedSrv.id ? hydratedSrv : prev
            );
          }
        }

        enqueuePendingCloudMutation({
          kind: 'upsert_source',
          targetId: prepared.id,
          timestamp: Date.now(),
          purgedAssetIds: localPurgedAssetIds,
        });
        setPendingCloudCount(getPendingCloudMutations().length);
        setSyncedStats(computeLocalStats(sourcesRef.current));
        setSyncStatus('idle');
        await handleConnectCloudAuthor();
      }
    } catch (err) {
      console.error('Failed to update source in cloud archive:', err);
      enqueuePendingCloudMutation({
        kind: 'upsert_source',
        targetId: updatedSource.id,
        timestamp: Date.now(),
      });
      setPendingCloudCount(getPendingCloudMutations().length);
      setSyncErrorMessage(
        'Chapter edit could not reach Cloud Firestore yet. Queued locally—click Retry to sync.'
      );
      setSyncStatus('error');
    }
  };

  // Default Cover Replacement: Uploading on a card replaces images[0] (the cover) and purges the old cover asset
  const handleAddPicturesToSource = async (
    targetSource: Source,
    dataUrls: string[]
  ) => {
    if (!isStudioBuildMode || dataUrls.length === 0) return;
    const latestTarget =
      sourcesRef.current.find((s) => s.id === targetSource.id) || targetSource;
    const existingImages = getSourceImages(latestTarget);

    const incomingClean: string[] = [];
    for (const url of dataUrls) {
      if (url && !incomingClean.includes(url)) {
        incomingClean.push(url);
      }
    }
    if (incomingClean.length === 0) return;

    // Replace primary cover (images[0]) while preserving any supplemental scans (existingImages.slice(1))
    const nextImages =
      existingImages.length > 0
        ? [
            ...incomingClean,
            ...existingImages
              .slice(1)
              .filter((u) => !incomingClean.includes(u)),
          ]
        : incomingClean;

    const updatedSource: Source = {
      ...latestTarget,
      imageUrl: nextImages[0] || undefined,
      images: nextImages.length > 0 ? nextImages : undefined,
      updatedAt: Date.now(),
    };

    await handleUpdateSource(updatedSource);
  };

  // Remove a specific picture (or all pictures if imageIndex is omitted) and purge its cloud/disk asset
  const handleRemovePictureFromSource = async (
    targetSource: Source,
    imageIndex?: number
  ) => {
    if (!isStudioBuildMode) return;
    const latestTarget =
      sourcesRef.current.find((s) => s.id === targetSource.id) || targetSource;
    const existingImages = getSourceImages(latestTarget);
    const remainingImages =
      typeof imageIndex === 'number'
        ? existingImages.filter((_, idx) => idx !== imageIndex)
        : [];

    const updatedSource: Source = {
      ...latestTarget,
      imageUrl: remainingImages[0] || undefined,
      images: remainingImages.length > 0 ? remainingImages : undefined,
      updatedAt: Date.now(),
    };

    await handleUpdateSource(updatedSource);
  };

  // Permanently delete card, record tombstone, and purge its image assets from Cloud Firestore & disk
  const handleDeleteSource = async (id: string) => {
    if (!isStudioBuildMode) return;
    const previousSource =
      sourcesRef.current.find((s) => s.id === id) || null;
    const remainingSources = sourcesRef.current.filter((s) => s.id !== id);

    setSyncStatus('syncing');
    setSyncErrorMessage(null);

    try {
      const candidateAssets = computeSupersededAssetIds(
        previousSource,
        { ...(previousSource || ({ id } as Source)), imageUrl: undefined, images: undefined, coverAssetId: undefined, assetIds: undefined },
        remainingSources
      );
      for (const aid of candidateAssets) {
        recordLocalDeletedAssetId(aid);
      }

      await removeSourceFromDB(id, true);
      updateSourcesAndRef(remainingSources);
      setVectorChunks((prev) => prev.filter((c) => c.sourceId !== id));
      setSelectedSourceIds((prev) => prev.filter((itemId) => itemId !== id));
      setActiveSourceDetail((prev) => (prev && prev.id === id ? null : prev));
      setEditingSource((prev) => (prev && prev.id === id ? null : prev));
      setSyncedStats(computeLocalStats(remainingSources));

      await fetch(`/api/archive/source/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      }).catch(() => {});

      if (isVerifiedAuthorUser(auth.currentUser)) {
        await deleteSourceFromCloud(id, previousSource, remainingSources);
        setSyncStatus('synced');
      } else {
        enqueuePendingCloudMutation({
          kind: 'delete_source',
          targetId: id,
          timestamp: Date.now(),
          purgedAssetIds: candidateAssets,
        });
        setPendingCloudCount(getPendingCloudMutations().length);
        setSyncStatus('idle');
        await handleConnectCloudAuthor();
      }
    } catch (err) {
      console.error('Failed to delete source from cloud archive:', err);
      enqueuePendingCloudMutation({
        kind: 'delete_source',
        targetId: id,
        timestamp: Date.now(),
      });
      setPendingCloudCount(getPendingCloudMutations().length);
      setSyncErrorMessage('Card deletion queued locally—click Retry to finalize in Firestore.');
      setSyncStatus('error');
    }
  };

  const handleSaveBookMetadata = async (newMetadata: BookMetadata) => {
    if (!isStudioBuildMode) return;
    setBookMetadata(newMetadata);
    bookMetadataRef.current = newMetadata;
    setSyncStatus('syncing');
    setSyncErrorMessage(null);

    try {
      await fetch('/api/archive/metadata', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ bookMetadata: newMetadata }),
      }).catch(() => {});

      if (isVerifiedAuthorUser(auth.currentUser)) {
        await saveBookMetadataToCloud(newMetadata);
        setSyncStatus('synced');
      } else {
        enqueuePendingCloudMutation({
          kind: 'save_metadata',
          targetId: 'book_metadata',
          timestamp: Date.now(),
        });
        setPendingCloudCount(getPendingCloudMutations().length);
        setSyncStatus('idle');
        await handleConnectCloudAuthor();
      }
    } catch (err) {
      console.error('Failed to persist book metadata to cloud:', err);
      setSyncErrorMessage('Book settings could not sync to Firestore. Click Retry.');
      setSyncStatus('error');
    }
  };

  // Reset book metadata & archive to default seed corpus (Google Studio Author Only)
  const handleResetToDefault = async () => {
    if (!isStudioBuildMode) return;
    setSyncStatus('syncing');
    setSyncErrorMessage(null);
    try {
      clearDeletedSourcesRegistry();
      setBookMetadata(defaultBookMetadata);
      bookMetadataRef.current = defaultBookMetadata;
      const allIndexedChunks = await indexSourcesBatch(seedSources);
      updateSourcesAndRef(seedSources);
      setVectorChunks(allIndexedChunks);
      setSelectedSourceIds(seedSources.map((s) => s.id));

      if (isVerifiedAuthorUser(auth.currentUser)) {
        await syncCloudForVerifiedAuthor(true);
      } else {
        await mirrorFullArchiveToServer(seedSources, [], defaultBookMetadata);
        setSyncStatus('idle');
      }
    } catch (err) {
      console.warn('Failed to reset archive:', err);
      setSyncStatus('error');
    }
  };

  // Core Conversational Query Handler
  const handleSendMessage = async (query: string) => {
    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsChatLoading(true);

    // 0. Client-side pre-flight guardrail check (works in both online & offline modes)
    const guardrailCheck = evaluateQueryGuardrails(query);
    if (!guardrailCheck.allowed && guardrailCheck.refusalReply) {
      const guardrailMessage: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: guardrailCheck.refusalReply,
        timestamp: Date.now(),
        model: isOfflineMode ? 'Local Safety Guardrail' : chatModel,
        isOffline: isOfflineMode,
        guardrailCategory: guardrailCheck.category,
      };
      setMessages((prev) => [...prev, guardrailMessage]);
      setIsChatLoading(false);
      return;
    }

    // 1. Retrieve top matching vector passages from local vector store
    const activeSources =
      sourcesRef.current.length > 0 ? sourcesRef.current : seedSources;
    let searchResults: SearchResult[] = [];
    let citations: Citation[] = [];

    try {
      const effectiveChunks =
        vectorChunks.length > 0
          ? vectorChunks
          : activeSources.flatMap((s) => computeChunksForSource(s));

      searchResults = await semanticSearch(
        query,
        effectiveChunks,
        selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
        5
      );

      citations = searchResults.map((sr, idx) => ({
        sourceId: sr.chunk.sourceId,
        sourceTitle: sr.chunk.sourceTitle,
        sourceType: sr.chunk.sourceType,
        reference: sr.chunk.reference,
        snippet: sr.chunk.text,
        index: idx + 1,
      }));
    } catch (searchErr) {
      console.warn('Local vector search fallback:', searchErr);
    }

    try {
      // 2. If in strict Offline Privacy Mode: synthesize locally without external API calls
      if (isOfflineMode) {
        const localAnswer = synthesizeGroundedResponse(
          query,
          searchResults,
          activeSources,
          isStudioBuildMode
        );

        const assistantMessage: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: localAnswer,
          timestamp: Date.now(),
          citations,
          isOffline: true,
          model: 'Local Vector Synthesizer',
          guardrailCategory: 'safe',
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setIsChatLoading(false);
        return;
      }

      // 3. Otherwise: Server-Side Gemini proxy with retrieved contexts and selected model tier
      const contexts = searchResults.map((sr, idx) => {
        const parentSource = activeSources.find((s) => s.id === sr.chunk.sourceId);
        return {
          id: sr.chunk.id,
          title: sr.chunk.sourceTitle,
          type: sr.chunk.sourceType,
          reference: sr.chunk.reference,
          snippet: sr.chunk.text,
          isProtected: Boolean(parentSource?.isProtected),
          index: idx + 1,
        };
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          contexts,
          history: messages.slice(-8),
          bookTitle: bookMetadata.title,
          authorName: bookMetadata.author,
          model: chatModel,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      let data: {
        reply?: string;
        model?: string;
        error?: string;
        guardrailCategory?: GuardrailCategory;
      } | null = null;
      if (
        contentType.includes('application/json') &&
        !rawText.trim().startsWith('<')
      ) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }

      if (!response.ok || !data || !data.reply) {
        const fallbackReply = synthesizeGroundedResponse(
          query,
          searchResults,
          activeSources,
          isStudioBuildMode
        );
        const assistantMessage: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: fallbackReply,
          timestamp: Date.now(),
          citations,
          model: 'Local Vector Synthesizer',
          isOffline: true,
          guardrailCategory: 'safe',
        };
        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      const isGuardrailRefusal =
        data.guardrailCategory && data.guardrailCategory !== 'safe';

      const assistantMessage: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
        citations: isGuardrailRefusal ? undefined : citations,
        model: data.model || chatModel,
        isOffline: false,
        guardrailCategory: data.guardrailCategory || 'safe',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const fallbackReply = synthesizeGroundedResponse(
        query,
        searchResults,
        activeSources,
        isStudioBuildMode
      );
      const fallbackMessage: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: fallbackReply,
        timestamp: Date.now(),
        citations,
        model: 'Local Vector Synthesizer',
        isOffline: true,
        guardrailCategory: 'safe',
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const selectedSourcesList = sources.filter((s) =>
    selectedSourceIds.includes(s.id)
  );

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0B0B0C] flex flex-col font-sans selection:bg-[#E8EAED] selection:text-[#0B0B0C]">
      {/* Global Header */}
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        isOfflineMode={isOfflineMode}
        setIsOfflineMode={setIsOfflineMode}
        bookMetadata={bookMetadata}
        onOpenBookSettings={
          isStudioBuildMode ? () => setIsBookSettingsOpen(true) : undefined
        }
        onToggleSemanticSearch={() =>
          setIsSemanticSearchOpen(!isSemanticSearchOpen)
        }
        isSemanticSearchOpen={isSemanticSearchOpen}
        totalSourcesCount={sources.length}
        totalChunksCount={vectorChunks.length}
        onOpenChatPopup={() => setIsChatPopupOpen(true)}
        onPublishToPublic={
          isStudioBuildMode ? () => publishArchiveToPublic() : undefined
        }
        syncStatus={syncStatus}
        syncedStats={syncedStats}
        onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
      />

      {/* Studio-Only Author Cloud Auto-Save Bar (Strictly hidden on public shared ais-pre-* URLs) */}
      {isStudioBuildMode &&
        (cloudAuthState === 'unauthenticated' || syncStatus === 'error') && (
          <div className="bg-[#FAF6F0] border-b border-[#EAE1D9] px-4 py-2 text-xs">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#241B1C]">
                {syncStatus === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-[#C83E0B] shrink-0" />
                ) : (
                  <CloudUpload className="w-4 h-4 text-[#C83E0B] shrink-0" />
                )}
                <span>
                  {syncErrorMessage
                    ? syncErrorMessage
                    : pendingCloudCount > 0
                    ? `Studio Author Mode: ${pendingCloudCount} chapter/asset edit${pendingCloudCount === 1 ? '' : 's'} ready to persist permanently to Cloud Firestore.`
                    : `Studio Author Mode: Connect ${AUTHOR_EMAIL} once to enable automatic permanent Cloud Firestore saving for all chapter edits & cover replacements.`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cloudAuthState === 'unauthenticated' ? (
                  <button
                    type="button"
                    onClick={() => handleConnectCloudAuthor()}
                    className="px-3.5 py-1.5 rounded-lg bg-[#C83E0B] hover:bg-[#A93207] text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Connect Cloud Auto-Save</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => publishArchiveToPublic()}
                    disabled={syncStatus === 'syncing'}
                    className="px-3.5 py-1.5 rounded-lg bg-[#C83E0B] hover:bg-[#A93207] text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {syncStatus === 'syncing' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Retry Cloud Save</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      {/* VIEW: Dedicated References & Archive Repository Page */}
      {currentView === 'archive' && (
        <ArchivePageView
          sources={sources}
          bookMetadata={bookMetadata}
          onOpenSourceDetail={(s) => setActiveSourceDetail(s)}
          onOpenAddSource={
            isStudioBuildMode
              ? (section) => {
                  setDefaultAddSection(section || 'authored');
                  setIsAddSourceOpen(true);
                }
              : undefined
          }
          onAskAboutSourceInStudio={(s) => {
            if (!selectedSourceIds.includes(s.id)) {
              setSelectedSourceIds((prev) => [...prev, s.id]);
            }
            setIsChatPopupOpen(true);
            handleSendMessage(
              `Summarize the core insights and citations from "${s.title}"`
            );
          }}
          onEditSource={
            isStudioBuildMode ? (s) => setEditingSource(s) : undefined
          }
          onAddPicturesToSource={
            isStudioBuildMode ? handleAddPicturesToSource : undefined
          }
          onRemovePictureFromSource={
            isStudioBuildMode ? handleRemovePictureFromSource : undefined
          }
          onDeleteSource={isStudioBuildMode ? handleDeleteSource : undefined}
          isStudioAdmin={isStudioBuildMode}
          totalVectorChunks={vectorChunks.length}
          onReturnHome={() => {
            setCurrentView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPublishToPublic={
            isStudioBuildMode ? () => publishArchiveToPublic() : undefined
          }
          syncStatus={syncStatus}
          syncedStats={syncedStats}
          cloudAuthState={cloudAuthState}
          onConnectCloudAuthor={
            isStudioBuildMode ? handleConnectCloudAuthor : undefined
          }
          pendingCloudCount={pendingCloudCount}
          syncErrorMessage={syncErrorMessage}
        />
      )}

      {/* VIEW: VoiceBook Investor Pitch & Author SaaS Studio Page */}
      {currentView === 'pitch' && (
        <PitchPageView
          sources={sources}
          onReturnToManuscript={() => {
            setCurrentView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenArchive={() => {
            setCurrentView('archive');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
          completedDimensionsCount={completedDimensions.length}
        />
      )}

      {/* VIEW: Book Landing Page Mode (Default Homepage with Conversational Q&A) */}
      {currentView === 'landing' && (
        <LandingPageView
          bookMetadata={bookMetadata}
          sources={sources}
          selectedSources={selectedSourcesList}
          onOpenArchive={() => setCurrentView('archive')}
          onSelectSource={(s) => setActiveSourceDetail(s)}
          messages={messages}
          onSendMessage={handleSendMessage}
          isChatLoading={isChatLoading}
          onClearChat={() => setMessages([])}
          chatModel={chatModel}
          isOfflineMode={isOfflineMode}
          onOpenSafetyModal={() => setIsSafetyModalOpen(true)}
          onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
          onOpenPitchPage={() => {
            setCurrentView('pitch');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          completedDimensions={completedDimensions}
          onCompleteDimension={handleCompleteDimension}
        />
      )}

      {/* WHATSAPP VOICEBOOK COMPANION MODAL */}
      <WhatsAppCompanionModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        sources={sources}
        onSelectSource={(s) => {
          setIsWhatsAppModalOpen(false);
          setActiveSourceDetail(s);
        }}
        isRunaPage={currentView === 'pitch'}
      />

      {/* FLOATING POPUP CONVERSATIONAL WINDOW (Available on every page) */}
      <ConversationalPopupWindow
        isOpen={isChatPopupOpen}
        onToggle={() => setIsChatPopupOpen(!isChatPopupOpen)}
        messages={messages}
        onSendMessage={handleSendMessage}
        isChatLoading={isChatLoading}
        onClearChat={() => setMessages([])}
        isOfflineMode={isOfflineMode}
        onSelectSource={(s) => setActiveSourceDetail(s)}
        sources={sources}
        chatModel={chatModel}
        onOpenSafetyModal={() => setIsSafetyModalOpen(true)}
        isRunaPage={currentView === 'pitch'}
      />

      {/* CONVERSATIONAL SAFETY, FAIR DISCLOSURE & GUARDRAILS MODAL */}
      <SafetyDisclosureModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
      />

      {/* SEMANTIC VECTOR SEARCH MODAL OVERLAY */}
      {isSemanticSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B0B0C]/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] w-full max-w-4xl h-[85vh] rounded-3xl flex flex-col overflow-hidden">
            <SemanticSearchPanel
              allChunks={vectorChunks}
              allSources={sources}
              isStudioAdmin={isStudioBuildMode}
              onAskAboutExcerpt={(excerpt, title) => {
                setIsSemanticSearchOpen(false);
                setIsChatPopupOpen(true);
                handleSendMessage(
                  `Please elaborate on this passage from "${title}": "${excerpt}"`
                );
              }}
              onSelectSource={(sourceId) => {
                const s = sources.find((item) => item.id === sourceId);
                if (s) setActiveSourceDetail(s);
              }}
              onClose={() => setIsSemanticSearchOpen(false)}
            />
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Source Detail Modal */}
      <SourceDetailModal
        source={activeSourceDetail}
        onClose={() => setActiveSourceDetail(null)}
        onAskAboutSource={(s) => {
          setIsChatPopupOpen(true);
          handleSendMessage(
            `Summarize the main concepts and evidence from "${s.title}"`
          );
        }}
        onDeleteSource={isStudioBuildMode ? handleDeleteSource : undefined}
        onEditSource={
          isStudioBuildMode
            ? (s) => {
                setEditingSource(s);
              }
            : undefined
        }
        onAddPicturesToSource={
          isStudioBuildMode ? handleAddPicturesToSource : undefined
        }
        onRemovePictureFromSource={
          isStudioBuildMode ? handleRemovePictureFromSource : undefined
        }
        isStudioAdmin={isStudioBuildMode}
      />

      {/* 2. Add Source Modal — visible only to the author in Google AI Studio Build mode */}
      {isStudioBuildMode && (
        <AddSourceModal
          isOpen={isAddSourceOpen}
          onClose={() => setIsAddSourceOpen(false)}
          onAddSource={handleAddSource}
          defaultSection={defaultAddSection}
        />
      )}

      {/* 3. Edit Source Modal — visible only to the author in Google AI Studio Build mode */}
      {isStudioBuildMode && (
        <EditSourceModal
          source={editingSource}
          isOpen={Boolean(editingSource)}
          onClose={() => setEditingSource(null)}
          onSaveSource={handleUpdateSource}
          onDeleteSource={handleDeleteSource}
        />
      )}

      {/* 4. Book Metadata Settings Modal — visible only in Google AI Studio Build mode */}
      {isStudioBuildMode && (
        <BookSettingsModal
          isOpen={isBookSettingsOpen}
          onClose={() => setIsBookSettingsOpen(false)}
          metadata={bookMetadata}
          onSaveMetadata={handleSaveBookMetadata}
          onResetToDefault={handleResetToDefault}
        />
      )}
    </div>
  );
}
