# Deep Burnt Orange Interactive Accent & Button Theme Update

Replace all pink (`#FF2A6D` / `#E61556`) and legacy rose (`#C85A6E` / `#9E3E50`) UI button fills, active state indicators, badges, and interactive hover accents across *The Truth About Love* with **Deep Burnt Orange (`#C83E0B`)** and a rich hover state (`#A93207`), matching the warm editorial burnt orange of the reference slide (*"Chapter 1"*), while preserving the light yellow and soft pink floating flower and cloud backdrop shapes unchanged.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design decisions were confirmed with you and guide this implementation:

- **Confirmed Decision 1 — Deep Burnt Orange Primary Accent (`#C83E0B`)**: All primary buttons, active model-tier selectors, citation pills, filter tabs, and interactive hover accents will transition from neon pink (`#FF2A6D`) to Deep Burnt Orange (`#C83E0B`) with a darkened pressed/hover state (`#A93207`) and soft warm tint (`#FDF2EE`) where subtle accent surfaces are used in studio editor modals.
- **Confirmed Decision 2 — Preserve Floating Flower & Cloud Gradients**: The organic 8-petal flower and 3-lobe cloud SVG shapes (`LabsFlowerShape` and `LabsCloudShape`) will retain their current light yellow and soft pink atmospheric mesh gradients so the burnt orange buttons stand out with crisp editorial contrast against the pastel shapes and monochrome canvas.

---

## 1. Overview & Core Concept

- **What It Does**: Harmonizes the interactive action palette across the entire manuscript companion, conversational studio, floating chat assistant, semantic search drawer, and archive studio modals around a single **Deep Burnt Orange (`#C83E0B`)** accent color.
- **Target Audience / Persona**: Readers and fierce lovers exploring Catalina Butnaru's interactive manuscript, truths carousel, and reference archive.
- **Key Value**: Connects the interactive UI buttons directly to the editorial burnt-orange typography from the reference slide while maintaining high-contrast WCAG AA legibility with crisp white button labels (`#FFFFFF`).

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Truths About Love Carousel**: The primary *"Ask Manuscript"* button beneath each rotating quote is styled in `#C83E0B` burnt orange with `#A93207` hover feedback.
  2. **Conversational Manuscript Studio**: The model tier selector (*Fast / Balanced / Deep Reasoning*), *"Ask the Manuscript"* submit CTA, instant prompt pill hover states, inline `[Source N]` citation badges, and citation chips all respond in `#C83E0B`.
  3. **Book Showcase & Five Dimensions of Love**: Primary CTAs (*"Ask Manuscript"*, *"Begin Practical Exercises"*, *"Talk to the manuscript"*, *"Explore (N)"*) use `#C83E0B` burnt orange against the crisp `#FFFFFF`, `#F8F9FA`, and `#0B0B0C` surfaces.
  4. **Interactive Archive & Modals**: Active type filter tabs, *"The Truth About Love"* return pill, *"Ask Manuscript"* card actions, external Substack/source links, semantic search triggers, and author studio modals use `#C83E0B` burnt orange consistently.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Google Labs editorial minimalism meets warm curatorial monograph.
  - *Color Palette & Mood*:
    - `--background`: `#FFFFFF` (Primary canvas) / `#F8F9FA` & `#F4F4F9` (Secondary architectural surfaces)
    - `--foreground`: `#0B0B0C` & `#1E1F18` (High-contrast ink)
    - `--primary`: `#C83E0B` (Deep Burnt Orange for all primary buttons, active toggles, and interactive accents)
    - `--primary-hover`: `#A93207` (Rich darkened burnt orange on hover/active states)
    - `--accent-subtle`: `#FDF2EE` (Warm tinted surface for active studio modal selection states)
  - *Typography & Hierarchy*: Retains `Google Sans Display` for headlines and quotes, `Google Sans Text` for prose and UI controls, and `Google Sans Mono` for archival metadata and citations.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Unified Burnt Orange Token Across Public & Studio Surfaces**
  - *Chosen Approach*: Replace both the `#FF2A6D` neon pink on reader-facing views and the remaining `#C85A6E` / `#9E3E50` rose tones inside the Archive Card, Source Detail, Add/Edit Source, and Book Settings modals with the unified `#C83E0B` / `#A93207` burnt orange palette.
  - *Why*: Eliminates any leftover pink/rose visual drift across modals and secondary states so the entire application feels cohesive.
  - *Alternatives Considered*: Updating only the landing page buttons; rejected because the user requested replacing pink with burnt orange across all buttons and accents.
