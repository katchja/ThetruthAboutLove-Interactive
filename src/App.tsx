import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SourceDetailModal } from './components/SourceDetailModal';
import { AddSourceModal } from './components/AddSourceModal';
import { EditSourceModal } from './components/EditSourceModal';
import { SemanticSearchPanel } from './components/SemanticSearchPanel';
import { LandingPageView } from './components/LandingPageView';
import { ArchivePageView } from './components/ArchivePageView';
import { ConversationalPopupWindow } from './components/ConversationalPopupWindow';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { BookSettingsModal } from './components/BookSettingsModal';
import {
  Source,
  VectorChunk,
  ChatMessage,
  BookMetadata,
  VoiceSettings,
  Citation,
  AppView,
  ArchiveSection,
  SearchResult,
  ChatModelTier,
  getSourceImages,
} from './types';
import { defaultBookMetadata, seedSources } from './data/seedData';
import {
  indexSource,
  loadArchiveFromDB,
  removeSourceFromDB,
  semanticSearch,
  clearDeletedSourcesRegistry,
  getDeletedSourceIds,
  isPurgedArchiveSource,
} from './utils/vectorStore';

const DEFAULT_AUTHOR_VOICE_ID = 'voice_lp7vh3bk6taq';
const VOICE_STORAGE_KEY = 'TruthAboutLove_VoiceSettings_v3';

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  engine: 'cloned_author',
  voiceName: DEFAULT_AUTHOR_VOICE_ID,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  style: 'author_monologue',
  voiceCloningKey: DEFAULT_AUTHOR_VOICE_ID,
  voicePersonaPrompt:
    'Warm, articulate, poised female author voice with a luminous philosophical cadence, deliberate rhythmic pacing, resonant alto timbre, and fierce intellectual clarity',
  prebuiltBaseVoice: 'Kore',
  isClonedVoiceActive: true,
};

function loadInitialVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS;
  try {
    const saved = window.localStorage.getItem(VOICE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const validVoiceKey =
        parsed.voiceCloningKey &&
        !String(parsed.voiceCloningKey).startsWith('gcv-catalina-author-v1-')
          ? parsed.voiceCloningKey
          : DEFAULT_AUTHOR_VOICE_ID;
      return {
        ...DEFAULT_VOICE_SETTINGS,
        ...parsed,
        engine: parsed.engine || 'cloned_author',
        voiceName: validVoiceKey,
        voiceCloningKey: validVoiceKey,
        isClonedVoiceActive: true,
      };
    }
  } catch {}
  return DEFAULT_VOICE_SETTINGS;
}

