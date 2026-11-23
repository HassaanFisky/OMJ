# OMJ — INDEPENDENT VISUAL CRITIQUE REPORT
## Stage 3 of 4: Comprehensive Visual, Animation, Layout & Environmental Quality Assurance

**Inspection Date:** November 23, 2026  
**Evaluation Mode:** Headed Browser Verification & Playwright Screenshot Capture  
**Test Platforms:**
- Desktop: 1440 × 900 (Widescreen 16:10 / 16:9 context)
- Mobile: 393 × 852 (iPhone 14 Pro Portrait)  
**Reference Artifacts Captured:**
- `omj-desktop-entrance.png`, `omj-desktop-playback.png`
- `critique-desktop-01-waiting.png`
- `critique-desktop-04-kiss.png`
- `critique-desktop-10-chorus-rain.png`
- `critique-desktop-19-gifts.png`
- `critique-desktop-22-winter.png`
- `critique-desktop-31-lap.png`
- `critique-desktop-41-embrace.png`
- `critique-desktop-42-window-back.png`
- `critique-desktop-43-quilt.png`
- `critique-desktop-climax-snowglobe.png`
- `critique-mobile-01-waiting.png`
- `critique-mobile-31-lap.png`
- `critique-mobile-42-window-back.png`
- `critique-mobile-climax-snowglobe.png`

---

## 1. Executive Summary & Defect Prioritization

Visual rendering inspection demonstrates significant improvements over the legacy commit `50c4661`: the character rigs are chubby, cuddly, and feature multi-layered glassy eyes; the wooden bed and quilt replace the bare sticks; the Snow Globe climax is present in SVG markup; and the lyric caption is pinned to the bottom in all caps.

However, visual inspection of the rendered frames in Playwright reveals several **critical defects (P0/P1)** caused by SVG viewport slicing, camera offsets, coordinate inversions, and Z-index collisions:

1. **P0 — Severe Bottom Cropping on Desktop (`preserveAspectRatio="xMidYMid slice"`):** On a 1440×900 desktop screen, the vertical aspect ratio mismatch crops the bottom ~35% of the 720×1080 stage. Consequently, characters' bodies, paws, gifts, and the newly built wooden bed are almost entirely cut off below the viewport fold, leaving only their ear tips visible!
2. **P0 — Lap-Rest Anatomical Inversion (Teddy A Head Floating in Air, Feet on Lap):** In `critique-mobile-31-lap.png`, Teddy A's head is pointing to the right, floating off the right edge of the bed, while his feet and pelvis are sitting on Teddy B's lap. Teddy B's arm points out to the left caressing empty air.
3. **P1 — Floating Controls Pill Collision with Topbar Mute:** The `.player.cinematic-controls` pill in the upper right directly overlaps the `.topbar` Mute button, intercepting mouse clicks and causing automated test timeouts.
4. **P1 — Back View Torso Incomplete (Belly Patch Still Shows):** While the head and ears face away with a back seam, the front belly patch is not suppressed in code and the back torso spine seam remains at `opacity: 0`.
5. **P1 — Absence of Physical Hug/Kiss Arm Wrapping:** In both `kiss` and `embrace`, character paws remain stationary at their sides (`-61, -29` / `61, -29`) rather than embracing or reaching toward cheeks.
6. **P2 — Weather Flickering and Sun/Moon Simultaneous Inconsistency:** The chorus oscillates rapidly between rain=1.0 and sun=0.85 every 2 seconds, displaying bright sunbeam rays while a crescent moon and raindrops are visible simultaneously.
7. **P2 — Mobile Horizontal Framing Squeeze:** On 393×852 mobile screens, characters in wide shots (`kiss`, `embrace`, `window`) are pushed close to the left/right screen edges with minimal horizontal breathing room.

---

## 2. Categorized Findings & Visual Evidence

### [P0] Critical Visual & Logical Defects

