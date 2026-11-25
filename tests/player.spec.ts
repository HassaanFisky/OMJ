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
    buffer: diagnosticWav(161.332),
  });

  await expect(
    page.getByRole("button", { name: "PLAY OMJ", exact: true }),
  ).toBeEnabled();
}

test("does not autoplay and shows only a single OMJ mark on entrance", async ({ page }) => {
  await loadAudio(page);

  expect(
    await page.locator("audio").evaluate((audio) => (audio as HTMLAudioElement).paused),
  ).toBe(true);

  const visibleOmjCount = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.includes("OMJ")) continue;
      const el = node.parentElement;
      if (!el) continue;
      const style = window.getComputedStyle(el);
      if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && !el.closest(".sr-only")) {
        count++;
      }
    }
    return count;
  });

  expect(visibleOmjCount).toBe(1);
});

test("play, pause, seek, mute, C shortcut, and replay", async ({ page }) => {
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

  // C shortcut toggles caption visibility cleanly when focus is not inside a control
  await page.locator("main.experience").focus();
  await page.keyboard.press("c");
  await expect(page.locator(".lyric-caption")).toHaveAttribute("data-hidden", "true");
  await page.keyboard.press("c");
  await expect(page.locator(".lyric-caption")).toHaveAttribute("data-hidden", "false");

  // C shortcut must be ignored while focused inside a button
  await page.getByRole("button", { name: "Resume", exact: true }).focus();
  await page.keyboard.press("c");
  await expect(page.locator(".lyric-caption")).toHaveAttribute("data-hidden", "false");

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
    await expect(page.locator(".lyric-caption")).toHaveText(cue.text.toUpperCase());
  }
});

test("renders persistent window, diagonal bed, and live mirror reflection", async ({ page }) => {
  await loadAudio(page);

  await page.getByRole("button", {
    name: "PLAY OMJ",
    exact: true,
  }).click();
  await page.getByRole("button", {
    name: "Pause",
    exact: true,
  }).click();

  // Cue 20 (hearts at t = 78.5): Yume stands in front of dressing mirror
  await page.locator("audio").evaluate((audio) => {
    (audio as HTMLAudioElement).currentTime = 78.5;
  });

  await expect(page.locator(".cinematic-stage")).toHaveAttribute("data-action", "hearts");

  const mirrorOpacity = await page.locator('[data-bear="mirror-b"]').getAttribute("opacity");
  expect(Number(mirrorOpacity)).toBeGreaterThan(0.2);

  // Window and Bed remain visible across all bedroom scenes
  expect(Number(await page.locator('[data-node="window"]').getAttribute("opacity"))).toBe(1);
  expect(Number(await page.locator('[data-node="bed"]').getAttribute("opacity"))).toBe(1);
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

test("fills full viewport with zero horizontal or vertical overflow", async ({ page }) => {
  await loadAudio(page);

  const overflow = await page.evaluate(() => ({
    h: document.documentElement.scrollWidth > window.innerWidth,
    v: document.documentElement.scrollHeight > window.innerHeight,
  }));

  expect(overflow.h).toBe(false);
  expect(overflow.v).toBe(false);
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

test("supports top-left pin-up speed popover, arrow seek, earless rigs, and window footstools", async ({ page }) => {
  await loadAudio(page);

  // Verify earless smooth dome rigs have zero dashed stitch lines
  const bearDashCount = await page.evaluate(() => {
    const bears = document.querySelectorAll('[data-bear="a"], [data-bear="b"]');
    let count = 0;
    bears.forEach((b) => {
      count += b.querySelectorAll('[stroke-dasharray]').length;
    });
    return count;
  });
  expect(bearDashCount).toBe(0);

  // Open top-left compact pin-up popover and verify speed presets
  await page.getByRole("button", { name: "Playback menu", exact: true }).click();
  const card = page.getByRole("dialog", { name: "Cinema controls" });
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThan(280);

  await card.getByRole("button", { name: "1.5x", exact: true }).click();
  expect(
    await page.locator("audio").evaluate((audio) => (audio as HTMLAudioElement).playbackRate),
  ).toBe(1.5);

  // Close popover and test playback + ArrowRight/ArrowLeft seek
  await page.getByRole("button", { name: "Playback menu", exact: true }).click();
  await page.getByRole("button", { name: "PLAY OMJ", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await page.locator("audio").evaluate((audio) => {
    (audio as HTMLAudioElement).currentTime = 40;
  });

  await page.locator("main.experience").focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () =>
    page.locator("audio").evaluate((audio) => (audio as HTMLAudioElement).currentTime),
  ).toBeGreaterThanOrEqual(44.5);

  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () =>
    page.locator("audio").evaluate((audio) => (audio as HTMLAudioElement).currentTime),
  ).toBeLessThan(41);

  // Seek to window-gazing cue (Cue 42 at t=139.5) and verify footstools are visible
  await page.locator("audio").evaluate((audio) => {
    (audio as HTMLAudioElement).currentTime = 139.5;
  });
  await expect(page.locator(".cinematic-stage")).toHaveAttribute("data-action", "window");
  expect(Number(await page.locator('[data-node="stoolA"]').getAttribute("opacity"))).toBeGreaterThan(0.8);
  expect(Number(await page.locator('[data-node="stoolB"]').getAttribute("opacity"))).toBeGreaterThan(0.8);
});
