/**
 * Room3D — True 360-degree 3D perspective projection & modern bedroom geometry.
 *
 * World coordinate system (centered at room floor center):
 * - X: -800 (West / Vanity Wall) to +800 (East / Bed Wall)
 * - Y: 0 (Floor) to +900 (Ceiling)
 * - Z: -700 (North / Window Wall) to +700 (South / Bookshelf & Lounge Wall)
 *
 * Camera orbits around (0, 260, 0) by (yawDeg, pitchDeg).
 * At yaw=0, camera looks toward -Z (North Wall).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Camera3D {
  yawRad: number;
  pitchRad: number;
  cx: number;
  cy: number;
  cz: number;
  fov: number;
  centerX: number;
  centerY: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  zCam: number;
  scale: number;
  visible: boolean;
}

export function createCamera3D(
  yawDeg: number,
  pitchDeg: number,
  centerX = 720,
  centerY = 540,
): Camera3D {
  const yawRad = (yawDeg * Math.PI) / 180;
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const radius = 620;
  const targetY = 255;

  // Camera position orbiting around (0, targetY, 0)
  const cx = Math.sin(yawRad) * Math.cos(pitchRad) * radius;
  const cy = targetY + Math.sin(pitchRad) * radius;
  const cz = Math.cos(yawRad) * Math.cos(pitchRad) * radius;

  return {
    yawRad,
    pitchRad,
    cx,
    cy,
    cz,
    fov: 920,
    centerX,
    centerY,
  };
}

export function project3D(p: Vec3, cam: Camera3D): ProjectedPoint {
  const dx = p.x - cam.cx;
  const dy = p.y - cam.cy;
  const dz = p.z - cam.cz;

  // Rotate around Y by -yawRad
  const cosY = Math.cos(cam.yawRad);
  const sinY = Math.sin(cam.yawRad);
  const rx = dx * cosY - dz * sinY;
  const rz1 = dx * sinY + dz * cosY;

  // Rotate around X by -pitchRad (camera looks toward -Z in camera space)
  const cosP = Math.cos(cam.pitchRad);
  const sinP = Math.sin(cam.pitchRad);
  const ry = dy * cosP - rz1 * sinP;
  const rz = dy * sinP + rz1 * cosP;

  // Forward is -rz
  const depth = -rz;
  if (depth < 35) {
    return { x: cam.centerX, y: cam.centerY, zCam: depth, scale: 0, visible: false };
  }

  const scale = cam.fov / depth;
  return {
    x: cam.centerX + rx * scale,
    y: cam.centerY - ry * scale,
    zCam: depth,
    scale,
    visible: true,
  };
}

export interface Quad3D {
  id: string;
  pts: [Vec3, Vec3, Vec3, Vec3];
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  wall?: "north" | "east" | "south" | "west" | "floor" | "ceiling";
}

export function projectQuad(quad: Quad3D, cam: Camera3D): {
  d: string;
  depth: number;
  visible: boolean;
} {
  const p0 = project3D(quad.pts[0], cam);
  const p1 = project3D(quad.pts[1], cam);
  const p2 = project3D(quad.pts[2], cam);
  const p3 = project3D(quad.pts[3], cam);
  if (!p0.visible || !p1.visible || !p2.visible || !p3.visible) {
    return { d: "", depth: 0, visible: false };
  }
  const depth = (p0.zCam + p1.zCam + p2.zCam + p3.zCam) * 0.25;
  const d = `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} L${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L${p2.x.toFixed(1)} ${p2.y.toFixed(1)} L${p3.x.toFixed(1)} ${p3.y.toFixed(1)} Z`;
  return { d, depth, visible: true };
}

/**
 * Generates the static 3D architectural shell & modern furniture quads
 * for all 4 walls, floor, ceiling, and rug.
 */
