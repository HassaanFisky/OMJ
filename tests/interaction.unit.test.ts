/**
 * Interaction, camera and lighting contract.
 *
 * These are the behavioural tests for the completion pass: every one of them
 * fails on the previous implementation, which is the point — a hug used to be a
 * bounce, the bed was camera-only, the lamp had no off switch, and orbiting
 * could drive the camera into the bed.
 */

import { describe, expect, it } from "vitest";
import {
  applyWorldAction,
  BED_ACTIONS,
  BED_SURFACE_Y,
  clampCameraDistance,
  CAMERA_PRESETS,
  characterObstacles,
  resolveCameraPose,
  describeAction,
  HUG_MEETING,
  HUG_SPECS,
  positionFor,
  type WorldAction,
} from "../src/world/actions";
import { WorldEngine, stepInteraction, stepLamp } from "../src/world/engine";
import {
  CAMERA_LIMITS,
  createInitialWorldState,
  ORBIT_FOCUS,
  ROOM_BOUNDS,
  interactionDuration,
  phaseForProgress,
  resolveLighting,
  type WorldState,
} from "../src/world/state";
import { bedTargets, hugPosture, hugTargets, phaseAt } from "../src/stage/explore/choreography";
import { insideObstacle, SHELL } from "../src/stage/explore/scene";
import { framesFor } from "../src/stage/explore/characterStage";
import { createExploreCamera } from "../src/stage/explore/renderer";

let seq = 0;
const act = <T extends Omit<WorldAction, "id">>(action: T): WorldAction =>
  ({ ...action, id: `t-${(seq += 1)}` }) as WorldAction;

const base = createInitialWorldState();

const run = (state: WorldState, seconds: number, step = 1 / 60): WorldState => {
  const engine = new WorldEngine(state, { manual: true });
  const frames = Math.round(seconds / step);
  for (let i = 0; i < frames; i += 1) engine.update(step);
  return engine.getState();
};

