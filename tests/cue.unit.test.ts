import { describe, expect, it } from "vitest";
import { initialScore } from "../src/timeline/score";

describe("canonical lyric cues", () => {
  it("keeps every authored cue, in order and non-overlapping", () => {
    expect(initialScore.cues.length).toBe(43);

    initialScore.cues.forEach((cue, index) => {
      expect(cue.text.trim().length).toBeGreaterThan(0);
      expect(cue.end).toBeGreaterThan(cue.start);
      if (index > 0) {
        const previous = initialScore.cues[index - 1]!;
        expect(cue.start).toBeGreaterThanOrEqual(previous.start);
      }
    });
  });

  it("resolves a deterministic cue at every canonical start time", () => {
    // Reconstructing state from time alone is what makes seek/pause/resume/replay
    // honest: the same clock must always produce the same cue.
    for (const cue of initialScore.cues) {
      const at = (time: number) =>
        initialScore.cues.find((item) => time >= item.start && time < item.end) ?? null;
      expect(at(cue.start)?.id).toBe(cue.id);
      expect(at(cue.end - 0.001)?.id).toBe(cue.id);
    }
  });
});
