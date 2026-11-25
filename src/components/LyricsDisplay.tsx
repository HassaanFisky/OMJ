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

export interface SafeBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LyricsHandle {
  paint(time: number, score: Score, reduced: boolean, safeZones?: SafeBox[]): void;
  setTone(tone: "warm" | "cool" | "neutral"): void;
  setVisible(visible: boolean): void;
  clear(): void;
}

type Quadrant = "upper-left" | "mid-left" | "upper-right" | "lower-right";

const QUADRANTS: Array<{ id: Quadrant; x: number; y: number; align: "left" | "right" | "center" }> = [
  { id: "upper-left", x: 0.24, y: 0.16, align: "left" },
  { id: "upper-right", x: 0.76, y: 0.16, align: "right" },
  { id: "mid-left", x: 0.24, y: 0.34, align: "left" },
  { id: "lower-right", x: 0.74, y: 0.84, align: "right" },
];

const HERO_WORDS = new Set([
  "JAAN", "LOVE", "SAATH", "BARDASHT", "SARDIYAN", "GHALTIYAN",
  "KHIRKI", "RAZAAI", "GHUM", "QISSAY", "BETAAB", "TASALLIYAN",
  "KOSHISHEIN", "INTEZAAR", "BARBAAD", "HAMDARDI", "SHIKWE",
]);

function isHeroWord(raw: string): boolean {
  const clean = raw.replace(/[^A-Z]/gi, "").toUpperCase();
  return HERO_WORDS.has(clean) || clean.length >= 8;
}

function overlapArea(a: SafeBox, b: SafeBox): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  return ix * iy;
}

function pickSafePosition(cueIndex: number, safeZones: SafeBox[]): { leftPct: number; topPct: number; zone: Quadrant } {
  const preferred = QUADRANTS[cueIndex % QUADRANTS.length]!;
  if (!safeZones.length) {
    return { leftPct: preferred.x * 100, topPct: preferred.y * 100, zone: preferred.id };
  }

  let best = preferred;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let i = 0; i < QUADRANTS.length; i++) {
    const q = QUADRANTS[(cueIndex + i) % QUADRANTS.length]!;
    const box: SafeBox = {
      x1: q.x - 0.19,
      x2: q.x + 0.19,
      y1: q.y - 0.06,
      y2: q.y + 0.06,
    };
    let penalty = i * 0.004;
    for (const z of safeZones) {
      penalty += overlapArea(box, z);
    }
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = q;
    }
  }

  return {
    leftPct: clamp(best.x, 0.22, 0.78) * 100,
    topPct: clamp(best.y, 0.13, 0.87) * 100,
    zone: best.id,
  };
}

export const LyricsDisplay = forwardRef<LyricsHandle>(
  function LyricsDisplay(_, ref) {
    const element = useRef<HTMLDivElement>(null);
    const previous = useRef<Cue | undefined>(undefined);
    const fills = useRef<HTMLElement[]>([]);
    const visibleRef = useRef(true);

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
        // Kinetic DUUR-style split: preserve exact cue.text.toUpperCase() textContent
        // while giving hero emotional words expressive brush scale & contrast
        const tokens = cue.text.toUpperCase().split(/(\s+)/);
        for (const token of tokens) {
          if (!token) continue;
          if (/^\s+$/.test(token)) {
            root.append(document.createTextNode(token));
            continue;
          }
          const span = document.createElement("span");
          span.className = isHeroWord(token) ? "lyric-word-hero" : "lyric-word-sub";
          span.textContent = token;
          root.append(span);
        }
      }
    }

    useImperativeHandle(ref, () => ({
      paint(time, score, reduced, safeZones = []) {
        const root = element.current!;
        const cue = cueAt(time, score);

        if (cue !== previous.current) setCue(cue);

        if (!visibleRef.current) {
          root.style.opacity = "0";
          return;
        }

        const opacity = cue
          ? Math.min(
              clamp((time - cue.start) / 0.16),
              clamp((cue.end - time) / 0.16),
            )
          : 0;

        if (cue) {
          const idx = Math.max(0, score.cues.indexOf(cue));
          const pos = pickSafePosition(idx, safeZones);
          root.dataset.zone = pos.zone;
          root.style.left = `${pos.leftPct.toFixed(1)}%`;
          root.style.top = `${pos.topPct.toFixed(1)}%`;
        }

        const springIn = cue && !reduced
          ? clamp((time - cue.start) / 0.28)
          : 1;
        const slideY = reduced ? 0 : (1 - springIn) * 10;

        root.style.opacity = String(opacity);
        root.style.clipPath =
          springIn < 0.995
            ? `inset(0 ${((1 - springIn) * 100).toFixed(1)}% 0 0)`
            : "none";
        root.style.transform =
          `translate(-50%, -50%) translateY(${slideY.toFixed(1)}px) scale(${(0.96 + springIn * 0.04).toFixed(3)})`;

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

      setTone(tone) {
        if (element.current) {
          element.current.dataset.tone = tone;
        }
      },

      setVisible(visible) {
        visibleRef.current = visible;
        const root = element.current;
        if (!root) return;
        root.dataset.hidden = visible ? "false" : "true";
        if (!visible) {
          root.style.opacity = "0";
        }
      },

      clear() {
        setCue(undefined);
        if (element.current) {
          element.current.style.opacity = "0";
        }
      },
    }), []);

    return (
      <div
        ref={element}
        className="lyric-caption"
        data-tone="neutral"
        data-hidden="false"
        data-zone="upper-left"
        aria-hidden="true"
      />
    );
  },
);
