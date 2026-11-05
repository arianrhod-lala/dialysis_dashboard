import { SESSION_RANGES } from "./summary.js";

export function createRenderer({ document, ChartClass }) {
  const chartInstances = {};
  const $ = (id) => document.getElementById(id);
  const format = (value) => value.toLocaleString();
  const percent = (part, total) =>
    total ? `${((100 * part) / total).toFixed(1)}%` : "Unavailable";
  const sessionLabels = SESSION_RANGES.map((range) => range.label);
  function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function renderSummary(data) {
    const metrics = [
      [
        "Proxy profiles",
        data.totalProfiles,
        "Demographic groups; not verified people",
      ],
      [
        "Recorded sessions",
        data.totalSessions,
        "Observation count without follow-up time",
      ],
      [
        "Scores retained",
        data.eligibleProfiles,
        "Passed the aggregate evidence screen",
      ],
      [
        "Scores withheld",
        data.withheldProfiles,
        `${percent(data.withheldProfiles, data.totalProfiles)} of profiles`,
      ],
    ];
    $("metricsGrid").replaceChildren(
      ...metrics.map(([label, value, detail]) => {
        const node = element("div", "", "metric");
        node.append(
          element("div", label, "metric-label"),
          element("div", format(value), "metric-value"),
          element("div", detail, "metric-detail"),
        );
        return node;
      }),
    );
    const findings = [
      [
        "Some profiles cannot support a score.",
        `${format(data.withheldProfiles)} of ${format(data.totalProfiles)} profiles (${percent(data.withheldProfiles, data.totalProfiles)}) do not support a numerical score under the aggregate screen. Keeping them visible as a separate count avoids presenting missing evidence as a low score.`,
      ],
      [
        "Observation coverage is uneven.",
        `${format(data.profileCountsBySessionRange[0])} profiles have only one recorded session. A single observation cannot establish within-profile variability, and session totals alone cannot establish attendance or treatment frequency.`,
      ],
      [
        "A high band does not predict an outcome.",
        `${format(data.scoreBands.high)} of ${format(data.eligibleProfiles)} retained scores (${percent(data.scoreBands.high, data.eligibleProfiles)}) fall in the legacy high band (≥30). This describes a hand-weighted formula, not a probability of a clinical event or a survival outcome.`,
      ],
    ];
    $("findingsGrid").replaceChildren(
      ...findings.map(([title, text], i) => {
        const node = element("article", "", "finding");
        node.append(
          element("div", `0${i + 1}`, "eyebrow"),
          element("h3", title),
          element("p", text),
        );
        return node;
      }),
    );
    $("sessionSummary").textContent =
      data.profileCountsBySessionRange
        .map(
          (value, i) =>
            `${SESSION_RANGES[i].caption}: ${format(value)} profiles`,
        )
        .join(" · ") + ".";
    const bands = data.scoreBands;
    $("distributionSummary").textContent =
      `Low (<15): ${format(bands.low)} · Medium (15–<30): ${format(bands.medium)} · High (≥30): ${format(bands.high)} · Withheld: ${format(bands.unknown)}. Denominator: all ${format(data.totalProfiles)} proxy profiles.`;
    updateCharts(data);
  }
  function clearResults() {
    $("metricsGrid").replaceChildren();
    $("findingsGrid").replaceChildren();
    $("sessionSummary").textContent = "";
    $("distributionSummary").textContent = "";
    $("chartStatus").textContent = "";
    for (const id of Object.keys(chartInstances)) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }
  function updateCharts(data) {
    try {
      if (!ChartClass) throw new Error("Chart.js unavailable");
      makeChart(
        "sessionsChart",
        sessionLabels,
        data.profileCountsBySessionRange,
        "Recorded sessions per proxy profile",
        ["#285449", "#285449", "#285449", "#285449"],
      );
      makeChart(
        "distributionChart",
        ["Low", "Medium", "High", "Withheld"],
        ["low", "medium", "high", "unknown"].map((key) => data.scoreBands[key]),
        "Legacy score band / evidence",
        ["#285449", "#9a752e", "#9b4938", "#8b8b7c"],
      );
      $("chartStatus").textContent = "";
    } catch {
      $("chartStatus").textContent =
        "Charts are unavailable. All chart counts and findings are available in the text on this page.";
    }
  }
  function makeChart(id, labels, counts, x, colors) {
    chartInstances[id] = new ChartClass($(id), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Proxy profiles", data: counts, backgroundColor: colors },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: x }, grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            title: { display: true, text: "Proxy profiles" },
            grid: { color: "#deded2" },
          },
        },
      },
    });
  }

  return { render: renderSummary, clear: clearResults };
}
