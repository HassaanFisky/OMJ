/**
 * OMJ world state — the single ownership contract for everything interactive.
 *
 * Modes
 *  - "cinematic": the musical timeline is the authoritative owner of the frame.
 *  - "explore":   the exploration simulator owns the frame; the timeline is off.
 *
 * There is exactly one `WorldState` at a time. Cinematic playback never reads
 * exploration data and exploration never reads the film clock, which removes
 * the possibility of two animation clocks fighting for the same transform.
 */

import { clamp01, mixHex } from "./color";

export type WorldMode = "cinematic" | "explore";

export type Atmosphere = "night" | "twilight" | "day" | "dawn";

export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow";

export type CharacterId = "mochi" | "yume";

export interface WeatherState {
  condition: WeatherCondition;
  /** 0..1 how intense the active precipitation is. */
  intensity: number;
  /** 0..1 cloud density. Derived, but stored so the renderer stays declarative. */
  clouds: number;
  wind: number;
}

export interface TimeState {
  atmosphere: Atmosphere;
  /** 0..1 brightness of the exterior sky. */
  daylight: number;
}

export interface LambertState {
  /** Live intensity of the bedside lamp, 0 off .. 1 bright. Eased by the engine. */
  kerosene: number;
  /** Live colour temperature of the lamp, 1800..6500 K. Eased by the engine. */
  kelvin: number;
  /** Where the lamp is heading. Actions write targets; the engine eases live. */
  targetKerosene: number;
  targetKelvin: number;
  fairyLights: boolean;
  candle: boolean;
  cove: boolean;
}

export interface CameraState {
  yaw: number; // degrees, continuous (unwrapped)
  pitch: number; // degrees
  distance: number; // world units from the room centre
}

export interface PropState {
  curtainsOpen: number; // 0 closed .. 1 open
  globeOpen: boolean;
  giftOpen: boolean;
  /** Catalogue id of the surface the room is lit from. "auto" = lamp at night. */
  lightSource: string;
}

/* ── interactions ─────────────────────────────────────────────────────────── */

/**
 * Every named two-body / furniture interaction. The label is the single shared
 * vocabulary between the HUD, the command layer and the choreography, so a hug
 * preset cannot exist in one place and be missing in another.
 */
export type HugPreset =
  | "gentle"
  | "comforting"
  | "shy"
  | "reunion"
  | "sway"
  | "handhold"
  | "nosenose"
  | "wave";

export type InteractionKind = "hug" | "bed";

/** The named bed pose an active bed interaction is easing into. */
export type BedPoseName = "sit" | "lie" | "rest" | "together";

export type InteractionPhase =
  | "idle"
  | "notice"
  | "turn"
  | "approach"
  | "contact"
  | "settle"
  | "hold"
  | "release";

/**
 * One interaction, authored as a timeline.
 *
 * `elapsed` is advanced by the very same engine tick that smooths the
 * characters, so the choreography and the body transforms are one clock. The
 * phase is *derived* from elapsed — never stored twice — which removes the
 * classic bug where an animation ends but a stale "hugging" flag keeps the
 * characters frozen mid-pose.
 */
export interface InteractionState {
  kind: InteractionKind | null;
  /** Set for hugs; the authored beat sheet in flight. */
  preset: HugPreset | null;
  /** Set for bed interactions; the authored pose in flight. */
  bedPose: BedPoseName | null;
  /** 0..1 choreography progress. Drives phase, never the other way round. */
  progress: number;
  /** Seconds since the interaction began. */
  elapsed: number;
  phase: InteractionPhase;
}

/** Authored duration per interaction, in seconds. Slow enough to read. */
export const INTERACTION_TIMING = {
  hug: {
    notice: 0.5,
    turn: 0.75,
    approach: 1.15,
    contact: 0.7,
    settle: 0.6,
    /** The held pose. Long, but the user can always ask to return to neutral. */
    hold: 3.2,
    release: 1.2,
  },
  bed: {
    notice: 0.35,
    turn: 0.5,
    approach: 0.9,
    contact: 0.6,
    settle: 0.5,
    hold: 2.6,
    release: 1.0,
  },
} as const;

