import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Sparkles,
  Volume2,
  Send,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { VoiceSettings } from '../types';
import { speechEngine } from '../utils/speechEngine';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceSettings: VoiceSettings;
  authorName: string;
  bookTitle: string;
}

interface LiveTranscriptTurn {
  id: string;
  speaker: 'user' | 'author';
  text: string;
  voiceId?: string;
}

const DEFAULT_EMBEDDED_VOICE_ID = 'voice_lp7vh3bk6taq';

function float32ToPcm16Base64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function pcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const numSamples = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 / 32768.0;
  }
  return float32;
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  voiceSettings,
  authorName,
  bookTitle,
}) => {
  const embeddedVoiceId =
    voiceSettings.voiceCloningKey &&
    !voiceSettings.voiceCloningKey.startsWith('gcv-catalina-author-v1-')
      ? voiceSettings.voiceCloningKey
      : DEFAULT_EMBEDDED_VOICE_ID;

  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<LiveTranscriptTurn[]>([]);
  const [textInput, setTextInput] = useState('');
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(20).fill(18));
  const [voiceMode, setVoiceMode] = useState<'author_studio' | 'direct_live'>('author_studio');
  const [copiedVoiceId, setCopiedVoiceId] = useState(false);
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMicMutedRef = useRef<boolean>(false);
  const voiceModeRef = useRef<'author_studio' | 'direct_live'>('author_studio');
  const currentAuthorTextRef = useRef<string>('');
  const bufferedTurnChunksRef = useRef<string[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  useEffect(() => {
    if (isOpen) {
      startLiveSession();
    } else {
      cleanupSession();
    }
    return () => {
      cleanupSession();
    };
  }, [isOpen, embeddedVoiceId]);

  const stopScheduledPlayback = () => {
    speechEngine.stop();
    setSpeakingTurnId(null);
    for (const src of scheduledSourcesRef.current) {
      try {
        src.stop();
      } catch {}
    }
    scheduledSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setIsModelSpeaking(false);
  };

  const playPcmChunk24k = (base64Audio: string) => {
    const outCtx = outputAudioCtxRef.current;
    if (!outCtx) return;

    if (outCtx.state === 'suspended') {
      outCtx.resume().catch(() => {});
    }

    const floatSamples = pcm16Base64ToFloat32(base64Audio);
    if (floatSamples.length === 0) return;

    const audioBuffer = outCtx.createBuffer(1, floatSamples.length, 24000);
    audioBuffer.getChannelData(0).set(floatSamples);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    scheduledSourcesRef.current.push(source);
    setIsModelSpeaking(true);

    source.onended = () => {
      scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
      if (scheduledSourcesRef.current.length === 0) {
        setIsModelSpeaking(false);
      }
    };
  };

  const synthesizeTurnWithEmbeddedAuthorVoice = async (
    textToSpeak: string,
    fallbackChunks: string[]
  ) => {
    const clean = textToSpeak.trim();
    if (!clean) {
      fallbackChunks.forEach((c) => playPcmChunk24k(c));
      return;
    }

    setIsModelSpeaking(true);
    try {
      await speechEngine.speak(
        clean,
        {
          ...voiceSettings,
          engine: 'cloned_author',
          style: 'author_monologue',
          voiceCloningKey: embeddedVoiceId,
          isClonedVoiceActive: true,
        },
        {
          onStart: () => setIsModelSpeaking(true),
          onEnd: () => setIsModelSpeaking(false),
          onError: () => {
            setIsModelSpeaking(false);
            fallbackChunks.forEach((c) => playPcmChunk24k(c));
          },
        }
      );
    } catch {
      fallbackChunks.forEach((c) => playPcmChunk24k(c));
    }
  };

  const startLiveSession = async () => {
    cleanupSession();
    setStatus('connecting');
    setErrorMessage(null);
    setTranscripts([]);
    currentAuthorTextRef.current = '';
    bufferedTurnChunksRef.current = [];

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const baseVoice = voiceSettings.prebuiltBaseVoice || 'Kore';
      const wsUrl = `${protocol}//${window.location.host}/live?voiceId=${encodeURIComponent(
        embeddedVoiceId
      )}&voice=${encodeURIComponent(baseVoice)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'connected') {
            setStatus('connected');
          } else if (msg.type === 'audio' && msg.audio) {
            if (voiceModeRef.current === 'direct_live') {
              playPcmChunk24k(msg.audio);
            } else {
              bufferedTurnChunksRef.current.push(msg.audio);
            }
          } else if (msg.type === 'interrupted') {
            currentAuthorTextRef.current = '';
            bufferedTurnChunksRef.current = [];
            stopScheduledPlayback();
          } else if (msg.type === 'input_transcript' && msg.text) {
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === 'user') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: `${last.text} ${msg.text}`.trim() },
                ];
              }
              return [
                ...prev,
                { id: `u-${Date.now()}`, speaker: 'user', text: msg.text },
              ];
            });
          } else if (msg.type === 'output_transcript' && msg.text) {
            currentAuthorTextRef.current = `${currentAuthorTextRef.current} ${msg.text}`.trim();
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === 'author') {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    text: `${last.text} ${msg.text}`.trim(),
                    voiceId: embeddedVoiceId,
                  },
                ];
              }
              return [
                ...prev,
                {
                  id: `a-${Date.now()}`,
                  speaker: 'author',
                  text: msg.text,
                  voiceId: embeddedVoiceId,
                },
              ];
            });
          } else if (msg.type === 'turn_complete') {
            if (voiceModeRef.current === 'author_studio') {
              const turnText = currentAuthorTextRef.current;
              const fallbackChunks = [...bufferedTurnChunksRef.current];
              currentAuthorTextRef.current = '';
              bufferedTurnChunksRef.current = [];
              if (turnText || fallbackChunks.length > 0) {
                synthesizeTurnWithEmbeddedAuthorVoice(turnText, fallbackChunks);
              }
            } else {
              currentAuthorTextRef.current = '';
              bufferedTurnChunksRef.current = [];
            }
          } else if (msg.type === 'error') {
            setStatus('error');
            setErrorMessage(msg.message || 'Live voice session encountered an error.');
          }
        } catch {}
      };

      ws.onerror = () => {
        setStatus('error');
        setErrorMessage('Could not connect to Live Voice WebSocket.');
      };

      // Capture 16kHz microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      inputAudioCtxRef.current = inputCtx;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (isMicMutedRef.current) return;
        const inputSamples = e.inputBuffer.getChannelData(0);

        // Compute visual level bars
        let sum = 0;
        for (let i = 0; i < inputSamples.length; i += 64) {
          sum += Math.abs(inputSamples[i]);
        }
        const avg = sum / (inputSamples.length / 64);
        const bars = Array.from({ length: 20 }, (_, idx) =>
          Math.max(14, Math.min(100, Math.round(avg * 450 + ((idx * 7) % 25))))
        );
        setAudioLevels(bars);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const base64Pcm = float32ToPcm16Base64(inputSamples);
          wsRef.current.send(JSON.stringify({ audio: base64Pcm }));
        }
      };
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(
        err?.message ||
          'Microphone permission is required for real-time voice conversation.'
      );
    }
  };

  const cleanupSession = () => {
    stopScheduledPlayback();
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setStatus('idle');
    setIsModelSpeaking(false);
  };

  const handleSendTextTurn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    const text = textInput.trim();
    setTextInput('');
    currentAuthorTextRef.current = '';
    bufferedTurnChunksRef.current = [];
    setTranscripts((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, speaker: 'user', text },
    ]);
    wsRef.current.send(JSON.stringify({ text }));
  };

  const handleReplayAuthorTurn = (turn: LiveTranscriptTurn) => {
    if (speakingTurnId === turn.id) {
      stopScheduledPlayback();
      return;
    }
    stopScheduledPlayback();
    setSpeakingTurnId(turn.id);
    setIsModelSpeaking(true);
    speechEngine.speak(
      turn.text,
      {
        ...voiceSettings,
        engine: 'cloned_author',
        style: 'author_monologue',
        voiceCloningKey: embeddedVoiceId,
        isClonedVoiceActive: true,
      },
      {
        onStart: () => setIsModelSpeaking(true),
        onEnd: () => {
          setSpeakingTurnId(null);
          setIsModelSpeaking(false);
        },
        onError: () => {
          setSpeakingTurnId(null);
          setIsModelSpeaking(false);
        },
      }
    );
  };

  const handleCopyVoiceId = () => {
    navigator.clipboard.writeText(embeddedVoiceId);
    setCopiedVoiceId(true);
    setTimeout(() => setCopiedVoiceId(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1F1718]/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#FDFCFA] border border-[#EAE1D9] text-[#2A2022] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#241B1C] text-[#FAF7F2] flex items-center justify-between border-b border-[#3B2B2E]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FF2A6D] text-white flex items-center justify-center shadow-md shadow-[#FF2A6D]/30 shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-serif-book font-bold text-[#FAF7F2]">
                Live Voice Conversation
              </h2>
              <p className="text-xs text-[#FFA8C2] truncate">
                {authorName} · {bookTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#C2B2B5] hover:text-white hover:bg-[#382629] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Author Voice Active Bar (ID hidden) */}
        <div className="px-5 py-2.5 bg-[#FAF2F4] border-b border-[#F3CBD2] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2C6E49] shrink-0" />
            <span className="font-semibold text-[#241B1C]">
              {authorName} Author Voice Active
            </span>
          </div>

          {/* Voice Output Mode Selector */}
          <div className="flex items-center gap-1 bg-[#F3E5E9] p-0.5 rounded-lg text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setVoiceMode('author_studio')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                voiceMode === 'author_studio'
                  ? 'bg-[#FF2A6D] text-white shadow-sm'
                  : 'text-[#635154] hover:text-[#241B1C]'
              }`}
              title="Speak live responses with Custom Author Voice"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Author Voice</span>
            </button>
            <button
              type="button"
              onClick={() => setVoiceMode('direct_live')}
              className={`px-2 py-1 rounded-md transition-all ${
                voiceMode === 'direct_live'
                  ? 'bg-[#241B1C] text-white shadow-sm'
                  : 'text-[#635154] hover:text-[#241B1C]'
              }`}
              title="Stream raw Live PCM audio directly"
            >
              <span>Direct Live Stream</span>
            </button>
          </div>
        </div>

        {/* Visualizer & Status Stage */}
        <div className="p-5 bg-[#FAF6F0] border-b border-[#EAE1D9] flex flex-col items-center text-center space-y-3.5">
          <div className="text-xs font-medium text-[#635154]">
            {status === 'connecting' && 'Connecting Live Voice Session...'}
            {status === 'connected' &&
              (isModelSpeaking
                ? `${authorName} is speaking...`
                : isMicMuted
                ? 'Microphone muted'
                : 'Listening to your voice in real time...')}
            {status === 'error' && 'Connection interrupted'}
          </div>

          {/* Live Waveform Bars */}
          <div className="h-14 w-full max-w-sm flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#FDFCFA] border border-[#EAE1D9]">
            {audioLevels.map((lvl, idx) => {
              const barHeight = isModelSpeaking
                ? Math.max(
                    20,
                    Math.min(100, Math.round(Math.sin(idx * 0.7 + Date.now() / 120) * 38 + 55))
                  )
                : isMicMuted
                ? 14
                : lvl;
              return (
                <div
                  key={idx}
                  className={`w-1.5 rounded-full transition-all duration-100 ${
                    isModelSpeaking
                      ? 'bg-[#FF2A6D]'
                      : status === 'connected' && !isMicMuted
                      ? 'bg-[#241B1C]'
                      : 'bg-[#E0D4CB]'
                  }`}
                  style={{ height: `${barHeight}%` }}
                />
              );
            })}
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-[#FDF0F3] border border-[#F3CBD2] text-xs text-[#9E2A44] flex items-center gap-2 max-w-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Call Controls */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsMicMuted(!isMicMuted)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${
                isMicMuted
                  ? 'bg-[#FDF0F3] border-[#F3CBD2] text-[#9E2A44]'
                  : 'bg-[#FDFCFA] border-[#EAE1D9] text-[#241B1C] hover:bg-[#F5EFEB]'
              }`}
            >
              {isMicMuted ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Unmute Mic</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-[#FF2A6D]" />
                  <span>Mute Mic</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#241B1C] hover:bg-[#3A2B2E] text-white text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <PhoneOff className="w-4 h-4 text-[#FF2A6D]" />
              <span>End Voice Session</span>
            </button>
          </div>
        </div>

        {/* Live Transcript Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#FAF7F2] min-h-[170px] max-h-[250px]">
          {transcripts.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#8C7A7D] space-y-1">
              <p className="font-medium text-[#524245]">
                Speak naturally or type below to converse with {authorName} in real time.
              </p>
              <p>
                Try asking: &ldquo;Why is love a fundamental life force rather than an emotion?&rdquo;
              </p>
            </div>
          ) : (
            transcripts.map((turn) => (
              <div
                key={turn.id}
                className={`flex flex-col ${
                  turn.speaker === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    turn.speaker === 'user'
                      ? 'bg-[#FF2A6D] text-white'
                      : 'bg-[#FDFCFA] border border-[#EAE1D9] text-[#241B1C]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] opacity-80 mb-1 font-medium">
                    <span>{turn.speaker === 'user' ? 'You' : authorName}</span>
                    {turn.speaker === 'author' && (
                      <button
                        type="button"
                        onClick={() => handleReplayAuthorTurn(turn)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FAF2F4] text-[#FF2A6D] hover:bg-[#FCECEF] font-medium text-[9px]"
                        title="Replay in Author Voice"
                      >
                        <Volume2 className="w-2.5 h-2.5" />
                        <span>{speakingTurnId === turn.id ? 'Stop' : 'Replay'}</span>
                      </button>
                    )}
                  </div>
                  <div>{turn.text}</div>
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Optional Text Prompt Input inside Live Session */}
        <form
          onSubmit={handleSendTextTurn}
          className="p-3 bg-[#FAF6F0] border-t border-[#EAE1D9] flex items-center gap-2"
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={`Type a prompt to hear ${authorName} respond...`}
            className="flex-1 px-3.5 py-2 rounded-xl border border-[#E0D4CB] bg-[#FDFCFA] text-xs text-[#241B1C] focus:outline-none focus:border-[#FF2A6D]"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || status !== 'connected'}
            className="px-3.5 py-2 rounded-xl bg-[#FF2A6D] hover:bg-[#E61556] disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Speak</span>
          </button>
        </form>
      </div>
    </div>
  );
};

