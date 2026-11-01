# Implementation Plan: Add 3D Golden Blobs & Optimize Shape Positioning for Readability

## 1. Visual & Readability Direction
- **Asset Integration (`/assets/aistudio/39_0e8514b5.png`):**
  - Add a new `Labs3DBlobShape` component to `src/components/LabsFloatingShapes.tsx` that renders the 3D golden sculptural blob asset.
  - Apply seamless background blending (`mix-blend-multiply` plus a soft radial vignette mask) so the image's white canvas disappears completely on both white (`#FFFFFF`) and soft lavender-gray (`#F4F4F9`, `#F3F3FA`) section backgrounds.
  - Support rotation/flip variants (`default`, `tilted`, `mirrored`) and combine with existing gentle floating drift and slow rotation CSS animations (`labs-shape-float-rotate`, `labs-shape-float-breathe`, `labs-shape-slow-spin`).
- **Readability Optimization (Outer Margins & Corners):**
  - Reposition floating shapes so they frame the content from the outer margins and corners rather than sitting directly behind body copy or multi-line quotes.

---

## 2. Planned Changes by File

### A. `src/components/LabsFloatingShapes.tsx`
- Export `Labs3DBlobShape` accepting `className`, `variant` (`'default' | 'tilted' | 'mirrored'`), and `opacity` styling.
- Use a soft radial CSS mask (`radial-gradient(circle, black 58%, transparent 76%)`) and `mix-blend-multiply` so the 3D golden folds blend naturally into any background surface without visible square edges.

### B. `src/components/LandingPageView.tsx`
1. **Section 1 — "Truths About Love" Hero Carousel:**
   - Move the backdrop shapes away from the center of the quote text into the outer corners:
     - Upper-left outer margin: `LabsFlowerShape` (`-left-28 -top-24`).
     - Upper-right outer margin: `Labs3DBlobShape` (`-right-24 -top-16`, slow floating rotation).
     - Lower-left / lower-right outer margins: `LabsCloudShape` offset toward the bottom-right corner so the central quote and "Ask Manuscript" button sit on a clean, high-contrast canvas.
2. **Section 3 — "The Truth About Love" Book Introduction:**
   - Add a subtle `Labs3DBlobShape` in the far-right outer margin behind the book showcase column, keeping the left manifesto text column completely clear.
3. **Section 4 — "The Fierce Lovers Manifesto" Callout:**
   - Push the large `LabsFlowerShape` further into the far-right margin (`-right-40 lg:-right-48`) and add an accent `Labs3DBlobShape` in the bottom-right / top-right outer corner so the manifesto headline and paragraphs have zero visual interference.
4. **Section 5 — "The Five Dimensions of Love":**
   - Remove the flower shape that was centered directly behind the section title and description.
   - Instead, place a `LabsFlowerShape` in the far-left outer margin and a `Labs3DBlobShape` in the far-right outer margin, leaving the centered heading and subtitle crisp and unobstructed.
5. **Section 6 — "Interactive Archive" Callout Card:**
   - Push the `LabsCloudShape` and a companion `Labs3DBlobShape` to the far-right corner behind the action area, keeping the left description text completely clear.

### C. `src/components/ArchivePageView.tsx`
- Add a subtle corner-offset `Labs3DBlobShape` and `LabsFlowerShape` in the top banner's far-right outer margin (`overflow-hidden`), framing the header without overlapping the title or description text.

---

## 3. Verification
- Run `compile_applet` and `lint_applet` to verify zero TypeScript or build errors.