export function createInteractionState(): InteractionState {
  return { kind: null, preset: null, bedPose: null, progress: 0, elapsed: 0, phase: "idle" };
}

/** The idle interaction record, used everywhere a reset is needed. */
export const IDLE_INTERACTION: Readonly<InteractionState> = Object.freeze(
  createInteractionState(),
);

/**
 * Pure: phase for a progress value, using the authored timing bands.
 * `progress` is normalised 0..1 over the full interaction.
 */
export function phaseForProgress(kind: InteractionKind, progress: number): InteractionPhase {
  const t = INTERACTION_TIMING[kind];
  const total = t.notice + t.turn + t.approach + t.contact + t.settle + t.hold + t.release;
  const at = (seconds: number) => seconds / total;

  if (progress <= 0) return "idle";
  if (progress < at(t.notice)) return "notice";
  if (progress < at(t.notice + t.turn)) return "turn";
  if (progress < at(t.notice + t.turn + t.approach)) return "approach";
  if (progress < at(t.notice + t.turn + t.approach + t.contact)) return "contact";
  if (progress < at(t.notice + t.turn + t.approach + t.contact + t.settle)) return "settle";
  if (progress < at(total - t.release)) return "hold";
  return "release";
}

export function interactionDuration(kind: InteractionKind): number {
  const t = INTERACTION_TIMING[kind];
  return t.notice + t.turn + t.approach + t.contact + t.settle + t.hold + t.release;
}

/** True once the release has fully unwound and neutral may be restored. */
export function interactionFinished(state: InteractionState): boolean {
  return state.kind !== null && state.progress >= 1;
}

export type GazeTarget = "viewer" | "mochi" | "yume" | "window" | "globe" | "lamp" | "none";

export interface CharacterState {
  /**
   * yaw of the character facing direction in degrees, 0 = toward the viewer.
   * Interpolated toward `desiredYaw` so turns read as physical.
   */
  yaw: number;
  desiredYaw: number;
  gaze: GazeTarget;
  expression: "calm" | "happy" | "curious" | "sleepy" | "shy" | "warm";
  waveImpulse: number; // 0..1 decays over time but exists so it is observable/testable
  bounce: number; // 0..1 decays
  /**
   * Standing position in room world units.
   *
   * The position lives here rather than in the component because an approach is
   * a *state change*: the renderer must be able to read where a plushie is
   * without owning a parallel transform, and a reload/preset must restore the
   * exact same footprint.
   */
  x: number;
  z: number;
  /** 0..1 how far onto the bed edge the body has settled. */
  seated: number;
  /** 0..1 how far the body has reclined onto the mattress. */
  lie: number;
}

export interface CharactersState {
  mochi: CharacterState;
  yume: CharacterState;
}

export interface WorldState {
  version: 1;
  mode: WorldMode;
  time: TimeState;
  weather: WeatherState;
  lamp: LambertState;
  camera: CameraState;
  props: PropState;
  characters: CharactersState;
  /** The one active interaction, or an idle record. Never two at once. */
  interaction: InteractionState;
  /** Monotonic UI sequence so command feedback stays deterministic. */
  revision: number;
  lastActionId: string | null;
}

export const CAMERA_LIMITS = {
  pitch: { min: -18, max: 26 },
  /**
   * Orbit radius bounds.
   *
   * The minimum is the closest the camera may come to the *pivot*. It used to be
   * 330 and was then applied as a hard floor even when a wall was nearer, which
   * put the camera outside the room looking back in at yaw 180 — the floor and
   * ceiling quads both clipped away and the room appeared to have no walls.
   * 250 is close enough for an intimate view and far enough that neither plush
   * can fill the frame.
   */
  distance: { min: 250, max: 820 },
  /** Camera is never closer than this to the room shell walls. */
  wallClearance: 120,
} as const;

