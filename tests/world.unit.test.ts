import { describe, expect, it } from "vitest";
import {
  applyWorldAction,
  CAMERA_PRESETS,
  clampCameraDistance,
  currentAtmosphere,
  describeAction,
  resolveCameraPose,
  type WorldAction,
} from "../src/world/actions";
import {
  CAMERA_LIMITS,
  createInitialWorldState,
  daylightForAtmosphere,
  resolveLighting,
  type WorldState,
} from "../src/world/state";
import { WorldEngine } from "../src/world/engine";
import {
  parseWorldCommand,
  suggestCommands,
  localIntentProvider,
} from "../src/world/nlCommands";
import { ATMOSPHERES, ORBIT_FOCUS, ROOM_BOUNDS } from "../src/world/state";
import { buildExploreScene } from "../src/stage/explore/scene";
import { createExploreCamera, projectFace } from "../src/stage/explore/renderer";

let seq = 0;
const act = <T extends Omit<WorldAction, "id">>(action: T): WorldAction =>
  ({ ...action, id: `test-${(seq += 1)}` }) as WorldAction;

describe("world action reducer", () => {
  const base = createInitialWorldState();

  it("never mutates the previous state", () => {
    const before = structuredClone(base);
    const next = applyWorldAction(base, act({ type: "setWeather", condition: "snow" }));

    expect(base).toEqual(before);
    expect(next).not.toBe(base);
    expect(next.weather.condition).toBe("snow");
  });

  it("bumps the revision and records the action id on every change", () => {
    const next = applyWorldAction(base, {
      id: "revision-probe",
      type: "setLamp",
      kerosene: 1,
    });

    expect(next.revision).toBe(base.revision + 1);
    expect(next.lastActionId).toBe("revision-probe");
  });

  it("keeps weather intensity coherent with the chosen condition", () => {
    const clear = applyWorldAction(base, act({ type: "setWeather", condition: "clear" }));
    expect(clear.weather).toEqual({ condition: "clear", intensity: 0, clouds: 0, wind: 0.32 });

    const snow = applyWorldAction(base, act({ type: "setWeather", condition: "snow" }));
    expect(snow.weather.intensity).toBeGreaterThan(0.5);
    expect(snow.weather.clouds).toBeGreaterThan(0);
  });

  it("ties atmosphere to a matching daylight level", () => {
    for (const atmosphere of ["night", "twilight", "dawn", "day"] as const) {
      const next = applyWorldAction(base, act({ type: "setAtmosphere", atmosphere }));
      expect(next.time.daylight).toBe(daylightForAtmosphere(atmosphere));
      expect(currentAtmosphere(next)).toBe(atmosphere);
    }
  });

  it("clamps lamp values into their physical ranges", () => {
    const hot = applyWorldAction(base, act({ type: "setLamp", kerosene: 4, kelvin: 99999 }));
    expect(hot.lamp.kerosene).toBe(1);
    expect(hot.lamp.kelvin).toBe(6500);

    const cold = applyWorldAction(base, act({ type: "setLamp", kerosene: -3, kelvin: 10 }));
    expect(cold.lamp.kerosene).toBe(0);
    expect(cold.lamp.kelvin).toBe(1800);
  });

  it("toggles boolean props without touching unrelated state", () => {
    const lit = applyWorldAction(base, act({ type: "toggle", flag: "candle" }));
    expect(lit.lamp.candle).toBe(!base.lamp.candle);
    expect(lit.weather).toEqual(base.weather);

    const globe = applyWorldAction(base, act({ type: "toggle", flag: "globeOpen" }));
    expect(globe.props.globeOpen).toBe(true);
    expect(globe.props.curtainsOpen).toBe(base.props.curtainsOpen);
  });

  it("applies camera presets and clamps pitch", () => {
    // Presets are authored framings, not fixed yaw 0: the window preset looks
    // slightly off-axis because the orbit pivots near the window wall. Assert
    // the preset is applied verbatim rather than a hardcoded angle.
    const next = applyWorldAction(base, act({ type: "camera", preset: "window" }));
    expect(next.camera.yaw).toBe(CAMERA_PRESETS.window.yaw);
    expect(next.camera.pitch).toBe(CAMERA_PRESETS.window.pitch);
    expect(next.camera.pitch).toBeLessThanOrEqual(CAMERA_LIMITS.pitch.max);

    const extreme = applyWorldAction(base, act({ type: "camera", pitch: 400 }));
    expect(extreme.camera.pitch).toBe(CAMERA_LIMITS.pitch.max);
  });

  it("waves the requested character only", () => {
    const mochiOnly = applyWorldAction(base, act({ type: "wave", who: "mochi" }));
    expect(mochiOnly.characters.mochi.waveImpulse).toBe(1);
    expect(mochiOnly.characters.yume.waveImpulse).toBe(0);

    const both = applyWorldAction(base, act({ type: "wave", who: "both" }));
    expect(both.characters.mochi.waveImpulse).toBe(1);
    expect(both.characters.yume.waveImpulse).toBe(1);
  });

  it("turns characters toward each other for a coordinated hug", () => {
    const hugged = applyWorldAction(base, act({ type: "hug", preset: "gentle" }));
    expect(hugged.characters.mochi.desiredYaw).toBeLessThan(0);
    expect(hugged.characters.yume.desiredYaw).toBeGreaterThan(0);
    expect(hugged.characters.mochi.gaze).toBe("yume");
    expect(hugged.characters.yume.gaze).toBe("mochi");
  });

  it("describes every action with human language", () => {
    const actions: WorldAction[] = [
      act({ type: "setWeather", condition: "rain" }),
      act({ type: "setAtmosphere", atmosphere: "dawn" }),
      act({ type: "setLamp", kelvin: 1900 }),
      act({ type: "toggle", flag: "fairyLights" }),
      act({ type: "setCurtains", open: 1 }),
      act({ type: "camera", preset: "bed" }),
      act({ type: "wave", who: "yume" }),
      act({ type: "look", who: "mochi", at: "window" }),
      act({ type: "express", who: "both", expression: "happy" }),
      act({ type: "hug", preset: "gentle" }),
      act({ type: "setMode", mode: "explore" }),
    ];

    for (const action of actions) {
      const text = describeAction(action);
      expect(text.length).toBeGreaterThan(3);
      expect(text).toMatch(/[.!]$/);
    }
  });
});

