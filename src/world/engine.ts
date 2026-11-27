/**
 * WorldEngine — the single mutable owner of WorldState.
 *
 * Responsibilities
 *  - Hold the authoritative state and notify subscribers on change.
 *  - Run one deterministic update loop (only while exploring) that advances
 *    character smoothing, the active interaction clock, light easing, impulse
 *    decay and idle life.
 *  - Apply gesture input through the same reducer as everything else.
 *
 * The engine never touches the DOM and never reads the audio clock, which is
 * what keeps exploration and the cinematic timeline independent.
 */

import {
  applyWorldAction,
  BED_ACTIONS,
  characterObstacles,
  resolveCameraPose,
  type WorldAction,
} from "./actions";
import { bedTargets, hugTargets } from "../stage/explore/choreography";
import {
  CAMERA_LIMITS,
  cloneWorldState,
  createInitialWorldState,
  interactionDuration,
  ORBIT_FOCUS,
  ROOM_BOUNDS,
  phaseForProgress,
  type CharacterState,
  type InteractionState,
  type WorldState,
} from "./state";

type Listener = (state: WorldState) => void;

const IDLE = {
  /** How quickly a character's body turns toward its desired yaw. */
  turnSmoothing: 2.6,
  /** How quickly the head settles toward the gaze. */
  gazeSmoothing: 4.2,
  /** Impulse decay per second. */
  impulseDecay: 1.5,
  /** Easing rate of the bed seat/lie values. */
  seatSmoothing: 3.4,
  /** How fast the practical lamp fades up or down (per second). */
  lampEasing: 1.7,
  /** How fast colour temperature drifts toward its target. */
  kelvinEasing: 0.9,
} as const;

export interface EngineOptions {
  /** Injectable for tests so the loop is fully deterministic. */
  now?: () => number;
  requestFrame?: (cb: (time: number) => void) => number;
  cancelFrame?: (handle: number) => void;
  /** Disable the internal ticker (tests drive `update` manually). */
  manual?: boolean;
}

export class WorldEngine {
  private state: WorldState;
  private readonly listeners = new Set<Listener>();
  private readonly now: () => number;
  private readonly requestFrame: (cb: (time: number) => void) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly manual: boolean;

  private frame = 0;
  private lastTick = 0;
  private running = false;
  private disposed = false;

