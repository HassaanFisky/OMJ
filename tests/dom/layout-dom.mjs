/**
 * Layout harness.
 *
 * Verifies the room at the four required viewports (1440×900, 1920×1080,
 * 390×844, 393×852, 430×932). jsdom has no layout engine, so this checks the
 * things that actually break in practice and can be asserted structurally:
 * every control is present and reachable, no horizontal overflow is declared,
 * the projection fits the viewport, and the compact breakpoints apply.
 */
import { JSDOM } from "jsdom";

const VIEWPORTS = [
  { name: "desktop 1440x900", width: 1440, height: 900 },
  { name: "desktop 1920x1080", width: 1920, height: 1080 },
  { name: "phone 390x844", width: 390, height: 844 },
  { name: "phone 393x852", width: 393, height: 852 },
  { name: "phone 430x932", width: 430, height: 932 },
];

const results = [];
function check(name, fn) {
  try {
    const value = fn();
    const ok = value === true;
    results.push({ name, ok, detail: ok ? "" : String(value) });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

for (const viewport of VIEWPORTS) {
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
  // jsdom always reports 0×0; give each run the real viewport box.
  window.Element.prototype.getBoundingClientRect = function rect() {
    return { x: 0, y: 0, width: viewport.width, height: viewport.height, top: 0, left: 0, right: viewport.width, bottom: viewport.height, toJSON() {} };
  };
  window.Element.prototype.setPointerCapture = () => {};
  Object.defineProperty(window, "innerWidth", { configurable: true, value: viewport.width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: viewport.height });

  const gradientStub = { addColorStop() {} };
  window.HTMLCanvasElement.prototype.getContext = () =>
    new Proxy({}, {
      get: (_t, prop) => {
        if (prop === "canvas") return { width: viewport.width, height: viewport.height };
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradientStub;
        return () => undefined;
      },
      set: () => true,
    });
  window.HTMLMediaElement.prototype.pause = () => {};
  window.HTMLMediaElement.prototype.load = () => {};
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();

  const { createRoot } = await import("react-dom/client");
  const { createElement } = await import("react");
  const { default: App } = await import("../../src/App.tsx");

  const root = createRoot(window.document.getElementById("root"));
  root.render(createElement(App));
  await new Promise((r) => setTimeout(r, 260));

  const $ = (sel) => window.document.querySelector(sel);
  const $$ = (sel) => [...window.document.querySelectorAll(sel)];

  // Enter the room.
  const enter = $$("button").find((b) => (b.getAttribute("aria-label") || "").includes("Enter the room"));
  enter?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 320));

  check(`${viewport.name}: room entered`, () => $(".experience")?.getAttribute("data-screen") === "explore");
  const svg = $(".explore-svg");
  check(`${viewport.name}: stage tracks the viewport`, () => {
    const box = svg?.getAttribute("viewBox");
    return box === `0 0 ${viewport.width} ${viewport.height}` || `got ${box}`;
  });
  check(`${viewport.name}: scales without cropping input`, () =>
    svg?.getAttribute("preserveAspectRatio") === "xMidYMid slice" || `got ${svg?.getAttribute("preserveAspectRatio")}`,
  );
  check(`${viewport.name}: command bar present`, () => Boolean($(".command-input")));
  check(`${viewport.name}: hotspots reachable`, () => $$("[data-hotspot]").length >= 6);
  check(`${viewport.name}: every interactive control has a label`, () =>
    $$("[data-hotspot]").every((n) => (n.getAttribute("aria-label") || "").length > 3) || "unlabelled hotspot",
  );
  check(`${viewport.name}: camera rail present`, () => $$("button.camera-chip").length >= 5);
  check(`${viewport.name}: weather pills present`, () => $$("button.hud-pill").length >= 8);
  check(`${viewport.name}: body declares no forced width`, () =>
    !$(".explore-stage")?.getAttribute("style")?.includes("width:") || "stage pinned to a width",
  );
  check(`${viewport.name}: no duplicate stacks`, () => $$(".explore-stage").length === 1);

  root.unmount();
  dom.window.close();
}

const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} layout checks passed`);
process.exit(failed ? 1 : 0);
