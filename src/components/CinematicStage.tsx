import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AudioController } from "../audio/AudioController";
import { FilmEngine } from "../animation/FilmEngine";
import { createParticleEngine, type ViewBox } from "../animation/ParticleEngine";
import { BearRig } from "../characters/BearRig";
import { createBearPainter } from "../characters/BearAnimations";
import {
  resolveAuthoritativeEnv,
  type LiveOpeningContext,
} from "../environment/weatherState";
import {
  attachHand,
  clamp,
  MIRROR_CENTER_X,
  targetFor,
  worldPoint,
  type Frame,
} from "../timeline/scenes";
import { validateScore, type Score } from "../timeline/score";
import {
  buildModernBedroomQuads,
  createCamera3D,
  projectQuad,
} from "../stage/Room3D";
import { LyricsDisplay, type LyricsHandle, type SafeBox } from "./LyricsDisplay";
import { CinematicGrade } from "./CinematicGrade";
import { GlassBubble } from "./GlassBubble";

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

export interface StageHandle {
  resetOrbit(): void;
}

interface StageProps {
  controller: AudioController;
  score: Score;
  duration: number;
  active: boolean;
  captionsVisible: boolean;
  openingContext: LiveOpeningContext | null;
  playbackRate: number;
}

/* ── ending: the room the final camera must frame ─────────────────────────── */

/**
 * The room's actual contents, in the film's art coordinates.
 *
 * Measured from the authored art, not guessed: the nightstand group sits at
 * `translate(80 610)` and spans x≈90..270, the mirror/vanity tops out at y≈-223,
 * the bed runs to y≈1038, and the bookshelf — the last thing on the right — is
 * at `translate(1680 480)` and ends at x≈1825.
 *
 * This deliberately excludes the room's full-bleed wallpaper (`-1200..3400`)
 * and floor bleed, which are unbounded backdrop, not content. Framing on those
 * would zoom out until the furniture was a speck in an empty wall; framing on
 * the contents is what makes the ending read as "the whole room".
 */
const ROOM_ART_BOUNDS = { x: 40, y: -223, width: 1785, height: 1261 } as const;

interface ArtBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Viewport aspect, clamped the same way the camera clamps it. */
export function viewportAspect(width: number, height: number): number {
  return Math.max(0.25, width / Math.max(1, height));
}

/** The film's authored base frame for a given viewport aspect. */
export function baseFrame(width: number, height: number) {
  const aspect = viewportAspect(width, height);
  const SAFE_W = 760;
  const SAFE_H = 1040;

  if (aspect >= SAFE_W / SAFE_H) {
    return { width: SAFE_H * aspect, height: SAFE_H };
  }
  return { width: SAFE_W, height: SAFE_W / aspect };
}

/**
 * The camera framing that holds the entire room, solved against the room's own
 * bounds and the viewport's aspect ratio.
 *
 * This is the settled framing of the ending's pull-back. It is a viewBox — the
 * camera's field of view and aim — exactly like every other shot in the film,
 * so the room is framed by moving the camera and nothing else. No furniture is
 * scaled or repositioned to fake a wide shot, and the room's proportions are
 * never altered.
 *
 * A single `zoom` number cannot express this: zoom is floored at 0.48, and on a
 * portrait phone the room is far wider than the viewport, so holding its full
 * width needs a wider field of view than that floor allows. Solving here also
 * makes the shot correct on every screen rather than only where it was authored.
 */
export function roomFitBox(width: number, height: number): ArtBox {
  const aspect = viewportAspect(width, height);

  /*
   * Breathing room is added per axis, in *frame* terms rather than by inflating
   * both sides equally. The room is wider than it is tall, so a single combined
   * margin would either overflow the width or leave a dead band down one side.
   */
  const PAD = 20;
  const roomW = ROOM_ART_BOUNDS.width + PAD * 2;
  const roomH = ROOM_ART_BOUNDS.height + PAD * 1.5;

  // Contain the room on both axes at this aspect.
  const boxW = Math.max(roomW, roomH * aspect);
  const boxH = boxW / aspect;

  const centreX = ROOM_ART_BOUNDS.x + ROOM_ART_BOUNDS.width / 2;
  const centreY = ROOM_ART_BOUNDS.y + ROOM_ART_BOUNDS.height / 2;

  return {
    x: centreX - boxW / 2,
    y: centreY - boxH / 2,
    width: boxW,
    height: boxH,
  };
}

/**
 * Geometry for the ending's glass dome, solved against the live stage.
 *
 * Two constraints have to hold at once, on every screen:
 *
 *   1. The dome must be fully on screen, so it reads as an object rather than
 *      a shape cropped by the viewport. That fixes its radius at just under
 *      half of the *shorter* stage dimension — a circle, by construction.
 *   2. The complete room must sit inside it, with nothing left outside the
 *      glass. A room is wider than it is tall, so on a wide screen this needs
 *      the camera further back than the plain room fit; the required viewBox is
 *      derived from the room's diagonal, which is the only measurement that
 *      guarantees the corners are enclosed too.
 *
 * `radiusPx` is emitted in pixels (not percentages) because the two axes of a
 * stage are different lengths: a percentage radius would be an ellipse. Pixels
 * plus `aspect-ratio: 1` make circularity a fact rather than a hope.
 */
export function bubbleGeometry(stageWidth: number, stageHeight: number) {
  const w = stageWidth > 0 && Number.isFinite(stageWidth) ? stageWidth : 1440;
  const h = stageHeight > 0 && Number.isFinite(stageHeight) ? stageHeight : 900;

  /*
   * Solve the fit on both axes instead of guessing a fraction of the short side.
   *
   * The keepsake is the dome *plus* its plinth, so the object spans 1.13r above
   * the dome's centre and 1.238r below it (see the `.bubble-base` metrics). Two
   * independent limits follow:
   *
   *   vertical   — 1.238r must clear the bottom of the frame  → r ≤ 0.38·h
   *   horizontal — the dome is 2r wide, the plinth 1.16r          → r ≤ 0.49·w
   *
   * Taking the smaller keeps the object whole on a wide desktop *and* lets a
   * portrait phone use its full width, which a `min(w, h)` fraction did not:
   * there the short side is the width, so the dome was needlessly small.
   */
  const radiusPx = Math.min(w * 0.49, h * 0.38);

  const PAD = 20;
  const roomW = ROOM_ART_BOUNDS.width + PAD * 2;
  const roomH = ROOM_ART_BOUNDS.height + PAD * 1.5;
  const diagonal = Math.hypot(roomW, roomH);

  /*
   * Scale the room so its diagonal spans the dome's diameter, then convert that
   * to a viewBox. Fitting the diagonal — not the box — is what keeps the
   * corners of the room inside the circle.
   */
  const scale = (radiusPx * 2) / diagonal;
  const boxW = w / scale;
  const boxH = boxW / (w / h);

  const centreX = ROOM_ART_BOUNDS.x + ROOM_ART_BOUNDS.width / 2;
  const centreY = ROOM_ART_BOUNDS.y + ROOM_ART_BOUNDS.height / 2;

  return {
    radiusPx,
    box: {
      x: centreX - boxW / 2,
      y: centreY - boxH / 2,
      width: boxW,
      height: boxH,
    } as ArtBox,
  };
}

