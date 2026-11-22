# Design System & Editorial Cohesion Reference
**Application:** *The Truth About Love* by Catalina Butnaru · Powered by **Runa** (Conversational Manuscript Studio)

---

## 1. Aesthetic Philosophy & Brand Positioning
The visual language preserves the current **Google Labs × High-Craft Literary Monograph** direction:
- **Core Thesis:** *"For Culture & Depth. Runa makes your book conversational."*
- **Product Layer:** **Runa** — an Author SaaS toolkit for Substack writers, independent authors, and literary thinkers that transforms any human-written book or essay archive into a living written and voice-note conversational companion.
- **Author Sovereignty:** Every authored chapter and Substack essay remains protected in the author's corpus while AI acts strictly as a faithful, citation-grounded conversational bridge.

---

## 2. Color Palette & Surface Hierarchy (Daylight-First Editorial)

| Token Role | Hex | Usage Guidelines |
| :--- | :--- | :--- |
| **Primary Canvas** | `#FFFFFF` | Main viewport background, primary composer surface, and modal containers. |
| **Secondary Studio Surface** | `#F8F9FA` | Conversational Manuscript Studio container, card backgrounds, and inspector panels. |
| **Soft Lavender-Warm Accent** | `#F4F4F9` / `#F3F3FA` | Rotating Truths hero backdrop, Fierce Lovers Manifesto callout, and Interactive Archive banner. |
| **Control & Pill Surface** | `#F1F3F4` | Header navigation switcher, secondary action buttons, citation pills, and input bars. |
| **Hairline Divider** | `#E8EAED` | Subtle structural borders, table/FAQ dividers, and card separators. |
| **Obsidian Ink (Primary Text)** | `#0B0B0C` | Primary display headings, body copy, user chat bubbles, and primary brand badges. |
| **Deep Editorial Ink** | `#1E1F18` / `#202124` | Blockquotes, secondary headings, and high-contrast label text. |
| **Muted Slate (Secondary Text)** | `#5F6368` | Subtitles, metadata captions, timestamps, and helper copy. |
| **Subtle Caption Slate** | `#80868B` | Keyboard shortcut hints, placeholders, and inactive timestamps. |
| **Fierce Terracotta (Manuscript Accent)** | `#C83E0B` | Primary CTAs on *The Manuscript* and *Literature* views (`Ask the Manuscript`), active citation badges, and voice-note playback highlights. Hover state: `#A93207`. |
| **Neon Cyan (Runa Page Primary Accent)** | `#00F0FF` | Primary accent and CTA button color on the **Runa** page (`PitchPageView` & active Runa header tab). Hover state: `#00D5E6`; high-contrast label/icon accent on light surfaces: `#0098A6`. |
| **Burnt Orange / Tangerine (Runa Ask Manuscript CTA)** | `#FF5E1A` | Scoped strictly to the **Runa** page `"Ask Manuscript"` hero button and floating `"Ask Manuscript"` trigger button. Hover state: `#E84D0C`. |
| **Runa Soft Ambient Gradients** | `#746CF5` / `#8B5CF6` → `#00F0FF` | Soft floating violet-blue and neon cyan diffused gradient washes layered over light neutral white (`#FAFAFC`) on the Runa page. |
| **Runa Light Borderless Chat Surfaces** | `#F1F2F6` / `#FFFFFF` / `#F4F5F8` | Scoped strictly to chat windows on the **Runa** page. Pure daylight tonal hierarchy with **zero borders** (`border-0`), dark editorial ink (`#141413` / `#4A4944`), light cyan-tinted reader bubbles (`#00F0FF` at 20% opacity), and `#00F0FF` / `#0098A6` controls. |
| **WhatsApp Companion Emerald** | `#15803D` / `#DCFCE7` | Scoped strictly to WhatsApp Runa companion indicators and live webhook status badges on *The Manuscript* and *Literature* views. |

---

## 3. Typography & Scannable Hierarchy

- **Display & Literary Serif (`font-display`):**
  - *Font Stack:* `'Cormorant Garamond'`, `'Google Sans Display'`, Georgia, serif.
  - *Usage:* Rotating manuscript truths, section titles (`The Truth About Love`, `Chat with The Truth About Love`, `Runa`), and manifesto quotes.
