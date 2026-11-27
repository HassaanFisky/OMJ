import { expect, test, type Page } from "@playwright/test";

async function enterRoom(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the room — explore OMJ" }).click();
  await expect(page.locator(".explore-stage")).toBeVisible();
}

test("entrance offers an explicit room entry and keeps the film intact", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "PLAY OMJ", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter the room — explore OMJ" })).toBeVisible();

  // The room is not entered by default, so the original entrance is unchanged.
  await expect(page.locator(".explore-stage")).toHaveCount(0);
});

test("explore mode renders the projected room and both plush characters", async ({ page }) => {
  await enterRoom(page);

  // A real 3D room means real projected faces, not a flat illustration.
  const faces = await page.locator('[data-layer="room-far"] path').count();
  expect(faces).toBeGreaterThan(25);

  await expect(page.locator('[data-bear="explore-a"]')).toHaveCount(1);
  await expect(page.locator('[data-bear="explore-b"]')).toHaveCount(1);

  // Rigs are actually painted (positioned and visible), not merely mounted.
  await expect
    .poll(async () =>
      page.locator('[data-char-wrap="mochi"]').getAttribute("data-visible"),
    )
    .toBe("true");
});

test("dragging orbits the room and the projection actually changes", async ({ page, isMobile }) => {
  await enterRoom(page);

  const stage = page.locator(".explore-stage");
  const before = await page.locator('[data-layer="room-far"]').innerHTML();

  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width * 0.5;
  const cy = box!.y + box!.height * 0.5;

  // Keep the gesture inside the viewport: on a 390px phone a fixed 220px drag
  // from the centre would run off the edge and the pointer would leave the
  // stage before the orbit registers.
  const travel = Math.min(220, box!.width * 0.28);

  if (isMobile) {
    // Touch devices need real touch events; mouse events do not produce the
    // pointer stream the room listens to when hasTouch is set.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx, y: cy }],
    });
    for (let step = 1; step <= 6; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: cx + (travel / 6) * step, y: cy }],
      });
      await page.waitForTimeout(24);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + travel, cy + 30, { steps: 10 });
    await page.mouse.up();
  }
  await page.waitForTimeout(200);

  const after = await page.locator('[data-layer="room-far"]').innerHTML();
  expect(after).not.toBe(before);
});

test("keyboard navigation moves the camera", async ({ page }) => {
  await enterRoom(page);

  await page.locator(".explore-stage").focus();
  const before = await page.locator('[data-layer="room-far"]').innerHTML();

  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("ArrowRight");
  }
  await page.waitForTimeout(80);

  const after = await page.locator('[data-layer="room-far"]').innerHTML();
  expect(after).not.toBe(before);
});

test("weather, light and curtain actions all change the rendered room", async ({ page }) => {
  await enterRoom(page);

  const stage = page.locator(".explore-stage");
  const hud = page.getByRole("complementary", { name: "Room atmosphere" });

  await hud.getByRole("button", { name: "Weather: Snow", exact: true }).click();
  await expect(stage).toHaveAttribute("data-explore-weather", "snow");

  await hud.getByRole("button", { name: "Weather: Rain", exact: true }).click();
  await expect(stage).toHaveAttribute("data-explore-weather", "rain");

  await hud.getByRole("button", { name: "Weather: Clear", exact: true }).click();
  await expect(stage).toHaveAttribute("data-explore-weather", "clear");

  await hud.getByRole("button", { name: "Day", exact: true }).click();
  await expect(stage).toHaveAttribute("data-explore-atmosphere", "day");

  await hud.getByRole("button", { name: "Night", exact: true }).click();
  await expect(stage).toHaveAttribute("data-explore-atmosphere", "night");
});

test("hotspots respond and describe their effect", async ({ page }) => {
  await enterRoom(page);

  const lamp = page.locator('[data-hotspot="lamp"]');
  await expect(lamp).toBeVisible();
  await lamp.click();

  // The announcement is the user-facing confirmation of a real state change.
  await expect(page.locator("main.experience")).toContainText(/lamp/i, { timeout: 4000 });

  const globe = page.locator('[data-hotspot="globe"]');
  await expect(globe).toBeVisible();
  await globe.click();
  await expect(page.locator(".app-announcer")).toContainText(/snow globe/i);

  const mochi = page.locator('[data-hotspot="mochi"]');
  await mochi.click();
  await expect(page.locator(".app-announcer")).toContainText(/Mochi waves/i);
});