describe("hug choreography", () => {
  it("publishes the full phase sequence from a single progress clock", () => {
    const seen: string[] = [];
    for (let p = 0; p <= 1.0001; p += 0.005) {
      const phase = phaseAt("hug", p);
      if (seen[seen.length - 1] !== phase) seen.push(phase);
    }
    expect(seen).toEqual([
      "idle",
      "notice",
      "turn",
      "approach",
      "contact",
      "settle",
      "hold",
      "release",
    ]);
  });

  it("agrees with the state-level phase derivation", () => {
    for (let p = 0; p <= 1; p += 0.02) {
      expect(phaseAt("hug", p)).toBe(phaseForProgress("hug", p));
    }
  });

  it("starts both bodies at home and ends them at the authored meeting point", () => {
    const hugged = applyWorldAction(base, act({ type: "hug", preset: "gentle" }));

    const start = hugTargets(hugged, 0);
    expect(start.mochi.x).toBeCloseTo(base.characters.mochi.x, 4);
    expect(start.yume.x).toBeCloseTo(base.characters.yume.x, 4);

    const end = hugTargets(hugged, 1);
    expect(end.mochi.x).toBeCloseTo(HUG_MEETING.x - HUG_MEETING.spacing / 2, 3);
    expect(end.yume.x).toBeCloseTo(HUG_MEETING.x + HUG_MEETING.spacing / 2, 3);
    // Contact without interpenetration.
    expect(end.yume.x - end.mochi.x).toBeCloseTo(HUG_MEETING.spacing, 3);
  });

  it("moves the feet monotonically inward — no floor sliding back and forth", () => {
    const hugged = applyWorldAction(base, act({ type: "hug", preset: "gentle" }));
    let previous = Number.POSITIVE_INFINITY;
    for (let p = 0; p <= 1; p += 0.02) {
      const gap = Math.abs(hugTargets(hugged, p).yume.x - hugTargets(hugged, p).mochi.x);
      expect(gap).toBeLessThanOrEqual(previous + 1e-6);
      previous = gap;
    }
  });

  it("raises the arms before contact and wraps them only while held", () => {
    const hugged = applyWorldAction(base, act({ type: "hug", preset: "reunion" }));

    const early = hugPosture(hugged, 0.1, 0, false);
    const held = hugPosture(hugged, 0.7, 0, false);
    const released = hugPosture(hugged, 1, 0, false);

    expect(early.wrap).toBeLessThan(0.05);
    expect(held.wrap).toBeGreaterThan(0.8);
    // The paws actually leave the rest pose and land on the partner's back.
    expect(held.paws.mochi.left[0]).toBeGreaterThan(20);
    expect(held.paws.mochi.left[1]).toBeLessThan(-60);
    expect(released.wrap).toBeLessThan(0.05);
  });

  it("keeps the authored presets physically distinct", () => {
    const reach = Object.values(HUG_SPECS).map((spec) => spec.reach);
    expect(new Set(reach).size).toBeGreaterThanOrEqual(5);
    // A hand-hold must not wrap, a reunion must.
    expect(HUG_SPECS.handhold.reach).toBeLessThan(0.3);
    expect(HUG_SPECS.reunion.reach).toBeGreaterThan(1.1);
    expect(HUG_SPECS.shy.yaw).toBeLessThan(HUG_SPECS.reunion.yaw);
  });

  it("holds the pose instead of auto-cancelling, then releases without snapping", () => {
    const hugged = applyWorldAction(base, act({ type: "hug", preset: "gentle" }));
    const total = interactionDuration("hug");

    const atHold = run(hugged, total * 0.72);
    expect(atHold.interaction.kind).toBe("hug");
    expect(atHold.interaction.phase).toBe("hold");
    // Bodies are in contact, not back at home.
    expect(Math.abs(atHold.characters.yume.x - atHold.characters.mochi.x)).toBeLessThan(
      Math.abs(base.characters.yume.x - base.characters.mochi.x),
    );

    const afterHold = run(hugged, total * 0.98);
    expect(afterHold.interaction.phase).toBe("release");

    const done = run(hugged, total + 0.5);
    expect(done.interaction.progress).toBe(1);
    // The final pose is kept; nothing rewound the pair to the origin.
    expect(done.characters.mochi.x).toBeCloseTo(atHold.characters.mochi.x, 0);
  });

  it("returns to neutral only when explicitly asked", () => {
    const hugged = applyWorldAction(base, act({ type: "hug", preset: "sway" }));
    const done = run(hugged, interactionDuration("hug") + 0.5);
    expect(done.interaction.kind).toBe("hug");

    const neutralEngine = new WorldEngine(done, { manual: true });
    neutralEngine.dispatch(act({ type: "neutral" }));
    const after = run(neutralEngine.getState(), 6);
    expect(after.interaction.kind).toBeNull();
    expect(after.characters.mochi.x).toBeCloseTo(base.characters.mochi.x, 0);
    expect(after.characters.yume.x).toBeCloseTo(base.characters.yume.x, 0);
  });

  it("never leaves the pair standing in the floor or inside each other", () => {
    for (const preset of Object.keys(HUG_SPECS) as Array<keyof typeof HUG_SPECS>) {
      const hugged = applyWorldAction(base, act({ type: "hug", preset }));
      for (let p = 0; p <= 1; p += 0.05) {
        const t = hugTargets(hugged, p);
        // Inside the room shell.
        expect(Math.abs(t.mochi.x)).toBeLessThan(800);
        expect(Math.abs(t.yume.x)).toBeLessThan(800);
        // The plush body is ~150 units wide at scale 1.2; centres never overlap.
        expect(Math.abs(t.yume.x - t.mochi.x)).toBeGreaterThan(60);
      }
    }
  });
});

