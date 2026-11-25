import { test, expect } from "@playwright/test";
/* global document, window, getComputedStyle */
import { build } from "../build-showcase.js";
import { createServer } from "../serve-showcase.js";

let server, origin;
test.beforeAll(async () => {
  build();
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("chapter arrivals run once and stop when reduced motion is enabled", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(origin);
  await page.locator(".finding").first().waitFor();
  await page.evaluate(() => {
    globalThis.chapterArrivals = 0;
    document
      .getElementById("analysis")
      .addEventListener("animationstart", () => {
        globalThis.chapterArrivals++;
      });
    document.getElementById("analysis").scrollIntoView({ behavior: "instant" });
  });
  await expect(page.locator("#analysis")).toHaveClass(/scroll-arrival/);
  await expect
    .poll(() => page.evaluate(() => globalThis.chapterArrivals))
    .toBe(1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.evaluate(() =>
    document.getElementById("analysis").scrollIntoView({ behavior: "instant" }),
  );
  expect(await page.evaluate(() => globalThis.chapterArrivals)).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#analysis")).not.toHaveClass(/scroll-arrival/);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  await expect(page.locator("#analysis h2")).toBeVisible();
});

test("reduced-motion and unavailable observer leave chapters visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin);
  expect(await page.locator(".scroll-arrival").count()).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    window.IntersectionObserver = undefined;
  });
  await page.goto(origin);
  expect(
    await page
      .locator("#analysis")
      .evaluate((node) => getComputedStyle(node).opacity),
  ).toBe("1");
  await expect(page.locator("#methodology h2")).toBeVisible();
});

test("findings still load when the optional motion module fails", async ({
  page,
}) => {
  await page.route("**/motion.js", (route) => route.abort());
  await page.goto(origin);
  await expect(page.locator("#findingsGrid article")).toHaveCount(3);
  await expect(page.locator("#chartStatus")).toBeEmpty();
  await expect(page.locator("#question-title")).toBeVisible();
});
