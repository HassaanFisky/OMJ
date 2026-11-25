import { describe, expect, it } from "vitest";
import {
  initialScore,
  buildShots,
  cueAt,
  parseScore,
  validateScore,
} from "../src/timeline/score";
import { targetFor } from "../src/timeline/scenes";
import { FilmEngine } from "../src/animation/FilmEngine";
import { resolveAuthoritativeEnv } from "../src/environment/weatherState";
import {
  buildOpenMeteoUrl,
  resolveSceneContextFromHeaders,
} from "../api/scene-context";

describe("complete lyric score", () => {
  it("contains all 43 supplied lines", () => {
    expect(initialScore.cues).toHaveLength(43);

    expect(
      new Set(initialScore.cues.map((cue) => cue.id)).size,
    ).toBe(43);
  });

  it("keeps eight separate lines in each chorus", () => {
    expect(
      initialScore.cues.filter((cue) =>
        cue.action.startsWith("chorus1"),
      ),
    ).toHaveLength(8);

    expect(
      initialScore.cues.filter((cue) =>
        cue.action.startsWith("chorus2"),
      ),
    ).toHaveLength(8);
  });

  it("uses half-open boundaries", () => {
    expect(cueAt(28, initialScore)?.id).toBe("line-1");
    expect(cueAt(31, initialScore)?.id).toBe("line-2");
    expect(cueAt(68.5, initialScore)).toBeUndefined();
  });

  it("does not certify the supplied timing", () => {
    expect(initialScore.verification).toBe("draft");
    expect(
      initialScore.cues.every((cue) => cue.verification === "draft"),
    ).toBe(true);
  });

  it("rejects media shorter than the score", () => {
    expect(validateScore(initialScore, 120).length).toBeGreaterThan(0);
  });

  it("accepts the local omj.m4a duration (161.332s)", () => {
    expect(validateScore(initialScore, 161.332)).toEqual([]);
  });

  it("rejects changed lyrics in an imported score", () => {
    const changed = structuredClone(initialScore);
    changed.cues[0]!.text = "Changed text";

    expect(() => parseScore(JSON.stringify(changed))).toThrow();
  });
});

describe("complete scene coverage", () => {
  it("covers every instant of the media, including gaps", () => {
    const duration = 161.332;
    const shots = buildShots(initialScore, duration);

    expect(shots[0]!.start).toBe(0);
    expect(shots[shots.length - 1]!.end).toBe(duration);

    shots.forEach((shot, index) => {
      expect(shot.end).toBeGreaterThan(shot.start);

      if (index) {
        expect(shot.start).toBe(shots[index - 1]!.end);
      }
    });
  });

  it("implements every action", () => {
    for (const cue of initialScore.cues) {
      expect(() => targetFor(cue.action)).not.toThrow();
    }

    expect(() => targetFor("intro")).not.toThrow();
    expect(() => targetFor("tail")).not.toThrow();
  });

  it("moves camera horizontally rightward from opening to final bed scene", () => {
    const intro = targetFor("intro");
    const chorus1 = targetFor("chorus1-0");
    const nervous = targetFor("nervous");
    const lap = targetFor("lap");
    const quilt = targetFor("quilt");

    expect(chorus1.env.camX).toBeGreaterThan(intro.env.camX);
    expect(nervous.env.camX).toBeGreaterThan(chorus1.env.camX);
    expect(lap.env.camX).toBeGreaterThan(nervous.env.camX);
    expect(quilt.env.camX).toBeGreaterThan(intro.env.camX);
  });

  it("uses progressive choreography between Chorus 1 and Chorus 2", () => {
    const c1 = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      targetFor(`chorus1-${i}` as Parameters<typeof targetFor>[0]),
    );
    const c2 = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      targetFor(`chorus2-${i}` as Parameters<typeof targetFor>[0]),
    );

    expect(new Set(c1.map((f) => f.env.camX)).size).toBe(8);
    expect(c2[0]!.env.camX).toBeGreaterThan(c1[7]!.env.camX);
    expect(c2[1]!.env.hold).toBe(1);
    expect(c2[7]!.env.hug).toBe(1);
  });

  it("aligns back-facing window characters with zero neck twist", () => {
    const w = targetFor("window");
    expect(w.a.back).toBe(1);
    expect(w.b.back).toBe(1);
    expect(w.a.head).toBe(0);
    expect(w.b.head).toBe(0);
  });
});