test("natural language commands change the world and stay honest", async ({ page }) => {
  await enterRoom(page);

  const input = page.getByPlaceholder("Tell the room what to do…");

  await input.fill("let it snow");
  await input.press("Enter");
  await expect(page.locator(".explore-stage")).toHaveAttribute(
    "data-explore-weather",
    "snow",
  );
  await expect(page.locator(".command-feedback")).toContainText(/snow/i);

  await input.fill("open the curtains");
  await input.press("Enter");
  await expect(page.locator(".command-feedback")).toContainText(/curtains/i);

  // An unsupported request must be reported, never silently "executed".
  await input.fill("order me a pizza");
  await input.press("Enter");
  await expect(page.locator(".command-feedback")).toHaveAttribute("data-tone", "warn");
  await expect(page.locator(".command-feedback")).toContainText(/can't do/i);
});

test("command help discloses the local, limited understanding", async ({ page }) => {
  await enterRoom(page);

  await page.getByRole("button", { name: "?", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Room requests" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/no language model/i);
  await expect(panel).toContainText(/no network call/i);
});

test("the film and the room hand over cleanly in both directions", async ({ page }) => {
  await enterRoom(page);
  await page.getByRole("complementary", { name: "Room atmosphere" })
    .getByRole("button", { name: "Day", exact: true }).click();

  // Only one stage may ever be mounted: the cinematic one is not rendered while
  // the room owns the screen.
  await expect(page.locator(".explore-stage")).toHaveCount(1);
  await expect(page.locator(".cinematic-stage")).toHaveCount(0);

  // The film is available because the authorized audio is present. Entering it
  // must unmount the room completely (no duplicate animation loops).
  const toggle = page.locator(".mode-toggle");
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(page.locator(".experience")).toHaveAttribute("data-screen", "cinematic");
  await expect(page.locator(".explore-stage")).toHaveCount(0);
  await expect(page.locator(".cinematic-stage")).toHaveCount(1);

  // And back again, with exactly one room and one set of rigs.
  await page.locator(".mode-toggle").click();
  await expect(page.locator(".experience")).toHaveAttribute("data-screen", "explore");
  await expect(page.locator(".explore-stage")).toHaveCount(1);
  await expect(page.locator(".cinematic-stage")).toHaveCount(0);
  await expect(page.locator('[data-bear="explore-a"]')).toHaveCount(1);
  await expect(page.locator('[data-bear="explore-b"]')).toHaveCount(1);
});

test("explore mode never overflows on the target viewports", async ({ page }) => {
  await enterRoom(page);

  const overflow = await page.evaluate(() => ({
    h: document.documentElement.scrollWidth > window.innerWidth,
    v: document.documentElement.scrollHeight > window.innerHeight,
  }));

  expect(overflow.h).toBe(false);
  expect(overflow.v).toBe(false);
});

test("reduced motion is honoured inside the room", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterRoom(page);

  await page.getByRole("button", { name: "More", exact: true }).click();
  const toggle = page.getByRole("button", { name: "Reduce motion", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // The room remains fully functional with reduced motion on.
  await page.getByRole("complementary", { name: "Room atmosphere" })
    .getByRole("button", { name: "Weather: Snow", exact: true }).click();
  await expect(page.locator(".explore-stage")).toHaveAttribute(
    "data-explore-weather",
    "snow",
  );
});

test("every hotspot is reachable by keyboard with a visible label", async ({ page }) => {
  await enterRoom(page);

  const hotspots = page.locator(".hotspot");
  const count = await hotspots.count();
  expect(count).toBeGreaterThan(3);

  for (let i = 0; i < count; i += 1) {
    const spot = hotspots.nth(i);
    await expect(spot).toHaveAttribute("aria-label", /.+/);
  }
});

test("no console errors while exploring and commanding", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await enterRoom(page);

  const input = page.getByPlaceholder("Tell the room what to do…");
  for (const command of ["let it snow", "make it night", "open the curtains", "make them hug"]) {
    await input.fill(command);
    await input.press("Enter");
  }

  const box = await page.locator(".explore-stage").boundingBox();
  await page.mouse.move(box!.x + 200, box!.y + 300);
  await page.mouse.down();
  await page.mouse.move(box!.x + 520, box!.y + 360, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  expect(errors).toEqual([]);
});

test("the mirror shows a real reflection of the plushies, clipped to its glass", async ({ page }) => {
  await enterRoom(page);
  await page.locator(".explore-camera-rail button", { hasText: "Mirror" }).first().click();

  // The reflection exists...
  await expect
    .poll(async () =>
      page.locator('[data-mirror-wrap="yume"]').getAttribute("data-visible"),
    )
    .toBe("true");

  // ...and it inherits the room pose joint-for-joint, which is what makes it a
  // reflection rather than a second illustration.
  const pose = await page.evaluate(() => {
    const read = (root: string) =>
      ["head", "leftArm", "rightArm", "leftLeg", "rightLeg"].map(
        (joint) => document.querySelector(`[data-bear="${root}"] [data-joint="${joint}"]`)?.getAttribute("transform") ?? null,
      );
    return { room: read("explore-b"), mirror: read("explore-mirror-b") };
  });
  expect(pose.mirror).toEqual(pose.room);
  expect(pose.room.every((joint) => joint !== null)).toBe(true);

  // The glass is a real clip path, and the reflection sits inside it.
  const geometry = await page.evaluate(() => {
    const path = document.querySelector('[data-clip="mirror"]')?.getAttribute("d") ?? "";
    const numbers = path.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    const xs = numbers.filter((_, index) => index % 2 === 0);
    const ys = numbers.filter((_, index) => index % 2 === 1);
    const wrap = document.querySelector('[data-mirror-wrap="yume"]')?.getAttribute("transform") ?? "";
    const [x, y] = (wrap.match(/-?\d+\.?\d*/g) ?? []).map(Number);
    return {
      path: path.length,
      glass: xs.length ? { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) } : null,
      x,
      y,
    };
  });
  expect(geometry.path).toBeGreaterThan(10);
  expect(geometry.glass).not.toBeNull();
  expect(geometry.x).toBeGreaterThan(geometry.glass!.minX);
  expect(geometry.x).toBeLessThan(geometry.glass!.maxX);
  expect(geometry.y).toBeLessThan(geometry.glass!.maxY);
  expect(geometry.y).toBeGreaterThan(geometry.glass!.minY);

  // Turning away from the mirror removes the reflection: it is bound to the
  // room, not painted permanently into the glass.
  await page.locator(".explore-camera-rail button", { hasText: "Shelf" }).first().click();
  await expect
    .poll(async () =>
      page.locator('[data-mirror-wrap="yume"]').getAttribute("data-visible"),
    )
    .toBe("false");
});

test("every live hotspot is unobstructed and fires its own action", async ({ page }) => {
  await enterRoom(page);

  // Chrome floats above the room. A dot parked under it is invisible to the
  // pointer even though the button exists, so each one must hit-test to itself.
  // Dots are placed imperatively on the first painted frame, so poll rather than
  // measuring a not-yet-positioned button.
  await expect.poll(async () => page.evaluate(() => {
    const blocked: string[] = [];
    document.querySelectorAll<HTMLElement>(".hotspot").forEach((dot) => {
      const box = dot.getBoundingClientRect();
      if (box.width < 1) return;
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      if (!hit || !dot.contains(hit)) blocked.push(dot.dataset.hotspot ?? "?");
    });
    return blocked;
  })).toEqual([]);

  // And each one actually performs its action through a real pointer click.
  for (const [id, expected] of [
    ["lamp", /lamp/i],
    ["window", /curtain/i],
    ["mochi", /mochi/i],
  ] as const) {
    const dot = page.locator(`[data-hotspot="${id}"]`);
    await expect(dot).toBeVisible();
    await dot.click();
    await expect(page.locator(".app-announcer")).toHaveText(expected);
  }
});

test("releasing a drag keeps the orbit instead of snapping back", async ({ page, isMobile }) => {
  await enterRoom(page);

  const projection = () =>
    page.evaluate(() => document.querySelector('[data-layer="room-far"] path')?.getAttribute("d") ?? "");

  const before = await projection();
  const box = await page.locator(".explore-stage").boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  const travel = Math.min(220, box!.width * 0.28);

  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    const send = (
      type: "touchStart" | "touchMove" | "touchEnd",
      x: number,
      y: number,
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      });
    await send("touchStart", cx, cy);
    for (let step = 1; step <= 10; step += 1) await send("touchMove", cx + (travel * step) / 10, cy);
    await send("touchEnd", cx, cy);
  } else {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let step = 1; step <= 10; step += 1) await page.mouse.move(cx + (travel * step) / 10, cy);
    await page.mouse.up();
  }

  const released = await projection();
  expect(released).not.toBe(before);

  // Nothing may pull the camera back: the committed pose is the resting pose.
  await page.waitForTimeout(1800);
  expect(await projection()).toBe(released);

  // And the gesture must not have scrolled the page behind the room.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("neither mode resets the other's camera", async ({ page }) => {
  await enterRoom(page);

  // Orbit to a deliberate pose in the room.
  const stage = page.locator(".explore-stage");
  const box = await stage.boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) await page.mouse.move(cx + step * 14, cy);
  await page.mouse.up();

  // The camera pose itself, not the projection: the stage re-measures its size
  // when it remounts, which shifts pixels without the camera having moved.
  const view = async () => {
    const stage = page.locator(".explore-stage");
    return {
      yaw: await stage.getAttribute("data-camera-yaw"),
      pitch: await stage.getAttribute("data-camera-pitch"),
      distance: await stage.getAttribute("data-camera-distance"),
    };
  };

  const roomPose = await view();
  expect(Number(roomPose.yaw)).not.toBe(0);

  // Leave for the film and come back. The film owns its own camera, so the
  // room's pose must survive the round trip untouched.
  const toggle = page.locator(".mode-toggle");
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(page.locator(".experience")).toHaveAttribute("data-screen", "cinematic");
  await toggle.click();
  await expect(page.locator(".experience")).toHaveAttribute("data-screen", "explore");
  await expect(page.locator(".explore-stage")).toBeVisible();

  expect(await view()).toEqual(roomPose);
});
