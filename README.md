# The Truth About Love — Interactive Manuscript & Archive

![Author](https://img.shields.io/badge/Author-Catalina%20Butnaru-0B0B0C?style=flat-square)
![Contributor](https://img.shields.io/badge/Contributor-Gemini%20Argon-C83E0B?style=flat-square)
![Manuscript](https://img.shields.io/badge/Status-Interactive%20Manuscript-F1F3F4?style=flat-square& labelColor=202124)

> *"Love is not an emotion. It is a fundamental life force."*
> — **Catalina Butnaru**, *The Truth About Love: A Memoir and Manifesto Protecting Love in the Age of AI*

**The Truth About Love** is a self-published interactive manuscript and living research archive by **Catalina Butnaru**. It combines the book-in-the-making, author notes, Substack essays, and curated scientific and philosophical references with a safeguarded conversational companion grounded strictly in the manuscript's corpus.

---

## Contributors

- **Catalina Butnaru** — Author, Creator & Curator of *The Truth About Love*
- **Gemini Argon** (`gemini-4-argon` / Google AI Studio) — Application Architecture, Interactive Manuscript Studio & Archive Engineering
- **Gemini 3.1 Flash-Lite** — Safeguarded Conversational Manuscript Synthesis & Citation Grounding

---

## Key Features

- **Rotating "Truths About Love" Carousel**: Highlights core first principles from the manuscript and dynamic citations from the archive.
- **Safeguarded Conversational Manuscript Studio**: Grounded Q&A powered by Gemini Flash-Lite with inline source citations, anti-projection guardrails, and fair AI disclosure.
- **The Five Dimensions of Love**: Interactive exploration across *The Love of Self*, *The Love of Another*, *The Love of Life*, *The Love of Humanity*, *The Love of the Divine*, and *Practical Exercises*.
- **Interactive Archive**: Dual-section repository (*Authored by Catalina* and *Literature, References & Quotations*) with persistent image/document storage, local semantic vector search, and one-click public synchronization.

---

## Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and set your `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application runs on `http://localhost:3000`.

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

---

## Attributing Commits in Git

When committing updates to GitHub, you can include the `Co-authored-by` trailer at the end of your commit message:

```bash
git commit -m "Update manuscript archive

Co-authored-by: Gemini Argon <gemini@google.com>"
```
