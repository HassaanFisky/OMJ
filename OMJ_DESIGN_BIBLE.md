# OMJ — DESIGN BIBLE & CREATIVE SPECIFICATION

## 1. Project Identity
- **Name:** OMJ
- **Nature:** Standalone Interactive Cinematic 2D/2.5D Animated Short Experience
- **Philosophy:** Pure visual emotional storytelling without textual dependencies, song metadata, or singer identity. A tender, miniature universe built around two plush teddy characters traversing universal emotional states: waiting, affection, longing, separation, comfort, and reconciliation.

---

## 2. Color Palette & Lighting Philosophy
- **Primary Mood Colors:**
  - **Twilight Violet / Muted Lavender:** `#2a1b3d`, `#44318d`, `#8265a7`
  - **Soft Golden Glow / Interior Warmth:** `#ffeaa7`, `#fbc531`, `#e1b12c`
  - **Warm Beige / Plush Cream:** `#f5f0ea`, `#ede3da`, `#d6c7b2`
  - **Dusty Rose / Blush:** `#e8a598`, `#d98880`, `#f2b5d4`
  - **Winter White / Frost:** `#eef5fc`, `#dbe7f3`, `#b8c9dc`
  - **Midnight Atmosphere:** `#0d0f18`, `#16192b`, `#1e2338`

### Lighting Logic
- **Dual Temperature Contrast:** Cool, quiet exterior night or winter elements (`#16192b`) balanced against rich, warm interior candlelight or bedside lamp luminescence (`#fbc531`).
- **Atmospheric Depth:** Multi-layered canvas blending (`screen`, `soft-light`) with controlled gradient masks creating natural light shafts, rim lighting on teddy ears/fur, and soft contact shadows.

---

## 3. Typography & UI Restraint
- **Zero-Clutter Philosophy:** No track titles, no artist names, no lyrics karaoke, no seeking bars during cinematic playback.
- **Title Element:** Single minimalist SVG logotype `OMJ` in subtle warm silver with soft breathing glow.
- **Interaction Elements:**
  - Minimal translucent circle entrance button (play icon / heart glyph).
  - Subtle unobtrusive controls: corner pause/play toggle and replay button, meeting WCAG AA 44×44px touch targets.

---

## 4. Mobile-First Layout & Viewport Architecture
- **Primary Reference Viewport:** 393 × 852 CSS pixels (iPhone 14 Pro), verified on 390 × 844 and scales seamlessly to desktop viewports (16:9 / 21:9 letterboxed cinematic stage).
- **Safe Area Insets:** Fully accounted for `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- **Dynamic Viewport Height:** Driven by `100dvh` to prevent browser URL bar jumps on iOS Safari and mobile Chrome.
- **Letterboxing & Responsive Stage:** The stage retains a fixed aspect ratio (9:16 portrait on mobile, fluid cinematic frame on landscape/desktop) with zero horizontal overflow.
