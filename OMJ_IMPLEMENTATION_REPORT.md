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

---

## Final Cinematic Acceptance & Polish — November 26, 2026

Branch `arena/d5c1021d-omj` (from `main` @ `84f2e7e`). **Not pushed, no PR, no deploy.**

This pass inspected the rendered Cinematic frame by frame rather than only trusting
test output. Two genuine caption defects were found and fixed; everything else
listed below was verified as already correct and left untouched.

### Defects found and fixed

| # | Defect | Evidence | Fix |
|---|--------|----------|-----|
| 1 | Captions could cover both plushies | At the kiss (34.5s) the caption overlapped Mochi by 14,136px² and Yume by 24,676px² in a 1440x900 render | Character safe boxes are weighted 12x and a character collision is now **disqualifying**, so background clearance can no longer buy a caption onto a face |
| 2 | Captions collapsed to an 780x736 block and rendered off-screen | A desktop media query set `bottom: 20px` while JS positioned by `top`, stretching the element between 16% and the viewport floor; long lines also ran off the left edge | Removed the conflicting `bottom`; the caption is now clamped inside the viewport using its measured layout box |

Bug #2 was the root cause of #1's visible symptom: because the element was 736px
tall, the collision logic was reasoning about a block that covered half the
screen, and the text itself drew far from its chosen quadrant.

### Visually verified in this pass

Screenshots captured at 17 points and inspected directly (`.arena/shots/A-*, B-*, C-*, E-*`):

- **Opening** — window, moon, lamp, nightstand, rug, mirror edge; no duplicated OMJ mark.
- **Kiss (34.5s)** — hand contact reads, caption now clear of both characters.
- **Mist / Chorus 1 (44.5s, 50s)** — rain correctly confined to the panes; cloud, moon and hills all inside the aperture.
- **Disagree (72s)** — phone inward-facing, correct standing offsets.
- **Gifts (75.5s)** — flowers presented hand-to-hand, no interpenetration.
- **Hearts (78.5s)** — mirror, photos, bookshelf, and the long diagonal bed with visible depth.
- **Winter (84s)** — authored snow/frost; distinctly a story transition, not live weather.
- **Phone (96s)**, **Thought (98s)**, **Dream (101s)** — thought-bubble portal renders; plushies stay grounded.
- **Lap (106.5–109.8s)** — Yume seated on the bed, Mochi reclined with head in her lap. *An earlier sample at 105s showed them standing: that was 1s into a 6s cue, i.e. mid-transition, not a defect.*
- **Chorus 2 (111s)**, **Eyes (128s)** — both characters clear, captions separate.
- **Embrace (134s)** — arms wrap with real contact.
- **Window (139.5s)** — **both characters face away from the camera**, correct per the requirement.
- **Quilt (144s)** — both seated under the shared quilt, eyes closed, snow clipped to the panes.

### Physical-world anchoring

Verified by measurement, not by eye alone. Across nine timestamps spanning the
whole film (`anchor` probe), the architecture nodes (`room`, `window`, `bed`)
carry **no non-identity transform** — `room` reports `translate(0.0 0.0)
scale(1.000 1)` throughout. The camera moves exclusively through the SVG
`viewBox` (9 distinct viewBoxes across 9 timestamps), so furniture is only ever
re-projected by the camera, never animated. Parallax and perspective therefore
come from camera movement alone.

### Camera behaviour

- Horizontal song-driven travel confirmed: `viewBox.x` advances monotonically
  through the film and never oscillates in four directions.
- No vertical page scrolling and no scroll-jacking: the stage is sized to the
  viewport with `overflow` contained.
- Explore orbit and the cinematic camera remain separate: the Explore engine
  holds its own yaw/pitch/distance, the film derives its framing from
  `frame.env.camX`. Neither writes to the other.

### Release persistence

Re-tested after this pass's changes on desktop and mobile: a committed orbit is
still identical 1.8s after pointer release, no page scroll occurs, and no
animation loop overwrites the committed pose.