export function buildModernBedroomQuads(): Quad3D[] {
  const W = 800;
  const D = 700;
  const H = 900;

  return [
    // Floor (warm wide-plank oak)
    {
      id: "floor",
      wall: "floor",
      pts: [
        { x: -W, y: 0, z: -D },
        { x: W, y: 0, z: -D },
        { x: W, y: 0, z: D },
        { x: -W, y: 0, z: D },
      ],
      fill: "#3a271c",
      stroke: "#261810",
      strokeWidth: 1.5,
    },
    // Central plush bouclé area rug
    {
      id: "rug",
      wall: "floor",
      pts: [
        { x: -340, y: 2, z: -260 },
        { x: 340, y: 2, z: -260 },
        { x: 340, y: 2, z: 260 },
        { x: -340, y: 2, z: 260 },
      ],
      fill: "#d8cbb8",
      stroke: "#b8a790",
      strokeWidth: 2,
      opacity: 0.92,
    },
    // Ceiling (recessed cove-lit)
    {
      id: "ceiling",
      wall: "ceiling",
      pts: [
        { x: -W, y: H, z: D },
        { x: W, y: H, z: D },
        { x: W, y: H, z: -D },
        { x: -W, y: H, z: -D },
      ],
      fill: "#221b28",
      stroke: "#18121d",
      strokeWidth: 1,
    },
    // North Wall (z = -D)
    {
      id: "wall-north",
      wall: "north",
      pts: [
        { x: -W, y: 0, z: -D },
        { x: W, y: 0, z: -D },
        { x: W, y: H, z: -D },
        { x: -W, y: H, z: -D },
      ],
      fill: "#2e2436",
      stroke: "#1d1624",
      strokeWidth: 1.5,
    },
    // East Wall (x = +W) — Bed Wall
    {
      id: "wall-east",
      wall: "east",
      pts: [
        { x: W, y: 0, z: -D },
        { x: W, y: 0, z: D },
        { x: W, y: H, z: D },
        { x: W, y: H, z: -D },
      ],
      fill: "#282030",
      stroke: "#1b1421",
      strokeWidth: 1.5,
    },
    // West Wall (x = -W) — Vanity & Wardrobe Wall
    {
      id: "wall-west",
      wall: "west",
      pts: [
        { x: -W, y: 0, z: D },
        { x: -W, y: 0, z: -D },
        { x: -W, y: H, z: -D },
        { x: -W, y: H, z: D },
      ],
      fill: "#2a2132",
      stroke: "#1b1421",
      strokeWidth: 1.5,
    },
    // South Wall (z = +D) — Bookshelf, Art & Lounge Wall (revealed at 180 deg)
    {
      id: "wall-south",
      wall: "south",
      pts: [
        { x: W, y: 0, z: D },
        { x: -W, y: 0, z: D },
        { x: -W, y: H, z: D },
        { x: W, y: H, z: D },
      ],
      fill: "#261d2e",
      stroke: "#18121f",
      strokeWidth: 1.5,
    },
    // South Wall: Acoustic wood-slat accent panel
    {
      id: "south-slats",
      wall: "south",
      pts: [
        { x: 520, y: 40, z: D - 8 },
        { x: -120, y: 40, z: D - 8 },
        { x: -120, y: 780, z: D - 8 },
        { x: 520, y: 780, z: D - 8 },
      ],
      fill: "#4a3325",
      stroke: "#2d1d14",
      strokeWidth: 1.5,
    },
    // South Wall: Built-in recessed bookshelf with warm LED strip
    {
      id: "south-bookshelf",
      wall: "south",
      pts: [
        { x: -180, y: 60, z: D - 24 },
        { x: -580, y: 60, z: D - 24 },
        { x: -580, y: 720, z: D - 24 },
        { x: -180, y: 720, z: D - 24 },
      ],
      fill: "#3a281e",
      stroke: "#f6c982",
      strokeWidth: 2,
    },
    // South Wall: Framed minimalist art print 1
    {
      id: "south-art-1",
      wall: "south",
      pts: [
        { x: 420, y: 430, z: D - 18 },
        { x: 220, y: 430, z: D - 18 },
        { x: 220, y: 640, z: D - 18 },
        { x: 420, y: 640, z: D - 18 },
      ],
      fill: "#f2e7d8",
      stroke: "#8f6a4e",
      strokeWidth: 4,
    },
    // South Wall: Cozy modern lounge chair base
    {
      id: "south-chair",
      wall: "south",
      pts: [
        { x: 440, y: 12, z: D - 140 },
        { x: 230, y: 12, z: D - 140 },
        { x: 230, y: 185, z: D - 80 },
        { x: 440, y: 185, z: D - 80 },
      ],
      fill: "#c59d82",
      stroke: "#8a6750",
      strokeWidth: 2,
    },
    // East Wall: Modern upholstered low-profile platform bed
    {
      id: "east-bed-base",
      wall: "east",
      pts: [
        { x: W - 360, y: 20, z: -260 },
        { x: W - 20, y: 20, z: -260 },
        { x: W - 20, y: 165, z: 220 },
        { x: W - 360, y: 165, z: 220 },
      ],
      fill: "#5b4133",
      stroke: "#36241b",
      strokeWidth: 2,
    },
    // West Wall: Modern matte-oak wardrobe panel
    {
      id: "west-wardrobe",
      wall: "west",
      pts: [
        { x: -W + 24, y: 0, z: 160 },
        { x: -W + 24, y: 0, z: 540 },
        { x: -W + 24, y: 780, z: 540 },
        { x: -W + 24, y: 780, z: 160 },
      ],
      fill: "#4f382b",
      stroke: "#2f2018",
      strokeWidth: 2,
    },
  ];
}
