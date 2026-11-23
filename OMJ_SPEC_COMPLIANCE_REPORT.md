# OMJ — SPECIFICATION COMPLIANCE VERIFICATION REPORT
## Stage 2 of 4: Comprehensive Specification & Architecture Audit

**Repository:** `https://github.com/HassaanFisky/OMJ`  
**Inspected Branch / Head:** `main` (commit `9510c0cf3cd8a448e0a176496f2e5321778191d1`)  
**Previous Handoff Document:** `OMJ_CODE_STAGE_HANDOFF.md`  
**Production Target:** `https://omj-iota.vercel.app`  
**Verification Date:** November 23, 2026  

---

## 1. Executive Summary & Verification Matrix

Static analysis, TypeScript typechecking, Vitest unit test suite, Playwright browser test suite, and complete source code diff inspection were conducted.

- **TypeScript Compilation (`tsc --noEmit`):** ✅ **PASSED** (0 type errors).
- **Vite Production Build (`vite build`):** ✅ **PASSED** (clean bundle output).
- **Vitest Unit Suite (`vitest run`):** ⚠️ **11 Passed, 1 Failed** (Failed on lap-rest head placement geometry test).
- **Playwright Test Suite (`playwright test`):** ⚠️ **4 Passed, 2 Failed** (Failed on test expectation casing mismatch for uppercase lyrics and pointer-event interception between floating player pill and topbar mute button).

### Overall Compliance Status by Category

| # | Specification Criterion | Status |
|---|---|---|
| 01 | Character Appearance & Identity | **Confirmed in Source** |
| 02 | Chubby Plush Anatomy ("Gattu-Bacha") | **Confirmed in Source** |
| 03 | Eye Reflections & Facial Expression Architecture | **Confirmed in Source** |
| 04 | Two-Bone IK Correctness & Transform Scaling | **Confirmed in Source** |
| 05 | Direct Lap-Rest Positioning & Contact Support | ❌ **Incorrect / Regression Detected** |
| 06 | Natural Hugging and Kissing | ⚠️ **Partially Implemented** |
| 07 | Fully Back-Facing Window Pose with Visible Spine Seams | ⚠️ **Partially Implemented (Torso seam inactive)** |
| 08 | Wooden Bed, Headboard, Pillows & Quilt | **Confirmed in Source** |
| 09 | Environmental State Consistency | ⚠️ **Partially Implemented (Atmospheric flickering)** |
| 10 | Continuous Atmospheric Progression (Drizzle → Snow Globe) | ⚠️ **Partially Implemented** |
| 11 | Visual Action Mapped to Every Lyric Cue (43 cues) | **Confirmed in Source** |
| 12 | Uppercase Lyric Presentation | **Confirmed in Source (Breaks legacy test assertion)** |
| 13 | Bottom-Anchored Golden Karaoke Captions | **Confirmed in Source** |
| 14 | No Conventional Music-Player Interface | **Confirmed in Source** |
| 15 | Audio Synchronization Architecture (`audio.currentTime`) | **Confirmed in Source** |
| 16 | Cinematic Camera Movement (2.5D Parallax & Pull-Back) | **Confirmed in Source** |
| 17 | Full Edge-to-Edge Responsive Display (`slice` layout) | 🔍 **Cannot be fully verified without browser inspection** |
| 18 | Preservation of Existing Project Architecture | **Confirmed in Source** |

---

## 2. Detailed Findings by Specification Criterion

### 01. Character Appearance & Identity
- **Status:** Confirmed in Source
- **Evidence:** `src/characters/BearRig.tsx` defines distinct palettes and details for Mochi (Character A: `#fdf0da` / `#e8cfaa` / `#a07a52`, cream fur, purple knit scarf collar) and Yume (Character B: `#f0dff0` / `#d4b8d8` / `#8a5a9c`, lavender fur, sakura-pink ear bow, delicate eyelashes). Both characters maintain identical base rigs, SVG hierarchies, and joint anchors across the timeline.

### 02. Chubby Plush Anatomy ("Gattu-Bacha")
- **Status:** Confirmed in Source
- **Evidence:** `src/characters/BearRig.tsx` lines 70–165. Proportions feature oversized rounded heads (`ellipse cy="-152" rx="63" ry="62"`), compact chubby bellies (`ellipse cy="-52" rx="52" ry="68"`), lighter tummy patches (`ellipse cy="-40" rx="31" ry="42"`), thick curved legs (`ellipse cy="22" rx="22" ry="34"`), and broad rounded paws with paw pads and toe stitches (`cy="51" rx="28" ry="19"`).