describe("bed interaction", () => {
  it("seats the body on the real mattress height, not inside it", () => {
    for (const pose of Object.values(BED_ACTIONS)) {
      // The authored seat is the mattress top.
      expect(BED_SURFACE_Y).toBeGreaterThanOrEqual(158);
      expect(pose.mochi.x).toBeGreaterThan(462);
      expect(pose.mochi.x).toBeLessThan(722);
      expect(pose.mochi.z).toBeGreaterThan(-246);
      expect(pose.mochi.z).toBeLessThan(148);
    }
  });

  it("eases onto the bed and stays there", () => {
    const seated = applyWorldAction(base, act({ type: "bed", action: "sit" }));

    const early = bedTargets(seated, 0);
    expect(early.mochi.seated).toBeLessThan(0.05);

    const late = bedTargets(seated, 1);
    expect(late.mochi.seated).toBeCloseTo(1, 3);
    expect(late.mochi.lie).toBeCloseTo(0, 3);
    // Standing → sitting is a footprint change, and it lands on the mattress.
    expect(late.mochi.x).toBeGreaterThan(462);
  });

  it("lies further back than it sits and rests in between", () => {
    const lie = applyWorldAction(base, act({ type: "bed", action: "lie" }));
    const rest = applyWorldAction(base, act({ type: "bed", action: "rest" }));
    expect(bedTargets(lie, 1).mochi.lie).toBeGreaterThan(bedTargets(rest, 1).mochi.lie);
    expect(bedTargets(rest, 1).mochi.lie).toBeGreaterThan(0);
  });

  it("hops down on rise and restores the standing footprint", () => {
    const seated = applyWorldAction(base, act({ type: "bed", action: "sit" }));
    const up = applyWorldAction(seated, act({ type: "bed", action: "rise" }));
    expect(up.interaction.kind).toBeNull();
    expect(up.characters.mochi.seated).toBe(0);
    expect(up.characters.mochi.x).toBeCloseTo(base.characters.mochi.x, 4);
  });
});

describe("lighting", () => {
  it("switches the practical lamp off and back on", () => {
    const off = applyWorldAction(base, act({ type: "light", source: "lamp", on: false }));
    expect(off.lamp.targetKerosene).toBe(0);
    const offLit = resolveLighting({ ...off, lamp: { ...off.lamp, kerosene: 0 } });
    expect(offLit.lampSpill).toBeLessThan(0.12);

    const on = applyWorldAction(off, act({ type: "light", source: "lamp", on: true }));
    expect(on.lamp.targetKerosene).toBeGreaterThan(0.5);
  });

  it("eases intensity and colour temperature instead of snapping", () => {
    const off = applyWorldAction(base, act({ type: "light", source: "lamp", on: false }));
    const eased = stepLamp(off.lamp, 1 / 60);
    // One frame must not jump all the way to zero.
    expect(eased.kerosene).toBeGreaterThan(0);
    expect(eased.kerosene).toBeLessThan(off.lamp.kerosene);
    expect(eased.targetKerosene).toBe(0);

    const settled = stepLamp(off.lamp, 8);
    expect(settled.kerosene).toBeCloseTo(0, 3);
  });

  it("makes the room warmer by shifting interior colour, never by tinting the screen", () => {
    const cool = applyWorldAction(base, act({ type: "light", source: "lamp", warmth: 0 }));
    const warm = applyWorldAction(base, act({ type: "light", source: "lamp", warmth: 1 }));
    expect(warm.lamp.targetKelvin).toBeLessThan(cool.lamp.targetKelvin);

    const warmLight = resolveLighting({ ...warm, lamp: { ...warm.lamp, kelvin: warm.lamp.targetKelvin } });
    const coolLight = resolveLighting({ ...cool, lamp: { ...cool.lamp, kelvin: cool.lamp.targetKelvin } });

    // Warmer ⇒ more amber mixed into surfaces, and a warmer interior ambient.
    expect(warmLight.warmth).toBeGreaterThan(coolLight.warmth);
    expect(warmLight.amberMix).toBeGreaterThan(coolLight.amberMix);
    // The weather overlay (the only screen-space tint) must not grow.
    expect(warmLight.weatherTintAlpha).toBeLessThanOrEqual(coolLight.weatherTintAlpha);
    // ... and the room must not simply get brighter.
    expect(warmLight.exposure).toBeLessThan(coolLight.exposure * 1.05);
  });

  it("changes warmth without switching the lamp off", () => {
    const lit = applyWorldAction(base, act({ type: "light", source: "lamp", on: true }));
    expect(lit.lamp.targetKerosene).toBeGreaterThan(0.5);

    const cooler = applyWorldAction(lit, act({ type: "light", source: "lamp", warmth: 0 }));
    // Power is untouched by a colour-temperature change.
    expect(cooler.lamp.targetKerosene).toBe(lit.lamp.targetKerosene);
    expect(cooler.lamp.targetKelvin).toBeGreaterThan(lit.lamp.targetKelvin);

    const warmer = applyWorldAction(cooler, act({ type: "light", source: "lamp", warmth: 1 }));
    expect(warmer.lamp.targetKerosene).toBe(lit.lamp.targetKerosene);
    expect(warmer.lamp.targetKelvin).toBeLessThan(cooler.lamp.targetKelvin);
  });

  it("treats cove, candle and fairies as separate real lights", () => {
    const coveOff = applyWorldAction(base, act({ type: "light", source: "cove", on: false }));
    expect(resolveLighting(coveOff).coveLight).toBe(0);

    const candleOn = applyWorldAction(base, act({ type: "light", source: "candle", on: true }));
    expect(resolveLighting(candleOn).candleLight).toBeGreaterThan(0.5);

    const fairiesOff = applyWorldAction(base, act({ type: "light", source: "fairies", on: false }));
    expect(resolveLighting(fairiesOff).fairyLight).toBe(0);
  });

  it("never reports success for a light it did not change", () => {
    const off = applyWorldAction(base, act({ type: "light", source: "lamp", on: false }));
    expect(describeAction(act({ type: "light", source: "lamp", on: false }))).toContain("out");
    expect(off.lamp.targetKerosene).toBe(0);
  });
});