/**
 * The room shell, mirrored for camera maths.
 *
 * These MUST equal `SHELL` in `src/stage/explore/scene.ts`. They previously read
 * `x: 640, z: 560` while the built room is `800 x 700`, which silently pulled the
 * orbit radius 140–160 units inside the walls: the default 620-unit view was
 * clamped to 441, and the camera ended up sitting among the furniture. A unit
 * test asserts the two tables agree.
 */
export const ROOM_BOUNDS = {
  x: 800,
  y: 620,
  z: 700,
  height: 900,
  targetY: 300,
} as const;

/**
 * The point the orbit revolves around.
 *
 * Not the room's geometric centre: the plushies live near the window wall at
 * z ≈ −330, and the furniture you want in shot (bed, lamps, mirror) is spread
 * between there and the middle of the room. Pivoting on the true centre put the
 * pair *behind* the camera for a third of the orbit, so they genuinely
 * disappeared from the frame.
 *
 * The offset is measured, not guessed: sweeping every yaw at four radii, the
 * worst view-space depth for either plushie is −65 units at the room centre and
 * +116 at z = −330. Both characters therefore stay in front of the lens at
 * every angle, while the room still spreads behind them.
 */
export const ORBIT_FOCUS = { x: -10, y: 300, z: -330 } as const;

export function createCharacterState(
  yaw: number,
  expression: CharacterState["expression"] = "calm",
  home: { x: number; z: number } = { x: 0, z: 0 },
): CharacterState {
  return {
    yaw,
    desiredYaw: yaw,
    gaze: "viewer",
    expression,
    waveImpulse: 0,
    bounce: 0,
    x: home.x,
    z: home.z,
    seated: 0,
    lie: 0,
  };
}

export function createInitialWorldState(): WorldState {
  return {
    version: 1,
    mode: "explore",
    time: { atmosphere: "night", daylight: 0.08 },
    weather: { condition: "clear", intensity: 0, clouds: 0, wind: 0.35 },
    lamp: {
      kerosene: 0.55,
      kelvin: 2400,
      targetKerosene: 0.55,
      targetKelvin: 2400,
      fairyLights: true,
      candle: false,
      cove: true,
    },
    camera: { yaw: 0, pitch: 4, distance: 620 },
    props: { curtainsOpen: 0.35, globeOpen: false, giftOpen: false, lightSource: "auto" },
    characters: {
      mochi: createCharacterState(-8, "calm", { x: -230, z: -320 }),
      yume: createCharacterState(10, "calm", { x: 215, z: -345 }),
    },
    interaction: createInteractionState(),
    revision: 0,
    lastActionId: null,
  };
}

export function cloneWorldState(state: WorldState): WorldState {
  return {
    ...state,
    time: { ...state.time },
    weather: { ...state.weather },
    lamp: { ...state.lamp },
    camera: { ...state.camera },
    props: { ...state.props },
    characters: {
      mochi: { ...state.characters.mochi },
      yume: { ...state.characters.yume },
    },
    interaction: { ...state.interaction },
  };
}

export interface AtmosphereProfile {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  /** Exponential exposure applied to the room shell. */
  roomExposure: number;
  stars: number;
  sun: number;
  moon: number;
  ambient: number;
}

