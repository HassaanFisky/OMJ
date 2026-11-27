import type { AuthoritativeEnv } from "../environment/weatherState";
import type { Frame } from "../timeline/scenes";
import { worldPoint } from "../timeline/scenes";

const fract = (value: number) => value - Math.floor(value);
const random = (seed: number) =>
  fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453);

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WINDOW_PANES = [
  { x: 420, y: 148, width: 210, height: 414, radius: 24 },
  { x: 650, y: 148, width: 210, height: 414, radius: 24 },
  { x: 880, y: 148, width: 210, height: 414, radius: 24 },
] as const;

export function createParticleEngine(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D rendering is unavailable.");
  }

  const ctx = context;
  let last: [Frame, number, boolean, ViewBox, AuthoritativeEnv] | null = null;

  const mistCanvas = document.createElement("canvas");
  mistCanvas.width = 96;
  mistCanvas.height = 96;
  const mistContext = mistCanvas.getContext("2d");
  if (mistContext) {
    const gradient = mistContext.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, "rgba(210, 192, 236, 0.34)");
    gradient.addColorStop(1, "rgba(210, 192, 236, 0)");
    mistContext.fillStyle = gradient;
    mistContext.fillRect(0, 0, 96, 96);
  }

  function traceWindowPanes() {
    ctx.beginPath();
    for (const pane of WINDOW_PANES) {
      ctx.roundRect(pane.x, pane.y, pane.width, pane.height, [
        pane.radius,
        pane.radius,
        6,
        6,
      ]);
    }
  }

  function drawHeart(x: number, y: number, size: number) {
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(
      x - size, y - size * 0.4,
      x - size * 0.6, y - size,
      x, y - size * 0.4,
    );
    ctx.bezierCurveTo(
      x + size * 0.6, y - size,
      x + size, y - size * 0.4,
      x, y + size * 0.3,
    );
    ctx.fill();
  }

  function drawExteriorWeather(
    frame: Frame,
    time: number,
    reduced: boolean,
    env: AuthoritativeEnv,
  ) {
    // STRICT WINDOW APERTURE CLIP — weather stays outside the bedroom forever
    ctx.save();
    traceWindowPanes();
    ctx.clip();

    // 1. Night Stars (zero spinning 8-point polygons; suppressed strictly during day)
    if (env.stars > 0.01) {
      for (let i = 0; i < 48; i++) {
        const sx = 430 + random(i + 1) * 650;
        const sy = 158 + random(i + 101) * 290;
        const twinkle = reduced
          ? 0.85
          : 0.65 + Math.sin(time * (0.9 + random(i + 50) * 0.8) + i) * 0.3;

        ctx.globalAlpha = env.stars * twinkle * 0.9;
        ctx.fillStyle = i % 6 === 0 ? "#f7e3b5" : "#ebe2f7";

        const r = 0.8 + random(i + 180) * 1.3;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle stationary 4-point sparkle cross on a few brightest stars
        if (i % 13 === 0) {
          ctx.strokeStyle = "rgba(255, 245, 224, 0.5)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(sx - 4, sy);
          ctx.lineTo(sx + 4, sy);
          ctx.moveTo(sx, sy - 4);
          ctx.lineTo(sx, sy + 4);
          ctx.stroke();
        }
      }
    }

    // 2. Genuine Diagonal Shooting Star Streak (rare, night sky / window scenes only)
    if (!reduced && env.shootingStarChance > 0.1) {
      const shouldShow =
        frame.action === "sky" ||
        frame.action === "window" ||
        (frame.action === "intro" && Math.floor(time / 18) % 2 === 1);

      if (shouldShow) {
        let p = -1;
        if (frame.action === "sky" || frame.action === "window") {
          // Appears cleanly once in the middle of the cue
          p = (frame.progress - 0.18) / 0.58;
        } else {
          const cycle = (time % 18) / 18;
          p = cycle < 0.08 ? cycle / 0.08 : -1;
        }

        if (p >= 0 && p <= 1) {
          const startX = frame.action === "window" ? 1055 : 835;
          const startY = 178;
          const headX = startX - p * 175;
          const headY = startY + p * 98;
          const tailX = headX + 68;
          const tailY = headY - 38;
          const alpha = Math.sin(p * Math.PI);

          const grad = ctx.createLinearGradient(headX, headY, tailX, tailY);
          grad.addColorStop(0, `rgba(255, 248, 224, ${0.95 * alpha})`);
          grad.addColorStop(0.35, `rgba(232, 224, 255, ${0.55 * alpha})`);
          grad.addColorStop(1, "rgba(232, 224, 255, 0)");

          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.4;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(headX, headY);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();

          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#fff9e8";
          ctx.beginPath();
          ctx.arc(headX, headY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 3. Exterior Atmospheric Rain (never simultaneously active with snow)
    if (!reduced && env.rain > 0.01) {
      const slant = Math.min(8, 2 + env.windMs * 0.7);
      ctx.strokeStyle = "#d6e0f5";
      ctx.lineWidth = 1.4;

      for (let i = 0; i < 65; i++) {
        const rx =
          415 + ((random(i + 200) * 690 + time * slant * 6) % 690);
        const ry =
          135 +
          ((random(i + 300) * 440 + time * (320 + (i % 7) * 24)) % 440);

        ctx.globalAlpha = env.rain * (0.24 + random(i + 400) * 0.34);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - slant * 0.65, ry + 16);
        ctx.stroke();
      }

      // Gravity-driven droplets running down the exterior window glass
      ctx.fillStyle = "rgba(222, 234, 255, 0.55)";
      ctx.strokeStyle = "rgba(210, 226, 250, 0.25)";
      ctx.lineWidth = 1;
      for (let d = 0; d < 22; d++) {
        const dx = 432 + random(d + 450) * 645;
        const speed = 16 + random(d + 460) * 26;
        const dy = 152 + ((random(d + 470) * 405 + time * speed) % 405);
        const dropAlpha = env.wetGlass * (0.35 + random(d + 480) * 0.4);

        ctx.globalAlpha = dropAlpha;
        ctx.beginPath();
        ctx.moveTo(dx, dy - 11);
        ctx.lineTo(dx, dy);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(dx, dy, 1.8, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Exterior Natural Snowfall (varied sizes, gentle drift, strictly outside)
    if (!reduced && env.snow > 0.01) {
      ctx.fillStyle = "#f7f3ee";
      for (let i = 0; i < 58; i++) {
        const seed = random(i + 500);
        const sx =
          418 +
          ((random(i + 600) * 685 + Math.sin(time * 0.55 + i) * 16) % 685);
        const sy =
          140 + ((random(i + 700) * 435 + time * (22 + seed * 24)) % 435);

        ctx.globalAlpha = env.snow * (0.38 + seed * 0.45);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4 + seed * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Exterior Rolling Mist (strictly outside window panes)
    if (!reduced && env.mist > 0.01) {
      for (let i = 0; i < 6; i++) {
        const mx =
          380 + ((random(i + 800) * 740 + time * 10) % 740) - 90;
        const my = 420 + Math.sin(time * 0.35 + i) * 18;
        ctx.globalAlpha = env.mist * 0.42;
        ctx.drawImage(mistCanvas, mx, my, 210, 105);
      }
    }

    // 6. Winter Glass Edge Frost & Subtle Condensation (Cue 22 & Snow)
    if (env.frost > 0.02) {
      for (const pane of WINDOW_PANES) {
        const frostGrad = ctx.createRadialGradient(
          pane.x + pane.width / 2,
          pane.y + pane.height / 2,
          pane.width * 0.25,
          pane.x + pane.width / 2,
          pane.y + pane.height / 2,
          pane.height * 0.62,
        );
        frostGrad.addColorStop(0, "rgba(225, 238, 255, 0)");
        frostGrad.addColorStop(0.75, `rgba(218, 234, 252, ${env.frost * 0.14})`);
        frostGrad.addColorStop(1, `rgba(232, 244, 255, ${env.frost * 0.42})`);
        ctx.fillStyle = frostGrad;
        ctx.globalAlpha = 1;
        ctx.fillRect(pane.x, pane.y, pane.width, pane.height);
      }
    }

    ctx.restore();
  }

  function drawInteriorDetails(
    frame: Frame,
    time: number,
    reduced: boolean,
    env: AuthoritativeEnv,
  ) {
    // 1. Gentle Interior Floating Hearts (romantic scenes only)
    if (!reduced && frame.env.hearts > 0.01) {
      const center = (frame.a.x + frame.b.x) / 2;
      for (let i = 0; i < 14; i++) {
        const hx =
          center - 220 + random(i + 900) * 440 + Math.sin(time * 0.65 + i) * 14;
        const hy =
          940 - ((random(i + 950) * 480 + time * (20 + (i % 4) * 5)) % 480);

        ctx.globalAlpha =
          frame.env.hearts * (0.22 + random(i + 990) * 0.28);
        ctx.fillStyle = i % 2 === 0 ? "#e6aac0" : "#ccb2de";
        drawHeart(hx, hy, 4.5 + random(i + 1020) * 4.5);
      }
    }

    // 2. Romantic Paper Petals (Cue 14 "Yun na sata")
    if (!reduced && frame.env.petals > 0.01) {
      const center = (frame.a.x + frame.b.x) / 2;
      for (let i = 0; i < 16; i++) {
        const px =
          center - 240 + random(i + 1100) * 480 + Math.sin(time * 1.1 + i) * 24;
        const py =
          450 + ((random(i + 1150) * 500 + time * (32 + (i % 5) * 6)) % 500);
        const rot = time * 1.3 + i * 0.7;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.globalAlpha = frame.env.petals * 0.68;
        ctx.fillStyle = i % 2 === 0 ? "#f3c7d6" : "#f8e2e8";
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.5, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 3. Occasional Firefly Guide (Cue 37 subtle warm detail)
    if (!reduced && frame.env.firefly > 0.05) {
      const fx = 980 + Math.sin(time * 0.8) * 125;
      const fy = 520 + Math.cos(time * 0.65) * 70;
      const glow = (Math.sin(time * 3.8) * 0.28 + 0.72) * frame.env.firefly;

      ctx.save();
      ctx.globalAlpha = glow * 0.26;
      ctx.fillStyle = "#ffe088";
      ctx.beginPath();
      ctx.arc(fx, fy, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = glow * 0.9;
      ctx.fillStyle = "#fff9dc";
      ctx.beginPath();
      ctx.arc(fx, fy, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Restrained Cigarette Smoke Wisp (Cue 21 ONLY)
    if (!reduced && frame.env.cigarette > 0.05) {
      const tip = worldPoint(frame.a, frame.a.rightX + 18, frame.a.rightY - 12);
      ctx.save();
      ctx.strokeStyle = "rgba(220, 214, 232, 0.35)";
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      for (let w = 0; w < 3; w++) {
        const rise = ((time * 0.45 + w * 0.33) % 1);
        const sx = tip.x + Math.sin(time * 2.1 + w * 2) * (4 + rise * 10);
        const sy = tip.y - rise * 48;
        ctx.globalAlpha = frame.env.cigarette * (1 - rise) * 0.42;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2 + rise * 4.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    void env;
  }

  function draw(
    frame: Frame,
    time: number,
    reduced: boolean,
    viewBox: ViewBox,
    env: AuthoritativeEnv,
  ) {
    last = [frame, time, reduced, viewBox, env];

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / Math.max(1, viewBox.width);
    const scaleY = canvas.height / Math.max(1, viewBox.height);

    ctx.setTransform(
      scaleX, 0, 0, scaleY,
      -viewBox.x * scaleX, -viewBox.y * scaleY,
    );

    drawExteriorWeather(frame, time, reduced, env);
    drawInteriorDetails(frame, time, reduced, env);

    ctx.globalAlpha = 1;
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const w = Math.max(1, bounds.width);
    const h = Math.max(1, bounds.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    if (last) draw(...last);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return {
    draw,
    dispose() {
      observer.disconnect();
      last = null;
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}