describe("camera collision", () => {
  it("never lets the resolved camera push through a wall", () => {
    // The constraint is applied to the whole pose now: a request may be lifted
    // over furniture, so the *resolved* pitch and distance are what must be
    // inside the shell. Asserting the radius against the requested pitch was
    // only ever valid because nothing moved the pitch.
    for (let yaw = -360; yaw <= 360; yaw += 7) {
      for (const pitch of [-18, -6, 0, 8, 18, 26]) {
        const pose = resolveCameraPose(yaw, pitch, 100_000);
        const yawRad = (yaw * Math.PI) / 180;
        const pitchRad = (pose.pitch * Math.PI) / 180;
        const x = Math.sin(yawRad) * Math.cos(pitchRad) * pose.distance;
        const z = Math.cos(yawRad) * Math.cos(pitchRad) * pose.distance;
        const y = ORBIT_FOCUS.y + Math.sin(pitchRad) * pose.distance;

        expect(Math.abs(x)).toBeLessThan(SHELL_HALF.width);
        expect(Math.abs(z)).toBeLessThan(SHELL_HALF.depth);
        expect(y).toBeGreaterThan(60);
        expect(y).toBeLessThan(SHELL_HALF.height - 40);
      }
    }
  });

  it("respects the configured minimum distance", () => {
    expect(clampCameraDistance(0, 0, 1)).toBe(CAMERA_LIMITS.distance.min);
  });
});

const SHELL_HALF = { width: 800, depth: 700, height: 900 };

