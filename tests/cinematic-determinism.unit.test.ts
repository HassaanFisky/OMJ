import { describe, expect, it } from "vitest";
import { FilmEngine } from "../src/animation/FilmEngine";
import { initialScore } from "../src/timeline/score";

/**
 * The film must be a pure function of the media clock.
 *
 * That is what makes pause/resume/seek/replay honest: any route to a given
 * timestamp has to land on exactly the same frame, so the animation can never
 * carry private state of its own.
 */
describe("cinematic state is reconstructed from time alone", () => {
  const duration = initialScore.cues.at(-1)!.end + 4;
  const film = new FilmEngine(initialScore, duration);

  /**
   * A flat, comparable summary of a sampled frame. The frame carries GSAP
   * timeline references (deliberately, so nothing is re-allocated per frame),
   * so it cannot be serialised directly — the observable numbers are what
   * matter here.
   */
  const fingerprint = (time: number) => {
    const frame = film.sample(time, false) as unknown as Record<string, unknown>;
    return Object.keys(frame)
      .sort()
      .map((key) => {
        const value = frame[key];
        if (typeof value === "number") return `${key}=${value.toFixed(4)}`;
        if (typeof value === "boolean" || typeof value === "string") return `${key}=${value}`;
        // Nested objects are summarised by their own scalar fields only.
        const flat = value && typeof value === "object"
          ? Object.entries(value as Record<string, unknown>)
              .filter(([, inner]) => typeof inner === "number" || typeof inner === "boolean" || typeof inner === "string")
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([innerKey, inner]) => `${innerKey}:${typeof inner === "number" ? inner.toFixed(3) : inner}`)
              .join(",")
          : "";
        return `${key}={${flat}}`;
      })
      .join("|");
  };

  it("returns an identical frame for the same time, however it was reached", () => {
    const times = [0, 12.5, 40, 78.5, 100.8, 139.5, 155];

    const forwards = times.map((time) => fingerprint(time));
    const backwards = [...times].reverse().map((time) => fingerprint(time)).reverse();

    expect(backwards).toEqual(forwards);

    // Sampling repeatedly must not mutate the film either.
    expect(times.map((time) => fingerprint(time))).toEqual(forwards);
  });

  it("holds the authored scene, rather than drifting, across each hold", () => {
    // Every cue is a hold: the action is a property of the cue window, so it
    // cannot creep while the cue is on screen.
    for (const cue of initialScore.cues) {
      const span = cue.end - cue.start;
      if (span < 0.6) continue;
      const opening = film.sample(cue.start + 0.05, false);
      const closing = film.sample(cue.end - 0.05, false);
      expect(closing.action).toBe(opening.action);
    }
  });
});
