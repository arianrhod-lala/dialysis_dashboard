/** @typedef {'low'|'medium'|'high'|'unknown'} ScoreBand */
/**
 * @typedef {Object} CohortSummary
 * @property {2} schemaVersion
 * @property {number} totalProfiles
 * @property {number} totalSessions
 * @property {number} eligibleProfiles
 * @property {number} withheldProfiles
 * @property {Record<ScoreBand, number>} scoreBands
 * @property {[number, number, number, number]} profileCountsBySessionRange Counts of profiles, in SESSION_RANGES order.
 */
export const SESSION_RANGES = Object.freeze(
  [
    { label: "1", caption: "1 recorded session", min: 1, max: 1 },
    { label: "2–9", caption: "2–9 recorded sessions", min: 2, max: 9 },
    { label: "10–24", caption: "10–24 recorded sessions", min: 10, max: 24 },
    { label: "25+", caption: "25+ recorded sessions", min: 25, max: Infinity },
  ].map(Object.freeze),
);

/**
 * Validate untrusted JSON against the public, counts-only contract.
 * @param {unknown} input
 * @returns {CohortSummary} Input returned only after schema and consistency checks.
 * @throws {Error} For extra fields, unsupported schema, invalid counts or totals.
 */
export function validateSummary(input) {
  const data = /** @type {CohortSummary} */ (input);
  const keys = [
    "schemaVersion",
    "totalProfiles",
    "totalSessions",
    "eligibleProfiles",
    "withheldProfiles",
    "scoreBands",
    "profileCountsBySessionRange",
  ];
  const exactKeys = (object, expected) =>
    object &&
    !Array.isArray(object) &&
    typeof object === "object" &&
    Object.keys(object).length === expected.length &&
    expected.every((key) => Object.hasOwn(object, key));
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  if (
    !exactKeys(data, keys) ||
    data.schemaVersion !== 2 ||
    ![
      "totalProfiles",
      "totalSessions",
      "eligibleProfiles",
      "withheldProfiles",
    ].every((key) => count(data[key])) ||
    !exactKeys(data.scoreBands, ["low", "medium", "high", "unknown"]) ||
    !Object.values(data.scoreBands).every(count) ||
    !Array.isArray(data.profileCountsBySessionRange) ||
    data.profileCountsBySessionRange.length !== SESSION_RANGES.length ||
    !data.profileCountsBySessionRange.every(count)
  )
    throw new Error("Invalid cohort summary schema. Rebuild the showcase.");
  const minimumSessions = data.profileCountsBySessionRange.reduce(
    (n, value, i) => n + value * SESSION_RANGES[i].min,
    0,
  );
  const maximumSessions = data.profileCountsBySessionRange.reduce(
    (n, value, i) => (value === 0 ? n : n + value * SESSION_RANGES[i].max),
    0,
  );
  if (
    sum(Object.values(data.scoreBands)) !== data.totalProfiles ||
    sum(data.profileCountsBySessionRange) !== data.totalProfiles ||
    data.eligibleProfiles + data.withheldProfiles !== data.totalProfiles ||
    data.scoreBands.unknown !== data.withheldProfiles ||
    data.profileCountsBySessionRange[0] > data.withheldProfiles ||
    data.totalSessions < minimumSessions ||
    data.totalSessions > maximumSessions ||
    (!data.totalProfiles && data.totalSessions)
  )
    throw new Error("Inconsistent cohort totals. Rebuild the showcase.");
  return data;
}
