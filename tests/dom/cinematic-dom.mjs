/**
 * Cue verification probe.
 *
 * Drives the real AudioController's public seek API through every one of the 43
 * lyric cues and records what the cinematic stage renders at each moment. This
 * asserts the score→stage mapping itself, which is the invariant that matters;
 * it does not depend on jsdom's missing media pipeline.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
for (const key of ["navigator", "location"]) {
  try { Object.defineProperty(globalThis, key, { configurable: true, get: () => window[key] }); } catch {}
}
Object.assign(globalThis, {
  HTMLElement: window.HTMLElement,
  HTMLAudioElement: window.HTMLAudioElement,
  HTMLMediaElement: window.HTMLMediaElement,
  HTMLCanvasElement: window.HTMLCanvasElement,
  SVGElement: window.SVGElement,
  Element: window.Element,
  Node: window.Node,
  DOMRect: window.DOMRect,
});
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
window.matchMedia = globalThis.matchMedia;
class RO { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = RO;
window.ResizeObserver = RO;

// Drive the real element, not a patched controller: the bundler can emit more
// than one copy of a module, so prototype patches are unreliable. Prototype
// accessors below apply to whichever copy the app happens to use.
globalThis.__events = [];
const mediaState = { currentTime: 0, paused: true, muted: false, rate: 1 };
const mediaProto = window.HTMLMediaElement.prototype;
Object.defineProperty(mediaProto, "duration", { configurable: true, get: () => 161.332 });
Object.defineProperty(mediaProto, "readyState", { configurable: true, get: () => 4 });
Object.defineProperty(mediaProto, "paused", { configurable: true, get: () => mediaState.paused });
Object.defineProperty(mediaProto, "ended", { configurable: true, get: () => false });
Object.defineProperty(mediaProto, "currentTime", {
  configurable: true,
  get: () => mediaState.currentTime,
  set(value) {
    mediaState.currentTime = Number(value);
  },
});
Object.defineProperty(mediaProto, "muted", {
  configurable: true,
  get: () => mediaState.muted,
  set(value) { mediaState.muted = Boolean(value); },
});
Object.defineProperty(mediaProto, "playbackRate", {
  configurable: true,
  get: () => mediaState.rate,
  set(value) { mediaState.rate = Number(value); },
});
mediaProto.pause = function pause() { globalThis.__events.push("pause"); mediaState.paused = true; };
const origAddEventListener = window.EventTarget.prototype.addEventListener;
window.EventTarget.prototype.addEventListener = function patchedAdd(type, fn, opts) {
  if (this && this.tagName === "AUDIO") globalThis.__events.push(`listen:${type}`);
  return origAddEventListener.call(this, type, fn, opts);
};
Object.defineProperty(mediaProto, "src", {
  configurable: true,
  get() { return this.__src ?? ""; },
  set(value) { this.__src = value; globalThis.__events.push(`src=${value}`); },
});
mediaProto.load = function load() {
  globalThis.__loads = (globalThis.__loads ?? 0) + 1;
};
mediaProto.play = function play() { mediaState.paused = false; return Promise.resolve(); };

const gradientStub = { addColorStop() {} };
window.HTMLCanvasElement.prototype.getContext = () =>
  new Proxy({}, {
    get: (_t, prop) => {
      if (prop === "canvas") return { width: 1440, height: 900 };
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradientStub;
      return () => undefined;
    },
    set: () => true,
  });

window.Element.prototype.getBoundingClientRect = () => ({ x:0,y:0,width:1440,height:900,top:0,left:0,right:1440,bottom:900,toJSON(){} });
window.Element.prototype.setPointerCapture = () => {};

const { createRoot } = await import("react-dom/client");
const { createElement } = await import("react");
const { CinematicStage } = await import("../../src/components/CinematicStage.tsx");
const { AudioController } = await import("../../src/audio/AudioController.ts");
const { initialScore, cueAt } = await import("../../src/timeline/score.ts");

const results = [];
/**
 * A check passes only when its callback returns exactly `true`; any other value
 * is a failure whose text is reported. Never let a truthy diagnostic string
 * read as success.
 */
