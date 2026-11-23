import { chromium } from "@playwright/test";
import { Buffer } from "node:buffer";
import * as path from "node:path";

function diagnosticWav(seconds) {
  const rate = 8000;
  const bytes = Math.ceil(seconds * rate) * 2;
  const buffer = Buffer.alloc(44 + bytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + bytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(bytes, 40);
  return buffer;
}

const scenesToCapture = [
  { name: "01-waiting", time: 2.0 },
  { name: "04-kiss", time: 15.0 },
  { name: "08-mist", time: 33.0 },
  { name: "10-chorus-rain", time: 41.0 },
  { name: "19-gifts", time: 77.0 },
  { name: "22-winter", time: 88.0 },
  { name: "31-lap", time: 109.5 },
  { name: "41-embrace", time: 134.0 },
  { name: "42-window-back", time: 139.5 },
  { name: "43-quilt", time: 145.0 },
  { name: "climax-snowglobe", time: 158.0 }
];

async function run() {
  const outDir = "C:/Users/DELL/.gemini/antigravity/brain/7c3cc791-e748-4173-8759-c0d9444a7ab5";
  const browser = await chromium.launch();

  // Desktop
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4179/");
  await page.waitForSelector(".entrance");

  await page.getByLabel("Choose audio file").setInputFiles({
    name: "diagnostic.wav",
    mimeType: "audio/wav",
    buffer: diagnosticWav(164.375),
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "critique-desktop-00-entrance.png") });

  await page.getByRole("button", { name: "PLAY OMJ", exact: true }).click();
  await page.waitForTimeout(500);

  for (const scene of scenesToCapture) {
    await page.evaluate((t) => {
      const audio = document.getElementById("omj-audio");
      if (audio) {
        audio.currentTime = t;
        audio.dispatchEvent(new Event("timeupdate"));
      }
    }, scene.time);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, `critique-desktop-${scene.name}.png`) });
  }

  // Mobile iPhone 14 Pro
  const mobileContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true
  });
  const pageM = await mobileContext.newPage();
  await pageM.goto("http://127.0.0.1:4179/");
  await pageM.waitForSelector(".entrance");

  await pageM.getByLabel("Choose audio file").setInputFiles({
    name: "diagnostic.wav",
    mimeType: "audio/wav",
    buffer: diagnosticWav(164.375),
  });
  await pageM.waitForTimeout(300);
  await pageM.screenshot({ path: path.join(outDir, "critique-mobile-00-entrance.png") });

  await pageM.getByRole("button", { name: "PLAY OMJ", exact: true }).click();
  await pageM.waitForTimeout(500);

  const mobileKeyScenes = [
    { name: "01-waiting", time: 2.0 },
    { name: "31-lap", time: 109.5 },
    { name: "42-window-back", time: 139.5 },
    { name: "climax-snowglobe", time: 158.0 }
  ];

  for (const scene of mobileKeyScenes) {
    await pageM.evaluate((t) => {
      const audio = document.getElementById("omj-audio");
      if (audio) {
        audio.currentTime = t;
        audio.dispatchEvent(new Event("timeupdate"));
      }
    }, scene.time);
    await pageM.waitForTimeout(400);
    await pageM.screenshot({ path: path.join(outDir, `critique-mobile-${scene.name}.png`) });
  }

  await browser.close();
  console.log("ALL_CRITIQUE_SCREENSHOTS_CAPTURED");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
