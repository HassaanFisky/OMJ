/**
 * BearRig — Procedural 3D-shaded kinematic plush character rig.
 *
 * Character A ("Mochi") = Male plush bear (caramel-tan volumetric 3D shading, bare neck, sculpted brows)
 * Character B ("Yume")  = Female plush bear (pastel lilac-lavender 3D shading, bare neck, eyelashes, pink satin ribbon bow)
 *
 * Design invariants:
 * - 100% earless smooth dome head across front, 3/4, profile, and back views
 * - Zero dashed stitch seams, zero forehead/cheek wrinkles or dots
 * - Seamless capsule limbs with joint-crease ambient occlusion
 * - Exact left/right paw chirality: thumbs ALWAYS point inward toward body centerline
 * - Smooth 360-degree yaw support with rounded tail puff and rear bow visibility
 */
export function BearRig({
  id,
  variant,
}: {
  id: string;
  variant: "a" | "b";
}) {
  const isA = variant === "a";

  // ── Volumetric 3D Shading Palettes ─────────────────────────────────────────
  const furLight  = isA ? "#e6b17a" : "#e8d5f5";
  const furMid    = isA ? "#c98b50" : "#c8a6e0";
  const furShadow = isA ? "#9b622e" : "#9d77ba";
  const furDeep   = isA ? "#7a491d" : "#765196";
  const patch     = isA ? "#f6dec2" : "#f7eefa";
  const blushCol  = isA ? "#e08e79" : "#e88fb8";
  const noseCol   = "#341e19";
  const noseHi    = "#8c6154";
  const eyeDark   = "#170b1e";
  const bowMain   = "#f2adc9";
  const bowMid    = "#e08cb0";
  const bowDark   = "#b56186";
  const bowHi     = "#fde3ee";

  const gradFurId    = `${id}-fur`;
  const gradBodyId   = `${id}-body`;
  const gradHeadId   = `${id}-head`;
  const gradLimbId   = `${id}-limb`;
  const gradBlushId  = `${id}-blush`;
  const eyeGradId    = `${id}-eye`;
  const eyeShineId   = `${id}-shine`;

  return (
    <g data-bear={id} opacity="0">
      <defs>
        <radialGradient id={gradFurId} cx="0.34" cy="0.28" r="0.72">
          <stop offset="0%" stopColor={furLight} />
          <stop offset="52%" stopColor={furMid} />
          <stop offset="100%" stopColor={furShadow} />
        </radialGradient>

        <radialGradient id={gradBodyId} cx="0.36" cy="0.26" r="0.74">
          <stop offset="0%" stopColor={furLight} />
          <stop offset="54%" stopColor={furMid} />
          <stop offset="86%" stopColor={furShadow} />
          <stop offset="100%" stopColor={furDeep} />
        </radialGradient>

        <radialGradient id={gradHeadId} cx="0.36" cy="0.30" r="0.70">
          <stop offset="0%" stopColor={furLight} />
          <stop offset="56%" stopColor={furMid} />
          <stop offset="88%" stopColor={furShadow} />
          <stop offset="100%" stopColor={furDeep} />
        </radialGradient>

        <linearGradient id={gradLimbId} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={furLight} />
          <stop offset="55%" stopColor={furMid} />
          <stop offset="100%" stopColor={furShadow} />
        </linearGradient>

        <radialGradient id={gradBlushId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={blushCol} stopOpacity="0.46" />
          <stop offset="70%" stopColor={blushCol} stopOpacity="0.18" />
          <stop offset="100%" stopColor={blushCol} stopOpacity="0" />
        </radialGradient>

        <radialGradient id={eyeGradId} cx="0.38" cy="0.32" r="0.72">
          <stop offset="0%" stopColor={isA ? "#3c2345" : "#442242"} />
          <stop offset="50%" stopColor={eyeDark} />
          <stop offset="100%" stopColor="#07030c" />
        </radialGradient>

        <radialGradient id={eyeShineId} cx="0.3" cy="0.28" r="0.62">
          <stop stopColor="#ffffff" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── ROUNDED TAIL PUFF (visible in profile & back yaw views) ────────── */}
      <g data-joint="tailPuff" opacity="0">
        <circle
          cx="0"
          cy="-12"
          r="13.5"
          fill={`url(#${gradFurId})`}
          stroke={furShadow}
          strokeWidth="1.2"
        />
        <ellipse cx="-3" cy="-16" rx="5.5" ry="4" fill={furLight} opacity="0.42" />
      </g>

      {/* ── ARTICULATED CAPSULE LEGS (Hip -> Thigh -> Knee -> Shin -> Foot) ─ */}
      {(["left", "right"] as const).map((side) => {
        const sign = side === "left" ? -1 : 1;
        return (
          <g key={side} data-joint={`${side}Leg`}>
            {/* Smooth capsule thigh */}
            <rect
              x="-16.5"
              y="-6"
              width="33"
              height="38"
              rx="16.5"
              fill={`url(#${gradLimbId})`}
              stroke={furShadow}
              strokeOpacity="0.42"
              strokeWidth="1.1"
            />
            {/* Hip socket ambient occlusion */}
            <ellipse
              cy="-2"
              rx="13"
              ry="5"
              fill={furDeep}
              opacity="0.16"
            />

            {/* Knee pivot at (0, 24) */}
            <g data-joint={`${side}Knee`}>
              {/* Soft joint-crease occlusion */}
              <ellipse
                cy="1"
                rx="13"
                ry="6"
                fill={furDeep}
                opacity="0.15"
              />
              {/* Smooth capsule shin/calf */}
              <rect
                x="-15"
                y="-6"
                width="30"
                height="36"
                rx="15"
                fill={`url(#${gradLimbId})`}
                stroke={furShadow}
                strokeOpacity="0.4"
                strokeWidth="1.1"
              />

              {/* Ankle & Grounded Padded Foot */}
              <g data-joint={`${side}Foot`}>
                <ellipse
                  cx={sign * 4}
                  cy="6"
                  rx="22"
                  ry="13.5"
                  fill={`url(#${gradFurId})`}
                  stroke={furShadow}
                  strokeWidth="1.3"
                />
                <ellipse
                  cx={sign * 5}
                  cy="8"
                  rx="13"
                  ry="8"
                  fill={patch}
                  opacity="0.88"
                />
                {[-5.2, 0, 5.2].map((tx) => (
                  <ellipse
                    key={tx}
                    cx={sign * 5 + tx}
                    cy="2.2"
                    rx="3.1"
                    ry="2.5"
                    fill={patch}
                    stroke={furShadow}
                    strokeWidth="0.6"
                    opacity="0.72"
                  />
                ))}
              </g>
            </g>
          </g>
        );
      })}

      {/* ── VOLUMETRIC TORSO & BARE NECK SHADOW ──────────────────────────── */}
      <g data-joint="torso">
        <ellipse
          cy="-52"
          rx="49"
          ry="62"
          fill={`url(#${gradBodyId})`}
          stroke={furShadow}
          strokeOpacity="0.7"
          strokeWidth="1.4"
        />

        {/* Smooth creamy front belly patch (no stitch seams!) */}
        <g data-joint="belly">
          <ellipse
            cy="-42"
            rx="30"
            ry="39"
            fill={patch}
            opacity="0.84"
          />
        </g>

        {/* Subtle head-over-neck ambient occlusion under bare neck */}
        <ellipse
          cy="-98"
          rx="32"
          ry="10"
          fill={furDeep}
          opacity="0.26"
        />

        {/* Soft volumetric torso rim highlight */}
        <path
          d="M-42 -80 Q-49 -48 -39 -18"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.16"
        />
      </g>

      {/* ── ARTICULATED CAPSULE ARMS + CHIRAL PAWS (THUMB ALWAYS INWARD) ───── */}
      {(["left", "right"] as const).map((side) => {
        const sign = side === "left" ? -1 : 1;
        // Body centerline is at x=0. For left arm (x < 0, sign = -1), inward is +x (-sign).
        // For right arm (x > 0, sign = +1), inward is -x (-sign).
        const inward = -sign;
        return (
          <g key={side} data-joint={`${side}Arm`}>
            {/* Upper capsule arm */}
            <rect
              x="-14.5"
              y="-6"
              width="29"
              height="44"
              rx="14.5"
              fill={`url(#${gradLimbId})`}
              stroke={furShadow}
              strokeOpacity="0.42"
              strokeWidth="1.1"
            />
            <g data-joint={`${side}Forearm`}>
              {/* Soft elbow crease occlusion */}
              <ellipse
                cy="0"
                rx="11.5"
                ry="4.5"
                fill={furDeep}
                opacity="0.14"
              />
              {/* Forearm capsule */}
              <rect
                x="-13"
                y="-5"
                width="26"
                height="41"
                rx="13"
                fill={`url(#${gradLimbId})`}
                stroke={furShadow}
                strokeOpacity="0.4"
                strokeWidth="1.1"
              />
              {/* Chiral Paw: thumb ALWAYS points inward toward body centerline */}
              <g data-joint={`${side}Hand`} transform="translate(0 34)">
                <ellipse
                  cy="2"
                  rx="13"
                  ry="11.5"
                  fill={`url(#${gradFurId})`}
                  stroke={furShadow}
                  strokeWidth="1.2"
                />
                {/* Padded palm facing inward toward torso */}
                <ellipse
                  cx={inward * 1.5}
                  cy="3.5"
                  rx="7.6"
                  ry="6.5"
                  fill={patch}
                  opacity="0.88"
                />
                {/* Inward-pointing thumb */}
                <ellipse
                  cx={inward * 10.5}
                  cy="-1"
                  rx="4.4"
                  ry="6.6"
                  transform={`rotate(${inward * 26} ${inward * 10.5} -1)`}
                  fill={`url(#${gradFurId})`}
                  stroke={furShadow}
                  strokeWidth="1.05"
                />
                {/* 4 smooth rounded fingers */}
                {[-6.3, -2.1, 2.1, 6.3].map((fx, fi) => {
                  const fy = fi === 1 || fi === 2 ? 11.8 : 10.3;
                  const rx = 3.0;
                  const ry = fi === 1 || fi === 2 ? 4.9 : 4.2;
                  return (
                    <ellipse
                      key={fx}
                      cx={fx}
                      cy={fy}
                      rx={rx}
                      ry={ry}
                      fill={`url(#${gradFurId})`}
                      stroke={furShadow}
                      strokeWidth="0.95"
                    />
                  );
                })}
              </g>
            </g>
          </g>
        );
      })}

      {/* ── 100% EARLESS SMOOTH DOME HEAD & EXPRESSIVE FACE ──────────────── */}
      <g data-joint="head">
        {/* Pure smooth spherical/dome silhouette — ZERO ears, ZERO nubs, ZERO notches */}
        <ellipse
          cy="-152"
          rx="63"
          ry="58"
          fill={`url(#${gradHeadId})`}
          stroke={furShadow}
          strokeOpacity="0.75"
          strokeWidth="1.4"
        />

        {/* Soft volumetric top-left dome specular highlight */}
        <path
          d="M-38 -195 Q0 -210 38 -195"
          fill="none"
          stroke="#ffffff"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.16"
        />

        {/* ── FRONT / 3-QUARTER / PROFILE FACE FEATURES ──────────────────── */}
        <g data-joint="face">
          {/* Smooth radial rosy cheek blush (Yume stronger, Mochi subtle) */}
          <ellipse cx="-38" cy="-131" rx="16" ry="10" fill={`url(#${gradBlushId})`} opacity={isA ? 0.45 : 0.92} />
          <ellipse cx="38" cy="-131" rx="16" ry="10" fill={`url(#${gradBlushId})`} opacity={isA ? 0.45 : 0.92} />

          {/* Subtle affectionate cheek kiss mark (only visible after kiss moments) */}
          <g data-joint="kissMarks" opacity="0" transform="translate(36 -127) rotate(-14)">
            <path
              d="M-5 -1 Q-2 -4 0 -1.5 Q2 -4 5 -1 Q2 1.5 0 0.5 Q-2 1.5 -5 -1 Z"
              fill="#db7696"
              opacity="0.72"
            />
            <path
              d="M-4.5 2 Q0 5 4.5 2 Q0 3 -4.5 2 Z"
              fill="#db7696"
              opacity="0.62"
            />
          </g>

          {/* Smooth creamy oval muzzle */}
          <ellipse cy="-123" rx="26.5" ry="19.5" fill={patch} />

          {/* Expressive sculpted eyebrows */}
          <path
            data-joint="leftBrow"
            d="M-30 -173 Q-21 -177 -12 -173"
            fill="none"
            stroke={furDeep}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            data-joint="rightBrow"
            d="M12 -173 Q21 -177 30 -173"
            fill="none"
            stroke={furDeep}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Layered Glossy Eyes + Directional Gaze */}
          <g data-joint="eyes">
            {/* Left eye */}
            <g transform="translate(-21 -154)">
              <ellipse rx="8.6" ry="10.8" fill="#fdfaf6" />
              <ellipse rx="7.4" ry="9.4" fill={`url(#${eyeGradId})`} />
              <ellipse
                cy="3.4"
                rx="5.4"
                ry="2.8"
                fill={isA ? "#fce4c8" : "#f2d6ec"}
                opacity="0.34"
              />
              <ellipse cy="0.5" rx="4.2" ry="5.6" fill="#07030d" />
              <path
                d="M-4.2 -5.5 C-1.8 -7.8, 1.8 -7.8, 4.2 -5.5 C1.8 -6.6, -1.8 -6.6, -4.2 -5.5 Z"
                fill="#ffffff"
                opacity="0.9"
              />
              <ellipse cx="-2.4" cy="-3.4" rx="2.9" ry="3.4" fill={`url(#${eyeShineId})`} />
              <circle cx="2.5" cy="3" r="1.2" fill="#ffffff" opacity="0.82" />
              {!isA && (
                <path
                  d="M-7.5 -7.5 L-10.8 -10.8 M-5.4 -9.2 L-7.6 -12.8"
                  stroke="#2a1628"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              )}
            </g>

            {/* Right eye */}
            <g transform="translate(21 -154)">
              <ellipse rx="8.6" ry="10.8" fill="#fdfaf6" />
              <ellipse rx="7.4" ry="9.4" fill={`url(#${eyeGradId})`} />
              <ellipse
                cy="3.4"
                rx="5.4"
                ry="2.8"
                fill={isA ? "#fce4c8" : "#f2d6ec"}
                opacity="0.34"
              />
              <ellipse cy="0.5" rx="4.2" ry="5.6" fill="#07030d" />
              <path
                d="M-4.2 -5.5 C-1.8 -7.8, 1.8 -7.8, 4.2 -5.5 C1.8 -6.6, -1.8 -6.6, -4.2 -5.5 Z"
                fill="#ffffff"
                opacity="0.9"
              />
              <ellipse cx="-2.4" cy="-3.4" rx="2.9" ry="3.4" fill={`url(#${eyeShineId})`} />
              <circle cx="2.5" cy="3" r="1.2" fill="#ffffff" opacity="0.82" />
              {!isA && (
                <path
                  d="M7.5 -7.5 L10.8 -10.8 M5.4 -9.2 L7.6 -12.8"
                  stroke="#2a1628"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              )}
            </g>

            {/* Emotional glistening watery sheen */}
            <ellipse data-joint="eyeWater" cx="-21" cy="-150" rx="7.8" ry="4.5" fill="#cae7f8" opacity="0" />
            <ellipse data-joint="eyeWaterR" cx="21" cy="-150" rx="7.8" ry="4.5" fill="#cae7f8" opacity="0" />
          </g>

          {/* Soft upper eyelids */}
          <g data-joint="eyelids" opacity="0">
            <path d="M-30 -164 Q-21 -150 -12 -164 Z" fill={`url(#${gradHeadId})`} />
            <path d="M12 -164 Q21 -150 30 -164 Z" fill={`url(#${gradHeadId})`} />
          </g>

          {/* Closed peaceful crescent eyes */}
          <g
            data-joint="closedEyes"
            fill="none"
            stroke="#361f24"
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0"
          >
            <path d="M-29 -153 Q-21 -144 -13 -153" />
            <path d="M13 -153 Q21 -144 29 -153" />
          </g>

          {/* Animated crystal tears */}
          <g data-joint="tears" fill="#bce2fa" stroke="#85bce0" strokeWidth="0.9" opacity="0">
            <path d="M-27 -136 Q-34 -122 -27 -122 Q-20 -122 -27 -136 Z" />
            <path d="M27 -136 Q20 -122 27 -122 Q34 -122 27 -136 Z" />
          </g>

          {/* Button nose with micro specular highlight + muzzle mouth */}
          <ellipse cy="-130" rx="8.4" ry="6" fill={noseCol} />
          <ellipse cx="-2.4" cy="-132" rx="2.6" ry="1.4" fill={noseHi} opacity="0.72" />
          <path d="M0 -124 V-118" stroke="#5a3832" strokeWidth="2" strokeLinecap="round" />
          <path
            data-joint="mouth"
            d="M-10 -115 Q0 -109 10 -115"
            fill="none"
            stroke="#5a3832"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>

        {/* ── SMOOTH BACK OF HEAD (ZERO STITCH LINES!) ───────────────────── */}
        <g data-joint="backHead" opacity="0">
          <ellipse
            cy="-152"
            rx="63"
            ry="58"
            fill={`url(#${gradBodyId})`}
            stroke={furShadow}
            strokeOpacity="0.65"
            strokeWidth="1.4"
          />
          <path
            d="M-36 -192 Q0 -207 36 -192"
            fill="none"
            stroke={furLight}
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.2"
          />
        </g>

        {/* ── YUME ONLY: SOFT PINK SATIN RIBBON BOW ON UPPER-RIGHT HEAD CURVE ─ */}
        {!isA && (
          <g data-joint="bow">
            <g transform="translate(37 -191) rotate(22)">
              {/* Left ribbon loop */}
              <path
                d="M-3 0 C-22 -18 -26 10 -6 6 C-2 5 -1 2 -3 0 Z"
                fill={bowMain}
                stroke={bowDark}
                strokeWidth="1.3"
              />
              <path d="M-16 -3 Q-9 0 -4 0" stroke={bowHi} strokeWidth="1.6" strokeLinecap="round" fill="none" />
              {/* Right ribbon loop */}
              <path
                d="M3 0 C22 -18 26 10 6 6 C2 5 1 2 3 0 Z"
                fill={bowMain}
                stroke={bowDark}
                strokeWidth="1.3"
              />
              <path d="M16 -3 Q9 0 4 0" stroke={bowHi} strokeWidth="1.6" strokeLinecap="round" fill="none" />
              {/* Soft hanging tails */}
              <path d="M-2 3 L-11 21 L-3 18 Z" fill={bowMid} stroke={bowDark} strokeWidth="1" />
              <path d="M2 3 L11 21 L3 18 Z" fill={bowMid} stroke={bowDark} strokeWidth="1" />
              {/* Center satin knot */}
              <ellipse cx="0" cy="1" rx="6" ry="5" fill={bowHi} stroke={bowDark} strokeWidth="1.2" />
            </g>
          </g>
        )}
      </g>

      {/* ── WARM GOLDEN RIM LIGHT OVERLAY ────────────────────────────────── */}
      <g data-joint="warm" fill="#ffda96" opacity="0">
        <path d="M-44 -195 Q-64 -158 -42 -112 Q-53 -158 -34 -189 Z" />
        <path d="M-44 -80 Q-54 -42 -36 -12 Q-45 -44 -34 -74 Z" />
      </g>
    </g>
  );
}
