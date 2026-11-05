import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "../build-showcase.js";
import { createServer } from "../serve-showcase.js";
import { PUBLIC_ASSETS } from "../site-assets.js";

let output, server, origin;
test.beforeAll(async () => {
  output = fs.mkdtempSync(path.join(os.tmpdir(), "dialysis-browser-"));
  build(path.resolve(import.meta.dirname, ".."), output);
  server = createServer(output);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (
    output &&
    path.dirname(path.resolve(output)) === path.resolve(os.tmpdir()) &&
    path.basename(output).startsWith("dialysis-browser-")
  )
    fs.rmSync(output, { recursive: true, force: true });
});

test("built page starts automatically, loads only public assets and recovers through the real retry control", async ({
  page,
}) => {
  const requests = [];
  const pageErrors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin);
  await expect(page.locator("#findingsGrid article")).toHaveCount(3);
  await expect(page.locator("#loadStatus")).toContainText("summary loaded");
  await expect(page.locator("#chartStatus")).toBeEmpty();
  expect(
    await page.evaluate(() => Object.keys(globalThis.Chart.instances).length),
  ).toBe(2);
  expect(requests.every((url) => url.startsWith(origin))).toBe(true);
  expect(
    requests.every((url) =>
      PUBLIC_ASSETS.includes(new URL(url).pathname.slice(1) || "index.html"),
    ),
  ).toBe(true);
  expect(requests.some((url) => url.endsWith("cohort-summary.json"))).toBe(
    true,
  );
  expect(requests.some((url) => /\.csv(?:\?|$)/.test(url))).toBe(false);
  expect(pageErrors).toEqual([]);

  await page.route("**/cohort-summary.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry loading findings" }),
  ).toBeVisible();
  await expect(page.locator("#findingsGrid article")).toHaveCount(0);
  await page.unroute("**/cohort-summary.json");
  await page.getByRole("button", { name: "Retry loading findings" }).click();
  await expect(page.locator("#findingsGrid article")).toHaveCount(3);

  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.goto(origin);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});
