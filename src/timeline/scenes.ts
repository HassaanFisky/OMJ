import type { Action } from "./score";

export const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

export interface Pose {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  alpha: number;
  head: number;
  look: number;
  sad: number;
  closed: number;
  tear: number;
  sit: number;
  walk: number;
  nervous: number;
  back: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
}

export interface Environment {
  room: number;
  window: number;
  windowY: number;
  curtains: number;
  bench: number;
  sun: number;
  cold: number;
  stars: number;
  rain: number;
  snow: number;
  hearts: number;
  mist: number;
  title: number;
  message: number;
  gifts: number;
  flowers: number;
  phone: number;
  thought: number;
  quilt: number;
  lantern: number;
  letter: number;
  hold: number;
  hug: number;
  zoom: number;
  alpha: number;
  camX: number;
  camY: number;
}

export interface Frame {
  action: Action;
  progress: number;
  a: Pose;
  b: Pose;
  env: Environment;
}

export interface Beat {
  at: number;
  frame: Frame;
}

function pose(x: number): Pose {
  return {
    x,
    y: 878,
    scale: 1,
    rotation: 0,
    alpha: 1,
    head: 0,
    look: 0,
    sad: 0,
    closed: 0,
    tear: 0,
    sit: 0,
    walk: 0,
    nervous: 0,
    back: 0,
    leftX: -61,
    leftY: -29,
    rightX: 61,
    rightY: -29,
  };
}

export function cloneFrame(frame: Frame): Frame {
  return {
    ...frame,
    a: { ...frame.a },
    b: { ...frame.b },
    env: { ...frame.env },
  };
}