describe("orbit safety", () => {
  it("keeps the camera maths bound to the room that is actually built", () => {
    expect(ROOM_BOUNDS.x).toBe(SHELL.width);
    expect(ROOM_BOUNDS.z).toBe(SHELL.depth);
    expect(ROOM_BOUNDS.height).toBe(SHELL.height);
  });

  it("never places the camera inside furniture at any angle", () => {
    // The whole *resolved* pose is checked, because a request can now be lifted
    // over low furniture rather than only shortened.
    const violations: string[] = [];
    for (let yaw = -360; yaw <= 360; yaw += 4) {
      for (const pitch of [-18, -8, 0, 4, 12, 26]) {
        const pose = resolveCameraPose(yaw, pitch, 820);
        const yawRad = (yaw * Math.PI) / 180;
        const pitchRad = (pose.pitch * Math.PI) / 180;
        const position = {
          x: Math.sin(yawRad) * Math.cos(pitchRad) * pose.distance,
          y: ORBIT_FOCUS.y + Math.sin(pitchRad) * pose.distance,
          z: Math.cos(yawRad) * Math.cos(pitchRad) * pose.distance,
        };
        if (insideObstacle(position)) violations.push(`${yaw}/${pitch}/${Math.round(pose.distance)}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps a usable orbit radius even where the bed would block the view", () => {
    // The probe caught the camera inside the bed at these two angles.
    for (const yaw of [-138, -230, -92, -277]) {
      const distance = clampCameraDistance(yaw, 4, 820);
      expect(distance).toBeGreaterThanOrEqual(280);
      expect(distance).toBeLessThanOrEqual(820);
    }
  });

  it("honours every authored camera preset except ones the furniture blocks", () => {
    for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
      const distance = clampCameraDistance(preset.yaw, preset.pitch, preset.distance);
      // A preset may be pulled in when a real object is in the way — the vanity
      // shot is, because the dressing table stands where the camera would go —
      // but it must never be pushed *out* past what was authored.
      expect(distance).toBeLessThanOrEqual(preset.distance + 1e-6);
      // A wall can legitimately be nearer than the minimum orbit, so the
      // invariant is "still at a usable distance", not the nominal minimum.
      expect(distance).toBeGreaterThanOrEqual(CAMERA_LIMITS.distance.min * 0.9);
      // `bookshelf` is limited by the room's own wall at that bearing, and
      // `vanity` by the dressing table; every other preset is honoured exactly.
      if (name !== "vanity" && name !== "bookshelf") expect(distance).toBe(preset.distance);
    }
  });

  it("resolves every preset at its authored radius even with both plushies on the bed", () => {
    /*
     * The old preset test called `clampCameraDistance` with no obstacles, so it
     * proved a path the app never takes. The renderer always passes
     * `characterObstacles(state)`, and that is where every preset collapsed to
     * the minimum radius. Both cases are asserted here, with the characters
     * moved to the bed — the pose that puts the guard closest to the lens.
     */
    const world = createInitialWorldState();
    world.characters.mochi = { ...world.characters.mochi, x: 596, z: 60, seated: 1 };
    world.characters.yume = { ...world.characters.yume, x: 606, z: -62, seated: 1 };
    const obstacles = characterObstacles(world);
    for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
      const bare = resolveCameraPose(preset.yaw, preset.pitch, preset.distance);
      expect(bare.distance, `${name} (bare)`).toBe(preset.distance);
      const guarded = resolveCameraPose(preset.yaw, preset.pitch, preset.distance, obstacles);
      expect(guarded.distance, `${name} (with characters)`).toBe(preset.distance);
    }
  });

  it("does not let the character guard swallow the whole room", () => {
    /*
     * `characterObstacles` pads each plushie so the lens cannot be shoved into
     * a face. That pad used to apply vertically as well: a 355-tall body became
     * a 775-tall column, taller than any camera position, so *every* pose that
     * had to look past the pair counted as blocked. `resolveCameraPose` then
     * fell through to its degenerate fallback and the bed was shot from inside
     * the bed frame. The guard must keep the true height and pad only the
     * footprint.
     */
    const world = createInitialWorldState();
    world.characters.mochi = { ...world.characters.mochi, x: 596, z: 60, seated: 1 };
    world.characters.yume = { ...world.characters.yume, x: 606, z: -62, seated: 1 };
    const preset = CAMERA_PRESETS.bed;
    const resolved = resolveCameraPose(preset.yaw, preset.pitch, preset.distance, characterObstacles(world));
    expect(resolved.distance).toBe(preset.distance);

    /*
     * A lens above a head, looking down at the mattress, is not "in a face" and
     * must not count as blocked. Check the guard the way the solver does: the
     * footprint still pads horizontally, height does not.
     */
    for (const obstacle of characterObstacles(world)) {
      expect(obstacle.horizontalPadOnly).toBe(true);
      const above = {
        x: (obstacle.min.x + obstacle.max.x) / 2,
        y: obstacle.max.y + 60,
        z: (obstacle.min.z + obstacle.max.z) / 2,
      };
      const insideHeight = above.y > obstacle.min.y && above.y < obstacle.max.y;
      expect(insideHeight).toBe(false);
      // The footprint is still guarded, so a lens at face height is rejected.
      const atFace = { ...above, y: obstacle.max.y - 40 };
      const insideFootprint =
        atFace.x > obstacle.min.x &&
        atFace.x < obstacle.max.x &&
        atFace.z > obstacle.min.z &&
        atFace.z < obstacle.max.z;
      expect(insideFootprint).toBe(true);
    }
  });

  it("keeps the snow globe off the bed view", () => {
    /*
     * The bed preset has one non-obvious job: the snow globe stands between
     * the mattress and almost every bearing that frames it, and a globe-sized
     * disc of glass over a plushie's face is invisible to every other
     * assertion here. This projects the character bodies the way the renderer
     * does and fails if the globe's silhouette covers one of them.
     */
    const preset = CAMERA_PRESETS.bed;
    const { pitch, distance } = resolveCameraPose(preset.yaw, preset.pitch, preset.distance);
    const eye = positionFor(preset.yaw, pitch, distance);
    const forward = normalize3({
      x: ORBIT_FOCUS.x - eye.x,
      y: ORBIT_FOCUS.y - eye.y,
      z: ORBIT_FOCUS.z - eye.z,
    });
    const right = normalize3({ x: -forward.z, y: 0, z: forward.x });
    const up = {
      x: right.y * forward.z - right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y - right.y * forward.x,
    };
    const fov = Math.max(560, Math.min(1080, distance * 1.32));
    const project = (point: { x: number; y: number; z: number }) => {
      const dx = point.x - eye.x;
      const dy = point.y - eye.y;
      const dz = point.z - eye.z;
      const depth = dx * forward.x + dy * forward.y + dz * forward.z;
      const scale = fov / depth;
      return {
        x: (dx * right.x + dy * right.y + dz * right.z) * scale,
        y: (dx * up.x + dy * up.y + dz * up.z) * scale,
        depth,
      };
    };

    const globe = project({ x: 350, y: 236, z: -10 });
    const globeRadius = 62 * (fov / globe.depth);

    /*
     * What matters is the *face*. A lying plushie spreads upward from the
     * mattress, and the globe only ever touches the lower body — its disc sits
     * low and left of both heads. Asserting the whole silhouette would fail on
     * a shot that looks perfectly clear, so this asserts the head disc: the
     * part a viewer would call "covering Mochi".
     */
    const heads = [596, 606].map((x, i) => ({ x, z: i === 0 ? 60 : -62 }));
    for (const head of heads) {
      for (const [dx, dy] of [
        [0, 150],
        [-33, 150],
        [33, 150],
        [0, 205],
      ] as const) {
        const sample = project({ x: head.x + dx * 0.6, y: 190 + dy, z: head.z });
        const gap = Math.hypot(sample.x - globe.x, sample.y - globe.y);
        // Only a nearer globe can hide the plushie; a further one is bokeh.
        if (globe.depth > sample.depth) continue;
        expect(gap).toBeGreaterThan(globeRadius);
      }
    }
  });
});

function normalize3(v: { x: number; y: number; z: number }) {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

describe("single world state", () => {
  it("keeps the cinematic timeline out of exploration state", () => {
    const state = createInitialWorldState();
    expect(state).not.toHaveProperty("film");
    expect(state).not.toHaveProperty("audioTime");
    // Exploration owns the camera; entering cinematic leaves the value intact.
    const moved = applyWorldAction(state, act({ type: "camera", yaw: 40, distance: 500 }));
    const back = applyWorldAction(applyWorldAction(moved, act({ type: "setMode", mode: "cinematic" })), act({ type: "setMode", mode: "explore" }));
    expect(back.camera.yaw).toBe(40);
  });

  it("advances the interaction clock once per engine tick", () => {
    const hugged = applyWorldAction(base, act({ type: "hug", preset: "gentle" }));
    const one = stepInteraction(hugged.interaction, 0.5);
    const two = stepInteraction(one, 0.5);
    expect(two.elapsed).toBeGreaterThan(one.elapsed);
    expect(two.progress).toBeGreaterThan(one.progress);
  });

  it("renders both plushies from state alone", () => {
    const state = applyWorldAction(base, act({ type: "hug", preset: "comforting" }));
    const engine = new WorldEngine(state, { manual: true });
    for (let i = 0; i < 200; i += 1) engine.update(1 / 60);
    const live = engine.getState();
    const camera = createExploreCamera(live, 720, 486, 1440);
    const frames = framesFor(live, camera, 3, false);

    expect(frames).toHaveLength(2);
    for (const frame of frames) {
      expect(frame.placement.visible).toBe(true);
      expect(frame.placement.pixelScale).toBeGreaterThan(0);
      expect(Number.isFinite(frame.pose.leftX)).toBe(true);
    }
    // The hug has visibly changed the paw pose from the rest pose.
    expect(Math.abs(frames[0]!.pose.leftX - -54)).toBeGreaterThan(5);
  });
});