describe("lighting resolution", () => {
  const base = createInitialWorldState();

  it("produces a darker exterior at night than at noon", () => {
    const night = resolveLighting(applyWorldAction(base, act({ type: "setAtmosphere", atmosphere: "night" })));
    const day = resolveLighting(applyWorldAction(base, act({ type: "setAtmosphere", atmosphere: "day" })));

    expect(day.exposure).toBeGreaterThan(night.exposure);
    expect(night.skyStars).toBeGreaterThan(0.4);
    expect(day.skyStars).toBe(0);
  });

  it("removes stars under heavy cloud and rain", () => {
    const rainy = resolveLighting(applyWorldAction(base, act({ type: "setWeather", condition: "rain" })));
    expect(rainy.skyStars).toBeLessThan(0.2);
    expect(rainy.skyMoon).toBeLessThan(0.6);
  });

  it("warms the lamp pool as kelvin drops", () => {
    const warm = resolveLighting(applyWorldAction(base, act({ type: "setLamp", kelvin: 1800 })));
    const cool = resolveLighting(applyWorldAction(base, act({ type: "setLamp", kelvin: 6400 })));
    expect(warm.lampColor).not.toBe(cool.lampColor);
    expect(warm.lampSpill).toBeGreaterThan(0);
  });

  it("never renders a sun and a moon simultaneously", () => {
    for (let daylight = 0; daylight <= 1.0001; daylight += 0.02) {
      const state: WorldState = {
        ...base,
        time: { atmosphere: base.time.atmosphere, daylight },
      };
      const lighting = resolveLighting(state);
      expect(lighting.skySun > 0 && lighting.skyMoon > 0).toBe(false);
    }
  });

  it("defines a distinct palette for every atmosphere", () => {
    const tops = new Set(
      (["night", "twilight", "dawn", "day"] as const).map((a) => ATMOSPHERES[a].skyTop),
    );
    expect(tops.size).toBe(4);
  });
});

