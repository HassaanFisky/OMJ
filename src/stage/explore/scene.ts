/**
 * Explore scene geometry.
 *
 * The cinematic mode projects flat illustration layers; exploration needs an
 * actual architectural shell so orbiting the room reveals real corners. This
 * module builds that shell and its furniture as world-space quads.
 *
 * Conventions (matching src/stage/Room3D.ts):
 *   X: -800 vanity wall  .. +800 bed wall
 *   Y:    0 floor        .. +900 ceiling
 *   Z: -700 window wall  .. +700 bookshelf wall
 *   yaw 0 looks toward the window wall (-Z).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type SurfaceKind = "shell" | "furniture" | "accent" | "sky";

export interface Face {
  pts: readonly [Vec3, Vec3, Vec3, Vec3];
  normal: Vec3;
  /** Base albedo, before lighting. */
  albedo: string;
  kind: SurfaceKind;
  /** Optional gradient id used for emitting surfaces such as sky and glass. */
  gradient?: string;
  /** 0..1 self-illumination: the surface ignores the room rig and glows. */
  emissive?: number;
  opacity?: number;
  stroke?: string;
  /** Group id used for layering decisions. */
  group: string;
}

export interface FaceGroup {
  id: string;
  /** World position used for depth ordering against the characters. */
  anchor: Vec3;
  faces: Face[];
  /**
   * Optional world-space rotation applied to every face in this group, about
   * the Y axis through `pivot`. Used by the door, which has to swing about its
   * hinge — baking that as pre-rotated static faces would mean rebuilding the
   * whole scene graph on every animation frame, and would also break the
   * painter's ordering, which assumes faces do not move between sorts.
   */
  hinged?: { pivot: Vec3; angle: number };
  /** Interactive hotspot centre, if the group is clickable. */
  hotspot?: Vec3 & { radius: number; label: string; objectId: string };
}

export const SHELL = {
  width: 800,
  depth: 700,
  height: 900,
} as const;

/**
 * The standing mirror on the -X wall.
 *
 * The plushies live near z = -320, so the mirror is placed opposite them rather
 * than beside the dressing table: a reflection is only possible where the
 * geometry allows it, and a mirror 500 units down the same wall could never
 * contain them. `reflection.ts` imports these numbers, so the glass that is
 * drawn and the plane that is reflected can never disagree.
 */
