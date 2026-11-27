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
  /**
   * How strongly to avoid this box.
   *
   * The subject and the background cannot be treated alike: the window is a
   * huge, central, permanently-visible rectangle, so counting it at the same
   * weight as the plushies made *every* upper option look worse than parking the
   * caption across both characters' faces. Characters therefore carry a much
   * heavier weight than architecture.
   */
  weight?: number;
}

export interface LyricsHandle {
  paint(time: number, score: Score, reduced: boolean, safeZones?: SafeBox[]): void;
  setTone(tone: "warm" | "cool" | "neutral"): void;
  setVisible(visible: boolean): void;
  clear(): void;
}

type Quadrant = "upper-left" | "mid-left" | "upper-right" | "lower-right";

/**
 * Vertical band reserved for the playback toolbar, in CSS pixels. The toolbar
 * is a fixed overlay so these are stable; they only need to be tall enough
 * that a settled caption never tucks underneath it.
 */
const TOOLBAR_RESERVE_DESKTOP = 96;
const TOOLBAR_RESERVE_PHONE = 132;

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

/**
 * Splits a token into its leading letters and any trailing punctuation, so the
 * brush face only ever sets letters. A brushed comma beside a serif line reads
 * as a typesetting mistake, and it also inflates the hero box.
 */
function splitToken(token: string): { word: string; tail: string } {
  const match = /^([^\p{L}]*)(.*?)([^\p{L}]*)$/su.exec(token);
  if (!match) return { word: token, tail: "" };
  return { word: match[2] ?? token, tail: `${match[1] ?? ""}${match[3] ?? ""}` };
}

function isHeroWord(raw: string): boolean {
  const clean = splitToken(raw).word.replace(/[^A-Z]/gi, "").toUpperCase();
  if (!clean) return false;
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
    // The box is deliberately generous: it approximates the *rendered* caption,
    // which is a two-line, sometimes three-line block up to ~800px wide on a
    // desktop. The previous half-width of 0.19 suggested a one-line caption in
    // the middle of the screen, so the lower-right option scored as "clear" while
    // actually sitting across both plushies at the kiss.
    const box: SafeBox = {
      x1: q.x - 0.26,
      x2: q.x + 0.26,
      y1: q.y - 0.10,
      y2: q.y + 0.10,
    };
    // A caption that lands on top of the plushies is the one outcome that must
    // never win, however convenient the quadrant is. Anything else — the window,
    // the bed — is background and merely discouraged.
    let penalty = i * 0.004;
    let characterHit = 0;
    for (const z of safeZones) {
      const weighted = overlapArea(box, z) * (z.weight ?? 1);
      penalty += weighted;
      if ((z.weight ?? 1) >= 10) characterHit += weighted;
    }
    if (characterHit > 0) {
      // Dominant term: no amount of background clearance compensates.
      penalty += 1000 + characterHit;
    }
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = q;
    }
  }

  // The percentages clamp the *centre*, but a wide caption is centred with
  // translate(-50%), so a centre of 22% still pushes half the block off the left
  // edge. The safe inset depends on how wide the caption actually is, which only
  // the element knows — so `paint` refines this against its measured width.
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
          if (isHeroWord(token)) {
            const { word, tail } = splitToken(token);
            const hero = document.createElement("span");
            hero.className = "lyric-word-hero";
            hero.textContent = word;
            root.append(hero);

            if (tail) {
              const rest = document.createElement("span");
              rest.className = "lyric-word-sub";
              rest.textContent = tail;
              root.append(rest);
            }
            continue;
          }

          const span = document.createElement("span");
          span.className = "lyric-word-sub";
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

          // Place it, then keep it inside the viewport.
          //
          // `offsetWidth` is the layout width — it ignores the transform — so it
          // is exactly the box the -50% centring translate operates on. Measuring
          // the *rendered* rect here instead is a trap: the transform for this
          // frame is written further down, so the rect still describes the
          // previous cue, and correcting against it walks the caption off-screen.
          root.style.left = `${pos.leftPct.toFixed(1)}%`;
          root.style.top = `${pos.topPct.toFixed(1)}%`;

          const MARGIN = 12;
          const host = root.offsetParent as HTMLElement | null;
          const hostWidth = Math.max(
            1,
            host && host.clientWidth > 0 ? host.clientWidth : window.innerWidth,
          );
          const hostHeight = Math.max(
            1,
            host && host.clientHeight > 0 ? host.clientHeight : window.innerHeight,
          );

          // Half the layout width, expressed as a percentage of the stage.
          const halfW = (root.offsetWidth / 2 / hostWidth) * 100;
          const halfH = (root.offsetHeight / 2 / hostHeight) * 100;
          const xMargin = (MARGIN / hostWidth) * 100;
          const yMargin = (MARGIN / hostHeight) * 100;

          const minX = Math.min(halfW + xMargin, 50);
          const maxX = Math.max(100 - halfW - xMargin, 50);
          const minY = Math.min(halfH + yMargin, 50);
          const maxY = Math.max(100 - halfH - yMargin, 50);

          /*
           * The cinematic toolbar (play, replay, "Aa", close) occupies the top
           * of the frame. On a phone it is a large fraction of the height, so
           * a caption obeying only the safe zones can settle underneath it.
           * Reserve that band explicitly; the reserve is a constant because the
           * toolbar's height does not depend on the cue.
           */
          const toolbarReserve = hostWidth < 640 ? TOOLBAR_RESERVE_PHONE : TOOLBAR_RESERVE_DESKTOP;
          const minYClamped = Math.min(
            Math.max(minY, ((toolbarReserve / hostHeight) * 100) + halfH),
            50,
          );

          root.style.left = `${clamp(pos.leftPct, minX, maxX).toFixed(2)}%`;
          root.style.top = `${clamp(pos.topPct, minYClamped, maxY).toFixed(2)}%`;
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
