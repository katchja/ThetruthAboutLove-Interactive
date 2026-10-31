import { VoiceSettings } from '../types';

export interface SpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onBoundary?: (charIndex: number, currentText: string) => void;
  onError?: (err: any) => void;
}

/**
 * Resamples and encodes a browser AudioBuffer into a standard 24kHz 16-bit mono PCM WAV (LINEAR16)
 * returned as a data:audio/wav;base64,... string for Google Cloud Instant Custom Voice API.
 */
export async function encodeBlobToLinear16WavDataUrl(
  blob: Blob,
  targetSampleRate = 24000
): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(decoded.duration * targetSampleRate)),
      targetSampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    const samples = rendered.getChannelData(0);

    const wavBuffer = encodeLinear16Wav(samples, targetSampleRate);
    const bytes = new Uint8Array(wavBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return `data:audio/wav;base64,${btoa(binary)}`;
  } finally {
    try {
      await audioCtx.close();
    } catch {}
  }
}

function encodeLinear16Wav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1 (LINEAR16)
  view.setUint16(22, 1, true); // Mono = 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // 16 bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

class SpeechEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private abortController: AbortController | null = null;
  private isSpeakingState = false;
  private isPausedState = false;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private audioCache: Map<string, string> = new Map();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  public isSupported(): boolean {
    return true;
  }

  private loadVoices() {
    if (!this.synth) return;
    this.availableVoices = this.synth.getVoices();
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.availableVoices.length === 0 && this.synth) {
      this.availableVoices = this.synth.getVoices();
    }
    return this.availableVoices;
  }

  private playbackSessionId = 0;

  private splitIntoSpeechChunks(text: string, maxChunkLength = 550): string[] {
    if (text.length <= maxChunkLength) {
      return [text];
    }

    const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [text];
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if ((current + ' ' + trimmed).trim().length <= maxChunkLength) {
        current = (current + ' ' + trimmed).trim();
      } else {
        if (current) chunks.push(current);
        if (trimmed.length <= maxChunkLength) {
          current = trimmed;
        } else {
          // Split extra-long single sentence on commas or spaces
          let remaining = trimmed;
          while (remaining.length > maxChunkLength) {
            const slice = remaining.slice(0, maxChunkLength);
            const splitIdx = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf(' '));
            const cut = splitIdx > 200 ? splitIdx + 1 : maxChunkLength;
            chunks.push(remaining.slice(0, cut).trim());
            remaining = remaining.slice(cut).trim();
          }
          current = remaining;
        }
      }
    }

    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [text];
  }

  public async speak(
    text: string,
    settings: VoiceSettings,
    callbacks?: SpeechCallbacks
  ) {
    this.stop();
    const sessionId = ++this.playbackSessionId;

    const cleanText = text
      .replace(/\[Source\s*\d+[^\]]*\]/gi, '')
      .replace(/[*#_`>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    if (!cleanText) {
      callbacks?.onEnd?.();
      return;
    }

    // Default to cloned_author neural voice unless user explicitly switched to local browser TTS
    if (settings.engine !== 'browser') {
      try {
        await this.speakWithClonedVoice(cleanText, settings, callbacks, sessionId);
        return;
      } catch {
        if (sessionId !== this.playbackSessionId) return;
      }
    }

    if (sessionId === this.playbackSessionId) {
      this.speakWithBrowser(cleanText, settings, callbacks);
    }
  }

  private async fetchChunkAudioDataUrl(
    chunkText: string,
    settings: VoiceSettings,
    activeVoiceId: string,
    signal: AbortSignal
  ): Promise<string> {
    const cacheKey = `${settings.style || 'author_monologue'}|${activeVoiceId}|${settings.prebuiltBaseVoice || 'Kore'}|${chunkText.slice(0, 200)}|${chunkText.length}`;
    const cached = this.audioCache.get(cacheKey);
    if (cached) return cached;

    const response = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        text: chunkText,
        style: settings.style || 'author_monologue',
        voiceCloningKey: activeVoiceId,
        voicePersonaPrompt: settings.voicePersonaPrompt,
        prebuiltBaseVoice: settings.prebuiltBaseVoice || 'Kore',
        cloudAccessToken: settings.cloudAccessToken,
        rate: settings.rate || 1.0,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`TTS synthesis HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    if (!contentType.includes('application/json') || rawText.trim().startsWith('<')) {
      throw new Error('Invalid JSON from /api/tts/synthesize');
    }

    const data = JSON.parse(rawText);
    if (data.fallbackToBrowser || !data.audioBase64) {
      throw new Error('Fallback to browser synthesis requested');
    }

    const audioDataUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
    this.audioCache.set(cacheKey, audioDataUrl);
    return audioDataUrl;
  }

  private async speakWithClonedVoice(
    cleanText: string,
    settings: VoiceSettings,
    callbacks?: SpeechCallbacks,
    sessionId = this.playbackSessionId
  ) {
    const activeVoiceId =
      settings.voiceCloningKey &&
      !settings.voiceCloningKey.startsWith('gcv-catalina-author-v1-')
        ? settings.voiceCloningKey
        : 'voice_lp7vh3bk6taq';

    // For multi-speaker podcast scripts keep line structure intact up to 900 chars; for monologue chunk by sentences
    const chunks =
      settings.style === 'podcast'
        ? [cleanText.slice(0, 900)]
        : this.splitIntoSpeechChunks(cleanText, 550);

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    let charOffset = 0;
    let nextChunkPromise: Promise<string> | null =
      chunks.length > 0
        ? this.fetchChunkAudioDataUrl(chunks[0], settings, activeVoiceId, signal)
        : null;

    for (let i = 0; i < chunks.length; i++) {
      if (sessionId !== this.playbackSessionId || signal.aborted) return;

      const chunk = chunks[i];
      const currentPromise =
        nextChunkPromise ||
        this.fetchChunkAudioDataUrl(chunk, settings, activeVoiceId, signal);

      const audioDataUrl = await currentPromise;
      if (sessionId !== this.playbackSessionId || signal.aborted) return;

      // Start prefetching the next chunk while the current chunk plays
      if (i + 1 < chunks.length) {
        nextChunkPromise = this.fetchChunkAudioDataUrl(
          chunks[i + 1],
          settings,
          activeVoiceId,
          signal
        );
        // Prevent unhandled rejection if prefetch fails before we await it
        nextChunkPromise.catch(() => {});
      } else {
        nextChunkPromise = null;
      }

      const chunkOffset = charOffset;
      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(audioDataUrl);
        this.currentAudio = audio;
        audio.playbackRate = Math.max(0.75, Math.min(1.75, settings.rate || 1.0));
        audio.volume = Math.max(0.1, Math.min(1.0, settings.volume || 1.0));

        audio.onplay = () => {
          this.isSpeakingState = true;
          this.isPausedState = false;
          if (i === 0) {
            callbacks?.onStart?.();
          }
        };

        audio.ontimeupdate = () => {
          if (audio.duration && audio.duration > 0) {
            const progressRatio = Math.min(1, audio.currentTime / audio.duration);
            const charIdx = chunkOffset + Math.floor(progressRatio * chunk.length);
            callbacks?.onBoundary?.(charIdx, cleanText.substring(charIdx, charIdx + 60));
          }
        };

        audio.onended = () => {
          this.currentAudio = null;
          resolve();
        };

        audio.onerror = (e) => {
          this.currentAudio = null;
          reject(e);
        };

        audio.play().catch(reject);
      });

      charOffset += chunk.length + 1;
    }

    if (sessionId === this.playbackSessionId && !signal.aborted) {
      this.isSpeakingState = false;
      this.isPausedState = false;
      this.currentAudio = null;
      callbacks?.onEnd?.();
    }
  }

  private speakWithBrowser(
    cleanText: string,
    settings: VoiceSettings,
    callbacks?: SpeechCallbacks
  ) {
    if (!this.synth) {
      callbacks?.onError?.(new Error('Speech synthesis not supported in this browser.'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utterance;

    const voices = this.getVoices();
    if (settings.voiceName) {
      const selectedVoice = voices.find((v) => v.name === settings.voiceName);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    if (!utterance.voice && voices.length > 0) {
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Serena'))
      );
      if (preferred) utterance.voice = preferred;
    }

    utterance.rate = Math.max(0.5, Math.min(2.0, settings.rate || 1.0));
    utterance.pitch = Math.max(0.5, Math.min(1.5, settings.pitch || 1.0));
    utterance.volume = Math.max(0.1, Math.min(1.0, settings.volume || 1.0));

    utterance.onstart = () => {
      this.isSpeakingState = true;
      this.isPausedState = false;
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      this.isSpeakingState = false;
      this.isPausedState = false;
      this.currentUtterance = null;
      callbacks?.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isSpeakingState = false;
      this.isPausedState = false;
      callbacks?.onError?.(e);
    };

    utterance.onpause = () => {
      this.isPausedState = true;
      callbacks?.onPause?.();
    };

    utterance.onresume = () => {
      this.isPausedState = false;
      callbacks?.onResume?.();
    };

    utterance.onboundary = (e) => {
      callbacks?.onBoundary?.(
        e.charIndex,
        cleanText.substring(e.charIndex, e.charIndex + 40)
      );
    };

    this.synth.speak(utterance);
  }

  public pause() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.isPausedState = true;
      return;
    }
    if (this.synth && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.isPausedState = true;
    }
  }

  public resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
      this.isPausedState = false;
      return;
    }
    if (this.synth && this.synth.paused) {
      this.synth.resume();
      this.isPausedState = false;
    }
  }

  public stop() {
    this.playbackSessionId++;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeakingState = false;
    this.isPausedState = false;
    this.currentUtterance = null;
  }

  public isSpeaking(): boolean {
    if (this.currentAudio) {
      return !this.currentAudio.paused;
    }
    return this.synth ? this.synth.speaking && !this.synth.paused : false;
  }

  public isPaused(): boolean {
    if (this.currentAudio) {
      return this.currentAudio.paused;
    }
    return this.synth ? this.synth.paused : false;
  }
}

export const speechEngine = new SpeechEngine();
