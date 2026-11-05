import { SESSION_RANGES } from "./summary.js";

/**
 * @typedef {Readonly<{id: string, sessions: number, score: number|null,
 * reasons: readonly string[], band: import('./summary.js').ScoreBand}>} ScreenedProfile
 */
const number = (value) =>
  value == null || String(value).trim() === ""
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;
/**
 * Screen one row from the aggregate CSV without replacing its exported score.
 * Missing/invalid measurement evidence returns score=null with withholding reasons.
 * Invalid identity or a nonpositive/unsafe recorded-session count throws instead:
 * neither condition can support trustworthy cohort counts.
 * @param {import('./csv.js').AggregateExportRow} row Named fields from parseCSV.
 * @returns {ScreenedProfile}
 * @throws {Error} If identity or session count is invalid.
 */
function toProfile(row) {
  const sessions = number(row.Session_Count),
    sbp = number(row.SBP_mean),
    std = number(row.SBP_std);
  const mean = number(row.Interdialytic_Weight_Gain_mean),
    weightStd = number(row.Interdialytic_Weight_Gain_std);
  const cv = number(row.IDWG_CV),
    rank = number(row.BP_Instability_Rank),
    rawScore = number(row.Clinical_Risk_Score);
  if (
    typeof row.Proxy_ID !== "string" ||
    !row.Proxy_ID.trim() ||
    !Number.isSafeInteger(sessions) ||
    sessions < 1
  )
    throw new Error("Invalid profile identity or recorded session count.");
  const reasons = [];
  if (sessions < 2) reasons.push("Fewer than two recorded sessions");
  if (sbp === null || sbp <= 0) reasons.push("Mean SBP missing or invalid");
  if (std === null || std < 0)
    reasons.push("SBP variability missing or invalid");
  if (mean === null) reasons.push("Mean IDWG missing or invalid");
  else if (mean < 0.5)
    reasons.push("Mean IDWG below 0.5 kg; legacy CV substitution unsupported");
  if (weightStd === null || weightStd < 0)
    reasons.push("IDWG variability missing or invalid");
  if (cv === null || cv < 0 || cv > 2)
    reasons.push("IDWG CV missing or outside 0–2");
  if (!Number.isInteger(rank) || rank < 1 || rank > 4)
    reasons.push("BP rank missing or outside integer range 1–4");
  if (rawScore === null || rawScore < 0 || rawScore > 65)
    reasons.push("Exported score missing or outside 0–65");
  // Verify the documented legacy contract, never replace the exported score.
  // Tolerance covers floating-point serialization, not presentation rounding.
  if (!reasons.length) {
    const expectedCV = Math.min(weightStd / mean, 2);
    if (Math.abs(cv - expectedCV) > 1e-9)
      reasons.push("Exported CV disagrees with aggregate measurements");
    const expectedScore = (sbp < 100 ? 25 : 0) + rank * 5 + cv * 10;
    if (Math.abs(rawScore - expectedScore) > 1e-9)
      reasons.push("Exported score disagrees with legacy formula");
  }
  const score = reasons.length ? null : rawScore;
  return Object.freeze({
    id: row.Proxy_ID,
    sessions,
    score,
    reasons: Object.freeze(reasons),
    band:
      score === null
        ? "unknown"
        : score >= 30
          ? "high"
          : score >= 15
            ? "medium"
            : "low",
  });
}
/**
 * Validate every export row before a cohort is used or written.
 * All row-level fatal errors propagate; duplicate trimmed IDs also reject the
 * entire collection. Insufficient measurements remain as withheld-score profiles.
 * @param {import('./csv.js').AggregateExportRow[]} rows Parsed aggregate CSV records.
 * @returns {ScreenedProfile[]} Screened profiles in input order.
 * @throws {Error} For fatal row errors or duplicate identities.
 */
function validateProfiles(rows) {
  const ids = new Set();
  return rows.map((row, index) => {
    let profile;
    try {
      profile = toProfile(row);
    } catch (cause) {
      throw new Error(
        `Invalid aggregate data row ${index + 1}: ${cause.message}`,
        { cause },
      );
    }
    const identity = profile.id.trim();
    if (!identity || ids.has(identity))
      throw new Error(
        `Blank or duplicate profile identity at data row ${index + 1}. Check the aggregate export.`,
      );
    ids.add(identity);
    return profile;
  });
}
// Build-time only. Publish counts, never identities, measurements or profile rows.
/**
 * @param {readonly ScreenedProfile[]} profiles Validated profiles only.
 * @returns {import('./summary.js').CohortSummary} No identity or measurements.
 */
function summarizeProfiles(profiles) {
  const scoreBands = { low: 0, medium: 0, high: 0, unknown: 0 };
  const profileCountsBySessionRange = SESSION_RANGES.map(() => 0);
  let totalSessions = 0;
  for (const profile of profiles) {
    scoreBands[profile.band]++;
    totalSessions += profile.sessions;
    const rangeIndex = SESSION_RANGES.findIndex(
      (range) => profile.sessions >= range.min && profile.sessions <= range.max,
    );
    profileCountsBySessionRange[rangeIndex]++;
  }
  return {
    schemaVersion: 2,
    totalProfiles: profiles.length,
    totalSessions,
    eligibleProfiles: profiles.length - scoreBands.unknown,
    withheldProfiles: scoreBands.unknown,
    scoreBands,
    profileCountsBySessionRange,
  };
}
export { toProfile, validateProfiles, summarizeProfiles };