- **Decision 2: Untouched Pastel Flower & Cloud Shapes**
  - *Chosen Approach*: Keep `LabsFlowerShape` and `LabsCloudShape` gradients in their existing light yellow and soft blush-pink palette.
  - *Why*: Matches the reference presentation where bold `#C83E0B` burnt orange elements sit alongside soft yellow-and-pink organic flower shapes.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   GLOBAL THEME & ACCENT TOKEN LAYER                        │
│     Primary Button / Accent: #C83E0B   |   Hover / Active: #A93207         │
│     Subtle Accent Tint:      #FDF2EE   |   Focus Ring:     #C83E0B/30      │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐
│  GLOBAL SHELL & NAV  │  │  MANUSCRIPT LANDING  │  │  ARCHIVE & SEARCH      │
│  ──────────────────  │  │  ──────────────────  │  │  ────────────────────  │
│  • Header Bar        │  │  • Truths Carousel   │  │  • Archive Filter Tabs │
│    - Publish Button  │  │    "Ask Manuscript"  │  │  • Return Home Pill    │
│    - Search Toggle   │  │  • Studio Composer   │  │  • Card "Ask" & Link   │
│    - Privacy Toggle  │  │    - Model Selector  │  │    Buttons             │
│  • Floating Chat     │  │    - Instant Prompts │  │  • Semantic Search     │
│    Popup Window      │  │    - Citation Pills  │  │     Drawer & Filters    │
│    - Launcher Pill   │  │  • Book Showcase CTA │  │  • Source Detail,      │
│    - Model Tabs      │  │  • 5 Dimensions CTAs │  │    Add/Edit & Settings │
│    - Citation Chips  │  │  • Archive Callout   │  │    Studio Modals       │
└──────────────────────┘  └──────────────────────┘  └────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - **Header Navigation**: Active states for *"Search"*, *"Offline Privacy"*, and *"Publish to Public"* buttons transition to `bg-[#C83E0B] hover:bg-[#A93207] text-white`.
  - **Landing Page View**:
    - Section 1 Truths Carousel *"Ask Manuscript"* button (`button:nth-of-type(1)`) uses `bg-[#C83E0B] hover:bg-[#A93207]`.
    - Section 2 Conversational Studio active model tier buttons, *"New Conversation"* / *"Go back"* buttons, *"Ask the Manuscript"* submit button, instant prompt hover fills (`hover:bg-[#C83E0B]`), inline citation buttons, and citation chips use `#C83E0B`.
    - Section 3 Book Showcase *"Ask Manuscript"*, Section 5 Five Dimensions action buttons, and Section 6 Interactive Archive *"Explore"* button use `bg-[#C83E0B] hover:bg-[#A93207]`.
  - **Floating Conversational Popup & Semantic Search**: Floating launcher button, close button hover, active model tier pills, suggested inquiry hover states, citation chips, and search submit/filter controls use `#C83E0B` and `#A93207`.
  - **Archive View & Studio Modals**: Active category filters, *"Add to Archive"* / *"Add Authored Work"* / *"Add Reference"* buttons, *"Ask Manuscript"* and external link buttons, and form focus/selection accents in `SourceCard`, `SourceDetailModal`, `AddSourceModal`, `EditSourceModal`, and `BookSettingsModal` use `#C83E0B` and `#A93207`.
