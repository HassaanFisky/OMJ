# OMJ — Continuation Checkpoint

**Branch:** `arena/d5c1021d-omj` (PR #1 open, HEAD `d04a997`, all work below **uncommitted**)
**Date:** 2026-11-27
**Status:** All eight parts of the brief implemented and verified in the live preview.
Nothing committed, pushed, merged or deployed, per instruction.

---

## Verification gates (all green, this pass)

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 113/113 passed (5 files) |
| `npm run test:dom` | 35/35 + 13/13 + 50/50 |
| `npm run build` | built in ~256 ms |

Dev server: `vite` on **5180**, already running. Chromium needs
`LD_LIBRARY_PATH=/tmp/al2023-extract/lib` and `executablePath:'/tmp/chromium'`.
Cinematic captures need `--autoplay-policy=no-user-gesture-required`.

---

## What is done

### §1 — One shared blanket (complete)
`src/components/CinematicStage.tsx`. One outline path `QUILT_TOP`, authored once and
referenced three times: `data-node="quilt-back"` (behind the bears) and the front
`data-node="quilt"` group, which is wrapped in `clipPath="url(#quilt-front-clip)"`
covering only the region below the chests. Same geometry ⇒ provably continuous
fabric. Padded crests, diamond stitching, heart embroidery at `M1452 952`, rolled
hem across both bodies. No second cloth, no triangular overlay.

### §2 — Bed sleeping positions (complete)
`src/world/actions.ts` + `src/stage/explore/characterStage.ts`.
Mattress-relative placement along the bed's **length** produces head-to-toe
separation; rotation sign is `mochi ? 1 : -1` and must not be flipped (the pivot is
at the feet). `lieDrop = lie * 26` in `characterStage.ts` puts the horizontal bodies
on the quilt instead of hovering.

Final poses — lie: mochi `{yaw:96, seated:1, lie:1, x:544, z:-128}`,
yume `{yaw:84, seated:1, lie:1, x:640, z:100, expression:"sleepy"}`;
rest: mochi `{…x:550, z:-118, lie:0.55}`, yume `{…x:636, z:92, lie:0.4}`.

### §3 — State isolation (fixed at source)
`UserIntent { weather, atmosphere }` in `src/world/state.ts`; `setWeather` /
`setAtmosphere` stamp it; `adoptEnvironment` writes a field only when its flag is
false. `App.tsx` dispatches exactly one `adopt-environment` with deps `[engine]`.
Not reproducible through any UI control (12-control probe preserved state).

### §4 — Rain, clouds, curtain occlusion (complete)
Three real defects found and fixed:

1. **Clouds never drawn.** Sky panes are flat gradient faces; `world.weather.clouds`
   existed only in state. Added `drawClouds()` in `src/stage/explore/weather.ts` —
   cumulus built from overlapping lobes with a flat base and a domed crown, three
   depth bands. Drawn **lighter** than the sky, which is what makes them legible at
   night; moonlit crown pass on top.
2. **Weather painted over the curtains.** The weather canvas is a 2D overlay above
   the whole room, so anything inside the pane rects also lands on fabric hanging in
   front of the glass. `curtainPanels()` was extracted from `scene.ts` so
   `projectWindow()` can return the curtain footprint, and the painter erases it
   with `destination-out`.
3. **Unbalanced canvas state.** `drawClouds` called `ctx.restore()` one more time
   than it called `ctx.save()`, popping the caller's clip — which is why the rain
   pass painted unclipped past the glass onto the curtains and wall. Save/restore is
   now balanced per crown pass and nowhere else.

`projectWindow()` also returns per-pane rects (`WindowRect.panes`) so the clip is the
glass, never the opening's bounding box (which includes mullions and wall reveal).

Verified: rain streaks inside the glass only; clouds visible at night; snow; open
curtains reveal the exterior; closed curtains occlude it with only the intentional
central gap.

### §5 — Dance ↔ music (complete)
`ExploreStageProps.onEnsureMusic?(): Promise<boolean>` + `musicPlaying?`.
Dance click dispatches `dance: on` immediately, then awaits the callback. `App.tsx`
`ensureMusic` short-circuits when `status === "playing"`, calls `controller.play()`,
and `seek(0)` only if the track had ended — one `AudioController`, one audio element,
never a second player. On refusal the room says so rather than pretending.

**Additional fix found while verifying:** stopping the dance wrote
`phase: "release"`, but `phase` is re-derived from `progress` every tick, so the next
frame recomputed it to `hold` and the pair danced forever. Added an independent
`InteractionState.release` clock (0..1, `null` = not stopping) that `stepInteraction`
advances; when it lands the interaction clears to `createInteractionState()`.

Verified: `before dance {paused:true}` → `after {paused:false, srcs:1}`; stop →
`phase:"release"` → `idle` within 1.4 s.

**Deliberately NOT changed:** reaching `progress >= 1` still holds the final pose.
That is the designed ending for both hugs and dance (the brief asks for a "lovely
final pose"), and `tests/interaction.unit.test.ts` asserts it. Clearing on natural
end was tried and reverted.

### §6 — Glass-globe showpiece (complete)
`src/components/GlassBubble.tsx` + `src/styles.css` + `bubbleGeometry()` in
`CinematicStage.tsx`.

- **Base added.** `.bubble-base` — lipped top, tapered body, flared foot — all sized
  from `--bubble-r`. Opaque gradients: an earlier translucent version let the floor
  and rug show straight through, destroying the one illusion the ending depends on.
- **Wordmark moved onto the base.** It was inside `.bubble-orb`, which laid OMJ over
  the room the ending had just revealed. `OMJ` primary (Georgia, tracked, glow),
  `HASSAAN FISKY` secondary engraved beneath. Four `<Kiss/>` accents around the J.
  No ® anywhere.
- **Two-axis fit.** `radiusPx = Math.min(w * 0.49, h * 0.38)` so the dome *plus*
  plinth fits every aspect. Measured circular at 390×844, 1024×768, 1920×1080
  (orb width === height exactly in all three).
- **Key sheen softened** (0.5 → 0.26 alpha, narrower) — it was reading as a blurred
  white blob rather than a reflection. The redundant second glint was removed.
- **Stale CSS removed.** A duplicate `.bubble-mark` / `.bubble-mark-word` block from
  the old in-orb placement was still in `styles.css` and was overriding the new one,
  offsetting the wordmark 93 px off-centre.

Sequence (unchanged): lyric "Orh bethein razaai…" at 142–148 s → reveal at 148 s →
single continuous camera pull-back to 0.62 → wide shot breathes to 0.76 → glass forms
to 1.0 (≈158 s). No furniture fades, nothing scales, only camera and glass.

### §7 / §8 — Preserved and inspected
Explore architecture, camera orbit, mirror, lamps, hug, curtains, bed controls,
cinematic storyline, lyric typography, music controls, responsive layouts all intact
— confirmed by the 50/50 layout suite and the screenshots listed below. No new
dependencies. Implemented in real code, verified in the preview.

---

## Screenshots (this pass, `/tmp/shots/`)

| File | Shows |
| --- | --- |
| `w3-halfopen-rain.png` | rain + clouds on glass only, curtains opaque |
| `w3-open-rain.png` | curtains open, full exterior |
| `w3-closed-rain.png` | closed curtains occluding, central gap only |
| `wx-cloudy-night.png` | clouds at night |
| `w4-snow-day.png` | snow, day |
| `canvas-dump2.png` | weather canvas in isolation, clipped to glass |
| `globe-v1.png`, `globe-phone.png`, `globe-wide.png`, `globe-tablet.png` | keepsake with base + both marks |
| `fin-148.png`, `fin-156.png` | reveal pull-back |
| `bed-lie.png` | two separate sleepers |
| `q3-156.png` | single shared quilt |
| `dance-audio.png` | dance with "Stop dancing" toggle |

## Probes

`.arena/wx.mjs`, `wx2.mjs`, `wx3.mjs`, `wx4.mjs`, `dump2.mjs` (weather);
`.arena/fin2.mjs`, `fin3.mjs`, `measure.mjs` (globe geometry + box metrics);
`.arena/danceprobe.mjs`, `danceend.mjs`, `danceaudio.mjs` (dance state + audio);
`.arena/bed2.mjs`, `q3.mjs`, `zoom.mjs` (bed + quilt).

## If work resumes

Everything in the brief is implemented and gated. Remaining work is only the
user's own review pass. Do **not** commit, push, merge or deploy until asked.