  constructor(initial: WorldState = createInitialWorldState(), options: EngineOptions = {}) {
    this.state = cloneWorldState(initial);
    this.now = options.now ?? (() => performance.now());
    this.requestFrame =
      options.requestFrame ??
      ((cb) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : 0));
    this.cancelFrame =
      options.cancelFrame ??
      ((handle) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(handle) : 0));
    this.manual = options.manual ?? false;
  }

  getState = (): WorldState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  dispatch = (action: WorldAction): WorldState => {
    if (this.disposed) return this.state;

    const next = applyWorldAction(this.state, action);
    if (next === this.state) return this.state;

    const wasMode = this.state.mode;
    this.state = next;

    if (wasMode !== next.mode) {
      if (next.mode === "explore") this.start();
      else this.stop();
    }

    this.publish();
    return this.state;
  };

  /** Orbit drag in screen pixels; deterministic and clamp-safe. */
  orbit = (dxPixels: number, dyPixels: number) => {
    const camera = this.state.camera;
    this.dispatch({
      id: `orbit-${Math.round(camera.yaw)}-${Math.round(dyPixels)}`,
      type: "camera",
      yaw: camera.yaw + dxPixels * 0.32,
      pitch: camera.pitch + dyPixels * 0.16,
      distance: camera.distance,
    });
  };

  zoom = (delta: number) => {
    const camera = this.state.camera;
    this.dispatch({
      id: `zoom-${Math.round(camera.distance)}`,
      type: "camera",
      distance: camera.distance + delta,
    });
  };

  /** Advances the living layer. Exposed so tests can step deterministically. */
  update = (dt: number) => {
    const state = this.state;

    if (state.mode !== "explore") {
      return;
    }

    const seconds = Math.max(0, Math.min(0.1, dt));
    if (seconds === 0) return;

    const interaction = stepInteraction(state.interaction, seconds);
    const lamp = stepLamp(state.lamp, seconds);

    // Choreography first: it decides the footprint and the posture targets for
    // this instant. The characters are then smoothed *toward* those targets, so
    // there is exactly one place that says where a body is, and the smoothing
    // can never fight the choreography.
    const posed = applyInteractionPose(
      { ...state, interaction, lamp },
      seconds,
    );

    const changed =
      posed.mochi !== state.characters.mochi ||
      posed.yume !== state.characters.yume ||
      interaction !== state.interaction ||
      lamp !== state.lamp;

    if (!changed) {
      return;
    }

    this.state = {
      ...state,
      characters: { mochi: posed.mochi, yume: posed.yume },
      interaction,
      lamp,
    };

    this.publish();
  };

  start() {
    if (this.manual || this.running || this.disposed) return;
    this.running = true;
    this.lastTick = this.now();

    const tick = (time: number) => {
      if (!this.running || this.disposed) return;

      const delta = (time - this.lastTick) / 1000;
      this.lastTick = time;

      // Never simulate while the tab is hidden to avoid a state jump on return.
      if (!(typeof document !== "undefined" && document.hidden)) {
        this.update(delta);
      }

      this.frame = this.requestFrame(tick);
    };

    this.frame = this.requestFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.frame) {
      this.cancelFrame(this.frame);
      this.frame = 0;
    }
  }

  dispose() {
    this.stop();
    this.disposed = true;
    this.listeners.clear();
  }

  /**
   * Camera position in world space, used by the renderer and tests.
   *
   * Reports the *resolved* pose (the one actually rendered), not the raw
   * request: the state stores intent, and a caller asking "where is the camera"
   * must get the constrained answer or every spatial check downstream is about
   * a position that was never drawn.
   */
  cameraPosition() {
    const { yaw } = this.state.camera;
    const { pitch, distance } = resolveCameraPose(
      yaw,
      this.state.camera.pitch,
      this.state.camera.distance,
      characterObstacles(this.state),
    );
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;

    // Matches the renderer: swing about the room axis, aim at ORBIT_FOCUS.
    // Adding the focus to X/Z here described a different camera from the one
    // that was actually drawn (see `positionFor` in actions.ts).
    return {
      x: Math.sin(yawRad) * Math.cos(pitchRad) * distance,
      y: ORBIT_FOCUS.y + Math.sin(pitchRad) * distance,
      z: Math.cos(yawRad) * Math.cos(pitchRad) * distance,
    };
  }

  /** True when the resolved camera is safely inside the room shell. */
  cameraInsideRoom() {
    const { x, y, z } = this.cameraPosition();
    const { x: rx, z: rz, height } = ROOM_BOUNDS;
    return Math.abs(x) < rx - 40 && Math.abs(z) < rz - 40 && y > 60 && y < height - 40;
  }
}

/**
 * Resolve both bodies for this frame.
 *
 * Hugs and bed poses both hand back a footprint (x/z), a posture (seated/lie)
 * and the phase-specific extras (lift, lean, press, paw targets). Those extras
 * are *derived* fresh each frame from the single progress clock, so a paused or
 * backgrounded tab can never leave a body mid-lean.
 */
function applyInteractionPose(
  state: WorldState,
  dt: number,
): { mochi: CharacterState; yume: CharacterState } {
  const mochiBase = stepCharacter(state.characters.mochi, dt);
  const yumeBase = stepCharacter(state.characters.yume, dt);

  const interaction = state.interaction;
  if (interaction.kind === null) {
    return { mochi: mochiBase, yume: yumeBase };
  }

  const progress = interaction.progress;

  if (interaction.kind === "hug") {
    const target = hugTargets(state, progress);
    return {
      mochi: {
        ...mochiBase,
        x: target.mochi.x,
        z: target.mochi.z,
        desiredYaw: target.mochi.yaw,
        seated: 0,
        lie: 0,
      },
      yume: {
        ...yumeBase,
        x: target.yume.x,
        z: target.yume.z,
        desiredYaw: target.yume.yaw,
        seated: 0,
        lie: 0,
      },
    };
  }

  const bed = bedTargets(state, progress);
  return {
    mochi: {
      ...mochiBase,
      x: bed.mochi.x,
      z: bed.mochi.z,
      seated: bed.mochi.seated,
      lie: bed.mochi.lie,
      desiredYaw: BED_ACTIONS[interaction.bedPose ?? "sit"].mochi.yaw,
    },
    yume: {
      ...yumeBase,
      x: bed.yume.x,
      z: bed.yume.z,
      seated: bed.yume.seated,
      lie: bed.yume.lie,
      desiredYaw: BED_ACTIONS[interaction.bedPose ?? "sit"].yume.yaw,
    },
  };
}

