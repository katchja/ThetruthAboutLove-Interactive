import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Volume2,
  Play,
  Square,
  Check,
  Mic,
  Sparkles,
  Copy,
  Key,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Radio,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { VoiceSettings } from '../types';
import { speechEngine, encodeBlobToLinear16WavDataUrl } from '../utils/speechEngine';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onSaveSettings: (settings: VoiceSettings) => void;
  authorName: string;
}

const DEFAULT_EMBEDDED_VOICE_ID = 'voice_lp7vh3bk6taq';

const MANDATORY_CONSENT_SCRIPT =
  'I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.';

const GUIDED_REFERENCE_SCRIPT =
  'Love is not an emotion. It is a fundamental life force. When we understand this truth, the quality of our inner life increases. You expand who you are and dissolve the distortions that make you less than: the power dynamics, the control disguised as deep connection, and the synthetic AI lovers.';

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  authorName,
}) => {
  const resolveVoiceId = (raw?: string) =>
    raw && !raw.startsWith('gcv-catalina-author-v1-')
      ? raw
      : DEFAULT_EMBEDDED_VOICE_ID;

  const [engine, setEngine] = useState<'cloned_author' | 'browser'>(
    settings.engine || 'cloned_author'
  );
  const [currentVoice, setCurrentVoice] = useState(
    settings.voiceName || DEFAULT_EMBEDDED_VOICE_ID
  );
  const [rate, setRate] = useState(settings.rate || 1.0);
  const [pitch, setPitch] = useState(settings.pitch || 1.0);
  const [volume, setVolume] = useState(settings.volume || 1.0);
  const [voiceCloningKey, setVoiceCloningKey] = useState(
    resolveVoiceId(settings.voiceCloningKey)
  );
  const [voicePersonaPrompt, setVoicePersonaPrompt] = useState(
    settings.voicePersonaPrompt ||
      'Warm, articulate, poised female author voice with a luminous philosophical cadence, deliberate rhythmic pacing, resonant alto timbre, and fierce intellectual clarity'
  );
  const [prebuiltBaseVoice, setPrebuiltBaseVoice] = useState<
    'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir'
  >(settings.prebuiltBaseVoice || 'Kore');
  const [referenceAudioDataUrl, setReferenceAudioDataUrl] = useState<string | undefined>(
    settings.referenceAudioDataUrl
  );
  const [consentAudioDataUrl, setConsentAudioDataUrl] = useState<string | undefined>(
    undefined
  );

  // Guided Recording State
  const [showMicCalibration, setShowMicCalibration] = useState(false);
  const [activeRecStep, setActiveRecStep] = useState<'consent' | 'reference' | null>(
    null
  );
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micLevels, setMicLevels] = useState<number[]>(Array(18).fill(15));
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [cloneStatusMsg, setCloneStatusMsg] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Playback test state
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [playingSampleStep, setPlayingSampleStep] = useState<'consent' | 'reference' | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVoices(speechEngine.getVoices());
      setEngine(settings.engine || 'cloned_author');
      setCurrentVoice(settings.voiceName || DEFAULT_EMBEDDED_VOICE_ID);
      setRate(settings.rate || 1.0);
      setPitch(settings.pitch || 1.0);
      setVolume(settings.volume || 1.0);
      setVoiceCloningKey(resolveVoiceId(settings.voiceCloningKey));
      if (settings.voicePersonaPrompt) {
        setVoicePersonaPrompt(settings.voicePersonaPrompt);
      }
      if (settings.prebuiltBaseVoice) {
        setPrebuiltBaseVoice(settings.prebuiltBaseVoice);
      }
      setReferenceAudioDataUrl(settings.referenceAudioDataUrl);
      setCloneError(null);
    } else {
      stopActiveRecording();
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        sampleAudioRef.current = null;
      }
    }
  }, [isOpen]);

  const stopActiveRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      window.cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setActiveRecStep(null);
    setMicLevels(Array(18).fill(15));
  };

  const startGuidedRecording = async (step: 'consent' | 'reference') => {
    setCloneError(null);
    setCloneStatusMsg(null);
    if (activeRecStep) {
      stopActiveRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000,
        },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevels = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 18 }, (_, i) => {
          const val = dataArray[i % dataArray.length] || 0;
          return Math.max(12, Math.min(100, Math.round((val / 255) * 100)));
        });
        setMicLevels(bars);
        animFrameRef.current = requestAnimationFrame(updateLevels);
      };
      animFrameRef.current = requestAnimationFrame(updateLevels);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        try {
          await audioCtx.close();
        } catch {}
        const rawBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        try {
          const wavDataUrl = await encodeBlobToLinear16WavDataUrl(rawBlob, 24000);
          if (step === 'consent') {
            setConsentAudioDataUrl(wavDataUrl);
          } else {
            setReferenceAudioDataUrl(wavDataUrl);
          }
        } catch {
          setCloneError('Could not encode microphone audio to LINEAR16 WAV. Please try recording again.');
        }
      };

      recorder.start();
      setActiveRecStep(step);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setCloneError(
        'Microphone access was denied or unavailable. Please allow microphone permission in your browser.'
      );
    }
  };

  const handlePlayRecordedSample = (step: 'consent' | 'reference') => {
    const url = step === 'consent' ? consentAudioDataUrl : referenceAudioDataUrl;
    if (!url) return;

    if (playingSampleStep === step && sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current = null;
      setPlayingSampleStep(null);
      return;
    }

    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
    }

    const audio = new Audio(url);
    sampleAudioRef.current = audio;
    setPlayingSampleStep(step);
    audio.onended = () => setPlayingSampleStep(null);
    audio.onerror = () => setPlayingSampleStep(null);
    audio.play().catch(() => setPlayingSampleStep(null));
  };

  const handleCreateClonedVoice = async () => {
    if (!consentAudioDataUrl || !referenceAudioDataUrl) {
      setCloneError(
        'Please record both Step 1 (Google Consent Script) and Step 2 (Author Reference Script) first.'
      );
      return;
    }

    setIsGeneratingKey(true);
    setCloneError(null);
    setCloneStatusMsg(null);

    try {
      const response = await fetch('/api/voice-clone/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          consentAudioBase64: consentAudioDataUrl,
          referenceAudioBase64: referenceAudioDataUrl,
          authorName,
        }),
      });

      const rawText = await response.text();
      const data = JSON.parse(rawText);

      if (!response.ok || !data.voiceCloningKey) {
        throw new Error(data.error || 'Failed to generate voice cloning key.');
      }

      setVoiceCloningKey(data.voiceCloningKey);
      if (data.voicePersonaPrompt) {
        setVoicePersonaPrompt(data.voicePersonaPrompt);
      }
      if (data.prebuiltBaseVoice) {
        setPrebuiltBaseVoice(data.prebuiltBaseVoice);
      }
      setEngine('cloned_author');

      const updatedSettings: VoiceSettings = {
        engine: 'cloned_author',
        voiceName: data.voiceCloningKey,
        rate,
        pitch,
        volume,
        style: 'author_monologue',
        voiceCloningKey: data.voiceCloningKey,
        voicePersonaPrompt: data.voicePersonaPrompt || voicePersonaPrompt,
        prebuiltBaseVoice: data.prebuiltBaseVoice || prebuiltBaseVoice,
        referenceAudioDataUrl,
        consentRecordedAt: Date.now(),
        isClonedVoiceActive: true,
      };

      onSaveSettings(updatedSettings);
      setCloneStatusMsg(
        'Your Custom Author Voice has been embedded as the default voice across "Hear Catalina\'s Voice" and Author Voice Read Aloud.'
      );
    } catch (err: any) {
      setCloneError(err.message || 'Could not complete voice cloning calibration.');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleTestVoice = () => {
    if (isPlayingTest) {
      speechEngine.stop();
      setIsPlayingTest(false);
      return;
    }

    setIsPlayingTest(true);
    const activeId = voiceCloningKey || DEFAULT_EMBEDDED_VOICE_ID;
    const testText = `Love is not an emotion. It is a fundamental life force. When we understand this truth, the quality of our inner life increases.`;
    speechEngine.speak(
      testText,
      {
        engine,
        voiceName: activeId,
        rate,
        pitch,
        volume,
        style: 'author_monologue',
        voiceCloningKey: activeId,
        voicePersonaPrompt,
        prebuiltBaseVoice,
        referenceAudioDataUrl,
        isClonedVoiceActive: true,
      },
      {
        onEnd: () => setIsPlayingTest(false),
        onError: () => setIsPlayingTest(false),
      }
    );
  };

  const handleSave = () => {
    const activeId = (voiceCloningKey || DEFAULT_EMBEDDED_VOICE_ID).trim();
    onSaveSettings({
      engine,
      voiceName: engine === 'cloned_author' ? activeId : currentVoice,
      rate,
      pitch,
      volume,
      style: settings.style || 'author_monologue',
      voiceCloningKey: activeId,
      voicePersonaPrompt,
      prebuiltBaseVoice,
      referenceAudioDataUrl,
      isClonedVoiceActive: engine === 'cloned_author',
    });
    speechEngine.stop();
    onClose();
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1F1718]/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#FDFCFA] border border-[#EAE1D9] text-[#2A2022] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE1D9] flex items-center justify-between bg-[#FAF6F0] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FCECEF] text-[#FF2A6D] flex items-center justify-center border border-[#F3CBD2] shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-serif-book font-bold text-[#241B1C]">
                  Google Voice Studio · Author Voice
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#EDF7F1] border border-[#B7DFC6] text-[#1E5233] text-[10px] font-semibold">
                  Embedded &amp; Active
                </span>
              </div>
              <p className="text-xs text-[#8C7A7D] truncate">
                Embedded across &ldquo;Hear Catalina&apos;s Voice&rdquo; &amp; Author Voice Read Aloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C7A7D] hover:text-[#241B1C] hover:bg-[#F3EBE3] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Voice Engine Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F5EFEB] rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setEngine('cloned_author')}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                engine === 'cloned_author'
                  ? 'bg-[#FDFCFA] text-[#FF2A6D] shadow-sm font-semibold'
                  : 'text-[#635154] hover:text-[#241B1C]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Google Custom Author Voice (Default)</span>
            </button>
            <button
              type="button"
              onClick={() => setEngine('browser')}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                engine === 'browser'
                  ? 'bg-[#FDFCFA] text-[#241B1C] shadow-sm font-semibold'
                  : 'text-[#635154] hover:text-[#241B1C]'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Local Browser Voice</span>
            </button>
          </div>

          {engine === 'cloned_author' ? (
            <div className="space-y-4">
              {/* PRIMARY CARD: Embedded Google Voice Studio Profile */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#241B1C] to-[#332225] text-[#FAF7F2] border border-[#4A3237] shadow-md space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF2A6D] text-white text-[10px] font-bold tracking-wide uppercase">
                      <CheckCircle2 className="w-3 h-3" />
                      Active Default Voice
                    </span>
                    <span className="text-xs text-[#E2CFD3] font-medium">
                      Google Voice Studio Profile
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#FFA8C2]">
                    <Volume2 className="w-3.5 h-3.5 text-[#FF2A6D]" />
                    <span>Hear Catalina&apos;s Voice &amp; Author Voice</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#191112]/90 border border-[#443034] flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-[#B5A4A7] font-semibold">
                      Embedded Author Voice Persona
                    </div>
                    <div className="text-sm font-serif-book font-bold text-[#FFA8C2] mt-0.5">
                      {authorName} · Custom Studio Voice
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowKeyInput(!showKeyInput)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#2E2023] hover:bg-[#3D2A2E] border border-[#4A3237] text-xs font-medium text-[#FFA8C2] flex items-center gap-1.5 transition-colors"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Cadence Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestVoice}
                      className="px-3 py-1.5 rounded-lg bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Play
                        className={`w-3.5 h-3.5 fill-current ${
                          isPlayingTest ? 'animate-pulse' : ''
                        }`}
                      />
                      <span>
                        {isPlayingTest ? 'Stop Preview' : 'Preview Author Voice'}
                      </span>
                    </button>
                  </div>
                </div>

                {showKeyInput && (
                  <div className="pt-1 space-y-1.5">
                    <label className="block text-[11px] font-medium text-[#DBCBCD]">
                      Embedded Vocal Timbre &amp; Cadence Profile:
                    </label>
                    <textarea
                      rows={2}
                      value={voicePersonaPrompt}
                      onChange={(e) => setVoicePersonaPrompt(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#4A3237] bg-[#191112] text-xs text-[#FAF7F2] focus:outline-none focus:border-[#FF2A6D] leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {cloneStatusMsg && (
                <div className="p-3 rounded-xl bg-[#EDF7F1] border border-[#B7DFC6] text-xs text-[#1E5233] flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cloneStatusMsg}</span>
                </div>
              )}

              {cloneError && (
                <div className="p-3 rounded-xl bg-[#FDF0F3] border border-[#F3CBD2] text-xs text-[#9E2A44] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cloneError}</span>
                </div>
              )}

              {/* Collapsible Optional Microphone Recording Drawer */}
              <div className="rounded-xl border border-[#EAE1D9] bg-[#FAF7F2] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMicCalibration(!showMicCalibration)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#F5EFEB] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Mic className="w-3.5 h-3.5 text-[#FF2A6D]" />
                    <span className="text-xs font-semibold text-[#241B1C]">
                      Optional: Record New Microphone Sample to Re-Clone Voice
                    </span>
                  </div>
                  {showMicCalibration ? (
                    <ChevronUp className="w-4 h-4 text-[#8C7A7D]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8C7A7D]" />
                  )}
                </button>

                {showMicCalibration && (
                  <div className="p-4 pt-2 border-t border-[#EAE1D9] space-y-4">
                    {/* Step 1: Mandatory Google Consent Script */}
                    <div className="p-3.5 rounded-xl bg-[#FDFCFA] border border-[#EAE1D9] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-[#FF2A6D]">
                            01.
                          </span>
                          <h3 className="text-xs font-semibold text-[#241B1C]">
                            Record Mandatory Google Voice Talent Consent Script
                          </h3>
                        </div>
                        {consentAudioDataUrl && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2C6E49]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Consent Recorded (24kHz LINEAR16)</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-serif-book italic text-[#241B1C] bg-[#FAF7F2] p-3 rounded-lg border border-[#EAE1D9] leading-relaxed">
                        &ldquo;{MANDATORY_CONSENT_SCRIPT}&rdquo;
                      </p>

                      {activeRecStep === 'consent' && (
                        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#FFF0F4] border border-[#F3CBD2]">
                          <div className="flex items-center gap-1 h-6 flex-1">
                            {micLevels.map((lvl, idx) => (
                              <div
                                key={idx}
                                className="w-1 bg-[#FF2A6D] rounded-full transition-all duration-75"
                                style={{ height: `${lvl}%` }}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-mono tabular-nums font-semibold text-[#FF2A6D]">
                            {formatTimer(recordingSeconds)} / 00:15
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            activeRecStep === 'consent'
                              ? stopActiveRecording()
                              : startGuidedRecording('consent')
                          }
                          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            activeRecStep === 'consent'
                              ? 'bg-[#241B1C] text-white'
                              : 'bg-[#FF2A6D] hover:bg-[#E61556] text-white shadow-sm'
                          }`}
                        >
                          {activeRecStep === 'consent' ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>Stop Recording</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-3.5 h-3.5" />
                              <span>
                                {consentAudioDataUrl
                                  ? 'Re-record Consent'
                                  : 'Record Consent Script'}
                              </span>
                            </>
                          )}
                        </button>

                        {consentAudioDataUrl && (
                          <button
                            type="button"
                            onClick={() => handlePlayRecordedSample('consent')}
                            className="px-3 py-2 rounded-lg border border-[#EAE1D9] bg-[#FDFCFA] hover:bg-[#F5EFEB] text-xs font-medium text-[#443236] flex items-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            <Play className="w-3 h-3 fill-current text-[#FF2A6D]" />
                            <span>
                              {playingSampleStep === 'consent'
                                ? 'Stop Preview'
                                : 'Play Consent Take'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Guided Author Reference Script */}
                    <div className="p-3.5 rounded-xl bg-[#FDFCFA] border border-[#EAE1D9] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-[#FF2A6D]">
                            02.
                          </span>
                          <h3 className="text-xs font-semibold text-[#241B1C]">
                            Record Guided Author Reference Passage
                          </h3>
                        </div>
                        {referenceAudioDataUrl && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2C6E49]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Reference Recorded (24kHz LINEAR16)</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-serif-book italic text-[#241B1C] bg-[#FAF7F2] p-3 rounded-lg border border-[#EAE1D9] leading-relaxed">
                        &ldquo;{GUIDED_REFERENCE_SCRIPT}&rdquo;
                      </p>

                      {activeRecStep === 'reference' && (
                        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#FFF0F4] border border-[#F3CBD2]">
                          <div className="flex items-center gap-1 h-6 flex-1">
                            {micLevels.map((lvl, idx) => (
                              <div
                                key={idx}
                                className="w-1 bg-[#FF2A6D] rounded-full transition-all duration-75"
                                style={{ height: `${lvl}%` }}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-mono tabular-nums font-semibold text-[#FF2A6D]">
                            {formatTimer(recordingSeconds)} / 00:30
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            activeRecStep === 'reference'
                              ? stopActiveRecording()
                              : startGuidedRecording('reference')
                          }
                          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            activeRecStep === 'reference'
                              ? 'bg-[#241B1C] text-white'
                              : 'bg-[#FF2A6D] hover:bg-[#E61556] text-white shadow-sm'
                          }`}
                        >
                          {activeRecStep === 'reference' ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>Stop Recording</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-3.5 h-3.5" />
                              <span>
                                {referenceAudioDataUrl
                                  ? 'Re-record Reference Script'
                                  : 'Record Reference Script'}
                              </span>
                            </>
                          )}
                        </button>

                        {referenceAudioDataUrl && (
                          <button
                            type="button"
                            onClick={() => handlePlayRecordedSample('reference')}
                            className="px-3 py-2 rounded-lg border border-[#EAE1D9] bg-[#FDFCFA] hover:bg-[#F5EFEB] text-xs font-medium text-[#443236] flex items-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            <Play className="w-3 h-3 fill-current text-[#FF2A6D]" />
                            <span>
                              {playingSampleStep === 'reference'
                                ? 'Stop Preview'
                                : 'Play Reference Take'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCreateClonedVoice}
                      disabled={isGeneratingKey || !consentAudioDataUrl || !referenceAudioDataUrl}
                      className="px-4 py-2.5 rounded-xl bg-[#241B1C] hover:bg-[#3A2B2D] disabled:opacity-45 text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
                    >
                      {isGeneratingKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF2A6D]" />
                          <span>Generating Voice Cloning Key...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#FF2A6D]" />
                          <span>Generate New Key from Recorded Samples</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#443236] mb-1.5">
                Select Local Browser Voice Profile
              </label>
              <select
                value={currentVoice}
                onChange={(e) => setCurrentVoice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E0D4CB] bg-[#FAF7F2] text-xs text-[#2A2022] focus:outline-none focus:ring-1 focus:ring-[#C85A6E] focus:border-[#C85A6E]"
              >
                <option value="">Default System Natural Voice</option>
                {voices
                  .filter((v) => v.lang.startsWith('en'))
                  .map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Speaking Pace & Volume */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#443236]">Speaking Pace</span>
                <span className="font-mono tabular-nums text-[#8C7A7D]">{rate}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full accent-[#FF2A6D] cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#443236]">Output Volume</span>
                <span className="font-mono tabular-nums text-[#8C7A7D]">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-[#FF2A6D] cursor-pointer"
              />
            </div>
          </div>

          {/* Test Embedded Author Voice Button */}
          <div>
            <button
              type="button"
              onClick={handleTestVoice}
              className="w-full py-2.5 px-4 rounded-xl border border-[#F3CBD2] bg-[#FAF2F4] text-[#9E3E50] text-xs font-semibold hover:bg-[#FCECEF] transition-colors flex items-center justify-center gap-2"
            >
              <Play
                className={`w-3.5 h-3.5 fill-current ${isPlayingTest ? 'animate-pulse' : ''}`}
              />
              <span>
                {isPlayingTest
                  ? 'Stop Author Voice Test'
                  : `Test Embedded ${authorName} Voice`}
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#EAE1D9] bg-[#FAF6F0] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#7D6B6E] hover:text-[#241B1C] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-semibold shadow-md shadow-[#FF2A6D]/25 transition-colors"
          >
            Save as Default Author Voice
          </button>
        </div>
      </div>
    </div>
  );
};

