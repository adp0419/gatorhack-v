import { test } from "node:test";
import assert from "node:assert/strict";
import { score, compare } from "../src/scoring.js";
import { REGISTRY } from "../src/registry.js";
const manifest = {
  versions: { checks: "v1" },
  checkpoints: [
    {
      id: "a",
      goal: "test",
      logicalUrl: "https://example.com",
      sample: ["id:menu"],
    },
  ],
  viewports: { desktop: 1280, narrow: 320 },
  authorization: "public",
  budgets: { calls: 12 },
};
const all = (status = "passed") =>
  REGISTRY.map((c) => ({
    checkId: c.id,
    checkpointId: "a",
    status,
    passedTargets: ["id:menu"],
  }));
test("equal category weights: one keyboard failure gives 90, independent of nodes or impact", () => {
  const r = all();
  r[0].status = "failed";
  r[0].nodes = Array(20).fill({});
  r[0].impact = "critical";
  assert.equal(score(r, manifest).score, 90);
  assert.equal(score(r, manifest).coverage, 100);
  assert.equal(score(r, manifest).provisional, false);
});
test("genuine forms N/A yields 87.5 and excludes coverage denominator", () => {
  const r = all();
  r[0].status = "failed";
  for (const result of r)
    if (result.checkId.startsWith("F")) result.status = "not_applicable";
  assert.equal(score(r, manifest).score, 87.5);
  assert.equal(score(r, manifest).categories[1].state, "not_applicable");
});
test("untested keyboard preserves provisional 100 with 80% macro coverage", () => {
  const r = all();
  r.filter((x) => x.checkId.startsWith("K")).forEach(
    (x) => (x.status = "not_tested"),
  );
  const s = score(r, manifest);
  assert.equal(s.score, 100);
  assert.equal(s.coverage, 80);
  assert.equal(s.provisional, true);
  assert.equal(s.categories[0].state, "not_scored");
});
test("unresolved evidence and no applicable evidence never fabricate score", () => {
  assert.equal(score(all("review"), manifest).score, null);
  assert.equal(score(all("review"), manifest).coverage, 0);
  assert.equal(score(all("not_applicable"), manifest).score, null);
  assert.equal(score(all("not_applicable"), manifest).coverage, null);
});
test("mixed results counted per check/state; duplicates cannot dilute failures", () => {
  const m = { ...manifest, checkpoints: [{ id: "a" }, { id: "b" }] };
  const r = all();
  r[1].status = "failed";
  const s = score(r, m);
  assert.equal(s.categories[0].score, 50);
  assert.equal(s.categories[0].coverage, 50);
  assert.equal(s.provisional, true);
  assert.equal(
    score([...r, { ...r[1], status: "passed" }], m).categories[0].score,
    50,
  );
});
const finding = {
  key: "same",
  checkId: "K01",
  checkpointId: "a",
  target: "id:menu",
  verification: "confirmed",
};
function report(overrides = {}) {
  return {
    id: "b",
    manifest,
    findings: [finding],
    results: all(),
    explorationComplete: true,
    summary: { score: 90 },
    ...overrides,
  };
}
test("retets require positive target pass and identical reconstructed scope", () => {
  const baseline = report();
  let current = report({ id: "c", findings: [], summary: { score: 100 } });
  assert.equal(compare(baseline, current).changes[0].retest, "resolved");
  assert.equal(compare(baseline, current).delta, 10);
  current.results = current.results.map((r) => ({ ...r, passedTargets: [] }));
  assert.equal(compare(baseline, current).changes[0].retest, "unverified");
  current = report({
    findings: [],
    manifest: {
      ...manifest,
      checkpoints: [{ ...manifest.checkpoints[0], reconstructed: false }],
    },
  });
  assert.equal(compare(baseline, current).comparable, false);
  assert.equal(compare(baseline, current).delta, null);
  assert.equal(compare(baseline, current).changes[0].retest, "unverified");
});
test("changed methods and vanished/N/A targets are unverified", () => {
  const baseline = report();
  for (const changes of [
    { manifest: { ...manifest, authorization: "active" } },
    { manifest: { ...manifest, viewports: { desktop: 1000 } } },
    { results: all("not_applicable") },
  ]) {
    const comparison = compare(baseline, report({ findings: [], ...changes }));
    assert.equal(comparison.changes[0].retest, "unverified");
  }
  assert.equal(compare(baseline, report()).changes[0].retest, "persistent");
  assert.equal(
    compare(report({ findings: [] }), report()).changes[0].retest,
    "new",
  );
});
test("a positively verified fix in one matched checkpoint survives an unrelated reconstruction failure; delta does not", () => {
  const comparison = compare(
    report(),
    report({ findings: [], explorationComplete: false }),
  );
  assert.equal(comparison.changes[0].retest, "resolved");
  assert.equal(comparison.comparable, false);
  assert.equal(comparison.delta, null);
});
