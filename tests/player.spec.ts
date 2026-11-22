import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";
import { initialScore } from "../src/timeline/score";

function diagnosticWav(seconds: number): Buffer {
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

async function loadAudio(page: Page) {
  await page.goto("/");

  await page.getByLabel("Choose audio file").setInputFiles({
    name: "diagnostic.wav",
    mimeType: "audio/wav",
    buffer: diagnosticWav(164.375),
  });

  await expect(
    page.getByRole("button", { name: "PLAY OMJ", exact: true }),
  ).toBeEnabled();
}

test("does not autoplay", async ({ page }) => {
  await loadAudio(page);

  expect(
    await page.locator("audio").evaluate((audio) => (audio as HTMLAudioElement).paused),
  ).toBe(true);
});

test("play, pause, seek, mute and replay", async ({ page }) => {
  await loadAudio(page);

  await page.getByRole("button", {
    name: "PLAY OMJ",
    exact: true,
  }).click();

  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", {
    name: "Pause",
    exact: true,
  }).click();

  expect(
    await page.locator("audio").evaluate((audio) => (audio as HTMLAudioElement).paused),
  ).toBe(true);

  await page.locator("audio").evaluate((audio) => {
    (audio as HTMLAudioElement).currentTime = 100.8;
  });

  await expect(page.locator(".cinematic-stage")).toHaveAttribute(
    "data-action",
    "dream",
  );

  await page.getByRole("button", {
    name: "Mute",
    exact: true,
  }).click();

  expect(
    await page.locator("audio").evaluate((audio) => (audio as HTMLAudioElement).muted),
  ).toBe(true);

  await page.getByRole("button", {
    name: "Replay",
    exact: true,
  }).click();

  await expect.poll(async () =>
    page.locator("audio").evaluate((audio) => (audio as HTMLAudioElement).currentTime),
  ).toBeLessThan(2);
});

test("every lyric can be reached by seeking", async ({ page }) => {
  await loadAudio(page);

  await page.getByRole("button", {
    name: "PLAY OMJ",
    exact: true,
  }).click();

  await page.getByRole("button", {
    name: "Pause",
    exact: true,
  }).click();

  for (const cue of initialScore.cues) {
    const time = cue.start + Math.min(0.4, (cue.end - cue.start) / 2);

    await page.locator("audio").evaluate((audio, value) => {
      (audio as HTMLAudioElement).currentTime = value;
    }, time);

    await expect(page.locator(".lyric-caption")).toHaveAttribute(
      "data-cue",
      cue.id,
    );
    await expect(page.locator(".lyric-caption")).toHaveText(cue.text);
  }
});

test("returns to the entrance at the end", async ({ page }) => {
  await loadAudio(page);

  await page.getByRole("button", {
    name: "PLAY OMJ",
    exact: true,
  }).click();

  await page.locator("audio").evaluate((audio) => {
    const el = audio as HTMLAudioElement;
    el.currentTime = el.duration - 0.15;
  });

  await expect(
    page.getByRole("button", { name: "REPLAY OMJ", exact: true }),
  ).toBeVisible({ timeout: 10_000 });
});

test("supports reduced motion without horizontal overflow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadAudio(page);

  await expect(page.locator(".cinematic-stage")).toHaveAttribute(
    "data-reduced",
    "true",
  );

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});

test("provides a complete transcript", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Read lyrics" }).click();

  await expect(page.locator(".transcript-list > li")).toHaveCount(43);
});
