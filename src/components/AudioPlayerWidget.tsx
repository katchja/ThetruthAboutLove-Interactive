import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Sparkles,
  Radio,
  Sliders,
  Loader2,
  Mic,
  PhoneCall,
} from 'lucide-react';
import { AudioOverviewData, Source, VoiceSettings } from '../types';
import { speechEngine } from '../utils/speechEngine';

interface AudioPlayerWidgetProps {
  selectedSources: Source[];
  voiceSettings: VoiceSettings;
  onOpenVoiceSettings: () => void;
  onOpenLiveVoice?: () => void;
  bookTitle: string;
}

export const AudioPlayerWidget: React.FC<AudioPlayerWidgetProps> = ({
  selectedSources,
  voiceSettings,
  onOpenVoiceSettings,
  onOpenLiveVoice,
  bookTitle,
}) => {
  const [audioOverview, setAudioOverview] = useState<AudioOverviewData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [styleMode, setStyleMode] = useState<'author_monologue' | 'podcast'>(
    'author_monologue'
  );
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  useEffect(() => {
    if (!audioOverview) {
      setAudioOverview({
        title: "Author's Manifesto: The Truth About Love",
        style: 'author_monologue',
        script: `Love is not an emotion. It is a fundamental life force.

You expand who you are and dissolve the distortions that make you less than: the power dynamics, the control disguised as deep connection, the programmatic content regulating your emotions, and the synthetic AI lovers.

By 2030, inner life and love will collide with a changed collective reality, one where AI-generated thought takes more room than your truth. To preserve the power of love, and to live a life to the highest standard, here's a place to start.

This manifesto is for you, fierce lovers!`,
        durationEstimateSeconds: 100,
        generatedAt: Date.now(),
      });
    }
  }, [bookTitle]);

  const handleGenerateOverview = async () => {
    setIsGenerating(true);
    speechEngine.stop();
    setIsPlaying(false);
    try {
      const response = await fetch('/api/audio-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: selectedSources,
          style: styleMode,
          topic: `Core insights and thesis of "${bookTitle}"`,
        }),
      });

      if (!response.ok) throw new Error('Audio overview failed');
      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      if (!contentType.includes('application/json') || rawText.trim().startsWith('<')) {
        throw new Error('Non-JSON response');
      }
      const data = JSON.parse(rawText);

      setAudioOverview({
        title:
          styleMode === 'author_monologue'
            ? "Author's Audio Reflection"
            : 'NotebookLM Deep Dive Podcast',
        script: data.script,
        style: styleMode,
        durationEstimateSeconds: 150,
        generatedAt: Date.now(),
      });
    } catch (err) {
      console.warn('Fallback audio overview generation:', err);
      setAudioOverview({
        title: "Author's Archival Reflection",
        script: `Love is not an emotion. It is a fundamental life force. When we understand this truth, the quality of our inner life increases. You expand who you are and dissolve the distortions that make you less than: the power dynamics, the control disguised as deep connection, the programmatic content regulating your emotions, and the synthetic AI lovers. By 2030, inner life and love will collide with a changed collective reality. This manifesto is for you, fierce lovers!`,
        style: styleMode,
        durationEstimateSeconds: 90,
        generatedAt: Date.now(),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!audioOverview) return;

    if (isPlaying) {
      speechEngine.stop();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      const settings: VoiceSettings = {
        ...voiceSettings,
        style: styleMode,
        rate: playbackSpeed,
      };

      speechEngine.speak(audioOverview.script, settings, {
        onStart: () => setIsPlaying(true),
        onEnd: () => {
          setIsPlaying(false);
          setCurrentProgress(0);
        },
        onError: () => setIsPlaying(false),
        onBoundary: (charIndex) => {
          const ratio = Math.min(
            100,
            (charIndex / Math.max(1, audioOverview.script.length)) * 100
          );
          setCurrentProgress(ratio);
        },
      });
    }
  };

  const handleSpeedCycle = () => {
    const speeds = [1.0, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
    if (isPlaying) {
      togglePlay();
      setTimeout(togglePlay, 100);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-[#EAE1D9] bg-[#FDFCFA] shadow-sm space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#FCECEF] text-[#C85A6E] flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-[#2A2022] truncate">
              Author Voice &amp; Audio Overview
            </h3>
            <span className="text-[10px] text-[#8C7A7D] block truncate">
              {voiceSettings.engine !== 'browser'
                ? 'Catalina Butnaru · Custom Author Voice'
                : 'Browser Voice Synthesis'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onOpenVoiceSettings}
            className="px-2.5 py-1 rounded-lg bg-[#FAF2F4] hover:bg-[#FCECEF] border border-[#F3CBD2] text-[#9E3E50] text-[10px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
            title="Open Author Voice Studio"
          >
            <Mic className="w-3 h-3" />
            <span>Author Voice</span>
          </button>
          <button
            onClick={onOpenVoiceSettings}
            className="p-1 rounded-md text-[#8C7A7D] hover:text-[#2A2022] transition-colors"
            title="Configure Voice Persona & Pitch"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Style selector segmented buttons */}
      <div className="grid grid-cols-2 p-1 bg-[#F5EFEB] rounded-xl text-[11px] font-medium">
        <button
          onClick={() => setStyleMode('author_monologue')}
          className={`py-1.5 px-2 rounded-lg transition-all text-center whitespace-nowrap ${
            styleMode === 'author_monologue'
              ? 'bg-[#FDFCFA] text-[#FF2A6D] shadow-sm font-semibold'
              : 'text-[#7D6B6E] hover:text-[#2A2022]'
          }`}
        >
          Author Voice
        </button>
        <button
          onClick={() => setStyleMode('podcast')}
          className={`py-1.5 px-2 rounded-lg transition-all text-center whitespace-nowrap ${
            styleMode === 'podcast'
              ? 'bg-[#FDFCFA] text-[#FF2A6D] shadow-sm font-semibold'
              : 'text-[#7D6B6E] hover:text-[#2A2022]'
          }`}
        >
          Podcast Duo
        </button>
      </div>

      {/* Player Card */}
      {audioOverview && (
        <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#EAE1D9] space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-xs font-medium text-[#2A2022] line-clamp-1">
                {audioOverview.title}
              </h4>
              <p className="text-[10px] text-[#8C7A7D] font-mono mt-0.5">
                {styleMode === 'author_monologue'
                  ? 'Catalina Butnaru Default Voice'
                  : 'Archival Deep Dive Duo'}
              </p>
            </div>
            <button
              onClick={handleSpeedCycle}
              className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-[#F0E6DE] text-[#635154]"
            >
              {playbackSpeed}x
            </button>
          </div>

          {/* Animated Waveform Visualization */}
          <div className="h-9 flex items-center justify-center gap-1 px-2 bg-[#F5EFEB] rounded-lg overflow-hidden">
            {Array.from({ length: 24 }).map((_, i) => {
              const height = isPlaying
                ? Math.max(
                    15,
                    Math.min(100, Math.sin(i * 0.5 + Date.now() / 200) * 40 + 50)
                  )
                : 20 + (i % 3) * 10;
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isPlaying ? 'bg-[#FF2A6D]' : 'bg-[#E0D4CB]'
                  }`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#EAE1D9] rounded-full h-1 overflow-hidden">
            <div
              className="bg-[#FF2A6D] h-full transition-all duration-300 shadow-sm"
              style={{ width: `${currentProgress}%` }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              onClick={togglePlay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-semibold transition-colors shadow-md shadow-[#FF2A6D]/25 whitespace-nowrap"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Voice</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Voice Overview</span>
                </>
              )}
            </button>

            <button
              onClick={handleGenerateOverview}
              disabled={isGenerating}
              className="text-[11px] text-[#7D6B6E] hover:text-[#FF2A6D] flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Scripting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-[#C85A6E]" />
                  <span>Regenerate Script</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Live Voice Conversation CTA */}
      {onOpenLiveVoice && (
        <button
          type="button"
          onClick={onOpenLiveVoice}
          className="w-full py-2 px-3 rounded-xl border border-[#EAE1D9] bg-[#FAF7F2] hover:bg-[#FFF0F4] hover:border-[#FF2A6D]/40 text-[#241B1C] text-xs font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <PhoneCall className="w-3.5 h-3.5 text-[#FF2A6D]" />
          <span>Start Real-Time Voice Conversation (`gemini-3.8-live`)</span>
        </button>
      )}
    </div>
  );
};