### Mirror and exterior

- Mirror reflection in Explore is unchanged and still verified by automated test
  (pose equality joint-for-joint against the room rig, clip-path containment,
  removal when out of range).
- The cinematic mirror is a separate live clipped reflection (`mirror-a`/`mirror-b`).
- Weather stays outside: `ParticleEngine.drawExteriorWeather` clips to
  `traceWindowPanes()` before drawing anything, so rain, snow, stars and clouds
  cannot enter the room.

### Live weather — actual status

**The integration is implemented, but it cannot run in this environment and was
not verified against real weather data.**

- `api/scene-context.ts` is a Vercel serverless function that reads
  `x-vercel-ip-latitude/longitude/timezone`, calls Open-Meteo for
  `current=temperature_2m,apparent_temperature,is_day,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m`,
  and never exposes the visitor's coordinates or city.
- Under `vite dev` the route is served as **JavaScript source** (`200
  text/javascript`), not JSON, because Vite does not execute Vercel functions. The
  client's `response.json()` throws and is caught, falling back cleanly to
  `weather: null` and client-local time. Confirmed: no console errors.
- Consequently the opening environment currently uses **inferred local time only**,
  with no weather. No temperature, location or condition is fabricated anywhere.

### Audio — actual verification status

- All **43 canonical lyric cues** are preserved verbatim and are guarded by
  `validateScore` (identity, text, action, ordering, overlaps, duration) plus a
  dedicated unit test.
- **Cue timings remain `verification: "draft"` and uncalibrated.** They have
  never been checked against the authorized production recording — only against a
  synthetic `diagnostic.wav` used to drive the browser tests. Word-level
  timestamps are deliberately absent.
- **Audio calibration is explicitly blocked** until the original recording is
  available for human review.

### Automated results after this pass

| Gate | Result |
|------|--------|
| `tsc --noEmit` | pass |
| `npm run test` | **83 / 83** |
| `npm run test:dom` | 38/38 explore · 13/13 cinematic · 50/50 layout |
| `npm run build` | pass — `index-DXaH_6Jm.js` 455.81 kB / 149.38 kB gzip |
| Browser suite, 5 viewports | **135 / 135** |

The suite grew from 130 to 135 because this pass added a regression test that
walks all 43 cues and asserts no caption overlaps a character and none leaves
the viewport.

### Remaining limitations

- **Chromium only.** Mobile viewports use `isMobile`/`hasTouch` in Chromium.
  **No physical iOS or Android device was used**, and WebKit was not exercised —
  the sandbox cannot download that binary. Frame rate, thermals, safe-area insets
  and real touch hardware are untested.
- This is a **2D projection with painter's-order depth**, not a GPU 3D renderer.
  Perspective and occlusion are coherent, but the implementation is vector
  geometry, and no 3D or 4K claim is made.
- Live weather requires a deployment that executes serverless functions; it is
  unverified end-to-end.
- Lyric timing calibration is blocked pending the original recording.

### Incomplete requirements

None outstanding in code. The three items above are environmental or
evidence-limited, not unimplemented.

---

## Verification Pass — November 26, 2026

Branch `arena/d5c1021d-omj` (from `main` @ `84f2e7e`). **Not pushed, no PR, no deploy.**

### Defects found and fixed in this pass

| # | Defect | Root cause | Fix |
|---|--------|-----------|-----|
| 1 | Hotspot dots were unclickable when they landed under the atmosphere HUD / camera rail | Dots were clamped to the viewport but not to the free area around floating chrome; `elementFromPoint` resolved to the HUD | Obstruction-aware placement (`chromeRects` + `clearOfChrome`) in `ExploreStage.tsx`; HUD and rail marked `data-hud-surface` |
| 2 | Tapping a hotspot did nothing on touch devices | Pointer capture was taken on `pointerdown`, retargeting events and suppressing the subsequent `click` | Capture is now deferred until the movement threshold is crossed, so a tap stays a tap and a swipe still orbits |
| 3 | `ArrowRight`/`ArrowLeft` seek could silently supersede a seek that was still settling | Arrows computed from `snapshot.time`, which only refreshes on the `timeupdate` cadence | Added `AudioController.getCurrentTime()` and read the media element's live clock |
| 4 | Explore mode had no mirror reflection — the vanity glass was a flat tinted quad | No reflection geometry existed | New `src/stage/explore/reflection.ts`: mirror plane reflected, projected through the viewer camera, clipped to the glass, composited into the room's depth queue |

