import type { IncomingMessage, ServerResponse } from "node:http";

export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow" | "mist";

export interface NormalizedLiveWeather {
  condition: WeatherCondition;
  isDay: boolean;
  temperatureC: number;
  apparentTemperatureC: number;
  cloudCover: number;
  rainIntensity: number;
  snowIntensity: number;
  windSpeedMs: number;
  weatherCode: number;
}

export interface SceneContextPayload {
  ok: boolean;
  timezone: string | null;
  weather: NormalizedLiveWeather | null;
  attribution: string;
}

interface OpenMeteoCurrent {
  temperature_2m?: unknown;
  apparent_temperature?: unknown;
  is_day?: unknown;
  rain?: unknown;
  showers?: unknown;
  snowfall?: unknown;
  weather_code?: unknown;
  cloud_cover?: unknown;
  wind_speed_10m?: unknown;
}

interface OpenMeteoResponse {
  timezone?: unknown;
  current?: OpenMeteoCurrent;
}

const ATTRIBUTION = "Weather data by Open-Meteo.com";

function headerString(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
    const trimmed = raw[0].trim();
    return trimmed || null;
  }
  return null;
}

function parseFiniteCoord(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildOpenMeteoUrl(
  latitude: number,
  longitude: number,
  timezone?: string | null,
): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current:
      "temperature_2m,apparent_temperature,is_day,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m",
    timezone: timezone && timezone.length <= 64 ? timezone : "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function classifyOpenMeteoCurrent(
  current: OpenMeteoCurrent,
): NormalizedLiveWeather | null {
  if (
    typeof current.temperature_2m !== "number" ||
    !Number.isFinite(current.temperature_2m)
  ) {
    return null;
  }

  const temperatureC = current.temperature_2m;
  const apparentTemperatureC = finiteNumber(
    current.apparent_temperature,
    temperatureC,
  );
  const isDay = finiteNumber(current.is_day, 1) >= 0.5;
  const rainMm = finiteNumber(current.rain, 0) + finiteNumber(current.showers, 0);
  const snowfallCm = finiteNumber(current.snowfall, 0);
  const weatherCode = Math.round(finiteNumber(current.weather_code, 0));
  const cloudCover = clamp01(finiteNumber(current.cloud_cover, 0) / 100);
  const windSpeedMs = Math.max(0, finiteNumber(current.wind_speed_10m, 0));

  // WMO Weather interpretation codes (WW):
  // 45, 48: Fog/mist
  // 51..67, 80..82, 95..99: Drizzle / Rain / Showers / Thunderstorm
  // 71..77, 85..86: Snowfall / Snow grains / Snow showers
  const isSnowCode =
    (weatherCode >= 71 && weatherCode <= 77) ||
    weatherCode === 85 ||
    weatherCode === 86;
  const isRainCode =
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82) ||
    weatherCode >= 95;
  const isMistCode = weatherCode === 45 || weatherCode === 48;

  // Enforce strict mutual exclusion between snow and rain
  let condition: WeatherCondition = "clear";
  let rainIntensity = 0;
  let snowIntensity = 0;

  if (snowfallCm > 0.01 || isSnowCode) {
    condition = "snow";
    snowIntensity = clamp01(Math.max(0.35, snowfallCm / 1.5));
  } else if (rainMm > 0.01 || isRainCode) {
    condition = "rain";
    rainIntensity = clamp01(Math.max(0.35, rainMm / 4));
  } else if (isMistCode) {
    condition = "mist";
  } else if (cloudCover >= 0.28 || weatherCode === 2 || weatherCode === 3) {
    condition = "cloudy";
  }

  return {
    condition,
    isDay,
    temperatureC,
    apparentTemperatureC,
    cloudCover,
    rainIntensity,
    snowIntensity,
    windSpeedMs,
    weatherCode,
  };
}

export async function resolveSceneContextFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<SceneContextPayload> {
  const rawTz = headerString(headers, "x-vercel-ip-timezone");
  const timezone = rawTz && /^[A-Za-z0-9_/+\\-]{1,64}$/.test(rawTz) ? rawTz : null;

  const lat = parseFiniteCoord(headerString(headers, "x-vercel-ip-latitude"), -90, 90);
  const lon = parseFiniteCoord(headerString(headers, "x-vercel-ip-longitude"), -180, 180);

  if (lat === null || lon === null) {
    return {
      ok: false,
      timezone,
      weather: null,
      attribution: ATTRIBUTION,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetchImpl(buildOpenMeteoUrl(lat, lon, timezone), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      return {
        ok: false,
        timezone,
        weather: null,
        attribution: ATTRIBUTION,
      };
    }

    const body = (await response.json()) as OpenMeteoResponse;
    const weather = body.current ? classifyOpenMeteoCurrent(body.current) : null;
    const resolvedTz =
      typeof body.timezone === "string" && body.timezone ? body.timezone : timezone;

    return {
      ok: weather !== null,
      timezone: resolvedTz,
      weather,
      attribution: ATTRIBUTION,
    };
  } catch {
    return {
      ok: false,
      timezone,
      weather: null,
      attribution: ATTRIBUTION,
    };
  }
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  const payload = await resolveSceneContextFromHeaders(req.headers);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // Never cache visitor-derived context in shared CDN caches
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.end(req.method === "HEAD" ? "" : JSON.stringify(payload));
}
