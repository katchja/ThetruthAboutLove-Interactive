# Conversational Safety, Fair Disclosure & Guardrail Framework (`gemini-3.1-flash-lite`)

A comprehensive architectural analysis of **Gemini Flash-Lite (`gemini-3.1-flash-lite`)** and a multi-layered safety, fair disclosure, prompt-injection defense, and intellectual-property protection framework for everyone engaging with *The Truth About Love* by Catalina Butnaru.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and safety design decisions have been confirmed and govern this implementation plan:

- **Confirmed Decision 1 — Default Model & Tier Selection**: Default all conversational manuscript sessions to **Gemini Flash-Lite (`gemini-3.1-flash-lite`)** for ultra-low-latency responses while keeping the 3-tier model switcher (*Fast · Flash-Lite*, *Balanced · 3.8 Flash*, *Deep Reasoning · 4 Argon*) accessible.
- **Confirmed Decision 2 — Fair AI Disclosure & Wellbeing UI**: Embed a **subtle inline disclosure banner** inside both the Landing Page conversational console and the floating Conversational Manuscript popup, paired with an **expandable Conversational Safety & Fair Disclosure modal** detailing AI attribution, non-clinical boundaries, privacy posture, and copyright scope.
- **Confirmed Decision 3 — Strict Manuscript-Only Scope & Guardrail Refusals**: Enforce a strict manuscript-and-archive scope with polite, grounded guardrail refusals when queries attempt prompt injection, verbatim chapter scraping, off-topic bot abuse, or clinical/medical requests.

---

## 1. Analysis of Gemini Flash-Lite (`gemini-3.1-flash-lite`) in a Conversational Manuscript Context

