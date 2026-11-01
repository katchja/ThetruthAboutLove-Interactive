# Comprehensive Security, Privacy & Data Integrity Audit + Remediation Plan

## 1. Executive Summary & Audit Findings

A thorough line-by-line review of the backend (`server.ts`), client state and storage (`src/App.tsx`, `src/utils/vectorStore.ts`), and UI components revealed **7 security, privacy, and data-integrity vulnerabilities**. Below is the detailed analysis of each finding and the exact code remediation we will implement.

---

### Finding 1 (Critical — Data Integrity & Unauthorized Modification): Spoofable Admin Check (`isStudioAdminRequest`)
- **Vulnerability:** In `server.ts` (lines 855–875), `isStudioAdminRequest(req)` relies primarily on client-supplied headers (`x-studio-admin: true`, `x-client-hostname`, `Origin`, and `Referer`) and returns `true` whenever `x-studio-admin: true` is sent without `ais-pre-` in those client headers. Any external script or `curl` request to the public shared URL (`ais-pre-...`) can spoof those headers to overwrite, corrupt, or delete the entire canonical archive via `POST /api/archive/sync`, `POST /api/archive/source`, `DELETE /api/archive/source/:id`, or `POST /api/archive/metadata`.
- **Remediation:**
  1. Validate the **server-side Host header** (`req.headers['x-forwarded-host'] || req.headers.host`) in `isStudioAdminRequest(req)`. If the server's own host starts with `ais-pre-` (the public shared deployment), unconditionally reject all admin write and OCR requests (`false`), regardless of what `Origin`, `Referer`, or `x-client-hostname` claims.
  2. Require the server host to match either the `ais-dev-` development host or local loopback (`localhost` / `127.0.0.1`), in addition to `x-studio-admin: 'true'` and Same-Origin verification.

---

### Finding 2 (High — Privacy & Intellectual Property Leak): Protected Manuscript (`isProtected`) Raw Text Exposed in Public UI
- **Vulnerability:** Sources have an `isProtected?: boolean` flag ("Protected Manuscript — Hide raw text from public; index for AI only"). However:
  - In `src/components/SourceDetailModal.tsx` (lines 189–198, 226–232, 419–469), public visitors (`!isAdmin`) can still click the **Indexed Content Passages (`raw`)** tab, view all verbatim book chunks, click **Copy Passage** or **Copy Full Text**, and view full **OCR Raw Transcriptions** (`ocr` tab) even when `source.isProtected === true`.
  - In `src/components/SemanticSearchPanel.tsx`, verbatim passage excerpts from protected sources are displayed in full in raw search cards to non-admin users.
- **Remediation (Per Your Preference — Hide Raw Text in UI Only for Protected Sources):**
  1. Keep full source content available in memory so client-side semantic vector indexing and grounded AI synthesis continue working seamlessly.
  2. In `src/components/SourceDetailModal.tsx`, when `source.isProtected && !isAdmin`:
     - Hide the **Indexed Content Passages (`raw`)** tab and the **Copy Full Text** button.
     - Redact `rawTranscription` and `verbatimQuotes` inside the `ocr` and `overview` tabs for non-admin visitors, displaying a clear **"Protected Manuscript — Indexed for AI Synthesis Only"** notice while preserving the AI Summary, Structural Breakdown, Entities, Key Themes, and Citation Generator.
  3. In `src/components/SemanticSearchPanel.tsx`, when a matched passage belongs to a source with `isProtected && !isAdmin`, show the source title, relevance score, and AI summary/theme metadata instead of exposing the verbatim raw manuscript chunk, prompting the visitor to explore the concept via the Conversational Archive AI.

---

### Finding 3 (High — Attack Surface & API Quota Abuse): Exposed Legacy Endpoints & Unauthenticated `/api/ocr`
- **Vulnerability:**
  - `server.ts` still exposes unused legacy endpoints (`POST /api/voice-clone/create`, `DELETE /api/voice-clone/:voiceId`, `POST /api/tts/synthesize`, `POST /api/audio-overview`, `POST /api/generate-artifact`, and the `/live` WebSocket proxy) even though the Author Voice and audio features were removed from the UI.
  - `POST /api/ocr` accepts up to 100MB payloads and invokes Gemini Vision without checking `isStudioAdminRequest(req)`, allowing any anonymous visitor to consume Gemini API quota for arbitrary OCR tasks.
- **Remediation:**
  1. Remove all unused audio/voice/live/artifact endpoints and the `/live` WebSocket server from `server.ts`, as well as unused client voice storage helpers (`src/utils/authorVoiceStorage.ts` and unused modal components).
  2. Lock down `POST /api/ocr` with `isStudioAdminRequest(req)` so only the author in the Studio Admin environment can run document/photo OCR.

---

### Finding 4 (High — Denial of Service & Cost Exhaustion): Global 100MB JSON Limit & Unbounded Public `/api/chat`
- **Vulnerability:**
  - `app.use(express.json({ limit: '100mb' }))` is applied globally to every route, allowing attackers to send 100MB JSON payloads to `/api/chat` and exhaust server memory.
  - `POST /api/chat` has no rate limiting, no maximum message/context length validation, and accepts arbitrary model names or unbounded conversation histories from the client.