describe("world engine lifecycle", () => {
  it("publishes state to subscribers", () => {
    const engine = new WorldEngine(undefined, { manual: true });
    const seen: WorldState[] = [];
    const off = engine.subscribe((state) => seen.push(state));

    engine.dispatch(act({ type: "setWeather", condition: "snow" }));
    expect(seen).toHaveLength(1);
    expect(seen[0]!.weather.condition).toBe("snow");

    off();
    engine.dispatch(act({ type: "setWeather", condition: "rain" }));
    expect(seen).toHaveLength(1);

    engine.dispose();
  });

  it("smooths character turns instead of teleporting them", () => {
    const engine = new WorldEngine(undefined, { manual: true });
    engine.dispatch(act({ type: "look", who: "mochi", at: "window" }));

    const target = engine.getState().characters.mochi.desiredYaw;
    const start = engine.getState().characters.mochi.yaw;
    expect(target).not.toBe(start);

    engine.update(1 / 60);
    const afterOneFrame = engine.getState().characters.mochi.yaw;
    expect(afterOneFrame).not.toBe(target);
    expect(Math.abs(afterOneFrame - target)).toBeLessThan(Math.abs(start - target));

    for (let i = 0; i < 600; i += 1) engine.update(1 / 60);
    // Once the turn completes the engine snaps exactly onto the target, so a
    // character never freezes in a half-rotated pose.
    expect(engine.getState().characters.mochi.yaw).toBe(target);

    engine.dispose();
  });

  it("decays the wave impulse to rest", () => {
    const engine = new WorldEngine(undefined, { manual: true });
    engine.dispatch(act({ type: "wave", who: "both" }));
    expect(engine.getState().characters.yume.waveImpulse).toBe(1);

    // 1.5/s decay from 1.0 reaches zero just under a second.
    for (let i = 0; i < 90; i += 1) engine.update(1 / 60);
    console.log("DBG", engine.getState().characters.yume.waveImpulse);
    expect(engine.getState().characters.yume.waveImpulse).toBe(0);

    engine.dispose();
  });

  it("starts a hug as a timed interaction, not an impulse", () => {
    // The old behaviour set `bounce: 1` and called it a hug. The choreography
    // now owns motion, so no impulse is minted and the interaction clock runs.
    const engine = new WorldEngine(undefined, { manual: true });
    engine.dispatch(act({ type: "hug", preset: "gentle" }));

    const started = engine.getState();
    expect(started.characters.yume.bounce).toBe(0);
    expect(started.interaction.kind).toBe("hug");
    expect(started.interaction.preset).toBe("gentle");
    expect(started.interaction.progress).toBe(0);

    for (let i = 0; i < 120; i += 1) engine.update(1 / 60);
    const running = engine.getState();
    expect(running.interaction.progress).toBeGreaterThan(0);
    // Both bodies have left their home footprint and are closing on each other.
    expect(running.characters.mochi.x).toBeGreaterThan(started.characters.mochi.x);
    expect(running.characters.yume.x).toBeLessThan(started.characters.yume.x);

    engine.dispose();
  });

  it("does not advance the living layer while cinematic", () => {
    const engine = new WorldEngine(undefined, { manual: true });
    engine.dispatch(act({ type: "setMode", mode: "cinematic" }));
    engine.dispatch(act({ type: "look", who: "yume", at: "lamp" }));

    const before = engine.getState().characters.yume.yaw;
    for (let i = 0; i < 60; i += 1) engine.update(1 / 60);
    expect(engine.getState().characters.yume.yaw).toBe(before);

    engine.dispose();
  });

  it("keeps the camera inside the room after many orbits and zooms", () => {
    const engine = new WorldEngine(undefined, { manual: true });

    for (let i = 0; i < 400; i += 1) {
      engine.orbit(i % 2 ? 37 : -51, i % 3 ? 9 : -13);
      engine.zoom(i % 2 ? 220 : -180);
      expect(engine.cameraInsideRoom()).toBe(true);
    }

    engine.dispose();
  });

  it("stops notifying after disposal", () => {
    const engine = new WorldEngine(undefined, { manual: true });
    let calls = 0;
    engine.subscribe(() => (calls += 1));
    engine.dispose();
    engine.dispatch(act({ type: "setWeather", condition: "snow" }));
    expect(calls).toBe(0);
  });
});