/** Canonical atmosphere palette, shared by the 3D room and UI chrome. */
export const ATMOSPHERES: Record<Atmosphere, AtmosphereProfile> = {
  night: {
    skyTop: "#080a18",
    skyMid: "#141a33",
    skyBottom: "#2b3050",
    roomExposure: 0.9,
    stars: 0.95,
    sun: 0,
    moon: 0.85,
    ambient: 0.34,
  },
  twilight: {
    skyTop: "#1c1738",
    skyMid: "#3b2d55",
    skyBottom: "#9a6472",
    roomExposure: 1.0,
    stars: 0.4,
    sun: 0.16,
    moon: 0.32,
    ambient: 0.46,
  },
  dawn: {
    skyTop: "#33416e",
    skyMid: "#9a7f9d",
    skyBottom: "#e8b894",
    roomExposure: 1.06,
    stars: 0.08,
    sun: 0.42,
    moon: 0,
    ambient: 0.6,
  },
  day: {
    skyTop: "#4b83bf",
    skyMid: "#8fb8dc",
    skyBottom: "#d8e8f2",
    roomExposure: 1.16,
    stars: 0,
    sun: 1,
    moon: 0,
    ambient: 0.78,
  },
};

/**
 * Resolves the atmosphere a given `daylight` value represents. This keeps the
 * atmosphere label and the actual light level inseparable, so the command
 * layer cannot set "night" while leaving the room lit like noon.
 */
export function atmosphereForDaylight(daylight: number): Atmosphere {
  if (daylight <= 0.22) return "night";
  if (daylight <= 0.48) return "twilight";
  if (daylight <= 0.72) return "dawn";
  return "day";
}

export function daylightForAtmosphere(atmosphere: Atmosphere): number {
  return { night: 0.08, twilight: 0.36, dawn: 0.6, day: 0.9 }[atmosphere];
}

export interface LightingResult {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  /** Multiplier applied to every static surface albedo. */
  exposure: number;
  /** Warmth of the lamp pool, used to tint floors/walls near the lamp. */
  lampColor: string;
  /** 0..1 how strongly the lamp bleeds into the room. */
  lampSpill: number;
  /** 0..1 moon/sun direction light over the room. */
  keyLight: number;
  skyStars: number;
  skySun: number;
  skyMoon: number;
  /** Overlay tint for weather (rain darkens, snow brightens). */
  weatherTint: string;
  weatherTintAlpha: number;
  /* ── discrete sources ───────────────────────────────────────────────────
   * Adding these as first-class numbers (instead of rolling them into
   * `exposure`) is what lets the HUD switch a *specific* light and see that
   * specific part of the room change.
   */
  /** Practical lamp light reaching the room, 0..1. */
  lampLight: number;
  /** Recessed ceiling cove strip, 0..1. */
  coveLight: number;
  /** Candle on the nightstand, 0..1. */
  candleLight: number;
  /** Fairy lights strung on the headboard, 0..1. */
  fairyLight: number;
  /** 0 cool .. 1 warm: shifts every interior surface's colour balance. */
  warmth: number;
  /** 0..1 how strongly the interior is tinted toward amber. Small by design. */
  amberMix: number;
  /** Colour the *interior* is lit with (not a screen filter). */
  ambientColor: string;
}

/**
 * Ambient "warmth" of the room, 0 cool .. 1 golden.
 *
 * Deliberately derived from the *lamp colour temperature and swing*, then
 * blended into the wall/floor albedo mix and the panel windows' spill. The
 * renderer applies it per surface — the screen itself is never tinted, which is
 * the difference between "the room got warmer" and "someone put an orange
 * rectangle over the photo".
 */
function warmthFromLamp(lamp: LambertState): number {
  const kelvinWarmth = clamp01((5200 - lamp.kelvin) / 3400);
  return clamp01(kelvinWarmth * 0.78 + lamp.kerosene * 0.22);
}

/**
 * Pure: derives the complete lighting rig for the room shell.
 * Lamp intensity, kelvin, weather and daylight are combined here and nowhere
 * else, so lighting can never be authored twice with conflicting results.
 */
