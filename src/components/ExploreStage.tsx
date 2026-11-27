import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { BearRig } from "../characters/BearRig";
import { createBearPainter } from "../characters/BearAnimations";
import { CAMERA_PRESETS, type WorldAction } from "../world/actions";
import type { WorldEngine } from "../world/engine";
import { resolveLighting, type WorldState } from "../world/state";
import {
  buildDoor,
  buildExploreScene,
  DOOR_SWING,
  buildWindow,
  CHARACTER_ANCHORS,
  GLOBE_POSITION,
} from "../stage/explore/scene";
import {
  buildLightRig,
  collectFaces,
  createExploreCamera,
  project,
  projectWindow,
} from "../stage/explore/renderer";
import {
  projectMirror,
  reflectCharacter,
  type MirrorQuad,
} from "../stage/explore/reflection";
import {
  CHARACTER_SCALE,
  framesFor,
  shadowMarkup,
  warmthFor,
} from "../stage/explore/characterStage";
import { createWeatherPainter } from "../stage/explore/weather";

export interface ExploreHandle {
  focusObject(objectId: string): void;
}

export interface ExploreStageProps {
  engine: WorldEngine;
  reduced: boolean;
  onAnnounce(message: string): void;
  onDispatch(action: WorldAction): void;
  /**
   * Start the one authorized soundtrack, if it is not already playing.
   *
   * The dance is the only *performance* in the room, and a silent performance
   * was the whole defect: the pair swayed to nothing. This is a callback rather
   * than a second player so there is exactly one audio element, one clock and
   * one set of browser permissions involved. It resolves `true` when music is
   * actually audible, so the caller never has to assume.
   */
  onEnsureMusic?: () => Promise<boolean>;
  /** True while the soundtrack is genuinely playing. */
  musicPlaying?: boolean;
}

interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  depth: number;
  visible: boolean;
  variant: "prop" | "character";
}

const HOTSPOT_LABELS: Record<string, string> = {
  lamp: "The bedside lamp",
  window: "The window — open the curtains",
  curtains: "Open the curtains",
  globe: "The snow globe",
  gift: "The gift box",
  bed: "The bed",
  mirror: "The mirror",
  bookshelf: "The bookshelf",
};

const hotspotLabel = (id: string) => HOTSPOT_LABELS[id] ?? id;
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const BASE_WIDTH = 1440;
const BASE_HEIGHT = 900;

function useElementSize(element: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: BASE_WIDTH, height: BASE_HEIGHT });

  useEffect(() => {
    const node = element.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    });

    observer.observe(node);
    const rect = node.getBoundingClientRect();
    setSize({ width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) });

    return () => observer.disconnect();
  }, [element]);

  return size;
}

