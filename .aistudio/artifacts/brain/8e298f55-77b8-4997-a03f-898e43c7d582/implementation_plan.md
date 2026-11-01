# Google Labs Floating Flower & Cloud Gradient Shapes Plan

## 1. Visual & Technical Design (Inspired by `labs.google` & Attached References)
To faithfully reproduce the organic shapes from your four reference screenshots, we will build custom SVG clip-path silhouettes paired with internal multi-point blurred mesh gradients and a subtle fine-grain noise overlay:

- **Shape 1 — 8-Petal Scalloped Flower (`LabsFlowerShape`)**:
  - **Geometry**: Eight overlapping circular petals arranged radially around a central core inside an SVG `<clipPath>`, creating the exact rounded scalloped flower silhouette from your third and first screenshots.
  - **Mesh Gradient Palette**: Soft diffused orbs blurred inside the flower mask combining **light chartreuse/lemon yellow** (`#E8E66B`, `#F5F293`), **soft blush pink & warm peach** (`#F6B4B7`, `#F7C6B5`), and **creamy mist** (`#EFF2EC`, `#F8F9F5`).
  - **Tactile Grain Overlay**: Subtle `<feTurbulence>` / `<feColorMatrix>` grain filter at low opacity so the gradient has the warm, editorial matte texture seen in your screenshots.

- **Shape 2 — 3-Lobe Asymmetric Cloud/Clover (`LabsCloudShape`)**:
  - **Geometry**: Three intersecting organic circles of varying radii inside an SVG `<clipPath>`, matching the asymmetric cloud/clover silhouette in your second and fourth screenshots.
  - **Mesh Gradient Palette**: Warm light yellow at the base transitioning through soft rose-pink and pale ivory at the upper lobes.

## 2. Gentle Floating Drift & Slow Rotation Animations (`src/index.css`)
- Define smooth, low-frequency CSS keyframe animations so the shapes feel alive without competing with the manuscript text:
  - `labs-float-rotate`: Slow orbital drift (`translate3d`) combined with a gentle continuous rotation (`36s–48s` cycle).
  - `labs-float-breathe`: Subtle counter-drift and gentle scale breathing (`24s–32s` cycle) for asymmetric 3-lobe cloud shapes.

## 3. Broad Section Placements (`src/components/LandingPageView.tsx`)
1. **Section 1 — "Truths About Love" Rotating Quote Carousel**:
   - Embed a large, softly drifting **3-lobe cloud/clover gradient shape** positioned directly behind the rotating `Google Sans Display` quote (mirroring your second reference screenshot where the bold headline sits across the cloud-flower backdrop), complemented by a smaller **8-petal flower** drifting near the upper-right margin.
2. **Section 4 — "The Fierce Lovers Manifesto"**:
   - Restyle the Manifesto section onto a **light Google Labs canvas** (`#F5F5FA` / `#F8F9FA`) with high-contrast `#0B0B0C` typography.
   - Embed a **giant edge-cropped 8-petal flower gradient shape** bleeding off the right side of the section (mirroring your first reference screenshot, *"Chapter 1"*) and a soft secondary cloud-clover shape near the bottom-left, while keeping the **"Hear Catalina Recite the Manifesto"** button in `#FF2A6D` pink.
3. **Ambient Continuity Accents**:
   - Add a subtle edge-bleeding flower/clover accent behind the Five Dimensions of Love header and the Interactive Archive callout so the visual language flows cohesively down the page.
