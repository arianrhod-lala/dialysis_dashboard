import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeProfiles } from "../analysis.js";
import { loadResearchCohort } from "./research-fixture.js";
test("the checked-in cohort retains exported eligible scores and exact totals", () => {
  const { raw, profiles, summary } = loadResearchCohort();
  assert.deepEqual(summary, {
    schemaVersion: 2,
    totalProfiles: 838,
    totalSessions: 12404,
    eligibleProfiles: 630,
    withheldProfiles: 208,
    scoreBands: { low: 143, medium: 401, high: 86, unknown: 208 },
    profileCountsBySessionRange: [120, 334, 221, 163],
  });
  raw.forEach((row, i) => {
    if (profiles[i].score !== null)
      assert.equal(profiles[i].score, Number(row.Clinical_Risk_Score));
  });
  assert.deepEqual(summarizeProfiles([...profiles].reverse()), summary);
});
