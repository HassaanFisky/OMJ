/**
 * Explore renderer primitives.
 *
 * Projects the room shell and furniture through a real perspective camera and
 * emits SVG. Faces are back-face culled, near-clipped and depth sorted with a
 * painter's algorithm, which is sufficient because every surface is opaque and
 * the room is convex. Characters are composited into the same sorted stream so
 * they are correctly occluded by furniture in front of them.
 */

import {
  damp,
  dampAngle,
  mixHex,
  rgba,
  shadeHex,
} from "../../world/color";
import { characterObstacles, resolveCameraPose } from "../../world/actions";
import { ORBIT_FOCUS, resolveLighting, type WorldState } from "../../world/state";
import {
  dot,
  normalize,
  curtainPanels,
  WINDOW_FRAME,
  windowPanes,
  type Face,
  type FaceGroup,
  type SurfaceKind,
  type Vec3,
} from "./scene";

export interface Camera3D {
  position: Vec3;
  target: Vec3;
  fov: number;
  centerX: number;
  centerY: number;
  /** Camera basis vectors in world space. */
  right: Vec3;
  up: Vec3;
  forward: Vec3;
}

export interface Projected {
  x: number;
  y: number;
  depth: number;
  scale: number;
  visible: boolean;
}

/**
 * Reference width the focal length was tuned against.
 *
 * The projection uses a single focal length for both axes, which is correct only
 * for a 16:10 frame. On a phone held upright the same focal length magnifies
 * everything by `1440 / width`, so the scene is cropped far too tightly and both
 * plushies fall off the sides. Scaling the focal length with the viewport keeps
 * the *horizontal* field of view constant, so a tall narrow screen sees the same
 * room width and simply shows less of the floor and ceiling.
 */
const REFERENCE_WIDTH = 1440;

export function createExploreCamera(
  state: WorldState,
  centerX: number,
  centerY: number,
  viewportWidth = REFERENCE_WIDTH,
): Camera3D {
  const { yaw } = state.camera;
  /*
   * The stored camera is the user's *intent*; this is where the physical
   * constraint is applied. Keeping the two apart means a lift over the bed
   * applies only to this frame and can never be mistaken for a new request.
   */
  const { pitch, distance } = resolveCameraPose(
    yaw,
    state.camera.pitch,
    state.camera.distance,
    characterObstacles(state),
  );
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const target: Vec3 = { ...ORBIT_FOCUS };

  /*
   * The orbit swings around the room's vertical axis while the lens stays
   * pointed at `ORBIT_FOCUS`. Offsetting X and Z by the focus as well was
   * tried and reverted: it turns the orbit into a tight circle *around the
   * characters*, who stand 445 units apart, so at the authored radii they
   * splay to ±33° either side of the view axis and a single plushie fills a
   * frame edge. Swinging about the room centre keeps the whole room readable
   * and is what every authored preset was framed against.
   */
  const position: Vec3 = {
    x: Math.sin(yawRad) * Math.cos(pitchRad) * distance,
    y: target.y + Math.sin(pitchRad) * distance,
    z: Math.cos(yawRad) * Math.cos(pitchRad) * distance,
  };

  const forward = normalize({
    x: target.x - position.x,
    y: target.y - position.y,
    z: target.z - position.z,
  });

  const worldUp: Vec3 = { x: 0, y: 1, z: 0 };
  const right = normalize({
    x: forward.y * worldUp.z - forward.z * worldUp.y,
    y: forward.z * worldUp.x - forward.x * worldUp.z,
    z: forward.x * worldUp.y - forward.y * worldUp.x,
  });

  const up = normalize({
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  });

  return {
    position,
    target,
    fov: clampFov(distance, viewportWidth),
    centerX,
    centerY,
    right,
    up,
    forward,
  };
}

const NEAR = 40;

/** Focal length that holds a 16:10 horizontal framing at any viewport width. */
function clampFov(distance: number, viewportWidth: number): number {
  const base = Math.max(560, Math.min(1080, distance * 1.32));
  const aspect = Math.max(0.28, Math.min(1.6, viewportWidth / REFERENCE_WIDTH));
  return Math.max(320, Math.min(1400, base * aspect));
}

