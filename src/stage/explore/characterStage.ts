/**
 * Explore-mode character staging.
 *
 * The plush rigs, their rigging and expression vocabulary are reused verbatim
 * from the cinematic film. This module only decides *where* they stand and
 * *what pose* the world state implies, then hands that to the same
 * `createBearPainter` used by the film so identities never drift.
 */

import { BED_SURFACE_Y } from "../../world/actions";
import type { CharacterState, GazeTarget, WorldState } from "../../world/state";
import { bedTargets, hugPosture, hugTargets } from "./choreography";
import type { Pose } from "../../timeline/scenes";
import type { Camera3D } from "./renderer";
import { project } from "./renderer";
import { CHARACTER_ANCHORS, type Vec3 } from "./scene";

/**
 * Room-world units per rig local unit.
 *
 * The rig is ~296 local units tall, so this makes the plushies about 355 world
 * units high: they sit comfortably below the 640-unit wainscot rail and read as
 * hand-sized companions on a real rug rather than towering over the furniture.
 * The previous value (0.82) put their heads above the window sill and pushed
 * their feet into the command bar.
 */
export const CHARACTER_SCALE = 1.2;
/** Local Y of the rig's feet relative to its root origin. */
const FOOT_OFFSET = 66;

export interface CharacterPlacement {
  id: "mochi" | "yume";
  /** Screen-space anchor for the rig root. */
  screenX: number;
  screenY: number;
  /** Pixels per rig local unit. */
  pixelScale: number;
  depth: number;
  visible: boolean;
  /** Screen-space character height in pixels (for hotspot sizing). */
  heightPx: number;
}

export function poseFor(state: CharacterState, time: number, reduced: boolean): Pose {
  const expression = resolveExpression(state);

  return {
    x: 0,
    y: 0,
    scale: 1,
    rotation: reduced ? 0 : Math.sin(time * 0.55 + (state.gaze === "yume" ? 1.4 : 0)) * 0.9,
    alpha: 1,
    head: expression.head + (reduced ? 0 : Math.sin(time * 0.42) * 1.2),
    look: expression.look,
    lookY: expression.lookY,
    sad: expression.sad,
    smile: expression.smile,
    closed: expression.closed,
    tear: 0,
    sit: 0,
    kneel: 0,
    walk: 0,
    nervous: 0,
    back: 0,
    kissMark: 0,
    leftX: -54,
    leftY: -26,
    rightX: 54,
    rightY: -26,
  };
}

interface ResolvedExpression {
  head: number;
  look: number;
  lookY: number;
  sad: number;
  smile: number;
  closed: number;
}

function resolveExpression(state: CharacterState): ResolvedExpression {
  const base: ResolvedExpression = {
    head: 0,
    look: 0,
    lookY: 0,
    sad: 0,
    smile: 0.25,
    closed: 0,
  };

  switch (state.expression) {
    case "happy":
      return { ...base, smile: 0.85, head: 3, lookY: -1 };
    case "curious":
      return { ...base, smile: 0.42, head: 7, lookY: -3, look: 2 };
    case "sleepy":
      return { ...base, smile: 0.32, closed: 0.86, head: 5, lookY: 3 };
    case "shy":
      return { ...base, smile: 0.45, sad: 0.12, head: -5, lookY: 2 };
    case "warm":
      return { ...base, smile: 0.72, closed: 0.22, head: 2 };
    default:
      return base;
  }
}

const GAZE_OFFSETS: Record<GazeTarget, { look: number; lookY: number }> = {
  viewer: { look: 0, lookY: 0 },
  mochi: { look: -4.4, lookY: 0.6 },
  yume: { look: 4.4, lookY: 0.6 },
  window: { look: 1.6, lookY: -4.6 },
  globe: { look: 4, lookY: 2.2 },
  lamp: { look: -4, lookY: -1.4 },
  none: { look: 0, lookY: 1.2 },
};

/** Blends the authored gaze into the pose, in rig-local eye units. */
export function applyGaze(pose: Pose, state: CharacterState): Pose {
  const target = GAZE_OFFSETS[state.gaze];
  return {
    ...pose,
    look: pose.look + target.look,
    lookY: pose.lookY + target.lookY,
  };
}

