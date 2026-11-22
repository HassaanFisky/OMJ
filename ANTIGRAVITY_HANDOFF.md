# OMJ — ANTIGRAVITY ENGINEERING HANDOFF & AUTONOMOUS DIRECTIVE

## 1. Project Overview & Architecture Status
- **Root Repository:** `https://github.com/HassaanFisky/OMJ`
- **Application Engine:** React 19 + TypeScript + Vite + GSAP + HTML5 Canvas.
- **Audio System:** Native `HTMLAudioElement` with fallback visual preview mode; asset stored in `public/audio/omj.m4a` and referenced in `public/media/omj-audio.mp3`.
- **Quality Benchmarks:**
  - `npm run typecheck` (`tsc --noEmit`): 0 errors.
  - `npm run test` (`vitest run`): 12 of 12 unit tests passing.
  - `npm run build`: Production bundle optimized in `dist/`.

---

## 2. File & Module Mapping
- **Design Bibles:**
  - `OMJ_DESIGN_BIBLE.md` -> Colors, lighting, mobile-first viewports (393×852).
  - `CHARACTER_BIBLE.md` -> Chubby plush teddy anatomy, velvet textures, facial emotional states.
  - `SCENE_BIBLE.md` -> Storyboard scenes A through Q + creative transition motifs.
  - `MOTION_BIBLE.md` -> GSAP easing, 60fps transform conventions, Canvas weather particle engines.
- **Core Engine:**
  - `src/characters/BearRig.tsx`: Layered SVG character rigs for both male and female plush teddies with independent eye blinks, cheek blush, ear positions, and limb animations.
  - `src/animation/FilmEngine.ts`: Master timeline controller orchestrating camera framing, character placement, and environmental crossfades.
  - `src/animation/ParticleEngine.ts`: Canvas weather simulator (fireflies, rain with puddle ripples, snow, floating hearts, stardust).
  - `src/components/CinematicStage.tsx`: Responsive viewport container enforcing letterboxed mobile-first viewing without layout shifting.
  - `src/components/Controls.tsx`: Discreet, accessible pause/replay controls.

---

## 3. Autonomous Verification Instructions for Future Agents
1. Inspect `src/timeline/scenes.ts` to ensure scene metadata matches Scenes A through Q.
2. Confirm zero text or lyrical clutter during playback — the story must remain purely visual and emotional.
3. Validate iPhone 14 Pro touch targets (minimum 44×44px).
4. Run `npm test` and `npm run build` before pushing any update to remote `main`.
