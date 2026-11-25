import type { Environment } from "../timeline/scenes";
import type { NormalizedLiveWeather } from "../../api/scene-context";

export interface LiveOpeningContext {
  timezone: string;
  localHour: number; // fractional hour 0..24
  weather: NormalizedLiveWeather | null;
  attribution: string;
}

export interface AuthoritativeEnv {
  sun: number;
  moon: number;
  stars: number;
  clouds: number;
  rain: number;
  snow: number;
  mist: number;
  frost: number;
  wetGlass: number;
  lampGlow: number;
  coldTint: number;
  warmth: number;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  captionTone: "warm" | "cool" | "neutral";
  shootingStarChance: number;
  windMs: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = Number.parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a: string, b: string, t: number): string {
  const k = clamp01(t);
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const r = Math.round(lerp(r1, r2, k));
  const g = Math.round(lerp(g1, g2, k));
  const bl = Math.round(lerp(b1, b2, k));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/**
 * Computes one authoritative, physically coherent environmental state.
 * Strict mutual exclusions enforced:
 * 1. Sun and moon are NEVER simultaneously > 0 (dead-zone separation).
 * 2. Rain and snow are NEVER simultaneously > 0.
 * 3. Stars NEVER appear in bright daytime.
 * 4. Clouds appear ONLY when cloudiness/storm conditions call for them.
 */
export function resolveAuthoritativeEnv(
  env: Environment,
  options?: {
    opening?: LiveOpeningContext | null;
    isIntroPreview?: boolean;
  },
): AuthoritativeEnv {
  let rawSun = clamp01(env.sun);
  let rawRain = clamp01(env.rain);
  let rawSnow = clamp01(env.snow);
  let rawMist = clamp01(env.mist);
  let rawStars = clamp01(env.stars);
  let rawClouds = clamp01(env.clouds ?? 0);
  let rawCold = clamp01(env.cold);
  let rawFrost = clamp01(env.frost ?? 0);
  let windMs = 2.4;
  let tempMod = 0; // -1 very cold, +1 warm

  const opening = options?.opening;
  if (options?.isIntroPreview && opening) {
    const h = opening.localHour;
    const isNightHour = h < 5.2 || h >= 19.6;
    const isDawn = h >= 5.2 && h < 7.5;
    const isDayHour = h >= 7.5 && h < 17.0;
    const isDusk = h >= 17.0 && h < 19.6;

    // Derive local sky phase from actual local clock (never fake afternoon at midnight)
    if (isNightHour) {
      rawSun = 0;
      rawStars = 0.85;
      rawClouds = 0;
    } else if (isDawn) {
      const p = (h - 5.2) / 2.3;
      rawSun = lerp(0.0, 0.55, p);
      rawStars = lerp(0.45, 0.0, p);
      rawClouds = 0.12;
    } else if (isDayHour) {
      rawSun = 0.92;
      rawStars = 0;
      rawClouds = 0;
    } else if (isDusk) {
      const p = (h - 17.0) / 2.6;
      rawSun = lerp(0.62, 0.0, p);
      rawStars = lerp(0.0, 0.55, p);
      rawClouds = 0.14;
    }

    const w = opening.weather;
    if (w) {
      windMs = w.windSpeedMs;
      tempMod = clamp01((w.apparentTemperatureC - 5) / 24) * 2 - 1;
      if (w.apparentTemperatureC <= 6) {
        rawCold = Math.max(rawCold, clamp01((8 - w.apparentTemperatureC) / 14));
      }

      if (w.condition === "clear") {
        rawClouds = 0;
        rawRain = 0;
        rawSnow = 0;
        rawMist = 0;
      } else if (w.condition === "cloudy") {
        rawClouds = Math.max(0.28, w.cloudCover);
        rawRain = 0;
        rawSnow = 0;
        rawMist = 0;
        rawStars *= 1 - w.cloudCover * 0.85;
        if (w.cloudCover > 0.72) rawSun *= 0.45;
      } else if (w.condition === "rain") {
        rawRain = Math.max(0.42, w.rainIntensity);
        rawSnow = 0;
        rawClouds = Math.max(0.65, w.cloudCover);
        rawMist = 0.25;
        rawStars = 0;
        rawSun = 0;
      } else if (w.condition === "snow") {
        rawSnow = Math.max(0.45, w.snowIntensity);
        rawRain = 0;
        rawFrost = Math.max(rawFrost, 0.55);
        rawCold = Math.max(rawCold, 0.75);
        rawClouds = Math.max(0.45, w.cloudCover);
        rawStars *= 0.3;
        rawSun *= 0.35;
      } else if (w.condition === "mist") {
        rawMist = 0.75;
        rawClouds = Math.max(0.35, w.cloudCover);
        rawRain = 0;
        rawSnow = 0;
        rawStars *= 0.35;
      }
    }
  }

  // ── 1. Strict Rain vs Snow Mutual Exclusion ────────────────────────────────
  let rain = rawRain;
  let snow = rawSnow;
  if (rain > 0.01 && snow > 0.01) {
    if (snow >= rain) {
      rain = 0;
    } else {
      snow = 0;
    }
  }

  // ── 2. Strict Sun vs Moon Mutual Exclusion ─────────────────────────────────
  // Heavy rain suppresses direct sunbeams.
  const sunSuppressed = rain > 0.35 ? rawSun * 0.1 : rawSun;
  // Dead-zone [0.14 .. 0.18]: sun turns on above 0.18, moon turns on below 0.14.
  const sun = sunSuppressed >= 0.18 ? clamp01((sunSuppressed - 0.18) / 0.82) : 0;
  const moonCandidate =
    sunSuppressed <= 0.14 ? clamp01((0.14 - sunSuppressed) / 0.14) : 0;
  // Heavy overcast or rain hides the moon
  const cloudOcclusion = clamp01(1 - rawClouds * 0.75 - rain * 0.75);
  const moon = sun > 0 ? 0 : moonCandidate * cloudOcclusion;

  // ── 3. Stars strictly suppressed during daylight ───────────────────────────
  const stars =
    sun > 0.12
      ? 0
      : rawStars * (1 - clamp01(sun / 0.12)) * clamp01(1 - rain * 0.85 - rawClouds * 0.65);

  // ── 4. Clouds, frost, wet glass, warmth & lamp ─────────────────────────────
  const clouds = rawClouds;
  const frost = clamp01(Math.max(rawFrost, snow * 0.85, rawCold * 0.55));
  const wetGlass = clamp01(rain);
  const coldTint = clamp01(Math.max(rawCold, snow * 0.65));
  const lampGlow = clamp01(1 - sun * 0.72);
  const warmth = clamp01(sun * 0.65 + env.hug * 0.5 + env.lantern * 0.6 + (tempMod > 0 ? 0.12 : 0));

  // ── 5. Coherent Sky Gradient Palette ───────────────────────────────────────
  // Night base -> Dawn/Dusk -> Afternoon Day -> Rainstorm -> Winter Cold
  let skyTop = "#14162c";
  let skyMid = "#2a2344";
  let skyBottom = "#5b4466";

  if (sun > 0) {
    // Transition smoothly from twilight dusk/dawn into clear daytime sky
    if (sun < 0.45) {
      const p = sun / 0.45;
      skyTop = mixHex("#1f2042", "#4b5a8e", p);
      skyMid = mixHex("#4d3660", "#b87a84", p);
      skyBottom = mixHex("#8f5e74", "#f2b88d", p);
    } else {
      const p = (sun - 0.45) / 0.55;
      skyTop = mixHex("#4b5a8e", "#4b83bf", p);
      skyMid = mixHex("#8f8eb6", "#83b4de", p);
      skyBottom = mixHex("#e7be9c", "#cce0f0", p);
    }
  } else if (options?.isIntroPreview && opening && (opening.localHour >= 23 || opening.localHour < 4.5)) {
    // Quiet deep midnight sky
    skyTop = "#0a0c1b";
    skyMid = "#161b34";
    skyBottom = "#272b4b";
  }

  if (rain > 0.05) {
    const r = clamp01(rain);
    skyTop = mixHex(skyTop, sun > 0.25 ? "#4a566b" : "#181d2e", r * 0.82);
    skyMid = mixHex(skyMid, sun > 0.25 ? "#67758a" : "#283044", r * 0.82);
    skyBottom = mixHex(skyBottom, sun > 0.25 ? "#8c98ab" : "#404963", r * 0.8);
  }

  if (snow > 0.05 || coldTint > 0.2) {
    const c = clamp01(Math.max(snow * 0.7, coldTint * 0.55));
    skyTop = mixHex(skyTop, "#1c2744", c * 0.65);
    skyMid = mixHex(skyMid, "#3d4e73", c * 0.65);
    skyBottom = mixHex(skyBottom, "#7b8eb5", c * 0.65);
  }

  if (rawMist > 0.05) {
    const m = clamp01(rawMist);
    skyTop = mixHex(skyTop, "#2f2746", m * 0.5);
    skyMid = mixHex(skyMid, "#65537c", m * 0.55);
    skyBottom = mixHex(skyBottom, "#9f8bb5", m * 0.55);
  }

  const captionTone: "warm" | "cool" | "neutral" =
    coldTint > 0.35 || snow > 0.2
      ? "cool"
      : sun > 0.25 || env.hug > 0.35 || env.hearts > 0.35 || env.quilt > 0.3
        ? "warm"
        : "neutral";

  return {
    sun,
    moon,
    stars,
    clouds,
    rain,
    snow,
    mist: rawMist,
    frost,
    wetGlass,
    lampGlow,
    coldTint,
    warmth,
    skyTop,
    skyMid,
    skyBottom,
    captionTone,
    shootingStarChance: stars > 0.55 && rain < 0.05 && clouds < 0.4 ? 1 : 0,
    windMs,
  };
}
