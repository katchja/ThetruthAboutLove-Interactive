import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Mic, Square, Play, Pause, Volume2, Loader2 } from 'lucide-react';

const clientAudioCache = new Map<string, string>();

interface VoiceNotePlayerBubbleProps {
  text: string;
  initialAudioDataUrl?: string;
  variant?: 'default' | 'whatsapp' | 'compact' | 'runa';
  autoPlay?: boolean;
  label?: string;
  surfaceClassName?: string;
}

export const VoiceNotePlayerBubble: React.FC<VoiceNotePlayerBubbleProps> = ({
  text,
  initialAudioDataUrl,
  variant = 'default',
  autoPlay = false,
  label = 'Runa Audio Note',
  surfaceClassName,
}) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(
    initialAudioDataUrl || clientAudioCache.get(text) || null
  );
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.25 | 1.5>(1);
  const [usingSpeechFallback, setUsingSpeechFallback] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  // Estimate spoken duration from word count (~2.4 words/sec) before audio metadata loads
  const estimatedSeconds = useMemo(() => {
    const words = String(text || '')
      .replace(/\[(Source\s*\d+[^\]]*|\d+)\]/gi, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(4, Math.min(35, Math.round(words / 2.4)));
  }, [text]);

  // Deterministic 42-bar WhatsApp-style speech envelope waveform heights based on text content
  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    const seedStr = text || 'Runa';
    const count = 42;
    for (let i = 0; i < count; i++) {
      const code = seedStr.charCodeAt(i % seedStr.length) || 70;
      // Natural speech cadence envelope: syllabus peaks with brief conversational dips
      const envelope = Math.sin((i / count) * Math.PI) * 0.55 + 0.45;
      const syllableWave = Math.abs(Math.sin(i * 0.85 + (code % 7))) * 58;
      const microVariation = ((code * (i + 5) * 13) % 26);
      const val = Math.round(18 + (syllableWave + microVariation) * envelope);
      bars.push(Math.max(18, Math.min(96, val)));
    }
    return bars;
  }, [text]);

  useEffect(() => {
    if (initialAudioDataUrl) {
      setAudioUrl(initialAudioDataUrl);
      clientAudioCache.set(text, initialAudioDataUrl);
    }
  }, [initialAudioDataUrl, text]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (fallbackTimerRef.current) {
        window.clearInterval(fallbackTimerRef.current);
      }
      if (usingSpeechFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [usingSpeechFallback]);

  const startWebSpeechFallback = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanSpoken = String(text || '')
      .replace(/\[(Source\s*\d+[^\]]*|\d+)\]/gi, '')
      .replace(/[*#_`~>]/g, '')
      .trim();
    const utterance = new SpeechSynthesisUtterance(cleanSpoken);
    utterance.rate = playbackRate;
    utterance.pitch = 1.0;

    setUsingSpeechFallback(true);
    setIsPlaying(true);
    setProgress(0);
    const totalMs = (estimatedSeconds * 1000) / playbackRate;
    const startedAt = Date.now();

    if (fallbackTimerRef.current) window.clearInterval(fallbackTimerRef.current);
    fallbackTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(99, (elapsed / totalMs) * 100);
      setProgress(pct);
    }, 120);

    utterance.onend = () => {
      if (fallbackTimerRef.current) window.clearInterval(fallbackTimerRef.current);
      setIsPlaying(false);
      setProgress(100);
      setTimeout(() => setProgress(0), 600);
    };
    utterance.onerror = () => {
      if (fallbackTimerRef.current) window.clearInterval(fallbackTimerRef.current);
      setIsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const playAudioFromUrl = (urlToPlay: string) => {
    if (!audioRef.current || audioRef.current.src !== urlToPlay) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(urlToPlay);
      audio.playbackRate = playbackRate;
      audio.onloadedmetadata = () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
          setDurationSec(Math.round(audio.duration));
        }
      };
      audio.ontimeupdate = () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };
      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        startWebSpeechFallback();
      };
      audioRef.current = audio;
    }

    audioRef.current.playbackRate = playbackRate;
    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        startWebSpeechFallback();
      });
  };

  const handleTogglePlay = async () => {
    if (isPlaying) {
      if (usingSpeechFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        if (fallbackTimerRef.current) window.clearInterval(fallbackTimerRef.current);
        setIsPlaying(false);
        return;
      }
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (audioUrl) {
      playAudioFromUrl(audioUrl);
      return;
    }

    const cached = clientAudioCache.get(text);
    if (cached) {
      setAudioUrl(cached);
      playAudioFromUrl(cached);
      return;
    }

    setIsSynthesizing(true);
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName: 'Kore' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.audioDataUrl) {
          clientAudioCache.set(text, data.audioDataUrl);
          setAudioUrl(data.audioDataUrl);
          setIsSynthesizing(false);
          playAudioFromUrl(data.audioDataUrl);
          return;
        }
      }
      setIsSynthesizing(false);
      startWebSpeechFallback();
    } catch {
      setIsSynthesizing(false);
      startWebSpeechFallback();
    }
  };

  useEffect(() => {
    if (autoPlay && text) {
      handleTogglePlay().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  const cycleSpeed = () => {
    const next: 1 | 1.25 | 1.5 =
      playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : 1;
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const formatSeconds = (sec: number) => {
    const s = Math.max(1, Math.round(sec));
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const displaySeconds = durationSec > 0 ? durationSec : estimatedSeconds;
  const isWhatsApp = variant === 'whatsapp';
  const isRuna = variant === 'runa';
  const isCompact = variant === 'compact';

  return (
    <div
      className={`rounded-2xl transition-all flex items-center gap-3.5 select-none ${
        isWhatsApp
          ? 'bg-[#DCFCE7]/90 border border-[#BBF7D0] px-3.5 py-2.5 text-[#0B0B0C]'
          : isRuna
          ? `${surfaceClassName || 'bg-[#F4F5F8]'} px-4 py-3 text-[#0B0B0C]`
          : isCompact
          ? 'bg-[#F1F3F4] px-3 py-2 text-[#0B0B0C]'
          : 'bg-[#F8F9FA] border border-[#E8EAED] px-4 py-3 text-[#0B0B0C]'
      }`}
    >
      {isRuna ? (
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={isSynthesizing}
          className="relative w-11 h-11 rounded-full overflow-hidden bg-[#E4E6EB] shrink-0 cursor-pointer transition-transform active:scale-95 disabled:opacity-60"
          title={isPlaying ? 'Pause Voice Note' : 'Listen to Voice Note'}
        >
          <img
            src="/assets/aistudio/CatalinaButnaru_123bee84.webp"
            alt="Catalina Butnaru"
            className="w-full h-full object-cover object-top"
          />
          {isSynthesizing && (
            <div className="absolute inset-0 bg-[#141413]/35 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={isSynthesizing}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
            isWhatsApp
              ? 'bg-[#15803D] hover:bg-[#166534] text-white'
              : 'bg-[#C83E0B] hover:bg-[#A93207] text-white'
          } disabled:opacity-60`}
          title={isPlaying ? 'Pause Voice Note' : 'Listen to Voice Note'}
        >
          {isSynthesizing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      )}

      {isRuna ? (
        <div
          onClick={handleTogglePlay}
          className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 cursor-pointer"
        >
          {/* WhatsApp Voice-Note Style Grey Sound Wave + Scrubber Dot */}
          <div className="relative flex items-center justify-between gap-[2.5px] sm:gap-[3px] h-6 px-0.5">
            {waveformBars.map((barHeight, idx) => {
              const barPct = ((idx + 1) / waveformBars.length) * 100;
              const isActive = progress >= barPct;
              return (
                <div
                  key={idx}
                  className={`w-[2.5px] sm:w-[3px] rounded-full transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#3D3C38]'
                      : isPlaying
                      ? 'bg-[#8E8D87]/70'
                      : 'bg-[#9CA3AF]/65'
                  }`}
                  style={{ height: `${Math.max(18, Math.min(100, barHeight))}%` }}
                />
              );
            })}
            {/* WhatsApp Playhead Scrubber Dot */}
            <span
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#4A4944] pointer-events-none transition-all duration-150"
              style={{ left: `${Math.max(1.5, Math.min(98.5, progress))}%` }}
            />
          </div>

          {/* WhatsApp Bottom Metadata Row: Duration + Label */}
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#73726C] leading-none">
            <span className="tabular-nums">{formatSeconds(displaySeconds)}</span>
            <span className="truncate">
              {isSynthesizing ? 'Synthesizing Voice Note...' : label}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#5F6368]">
            <span className="inline-flex items-center gap-1 font-medium text-[#0B0B0C] truncate">
              <Volume2 className="w-3 h-3 shrink-0 text-[#C83E0B]" />
              <span>{isSynthesizing ? 'Synthesizing Voice Note...' : label}</span>
            </span>
            <span className="tabular-nums shrink-0">{formatSeconds(displaySeconds)}</span>
          </div>

          {/* Acoustic Waveform Scrubber */}
          <div className="flex items-center gap-[3px] h-5">
            {waveformBars.slice(0, 24).map((barHeight, idx) => {
              const barPct = ((idx + 1) / 24) * 100;
              const isActive = progress >= barPct;
              return (
                <div
                  key={idx}
                  className={`flex-1 rounded-full transition-colors duration-150 ${
                    isActive
                      ? isWhatsApp
                        ? 'bg-[#15803D]'
                        : 'bg-[#C83E0B]'
                      : isPlaying
                      ? 'bg-[#0B0B0C]/30'
                      : 'bg-[#0B0B0C]/20'
                  }`}
                  style={{ height: `${Math.max(22, Math.min(100, barHeight))}%` }}
                />
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={cycleSpeed}
        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors shrink-0 cursor-pointer tabular-nums ${
          isRuna
            ? 'runa-glass-btn runa-glass-pill text-[#4A4944]'
            : 'bg-[#FFFFFF] border border-[#E8EAED] text-[#0B0B0C] hover:bg-[#E8EAED]'
        }`}
        title="Toggle Voice Note playback speed"
      >
        {playbackRate}x
      </button>
    </div>
  );
};

interface VoiceNoteRecorderButtonProps {
  onTranscriptReady: (transcript: string, autoSend?: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  autoSendOnStop?: boolean;
  accentTheme?: 'default' | 'runa';
}

export const VoiceNoteRecorderButton: React.FC<VoiceNoteRecorderButtonProps> = ({
  onTranscriptReady,
  disabled = false,
  compact = false,
  autoSendOnStop = true,
  accentTheme = 'default',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const speechRecRef = useRef<any>(null);
  const liveSpeechTranscriptRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const startRecording = async () => {
    if (disabled || isTranscribing) return;
    setErrorHint(null);
    chunksRef.current = [];
    liveSpeechTranscriptRef.current = '';

    // Start parallel browser SpeechRecognition if available for instant fallback
    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (SpeechRecognitionCtor) {
      try {
        const rec = new SpeechRecognitionCtor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        rec.onresult = (event: any) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i++) {
            combined += event.results[i][0].transcript + ' ';
          }
          liveSpeechTranscriptRef.current = combined.trim();
        };
        rec.start();
        speechRecRef.current = rec;
      } catch {}
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (speechRecRef.current) {
          try {
            speechRecRef.current.stop();
          } catch {}
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        if (blob.size < 400 && liveSpeechTranscriptRef.current) {
          onTranscriptReady(liveSpeechTranscriptRef.current, autoSendOnStop);
          return;
        }

        setIsTranscribing(true);
        try {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: blob.type || 'audio/webm',
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.transcript) {
              onTranscriptReady(data.transcript, autoSendOnStop);
              setIsTranscribing(false);
              return;
            }
          }

          if (liveSpeechTranscriptRef.current) {
            onTranscriptReady(liveSpeechTranscriptRef.current, autoSendOnStop);
          } else {
            setErrorHint('Could not hear voice clearly. Try speaking closer to the mic.');
          }
        } catch {
          if (liveSpeechTranscriptRef.current) {
            onTranscriptReady(liveSpeechTranscriptRef.current, autoSendOnStop);
          } else {
            setErrorHint('Voice transcription unavailable.');
          }
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setSeconds(0);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      // If microphone permission is denied or unavailable in iframe, fall back to SpeechRecognition or prompt
      if (speechRecRef.current) {
        setIsRecording(true);
        setSeconds(0);
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          setSeconds((prev) => prev + 1);
        }, 1000);
      } else {
        setErrorHint('Microphone access is blocked by browser settings.');
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      return;
    }

    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {}
      if (liveSpeechTranscriptRef.current) {
        onTranscriptReady(liveSpeechTranscriptRef.current, autoSendOnStop);
      }
    }
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const isRunaTheme = accentTheme === 'runa';

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || isTranscribing}
        onClick={isRecording ? stopRecording : startRecording}
        className={`inline-flex items-center gap-2 rounded-full font-sans font-medium transition-all cursor-pointer ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-xs sm:text-sm'
        } ${
          isRecording
            ? isRunaTheme
              ? 'runa-glass-btn runa-glass-black text-white font-semibold animate-pulse'
              : 'bg-[#C83E0B] text-white animate-pulse'
            : isTranscribing
            ? 'bg-[#F1F3F4] text-[#0B0B0C]'
            : isRunaTheme
            ? 'runa-glass-btn runa-glass-pill text-[#0B0B0C] font-semibold'
            : 'bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#0B0B0C]'
        } disabled:opacity-50`}
        title={
          isRecording
            ? 'Stop recording and send Voice Note'
            : 'Record a spoken Voice Note inquiry'
        }
      >
        {isTranscribing ? (
          <>
            <Loader2
              className={`w-3.5 h-3.5 animate-spin ${
                isRunaTheme ? 'text-[#0B0B0C]' : 'text-[#C83E0B]'
              }`}
            />
            <span>Transcribing...</span>
          </>
        ) : isRecording ? (
          <>
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="font-mono tabular-nums">Stop · {formatTimer(seconds)}</span>
          </>
        ) : (
          <>
            <Mic
              className={`w-3.5 h-3.5 ${
                isRunaTheme ? 'text-[#0B0B0C]' : 'text-[#C83E0B]'
              }`}
            />
            <span>{compact ? 'Voice Note' : 'Record Voice Note'}</span>
          </>
        )}
      </button>
      {errorHint && (
        <span
          className={`text-[11px] font-sans ${
            isRunaTheme ? 'text-[#0098A6]' : 'text-[#C83E0B]'
          }`}
        >
          {errorHint}
        </span>
      )}
    </div>
  );
};
