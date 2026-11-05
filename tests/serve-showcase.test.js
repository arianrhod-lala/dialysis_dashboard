import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createServer } from "../serve-showcase.js";
import { build } from "../build-showcase.js";
import { temporaryDirectory } from "./temporary-directory.js";

async function preview(context, root, options) {
  const server = createServer(root, options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test("preview serves the built page and aggregate JSON with correct headers", async (context) => {
  const output = temporaryDirectory(context);
  const summary = build(path.resolve(import.meta.dirname, ".."), output);
  const url = await preview(context, output);
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(
    await (await fetch(url + "/cohort-summary.json")).json(),
    summary,
  );
  const head = await fetch(url + "/index.html", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("preview denies source data and traversal even when a CSV exists in the public folder", async (context) => {
  const output = temporaryDirectory(context);
  fs.writeFileSync(
    path.join(output, "Patient_Dashboard_Data.csv"),
    "synthetic private input",
  );
  const url = await preview(context, output);
  for (const file of [
    "Patient_Dashboard_Data.csv",
    "High_Risk_Patients_Report.csv",
    "analysis.js",
    "analysis_pipeline.py",
    ".git/config",
    "%2e%2e/Patient_Dashboard_Data.csv",
  ])
    assert.equal((await fetch(url + "/" + file)).status, 404);
  const post = await fetch(url + "/index.html", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
});

test("preview reports missing build output without serving another folder", async (context) => {
  const url = await preview(context, temporaryDirectory(context));
  const response = await fetch(url);
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Build the showcase/);
});

test("preview distinguishes an unreadable asset from a missing build and preserves diagnostics", async (context) => {
  const failure = Object.assign(new Error("synthetic access failure"), {
    code: "EACCES",
  });
  const logs = [];
  const url = await preview(context, temporaryDirectory(context), {
    readAsset: (_path, callback) => callback(failure),
    logError: (...args) => logs.push(args),
  });
  const response = await fetch(url);
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /Build the showcase/);
  assert.equal(logs[0][0], "Could not read showcase asset index.html");
  assert.equal(logs[0][1], failure);
});
