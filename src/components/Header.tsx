import React from 'react';
import {
  Heart,
  Settings,
  MessageCircle,
  Sparkles,
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
  onOpenWhatsAppModal?: () => void;
  onPublishToPublic?: () => void;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  syncedStats?: {
    totalSources: number;
    photoCount: number;
    citationCount: number;
  };
}

const RUNA_MORPH_PATHS = (() => {
  const N = 48;

  const buildClosedBezierPath = (
    pts: Array<{ x: number; y: number }>,
    smoothness = 1
  ) => {
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % N];
      const p3 = pts[(i + 2) % N];

      // Linear control points along segment p1->p2 (keeps Tiwaz rune ᛏ crisp & angular)
      const linCp1x = p1.x + (p2.x - p1.x) / 3;
      const linCp1y = p1.y + (p2.y - p1.y) / 3;
      const linCp2x = p1.x + ((p2.x - p1.x) * 2) / 3;
      const linCp2y = p1.y + ((p2.y - p1.y) * 2) / 3;

      // Catmull-Rom smooth control points (for fluid organic voice wave shapes)
      const smCp1x = p1.x + (p2.x - p0.x) / 6;
      const smCp1y = p1.y + (p2.y - p0.y) / 6;
      const smCp2x = p2.x - (p3.x - p1.x) / 6;
      const smCp2y = p2.y - (p3.y - p1.y) / 6;

      const cp1x = linCp1x + (smCp1x - linCp1x) * smoothness;
      const cp1y = linCp1y + (smCp1y - linCp1y) * smoothness;
      const cp2x = linCp2x + (smCp2x - linCp2x) * smoothness;
      const cp2y = linCp2y + (smCp2y - linCp2y) * smoothness;

      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return `${d} Z`;
  };

  const buildSmoothClosedPath = (fn: (t: number) => { x: number; y: number }) => {
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push(fn(t));
    }
    return buildClosedBezierPath(pts, 1);
  };

  // 1. Original Resting Shape: ᛏ (Tiwaz Rune — upward spear/arrow with vertical stave)
  const tiwazPath = (() => {
    const waypoints = [
      { x: 50, y: 16 }, // Top apex
      { x: 75, y: 40 }, // Right wing tip
      { x: 50, y: 16 }, // Back to top apex junction
      { x: 50, y: 84 }, // Bottom of central vertical stave
      { x: 50, y: 16 }, // Up central vertical stave to top apex
      { x: 25, y: 40 }, // Left wing tip
    ];
    const segLen = N / waypoints.length; // 8 points per segment (6 * 8 = 48)
    const pts: Array<{ x: number; y: number }> = [];
    for (let s = 0; s < waypoints.length; s++) {
      const a = waypoints[s];
      const b = waypoints[(s + 1) % waypoints.length];
      for (let k = 0; k < segLen; k++) {
        const u = k / segLen;
        pts.push({
          x: a.x + (b.x - a.x) * u,
          y: a.y + (b.y - a.y) * u,
        });
      }
    }
    return buildClosedBezierPath(pts, 0);
  })();

  // 2. Circle (Cresta transition frame)
  const circlePath = buildSmoothClosedPath((t) => ({
    x: 50 + 27 * Math.sin(t),
    y: 50 - 27 * Math.cos(t),
  }));

  // 3. Right Acoustic Teardrop Lobe
  const teardropRightPath = buildSmoothClosedPath((t) => ({
    x: 50 + 29 * Math.sin(t),
    y: 50 - 24 * Math.cos(t) * (1 - 0.36 * Math.sin(t)),
  }));

  // 4. Asymmetric Infinity Voice Wave (left loop larger)
  const infinityLeftPath = buildSmoothClosedPath((t) => ({
    x: 50 + 30 * Math.sin(t),
    y: 50 - 20 * Math.sin(2 * t) * (1 - 0.25 * Math.sin(t)),
  }));

  // 5. Asymmetric Infinity Voice Wave (right loop larger)
  const infinityRightPath = buildSmoothClosedPath((t) => ({
    x: 50 + 30 * Math.sin(t),
    y: 50 + 20 * Math.sin(2 * t) * (1 + 0.25 * Math.sin(t)),
  }));

  // 6. Soft Diamond Wave Pulse
  const diamondWavePath = buildSmoothClosedPath((t) => {
    const s = Math.sin(t);
    const c = Math.cos(t);
    return {
      x: 50 + 28 * Math.sign(s) * Math.pow(Math.abs(s), 0.72),
      y: 50 - 26 * Math.sign(c) * Math.pow(Math.abs(c), 0.72),
    };
  });

  // 7. Left Acoustic Teardrop Lobe
  const teardropLeftPath = buildSmoothClosedPath((t) => ({
    x: 50 + 29 * Math.sin(t),
    y: 50 - 24 * Math.cos(t) * (1 + 0.36 * Math.sin(t)),
  }));

  const keyframes = [
    tiwazPath,
    tiwazPath,
    circlePath,
    teardropRightPath,
    infinityLeftPath,
    infinityRightPath,
    diamondWavePath,
    teardropLeftPath,
    circlePath,
    tiwazPath,
  ];

  return {
    originPath: tiwazPath,
    values: keyframes.join(';'),
    keyTimes: '0;0.18;0.28;0.39;0.50;0.62;0.74;0.84;0.92;1',
    keySplines: Array(keyframes.length - 1)
      .fill('0.42 0 0.58 1')
      .join(';'),
  };
})();

