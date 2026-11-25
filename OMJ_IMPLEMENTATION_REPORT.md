# OMJ — Implementation Report

**Date:** November 25, 2026  
**Branch:** `feature/cinematic-rebuild` (branched from `main` at `01ebf38`; not pushed or deployed)

---

## 1. Status Breakdown

### Implemented and Verified
- **Full-bleed responsive horizontal camera** (`CinematicStage.tsx`, `ParticleEngine.ts`): Eliminated `720×1080` letterboxing (`xMidYMid meet`). Dynamic `viewBox` + Canvas affine lock verified at `1440×900`, `1920×1080`, `390×844`, `393×852`, and `430×932` with zero horizontal/vertical browser overflow.
- **Monotonic rightward world progression** (`scenes.ts`): `camX` glides smoothly rightward (`480 → 1280`) across the bedroom from the left nightstand/window corner past the dressing-table mirror onto the diagonal 3D wooden bed.
- **Authoritative environment state & window clipping** (`weatherState.ts`, `ParticleEngine.ts`): Verified Sun/Moon mutual exclusion, Rain/Snow mutual exclusion, daytime star suppression, clear-sky zero-cloud rule, strict clipping of exterior weather/rain droplets/winter frost to the 3 window panes, and diagonal shooting-star streak.
- **Server-side opening context endpoint** (`api/scene-context.ts`, `liveContext.ts`): Reads `x-vercel-ip-latitude`, `x-vercel-ip-longitude`, `x-vercel-ip-timezone`, calls Open-Meteo `&current=temperature_2m,apparent_temperature,is_day,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m`, never exposes city/coordinates/IP, never requests GPS, and falls back to client `Intl` local time-of-day without fabricating weather.
- **Spatial bedroom, diagonal 3D bed & functional mirror** (`CinematicStage.tsx`): Verified persistent 3-bay window (`opacity: 1`), diagonal 3D perspective wooden bed + mattress + shared `razai`, framed memory photos above headboard, and live clipped mirrored reflection (`mirror-a` / `mirror-b`).
- **Plush teddies Mochi & Yume** (`BearRig.tsx`, `BearAnimations.ts`): Procedural 3D-shaded kinematic rigs with 100% earless smooth dome heads, bare necks, zero dashed stitch seams or surface dots/wrinkles, seamless capsule limbs, chiral left/right paws (thumbs always pointing inward toward body centerline), 360° yaw rotation with rounded tail puff and rear bow visibility, kneeling ring box (`Cues 17–18`), direct hand-to-hand gift/flower transfer (`Cue 19`), restrained cigarette (`Cue 21`), inward-facing phone (`Cue 27`), scalloped fluffy thought-cloud dream portal (`Cues 28–29`), Mochi-on-Yume lap-rest (`Cue 31`), and wooden footstools for window gazing (`Cue 42`).
- **360° Interactive Orbit, YouTube-Style Gestures & Top-Left Pin-Up Popover** (`CinematicStage.tsx`, `Controls.tsx`, `App.tsx`, `styles.css`): Horizontal drag/swipe rotates `cameraYaw` across 360° with spring-return and `360°` HUD badge; double-tap/click left/right stage halves and `ArrowLeft`/`ArrowRight` seek `-5s`/`+5s`; press-and-hold (`>220ms`) activates `2x >>` playback; compact top-left pin-up popover provides speed presets (`0.5x`–`2x`), Play/Pause, Replay, Mute, Lyrics toggle (`C` shortcut), and Reset 360° View.
- **Kinetic Multi-Zone Lyrics Typography** (`LyricsDisplay.tsx`, `styles.css`): DUUR-inspired alternating safe-quadrant layout with contrast scale (hero brush words + clean condensed sub-words) and dynamic safe-box avoidance around Mochi, Yume, bed, and window.
- **43 canonical cues & progressive choruses** (`score.ts`, `scenes.ts`, `FilmEngine.ts`): All 43 lyrics preserved verbatim; Chorus 1 and Chorus 2 choreographed distinctly; deterministic `audio.currentTime` seeking, pausing, resuming, and Snow Globe `tail` outro verified.

