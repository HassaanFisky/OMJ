/**
 * The dressing-table mirror is not a picture of a teddy — it is a window onto
 * the same room from the other side of its glass.
 *
 * Everything here is geometry, not illustration. A point in the room is
 * reflected across the mirror's own plane, projected through the *viewer's*
 * camera, and then drawn inside the glass quad. Because the source is the live
 * transform that already drives the character in the room, the reflection
 * cannot drift: same plush, same pose, same gaze, opposite handedness.
 */

import { project, projectFace, type Camera3D } from "./renderer";
import { MIRROR, type Vec3 } from "./scene";
import { CHARACTER_SCALE } from "./characterStage";

/**
 * The glass geometry comes from `scene.ts` so the plane that is reflected and
 * the plane that is drawn are the same numbers by construction.
 */
const MIRROR_PLANE_X = MIRROR.planeX;

const GLASS = {
  minY: MIRROR.minY,
  maxY: MIRROR.maxY,
  minZ: MIRROR.minZ,
  maxZ: MIRROR.maxZ,
};

/** Local Y of the rig's feet relative to its root origin (see characterStage). */
const FOOT_OFFSET = 66;

export interface MirrorQuad {
  /** Clip-path `d` attribute in screen space. */
  path: string;
  /** Screen area of the glass, for cheap culling. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** True when the glass is facing the viewer and large enough to see into. */
  visible: boolean;
  /** Depth of the glass plane, used to composite reflections in the room queue. */
  depth: number;
  /** Averaged projection scale, so reflections can be sized consistently. */
  scale: number;
}

export interface MirrorReflection {
  id: "mochi" | "yume";
  /** Screen anchor for the reflected rig root. */
  screenX: number;
  screenY: number;
  /** Pixels per rig local unit at the mirror's depth. */
  pixelScale: number;
  /** View depth of the reflected point, for compositing against the room. */
  screenDepth: number;
  /** Mirrored body yaw, in degrees. */
  yaw: number;
  /** Normalised position across the glass, 0 (left) .. 1 (right). */
  u: number;
  /** Normalised position down the glass, 0 (top) .. 1 (bottom). */
  v: number;
  /**
   * False when the character stands behind the glass (not yet in front of the
   * mirror) or outside the glass — the reflection must not be drawn at all.
   */
  visible: boolean;
}

/** Reflect a world point across the vanity plane. */
export function reflectPoint(point: Vec3): Vec3 {
  return { x: 2 * MIRROR_PLANE_X - point.x, y: point.y, z: point.z };
}

/**
 * Project the glass itself. Returned in screen space so the caller can both
 * clip the reflection and know whether it is worth computing at all.
 */
export function projectMirror(camera: Camera3D): MirrorQuad | null {
  const corners: [Vec3, Vec3, Vec3, Vec3] = [
    { x: MIRROR_PLANE_X, y: GLASS.minY, z: GLASS.minZ },
    { x: MIRROR_PLANE_X, y: GLASS.minY, z: GLASS.maxZ },
    { x: MIRROR_PLANE_X, y: GLASS.maxY, z: GLASS.maxZ },
    { x: MIRROR_PLANE_X, y: GLASS.maxY, z: GLASS.minZ },
  ];

  // The camera stands inside the room, so parts of the glass are frequently
  // behind the near plane. Reusing the renderer's clipper keeps the aperture
  // correct from every orbit instead of collapsing the quad.
  const projected = projectFace(
    {
      group: "standing-mirror",
      kind: "accent",
      albedo: "#43506e",
      normal: { x: 1, y: 0, z: 0 },
      pts: corners,
    },
    camera,
  );

  if (!projected) return null;

  const numbers = projected.path.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    xs.push(numbers[i]!);
    ys.push(numbers[i + 1]!);
  }
  if (xs.length < 3) return null;

  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;

  if (width < 6 || height < 6) return null;

  // The glass faces +X. It is only a mirror while the viewer stands in front of
  // it; from behind, the frame's backing is what you would see.
  const facing = camera.position.x > MIRROR_PLANE_X + 1;

  // And it is only visible while it is inside the view. A mirror behind the
  // camera still projects a quad (the clipper keeps whatever is past the near
  // plane), so without this test the reflection would keep updating off-screen.
  const centre: Vec3 = {
    x: MIRROR_PLANE_X,
    y: (GLASS.minY + GLASS.maxY) / 2,
    z: (GLASS.minZ + GLASS.maxZ) / 2,
  };
  const toMirror: Vec3 = {
    x: centre.x - camera.position.x,
    y: centre.y - camera.position.y,
    z: centre.z - camera.position.z,
  };
  const inView = toMirror.x * camera.forward.x + toMirror.y * camera.forward.y + toMirror.z * camera.forward.z > 40;
  const scale = camera.fov / Math.max(120, projected.depth);

  return {
    path: projected.path,
    x,
    y,
    width,
    height,
    visible: facing && inView,
    depth: projected.depth,
    scale,
  };
}

/**
 * Build the reflection of a character currently staged in the room.
 *
 * `worldAnchor` is the character's room position (the same point the room
 * projection uses), so pose, gaze and gesture are inherited by construction —
 * only the spatial transform changes.
 */
export function reflectCharacter(
  id: "mochi" | "yume",
  worldAnchor: Vec3,
  bodyYaw: number,
  camera: Camera3D,
  quad: MirrorQuad,
): MirrorReflection {
  const rootWorld: Vec3 = {
    x: worldAnchor.x,
    y: FOOT_OFFSET * CHARACTER_SCALE,
    z: worldAnchor.z,
  };

  const mirrored = reflectPoint(rootWorld);
  const projected = project(mirrored, camera);

  // A body only casts a reflection once it stands in front of the glass. Behind
  // it, the glass shows the empty room.
  const inFront = worldAnchor.x > MIRROR_PLANE_X;

  // The reflection lands on the glass only if the *reflected* point projects
  // inside the glass quad; anywhere else and the glass would be showing
  // something the frame does not contain.
  const inGlass =
    projected.visible &&
    projected.x >= quad.x - quad.width * 0.9 &&
    projected.x <= quad.x + quad.width * 1.9 &&
    projected.y >= quad.y - quad.height * 1.6 &&
    projected.y <= quad.y + quad.height * 2.6;
  const spanZ = GLASS.maxZ - GLASS.minZ;
  const spanY = GLASS.maxY - GLASS.minY;
  const u = (worldAnchor.z - GLASS.minZ) / spanZ;
  const v = 1 - (rootWorld.y - GLASS.minY) / spanY;

  return {
    id,
    screenX: projected.x,
    screenY: projected.y,
    pixelScale: projected.visible ? projected.scale * CHARACTER_SCALE : 0,
    screenDepth: quad.depth,
    // A mirror reverses handedness: a body turned to its left appears turned to
    // the viewer's left. Mirroring the yaw about the glass normal does that.
    yaw: -bodyYaw,
    u: Math.max(-0.4, Math.min(1.4, u)),
    v: Math.max(-0.4, Math.min(1.4, v)),
    visible: inFront && inGlass && projected.visible && quad.visible,
  };
}