export function targetFor(action: Action): Frame {
  const frame: Frame = {
    action,
    progress: 0,
    a: pose(275),
    b: pose(455),
    env: {
      room: 0,
      window: 0,
      windowY: 0,
      curtains: 0,
      bench: 0,
      sun: 0,
      cold: 0,
      stars: 0.75,
      rain: 0,
      snow: 0,
      hearts: 0,
      mist: 0,
      title: 0,
      message: 0,
      gifts: 0,
      flowers: 0,
      phone: 0,
      thought: 0,
      quilt: 0,
      lantern: 0,
      letter: 0,
      hold: 0,
      hug: 0,
      zoom: 1,
      alpha: 1,
      camX: 0,
      camY: 0,
    },
  };

  const { a, b, env } = frame;

  if (action.startsWith("chorus")) {
    const second = action.startsWith("chorus2");
    const step = Number(action.split("-")[1]);

    env.title = [1, 0, 0, 0.8, 0.55, 0, 0, 1][step] ?? 0;
    env.rain = second
      ? 0
      : ([0.65, 0.55, 0.45, 0.3, 0.2, 0.1, 0.05, 0.0][step] ?? 0);
    env.sun = second
      ? ([0.45, 0.55, 0.65, 0.75, 0.8, 0.85, 0.9, 0.95][step] ?? 0.8)
      : ([0.0, 0.0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.65][step] ?? 0);
    env.stars = second ? 0.2 : (env.rain > 0.2 ? 0.2 : 0.6 - env.sun * 0.4);
    env.hearts = second ? 0.12 + step * 0.035 : 0;
    env.zoom = 1 + (step % 3) * 0.007;

    a.x = second ? 305 : 275;
    b.x = second ? 425 : 465;
    a.y = 913;
    b.y = 913;
    a.sit = 1;
    b.sit = 1;
    a.head = step % 2 ? -6 : 4;
    b.head = step % 2 ? 6 : -4;
    b.alpha = second ? 1 : 0.72;
    env.bench = 0.65;
    env.hold = second ? 0.65 : 0;

    return frame;
  }

  switch (action) {
    case "intro":
      env.room = 1;
      env.window = 1;
      env.bench = 1;
      a.y = 913;
      a.sit = 1;
      a.head = -8;
      a.closed = 0.1;
      b.alpha = 0;
      b.x = 665;
      break;

    case "waiting":
      env.room = 1;
      env.window = 1;
      env.bench = 1;
      env.letter = 1;
      a.y = 913;
      a.sit = 1;
      a.head = -10;
      a.look = 4;
      a.sad = 0.35;
      b.alpha = 0;
      b.x = 665;
      break;

    case "help":
      env.room = 1;
      env.window = 1;
      env.bench = 1;
      env.message = 1;
      env.hold = 1;
      a.x = 285;
      b.x = 435;
      a.y = 913;
      b.y = 913;
      a.sit = 1;
      b.sit = 1;
      break;

    case "only":
      env.room = 0.6;
      env.window = 0.6;
      env.bench = 0.8;
      a.y = 913;
      b.y = 913;
      a.sit = 1;
      b.sit = 1;
      b.x = 465;
      a.look = 4;
      a.head = 5;
      break;

    case "kiss":
      a.x = 305;
      b.x = 425;
      a.rotation = 5;
      b.rotation = -4;
      a.head = 11;
      b.head = -11;
      a.closed = 0.75;
      b.closed = 0.75;
      env.hug = 0.9;
      env.hearts = 0.3;
      env.sun = 0.15;
      env.camY = -28;
      env.zoom = 1.15;
      // Arms reaching toward each other for a natural embrace
      a.rightX = 72;
      a.rightY = -60;
      b.leftX = -72;
      b.leftY = -60;
      break;

    case "leaving":
      a.sad = 1;
      a.tear = 1;
      a.look = 5;
      b.x = 675;
      b.alpha = 0.45;
      b.walk = 1;
      b.look = 5;
      env.camX = 35;
      env.camY = -10;
      break;

    case "neglected":
      a.sad = 0.95;
      a.tear = 0.75;
      a.head = 12;
      b.x = 750;
      b.alpha = 0;
      env.rain = 0.15;
      env.camX = 40;
      env.camY = -15;
      break;

    case "sky":
    case "mist":
      a.x = 205;
      a.y = 925;
      a.rotation = 90;
      a.head = -12;
      a.sad = 0.7;
      b.alpha = 0;
      env.stars = 1;
      env.zoom = 1.08;
      env.camY = -130;
      env.mist = action === "mist" ? 1 : 0;
      break;

    case "nervous":
      env.room = 1;
      env.window = 1;
      env.letter = 1;
      a.x = 285;
      a.nervous = 1;
      a.head = 12;
      a.sad = 0.3;
      b.head = -5;
      break;

    case "disagree":
      env.room = 1;
      env.window = 1;
      a.head = 11;
      a.sad = 0.6;
      b.head = -15;
      b.look = 5;
      b.rotation = -4;
      b.leftX = -22;
      b.leftY = -46;
      b.rightX = 20;
      b.rightY = -47;
      break;

    case "gifts":
      env.room = 0.8;
      env.window = 0.8;
      env.gifts = 1;
      env.flowers = 1;
      a.rightX = 98;
      a.rightY = -65;
      b.leftX = -85;
      b.leftY = -40;
      break;

    case "hearts":
      env.gifts = 0.6;
      env.flowers = 0.5;
      env.hearts = 1;
      env.sun = 0.2;
      a.rightX = 82;
      a.rightY = -32;
      b.leftX = -82;
      b.leftY = -32;
      break;

    case "exhausted":
      env.bench = 1;
      a.y = 915;
      a.sit = 1;
      a.head = 16;
      a.rotation = 6;
      a.sad = 1;
      b.alpha = 0.7;
      env.hearts = 0.12;
      break;

    case "winter":
    case "comfort":
      env.room = 1;
      env.window = 1;
      env.snow = 1;
      env.cold = 1;
      a.sad = 0.9;
      a.head = 10;
      b.x = 420;
      b.head = -7;

      if (action === "comfort") {
        a.tear = 0.3;
        b.leftX = -105;
        b.leftY = -75;
      }
      break;

    case "call":
      env.title = 1;
      env.snow = 0.35;
      env.cold = 0.5;
      a.head = -11;
      break;

    case "devotion":
      env.lantern = 1;
      a.rightX = 100;
      a.rightY = -80;
      a.head = 5;
      b.head = -4;
      break;

    case "unnoticed":
      env.lantern = 1;
      a.rightX = 92;
      a.rightY = -58;
      a.sad = 0.5;
      b.look = 5;
      b.head = -10;
      break;

    case "phone":
      env.phone = 1;
      a.rightX = 90;
      a.rightY = -45;
      a.sad = 0.65;
      b.head = 13;
      b.look = -5;
      b.leftX = -12;
      b.leftY = -65;
      b.rightX = 15;
      b.rightY = -65;
      break;

    case "thought":
    case "dream":
      env.thought = action === "dream" ? 1 : 0.65;
      env.camY = -140;
      env.zoom = 1.12;
      a.head = -12;
      a.look = 3;
      b.alpha = action === "dream" ? 0 : 0.4;
      break;

    case "reach":
      a.rightX = 100;
      a.rightY = -58;
      b.x = 465;
      b.leftX = -90;
      b.leftY = -50;
      break;

    case "lap":
      env.bench = 1;
      env.sun = 0.18;
      env.camX = -15;
      env.camY = -22;
      env.zoom = 1.18;
      // Teddy B sits naturally on the bed, slightly left of centre
      b.x = 420;
      b.y = 915;
      b.sit = 1;
      b.head = -10;
      // B's left arm caresses resting A
      b.leftX = -45;
      b.leftY = -35;
      b.rightX = 28;
      b.rightY = -40;

      // Teddy A lies across B's lap — rotation 90° so body is horizontal
      // x offset: position head at B's lap. With rotation=90, local +x is world +y
      // so head (at local x=+150) must map to world-x of b.x-22.
      // => a.x + 150 * a.scale ≈ b.x - 22  →  a.x = b.x - 22 - 150 * a.scale
      a.rotation = 90;
      a.x = b.x - 22 - 150 * a.scale;  // head centred over B's lap
      a.y = b.y - 12;    // resting on B's thighs, elevated above ground
      a.closed = 0.8;    // sleepy/peaceful eyes
      a.head = -8;       // slight chin-tuck comfort
      a.sad = 0;
      // A's arms dangle naturally when lying down
      a.leftX = -30;
      a.leftY = 20;
      a.rightX = 30;
      a.rightY = 20;
      break;

    case "eyes":
      a.x = 300;
      b.x = 430;
      a.look = 4;
      b.look = -4;
      a.head = 5;
      b.head = -5;
      env.hearts = 0.55;
      break;

    case "embrace":
      a.x = 310;
      b.x = 420;
      a.rotation = 5;
      b.rotation = -5;
      a.head = 11;
      b.head = -11;
      a.closed = 0.75;
      b.closed = 0.75;
      env.hug = 1;
      env.sun = 1;
      env.hearts = 0.8;
      env.camY = -25;
      env.zoom = 1.15;
      // Full wrap-around hug — both arms around each other
      a.leftX = -58;
      a.leftY = -50;
      a.rightX = 58;
      a.rightY = -50;
      b.leftX = -58;
      b.leftY = -50;
      b.rightX = 58;
      b.rightY = -50;
      break;

    case "window":
      env.room = 1;
      env.window = 1;
      env.windowY = 160;
      env.curtains = 1;
      env.sun = 0.25;
      env.hearts = 0.12;
      env.camY = 15;
      env.zoom = 1.02;
      a.x = 290;
      b.x = 435;
      // Both fully facing away (back = 1), natural waist-level framing
      a.back = 1;
      b.back = 1;
      // Heads align naturally with bodies looking at window (no neck twist)
      a.head = 0;
      b.head = 0;
      // Arms rest naturally at sides when facing back
      a.leftX = -48;
      a.leftY = -55;
      a.rightX = 48;
      a.rightY = -55;
      b.leftX = -48;
      b.leftY = -55;
      b.rightX = 48;
      b.rightY = -55;
      break;

    case "quilt":
    case "tail":
      env.room = 1;
      env.window = 1;
      env.windowY = 160;
      env.curtains = 1;
      env.quilt = 1;
      env.snow = 1;
      env.cold = 0.7;
      env.bench = 1;
      env.camY = -15;
      env.zoom = 1.06;
      a.x = 290;
      b.x = 435;
      a.y = 915;
      b.y = 915;
      a.sit = 1;
      b.sit = 1;
      // Gentle settled expressions — slightly droopy with peaceful tiredness
      a.head = 6;
      b.head = -6;
      a.closed = 0.6;
      b.closed = 0.6;
      // Arms tucked under quilt
      a.leftX = -38;
      a.leftY = -18;
      a.rightX = 38;
      a.rightY = -18;
      b.leftX = -38;
      b.leftY = -18;
      b.rightX = 38;
      b.rightY = -18;
      break;

    default:
      throw new Error(`Unimplemented scene action: ${String(action)}`);
  }

  return frame;
}