### 03. Eye Reflections & Facial Expression Architecture
- **Status:** Confirmed in Source
- **Evidence:** `src/characters/BearRig.tsx` lines 215–280. Eyes are built using a 5-layer composite: white sclera base (`#f8f2ee`), radial iris gradient (`#2d1a38` to `#0a0410`), deep center pupil, primary upper-left specular reflection (`#ffffff` opacity .92), and secondary bottom-right bounce light (`#ffffff` opacity .28). Emotional tears (`data-joint="tears"`) and dynamic eye sheens (`data-joint="eyeWater"`) respond to the `tear` parameter. `src/characters/BearAnimations.ts` executes organic dual-interval blinking (primary 4.9–5.1s cycle + secondary 5.25–5.4s micro-blink) and mouth morphing.

### 04. Two-Bone IK Correctness & Transform Scaling
- **Status:** Confirmed in Source
- **Evidence:** `src/characters/BearAnimations.ts` lines 11–48 implements analytical 2-bone IK (`solveArm`) with anatomical upper (`36px`) and lower (`35px`) lengths and constrained elbow bending (`cosElbow` clamped between -1 and 1). World-space hand attachments in `src/timeline/scenes.ts` lines 640–660 (`attachHand` and `worldPoint`) correctly de-rotate and divide by `pose.scale` to prevent torso clipping or limb separation.

### 05. Direct Lap-Rest Positioning & Contact Support
- **Status:** ❌ **Incorrect / Regression Detected**
- **Evidence:** In `src/timeline/scenes.ts` lines 418–424, commit `9510c0c` altered `a.x` from `b.x - 22 - 150 * a.scale` to `b.x - 20`. In the character rig, the head is located at `cy = -152` relative to origin `(0, 0)`. When Teddy A is rotated 90°, the head rotates to `+152px` local X. Setting `a.x = b.x - 20` causes the head world X to be `(b.x - 20) + 152 = b.x + 132`, placing the head 132px to the *right* of Teddy B in mid-air, while Teddy A's pelvis/feet land on Teddy B's lap. Furthermore, vitest unit test `tests/film.unit.test.ts:112` failed with:
  ```
  AssertionError: expected 550 to be close to 398, received difference is 152, but expected 0.005
  ```
- **File:** `src/timeline/scenes.ts`
- **Severity:** **HIGH**
- **Required Correction:** Revert `a.x` calculation in `case "lap"` to account for the +90° head displacement: `a.x = b.x - 25 - 150 * a.scale`, with `a.y = b.y - 10` so the head rests directly onto Teddy B's lap.

### 06. Natural Hugging and Kissing
- **Status:** ⚠️ **Partially Implemented**
- **Evidence:** In `src/timeline/scenes.ts`, `case "kiss"` (lines 221–235) and `case "embrace"` (lines 447–461) configure head tilts (`head: 11 / -11`), eye closure (`closed: 0.75`), and body rotations (`rotation: 5 / -5`). However, neither case configures arm targets (`leftX`, `leftY`, `rightX`, `rightY`). Both characters remain with arms hanging at default positions (`61, -29`) rather than wrapping paws around each other or resting on cheeks.
- **File:** `src/timeline/scenes.ts`
- **Severity:** **MEDIUM**
- **Required Correction:** Define explicit arm coordinates in `kiss` and `embrace` (e.g. `a.rightX = 65, a.rightY = -55, b.leftX = -65, b.leftY = -55`) so paws physically touch the partner's shoulders/torso.

### 07. Fully Back-Facing Window Pose with Visible Spine Seams
- **Status:** ⚠️ **Partially Implemented**
- **Evidence:** In `src/timeline/scenes.ts` line 457, `window` sets `a.back = 1` and `b.back = 1`, and `a.head = 0, b.head = 0`. In `src/characters/BearRig.tsx`, `<g data-joint="belly">` and `<path data-joint="backTorsoSeam">` were added. However, in `src/characters/BearAnimations.ts`, lines 50–87, neither `belly` nor `backTorsoSeam` are listed in `JointName` or queried from the DOM. Consequently, during `back = 1`:
  1. The belly patch (`data-joint="belly"`) remains visible at default `opacity=".68"`.
  2. The back spine seam (`data-joint="backTorsoSeam"`) remains at default `opacity="0"`.
  Only the head back seam (`data-joint="backSeam"`) is animated.
- **File:** `src/characters/BearAnimations.ts` & `src/characters/BearRig.tsx`
- **Severity:** **MEDIUM**
- **Required Correction:** Add `belly` and `backTorsoSeam` to `JointName` in `BearAnimations.ts`. Set `nodes.belly.setAttribute("opacity", String(1 - pose.back))` and `nodes.backTorsoSeam.setAttribute("opacity", String(pose.back * 0.75))`.