### Mirror reflection — what was built

The Explore room now has a **standing cheval mirror** on the −X wall, directly opposite the plushies, and its glass is a genuine reflection aperture:

- `MIRROR` geometry is exported from `scene.ts`, so the plane that is drawn and the plane that is reflected cannot drift apart.
- Each character's live room anchor is reflected across the mirror plane (`reflectPoint`), projected through the viewer's camera, and drawn with the **same `createBearPainter`, the same pose, and the same joints** — only the body yaw is mirrored. Pose matching is therefore true by construction, not by imitation.
- The glass quad is built with the renderer's existing near-plane clipper (`projectFace`), so the aperture stays correct from every orbit.
- The reflection layer is spliced into the painter stream at the glass's own depth, so the lamp and nightstand **occlude it** exactly as they occlude the room.
- It disappears when the character is behind the glass, outside the frame, or off-camera.

The plushies were deliberately left where they are, and the mirror moved to them instead: the characters' authored positions are part of the room's composition, whereas a mirror that could never contain them would have been the thing worth relocating.

### Verified in this pass

| Gate | Result |
|------|--------|
| `tsc --noEmit` | pass |
| `npm run test` (vitest) | **83 / 83** (4 files) |
| `npm run test:dom` | **38 / 38** explore · **13 / 13** cinematic · **50 / 50** layout |
| `npm run build` | pass — `index-CN1BH6ey.js` 455.37 kB / 149.23 kB gzip |
| Browser suite (`playwright`, 5 viewports) | **130 / 130** (26 tests × 5: desktop 1440×900, desktop 1920×1080, mobile 390/393/430) |

New automated coverage added:

- `tests/explore.spec.ts` → mirror reflection (pose equality joint-for-joint, clip-path containment, removal when out of range); every live hotspot unobstructed and firing its own action; drag release persisting instead of snapping back; neither mode resetting the other's camera.
- `tests/cue.unit.test.ts` → all **43** canonical cues present, ordered, non-overlapping, and deterministically resolvable from time alone.
- `tests/cinematic-determinism.unit.test.ts` → the film is a pure function of `audio.currentTime` (same timestamp identical whichever direction it was reached from) and each authored hold keeps its scene rather than drifting.

---

## Verification Pass 2 — camera geometry, occlusion and the bed view

Branch `arena/d5c1021d-omj`. **Not pushed, no PR, no deploy.**

This pass started from a single reported symptom — the snow globe covering
Mochi in the bed view — and ended up finding four independent camera and
painter defects behind it.

### Defects found and fixed in this pass

| # | Defect | Root cause | Fix |
|---|--------|-----------|-----|
| 1 | The orbit and the wall solver modelled **two different cameras** | `positionFor` (`actions.ts`) and `cameraPosition` (`engine.ts`) added `ORBIT_FOCUS` to X and Z; `createExploreCamera` (`renderer.ts`) swung about the room axis. The solver therefore guarded a point the lens never occupied | All three now use one definition: swing about the room's vertical axis at the requested radius, aim at `ORBIT_FOCUS`. `positionFor` is exported so tests share it instead of re-deriving it |
| 2 | Camera could leave the room, and at other bearings could enter the window wall | Fallout from (1): at yaw 0 the solver approved a radius that put the *real* lens at z = +816, through the far wall | `cameraDistanceLimit` now solves against the room axis, which is the geometry that is actually rendered |
| 3 | A wall clipped by the near plane was sorted as the **nearest** object in the room and painted over the plushies | `projectFace` averaged depth over the *clipped* polygon, so a wall running past the lens collapsed to a depth of ~100 | Clipped faces report `Infinity`; shell faces and horizontal surfaces are keyed by their farthest vertex, furniture by its centroid |
| 4 | Bed actions rendered blank — the plushies were in the DOM but invisible | `characterObstacles` applied its 210-unit framing pad to **Y as well**, inflating each plushie into a 544 × 775 column taller than the camera. Every pose that looked past the pair counted as blocked, and `resolveCameraPose` fell through to its degenerate minimum radius | The pad is horizontal-only (`horizontalPadOnly`); the guard keeps the true 355-unit body height |

