import { memo } from "react";

/**
 * The ending's glass bubble.
 *
 * This is *not* a circle painted on top of the room, and it is not an empty
 * sphere parked behind it. It is a set of glass optics — limb darkening, a rim,
 * refraction bands, highlights, a caustic shadow and a reflective floor — that
 * are drawn around the finished wide shot so the room it already contains reads
 * as the thing sealed inside the glass.
 *
 * Everything here is a viewport-space overlay: it never scales, moves or
 * repositions the room, and because it is laid out in percentages against the
 * stage, the glass stays a true circle on every aspect ratio — resolved by the
 * browser's own layout rather than by a guessed radius. Circularity comes from
 * `aspect-ratio: 1` plus equal padding, so the only remaining variable is how
 * much of the room the dome can cover, and that is solved from the stage size.
 *
 * `--bubble-r` is the dome radius as a percentage of the stage width; the
 * renderer hands it a value that is guaranteed to fit, so nothing important is
 * ever cropped by the glass edge.
 */

export interface GlassBubbleProps {
  /** 0 → absent, 1 → fully formed. Drives every optic through CSS. */
  presence: number;
}

export const GlassBubble = memo(function GlassBubble({ presence }: GlassBubbleProps) {
  return (
    <div
      className="glass-bubble"
      data-node="glass-bubble"
      data-present={presence > 0.001 ? "true" : "false"}
      style={{ ["--bubble-p" as string]: presence.toFixed(3) }}
      aria-hidden="true"
    >
      {/*
        The display base. A keepsake globe is *set on* something — without a
        plinth the dome reads as an effect hovering over a painting rather than
        an object in the room. It is drawn outside the orb so the glass can
        never clip it, and it carries the wordmark because that is where a
        maker's mark belongs.
      */}
      <div className="bubble-base">
        <div className="bubble-base-top" />
        <div className="bubble-base-body">
          {/*
            Primary mark and secondary signature both live on the turned face of
            the plinth. OMJ is the identity; HASSAAN FISKY is the engraving
            beneath it — smaller and quieter, the way a signature sits under a
            marque. No registered-trademark symbol anywhere: this is a maker's
            mark, not a claim of registration.
          */}
          <div className="bubble-mark">
            <span className="bubble-mark-word">OMJ</span>
            <Kiss className="kiss kiss-1" />
            <Kiss className="kiss kiss-2" />
            <Kiss className="kiss kiss-3" />
            <Kiss className="kiss kiss-4" />
          </div>
          <span className="bubble-signature">HASSAAN FISKY</span>
        </div>
        <div className="bubble-base-foot" />
        <div className="bubble-caustic" />
      </div>

      <div className="bubble-orb">
        {/* The glass volume itself: darkest at the rim, clearest at the centre,
            which is what lets the room show through where it matters. */}
        <div className="bubble-volume" />
        {/* Thickness at the silhouette, where a real glass wall bends light. */}
        <div className="bubble-rim" />
        <div className="bubble-rim-inner" />

        {/* Two broad, soft window reflections — the studio light a real bubble
            would pick up. Deliberately asymmetric and low-contrast. */}
        <div className="bubble-sheen bubble-sheen-key" />
        <div className="bubble-sheen bubble-sheen-fill" />

        {/* Fine curved highlights near the rim. */}
        <div className="bubble-arc bubble-arc-a" />
        <div className="bubble-arc bubble-arc-b" />

        {/*
          A restrained glint where the key light lands hardest. One only — a
          second, larger glint in the upper left was reading as a blurred white
          blob floating over the room rather than as a reflection on glass.
        */}
        <div className="bubble-glint bubble-glint-a" />

        {/*
          Snow inside the glass. Six fixed particles, placed by hand, drifting
          on long delays — enough to say "this world is sealed and still
          falling" without turning into a particle system or a glitter effect.
        */}
        <div className="bubble-snow">
          <i /><i /><i /><i /><i /><i />
        </div>

      </div>
    </div>
  );
});

/**
 * A single lipstick kiss print: two lip lobes and a cupid's bow, with the
 * lower lobe slightly fuller. One path per lobe keeps it legible at 10 px,
 * which is the size this has to survive.
 */
function Kiss({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2.6c1.5-1.5 3.6-2 5.2-1.1 2 .9 3.1 2.9 2.9 4.9-.2 2-1.9 3.4-4.1 3.7-1.3.2-2.6 0-4-.5-1.4.5-2.7.7-4 .5-2.2-.3-3.9-1.7-4.1-3.7C1.7 4.4 2.8 2.4 4.8 1.5c1.6-.9 3.7-.4 5.2 1.1h2Z"
        fill="#c8647f"
      />
      <path
        d="M12 11.7c1.1 0 2-.3 2.6-.8.7-.6.9-1.4.5-2-.3-.5-.9-.8-1.6-.8-.6 0-1.1.2-1.5.5-.4-.3-.9-.5-1.5-.5-.7 0-1.3.3-1.6.8-.4.6-.2 1.4.5 2 .6.5 1.5.8 2.6.8Z"
        fill="#c8647f"
        opacity="0.88"
      />
      <path
        d="M5.4 3.2c1.2-.9 2.8-.7 4.1.3"
        stroke="#f6dfe6"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}