/** Pure: advance the interaction clock and re-derive its phase. */
export function stepInteraction(interaction: InteractionState, dt: number): InteractionState {
  if (interaction.kind === null) return interaction;
  if (interaction.progress >= 1) return interaction;

  const duration = interactionDuration(interaction.kind);
  const elapsed = interaction.elapsed + dt;
  const progress = Math.min(1, elapsed / duration);
  const phase = phaseForProgress(interaction.kind, progress);

  return { ...interaction, elapsed, progress, phase };
}

/** Pure: ease live lamp intensity and colour temperature toward their targets. */
export function stepLamp(
  lamp: WorldState["lamp"],
  dt: number,
): WorldState["lamp"] {
  const kerosene = damp(lamp.kerosene, lamp.targetKerosene, IDLE.lampEasing, dt);
  const kelvin = damp(lamp.kelvin, lamp.targetKelvin, IDLE.kelvinEasing, dt);

  if (
    Math.abs(kerosene - lamp.kerosene) < 1e-4 &&
    Math.abs(kelvin - lamp.kelvin) < 1e-3
  ) {
    if (lamp.kerosene === lamp.targetKerosene && lamp.kelvin === lamp.targetKelvin) return lamp;
    return { ...lamp, kerosene: lamp.targetKerosene, kelvin: lamp.targetKelvin };
  }

  return { ...lamp, kerosene, kelvin };
}

function stepCharacter(character: CharacterState, dt: number): CharacterState {
  const yaw = damp(character.yaw, character.desiredYaw, IDLE.turnSmoothing, dt);

  // Snap impulses that are imperceptible to a true zero *before* the settle test.
  // `decay` lands on values like 0.025000000000000398; testing that for an exact
  // zero never passes, so a character used to freeze one frame short of rest and
  // keep its paw permanently raised after a wave.
  const decayedWave = decay(character.waveImpulse, IDLE.impulseDecay, dt);
  const decayedBounce = decay(character.bounce, IDLE.impulseDecay * 1.1, dt);
  const waveImpulse = decayedWave < 1e-3 ? 0 : decayedWave;
  const bounce = decayedBounce < 1e-3 ? 0 : decayedBounce;

  // Snap to rest once the remaining error is imperceptible. Comparing the
  // distance to the target (not the per-frame delta) is what stops a turn from
  // freezing in a visibly half-rotated pose.
  const settled =
    Math.abs(targetOr(character.desiredYaw, yaw) - yaw) < 0.05 &&
    waveImpulse === 0 &&
    bounce === 0;

  if (settled) {
    // Returning `character` here was wrong: the input still carries the old
    // (already-zero) impulse, so the caller kept re-publishing a body whose paw
    // was raised at 0.025 and never finished settling. A rested character must
    // be constructed, not reused.
    return character.yaw === character.desiredYaw &&
      character.waveImpulse === 0 &&
      character.bounce === 0
      ? character
      : { ...character, yaw: character.desiredYaw, waveImpulse: 0, bounce: 0 };
  }

  return { ...character, yaw, waveImpulse, bounce };
}

const targetOr = (target: number, fallback: number) =>
  Number.isFinite(target) ? target : fallback;

function damp(current: number, target: number, smoothing: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-smoothing * dt));
}

function decay(value: number, rate: number, dt: number): number {
  return value <= 0 ? 0 : Math.max(0, value - rate * dt);
}

export { CAMERA_LIMITS };
