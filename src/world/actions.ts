/**
 * World action contract.
 *
 * Every displacement of world state is expressed as one of these serialisable
 * actions. The natural-language layer, the contextual hotspots and the
 * keyboard shortcuts all emit the same actions — the reducer is the only place
 * that mutates state, so behaviour stays deterministic and unit-testable.
 */

import { insideObstacle } from "../stage/explore/scene";
import {
  atmosphereForDaylight,
  CAMERA_LIMITS,
  cloneWorldState,
  daylightForAtmosphere,
  IDLE_INTERACTION,
  ORBIT_FOCUS,
  interactionDuration,
  phaseForProgress,
  ROOM_BOUNDS,
  type Atmosphere,
  type CharacterState,
  type GazeTarget,
  type HugPreset,
  type WeatherCondition,
  type WorldState,
} from "./state";

export type CharacterId = "mochi" | "yume";
export type Who = CharacterId | "both";

export type Expression = CharacterState["expression"];

export interface CameraPreset {
  yaw: number;
  pitch: number;
  distance: number;
}

/**
 * Authored camera framings.
 *
 * These are derived from the subjects' world positions relative to
 * `ORBIT_FOCUS`, not from the room centre: orbiting a pivot near the window
 * means a yaw that used to frame the bed now looks at the wall. Each entry was
 * re-solved against the actual furniture geometry, and each is checked by a
 * unit test that it resolves at (close to) its authored radius and never inside
 * an obstacle.
 */
export const CAMERA_PRESETS: Record<
  | "window"
  | "bed"
  | "bedAction"
  | "vanity"
  | "bookshelf"
  | "lamp"
  | "globe"
  | "mochi"
  | "yume"
  | "overview",
  CameraPreset
> = {
  overview: { yaw: 0, pitch: 6, distance: 560 },
  window: { yaw: -2, pitch: 8, distance: 470 },
  /*
   * Two framings, because the plushies move and no single pose serves both.
   *
   * `bed` is the chip and the "show me the bed" intent: shot wide from the
   * foot of the bed so the frame, mattress and headboard all read, with the
   * pair small in the foreground where they stand at home.
   *
   * `bedAction` is used once they are actually on the quilt. They walk to
   * x ≈ 600 — right beside the bed — so the camera has to come round toward
   * the bed's own side and lift over the mattress (~190 high) to keep both
   * faces clear of it. That angle cannot also frame the whole bed from the
   * room; it is a close two-shot on the quilt, which is what the action is
   * about.
   *
   * A single preset was tried and failed visibly in both directions: the wide
   * angle cut the pair in half at the frame edge, the close angle cropped the
   * bed. Two named poses, chosen by state, is the honest model.
   */
  bed: { yaw: -156, pitch: 22, distance: 680 },
  bedAction: { yaw: -148, pitch: 16, distance: 370 },
  vanity: { yaw: 102, pitch: 6, distance: 470 },
  // The shelf wall is close behind the pivot: 276 is the longest radius the
  // wall allows at this bearing, so asking for more would push through it.
  bookshelf: { yaw: 155, pitch: 5, distance: 270 },
  lamp: { yaw: 100, pitch: 2, distance: 330 },
  globe: { yaw: -132, pitch: -4, distance: 330 },
  mochi: { yaw: 93, pitch: -2, distance: 330 },
  yume: { yaw: -86, pitch: -2, distance: 330 },
};

export const LIGHT_SOURCES = ["lamp", "cove", "candle", "fairies", "window"] as const;
export type LightSource = (typeof LIGHT_SOURCES)[number];

/** Where each plushie stands when nothing is happening. */
export const HOME = {
  mochi: { x: -230, z: -320, yaw: -8 },
  yume: { x: 215, z: -345, yaw: 10 },
} as const;

/**
 * Where the two bodies meet during a hug.
 *
 * Authored as one meeting point rather than two independent targets, so the
 * pair cannot drift apart over repeated actions: both approach the same x, on
 * the rug, at a spacing that leaves the plush bellies just touching (the body is
 * ~150 world units wide at scale 1.2, so 78 units of centre offset per bear
 * gives contact without interpenetration).
 */
export const HUG_MEETING = {
  x: -6,
  z: -330,
  /**
   * Centre offset along the meeting axis.
   *
   * Two bodies closer than this disappear into each other: the rig is ~136
   * local units wide, so at CHARACTER_SCALE a plush occupies ~163 world units.
   * 116 leaves the bellies touching while both faces still read.
   */
  spacing: 116,
  /**
   * Depth offset across the meeting axis.
   *
   * Without it the pair share a z plane and the near body paints over the far
   * one completely — Mochi vanished behind Yume in the first pass. Staggering
   * them 34 units apart in depth makes the hug read as two plushies turned
   * toward each other rather than one plushie with an ear behind it.
   */
  stagger: 34,
} as const;