/**
 * Arm choreography. Impulses are state, not CSS animation, so a wave always
 * completes even if the user clicks repeatedly, and reduced-motion users get a
 * still, raised paw instead of a flicker.
 */
export function applyGesture(pose: Pose, state: CharacterState, time: number, reduced: boolean): Pose {
  if (state.waveImpulse <= 0.01) return pose;

  const lift = state.waveImpulse;
  const swing = reduced ? 0 : Math.sin(time * 9.5) * 16;

  return {
    ...pose,
    rightX: 54 + lift * (36 + swing * 0.55),
    rightY: -26 - lift * 96,
    smile: Math.max(pose.smile, 0.6),
  };
}

/**
 * Resolve the full pose + placement for both plushies.
 *
 * This is the only place exploration decides where a body is and what it is
 * doing, and it derives everything from `world` — the engine has already
 * advanced the interaction clock, so a hug that is 40% through its approach is
 * painted exactly 40% through its approach. No component keeps a second copy of
 * "is hugging" or "how far".
 */
export function framesFor(
  world: WorldState,
  camera: Camera3D,
  time: number,
  reduced: boolean,
): CharacterFrame[] {
  const interaction = world.interaction;
  const hugging = interaction.kind === "hug";
  const onBed = interaction.kind === "bed";

  const posture = hugging ? hugPosture(world, interaction.progress, time, reduced) : null;
  const bed = onBed ? bedTargets(world, interaction.progress) : null;
  const feet = hugging ? hugTargets(world, interaction.progress) : null;

  return (["mochi", "yume"] as const).map((id) => {
    const state = world.characters[id];
    const placement = placeCharacter(camera, id, world);

    let pose = poseFor(state, time, reduced);
    pose = applyGaze(pose, state);
    pose = applyGesture(pose, state, time, reduced);

    // ── two-body hug posture ──────────────────────────────────────────────
    if (posture) {
      const paws = posture.paws[id];
      const rest = { left: [-54, -26] as const, right: [54, -26] as const };

      // Look at the partner, not past them: the rig blends by yaw, so a slight
      // inward look keeps the eyes on the other face as the bodies turn.
      pose.head += posture.headTilt;
      pose.closed = Math.max(pose.closed, posture.closed);
      pose.smile = Math.max(pose.smile, 0.55);
      pose.rotation += posture.sway;
      pose.leftX = paws.left[0];
      pose.leftY = paws.left[1];
      pose.rightX = paws.right[0];
      pose.rightY = paws.right[1];

      // Plush compression: the body squashes where it meets the partner and the
      // head settles down onto the partner's shoulder. Applied to the rig's own
      // scale so the shadow and the reflection follow it.
      // Plush compression: the body lifts and settles a fraction as it presses
      // against the partner. `Pose` only carries a uniform scale, so the squash
      // is expressed as a small body lift plus a head settle — which is what
      // reads on a soft plush anyway.
      const press = posture.press;
      if (press > 0.001) {
        pose.y += press * 5;
        pose.head += press * 4;
      }
      void rest;

      // The reunion lift: a real small hop that returns to the floor.
      pose.y -= posture.lift;

      // Weight shift: leaning into the partner moves the body centre sideways,
      // which is what sells contact instead of two mannequins placed side by side.
      pose.x += (id === "mochi" ? 1 : -1) * posture.lean * 6;
    }

    // ── bed posture ──────────────────────────────────────────────────────
    if (bed) {
      const seat = bed[id];
      pose.sit = seat.seated;
      pose.kneel = 0;
      pose.y = -seat.settle;
      // Reclining rotates the body about its own hips so the plush lies along
      // the mattress instead of sinking through it. 74° is a plush settling
      // onto its side — the previous 34° read as "leaning back", which is why
      // "Lie down" looked like standing on the bed.
      pose.rotation += (id === "mochi" ? 1 : -1) * seat.lie * 74;
      pose.head += seat.lie * -6;
      pose.closed = Math.max(pose.closed, seat.lie * 0.5);
      if (seat.lie > 0.2) pose.smile = Math.max(pose.smile, 0.4);
    }

    // A gentle bounce on a wave impulse only — never on an interaction, where
    // the choreography owns the vertical.
    if (state.bounce > 0.01 && !reduced && !posture && !bed) {
      pose.y -= Math.abs(Math.sin(time * 6)) * 10 * state.bounce;
    }

    void feet;
    return { id, placement, pose, yaw: state.yaw };
  });
}