export function beatsFor(action: Action, seconds: number): Beat[] {
  const target = targetFor(action);
  const settle = Math.min(0.4, 0.65 / seconds);

  if (action === "intro") {
    const glance = cloneFrame(target);
    glance.a.head = -13;
    glance.a.look = 4;

    return [
      { at: 0.25, frame: target },
      { at: 0.65, frame: glance },
      { at: 1, frame: target },
    ];
  }

  if (action === "help") {
    const arrival = cloneFrame(target);
    arrival.b.walk = 1;
    arrival.b.sit = 0;
    arrival.b.y = 878;

    const lift = cloneFrame(target);
    lift.a.sit = 0;
    lift.a.y = 878;
    lift.b.sit = 0;
    lift.b.y = 878;

    return [
      { at: 0.3, frame: arrival },
      { at: 0.62, frame: lift },
      { at: 1, frame: target },
    ];
  }

  if (action === "only") {
    const left = cloneFrame(target);
    left.a.look = -6;
    left.a.head = -8;

    const right = cloneFrame(target);
    right.a.look = 6;
    right.a.head = 8;

    return [
      { at: 0.25, frame: left },
      { at: 0.6, frame: right },
      { at: 1, frame: target },
    ];
  }

  if (action === "kiss") {
    const approach = cloneFrame(target);
    approach.a.x = 295;
    approach.b.x = 440;
    approach.a.closed = 0;
    approach.b.closed = 0;
    approach.env.hearts = 0;

    return [
      { at: 0.25, frame: approach },
      { at: 0.7, frame: target },
      { at: 1, frame: target },
    ];
  }

  if (action === "leaving") {
    const notice = cloneFrame(target);
    notice.b.x = 495;
    notice.b.alpha = 1;

    return [
      { at: 0.25, frame: notice },
      { at: 1, frame: target },
    ];
  }

  if (action === "gifts") {
    const first = cloneFrame(target);
    first.env.gifts = 0.25;
    first.env.flowers = 0;

    const middle = cloneFrame(target);
    middle.env.gifts = 0.65;
    middle.env.flowers = 0.5;

    return [
      { at: 0.25, frame: first },
      { at: 0.6, frame: middle },
      { at: 1, frame: target },
    ];
  }

  if (action === "lap") {
    const seated = cloneFrame(target);
    seated.a.rotation = 0;
    seated.a.x = 285;
    seated.a.y = 915;
    seated.a.sit = 1;
    seated.a.closed = 0.3;

    return [
      { at: 0.2, frame: seated },
      { at: 0.75, frame: target },
      { at: 1, frame: target },
    ];
  }

  if (action === "tail") {
    const distant = cloneFrame(target);
    distant.env.zoom = 0.78;
    distant.env.camY = 75;
    distant.env.snow = 0.4;
    distant.env.stars = 1;

    const gone = cloneFrame(distant);
    gone.env.alpha = 0;
    gone.env.zoom = 0.72;
    gone.env.camY = 110;

    return [
      { at: 0.15, frame: target },
      { at: 0.6, frame: distant },
      { at: 1, frame: gone },
    ];
  }

  return [
    { at: settle, frame: target },
    { at: 1, frame: target },
  ];
}

export function worldPoint(pose: Pose, x: number, y: number) {
  const angle = pose.rotation * Math.PI / 180;

  return {
    x: pose.x + (x * Math.cos(angle) - y * Math.sin(angle)) * pose.scale,
    y: pose.y + (x * Math.sin(angle) + y * Math.cos(angle)) * pose.scale,
  };
}

export function attachHand(
  pose: Pose,
  side: "left" | "right",
  x: number,
  y: number,
  strength: number,
) {
  const angle = -pose.rotation * Math.PI / 180;
  const dx = (x - pose.x) / pose.scale;
  const dy = (y - pose.y) / pose.scale;
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

  if (side === "left") {
    pose.leftX += (localX - pose.leftX) * strength;
    pose.leftY += (localY - pose.leftY) * strength;
  } else {
    pose.rightX += (localX - pose.rightX) * strength;
    pose.rightY += (localY - pose.rightY) * strength;
  }
}