export interface HugSpec {
  /** How far each body turns toward its partner, in degrees. */
  yaw: number;
  /**
   * How close the pair actually walk, as a multiple of HUG_MEETING.spacing.
   *
   * A hand-hold or a friendly wave must not close to embrace distance: the
   * gesture is defined by the *gap* as much as the arms. 1 is belly-to-belly;
   * 2 still leaves room for two outstretched paws between the bodies.
   */
  approach: number;
  expression: CharacterState["expression"];
  /** 0.7 gentle .. 1.2 enveloping: how far the arms reach around the body. */
  reach: number;
  /** -1..1 head tilt of the pair; +1 leans in for a forehead/nose rest. */
  lean: number;
  /** 0..1 how much of the plush body compresses against the partner. */
  press: number;
  /** 0..1 shared sway amplitude while held. */
  sway: number;
  /** Where the hands land, in rig-local units, per character. */
  hands: {
    mochi: { left: [number, number]; right: [number, number] };
    yume: { left: [number, number]; right: [number, number] };
  };
}

/**
 * The authored beat sheets.
 *
 * Each preset differs in *posture*, not just in a caption: `comforting` tucks
 * Yume's head down and Mochi's arms high over the shoulders, `shy` barely
 * closes the distance and keeps the paws low, `reunion` is a full wrap with a
 * lift, `sway` holds and rocks, `handhold` never wraps at all, `nosenose` stops
 * short of contact and presses foreheads, and `wave` is a friendly near-miss.
 */
export const HUG_SPECS: Record<HugPreset, HugSpec> = {
  gentle: {
    yaw: 52,
    approach: 1,
    expression: "warm",
    reach: 0.92,
    lean: 0.25,
    press: 0.35,
    sway: 0.32,
    // The near paw rides high across the partner's shoulder, the far paw tucks
    // lower at the waist. Two different heights is what reads as "around the
    // back" — targeting one point made both paws meet in front like clasped
    // hands, which is a different gesture entirely.
    hands: {
      mochi: { left: [60, -104], right: [26, -58] },
      yume: { left: [60, -104], right: [26, -58] },
    },
  },
  comforting: {
    yaw: 58,
    approach: 0.94,
    expression: "sleepy",
    reach: 1,
    lean: 0.62,
    press: 0.55,
    sway: 0.24,
    // Enveloping: the high paw reaches over the far shoulder, the low paw
    // settles at the small of the back, and Yume's head tucks down.
    hands: {
      mochi: { left: [66, -112], right: [30, -50] },
      yume: { left: [62, -74], right: [34, -96] },
    },
  },
  shy: {
    yaw: 34,
    approach: 1.5,
    expression: "shy",
    reach: 0.55,
    lean: -0.15,
    press: 0.15,
    sway: 0.12,
    // Barely any reach: the paws hover at the partner's sides without closing.
    hands: {
      mochi: { left: [34, -54], right: [12, -44] },
      yume: { left: [30, -52], right: [10, -42] },
    },
  },
  reunion: {
    yaw: 62,
    approach: 0.88,
    expression: "happy",
    reach: 1.16,
    lean: 0.45,
    press: 0.7,
    sway: 0.44,
    hands: {
      mochi: { left: [70, -116], right: [30, -64] },
      yume: { left: [70, -116], right: [30, -64] },
    },
  },
  sway: {
    yaw: 54,
    approach: 1.02,
    expression: "warm",
    reach: 0.98,
    lean: 0.3,
    press: 0.45,
    sway: 0.85,
    hands: {
      mochi: { left: [62, -100], right: [28, -58] },
      yume: { left: [62, -100], right: [28, -58] },
    },
  },
  handhold: {
    yaw: 40,
    approach: 1.8,
    expression: "happy",
    reach: 0.18,
    lean: 0,
    press: 0,
    sway: 0.18,
    hands: {
      // The inner paws meet in the middle at waist height; nothing wraps.
      mochi: { left: [-54, -26], right: [46, -40] },
      yume: { left: [46, -40], right: [-54, -26] },
    },
  },
  nosenose: {
    yaw: 48,
    approach: 1.22,
    expression: "warm",
    reach: 0.3,
    lean: 1,
    press: 0.2,
    sway: 0.1,
    hands: {
      mochi: { left: [42, -62], right: [18, -52] },
      yume: { left: [38, -60], right: [16, -50] },
    },
  },
  wave: {
    yaw: 22,
    approach: 2.1,
    expression: "happy",
    reach: 0,
    lean: -0.2,
    press: 0,
    sway: 0.1,
    hands: {
      mochi: { left: [-54, -26], right: [54, -26] },
      yume: { left: [-54, -26], right: [54, -26] },
    },
  },
};