### 08. Wooden Bed, Headboard, Pillows & Quilt
- **Status:** Confirmed in Source
- **Evidence:** `src/components/CinematicStage.tsx` lines 485–556 replaces the previous bare sticks with an ornate handcrafted wooden daybed containing:
  - 4 turned posts with spherical finials (`rect rx="6"`, `ellipse rx="13" ry="8"`).
  - Carved wooden headboard panel with raised rail top and grain stitch details (`#5c3820`, `#7a5035`, `#3e2410`).
  - Quilted mattress with piping edge and diamond tuck stitching (`#ece0d4`, `#c4aea8`).
  - Dual plump pillows with crease shadows (`ellipse rx="52" ry="11"`).
  - Quilt overlay in `quilt` and `tail` scenes properly drapes over mattress and seated characters.

### 09. Environmental State Consistency
- **Status:** ⚠️ **Partially Implemented**
- **Evidence:** In `src/timeline/scenes.ts` lines 146–147, the chorus steps still oscillate rapidly between conflicting weather states:
  ```ts
  env.rain = [0.15, 1, 0.75, 0.35, 0.4, 0.85, 0.45, 0.15][step] ?? 0;
  env.sun = [0.05, 0.1, 0.85, 0.4, 0.6, 0.25, 0.95, 0.75][step] ?? 0;
  ```
  Rain and sun fluctuate up and down abruptly every 2 seconds. Furthermore, `env.snow` appears at cue 22 (`case "winter"`), drops to 0 at cue 25 (`case "devotion"`), then re-emerges at cue 43 (`case "quilt"`).
- **File:** `src/timeline/scenes.ts`
- **Severity:** **MEDIUM**
- **Required Correction:** Unify the weather curves in `chorus` and verses to follow the monotonic narrative progression: initial cold window drizzle (`rain: 0.6–0.7`), transitioning into indoor evening shelter (`warmth/sun: 0.25, mist: 0.4`), culminating in outdoor winter snowfall (`snow: 0.8–1.0`).

### 10. Continuous Atmospheric Progression (Drizzle → Snow Globe)
- **Status:** ⚠️ **Partially Implemented**
- **Evidence:** `CinematicStage.tsx` lines 621–643 implements the ornate Snow Globe climax SVG (halo, curved specular reflections, wooden base tiering, brass plaque with "OMJ" monogram). Line 168 reveals it during `action === "tail"`. However, the intermediate progression between drizzle, reflection, mist, and snow in `scenes.ts` contains the abrupt discontinuities noted in Criterion 09.
- **File:** `src/timeline/scenes.ts`
- **Severity:** **LOW**
- **Required Correction:** Smooth weather properties across the 43 cues in `scenes.ts`.

### 11. Visual Action Mapped to Every Lyric Cue (43 Cues)
- **Status:** Confirmed in Source
- **Evidence:** `src/timeline/score.ts` rows lines 10–58 contains all 43 canonical lyric lines mapped to unique action identifiers. `src/timeline/scenes.ts` provides explicit target poses and environment states for all actions. Vitest test `implements every action` passed.

### 12. Uppercase Lyric Presentation
- **Status:** Confirmed in Source (with Legacy Test Impact)
- **Evidence:** `src/components/LyricsDisplay.tsx` lines 39–52 executes `.toUpperCase()` on all word elements and cue fallback text. `src/styles.css` line 304 enforces `text-transform: uppercase`.
  *Note:* Playwright test `tests/player.spec.ts:122` failed because the test asserted exact case match with `cue.text` (which is written in title/sentence case in `score.ts`). The implementation satisfies the user's explicit specification; the test harness requires case-insensitive or uppercase comparison.
- **File:** `tests/player.spec.ts`
- **Severity:** **LOW (Test harness only)**
- **Required Correction:** Update `tests/player.spec.ts:122` to `expect(page.locator(".lyric-caption")).toHaveText(cue.text.toUpperCase())`.

### 13. Bottom-Anchored Golden Karaoke Captions
- **Status:** Confirmed in Source
- **Evidence:** `src/styles.css` lines 289–328:
  - Anchored at bottom: `bottom: calc(env(safe-area-inset-bottom, 0px) + 26px); top: auto;`.
  - Capsule pill styling: `border-radius: 999px; background: rgba(20, 16, 30, 0.88); backdrop-filter: blur(16px);`.
  - Word fill karaoke: `.lyric-word-fill { color: #ffe6a0; text-shadow: 0 0 14px rgba(255, 215, 115, 0.85); }`.
  - Does not block characters' faces at center stage.

### 14. No Conventional Music-Player Interface
- **Status:** Confirmed in Source
- **Evidence:** `src/components/Controls.tsx` lines 128–195 implements `AudioPlayer` as a minimal glass pill in the top-right corner with 4 compact icon buttons (Play/Pause, Replay, Transcript, Close). All conventional scrub bars, seek sliders, progress rails, and track timers are removed during playback.

