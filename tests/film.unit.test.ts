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

  it("rejects changed lyrics in an imported score", () => {
    const changed = structuredClone(initialScore);
    changed.cues[0]!.text = "Changed text";

    expect(() => parseScore(JSON.stringify(changed))).toThrow();
  });
});

describe("complete scene coverage", () => {
  it("covers every instant of the media, including gaps", () => {
    const duration = 164.375;
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
});

describe("deterministic rendering", () => {
  it("reconstructs the same pose after arbitrary seeks", () => {
    const film = new FilmEngine(initialScore, 164.375);
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

  it("places the resting head at the lap", () => {
    const film = new FilmEngine(initialScore, 164.375);
    const frame = film.sample(109.5, false);

    expect(frame.action).toBe("lap");
    expect(frame.a.x + 150 * frame.a.scale)
      .toBeCloseTo(frame.b.x - 22, 2);

    film.dispose();
  });

  it("finishes at the actual duration", () => {
    const film = new FilmEngine(initialScore, 164.375);

    expect(film.sample(164.375, false).env.alpha).toBe(0);
    film.dispose();
  });

  it("removes camera travel under reduced motion", () => {
    const film = new FilmEngine(initialScore, 164.375);

    expect(film.sample(46, true).env.zoom).toBe(1);
    film.dispose();
  });
});