export const MIRROR = {
  /**
   * Glass plane; the mirror faces +X, into the room.
   *
   * It stands clear of the wall rather than flush against it. The painter
   * sorts by face centroid, and a tall panel hugging the wall sorts *behind*
   * the wall's own centroid — which buried the whole mirror. A cheval glass set
   * 200 units into the room sorts in front, as it should for a real object.
   */
  planeX: -600,
  minZ: -325,
  maxZ: -65,
  minY: 115,
  maxY: 625,
} as const;

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/* ── vector helpers ───────────────────────────────────────────────────────── */

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function normalize(a: Vec3): Vec3 {
  const len = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

function face(
  group: string,
  quad: readonly [Vec3, Vec3, Vec3, Vec3],
  albedo: string,
  kind: SurfaceKind,
  outward?: Vec3,
  extra?: Partial<Face>,
): Face {
  const normal = normalize(cross(sub(quad[1], quad[0]), sub(quad[2], quad[0])));
  const oriented = outward && dot(normal, outward) < 0 ? negate(normal) : normal;
  return { pts: quad, normal: oriented, albedo, kind, group, ...extra };
}

function negate(n: Vec3): Vec3 {
  return { x: -n.x, y: -n.y, z: -n.z };
}

/* ── architectural shell ──────────────────────────────────────────────────── */

export function buildShell(): Face[] {
  const { width: W, depth: D, height: H } = SHELL;

  return [
    face(
      "floor",
      [v(-W, 0, -D), v(W, 0, -D), v(W, 0, D), v(-W, 0, D)],
      "#5d3d29",
      "shell",
      v(0, 1, 0),
    ),
    // Apron: a skirt of floor that continues past the walls, so any seam at the
    // wall base reads as a shadow line instead of a hole in the world.
    face(
      "floor-apron",
      [v(-W - 900, -2, -D - 900), v(W + 900, -2, -D - 900), v(W + 900, -2, D + 900), v(-W - 900, -2, D + 900)],
      "#4a3022",
      "shell",
      v(0, 1, 0),
    ),
    face(
      "ceiling",
      [v(-W, H, D), v(W, H, D), v(W, H, -D), v(-W, H, -D)],
      "#3b3048",
      "shell",
      v(0, -1, 0),
    ),
    face(
      "wall-window",
      [v(-W, 0, -D), v(W, 0, -D), v(W, H, -D), v(-W, H, -D)],
      "#4a3a58",
      "shell",
      v(0, 0, 1),
    ),
    face(
      "wall-bed",
      [v(W, 0, -D), v(W, 0, D), v(W, H, D), v(W, H, -D)],
      "#45344f",
      "shell",
      v(-1, 0, 0),
    ),
    face(
      "wall-vanity",
      [v(-W, 0, D), v(-W, 0, -D), v(-W, H, -D), v(-W, H, D)],
      "#47364f",
      "shell",
      v(1, 0, 0),
    ),
    face(
      "wall-bookshelf",
      [v(W, 0, D), v(-W, 0, D), v(-W, H, D), v(W, H, D)],
      "#40304a",
      "shell",
      v(0, 0, -1),
    ),

    // Wainscot rail + skirting: thin bands that give the walls architecture.
    face(
      "rail-window",
      [v(-W, 640, -D + 6), v(W, 640, -D + 6), v(W, 664, -D + 6), v(-W, 664, -D + 6)],
      "#5c4a63",
      "accent",
      v(0, 0, 1),
    ),
    face(
      "rail-bed",
      [v(W - 6, 640, -D), v(W - 6, 640, D), v(W - 6, 664, D), v(W - 6, 664, -D)],
      "#55445c",
      "accent",
      v(-1, 0, 0),
    ),
    face(
      "rail-vanity",
      [v(-W + 6, 640, D), v(-W + 6, 640, -D), v(-W + 6, 664, -D), v(-W + 6, 664, D)],
      "#55445c",
      "accent",
      v(1, 0, 0),
    ),
    face(
      "rail-bookshelf",
      [v(W, 640, D - 6), v(-W, 640, D - 6), v(-W, 664, D - 6), v(W, 664, D - 6)],
      "#4e3f57",
      "accent",
      v(0, 0, -1),
    ),

    // Ceiling cove: a warm recessed strip.
    face(
      "cove",
      [v(-W + 60, H - 14, -D + 60), v(W - 60, H - 14, -D + 60), v(W - 60, H - 14, D - 60), v(-W + 60, H - 14, D - 60)],
      "#5a4866",
      "accent",
      v(0, -1, 0),
      { emissive: 0.42 },
    ),
  ];
}

/* ── furniture & props ────────────────────────────────────────────────────── */

function box(
  group: string,
  min: Vec3,
  max: Vec3,
  albedo: string,
  options: { skipBottom?: boolean; kind?: SurfaceKind; accent?: string } = {},
): Face[] {
  const kind = options.kind ?? "furniture";
  const faces: Face[] = [
    face(group, [v(min.x, max.y, min.z), v(max.x, max.y, min.z), v(max.x, max.y, max.z), v(min.x, max.y, max.z)], albedo, kind, v(0, 1, 0)),
    face(group, [v(min.x, min.y, min.z), v(max.x, min.y, min.z), v(max.x, max.y, min.z), v(min.x, max.y, min.z)], albedo, kind, v(0, 0, -1)),
    face(group, [v(max.x, min.y, min.z), v(max.x, min.y, max.z), v(max.x, max.y, max.z), v(max.x, max.y, min.z)], albedo, kind, v(1, 0, 0)),
    face(group, [v(max.x, min.y, max.z), v(min.x, min.y, max.z), v(min.x, max.y, max.z), v(max.x, max.y, max.z)], albedo, kind, v(0, 0, 1)),
    face(group, [v(min.x, min.y, max.z), v(min.x, min.y, min.z), v(min.x, max.y, min.z), v(min.x, max.y, max.z)], albedo, kind, v(-1, 0, 0)),
  ];

  if (!options.skipBottom) {
    faces.push(
      face(group, [v(min.x, min.y, max.z), v(max.x, min.y, max.z), v(max.x, min.y, min.z), v(min.x, min.y, min.z)], options.accent ?? albedo, kind, v(0, -1, 0)),
    );
  }

  return faces;
}

/** Four-sided tapered solid (frustum) — used for the lampshade and vase. */
function frustum(
  group: string,
  bottomMin: Vec3,
  bottomMax: Vec3,
  topInset: number,
  topY: number,
  albedo: string,
): Face[] {
  const b0 = v(bottomMin.x, bottomMin.y, bottomMin.z);
  const b1 = v(bottomMax.x, bottomMin.y, bottomMin.z);
  const b2 = v(bottomMax.x, bottomMin.y, bottomMax.z);
  const b3 = v(bottomMin.x, bottomMin.y, bottomMax.z);

  const t0 = v(bottomMin.x + topInset, topY, bottomMin.z + topInset);
  const t1 = v(bottomMax.x - topInset, topY, bottomMin.z + topInset);
  const t2 = v(bottomMax.x - topInset, topY, bottomMax.z - topInset);
  const t3 = v(bottomMin.x + topInset, topY, bottomMax.z - topInset);

  return [
    face(group, [b3, b2, t2, t3], albedo, "furniture", v(0, 0, 1)),
    face(group, [b1, b0, t0, t1], albedo, "furniture", v(0, 0, -1)),
    face(group, [b2, b1, t1, t2], albedo, "furniture", v(1, 0, 0)),
    face(group, [b0, b3, t3, t0], albedo, "furniture", v(-1, 0, 0)),
    face(group, [t3, t2, t1, t0], albedo, "accent", v(0, 1, 0), { emissive: 0.55 }),
  ];
}

/**
 * Faceted glass sphere for the snow globe.
 *
 * Six latitude bands x eight longitudes is enough to read as a dome at the sizes
 * the room uses, and keeps the face count (and therefore the per-frame painter
 * sort) small.
 */
const SPHERE_FACETS = (() => {
  const facets: Array<{ a: number; b: number; y0: number; y1: number; r0: number; r1: number; normal: Vec3 }> = [];
  const bands = 6;
  const segments = 8;
  const radius = 62;

  for (let band = 0; band < bands; band += 1) {
    const phi0 = (band / bands) * Math.PI;
    const phi1 = ((band + 1) / bands) * Math.PI;
    const y0 = Math.cos(phi0) * radius;
    const y1 = Math.cos(phi1) * radius;
    const r0 = Math.sin(phi0) * radius;
    const r1 = Math.sin(phi1) * radius;
    const midPhi = (phi0 + phi1) / 2;

    for (let segment = 0; segment < segments; segment += 1) {
      const a = (segment / segments) * Math.PI * 2;
      const b = ((segment + 1) / segments) * Math.PI * 2;
      const midAngle = (a + b) / 2;
      facets.push({
        a,
        b,
        y0,
        y1,
        r0,
        r1,
        normal: v(
          Math.cos(midAngle) * Math.sin(midPhi),
          Math.cos(midPhi),
          Math.sin(midAngle) * Math.sin(midPhi),
        ),
      });
    }
  }

  return facets;
})();

export const LAMP_POSITION = v(-520, 470, -250);
export const GLOBE_POSITION = v(350, 236, -10);
export const GIFT_POSITION = v(-395, 74, -25);

/* ── the door ─────────────────────────────────────────────────────────────── */

/**
 * A real entry door on the +Z (bookshelf) wall.
 *
 * It sits on the largest uninterrupted stretch of that wall. The bookshelf is
 * on the -X half, the reading chair and the framed art are on the +X half, and
 * the space between them — around world x ≈ 60 — is the only place a door can
 * go without displacing furniture that already has a hotspot. That is also the
 * architecturally sensible spot: opposite the window, so the room has a proper
 * threshold rather than a decorated dead end.
 *
 * The opening is cut as a real recess: side jambs going back into the wall,
 * a head jamb, and an architrave standing proud on the room side. The leaf is
 * hinged on its -X stile and swings inward, into the room.
 */
export const DOOR = {
  /** Centre of the opening on the +Z wall. */
  x: 60,
  /** Clear opening, in world units. */
  width: 210,
  height: 560,
  /** How far the wall is recessed before the frame starts. */
  reveal: 54,
  /** Wall depth the leaf and casing live against. */
  face: 700,
  /**
   * How far the leaf travels, in radians. A shade over ninety degrees: enough
   * that the opening reads as clearly open from every camera angle, short of
   * flat against the wall, which would look like a shutter rather than a door.
   */
  swing: 1.66,
} as const;

/** Exported for the stage, which maps world state onto the leaf's angle. */
export const DOOR_SWING = DOOR.swing;

const DOOR_LEAF_COLOR = "#6b4a31";
const DOOR_CASING_COLOR = "#7a5638";
const DOOR_PANEL_COLOR = "#5c3e29";

/**
 * The door leaf and its furniture, authored at angle 0 (closed) in world space.
 * Every face is tagged `group: "door"` so the renderer can treat the swing as
 * one object.
 */
export function buildDoor(angle: number): FaceGroup[] {
  const { x, width, height } = DOOR;
  const faceZ = DOOR.face - 6;
  const left = x - width / 2;
  const right = x + width / 2;
  const leafDepth = 22;
  const backZ = DOOR.face - DOOR.reveal;

  /*
   * The casing is built as its own, immovable group. It must not swing with the
   * leaf: an architrave that rotated with the door would tear itself out of the
   * wall, which is exactly the kind of impossible joinery that makes a room
   * look like a cardboard set.
   */
  const frameFaces: Face[] = [
    // Side jambs, receding from the room face into the wall.
    ...box("door-frame", v(left - 26, 0, DOOR.face), v(left, height + 30, backZ), DOOR_CASING_COLOR),
    ...box("door-frame", v(right, 0, DOOR.face), v(right + 26, height + 30, backZ), DOOR_CASING_COLOR),
    // Head jamb.
    ...box("door-frame", v(left - 26, height, DOOR.face), v(right + 26, height + 30, backZ), DOOR_CASING_COLOR),
    // Architrave: a proud band on the room side, so the opening has shadow.
    ...box("door-frame", v(left - 44, 0, faceZ), v(left - 20, height + 48, faceZ - 10), DOOR_CASING_COLOR, { skipBottom: true }),
    ...box("door-frame", v(right + 20, 0, faceZ), v(right + 44, height + 48, faceZ - 10), DOOR_CASING_COLOR, { skipBottom: true }),
    ...box("door-frame", v(left - 44, height + 26, faceZ), v(right + 44, height + 48, faceZ - 10), DOOR_CASING_COLOR, { skipBottom: true }),
    // A dark threshold plate.
    ...box("door-frame", v(left, -1, faceZ), v(right, 4, faceZ - 34), "#3a271c", { skipBottom: true }),
    /*
     * The hallway behind the opening. Without a surface back here the doorway
     * would show the bedroom's own wallpaper through the hole and immediately
     * read as a painted rectangle. A deep, almost-black quad just inside the
     * reveal is enough to make the opening feel like it leads somewhere.
     */
    face(
      "door-frame",
      [v(left, 0, backZ - 2), v(right, 0, backZ - 2), v(right, height + 28, backZ - 2), v(left, height + 28, backZ - 2)],
      "#1b1522",
      "accent",
      v(0, 0, -1),
      { emissive: 0.04 },
    ),
  ];

  const leafFaces: Face[] = [
    // Body of the leaf.
    ...box("door", v(left, 8, faceZ), v(right, height, faceZ - leafDepth), DOOR_LEAF_COLOR),
    // Two raised panels on the room side.
    ...box("door", v(left + 26, 300, faceZ - leafDepth - 7), v(right - 26, height - 46, faceZ - leafDepth), DOOR_PANEL_COLOR, { skipBottom: true }),
    ...box("door", v(left + 26, 60, faceZ - leafDepth - 7), v(right - 26, 262, faceZ - leafDepth), DOOR_PANEL_COLOR, { skipBottom: true }),
    // Handle on the latch stile, room side: a rose and a lever.
    ...box("door", v(right - 40, 300, faceZ - leafDepth - 12), v(right - 26, 336, faceZ - leafDepth - 4), "#c9a978", { skipBottom: true }),
    ...box("door", v(right - 62, 314, faceZ - leafDepth - 11), v(right - 26, 324, faceZ - leafDepth - 8), "#e0c193", { skipBottom: true }),
  ];

  return [
    {
      id: "door-frame",
      anchor: v(x, height / 2, backZ),
      faces: frameFaces,
    },
    {
      id: "door",
      anchor: v(x, height / 2, faceZ),
      faces: leafFaces,
      // Hinge on the -X stile; the leaf rotates about this vertical line.
      hinged: { pivot: v(left, 0, faceZ), angle },
      hotspot: {
        x,
        y: height / 2,
        z: DOOR.face - 40,
        radius: 250,
        label: "The door",
        objectId: "door",
      },
    },
  ];
}

export function buildFurniture(): FaceGroup[] {
  const { width: W, depth: D } = SHELL;
  const groups: FaceGroup[] = [];

  /* Bed against the +X wall, angled slightly toward the room. */
  const bedFaces: Face[] = [
    // Turned legs
    ...box("bed", v(W - 330, 0, -250), v(W - 300, 22, -220), "#3d2819"),
    ...box("bed", v(W - 330, 0, 120), v(W - 300, 22, 150), "#3d2819"),
    ...box("bed", v(W - 130, 0, -250), v(W - 100, 22, -220), "#3d2819"),
    ...box("bed", v(W - 130, 0, 120), v(W - 100, 22, 150), "#3d2819"),
    // Base frame
    ...box("bed", v(W - 338, 16, -258), v(W - 78, 104, 158), "#4d3527"),
    // Mattress
    ...box("bed", v(W - 324, 104, -246), v(W - 92, 158, 148), "#cdbcae"),
    // Folded duvet across the foot
    ...box("bed", v(W - 316, 158, -10), v(W - 100, 190, 148), "#8f6f90", { skipBottom: true }),
    // Turned-down sheet edge
    ...box("bed", v(W - 316, 158, -56), v(W - 100, 172, -10), "#e2d6c8", { skipBottom: true }),
    // Headboard posts + slats
    ...box("bed", v(W - 104, 20, -262), v(W - 60, 330, -238), "#5a3c29"),
    ...box("bed", v(W - 104, 20, 130), v(W - 60, 330, 154), "#5a3c29"),
    ...box("bed", v(W - 96, 90, -256), v(W - 72, 322, 146), "#4a3022"),
  ];

  // Vertical headboard slats for a crafted, non-boxy silhouette.
  for (let i = 0; i < 7; i += 1) {
    const z = -230 + i * 54;
    bedFaces.push(
      ...box("bed", v(W - 76, 130, z), v(W - 68, 312, z + 12), "#63452f", { skipBottom: true }),
    );
  }

  groups.push({
    id: "bed",
    anchor: v(W - 220, 120, -50),
    faces: bedFaces,
    hotspot: { x: W - 220, y: 190, z: -50, radius: 230, label: "The bed", objectId: "bed" },
  });

  /* Two stacked pillows (kept as their own small group so they read as plush). */
  groups.push({
    id: "pillows",
    anchor: v(W - 250, 190, -180),
    faces: [
      ...box("pillows", v(W - 300, 162, -228), v(W - 130, 208, -120), "#ded0c4", { skipBottom: true }),
      ...box("pillows", v(W - 288, 166, -140), v(W - 128, 196, -60), "#c9b6c2", { skipBottom: true }),
    ],
  });

  /* Nightstand + kerosene lamp. */
  groups.push({
    id: "nightstand",
    anchor: v(-500, 160, -240),
    faces: box("nightstand", v(-600, 0, -330), v(-400, 190, -160), "#4a2f1e"),
    hotspot: { x: -500, y: 220, z: -245, radius: 150, label: "Bedside lamp", objectId: "lamp" },
  });

  groups.push({
    id: "lamp",
    anchor: LAMP_POSITION,
    faces: [
      ...box("lamp", v(-530, 190, -270), v(-470, 300, -210), "#c79e8d", { skipBottom: true }),
      // Tapered linen shade (a real frustum, so it reads as a lampshade).
      ...frustum("lamp", v(-556, 300, -296), v(-444, 372, -184), 34, 386, "#f6dfb8"),
      // Emissive underside of the shade: the light source itself.
      face(
        "lamp",
        [v(-552, 298, -292), v(-448, 298, -292), v(-448, 298, -188), v(-552, 298, -188)],
        "#ffd79a",
        "accent",
        v(0, -1, 0),
        { emissive: 1 },
      ),
    ],
  });

  /* Vanity with a real mirror on the -X wall. */
  groups.push({
    id: "vanity",
    anchor: v(-700, 430, 240),
    faces: [
      ...box("vanity", v(-760, 0, 120), v(-560, 300, 380), "#4c3423"),
      // Mirror frame + glass (glass is drawn as an accent so it can be tinted).
      ...box("vanity", v(-756, 340, 150), v(-736, 720, 350), "#6b4a31", { skipBottom: true }),
      face(
        "vanity",
        [v(-734, 360, 165), v(-734, 360, 335), v(-734, 700, 335), v(-734, 700, 165)],
        "#43506e",
        "accent",
        v(1, 0, 0),
        { emissive: 0.12 },
      ),
    ],
    hotspot: { x: -700, y: 480, z: 250, radius: 220, label: "The dressing table", objectId: "vanity" },
  });

  /* A tall standing mirror, squarely opposite the plushies. Its glass is a real
     reflection aperture: `reflection.ts` reflects the live character transforms
     across this plane and clips them to this glass, so what appears in the frame
     is the room's own geometry seen from the far side. */
  groups.push({
    id: "standing-mirror",
    anchor: v(MIRROR.planeX + 10, (MIRROR.minY + MIRROR.maxY) / 2, (MIRROR.minZ + MIRROR.maxZ) / 2),
    faces: [
      // Frame back and surround, set behind the glass plane.
      ...box("standing-mirror", v(-676, 100, -341), v(-604, 641, -49), "#6b4a31"),
      // Glass: an accent face so it takes the room's cool bounce light.
      face(
        "standing-mirror",
        [
          v(MIRROR.planeX, MIRROR.minY, MIRROR.minZ),
          v(MIRROR.planeX, MIRROR.minY, MIRROR.maxZ),
          v(MIRROR.planeX, MIRROR.maxY, MIRROR.maxZ),
          v(MIRROR.planeX, MIRROR.maxY, MIRROR.minZ),
        ],
        "#43506e",
        "accent",
        v(1, 0, 0),
        { emissive: 0.12 },
      ),
      // Uprights and feet, so it stands on the floor instead of floating.
      ...box("standing-mirror", v(-690, 0, -348), v(-612, 660, -326), "#5a3c29"),
      ...box("standing-mirror", v(-690, 0, -64), v(-612, 660, -42), "#5a3c29"),
      ...box("standing-mirror", v(-706, 0, -356), v(-604, 34, -18), "#4d3324"),
    ],
    hotspot: {
      x: MIRROR.planeX + 20,
      y: (MIRROR.minY + MIRROR.maxY) / 2,
      z: (MIRROR.minZ + MIRROR.maxZ) / 2,
      radius: 300,
      label: "The mirror",
      objectId: "mirror",
    },
  });

  /* Bookshelf on the +Z wall with lit shelves. */
  groups.push({
    id: "bookshelf",
    anchor: v(-420, 360, D - 80),
    faces: [
      ...box("bookshelf", v(-620, 0, D - 180), v(-220, 720, D - 40), "#3f2618"),
      face("bookshelf", [v(-600, 190, D - 182), v(-240, 190, D - 182), v(-240, 196, D - 182), v(-600, 196, D - 182)], "#f6c982", "accent", v(0, 0, -1), { emissive: 0.85 }),
      face("bookshelf", [v(-600, 400, D - 182), v(-240, 400, D - 182), v(-240, 406, D - 182), v(-600, 406, D - 182)], "#f6c982", "accent", v(0, 0, -1), { emissive: 0.85 }),
      // A few book spines as thin boxes for silhouette detail.
      ...box("bookshelf", v(-590, 200, D - 176), v(-556, 300, D - 146), "#8d667e", { skipBottom: true }),
      ...box("bookshelf", v(-548, 200, D - 176), v(-512, 286, D - 146), "#b48a78", { skipBottom: true }),
      ...box("bookshelf", v(-504, 200, D - 176), v(-470, 306, D - 146), "#6f8798", { skipBottom: true }),
      ...box("bookshelf", v(-462, 202, D - 176), v(-432, 292, D - 146), "#c2a06a", { skipBottom: true }),
      ...box("bookshelf", v(-424, 200, D - 176), v(-392, 300, D - 146), "#7d5c78", { skipBottom: true }),
      ...box("bookshelf", v(-430, 412, D - 176), v(-392, 500, D - 146), "#a87686", { skipBottom: true }),
      ...box("bookshelf", v(-384, 414, D - 176), v(-350, 494, D - 146), "#6f8798", { skipBottom: true }),
      ...box("bookshelf", v(-342, 410, D - 176), v(-312, 502, D - 146), "#b48a78", { skipBottom: true }),
      // Shelf boards so the recess reads as furniture, not a painted panel.
      ...box("bookshelf", v(-610, 300, D - 178), v(-230, 316, D - 120), "#54402c", { skipBottom: true }),
      ...box("bookshelf", v(-610, 508, D - 178), v(-230, 524, D - 120), "#54402c", { skipBottom: true }),
    ],
    hotspot: { x: -420, y: 380, z: D - 120, radius: 240, label: "The bookshelf", objectId: "bookshelf" },
  });

  /* Reading chair with a floor lamp relationship to the window. */
  groups.push({
    id: "chair",
    anchor: v(420, 130, 470),
    faces: [
      ...box("chair", v(300, 0, 360), v(540, 150, 590), "#a87c63"),
      ...box("chair", v(300, 150, 540), v(540, 430, 590), "#966b55", { skipBottom: true }),
      ...box("chair", v(300, 140, 360), v(540, 200, 520), "#c39a7e", { skipBottom: true }),
    ],
  });

  /* Framed art on the bookshelf wall: warm accents that also frame the room. */
  const artZ = D - 16;
  const frames: Array<[number, number, number, number, string]> = [
    [300, 430, 150, 190, "#e8d8c4"],
    [480, 470, 118, 150, "#d6c3b4"],
    [330, 660, 240, 96, "#c9b6a6"],
  ];

  groups.push({
    id: "art",
    anchor: v(390, 520, artZ),
    faces: frames.flatMap(([x, y, w, h, tone], index) => [
      face(
        "art",
        [v(x, y, artZ), v(x + w, y, artZ), v(x + w, y + h, artZ), v(x, y + h, artZ)],
        "#8a6a4a",
        "accent",
        v(0, 0, -1),
        { emissive: 0.1 },
      ),
      face(
        "art",
        [v(x + 8, y + 8, artZ - 3), v(x + w - 8, y + 8, artZ - 3), v(x + w - 8, y + h - 8, artZ - 3), v(x + 8, y + h - 8, artZ - 3)],
        index % 2 === 0 ? tone : "#4a3f5c",
        "accent",
        v(0, 0, -1),
        { emissive: 0.06 },
      ),
    ]),
  });

  /* A tall plant softens the window/wall corner. */
  groups.push({
    id: "plant",
    anchor: v(-700, 220, -560),
    faces: [
      ...frustum("plant", v(-750, 0, -610), v(-650, 90, -510), 16, 150, "#8d6a52"),
      ...box("plant", v(-724, 150, -584), v(-676, 330, -536), "#5b7152", { skipBottom: true }),
      ...box("plant", v(-770, 210, -620), v(-706, 330, -556), "#6a8060", { skipBottom: true }),
      ...box("plant", v(-710, 250, -600), v(-650, 380, -540), "#5f7557", { skipBottom: true }),
    ],
  });

  /* Rug — a thin slab so it catches light like the rest of the room. */
  groups.push({
    id: "rug",
    anchor: v(0, 6, 60),
    faces: [
      face(
        "rug",
        [v(-300, 6, -150), v(300, 6, -150), v(300, 6, 290), v(-300, 6, 290)],
        "#b5906d",
        "accent",
        v(0, 1, 0),
      ),
      face(
        "rug",
        [v(-272, 8, -122), v(272, 8, -122), v(272, 8, 262), v(-272, 8, 262)],
        "#9b7554",
        "accent",
        v(0, 1, 0),
      ),
    ],
  });

  /* Snow globe on a pedestal between bed and window. */
  groups.push({
    id: "globe",
    anchor: GLOBE_POSITION,
    faces: [
      // Turned plinth: a wide foot, a tapered column, then the glass.
      ...box("globe", v(294, 0, -66), v(406, 22, 46), "#4c3423"),
      ...frustum("globe", v(312, 22, -42), v(388, 22, 22), 18, 168, "#5a3d28"),
      ...box("globe", v(330, 168, -30), v(370, 196, 10), "#3b2a1e", { skipBottom: true }),
      // Glass dome: a faceted sphere approximated by stacked rings. `emissive`
      // keeps it glowing rather than picking up the room rig, which is what makes
      // it read as glass instead of another wooden box.
      ...SPHERE_FACETS.map(({ a, b, y0, y1, r0, r1, normal }) => {
        const centre = v(350, 236, -10);
        const pt = (radius: number, y: number, angle: number): Vec3 =>
          v(centre.x + Math.cos(angle) * radius, centre.y + y, centre.z + Math.sin(angle) * radius);
        return face(
          "globe",
          [pt(r0, y0, a), pt(r0, y0, b), pt(r1, y1, b), pt(r1, y1, a)],
          "#d9c8e8",
          "sky",
          normal,
          { opacity: 0.34, emissive: 0.5 },
        );
      }),
    ],
    hotspot: { x: 350, y: 255, z: -10, radius: 70, label: "Snow globe", objectId: "globe" },
  });

  /* Gift box resting on the rug. */
  groups.push({
    id: "gift",
    anchor: GIFT_POSITION,
    faces: [
      ...box("gift", v(-430, 6, -60), v(-360, 70, 10), "#c89dad", { skipBottom: true }),
      ...box("gift", v(-436, 70, -66), v(-354, 84, 16), "#d7b1bf", { skipBottom: true }),
      // Ribbon: a vertical band on the front face plus a band across the lid.
      face("gift", [v(-400, 6, 11), v(-390, 6, 11), v(-390, 70, 11), v(-400, 70, 11)], "#f7e9d3", "accent", v(0, 0, 1)),
      face("gift", [v(-400, 70, 16), v(-390, 70, 16), v(-390, 84, 16), v(-400, 84, 16)], "#f7e9d3", "accent", v(0, 0, 1),
        { emissive: 0.08 }),
      face("gift", [v(-436, 84, -26), v(-354, 84, -26), v(-354, 84, -24), v(-436, 84, -24)], "#f7e9d3", "accent", v(0, 1, 0),
        { emissive: 0.08 }),
      // A small bow knot on top.
      ...box("gift", v(-402, 84, -30), v(-394, 92, -20), "#f7e9d3", { skipBottom: true }),
    ],
    hotspot: { x: -395, y: 60, z: -25, radius: 66, label: "The gift", objectId: "gift" },
  });

  return groups;
}

/* ── window (north wall) ──────────────────────────────────────────────────── */

export const WINDOW_FRAME = {
  /** Centre of the window on the north wall. */
  center: v(0, 460, -SHELL.depth + 4),
  width: 520,
  height: 400,
} as const;

export interface WindowPane {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function windowPanes(): WindowPane[] {
  const { center, width, height } = WINDOW_FRAME;
  const left = center.x - width / 2;
  const gap = 14;
  const paneWidth = (width - gap * 2) / 3;
  const panes: WindowPane[] = [];

  for (let i = 0; i < 3; i += 1) {
    const minX = left + i * (paneWidth + gap);
    panes.push({
      minX,
      maxX: minX + paneWidth,
      minY: center.y - height / 2,
      maxY: center.y + height / 2,
    });
  }

  return panes;
}

/**
 * Curtain panel geometry, shared by the scene builder and the weather painter.
 *
 * The weather canvas is a 2D overlay drawn *above* the whole room, so anything
 * it paints inside the window rectangle also lands on top of any curtain panel
 * hanging in front of the glass. Returning the panels here lets the painter
 * subtract their projected footprint and keep the fabric opaque — which is what
 * "closed curtains hide the exterior" actually requires.
 */
export function curtainPanels(open: number): {
  min: Vec3;
  max: Vec3;
  color: string;
}[] {
  const { center, width, height } = WINDOW_FRAME;
  const z = center.z + 4;
  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const top = center.y + height / 2;
  const bottom = center.y - height / 2;
  const halfOpening = width / 2;
  const panelWidth = halfOpening * (1.04 - open * 0.62);
  const slide = open * (halfOpening * 0.92);

  return [
    {
      min: v(left - 46 - slide, bottom - 10, z + 16),
      max: v(left - 46 + panelWidth - slide, top + 34, z + 42),
      color: "#7b5b76",
    },
    {
      min: v(left - 46 - slide + panelWidth * 0.22, bottom - 10, z + 20),
      max: v(left - 46 + panelWidth - slide, top + 34, z + 34),
      color: "#8b6a85",
    },
    {
      min: v(right + 46 - panelWidth + slide, bottom - 10, z + 16),
      max: v(right + 46 + slide, top + 34, z + 42),
      color: "#7b5b76",
    },
    {
      min: v(right + 46 - panelWidth * 0.22 + slide, bottom - 10, z + 20),
      max: v(right + 46, top + 34, z + 34),
      color: "#8b6a85",
    },
  ];
}

/**
 * Window assembly. Panes carry `kind: "sky"` so the renderer fills them with
 * the live atmosphere gradient instead of a lit surface colour.
 */
export function buildWindow(curtainsOpen: number, fairyLights: boolean): FaceGroup {
  const { center, width, height } = WINDOW_FRAME;
  const z = center.z;
  const groups: Face[] = [];
  const panes = windowPanes();
  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const top = center.y + height / 2;
  const bottom = center.y - height / 2;

  for (const pane of panes) {
    groups.push(
      face(
        "window",
        [
          v(pane.minX, pane.minY, z),
          v(pane.maxX, pane.minY, z),
          v(pane.maxX, pane.maxY, z),
          v(pane.minX, pane.maxY, z),
        ],
        "#1b2438",
        "sky",
        v(0, 0, 1),
        { gradient: "omj-sky", emissive: 1 },
      ),
    );
  }

  // Frame rails
  const rail = (min: Vec3, max: Vec3, albedo: string) => {
    groups.push(...box("window", min, max, albedo, { skipBottom: true, kind: "furniture" }));
  };

  rail(v(left - 26, top, z - 20), v(right + 26, top + 26, z + 10), "#6b4a3c");
  rail(v(left - 26, bottom - 26, z - 20), v(right + 26, bottom, z + 10), "#6b4a3c");
  rail(v(left - 26, bottom, z - 20), v(left, top, z + 10), "#6b4a3c");
  rail(v(right, bottom, z - 20), v(right + 26, top, z + 10), "#6b4a3c");
  rail(v(left + 150, bottom, z - 14), v(left + 164, top, z + 6), "#5c4033");
  rail(v(left + 150 + 14 + 176, bottom, z - 14), v(left + 150 + 14 + 190, top, z + 6), "#5c4033");

  // Projecting sill: catches the lamp light and grounds the window.
  groups.push(
    ...box("window", v(left - 44, bottom - 44, z - 10), v(right + 44, bottom - 20, z + 54), "#7a5643", {
      skipBottom: true,
      kind: "furniture",
    }),
  );

  /*
   * Curtains.
   *
   * These are two panels that *meet* when closed and gather at the jambs when
   * open. The previous width (120 units on a 520-unit window) left the middle
   * of the glass uncovered no matter what, so "closed" curtains still showed a
   * fully readable sky, clouds and rain through the gap — the exterior was
   * never actually occluded.
   *
   * Each panel is now just over half the opening, and they slide out past the
   * reveal as they open, so closed means closed and open means the whole pane
   * is visible. A small seam is left at the centre, which is the one gap real
   * curtains do leave.
   */
  const open = Math.max(0, Math.min(1, curtainsOpen));
  const halfOpening = width / 2;
  // 0 closed → each panel covers 52% of the opening (2% overlap at the seam).
  // 1 open   → each panel gathers to 30% and slides clear of the glass.
  groups.push(
    // Deep folds: two overlapping panels each, so the fabric reads as gathered
    // cloth rather than a flat shutter. Geometry comes from `curtainPanels()` so
    // the weather painter can occlude exactly the same region.
    ...curtainPanels(open).flatMap((panel) =>
      box("curtains", panel.min, panel.max, panel.color, { skipBottom: true, kind: "accent" }),
    ),
  );

  if (fairyLights) {
    groups.push(
      face(
        "window",
        [v(left - 10, top + 2, z + 26), v(right + 10, top + 2, z + 26), v(right + 10, top + 12, z + 26), v(left - 10, top + 12, z + 26)],
        "#ffe1a6",
        "accent",
        v(0, 0, 1),
        { emissive: 0.92 },
      ),
    );
  }

  return {
    id: "window",
    anchor: v(center.x, center.y, z),
    faces: groups,
    hotspot: { x: center.x, y: center.y, z: z + 30, radius: 300, label: "The window", objectId: "window" },
  };
}

/* ── static scene assembly ────────────────────────────────────────────────── */

export interface ExploreScene {
  shell: Face[];
  furniture: FaceGroup[];
}

export function buildExploreScene(): ExploreScene {
  return { shell: buildShell(), furniture: buildFurniture() };
}

/**
 * Character anchors on the rug, in world space.
 *
 * Both plushies stand on the middle of the rug (z ~ -210), which is further
 * from the default camera than the front of the room. That keeps their feet
 * above the command bar at every supported viewport and lets them share the
 * frame with the lamp and the window instead of blocking both.
 */
export const CHARACTER_ANCHORS = {
  mochi: v(-230, 0, -320),
  yume: v(215, 0, -345),
} as const;

/* ── camera safety ────────────────────────────────────────────────────────── */

/**
 * Axis-aligned interior volumes the camera must stay out of.
 *
 * Derived from the furniture geometry above (the same literals, kept adjacent so
 * a moved bed is a two-line change). Before this list existed, orbiting toward
 * the bed walked the camera *into* the bed box: the near plane clipped the
 * mattress open and the quilt filled the frame as a giant tan blob, which is what
 * the orbit probe caught at yaw −138° and −230°.
 */
export const CAMERA_OBSTACLES: Array<{
  id: string;
  min: Vec3;
  max: Vec3;
  /** Extra breathing room so the near plane never grazes a face. */
  pad: number;
}> = [
  // Bed: base, mattress, headboard, footboard.
  { id: "bed", min: v(462, 0, -258), max: v(722, 330, 158), pad: 46 },
  // Nightstand + lamp.
  { id: "nightstand", min: v(-600, 0, -330), max: v(-400, 470, -160), pad: 40 },
  // Vanity table + standing mirror.
  { id: "vanity", min: v(-760, 0, -356), max: v(-560, 720, 380), pad: 46 },
  // Bookshelf.
  { id: "bookshelf", min: v(-620, 0, 520), max: v(-220, 720, 660), pad: 44 },
  // Chair.
  { id: "chair", min: v(300, 0, 360), max: v(540, 430, 590), pad: 40 },
  // The snow globe, gift and plant are deliberately *not* camera obstacles:
  // they are knee-height props, the orbit passes above them, and making them
  // solid pushed the camera 170 units inward near the window wall for no visual
  // gain. The near plane handles them if the camera ever does get close.
] as const;

/**
 * True when a point is inside any padded obstacle volume.
 * Used by the camera clamp; split out so it is unit-testable.
 */
export function insideObstacle(point: Vec3, obstacles = CAMERA_OBSTACLES): boolean {
  return obstacles.some(
    (o) =>
      point.x > o.min.x - o.pad &&
      point.x < o.max.x + o.pad &&
      point.y > o.min.y - o.pad &&
      point.y < o.max.y + o.pad &&
      point.z > o.min.z - o.pad &&
      point.z < o.max.z + o.pad,
  );
}
