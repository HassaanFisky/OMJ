import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const outDir =
  "C:/Users/DELL/.gemini/antigravity/brain/388a0888-58ad-4203-adaa-58ce33c09ea7/screenshots";
fs.mkdirSync(outDir, { recursive: true });

// All 43 canonical cues (exact midpoint sampling) + entrance + outro
const desktopMoments = [
  { name: "cue-01-waiting", time: 29.5 },
  { name: "cue-02-help", time: 31.5 },
  { name: "cue-03-only", time: 33.0 },
  { name: "cue-04-kiss", time: 35.8 },
  { name: "cue-05-leaving", time: 38.6 },
  { name: "cue-06-neglected", time: 41.0 },
  { name: "cue-07-sky", time: 43.0 },
  { name: "cue-08-mist", time: 46.5 },
  { name: "cue-09-chorus1-0", time: 50.0 },
  { name: "cue-10-chorus1-1", time: 52.0 },
  { name: "cue-11-chorus1-2", time: 54.5 },
  { name: "cue-12-chorus1-3", time: 57.0 },
  { name: "cue-13-chorus1-4", time: 59.5 },
  { name: "cue-14-chorus1-5", time: 62.0 },
  { name: "cue-15-chorus1-6", time: 64.0 },
  { name: "cue-16-chorus1-7", time: 66.5 },
  { name: "cue-17-nervous", time: 70.4 },
  { name: "cue-18-disagree", time: 72.8 },
  { name: "cue-19-gifts", time: 75.8 },
  { name: "cue-20-hearts", time: 78.5 },
  { name: "cue-21-exhausted", time: 81.5 },
  { name: "cue-22-winter", time: 84.2 },
  { name: "cue-23-comfort", time: 86.5 },
  { name: "cue-24-call", time: 89.0 },
  { name: "cue-25-devotion", time: 91.5 },
  { name: "cue-26-unnoticed", time: 94.0 },
  { name: "cue-27-phone", time: 96.0 },
  { name: "cue-28-thought", time: 98.8 },
  { name: "cue-29-dream", time: 101.2 },
  { name: "cue-30-reach", time: 103.0 },
  { name: "cue-31-lap", time: 108.5 },
  { name: "cue-32-chorus2-0", time: 111.0 },
  { name: "cue-33-chorus2-1", time: 113.0 },
  { name: "cue-34-chorus2-2", time: 115.0 },
  { name: "cue-35-chorus2-3", time: 117.0 },
  { name: "cue-36-chorus2-4", time: 119.0 },
  { name: "cue-37-chorus2-5", time: 121.0 },
  { name: "cue-38-chorus2-6", time: 123.0 },
  { name: "cue-39-chorus2-7", time: 125.0 },
  { name: "cue-40-eyes", time: 129.0 },
  { name: "cue-41-embrace", time: 135.2 },
  { name: "cue-42-window", time: 139.8 },
  { name: "cue-43-quilt", time: 145.5 },
  { name: "outro-snowglobe", time: 158.0 },
];

const mobileMoments = [
  { name: "cue-01-waiting", time: 29.5 },
  { name: "cue-04-kiss", time: 35.8 },
  { name: "cue-17-nervous", time: 70.4 },
  { name: "cue-20-hearts-mirror", time: 78.5 },
  { name: "cue-22-winter", time: 84.2 },
  { name: "cue-27-phone", time: 96.0 },
  { name: "cue-29-dream", time: 101.2 },
  { name: "cue-31-lap", time: 108.5 },
  { name: "cue-42-window", time: 139.8 },
  { name: "cue-43-quilt", time: 145.5 },
  { name: "outro-snowglobe", time: 158.0 },
];

async function isUp(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url) {
  for (let i = 0; i < 60; i++) {
    if (await isUp(url)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Vite server did not respond in time");
}

async function captureViewport(
  browser,
  label,
  viewport,
  moments,
  isMobile = false,
) {
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4179/");
  await page.waitForSelector(".entrance");

  await page.waitForFunction(() => {
    const audio = document.getElementById("omj-audio");
    return Boolean(audio && Number.isFinite(audio.duration) && audio.duration > 150);
  });

  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outDir, `${label}-00-entrance.png`),
  });

  await page.getByRole("button", { name: "PLAY OMJ", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  for (const moment of moments) {
    await page.evaluate((t) => {
      const audio = document.getElementById("omj-audio");
      if (audio) audio.currentTime = t;
    }, moment.time);
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(outDir, `${label}-${moment.name}.png`),
    });
  }

  await context.close();
}

async function main() {
  const url = "http://127.0.0.1:4179/";
  const alreadyRunning = await isUp(url);
  const server = alreadyRunning
    ? null
    : spawn(
        "npx",
        ["vite", "--host", "127.0.0.1", "--port", "4179", "--strictPort"],
        { shell: true, stdio: "ignore" },
      );

  try {
    await waitForServer(url);
    const browser = await chromium.launch();
    try {
      await captureViewport(
        browser,
        "desktop-1440",
        { width: 1440, height: 900 },
        desktopMoments,
        false,
      );
      await captureViewport(
        browser,
        "mobile-390",
        { width: 390, height: 844 },
        mobileMoments,
        true,
      );
      console.log("ALL_43_CUE_SCREENSHOTS_CAPTURED");
    } finally {
      await browser.close();
    }
  } finally {
    server?.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
