import React from 'react';
import {
  Heart,
  Settings,
} from 'lucide-react';
import { BookMetadata, AppView } from '../types';

interface HeaderProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  isOfflineMode: boolean;
  setIsOfflineMode: (offline: boolean) => void;
  bookMetadata: BookMetadata;
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
  onOpenBookSettings,
  onToggleSemanticSearch,
  isSemanticSearchOpen,
}) => {
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
              Catalina Butnaru · Reclaim your power through love
            </p>
          </div>
        </div>

        {/* View mode switcher */}
        <div className="hidden md:flex items-center p-1 bg-[#F1F3F4] rounded-xl text-xs gap-1">
          <button
            onClick={() => {
              setCurrentView('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
              currentView === 'landing'
                ? 'bg-[#FFFFFF] text-[#0B0B0C] font-semibold'
                : 'text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
          >
            <span>The Manuscript</span>
          </button>

          <button
            onClick={() => setCurrentView('archive')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
              currentView === 'archive'
                ? 'bg-[#FFFFFF] text-[#0B0B0C] font-semibold'
                : 'text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
          >
            <span>Literature</span>
          </button>
        </div>

        {/* Action controls & Privacy mode */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Semantic Search toggle */}
          <button
            onClick={onToggleSemanticSearch}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              isSemanticSearchOpen
                ? 'bg-[#C83E0B] text-white'
                : 'bg-[#F1F3F4] text-[#202124] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
            title="Search the archive"
          >
            <span>Search</span>
          </button>

          {/* Privacy */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              isOfflineMode
                ? 'bg-[#C83E0B] text-white font-semibold'
                : 'bg-[#F1F3F4] text-[#202124] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
            title={
              isOfflineMode
                ? 'Offline Privacy Active: Chats stay private in local browser.'
                : 'Hybrid Mode: Gemini answers with locally available passages.'
            }
          >
            <span>{isOfflineMode ? 'Offline Privacy' : 'Local Search'}</span>
          </button>

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