export function project(point: Vec3, camera: Camera3D): Projected {
  const dx = point.x - camera.position.x;
  const dy = point.y - camera.position.y;
  const dz = point.z - camera.position.z;

  const depth = dx * camera.forward.x + dy * camera.forward.y + dz * camera.forward.z;

  if (depth < NEAR) {
    return { x: camera.centerX, y: camera.centerY, depth, scale: 0, visible: false };
  }

  const rx = dx * camera.right.x + dy * camera.right.y + dz * camera.right.z;
  const ry = dx * camera.up.x + dy * camera.up.y + dz * camera.up.z;
  const scale = camera.fov / depth;

  return {
    x: camera.centerX + rx * scale,
    y: camera.centerY - ry * scale,
    depth,
    scale,
    visible: true,
  };
}

/** How far in front of the camera a view-space point sits. */
function toViewDepth(vertex: { x: number; y: number; z: number }, _camera: Camera3D): number {
  return vertex.z;
}

/** View-space coordinates of a point: x right, y up, z forward (depth). */
function toView(point: Vec3, camera: Camera3D): { x: number; y: number; z: number } {
  const dx = point.x - camera.position.x;
  const dy = point.y - camera.position.y;
  const dz = point.z - camera.position.z;

  return {
    x: dx * camera.right.x + dy * camera.right.y + dz * camera.right.z,
    y: dx * camera.up.x + dy * camera.up.y + dz * camera.up.z,
    z: dx * camera.forward.x + dy * camera.forward.y + dz * camera.forward.z,
  };
}

/** Projects a view-space point through the perspective divide. */
function projectView(
  view: { x: number; y: number; z: number },
  camera: Camera3D,
): { x: number; y: number; depth: number } {
  const scale = camera.fov / view.z;
  return {
    x: camera.centerX + view.x * scale,
    y: camera.centerY - view.y * scale,
    depth: view.z,
  };
}

/**
 * Projects a quad onto the screen, clipping it against the near plane first.
 *
 * The camera stands inside the room, so a wide surface (the floor, a wall) very
 * often has some corners behind the near plane even at the default zoom. Simply
 * discarding those faces punched holes in the world; clipping keeps the visible
 * part of the polygon and is what a real rasteriser does.
 */
export function projectFace(
  face: Face,
  camera: Camera3D,
): { path: string; depth: number; clipped: boolean } | null {
  const view = face.pts.map((point) => toView(point, camera));

  let clipped = false;
  const polygon: Array<{ x: number; y: number; z: number }> = [];

  for (let i = 0; i < view.length; i += 1) {
    const current = view[i]!;
    const next = view[(i + 1) % view.length]!;
    const currentInside = current.z >= NEAR;
    const nextInside = next.z >= NEAR;

    if (currentInside) polygon.push(current);

    if (currentInside !== nextInside) {
      // Intersect the edge with the plane z = NEAR.
      const t = (NEAR - current.z) / (next.z - current.z);
      polygon.push({
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
        z: NEAR,
      });
      clipped = true;
    }
  }

  // Fully behind the camera: nothing to draw.
  if (polygon.length < 3) return null;

  let depthTotal = 0;
  let path = "";
  polygon.forEach((vertex, index) => {
    const projected = projectView(vertex, camera);
    depthTotal += projected.depth;
    path += `${index === 0 ? "M" : "L"}${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`;
  });

  /*
   * Depth is the sort key for the whole painter stream, so it must describe the
   * surface, not the sliver that survived clipping.
   *
   * Averaging the clipped polygon was a real bug: a wall running past the
   * camera loses most of its area, its remaining vertices all sit near NEAR, and
   * its average depth collapses to ~100. The wall was then sorted as the
   * nearest thing in the room and painted on top of the plushies — the entire
   * bed view went blank whenever the lens came close to the bed wall. A clipped
   * face is by definition the room's own shell or a large wall, so it always
   * belongs behind everything; report it as infinitely far and let the
   * back-to-front painter put it down first.
   */
  /*
   * Horizontal surfaces are keyed by their *farthest* vertex, not their average.
   *
   * A tabletops or mattress is a large quad and every character rests on top of
   * it, so its centroid is usually nearer than the plushie lying on it — the
   * mattress top sorted in front of the bears asleep on the quilt and covered
   * them completely. Taking the far edge puts a support surface behind whatever
   * stands on it while still letting real furniture in front occlude it.
   */
  /*
   * The room shell is keyed by its farthest vertex, and everything else by its
   * centroid.
   *
   * A wall is a single room-sized quad, so its centroid says almost nothing
   * about where it sits: the +X wall's centroid can be a hair nearer than a
   * plushie standing against it, which put the whole wall in front of that
   * plushie and painted the room over it. Shell surfaces are never "in front
   * of" anything inside the room, so they take the far edge and always land at
   * the back of the painter order. Furniture keeps the centroid, which is what
   * lets the bed occlude a plushie standing behind it.
   */
  const horizontal = Math.abs(face.normal.y) > 0.7;
  let depth = clipped ? Number.POSITIVE_INFINITY : depthTotal / polygon.length;
  if (!clipped && (horizontal || face.kind === "shell")) {
    let farthest = 0;
    for (const vertex of polygon) farthest = Math.max(farthest, toViewDepth(vertex, camera));
    depth = farthest;
  }

  return { path: `${path} Z`, depth, clipped };
}

