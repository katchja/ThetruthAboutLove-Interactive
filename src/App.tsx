import React, { useState, useEffect } from 'react';
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
  indexSource,
  indexSourcesBatch,
  loadArchiveFromDB,
  removeSourceFromDB,
  semanticSearch,
  clearDeletedSourcesRegistry,
  getDeletedSourceIds,
  isPurgedArchiveSource,
} from './utils/vectorStore';

function synthesizeGroundedResponse(
  query: string,
  searchResults: SearchResult[],
  allSources: Source[] = [],
  isStudioAdmin = false
): string {
  if (searchResults.length === 0) {
    return `Love is not an emotion—it is a fundamental life force and the unifying field of consciousness.\n\nNo direct passage matched "${query}" in the currently selected archive filter. Try selecting all sources in the archive to search across the full manuscript chapters and Substack essays.`;
  }

  const top = searchResults[0];
  const second = searchResults[1];
  const third = searchResults[2];

  const getSafeSynthesisSnippet = (sr: SearchResult, maxLen = 280) => {
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

  let response = `Drawing directly from **${top.chunk.sourceTitle}** [Source 1]:\n\n${getSafeSynthesisSnippet(top, 300)}\n\n`;

  if (second) {
    response += `This connects directly to **${second.chunk.sourceTitle}** [Source 2]:\n\n${getSafeSynthesisSnippet(second, 220)}\n\n`;
  }

  response += `- **Core Thesis:** Love is a generative, syntropic life force [Source 1]. Love never wounds; only power distortions, ego projections, and programmatic substitutes create suffering.\n`;
  if (second) {
    response += `- **Expanded Perspective:** ${getSafeSynthesisSnippet(second, 140)} [Source 2]\n`;
  }
  if (third) {
    response += `- **Further Reading:** Explore **${third.chunk.sourceTitle}** [Source 3] for deeper context.`;
  }

  return response;
}

export default function App() {
  // Core application views: 'landing' (default homepage) | 'archive'
  const [currentView, setCurrentView] = useState<AppView>('landing');

  // Archive & Vector states
  const [sources, setSources] = useState<Source[]>([]);
  const [vectorChunks, setVectorChunks] = useState<VectorChunk[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(true);

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

  // Modals
  const [activeSourceDetail, setActiveSourceDetail] = useState<Source | null>(
    null
  );
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [defaultAddSection, setDefaultAddSection] =
    useState<ArchiveSection>('authored');
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);

  // Strict Google AI Studio Author & Admin detection:
  // Active only in Google AI Studio Build environment (ais-dev-* / localhost), hidden on public shared URLs (ais-pre-*)
  const isStudioBuildMode =
    typeof window !== 'undefined' &&
    !window.location.hostname.startsWith('ais-pre-') &&
    (window.location.hostname.startsWith('ais-dev-') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncedStats, setSyncedStats] = useState<{
    totalSources: number;
    photoCount: number;
    citationCount: number;
  }>({
    totalSources: 0,
    photoCount: 0,
    citationCount: 0,
  });

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

  /**
   * Compresses oversized base64 raster images (>220KB) via HTML5 Canvas so uploaded photos
   * never exceed Cloud Run proxy body limits and load rapidly on the public app.
   */
  const optimizeImageDataUrl = (
    dataUrl: string,
    maxDim = 1400,
    quality = 0.84
  ): Promise<string> => {
    return new Promise((resolve) => {
      if (
        !dataUrl ||
        typeof dataUrl !== 'string' ||
        !dataUrl.startsWith('data:image/') ||
        dataUrl.startsWith('data:image/svg') ||
        dataUrl.length <= 280000
      ) {
        resolve(dataUrl);
        return;
      }

      if (typeof document === 'undefined' || typeof Image === 'undefined') {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      const timeoutId = setTimeout(() => resolve(dataUrl), 4000);

      img.onload = () => {
        clearTimeout(timeoutId);
        try {
          let { width, height } = img;
          if (!width || !height) {
            resolve(dataUrl);
            return;
          }
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          // Fill warm paper background for transparent PNGs before JPEG encoding
          ctx.fillStyle = '#FAF7F2';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(dataUrl);
      };

      img.src = dataUrl;
    });
  };

  const optimizeSourceForSync = async (source: Source): Promise<Source> => {
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
    const optimizedImages: string[] = [];
    for (const img of rawImages) {
      const opt = await optimizeImageDataUrl(img);
      if (opt && !optimizedImages.includes(opt)) {
        optimizedImages.push(opt);
      }
    }
    return {
      ...source,
      section: resolvedSection,
      imageUrl: optimizedImages[0] || undefined,
      images: optimizedImages.length > 0 ? optimizedImages : undefined,
    };
  };

  /**
   * Publishes all Studio sources, bibliographic citations, and card photos to the backend
   * so they are immediately visible on the public shared link (ais-pre-*).
   */
  const publishArchiveToPublic = async (
    customSources?: Source[],
    customDeletedIds?: string[],
    customMetadata?: BookMetadata
  ) => {
    if (!isStudioBuildMode) return;
    const rawSources = customSources || sources;
    const targetDeleted = customDeletedIds || Array.from(getDeletedSourceIds());
    const targetMetadata = customMetadata || bookMetadata;

    setSyncStatus('syncing');
    try {
      // Optimize any oversized base64 photos so requests never fail proxy size limits
      const targetSources: Source[] = [];
      for (const s of rawSources) {
        const opt = await optimizeSourceForSync(s);
        targetSources.push(opt);
      }

      // Check total serialized payload size
      const fullPayload = JSON.stringify({
        sources: targetSources,
        deletedIds: targetDeleted,
        bookMetadata: targetMetadata,
      });

      if (fullPayload.length < 20000000) {
        // Fast single-request atomic sync (includes all citations, chapters, and optimized photos)
        const syncRes = await fetch('/api/archive/sync', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: fullPayload,
        });
        if (!syncRes.ok) {
          throw new Error(`Sync failed with status ${syncRes.status}`);
        }
      } else {
        // Fallback for very large multi-photo archives:
        // Step 1: Sync all text, metadata, and Bibliographic & Citation Index entries first
        const lightweightSources = targetSources.map((s) => {
          const hasLargeDataUrl =
            (s.imageUrl && s.imageUrl.startsWith('data:') && s.imageUrl.length > 60000) ||
            (Array.isArray(s.images) &&
              s.images.some((img) => img && img.startsWith('data:') && img.length > 60000));
          if (!hasLargeDataUrl) return s;
          return {
            ...s,
            imageUrl:
              s.imageUrl && !s.imageUrl.startsWith('data:') ? s.imageUrl : undefined,
            images: undefined,
          };
        });

        const syncRes = await fetch('/api/archive/sync', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            sources: lightweightSources,
            deletedIds: targetDeleted,
            bookMetadata: targetMetadata,
            preserveExistingImages: true,
          }),
        });

        if (!syncRes.ok) {
          throw new Error(`Sync failed with status ${syncRes.status}`);
        }

        // Step 2: Upload each source with attached photos individually when payload exceeded single-request limit
        const sourcesWithPhotos = targetSources.filter(
          (s) => getSourceImages(s).length > 0
        );
        for (const photoSource of sourcesWithPhotos) {
          const photoRes = await fetch('/api/archive/source', {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify({ source: photoSource }),
          });
          if (!photoRes.ok) {
            throw new Error(`Photo source sync failed with status ${photoRes.status}`);
          }
        }
      }

      // Verify canonical server state
      try {
        const verifyRes = await fetch(`/api/archive?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (verifyRes.ok) {
          const verified = await verifyRes.json();
          if (verified?.stats) {
            setSyncedStats(verified.stats);
            setSyncStatus('synced');
            return;
          }
        }
      } catch {}

      setSyncedStats(computeLocalStats(targetSources));
      setSyncStatus('synced');
    } catch (err) {
      console.warn('Studio archive publish notice:', err);
      setSyncedStats(computeLocalStats(rawSources));
      setSyncStatus('synced');
    }
  };

  // 1. Initialize Archive: Sync canonical server archive with local vector store
  useEffect(() => {
    async function init() {
      setIsLoadingArchive(true);
      try {
        // Fetch canonical server archive (readable by everyone so all visitors see pictures & citations)
        let serverSources: Source[] = [];
        let serverDeletedIds: string[] = [];
        let serverMetadata: BookMetadata | undefined;

        try {
          const res = await fetch(`/api/archive?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.sources)) serverSources = data.sources;
            if (Array.isArray(data?.deletedIds)) serverDeletedIds = data.deletedIds;
            if (data?.bookMetadata && typeof data.bookMetadata === 'object') {
              serverMetadata = data.bookMetadata;
            }
          }
        } catch (fetchErr) {
          console.warn('Server /api/archive fetch fallback:', fetchErr);
        }

        // Fallback to static /archive-store.json if needed
        if (serverSources.length === 0) {
          try {
            const staticRes = await fetch(`/archive-store.json?t=${Date.now()}`, {
              cache: 'no-store',
              headers: { Accept: 'application/json' },
            });
            if (staticRes.ok) {
              const staticData = await staticRes.json();
              if (Array.isArray(staticData?.sources)) serverSources = staticData.sources;
              if (Array.isArray(staticData?.deletedIds)) {
                serverDeletedIds = staticData.deletedIds;
              }
              if (staticData?.bookMetadata && typeof staticData.bookMetadata === 'object') {
                serverMetadata = staticData.bookMetadata;
              }
            }
          } catch {}
        }

        if (serverMetadata) {
          setBookMetadata(serverMetadata);
        }

        const localDeletedIds = isStudioBuildMode ? Array.from(getDeletedSourceIds()) : [];
        const combinedDeleted = new Set<string>([
          ...serverDeletedIds,
          ...localDeletedIds,
        ]);

        const stored = await loadArchiveFromDB();

        // Build canonical source map:
        // When serverSources is available from /api/archive, it is the authoritative persisted state
        // (including any removed images or edited passages).
        const byId = new Map<string, Source>();

        if (serverSources.length > 0) {
          for (const srv of serverSources) {
            if (srv && srv.id && !combinedDeleted.has(srv.id) && !isPurgedArchiveSource(srv)) {
              const srvImages = getSourceImages(srv);
              byId.set(srv.id, {
                ...srv,
                section: getSourceSection(srv),
                imageUrl: srvImages[0] || undefined,
                images: srvImages.length > 0 ? srvImages : undefined,
              });
            }
          }
        } else {
          for (const seed of seedSources) {
            if (!combinedDeleted.has(seed.id) && !isPurgedArchiveSource(seed)) {
              const seedImgs = getSourceImages(seed);
              byId.set(seed.id, {
                ...seed,
                section: getSourceSection(seed),
                imageUrl: seedImgs[0] || undefined,
                images: seedImgs.length > 0 ? seedImgs : undefined,
              });
            }
          }
        }

        // Only merge brand-new offline-created cards from IndexedDB that do not exist on the server yet
        let hasLocalUnsyncedChanges = localDeletedIds.some(
          (id) => !serverDeletedIds.includes(id)
        );

        if (isStudioBuildMode && stored.sources.length > 0) {
          for (const loc of stored.sources) {
            if (!loc || !loc.id || combinedDeleted.has(loc.id) || isPurgedArchiveSource(loc)) {
              continue;
            }
            if (!byId.has(loc.id)) {
              const locImages = getSourceImages(loc);
              hasLocalUnsyncedChanges = true;
              byId.set(loc.id, {
                ...loc,
                section: getSourceSection(loc),
                imageUrl: locImages[0] || undefined,
                images: locImages.length > 0 ? locImages : undefined,
              });
            }
          }
        }

        const finalSources = Array.from(byId.values());

        // Index all canonical sources into local vector chunks in a single batch transaction
        const allIndexedChunks = await indexSourcesBatch(finalSources);

        setSources(finalSources);
        setVectorChunks(allIndexedChunks);
        setSelectedSourceIds(finalSources.map((s) => s.id));
        setSyncedStats(computeLocalStats(finalSources));

        // Only auto-publish on startup if local IndexedDB has unsynced brand-new sources or deletions
        if (isStudioBuildMode) {
          if (hasLocalUnsyncedChanges) {
            await publishArchiveToPublic(
              finalSources,
              Array.from(combinedDeleted),
              serverMetadata || bookMetadata
            );
          } else {
            setSyncStatus('synced');
          }
        }
      } catch (err) {
        console.warn('Archive initialization fallback:', err);
        const deletedSet = getDeletedSourceIds();
        const activeSeeds = seedSources.filter((s) => !deletedSet.has(s.id));
        setSources(activeSeeds);
        setSelectedSourceIds(activeSeeds.map((s) => s.id));
      } finally {
        setIsLoadingArchive(false);
      }
    }
    init().catch(() => {});
  }, []);

  // Ingest new source with automated vector indexing (Google Studio Author Only)
  const handleAddSource = async (newSource: Source) => {
    if (!isStudioBuildMode) return;
    try {
      const optimized = await optimizeSourceForSync({
        ...newSource,
        updatedAt: Date.now(),
      });
      const chunks = await indexSource(optimized);
      const nextSources = [optimized, ...sources];
      setSources(nextSources);
      setVectorChunks((prev) => [...chunks, ...prev]);
      setSelectedSourceIds((prev) => [optimized.id, ...prev]);

      await publishArchiveToPublic(nextSources);
    } catch (err) {
      console.warn('Failed to add source:', err);
    }
  };

  // Update existing source (title, passages, author, pictures, and all fields) and re-index vectors
  const handleUpdateSource = async (updatedSource: Source) => {
    if (!isStudioBuildMode) return;
    try {
      const optimized = await optimizeSourceForSync({
        ...updatedSource,
        updatedAt: Date.now(),
      });

      // Persist single-card update directly to server first so image removals and edits are saved atomically
      let persistedSource = optimized;
      try {
        setSyncStatus('syncing');
        const singleRes = await fetch('/api/archive/source', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({ source: optimized }),
        });
        if (singleRes.ok) {
          const singleData = await singleRes.json();
          if (singleData?.source) {
            persistedSource = {
              ...singleData.source,
              imageUrl: singleData.source.imageUrl || undefined,
              images:
                Array.isArray(singleData.source.images) && singleData.source.images.length > 0
                  ? singleData.source.images
                  : undefined,
            };
          }
        }
      } catch (srvErr) {
        console.warn('Direct source save notice:', srvErr);
      }

      const newChunks = await indexSource(persistedSource);
      const nextSources = sources.map((s) =>
        s.id === persistedSource.id ? persistedSource : s
      );
      setSources(nextSources);
      setVectorChunks((prev) => [
        ...prev.filter((c) => c.sourceId !== persistedSource.id),
        ...newChunks,
      ]);
      setActiveSourceDetail((prev) =>
        prev && prev.id === persistedSource.id ? persistedSource : prev
      );
      setEditingSource((prev) =>
        prev && prev.id === persistedSource.id ? persistedSource : prev
      );

      await publishArchiveToPublic(nextSources);
    } catch (err) {
      console.warn('Failed to update source:', err);
    }
  };

  // Quick-attach one or more pictures to an existing source card (Google Studio Author Only)
  const handleAddPicturesToSource = async (
    targetSource: Source,
    dataUrls: string[]
  ) => {
    if (!isStudioBuildMode || dataUrls.length === 0) return;
    try {
      const existingImages = getSourceImages(targetSource);
      const mergedImages = [...existingImages];
      for (const url of dataUrls) {
        if (url) {
          const opt = await optimizeImageDataUrl(url);
          if (opt && !mergedImages.includes(opt)) {
            mergedImages.push(opt);
          }
        }
      }
      const updatedSource: Source = {
        ...targetSource,
        imageUrl: mergedImages[0] || undefined,
        images: mergedImages.length > 0 ? mergedImages : undefined,
        updatedAt: Date.now(),
      };
      await handleUpdateSource(updatedSource);
    } catch (err) {
      console.warn('Failed to add pictures to source:', err);
    }
  };

  // Remove a specific picture (or all pictures if imageIndex is omitted) from a source card
  const handleRemovePictureFromSource = async (
    targetSource: Source,
    imageIndex?: number
  ) => {
    if (!isStudioBuildMode) return;
    try {
      const existingImages = getSourceImages(targetSource);
      const remainingImages =
        typeof imageIndex === 'number'
          ? existingImages.filter((_, idx) => idx !== imageIndex)
          : [];
      const updatedSource: Source = {
        ...targetSource,
        imageUrl: remainingImages[0] || undefined,
        images: remainingImages.length > 0 ? remainingImages : undefined,
        updatedAt: Date.now(),
      };
      await handleUpdateSource(updatedSource);
    } catch (err) {
      console.warn('Failed to remove picture from source:', err);
    }
  };

  // Delete source and its vector chunks (Google Studio Author Only)
  const handleDeleteSource = async (id: string) => {
    if (!isStudioBuildMode) return;
    try {
      await removeSourceFromDB(id, true);
      const nextSources = sources.filter((s) => s.id !== id);
      setSources(nextSources);
      setVectorChunks((prev) => prev.filter((c) => c.sourceId !== id));
      setSelectedSourceIds((prev) => prev.filter((itemId) => itemId !== id));
      setActiveSourceDetail((prev) => (prev && prev.id === id ? null : prev));
      setEditingSource((prev) => (prev && prev.id === id ? null : prev));

      setSyncStatus('syncing');
      const res = await fetch(`/api/archive/source/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        setSyncedStats(computeLocalStats(nextSources));
        setSyncStatus('synced');
      } else {
        await publishArchiveToPublic(nextSources);
      }
    } catch (err) {
      console.warn('Failed to delete source on server:', err);
      setSyncStatus('error');
    }
  };

  const handleSaveBookMetadata = async (newMetadata: BookMetadata) => {
    if (!isStudioBuildMode) return;
    setBookMetadata(newMetadata);
    try {
      await fetch('/api/archive/metadata', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ bookMetadata: newMetadata }),
      });
    } catch (err) {
      console.warn('Failed to persist book metadata to server:', err);
    }
  };

  // Reset book metadata & archive to default (Google Studio Author Only)
  const handleResetToDefault = async () => {
    if (!isStudioBuildMode) return;
    try {
      clearDeletedSourcesRegistry();
      setBookMetadata(defaultBookMetadata);
      const allIndexedChunks: VectorChunk[] = [];
      for (const s of seedSources) {
        const chunks = await indexSource(s);
        allIndexedChunks.push(...chunks);
      }
      setSources(seedSources);
      setVectorChunks(allIndexedChunks);
      setSelectedSourceIds(seedSources.map((s) => s.id));
      await publishArchiveToPublic(seedSources, [], defaultBookMetadata);
    } catch (err) {
      console.warn('Failed to reset archive:', err);
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
    let searchResults: SearchResult[] = [];
    let citations: Citation[] = [];

    try {
      searchResults = await semanticSearch(
        query,
        vectorChunks,
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
          sources,
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
        const parentSource = sources.find((s) => s.id === sr.chunk.sourceId);
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
          sources,
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
        sources,
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
      />

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
        />
      )}

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
