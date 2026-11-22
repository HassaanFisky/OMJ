export function BearRig({
  id,
  variant,
}: {
  id: string;
  variant: "a" | "b";
}) {
  const cream = variant === "a";
  const light = cream ? "#fff0dc" : "#dccae6";
  const fur = cream ? "#e5cfb3" : "#b59bc8";
  const shadow = cream ? "#b99c81" : "#866d9d";
  const patch = cream ? "#fff4e5" : "#eadbec";

  return (
    <g data-bear={id} opacity="0">
      <defs>
        <linearGradient
          id={`${id}-fur`}
          x1="0"
          y1="0"
          x2=".8"
          y2="1"
        >
          <stop stopColor={light} />
          <stop offset="1" stopColor={fur} />
        </linearGradient>
      </defs>

      <g
        fill={`url(#${id}-fur)`}
        stroke={shadow}
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        {["left", "right"].map((side) => (
          <g key={side} data-joint={`${side}Leg`}>
            <ellipse cy="18" rx="20" ry="30" />
            <g data-joint={`${side}Foot`}>
              <ellipse cy="47" rx="25" ry="17" />
              <ellipse
                cy="49"
                rx="13"
                ry="8"
                fill={patch}
                stroke="none"
              />
            </g>
          </g>
        ))}

        <ellipse cy="-53" rx="48" ry="64" />

        <ellipse
          cy="-43"
          rx="28"
          ry="38"
          fill={patch}
          stroke="none"
          opacity=".72"
        />

        <path
          d="M0-78v56"
          fill="none"
          strokeDasharray="2 6"
          strokeLinecap="round"
          opacity=".4"
        />

        {["left", "right"].map((side) => (
          <g key={side} data-joint={`${side}Arm`}>
            <ellipse cy="17" rx="15" ry="23" />
            <g data-joint={`${side}Forearm`}>
              <ellipse cy="17" rx="14" ry="23" />
              <circle cy="34" r="15" />
              <ellipse
                cy="37"
                rx="8"
                ry="7"
                fill={patch}
                stroke="none"
              />
            </g>
          </g>
        ))}

        <g data-joint="head">
          <circle cx="-43" cy="-195" r="22" />
          <circle cx="43" cy="-195" r="22" />

          <circle
            cx="-43"
            cy="-195"
            r="12"
            fill={patch}
            stroke="none"
          />
          <circle
            cx="43"
            cy="-195"
            r="12"
            fill={patch}
            stroke="none"
          />

          <ellipse cy="-150" rx="59" ry="57" />

          <path
            d="M-34-185q28-17 54 0"
            fill="none"
            stroke="#fff"
            strokeWidth="8"
            strokeLinecap="round"
            opacity=".1"
          />

          <g data-joint="face">
            <ellipse
              cx="-32"
              cy="-134"
              rx="11"
              ry="6"
              fill="#df9ead"
              stroke="none"
              opacity=".38"
            />
            <ellipse
              cx="32"
              cy="-134"
              rx="11"
              ry="6"
              fill="#df9ead"
              stroke="none"
              opacity=".38"
            />

            <ellipse
              cy="-129"
              rx="24"
              ry="19"
              fill={patch}
              stroke="none"
            />

            <g data-joint="eyes" fill="#49364c" stroke="none">
              <ellipse cx="-20" cy="-157" rx="4.5" ry="6.5" />
              <ellipse cx="20" cy="-157" rx="4.5" ry="6.5" />
              <circle cx="-18.8" cy="-159" r="1.3" fill="#fff9ef" />
              <circle cx="21.2" cy="-159" r="1.3" fill="#fff9ef" />
            </g>

            <path
              data-joint="closedEyes"
              d="M-26-156q6 5 12 0M14-156q6 5 12 0"
              fill="none"
              stroke="#49364c"
              strokeWidth="2.3"
              strokeLinecap="round"
              opacity="0"
            />

            <path
              d="M-6-134q6-5 12 0q0 7-6 8q-6-1-6-8"
              fill="#604751"
              stroke="none"
            />

            <path
              data-joint="mouth"
              d="M-10-119Q0-111 10-119"
              fill="none"
              stroke="#604751"
              strokeWidth="2"
              strokeLinecap="round"
            />

            <g
              data-joint="tears"
              fill="#d1e6f5"
              stroke="none"
              opacity="0"
            >
              <path d="M-24-143q-8 12 0 12q8 0 0-12" />
              <path d="M24-143q-8 12 0 12q8 0 0-12" />
            </g>
          </g>

          <path
            data-joint="backSeam"
            d="M0-194v71"
            fill="none"
            strokeDasharray="2 6"
            strokeLinecap="round"
            opacity="0"
          />

          {!cream && (
            <g
              fill="#dca3b9"
              stroke="#b9819e"
              strokeWidth="1.5"
            >
              <path d="M34-194q-28-24-24 6q10 12 24-1" />
              <path d="M38-194q28-25 25 6q-11 11-25-1" />
              <circle cx="36" cy="-191" r="6.5" fill="#f0c6d0" />
            </g>
          )}
        </g>

        {cream && (
          <g stroke="#7c628f" strokeWidth="1.5">
            <path
              d="M-38-105q38 14 76 0v13q-38 16-76 0Z"
              fill="#9c83b0"
            />
            <path
              d="M9-94q12 6 25 0l-2 47q-13 7-24-1Z"
              fill="#8e72a6"
            />
            <path d="M11-56h19" stroke="#d1bddf" opacity=".8" />
          </g>
        )}

        <path
          d="M-7-12q-10-12-16-2q-3 8 16 19q19-11 16-19q-6-10-16 2"
          transform="translate(19 -1) scale(.48)"
          fill={cream ? "#d4b27e" : "#c69fbf"}
          stroke="none"
        />

        <g
          data-joint="warm"
          fill="#ffd397"
          stroke="none"
          opacity="0"
        >
          <path d="M-41-190q-29 30-7 69q-31-31-13-60Z" />
          <path d="M-39-80q-16 36-2 64q-22-30-10-57Z" />
        </g>
      </g>
    </g>
  );
}