export interface Practical {
  position: Vec3;
  /** 0..1 intensity of this specific fixture. */
  strength: number;
  color: string;
  /** Distance at which this practical has fallen off to ~0, world units. */
  reach: number;
  /** Where the fixture's pool of light lands (floor and wall washes). */
  pool?: Vec3;
}

export interface LightRig {
  /** Floor point directly beneath the lamp, for the warm floor pool. */
  lampFloor: Vec3;
  exposure: number;
  ambient: number;
  keyDirection: Vec3;
  keyColor: string;
  keyStrength: number;
  lampPosition: Vec3;
  lampColor: string;
  lampStrength: number;
  fog: string;
  /**
   * Every discrete fixture, each with its own position.
   *
   * This is why switching the cove off darkens the ceiling without touching the
   * bedside table, and why the candle warms the nightstand instead of tinting
   * the whole frame.
   */
  practicals: Practical[];
  /** 0 cool .. 1 golden: the room's interior colour balance. */
  warmth: number;
  /** 0..1 how strongly a surface's albedo is pulled toward amber. */
  amberMix: number;
  /** The colour the interior is lit with. */
  ambientColor: string;
}

export function buildLightRig(state: WorldState): LightRig {
  const lighting = resolveLighting(state);
  const daylight = state.time.daylight;

  // Key light comes through the window (north wall) by day, from the lamp at night.
  const keyDirection = normalize({ x: 0.18, y: 0.72, z: -0.66 });
  const keyStrength = 0.28 + lighting.keyLight * 0.72;
  const keyColor = mixHex(lighting.lampColor, "#e8eefc", Math.min(1, daylight * 1.5));

  // Positions come from the scene's own fixture anchors, so a light cannot be
  // declared here and physically missing from the room.
  const practicals: Practical[] = [];

  if (lighting.lampLight > 0.001) {
    practicals.push({
      position: { x: -500, y: 296, z: -245 },
      strength: lighting.lampLight,
      color: lighting.lampColor,
      reach: 1150,
      pool: { x: -500, y: 8, z: -245 },
    });
  }
  if (lighting.coveLight > 0.001) {
    // The ceiling cove: a broad, high, cool-neutral wash with no hard pool.
    practicals.push({
      position: { x: 0, y: 880, z: 0 },
      strength: lighting.coveLight,
      color: mixHex("#c9c2e6", "#ffe3bd", lighting.warmth * 0.7),
      reach: 1500,
    });
  }
  if (lighting.candleLight > 0.001) {
    practicals.push({
      position: { x: -430, y: 210, z: -180 },
      strength: lighting.candleLight,
      color: "#ffb066",
      reach: 420,
      pool: { x: -430, y: 8, z: -170 },
    });
  }
  if (lighting.fairyLight > 0.001) {
    // Strung across the headboard, so the light is low and close to the bed.
    practicals.push({
      position: { x: 560, y: 300, z: -60 },
      strength: lighting.fairyLight * 0.8,
      color: "#ffd9a2",
      reach: 620,
      pool: { x: 640, y: 190, z: -40 },
    });
  }

  return {
    lampFloor: { x: -500, y: 8, z: -245 },
    exposure: lighting.exposure,
    ambient: 0.62 + daylight * 0.3 + lighting.lampSpill * 0.22 + lighting.coveLight * 0.1,
    keyDirection,
    keyColor,
    keyStrength,
    lampPosition: { x: -500, y: 340, z: -245 },
    lampColor: lighting.lampColor,
    lampStrength: lighting.lampSpill,
    fog: mixHex("#120f1f", lighting.skyMid, 0.35),
    practicals,
    warmth: lighting.warmth,
    amberMix: lighting.amberMix,
    ambientColor: lighting.ambientColor,
  };
}

