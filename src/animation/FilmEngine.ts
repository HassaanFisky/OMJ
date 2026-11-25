import { gsap } from "gsap";
import { buildShots, type Score, type Shot } from "../timeline/score";
import {
  attachHand,
  beatsFor,
  clamp,
  cloneFrame,
  targetFor,
  type Frame,
} from "../timeline/scenes";

interface CompiledShot {
  shot: Shot;
  state: Frame;
  timeline: ReturnType<typeof gsap.timeline> | null;
}

export class FilmEngine {
  private readonly shots: CompiledShot[] = [];

  constructor(
    score: Score,
    private readonly duration: number,
  ) {
    let previous = targetFor("intro");

    for (const shot of buildShots(score, duration)) {
      const state = cloneFrame(previous);

      if (shot.hold) {
        this.shots.push({ shot, state, timeline: null });
        continue;
      }

      const timeline = gsap.timeline({ paused: true });
      const length = shot.end - shot.start;
      const beats = beatsFor(shot.action, length);

      let prior = cloneFrame(previous);
      let priorAt = 0;

      for (const beat of beats) {
        const seconds = Math.max(0.0001, (beat.at - priorAt) * length);
        const position = priorAt * length;

        const settings = {
          duration: seconds,
          ease: "sine.inOut",
          immediateRender: false,
          lazy: false,
          overwrite: false,
        };

        timeline.fromTo(
          state.a,
          { ...prior.a },
          { ...beat.frame.a, ...settings },
          position,
        );

        timeline.fromTo(
          state.b,
          { ...prior.b },
          { ...beat.frame.b, ...settings },
          position,
        );

        timeline.fromTo(
          state.env,
          { ...prior.env },
          { ...beat.frame.env, ...settings },
          position,
        );

        prior = cloneFrame(beat.frame);
        priorAt = beat.at;
      }

      previous = cloneFrame(prior);
      this.shots.push({ shot, state, timeline });
    }
  }

  sample(rawTime: number, reduced: boolean): Frame {
    const time = clamp(rawTime, 0, this.duration);

    const compiled =
      this.shots.find(
        ({ shot }) => time >= shot.start && time < shot.end,
      ) ?? this.shots[this.shots.length - 1]!;

    const { shot, state, timeline } = compiled;
    const local = clamp(time - shot.start, 0, shot.end - shot.start);

    timeline?.time(local, true);

    const frame = reduced
      ? targetFor(shot.action)
      : cloneFrame(state);

    frame.action = shot.action;
    frame.progress = clamp(local / (shot.end - shot.start));

    if (reduced) {
      frame.env.zoom = 1;
      frame.env.camY = 0;

      if (shot.action === "tail") {
        frame.env.alpha = 1 - frame.progress;
      }
    }

    if (!reduced) {
      for (const pose of [frame.a, frame.b]) {
        const gait = Math.sin(time * 6.5);
        const fidget = Math.sin(time * 10) * pose.nervous;

        // Subtle walk hip-bob (only during active walk)
        pose.y -= Math.abs(gait) * pose.walk * 2.1;
        pose.leftY += fidget * 3.5;
        pose.rightY -= fidget * 3.5;
        pose.head += fidget * 1.6;
      }
    }

    const hold = frame.env.hold;
    if (hold > 0) {
      const x = (frame.a.x + frame.b.x) / 2;
      const y = Math.min(frame.a.y, frame.b.y) - 44;

      attachHand(frame.a, "right", x, y, hold);
      attachHand(frame.b, "left", x, y, hold);
    }

    if (frame.env.hug > 0) {
      attachHand(
        frame.a,
        "right",
        frame.b.x - 16,
        frame.b.y - 54,
        frame.env.hug,
      );

      attachHand(
        frame.b,
        "left",
        frame.a.x + 16,
        frame.a.y - 52,
        frame.env.hug,
      );
    }

    if (time >= this.duration) {
      frame.env.alpha = 0;
    }

    return frame;
  }

  dispose() {
    this.shots.forEach(({ timeline }) => timeline?.kill());
    this.shots.length = 0;
  }
}