### 15. Audio Synchronization Architecture
- **Status:** Confirmed in Source
- **Evidence:** `src/audio/AudioController.ts` uses native `HTMLAudioElement` and `requestAnimationFrame`. `CinematicStage.tsx` registers a renderer via `controller.addRenderer((time) => { ... })` which samples `film.sample(time, reduced)` on each tick. Seeking and pausing deterministically reconstruct poses.

### 16. Cinematic Camera Movement
- **Status:** Confirmed in Source
- **Evidence:** `CinematicStage.tsx` lines 174–220 implements a multiplane parallax camera with `camX`, `camY`, and `zoom`. Background moon/sun translates at 0.1x, room at 0.45x, window at 0.6x, and foreground stage at 1.0x. `FilmEngine.ts` smoothly interpolates camera coordinates between scene beats.

### 17. Full Edge-to-Edge Responsive Display
- **Status:** 🔍 **Cannot be fully verified without browser inspection**
- **Evidence:** `src/components/CinematicStage.tsx` lines 330 and 409 configured `preserveAspectRatio="xMidYMid slice"` on the SVG root elements, and `src/styles.css` sets `.cinematic-stage` and `.art` to `inset: 0; width: 100%; height: 100%;`. On wide desktop viewports (1440x900, 1920x1080), the stage fills the entire screen edge-to-edge without letterboxing. However, on narrow portrait screens (e.g. 390x844), horizontal cropping occurs (approx. 30% width cropped), which must be visually inspected in Stage 3 to ensure characters are not clipped.

### 18. Preservation of Existing Project Architecture
- **Status:** Confirmed in Source
- **Evidence:** The application remains built on React 18, TypeScript, Vite, GSAP, HTML5 Canvas, SVG rigs, and the verified 43-cue score structure. No extraneous 3D frameworks or architectural rewrites were added.

---

## 3. Discrepancies and Required Corrections

### Defect 1: Lap-Rest Head Offset Inversion (Unit Test Failure)
- **File:** `src/timeline/scenes.ts` (lines 418–424)
- **Severity:** **HIGH**
- **Description:** Setting `a.x = b.x - 20` when `a.rotation = 90` puts Teddy A's head 132px to the right of Teddy B instead of resting on her lap.
- **Correction:** Set `a.x = b.x - 25 - 150 * a.scale;` and `a.y = b.y - 10;`.

### Defect 2: Back Torso Seam and Belly Group Unconnected to Rig Driver
- **File:** `src/characters/BearAnimations.ts` (lines 50–87, 173–176)
- **Severity:** **MEDIUM**
- **Description:** In `BearRig.tsx`, `<g data-joint="belly">` and `<path data-joint="backTorsoSeam">` were created, but `BearAnimations.ts` does not query them or modify their opacity on `pose.back`. The belly stays visible from behind and the back spine seam never renders.
- **Correction:** Query `belly` and `backTorsoSeam` in `BearAnimations.ts` and modulate their opacity based on `pose.back`.

### Defect 3: Kiss and Embrace Missing Arm Placement
- **File:** `src/timeline/scenes.ts` (lines 221–235, 447–461)
- **Severity:** **MEDIUM**
- **Description:** `kiss` and `embrace` do not define `leftX`, `leftY`, `rightX`, `rightY`, leaving arms in default rest positions rather than wrapping around or touching.
- **Correction:** Add hand coordinates to `targetFor("kiss")` and `targetFor("embrace")`.

### Defect 4: Floating Controls Pill Intercepts Topbar Click Events
- **File:** `src/styles.css` (lines 330–355)
- **Severity:** **MEDIUM**
- **Description:** In Playwright test `player.spec.ts:49`, clicking the topbar "Mute" button failed because `.player.cinematic-controls` (with `z-index: 25` in top-right) was intercepting pointer events over `.topbar` (`z-index: 20`).
- **Correction:** Adjust layout or position of `.player` (e.g. shift below topbar or configure pointer-events / margins) so topbar buttons remain clickable.

### Defect 5: Playwright Caption Text Case Expectation Mismatch
- **File:** `tests/player.spec.ts` (line 122)
- **Severity:** **LOW**
- **Description:** Playwright expects `cue.text` exact match ("Kabhi tu dekh..."), but UI correctly presents `"KABHI TU DEKH..."` as mandated by spec.
- **Correction:** Update test expectation to `.toHaveText(cue.text.toUpperCase())` or use case-insensitive regex.

---

## 4. Verification Checkpoint Sign-Off

- **Specification Verification Status:** **COMPLETE (Stage 2 of 4)**
- **Code Modifications Made During Stage 2:** **NONE** (Strict read-only audit executed).
- **Next Required Stage:** **Stage 3 (Visual QA & Browser Verification)** / Implementation of the 5 identified corrections prior to final visual sign-off.
