import { parseCSV } from "../csv.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { toProfile, validateProfiles, summarizeProfiles } from "../analysis.js";
import { known, header, serialize } from "./fixtures.js";

test("missing, invalid and singleton measurements withhold rather than replace scores", () => {
  for (const changes of [
    { Session_Count: "1" },
    { SBP_mean: "" },
    { SBP_std: "NaN" },
    { IDWG_CV: "bad" },
    { Clinical_Risk_Score: "" },
    { Interdialytic_Weight_Gain_mean: "0" },
    { Interdialytic_Weight_Gain_mean: "-1" },
    { Interdialytic_Weight_Gain_mean: ".2" },
    { BP_Instability_Rank: "1.5" },
    { SBP_std: "-1" },
    { Interdialytic_Weight_Gain_std: "" },
  ]) {
    assert.equal(
      toProfile({ ...known, ...changes }).score,
      null,
      JSON.stringify(changes),
    );
  }
  const singleton = toProfile({
    ...known,
    Session_Count: "1",
    SBP_std: "",
    Interdialytic_Weight_Gain_std: "",
  });
  assert.equal(singleton.reasons.length, 3);
  assert(Object.isFrozen(singleton.reasons));
  for (const changes of [
    { Session_Count: "0" },
    { Session_Count: "1.5" },
    { Proxy_ID: "" },
  ])
    assert.throws(() => toProfile({ ...known, ...changes }));
});

test("duplicate and blank identities fail before a cohort is published", () => {
  assert.throws(
    () => validateProfiles([known, { ...known }]),
    /duplicate profile identity/,
  );
  assert.throws(
    () =>
      validateProfiles([
        known,
        { ...known, Proxy_ID: " " + known.Proxy_ID + " " },
      ]),
    /duplicate profile identity/,
  );
  assert.throws(
    () => validateProfiles([{ ...known, Proxy_ID: "  " }]),
    /identity/,
  );
  assert.deepEqual(validateProfiles([]), []);
});

test("formula checks preserve serialization tolerance and capped ratios", () => {
  assert.equal(toProfile(known).score, 13);
  assert.deepEqual(toProfile(known).reasons, []);
  assert.equal(
    toProfile({ ...known, Clinical_Risk_Score: "13.0000000001" }).score,
    13.0000000001,
  );
  assert.equal(
    toProfile({ ...known, Clinical_Risk_Score: "13.00001" }).score,
    null,
  );
  assert.equal(
    toProfile({
      ...known,
      Interdialytic_Weight_Gain_std: "6",
      IDWG_CV: "2",
      Clinical_Risk_Score: "30",
    }).score,
    30,
  );
  const mismatch = toProfile({
    ...known,
    IDWG_CV: ".4",
    Clinical_Risk_Score: "14",
  });
  assert.equal(mismatch.score, null);
  assert.match(mismatch.reasons.join("; "), /CV disagrees/);
});

test("score bands use full precision at both thresholds", () => {
  for (const [score, cv, rank, band] of [
    [14.9999, 0.49999, 2, "low"],
    [15, 0.5, 2, "medium"],
    [29.9999, 0.99999, 4, "medium"],
    [30, 1, 4, "high"],
  ]) {
    assert.equal(
      toProfile({
        ...known,
        Clinical_Risk_Score: String(score),
        IDWG_CV: String(cv),
        Interdialytic_Weight_Gain_std: String(cv * 2),
        BP_Instability_Rank: String(rank),
      }).band,
      band,
    );
  }
});

test("CSV accepts quoted delimiters, escaped quotes, multiline cells and empty cohorts", () => {
  const quoted = { ...known, Proxy_ID: 'quoted, "ID"\nsecond line' };
  assert.equal(
    parseCSV("\uFEFF" + header + "\r\n" + serialize(quoted))[0].Proxy_ID,
    quoted.Proxy_ID,
  );
  assert.deepEqual(parseCSV(header + "\n"), []);
  for (const invalid of [
    "",
    "<html>error</html>",
    header + "\nx,y",
    header + '\n"unclosed',
    header + '\n"closed"bad',
  ])
    assert.throws(() => parseCSV(invalid));
});

test("fixed session bins preserve cohort counts without publishing identity", () => {
  const synthetic = validateProfiles(
    [1, 2, 9, 10, 24, 25].map((sessions, i) => ({
      ...known,
      Proxy_ID: `synthetic-${i}`,
      Session_Count: String(sessions),
    })),
  );
  const grouped = summarizeProfiles(synthetic);
  assert.deepEqual(grouped.profileCountsBySessionRange, [1, 2, 2, 1]);
  assert.equal(grouped.totalSessions, 71);
  assert.equal(grouped.withheldProfiles, 1);
  assert(
    !JSON.stringify(summarizeProfiles([toProfile(known)])).includes(
      known.Proxy_ID,
    ),
  );
});

test("fatal input errors identify the data row without revealing its content", () => {
  assert.throws(
    () => validateProfiles([known, { ...known, Session_Count: "0" }]),
    (error) => {
      assert.match(error.message, /data row 2/);
      assert(error.cause instanceof Error);
      assert(!error.message.includes(known.Proxy_ID));
      return true;
    },
  );
  assert.throws(
    () => parseCSV(header + "\n" + serialize(known) + "\nx,y"),
    /data row 2/,
  );
  assert.throws(() => parseCSV(header + '\n"unclosed'), /character \d+/);
});