#### Defect 1.1: Desktop Viewport Slicing Cuts Off Characters & Bed
- **Severity:** **P0**
- **Observed Behavior:** On desktop viewports (1440×900, 1920×1080), `<svg viewBox="0 0 720 1080" preserveAspectRatio="xMidYMid slice">` scales the width from 720 to 1440 (2.0x scale factor). This makes the effective height 2160px inside a 900px viewport, centering on Y=540. The bottom half of the stage (Y=850–1080, where the bed, gifts, floor, character bodies, and paws reside) is pushed 400px below the bottom edge of the monitor!
- **Visual Evidence:** In `critique-desktop-01-waiting.png`, `critique-desktop-04-kiss.png`, and `critique-desktop-19-gifts.png`, only the forehead and ears of the bears are visible at the very bottom edge of the screen, behind the caption pill. The entire wooden bed, pillows, gifts, and limbs are completely invisible off-screen!
- **Root Cause:** Slicing a tall vertical 720×1080 SVG across a landscape 16:9/16:10 screen without adjusting the viewBox or camera framing.
- **Required Fix:** Either:
  1. Use dynamic viewBox computation (`viewBox={`${viewBoxX} 0 ${viewBoxW} 1080`}`) based on container aspect ratio so height stays 1080 and width expands to 1920 (centered at X=360), or
  2. Implement a responsive stage camera target that shifts `camY` up on landscape screens (`camY: -220` on desktop).

#### Defect 1.2: Lap-Rest Position Inverted (Teddy A's Head Floating in Space)
- **Severity:** **P0**
- **Observed Behavior:** In `critique-mobile-31-lap.png`, Teddy B sits upright on the bed. Teddy A is horizontal (rotated 90°), but his head is facing right, protruding completely into empty space past the right bedpost. Teddy A's bottom/feet are positioned on Teddy B's lap. Teddy B's left arm is reaching out to the left side, caressing thin air.
- **Visual Evidence:** Directly visible in `critique-mobile-31-lap.png`.
- **Root Cause:** In `src/timeline/scenes.ts` line 420:
  ```ts
  a.rotation = 90;
  a.x = b.x - 20; // Head is at local +150px! World X = (b.x - 20) + 150 = b.x + 130!
  ```
- **Required Fix:** Revert `a.x` to `b.x - 25 - 150 * a.scale` and set `a.y = b.y - 12`. Align Teddy B's caressing arm (`b.leftX = -45, b.leftY = -35`) over Teddy A's actual head.

---

### [P1] Major Creative & Animation Defects

#### Defect 2.1: Floating Player Controls Pill Blocks Topbar Mute Button
- **Severity:** **P1**
- **Observed Behavior:** The floating glass controls pill (`.player.cinematic-controls`) is placed at `top: 12px; right: 16px; z-index: 25;`. The topbar sound toggle is also placed at the top-right (`.topbar .top-actions`). The close and transcript buttons inside `.player` physically sit directly on top of the Mute button, intercepting all clicks and causing Playwright tests to timeout.
- **Visual Evidence:** Reproduced in automated Playwright run `tests/player.spec.ts:49:1` ("button from player subtree intercepts pointer events").
- **Root Cause:** CSS `.player` positioned at top right without clearing `.topbar`.
- **Required Fix:** Offset `.player` below `.topbar` (e.g. `top: calc(env(safe-area-inset-top, 0px) + 54px);`) or integrate the controls into a single cohesive header.

#### Defect 2.2: Back-Facing Window Pose Shows Incomplete Anatomy
- **Severity:** **P1**
- **Observed Behavior:** In `critique-desktop-42-window-back.png`, both bears are turned facing the window. Their heads show the back ears and head seam. However, because `belly` and `backTorsoSeam` are never toggled in `BearAnimations.ts`, the front belly patch is still rendered on their torsos and the spine seam down the back of the plush toy is missing (`opacity: 0`).
- **Visual Evidence:** `critique-desktop-42-window-back.png` and `critique-mobile-42-window-back.png`.
- **Root Cause:** `BearAnimations.ts` does not query or set opacity on `data-joint="belly"` or `data-joint="backTorsoSeam"`.
- **Required Fix:** Add `belly` and `backTorsoSeam` to `JointName` and toggle them with `pose.back`.

