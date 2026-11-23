import type { Frame } from "../timeline/scenes";

const fract = (value: number) => value - Math.floor(value);
const random = (seed: number) =>
  fract(Math.sin(seed * 127.1) * 43758.5453);

export function createParticleEngine(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D rendering is unavailable.");
  }

  const ctx = context;
  let width = 1;
  let height = 1;
  let dpr = 1;
  let last: [Frame, number, boolean] | null = null;

  const mist = document.createElement("canvas");
  mist.width = 96;
  mist.height = 96;

  const mistContext = mist.getContext("2d");

  if (mistContext) {
    const gradient = mistContext.createRadialGradient(
      48, 48, 0, 48, 48, 48,
    );
    gradient.addColorStop(0, "rgba(210,190,230,.36)");
    gradient.addColorStop(1, "rgba(210,190,230,0)");
    mistContext.fillStyle = gradient;
    mistContext.fillRect(0, 0, 96, 96);
  }

  function heart(x: number, y: number, size: number) {
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

  function outdoors(
    frame: Frame,
    time: number,
    reduced: boolean,
    alpha: number,
  ) {
    const env = frame.env;

    // Twinkling night stars & constellation stardust
    for (let index = 0; index < 34; index++) {
      const x = 30 + random(index + 1) * 660;
      const y = 45 + random(index + 101) * 560;
      const twinkle = reduced
        ? 0.8
        : 0.72 + Math.sin(time * 0.7 + index) * 0.2;

      ctx.globalAlpha = alpha * env.stars * twinkle;
      ctx.fillStyle = index % 5 ? "#e6daee" : "#f4dfae";

      if (index % 9 === 0) {
        ctx.beginPath();
        for (let point = 0; point < 16; point++) {
          const angle = (point * Math.PI) / 8;
          const radius = point % 2 ? 2.7 : 5;
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius;

          if (!point) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(
          x, y, 0.9 + random(index + 180),
          0, Math.PI * 2,
        );
        ctx.fill();
      }
    }

    if (reduced) return;

    // The Firefly Guide: A warm glowing ember that gently floats across scenes
    if (alpha > 0.1 && (env.stars > 0.2 || env.mist > 0.1)) {
      const flyX = 360 + Math.sin(time * 0.45) * 160 + Math.cos(time * 0.9) * 45;
      const flyY = 620 + Math.cos(time * 0.38) * 110 + Math.sin(time * 0.75) * 35;
      const glow = (Math.sin(time * 3.5) * 0.3 + 0.7) * alpha;

      ctx.save();
      // Outer aura
      ctx.globalAlpha = glow * 0.22;
      ctx.fillStyle = "#ffdf80";
      ctx.beginPath();
      ctx.arc(flyX, flyY, 14, 0, Math.PI * 2);
      ctx.fill();

      // Core ember
      ctx.globalAlpha = glow * 0.85;
      ctx.fillStyle = "#fff8d6";
      ctx.beginPath();
      ctx.arc(flyX, flyY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Atmospheric Rain
    if (env.rain > 0.001) {
      ctx.strokeStyle = "#d4d9eb";
      ctx.lineWidth = 1.5;

      for (let index = 0; index < 46; index++) {
        const x =
          (random(index + 200) * 850 + time * 16) % 850 - 65;
        const y =
          (
            random(index + 300) * 1220 +
            time * (300 + (index % 9) * 16)
          ) % 1220 - 70;

        ctx.globalAlpha =
          alpha * env.rain * (0.2 + random(index + 400) * 0.3);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 18);
        ctx.stroke();
      }

      // Ground puddle ripples
      ctx.save();
      ctx.strokeStyle = "#c8d4e8";
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const rx = 180 + ((time * 45 + i * 115) % 360);
        const ry = 948 + i * 10;
        const progress = (time * 1.4 + i * 0.25) % 1;
        ctx.globalAlpha = (1 - progress) * env.rain * 0.3 * alpha;
        ctx.beginPath();
        ctx.ellipse(rx, ry, progress * 14, progress * 4.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Crystalline Snowfall
    if (env.snow > 0.001) {
      ctx.fillStyle = "#fff7ed";

      for (let index = 0; index < 38; index++) {
        const seed = random(index + 500);
        const x =
          random(index + 600) * 790 - 35 +
          Math.sin(time * 0.5 + index) * 17;
        const y =
          (
            random(index + 700) * 1170 +
            time * (24 + seed * 22)
          ) % 1170 - 45;

        ctx.globalAlpha =
          alpha * env.snow * (0.35 + seed * 0.4);

        ctx.beginPath();
        ctx.arc(x, y, 1.6 + seed * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Rolling Environmental Mist
    if (env.mist > 0.001) {
      for (let index = 0; index < 5; index++) {
        const x =
          (random(index + 800) * 1000 + time * 9) % 1000 - 140;
        const y = 840 + Math.sin(time * 0.3 + index) * 24;

        ctx.globalAlpha = alpha * env.mist * 0.35;
        ctx.drawImage(mist, x, y, 230, 120);
      }
    }
  }

  function draw(frame: Frame, time: number, reduced: boolean) {
    last = [frame, time, reduced];

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(width / 720, height / 1080);
    const offsetX = (width - scale * 720) / 2;
    const offsetY = (height - scale * 1080) / 2;

    ctx.setTransform(
      scale * dpr, 0, 0, scale * dpr,
      offsetX * dpr, offsetY * dpr,
    );

    const room = Math.max(0, Math.min(1, frame.env.room));

    if (room < 0.999) {
      outdoors(frame, time, reduced, 1 - room);
    }

    if (room > 0.001) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        185,
        145 + frame.env.windowY,
        350,
        445,
        104,
      );
      ctx.clip();
      outdoors(frame, time, reduced, room);
      ctx.restore();
    }

    // Multiplane Floating Hearts with Depth Layering
    if (!reduced && frame.env.hearts > 0.001) {
      for (let index = 0; index < 18; index++) {
        const x =
          70 + random(index + 900) * 580 +
          Math.sin(time * 0.6 + index) * 12;
        const y =
          (
            random(index + 950) * 1120 +
            time * (22 + (index % 4) * 5)
          ) % 1120 - 20;

        if (y > 525 && y < 655) continue;

        ctx.globalAlpha =
          frame.env.hearts *
          (0.25 + random(index + 990) * 0.3);
        ctx.fillStyle = index % 2 ? "#e5afc2" : "#cab2db";

        heart(x, y, 5 + random(index + 1020) * 5);
      }
    }

    ctx.globalAlpha = 1;
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

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
