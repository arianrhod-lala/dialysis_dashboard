import fs from "node:fs";
import { parseCSV } from "../csv.js";
import { validateProfiles, summarizeProfiles } from "../analysis.js";
import { validateSummary } from "../summary.js";

// Opt-in fixture loading: synthetic tests never import or read research data.
export function loadResearchCohort() {
  const text = fs.readFileSync(
    new URL("../Patient_Dashboard_Data.csv", import.meta.url),
    "utf8",
  );
  const raw = parseCSV(text);
  const profiles = validateProfiles(raw);
  return {
    raw,
    profiles,
    summary: validateSummary(summarizeProfiles(profiles)),
  };
}