### Why `gemini-3.1-flash-lite` Requires Dedicated Guardrail Engineering
1. **Minimal-Thinking Latency Profile (`ThinkingLevel.MINIMAL`)**:
   - Unlike deeper reasoning models that spend internal reasoning tokens evaluating subtle adversarial intent before responding, `gemini-3.1-flash-lite` is optimized for high-speed, low-latency token generation.
   - **Risk**: Without external deterministic pre-filters and structural prompt delimiters, lightweight models are more susceptible to **"instruction shadowing"** (where a user's latest prompt overrides earlier system rules), **roleplay framing** (*"Pretend you are a raw text printer"*), and **encoding tricks** (Base64, translation, or markdown code-block exfiltration).
2. **Verbatim Reproduction vs. Conceptual Synthesis**:
   - When given rich RAG context chunks from a book manuscript, lightweight models naturally gravitate toward copying large spans of the provided context verbatim if asked to *"expand"* or *"continue from paragraph 2"*.
   - **Risk**: Readers or automated scrapers could stitch together protected chapters unless both input requests and output responses enforce a strict **synthesis-plus-short-quote ceiling** (maximum 1–2 illustrative sentences per citation).
3. **Psychological & Relational Subject-Matter Sensitivity**:
   - *The Truth About Love* examines love as a life force, unprogrammable self-love, relational sovereignty, power distortions, and ego surrender.
   - **Risk**: Readers experiencing acute personal distress, relationship abuse, or mental health crises may turn to the conversational companion seeking clinical therapy, psychiatric diagnosis, or crisis intervention. The model must clearly distinguish **philosophical and literary inquiry** from **clinical or medical care**, and immediately surface supportive helpline resources when acute distress is detected.
4. **Scope Creep & API Quota Abuse**:
   - Publicly accessible chat endpoints are frequent targets for free-riding (users attempting to use the endpoint to write code, solve unrelated assignments, generate marketing copy, or run automated queries).
   - **Risk**: Unbounded off-topic usage exhausts API quotas and dilutes the integrity of the literary companion.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Fair Disclosure at Every Entry Point**:
   - Directly beneath the conversational composer in both the **Landing Page Chat Console** and the **Floating Conversational Popup**, readers see a quiet, editorial inline disclosure strip:
     `AI Research Companion (Gemini Flash-Lite) · Grounded in Catalina Butnaru's manuscript · Philosophical & educational exploration, not clinical advice · Safety & Fair Disclosure`
   - Clicking **Safety & Fair Disclosure** opens a clean, editorial modal explaining how the AI companion works, its limitations, intellectual property protections, and reader wellbeing boundaries.
2. **Transparent Guardrail Refusals in Conversation**:
   - If a reader submits a prompt injection attempt, requests a full verbatim chapter dump, or asks an unrelated off-topic task (e.g., writing Python code), the conversation displays a calm, dignified **Guardrail Notice** card in Catalina's editorial aesthetic explaining that the companion is dedicated exclusively to exploring the concepts and cited research of *The Truth About Love*.
   - If a reader expresses acute personal crisis or self-harm indicators, the guardrail immediately responds with a compassionate wellbeing boundary message and verified 24/7 crisis support resources without invoking speculative AI generation.

### Visual Identity & Theme
- **Aesthetic Direction**: Google Labs High-Craft Light Mode combined with Museum & Editorial clarity.
- **Color Palette & Mood**:
  - **Canvas**: Pure Daylight White (`#FFFFFF`) and Soft Alabaster Gray (`#F8F9FA`).
  - **Typography & Ink**: Deep Obsidian (`#0B0B0C`) for primary headings, Charcoal (`#202124`) for prose, and Slate (`#5F6368`) for unboxed metadata and disclosures.
  - **Interactive Accent**: Deep Burnt Orange (`#C83E0B` with `#A93207` hover) for interactive buttons, active model tier selection, and safety modal triggers.
- **Typography & Hierarchy**:
  - `Google Sans Display` for modal titles and editorial headers; `Google Sans` for conversational prose (`65ch–75ch` reading measure, `leading-relaxed`); `Google Sans Mono` (`tabular-nums`) for citation indices and guardrail metadata.
- **Zero-Pill & Spatial Discipline**:
  - Inline disclosure notices use clean, unboxed typography with `·` separators and generous whitespace (`16px–24px` container padding) rather than cluttered badge islands or thick left borders.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Four-Layer Defense-in-Depth Architecture (Pre-Filter + Sandwich Prompting + Native Safety Settings + Output Scrubbing)**
  - *Chosen Approach*: Combine deterministic regex/heuristic input classification, XML-delimited "sandwich" prompting, `@google/genai` `safetySettings`, and post-generation output verification.
  - *Why*: Relying on a system prompt alone is insufficient for `gemini-3.1-flash-lite`. Pre-filtering stops known jailbreaks, scraping prompts, and off-topic abuse in `<1ms` before spending API tokens, while output scrubbing guarantees no verbatim chapter dumps or system-prompt leaks ever reach the browser.
  - *Alternatives Considered*: Using a second LLM call as a judge on every turn—rejected because it doubles latency and API cost, negating the speed advantage of `gemini-3.1-flash-lite`.
- **Decision 2: Protected Source Redaction Before Model Context Construction**
  - *Chosen Approach*: For any source marked `isProtected: true`, cap the context snippet sent to the LLM and tag it as `[PROTECTED MANUSCRIPT EXCERPT — SYNTHESIZE ONLY, DO NOT QUOTE VERBATIM BEYOND 1 SENTENCE]`.
  - *Why*: Ensures that even if a clever query asks for detailed text from a protected chapter, the model only receives bounded context and explicit per-chunk synthesis constraints.

---

## 4. Technical Architecture & Safety Guardrail Strategy *(Technical Reference)*

### Multi-Layer Conversational Safety Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        READER CONVERSATIONAL UI                             │
│  • Default Model: Gemini Flash-Lite (gemini-3.1-flash-lite) + Tier Switcher │
│  • Subtle Inline Fair Disclosure Banner + Expandable Safety & Terms Modal   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│        LAYER 1: DETERMINISTIC INPUT GUARDRAIL & ABUSE CLASSIFIER            │
│  1. Rate & Burst Limiter + Payload Normalization (strip control/zero-width) │
│  2. Prompt Injection Detector (system override, roleplay, XML tag escape,   │
│     encoded payloads, "ignore rules", prompt exfiltration)                  │
│  3. IP / Verbatim Scraping Detector ("full chapter", "verbatim dump", etc.) │
│  4. Off-Topic Abuse Filter (coding, scripts, unrelated homework/tasks)      │
│  5. Wellbeing & Acute Crisis Detector -> Immediate compassionate resources  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Passes Layer 1)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│      LAYER 2: XML-SANDBOXED "SANDWICH" PROMPT & CONTEXT BOUNDING            │
│  • System Instruction: Persona, IP synthesis rules, non-clinical boundary   │
│  • <manuscript_context>: Top retrieved chunks (Protected chunks flagged)    │
│  • <reader_inquiry>: XML-escaped user question                              │
│  • Post-Query Reinforcement ("Sandwich Guard"): Re-asserts scope & rules    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│       LAYER 3: GEMINI API EXECUTION (@google/genai safetySettings)          │
│  • Model: gemini-3.1-flash-lite (default) | gemini-3.8-flash | gemini-4     │
│  • HarmCategory thresholds: BLOCK_LOW_AND_ABOVE / BLOCK_MEDIUM_AND_ABOVE    │
│    for Harassment, Hate Speech, Dangerous Content, and Sexually Explicit    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│         LAYER 4: POST-GENERATION OUTPUT VERIFIER & LEAK SCRUBBER            │
│  • System Prompt / Instruction Leak Check (blocks internal rule echoes)     │
│  • Verbatim Overlap Check (prevents long contiguous copies of protected     │
│    manuscript text > 320 chars)                                             │
│  • Appends structured Guardrail / Disclosure metadata to response JSON      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Guardrail Classification States
- **Conversational Safety Audit Module**:
  - Evaluates incoming queries and conversation history across five categories:
    1. `safe`: Normal conceptual, literary, philosophical, or archival inquiry.
    2. `prompt_injection`: Attempts to override instructions, reveal system prompts, inject fake XML/system roles, or use encoded bypasses.
    3. `ip_extraction`: Demands for full verbatim chapters, raw file dumps, or complete copyrighted text reproduction.
    4. `off_topic_abuse`: Unrelated utility tasks (software coding, math homework, SQL queries, commercial spam).
    5. `wellbeing_support`: Queries indicating acute personal crisis, self-harm, or domestic danger—handled with a dedicated, compassionate non-clinical support response.
- **Interactive Component & State Mapping**:
  - **Landing Page Chat Console & Conversational Popup**:
    - Initialize `chatModel` to `'gemini-3.1-flash-lite'` (`Fast · Flash-Lite`).
    - Render the inline Fair Disclosure strip below the input composer with an interactive `"Safety & Fair Disclosure"` button.
    - Render a subtle guardrail indicator badge when a response was intercepted by the safety guardrail so the reader understands why a request was declined.
  - **Safety & Fair Disclosure Modal**:
    - Accessible from the inline disclosure banner in both chat interfaces and the page footer.
    - Presents 4 structured editorial sections:
      1. *Fair AI Disclosure & Model Architecture* (`gemini-3.1-flash-lite` synthesis vs. original authorship).
      2. *Philosophical & Educational Scope (Non-Clinical Disclaimer)*.
      3. *Intellectual Property & Anti-Scraping Guardrails*.
      4. *Reader Privacy & Ephemeral Processing*.