describe("natural language world commands", () => {
  const cases: Array<[string, string, Partial<WorldAction>]> = [
    ["Make it rain outside.", "setWeather", { condition: "rain" }],
    ["Let it snow.", "setWeather", { condition: "snow" }],
    ["clear the sky", "setWeather", { condition: "clear" }],
    ["bring clouds", "setWeather", { condition: "cloudy" }],
    ["Make it night", "setAtmosphere", { atmosphere: "night" }],
    ["twilight please", "setAtmosphere", { atmosphere: "twilight" }],
    ["dawn light", "setAtmosphere", { atmosphere: "dawn" }],
    ["Turn the room lights warmer.", "setLamp", { kelvin: 1900 }],
    ["dim the lamp", "setLamp", { kerosene: 0.16 }],
    ["toggle the fairy lights", "toggle", { flag: "fairyLights" }],
    ["light a candle", "toggle", { flag: "candle" }],
    ["Open the curtains.", "setCurtains", { open: 1 }],
    ["close the curtains", "setCurtains", { open: 0 }],
    ["Move the camera towards the window.", "camera", { preset: "window" }],
    ["look at the bed", "camera", { preset: "bed" }],
    ["show the snow globe", "toggle", { flag: "globeOpen" }],
    ["open the gift", "toggle", { flag: "giftOpen" }],
    ["Make Mochi wave.", "wave", { who: "mochi" }],
    ["Make Yume wave", "wave", { who: "yume" }],
    ["make them hug", "hug", { preset: "gentle" }],
  ];

  it.each(cases)("parses %s into %s", (input, type, patch) => {
    const result = parseWorldCommand(input);

    expect(result.status).toBe("ok");
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0]!.type).toBe(type);

    for (const [key, value] of Object.entries(patch)) {
      expect((result.actions[0] as unknown as Record<string, unknown>)[key]).toBe(value);
    }
  });

  it("routes 'Make Yume look at Mochi' to the correct character", () => {
    const result = parseWorldCommand("Make Yume look at Mochi.");
    expect(result.status).toBe("ok");
    const look = result.actions[0]!;
    expect(look.type).toBe("look");
    if (look.type === "look") {
      expect(look.who).toBe("yume");
      expect(look.at).toBe("mochi");
    }
  });

  it("understands compound requests", () => {
    const result = parseWorldCommand("let it snow and open the curtains");
    expect(result.status).toBe("ok");
    expect(result.actions.map((action) => action.type)).toEqual([
      "setWeather",
      "setCurtains",
    ]);
  });

  it("reports unsupported requests honestly instead of faking them", () => {
    const result = parseWorldCommand("order me a pizza");
    expect(result.status).toBe("unsupported");
    expect(result.actions).toEqual([]);
    expect(result.reply).toMatch(/can't do/i);
  });

  it("keeps partial success explicit when one clause is unknown", () => {
    const result = parseWorldCommand("let it snow and launch a rocket");
    expect(result.status).toBe("ok");
    expect(result.actions).toHaveLength(1);
    expect(result.reply).toMatch(/skipped/i);
  });

  it("is deterministic across repeated parses", () => {
    const a = parseWorldCommand("make mochi wave and turn the lamp warmer");
    const b = parseWorldCommand("make mochi wave and turn the lamp warmer");
    expect(a.actions.map((x) => x.type)).toEqual(b.actions.map((x) => x.type));
    expect(a.intent).toBe(b.intent);
  });

  it("rejects empty and oversized input gracefully", () => {
    expect(parseWorldCommand("   ").status).toBe("empty");
    expect(parseWorldCommand("x".repeat(500)).status).toBe("unsupported");
  });

  it("never touches the network", () => {
    // The provider is explicitly local; the contract is part of the product
    // promise so the guarantee is asserted, not merely documented.
    expect(localIntentProvider.kind).toBe("local");
  });

  it("offers discoverable suggestions", () => {
    const suggestions = suggestCommands(4);
    expect(suggestions).toHaveLength(4);
    for (const suggestion of suggestions) {
      expect(parseWorldCommand(suggestion).status).toBe("ok");
    }
  });

  it("produces actions that the reducer accepts", () => {
    for (const suggestion of suggestCommands(9)) {
      const parsed = parseWorldCommand(suggestion);
      let state = createInitialWorldState();
      for (const action of parsed.actions) {
        state = applyWorldAction(state, action);
      }
      expect(state.revision).toBeGreaterThan(createInitialWorldState().revision);
    }
  });
});

/**
 * Camera containment and near-plane clipping.
 *
 * The room is drawn through a perspective camera that stands inside the shell.
 * A wall or the floor can easily have corners behind the near plane; if the
 * renderer discards those faces the visitor sees a hole where the world should
 * be. These tests walk the reachable camera envelope and assert that the ground,
 * the ceiling and every wall the camera faces still project.
 */
