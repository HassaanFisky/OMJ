import { chromium } from "@playwright/test";
import { Buffer } from "node:buffer";
import * as path from "node:path";
import * as fs from "node:fs";

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

async function capture() {
  const outDir = "C:/Users/DELL/.gemini/antigravity/brain/7c3cc791-e748-4173-8759-c0d9444a7ab5";
  const browser = await chromium.launch();

  // 1. Desktop Entrance
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const pageD = await desktopContext.newPage();
  await pageD.goto("http://127.0.0.1:4179/");
  await pageD.waitForSelector(".entrance");
  await pageD.screenshot({ path: path.join(outDir, "omj-desktop-entrance.png") });

  // Load audio and enter playing state
  await pageD.getByLabel("Choose audio file").setInputFiles({
    name: "diagnostic.wav",
    mimeType: "audio/wav",
    buffer: diagnosticWav(164.375),
  });
  await pageD.getByRole("button", { name: "PLAY OMJ", exact: true }).click();
  await pageD.waitForTimeout(1500);
  await pageD.screenshot({ path: path.join(outDir, "omj-desktop-playback.png") });
  await desktopContext.close();

  // 2. Mobile iPhone 14 Pro
  const mobileContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const pageM = await mobileContext.newPage();
  await pageM.goto("http://127.0.0.1:4179/");
  await pageM.waitForSelector(".entrance");
  await pageM.screenshot({ path: path.join(outDir, "omj-mobile-entrance.png") });

  await pageM.getByLabel("Choose audio file").setInputFiles({
    name: "diagnostic.wav",
    mimeType: "audio/wav",
    buffer: diagnosticWav(164.375),
  });
  await pageM.getByRole("button", { name: "PLAY OMJ", exact: true }).click();
  await pageM.waitForTimeout(1500);
  await pageM.screenshot({ path: path.join(outDir, "omj-mobile-playback.png") });
  await mobileContext.close();

  await browser.close();
  console.log("SCREENSHOTS_CAPTURED_SUCCESSFULLY");
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