export interface BedPose {
  mochi: { yaw: number; seated: number; lie: number; x: number; z: number };
  yume: { yaw: number; seated: number; lie: number; x: number; z: number; expression: CharacterState["expression"] };
}

/**
 * The bed's mattress top, in world units, read from the actual geometry in
 * `scene.ts` (mattress box is y 104..158, quilt 158..190, pillows 162..208).
 * Seating the body on 190 puts the seat exactly on the quilt with no sink.
 */
export const BED_SURFACE_Y = 190;

/**
 * Bed poses. `x`/`z` are the *footprint* on the mattress, derived from the bed
 * box (x 462..722, z −246..148). Sitting places the body near the near edge so
 * the legs hang off the side; lying centres it along the mattress.
 */
export const BED_ACTIONS: Record<"sit" | "lie" | "rest" | "together", BedPose> = {
  sit: {
    mochi: { yaw: 96, seated: 1, lie: 0, x: 600, z: 66 },
    yume: { yaw: 84, seated: 1, lie: 0, x: 612, z: -66, expression: "calm" },
  },
  lie: {
    mochi: { yaw: 96, seated: 1, lie: 1, x: 596, z: 60 },
    yume: { yaw: 84, seated: 1, lie: 1, x: 606, z: -62, expression: "sleepy" },
  },
  rest: {
    mochi: { yaw: 96, seated: 1, lie: 0.5, x: 598, z: 64 },
    yume: { yaw: 88, seated: 1, lie: 0.35, x: 610, z: -64, expression: "sleepy" },
  },
  together: {
    // Turned toward each other, shoulders almost touching: the pair sits as a
    // pair rather than as two separate profiles.
    mochi: { yaw: 120, seated: 1, lie: 0.15, x: 600, z: 44 },
    yume: { yaw: 60, seated: 1, lie: 0.15, x: 612, z: -44, expression: "warm" },
  },
};

export type WorldAction =
  | { id: string; type: "setMode"; mode: WorldState["mode"] }
  | { id: string; type: "setWeather"; condition: WeatherCondition; intensity?: number }
  | { id: string; type: "setAtmosphere"; atmosphere: Atmosphere }
  | { id: string; type: "setLamp"; kerosene?: number; kelvin?: number }
  | {
      id: string;
      type: "toggle";
      flag: "fairyLights" | "candle" | "cove" | "globeOpen" | "giftOpen";
    }
  | { id: string; type: "setCurtains"; open: number }
  | {
      id: string;
      type: "camera";
      preset?: keyof typeof CAMERA_PRESETS;
      yaw?: number;
      pitch?: number;
      distance?: number;
    }
  | { id: string; type: "wave"; who: Who }
  | { id: string; type: "look"; who: Who; at: GazeTarget }
  | { id: string; type: "express"; who: Who; expression: Expression }
  | {
      id: string;
      /**
       * Named two-body choreography. `preset` selects the authored beat sheet
       * ("gentle", "comforting", ...); omitting it keeps the last preset.
       */
      type: "hug";
      preset?: HugPreset;
    }
  | { id: string; type: "bed"; action: "sit" | "lie" | "rest" | "together" | "rise" }
  | {
      id: string;
      /**
       * Discrete light control. `source` names a real light in the rig, so the
       * HUD's on/off switch changes an actual light rather than a mood flag.
       */
      type: "light";
      source: LightSource;
      on?: boolean;
      intensity?: number;
      warmth?: number;
    }
  | { id: string; type: "neutral" };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function withCharacter(
  state: WorldState,
  id: CharacterId,
  patch: Partial<CharacterState>,
): WorldState {
  return {
    ...state,
    characters: {
      ...state.characters,
      [id]: { ...state.characters[id], ...patch },
    },
  };
}

function forWho(
  state: WorldState,
  who: Who,
  patch: (character: CharacterState) => Partial<CharacterState>,
): WorldState {
  if (who === "both") {
    return forWho(forWho(state, "mochi", patch), "yume", patch);
  }
  return withCharacter(state, who, patch(state.characters[who]));
}