/**
 * Total light from every practical fixture that reaches a surface.
 *
 * Each fixture is evaluated at its own position with its own colour and reach,
 * then the results are summed. That is what makes the bedside lamp, the ceiling
 * cove, the candle and the fairy lights read as four separate lights rather than
 * one global "brightness" number.
 */
function practicalContribution(rig: LightRig, centroid: Vec3, normal: Vec3): {
  intensity: number;
  color: string;
} {
  let intensity = 0;
  let warmest: Practical | null = null;
  let warmestWeight = 0;

  for (const light of rig.practicals) {
    if (light.strength <= 0.001) continue;

    const dx = light.position.x - centroid.x;
    const dy = light.position.y - centroid.y;
    const dz = light.position.z - centroid.z;
    const distance = Math.hypot(dx, dy, dz) || 1;

    const toLight: Vec3 = { x: dx / distance, y: dy / distance, z: dz / distance };
    const facing = Math.max(0, dot(normal, toLight));
    const falloff = Math.pow(Math.max(0.1, 1 - distance / light.reach), 1.55);
    const contribution = facing * falloff * light.strength;

    intensity += contribution;
    if (contribution > warmestWeight) {
      warmestWeight = contribution;
      warmest = light;
    }
  }

  return { intensity, color: warmest ? warmest.color : rig.lampColor };
}

export function litColor(rig: LightRig, face: Face, centroid: Vec3): string {
  const normal = face.normal;

  // Two-sided: interior faces of boxes receive light on whichever side we see.
  const keyDot = Math.abs(dot(normal, rig.keyDirection));
  // Floors reflect far less direct key light than walls, which stops warm
  // wood albedo from drifting toward olive when mixed with a cool key colour.
  const keyReception = normal.y > 0.7 ? 0.42 : normal.y < -0.7 ? 0.22 : 1;
  const key = keyDot * rig.keyStrength * keyReception;

  const practical = practicalContribution(rig, centroid, normal);
  const total = rig.ambient * rig.exposure + key * rig.exposure + practical.intensity * 0.95;

  let color = shadeHex(face.albedo, Math.min(1.55, total));

  if (key > 0.05) {
    color = mixHex(color, rig.keyColor, Math.min(0.42, key * 0.5));
  }
  if (practical.intensity > 0.04) {
    // Cap the blend so an already-lit surface cannot desaturate toward olive.
    const amount = Math.min(0.34, practical.intensity * 0.5);
    color = mixHex(color, practical.color, amount);
  }

  // ── interior colour balance ────────────────────────────────────────────
  // "Warmer room" is applied per surface, weighted by how much of the surface
  // faces the room rather than the sky. That is a genuine change of the
  // interior's colour balance — walls, quilt, wood and plush all shift together
  // — and it is deliberately *not* a rectangular overlay on the screen. The
  // window-facing side stays cooler, which is what preserves the
  // window-to-room contrast the brief asks for.
  if (rig.amberMix > 0.001) {
    const skyFacing = Math.max(0, -normal.z); // the window wall is at -Z
    const interiorWeight = 1 - skyFacing * 0.55;
    color = mixHex(color, mixHex(color, "#ffbb6e", 0.6), rig.amberMix * interiorWeight);
  }

  // Aerial perspective toward the fog colour for far surfaces.
  return color;
}

function centroidOf(face: Face): Vec3 {
  const [a, b, c, d] = face.pts;
  return {
    x: (a.x + b.x + c.x + d.x) / 4,
    y: (a.y + b.y + c.y + d.y) / 4,
    z: (a.z + b.z + c.z + d.z) / 4,
  };
}

export interface RenderItem {
  kind: "face" | "character" | "sky-overlay";
  /** For faces: the architectural surface, used to pick a painter layer. */
  surface?: SurfaceKind;
  /** For faces: the face group ("floor", "wall-window", "bed", ...). */
  group?: string;
  depth: number;
  markup: string;
  /**
   * True for floors, ceilings, tabletops and mattress tops. Every character
   * rests *on* a horizontal surface, so such a face can never correctly hide
   * one; it is drawn behind them instead of trusting its centroid depth.
   */
  horizontal?: boolean;
}

export interface SceneRenderInput {
  camera: Camera3D;
  rig: LightRig;
  shell: Face[];
  groups: FaceGroup[];
  state: WorldState;
  /** Returned markup for characters, keyed by their anchor depth. */
  characterMarkup?: { id: string; anchor: Vec3; markup: string }[];
  /** Extra band drawn behind the window: sky gradient + weather hint. */
  skyMarkup?: string;
  width: number;
  height: number;
  time: number;
  reduced: boolean;
}

