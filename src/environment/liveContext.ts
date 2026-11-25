import type { SceneContextPayload } from "../../api/scene-context";
import type { LiveOpeningContext } from "./weatherState";

export function localHourInTimezone(timezone: string, now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "numeric",
      minute: "numeric",
    }).formatToParts(now);

    const hourPart = Number(parts.find((p) => p.type === "hour")?.value ?? now.getHours());
    const minPart = Number(parts.find((p) => p.type === "minute")?.value ?? now.getMinutes());
    const hour = hourPart === 24 ? 0 : hourPart;
    return Math.max(0, Math.min(23.99, hour + minPart / 60));
  } catch {
    return now.getHours() + now.getMinutes() / 60;
  }
}

export function clientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function fallbackOpeningContext(now: Date = new Date()): LiveOpeningContext {
  const tz = clientTimezone();
  return {
    timezone: tz,
    localHour: localHourInTimezone(tz, now),
    weather: null,
    attribution: "Weather data by Open-Meteo.com",
  };
}

export async function fetchLiveOpeningContext(
  now: Date = new Date(),
): Promise<LiveOpeningContext> {
  const fallbackTz = clientTimezone();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch("/api/scene-context", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      return fallbackOpeningContext(now);
    }

    const data = (await response.json()) as Partial<SceneContextPayload>;
    const tz =
      typeof data.timezone === "string" && data.timezone
        ? data.timezone
        : fallbackTz;

    return {
      timezone: tz,
      localHour: localHourInTimezone(tz, now),
      weather: data.ok && data.weather ? data.weather : null,
      attribution:
        typeof data.attribution === "string" && data.attribution
          ? data.attribution
          : "Weather data by Open-Meteo.com",
    };
  } catch {
    return fallbackOpeningContext(now);
  }
}
