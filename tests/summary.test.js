import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSummary } from "../summary.js";
import { summary, empty, known } from "./fixtures.js";

test("accepts the aggregate contract and the empty-cohort identity", () => {
  assert.equal(validateSummary(summary), summary);
  assert.equal(validateSummary(empty).totalProfiles, 0);
  assert.throws(
    () => validateSummary({ ...summary, schemaVersion: 1 }),
    /schema/,
  );
});

test("rejects extra detail, unsafe counts and inconsistent denominators", () => {
  for (const invalid of [
    null,
    {},
    { ...summary, profiles: [known] },
    { ...summary, totalProfiles: 839 },
    { ...summary, totalSessions: -1 },
    { ...summary, profileCountsBySessionRange: [838, 0, 0, 0] },
    { ...summary, scoreBands: { ...summary.scoreBands, high: 86.5 } },
    { ...summary, totalSessions: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.throws(() => validateSummary(invalid));
});