- **Runa Page Literary & Conversational Serif (`font-['Georgia',serif]` / `font-serif`):**
  - *Font Stack:* `'Georgia'`, `'Instrument Serif'`, `'Newsreader'`, `'Times New Roman'`, serif.
  - *Usage:* Exclusively on the **Runa** page (`PitchPageView`), the Hero headline (`Love Chatting to Books, Not Bots.`), the Live Coexistence Specimen inquiry selector tabs (`Select Inquiry:` label and `01`–`03` tab buttons), reader inquiry questions, Runa coexisting agent replies, and all editorial/narrative paragraphs across Sections 1–6 use `Georgia, serif` (`font-['Georgia',serif]`) to evoke a warm, book-first literary feel.
- **UI & Conversational Sans (`font-sans`):**
  - *Font Stack:* `'Plus Jakarta Sans'`, `'Inter'`, system-ui, sans-serif.
  - *Usage:* Navigation controls, primary action buttons, and UI controls on *The Manuscript* and *Literature* views.
- **Technical & Citation Monospace (`font-mono`):**
  - *Font Stack:* `'JetBrains Mono'`, monospace.
  - *Usage:* `[Source N]` citations, audio duration timers (`0:18`), webhook payload inspection, and telemetry counters (`tabular-nums`).

---

## 4. Conversational & Runa UX Rules

1. **Short Conversational Chats (Strict Token Discipline):**
   - Both written responses and voice-note transcripts must read like a direct, high-signal WhatsApp chat or voice note from the author's research companion—**never** a long multi-paragraph LLM essay.
   - Responses are strictly bounded to **2–4 punchy sentences (~40–75 words maximum)** with inline `[Source N]` citations.
2. **Dual Modality (Written + Voice Note Everywhere):**
   - Readers can type a question OR record a spoken voice note (`gemini-3.5-transcribe`) in:
     1. The main **Conversational Manuscript** composer on the Landing Page.
     2. The floating **Ask Manuscript** popup window (`ConversationalPopupWindow`).
     3. The **WhatsApp Runa Companion** modal & live Meta WhatsApp Business API webhook.
   - Every assistant reply includes an interactive **Runa Audio Note Player** (`gemini-3.8-flash-lite-tts` 24kHz WAV with acoustic waveform scrubber and `1x / 1.25x / 1.5x` speed control).
3. **Runa Page Light, Borderless Chat Windows (Runa Page Only):**
   - Exclusively on the **Runa** page (`PitchPageView` and any chat windows opened while viewing the Runa page, including the **Live Coexistence Specimen**, **Interactive Coexistence Studio**, **WhatsApp Voice-Note & Chat Pipeline**, **WhatsApp Runa Companion Modal**, and the floating **Ask Manuscript** popup window), every chat window must use a **light color palette with no borders**.
   - **No dark chat shells or CSS borders:** Replace dark containers (`#141413` / `#1F1E1C` / `#252422`) and structural borders (`border`, `border-t`, `border-b`) with layered daylight tonal surfaces (`#F1F2F6/90` outer shells, `#FFFFFF` primary cards/bubbles, `#F4F5F8` inset panels/inputs/audio bubbles, and subtle `bg-[#141413]/10` hairlines where needed).
   - **Light Reader Bubbles & Cyan Controls:** User chat bubbles use a light cyan wash (`#00F0FF` at 20% opacity with `#0B0B0C` ink) rather than solid obsidian, paired with Neon Cyan (`#00F0FF` / hover `#00D5E6`) interactive buttons and `#0098A6` labels for daylight contrast.
   - *The Manuscript* and *Literature* views remain unchanged and retain their existing editorial styling.
4. **Runa Page Plain Deep Charcoal & Slightly Transparent Neutral Light Buttons (Runa Page Only):**
   - Exclusively on the **Runa** page, all buttons use a clean, plain, borderless button aesthetic without glass gradients, specular borders, or drop shadows:
     - **`.runa-glass-black` (Plain Deep Charcoal)**: Solid deep charcoal (`#1F1F22`, hover `#2D2D32`) with white text/icons (`#FFFFFF`) for primary Runa CTAs, active tabs, and audio play buttons.
     - **`.runa-glass-pill` (Slightly Transparent Neutral Light)**: Slightly transparent neutral light (`rgba(241, 242, 246, 0.72)`, hover `rgba(228, 230, 237, 0.88)`) with dark ink (`#0B0B0C` / `#141413`) for secondary CTAs (`Ask Manuscript`, `WhatsApp`), preset buttons, speed controls, and voice-note recorder controls.
5. **Ambient Sculptural Restraint:**
   - Google Labs floating SVG shapes (`LabsFlowerShape`, `LabsCloudShape`, `Labs3DBlobShape`) remain positioned in outer margins with `pointer-events-none` so reading legibility and interactive controls remain unobstructed.