describe("deterministic rendering", () => {
  it("reconstructs the same pose after arbitrary seeks", () => {
    const film = new FilmEngine(initialScore, 161.332);
    const first = film.sample(100.8, false);

    film.sample(145.3, false);
    film.sample(12.5, false);
    film.sample(75.1, false);

    const repeated = film.sample(100.8, false);

    expect(repeated.a.x).toBeCloseTo(first.a.x, 5);
    expect(repeated.a.head).toBeCloseTo(first.a.head, 5);
    expect(repeated.b.alpha).toBeCloseTo(first.b.alpha, 5);
    expect(repeated.env.thought).toBeCloseTo(first.env.thought, 5);

    film.dispose();
  });

  it("places Mochi's resting head squarely on Yume's lap in Cue 31", () => {
    const film = new FilmEngine(initialScore, 161.332);
    const frame = film.sample(109.5, false);

    expect(frame.action).toBe("lap");
    expect(frame.a.rotation).toBeCloseTo(90, 1);
    expect(frame.b.sit).toBeCloseTo(1, 2);
    expect(frame.a.x + 150 * frame.a.scale)
      .toBeCloseTo(frame.b.x - 22, 2);

    film.dispose();
  });

  it("finishes at the actual duration", () => {
    const film = new FilmEngine(initialScore, 161.332);

    expect(film.sample(161.332, false).env.alpha).toBe(0);
    film.dispose();
  });

  it("removes camera travel under reduced motion", () => {
    const film = new FilmEngine(initialScore, 161.332);

    expect(film.sample(46, true).env.zoom).toBe(1);
    film.dispose();
  });
});

describe("authoritative environment state", () => {
  it("never renders sun and moon together at any solar transition value", () => {
    const base = targetFor("intro").env;
    for (let s = 0; s <= 1.001; s += 0.02) {
      const auth = resolveAuthoritativeEnv({ ...base, sun: s, clouds: 0 });
      expect(auth.sun > 0 && auth.moon > 0).toBe(false);
    }
  });

  it("never renders rain and snow simultaneously", () => {
    const base = targetFor("intro").env;
    for (const [rain, snow] of [
      [0.8, 0.2],
      [0.5, 0.5],
      [0.3, 0.9],
    ] as const) {
      const auth = resolveAuthoritativeEnv({ ...base, rain, snow });
      expect(auth.rain > 0 && auth.snow > 0).toBe(false);
    }
  });

  it("suppresses night stars during bright daytime", () => {
    const base = targetFor("intro").env;
    const auth = resolveAuthoritativeEnv({ ...base, sun: 0.85, stars: 1 });
    expect(auth.stars).toBe(0);
  });

  it("produces zero clouds for clear weather", () => {
    const base = targetFor("intro").env;
    const auth = resolveAuthoritativeEnv(base, {
      isIntroPreview: true,
      opening: {
        timezone: "UTC",
        localHour: 14,
        attribution: "Weather data by Open-Meteo.com",
        weather: {
          condition: "clear",
          isDay: true,
          temperatureC: 22,
          apparentTemperatureC: 22,
          cloudCover: 0,
          rainIntensity: 0,
          snowIntensity: 0,
          windSpeedMs: 2,
          weatherCode: 0,
        },
      },
    });
    expect(auth.clouds).toBe(0);
    expect(auth.moon).toBe(0);
    expect(auth.stars).toBe(0);
  });
});

describe("server-side scene-context endpoint", () => {
  it("builds the minimal Open-Meteo current-conditions URL", () => {
    const url = new URL(buildOpenMeteoUrl(51.5074, -0.1278, "Europe/London"));
    expect(url.origin).toBe("https://api.open-meteo.com");
    expect(url.pathname).toBe("/v1/forecast");
    expect(url.searchParams.get("current")).toBe(
      "temperature_2m,apparent_temperature,is_day,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m",
    );
    expect(url.searchParams.has("hourly")).toBe(false);
    expect(url.searchParams.has("forecast_days")).toBe(false);
  });

  it("does not fabricate weather or assume Karachi when headers are missing", async () => {
    const result = await resolveSceneContextFromHeaders({});
    expect(result.ok).toBe(false);
    expect(result.weather).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/karachi/i);
  });

  it("never exposes coordinates, city, or IP in its response payload", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          timezone: "Europe/Berlin",
          current: {
            temperature_2m: 4.2,
            apparent_temperature: 1.5,
            is_day: 0,
            rain: 0,
            showers: 0,
            snowfall: 0.4,
            weather_code: 71,
            cloud_cover: 80,
            wind_speed_10m: 3.1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await resolveSceneContextFromHeaders(
      {
        "x-vercel-ip-latitude": "52.52",
        "x-vercel-ip-longitude": "13.41",
        "x-vercel-ip-city": "Munich",
        "x-vercel-ip-timezone": "Europe/Berlin",
      },
      mockFetch,
    );

    expect(result.ok).toBe(true);
    expect(result.weather?.condition).toBe("snow");
    expect(result.weather?.rainIntensity).toBe(0);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Munich");
    expect(serialized).not.toContain("52.52");
    expect(serialized).not.toContain("13.41");
  });

  it("returns neutral failure state when Open-Meteo errors", async () => {
    const failFetch: typeof fetch = async () =>
      new Response("upstream error", { status: 503 });

    const result = await resolveSceneContextFromHeaders(
      {
        "x-vercel-ip-latitude": "35.6762",
        "x-vercel-ip-longitude": "139.6503",
        "x-vercel-ip-timezone": "Asia/Tokyo",
      },
      failFetch,
    );

    expect(result.ok).toBe(false);
    expect(result.weather).toBeNull();
    expect(result.timezone).toBe("Asia/Tokyo");
  });
});
