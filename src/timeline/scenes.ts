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
  lookY: number;
  sad: number;
  smile: number;
  closed: number;
  tear: number;
  sit: number;
  kneel: number;
  walk: number;
  nervous: number;
  back: number;
  kissMark: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
}

export interface Environment {
  room: number;
  window: number;
  windowY: number;
  stools: number;
  curtains: number;
  bench: number;
  sun: number;
  cold: number;
  stars: number;
  clouds: number;
  rain: number;
  snow: number;
  frost: number;
  hearts: number;
  petals: number;
  mist: number;
  firefly: number;
  title: number;
  message: number;
  gifts: number;
  giftTransfer: number; // 0 = in Mochi's hands, 0.5 = mid handover contact, 1 = in Yume's hands
  flowers: number;
  ringbox: number;
  cigarette: number;
  phone: number;
  thought: number;
  dreamEnter: number;
  quilt: number;
  sharedScarf: number;
  photoGlow: number;
  lantern: number;
  letter: number;
  hold: number;
  hug: number;
  zoom: number;
  alpha: number;
  camX: number; // horizontal focus center in bedroom world (opening 460 -> 1290)
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

export const FLOOR_Y = 858;
export const BED_SEAT_Y = 885;
export const MIRROR_CENTER_X = 1205;

function pose(x: number, y = FLOOR_Y): Pose {
  return {
    x,
    y,
    scale: 1,
    rotation: 0,
    alpha: 1,
    head: 0,
    look: 0,
    lookY: 0,
    sad: 0,
    smile: 0.2,
    closed: 0,
    tear: 0,
    sit: 0,
    kneel: 0,
    walk: 0,
    nervous: 0,
    back: 0,
    kissMark: 0,
    leftX: -54,
    leftY: -26,
    rightX: 54,
    rightY: -26,
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
    a: pose(420),
    b: pose(610),
    env: {
      room: 1,
      window: 1,
      windowY: 0,
      stools: 0,
      curtains: 0.25,
      bench: 1,
      sun: 0,
      cold: 0,
      stars: 0.78,
      clouds: 0,
      rain: 0,
      snow: 0,
      frost: 0,
      hearts: 0,
      petals: 0,
      mist: 0,
      firefly: 0,
      title: 0,
      message: 0,
      gifts: 0,
      giftTransfer: 0,
      flowers: 0,
      ringbox: 0,
      cigarette: 0,
      phone: 0,
      thought: 0,
      dreamEnter: 0,
      quilt: 0,
      sharedScarf: 0,
      photoGlow: 0,
      lantern: 0,
      letter: 0,
      hold: 0,
      hug: 0,
      zoom: 1,
      alpha: 1,
      camX: 480,
      camY: 0,
    },
  };

  const { a, b, env } = frame;

  // ── Progressive Chorus 1 (Cues 9–16) & Chorus 2 (Cues 32–39) ─────────────
  if (action.startsWith("chorus")) {
    const second = action.startsWith("chorus2");
    const step = Number(action.split("-")[1]);

    if (!second) {
      // CHORUS 1: Progressive longing -> warm memory -> petals -> gentle reach
      env.camX = 650 + step * 24;
      env.camY = 8;
      env.room = 1;
      env.window = 1;
      env.rain = [0.55, 0.42, 0.28, 0.14, 0, 0, 0, 0][step] ?? 0;
      env.clouds = env.rain > 0.1 ? 0.55 : 0.15;
      env.sun = [0, 0, 0.08, 0.22, 0.34, 0.45, 0.52, 0.58][step] ?? 0.3;
      env.stars = env.sun > 0.15 ? 0 : 0.5;
      env.photoGlow = step === 3 ? 1 : step > 3 ? 0.35 : 0;
      env.petals = step === 5 ? 1 : step === 6 ? 0.35 : 0;
      env.hearts = step >= 6 ? 0.2 : 0;
      env.zoom = [0.95, 1.0, 1.05, 1.08, 1.18, 1.12, 1.1, 1.02][step] ?? 1;

      a.x = 580 + step * 18;
      b.x = 760 + step * 10;
      a.y = FLOOR_Y;
      b.y = FLOOR_Y;
      a.look = 4;
      b.look = step % 2 ? -3 : -5;
      a.head = [4, 7, 5, -3, 6, 4, 8, 3][step] ?? 4;
      b.head = [-3, -6, -4, 3, -6, -4, -7, -3][step] ?? -4;
      a.smile = 0.25 + step * 0.05;
      b.smile = 0.3 + step * 0.05;
      a.kissMark = step <= 2 ? 0.3 : 0;

      // Progressive arm choreography (no identical repetition!)
      if (step === 1 || step === 6) {
        a.rightX = 88;
        a.rightY = -56;
        b.leftX = -82;
        b.leftY = -54;
      } else if (step === 2) {
        a.rightX = 62;
        a.rightY = -44;
        a.nervous = 0.35;
      } else if (step === 3) {
        // Point/look warmly toward framed wall photo memory
        a.head = -8;
        a.look = 5;
        b.head = -6;
        b.look = 5;
      } else if (step === 4) {
        a.x += 12;
        b.x -= 12;
      }
      return frame;
    }

    // CHORUS 2: Mutual connection -> joined hands -> dance -> shared scarf + firefly -> full embrace
    env.camX = 1110 + step * 10;
    env.camY = step === 3 || step === 4 ? 14 : 6;
    env.room = 1;
    env.window = 1;
    env.sun = [0.35, 0.45, 0.55, 0.65, 0.72, 0.78, 0.85, 0.9][step] ?? 0.6;
    env.stars = 0;
    env.hearts = 0.25 + step * 0.075;
    env.firefly = step === 5 ? 1 : 0;
    env.sharedScarf = step === 5 ? 1 : 0;
    env.photoGlow = step === 6 ? 0.85 : 0.25;
    env.zoom = [1.02, 1.08, 1.04, 1.18, 1.2, 1.12, 1.06, 1.14][step] ?? 1.06;

    a.x = 1065 + step * 10;
    b.x = 1175 + step * 6;
    a.y = FLOOR_Y;
    b.y = FLOOR_Y;
    a.smile = 0.75 + step * 0.03;
    b.smile = 0.8 + step * 0.03;
    a.look = 4;
    b.look = -4;

    if (step === 0) {
      a.head = 5;
      b.head = -5;
    } else if (step === 1) {
      env.hold = 1;
      a.head = 6;
      b.head = -6;
    } else if (step === 2) {
      // Gentle swaying dance
      env.hold = 0.9;
      a.rotation = -4;
      b.rotation = 4;
      a.walk = 0.4;
      b.walk = 0.4;
    } else if (step === 3 || step === 4) {
      // Close two-shot & cheek closeness
      a.x += 12;
      b.x -= 12;
      a.head = 9;
      b.head = -9;
      a.closed = step === 4 ? 0.5 : 0.15;
      b.closed = step === 4 ? 0.55 : 0.15;
      env.hold = 0.8;
    } else if (step === 5) {
      // Tender scarf comfort + firefly
      a.rightX = 88;
      a.rightY = -72;
      b.leftX = -75;
      b.leftY = -58;
    } else if (step === 6) {
      // Warm corner glide
      env.hold = 0.9;
      a.head = 7;
      b.head = -7;
    } else if (step === 7) {
      // Full affectionate embrace
      a.x = 1135;
      b.x = 1215;
      a.rotation = 5;
      b.rotation = -5;
      a.head = 10;
      b.head = -10;
      a.closed = 0.7;
      b.closed = 0.7;
      env.hug = 1;
    }
    return frame;
  }

  switch (action) {
    case "intro":
      env.camX = 480;
      env.stars = 0.8;
      a.x = 390;
      a.y = FLOOR_Y;
      a.head = -7;
      a.look = -2;
      a.smile = 0.25;
      b.alpha = 0;
      b.x = 690;
      break;

    case "waiting":
      env.camX = 495;
      env.letter = 1;
      a.x = 395;
      a.y = FLOOR_Y;
      a.head = -10;
      a.look = 3;
      a.sad = 0.35;
      a.smile = 0.1;
      a.rightX = 64;
      a.rightY = -44;
      b.alpha = 0;
      b.x = 700;
      break;

    case "help":
      env.camX = 520;
      env.message = 1;
      env.hold = 0.85;
      a.x = 425;
      b.x = 565;
      a.look = 4;
      b.look = -4;
      a.smile = 0.55;
      b.smile = 0.7;
      break;

    case "only":
      env.camX = 545;
      a.x = 450;
      b.x = 585;
      a.head = 5;
      a.look = 4;
      b.look = -4;
      a.smile = 0.45;
      b.smile = 0.55;
      break;

    case "kiss":
      env.camX = 560;
      env.camY = 14;
      env.zoom = 1.22;
      env.hug = 0.9;
      env.hearts = 0.35;
      env.sun = 0.22;
      a.x = 492;
      b.x = 602;
      a.rotation = 6;
      b.rotation = -6;
      a.head = 12;
      b.head = -12;
      a.closed = 0.88;
      b.closed = 0.88;
      a.smile = 0.85;
      b.smile = 0.85;
      a.kissMark = 0.45;
      a.rightX = 72;
      a.rightY = -58;
      b.leftX = -72;
      b.leftY = -58;
      break;

    case "leaving":
      env.camX = 600;
      a.x = 485;
      a.sad = 0.95;
      a.tear = 0.95;
      a.smile = 0;
      a.look = 5;
      a.kissMark = 0.45;
      b.x = 760;
      b.alpha = 0.8;
      b.walk = 1;
      b.look = 4;
      b.head = -5;
      b.smile = 0.1;
      break;

    case "neglected":
      env.camX = 620;
      env.rain = 0.68;
      env.clouds = 0.75;
      env.stars = 0;
      a.x = 515;
      a.sad = 0.92;
      a.tear = 0.75;
      a.smile = 0;
      a.head = 11;
      a.kissMark = 0.35;
      b.x = 880;
      b.alpha = 0;
      break;

    case "sky":
      env.camX = 635;
      env.camY = -30;
      env.zoom = 1.1;
      env.stars = 1;
      env.clouds = 0;
      a.x = 550;
      a.head = -15;
      a.lookY = -4;
      a.sad = 0.65;
      a.smile = 0.05;
      b.alpha = 0;
      break;

    case "mist":
      env.camX = 648;
      env.camY = -10;
      env.zoom = 1.16;
      env.mist = 1;
      env.clouds = 0.35;
      env.stars = 0.45;
      a.x = 570;
      a.head = -8;
      a.sad = 0.8;
      a.tear = 0.45;
      a.smile = 0;
      b.alpha = 0;
      break;

    case "nervous":
      // Cue 17: Yume walks slowly away toward mirror; Mochi follows & kneels with open ring box
      env.camX = 950;
      env.ringbox = 1;
      a.x = 920;
      a.y = FLOOR_Y - 2;
      a.rotation = 5;
      a.kneel = 1;
      a.head = -6;
      a.look = 5;
      a.sad = 0.35;
      a.nervous = 0.55;
      a.smile = 0.1;
      a.leftX = 48;
      a.leftY = -56;
      a.rightX = 62;
      a.rightY = -56;
      // Yume near dressing mirror (reflection visible!)
      b.x = 1150;
      b.head = 7;
      b.look = 4;
      b.sad = 0.35;
      b.smile = 0.05;
      b.walk = 0.3;
      break;

    case "disagree":
      // Cue 18: Yume hurt/hesitant (not villainous), Mochi lowers gaze while kneeling patiently
      env.camX = 975;
      env.ringbox = 1;
      a.x = 945;
      a.y = FLOOR_Y - 2;
      a.rotation = 4;
      a.kneel = 1;
      a.head = 12;
      a.look = 3;
      a.sad = 0.68;
      a.smile = 0;
      a.leftX = 46;
      a.leftY = -52;
      a.rightX = 60;
      a.rightY = -52;
      b.x = 1170;
      b.head = -11;
      b.look = 5;
      b.sad = 0.48;
      b.smile = 0.05;
      b.leftX = -24;
      b.leftY = -44;
      b.rightX = 22;
      b.rightY = -44;
      break;

    case "gifts":
      // Cue 19: Direct hand-to-hand handover of gift box + flowers
      env.camX = 995;
      env.gifts = 1;
      env.flowers = 1;
      env.giftTransfer = 1;
      a.x = 985;
      b.x = 1130;
      a.look = 4;
      b.look = -4;
      a.smile = 0.65;
      b.smile = 0.55;
      a.rightX = 82;
      a.rightY = -52;
      b.leftX = -82;
      b.leftY = -52;
      break;

    case "hearts":
      // Cue 20: Yume holds received flowers in front of mirror; warm sunlight + floating hearts
      env.camX = 1015;
      env.gifts = 0.35;
      env.flowers = 1;
      env.giftTransfer = 1;
      env.hearts = 0.85;
      env.sun = 0.32;
      env.stars = 0;
      a.x = 1015;
      b.x = 1175; // Right near mirror (1205) so reflection glows warmly!
      a.smile = 0.72;
      b.smile = 0.78;
      a.look = 4;
      b.look = -3;
      b.leftX = -42;
      b.leftY = -46;
      b.rightX = 22;
      b.rightY = -48;
      break;

    case "exhausted":
      // Cue 21: Restrained brief cigarette melancholic moment
      env.camX = 1030;
      env.cigarette = 1;
      env.hearts = 0;
      a.x = 1005;
      a.y = FLOOR_Y + 14;
      a.sit = 1;
      a.head = 13;
      a.rotation = 4;
      a.sad = 0.85;
      a.smile = 0;
      a.closed = 0.82;
      a.rightX = 64;
      a.rightY = -62;
      b.x = 1230;
      b.alpha = 0.65;
      b.sad = 0.4;
      break;

    case "winter":
      // Cue 22: Winter transformation outside window + glass edge frost
      env.camX = 1040;
      env.snow = 0.92;
      env.frost = 0.88;
      env.cold = 0.9;
      env.clouds = 0.45;
      env.stars = 0.2;
      a.x = 995;
      b.x = 1155;
      a.sad = 0.75;
      a.head = 8;
      b.head = -6;
      b.sad = 0.3;
      break;

    case "comfort":
      // Cue 23: Restrained comfort attempt
      env.camX = 1050;
      env.snow = 0.75;
      env.frost = 0.8;
      env.cold = 0.8;
      env.clouds = 0.35;
      a.x = 1010;
      b.x = 1120;
      a.sad = 0.55;
      a.tear = 0.25;
      a.head = 9;
      b.head = -8;
      b.sad = 0.2;
      b.smile = 0.35;
      b.leftX = -86;
      b.leftY = -64;
      break;

    case "call":
      // Cue 24: Reconnection glance
      env.camX = 1060;
      env.snow = 0.45;
      env.frost = 0.45;
      env.cold = 0.45;
      a.x = 1020;
      b.x = 1140;
      a.head = -6;
      b.head = 6;
      a.look = 4;
      b.look = -4;
      a.smile = 0.5;
      b.smile = 0.55;
      break;

    case "devotion":
      // Cue 25: Sharing/wrapping scarf affectionately + warm lantern
      env.camX = 1070;
      env.lantern = 0.85;
      env.sharedScarf = 1;
      a.x = 1045;
      b.x = 1145;
      a.head = 6;
      b.head = -6;
      a.smile = 0.7;
      b.smile = 0.75;
      a.rightX = 88;
      a.rightY = -74;
      b.leftX = -66;
      b.leftY = -56;
      break;

    case "unnoticed":
      // Cue 26: Quiet unspoken distance right in front of Dressing Table Mirror (1205)
      env.camX = 1080;
      env.lantern = 0.5;
      a.x = 1165; // Directly before the mirror -> clear reflection!
      b.x = 1285;
      a.sad = 0.45;
      a.look = 4;
      b.look = 5;
      b.head = -8;
      a.rightX = 76;
      a.rightY = -48;
      break;

    case "phone":
      // Cue 27: Yume reads phone (back of phone faces viewer, screen faces Yume!)
      env.camX = 1090;
      env.phone = 1;
      a.x = 1045;
      b.x = 1190; // Right in front of mirror
      a.sad = 0.6;
      a.look = 5;
      b.head = 12;
      b.look = -3;
      b.lookY = 4;
      b.leftX = -18;
      b.leftY = -62;
      b.rightX = 16;
      b.rightY = -62;
      break;

    case "thought":
      // Cue 28: Thought bubbles rise from Mochi's head while both remain visible in bedroom
      env.camX = 1105;
      env.camY = -70;
      env.zoom = 1.08;
      env.thought = 1;
      env.dreamEnter = 0.22;
      a.x = 1055;
      b.x = 1215;
      b.alpha = 0.9;
      a.head = -12;
      a.look = 3;
      a.lookY = -4;
      break;

    case "dream":
      // Cue 29: Camera glides upward into scalloped fluffy cloud portal while Mochi & Yume stay below
      env.camX = 1110;
      env.camY = -145;
      env.zoom = 1.14;
      env.thought = 1;
      env.dreamEnter = 1;
      env.hearts = 0.55;
      env.sun = 0.45;
      env.stars = 0;
      a.x = 1060;
      b.x = 1215;
      a.head = -10;
      b.alpha = 0.92;
      break;

    case "reach":
      // Cue 30: Back in bedroom; Yume approaches & reaches toward Mochi
      env.camX = 1135;
      a.x = 1075;
      b.x = 1215;
      a.look = 4;
      b.look = -4;
      a.smile = 0.65;
      b.smile = 0.72;
      a.rightX = 88;
      a.rightY = -56;
      b.leftX = -88;
      b.leftY = -54;
      break;

    case "lap":
      // Cue 31: Exact Lap-Rest on Diagonal Wooden Bed!
      // Yume (B) sits comfortably on bed; Mochi (A) lies horizontally with head on B's lap.
      env.camX = 1240;
      env.camY = 20;
      env.zoom = 1.2;
      env.sun = 0.25;
      env.stars = 0;
      b.x = 1480;
      b.y = BED_SEAT_Y;
      b.sit = 1;
      b.rotation = 0;
      b.head = -10;
      b.smile = 0.85;
      b.leftX = -52;
      b.leftY = -44;
      b.rightX = 32;
      b.rightY = -36;

      // Exact geometric lock: a.x + 150 * a.scale === b.x - 22
      a.rotation = 90;
      a.x = b.x - 22 - 150 * a.scale;
      a.y = b.y - 24;
      a.closed = 0.84;
      a.head = -8;
      a.sad = 0;
      a.smile = 0.85;
      a.leftX = -26;
      a.leftY = 16;
      a.rightX = 26;
      a.rightY = 16;
      break;

    case "eyes":
      env.camX = 1185;
      env.sun = 0.5;
      env.stars = 0;
      env.hearts = 0.6;
      a.x = 1125;
      b.x = 1225;
      a.look = 4;
      b.look = -4;
      a.head = 5;
      b.head = -5;
      a.smile = 0.9;
      b.smile = 0.9;
      break;

    case "embrace":
      env.camX = 1185;
      env.camY = 16;
      env.zoom = 1.2;
      env.sun = 0.85;
      env.stars = 0;
      env.hug = 1;
      env.hearts = 0.85;
      a.x = 1140;
      b.x = 1222;
      a.rotation = 5;
      b.rotation = -5;
      a.head = 11;
      b.head = -11;
      a.closed = 0.88;
      b.closed = 0.88;
      a.smile = 0.95;
      b.smile = 0.95;
      a.kissMark = 0.85;
      a.leftX = -54;
      a.leftY = -48;
      a.rightX = 56;
      a.rightY = -48;
      b.leftX = -56;
      b.leftY = -48;
      b.rightX = 54;
      b.rightY = -48;
      break;

    case "window":
      // Cue 42: Both bring wooden footstools below window sill & step up (back = 1)
      env.camX = 985;
      env.camY = -20;
      env.zoom = 1.04;
      env.stools = 1;
      env.curtains = 0.85;
      env.sun = 0;
      env.stars = 0.95;
      env.clouds = 0;
      env.hearts = 0.12;
      a.x = 925;
      b.x = 1045;
      a.y = 774;
      b.y = 774;
      a.back = 1;
      b.back = 1;
      a.head = 0;
      b.head = 0;
      a.leftX = -46;
      a.leftY = -48;
      a.rightX = 46;
      a.rightY = -48;
      b.leftX = -46;
      b.leftY = -48;
      b.rightX = 46;
      b.rightY = -48;
      break;

    case "quilt":
    case "tail":
      // Cue 43 & Outro: Both sit together on diagonal 3D bed under shared quilted razai, snow outside window
      env.camX = 1280;
      env.camY = 8;
      env.zoom = 1.05;
      env.curtains = 0.8;
      env.quilt = 1;
      env.snow = 0.95;
      env.frost = 0.72;
      env.cold = 0.65;
      env.sun = 0;
      env.stars = 0.6;
      env.clouds = 0.25;
      a.x = 1365;
      b.x = 1480;
      a.y = BED_SEAT_Y;
      b.y = BED_SEAT_Y;
      a.sit = 1;
      b.sit = 1;
      a.head = 6;
      b.head = -6;
      a.closed = 0.84;
      b.closed = 0.84;
      a.smile = 0.88;
      b.smile = 0.88;
      a.kissMark = 0.65;
      a.leftX = -38;
      a.leftY = -20;
      a.rightX = 38;
      a.rightY = -20;
      b.leftX = -38;
      b.leftY = -20;
      b.rightX = 38;
      b.rightY = -20;
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
    glance.a.head = -12;
    glance.a.look = 4;
    return [
      { at: 0.25, frame: target },
      { at: 0.65, frame: glance },
      { at: 1, frame: target },
    ];
  }

  if (action === "help") {
    const arrival = cloneFrame(target);
    arrival.b.x = 670;
    arrival.b.walk = 1;
    arrival.env.hold = 0;

    const meet = cloneFrame(target);
    meet.b.walk = 0.3;
    meet.env.hold = 0.6;

    return [
      { at: 0.3, frame: arrival },
      { at: 0.68, frame: meet },
      { at: 1, frame: target },
    ];
  }

  if (action === "only") {
    const left = cloneFrame(target);
    left.a.look = -4;
    left.a.head = -7;

    const right = cloneFrame(target);
    right.a.look = 5;
    right.a.head = 7;

    return [
      { at: 0.25, frame: left },
      { at: 0.62, frame: right },
      { at: 1, frame: target },
    ];
  }

  if (action === "kiss") {
    const approach = cloneFrame(target);
    approach.a.x = 485;
    approach.b.x = 620;
    approach.a.closed = 0;
    approach.b.closed = 0;
    approach.env.hearts = 0;

    return [
      { at: 0.25, frame: approach },
      { at: 0.68, frame: target },
      { at: 1, frame: target },
    ];
  }

  if (action === "leaving") {
    const notice = cloneFrame(target);
    notice.b.x = 605;
    notice.b.alpha = 1;
    notice.a.tear = 0.2;

    return [
      { at: 0.25, frame: notice },
      { at: 1, frame: target },
    ];
  }

  if (action === "nervous") {
    // Yume turns & walks right while Mochi follows gently and kneels
    const walkStart = cloneFrame(target);
    walkStart.a.x = 845;
    walkStart.a.y = FLOOR_Y;
    walkStart.a.kneel = 0;
    walkStart.a.walk = 0.8;
    walkStart.b.x = 1045;
    walkStart.b.walk = 0.9;
    walkStart.env.ringbox = 0;

    return [
      { at: 0.35, frame: walkStart },
      { at: 0.85, frame: target },
      { at: 1, frame: target },
    ];
  }

  if (action === "gifts") {
    // True continuous hand-to-hand transfer (0 -> 0.5 -> 1)
    const presentGift = cloneFrame(target);
    presentGift.env.giftTransfer = 0;
    presentGift.a.rightX = 64;
    presentGift.a.rightY = -48;
    presentGift.b.leftX = -52;
    presentGift.b.leftY = -36;

    const handContact = cloneFrame(target);
    handContact.env.giftTransfer = 0.5;
    handContact.a.rightX = 86;
    handContact.a.rightY = -54;
    handContact.b.leftX = -86;
    handContact.b.leftY = -54;

    return [
      { at: 0.28, frame: presentGift },
      { at: 0.62, frame: handContact },
      { at: 1, frame: target },
    ];
  }

  if (action === "dream") {
    // Smooth zoom into portal -> clear held kiss -> smooth return
    const enter = cloneFrame(target);
    enter.env.dreamEnter = 0.35;
    enter.env.zoom = 1.16;

    const holdKiss = cloneFrame(target);
    holdKiss.env.dreamEnter = 1;
    holdKiss.env.zoom = 1.24;

    const exit = cloneFrame(target);
    exit.env.dreamEnter = 0.25;
    exit.env.zoom = 1.06;

    return [
      { at: 0.2, frame: enter },
      { at: 0.72, frame: holdKiss },
      { at: 1, frame: exit },
    ];
  }

  if (action === "lap") {
    const settle = cloneFrame(target);
    settle.a.rotation = 0;
    settle.a.x = 1280;
    settle.a.y = BED_SEAT_Y;
    settle.a.sit = 1;
    settle.a.closed = 0.25;

    return [
      { at: 0.2, frame: settle },
      { at: 0.75, frame: target },
      { at: 1, frame: target },
    ];
  }

  if (action === "embrace") {
    const stepIn = cloneFrame(target);
    stepIn.a.x = 1120;
    stepIn.b.x = 1240;
    stepIn.a.closed = 0.1;
    stepIn.b.closed = 0.1;
    stepIn.env.hug = 0.3;

    return [
      { at: 0.28, frame: stepIn },
      { at: 0.72, frame: target },
      { at: 1, frame: target },
    ];
  }

  if (action === "window") {
    const bringStools = cloneFrame(target);
    bringStools.a.x = 960;
    bringStools.b.x = 1085;
    bringStools.a.y = FLOOR_Y;
    bringStools.b.y = FLOOR_Y;
    bringStools.a.walk = 0.75;
    bringStools.b.walk = 0.75;
    bringStools.a.back = 0.4;
    bringStools.b.back = 0.4;
    bringStools.env.stools = 0.7;

    const stepUp = cloneFrame(target);
    stepUp.a.y = 812;
    stepUp.b.y = 812;
    stepUp.a.sit = 0.35;
    stepUp.b.sit = 0.35;
    stepUp.a.back = 0.9;
    stepUp.b.back = 0.9;
    stepUp.env.stools = 1;

    return [
      { at: 0.28, frame: bringStools },
      { at: 0.58, frame: stepUp },
      { at: 1, frame: target },
    ];
  }

  if (action === "tail") {
    const pullBack = cloneFrame(target);
    pullBack.env.camX = 1180;
    pullBack.env.camY = -10;
    pullBack.env.zoom = 0.62;
    pullBack.env.snow = 0.82;
    pullBack.env.stars = 1;

    const finalGlobe = cloneFrame(pullBack);
    finalGlobe.env.alpha = 0.92;
    finalGlobe.env.zoom = 0.56;
    finalGlobe.env.camY = -20;

    return [
      { at: 0.15, frame: target },
      { at: 0.62, frame: pullBack },
      { at: 1, frame: finalGlobe },
    ];
  }

  return [
    { at: settle, frame: target },
    { at: 1, frame: target },
  ];
}

export function worldPoint(pose: Pose, x: number, y: number) {
  const angle = (pose.rotation * Math.PI) / 180;
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
  const angle = (-pose.rotation * Math.PI) / 180;
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