const RunaMorphingHeartLogo: React.FC = () => (
  <svg
    viewBox="0 0 100 100"
    className="w-7 h-7 overflow-visible"
    fill="none"
    aria-label="Runa Agent Animated Tiwaz Rune Voice Logo"
  >
    <path
      d={RUNA_MORPH_PATHS.originPath}
      stroke="#FFFFFF"
      strokeWidth="7.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <animate
        attributeName="d"
        values={RUNA_MORPH_PATHS.values}
        keyTimes={RUNA_MORPH_PATHS.keyTimes}
        keySplines={RUNA_MORPH_PATHS.keySplines}
        calcMode="spline"
        dur="4.6s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  isOfflineMode,
  setIsOfflineMode,
  onOpenBookSettings,
  onToggleSemanticSearch,
  isSemanticSearchOpen,
  onOpenWhatsAppModal,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-md text-[#0B0B0C] border-b border-[#E8EAED]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand / Book info (clickable to homepage) */}
        <div
          onClick={() => {
            setCurrentView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-3 min-w-0 cursor-pointer group shrink-0"
          title={
            currentView === 'pitch'
              ? 'Runa Agent — Chat with the books you love'
              : 'Return to Homepage: The Truth About Love'
          }
        >
          <div className="w-10 h-10 rounded-xl bg-[#0B0B0C] flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
            {currentView === 'pitch' ? (
              <RunaMorphingHeartLogo />
            ) : (
              <Heart className="w-5 h-5 text-white fill-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-[#0B0B0C] text-lg tracking-tight truncate group-hover:text-[#5F6368] transition-colors whitespace-nowrap ${
                  currentView === 'pitch'
                    ? "font-['Georgia',serif] font-bold"
                    : 'font-medium font-display'
                }`}
              >
                {currentView === 'pitch' ? 'Runa' : 'The Truth About Love'}
              </span>
            </div>
            <p className="text-xs text-[#5F6368] truncate max-w-xs font-sans">
              {currentView === 'pitch'
                ? 'Chat with the books you love'
                : 'By Catalina Butnaru · Chat with the manuscript'}
            </p>
          </div>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center p-1 bg-[#F1F3F4] rounded-xl text-xs gap-1 overflow-x-auto">
          <button
            onClick={() => {
              setCurrentView('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
              currentView === 'landing'
                ? 'bg-[#FFFFFF] text-[#0B0B0C] font-semibold'
                : 'text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
          >
            <span>The Manuscript</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('archive');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
              currentView === 'archive'
                ? 'bg-[#FFFFFF] text-[#0B0B0C] font-semibold'
                : 'text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
          >
            <span>Literature</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('pitch');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
              currentView === 'pitch'
                ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                : 'text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
            title="Runa Investor Pitch & Author SaaS Toolkit"
          >
            <Sparkles className="w-3 h-3 text-current" />
            <span>Runa</span>
          </button>
        </div>

        {/* Action controls & Privacy mode */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenWhatsAppModal && (
            <button
              type="button"
              onClick={onOpenWhatsAppModal}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'pitch'
                  ? 'runa-glass-btn runa-glass-pill text-[#0B0B0C] font-semibold'
                  : 'bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D]'
              }`}
              title="Open WhatsApp Runa Companion"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          )}

          {/* Semantic Search toggle */}
          <button
            onClick={onToggleSemanticSearch}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              isSemanticSearchOpen
                ? currentView === 'pitch'
                  ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                  : 'bg-[#C83E0B] text-white'
                : currentView === 'pitch'
                ? 'runa-glass-btn runa-glass-pill text-[#202124] hover:text-[#0B0B0C]'
                : 'bg-[#F1F3F4] text-[#202124] hover:text-[#0B0B0C] hover:bg-[#E8EAED]'
            }`}
            title="Search the archive"
          >
            <span>Search</span>
          </button>

          {/* Privacy */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`hidden lg:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              isOfflineMode
                ? currentView === 'pitch'
                  ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                  : 'bg-[#C83E0B] text-white font-semibold'
                : currentView === 'pitch'
                ? 'runa-glass-btn runa-glass-pill text-[#202124] hover:text-[#0B0B0C]'
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