/**
 * Resolve an orbit request into a camera pose that is physically safe.
 *
 * Requirements this has to satisfy at once:
 *  - the camera must never sit inside a wall, the floor, the ceiling or a piece
 *    of furniture (that is what produced the "giant tan blob" orbit bug);
 *  - orbiting must not steadily zoom the room in. The first implementation
 *    stepped the radius inward until it was clear, which is a one-way ratchet:
 *    orbit past the bed once and the rest of the orbit is permanently closer;
 *  - low furniture should not steal the framing at all.
 *
 * So distance is preserved wherever possible and the camera is *lifted* over
 * low obstacles by raising the pitch. Only genuinely tall furniture (the
 * wardrobe-height vanity, bookcase and bedside lamp) can force a radius change,
 * and then only as far as that object needs.
 */
export interface CameraObstacle {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  pad: number;
  /** Pad the footprint only; keep the true height. See `characterObstacles`. */
  horizontalPadOnly?: boolean;
}

/**
 * The two plushies as camera obstacles.
 *
 * They stand in the middle of an orbit and are 355 world units tall, so at some
 * angles the camera passed within a hundred units of a face — the room vanished
 * behind a filling-screen bear. They are excluded from the *static* obstacle
 * table (which describes architecture and furniture) and supplied here instead,
 * from their live positions, so a hug that walks them across the rug is
 * respected too.
 */
export function characterObstacles(state: WorldState): CameraObstacle[] {
  const height = 355;
  const half = 62;
  /*
   * The pad is a framing distance: the lens is kept a comfortable distance from
   * a face rather than merely outside the body. 210 is the largest value that
   * still lets every authored camera preset resolve at its requested radius —
   * the lamp, globe and vanity shots all sit near the plushies, and a larger
   * pad silently collapsed every one of them to the minimum orbit.
   */
  const pad = 210;
  /*
   * The pad is horizontal only, and that distinction is load-bearing.
   *
   * Applying it to Y as well inflated each plushie into a 544 x 775 x 544
   * column — taller than the room. Every camera that had to look past the pair
   * to reach the furniture reported "inside a character", `resolveCameraPose`
   * fell through its lift/step-in loops to the degenerate minimum radius, and
   * the bed view ended up shot from 250 units out inside the bed frame. The
   * guard exists so the lens is not shoved into a face; a lens above a head,
   * looking down at the mattress, is not in a face. So keep the true body
   * height and pad only the horizontal footprint.
   */
  return (["mochi", "yume"] as const).map((id) => {
    const c = state.characters[id];
    return {
      min: { x: c.x - half, y: 0, z: c.z - half },
      max: { x: c.x + half, y: height, z: c.z + half },
      pad,
      horizontalPadOnly: true,
    };
  });
}

export function resolveCameraPose(
  yawDeg: number,
  requestedPitch: number,
  requestedDistance: number,
  extraObstacles: CameraObstacle[] = [],
): { pitch: number; distance: number } {
  const pitch = clamp(requestedPitch, CAMERA_LIMITS.pitch.min, CAMERA_LIMITS.pitch.max);
  const { min: minDistance } = CAMERA_LIMITS.distance;

  /*
   * Keep as much of the requested radius as the walls and floor allow.
   *
   * Note the ordering: the *wall* is the hard constraint, the minimum radius is
   * a preference. Applying the minimum last is what let the camera sit outside
   * the room whenever a wall was nearer than the floor value.
   */
  const wallLimit = cameraDistanceLimit(yawDeg, pitch);
  const distance = Math.max(
    Math.min(minDistance, wallLimit),
    Math.min(requestedDistance, wallLimit),
  );

  const blocked = (point: { x: number; y: number; z: number }) =>
    insideObstacle(point) ||
    extraObstacles.some((o) => {
      const padY = o.horizontalPadOnly ? 0 : o.pad;
      return (
        point.x > o.min.x - o.pad &&
        point.x < o.max.x + o.pad &&
        point.y > o.min.y - padY &&
        point.y < o.max.y + padY &&
        point.z > o.min.z - o.pad &&
        point.z < o.max.z + o.pad
      );
    });

  if (!blocked(positionFor(yawDeg, pitch, distance))) {
    return { pitch, distance };
  }

  // ── 1. Try lifting the camera over the obstacle ──────────────────────────
  // Raising the pitch swings the camera upward along its orbit. A low object
  // (the bed at 330, the chair at 430) is cleared this way with the radius
  // untouched, which is what keeps the room framed identically either side of
  // it. Up to the ceiling limit, in half-degree steps.
  for (let lifted = pitch; lifted <= CAMERA_LIMITS.pitch.max; lifted += 0.5) {
    const trial = clamp(
      requestedDistance,
      minDistance,
      Math.max(minDistance, cameraDistanceLimit(yawDeg, lifted)),
    );
    if (!blocked(positionFor(yawDeg, lifted, trial))) {
      return { pitch: lifted, distance: trial };
    }
  }

  // ── 2. Fall back to moving in, for wardrobe-height furniture ─────────────
  for (let r = distance; r >= minDistance; r -= 24) {
    if (!blocked(positionFor(yawDeg, pitch, r))) {
      return { pitch, distance: r };
    }
  }

  // A degenerate pose (the requested direction is inside a tall object at every
  // radius). Stay at the minimum radius, which is still inside the room.
  return { pitch, distance: minDistance };
}

