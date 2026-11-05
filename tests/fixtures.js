export const known = {
  Proxy_ID: "TEST-ID-NOT-FOR-PUBLICATION",
  Session_Count: "3",
  SBP_mean: "110",
  SBP_std: "8",
  Interdialytic_Weight_Gain_mean: "2",
  Interdialytic_Weight_Gain_std: ".6",
  IDWG_CV: ".3",
  BP_Instability_Rank: "2",
  Clinical_Risk_Score: "13",
};
export const header = Object.keys(known).join(",");
export const serialize = (row) =>
  Object.values(row)
    .map((value) => '"' + String(value).replace(/"/g, '""') + '"')
    .join(",");
export const summary = {
  schemaVersion: 2,
  totalProfiles: 8,
  totalSessions: 100,
  eligibleProfiles: 6,
  withheldProfiles: 2,
  scoreBands: { low: 2, medium: 3, high: 1, unknown: 2 },
  profileCountsBySessionRange: [1, 3, 2, 2],
};
export const empty = {
  schemaVersion: 2,
  totalProfiles: 0,
  totalSessions: 0,
  eligibleProfiles: 0,
  withheldProfiles: 0,
  scoreBands: { low: 0, medium: 0, high: 0, unknown: 0 },
  profileCountsBySessionRange: [0, 0, 0, 0],
};
