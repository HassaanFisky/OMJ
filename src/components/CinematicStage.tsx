import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
} from "react";
import { AudioController } from "../audio/AudioController";
import { FilmEngine } from "../animation/FilmEngine";
import { createParticleEngine } from "../animation/ParticleEngine";
import { BearRig } from "../characters/BearRig";
import { createBearPainter } from "../characters/BearAnimations";
import {
  targetFor,
  worldPoint,
  type Frame,
} from "../timeline/scenes";
import {
  validateScore,
  type Score,
} from "../timeline/score";
import {
  LyricsDisplay,
  type LyricsHandle,
} from "./LyricsDisplay";

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);

    media.addEventListener("change", update);
    update();

    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function Present({
  index,
  color,
}: {
  index: number;
  color: string;
}) {
  return (
    <g data-present={index}>
      <rect
        x="-27" y="-46" width="54" height="46" rx="6"
        fill={color} stroke="#80677e" strokeWidth="1.5"
      />
      <rect
        x="-31" y="-56" width="62" height="13" rx="4"
        fill={color} stroke="#80677e" strokeWidth="1.5"
      />
      <path
        d="M0-55V0M-26-24H26"
        stroke="#f5e7cf"
        strokeWidth="5"
        opacity=".9"
      />
      <path
        d="M0-56C-29-78-30-48 0-56C29-78 30-48 0-56"
        fill="none"
        stroke="#f5e7cf"
        strokeWidth="4"
      />
    </g>
  );
}

interface StageProps {
  controller: AudioController;
  score: Score;
  duration: number;
  active: boolean;
}

