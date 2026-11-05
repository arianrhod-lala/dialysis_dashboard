import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { createShowcase } from "../script.js";
import { summary, empty, known } from "./fixtures.js";

class FakeElement {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.hidden = false;
    this.textContent = "";
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  addEventListener(name, fn) {
    (this.listeners[name] ??= []).push(fn);
  }
  fire(name) {
    return Promise.all((this.listeners[name] ?? []).map((fn) => fn()));
  }
}
async function browserChecks(withCharts) {
  const allowed = [
    "retryBtn",
    "loadStatus",
    "metricsGrid",
    "findingsGrid",
    "sessionSummary",
    "distributionSummary",
    "chartStatus",
    "sessionsChart",
    "distributionChart",
  ];
  const nodes = new Map(allowed.map((id) => [id, new FakeElement()]));
  const get = (id) => {
    assert(nodes.has(id), `Unexpected browser dependency: ${id}`);
    return nodes.get(id);
  };
  let mode = "ok",
    requests = 0,
    destroyed = 0;
  const charts = [];
  const context = {
    document: {
      readyState: "complete",
      getElementById: get,
      createElement: () => new FakeElement(),
    },
    fetch: async (url) => {
      assert.equal(url, "cohort-summary.json");
      requests++;
      return {
        ok: mode !== "http",
        status: 503,
        json: async () => {
          if (mode === "json") throw new Error("Invalid JSON");
          return mode === "empty"
            ? empty
            : mode === "schema"
              ? { ...summary, profiles: [known] }
              : summary;
        },
      };
    },
    console,
  };
  if (withCharts)
    context.Chart = class {
      constructor(canvas, config) {
        charts.push(config);
      }
      destroy() {
        destroyed++;
      }
    };
  const showcase = createShowcase({
    document: context.document,
    fetchData: context.fetch,
    ChartClass: context.Chart,
  });
  await showcase.load();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(get("loadStatus").textContent, /summary loaded/);
  assert.equal(get("findingsGrid").children.length, 3);
  assert.match(
    get("findingsGrid").children[0].children[2].textContent,
    /2 of 8 profiles \(25.0%\)/,
  );
  assert.match(
    get("findingsGrid").children[2].children[2].textContent,
    /1 of 6 retained scores \(16.7%\)/,
  );
  assert.match(
    get("sessionSummary").textContent,
    /1 recorded session: 1 profiles/,
  );
  assert.match(get("distributionSummary").textContent, /Withheld: 2/);
  if (withCharts) {
    assert.equal(charts.length, 2);
    assert.deepEqual(
      Array.from(charts[0].data.datasets[0].data),
      summary.profileCountsBySessionRange,
    );
    assert.deepEqual(Array.from(charts[1].data.datasets[0].data), [2, 3, 1, 2]);
  } else assert.match(get("chartStatus").textContent, /Charts are unavailable/);
  for (const failure of ["http", "json", "schema"]) {
    mode = failure;
    await get("retryBtn").fire("click");
    assert.match(get("loadStatus").textContent, /could not load/);
    assert.equal(get("retryBtn").hidden, false);
    assert.equal(get("metricsGrid").children.length, 0);
    assert.equal(get("findingsGrid").children.length, 0);
    assert.equal(get("distributionSummary").textContent, "");
  }
  if (withCharts) assert.equal(destroyed, 2);
  mode = "empty";
  await get("retryBtn").fire("click");
  assert.match(get("loadStatus").textContent, /no profiles/);
  assert.equal(get("findingsGrid").children.length, 0);
  mode = "ok";
  await get("retryBtn").fire("click");
  assert.match(get("loadStatus").textContent, /summary loaded/);
  assert.equal(get("retryBtn").hidden, true);
  assert.equal(requests, 6);
  assert.equal(get("retryBtn").listeners.click.length, 1);
}

test("findings survive absent charts, errors, empty data and retry", () =>
  browserChecks(false));
test("chart counts agree with findings and instances are disposed", () =>
  browserChecks(true));

test("importing the factory is inert even when browser globals exist", () => {
  const moduleURL = new URL("../script.js", import.meta.url).href;
  const probe = `globalThis.document={getElementById(){throw new Error('import touched DOM')}}; globalThis.fetch=()=>{throw new Error('import fetched data')}; await import(${JSON.stringify(moduleURL)});`;
  execFileSync(process.execPath, ["--input-type=module", "-e", probe]);
});