### Implemented but Only Partially Verified
- **Vercel Geolocation Headers in Production**: `api/scene-context.ts` was unit-tested with mocked Vercel headers (`x-vercel-ip-*`) and mocked Open-Meteo responses, and `liveContext.ts` was verified against local Vite fallback; live Vercel Edge header injection requires testing on a deployed preview/production Vercel environment.
- **Audio Synchronization against `public/audio/omj.m4a`**: Local `public/audio/omj.m4a` (`161.332s`) is present and verified to load cleanly in Chromium and validate against `initialScore` (`148s < 161.332s`). However, all 43 lyric intervals remain `verification: "draft"` because exact vocal onset/offset millisecond calibration by human ear has not been performed.

### Not Implemented / Deferred
- **Playwright WebKit Binary Execution**: Installing Playwright's `webkit` browser binary (`62.4 MiB`) stalled at 10% over the local network, so mobile portrait tests (`390×844`, `393×852`, `430×932`) were executed in Chromium (`isMobile: true, hasTouch: true`) rather than WebKit.

### Requires Real-Device Testing
- Physical iPhone (iOS Safari) and Android (Chrome) frame rate, thermal behavior, touch interaction, safe-area insets, and Bluetooth/speaker audio sync.
- Human ear review of all 43 draft cue timestamps (plus Chorus 1 vs Chorus 2 and instrumental intro/outro) against `public/audio/omj.m4a` using the dev `Timing` workspace.

---

## 2. Files Changed & Added

- **Added:**
  - `api/scene-context.ts`
  - `src/environment/weatherState.ts`
  - `src/environment/liveContext.ts`
  - `scripts/capture_all_scenes.mjs`
  - `OMJ_IMPLEMENTATION_REPORT.md`
- **Modified:**
  - `src/characters/BearRig.tsx`, `src/characters/BearAnimations.ts`
  - `src/components/CinematicStage.tsx`, `src/components/Controls.tsx`, `src/components/LyricsDisplay.tsx`, `src/components/TimingEditor.tsx`
  - `src/animation/FilmEngine.ts`, `src/animation/ParticleEngine.ts`
  - `src/timeline/scenes.ts`
  - `src/App.tsx`, `src/main.tsx`, `src/styles.css`
  - `tests/film.unit.test.ts`, `tests/player.spec.ts`, `playwright.config.ts`
  - `package.json`, `package-lock.json`, `tsconfig.json`, `THIRD_PARTY.md`, `ANTIGRAVITY_HANDOFF.md`

---

## 3. Dependencies & Weather Licence Notes

- **Added runtime dependency:** `@fontsource/caveat` (`5.3.0`, **SIL OFL-1.1**) — bundled locally into `dist/assets/*.woff2` (no external font CDN requests; compatible with `vercel.json` `default-src 'self'` CSP).
- **Weather API licence:** `api/scene-context.ts` uses Open-Meteo (`https://api.open-meteo.com/v1/forecast`). Open-Meteo's free tier is restricted to **non-commercial use** with attribution (`Weather data by Open-Meteo.com` included in the transcript/credits footer and `THIRD_PARTY.md`). Commercial deployment requires a paid Open-Meteo licence or commercial weather provider.

---

## 4. Checks Executed

| Check | Command | Result |
| :--- | :--- | :--- |
| TypeScript | `npm run typecheck` | Passed (0 errors) |
| Unit Tests | `npm run test` (Vitest) | Passed (**24/24**) |
| Production Build | `npm run build` (Vite) | Passed (`dist/` built cleanly) |
| Browser E2E | `npx playwright test` (Chromium) | Passed (**45/45** across `1440×900`, `1920×1080`, `390×844`, `393×852`, `430×932`) |
| Visual Captures | `node scripts/capture_all_scenes.mjs` | Captured & inspected desktop (`1440×900`) all 43 cues + entrance + outro, and mobile (`390×844`) key scenes |
