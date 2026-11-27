/**
 * Shared colour maths for the world engine.
 *
 * Every lighting / atmosphere decision in OMJ resolves to one of these
 * primitives so Explore Mode, the cinematic film and the command layer all
 * speak the same colour language. Pure functions only — no side effects.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const clamp01 = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

export function parseHex(hex: string): Rgb {
  const clean = hex.trim().replace(/^#/, "");

  if (clean.length === 3) {
    const r = Number.parseInt(clean.charAt(0).repeat(2), 16);
    const g = Number.parseInt(clean.charAt(1).repeat(2), 16);
    const b = Number.parseInt(clean.charAt(2).repeat(2), 16);
    return { r, g, b };
  }

  const n = Number.parseInt(clean.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b))
    .toString(16)
    .slice(1)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const k = clamp01(t);
  const c1 = parseHex(a);
  const c2 = parseHex(b);
  return toHex({
    r: c1.r + (c2.r - c1.r) * k,
    g: c1.g + (c2.g - c1.g) * k,
    b: c1.b + (c2.b - c1.b) * k,
  });
}

/** Multiply a colour's luminance without changing its hue balance. */
export function shadeHex(hex: string, amount: number): string {
  const c = parseHex(hex);
  return toHex({ r: c.r * amount, g: c.g * amount, b: c.b * amount });
}

/** Scale luminance by `amount`, then blend `t` of the way toward `toward`. */
export function tintHex(hex: string, toward: string, t: number): string {
  return mixHex(hex, toward, t);
}

/** Perceived luminance 0..1 (Rec. 709). */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha).toFixed(3)})`;
}

/**
 * Colour temperature in kelvin (1800 = candle, 6500 = daylight).
 * Returns a warm-to-cool tint that can be mixed into lit surfaces.
 */
export function kelvinTint(kelvin: number): string {
  const k = Math.max(1800, Math.min(9000, kelvin));
  if (k <= 4000) {
    // amber -> neutral
    return mixHex("#ff9b3d", "#ffd9a8", (k - 1800) / (4000 - 1800));
  }
  if (k <= 6600) {
    return mixHex("#ffd9a8", "#f4f1ea", (k - 4000) / (6600 - 4000));
  }
  return mixHex("#f4f1ea", "#c9dcff", (k - 6600) / (2400));
}

/** Normalised light strength 0..1 from kelvin for rendering overlays. */
export function kelvinStrength(kelvin: number): number {
  return clamp01((kelvin - 1800) / 4700) * 0.55 + 0.45;
}

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * clamp01(t);

/** Frame-rate independent exponential smoothing. */
export function damp(current: number, target: number, smoothing: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-smoothing * dt));
}

export function dampAngle(
  current: number,
  target: number,
  smoothing: number,
  dt: number,
): number {
  const delta = ((target - current + 540) % 360) - 180;
  return current + delta * (1 - Math.exp(-smoothing * dt));
}
