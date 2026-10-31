# Author Voice Cloning Studio & Default Voice Integration

Enable Catalina Butnaru to record her voice directly in the app using a guided microphone script, generate and embed a Google Cloud Instant Custom Voice (`voiceCloningKey`), and set her cloned voice as the default **Author Voice** across both the **Audio Overview Player** and **Q&A Read Aloud**.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions incorporate your confirmed preferences from our clarification step:

- **Confirmed Decision 1 — Guided Microphone Recording Flow**: Voice creation uses a dedicated in-app microphone recorder with a two-part guided teleprompter script (Google's mandatory legal consent phrase followed by the Author Manifesto reference passage), automatically encoding recordings into 24kHz mono `LINEAR16` WAV format required by Google Cloud Instant Custom Voice.
- **Confirmed Decision 2 — Google Cloud Instant Custom Voice Cloning Key**: The backend integrates with Google Cloud Text-to-Speech Instant Custom Voice (`v1beta1/voices:generateVoiceCloningKey` and `v1beta1/text:synthesize` with `voiceClone.voiceCloningKey`), while also allowing you to paste or export your `voiceCloningKey` for permanent reuse and providing automatic Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`) neural voice synthesis calibrated from your recording whenever Cloud project allowlisting is pending.
- **Confirmed Decision 3 — Default Across Audio Overview & Q&A Read Aloud**: Once calibrated, the cloned Author Voice becomes the active default persona for the Hero Manifesto intro, the **Author Voice & Audio Overview** player, and all **Read Aloud** buttons in the Q&A Notebook.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the existing Voice Persona modal into a full **Google Instant Custom Voice Studio** where the author records two short guided scripts via microphone, generates a persistent `voiceCloningKey` and vocal timbre profile, and embeds that voice as the default narrator throughout the companion app.
- **Target Audience / Persona**: Catalina Butnaru (as the author calibrating and embedding her voice) and readers listening to the Manifesto, Audio Overviews, and grounded Q&A answers in her voice.
- **Key Value**: Replaces generic browser speech synthesis with an authentic, neural Author Voice powered by Google's voice cloning pipeline and high-resolution 24kHz WAV streaming.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Open Author Voice Studio**: Clicking the Voice Settings icon in the **Author Voice & Audio Overview** card (or the voice badge in the Q&A panel) opens the **Author Voice Cloning Studio**.
  2. **Step 1 — Record Mandatory Consent Script**: Google Cloud Instant Custom Voice requires an exact spoken consent statement. A clean teleprompter card displays:
     *"I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model."*
     The user clicks **Start Recording**, reads the line with live microphone level visualization, and can replay or re-record.
  3. **Step 2 — Record Guided Author Reference Script**: The teleprompter displays a 25-second passage from *The Truth About Love* Manifesto (*"Love is not an emotion. It is a fundamental life force..."*). Recording this captures Catalina's cadence, warmth, and prosody.
  4. **Step 3 — Generate & Embed Cloning Key**: Clicking **Create & Embed Author Voice** converts both recordings into `LINEAR16` 24kHz mono WAV buffers in the browser, extracts the author's acoustic signature, requests the `voiceCloningKey` from the server, and sets this cloned voice as the default **Author Voice**. Users can also view, copy, or paste a pre-existing `voiceCloningKey`.
  5. **Seamless Playback Everywhere**: Clicking **Play Voice Overview**, **Listen to Author's Voice Intro**, or **Read Aloud** on any Q&A response streams 24kHz neural audio in the embedded Author Voice with real-time waveform animation and progress tracking.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Warm editorial monograph aesthetic consistent with *The Truth About Love*.
  - *Color Palette & Mood*: 60% warm linen and limestone canvas (`#FAF7F2` / `#FDFCFA`), 30% structured editorial borders and deep espresso typography (`#EAE1D9` / `#241B1C`), and 10% warm neon crimson accent (`#FF2A6D`) for active recording controls and primary CTAs.
  - *Typography & Hierarchy*: Editorial serif headings (`Cormorant Garamond` / `Playfair Display`) paired with clean sans-serif controls and `tabular-nums` recording timers (`00:18 / 00:30`).
- **Interactive Feedback & Motion**:
  - Live Web Audio API frequency bars respond in real time to microphone input during script recording.
  - Clear step completion indicators, instant audio preview player for recorded takes, and loading states while synthesizing neural WAV audio.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: In-Browser `LINEAR16` WAV Encoding vs. Raw `MediaRecorder` WebM**
  - *Chosen Approach*: Decode recorded microphone audio via the browser's `AudioContext` and resample/encode directly into standard 16-bit 24kHz mono PCM WAV (`LINEAR16`) before sending to the backend.
  - *Why*: Google Cloud's `generateVoiceCloningKey` API strictly requires `LINEAR16` (uncompressed WAV) for both `reference_audio` and `voice_talent_consent`. Encoding in-browser avoids brittle server-side `ffmpeg` dependencies.
- **Decision 2: Hybrid Google Cloud Instant Custom Voice + Gemini 3.8 Neural TTS Synthesis**
  - *Chosen Approach*: Primary synthesis calls Google Cloud Text-to-Speech `v1beta1/text:synthesize` with `voiceClone: { voiceCloningKey }`. If the environment's API key is a Gemini Studio key not yet allowlisted on Google Cloud's restricted v1beta1 Instant Custom Voice endpoint, the backend automatically analyzes the recorded voice sample using Gemini multimodal audio analysis to extract a detailed vocal persona profile and synthesizes 24kHz neural WAV audio via `gemini-3.8-flash-tts` Voice Design, while also storing the author's actual recorded Manifesto audio for authentic playback.
  - *Why*: Guarantees that the voice cloning workflow and neural Author Voice playback succeed reliably in every preview and production environment without breaking if GCP enterprise allowlisting is pending.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Client Application (React SPA)                      │
├───────────────────────────────────┬────────────────────────────────────────┤
│   Author Voice Cloning Studio     │     Playback Consumers (Default)       │
│  ┌─────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ 1. Consent Script Recorder  │  │  │ Landing Hero Manifesto Intro     │  │
│  │ 2. Reference Script Recorder│  │  │ AudioPlayerWidget (Overview/Duo) │  │
│  │ 3. WebAudio LINEAR16 Encoder│  │  │ ChatPanel & Landing Q&A ReadAloud│  │
│  │ 4. Cloning Key Manager      │  │  └─────────────────┬────────────────┘  │
│  └──────────────┬──────────────┘  │                    │                   │
│                 │                 │                    ▼                   │
│                 │                 │  ┌──────────────────────────────────┐  │
│                 └─────────────────┼─►│   Unified Speech Engine (WAV +   │  │
│                                   │  │   HTML5 Audio + Progress Sync)   │  │
│                                   │  └─────────────────┬────────────────┘  │
└───────────────────────────────────┴────────────────────┼───────────────────┘
                                                         │
                                           POST /api/voice-clone/create
                                           POST /api/tts/synthesize
                                                         │
                                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         Express Backend Server                             │
├────────────────────────────────────────────────────────────────────────────┤
│  • POST /api/voice-clone/create                                            │
│    ├─ Calls Cloud TTS v1beta1 `voices:generateVoiceCloningKey` (LINEAR16)  │
│    └─ Analyzes reference audio via Gemini to extract acoustic voice style  │
│                                                                            │
│  • POST /api/tts/synthesize                                                │
│    ├─ Synthesizes with `voiceClone: { voiceCloningKey }` via Cloud TTS     │
│    └─ Synthesizes 24kHz WAV via `gemini-3.8-flash-tts` with Voice Design   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`VoiceSettings` Extension**:
  - `engine`: `'cloned_author' | 'browser'` (defaults to `'cloned_author'`)
  - `voiceCloningKey?: string` — The Google Cloud Instant Custom Voice key string
  - `voicePersonaPrompt?: string` — Acoustic style descriptor calibrated from Catalina's recording (e.g., warm, rhythmic, incisive Eastern-European-inflected English cadence)
  - `prebuiltBaseVoice?: 'Kore' | 'Zephyr' | 'Aoede' | 'Puck' | 'Charon' | 'Fenrir'` — Base neural voice anchor
  - `referenceAudioDataUrl?: string` — Base64 `audio/wav` of Catalina's recorded Manifesto reference sample for direct verification and Manifesto playback
  - `consentRecordedAt?: number` — Timestamp confirming both consent and reference scripts were recorded
  - `isClonedVoiceActive?: boolean` — Flag indicating the custom Author Voice is embedded as default

### Interactive Component & State Mapping

- **Guided Microphone Recorder (`VoiceSettingsModal`)**:
  - Manages microphone permissions (`navigator.mediaDevices.getUserMedia`), real-time `AnalyserNode` amplitude levels, recording timer, and conversion of recorded `AudioBuffer` into 24kHz 16-bit mono WAV (`LINEAR16`).
  - Supports switching between **Guided Microphone Cloning** and **Paste Existing Cloning Key** so a generated key can be backed up or restored at any time.
- **Neural Audio Playback (`speechEngine`)**:
  - When `engine === 'cloned_author'` (the default), `speechEngine.speak()` requests synthesized 24kHz WAV audio from `/api/tts/synthesize` (with client-side audio caching by text hash for instant replay), plays it through an `HTMLAudioElement`, and emits progress boundary callbacks to drive the waveform and progress bar in `AudioPlayerWidget` and `ChatPanel`.
