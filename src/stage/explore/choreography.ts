/**
 * Two-body choreography for exploration mode.
 *
 * The brief for a hug is a *sequence*, not a toggle: notice → eyes → turn →
 * step in with a real foot placement → arms rise and reach around → hands make
 * contact with back and shoulders → the pair settles into contact → heads rest →
 * hold, breathing and swaying. That cannot be expressed as "set yaw, add a
 * bounce", which is what the previous implementation did.
 *
 * Design rules enforced here:
 *  1. One clock. `progress` (0..1) is advanced by the engine; every body offset
 *     is a pure function of it. There is no second animation timeline.
 *  2. Nothing teleports. The approach interpolates the *footprint* stored in
 *     `CharacterState.x/z`, so the shadow, the reflection and the occlusion all
 *     agree with the visible body.
 *  3. Contact is measured, not guessed. The meeting point and per-preset arm
 *     reach are authored so the hands land on the partner's back, and the body
 *     compresses rather than intersecting.
 *  4. It completes and stays. The hold does not auto-cancel; `neutral` is the
 *     only thing that un-hugs, and it does so through the release phase.
 */

import {
  BED_ACTIONS,
  HUG_MEETING,
  HUG_SPECS,
  type HugSpec,
} from "../../world/actions";
import {
  INTERACTION_TIMING,
  type CharacterId,
  type CharacterState,
  type HugPreset,
  type InteractionPhase,
  type WorldState,
} from "../../world/state";

export type { CharacterId };

/** Cached because it is called per frame per character. */
const SPEC_CACHE = new Map<HugPreset, HugSpec>();

function specFor(preset: HugPreset | null): HugSpec {
  const key: HugPreset = preset ?? "gentle";
  let spec = SPEC_CACHE.get(key);
  if (!spec) {
    spec = HUG_SPECS[key];
    SPEC_CACHE.set(key, spec);
  }
  return spec;
}

const smoothstep = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** Ease-in-out with a longer tail: bodies decelerate into contact. */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const easeInOutCubic = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/**
 * Normalised band boundaries for the seven phases, derived from the authored
 * timing table. Computed once per kind.
 */
function bands(kind: "hug" | "bed") {
  const t = INTERACTION_TIMING[kind];
  const total = t.notice + t.turn + t.approach + t.contact + t.settle + t.hold + t.release;
  const n = t.notice / total;
  const tu = t.turn / total;
  const a = t.approach / total;
  const c = t.contact / total;
  const s = t.settle / total;
  const h = t.hold / total;
  return {
    total,
    noticeEnd: n,
    turnEnd: n + tu,
    approachEnd: n + tu + a,
    contactEnd: n + tu + a + c,
    settleEnd: n + tu + a + c + s,
    holdEnd: n + tu + a + c + s + h,
  };
}

export interface BodyTarget {
  x: number;
  z: number;
  yaw: number;
  /** 0..1 how much of the body's weight has shifted onto this interaction. */
  weight: number;
  seated: number;
  lie: number;
}

/**
 * The footprint and posture each body should have at a given interaction
 * progress. Pure; no side effects, no reads of mutable state outside `world`.
 */
