/**
 * The film's colour grade.
 *
 * This is the whole "look" of the picture in one place: the split-tone (cold
 * midnight outside the window, warm amber inside the room), the lifted
 * lavender shadows, the gently rolled-off highlights, the bloom that makes the
 * practical lamps glow, and the grain that keeps the flat vector art from
 * reading as clip art.
 *
 * Everything here is a *grade*, not an effect: it never moves on its own, it
 * never pulses, and it is entirely deterministic — the same grain tile is
 * generated once and re-used, so it costs nothing per frame.
 *
 * The grade is composed of separate fixed layers rather than one blur because
 * each has a single job:
 *
 *   grade-tone      split-tone + shadow lift + highlight roll-off
 *   grade-bloom     a heavily blurred copy of the screen, screened back on
 *   grade-grain     static monochrome noise, extremely low opacity
 *   grade-vignette  natural lens falloff
 */

/** Static grain tile, generated deterministically from a fixed seed. */
const GRAIN_SEED = 20260101;
const GRAIN_SIZE = 180;

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A tile of fine monochrome noise, as a data URI.
 *
 * Uniform white noise looks like television snow; real film grain is slightly
 * clumped, so each pixel is the average of three random draws, which narrows
 * the distribution the way an emulsion does.
 */
function grainTile(size: number, seed: number): string {
  if (typeof document === "undefined") return "";

  const random = mulberry32(seed);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  /*
   * Canvas may be present but unbacked — jsdom, some headless configurations,
   * and any browser that has exhausted its canvas pool all return a context
   * whose createImageData yields undefined. The grain is a garnish; if it
   * cannot be generated the rest of the grade must still render.
   */
  const context = canvas.getContext("2d");
  if (!context || typeof context.createImageData !== "function") return "";

  let image: ImageData;
  try {
    image = context.createImageData(size, size);
  } catch {
    return "";
  }
  if (!image?.data) return "";

  const { data } = image;

  for (let i = 0; i < data.length; i += 4) {
    const n = (random() + random() + random()) / 3;
    const value = Math.round(128 + (n - 0.5) * 190);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  try {
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

let cachedGrain: string | null = null;

function grainImage(): string {
  if (cachedGrain === null) cachedGrain = grainTile(GRAIN_SIZE, GRAIN_SEED);
  return cachedGrain;
}

export interface GradeProps {
  /**
   * How strongly the exterior reads as night. Exists so a bright "sun through
   * the window" passage can pull the cool tone back instead of fighting it.
   */
  night?: number;
  /** Extra warmth for candlelit passages. */
  warmth?: number;
}

/**
 * Renders the grade layers. They sit above the artwork and below the captions,
 * so type stays perfectly crisp while the picture is graded.
 */
export function CinematicGrade({ night = 1, warmth = 0 }: GradeProps) {
  const grain = grainImage();

  return (
    <div
      className="grade"
      aria-hidden="true"
      style={
        {
          "--grade-night": night.toFixed(3),
          "--grade-warmth": warmth.toFixed(3),
          "--grade-grain": grain ? `url(${grain})` : "none",
        } as React.CSSProperties
      }
    >
      <div className="grade-tone" />
      <div className="grade-warmth" />
      <div className="grade-coolth" />
      <div className="grade-bloom" />
      <div className="grade-grain" />
      <div className="grade-vignette" />
    </div>
  );
}