- **Remediation:**
  1. Set the default global `express.json({ limit: '512kb' })` for public routes, and apply a scoped higher limit (`25mb`) only to authenticated Studio Admin routes (`/api/ocr`, `/api/archive/*`).
  2. Add an in-memory per-IP sliding-window rate limiter on `/api/chat` (e.g., max 20 requests per minute per IP) and `/api/archive` write routes.
  3. Enforce strict input bounds on `/api/chat`: cap `message` length (max 2,000 characters), cap `history` to the last 10 turns (max 1,500 characters per turn), cap `context` length (max 25,000 characters), and hardcode/whitelist the allowed Gemini model on the server so clients cannot request expensive arbitrary models.
  4. Harden the system instruction in `/api/chat` against prompt injection so users cannot trick the assistant into dumping verbatim protected passages or ignoring grounding rules.

---

### Finding 5 (Medium — Data Integrity & Corruption Risk): Non-Atomic File Writes & Unvalidated Sync Schema
- **Vulnerability:**
  - `writeArchiveStore` in `server.ts` writes directly to `archive-store.json` and `public/archive-store.json` via `fs.writeFileSync`. If the process restarts mid-write or receives malformed data in `/api/archive/sync`, the canonical JSON file can be truncated or corrupted.
  - Static file serving currently allows `/archive-store.json` to be served directly before custom middleware headers, and `writeArchiveStore` does not validate item schemas or maintain a `.bak` recovery file.
- **Remediation:**
  1. Implement **atomic writes**: write to a temporary file (`archive-store.json.tmp`) first, verify JSON serialization, create a rolling backup (`archive-store.json.bak`), and atomically rename (`fs.renameSync`) over `archive-store.json` and `public/archive-store.json`.
  2. Add automatic fallback to `archive-store.json.bak` in `readArchiveStore()` if the primary file is ever unreadable.
  3. Validate and sanitize all `Source` and `BookMetadata` fields on the server before persisting (enforcing string types, max lengths, valid category enums, and boolean flags).

---

### Finding 6 (Medium — XSS & Unsafe URI Schemes): Unsanitized `externalUrl`, `purchaseUrl`, and Image Sources
- **Vulnerability:**
  - `source.externalUrl`, `bookMetadata.purchaseUrl`, and `source.imageUrl` / `source.images` are rendered directly into `<a href={...}>` and `<img src={...}>` across `LandingPageView.tsx`, `SourceDetailModal.tsx`, and `SourceCard.tsx`. A `javascript:` or `data:text/html` URI could execute script in the browser.
- **Remediation:**
  1. Create a shared `sanitizeUrl(url)` and `sanitizeImageSrc(src)` utility in `src/utils/security.ts` (and mirror it on `server.ts`) that strictly permits only `https://`, `http://`, or safe local `/assets/` paths for links, and `https://`, `http://`, `/assets/`, or `data:image/(png|jpeg|jpg|webp|gif);base64,` for images.
  2. Apply `sanitizeUrl` and `rel="noopener noreferrer"` to all external links across the application.

---

### Finding 7 (Low — Missing HTTP Security Headers): Hardening Express Response Headers
- **Vulnerability:** `server.ts` does not set baseline security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection`).
- **Remediation:**
  1. Add a security headers middleware in `server.ts` setting `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: microphone=(), camera=(), geolocation=()` (while preserving iframe compatibility required by the AI Studio preview environment).

---

## 2. Implementation Steps

1. **Create `src/utils/security.ts`:**
   - Implement `sanitizeExternalUrl`, `sanitizeImageSrc`, and text-length bounds helpers for client and server use.
2. **Harden `server.ts`:**
   - Remove unused legacy endpoints (`/api/voice-clone/*`, `/api/tts/*`, `/api/audio-overview`, `/api/generate-artifact`, `/live` WebSocket server).
   - Upgrade `isStudioAdminRequest(req)` to verify the server's own `Host` / `X-Forwarded-Host` header and block any admin action on `ais-pre-*`.
   - Protect `POST /api/ocr` with `isStudioAdminRequest(req)`.
   - Replace the global `100mb` JSON parser with a `512kb` default limit and a `25mb` parser scoped only to admin routes.
   - Add per-IP sliding-window rate limiting and strict payload/model validation on `POST /api/chat`, plus anti-prompt-injection guardrails for protected manuscripts.
   - Upgrade `writeArchiveStore` and `readArchiveStore` with schema sanitization, atomic `.tmp` -> rename writes, and `.bak` automatic backup recovery.
   - Add HTTP security headers middleware.
3. **Enforce Protected Manuscript (`isProtected`) Privacy in UI:**
   - Update `src/components/SourceDetailModal.tsx` to hide the `raw` passages tab, full-text copy buttons, raw OCR transcriptions, and verbatim quotes when `source.isProtected && !isAdmin`.
   - Update `src/components/SemanticSearchPanel.tsx` and `src/App.tsx` so protected sources never dump raw verbatim manuscript chunks to public visitors while still powering grounded AI synthesis.
4. **Sanitize External Links & Clean Up Dead Code:**
   - Apply `sanitizeExternalUrl` and `sanitizeImageSrc` in `LandingPageView.tsx`, `SourceDetailModal.tsx`, and `SourceCard.tsx`.
   - Remove unused `src/utils/authorVoiceStorage.ts`.
5. **Verification:**
   - Run `compile_applet` and `lint_applet` to ensure zero build or TypeScript errors.