export function resolveLighting(state: WorldState): LightingResult {
  const atmosphere = ATMOSPHERES[state.time.atmosphere];
  const daylight = clamp01(state.time.daylight);

  const { weather, lamp } = state;

  let exposure = atmosphere.roomExposure;
  let skyTop = atmosphere.skyTop;
  let skyMid = atmosphere.skyMid;
  let skyBottom = atmosphere.skyBottom;

  // Weather darkens and desaturates the exterior.
  if (weather.condition === "rain") {
    const k = 0.4 + weather.intensity * 0.3;
    skyTop = mixHex(skyTop, "#141a26", k);
    skyMid = mixHex(skyMid, "#26303f", k);
    skyBottom = mixHex(skyBottom, "#3c4756", k);
    exposure *= 1 - 0.18 * weather.intensity;
  } else if (weather.condition === "snow") {
    const k = 0.32 + weather.intensity * 0.26;
    skyTop = mixHex(skyTop, "#2a3a58", k);
    skyMid = mixHex(skyMid, "#5d7290", k);
    skyBottom = mixHex(skyBottom, "#aebfd4", k);
    exposure *= 1 + 0.08 * weather.intensity;
  } else if (weather.condition === "cloudy") {
    const k = 0.22 + weather.clouds * 0.22;
    skyTop = mixHex(skyTop, "#2b3142", k);
    skyMid = mixHex(skyMid, "#495064", k);
    skyBottom = mixHex(skyBottom, "#6d7085", k);
    exposure *= 1 - 0.06 * weather.clouds;
  }

  // Discrete practicals. Each one is a real light with a position in the scene
  // (`LIGHT_RIGS`); these numbers are the *intensities* handed to that rig.
  const lampLight = clamp01(lamp.kerosene);
  const coveLight = lamp.cove ? 0.55 + lampLight * 0.2 : 0;
  const candleLight = lamp.candle ? 0.62 : 0;
  const fairyLight = lamp.fairyLights ? 0.7 : 0;

  // The kerosene lamp contributes a warm pool regardless of the hour.
  const lampSpill = clamp01(lampLight * 0.72 + fairyLight * 0.1 + candleLight * 0.06);
  const lampColor = mixHex("#ffb45e", "#ffe7c4", clamp01((lamp.kelvin - 1800) / 4200));
  exposure *= 1 + lampSpill * 0.22;
  // The cove lifts the whole shell a little; without it the room went pitch
  // black the moment the practical lamp was switched off, which is not how a
  // room with a lit ceiling recess behaves.
  exposure *= 1 + coveLight * 0.1;

  const stars =
    atmosphere.stars * clamp01(1 - daylight * 0.4) * (1 - weather.clouds * 0.85);
  const rainOcclusion = weather.condition === "rain" ? 1 - weather.intensity * 0.7 : 1;

  let weatherTint = "#000000";
  let weatherTintAlpha = 0;
  if (weather.condition === "rain") {
    weatherTint = "#5f7ba8";
    weatherTintAlpha = 0.1 * weather.intensity;
  } else if (weather.condition === "snow") {
    weatherTint = "#cfe2ff";
    weatherTintAlpha = 0.09 * weather.intensity;
  }

  const warmth = warmthFromLamp(lamp);
  // Amber is applied per surface, so it can be far stronger than a screen tint
  // without washing the picture out.
  const amberMix = clamp01(
    0.06 + warmth * 0.3 + candleLight * 0.08 + fairyLight * 0.04 * (1 - daylight),
  );
  const ambientColor = mixHex("#7b86a6", "#ffc98a", warmth);

  return {
    skyTop,
    skyMid,
    skyBottom,
    exposure,
    lampColor,
    lampSpill,
    keyLight: atmosphere.sun * (weather.condition === "rain" ? 0.35 : 1),
    skyStars: stars,
    skySun: atmosphere.sun * rainOcclusion * (weather.condition === "snow" ? 0.5 : 1),
    skyMoon: atmosphere.moon * rainOcclusion,
    weatherTint,
    weatherTintAlpha,
    lampLight,
    coveLight,
    candleLight,
    fairyLight,
    warmth,
    amberMix,
    ambientColor,
  };
}
