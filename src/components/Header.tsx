import React from 'react';
import {
  Heart,
  MessageSquare,
  ShieldCheck,
  Volume2,
  Settings,
  Search,
  Database,
  Archive,
  CloudUpload,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { BookMetadata, AppView, VoiceSettings } from '../types';

interface HeaderProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  isOfflineMode: boolean;
  setIsOfflineMode: (offline: boolean) => void;
  bookMetadata: BookMetadata;
  voiceSettings?: VoiceSettings;
  onOpenVoiceSettings?: () => void;
  onOpenBookSettings?: () => void;
  onToggleSemanticSearch: () => void;
  isSemanticSearchOpen: boolean;
  totalSourcesCount: number;
  totalChunksCount: number;
  onOpenChatPopup?: () => void;
  onPublishToPublic?: () => void;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  syncedStats?: {
    totalSources: number;
    photoCount: number;
    citationCount: number;
  };
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  isOfflineMode,
  setIsOfflineMode,
  voiceSettings,
  onOpenVoiceSettings,
  onOpenBookSettings,
  onToggleSemanticSearch,
  isSemanticSearchOpen,
  onOpenChatPopup,
  onPublishToPublic,
  syncStatus = 'idle',
  syncedStats,
}) => {
  const embeddedVoiceId =
    voiceSettings?.voiceCloningKey &&
    !voiceSettings.voiceCloningKey.startsWith('gcv-catalina-author-v1-')
      ? voiceSettings.voiceCloningKey
      : 'voice_lp7vh3bk6taq';

  return (
    <header className="sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-md text-[#0B0B0C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Book info (clickable to homepage) */}
        <div
          onClick={() => {
            setCurrentView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-3 min-w-0 cursor-pointer group shrink-0"
          title="Return to Homepage: The Truth About Love"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0B0B0C] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#0B0B0C] text-lg tracking-tight truncate group-hover:text-[#5F6368] transition-colors font-display whitespace-nowrap">
                The Truth About Love
              </span>
            </div>
            <p className="text-xs text-[#5F6368] truncate max-w-xs font-sans">
              Catalina Butnaru · Interactive Manuscript
            </p>
          </div>
        </div>

        {/* View mode switcher & Studio triggers */}
        <div className="hidden md:flex items-center p-1 bg-[#F1F3F4] rounded-xl text-xs gap-1">
          <button
            onClick={() => {
              setCurrentView('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
              currentView === 'landing'
                ? 'bg-[#FFFFFF] text-[#0B0B0C] font-semibold'
                : 'text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-current" />
            <span>The Manuscript</span>
          </button>

          <button
            onClick={() => setCurrentView('archive')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
              currentView === 'archive'
                ? 'bg-[#FFFFFF] text-[#0B0B0C] font-semibold'
                : 'text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-current" />
            <span>Manuscript Archive &amp; Citations</span>
          </button>

          {onOpenChatPopup && (
            <button
              onClick={onOpenChatPopup}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-white bg-[#FF2A6D] hover:bg-[#E61556] transition-all whitespace-nowrap cursor-pointer"
              title="Open Multi-Turn Conversational Manuscript"
            >
              <MessageSquare className="w-3.5 h-3.5 text-white" />
              <span>Ask Manuscript</span>
            </button>
          )}
        </div>

        {/* Action controls & Privacy mode */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Publish to Public button — visible only to the author in Google AI Studio Build mode */}
          {onPublishToPublic && (
            <button
              onClick={onPublishToPublic}
              disabled={syncStatus === 'syncing'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                syncStatus === 'synced'
                  ? 'bg-[#F1F3F4] text-[#0B0B0C] hover:bg-[#E8EAED]'
                  : syncStatus === 'error'
                  ? 'bg-[#202124] text-white hover:bg-[#0B0B0C]'
                  : 'bg-[#FF2A6D] text-white hover:bg-[#E61556]'
              }`}
              title={
                syncedStats
                  ? `Public Sync Active: ${syncedStats.photoCount} Photos & ${syncedStats.citationCount} Citations published to public link. Click to force publish.`
                  : 'Publish all photos, edits, and citations from Studio to the public app'
              }
            >
              {syncStatus === 'syncing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : syncStatus === 'synced' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0B0B0C]" />
                  <span className="hidden xl:inline font-mono">
                    Published ({syncedStats?.photoCount ?? 0} Photos · {syncedStats?.citationCount ?? 0} Citations)
                  </span>
                  <span className="xl:hidden">Published</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Publish to Public</span>
                </>
              )}
            </button>
          )}

          {/* Semantic Search toggle */}
          <button
            onClick={onToggleSemanticSearch}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              isSemanticSearchOpen
                ? 'bg-[#FF2A6D] text-white'
                : 'bg-[#F1F3F4] text-[#202124] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
            title="Search private vector embeddings directly"
          >
            <Search className="w-3.5 h-3.5 text-current" />
            <span className="hidden lg:inline">Vector Search</span>
          </button>

          {/* Privacy & Offline toggle */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              isOfflineMode
                ? 'bg-[#FF2A6D] text-white font-semibold'
                : 'bg-[#F1F3F4] text-[#202124] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
            title={
              isOfflineMode
                ? 'Offline Privacy Active: Queries stay in local browser vector index'
                : 'Hybrid Mode: Grounded Gemini answers with retrieved local passages'
            }
          >
            {isOfflineMode ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">Offline Privacy</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5 text-[#5F6368]" />
                <span className="hidden sm:inline">Local Index + AI</span>
              </>
            )}
          </button>

          {/* Voice Cloning Studio configuration — visible only to the author in Google AI Studio Build mode */}
          {onOpenVoiceSettings && (
            <button
              onClick={onOpenVoiceSettings}
              data-voice-id={embeddedVoiceId}
              className="px-3 py-1.5 rounded-lg bg-[#F1F3F4] text-[#202124] hover:text-[#0B0B0C] hover:bg-[#E8EAED] transition-colors flex items-center gap-1.5 text-xs font-medium whitespace-nowrap cursor-pointer"
              title="Open Author Voice Studio"
            >
              <Volume2 className="w-3.5 h-3.5 text-current" />
              <span className="hidden xl:inline">Author Voice</span>
            </button>
          )}

          {/* Book settings — visible only to the author in Google AI Studio Build mode */}
          {onOpenBookSettings && (
            <button
              onClick={onOpenBookSettings}
              className="p-2 rounded-lg bg-[#F1F3F4] text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED] transition-colors cursor-pointer"
              title="Book Metadata & Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