/** Backwards-compatible helper used by tests: the safe radius only. */
export function clampCameraDistance(
  yawDeg: number,
  pitchDeg: number,
  distance: number,
): number {
  return resolveCameraPose(yawDeg, pitchDeg, distance).distance;
}

/*
 * ── The orbit's real geometry ───────────────────────────────────────────────
 *
 * Two things are easy to conflate here and they are *not* the same point:
 *
 *   • the camera swings around the room's vertical axis (x 0, z 0) at the
 *     radius the user asked for, and
 *   • the lens is always aimed at ORBIT_FOCUS, which is offset 330 units toward
 *     the window wall.
 *
 * So the pivot is the room axis, not the focus. `positionFor` used to add the
 * focus to X and Z as well, which described a sphere around ORBIT_FOCUS — a
 * camera the renderer never built. The wall solver then guarded the wrong
 * point in both directions: at yaw 0 it approved a radius that put the real
 * lens at z = +816, sixty units *through* the far wall, and at yaw 180 the
 * "safe" radius of 251 drove the real lens into the window wall. Both are
 * visible as walls vanishing or the room viewed from outside.
 *
 * `ORBIT_FOCUS` is still the aim point and still the vertical centre; only the
 * horizontal pivot is the room axis.
 */
export function positionFor(yawDeg: number, pitchDeg: number, distance: number): { x: number; y: number; z: number } {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  return {
    x: Math.sin(yaw) * Math.cos(pitch) * distance,
    y: ORBIT_FOCUS.y + Math.sin(pitch) * distance,
    z: Math.cos(yaw) * Math.cos(pitch) * distance,
  };
}

/** The wall/floor/ceiling radius limit at a given orbit angle. */
export function cameraDistanceLimit(yawDeg: number, pitchDeg: number): number {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const horizontal = Math.cos(pitch);

  /*
   * The camera swings around the room axis (see `positionFor`), so the room is
   * symmetric in X and Z and the limit in any direction is simply the distance
   * from that axis to the near wall along that ray. A previous version solved
   * against ORBIT_FOCUS, which matched neither the rendered camera nor the
   * room: it allowed the lens out through the far wall and, in the opposite
   * direction, allowed it into the window wall.
   */
  const xLimit = ROOM_BOUNDS.x - CAMERA_LIMITS.wallClearance;
  const zLimit = ROOM_BOUNDS.z - CAMERA_LIMITS.wallClearance;

  const dirX = Math.sin(yaw) * horizontal;
  const dirZ = Math.cos(yaw) * horizontal;
  const dirY = Math.sin(pitch);

  const limits: number[] = [CAMERA_LIMITS.distance.max];

  // Divide by |dirX|, never by the signed value: the signed form produced a
  // *negative* limit for half the orbit, which clamped everything to the
  // minimum radius.
  if (Math.abs(dirX) > 1e-4) limits.push(xLimit / Math.abs(dirX));
  if (Math.abs(dirZ) > 1e-4) limits.push(zLimit / Math.abs(dirZ));
  if (Math.abs(dirY) > 1e-4) {
    // Both terms are distances to a boundary, so both must be positive:
    // divide by |dirY| and pick the boundary the ray is actually heading for.
    const ceilingRoom = ROOM_BOUNDS.height - 90 - ORBIT_FOCUS.y;
    const floorRoom = ORBIT_FOCUS.y - 80;
    limits.push(
      (dirY > 0 ? ceilingRoom : floorRoom) / Math.abs(dirY),
    );
  }

  return Math.max(CAMERA_LIMITS.distance.min, Math.min(...limits));
}

