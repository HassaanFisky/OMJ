# Antigravity Handoff: OMJ — Living Storybook

**Branch:** `feature/cinematic-rebuild` (created from `main` at `01ebf38`)  
**Repository:** https://github.com/HassaanFisky/OMJ  
**Production Reference:** https://omj-iota.vercel.app  
**Last Updated:** November 25, 2026

---

## 1. Current Architecture Overview

OMJ is a full-bleed, horizontally tracking animated short film built with React 19, TypeScript, Vite, GSAP, layered SVG rigging, and camera-locked HTML5 Canvas particle rendering, synchronized deterministically to `audio.currentTime`.

```text
OMJ/
├── api/
│   └── scene-context.ts            # Vercel serverless function reading x-vercel-ip-* headers & Open-Meteo current weather
├── src/
│   ├── animation/
│   │   ├── FilmEngine.ts           # Deterministic GSAP shot sampler bound to audio.currentTime
│   │   └── ParticleEngine.ts       # ViewBox-locked Canvas engine (window-clipped rain/snow/stars/frost + shooting star)
│   ├── audio/
│   │   └── AudioController.ts      # Master HTMLAudioElement clock & RAF scheduler
│   ├── characters/
│   │   ├── BearRig.tsx             # Plush teddies Mochi (A) & Yume (B): articulated knees, thumb+4-finger paws, brows, rear seams
│   │   └── BearAnimations.ts       # 2-bone arm IK, grounded hip-knee-ankle walk/sit/kneel, blink & tear physics
│   ├── components/
│   │   ├── CinematicStage.tsx      # Dynamic responsive viewBox camera, 3-bay window, real mirror, 3D diagonal bed, dream portal, snow globe
│   │   ├── Controls.tsx            # Single centered OMJ entrance & discreet Pause/Replay/Transcript/Close controls
│   │   ├── LyricsDisplay.tsx       # Local Caveat brush-script uppercase captions (~25% backdrop, scene tone, C toggle)
│   │   └── TimingEditor.tsx        # Dev timing calibration workspace & accessible 43-line transcript + Open-Meteo attribution
│   ├── environment/
│   │   ├── liveContext.ts          # Client /api/scene-context fetcher & Intl timezone local-hour fallback
│   │   └── weatherState.ts         # Authoritative environment state (sun/moon & rain/snow mutual exclusion)
│   ├── timeline/
│   │   ├── scenes.ts               # Horizontal rightward camX journey (480 -> 1280), 43 cue poses, lap-rest & handover geometry
│   │   └── score.ts                # 43 canonical lyrics (verification: "draft") & shot builder
│   ├── App.tsx                     # Root state, C shortcut toggle, single OMJ branding, live opening context
│   ├── main.tsx                    # Local @fontsource/caveat font imports
│   └── styles.css                  # Full-viewport 100dvh overflow-hidden layout, minimal cinema UI
├── scripts/
│   └── capture_all_scenes.mjs      # Automated desktop & mobile screenshot capture across all 43 cues
└── tests/
    ├── film.unit.test.ts           # 24 Vitest unit tests (score, rightward camX, lap geometry, weather exclusion, API handler)
    └── player.spec.ts              # 8 Playwright E2E specs × 5 viewports = 40 browser tests
```

---

## 2. Key Implemented Systems

1. **Full-Bleed Horizontal World Camera (`CinematicStage.tsx`, `scenes.ts`)**:
   - Dynamic responsive SVG `viewBox` synced pixel-for-pixel with `ParticleEngine` Canvas affine transform (`0` letterboxing, `0` browser scrolling).
   - Monotonic rightward world travel (`camX: 480 → 1280`) from the left nightstand & window corner past the memory gallery, dressing-table mirror, and onto the diagonal 3D wooden bed.
2. **Live Opening Context (`api/scene-context.ts`, `liveContext.ts`, `weatherState.ts`)**:
   - Reads `x-vercel-ip-latitude`, `x-vercel-ip-longitude`, `x-vercel-ip-timezone` server-side; queries Open-Meteo `current=` variables without exposing city/coordinates/IP or requesting GPS.
   - Falls back cleanly to `Intl.DateTimeFormat().resolvedOptions().timeZone` local time-of-day lighting with neutral sky when headers/API are unavailable (never fabricates weather).
   - Once playback begins, `FilmEngine` authored song timeline takes full control.
3. **Authoritative Weather & Strict Window Clipping (`weatherState.ts`, `ParticleEngine.ts`)**:
   - Enforces strict mutual exclusion between Sun & Moon (with transition dead-zone) and between Rain & Snow; suppresses stars in bright daytime.
   - Clips all exterior sky, clouds, stars, rain, glass rain droplets, snow, frost, and diagonal shooting-star streaks strictly inside the 3 window panes.
4. **Spatial Bedroom, Diagonal 3D Bed & Functional Mirror (`CinematicStage.tsx`)**:
   - Lived-in bedroom with wallpaper, wainscoting, perspective wooden floor, oval rug, nightstand lamp, framed teddy photos above the bed, persistent 3-bay window, and diagonal 3D wooden bed with thick mattress & shared quilted `razai`.
   - Functional arched dressing-table mirror beside the bed rendering real-time clipped mirrored `<BearRig>` reflections matching pose, head angle, and limbs.
5. **Procedural 3D-Shaded Earless Rigs Mochi & Yume (`BearRig.tsx`, `BearAnimations.ts`)**:
   - 100% earless smooth dome heads with bare necks, zero dashed stitch seams, zero wrinkles/dots, seamless capsule limbs, chiral left/right paws (thumbs always inward), 360° yaw rotation with tail puff & rear bow visibility, kneeling ring box (`Cues 17–18`), hand-to-hand gift/flower handover (`Cue 19`), restrained cigarette (`Cue 21`), inward-facing phone (`Cue 27`), scalloped fluffy thought-cloud dream portal (`Cues 28–29`), Mochi-on-Yume lap-rest (`Cue 31`), and wooden footstools for window gazing (`Cue 42`).
6. **360° Orbit, YouTube Gestures, Pin-Up Popover & Kinetic Lyrics (`CinematicStage.tsx`, `Controls.tsx`, `LyricsDisplay.tsx`, `App.tsx`, `styles.css`)**:
   - 360° drag/swipe orbit with spring-return and `Reset 360° View`; double-tap/click left/right & `ArrowLeft`/`ArrowRight` `-5s`/`+5s` seek; press-and-hold `2x >>` speed; compact top-left pin-up popover with speed presets (`0.5x`–`2x`); DUUR-inspired multi-zone kinetic typography with safe-box avoidance and `C` toggle shortcut; single `OMJ` mark.

---

## 3. Verification Summary

- `npm run typecheck`: **0 errors**
- `npm run test` (Vitest): **24/24 passed**
- `npm run build` (Vite): **clean production bundle** (`dist/`)
- `npx playwright test`: **45/45 passed** across `1440×900`, `1920×1080`, `390×844`, `393×852`, and `430×932` (Chromium)
- Visual QA screenshots captured and inspected across all 43 cues + entrance + snow globe outro (`scripts/capture_all_scenes.mjs`).