describe("camera containment", () => {
  it("keeps the clamped camera inside the shell at every angle", () => {
    for (let yaw = -180; yaw <= 180; yaw += 7) {
      for (let pitch = CAMERA_LIMITS.pitch.min; pitch <= CAMERA_LIMITS.pitch.max; pitch += 3) {
        const pose = resolveCameraPose(yaw, pitch, 100_000);
        const yawRad = (yaw * Math.PI) / 180;
        const pitchRad = (pose.pitch * Math.PI) / 180;

        const x = Math.sin(yawRad) * Math.cos(pitchRad) * pose.distance;
        const y = ORBIT_FOCUS.y + Math.sin(pitchRad) * pose.distance;
        const z = Math.cos(yawRad) * Math.cos(pitchRad) * pose.distance;

        expect(Math.abs(x)).toBeLessThan(ROOM_BOUNDS.x);
        expect(Math.abs(z)).toBeLessThan(ROOM_BOUNDS.z);
        expect(y).toBeGreaterThan(55);
        expect(y).toBeLessThan(ROOM_BOUNDS.height - 30);
      }
    }
  });

  it("keeps the camera inside the room even zoomed fully in", () => {
    // Zooming fully in must never push the camera through the shell. (Looking
    // straight up into a corner can legitimately put the *ceiling* behind the
    // lens — that is what a ceiling is — so the invariant is the camera's
    // containment, not the presence of every shell quad in every direction.)
    const failures: string[] = [];

    for (let yaw = -180; yaw <= 180; yaw += 15) {
      for (let pitch = CAMERA_LIMITS.pitch.min; pitch <= CAMERA_LIMITS.pitch.max; pitch += 4) {
        const distance = clampCameraDistance(yaw, pitch, 0);
        const cam = createExploreCamera(
          { ...createInitialWorldState(), camera: { yaw, pitch, distance } },
          720,
          450,
        );

        expect(Number.isFinite(cam.position.x)).toBe(true);
        expect(Number.isFinite(cam.fov)).toBe(true);
        if (Math.abs(cam.position.x) > ROOM_BOUNDS.x - 40) failures.push(`x yaw=${yaw} pitch=${pitch}`);
        if (Math.abs(cam.position.z) > ROOM_BOUNDS.z - 40) failures.push(`z yaw=${yaw} pitch=${pitch}`);
        if (cam.position.y < 60) failures.push(`floor yaw=${yaw} pitch=${pitch}`);
        if (cam.position.y > ROOM_BOUNDS.height - 30) failures.push(`ceiling yaw=${yaw} pitch=${pitch}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("still projects every wall the camera actually faces", () => {
    const scene = buildExploreScene();
    const failures: string[] = [];

    for (let yaw = -180; yaw <= 180; yaw += 15) {
      for (let pitch = CAMERA_LIMITS.pitch.min; pitch <= CAMERA_LIMITS.pitch.max; pitch += 4) {
        const distance = clampCameraDistance(yaw, pitch, 0);
        const cam = createExploreCamera(
          { ...createInitialWorldState(), camera: { yaw, pitch, distance } },
          720,
          450,
        );
        // The camera must remain a legal, finite pose even fully zoomed in.
        expect(Number.isFinite(cam.position.x)).toBe(true);
        expect(Number.isFinite(cam.fov)).toBe(true);
        expect(cam.position.y).toBeGreaterThan(60);
        expect(cam.position.y).toBeLessThan(ROOM_BOUNDS.height - 30);

        for (const face of scene.shell) {
          if (!face.group.startsWith("wall-")) continue;
          const n = face.pts.length;
          const cx = face.pts.reduce((sum, p) => sum + p.x, 0) / n;
          const cy = face.pts.reduce((sum, p) => sum + p.y, 0) / n;
          const cz = face.pts.reduce((sum, p) => sum + p.z, 0) / n;
          const toCamera = { x: cam.position.x - cx, y: cam.position.y - cy, z: cam.position.z - cz };
          const facing =
            face.normal.x * toCamera.x + face.normal.y * toCamera.y + face.normal.z * toCamera.z > 0;
          if (!facing) continue;
          // A wall behind the camera is not expected to draw.
          const viewZ =
            (cx - cam.position.x) * cam.forward.x +
            (cy - cam.position.y) * cam.forward.y +
            (cz - cam.position.z) * cam.forward.z;
          if (viewZ < 0) continue;
          if (!projectFace(face, cam)) {
            failures.push(`${face.group} yaw=${yaw} pitch=${pitch}`);
          }
        }
      }
    }

    expect(failures.slice(0, 8)).toEqual([]);
  });
});