function synthesizeGroundedResponse(query: string, searchResults: SearchResult[]): string {
  if (searchResults.length === 0) {
    return `Love is not an emotion—it is a fundamental life force and the unifying field of consciousness.\n\nNo direct passage matched "${query}" in the currently selected archive filter. Try selecting all sources in the archive to search across the full manuscript chapters and Substack essays.`;
  }

  const top = searchResults[0];
  const second = searchResults[1];
  const third = searchResults[2];

  const cleanExcerpt = (text: string, maxLen = 280) => {
    const lines = text
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

  let response = `Drawing directly from **${top.chunk.sourceTitle}** [Source 1]:\n\n"${cleanExcerpt(top.chunk.text, 300)}"\n\n`;

  if (second) {
    response += `This connects directly to **${second.chunk.sourceTitle}** [Source 2]:\n\n"${cleanExcerpt(second.chunk.text, 220)}"\n\n`;
  }

  response += `- **Core Thesis:** Love is a generative, syntropic life force [Source 1]. Love never wounds; only power distortions, ego projections, and programmatic substitutes create suffering.\n`;
  if (second) {
    response += `- **Expanded Perspective:** ${cleanExcerpt(second.chunk.text, 140)} [Source 2]\n`;
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

  // Conversational Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatModel, setChatModel] = useState<ChatModelTier>('gemini-3.8-flash');
  const [isSemanticSearchOpen, setIsSemanticSearchOpen] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);

  // Book & Voice Metadata
  const [bookMetadata, setBookMetadata] =
    useState<BookMetadata>(defaultBookMetadata);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(
    loadInitialVoiceSettings
  );

  // Modals
  const [activeSourceDetail, setActiveSourceDetail] = useState<Source | null>(
    null
  );
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [defaultAddSection, setDefaultAddSection] =
    useState<ArchiveSection>('authored');
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);

  // Strict Google AI Studio Author & Admin detection:
  // Active only in Google AI Studio Build environment (ais-dev-* / localhost), hidden on public shared URLs (ais-pre-*)
  const isStudioBuildMode =
    typeof window !== 'undefined' &&
    !window.location.hostname.startsWith('ais-pre-') &&
    (window.location.hostname.startsWith('ais-dev-') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const handleSaveVoiceSettings = (updated: VoiceSettings) => {
    setVoiceSettings(updated);
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  // 1. Initialize Archive: Sync canonical server archive with local vector store
  useEffect(() => {
    async function init() {
      setIsLoadingArchive(true);
      try {
        // Fetch canonical server archive (readable by everyone so all visitors see pictures & edits)
        let serverSources: Source[] = [];
        let serverDeletedIds: string[] = [];
        let serverMetadata: BookMetadata | undefined;

        try {
          const res = await fetch('/api/archive', {
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
          console.warn('Server archive fetch fallback:', fetchErr);
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

        // Build merged map starting from seedSources -> serverSources -> (if Studio Admin) local IndexedDB sources
        const byId = new Map<string, Source>();

        for (const seed of seedSources) {
          if (!combinedDeleted.has(seed.id) && !isPurgedArchiveSource(seed)) {
            byId.set(seed.id, seed);
          }
        }

        for (const srv of serverSources) {
          if (srv && srv.id && !combinedDeleted.has(srv.id) && !isPurgedArchiveSource(srv)) {
            const existing = byId.get(srv.id);
            byId.set(srv.id, existing ? { ...existing, ...srv } : srv);
          }
        }

        // If the author is in Google AI Studio Build mode, merge any pictures/edits from her browser IndexedDB
        // and immediately push them to the server so they become visible to everyone!
        if (isStudioBuildMode && stored.sources.length > 0) {
          for (const loc of stored.sources) {
            if (!loc || !loc.id || combinedDeleted.has(loc.id) || isPurgedArchiveSource(loc)) {
              continue;
            }
            const current = byId.get(loc.id);
            if (!current) {
              byId.set(loc.id, loc);
            } else {
              const locImgCount = getSourceImages(loc).length;
              const curImgCount = getSourceImages(current).length;
              const locTime = loc.updatedAt || loc.createdAt || 0;
              const curTime = current.updatedAt || current.createdAt || 0;

              if (locTime >= curTime || locImgCount > curImgCount) {
                const mergedImages =
                  locImgCount > 0 ? getSourceImages(loc) : getSourceImages(current);
                byId.set(loc.id, {
                  ...current,
                  ...loc,
                  imageUrl: mergedImages[0] || loc.imageUrl || current.imageUrl,
                  images: mergedImages.length > 0 ? mergedImages : undefined,
                });
              }
            }
          }
        }

        const finalSources = Array.from(byId.values());

        // If in Google AI Studio Build mode, sync the canonical merged set to the backend server
        if (isStudioBuildMode) {
          try {
            await fetch('/api/archive/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-studio-admin': 'true',
              },
              body: JSON.stringify({
                sources: finalSources,
                deletedIds: Array.from(combinedDeleted),
                bookMetadata: serverMetadata || bookMetadata,
              }),
            });
          } catch (syncErr) {
            console.warn('Studio archive sync notice:', syncErr);
          }
        }

        // Index all canonical sources into local vector chunks
        const allIndexedChunks: VectorChunk[] = [];
        for (const s of finalSources) {
          const chunks = await indexSource(s);
          allIndexedChunks.push(...chunks);
        }

        setSources(finalSources);
        setVectorChunks(allIndexedChunks);
        setSelectedSourceIds(finalSources.map((s) => s.id));
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
    init();
  }, []);

  // Ingest new source with automated vector indexing (Google Studio Author Only)
  const handleAddSource = async (newSource: Source) => {
    if (!isStudioBuildMode) return;
    const enriched: Source = {
      ...newSource,
      updatedAt: Date.now(),
    };
    const chunks = await indexSource(enriched);
    setSources((prev) => [enriched, ...prev]);
    setVectorChunks((prev) => [...chunks, ...prev]);
    setSelectedSourceIds((prev) => [enriched.id, ...prev]);

    try {
      await fetch('/api/archive/source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-studio-admin': 'true',
        },
        body: JSON.stringify({ source: enriched }),
      });
    } catch (err) {
      console.warn('Failed to persist new source to server:', err);
    }
  };

  // Update existing source (title, passages, author, pictures, and all fields) and re-index vectors
  const handleUpdateSource = async (updatedSource: Source) => {
    if (!isStudioBuildMode) return;
    const enriched: Source = {
      ...updatedSource,
      updatedAt: Date.now(),
    };
    const newChunks = await indexSource(enriched);
    setSources((prev) =>
      prev.map((s) => (s.id === enriched.id ? enriched : s))
    );
    setVectorChunks((prev) => [
      ...prev.filter((c) => c.sourceId !== enriched.id),
      ...newChunks,
    ]);
    setActiveSourceDetail((prev) =>
      prev && prev.id === enriched.id ? enriched : prev
    );

    try {
      await fetch('/api/archive/source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-studio-admin': 'true',
        },
        body: JSON.stringify({ source: enriched }),
      });
    } catch (err) {
      console.warn('Failed to persist updated source to server:', err);
    }
  };

  // Quick-attach one or more pictures to an existing source card (Google Studio Author Only)
  const handleAddPicturesToSource = async (
    targetSource: Source,
    dataUrls: string[]
  ) => {
    if (!isStudioBuildMode || dataUrls.length === 0) return;
    const existingImages = getSourceImages(targetSource);
    const mergedImages = [...existingImages];
    for (const url of dataUrls) {
      if (url && !mergedImages.includes(url)) {
        mergedImages.push(url);
      }
    }
    const updatedSource: Source = {
      ...targetSource,
      imageUrl: mergedImages[0] || targetSource.imageUrl,
      images: mergedImages,
      updatedAt: Date.now(),
    };
    await handleUpdateSource(updatedSource);
  };

  // Delete source and its vector chunks (Google Studio Author Only)
  const handleDeleteSource = async (id: string) => {
    if (!isStudioBuildMode) return;
    await removeSourceFromDB(id, true);
    setSources((prev) => prev.filter((s) => s.id !== id));
    setVectorChunks((prev) => prev.filter((c) => c.sourceId !== id));
    setSelectedSourceIds((prev) => prev.filter((itemId) => itemId !== id));
    setActiveSourceDetail((prev) => (prev && prev.id === id ? null : prev));
    setEditingSource((prev) => (prev && prev.id === id ? null : prev));

    try {
      await fetch(`/api/archive/source/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'x-studio-admin': 'true',
        },
      });
    } catch (err) {
      console.warn('Failed to delete source on server:', err);
    }
  };

  const handleSaveBookMetadata = async (newMetadata: BookMetadata) => {
    if (!isStudioBuildMode) return;
    setBookMetadata(newMetadata);
    try {
      await fetch('/api/archive/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-studio-admin': 'true',
        },
        body: JSON.stringify({ bookMetadata: newMetadata }),
      });
    } catch (err) {
      console.warn('Failed to persist book metadata to server:', err);
    }
  };

  // Reset book metadata & archive to default (Google Studio Author Only)
  const handleResetToDefault = async () => {
    if (!isStudioBuildMode) return;
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

    try {
      await fetch('/api/archive/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-studio-admin': 'true',
        },
        body: JSON.stringify({
          sources: seedSources,
          deletedIds: [],
          bookMetadata: defaultBookMetadata,
        }),
      });
    } catch {}
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
        const localAnswer = synthesizeGroundedResponse(query, searchResults);

        const assistantMessage: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: localAnswer,
          timestamp: Date.now(),
          citations,
          isOffline: true,
          model: 'Local Vector Synthesizer',
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setIsChatLoading(false);
        return;
      }

      // 3. Otherwise: Server-Side Gemini proxy with retrieved contexts and selected model tier
      const contexts = searchResults.map((sr, idx) => ({
        id: sr.chunk.id,
        title: sr.chunk.sourceTitle,
        type: sr.chunk.sourceType,
        reference: sr.chunk.reference,
        snippet: sr.chunk.text,
        index: idx + 1,
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        chatModel === 'gemini-4-argon' ? 26000 : 16000
      );

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          contexts,
          history: messages.slice(-10),
          bookTitle: bookMetadata.title,
          authorName: bookMetadata.author,
          model: chatModel,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      let data: { reply?: string; model?: string; error?: string } | null =
        null;
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
        const fallbackReply = synthesizeGroundedResponse(query, searchResults);
        const assistantMessage: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: fallbackReply,
          timestamp: Date.now(),
          citations,
          model: 'Local Vector Synthesizer',
          isOffline: true,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
        citations,
        model: data.model || chatModel,
        isOffline: false,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const fallbackReply = synthesizeGroundedResponse(query, searchResults);
      const fallbackMessage: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: fallbackReply,
        timestamp: Date.now(),
        citations,
        model: 'Local Vector Synthesizer',
        isOffline: true,
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
    <div className="min-h-screen bg-[#FAF7F2] text-[#2A2022] flex flex-col font-sans selection:bg-[#F8DEE3] selection:text-[#7A2B3A]">
      {/* Global Header */}
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        isOfflineMode={isOfflineMode}
        setIsOfflineMode={setIsOfflineMode}
        bookMetadata={bookMetadata}
        voiceSettings={voiceSettings}
        onOpenVoiceSettings={
          isStudioBuildMode ? () => setIsVoiceSettingsOpen(true) : undefined
        }
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
          onDeleteSource={isStudioBuildMode ? handleDeleteSource : undefined}
          isStudioAdmin={isStudioBuildMode}
          totalVectorChunks={vectorChunks.length}
          onReturnHome={() => {
            setCurrentView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {/* VIEW: Book Landing Page Mode (Default Homepage with Conversational Q&A & Voice Player) */}
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
          voiceSettings={voiceSettings}
          onOpenVoiceSettings={
            isStudioBuildMode ? () => setIsVoiceSettingsOpen(true) : undefined
          }
          chatModel={chatModel}
          onChangeChatModel={setChatModel}
          isOfflineMode={isOfflineMode}
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
        voiceSettings={voiceSettings}
        isOfflineMode={isOfflineMode}
        onSelectSource={(s) => setActiveSourceDetail(s)}
        sources={sources}
        chatModel={chatModel}
        onChangeChatModel={setChatModel}
      />

      {/* SEMANTIC VECTOR SEARCH MODAL OVERLAY */}
      {isSemanticSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[#1F1718]/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl border border-[#EAE1D9] flex flex-col overflow-hidden">
            <SemanticSearchPanel
              allChunks={vectorChunks}
              allSources={sources}
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

      {/* 4. Google Instant Custom Voice Cloning Studio & Settings Modal — visible only in Google AI Studio Build mode */}
      {isStudioBuildMode && (
        <VoiceSettingsModal
          isOpen={isVoiceSettingsOpen}
          onClose={() => setIsVoiceSettingsOpen(false)}
          settings={voiceSettings}
          onSaveSettings={handleSaveVoiceSettings}
          authorName={bookMetadata.author}
        />
      )}

      {/* 5. Book Metadata Settings Modal — visible only in Google AI Studio Build mode */}
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