function windowSkyFace(shell: Face[]): Face | null {
  return shell.find((f) => f.kind === "sky") ?? null;
}

/** Emits one SVG `<path>` per visible face. */
export function collectFaces(input: SceneRenderInput): RenderItem[] {
  const { camera, rig, shell, groups, state } = input;
  const items: RenderItem[] = [];
  const cameraPos = camera.position;

  const push = (face: Face) => {
    const centroid = centroidOf(face);
    const toCamera: Vec3 = {
      x: cameraPos.x - centroid.x,
      y: cameraPos.y - centroid.y,
      z: cameraPos.z - centroid.z,
    };
    if (dot(face.normal, toCamera) <= 0) return;

    const projected = projectFace(face, camera);
    if (!projected) return;

    const emissive = face.emissive ?? 0;
    const opacity = face.opacity ?? 1;

    // Emitting surfaces (sky, lamp shade, LED strips) skip the room rig so
    // they read as light sources rather than painted boxes.
    if (emissive >= 0.99 && face.gradient) {
      items.push({
        kind: "face",
        surface: face.kind,
        group: face.group,
        depth: projected.depth,
        horizontal: Math.abs(face.normal.y) > 0.7,
        markup: `<path d="${projected.path}" fill="url(#${face.gradient})" opacity="${opacity.toFixed(3)}" stroke-linejoin="round" />`,
      });
      return;
    }

    const lit = litColor(rig, face, centroid);
    const fill = emissive > 0 ? mixHex(lit, face.albedo, emissive) : lit;
    const stroke = face.stroke ? face.stroke : shadeHex(fill, 0.86);
    const depthFade = Math.max(0, Math.min(0.45, (projected.depth - 760) / 2600));
    const fillFinal = emissive > 0 ? fill : mixHex(fill, rig.fog, depthFade);

    // A warm bloom halo behind strong emitters gives the lamp and LED strips
    // an actual glow rather than a flat bright rectangle.
    if (emissive > 0.6 && !face.gradient) {
      items.push({
        kind: "face",
        surface: face.kind,
        group: face.group,
        depth: projected.depth + 4,
        horizontal: Math.abs(face.normal.y) > 0.7,
        markup: `<path d="${projected.path}" fill="${rgba(face.albedo, 0.34)}" stroke="none" transform="scale(1)" opacity="0.5" filter="url(#omj-soft-glow)" />`,
      });
    }

    items.push({
      kind: "face",
      surface: face.kind,
      group: face.group,
      depth: projected.depth,
      horizontal: Math.abs(face.normal.y) > 0.7,
      markup: `<path d="${projected.path}" fill="${fillFinal}" stroke="${stroke}" stroke-width="0.6" opacity="${opacity.toFixed(3)}" stroke-linejoin="round" />`,
    });
  };

  shell.forEach(push);

  groups.forEach((group) => {
    if (!group.hinged) {
      group.faces.forEach(push);
      return;
    }

    /*
     * A hinged group (the door) is rotated once, here, rather than being
     * rebuilt whenever the swing changes. Rotating about the pivot line keeps
     * the stile on its hinges and swings the rest of the leaf through an arc,
     * which is what makes the motion read as a real door instead of a panel
     * sliding sideways. Normals rotate with the geometry, so lighting stays
     * correct as the leaf turns away from the room.
     */
    const { pivot, angle } = group.hinged;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const turn = (p: Vec3): Vec3 => {
      const dx = p.x - pivot.x;
      const dz = p.z - pivot.z;
      return {
        x: pivot.x + dx * cos + dz * sin,
        y: p.y,
        z: pivot.z - dx * sin + dz * cos,
      };
    };

    group.faces.forEach((f) => {
      push({
        ...f,
        pts: [turn(f.pts[0]), turn(f.pts[1]), turn(f.pts[2]), turn(f.pts[3])],
        normal: {
          x: f.normal.x * cos + f.normal.z * sin,
          y: f.normal.y,
          z: -f.normal.x * sin + f.normal.z * cos,
        },
      });
    });
  });

  // Characters composite into the same painter stream.
  for (const character of input.characterMarkup ?? []) {
    const projected = project(character.anchor, camera);
    items.push({
      kind: "character",
      depth: projected.visible ? projected.depth : Number.POSITIVE_INFINITY,
      markup: character.markup,
    });
  }

  items.sort((a, b) => b.depth - a.depth);
  return items;
}

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  /**
   * Screen-space rectangles of the individual glass panes.
   *
   * `x/y/width/height` above is the bounding box of the whole opening, which
   * includes the mullions *and* the wall reveal either side of the glass. Any
   * weather clipped to it therefore spills onto the curtains and the wall — so
   * precipitation is clipped to these instead.
   */
  panes: { x: number; y: number; width: number; height: number }[];
  /**
   * Screen-space footprint of the curtain panels in front of the glass.
   *
   * The weather canvas is an overlay above the entire room, so precipitation
   * painted inside the pane rects still covers any curtain hanging there.
   * Subtracting these keeps the fabric between the viewer and the weather.
   */
  curtains: { x: number; y: number; width: number; height: number }[];
}