/** Pure reducer. Returns a new state; never mutates the input. */
export function applyWorldAction(prev: WorldState, action: WorldAction): WorldState {
  const state = cloneWorldState(prev);

  switch (action.type) {
    case "setMode": {
      state.mode = action.mode;
      break;
    }

    case "setWeather": {
      const condition = action.condition;
      const intensity =
        condition === "rain" || condition === "snow"
          ? clamp(action.intensity ?? 0.85, 0.15, 1)
          : 0;
      state.weather = {
        condition,
        intensity,
        clouds:
          condition === "rain"
            ? clamp(0.55 + intensity * 0.45, 0, 1)
            : condition === "snow"
              ? clamp(0.4 + intensity * 0.4, 0, 1)
              : condition === "cloudy"
                ? 0.6
                : 0,
        wind: condition === "rain" ? 0.8 : condition === "snow" ? 0.5 : 0.32,
      };
      break;
    }

    case "setAtmosphere": {
      state.time = {
        atmosphere: action.atmosphere,
        daylight: daylightForAtmosphere(action.atmosphere),
      };
      break;
    }

    case "setLamp": {
      if (action.kerosene !== undefined) {
        state.lamp.kerosene = clamp(action.kerosene, 0, 1);
      }
      if (action.kelvin !== undefined) {
        state.lamp.kelvin = clamp(action.kelvin, 1800, 6500);
      }
      break;
    }

    case "toggle": {
      if (action.flag === "globeOpen" || action.flag === "giftOpen") {
        state.props = { ...state.props, [action.flag]: !state.props[action.flag] };
      } else {
        state.lamp = { ...state.lamp, [action.flag]: !state.lamp[action.flag] };
      }
      break;
    }

    case "setCurtains": {
      state.props = { ...state.props, curtainsOpen: clamp(action.open, 0, 1) };
      break;
    }

    case "camera": {
      const preset = action.preset ? CAMERA_PRESETS[action.preset] : undefined;
      const yaw = action.yaw ?? preset?.yaw ?? state.camera.yaw;
      const pitch = clamp(
        action.pitch ?? preset?.pitch ?? state.camera.pitch,
        CAMERA_LIMITS.pitch.min,
        CAMERA_LIMITS.pitch.max,
      );
      /*
       * The state stores the camera *intent*; the renderer resolves it into a
       * physically legal pose with `resolveCameraPose`.
       *
       * Writing the resolved pose back here was a ratchet: a lift over the bed
       * became the new requested pitch, so the camera never came back down and
       * every later orbit inherited the lift. Intent and constraint must stay
       * separate or the constraint accumulates.
       */
      state.camera = {
        yaw,
        pitch,
        distance: action.distance ?? preset?.distance ?? state.camera.distance,
      };
      break;
    }

    case "wave": {
      state.characters = {
        ...state.characters,
        mochi:
          action.who === "yume"
            ? state.characters.mochi
            : { ...state.characters.mochi, waveImpulse: 1, expression: "happy", gaze: "viewer" },
        yume:
          action.who === "mochi"
            ? state.characters.yume
            : { ...state.characters.yume, waveImpulse: 1, expression: "happy", gaze: "viewer" },
      };
      break;
    }

    case "look": {
      state.characters = forWho(state, action.who, () => ({
        gaze: action.at,
        desiredYaw:
          action.at === "viewer"
            ? 0
            : action.at === "window"
              ? 180
              : action.at === "mochi"
                ? 42
                : action.at === "yume"
                  ? -42
                  : 62,
      })).characters;
      break;
    }

    case "express": {
      state.characters = forWho(state, action.who, () => ({
        expression: action.expression,
      })).characters;
      break;
    }

    case "hug": {
      const preset: HugPreset = action.preset ?? state.interaction.preset ?? "gentle";
      const spec = HUG_SPECS[preset];
      state.interaction = {
        kind: "hug",
        preset,
        bedPose: null,
        progress: 0,
        elapsed: 0,
        phase: "notice",
      };
      // The *targets* are authoritative; the engine eases toward them, and
      // `hugChoreography` re-derives the reach/contact offsets from the single
      // progress clock. Nothing here teleports a body.
      state.characters = {
        mochi: {
          ...state.characters.mochi,
          desiredYaw: -spec.yaw,
          gaze: "yume",
          expression: spec.expression,
          seated: 0,
          lie: 0,
        },
        yume: {
          ...state.characters.yume,
          desiredYaw: spec.yaw,
          gaze: "mochi",
          expression: spec.expression,
          seated: 0,
          lie: 0,
        },
      };
      break;
    }

    case "bed": {
      // Sitting, lying and getting up are *positional* changes. They are
      // expressed as an interaction so the same clock that raises the body also
      // owns the pose, and so the plushies can never end up half inside the
      // mattress: the target pose is one authored value, `BED_POSES`.
      if (action.action === "rise") {
        state.interaction = { ...IDLE_INTERACTION };
        state.characters = {
          mochi: { ...state.characters.mochi, seated: 0, lie: 0, x: HOME.mochi.x, z: HOME.mochi.z },
          yume: { ...state.characters.yume, seated: 0, lie: 0, x: HOME.yume.x, z: HOME.yume.z },
        };
        break;
      }

      const spec = BED_ACTIONS[action.action];
      state.interaction = {
        kind: "bed",
        preset: null,
        bedPose: action.action,
        progress: 0,
        elapsed: 0,
        phase: "notice",
      };
      /*
       * Sitting or lying down also frames the shot. The pair has just walked
       * to x ≈ 600, beside the bed on the +X wall, so the wide "show me the
       * bed" camera would leave both of them cropped at the frame edge — the
       * close `bedAction` pose is the only one that keeps their faces clear of
       * a 190-high mattress. The user asked to see them on the bed; the camera
       * should be where that is visible.
       */
      state.camera = {
        yaw: CAMERA_PRESETS.bedAction.yaw,
        pitch: clamp(
          CAMERA_PRESETS.bedAction.pitch,
          CAMERA_LIMITS.pitch.min,
          CAMERA_LIMITS.pitch.max,
        ),
        distance: CAMERA_PRESETS.bedAction.distance,
      };
      state.characters = {
        mochi: {
          ...state.characters.mochi,
          expression: "sleepy",
          gaze: "viewer",
          desiredYaw: spec.mochi.yaw,
          bounce: 0,
        },
        yume: {
          ...state.characters.yume,
          expression: spec.yume.expression,
          gaze: action.action === "together" ? "mochi" : "viewer",
          desiredYaw: spec.yume.yaw,
          bounce: 0,
        },
      };
      break;
    }

    case "light": {
      const { source } = action;
      if (source === "lamp") {
        /*
         * Power and warmth are independent. This branch used to treat *any*
         * lamp action as a power toggle, so dragging the warmth slider to its
         * cool end switched the lamp off — the slider said "cooler" and the
         * room went dark. Only act on power when the caller actually asked for
         * it (an explicit `on`, or an intensity, or a bare toggle).
         */
        const changingPower = action.on !== undefined || action.intensity !== undefined;
        const changingWarmth = action.warmth !== undefined;

        if (changingPower || !changingWarmth) {
          const on = action.on ?? state.lamp.targetKerosene < 0.5;
          state.lamp = {
            ...state.lamp,
            targetKerosene: on ? (action.intensity ?? 0.92) : 0,
          };
          if (on && state.lamp.targetKelvin > 5400) {
            // Never turn on at a clinical daylight colour: a kerosene lamp is warm.
            state.lamp.targetKelvin = 2400;
          }
        }
      } else if (source === "cove") {
        state.lamp = { ...state.lamp, cove: action.on ?? !state.lamp.cove };
      } else if (source === "candle") {
        state.lamp = { ...state.lamp, candle: action.on ?? !state.lamp.candle };
      } else if (source === "fairies") {
        state.lamp = { ...state.lamp, fairyLights: action.on ?? !state.lamp.fairyLights };
      } else {
        // "window" is the daylight key: the blind/curtain arg lives in props, so
        // the switch opens the curtains rather than editing a phantom light.
        const open = action.on ?? state.props.curtainsOpen < 0.5;
        state.props = { ...state.props, curtainsOpen: open ? 1 : 0 };
      }

      if (action.warmth !== undefined) {
        const warm = clamp(action.warmth, 0, 1);
        // Warmer = a lower colour temperature on the practicals. This single
        // number is the room's colour balance; the renderer spreads it across
        // walls, furniture, lamp spill and the character warmth.
        state.lamp = {
          ...state.lamp,
          targetKelvin: clamp(5200 - warm * 3400, 1800, 6500),
        };
      }
      state.props = { ...state.props, lightSource: source };
      break;
    }

    case "neutral": {
      state.interaction = { ...IDLE_INTERACTION };
      state.characters = {
        mochi: { ...state.characters.mochi, desiredYaw: HOME.mochi.yaw, gaze: "viewer", expression: "calm", x: HOME.mochi.x, z: HOME.mochi.z, seated: 0, lie: 0 },
        yume: { ...state.characters.yume, desiredYaw: HOME.yume.yaw, gaze: "viewer", expression: "calm", x: HOME.yume.x, z: HOME.yume.z, seated: 0, lie: 0 },
      };
      break;
    }

    default: {
      return prev;
    }
  }

  state.revision = prev.revision + 1;
  state.lastActionId = action.id;
  return state;
}

