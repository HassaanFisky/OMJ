/**
 * BearRig — Premium plush teddy character SVG rig.
 * Chubby, cuddly anatomy with layered glossy eyes, blush, and plush texture.
 * Character A (cream/honey) = male waiting teddy
 * Character B (lavender/rose) = female guiding-light teddy
 */
export function BearRig({
  id,
  variant,
}: {
  id: string;
  variant: "a" | "b";
}) {
  const isA = variant === "a";

  // ── Palette ────────────────────────────────────────────────────────────────
  const furLight  = isA ? "#fdf0da" : "#f0dff0";
  const furMid    = isA ? "#e8cfaa" : "#d4b8d8";
  const furShadow = isA ? "#c4a07a" : "#a87cb8";
  const furDeep   = isA ? "#a07a52" : "#8a5a9c";
  const patch     = isA ? "#fff6e8" : "#f5ecf8";
  const blush     = isA ? "#e8a090" : "#da90b8";
  const nose      = "#3e2723";
  const eyeDark   = "#1a0e22";
  const scarf1    = isA ? "#9c83b0" : "#8ea8c8";
  const scarf2    = isA ? "#7a6490" : "#6e8aaa";
  const accessory = isA ? "#7a6490" : "#dca3b9";

  const gradId     = `${id}-fur`;
  const gradBodyId = `${id}-body`;
  const eyeGradId  = `${id}-eye`;
  const eyeShineId = `${id}-shine`;
  const earInId    = `${id}-earin`;

  return (
    <g data-bear={id} opacity="0">
      <defs>
        {/* Fur surface gradient — light top-left to deep bottom-right */}
        <linearGradient id={gradId} x1="0" y1="0" x2=".65" y2="1">
          <stop stopColor={furLight} />
          <stop offset=".45" stopColor={furMid} />
          <stop offset="1" stopColor={furShadow} />
        </linearGradient>

        {/* Body gradient — slightly warmer/deeper for torso volume */}
        <linearGradient id={gradBodyId} x1="0" y1="0" x2=".4" y2="1">
          <stop stopColor={furMid} />
          <stop offset="1" stopColor={furDeep} />
        </linearGradient>

        {/* Eye iris gradient — deep dark pupil with subtle warm tint */}
        <radialGradient id={eyeGradId} cx=".35" cy=".3" r=".7">
          <stop stopColor="#2d1a38" />
          <stop offset=".5" stopColor={eyeDark} />
          <stop offset="1" stopColor="#0a0410" />
        </radialGradient>

        {/* Eye specular / shine gradient */}
        <radialGradient id={eyeShineId} cx=".3" cy=".25" r=".6">
          <stop stopColor="#ffffff" stopOpacity=".92" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Inner ear gradient */}
        <radialGradient id={earInId} cx=".5" cy=".5" r=".5">
          <stop stopColor={patch} />
          <stop offset="1" stopColor={blush} stopOpacity=".5" />
        </radialGradient>
      </defs>

      {/* ── LEGS ──────────────────────────────────────────────────────────── */}
      {(["left", "right"] as const).map((side) => (
        <g key={side} data-joint={`${side}Leg`}>
          {/* Upper leg — thick, chubby ellipse */}
          <ellipse
            cy="22" rx="22" ry="34"
            fill={`url(#${gradBodyId})`}
            stroke={furShadow} strokeWidth="1.4" strokeLinejoin="round"
          />
          <g data-joint={`${side}Foot`}>
            {/* Foot pad — wide, rounded plush paw */}
            <ellipse
              cy="51" rx="28" ry="19"
              fill={`url(#${gradId})`}
              stroke={furShadow} strokeWidth="1.4" strokeLinejoin="round"
            />
            {/* Paw pad patch */}
            <ellipse
              cy="54" rx="15" ry="10"
              fill={patch} stroke="none" opacity=".8"
            />
            {/* Toe dots */}
            {[-7, 0, 7].map((tx) => (
              <circle key={tx} cx={tx} cy="49" r="2.8"
                fill={furShadow} opacity=".35" />
            ))}
          </g>
        </g>
      ))}

      {/* ── TORSO ─────────────────────────────────────────────────────────── */}
      {/* Main body — large, compact, slightly chubby */}
      <ellipse
        cy="-52" rx="52" ry="68"
        fill={`url(#${gradId})`}
        stroke={furShadow} strokeWidth="1.6" strokeLinejoin="round"
      />
      {/* Belly patch — lighter oval for plush tummy */}
      <ellipse
        cy="-40" rx="31" ry="42"
        fill={patch} stroke="none" opacity=".68"
      />
      {/* Body center seam stitch */}
      <path
        d="M0-82v60"
        fill="none"
        stroke={furShadow} strokeWidth=".8"
        strokeDasharray="2 7" strokeLinecap="round"
        opacity=".35"
      />
      {/* Rim light on body left edge */}
      <path
        d="M-45-80q-14 30-8 68"
        fill="none" stroke="#ffffff" strokeWidth="4"
        strokeLinecap="round" opacity=".07"
      />

      {/* ── ARMS ──────────────────────────────────────────────────────────── */}
      {(["left", "right"] as const).map((side) => (
        <g key={side} data-joint={`${side}Arm`}>
          {/* Upper arm — thick, short */}
          <ellipse
            cy="18" rx="17" ry="26"
            fill={`url(#${gradId})`}
            stroke={furShadow} strokeWidth="1.4" strokeLinejoin="round"
          />
          <g data-joint={`${side}Forearm`}>
            {/* Lower arm */}
            <ellipse
              cy="19" rx="16" ry="25"
              fill={`url(#${gradId})`}
              stroke={furShadow} strokeWidth="1.4" strokeLinejoin="round"
            />
            {/* Paw — large round hand */}
            <circle
              cy="37" r="17"
              fill={`url(#${gradId})`}
              stroke={furShadow} strokeWidth="1.4"
            />
            {/* Paw pad */}
            <ellipse
              cy="40" rx="10" ry="9"
              fill={patch} stroke="none" opacity=".85"
            />
            {/* Finger dots */}
            {[-7, 0, 7].map((tx) => (
              <circle key={tx} cx={tx} cy="33" r="2.5"
                fill={furShadow} opacity=".3" />
            ))}
          </g>
        </g>
      ))}

      {/* ── HEAD ──────────────────────────────────────────────────────────── */}
      <g data-joint="head">
        {/* Ear outer circles — soft rounded */}
        <circle cx="-46" cy="-198" r="25"
          fill={`url(#${gradId})`}
          stroke={furShadow} strokeWidth="1.6"
        />
        <circle cx="46" cy="-198" r="25"
          fill={`url(#${gradId})`}
          stroke={furShadow} strokeWidth="1.6"
        />
        {/* Ear inner — velvet pad */}
        <circle cx="-46" cy="-198" r="14"
          fill={`url(#${earInId})`} stroke="none"
        />
        <circle cx="46" cy="-198" r="14"
          fill={`url(#${earInId})`} stroke="none"
        />

        {/* Main head — large, beautifully rounded */}
        <ellipse
          cy="-152" rx="63" ry="62"
          fill={`url(#${gradId})`}
          stroke={furShadow} strokeWidth="1.6" strokeLinejoin="round"
        />

        {/* Head top-left specular rim highlight */}
        <path
          d="M-40-200q35-21 60 0"
          fill="none" stroke="#ffffff" strokeWidth="10"
          strokeLinecap="round" opacity=".07"
        />

        {/* ── FACE GROUP ───────────────────────────────────────────────────── */}
        <g data-joint="face">
          {/* Cheek blush — soft bilateral ovals */}
          <ellipse
            cx="-38" cy="-130" rx="16" ry="10"
            fill={blush} stroke="none" opacity=".32"
          />
          <ellipse
            cx="38" cy="-130" rx="16" ry="10"
            fill={blush} stroke="none" opacity=".32"
          />

          {/* Muzzle — slightly protruding oval */}
          <ellipse
            cy="-122" rx="28" ry="22"
            fill={patch} stroke="none"
          />

          {/* ── EYES (premium layered construction) ─────────────────────── */}
          <g data-joint="eyes">
            {/* Left eye */}
            <g transform="translate(-21 -157)">
              {/* Eye socket / white sclera */}
              <ellipse rx="8.5" ry="11" fill="#f8f2ee" />
              {/* Iris gradient */}
              <ellipse rx="7" ry="9" fill={`url(#${eyeGradId})`} />
              {/* Pupil — deep center */}
              <ellipse cy="1" rx="4" ry="5.5" fill="#0a0410" />
              {/* Primary specular catchlight — top left */}
              <ellipse
                cx="-2.5" cy="-3.5" rx="2.8" ry="3.2"
                fill={`url(#${eyeShineId})`}
              />
              {/* Secondary bounce light — bottom right */}
              <circle cx="2.5" cy="3" r="1.4"
                fill="#ffffff" opacity=".28"
              />
              {/* Eyelid upper crease */}
              <path
                d="M-7-9q7-5 14 0"
                fill="none" stroke={furShadow} strokeWidth="1.5"
                strokeLinecap="round" opacity=".45"
              />
            </g>

            {/* Right eye */}
            <g transform="translate(21 -157)">
              <ellipse rx="8.5" ry="11" fill="#f8f2ee" />
              <ellipse rx="7" ry="9" fill={`url(#${eyeGradId})`} />
              <ellipse cy="1" rx="4" ry="5.5" fill="#0a0410" />
              <ellipse
                cx="-2.5" cy="-3.5" rx="2.8" ry="3.2"
                fill={`url(#${eyeShineId})`}
              />
              <circle cx="2.5" cy="3" r="1.4"
                fill="#ffffff" opacity=".28"
              />
              <path
                d="M-7-9q7-5 14 0"
                fill="none" stroke={furShadow} strokeWidth="1.5"
                strokeLinecap="round" opacity=".45"
              />
            </g>

            {/* Eyelashes — delicate upper fringe for Teddy B */}
            {!isA && (
              <g opacity=".6" stroke={furDeep} strokeWidth="1" strokeLinecap="round">
                <path d="M-28-167l-2-4M-25-168l0-5M-14-168l2-4" />
                <path d="M28-167l2-4M25-168l0-5M14-168l-2-4" />
              </g>
            )}

            {/* Watery highlight overlay — emotional glimmer (opacity driven by tear) */}
            <ellipse
              data-joint="eyeWater"
              cx="-21" cy="-157" rx="8.5" ry="5.5"
              fill="#c8e8f8" opacity="0"
            />
            <ellipse
              data-joint="eyeWaterR"
              cx="21" cy="-157" rx="8.5" ry="5.5"
              fill="#c8e8f8" opacity="0"
            />
          </g>

          {/* Closed eyes — 3-phase crescent blink curves */}
          <g
            data-joint="closedEyes"
            fill="none"
            stroke={furDeep}
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0"
          >
            <path d="M-30-157q9 7 18 0" />
            <path d="M12-157q9 7 18 0" />
          </g>

          {/* Nose — tiny chocolate button */}
          <path
            d="M-7-130q7-7 14 0q0 8-7 9q-7-1-7-9"
            fill={nose} stroke="none"
          />
          {/* Nose highlight */}
          <circle cx="-2" cy="-133" r="1.8"
            fill="#ffffff" opacity=".35"
          />

          {/* Mouth — neutral gentle curve, deforms to sad via d-attr */}
          <path
            data-joint="mouth"
            d="M-10-115Q0-107 10-115"
            fill="none"
            stroke={nose}
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Tears — crystalline droplets, animated via transform + opacity */}
          <g data-joint="tears" fill="#b8def8" stroke="#8bbfd8" strokeWidth=".8" opacity="0">
            <path d="M-28-137q-9 14 0 14q9 0 0-14" />
            <path d="M28-137q-9 14 0 14q9 0 0-14" />
          </g>
        </g>

        {/* Back-of-head seam (shown when facing away) */}
        <path
          data-joint="backSeam"
          d="M0-200v72"
          fill="none"
          stroke={furShadow}
          strokeWidth=".9"
          strokeDasharray="2 7"
          strokeLinecap="round"
          opacity="0"
        />

        {/* ── ACCESSORY — Teddy B: rose bow on left ear ──────────────────── */}
        {!isA && (
          <g fill={accessory} stroke="#b9819e" strokeWidth="1.4">
            <path d="M34-196q-28-26-24 6q10 14 24-1" />
            <path d="M38-196q28-26 25 6q-11 13-25-1" />
            <circle cx="36" cy="-193" r="7" fill="#f0c6d0" stroke="none" />
            <circle cx="36" cy="-193" r="3" fill="#ffffff" opacity=".5" stroke="none" />
          </g>
        )}

        {/* ── ACCESSORY — Teddy A: knit scarf collar ─────────────────────── */}
        {isA && (
          <g stroke={scarf2} strokeWidth="1.5">
            <path
              d="M-42-100q42 15 84 0v14q-42 18-84 0Z"
              fill={scarf1}
            />
            <path
              d="M10-88q12 7 26 0l-2 50q-14 8-26-1Z"
              fill={scarf2}
            />
            <path d="M12-50h21" stroke="#d1bddf" opacity=".8" />
          </g>
        )}
      </g>

      {/* ── WARM INNER GLOW (sun-warmth light effect, opacity driven) ─────── */}
      <g data-joint="warm" fill="#ffd08a" stroke="none" opacity="0">
        <path d="M-44-192q-32 32-9 72q-32-33-15-62Z" />
        <path d="M-42-78q-18 38-4 68q-24-32-12-60Z" />
      </g>

      {/* ── NOSE TIP HEART (Teddy B — subtle love accent) ──────────────────── */}
      {!isA && (
        <path
          d="M-4.5-14q-7-8-11-2q-2 5 11 13q13-8 11-13q-4-6-11 2"
          transform="translate(19 -1) scale(.52)"
          fill="#d4a0bf"
          stroke="none"
        />
      )}
    </g>
  );
}
