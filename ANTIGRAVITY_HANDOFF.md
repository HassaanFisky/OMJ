# OMJ — ANTIGRAVITY ENGINEERING HANDOFF & AUTONOMOUS DIRECTIVE

## 1. Project Overview & Architecture Status
- **Root Repository:** `https://github.com/HassaanFisky/OMJ`
- **Active Branch:** `feat/omj-living-storybook-reconstruction`
- **Starting Commit:** `50c4661`
- **Application Engine:** React 19 + TypeScript + Vite + GSAP + HTML5 Canvas.
- **Audio System:** Native `HTMLAudioElement` with fallback visual preview mode; asset stored in `public/audio/omj.m4a` and referenced in `.env`.
- **Quality Benchmarks:**
  - `npm run typecheck` (`tsc --noEmit`): 0 errors.
  - `npm run test` (`vitest run`): 12 of 12 unit tests passing (0 failures).
  - `npm run build`: Production bundle optimized in `dist/`.
  - Local Dev Server: Active on `http://127.0.0.1:4179/`.

---

## 2. File & Documentation Architecture
- **Engineering & Creative Bibles:**
  - `OMJ_DESIGN_BIBLE.md` -> Colors, lighting, mobile-first viewports (393×852).
  - `CHARACTER_BIBLE.md` -> Chubby plush teddy anatomy, velvet textures, facial emotional states.
  - `SCENE_BIBLE.md` -> Storyboard scenes A through Q + creative transition motifs.
  - `MOTION_BIBLE.md` -> GSAP easing, 60fps transform conventions, Canvas weather particle engines.
  - `OMJ_FINAL_AUDIT.md` -> Classification of 16 audit findings (Resolved/Corrected).
  - `OMJ_IMPLEMENTATION_REPORT.md` -> Complete reconstruction log and telemetry.
  - `OMJ_VISUAL_QA.md` -> Viewport matrix, contact mechanics, and accessibility standards.
- **Core Engine & Character Rigs:**
  - `src/characters/BearRig.tsx`: Layered SVG character rigs for both male and female plush teddies with multi-layered specular eyes, cheek blush, ear positions, and limb animations.
  - `src/characters/BearAnimations.ts`: Upgraded two-bone IK arm solver, dual-phase organic blinking, emotional mouth arching, and glistening teardrop physics.
  - `src/animation/FilmEngine.ts`: Master timeline controller orchestrating camera framing, character placement, and environmental crossfades.
  - `src/animation/ParticleEngine.ts`: Canvas weather simulator with Firefly Guide, rain puddle ripples, snowflakes, floating hearts, and twinkling stardust.
  - `src/components/CinematicStage.tsx`: Responsive viewport container enforcing letterboxed mobile-first viewing without layout shifting.
  - `src/components/Controls.tsx`: Discreet, accessible floating glass pill controls meeting 44×44px touch targets.

---

## 3. Autonomous Verification Instructions for Future Agents
1. Inspect `src/timeline/scenes.ts` to ensure scene metadata matches Scenes A through Q.
2. Confirm zero conventional player clutter (no seekbars or time counters during cinematic playback).
3. Validate iPhone 14 Pro touch targets (minimum 44×44px).
4. Run `npm test` and `npm run build` before pushing any update to remote.