/**
 * Idle life, measured in world units and applied behind the interaction layer.
 *
 * Kept deliberately small and *non-repeating*: two incommensurate sine periods
 * mean the pair never falls into a visible loop, which is the difference
 * between "breathing" and "bobbing on a cycle".
 */
export function idleBreathe(time: number, seed: number, reduced: boolean): number {
  if (reduced) return 0;
  return (Math.sin(time * 0.63 + seed) * 0.6 + Math.sin(time * 0.41 + seed * 2.1) * 0.35) * 0.9;
}

/** On-bed seat height in world units, derived from the real mattress geometry. */
export function bedSeatWorldY(seated: number, lie: number): number {
  return BED_SURFACE_Y + seated * 0 + lie * 0;
}

export function placeCharacter(
  camera: Camera3D,
  id: "mochi" | "yume",
  world?: WorldState,
): CharacterPlacement {
  const anchor = world ? world.characters[id] : undefined;
  const home = CHARACTER_ANCHORS[id];
  const x = anchor ? anchor.x : home.x;
  const z = anchor ? anchor.z : home.z;

  // Seating raises the root by the mattress height so the legs fold onto the
  // quilt rather than through the frame; lying lowers it back by the plush's
  // own half-depth so the body rests *on* the surface.
  /*
   * Seating maths, in world units.
   *
   * The rig's origin sits at its feet, and `placeCharacter` already raises it by
   * `FOOT_OFFSET * CHARACTER_SCALE` so the feet land on the floor. Sitting on
   * the mattress therefore must *not* add the mattress height on top of that —
   * doing so lifted the pair into the air above the bed. What matters is where
   * the hips land: the rig's hip pivot is at local y ≈ +4, i.e. just below the
   * origin once scaled, so the root belongs at `mattress − hipOffset`.
   */
  const standingRootY = FOOT_OFFSET * CHARACTER_SCALE;
  const hipLocal = 4 * CHARACTER_SCALE;
  const seatedRootY = BED_SURFACE_Y - hipLocal;

  const seatLift = anchor ? anchor.seated * (seatedRootY - standingRootY) : 0;
  // Lying settles a little lower again, so the body rests on the quilt instead
  // of hovering a hand's width above it.
  const lieDrop = anchor ? anchor.lie * 12 : 0;

  const rootWorld: Vec3 = {
    x,
    y: standingRootY + seatLift - lieDrop,
    z,
  };

  const projected = project(rootWorld, camera);
  const pixelScale = projected.visible ? projected.scale * CHARACTER_SCALE : 0;

  return {
    id,
    screenX: projected.x,
    screenY: projected.y,
    pixelScale,
    depth: projected.depth,
    visible: projected.visible,
    heightPx: 296 * pixelScale,
  };
}

export function shadowMarkup(placement: CharacterPlacement, alpha = 0.3): string {
  const rx = 62 * placement.pixelScale;
  const ry = 16 * placement.pixelScale;
  return `<ellipse cx="${placement.screenX.toFixed(1)}" cy="${placement.screenY.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#0b0813" opacity="${alpha.toFixed(2)}" />`;
}

export interface CharacterFrame {
  id: "mochi" | "yume";
  placement: CharacterPlacement;
  pose: Pose;
  /** Yaw handed to the painter so 3D turning matches the plush rig's blending. */
  yaw: number;
}

export function warmthFor(world: WorldState): number {
  if (world.time.daylight > 0.7) return 0.24;
  return 0.3 + Math.min(0.45, world.lamp.kerosene * 0.34);
}
