import { validateSummary } from "./summary.js";
import { createRenderer } from "./renderer.js";

export function createShowcase({ document, fetchData, ChartClass }) {
  const $ = (id) => document.getElementById(id);
  const renderer = createRenderer({ document, ChartClass });
  async function loadData() {
    $("retryBtn").hidden = true;
    renderer.clear();
    $("loadStatus").textContent = "Loading cohort findings…";
    try {
      const response = await fetchData("cohort-summary.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = validateSummary(await response.json());
      if (!data.totalProfiles) {
        $("loadStatus").textContent =
          "The summary contains no profiles. No findings are available.";
        return;
      }
      renderer.render(data);
      $("loadStatus").textContent =
        "Cohort summary loaded. Source generation date unavailable.";
    } catch (error) {
      renderer.clear();
      $("loadStatus").textContent =
        `Findings could not load: ${error.message} Check cohort-summary.json in the built showcase.`;
      $("retryBtn").hidden = false;
    }
  }
  $("retryBtn").addEventListener("click", loadData);
  return { load: loadData };
}