export function hugTargets(
  world: WorldState,
  progress: number,
): Record<CharacterId, BodyTarget> {
  const spec = specFor(world.interaction.preset);
  const b = bands("hug");
  const p = Math.max(0, Math.min(1, progress));

  // The approach begins after the turn and completes when the arms start to
  // rise. The footprints must be still *before* contact: if the step finishes
  // while the arms are already closing, the hug reads as a grab mid-stride, and
  // the hands visibly travel with the body instead of landing on a planted
  // partner.
  const approach = easeInOutCubic(
    (p - b.turnEnd) / Math.max(1e-4, b.approachEnd - b.turnEnd),
  );
  const reachIn = smoothstep((p - b.approachEnd) / Math.max(1e-4, b.contactEnd - b.approachEnd));
  const settle = smoothstep((p - b.contactEnd) / Math.max(1e-4, b.settleEnd - b.contactEnd));

  const meet = HUG_MEETING;
  // Each preset owns how close the pair gets. A wave holds its ground; an
  // embrace closes to belly contact. Without this every preset ended in the
  // same silhouette regardless of what the arms were doing.
  const halfSpacing = (meet.spacing * spec.approach) / 2;
  const halfStagger = meet.stagger / 2;

  // `legacy`: the hug is a *shared* pose, so the pair closes to the authored
  // meeting point rather than each hunting its own target.
  const mochiHome = { x: world.characters.mochi.x, z: world.characters.mochi.z };
  const yumeHome = { x: world.characters.yume.x, z: world.characters.yume.z };

  // Approached on a shallow diagonal so neither body occludes the other's face.
  const mochiX = lerp(mochiHome.x, meet.x - halfSpacing, approach);
  const yumeX = lerp(yumeHome.x, meet.x + halfSpacing, approach);
  const mochiZ = lerp(mochiHome.z, meet.z + halfStagger, approach);
  const yumeZ = lerp(yumeHome.z, meet.z - halfStagger, approach);

  // Weight: 0 at the start, 1 once contact is made; used by the renderer to
  // lean the bodies into each other and to compress the plush silhouette.
  const weight = clamp01(reachIn * 0.7 + settle * 0.3);

  return {
    mochi: {
      x: mochiX,
      z: mochiZ,
      yaw: -spec.yaw * easeOutCubic((p - b.noticeEnd) / Math.max(1e-4, b.approachEnd - b.noticeEnd)),
      weight,
      seated: 0,
      lie: 0,
    },
    yume: {
      x: yumeX,
      z: yumeZ,
      yaw: spec.yaw * easeOutCubic((p - b.noticeEnd) / Math.max(1e-4, b.approachEnd - b.noticeEnd)),
      weight,
      seated: 0,
      lie: 0,
    },
  };
}

export interface HugPosture {
  /** Extra lift of the body (world units): the reunion hop, the settle drop. */
  lift: number;
  /** 0..1 forward lean into the partner. */
  lean: number;
  /** 0..1 how compressed the plush is against the partner. */
  press: number;
  /** Degrees of head tilt (positive = toward partner). */
  headTilt: number;
  /** 0..1 shared sway, unitless — the caller multiplies by time. */
  sway: number;
  /** 0..1 how closed the eyes are. */
  closed: number;
  /** Rig-local paw targets, already blended from the neutral rest pose. */
  paws: {
    mochi: { left: [number, number]; right: [number, number] };
    yume: { left: [number, number]; right: [number, number] };
  };
  /** 0..1 how much the arms are "in the hug" (drives the elbow bend). */
  wrap: number;
}

const REST_PAWS = {
  mochi: { left: [-54, -26] as [number, number], right: [54, -26] as [number, number] },
  yume: { left: [-54, -26] as [number, number], right: [54, -26] as [number, number] },
};

/**
 * Posture at a given progress.
 *
 * Note the deliberate *anticipation*: the heads tilt a fraction before the arms
 * close (`reach - 0.12`), which is what makes the movement read as intention
 * rather than mechanism.
 */
export function hugPosture(
  world: WorldState,
  progress: number,
  time: number,
  reduced: boolean,
): HugPosture {
  const spec = specFor(world.interaction.preset);
  const b = bands("hug");
  const p = Math.max(0, Math.min(1, progress));

  const reach = smoothstep((p - b.approachEnd) / Math.max(1e-4, b.contactEnd - b.approachEnd));
  const settle = smoothstep((p - b.contactEnd) / Math.max(1e-4, b.settleEnd - b.contactEnd));
  const release = smoothstep((p - b.holdEnd) / Math.max(1e-4, 1 - b.holdEnd));
  // Anticipation: the head starts leaning a little before the arms commit.
  const anticipation = smoothstep(
    (p - (b.turnEnd - 0.04)) / Math.max(1e-4, b.contactEnd - b.turnEnd + 0.04),
  );

  const held = reach * (1 - release);
  const wrap = held * spec.reach;

  // A short lift during "reunion" is the only time a body leaves the ground,
  // and it returns to zero before the hold — no floating hugs.
  const liftEnvelope =
    Math.sin(Math.PI * clamp01((p - b.contactEnd) / Math.max(1e-4, b.settleEnd - b.contactEnd))) *
    spec.press;
  const lift =
    spec.reach > 1.1 && !reduced ? liftEnvelope * 12 : 0;

  // Breathing while held: slow, small, and it stops when the interaction ends.
  const breathe = reduced ? 0 : Math.sin(time * 1.6) * 1.1 * held;

  const swayPhase = reduced ? 0 : Math.sin(time * 0.9) * spec.sway * 2.4 * settle * (1 - release);

  const blendPaw = (
    rest: [number, number],
    target: [number, number],
    amount: number,
  ): [number, number] => [
    lerp(rest[0], target[0], amount),
    lerp(rest[1], target[1], amount) + breathe * 0.6,
  ];

  return {
    lift,
    lean: spec.lean * anticipation,
    press: spec.press * held,
    headTilt: spec.lean * 9 * anticipation,
    sway: swayPhase,
    closed: Math.max(0, spec.lean) * anticipation * 0.55,
    wrap,
    paws: {
      mochi: {
        left: blendPaw(REST_PAWS.mochi.left, spec.hands.mochi.left, wrap),
        right: blendPaw(REST_PAWS.mochi.right, spec.hands.mochi.right, wrap),
      },
      yume: {
        left: blendPaw(REST_PAWS.yume.left, spec.hands.yume.left, wrap),
        right: blendPaw(REST_PAWS.yume.right, spec.hands.yume.right, wrap),
      },
    },
  };
}

