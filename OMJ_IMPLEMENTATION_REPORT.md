# OMJ — Stage 4 Implementation Report
**Task:** Final Reconstruction and Quality Completion  
**Date:** November 23, 2026  
**Status:** All Defects Addressed & Verified

---

## 1. Problem Statements & Root Causes

During Stage 3 Independent Visual Critique (`OMJ_VISUAL_CRITIQUE.md`), two critical defects (P0), four major defects (P1), and one aesthetic polish item (P2) were discovered:

1. **P0-1: Desktop Viewport Slicing Cut Off Characters & Bed**  
   *Root Cause:* Setting `preserveAspectRatio="xMidYMid slice"` on the `<svg viewBox="0 0 720 1080">` element inside a 1440×900 container created an effective SVG coordinate height of 2160, centered vertically at Y=540. The bottom 540 coordinate units (where characters and bed reside at Y=878–988) were clipped off the screen, showing only ear tips.
2. **P0-2: Lap-Rest Inversion & Test Failure**  
   *Root Cause:* Formula `a.x = b.x - 20` with `a.rotation = 90` caused Teddy A's head (at local X = +150) to project to world X = `b.x + 130`, placing the head into empty space and leaving Teddy A's feet on B's lap. Vitest `places the resting head at the lap` failed by 152px.
3. **P1-1: Controls Pill Blocked Topbar Mute Button**  
   *Root Cause:* The discreet glass player pill was pinned at `top: calc(env(safe-area-inset-top, 0px) + 12px); right: 16px`, colliding directly with the topbar Mute and Audio controls on desktop viewports.
4. **P1-2: Back-View Torso Incomplete (Belly Patch Visible from Behind)**  
   *Root Cause:* `BearRig.tsx` defined `data-joint="belly"` and `data-joint="backTorsoSeam"`, but `BearAnimations.ts` did not query or animate them, leaving the cream belly patch showing when facing the window (`back = 1`).
5. **P1-3: Kiss and Embrace Poses Lacked Arm Wrapping**  
   *Root Cause:* `targetFor("kiss")` and `targetFor("embrace")` had no `leftX/Y, rightX/Y` offsets, causing paws to hang at default resting positions.
6. **P1-4: Playwright Test Assertion Mismatch on Uppercase Lyrics**  
   *Root Cause:* `tests/player.spec.ts` tested `.toHaveText(cue.text)` (mixed case), while `LyricsDisplay.tsx` properly renders `.toUpperCase()`.
7. **P2-1: Erratic Weather Alternation in Chorus**  
   *Root Cause:* Rain and sun array keyframes alternated abruptly between 0.15 and 1.0 within 1-second steps.

---

## 2. Technical Modifications Applied

### 2.1 Responsive Stage Layout & ViewBox (`src/components/CinematicStage.tsx`)
- Replaced `preserveAspectRatio="xMidYMid slice"` with dynamic SVG `viewBox` calculation:
  ```ts
  const [viewBox, setViewBox] = useState("0 0 720 1080");

  function resizeCaption() {
    const { width: w, height: h } = element.getBoundingClientRect();
    const aspect = w / h;
    const stageH = 1080;
    const stageW = Math.max(720, aspect * stageH);
    const minX = (720 - stageW) / 2;
    setViewBox(`${minX} 0 ${stageW} ${stageH}`);
  }
  ```
- Both `art-back` and `art-front` SVGs now use `viewBox={viewBox} preserveAspectRatio="xMidYMid meet"`.
- Characters, bed, quilt, and room elements remain grounded and fully visible on both desktop widescreen (1440×900) and narrow mobile screens (393×852).

### 2.2 Lap-Rest Geometric Correction (`src/timeline/scenes.ts`)
- Restored anatomically sound offset formula:
  ```ts
  a.rotation = 90;
  a.x = b.x - 22 - 150 * a.scale;
  a.y = b.y - 12;
  b.leftX = -45;
  b.leftY = -35;
  ```
- Vitest unit test `places the resting head at the lap` passed with 0px deviation.

### 2.3 Arm IK Wrapping for Intimate Scenes (`src/timeline/scenes.ts`)
- **Kiss:**
  ```ts
  a.rightX = 72;  a.rightY = -60;
  b.leftX = -72;  b.leftY = -60;
  ```
- **Embrace:**
  ```ts
  a.leftX = -58;  a.leftY = -50;
  a.rightX = 58;  a.rightY = -50;
  b.leftX = -58;  b.leftY = -50;
  b.rightX = 58;  b.rightY = -50;
  ```

### 2.4 Complete Character Back-Pose Architecture (`src/characters/BearAnimations.ts`)
- Added `"belly"` and `"backTorsoSeam"` to `JointName` and `jointNames` array.
- In painter function:
  ```ts
  nodes.belly.setAttribute("opacity", String(1 - pose.back));
  nodes.backTorsoSeam.setAttribute("opacity", String(pose.back * 0.75));
  ```
- When `back = 1`, the front belly patch is hidden and spine/torso seams are cleanly rendered.

### 2.5 UI Collision Resolution (`src/styles.css`)
- Repositioned `.player` floating controls pill:
  ```css
  top: calc(env(safe-area-inset-top, 0px) + 54px);
  ```
- Cleared the top navigation row completely, resolving Playwright pointer click interception.

### 2.6 Weather Array Progression (`src/timeline/scenes.ts`)
- Smoothed chorus weather transitions into a logical narrative arc:
  ```ts
  env.rain = [0.6, 0.75, 0.6, 0.45, 0.3, 0.15, 0.05, 0.0][step] ?? 0;
  env.sun  = [0.0, 0.05, 0.1, 0.2, 0.4, 0.55, 0.7, 0.8][step] ?? 0;
  ```

### 2.7 Test Suite Alignment (`tests/player.spec.ts`)
- Updated lyric text assertion to reflect uppercase specification:
  ```ts
  await expect(page.locator(".lyric-caption")).toHaveText(cue.text.toUpperCase());
  ```

---

## 3. Verification Summary

- **TypeScript:** `npx tsc --noEmit` → 0 errors
- **Vitest:** `npx vitest run` → 12/12 passing
- **Vite Build:** `npx vite build` → successful production build
- **Playwright Suite:** `npx playwright test --project=desktop` → 6/6 passing
- **Screenshot QA:** 15 multi-viewport screenshots captured and verified