/** Human readable confirmation surfaced in the command bar. */
/** Full descriptions, used for announcements and the reduced-motion summary. */
export const HUG_LABELS: Record<HugPreset, string> = {
  gentle: "a gentle hug",
  comforting: "a comforting hug",
  shy: "a shy side-hug",
  reunion: "a warm reunion",
  sway: "a slow swaying hug",
  handhold: "held hands",
  nosenose: "a nose-to-nose moment",
  wave: "a friendly wave",
};

/**
 * Short names for the picker.
 *
 * The picker is a compact grid; using the sentence-length labels there forced
 * every one of them to ellipsise, which left the control unreadable.
 */
export const HUG_SHORT_LABELS: Record<HugPreset, string> = {
  gentle: "Gentle",
  comforting: "Comforting",
  shy: "Shy",
  reunion: "Reunion",
  sway: "Sway",
  handhold: "Hands",
  nosenose: "Nose to nose",
  wave: "Wave",
};

export function describeAction(action: WorldAction): string {
  switch (action.type) {
    case "setWeather": {
      return {
        clear: "The sky clears.",
        cloudy: "Clouds gather outside.",
        rain: "Rain begins outside.",
        snow: "Snow drifts down outside.",
      }[action.condition];
    }
    case "setAtmosphere": {
      return {
        night: "The night deepens.",
        twilight: "Twilight settles in.",
        dawn: "Dawn warms the window.",
        day: "Morning light fills the room.",
      }[action.atmosphere];
    }
    case "setLamp": {
      if (action.kelvin !== undefined && action.kerosene === undefined) {
        return action.kelvin >= 3400 ? "The lamp turns cooler." : "The lamp turns warmer.";
      }
      return (action.kerosene ?? 1) < 0.2 ? "The lamp dims." : "The lamp glows brighter.";
    }
    case "toggle": {
      const names: Record<string, [string, string]> = {
        fairyLights: ["Fairy lights on.", "Fairy lights off."],
        candle: ["A candle is lit.", "The candle is out."],
        cove: ["Cove lighting on.", "Cove lighting off."],
        globeOpen: ["The snow globe opens.", "The snow globe closes."],
        giftOpen: ["The gift opens.", "The gift closes."],
      };
      const pair = names[action.flag]!;
      // The reducer toggles, so describe the outcome of the toggle lazily.
      return pair[0];
    }
    case "setCurtains": {
      return action.open > 0.5 ? "The curtains part." : "The curtains close.";
    }
    case "camera": {
      return action.preset ? `The camera drifts toward the ${action.preset}.` : "The camera moves.";
    }
    case "wave": {
      if (action.who === "both") return "Mochi and Yume wave.";
      return action.who === "mochi" ? "Mochi waves." : "Yume waves.";
    }
    case "look": {
      if (action.who === "both") return "They look over.";
      return action.who === "mochi" ? "Mochi looks over." : "Yume looks over.";
    }
    case "express": {
      return "Their expression softens.";
    }
    case "hug": {
      const name = action.preset ? HUG_LABELS[action.preset] : "a hug";
      return `Mochi and Yume share ${name}.`;
    }
    case "bed": {
      return {
        sit: "They settle onto the edge of the bed.",
        lie: "They stretch out on the quilt.",
        rest: "They rest against the pillows.",
        together: "They sit together on the bed.",
        rise: "They hop down from the bed.",
      }[action.action];
    }
    case "light": {
      if (action.source === "lamp") {
        const on = action.on ?? true;
        return on ? "The lamp is on." : "The lamp goes out.";
      }
      if (action.source === "cove") {
        return (action.on ?? true) ? "The room light warms up." : "The room light dims.";
      }
      if (action.source === "candle") {
        return (action.on ?? true) ? "The candle catches." : "The candle is snuffed.";
      }
      if (action.source === "fairies") {
        return (action.on ?? true) ? "The fairy lights glow." : "The fairy lights go dark.";
      }
      return (action.on ?? true) ? "Daylight reaches in." : "The room closes against the window.";
    }
    case "neutral": {
      return "They step back to where they were.";
    }
    case "setMode": {
      return action.mode === "explore" ? "Exploring the room." : "The film begins.";
    }
    default: {
      return "The room shifts.";
    }
  }
}

/** Derives the atmosphere label from state so the two can never disagree. */
export function currentAtmosphere(state: WorldState): Atmosphere {
  return atmosphereForDaylight(state.time.daylight);
}