export interface BedPosture {
  seated: number;
  lie: number;
  x: number;
  z: number;
  /** 0..1 the small "settle" dip after sitting down. */
  settle: number;
}

/**
 * Bed choreography.
 *
 * The seated/lie values and the *footprint* are eased over the same clock, so
 * there is never a frame where the body is upright but already inside the
 * mattress. A settle dip lands the weight on the quilt once seated.
 */
export function bedTargets(
  world: WorldState,
  progress: number,
): { mochi: BedPosture; yume: BedPosture } {
  const b = bands("bed");
  const p = Math.max(0, Math.min(1, progress));
  const target = BED_ACTIONS[world.interaction.bedPose ?? "sit"];

  const move = easeInOutCubic((p - b.turnEnd) / Math.max(1e-4, b.settleEnd - b.turnEnd));
  const settle = smoothstep((p - b.contactEnd) / Math.max(1e-4, b.settleEnd - b.contactEnd));
  const unwind = smoothstep((p - b.holdEnd) / Math.max(1e-4, 1 - b.holdEnd));

  // One soft dip on landing, then nothing: no looping bounce.
  const bob = Math.sin(Math.PI * settle) * 5 + settle * 2;

  // The bed pose is *held*: the release band is the only thing that lifts the
  // body back up, and only `rise` is allowed to do that.
  const keep = 1;

  return {
    mochi: {
      seated: target.mochi.seated * move,
      lie: target.mochi.lie * move,
      x: lerp(world.characters.mochi.x, target.mochi.x, move),
      z: lerp(world.characters.mochi.z, target.mochi.z, move),
      settle: bob * (1 - unwind) * keep,
    },
    yume: {
      seated: target.yume.seated * move,
      lie: target.yume.lie * move,
      x: lerp(world.characters.yume.x, target.yume.x, move),
      z: lerp(world.characters.yume.z, target.yume.z, move),
      settle: bob * (1 - unwind) * keep,
    },
  };
}

/** Which phase a progress value maps to. Mirrors `phaseForProgress`. */
export function phaseAt(kind: "hug" | "bed", progress: number): InteractionPhase {
  const b = bands(kind);
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return "idle";
  if (p < b.noticeEnd) return "notice";
  if (p < b.turnEnd) return "turn";
  if (p < b.approachEnd) return "approach";
  if (p < b.contactEnd) return "contact";
  if (p < b.settleEnd) return "settle";
  if (p < b.holdEnd) return "hold";
  return "release";
}

/** Seconds an interaction lasts, used by the engine and the tests. */
export function durationFor(kind: "hug" | "bed"): number {
  return bands(kind).total;
}

/** Screen-space "look here" hint targets while an interaction is running. */
export function gazeDuring(kind: "hug" | "bed"): {
  mochi: CharacterState["gaze"];
  yume: CharacterState["gaze"];
} {
  return kind === "hug"
    ? { mochi: "yume", yume: "mochi" }
    : { mochi: "viewer", yume: "viewer" };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