export const ExploreStage = forwardRef<ExploreHandle, ExploreStageProps>(
  function ExploreStage({ engine, reduced, onAnnounce, onDispatch, onEnsureMusic, musicPlaying }, ref) {
    const root = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const size = useElementSize(root);
    // Latest stage size for imperative paint loops, which must not close over a
    // stale render value.
    const sizeRef = useRef(size);
    sizeRef.current = size;

    const worldRef = useRef<WorldState>(engine.getState());
    const [world, setWorld] = useState<WorldState>(engine.getState());
    const [hotspotIds, setHotspotIds] = useState<string[]>([]);
    const [hovered, setHovered] = useState<string | null>(null);

    const lastHotspotKey = useRef("");
    const hotspotNodes = useRef(new Map<string, { root: HTMLButtonElement; label: HTMLElement | null }>());

    /**
     * Chrome that floats above the scene. A hotspot must never be parked
     * underneath it: the button stays in the DOM, `elementFromPoint` resolves to
     * the HUD, and the dot looks perfectly tappable while swallowing every
     * click. Positions are read live because the HUD reflows with the viewport.
     */
    const chromeRects = useCallback(() => {
      const nodes = document.querySelectorAll<HTMLElement>("[data-hud-surface]");
      const rects: Array<{ left: number; right: number; top: number; bottom: number }> = [];
      nodes.forEach((node) => {
        const box = node.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) return;
        rects.push({ left: box.left, right: box.right, top: box.top, bottom: box.bottom });
      });
      return rects;
    }, []);

    /** Nudge `top` upward until a `size`-square clears every chrome rect. */
    const clearOfChrome = useCallback(
      (
        left: number,
        top: number,
        size: number,
        rects: Array<{ left: number; right: number; top: number; bottom: number }>,
        height: number,
      ) => {
        const half = size / 2;
        let y = top;
        for (let pass = 0; pass < rects.length + 1; pass += 1) {
          const hit = rects.find(
            (r) =>
              left + half > r.left - 2 &&
              left - half < r.right + 2 &&
              y + half > r.top - 2 &&
              y - half < r.bottom + 2,
          );
          if (!hit) return y;
          // Prefer rising above the chrome; fall back to the nearest free edge.
          const above = hit.top - half - 4;
          y = above >= half ? above : Math.min(height - half, hit.bottom + half + 4);
        }
        return y;
      },
      [],
    );

    const paintHotspotNodes = useCallback((spots: Hotspot[]) => {
      const stage = root.current;
      if (!stage) return;
      // A hotspot whose centre has orbited off-canvas must not stay clickable:
      // its button would still sit at a negative (or off-screen) coordinate and
      // swallow taps meant for the room. Hide those and keep the rest live.
      const margin = 48;
      const live = new Set<string>();
      for (const spot of spots) {
        const key = `${spot.variant}:${spot.id}`;
        const entry = hotspotNodes.current.get(key);
        if (!entry) continue;
        const onScreen =
          spot.x > -margin &&
          spot.x < sizeRef.current.width + margin &&
          spot.y > -margin &&
          spot.y < sizeRef.current.height + margin;
        if (!onScreen) {
          entry.root.style.display = "none";
          entry.root.setAttribute("aria-hidden", "true");
          entry.root.tabIndex = -1;
          continue;
        }
        live.add(key);
        entry.root.style.display = "";
        entry.root.removeAttribute("aria-hidden");
        entry.root.tabIndex = 0;

        // Keep the whole tap target on screen. A dot centred near the edge used
        // to hang half outside the viewport, so on a phone its visible sliver was
        // too small to hit even though the button technically existed.
        const size = Math.max(44, spot.radius * 2);
        const half = size / 2;
        const left = Math.min(Math.max(spot.x, half), sizeRef.current.width - half);
        const top = Math.min(Math.max(spot.y, half), sizeRef.current.height - half);
        const stageBox = stage.getBoundingClientRect();
        const clearTop = clearOfChrome(
          left,
          top,
          size,
          chromeRects().map((r) => ({
            left: r.left - stageBox.left,
            right: r.right - stageBox.left,
            top: r.top - stageBox.top,
            bottom: r.bottom - stageBox.top,
          })),
          sizeRef.current.height,
        );
        entry.root.style.left = `${left}px`;
        entry.root.style.top = `${clearTop}px`;
        entry.root.style.width = `${size}px`;
        entry.root.style.height = `${size}px`;
      }
      // Anything mounted earlier but absent from this frame is off-canvas too.
      hotspotNodes.current.forEach((entry, key) => {
        if (live.has(key)) return;
        entry.root.style.display = "none";
        entry.root.setAttribute("aria-hidden", "true");
        entry.root.tabIndex = -1;
      });
    }, [chromeRects, clearOfChrome]);

    const dragRef = useRef({
      pointerId: -1,
      lastX: 0,
      lastY: 0,
      moved: 0,
      startYaw: 0,
      startPitch: 0,
      captured: false,
    });

    const scene = useMemo(() => buildExploreScene(), []);
    const weather = useMemo(() => createWeatherPainter(), []);

    useEffect(() => {
      const unsubscribe = engine.subscribe((next) => {
        worldRef.current = next;
        setWorld(next);
      });
      worldRef.current = engine.getState();
      setWorld(engine.getState());
      return unsubscribe;
    }, [engine]);

    useImperativeHandle(ref, () => ({
      focusObject(objectId: string) {
        const preset = (
          {
            window: "window",
            bed: "bed",
            mirror: "vanity",
            bookshelf: "bookshelf",
            lamp: "lamp",
            globe: "globe",
          } as const
        )[objectId as "window" | "bed" | "mirror" | "bookshelf" | "lamp" | "globe"];

        if (preset) onDispatch({ id: `focus-${objectId}`, type: "camera", preset });
      },
    }), [onDispatch]);

    /* ── painting ─────────────────────────────────────────────────────────── */

    const stageCenter = useMemo(
      () => ({ x: size.width / 2, y: size.height * 0.54 }),
      [size.width, size.height],
    );

    const paintState = useMemo(() => {
      const camera = createExploreCamera(world, stageCenter.x, stageCenter.y, size.width);
      const rig = buildLightRig(world);
      const windowGroup = buildWindow(world.props.curtainsOpen, world.lamp.fairyLights);
      /*
       * The door's leaf angle comes straight from world state, so the swing is
       * driven by the same reducer as every other object in the room. The leaf
       * opens inward, toward -Z, about its -X stile.
       */
            /*
       * Positive rotation swings the leaf *inward*, toward the room. The
       * opposite sign sent it straight out through the wall, where it was
       * invisible and left the doorway looking like an empty hole.
       */
      const doorGroup = buildDoor(world.props.doorOpen * DOOR_SWING);
      const groups = [...scene.furniture, ...doorGroup, windowGroup];
      const frames = framesFor(world, camera, performance.now() / 1000, reduced);
      const lighting = resolveLighting(world);
      return { camera, rig, groups, frames, lighting, windowGroup };
    }, [world, stageCenter.x, stageCenter.y, size.width, reduced, scene.furniture]);

    useLayoutEffect(() => {
      const svg = svgRef.current;
      if (!svg) return;

      const { camera, rig, groups, frames, lighting } = paintState;

      // Characters are live DOM (every joint is written each frame), so they
      // cannot live inside the generated path stream. Instead the room is split
      // into two painter layers around the characters' depth: everything
      // further away renders beneath them, everything nearer renders on top.
      // That keeps occlusion correct without duplicating rig markup.
      const time = performance.now() / 1000;

      for (const frame of frames) {
        const node = svg.querySelector<SVGGElement>(`[data-bear="explore-${frame.id === "mochi" ? "a" : "b"}"]`);
        if (!node) continue;
        const painter = createBearPainter(node);
        painter(frame.pose, time, reduced, warmthFor(world), frame.yaw);
      }

      // Split at the *nearest* character so neither plush is cut by the split.
      const characterDepth = Math.min(
        ...frames
          .filter((frame) => frame.placement.visible)
          .map((frame) => frame.placement.depth),
      );

      // The mirror. Reflection geometry is recomputed every frame from the same
      // live pose that draws the plushies, so the glass can never show a
      // stale or unrelated picture.
      const mirrorQuad: MirrorQuad | null = projectMirror(camera);
      const clipNode = svg.querySelector<SVGPathElement>('[data-clip="mirror"]');
      if (clipNode) clipNode.setAttribute("d", mirrorQuad ? mirrorQuad.path : "");

      const mirrorReflections = frames.map((frame) =>
        mirrorQuad
          ? reflectCharacter(frame.id, CHARACTER_ANCHORS[frame.id], frame.yaw, camera, mirrorQuad)
          : null,
      );
      const mirrorLayer = svg.querySelector<SVGGElement>('[data-layer="mirror-reflection"]');
      const nearestReflection = mirrorReflections.reduce(
        (nearest, item) =>
          item && item.visible && item.pixelScale > 0 ? Math.min(nearest, item.screenDepth) : nearest,
        Number.POSITIVE_INFINITY,
      );
      if (mirrorLayer) {
        // Painted inside the room's own depth queue, so furniture standing in
        // front of the glass hides the reflection exactly as it hides the room.
        mirrorLayer.setAttribute(
          "data-depth",
          Number.isFinite(nearestReflection) ? nearestReflection.toFixed(1) : "",
        );
      }

      const faces = collectFaces({
        camera,
        rig,
        shell: scene.shell,
        groups,
        state: world,
        characterMarkup: [],
        width: size.width,
        height: size.height,
        time,
        reduced,
      });

      // The floor and ceiling are single room-sized quads, so their centroid
      // depth says nothing useful about where they sit relative to the plushies
      // — the floor's average depth is *nearer* than a character standing in the
      // middle of the room, which buried both bears under it. Ground and ceiling
      // are therefore always painted behind the characters; only furniture and
      // walls use the depth split.
      const isBackdrop = (item: (typeof faces)[number]) =>
        item.group === "floor" ||
        item.group === "floor-apron" ||
        item.group === "ceiling";

      let farMarkup = "";
      let nearMarkup = "";

      // Where does the reflection belong in the painter stream? Faces arrive
      // nearest-first, so it belongs immediately before the first face strictly
      // further away: every face emitted after that point is in front of the
      // glass and must be allowed to occlude it.
      const wantsMirror = Boolean(mirrorLayer) && Number.isFinite(nearestReflection);
      let mirrorInserted = false;
      const mirrorSlot = `<g data-slot="mirror-reflection"></g>`;

      for (const item of faces) {
        if (item.kind !== "face") continue;
        const backdrop = isBackdrop(item);
        if (wantsMirror && !mirrorInserted && !backdrop && item.depth < nearestReflection) {
          // Emit the slot into whichever layer this face is about to enter.
          if (item.depth >= characterDepth) farMarkup += mirrorSlot;
          else nearMarkup += mirrorSlot;
          mirrorInserted = true;
        }
        if (backdrop || item.depth >= characterDepth) farMarkup += item.markup;
        else nearMarkup += item.markup;
      }

      const farNode = svg.querySelector<SVGGElement>('[data-layer="room-far"]');
      const nearNode = svg.querySelector<SVGGElement>('[data-layer="room-near"]');
      if (farNode) farNode.innerHTML = farMarkup + (wantsMirror && !mirrorInserted ? mirrorSlot : "");
      if (nearNode) nearNode.innerHTML = nearMarkup;

      // Put the live reflection element where the slot stands. Moving the node
      // keeps exactly one rig: serialising it through innerHTML each frame would
      // mint a duplicate and orphan the tree the painters write into.
      if (mirrorLayer) {
        const slot = svg.querySelector('[data-slot="mirror-reflection"]');
        if (slot && slot.parentNode) slot.parentNode.replaceChild(mirrorLayer, slot);
        else if (!mirrorLayer.isConnected && farNode) farNode.insertBefore(mirrorLayer, farNode.firstChild);
      }

      // Position the room's own plushies. Their rigs are live DOM, so only the
      // wrapper transform and visibility are written here; the joints were
      // painted above.
      for (const frame of frames) {
        const wrap = svg.querySelector<SVGGElement>(`[data-char-wrap="${frame.id}"]`);
        if (!wrap) continue;
        const p = frame.placement;
        const visible = p.visible && p.heightPx > 30;
        wrap.setAttribute("opacity", visible ? "1" : "0");
        wrap.setAttribute("data-visible", String(visible));
        wrap.setAttribute(
          "transform",
          `translate(${p.screenX.toFixed(2)} ${p.screenY.toFixed(2)}) scale(${p.pixelScale.toFixed(4)})`,
        );
      }

      // Paint the reflections. Each one inherits the room pose exactly — head
      // tilt, eye line, arm and leg placement — because the same rig painter is
      // handed the same pose; only the mirrored body yaw differs.
      for (const frame of frames) {
        const wrap = mirrorLayer?.querySelector<SVGGElement>(`[data-mirror-wrap="${frame.id}"]`)
          ?? svg.querySelector<SVGGElement>(`[data-mirror-wrap="${frame.id}"]`);
        const reflection = mirrorReflections[frames.indexOf(frame)];
        if (!wrap) continue;

        const shown = Boolean(reflection?.visible) && (reflection?.pixelScale ?? 0) > 0;
        wrap.setAttribute("opacity", shown ? "0.78" : "0");
        wrap.setAttribute("data-visible", String(shown));
        if (!shown || !reflection) continue;

        wrap.setAttribute(
          "transform",
          `translate(${reflection.screenX.toFixed(2)} ${reflection.screenY.toFixed(2)}) scale(${reflection.pixelScale.toFixed(4)})`,
        );

        const rigNode = wrap.querySelector<SVGGElement>(`[data-bear="explore-mirror-${frame.id === "mochi" ? "a" : "b"}"]`);
        if (rigNode) {
          createBearPainter(rigNode)(frame.pose, time, reduced, warmthFor(world), reflection.yaw);
        }
      }

      // Sky gradient stops.
      svg.querySelectorAll<SVGStopElement>("[data-sky]").forEach((stop) => {
        const slot = stop.getAttribute("data-sky");
        const value =
          slot === "top" ? lighting.skyTop : slot === "mid" ? lighting.skyMid : lighting.skyBottom;
        stop.setAttribute("stop-color", value);
      });

      // Atmospheric overlays.
      const tintNode = svg.querySelector<SVGRectElement>('[data-overlay="tint"]');
      if (tintNode) {
        tintNode.setAttribute("fill", lighting.weatherTint);
        tintNode.setAttribute("opacity", (lighting.weatherTintAlpha + 0.06).toFixed(3));
      }

      const lampNode = svg.querySelector<SVGCircleElement>('[data-overlay="lamp-pool"]');
      if (lampNode) {
        const lampProjected = project(rig.lampFloor, camera);
        lampNode.setAttribute("opacity", rig.lampStrength > 0.02 && lampProjected.visible ? String(0.55 * rig.lampStrength) : "0");
        if (lampProjected.visible) {
          // An ellipse so the pool reads as lying flat on the floor.
          lampNode.setAttribute("cx", lampProjected.x.toFixed(1));
          lampNode.setAttribute("cy", lampProjected.y.toFixed(1));
          lampNode.setAttribute("r", (lampProjected.scale * 220).toFixed(1));
          lampNode.setAttribute(
            "transform",
            `translate(${lampProjected.x} ${lampProjected.y}) scale(1 0.52) translate(${-lampProjected.x} ${-lampProjected.y})`,
          );
        }
      }

      // Hotspots are projected from world space every frame.
      const nextHotspots: Hotspot[] = [];
      const pushHotspot = (
        id: string,
        label: string,
        position: { x: number; y: number; z: number },
        radius: number,
        variant: Hotspot["variant"],
      ) => {
        const projected = project(position, camera);
        if (!projected.visible) return;
        nextHotspots.push({
          id,
          label,
          x: projected.x,
          y: projected.y,
          radius: Math.max(18, Math.min(64, radius * projected.scale * 0.42)),
          depth: projected.depth,
          visible: true,
          variant,
        });
      };

      for (const group of groups) {
        const hotspot = group.hotspot;
        if (!hotspot) continue;
        if (group.id === "window" && world.props.curtainsOpen < 0.15) {
          // Still clickable, but read as the curtain control while closed.
          pushHotspot("curtains", "Open the curtains", hotspot, hotspot.radius, "prop");
          continue;
        }
        pushHotspot(
          hotspot.objectId,
          group.id === "globe" && world.props.globeOpen
            ? "Snow globe — close"
            : group.id === "gift" && world.props.giftOpen
              ? "Gift — close"
              : group.id === "door" && world.props.doorOpen > 0.5
                ? "The door — close"
                : hotspot.label,
          hotspot,
          hotspot.radius,
          "prop",
        );
      }

      for (const frame of frames) {
        if (!frame.placement.visible || frame.placement.heightPx < 40) continue;
        // Head anchor in world space: the rig is ~296 local units tall and its
        // origin sits at the feet, so the head is near local y = 250.
        const head = project(
          {
            x: CHARACTER_ANCHORS[frame.id].x,
            y: 250 * CHARACTER_SCALE,
            z: CHARACTER_ANCHORS[frame.id].z,
          },
          camera,
        );
        if (!head.visible) continue;
        nextHotspots.push({
          id: frame.id,
          label: frame.id === "mochi" ? "Mochi" : "Yume",
          x: head.x,
          y: head.y,
          radius: Math.max(20, frame.placement.heightPx * 0.22),
          depth: head.depth,
          visible: true,
          variant: "character",
        });
      }

      // Hotspot geometry is repainted imperatively (see below); React only
      // tracks the identity of the set so buttons are not remounted per frame.
      const ids = nextHotspots.map((spot) => `${spot.variant}:${spot.id}`).sort();
      const idKey = ids.join("|");
      if (idKey !== lastHotspotKey.current) {
        lastHotspotKey.current = idKey;
        setHotspotIds(ids);
      }
      paintHotspotNodes(nextHotspots);

      // Weather.
      const windowRect = projectWindow(camera, world.props.curtainsOpen);
      // The globe's glass is drawn as a room object; the flakes inside it are
      // painted on the weather canvas, so hand the painter the projected centre.
      const globeGroup = groups.find((group) => group.id === "globe");
      const globeCentre = globeGroup ? project(GLOBE_POSITION, camera) : null;
      const globe =
        globeCentre && globeCentre.visible
          ? { x: globeCentre.x, y: globeCentre.y, radius: 58 * globeCentre.scale }
          : null;

      weather.paint(canvasRef.current, {
        lighting,
        world,
        windowRect,
        width: size.width,
        height: size.height,
        time,
        reduced,
        windowVisible: Boolean(windowRect) && world.props.curtainsOpen > 0.12,
        globe: world.props.globeOpen ? globe : null,
      });
    });

    /* ── interaction ──────────────────────────────────────────────────────── */

    /**
     * Pointer capture is taken only once the gesture is definitely a drag.
     *
     * Capturing on `pointerdown` retargets every later event to the stage, which
     * suppresses the `click` that a hotspot needs — so tapping a dot stopped
     * working. Conversely, *not* capturing at all let a phone swipe that started
     * on a dot die the moment the finger left the button. Deferring the capture
     * until the movement threshold is crossed satisfies both.
     */
    const DRAG_THRESHOLD = 4;

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      // Form controls keep their own gestures. Hotspots deliberately do not bail
      // out: they cover real patches of the scene, and a swipe that begins on a
      // dot must still orbit the room.
      if (target?.closest("input,textarea,select,label,a[href]")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      dragRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: 0,
        startYaw: worldRef.current.camera.yaw,
        startPitch: worldRef.current.camera.pitch,
        captured: false,
      };
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;

      if (drag.moved < DRAG_THRESHOLD) return;

      if (!drag.captured) {
        drag.captured = true;
        const stage = event.currentTarget as HTMLDivElement;
        try {
          stage.setPointerCapture(event.pointerId);
        } catch {
          // Capture is an optimisation; a rejected request must not break orbit.
        }
      }

      engine.orbit(dx, dy);
    };

    const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag.pointerId !== event.pointerId) return;
      const stage = event.currentTarget as HTMLDivElement;
      drag.pointerId = -1;
      if (drag.captured) {
        drag.captured = false;
        if (stage.hasPointerCapture?.(event.pointerId)) {
          stage.releasePointerCapture(event.pointerId);
        }
      }
      // The camera keeps whatever pose the gesture ended on: no spring-back.
    };

    const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      engine.zoom(event.deltaY * 0.6);
    };

    /* ── hotkeys ──────────────────────────────────────────────────────────── */

    const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const node = event.target as HTMLElement | null;
      if (node?.closest("input,textarea,button,a,[role='dialog']")) return;

      const step = event.shiftKey ? 22 : 8;
      let handled = true;

      switch (event.key) {
        case "ArrowLeft":
          engine.orbit(-step, 0);
          break;
        case "ArrowRight":
          engine.orbit(step, 0);
          break;
        case "ArrowUp":
          engine.orbit(0, step * 0.5);
          break;
        case "ArrowDown":
          engine.orbit(0, -step * 0.5);
          break;
        case "+":
        case "=":
          engine.zoom(-48);
          break;
        case "-":
        case "_":
          engine.zoom(48);
          break;
        case "w":
        case "W":
          onDispatch({ id: `key-w-${Date.now()}`, type: "camera", preset: "window" });
          onAnnounce("Camera — the window.");
          break;
        case "b":
        case "B":
          onDispatch({ id: `key-b-${Date.now()}`, type: "camera", preset: "bed" });
          onAnnounce("Camera — the bed.");
          break;
        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleHotspot = useCallback(
      (id: string) => {
        // A pointer that travelled is an orbit, not a tap.
        if (dragRef.current.moved > 8) return;
        if (id === "mochi" || id === "yume") {
          /*
           * Touching either plush starts the dance — the same action from
           * either body, because the dance belongs to the pair. A second touch
           * stops it, and stopping unwinds through the release phase rather
           * than cutting, so they part hands and step back instead of snapping.
           */
          const dancing = worldRef.current.interaction.kind === "dance";

          if (dancing) {
            onDispatch({ id: `hotspot-dance-${id}`, type: "dance", on: false });
            onAnnounce("The dance winds down and they settle together.");
            return;
          }

          /*
           * The dance is a performance, so it brings its own music. The
           * soundtrack is started through the shared controller — never a
           * second player — and only if it is not already playing, so asking
           * the pair to dance mid-song resumes the choreography without
           * restarting the track under the audience.
           *
           * The action is dispatched immediately rather than after the audio
           * promise resolves: a browser that blocks playback must not turn a
           * click into a dead button. If the sound is refused, the room says so
           * and offers the real playback control instead of pretending.
           */
          onDispatch({ id: `hotspot-dance-${id}`, type: "dance", on: true });

          const starter = onEnsureMusic;
          if (!starter) {
            onAnnounce(
              `${id === "mochi" ? "Mochi" : "Yume"} takes the other's paw — they start to dance.`,
            );
            return;
          }

          void starter().then((audible) => {
            onAnnounce(
              audible
                ? "The song comes up and they dance together."
                : "They dance, but the soundtrack could not start — press play in the menu to hear it.",
            );
          });
          return;
        }

        switch (id) {
          case "lamp": {
            // The hotspot toggles the lamp on and off — the same action the HUD
            // uses, so both stay in sync and neither can disagree about state.
            const on = worldRef.current.lamp.targetKerosene < 0.5;
            onDispatch({ id: `hotspot-lamp`, type: "light", source: "lamp", on });
            onAnnounce(on ? "The lamp comes on." : "The lamp goes out.");
            break;
          }
          case "window": {
            const open = worldRef.current.props.curtainsOpen < 0.5;
            onDispatch({ id: `hotspot-window`, type: "light", source: "window", on: open });
            onAnnounce(open ? "The curtains part — look outside." : "The curtains close.");
            break;
          }
          case "door": {
            const opening = worldRef.current.props.doorOpen < 0.5;
            onDispatch({ id: "hotspot-door", type: "toggle", flag: "doorOpen" });
            onAnnounce(
              opening
                ? "The door swings open onto the hallway."
                : "The door closes with a soft click.",
            );
            break;
          }
          case "curtains": {
            onDispatch({ id: `hotspot-curtains`, type: "light", source: "window", on: true });
            onAnnounce("The curtains part.");
            break;
          }
          case "globe": {
            // Compute the post-dispatch state up front: worldRef still holds the
            // pre-click value, so reading it after dispatching announces the
            // opposite of what just happened.
            const opening = !worldRef.current.props.globeOpen;
            onDispatch({ id: `hotspot-globe`, type: "toggle", flag: "globeOpen" });
            onDispatch({ id: `hotspot-globe-cam`, type: "camera", preset: "globe" });
            onAnnounce(
              opening
                ? "The snow globe wakes up — snow spirals inside the glass."
                : "The snow globe settles.",
            );
            break;
          }
          case "gift": {
            const opening = !worldRef.current.props.giftOpen;
            onDispatch({ id: `hotspot-gift`, type: "toggle", flag: "giftOpen" });
            onAnnounce(
              opening
                ? "The gift box opens — a little brass heart rests inside."
                : "The gift box closes.",
            );
            break;
          }
          case "bed": {
            // The bed is interactable, not just a camera preset: the first tap
            // seats them, a second tap lies them down, a third tucks them in.
            const kind = worldRef.current.interaction.kind;
            const pose = worldRef.current.interaction.bedPose;
            // The `bed` action frames itself with `bedAction`; only the first
            // tap needs the wide pose to show what is being sat on.
            if (kind !== "bed") {
              onDispatch({ id: `hotspot-bed-cam`, type: "camera", preset: "bed" });
            }
            if (kind !== "bed") {
              onDispatch({ id: `hotspot-bed-sit`, type: "bed", action: "sit" });
              onAnnounce("Mochi and Yume settle onto the edge of the bed.");
            } else if (pose !== "lie") {
              onDispatch({ id: `hotspot-bed-lie`, type: "bed", action: "lie" });
              onAnnounce("They stretch out on the quilt.");
            } else {
              onDispatch({ id: `hotspot-bed-rest`, type: "bed", action: "rest" });
              onAnnounce("They rest against the pillows.");
            }
            break;
          }
          case "mirror": {
            // Looking into the mirror is a camera move that frames the live
            // reflection; it never swaps in a picture.
            onDispatch({ id: `hotspot-mirror`, type: "camera", preset: "vanity" });
            onAnnounce("You look into the mirror — the room reflects back.");
            break;
          }
          case "bookshelf": {
            const on = !worldRef.current.lamp.fairyLights;
            onDispatch({ id: `hotspot-bookshelf`, type: "light", source: "fairies", on });
            onAnnounce(on ? "The fairy lights glow." : "The fairy lights go dark.");
            break;
          }
          default:
            break;
        }
      },
      [onAnnounce, onDispatch],
    );

    const dispatchPreset = useCallback(
      (preset: keyof typeof CAMERA_PRESETS) => {
        onDispatch({ id: `preset-${preset}`, type: "camera", preset });
      },
      [onDispatch],
    );

    const characterHeight = Math.max(0, 296 * 0.82 * (size.height / BASE_HEIGHT)) * 0.9;

    return (
      <div
        className="explore-stage"
        ref={root}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="application"
        aria-label="Explore OMJ — drag to orbit the room, scroll to zoom, click the glowing points to interact"
        data-explore-atmosphere={world.time.atmosphere}
        data-explore-weather={world.weather.condition}
        // The committed camera pose, exposed so its persistence is observable
        // rather than inferred from pixels.
        data-camera-yaw={world.camera.yaw.toFixed(2)}
        data-camera-pitch={world.camera.pitch.toFixed(2)}
        data-camera-distance={world.camera.distance.toFixed(1)}
        // The interaction's authoritative clock, exposed so choreography can be
        // asserted from the DOM instead of inferred from a screenshot.
        data-interaction={world.interaction.kind ?? "idle"}
        data-interaction-preset={world.interaction.preset ?? ""}
        data-interaction-bed={world.interaction.bedPose ?? ""}
        data-interaction-phase={world.interaction.phase}
        data-interaction-progress={world.interaction.progress.toFixed(4)}
        data-character-mochi-x={world.characters.mochi.x.toFixed(1)}
        data-character-yume-x={world.characters.yume.x.toFixed(1)}
        data-character-mochi-seated={world.characters.mochi.seated.toFixed(3)}
        data-lamp-kerosene={world.lamp.kerosene.toFixed(3)}
        data-lamp-target={world.lamp.targetKerosene.toFixed(3)}
        data-lamp-kelvin={world.lamp.kelvin.toFixed(0)}
        data-light-source={world.props.lightSource}
      >
        <svg
          ref={svgRef}
          className="explore-svg"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="omj-sky" x1="0" y1="0" x2="0" y2="1">
              <stop data-sky="top" offset="0%" stopColor="#0a0e1e" />
              <stop data-sky="mid" offset="58%" stopColor="#182038" />
              <stop data-sky="bottom" offset="100%" stopColor="#2b3050" />
            </linearGradient>
            <radialGradient id="omj-lamp-pool">
              <stop stopColor="#ffcf87" stopOpacity="0.5" />
              <stop offset="0.55" stopColor="#ffb45e" stopOpacity="0.18" />
              <stop offset="1" stopColor="#ffb45e" stopOpacity="0" />
            </radialGradient>
            <filter id="omj-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <clipPath id="omj-mirror-clip">
              <path d="" data-clip="mirror" />
            </clipPath>
            <radialGradient id="omj-vignette">
              <stop offset="55%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#07050f" stopOpacity="0.72" />
            </radialGradient>
          </defs>

          {/* Deep space behind the room so orbited gaps never show the page. */}
          <rect width="100%" height="100%" fill="#0a0812" />

          {/* Window sky sits behind the room shell. */}
          <rect
            x={-size.width}
            y={-size.height}
            width={size.width * 3}
            height={size.height * 3}
            fill="url(#omj-sky)"
            data-layer="sky"
          />

          <g data-layer="room-far" />
          <circle data-overlay="lamp-pool" cx={0} cy={0} r={0} fill="url(#omj-lamp-pool)" opacity="0" />
          <rect
            data-overlay="tint"
            width="100%"
            height="100%"
            fill="#000"
            opacity="0"
            style={{ mixBlendMode: "soft-light" }}
          />

          {/* Live plush rigs. Depth ordering against furniture is resolved by
              the painter stream; the rigs stay in the DOM because every joint
              is written per frame. */}
          <g data-layer="characters">
            <g data-char-wrap="mochi" opacity="0">
              <ellipse data-char-shadow cx={0} cy={0} rx={0} ry={0} fill="#0b0813" opacity="0" />
              <BearRig id="explore-a" variant="a" />
            </g>
            <g data-char-wrap="yume" opacity="0">
              <ellipse data-char-shadow cx={0} cy={0} rx={0} ry={0} fill="#0b0813" opacity="0" />
              <BearRig id="explore-b" variant="b" />
            </g>
          </g>

          <g data-layer="room-near" />

          {/* The dressing mirror reflects the room, so the plushies standing in
              front of it appear inside the glass — same rig, same pose, same
              gaze, reflected through the mirror plane and clipped to the
              aperture. */}
          <g data-layer="mirror-reflection" clipPath="url(#omj-mirror-clip)" pointerEvents="none">
            <g data-mirror-wrap="mochi" opacity="0">
              <BearRig id="explore-mirror-a" variant="a" />
            </g>
            <g data-mirror-wrap="yume" opacity="0">
              <BearRig id="explore-mirror-b" variant="b" />
            </g>
          </g>

          <rect width="100%" height="100%" fill="url(#omj-vignette)" pointerEvents="none" />
        </svg>

        <canvas ref={canvasRef} className="explore-weather" aria-hidden="true" />

        {hotspotIds.map((key) => {
          const [variant, id] = key.split(":") as [Hotspot["variant"], string];
          const character = variant === "character";
          return (
            <button
              key={key}
              ref={(node) => {
                if (node) hotspotNodes.current.set(key, { root: node, label: null });
                else hotspotNodes.current.delete(key);
              }}
              type="button"
              className={`hotspot hotspot-${variant}`}
              data-hotspot={id}
              aria-label={
                character
                  ? world.interaction.kind === "dance"
                    ? `Ask ${titleCase(id)} to stop dancing`
                    : `Dance with ${titleCase(id)}`
                  : `Interact with ${id}`
              }
              onPointerEnter={() => setHovered(id)}
              onPointerLeave={() => setHovered((prev) => (prev === id ? null : prev))}
              onFocus={() => setHovered(id)}
              onBlur={() => setHovered((prev) => (prev === id ? null : prev))}
              onClick={(event) => {
                event.stopPropagation();
                handleHotspot(id);
              }}
            >
              <span className="hotspot-dot" aria-hidden="true" />
              <span
                className={`hotspot-label${hovered === id ? " is-visible" : ""}`}
                aria-hidden="true"
              >
                {character
                  ? world.interaction.kind === "dance"
                    ? `Stop dancing with ${titleCase(id)}`
                    : `Dance with ${titleCase(id)}`
                  : hotspotLabel(id)}
              </span>
            </button>
          );
        })}

        <nav className="explore-camera-rail" aria-label="Camera viewpoints" data-hud-surface>
          {(
            [
              ["window", "Window"],
              ["bed", "Bed"],
              ["vanity", "Mirror"],
              ["bookshelf", "Shelf"],
              ["overview", "Room"],
            ] as const
          ).map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              className="camera-chip"
              onClick={() => dispatchPreset(preset)}
              aria-label={`Move the camera to the ${label.toLowerCase()}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <p className="sr-only room-status" aria-live="polite">
          {world.weather.condition} weather, {world.time.atmosphere} light, curtains{" "}
          {world.props.curtainsOpen > 0.5 ? "open" : "closed"}.
        </p>
      </div>
    );
  },
);