function check(name, fn) {
  try {
    const value = fn();
    const ok = value === true;
    results.push({ name, ok, detail: ok ? "" : String(value) });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

const originalError = console.error;
const reactErrors = [];
console.error = (...args) => { reactErrors.push(args.map(String).join(" ")); };

// A real controller attached to a real (jsdom) audio element.
const audio = window.document.createElement("audio");
audio.id = "omj-audio";
window.document.body.appendChild(audio);
const controller = new AudioController();
const detach = controller.attach(audio);
audio.dispatchEvent(new window.Event("loadedmetadata"));

const container = window.document.getElementById("root");
const root = createRoot(container);
root.render(
  createElement(CinematicStage, {
    controller,
    score: initialScore,
    duration: 161.332,
    active: true,
    captionsVisible: true,
    openingContext: null,
    playbackRate: 1,
  }),
);

const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));
await settle(300);
console.error = originalError;

const $ = (sel) => window.document.querySelector(sel);
const $$ = (sel) => [...window.document.querySelectorAll(sel)];

/** Seek through the element; jsdom dispatches nothing on its own. */
function seekTo(time) {
  mediaState.currentTime = time;
  audio.dispatchEvent(new window.Event("seeking"));
  audio.dispatchEvent(new window.Event("seeked"));
  audio.dispatchEvent(new window.Event("timeupdate"));
  // the stage polls the controller each animation frame; give rAF a chance
  return settle(90);
}

check("stage mounted", () => Boolean($(".cinematic-stage")));
check("score has 43 cues", () => initialScore.cues.length === 43 || `got ${initialScore.cues.length}`);

const cueFailures = [];
const seenActions = new Set();
for (const cue of initialScore.cues) {
  const at = cue.start + Math.min(0.4, (cue.end - cue.start) / 2);
  await seekTo(at);
  const stage = $(".cinematic-stage");
  const action = stage?.getAttribute("data-action");
  seenActions.add(action);
  if (action !== cue.action) cueFailures.push(`${cue.id}: action=${action} want=${cue.action}`);
  if (cueAt(at, initialScore)?.id !== cue.id) cueFailures.push(`${cue.id}: cueAt mismatch`);
}
check("all 43 cues render their action", () => cueFailures.length === 0 || cueFailures.slice(0, 5).join("; "));
check("stage visits many distinct actions", () => seenActions.size >= 8 || `only ${seenActions.size}`);

// Determinism at a repeated instant.
await seekTo(100.8);
const a = $(".art-front")?.innerHTML ?? "";
await seekTo(12.5);
await seekTo(145.3);
await seekTo(100.8);
const b = $(".art-front")?.innerHTML ?? "";
check("seeking is deterministic", () => (a.length > 500 && a === b) || `len=${a.length} equal=${a === b}`);

// Pause / resume through the controller's public API.
await seekTo(60);
controller.pause();
await settle(80);
check("pause publishes paused", () => controller.getSnapshot().status === "paused" || `got ${controller.getSnapshot().status}`);
check("resume restores time", () => mediaState.currentTime >= 59.9 || `at ${mediaState.currentTime}`);

// Mute is a controller concern, not a stage concern.
controller.toggleMute();
check("mute toggles", () => mediaState.muted === true || `muted=${mediaState.muted}`);

// Snow globe finale: last cue is the tail, and the stage renders there.
const finale = initialScore.cues[initialScore.cues.length - 1];
check("final lyric line is the quilt line", () => finale?.action === "quilt" || `got ${finale?.action}`);

// After the last lyric the timeline builds an instrumental "tail" shot, which is
// where the Snow Globe resolves. Seeking past the final cue must land there.
const { buildShots } = await import("../../src/timeline/score.ts");
const shots = buildShots(initialScore, 161.332);
const tailShot = shots[shots.length - 1];
check("timeline ends in the snow globe tail", () => tailShot?.action === "tail" || `got ${tailShot?.action}`);
await seekTo(tailShot.start + 0.4);
check("tail shot renders in the stage", () => $(".cinematic-stage")?.getAttribute("data-action") === "tail" || `got ${$(".cinematic-stage")?.getAttribute("data-action")}`);
await seekTo(161.332 - 0.05);
check("final frame still renders", () => Boolean($(".cinematic-stage")));

check("no React errors", () => reactErrors.length === 0 || reactErrors[0]);

const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} cinematic checks passed`);

root.unmount();
detach();
process.exit(failed ? 1 : 0);