export const CinematicStage = memo(function CinematicStage({
  controller,
  score,
  duration,
  active,
}: StageProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const lyrics = useRef<LyricsHandle>(null);
  const reduced = useReducedMotion();
  const [viewBox, setViewBox] = useState("0 0 720 1080");

  useLayoutEffect(() => {
    const element = root.current!;
    const particles = createParticleEngine(canvas.current!);

    const query = (name: string) => {
      const node = element.querySelector<SVGElement>(
        `[data-node="${name}"]`,
      );

      if (!node) throw new Error(`Missing stage node: ${name}`);
      return node;
    };

    const nodes = Object.fromEntries(
      [
        "room", "hole", "window", "sun", "moon", "cold",
        "cloudA", "cloudB", "camera", "bed", "message",
        "gifts", "flowers", "phone", "thought", "quilt",
        "lantern", "letter", "title", "curtainA", "curtainB",
        "shadowA", "shadowB", "snowglobe",
      ].map((name) => [name, query(name)]),
    );

    const character = (id: string) => {
      const node = element.querySelector<SVGGElement>(
        `[data-bear="${id}"]`,
      );

      if (!node) throw new Error(`Missing character: ${id}`);
      return createBearPainter(node);
    };

    const paintA = character("a");
    const paintB = character("b");
    const paintDreamA = character("dream-a");
    const paintDreamB = character("dream-b");

    const presents = Array.from(
      element.querySelectorAll<SVGGElement>("[data-present]"),
    );

    const surface = element.querySelector<HTMLElement>(".film-surface")!;

    const valid = duration > 0 && validateScore(score, duration).length === 0;
    const film = valid ? new FilmEngine(score, duration) : null;

    const opacity = (name: string, value: number) =>
      nodes[name]!.setAttribute("opacity", String(value));

    function paint(frame: Frame, time: number) {
      const env = frame.env;

      element.dataset.action = frame.action;
      element.dataset.reduced = String(reduced);
      surface.style.opacity = String(env.alpha);

      opacity("room", env.room);
      opacity("window", env.window);
      opacity("sun", env.sun);
      opacity("moon", 1 - env.sun * 0.75);
      opacity("cold", env.cold * 0.16);
      opacity("bed", env.bench);
      opacity("message", env.message);
      opacity("gifts", env.gifts);
      opacity("flowers", env.flowers);
      opacity("phone", env.phone);
      opacity("thought", env.thought);
      opacity("quilt", env.quilt);
      opacity("lantern", env.lantern);
      opacity("letter", env.letter);
      opacity("title", env.title);

      const globeReveal =
        frame.action === "tail"
          ? Math.min(1, Math.max(0, (0.95 - env.zoom) / 0.22))
          : 0;
      opacity("snowglobe", globeReveal);

      const cx = env.camX ?? 0;
      const cy = env.camY ?? 0;

      nodes.moon!.setAttribute(
        "transform",
        `translate(${-cx * 0.1} ${-cy * 0.08})`,
      );
      nodes.sun!.setAttribute(
        "transform",
        `translate(${-cx * 0.1} ${-cy * 0.08})`,
      );

      nodes.room!.setAttribute(
        "transform",
        `translate(${-cx * 0.45} ${-cy * 0.4})`,
      );
      nodes.window!.setAttribute(
        "transform",
        `translate(${-cx * 0.6} ${env.windowY - cy * 0.55})`,
      );
      nodes.hole!.setAttribute("x", String(185 - cx * 0.6));
      nodes.hole!.setAttribute("y", String(145 + env.windowY - cy * 0.55));

      nodes.curtainA!.setAttribute(
        "transform",
        `translate(${-env.curtains * 22} 0)`,
      );
      nodes.curtainB!.setAttribute(
        "transform",
        `translate(${env.curtains * 22} 0)`,
      );

      const drift = reduced ? 0 : Math.sin(time * 0.035) * 25;

      nodes.cloudA!.setAttribute(
        "transform",
        `translate(${drift - cx * 0.22} ${-cy * 0.18})`,
      );
      nodes.cloudB!.setAttribute(
        "transform",
        `translate(${-drift * 0.6 - cx * 0.22} ${-cy * 0.18})`,
      );

      nodes.camera!.setAttribute(
        "transform",
        `translate(${360 - cx} ${870 - cy}) scale(${env.zoom}) translate(-360 -870)`,
      );

      const phone = worldPoint(frame.b, 0, -65);
      const letter = worldPoint(frame.a, frame.a.rightX, frame.a.rightY);
      const lantern = worldPoint(frame.a, frame.a.rightX, frame.a.rightY);

      nodes.phone!.setAttribute(
        "transform",
        `translate(${phone.x} ${phone.y}) rotate(-7)`,
      );
      nodes.letter!.setAttribute(
        "transform",
        `translate(${letter.x} ${letter.y}) rotate(-9)`,
      );
      nodes.lantern!.setAttribute(
        "transform",
        `translate(${lantern.x} ${lantern.y + 14})`,
      );

      presents.forEach((present, index) => {
        const reveal = Math.max(
          0,
          Math.min(1, env.gifts * 3 - index * 0.25),
        );

        present.setAttribute(
          "transform",
          `translate(${156 + index * 101} ${962 - reveal * 4}) scale(${0.85 + reveal * 0.15})`,
        );
        present.setAttribute("opacity", String(reveal));
      });

      for (const [name, pose] of [
        ["shadowA", frame.a],
        ["shadowB", frame.b],
      ] as const) {
        const tilt = Math.sin(Math.abs(pose.rotation) * Math.PI / 180);

        nodes[name]!.setAttribute(
          "transform",
          `translate(${pose.x + tilt * 55} ${pose.y + 78 - pose.sit * 35 - tilt * 23})`,
        );
        nodes[name]!.setAttribute("opacity", String(pose.alpha * 0.15));
      }

      paintA(frame.a, time, reduced, env.sun);
      paintB(frame.b, time, reduced, env.sun);

      const dream = targetFor("kiss");

      dream.a.x = 323;
      dream.a.y = 514;
      dream.a.scale = 0.63;
      dream.a.rotation = 7;
      dream.a.rightX = 103;
      dream.a.rightY = -12;
      dream.a.closed = 0.75;

      dream.b.x = 400;
      dream.b.y = 514;
      dream.b.scale = 0.63;
      dream.b.rotation = -3;
      dream.b.leftX = -77;
      dream.b.leftY = -42;
      dream.b.closed = 0.6;

      paintDreamA(dream.a, time, reduced, 0.8);
      paintDreamB(dream.b, time, reduced, 0.8);

      particles.draw(frame, time, reduced);
    }

    function resizeCaption() {
      // Compute a responsive viewBox that expands width on wide screens
      // while keeping height fixed at 1080 (never vertical-slice characters).
      const { width: w, height: h } = element.getBoundingClientRect();
      const aspect = w / h;
      const stageH = 1080;
      const stageW = Math.max(720, aspect * stageH);
      const minX = (720 - stageW) / 2;
      setViewBox(`${minX} 0 ${stageW} ${stageH}`);
    }

    const resizeObserver = new ResizeObserver(resizeCaption);
    resizeObserver.observe(element);
    resizeCaption();

    const unsubscribe = controller.addRenderer((time) => {
      if (active && film) {
        paint(film.sample(time, reduced), time);
        lyrics.current?.paint(time, score, reduced);
      } else {
        paint(targetFor("intro"), 0);
        lyrics.current?.clear();
      }
    });

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
      film?.dispose();
      particles.dispose();
    };
  }, [controller, score, duration, active, reduced]);

  return (
    <div className="cinematic-stage" ref={root}>
      <div className="sky-base" aria-hidden="true" />

      <div className="film-surface" aria-hidden="true">
        <svg className="art art-back" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="moon-halo">
              <stop stopColor="#f6dfa8" stopOpacity=".22" />
              <stop offset="1" stopColor="#f6dfa8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sun-halo">
              <stop stopColor="#ffe5b4" stopOpacity=".6" />
              <stop offset="1" stopColor="#ffe5b4" stopOpacity="0" />
            </radialGradient>
            <pattern id="wallpaper" width="92" height="92"
              patternUnits="userSpaceOnUse">
              <path d="M46 0v92" stroke="#a58aaa"
                strokeWidth="1" opacity=".12" />
              <path d="M43 41l3-4 3 4-3 4Z"
                fill="#d5bacc" opacity=".08" />
            </pattern>
            <mask id="room-cutout" maskUnits="userSpaceOnUse"
              x="-3000" y="-3000" width="7000" height="7000">
              <rect x="-3000" y="-3000" width="7000" height="7000"
                fill="white" />
              <rect data-node="hole" x="185" y="145" width="350"
                height="445" rx="104" fill="black" />
            </mask>
          </defs>

          <g data-node="moon">
            <circle cx="446" cy="230" r="150" fill="url(#moon-halo)" />
            <path
              d="M466 172C411 178 402 238 444 267C404 263 380 227 394 198C409 168 442 161 466 172Z"
              fill="#f0debb"
            />
          </g>

          <g data-node="sun" opacity="0">
            <circle cx="279" cy="377" r="270" fill="url(#sun-halo)" />
            <circle cx="279" cy="377" r="50" fill="#f5d9a9" />
            <path d="M247 427L143 700M279 433V745M313 426L421 700"
              stroke="#f5d9a9" strokeWidth="22" opacity=".08" />
          </g>

          <g data-node="cloudA" fill="#b5a3c6" opacity=".45">
            <path
              d="M58 353c-28-1-32-28-8-36c-5-28 30-42 47-20c23-31 61-13 59 15c37-1 42 39 11 41Z"
            />
          </g>
          <g data-node="cloudB" fill="#ccb8d5" opacity=".38">
            <path
              d="M478 435c-27 0-31-28-7-34c-2-29 32-40 48-18c22-29 59-10 57 13c34 0 39 39 9 39Z"
            />
          </g>

          <path
            d="M-800 858Q-300 600 0 790Q190 650 360 781Q570 644 790 790Q1200 600 1600 850V2000H-800Z"
            fill="#51415f" opacity=".6"
          />
          <path
            d="M-800 935Q-250 740 70 876Q230 761 395 874Q588 747 850 885Q1200 750 1600 950V2000H-800Z"
            fill="#342e47"
          />

          <g data-node="room">
            <g mask="url(#room-cutout)">
              <rect x="-3000" y="-3000" width="7000" height="7000"
                fill="#342c43" />
              <rect x="-3000" y="-3000" width="7000" height="7000"
                fill="url(#wallpaper)" />
            </g>
            <path d="M-3000 983H4000V4000H-3000Z" fill="#292537" />
            <path d="M-3000 983H4000" stroke="#aa8a9f"
              strokeWidth="3" opacity=".25" />
          </g>

          <rect data-node="cold" x="-3000" y="-3000"
            width="7000" height="7000" fill="#849cce" opacity="0" />
        </svg>

        <canvas ref={canvas} className="weather" />

        <svg className="art art-front" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id="imagination-clip">
              <rect x="151" y="277" width="418" height="263" rx="88" />
            </clipPath>
            <linearGradient id="quilt-color" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#b797b0" />
              <stop offset="1" stopColor="#856682" />
            </linearGradient>
            <radialGradient id="lantern-glow">
              <stop stopColor="#ffe1a1" stopOpacity=".4" />
              <stop offset="1" stopColor="#ffe1a1" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="snowglobe-halo">
              <stop stopColor="#e8d5f5" stopOpacity=".35" />
              <stop offset="1" stopColor="#e8d5f5" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="wood-tier1" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#5a3825" />
              <stop offset="1" stopColor="#3e2415" />
            </linearGradient>
            <linearGradient id="wood-body" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#422616" />
              <stop offset="1" stopColor="#2a170e" />
            </linearGradient>
            <linearGradient id="brass-plate" x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="#ffe8a3" />
              <stop offset=".5" stopColor="#d4aa50" />
              <stop offset="1" stopColor="#8c6b28" />
            </linearGradient>
          </defs>

          <g data-node="window">
            <rect x="173" y="133" width="374" height="469" rx="116"
              fill="none" stroke="#7c6074" strokeWidth="17" />
            <rect x="184" y="144" width="352" height="447" rx="105"
              fill="none" stroke="#c6a7b3" strokeWidth="3" />
            <path d="M360 148V590M187 370H533"
              stroke="#b99aa9" strokeWidth="7" />
            <path d="M160 608H560" stroke="#cfb0b6"
              strokeWidth="15" strokeLinecap="round" />

            <g data-node="curtainA">
              <path d="M172 175Q143 330 168 543"
                stroke="#8c6b83" strokeWidth="24"
                fill="none" strokeLinecap="round" />
            </g>
            <g data-node="curtainB">
              <path d="M547 175Q577 330 552 543"
                stroke="#8c6b83" strokeWidth="24"
                fill="none" strokeLinecap="round" />
            </g>

            <path d="M155 158Q360 39 565 158"
              fill="none" stroke="#aa8a9a" strokeWidth="2" />

            {[170, 230, 294, 360, 426, 490, 550].map((x, index) => (
              <g key={x}>
                <path
                  d={`M${x} ${index === 3 ? 100 : 121}v17`}
                  stroke="#b59a9f" strokeWidth="2"
                />
                <circle cx={x} cy={index === 3 ? 120 : 141}
                  r="4.5" fill="#f0d2a5" />
                <circle cx={x} cy={index === 3 ? 120 : 141}
                  r="10" fill="#f0d2a5" opacity=".05" />
              </g>
            ))}
          </g>

          <g data-node="camera">
            <ellipse data-node="shadowA" rx="65" ry="11"
              fill="#121020" opacity=".15" />
            <ellipse data-node="shadowB" rx="65" ry="11"
              fill="#121020" opacity=".15" />

            <g data-node="bed" opacity="0">
              {/* ── WOODEN BED — Handcrafted daybed with headboard ── */}
              {/* Mattress base shadow */}
              <ellipse cx="363" cy="998" rx="195" ry="12" fill="#0e0c1a" opacity=".35" />

              {/* Foot posts (front) */}
              <rect x="192" y="910" width="20" height="88" rx="6"
                fill="#5c3820" stroke="#3e2210" strokeWidth="1.5" />
              <ellipse cx="202" cy="910" rx="13" ry="8" fill="#7a4e2e" stroke="#3e2210" strokeWidth="1.5" />
              <rect x="528" y="910" width="20" height="88" rx="6"
                fill="#5c3820" stroke="#3e2210" strokeWidth="1.5" />
              <ellipse cx="538" cy="910" rx="13" ry="8" fill="#7a4e2e" stroke="#3e2210" strokeWidth="1.5" />

              {/* Head posts (back-ish, taller) */}
              <rect x="192" y="828" width="20" height="90" rx="6"
                fill="#5c3820" stroke="#3e2210" strokeWidth="1.5" />
              <ellipse cx="202" cy="828" rx="13" ry="8" fill="#7a4e2e" stroke="#3e2210" strokeWidth="1.5" />
              <rect x="528" y="828" width="20" height="90" rx="6"
                fill="#5c3820" stroke="#3e2210" strokeWidth="1.5" />
              <ellipse cx="538" cy="828" rx="13" ry="8" fill="#7a4e2e" stroke="#3e2210" strokeWidth="1.5" />

              {/* Headboard panel */}
              <path d="M202 836Q360 808 538 836V918Q360 926 202 918Z"
                fill="#4a2e18" stroke="#3e2210" strokeWidth="2" />
              {/* Headboard raised rail top */}
              <path d="M202 836Q360 812 538 836"
                fill="none" stroke="#7a5035" strokeWidth="8" strokeLinecap="round" />
              {/* Headboard carved detail */}
              <path d="M230 862Q360 848 490 862"
                fill="none" stroke="#6a4028" strokeWidth="3" strokeLinecap="round" opacity=".7" />
              <path d="M240 876Q360 864 480 876"
                fill="none" stroke="#6a4028" strokeWidth="2" strokeLinecap="round" opacity=".5" />
              {/* Wood grain lines on headboard */}
              <path d="M270 840v72M360 836v82M450 840v72"
                stroke="#3e2410" strokeWidth="1" strokeDasharray="3 9" opacity=".4" />
              {/* Headboard side rails */}
              <rect x="192" y="836" width="12" height="82" rx="3"
                fill="#5a3820" stroke="#3e2210" strokeWidth="1" />
              <rect x="536" y="836" width="12" height="82" rx="3"
                fill="#5a3820" stroke="#3e2210" strokeWidth="1" />

              {/* Mattress */}
              <path d="M204 918Q360 908 536 918V988Q360 998 204 988Z"
                fill="#ece0d4" stroke="#b8a09a" strokeWidth="2" />
              {/* Mattress piping top edge */}
              <path d="M204 918Q360 908 536 918"
                fill="none" stroke="#d4c0ba" strokeWidth="6" strokeLinecap="round" />
              {/* Mattress side seam */}
              <path d="M204 918V988M536 918V988"
                stroke="#c4aea8" strokeWidth="2" strokeLinecap="round" />
              {/* Mattress quilted pattern */}
              <path d="M270 926L265 980M360 924V982M450 926L455 980"
                stroke="#c4b0a8" strokeWidth="1" strokeDasharray="4 8" opacity=".5" />
              <path d="M210 952Q360 946 530 952"
                fill="none" stroke="#c4b0a8" strokeWidth="1" strokeDasharray="4 8" opacity=".5" />

              {/* Pillows */}
              <path d="M228 912Q280 900 340 908V928Q280 936 228 926Z"
                fill="#f5ece8" stroke="#c8b4b0" strokeWidth="1.5" />
              <ellipse cx="284" cy="918" rx="52" ry="11"
                fill="#f8f1ee" stroke="none" opacity=".6" />
              <path d="M380 910Q440 900 495 910V928Q440 938 380 926Z"
                fill="#ede0e8" stroke="#c0aab8" strokeWidth="1.5" />
              <ellipse cx="438" cy="918" rx="52" ry="11"
                fill="#f4eef2" stroke="none" opacity=".6" />
              {/* Pillow soft fold shadows */}
              <path d="M230 920Q280 926 338 921"
                fill="none" stroke="#c4b0aa" strokeWidth="1.5" strokeLinecap="round" opacity=".4" />
              <path d="M382 918Q440 924 492 918"
                fill="none" stroke="#baaab6" strokeWidth="1.5" strokeLinecap="round" opacity=".4" />

              {/* Foot rail crossbar */}
              <path d="M204 988Q360 998 536 988"
                fill="none" stroke="#5c3820" strokeWidth="12" strokeLinecap="round" />
              <path d="M204 988Q360 998 536 988"
                fill="none" stroke="#7a4e2e" strokeWidth="4" strokeLinecap="round" opacity=".5" />
            </g>

            <g data-node="gifts" opacity="0">
              {["#c1a9c8", "#c9b695", "#a5b5bf", "#c89dad", "#ac9ac4"]
                .map((color, index) => (
                  <Present key={color} index={index} color={color} />
                ))}
            </g>

            <g data-node="flowers" opacity="0"
              transform="translate(550 899)">
              <path d="M0 48L-17-15M0 48L12-24M0 48L29-4"
                stroke="#8d9b86" strokeWidth="3" />
              {[-17, 12, 29].map((x, index) => (
                <g key={x}
                  transform={`translate(${x} ${-15 + index * 7})`}>
                  <circle cx="-7" r="9" fill="#d7aac0" />
                  <circle cx="7" r="9" fill="#d7aac0" />
                  <circle cy="-7" r="9" fill="#d7aac0" />
                  <circle cy="7" r="9" fill="#d7aac0" />
                  <circle r="5" fill="#eed9a5" />
                </g>
              ))}
              <path d="M-21 19L24 17L10 62H-8Z" fill="#e8d7c0" />
              <path d="M-15 34L17 33" stroke="#bb91a7" strokeWidth="4" />
            </g>

            <BearRig id="a" variant="a" />
            <BearRig id="b" variant="b" />

            <g data-node="letter" opacity="0">
              <rect x="-23" y="-16" width="46" height="32" rx="4"
                fill="#f2e2cc" stroke="#b29a9f" strokeWidth="1.5" />
              <path d="M-21-14L0 2L21-14"
                fill="none" stroke="#b29a9f" strokeWidth="1.5" />
              <circle cy="2" r="4" fill="#b78b9c" />
            </g>

            <g data-node="phone" opacity="0">
              <rect x="-14" y="-29" width="28" height="54" rx="6"
                fill="#3d3246" stroke="#dec4d1" strokeWidth="1.5" />
              <rect x="-10" y="-21" width="20" height="33" rx="2"
                fill="#b8a5cd" />
              <path d="M-5-12H6M-5-5H3M-5 2H7"
                stroke="#eaddec" strokeWidth="1.5" />
              <circle cy="18" r="2" fill="#d4bdd9" />
            </g>

            <g data-node="lantern" opacity="0">
              <circle r="55" fill="url(#lantern-glow)" />
              <path d="M-10-4Q0-15 10-4V19Q0 28-10 19Z"
                fill="#eed19a" stroke="#ab8279" strokeWidth="1.5" />
              <path d="M-6-7v-10q6-11 12 0v10"
                fill="none" stroke="#c2a8a9" strokeWidth="2" />
              <path d="M0-3V20" stroke="#fff0c9" strokeWidth="3" />
            </g>

            <g data-node="quilt" opacity="0">
              {/* Quilt draped over both seated characters on the bed */}
              {/* Main quilt body — rises over laps, drapes naturally */}
              <path
                d="M196 898Q362 876 544 898L560 988Q360 1004 160 988Z"
                fill="url(#quilt-color)"
                stroke="#70586f" strokeWidth="3"
              />
              {/* Top quilted fold — rolls over the bodies naturally */}
              <path d="M200 898Q362 879 540 898"
                fill="none" stroke="#dfbcca"
                strokeWidth="18" strokeLinecap="round" />
              {/* Secondary fold shadow */}
              <path d="M210 905Q362 886 530 905"
                fill="none" stroke="#c4a0b5"
                strokeWidth="6" strokeLinecap="round" opacity=".5" />
              {/* Quilted stitching grid lines */}
              <path
                d="M230 910L218 988M305 904L300 992M380 902V994M455 904L462 990M530 912L548 986M176 946Q362 968 554 946M168 970Q362 992 562 970"
                fill="none" stroke="#d0abc0"
                strokeWidth="1.5" strokeDasharray="3 7" opacity=".6"
              />
              {/* Heart motif centre-quilt */}
              <path
                d="M351 936q-15-20-24-5q-4 10 24 28q28-18 24-28q-9-15-24 5"
                fill="#cda9bb" opacity=".65"
              />
              {/* Warm ambient glow on quilt surface */}
              <ellipse cx="362" cy="940" rx="140" ry="22"
                fill="#f5e0ea" opacity=".08" />
            </g>
          </g>

          <g data-node="message" opacity="0">
            <rect x="500" y="650" width="170" height="76" rx="21"
              fill="#f0e6e3" stroke="#ceb8cc" strokeWidth="1.5" />
            <circle cx="522" cy="672" r="5" fill="#b39bbf" />
            <path d="M535 672H575"
              stroke="#b9a0b5" strokeWidth="3" strokeLinecap="round" />
            <text x="522" y="705"
              fontFamily="system-ui" fontSize="20" fill="#514152">
              Pull up
            </text>
          </g>

          <g data-node="thought" opacity="0">
            <circle cx="205" cy="562" r="11" fill="#dbc9df" />
            <circle cx="186" cy="585" r="6" fill="#dbc9df" />
            <rect x="151" y="277" width="418" height="263" rx="88"
              fill="#dfccdd" stroke="#bba0c6" strokeWidth="3" />

            <g clipPath="url(#imagination-clip)">
              <rect x="157" y="283" width="406" height="251"
                fill="#b29ab4" />
              <path
                d="M190 282v260M245 282v260M300 282v260M355 282v260M410 282v260M465 282v260M520 282v260"
                stroke="#d3bdce" strokeWidth="2" opacity=".45"
              />
              <path d="M438 306V535"
                stroke="#8b708e" strokeWidth="8" opacity=".45" />
              <path d="M151 530H569" stroke="#8c7089" strokeWidth="9" />
              <BearRig id="dream-a" variant="a" />
              <BearRig id="dream-b" variant="b" />
            </g>

            <path d="M231 302Q360 274 489 302"
              fill="none" stroke="#f3e4ed" strokeWidth="2" opacity=".5" />
          </g>

          <g data-node="title" opacity="0">
            <circle cx="360" cy="215" r="97"
              fill="none" stroke="#ead5b2" strokeWidth="1" opacity=".35" />
            <circle cx="360" cy="215" r="88"
              fill="none" stroke="#ead5b2" strokeWidth="1" opacity=".12" />
            <text x="360" y="221" textAnchor="middle"
              fontFamily="Georgia,serif" fontSize="27"
              letterSpacing="2" fill="#f4e6d4">
              O MERI JAAN
            </text>
            <path d="M338 244H382"
              stroke="#d6b4bf" strokeWidth="2" strokeLinecap="round" />
          </g>

          <g data-node="snowglobe" opacity="0">
            <circle cx="360" cy="540" r="390" fill="url(#snowglobe-halo)" opacity=".35" />
            <circle cx="360" cy="540" r="380" fill="none" stroke="#d5c0e8" strokeWidth="6" opacity=".55" />
            <circle cx="360" cy="540" r="382" fill="none" stroke="#ffffff" strokeWidth="2" opacity=".75" />
            <path d="M140 320 A 370 370 0 0 1 340 185" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity=".65" />
            <ellipse cx="260" cy="220" rx="45" ry="18" transform="rotate(-35 260 220)" fill="#ffffff" opacity=".45" />
            <path d="M580 400 A 375 375 0 0 1 540 680" fill="none" stroke="#d4bde8" strokeWidth="8" strokeLinecap="round" opacity=".22" />

            <g transform="translate(360 920)">
              <ellipse cy="78" rx="280" ry="24" fill="#0c0a18" opacity=".6" />
              <ellipse cy="0" rx="270" ry="26" fill="url(#wood-tier1)" stroke="#523220" strokeWidth="2" />
              <path d="M-270 0 L-295 48 C-200 68 200 68 295 48 L270 0 Z" fill="url(#wood-body)" stroke="#422515" strokeWidth="2" />
              <path d="M-285 24 C-190 42 190 42 285 24" fill="none" stroke="#f6dfa8" strokeWidth="4" opacity=".8" />
              <path d="M-280 28 C-190 46 190 46 280 28" fill="none" stroke="#b89350" strokeWidth="1.5" />
              <ellipse cy="52" rx="305" ry="28" fill="url(#wood-tier1)" stroke="#523220" strokeWidth="2" />
              <path d="M-305 52 L-310 74 C-210 96 210 96 310 74 L305 52 Z" fill="#2d1910" />
              <ellipse cy="74" rx="310" ry="28" fill="#22120b" />
              <rect x="-65" y="32" width="130" height="28" rx="5" fill="url(#brass-plate)" stroke="#f5dfa5" strokeWidth="1.5" />
              <circle cx="-56" cy="46" r="2" fill="#7a5520" />
              <circle cx="56" cy="46" r="2" fill="#7a5520" />
              <text x="0" y="52" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" letterSpacing="3" fill="#382108" fontWeight="bold">OMJ</text>
            </g>
          </g>
        </svg>
      </div>

      <div className="vignette" aria-hidden="true" />
      <LyricsDisplay ref={lyrics} />
    </div>
  );
});
