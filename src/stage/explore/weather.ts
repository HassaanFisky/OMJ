/**
 * Explore-mode weather painter.
 *
 * Rain, snow and ambient dust are drawn on a 2D canvas that sits above the
 * room but is clipped to the projected window rectangle, so precipitation is
 * always physically *outside*. Particle motion uses a deterministic hash of the
 * particle index plus the current time, meaning no allocation happens per frame
 * and the same instant always produces the same frame.
 */

import { rgba } from "../../world/color";
import type { WorldState } from "../../world/state";
import type { WindowRect } from "./renderer";

export interface WeatherPaintInput {
  lighting: { skyTop: string; skyMid: string; skyBottom: string; weatherTint: string };
  world: WorldState;
  windowRect: WindowRect | null;
  width: number;
  height: number;
  time: number;
  reduced: boolean;
  windowVisible: boolean;
  /** Screen centre and radius of the snow globe, when it is on screen. */
  globe?: { x: number; y: number; radius: number } | null;
}

const fract = (value: number) => value - Math.floor(value);
const hash = (seed: number) => fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453);

const RAIN_COUNT = 190;
const SNOW_COUNT = 150;
const DUST_COUNT = 46;

export interface WeatherPainter {
  paint(canvas: HTMLCanvasElement | null, input: WeatherPaintInput): void;
}

export function createWeatherPainter(): WeatherPainter {
  let context: CanvasRenderingContext2D | null = null;
  let canvasRef: HTMLCanvasElement | null = null;

  const ensure = (canvas: HTMLCanvasElement) => {
    if (canvasRef !== canvas) {
      canvasRef = canvas;
      context = canvas.getContext("2d");
    }
    return context;
  };

  return {
    paint(canvas, input) {
      if (!canvas) return;
      const ctx = ensure(canvas);
      if (!ctx) return;

      const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
      const pixelWidth = Math.max(1, Math.round(input.width * dpr));
      const pixelHeight = Math.max(1, Math.round(input.height * dpr));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, input.width, input.height);

      const { world, windowRect, time, reduced } = input;
      const condition = world.weather.condition;
      const intensity = world.weather.intensity;

      if (windowRect && input.windowVisible && condition !== "clear") {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(windowRect.x, windowRect.y, windowRect.width, windowRect.height, 18);
        ctx.clip();

        if (condition === "rain") {
          drawRain(ctx, windowRect, time, intensity, reduced);
        } else if (condition === "snow") {
          drawSnow(ctx, windowRect, time, intensity, reduced);
        }

        // Interior glass haze toward the bottom of the panes.
        const haze = ctx.createLinearGradient(0, windowRect.y, 0, windowRect.y + windowRect.height);
        haze.addColorStop(0, rgba(input.lighting.skyTop, 0));
        haze.addColorStop(1, rgba(condition === "snow" ? "#cfe2ff" : "#8fa8cc", 0.1 * intensity));
        ctx.fillStyle = haze;
        ctx.fillRect(windowRect.x, windowRect.y, windowRect.width, windowRect.height);

        ctx.restore();
      }

      // Snow globe spiral: local particles inside the globe's screen footprint.
      if (world.props.globeOpen) {
        drawGlobeSnow(ctx, time, reduced, input.globe ?? null);
      }

      // Floating dust motes catch the lamp light.
      if (world.lamp.kerosene > 0.05) {
        drawDust(ctx, time, input.width, input.height, world.lamp.kerosene, reduced);
      }
    },
  };
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  rect: WindowRect,
  time: number,
  intensity: number,
  reduced: boolean,
) {
  const count = Math.round(RAIN_COUNT * Math.max(0.2, intensity));
  ctx.lineCap = "round";

  for (let i = 0; i < count; i += 1) {
    const seed = i + 1;
    const speed = 0.55 + hash(seed * 3.3) * 0.9;
    const travel = enlargedTravel(time, speed, reduced);
    const x = rect.x + hash(seed * 7.7) * rect.width + travel * 22;
    const y = rect.y + ((hash(seed * 1.9) + travel) % 1) * rect.height;
    const length = 10 + hash(seed * 5.1) * 18;

    ctx.strokeStyle = rgba("#bcd2f0", 0.12 + hash(seed * 2.2) * 0.3);
    ctx.lineWidth = 0.8 + hash(seed * 4.4) * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - length * 0.18, y + length);
    ctx.stroke();
  }
}

function drawSnow(
  ctx: CanvasRenderingContext2D,
  rect: WindowRect,
  time: number,
  intensity: number,
  reduced: boolean,
) {
  const count = Math.round(SNOW_COUNT * Math.max(0.2, intensity));

  for (let i = 0; i < count; i += 1) {
    const seed = i + 1;
    const speed = 0.11 + hash(seed * 6.1) * 0.16;
    const travel = enlargedTravel(time, speed, reduced);
    const sway = reduced ? 0 : Math.sin(time * 0.9 + seed) * 10;
    const x = rect.x + hash(seed * 3.7) * rect.width + sway;
    const y = rect.y + ((hash(seed * 9.3) + travel) % 1) * rect.height;
    const radius = 0.9 + hash(seed * 2.6) * 2.4;

    ctx.fillStyle = rgba("#f4f8ff", 0.24 + hash(seed * 5.5) * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function enlargedTravel(time: number, speed: number, reduced: boolean): number {
  // Under reduced motion the precipitation is frozen but still present, so the
  // scene reads as weather without any scrolling movement.
  return reduced ? hash(speed * 91.7) : time * speed;
}

function drawGlobeSnow(
  ctx: CanvasRenderingContext2D,
  time: number,
  reduced: boolean,
  globe: { x: number; y: number; radius: number } | null,
) {
  // The spiral must follow the globe's real projected position: it is drawn in
  // the room at a fixed world point, so guessing a screen centre made the flakes
  // fly in mid-air once the camera moved.
  if (!globe || !Number.isFinite(globe.radius) || globe.radius < 6) return;
  const cx = globe.x;
  const cy = globe.y;
  const radius = globe.radius;

  for (let i = 0; i < 40; i += 1) {
    const seed = i + 1;
    const angle = hash(seed * 3.1) * Math.PI * 2 + (reduced ? 0 : time * (0.5 + hash(seed) * 0.7));
    const orbit = radius * (0.22 + hash(seed * 8.3) * 0.7);
    const bob = reduced ? 0 : Math.sin(time * 1.4 + seed) * 6;
    const x = cx + Math.cos(angle) * orbit;
    const y = cy + Math.sin(angle * 0.7) * orbit * 0.6 + bob;

    ctx.fillStyle = rgba("#f6f1ff", 0.25 + hash(seed * 2.9) * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + hash(seed * 4.2) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number,
  lamp: number,
  reduced: boolean,
) {
  for (let i = 0; i < DUST_COUNT; i += 1) {
    const seed = i + 1;
    const drift = reduced ? 0 : Math.sin(time * 0.24 + seed * 1.7) * 18;
    const rise = reduced ? 0 : ((time * 0.02 + hash(seed * 5.9)) % 1) * height;
    const x = hash(seed * 2.3) * width + drift;
    const y = height * 0.78 - rise * 0.4;
    const alpha = (0.06 + hash(seed * 7.1) * 0.16) * lamp;

    ctx.fillStyle = rgba("#ffd9a0", alpha);
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + hash(seed * 3.3) * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
