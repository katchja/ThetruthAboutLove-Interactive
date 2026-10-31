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
}) => {
  const embeddedVoiceId =
    voiceSettings?.voiceCloningKey &&
    !voiceSettings.voiceCloningKey.startsWith('gcv-catalina-author-v1-')
      ? voiceSettings.voiceCloningKey
      : 'voice_lp7vh3bk6taq';

  return (
    <header className="sticky top-0 z-30 bg-[#241B1C]/95 backdrop-blur-md border-b border-[#3B2B2E] text-[#F5EFEB]">
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF2A6D] to-[#D91450] flex items-center justify-center shadow-md shadow-[#FF2A6D]/30 shrink-0 group-hover:scale-105 transition-transform ring-1 ring-[#FF2A6D]/40">
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#FAF7F2] text-base tracking-tight truncate group-hover:text-[#FFA8C2] transition-colors font-serif-book whitespace-nowrap">
                The Truth About Love
              </span>
            </div>
            <p className="text-xs text-[#B5A4A7] truncate max-w-xs">
              Catalina Butnaru · Interactive Manuscript
            </p>
          </div>
        </div>

        {/* View mode switcher & Studio triggers */}
        <div className="hidden md:flex items-center p-1 bg-[#191112]/80 rounded-xl border border-[#3B2B2E] text-xs gap-1">
          <button
            onClick={() => setCurrentView('archive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              currentView === 'archive'
                ? 'bg-[#FF2A6D] text-white shadow-md shadow-[#FF2A6D]/30 font-semibold'
                : 'text-[#C2B2B5] hover:text-[#FFFFFF] hover:bg-[#382629]'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Manuscript Archive &amp; Citations</span>
          </button>

          {onOpenChatPopup && (
            <button
              onClick={onOpenChatPopup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-[#FFA8C2] hover:text-white hover:bg-[#FF2A6D]/20 transition-all whitespace-nowrap"
              title="Open Multi-Turn Conversational Manuscript"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#FF2A6D]" />
              <span>Ask Manuscript</span>
            </button>
          )}
        </div>

        {/* Action controls & Privacy mode */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Semantic Search toggle */}
          <button
            onClick={onToggleSemanticSearch}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              isSemanticSearchOpen
                ? 'bg-[#FF2A6D] border-[#FF2A6D] text-white shadow-sm shadow-[#FF2A6D]/30'
                : 'bg-[#2E2023] border-[#443034] text-[#DBCBCD] hover:border-[#FF2A6D]/50 hover:text-[#FFA8C2]'
            }`}
            title="Search private vector embeddings directly"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Vector Search</span>
          </button>

          {/* Privacy & Offline toggle */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
              isOfflineMode
                ? 'bg-[#3D1A25] border-[#FF2A6D] text-[#FFA8C2] shadow-sm'
                : 'bg-[#2E2023] border-[#443034] text-[#C2B2B5] hover:border-[#FF2A6D]/50 hover:text-[#FFFFFF]'
            }`}
            title={
              isOfflineMode
                ? 'Offline Privacy Active: Queries stay in local browser vector index'
                : 'Hybrid Mode: Grounded Gemini answers with retrieved local passages'
            }
          >
            {isOfflineMode ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-[#FF2A6D]" />
                <span className="hidden sm:inline">Offline Privacy</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5 text-[#B5A4A7]" />
                <span className="hidden sm:inline">Local Index + AI</span>
              </>
            )}
          </button>

          {/* Voice Cloning Studio configuration — visible only to the author in Google AI Studio Build mode */}
          {onOpenVoiceSettings && (
            <button
              onClick={onOpenVoiceSettings}
              data-voice-id={embeddedVoiceId}
              className="px-2.5 py-1.5 rounded-lg bg-[#2E2023] border border-[#443034] text-[#FFA8C2] hover:border-[#FF2A6D] hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
              title="Open Author Voice Studio"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#FF2A6D]" />
              <span className="hidden xl:inline">Author Voice</span>
            </button>
          )}

          {/* Book settings — visible only to the author in Google AI Studio Build mode */}
          {onOpenBookSettings && (
            <button
              onClick={onOpenBookSettings}
              className="p-2 rounded-lg bg-[#2E2023] border border-[#443034] text-[#DBCBCD] hover:border-[#FF2A6D]/50 hover:text-[#FFA8C2] transition-colors"
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

