import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { build } from "../build-showcase.js";
import { PUBLIC_ASSETS } from "../site-assets.js";
import { header, known, serialize } from "./fixtures.js";
import { loadResearchCohort } from "./research-fixture.js";
import { temporaryDirectory } from "./temporary-directory.js";

const root = path.resolve(import.meta.dirname, "..");

test("build publishes only allowlisted files and counts, reproducibly", (context) => {
  const { profiles, summary } = loadResearchCohort();
  const output = temporaryDirectory(context);
  assert.deepEqual(build(root, output), summary);
  assert.deepEqual(fs.readdirSync(output).sort(), [...PUBLIC_ASSETS].sort());
  const published = fs.readFileSync(
    path.join(output, "cohort-summary.json"),
    "utf8",
  );
  assert.deepEqual(JSON.parse(published), summary);
  for (const profile of profiles) assert(!published.includes(profile.id));
  build(root, output);
  assert.equal(
    fs.readFileSync(path.join(output, "cohort-summary.json"), "utf8"),
    published,
  );
});

test("build rejects unexpected public files and never overwrites them", (context) => {
  const output = temporaryDirectory(context);
  const sentinel = path.join(output, "Patient_Dashboard_Data.csv");
  fs.writeFileSync(sentinel, "synthetic unexpected publication file");
  assert.throws(() => build(root, output), /unexpected files/);
  assert.equal(
    fs.readFileSync(sentinel, "utf8"),
    "synthetic unexpected publication file",
  );
  assert.deepEqual(fs.readdirSync(output), ["Patient_Dashboard_Data.csv"]);
});

test("invalid input fails before writing assets or changing a previous build", (context) => {
  const source = temporaryDirectory(context);
  const output = temporaryDirectory(context);
  build(root, output);
  const previous = fs.readFileSync(
    path.join(output, "cohort-summary.json"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(source, "Patient_Dashboard_Data.csv"),
    header + "\n" + serialize(known) + "\n" + serialize(known),
  );
  assert.throws(() => build(source, output), /duplicate/);
  assert.equal(
    fs.readFileSync(path.join(output, "cohort-summary.json"), "utf8"),
    previous,
  );
});