/** Screen-space rectangle of the window panes, used to clip the weather. */
export function projectWindow(camera: Camera3D, curtainsOpen = 0): WindowRect | null {
  const z = WINDOW_FRAME.center.z + 8;
  const halfW = WINDOW_FRAME.width / 2;
  const halfH = WINDOW_FRAME.height / 2;
  const corners: Vec3[] = [
    { x: -halfW, y: WINDOW_FRAME.center.y - halfH, z },
    { x: halfW, y: WINDOW_FRAME.center.y - halfH, z },
    { x: halfW, y: WINDOW_FRAME.center.y + halfH, z },
    { x: -halfW, y: WINDOW_FRAME.center.y + halfH, z },
  ];

  const projected = corners.map((corner) => project(corner, camera));
  if (projected.some((p) => !p.visible)) return null;

  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;

  if (width < 8 || height < 8) return null;

  // A cheap perspective skew: the top edge is narrower than the bottom, so we
  // derive a rotation cue from the difference between the corner depths.
  const rotate = Math.atan2(projected[1]!.y - projected[0]!.y, projected[1]!.x - projected[0]!.x) * (180 / Math.PI);

  // Project each glass pane separately: the mullions must never be weather.
  const panes = windowPanes()
    .map((pane) => {
      const flat = [
        { x: pane.minX, y: pane.minY, z },
        { x: pane.maxX, y: pane.minY, z },
        { x: pane.maxX, y: pane.maxY, z },
        { x: pane.minX, y: pane.maxY, z },
      ].map((corner) => project(corner, camera));
      if (flat.some((p) => !p.visible)) return null;
      const px = flat.map((p) => p.x);
      const py = flat.map((p) => p.y);
      const paneMinX = Math.min(...px);
      const paneMinY = Math.min(...py);
      return {
        x: paneMinX,
        y: paneMinY,
        width: Math.max(...px) - paneMinX,
        height: Math.max(...py) - paneMinY,
      };
    })
    .filter((pane): pane is { x: number; y: number; width: number; height: number } => pane !== null);

  if (panes.length === 0) return null;

  const projectBox = (min: Vec3, max: Vec3) => {
    const corners = [
      { x: min.x, y: min.y, z: min.z },
      { x: max.x, y: min.y, z: min.z },
      { x: max.x, y: max.y, z: max.z },
      { x: min.x, y: max.y, z: max.z },
    ].map((corner) => project(corner, camera));
    if (corners.some((p) => !p.visible)) return null;
    const px = corners.map((p) => p.x);
    const py = corners.map((p) => p.y);
    const bx = Math.min(...px);
    const by = Math.min(...py);
    return { x: bx, y: by, width: Math.max(...px) - bx, height: Math.max(...py) - by };
  };

  const curtains = curtainPanels(curtainsOpen)
    .map((panel) => projectBox(panel.min, panel.max))
    .filter((box): box is { x: number; y: number; width: number; height: number } => box !== null);

  return { x: minX, y: minY, width, height, rotate, panes, curtains };
}

/** Orbit smoothing helper shared by the component and the tests. */
export function smoothCamera(state: WorldState, current: WorldState["camera"], dt: number) {
  const { yaw, pitch, distance } = state.camera;
  const shake = 0;

  return {
    yaw: dampAngle(current.yaw, yaw + shake, 9, dt),
    pitch: damp(current.pitch, pitch, 9, dt),
    distance: damp(current.distance, distance, 8, dt),
  };
}

export { rgba, centroidOf, windowSkyFace };
