import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import {
  cueAt,
  type Cue,
  type Score,
} from "../timeline/score";
import { clamp } from "../timeline/scenes";

export interface LyricsHandle {
  paint(time: number, score: Score, reduced: boolean): void;
  clear(): void;
}

export const LyricsDisplay = forwardRef<LyricsHandle>(
  function LyricsDisplay(_, ref) {
    const element = useRef<HTMLDivElement>(null);
    const previous = useRef<Cue | undefined>(undefined);
    const fills = useRef<HTMLElement[]>([]);

    function setCue(cue: Cue | undefined) {
      const root = element.current!;

      root.replaceChildren();
      root.dataset.cue = cue?.id ?? "";
      previous.current = cue;
      fills.current = [];

      if (!cue) return;

      if (cue.verification === "verified" && cue.words?.length) {
        for (const word of cue.words) {
          const wrapper = document.createElement("span");
          wrapper.className = "lyric-word";

          const wordText = word.text.toUpperCase();
          const base = document.createElement("span");
          base.textContent = wordText;

          const fill = document.createElement("span");
          fill.className = "lyric-word-fill";
          fill.textContent = wordText;

          wrapper.append(base, fill);
          root.append(wrapper);
          fills.current.push(fill);
        }
      } else {
        root.textContent = cue.text.toUpperCase();
      }
    }

    useImperativeHandle(ref, () => ({
      paint(time, score, reduced) {
        const root = element.current!;
        const cue = cueAt(time, score);

        if (cue !== previous.current) setCue(cue);

        const opacity = cue
          ? Math.min(
              clamp((time - cue.start) / 0.12),
              clamp((cue.end - time) / 0.12),
            )
          : 0;

        root.style.opacity = String(opacity);
        root.style.transform =
          `translateX(-50%) translateY(${reduced ? 0 : (1 - opacity) * 6}px)`;

        if (cue?.words && cue.verification === "verified") {
          cue.words.forEach((word, index) => {
            const progress = clamp(
              (time - word.start) / (word.end - word.start),
            );

            fills.current[index]!.style.clipPath =
              `inset(0 ${100 - progress * 100}% 0 0)`;
          });
        }
      },

      clear() {
        setCue(undefined);
        element.current!.style.opacity = "0";
      },
    }), []);

    return (
      <div
        ref={element}
        className="lyric-caption"
        aria-hidden="true"
      />
    );
  },
);