#### Defect 2.3: Kiss and Embrace Lack Arm Wrapping / IK Contact
- **Severity:** **P1**
- **Observed Behavior:** In `critique-desktop-04-kiss.png` and `critique-desktop-41-embrace.png`, both characters tilt heads and close eyes, but their paws remain hanging straight down at default coordinates (`61, -29`). There is zero physical touch between their paws, no hands reaching to cheeks, and no arms wrapped around each other's bodies.
- **Visual Evidence:** `critique-desktop-04-kiss.png`.
- **Root Cause:** In `scenes.ts`, `case "kiss"` and `case "embrace"` do not define `a.leftX/Y, a.rightX/Y, b.leftX/Y, b.rightX/Y`.
- **Required Fix:** Define explicit contact coordinates in `targetFor("kiss")` and `targetFor("embrace")` using `attachHand`.

---

### [P2] Noticeable Polish & Environmental Consistency Issues

#### Defect 3.1: Conflicting Weather in Chorus (Sunbeams + Crescent Moon + Rain)
- **Severity:** **P2**
- **Observed Behavior:** In `critique-desktop-10-chorus-rain.png`, the scene displays heavy rain falling, bright sunbeams cutting through the center (`env.sun = 0.85`), a crescent moon in the sky, and stars all at the exact same instant.
- **Root Cause:** `env.rain` and `env.sun` arrays in `scenes.ts` lines 146–148 step erratically between [0.15, 1, 0.75, 0.35] and [0.05, 0.1, 0.85, 0.4].
- **Required Fix:** Smooth the environmental curves in `chorus` to follow a coherent lighting atmosphere (warm dusk with soft rain, fading into twilight).

#### Defect 3.2: Mobile Screen Character Proportions & Edge Crowding
- **Severity:** **P2**
- **Observed Behavior:** On mobile screens (`critique-mobile-01-waiting.png`), the vertical framing displays the window and bed cleanly. However, in two-character scenes (`kiss`, `embrace`), characters sit close to the left and right screen borders.
- **Root Cause:** The base rig spacing `a.x = 275..305, b.x = 425..465` spans ~190px of 720px width. When sliced down to 393px viewport width, the effective margin on the sides is narrow.
- **Required Fix:** Tune mobile zoom / framing in `FilmEngine.ts` or add responsive camera scaling.

---

### [P3] Minor Polish & Aesthetic Refinements

#### Defect 4.1: Caption Pill Padding & Touch Area
- **Severity:** **P3**
- **Observed Behavior:** The caption capsule is styled with uppercase typography and a golden karaoke fill. On mobile portrait, when lyrics are long (e.g. line 31: "TUJHE BAITH KE SUNAYENGE HUM SAARAY GHUM"), the caption spans nearly edge-to-edge (width ~360px out of 393px).
- **Required Fix:** Reduce horizontal padding slightly on small mobile viewports (`padding: 8px 16px; font-size: 13px;`).

---

## 3. Prioritized Action Plan for Stage 4

| Priority | Issue Description | Target File | Impact |
|---|---|---|---|
| **P0** | Fix desktop viewport cropping (adjust SVG viewBox/camera framing so characters & bed are visible) | `CinematicStage.tsx` / `styles.css` | Critical for desktop viewing |
| **P0** | Fix lap-rest head position (`a.x = b.x - 25 - 150 * a.scale`) | `src/timeline/scenes.ts` | Fixes broken anatomy & unit test |
| **P1** | Move `.player` controls below topbar to prevent blocking Mute button | `src/styles.css` | Fixes UI interaction & Playwright test |
| **P1** | Wire `belly` and `backTorsoSeam` in `BearAnimations.ts` | `src/characters/BearAnimations.ts` | Fixes back-facing window scene |
| **P1** | Add arm reach / embrace coordinates in `kiss` and `embrace` | `src/timeline/scenes.ts` | Delivers genuine physical hugs |
| **P2** | Smooth chorus weather array to eliminate sun/moon/rain flicker | `src/timeline/scenes.ts` | Consistent atmospheric storytelling |
| **P2** | Update Playwright test expectation for uppercase lyrics | `tests/player.spec.ts` | Restores green CI test suite |

---

*End of Visual Critique Report.*