export const CinematicStage = memo(forwardRef<StageHandle, StageProps>(function CinematicStage({
  controller,
  score,
  duration,
  active,
  captionsVisible,
  openingContext,
  playbackRate,
}, ref) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const svgBack = useRef<SVGSVGElement>(null);
  const svgFront = useRef<SVGSVGElement>(null);
  const lyrics = useRef<LyricsHandle>(null);
  const reduced = useReducedMotion();

  const stageSizeRef = useRef({ width: 1440, height: 900 });
  const openingRef = useRef<LiveOpeningContext | null>(openingContext);
  openingRef.current = openingContext;

  const captionsVisibleRef = useRef(captionsVisible);
  captionsVisibleRef.current = captionsVisible;

  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  const orbitRef = useRef({
    yaw: 0,
    pitch: 0,
    dragging: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startYaw: 0,
    startPitch: 0,
    moved: false,
  });

  const gestureRef = useRef({
    holdTimer: 0 as number,
    fastForward: false,
    lastTapTime: 0,
    lastTapSide: "" as "" | "left" | "right",
    lastTapX: 0,
    lastTapY: 0,
  });

  const [orbitHud, setOrbitHud] = useState<number | null>(null);
  const [seekBadge, setSeekBadge] = useState<{ side: "left" | "right"; label: string; key: number } | null>(null);
  const [fastBadge, setFastBadge] = useState(false);

  useImperativeHandle(ref, () => ({
    resetOrbit() {
      orbitRef.current.yaw = 0;
      orbitRef.current.pitch = 0;
      orbitRef.current.dragging = false;
      setOrbitHud(null);
      controller.renderNow();
    },
  }), [controller]);

  useLayoutEffect(() => {
    const element = root.current!;
    const backSvg = svgBack.current!;
    const frontSvg = svgFront.current!;
    const particles = createParticleEngine(canvas.current!);

    const query = (name: string) => {
      const node = element.querySelector<SVGElement>(`[data-node="${name}"]`);
      if (!node) throw new Error(`Missing stage node: ${name}`);
      return node;
    };

    const nodes = Object.fromEntries(
      [
        "skyTopStop", "skyMidStop", "skyBottomStop",
        "room", "window", "sun", "moon", "cold",
        "cloudA", "cloudB", "cloudC", "bed", "message",
        "gifts", "flowers", "ringbox", "cigarette", "phone",
        "thought", "dreamScene", "quilt", "quilt-back", "stoolA", "stoolB",
        "lantern", "letter", "photoGlow", "lampGlow",
        "curtainA", "curtainB", "curtainC",
        "shadowA", "shadowB", "mirrorGroup",
        "mirrorWrapA", "mirrorWrapB", "stageBears",
      ].map((name) => [name, query(name)]),
    );

    const character = (id: string) => {
      const node = element.querySelector<SVGGElement>(`[data-bear="${id}"]`);
      if (!node) throw new Error(`Missing character: ${id}`);
      return createBearPainter(node);
    };

    const paintA = character("a");
    const paintB = character("b");
    const paintMirrorA = character("mirror-a");
    const paintMirrorB = character("mirror-b");
    const paintDreamA = character("dream-a");
    const paintDreamB = character("dream-b");

    const bearAEl = element.querySelector<SVGGElement>('[data-bear="a"]')!;
    const bearBEl = element.querySelector<SVGGElement>('[data-bear="b"]')!;
    const surface = element.querySelector<HTMLElement>(".film-surface")!;
    const bubbleEl = element.querySelector<HTMLElement>('.glass-bubble');

    const valid = duration > 0 && validateScore(score, duration).length === 0;
    const film = valid ? new FilmEngine(score, duration) : null;

    const setOpacity = (name: string, value: number) =>
      nodes[name]!.setAttribute("opacity", String(clamp(value)));

    function computeViewBox(frame: Frame): ViewBox {
      const { width, height } = stageSizeRef.current;
      const base = baseFrame(width, height);

      const zoom = Math.max(0.48, frame.env.zoom || 1);
      const vbW = base.width / zoom;
      const vbH = base.height / zoom;
      const yawRad = (orbitRef.current.yaw * Math.PI) / 180;
      const orbitOffsetX = Math.sin(yawRad) * 185;
      const orbitOffsetY = orbitRef.current.pitch * 4.5;
      const focusX = (frame.env.camX ?? 480) + orbitOffsetX;
      const focusY = 515 + (frame.env.camY ?? 0) + orbitOffsetY;

      const shotBox: ViewBox = {
        x: focusX - vbW / 2,
        y: focusY - vbH / 2,
        width: vbW,
        height: vbH,
      };

      /*
       * The ending's pull-back eases `roomFrame` to 1. Blending the *box* rather
       * than switching between two framings keeps the move continuous: at every
       * instant the camera has one field of view aimed at one point, so there is
       * no cut, snap or pop. Furniture is never touched — only the viewBox.
       */
      const roomFrame = clamp(frame.env.roomFrame ?? 0);
      if (roomFrame <= 0) return shotBox;

      const wide = roomFitBox(width, height);
      const revealed: ArtBox = {
        x: shotBox.x + (wide.x - shotBox.x) * roomFrame,
        y: shotBox.y + (wide.y - shotBox.y) * roomFrame,
        width: shotBox.width + (wide.width - shotBox.width) * roomFrame,
        height: shotBox.height + (wide.height - shotBox.height) * roomFrame,
      };

      /*
       * The glass arrives after the reveal. As it does, the camera keeps easing
       * back — the same continuous move, never a second one — until the whole
       * room fits inside the dome instead of merely inside the frame. Both
       * framings are pure viewBoxes, so the room's geometry is untouched.
       *
       * The two fits are *composed*, not stacked. `roomFitBox` already contains
       * the room on both axes, so the bubble framing has to be expressed as a
       * single scale factor relative to it; blending to a second absolutely
       * sized box would ease toward a framing solved from an already-wide one
       * and fly the camera straight past the room.
       */
      const glass = clamp(frame.env.bubble ?? 0);
      if (glass <= 0) return revealed;

      const { box: bubbleBox } = bubbleGeometry(width, height);
      // How much wider the bubble framing is than the plain room fit.
      const contain = Math.max(1, bubbleBox.width / wide.width);
      const t = glass * glass * (3 - 2 * glass); // smoothstep, for a soft settle
      const k = 1 + (contain - 1) * t;

      // Scale about the room's centre, so the move stays a camera pull-back.
      const cx = revealed.x + revealed.width / 2;
      const cy = revealed.y + revealed.height / 2;
      const w2 = revealed.width * k;
      const h2 = revealed.height * k;

      return { x: cx - w2 / 2, y: cy - h2 / 2, width: w2, height: h2 };
    }

    function paint(rawFrame: Frame, time: number, isIntroPreview: boolean): SafeBox[] {
      const frame = rawFrame;
      const env = frame.env;
      const auth = resolveAuthoritativeEnv(env, {
        opening: openingRef.current,
        isIntroPreview,
      });

      // Smooth spring-return on cameraYaw & cameraPitch when not actively dragging
      if (!orbitRef.current.dragging && (Math.abs(orbitRef.current.yaw) > 0.15 || Math.abs(orbitRef.current.pitch) > 0.1)) {
        orbitRef.current.yaw *= 0.88;
        orbitRef.current.pitch *= 0.88;
        if (Math.abs(orbitRef.current.yaw) <= 0.15) orbitRef.current.yaw = 0;
        if (Math.abs(orbitRef.current.pitch) <= 0.1) orbitRef.current.pitch = 0;
      }

      const yaw = orbitRef.current.yaw;
      const yawRad = (yaw * Math.PI) / 180;

      const vb = computeViewBox(frame);
      const vbStr = `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.width.toFixed(2)} ${vb.height.toFixed(2)}`;
      backSvg.setAttribute("viewBox", vbStr);
      frontSvg.setAttribute("viewBox", vbStr);

      element.dataset.action = frame.action;
      element.dataset.reduced = String(reduced);
      surface.style.opacity = String(clamp(env.alpha));

      /*
       * The glass dome is laid out here rather than in JSX because its radius
       * depends on the live stage size: it is solved so the dome *contains* the
       * room the camera just framed, on whatever screen is watching. It is a
       * CSS percentage of the stage width, so the ring itself is always a true
       * circle — only how much of the room it can hold varies.
       */
      if (bubbleEl) {
        const presence = clamp(env.bubble ?? 0);
        bubbleEl.style.setProperty("--bubble-p", presence.toFixed(3));
        const geo = bubbleGeometry(stageSizeRef.current.width, stageSizeRef.current.height);
        bubbleEl.style.setProperty("--bubble-r", `${geo.radiusPx.toFixed(2)}px`);
        bubbleEl.dataset.present = presence > 0.001 ? "true" : "false";

        /*
         * Containment. A real globe does not let its contents continue past the
         * glass, and the room's flat paint runs wider than its furniture does —
         * without this, the wall/floor bands would visibly cross the dome and
         * the whole illusion would collapse into "a circle drawn on a picture".
         *
         * So the room is clipped to the glass as the glass forms. It starts on
         * a circle larger than the frame (indistinguishable from no clip) and
         * eases down to exactly the dome's radius, in step with the glass
         * itself. Everything important — both characters, the bed, the window,
         * the furniture — is already far inside that radius; only the endless
         * wallpaper and floor edge meet the rim, which is precisely what the
         * rim of a snow globe does.
         */
        const { width, height } = stageSizeRef.current;
        const escape = Math.hypot(width, height) / 2 * 1.02;
        const ease = presence * presence * (3 - 2 * presence);
        const clipRadius = escape + (geo.radiusPx - escape) * ease;
        surface.style.setProperty(
          "--bubble-clip",
          `circle(${clipRadius.toFixed(1)}px at 50% 50%)`,
        );
        surface.dataset.bubbled = presence > 0.001 ? "true" : "false";
      }

      // Coherent Sky Gradient Colors
      nodes.skyTopStop!.setAttribute("stop-color", auth.skyTop);
      nodes.skyMidStop!.setAttribute("stop-color", auth.skyMid);
      nodes.skyBottomStop!.setAttribute("stop-color", auth.skyBottom);

      // Room and Window ALWAYS remain visible during bedroom story
      setOpacity("room", Math.max(0.92, env.room));
      setOpacity("window", 1);
      setOpacity("bed", 1);

      // Strict Sun vs Moon mutual exclusion + Clouds gated by condition
      setOpacity("sun", auth.sun);
      setOpacity("moon", auth.moon);
      setOpacity("cloudA", auth.clouds * 0.55);
      setOpacity("cloudB", auth.clouds * 0.45);
      setOpacity("cloudC", auth.clouds * 0.4);
      setOpacity("cold", auth.coldTint * 0.16);
      setOpacity("lampGlow", auth.lampGlow);

      // Subtle restrained curtain movement
      const curtainSway = reduced ? 0 : Math.sin(time * 0.7) * 2.5;
      nodes.curtainA!.setAttribute(
        "transform",
        `translate(${-env.curtains * 14 + curtainSway} 0)`,
      );
      nodes.curtainB!.setAttribute(
        "transform",
        `translate(${env.curtains * 8 - curtainSway * 0.5} 0)`,
      );
      nodes.curtainC!.setAttribute(
        "transform",
        `translate(${env.curtains * 14 - curtainSway} 0)`,
      );

      // Gentle outdoor cloud drift (only visible when auth.clouds > 0)
      const drift = reduced ? 0 : Math.sin(time * 0.032) * 22;
      nodes.cloudA!.setAttribute("transform", `translate(${drift} 0)`);
      nodes.cloudB!.setAttribute("transform", `translate(${-drift * 0.7} 0)`);
      nodes.cloudC!.setAttribute("transform", `translate(${drift * 0.5} 0)`);

      // True 360-degree 3D bedroom projection (all 4 walls, floor, ceiling, furniture)
      const room3dNode = backSvg.querySelector<SVGGElement>('[data-node="room3d"]');
      const orbitActive = Math.abs(yaw) > 0.5 || Math.abs(orbitRef.current.pitch) > 0.5;
      if (room3dNode) {
        if (orbitActive) {
          const cam3d = createCamera3D(
            yaw,
            orbitRef.current.pitch,
            vb.x + vb.width / 2,
            vb.y + vb.height / 2,
          );
          const quads = buildModernBedroomQuads()
            .map((q) => ({ q, p: projectQuad(q, cam3d) }))
            .filter((item) => item.p.visible)
            .sort((a, b) => b.p.depth - a.p.depth);

          room3dNode.innerHTML = quads
            .map(
              ({ q, p }) =>
                `<path d="${p.d}" fill="${q.fill}" stroke="${q.stroke ?? "none"}" stroke-width="${q.strokeWidth ?? 1}" opacity="${q.opacity ?? 1}" />`,
            )
            .join("");
          room3dNode.setAttribute("opacity", String(clamp(Math.abs(yaw) / 14 + Math.abs(orbitRef.current.pitch) / 6, 0, 1)));
        } else {
          room3dNode.setAttribute("opacity", "0");
        }
      }

      // Subtle parallax offset on distant exterior sky & 3D perspective on North room wall
      const skyParallax = (vb.x - 100) * 0.08 - Math.sin(yawRad) * 95;
      nodes.sun!.setAttribute("transform", `translate(${skyParallax} 0)`);
      nodes.moon!.setAttribute("transform", `translate(${skyParallax} 0)`);
      const northScaleX = clamp(Math.cos(yawRad), 0.12, 1);
      const northOpacity = clamp(Math.cos(yawRad) * 1.35 + 0.15, 0, 1);
      nodes.room!.setAttribute(
        "transform",
        `translate(${(-Math.sin(yawRad) * 520).toFixed(1)} ${(orbitRef.current.pitch * 3.5).toFixed(1)}) scale(${northScaleX.toFixed(3)} 1)`,
      );
      nodes.room!.setAttribute("opacity", String(Math.max(0.92, env.room) * northOpacity));

      // ── Props & Hand Contacts ─────────────────────────────────────────────
      setOpacity("message", env.message);
      setOpacity("photoGlow", env.photoGlow * 0.65);
      setOpacity("quilt", env.quilt);
      setOpacity("quilt-back", env.quilt);
      setOpacity("lantern", env.lantern);
      setOpacity("letter", env.letter);

      // Wooden Footstools for Window Gazing (Cue 42)
      const stoolVis = clamp(env.stools);
      setOpacity("stoolA", stoolVis);
      setOpacity("stoolB", stoolVis);
      nodes.stoolA!.setAttribute("transform", `translate(${frame.a.x} 810)`);
      nodes.stoolB!.setAttribute("transform", `translate(${frame.b.x} 810)`);

      // Notification bubble positioned calmly next to Mochi ONLY in Cue 2
      nodes.message!.setAttribute(
        "transform",
        `translate(${frame.a.x + 115} ${frame.a.y - 235})`,
      );

      // Letter held gently in Mochi's right paw in Cue 1
      const letterHand = worldPoint(frame.a, frame.a.rightX, frame.a.rightY);
      nodes.letter!.setAttribute(
        "transform",
        `translate(${letterHand.x} ${letterHand.y + 4}) rotate(-8)`,
      );

      // Warm lantern held gently by Mochi in Cue 25/26
      nodes.lantern!.setAttribute(
        "transform",
        `translate(${letterHand.x + 6} ${letterHand.y + 18})`,
      );

      // Phone in Yume's paws — BACK of phone faces viewer, screen faces Yume!
      const phonePos = worldPoint(frame.b, -6, -68);
      nodes.phone!.setAttribute(
        "transform",
        `translate(${phonePos.x} ${phonePos.y}) rotate(-10)`,
      );
      setOpacity("phone", env.phone);

      // Open Ring Box held directly between Mochi's paws (Cues 17–18)
      if (env.ringbox > 0.01) {
        const ringHand = worldPoint(
          frame.a,
          (frame.a.leftX + frame.a.rightX) / 2 + 8,
          frame.a.rightY - 6,
        );
        nodes.ringbox!.setAttribute(
          "transform",
          `translate(${ringHand.x} ${ringHand.y})`,
        );
      }
      setOpacity("ringbox", env.ringbox);

      // Direct Hand-to-Hand Gift & Flower Handover (Cues 19–20)
      const handover = clamp(env.giftTransfer);
      const giftStart = worldPoint(frame.a, frame.a.rightX, frame.a.rightY);
      const giftEnd = worldPoint(frame.b, frame.b.leftX, frame.b.leftY);
      const giftX = giftStart.x + (giftEnd.x - giftStart.x) * handover;
      const giftY = giftStart.y + (giftEnd.y - giftStart.y) * handover;

      nodes.gifts!.setAttribute(
        "transform",
        `translate(${giftX} ${giftY - 6})`,
      );
      setOpacity("gifts", env.gifts);

      nodes.flowers!.setAttribute(
        "transform",
        `translate(${giftX + (handover > 0.5 ? 24 : -14)} ${giftY - 10}) rotate(${handover > 0.5 ? -8 : 10})`,
      );
      setOpacity("flowers", env.flowers);

      // Brief Cigarette detail cleanly gripped in Mochi's right paw (Cue 21)
      if (env.cigarette > 0.01) {
        const cigHand = worldPoint(frame.a, frame.a.rightX, frame.a.rightY);
        nodes.cigarette!.setAttribute(
          "transform",
          `translate(${cigHand.x + 8} ${cigHand.y - 6}) rotate(-18)`,
        );
      }
      setOpacity("cigarette", env.cigarette);

      // ── Contact Shadows & Dynamic IK Contacts ─────────────────────────────
      for (const [name, pose] of [
        ["shadowA", frame.a],
        ["shadowB", frame.b],
      ] as const) {
        const isOnBed = pose.y > 885 || Math.abs(pose.rotation) > 20;
        const shadowY = isOnBed ? pose.y + 38 : pose.y + 66;
        const rx = Math.abs(pose.rotation) > 45 ? 95 : 54;
        nodes[name]!.setAttribute(
          "transform",
          `translate(${pose.x} ${shadowY})`,
        );
        nodes[name]!.setAttribute("rx", String(rx));
        /*
         * The gradient supplies the falloff, so opacity only needs to reflect
         * the character's own visibility. Slightly lower on the bed, where the
         * quilt already grounds them and a strong shadow would read as a stain.
         */
        nodes[name]!.setAttribute(
          "opacity",
          String(pose.alpha * (isOnBed ? 0.42 : 0.72)),
        );
      }

      if (frame.action === "lap") {
        // Yume's left paw rests tenderly on Mochi's head resting on her lap
        const headWorld = worldPoint(frame.a, 0, -150);
        const pet = reduced ? 0 : Math.sin(time * 2.8) * 5;
        attachHand(frame.b, "left", headWorld.x + pet, headWorld.y - 16, 1);
      } else if (frame.action === "kiss") {
        attachHand(frame.a, "right", frame.b.x - 12, frame.b.y - 54, 1);
        attachHand(frame.b, "left", frame.a.x + 12, frame.a.y - 54, 1);
      } else if (frame.action === "embrace" || frame.action === "chorus2-7") {
        attachHand(frame.a, "left", frame.b.x - 16, frame.b.y - 44, 1);
        attachHand(frame.a, "right", frame.b.x + 16, frame.b.y - 44, 1);
        attachHand(frame.b, "left", frame.a.x - 16, frame.a.y - 44, 1);
        attachHand(frame.b, "right", frame.a.x + 16, frame.a.y - 44, 1);
      } else if (frame.action === "gifts") {
        attachHand(frame.a, "right", giftX, giftY, 0.9);
        attachHand(frame.b, "left", giftX, giftY, 0.9);
      }

      // Ensure Mochi rests visibly ON TOP OF Yume's lap in Cue 31 ("lap")
      if (frame.action === "lap") {
        if (nodes.stageBears!.lastElementChild !== bearAEl) {
          nodes.stageBears!.appendChild(bearBEl);
          nodes.stageBears!.appendChild(bearAEl);
        }
      } else if (nodes.stageBears!.lastElementChild !== bearBEl) {
        nodes.stageBears!.appendChild(bearAEl);
        nodes.stageBears!.appendChild(bearBEl);
      }

      paintA(frame.a, time, reduced, auth.warmth, yaw);
      paintB(frame.b, time, reduced, auth.warmth, yaw);

      // ── Functional Dressing Table Mirror Reflection ───────────────────────
      // Renders exact real-time mirrored reflections inside #mirror-glass-clip
      for (const [pose, paintFn, wrap] of [
        [frame.a, paintMirrorA, nodes.mirrorWrapA!],
        [frame.b, paintMirrorB, nodes.mirrorWrapB!],
      ] as const) {
        const dist = Math.abs(pose.x - MIRROR_CENTER_X);
        const proximity = clamp(1 - Math.max(0, dist - 75) / 135);
        const vis = proximity * pose.alpha * clamp(1 - env.dreamEnter * 0.4);

        if (vis > 0.01) {
          const mirrorPose = {
            ...pose,
            // If standing facing away from camera into the mirror, mirror reflects their front!
            back: pose.back > 0.5 ? 0 : pose.back,
            alpha: vis * 0.74,
          };
          paintFn(mirrorPose, time, reduced, auth.warmth, -yaw);
          const rx = MIRROR_CENTER_X + (pose.x - MIRROR_CENTER_X) * 0.52;
          const ry = pose.y - 16;
          wrap.setAttribute(
            "transform",
            `translate(${rx} ${ry}) scale(-0.82 0.82) translate(${-pose.x} ${-pose.y})`,
          );
          wrap.setAttribute("opacity", "1");
          wrap.style.visibility = "visible";
        } else {
          wrap.setAttribute("opacity", "0");
          wrap.style.visibility = "hidden";
        }
      }

      // ── Scalloped Fluffy Thought-Cloud Dream Portal (Cues 28–29) ───────────
      // Small floating thought bubbles rise from near Mochi's head into a scalloped fluffy cloud
      // above the characters, keeping both Mochi & Yume visible in the bedroom below.
      const dreamProgress = clamp(env.dreamEnter);
      const thoughtOriginX = frame.a.x + 28;
      const thoughtOriginY = frame.a.y - 230;
      const cloudTargetX = (frame.a.x + frame.b.x) / 2 - 20;
      const cloudTargetY = vb.y + vb.height * 0.31;
      const portalCenterX =
        thoughtOriginX + (cloudTargetX - thoughtOriginX) * Math.min(1, dreamProgress * 1.4);
      const portalCenterY =
        thoughtOriginY + (cloudTargetY - thoughtOriginY) * Math.min(1, dreamProgress * 1.4);

      nodes.thought!.setAttribute(
        "transform",
        `translate(${thoughtOriginX} ${thoughtOriginY}) scale(${0.65 + dreamProgress * 0.45})`,
      );
      setOpacity("thought", env.thought);

      const dreamCloudOpacity = clamp((dreamProgress - 0.12) / 0.35);
      const cloudScale = 0.42 + dreamProgress * 0.68;
      nodes.dreamScene!.setAttribute(
        "transform",
        `translate(${portalCenterX} ${portalCenterY}) scale(${cloudScale})`,
      );
      setOpacity("dreamScene", dreamCloudOpacity);

      // Dream characters sharing an unmistakable affectionate kiss
      const dream = targetFor("kiss");
      dream.a.x = -50;
      dream.a.y = 95;
      dream.a.scale = 0.92;
      dream.a.rotation = 5;
      dream.a.head = 9;
      dream.a.leftX = -52;
      dream.a.leftY = -20;
      dream.a.rightX = 60;
      dream.a.rightY = -48;
      dream.a.closed = 0.88;
      dream.a.smile = 0.95;

      dream.b.x = 50;
      dream.b.y = 95;
      dream.b.scale = 0.92;
      dream.b.rotation = -5;
      dream.b.head = -9;
      dream.b.leftX = -60;
      dream.b.leftY = -48;
      dream.b.rightX = 52;
      dream.b.rightY = -20;
      dream.b.closed = 0.88;
      dream.b.smile = 0.95;

      paintDreamA(dream.a, time, reduced, 0.9);
      paintDreamB(dream.b, time, reduced, 0.9);

      // Update Lyric Caption Tone from Authoritative Weather State
      lyrics.current?.setTone(auth.captionTone);
      lyrics.current?.setVisible(captionsVisibleRef.current);

      // Draw camera-locked Canvas weather & particles
      particles.draw(frame, time, reduced, vb, auth);

      // Compute normalized screen-space safe boxes for Mochi, Yume, Bed, and Window
      const toNorm = (wx: number, wy: number, ww: number, wh: number): SafeBox => ({
        x1: clamp((wx - vb.x) / vb.width, 0, 1),
        y1: clamp((wy - vb.y) / vb.height, 0, 1),
        x2: clamp((wx + ww - vb.x) / vb.width, 0, 1),
        y2: clamp((wy + wh - vb.y) / vb.height, 0, 1),
      });

      // The plushies are the subject and are protected far more strictly than
      // furniture or the window, which are allowed to sit under a caption.
      return [
        { ...toNorm(frame.a.x - 68, frame.a.y - 220, 136, 235), weight: 12 },
        { ...toNorm(frame.b.x - 68, frame.b.y - 220, 136, 235), weight: 12 },
        toNorm(1220, 650, 440, 380), // Bed
        toNorm(400, 130, 710, 460),  // Window
      ];
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect ?? element.getBoundingClientRect();
      stageSizeRef.current = {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      };
      controller.renderNow();
    });
    resizeObserver.observe(element);

    const rect = element.getBoundingClientRect();
    stageSizeRef.current = {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };

    const unsubscribe = controller.addRenderer((time) => {
      if (active && film) {
        const safeZones = paint(film.sample(time, reduced), time, false);
        lyrics.current?.paint(time, score, reduced, safeZones);
      } else {
        paint(targetFor("intro"), 0, true);
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

  useEffect(() => {
    lyrics.current?.setVisible(captionsVisible);
  }, [captionsVisible]);

  useEffect(() => {
    // Repaint opening screen immediately when live weather/time arrives
    if (!active) {
      controller.renderNow();
    }
  }, [openingContext, active, controller]);

  function onStagePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button,label,input,a,[role='dialog']")) return;

    const now = performance.now();
    orbitRef.current.pointerId = e.pointerId;
    orbitRef.current.startX = e.clientX;
    orbitRef.current.startY = e.clientY;
    orbitRef.current.startYaw = orbitRef.current.yaw;
    orbitRef.current.startPitch = orbitRef.current.pitch;
    orbitRef.current.dragging = false;
    orbitRef.current.moved = false;

    window.clearTimeout(gestureRef.current.holdTimer);
    if (active) {
      gestureRef.current.holdTimer = window.setTimeout(() => {
        if (!orbitRef.current.moved) {
          gestureRef.current.fastForward = true;
          controller.setRate(2.0);
          setFastBadge(true);
        }
      }, 220);
    }

    // Track timestamp for double-tap / double-click detection on up
    (e.currentTarget as HTMLDivElement).dataset.downTime = String(now);
  }

  function onStagePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (orbitRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - orbitRef.current.startX;
    const dy = e.clientY - orbitRef.current.startY;
    if (Math.hypot(dx, dy) > 8) {
      orbitRef.current.moved = true;
      orbitRef.current.dragging = true;
      window.clearTimeout(gestureRef.current.holdTimer);
      orbitRef.current.yaw = orbitRef.current.startYaw + dx * 0.45;
      orbitRef.current.pitch = clamp(orbitRef.current.startPitch + dy * 0.08, -12, 12);
      const deg = Math.round(((orbitRef.current.yaw % 360) + 360) % 360);
      setOrbitHud(deg);
      controller.renderNow();
    }
  }

  function onStagePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (orbitRef.current.pointerId !== e.pointerId) return;
    orbitRef.current.pointerId = -1;
    orbitRef.current.dragging = false;
    window.clearTimeout(gestureRef.current.holdTimer);

    if (gestureRef.current.fastForward) {
      gestureRef.current.fastForward = false;
      controller.setRate(playbackRateRef.current);
      setFastBadge(false);
      return;
    }

    if (orbitRef.current.moved) {
      setOrbitHud(null);
      return;
    }

    if (!active) return;

    // Quick tap/click: check for double-tap / double-click left or right half (-5s / +5s)
    const rect = e.currentTarget.getBoundingClientRect();
    const side: "left" | "right" = e.clientX < rect.left + rect.width / 2 ? "left" : "right";
    const now = performance.now();
    const g = gestureRef.current;

    if (
      g.lastTapSide === side &&
      now - g.lastTapTime < 340 &&
      Math.hypot(e.clientX - g.lastTapX, e.clientY - g.lastTapY) < 56
    ) {
      const delta = side === "left" ? -5 : 5;
      const cur = controller.getSnapshot().time;
      controller.seek(cur + delta);
      setSeekBadge({ side, label: side === "left" ? "-5s" : "+5s", key: now });
      window.setTimeout(() => {
        setSeekBadge((prev) => (prev?.key === now ? null : prev));
      }, 650);
      g.lastTapTime = 0;
      g.lastTapSide = "";
    } else {
      g.lastTapTime = now;
      g.lastTapSide = side;
      g.lastTapX = e.clientX;
      g.lastTapY = e.clientY;
    }
  }

  return (
    <div
      className="cinematic-stage"
      ref={root}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerUp}
      onPointerCancel={onStagePointerUp}
    >
      <div className="sky-base" aria-hidden="true" />

      <div className="film-surface" aria-hidden="true">
        {/* ── BACK LAYER: EXTERIOR SKY + WALLPAPER + PERSPECTIVE FLOOR ───── */}
        <svg
          ref={svgBack}
          className="art art-back"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
              <stop data-node="skyTopStop" offset="0%" stopColor="#14162c" />
              <stop data-node="skyMidStop" offset="52%" stopColor="#2a2344" />
              <stop data-node="skyBottomStop" offset="100%" stopColor="#5b4466" />
            </linearGradient>

            <radialGradient id="moon-halo">
              <stop stopColor="#f8e5b6" stopOpacity="0.34" />
              <stop offset="1" stopColor="#f8e5b6" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="sun-halo">
              <stop stopColor="#ffe7b5" stopOpacity="0.65" />
              <stop offset="1" stopColor="#ffe7b5" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="contact-shadow">
              <stop offset="0%" stopColor="#0b0914" stopOpacity="0.62" />
              <stop offset="46%" stopColor="#0b0914" stopOpacity="0.34" />
              <stop offset="78%" stopColor="#0b0914" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#0b0914" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="lamp-radial">
              <stop stopColor="#ffd788" stopOpacity="0.45" />
              <stop offset="0.55" stopColor="#f5b868" stopOpacity="0.16" />
              <stop offset="1" stopColor="#f5b868" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="photo-spot">
              <stop stopColor="#ffe7b2" stopOpacity="0.35" />
              <stop offset="1" stopColor="#ffe7b2" stopOpacity="0" />
            </radialGradient>

            <pattern id="wallpaper" width="84" height="84" patternUnits="userSpaceOnUse">
              <path d="M42 0v84" stroke="#9e82a6" strokeWidth="1" opacity="0.11" />
              <path d="M39 40l3-4 3 4-3 4Z" fill="#d3b8cb" opacity="0.08" />
            </pattern>

            <linearGradient id="wood-floor" gradientUnits="userSpaceOnUse" x1="0" y1="838" x2="0" y2="1838">
              <stop offset="0%" stopColor="#2f2433" />
              <stop offset="100%" stopColor="#1e1724" />
            </linearGradient>

            {/* 3 Persistent Window Bay Cutouts exposing exterior sky & Canvas weather */}
            <mask
              id="room-cutout"
              maskUnits="userSpaceOnUse"
              x="-2000"
              y="-2600"
              width="6000"
              height="6000"
            >
              <rect x="-2000" y="-2600" width="6000" height="6000" fill="white" />
              <rect x="420" y="148" width="210" height="414" rx="24" fill="black" />
              <rect x="650" y="148" width="210" height="414" rx="24" fill="black" />
              <rect x="880" y="148" width="210" height="414" rx="24" fill="black" />
            </mask>
          </defs>

          {/* Continuous Exterior Sky behind Window Panes */}
          <rect x="-1200" y="-600" width="4600" height="2200" fill="url(#sky-grad)" />

          {/* Moon (mutually exclusive with Sun) */}
          <g data-node="moon">
            <circle cx="805" cy="245" r="145" fill="url(#moon-halo)" />
            <path
              d="M824 190 C776 196 768 250 806 276 C770 272 748 240 760 214 C774 186 804 180 824 190 Z"
              fill="#f5e3bf"
            />
          </g>

          {/* Sun & Angled Sunbeams (mutually exclusive with Moon) */}
          <g data-node="sun" opacity="0">
            <circle cx="535" cy="265" r="240" fill="url(#sun-halo)" />
            <circle cx="535" cy="265" r="46" fill="#fae0ad" />
            <path
              d="M500 315 L395 570 M535 320 V590 M570 314 L675 570"
              stroke="#ffe7b8"
              strokeWidth="20"
              opacity="0.14"
            />
          </g>

          {/* Coherent Exterior Clouds (visible ONLY when cloudy/rainy) */}
          <g data-node="cloudA" fill="#b8a8ca" opacity="0">
            <path d="M450 285c-24-1-28-24-7-31c-4-24 26-36 41-17c20-27 52-11 50 13c32-1 36 33 9 35Z" />
          </g>
          <g data-node="cloudB" fill="#cbb9d6" opacity="0">
            <path d="M720 330c-24 0-27-24-6-30c-2-25 28-34 42-15c19-25 51-9 49 11c29 0 33 34 8 34Z" />
          </g>
          <g data-node="cloudC" fill="#b4a3c7" opacity="0">
            <path d="M935 270c-22-1-25-22-6-28c-4-22 24-33 37-16c18-24 47-10 45 12c29-1 33 30 8 32Z" />
          </g>

          {/* Exterior Rolling Hills & Distant Trees visible through Window */}
          <path
            d="M360 520 Q490 455 620 500 Q760 445 900 498 Q1030 458 1160 515 V620 H360 Z"
            fill="#473a58"
            opacity="0.65"
          />
          <path
            d="M360 550 Q510 495 660 538 Q810 490 960 535 Q1070 500 1160 545 V620 H360 Z"
            fill="#2d263e"
          />

          {/* Bedroom Back Wall + Wainscoting + Perspective Wooden Floor */}
          <g data-node="room3d" opacity="0" />
          <g data-node="room">
            <g mask="url(#room-cutout)">
              <rect x="-1200" y="-2400" width="4600" height="3235" fill="#362c45" />
              <rect x="-1200" y="-2400" width="4600" height="3235" fill="url(#wallpaper)" />
              {/* Architectural wainscot molding */}
              <path d="M-1200 660 H3400" stroke="#644e69" strokeWidth="4" opacity="0.55" />
              <rect x="-1200" y="662" width="4600" height="162" fill="#2d243b" opacity="0.55" />
            </g>

            {/* Baseboard trim separating Wall & Floor */}
            <rect x="-1200" y="820" width="4600" height="18" fill="#4b384e" />
            <path d="M-1200 820 H3400" stroke="#8f6e86" strokeWidth="2" opacity="0.4" />

            {/* Perspective Wooden Floor */}
            <rect x="-1200" y="838" width="4600" height="2400" fill="url(#wood-floor)" />
            {/* Perspective wooden plank seams converging toward room vanishing point */}
            {[-400, -150, 100, 320, 520, 720, 920, 1120, 1340, 1580, 1840, 2100].map(
              (fx) => (
                <line
                  key={fx}
                  x1={fx}
                  y1="838"
                  x2={fx + (fx - 840) * 0.48}
                  y2="1320"
                  stroke="#18121f"
                  strokeWidth="1.6"
                  opacity="0.45"
                />
              ),
            )}
            <path d="M-1200 905 H3400 M-1200 985 H3400 M-1200 1085 H3400" stroke="#18121f" strokeWidth="1.2" opacity="0.32" />

            {/* Woven Oval Bedroom Area Rug */}
            <ellipse
              cx="835"
              cy="932"
              rx="360"
              ry="58"
              fill="#4b3854"
              stroke="#795c7c"
              strokeWidth="3"
              opacity="0.88"
            />
            <ellipse
              cx="835"
              cy="932"
              rx="325"
              ry="46"
              fill="none"
              stroke="#a8889e"
              strokeWidth="1.5"
              strokeDasharray="6 7"
              opacity="0.45"
            />

            {/* Bedside Nightstand, Glowing Warm Lamp, Books & Plant (Left Cozy Zone) */}
            <g transform="translate(80 610)">
              {/* Nightstand floor shadow */}
              <ellipse cx="95" cy="285" rx="85" ry="12" fill="#0d0a16" opacity="0.45" />
              {/* Wooden Nightstand body */}
              <rect x="20" y="70" width="150" height="185" rx="6" fill="#462b1c" stroke="#2d1a0f" strokeWidth="2" />
              <rect x="32" y="88" width="126" height="62" rx="4" fill="#593825" stroke="#2d1a0f" strokeWidth="1.4" />
              <rect x="32" y="162" width="126" height="72" rx="4" fill="#593825" stroke="#2d1a0f" strokeWidth="1.4" />
              <circle cx="95" cy="119" r="5" fill="#d9b26f" />
              <circle cx="95" cy="198" r="5" fill="#d9b26f" />
              {/* Legs */}
              <rect x="28" y="255" width="14" height="28" fill="#351f13" />
              <rect x="148" y="255" width="14" height="28" fill="#351f13" />
              {/* Warm Bedside Lamp */}
              <g data-node="lampGlow">
                <circle cx="72" cy="-22" r="245" fill="url(#lamp-radial)" />
              </g>
              <rect x="58" y="24" width="28" height="46" rx="6" fill="#c79e8d" />
              <path d="M36 26 L52 -24 H92 L108 26 Z" fill="#f2d6ab" stroke="#a67c5c" strokeWidth="1.6" />
              {/* Stacked Books & Mug */}
              <rect x="115" y="54" width="46" height="16" rx="2" fill="#7d5c78" />
              <rect x="118" y="40" width="42" height="14" rx="2" fill="#a87d76" />
              <rect x="130" y="22" width="16" height="18" rx="3" fill="#ebd9cc" />
            </g>

            {/* Lived-in Floor Cushion & Handwritten Book near Left Window */}
            <g transform="translate(275 885)">
              <ellipse cx="0" cy="24" rx="48" ry="12" fill="#110e1d" opacity="0.36" />
              <ellipse cx="0" cy="14" rx="46" ry="16" fill="#6b4f70" stroke="#98769b" strokeWidth="1.5" />
              <path d="M-24 12 Q0 4 24 12" fill="none" stroke="#b697b9" strokeWidth="1.4" opacity="0.5" />
              <rect x="-16" y="26" width="38" height="14" rx="2" transform="rotate(-8)" fill="#ede0cf" stroke="#9d8585" strokeWidth="1.2" />
            </g>

            {/* Framed Teddy Romantic Memory Gallery Wall (Above Diagonal Bed) */}
            <g transform="translate(1365 385)">
              <circle data-node="photoGlow" cx="145" cy="55" r="165" fill="url(#photo-spot)" opacity="0" />
              {/* Frame 1: Smiling Cheek-to-Cheek Polaroid */}
              <g transform="translate(0 12) rotate(-3)">
                <rect width="78" height="86" rx="5" fill="#f3e6da" stroke="#704a36" strokeWidth="4" />
                <rect x="8" y="8" width="62" height="58" fill="#463458" />
                <circle cx="28" cy="36" r="11" fill="#e2be90" />
                <circle cx="50" cy="37" r="11" fill="#dcbcd8" />
                <circle cx="23" cy="25" r="4" fill="#e2be90" />
                <circle cx="55" cy="26" r="4" fill="#dcbcd8" />
              </g>
              {/* Frame 2: Oval Brass Kiss Memory */}
              <g transform="translate(106 4)">
                <ellipse cx="38" cy="44" rx="34" ry="42" fill="#523b5e" stroke="#caa25c" strokeWidth="4" />
                <circle cx="28" cy="42" r="10" fill="#e2be90" />
                <circle cx="48" cy="42" r="10" fill="#dcbcd8" />
                <path d="M36 24 q-4-6-7-1 q-1 4 7 9 q8-5 7-9 q-3-5-7 1" fill="#e59cb4" />
              </g>
              {/* Frame 3: Starlight Hug */}
              <g transform="translate(206 16) rotate(3)">
                <rect width="74" height="68" rx="4" fill="#f1e4d6" stroke="#5d3b28" strokeWidth="4" />
                <rect x="7" y="7" width="60" height="54" fill="#2c2444" />
                <ellipse cx="30" cy="38" rx="11" ry="14" fill="#e2be90" />
                <ellipse cx="44" cy="38" rx="11" ry="14" fill="#dcbcd8" />
              </g>
            </g>

            {/* Right Cozy Bookshelf & Potted Plant (Beyond Bed) */}
            <g transform="translate(1680 480)">
              <rect x="0" y="0" width="145" height="360" rx="6" fill="#3f2618" stroke="#28160d" strokeWidth="2" />
              <rect x="12" y="18" width="121" height="82" fill="#2b1910" />
              <rect x="12" y="116" width="121" height="86" fill="#2b1910" />
              <rect x="12" y="218" width="121" height="96" fill="#2b1910" />
              {/* Books */}
              <rect x="20" y="38" width="14" height="60" fill="#8d667e" />
              <rect x="36" y="44" width="16" height="54" fill="#b48a78" />
              <rect x="54" y="34" width="15" height="64" fill="#6f8798" />
              <rect x="80" y="142" width="16" height="58" fill="#a87686" />
              <rect x="98" y="135" width="14" height="65" fill="#7c638c" />
            </g>
          </g>

          {/* Subtle Cold Atmosphere Tint */}
          <rect data-node="cold" x="-1200" y="-2400" width="4600" height="4000" fill="#7e9ad4" opacity="0" />
        </svg>

        {/* ── CANVAS LAYER: STRICTLY CLIPPED EXTERIOR WEATHER + PARTICLES ─── */}
        <canvas ref={canvas} className="weather" />

        {/* ── FRONT LAYER: WINDOW FRAME, MIRROR, 3D BED, TEDDIES & PROPS ──── */}
        <svg
          ref={svgFront}
          className="art art-front"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="quilt-color" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#b896b0" />
              <stop offset="1" stopColor="#816180" />
            </linearGradient>
            <linearGradient id="wood-headboard" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#653d24" />
              <stop offset="1" stopColor="#412414" />
            </linearGradient>
            <linearGradient id="mattress-top" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#f3eae0" />
              <stop offset="1" stopColor="#dfd0c4" />
            </linearGradient>
            <linearGradient id="mirror-glass-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2c2642" />
              <stop offset="50%" stopColor="#3c3458" />
              <stop offset="100%" stopColor="#262038" />
            </linearGradient>
            {/*
              ONE quilt outline, authored once. Both the back and front layers
              reference this same path, which is what guarantees the fabric is a
              single continuous textile rather than two overlapping blankets.
            */}
            <clipPath id="quilt-clip">
              <path d="M1216 812 Q1300 790 1372 796 Q1448 802 1520 792 Q1584 784 1630 806 Q1656 830 1650 866 Q1642 916 1600 954 Q1546 1000 1476 1022 Q1402 1042 1330 1018 Q1268 996 1244 946 Q1222 896 1236 852 Q1244 826 1216 812 Z" />
            </clipPath>
            {/* Only the part of that one quilt below the pair's chests is drawn
                in front of them. */}
            <clipPath id="quilt-front-clip">
              <path d="M1170 858 Q1360 830 1476 840 Q1580 850 1670 832 L1670 1080 L1170 1080 Z" />
            </clipPath>
            <radialGradient id="lantern-glow">
              <stop stopColor="#ffe1a1" stopOpacity="0.45" />
              <stop offset="1" stopColor="#ffe1a1" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="dream-sky-grad" cx="0.5" cy="0.32" r="0.68">
              <stop offset="0%" stopColor="#fde1c8" stopOpacity="0.65" />
              <stop offset="48%" stopColor="#8d658c" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#2e2144" stopOpacity="1" />
            </radialGradient>

            {/* Functional Mirror Glass Clip Boundary */}
            <clipPath id="mirror-glass-clip">
              <path d="M1152 806 V592 A53 53 0 0 1 1258 592 V806 Z" />
            </clipPath>

            {/* Scalloped Fluffy Thought-Cloud Portal Clip Boundary (Cues 28-29) */}
            <clipPath id="dream-cloud-clip">
              <path d="M-190 35 C-238 32 -255 -28 -205 -56 C-212 -112 -148 -148 -98 -122 C-72 -172 18 -178 52 -128 C108 -154 176 -116 174 -58 C228 -36 226 36 172 48 C156 96 86 110 42 84 C0 116 -78 112 -106 76 C-152 94 -198 68 -190 35 Z" />
            </clipPath>
          </defs>

          {/* ── PERSISTENT TRIPLE-BAY BEDROOM WINDOW (NEVER DISAPPEARS) ───── */}
          <g data-node="window">
            {/* Outer architectural wood frame */}
            <rect
              x="402"
              y="130"
              width="706"
              height="452"
              rx="32"
              fill="none"
              stroke="#684a54"
              strokeWidth="22"
            />
            {/* Inner recessed window casing depth */}
            {[420, 650, 880].map((px) => (
              <g key={px}>
                <rect
                  x={px}
                  y="148"
                  width="210"
                  height="414"
                  rx="24"
                  fill="none"
                  stroke="#9c7a86"
                  strokeWidth="5"
                />
                {/* Windowpane cross mullions */}
                <path
                  d={`M${px + 105} 150 V560 M${px + 4} 352 H${px + 206}`}
                  stroke="#8b6c7a"
                  strokeWidth="5"
                />
                {/* Subtle diagonal glass reflection streaks */}
                <path
                  d={`M${px + 28} 205 L${px + 85} 165 M${px + 34} 230 L${px + 110} 175 M${px + 115} 530 L${px + 188} 470`}
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.1"
                />
              </g>
            ))}

            {/* Projecting wooden window sill ledge + shadow */}
            <path d="M385 596 H1125" stroke="#181224" strokeWidth="10" opacity="0.35" />
            <rect x="380" y="576" width="750" height="22" rx="6" fill="#7c5648" stroke="#4a3028" strokeWidth="2" />
            {/* Small potted windowsill succulent & keepsake */}
            <g transform="translate(465 552)">
              <path d="M-12 0 H12 L9 24 H-9 Z" fill="#b47b6c" />
              <ellipse cx="-6" cy="-5" rx="7" ry="10" transform="rotate(-20 -6 -5)" fill="#799476" />
              <ellipse cx="6" cy="-5" rx="7" ry="10" transform="rotate(20 6 -5)" fill="#799476" />
              <ellipse cx="0" cy="-8" rx="6" ry="11" fill="#8da888" />
            </g>

            {/* Curtain rod & finial rings */}
            <line x1="365" y1="108" x2="1145" y2="108" stroke="#61423c" strokeWidth="8" strokeLinecap="round" />
            <circle cx="362" cy="108" r="9" fill="#9c7260" />
            <circle cx="1148" cy="108" r="9" fill="#9c7260" />

            {/* Soft weighted curtains with natural fabric folds */}
            <g data-node="curtainA">
              <path
                d="M382 114 Q362 325 384 576 H445 Q424 340 434 114 Z"
                fill="#7b5b76"
                stroke="#583f56"
                strokeWidth="2"
              />
              <path d="M398 120 Q384 330 400 572 M416 120 Q406 335 422 572" stroke="#9e7d98" strokeWidth="2.2" fill="none" opacity="0.45" />
            </g>
            <g data-node="curtainB">
              <path
                d="M622 114 Q608 320 622 576 H658 Q668 320 656 114 Z"
                fill="#73546f"
                stroke="#583f56"
                strokeWidth="1.8"
                opacity="0.9"
              />
            </g>
            <g data-node="curtainC">
              <path
                d="M1066 114 Q1086 325 1064 576 H1126 Q1142 340 1120 114 Z"
                fill="#7b5b76"
                stroke="#583f56"
                strokeWidth="2"
              />
              <path d="M1086 120 Q1098 335 1084 572 M1105 120 Q1116 330 1102 572" stroke="#9e7d98" strokeWidth="2.2" fill="none" opacity="0.45" />
            </g>

            {/* Warm fairy lights strung gently across window top arch */}
            <path
              d="M415 152 Q525 186 640 152 Q755 186 870 152 Q985 186 1095 152"
              fill="none"
              stroke="#9e828c"
              strokeWidth="1.6"
            />
            {[450, 525, 600, 680, 755, 830, 910, 985, 1060].map((fx, i) => (
              <g key={fx}>
                <circle cx={fx} cy={i % 2 ? 168 : 162} r="3.5" fill="#f7dba8" />
                <circle cx={fx} cy={i % 2 ? 168 : 162} r="9" fill="#ffe1a6" opacity="0.14" />
              </g>
            ))}
          </g>

          {/* ── FUNCTIONAL DRESSING TABLE & REAL-TIME MIRROR (BESIDE BED) ── */}
          <g data-node="mirrorGroup">
            {/* Vanity floor shadow */}
            <ellipse cx="1205" cy="912" rx="82" ry="12" fill="#0d0a16" opacity="0.4" />
            {/* Mirror carved wooden bezel */}
            <path
              d="M1142 812 V590 A63 63 0 0 1 1268 590 V812 Z"
              fill="#563421"
              stroke="#2e1a0f"
              strokeWidth="3"
            />
            {/* Mirror Glass Backing */}
            <path
              d="M1152 806 V592 A53 53 0 0 1 1258 592 V806 Z"
              fill="url(#mirror-glass-grad)"
            />

            {/* REAL-TIME MIRRORED CHARACTER REFLECTIONS (clipped inside mirror glass!) */}
            <g clipPath="url(#mirror-glass-clip)">
              <g data-node="mirrorWrapA">
                <BearRig id="mirror-a" variant="a" />
              </g>
              <g data-node="mirrorWrapB">
                <BearRig id="mirror-b" variant="b" />
              </g>
              {/* Diagonal glass sheen & inner rim reflection over reflected teddies */}
              <path
                d="M1146 650 L1225 545 M1146 685 L1255 552"
                stroke="#ffffff"
                strokeWidth="10"
                opacity="0.09"
              />
              <path
                d="M1152 806 V592 A53 53 0 0 1 1258 592 V806"
                fill="none"
                stroke="#e8d8f0"
                strokeWidth="3"
                opacity="0.24"
              />
            </g>

            {/* Dressing Table Console (occludes everything below y = 808) */}
            <rect x="1128" y="808" width="154" height="58" rx="5" fill="#4f2f1d" stroke="#2d190e" strokeWidth="2" />
            <rect x="1138" y="818" width="62" height="36" rx="3" fill="#633e28" stroke="#2d190e" strokeWidth="1.2" />
            <rect x="1210" y="818" width="62" height="36" rx="3" fill="#633e28" stroke="#2d190e" strokeWidth="1.2" />
            <circle cx="1169" cy="836" r="3.5" fill="#dfb86f" />
            <circle cx="1241" cy="836" r="3.5" fill="#dfb86f" />
            {/* Vanity Legs */}
            <rect x="1138" y="866" width="12" height="44" fill="#3a2114" />
            <rect x="1260" y="866" width="12" height="44" fill="#3a2114" />
            {/* Small perfume bottle & candle on vanity top */}
            <rect x="1148" y="786" width="16" height="22" rx="4" fill="#dcb8d4" stroke="#997396" strokeWidth="1.2" />
            <circle cx="1156" cy="782" r="4" fill="#e5c782" />
            <rect x="1242" y="790" width="14" height="18" rx="2" fill="#f3e2ce" />
            <ellipse cx="1249" cy="785" rx="2.5" ry="4.5" fill="#ffd98a" />
          </g>

          {/* ── DIAGONAL 3D-PERSPECTIVE WOODEN BED (BESIDE WINDOW & MIRROR) ─ */}
          <g data-node="bed">
            {/* Deep floor contact shadow under diagonal bed */}
            <polygon
              points="1235,965 1545,1005 1665,865 1370,835"
              fill="#0c0916"
              opacity="0.5"
            />

            {/* Back Headposts & Carved Walnut Headboard along back wall */}
            <rect x="1362" y="655" width="22" height="190" rx="6" fill="#52301b" stroke="#2d180d" strokeWidth="2" />
            <ellipse cx="1373" cy="655" rx="14" ry="8" fill="#76492d" stroke="#2d180d" strokeWidth="1.5" />
            <rect x="1635" y="680" width="22" height="195" rx="6" fill="#52301b" stroke="#2d180d" strokeWidth="2" />
            <ellipse cx="1646" cy="680" rx="14" ry="8" fill="#76492d" stroke="#2d180d" strokeWidth="1.5" />

            <path
              d="M1373 668 Q1510 645 1646 692 V825 Q1510 812 1373 796 Z"
              fill="url(#wood-headboard)"
              stroke="#2d180d"
              strokeWidth="2.2"
            />
            <path
              d="M1373 668 Q1510 648 1646 692"
              fill="none"
              stroke="#7e5134"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M1402 706 Q1510 692 1618 724"
              fill="none"
              stroke="#70442a"
              strokeWidth="2.5"
              opacity="0.7"
            />

            {/* Diagonal Wooden Side Rail & Front Frame drawn UNDERNEATH Mattress */}
            <polygon
              points="1368,828 1244,954 1244,974 1368,848"
              fill="#4d2c19"
              stroke="#2a150b"
              strokeWidth="1.8"
            />
            <polygon
              points="1244,954 1532,992 1532,1012 1244,974"
              fill="#5d3620"
              stroke="#2a150b"
              strokeWidth="1.8"
            />

            {/* Thick 3D Perspective Mattress + Side Thickness + Piping */}
            {/* Mattress diagonal LEFT side thickness face */}
            <polygon
              points="1368,782 1244,908 1244,954 1368,828"
              fill="#ccb8ae"
              stroke="#9e8780"
              strokeWidth="1.6"
            />
            {/* Mattress FRONT thickness face */}
            <polygon
              points="1244,908 1532,946 1532,992 1244,954"
              fill="#ded0c6"
              stroke="#9e8780"
              strokeWidth="1.6"
            />
            {/* Top mattress sleeping surface (angled diagonally forward!) */}
            <polygon
              points="1368,782 1640,814 1532,946 1244,908"
              fill="url(#mattress-top)"
              stroke="#b8a19a"
              strokeWidth="2"
            />
            {/* Mattress quilted surface stitching & piping */}
            <path
              d="M1368 782 L1244 908 L1532 946 L1640 814"
              fill="none"
              stroke="#cbb4ac"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <path
              d="M1430 792 L1320 916 M1505 800 L1400 926 M1575 808 L1470 936 M1308 844 L1588 878"
              stroke="#c4aea7"
              strokeWidth="1.2"
              strokeDasharray="4 7"
              opacity="0.65"
            />

            {/* Plump Cushioned Pillows */}
            <path
              d="M1382 778 Q1432 762 1485 776 L1462 812 Q1410 812 1366 798 Z"
              fill="#f8f0ec"
              stroke="#c6b0ac"
              strokeWidth="1.5"
            />
            <path
              d="M1496 786 Q1554 776 1608 796 L1582 830 Q1525 826 1476 812 Z"
              fill="#efe3eb"
              stroke="#bfa9b8"
              strokeWidth="1.5"
            />

            {/* Front-left footpost */}
            <rect x="1226" y="886" width="22" height="114" rx="6" fill="#5e3821" stroke="#2d180d" strokeWidth="2" />
            <ellipse cx="1237" cy="886" rx="14" ry="8" fill="#815233" stroke="#2d180d" strokeWidth="1.5" />
            {/* Front-right footpost */}
            <rect x="1524" y="922" width="22" height="116" rx="6" fill="#5e3821" stroke="#2d180d" strokeWidth="2" />
            <ellipse cx="1535" cy="922" rx="14" ry="8" fill="#815233" stroke="#2d180d" strokeWidth="1.5" />
          </g>

          {/* ── WOODEN FOOTSTOOLS FOR WINDOW-GAZING (CUE 42) ──────────────── */}
          {(["stoolA", "stoolB"] as const).map((stoolId) => (
            <g key={stoolId} data-node={stoolId} opacity="0">
              <ellipse cx="0" cy="48" rx="46" ry="8" fill="#0d0a16" opacity="0.4" />
              <path d="M-32 8 L-40 48 H-28 L-22 8 Z" fill="#4f2f1d" stroke="#2a160c" strokeWidth="1.5" />
              <path d="M32 8 L40 48 H28 L22 8 Z" fill="#4f2f1d" stroke="#2a160c" strokeWidth="1.5" />
              <rect x="-44" y="-6" width="88" height="16" rx="5" fill="#73482e" stroke="#361f12" strokeWidth="1.8" />
              <path d="M-36 -2 H36" stroke="#996444" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
            </g>
          ))}

          {/* ── CHARACTER CONTACT SHADOWS ───────────────────────────────────── */}
          {/* Soft contact shadows: a radial falloff rather than a hard ellipse,
              so the plushies sit in the room instead of floating above it. */}
          <ellipse data-node="shadowA" rx="78" ry="19" fill="url(#contact-shadow)" opacity="0.9" />
          <ellipse data-node="shadowB" rx="78" ry="19" fill="url(#contact-shadow)" opacity="0.9" />

          {/* ── MOCHI (TEDDY A) & YUME (TEDDY B) ──────────────────────────── */}
          <g data-node="stageBears">
            <BearRig id="a" variant="a" />
            <BearRig id="b" variant="b" />
          </g>

          {/* ── THE FRONT OF THE ONE QUILT ─────────────────────────────────────
              The same path as `quilt-back`, drawn after the plushies and clipped
              to the region below their chests. Sharing geometry is what makes
              them *inside* one blanket; a separately authored runner is exactly
              what used to read as a second, floating cloth.
          ─────────────────────────────────────────────────────────────────── */}
          <g data-node="quilt" opacity="0">
            <g clipPath="url(#quilt-front-clip)">
              <path
                d="M1216 812 Q1300 790 1372 796 Q1448 802 1520 792 Q1584 784 1630 806 Q1656 830 1650 866 Q1642 916 1600 954 Q1546 1000 1476 1022 Q1402 1042 1330 1018 Q1268 996 1244 946 Q1222 896 1236 852 Q1244 826 1216 812 Z"
                fill="url(#quilt-color)"
                stroke="#5d4559"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <g clipPath="url(#quilt-clip)" opacity="0.4">
                <g stroke="#dcbfd0" strokeWidth="1.5" strokeDasharray="6 8" fill="none">
                  <path d="M1160 700 L1440 1060" />
                  <path d="M1226 690 L1506 1050" />
                  <path d="M1292 682 L1572 1042" />
                  <path d="M1358 676 L1638 1036" />
                  <path d="M1424 674 L1704 1034" />
                  <path d="M1160 1040 L1440 690" />
                  <path d="M1226 1060 L1506 710" />
                  <path d="M1292 1070 L1572 720" />
                  <path d="M1358 1080 L1638 730" />
                  <path d="M1424 1080 L1704 730" />
                </g>
              </g>
            </g>

            {/* The rolled fold across their bodies: this is the edge the paws
                rest on, so it has to read as soft fabric, not a drawn line. */}
            <path
              d="M1226 876 Q1310 854 1386 862 Q1466 870 1540 858 Q1596 850 1640 870"
              fill="none" stroke="#e6cfdb" strokeWidth="12" strokeLinecap="round" opacity="0.88"
            />
            <path
              d="M1226 876 Q1310 854 1386 862 Q1466 870 1540 858 Q1596 850 1640 870"
              fill="none" stroke="#a98a9f" strokeWidth="2.1" strokeLinecap="round" opacity="0.4"
            />
          </g>

          {/* ── THE WINTER RAZAI: ONE SHARED BLANKET ────────────────────────
              This is a single piece of bedding, not two.

              An earlier version drew a heap behind the pair *and* a separate
              runner across their laps, and the two shapes never quite met — so
              the pair appeared to be wearing two overlapping razais. There is
              now exactly one outline, authored once and reused three times:

                • `quilt-body`  — the whole textile, drawn behind the plushies
                • `quilt-front` — the same outline, clipped to the region below
                                  the pair's chests, drawn in front of them

              Because both layers share one path, the fabric is continuous
              through and around the bodies: there is no seam to read as a
              second blanket, and the paws contact the same cloth the bodies
              are under.
          ─────────────────────────────────────────────────────────────────── */}
          <g data-node="quilt-back" opacity="0">
            <path
              d="M1216 812 Q1300 790 1372 796 Q1448 802 1520 792 Q1584 784 1630 806 Q1656 830 1650 866 Q1642 916 1600 954 Q1546 1000 1476 1022 Q1402 1042 1330 1018 Q1268 996 1244 946 Q1222 896 1236 852 Q1244 826 1216 812 Z"
              fill="url(#quilt-color)"
              stroke="#5d4559"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />

            {/* Padded volume: long soft crests catching light along the upper
                fold, which is what stops the mass reading as a flat shape. */}
            <path
              d="M1248 824 Q1322 802 1400 806 Q1490 810 1564 800 Q1608 794 1638 812"
              fill="none" stroke="#c8a7bd" strokeWidth="5" strokeLinecap="round" opacity="0.5"
            />
            <path
              d="M1236 868 Q1292 848 1360 854"
              fill="none" stroke="#b392ab" strokeWidth="3.4" strokeLinecap="round" opacity="0.4"
            />

            {/* Diamond quilting over the whole textile. */}
            <g clipPath="url(#quilt-clip)" opacity="0.45">
              <g stroke="#dcbfd0" strokeWidth="1.5" strokeDasharray="6 8" fill="none">
                <path d="M1160 700 L1440 1060" />
                <path d="M1226 690 L1506 1050" />
                <path d="M1292 682 L1572 1042" />
                <path d="M1358 676 L1638 1036" />
                <path d="M1424 674 L1704 1034" />
                <path d="M1160 1040 L1440 690" />
                <path d="M1226 1060 L1506 710" />
                <path d="M1292 1070 L1572 720" />
                <path d="M1358 1080 L1638 730" />
                <path d="M1424 1080 L1704 730" />
              </g>
            </g>

            {/* Embroidery, low on the drape where a real quilt would carry it. */}
            <path
              d="M1452 952 q-13-17-21-4 q-3 9 21 23 q24-14 21-23 q-8-13-21 4"
              fill="#d8b3c8" opacity="0.55"
            />
          </g>

          {/* Thought Cloud Trail Bubbles rising from Mochi's head (Cues 28–29) */}
          <g data-node="thought" opacity="0">
            <circle cx="-12" cy="4" r="6" fill="#f2e6f5" stroke="#caaede" strokeWidth="1.6" opacity="0.92" />
            <circle cx="8" cy="-26" r="10" fill="#f2e6f5" stroke="#caaede" strokeWidth="1.8" opacity="0.94" />
            <circle cx="24" cy="-64" r="15" fill="#f2e6f5" stroke="#caaede" strokeWidth="2" opacity="0.96" />
          </g>

          {/* Scalloped Fluffy Thought-Cloud Dream Portal (Cues 28–29) */}
          <g data-node="dreamScene" opacity="0">
            <g clipPath="url(#dream-cloud-clip)">
              <rect x="-260" y="-200" width="520" height="340" fill="url(#dream-sky-grad)" />
              {/* Soft golden bokeh orbs */}
              <circle cx="-120" cy="-65" r="28" fill="#ffe6bf" opacity="0.2" />
              <circle cx="125" cy="-50" r="34" fill="#ffd9ec" opacity="0.18" />
              <circle cx="-45" cy="-115" r="18" fill="#fff0d1" opacity="0.22" />
              <circle cx="75" cy="-105" r="22" fill="#ffe1ea" opacity="0.18" />
              <ellipse cx="0" cy="105" rx="250" ry="65" fill="#5e436a" opacity="0.62" />
              <circle cx="-90" cy="-85" r="2.8" fill="#fff7e2" opacity="0.78" />
              <circle cx="95" cy="-95" r="2.4" fill="#fff7e2" opacity="0.78" />
              <circle cx="60" cy="-45" r="2" fill="#ffe6f0" opacity="0.7" />
              <circle cx="-65" cy="-40" r="2.4" fill="#ffe6f0" opacity="0.75" />
              <BearRig id="dream-a" variant="a" />
              <BearRig id="dream-b" variant="b" />
            </g>
            {/* Fluffy scalloped outer cloud rim */}
            <path
              d="M-190 35 C-238 32 -255 -28 -205 -56 C-212 -112 -148 -148 -98 -122 C-72 -172 18 -178 52 -128 C108 -154 176 -116 174 -58 C228 -36 226 36 172 48 C156 96 86 110 42 84 C0 116 -78 112 -106 76 C-152 94 -198 68 -190 35 Z"
              fill="none"
              stroke="#f2e2f7"
              strokeWidth="6"
              opacity="0.88"
            />
          </g>
          <g data-node="gifts" opacity="0">
            <rect x="-20" y="-34" width="40" height="34" rx="5" fill="#c89dad" stroke="#7c5d72" strokeWidth="1.5" />
            <rect x="-23" y="-42" width="46" height="10" rx="3" fill="#d7b1bf" stroke="#7c5d72" strokeWidth="1.5" />
            <path d="M0 -42 V0 M-20 -18 H20" stroke="#f7e9d3" strokeWidth="4" />
            <path d="M0 -43 C-20 -58 -20 -34 0 -43 C20 -58 20 -34 0 -43" fill="none" stroke="#f7e9d3" strokeWidth="3.2" />
          </g>

          <g data-node="flowers" opacity="0">
            <path d="M0 24 L-12 -18 M0 24 L6 -24 M0 24 L18 -12" stroke="#859a7e" strokeWidth="2.8" />
            {[-12, 6, 18].map((x, idx) => (
              <g key={x} transform={`translate(${x} ${-18 + idx * 4})`}>
                <circle cx="-5" r="7" fill="#dfadc2" />
                <circle cx="5" r="7" fill="#dfadc2" />
                <circle cy="-5" r="7" fill="#dfadc2" />
                <circle cy="5" r="7" fill="#dfadc2" />
                <circle r="4" fill="#f2dba4" />
              </g>
            ))}
            <path d="M-15 8 L17 7 L7 36 H-6 Z" fill="#ebd9c3" />
          </g>

          <g data-node="ringbox" opacity="0">
            {/* Open velvet ring box + aligned gleaming ring */}
            <rect x="-15" y="-6" width="30" height="15" rx="4" fill="#4f293b" stroke="#2c1420" strokeWidth="1.4" />
            <path d="M-15 -6 L-12 -24 Q0 -28 12 -24 L15 -6 Z" fill="#6b3750" stroke="#2c1420" strokeWidth="1.4" />
            <ellipse cy="-6" rx="10" ry="3.5" fill="#f3e5ec" />
            <circle cy="-12" r="5.5" fill="none" stroke="#f7d87c" strokeWidth="2.6" />
            <polygon points="0,-20 3,-17 0,-14 -3,-17" fill="#eef9ff" />
          </g>

          <g data-node="cigarette" opacity="0">
            {/* Slender unbranded restrained cigarette */}
            <rect x="-2" y="-2" width="18" height="3.2" rx="1" fill="#f2ece4" stroke="#b8aea2" strokeWidth="0.6" />
            <rect x="-2" y="-2" width="5" height="3.2" rx="1" fill="#c9955e" />
            <circle cx="16" cy="-0.4" r="1.4" fill="#e67e55" opacity="0.85" />
          </g>

          <g data-node="letter" opacity="0">
            <rect x="-21" y="-14" width="42" height="28" rx="4" fill="#f4e6d2" stroke="#ab9498" strokeWidth="1.5" />
            <path d="M-19 -12 L0 2 L19 -12" fill="none" stroke="#ab9498" strokeWidth="1.5" />
            <circle cy="2" r="3.6" fill="#c28ca0" />
          </g>

          {/* Phone Back Casing (screen faces Yume, NEVER audience!) */}
          <g data-node="phone" opacity="0">
            <rect x="-13" y="-25" width="26" height="48" rx="5" fill="#473852" stroke="#d9bfd1" strokeWidth="1.4" />
            <rect x="-9" y="-20" width="9" height="13" rx="3" fill="#2f2438" />
            <circle cx="-4.5" cy="-16" r="2.2" fill="#8d82a3" />
            <circle cx="-4.5" cy="-10" r="2.2" fill="#8d82a3" />
          </g>

          <g data-node="lantern" opacity="0">
            <circle r="52" fill="url(#lantern-glow)" />
            <path d="M-10 -4 Q0 -14 10 -4 V18 Q0 26 -10 18 Z" fill="#efd29b" stroke="#ab8279" strokeWidth="1.4" />
            <path d="M-6 -7 v-9 q6-10 12 0 v9" fill="none" stroke="#c2a8a9" strokeWidth="1.8" />
            <path d="M0 -3 V18" stroke="#fff2cc" strokeWidth="2.8" />
          </g>

          {/* Incoming "Pull up" Notification (Cue 2 ONLY) */}
          <g data-node="message" opacity="0">
            <rect x="0" y="0" width="152" height="64" rx="18" fill="#f3e9e4" stroke="#cab4c8" strokeWidth="1.5" />
            <circle cx="22" cy="21" r="4.5" fill="#b39bbf" />
            <path d="M34 21 H72" stroke="#b9a0b5" strokeWidth="2.8" strokeLinecap="round" />
            <text x="22" y="49" fontFamily="system-ui" fontSize="18" fill="#4e3d50">
              Pull up
            </text>
          </g>

        </svg>
      </div>

      {/*
        The ending's glass. Mounted after the grade so the room is graded first
        and then sealed — the dome encloses a finished image rather than being
        something the grade washes over.
      */}
      <GlassBubble presence={0} />

      <CinematicGrade />

      <div className="vignette" aria-hidden="true" />
      <LyricsDisplay ref={lyrics} />

      {orbitHud !== null && (
        <div className="orbit-badge" role="status" aria-live="polite">
          360° {orbitHud}°
        </div>
      )}

      {fastBadge && (
        <div className="fast-badge" role="status" aria-live="polite">
          2x &gt;&gt;
        </div>
      )}

      {seekBadge && (
        <div className={`seek-ripple seek-${seekBadge.side}`} role="status" aria-live="polite">
          {seekBadge.label}
        </div>
      )}
    </div>
  );
}));
