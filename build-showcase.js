import { parseCSV } from "./csv.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProfiles, summarizeProfiles } from "./analysis.js";
import { validateSummary } from "./summary.js";
import { PUBLIC_ASSETS } from "./site-assets.js";
export function build(
  root = import.meta.dirname,
  output = path.join(root, "dist"),
) {
  const csv = fs.readFileSync(
    path.join(root, "Patient_Dashboard_Data.csv"),
    "utf8",
  );
  const rows = parseCSV(csv);
  const profiles = validateProfiles(rows);
  const summary = validateSummary(summarizeProfiles(profiles));
  // Read and validate everything before modifying the public folder.
  const assets = new Map(
    PUBLIC_ASSETS.filter((name) => name !== "cohort-summary.json").map(
      (name) => [
        name,
        fs.readFileSync(
          name === "chart.min.js"
            ? path.join(
                import.meta.dirname,
                "node_modules/chart.js/dist/chart.min.js",
              )
            : path.join(root, name),
        ),
      ],
    ),
  );
  assets.set("cohort-summary.json", JSON.stringify(summary, null, 2) + "\n");
  if (fs.existsSync(output)) {
    const unexpected = fs
      .readdirSync(output, { withFileTypes: true })
      .filter(
        (entry) => !entry.isFile() || !PUBLIC_ASSETS.includes(entry.name),
      );
    if (unexpected.length)
      throw new Error(
        "Publish folder contains unexpected files. Use a clean folder; only showcase assets may be published.",
      );
  }
  fs.mkdirSync(output, { recursive: true });
  for (const [name, content] of assets)
    fs.writeFileSync(path.join(output, name), content);
  return summary;
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    const summary = build();
    console.log(
      `Built aggregate showcase in dist: ${summary.totalProfiles} proxy profiles, ${summary.withheldProfiles} scores withheld. Publish only dist/.`,
    );
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