Defect 4 is the reason the bed view had been "verified" as working while
showing an empty bed: the preset tests called `clampCameraDistance` **without**
obstacles, so they proved the wrong invariant.

### Bed framing — two poses, because one cannot serve both

The bed needs two framings and a single preset demonstrably failed in both
directions, so the camera is now split by intent:

| Preset | Pose | Used for |
|--------|------|----------|
| `bed` | `−156° / 22° / 680` | the Bed chip, the `B` key, the bed hotspot's first tap — a wide shot from the foot of the bed showing frame, mattress and headboard |
| `bedAction` | `−148° / 16° / 370` | applied by the `bed` action itself, once they are on the quilt |

Why one pose cannot work: a bed action walks the pair to x ≈ 600, right beside
the bed on the +X wall. The wide pose then crops them at the frame edge; the
close pose keeps their faces clear of a 190-high mattress but loses the bed.
`bedAction` is a close two-shot on the quilt, which is what the action is
about. Both resolve at their authored radii.

**Known limitation, not fixed:** the camera's aim point is fixed at
`ORBIT_FOCUS` (z ≈ −330), so a subject standing beside the bed can never be
centred — the best achievable is x ≈ 1054 of 1440. Moving the look-at target
would change the framing of every other shot, so the pair is composed inside
the bed frame instead of centred. This is a deliberate trade-off, not an
oversight.

### Snow-globe occlusion

The original complaint is now asserted rather than eyeballed: a unit test
projects the globe and both heads through the renderer's own camera and fails
if the globe's disc covers a face while being nearer than it. Only the lower
body ever overlaps the globe's disc, and the globe sits low and left of both
heads.

### Verified in this pass

| Gate | Result |
|------|--------|
| `tsc --noEmit` | pass |
| `npx vitest run` | **112 / 112** (5 files) |
| `npm run test:dom` | **38 / 38** explore · **13 / 13** cinematic · **50 / 50** layout |
| `npm run build` | pass — `index-BvbqWXx7.js` 475.62 kB / 155.44 kB gzip |
| Cinematic ending | audio 161.332245 s intact; globe opacity 0 → 0.81 → 1.0 at 144/154/158 s; branding reads **OMJ** |
| Orbit sweep | eight 46° steps, no wall voids, no near-plane blobs, both plushies present at every heading |
| Bed actions | sit · lie · rest · together all reach `hold` with `seated 1.000` and return to `idle` / `seated 0.000` |
| Hug presets | gentle and handhold hold at `hold` with distinct gaps (−64/52 vs −110/98) |
| Lighting | warmth 900 → kelvin 1800 and survives lamp off→on unchanged; cove off → 0; candle on → 0.62 |

New automated coverage added: the globe sight-line test, and a test that the
character guard pads the footprint but not the body height.

### Explicit limitations

- All browser tests ran in **Chromium** (`isMobile`/`hasTouch` for the mobile viewports). **No physical iOS or Android device was used**, and WebKit was not exercised — the sandbox cannot download Playwright's WebKit binary. Frame rate, thermal behaviour, safe-area insets and real touch hardware remain untested.
- The 43 lyric cue timestamps are still authored/draft values; they have not been calibrated by ear against `public/audio/omj.m4a`.
