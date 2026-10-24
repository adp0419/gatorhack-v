import test from "node:test";
import assert from "node:assert/strict";
import { scoreWebsite } from "../src/health-scoring.js";
const lighthouse = (a = 80, s = 90, p = 60) => ({
  status: "available",
  categories: {
    accessibility: { score: a },
    seo: { score: s },
    performance: { score: p },
    "best-practices": { score: 1 },
  },
});
const journey = (...statuses) => ({
  status: "completed",
  assertions: statuses.map((status, index) => ({
    id: `assertion-${index}`,
    status,
  })),
});
const design = { status: "available" };

test("equal weights preserve precision until presentation; design and Best Practices cannot change points", () => {
  const input = {
    lighthouse: lighthouse(),
    journey: journey("passed"),
    design,
  };
  const baseline = scoreWebsite(input);
  assert.equal(baseline.score, 82.5);
  assert.equal(Math.round(baseline.score), 83);
  assert.equal(baseline.numericAvailable, 4);
  assert.equal(baseline.provisional, false);
  assert.equal(baseline.reportPartial, false);
  input.design = { status: "available", score: 0, severity: "critical" };
  input.lighthouse.categories["best-practices"].score = 100;
  assert.equal(scoreWebsite(input).score, baseline.score);
  assert.deepEqual(
    baseline.categories.map((c) => c.id),
    ["accessibility", "seo", "performance", "functionality"],
  );
});

test("unavailable journey yields three-category provisional score", () => {
  const result = scoreWebsite({
    lighthouse: lighthouse(),
    journey: { status: "unavailable" },
    design,
  });
  assert.equal(result.score, 230 / 3);
  assert.equal(Math.round(result.score), 77);
  assert.equal(result.numericAvailable, 3);
  assert.equal(result.provisional, true);
  assert.equal(result.journeyCoverage, null);
});

test("two pass, one fail, one unresolved has 67 functionality and 75% outcome coverage", () => {
  const result = scoreWebsite({
    journey: journey("passed", "passed", "failed", "not_tested"),
    design,
  });
  assert.equal(Math.round(result.categories[3].score), 67);
  assert.equal(result.journeyCoverage, 75);
  assert.equal(result.conclusive, 3);
  assert.equal(result.eligible, 4);
  assert.equal(result.provisional, true);
});

test("a single positive outcome and two unresolved assertions can score 100 only provisionally", () => {
  const result = scoreWebsite({
    lighthouse: lighthouse(),
    journey: {
      ...journey("passed", "review", "not_tested"),
      status: "partial",
    },
    design,
  });
  assert.equal(result.categories[3].score, 100);
  assert.equal(Math.round(result.journeyCoverage), 33);
  assert.equal(result.provisional, true);
  assert.equal(result.reportPartial, true);
});

test("zero is measured, malformed values and unavailable sources are not", () => {
  assert.equal(
    scoreWebsite({
      lighthouse: lighthouse(0, 0, 0),
      journey: journey("failed"),
      design,
    }).score,
    0,
  );
  for (const invalid of [NaN, Infinity, -1, 101, "90", null]) {
    assert.equal(
      scoreWebsite({ lighthouse: lighthouse(invalid, 90, 60), design })
        .categories[0].score,
      null,
    );
  }
  const unavailable = lighthouse();
  unavailable.status = "unavailable";
  assert.equal(scoreWebsite({ lighthouse: unavailable }).score, null);
  assert.equal(scoreWebsite().numericAvailable, 0);
});

test("Gemini absence changes report completeness without invalidating measured scores", () => {
  const result = scoreWebsite({
    lighthouse: lighthouse(),
    journey: journey("passed"),
    design: { status: "unavailable" },
  });
  assert.equal(result.score, 82.5);
  assert.equal(result.provisional, false);
  assert.equal(result.reportPartial, true);
});

test("repeated assertions never multiply denominator or extra passes; assessed N/A is excluded", () => {
  const selected = journey("passed", "failed", "not_applicable");
  selected.assertions.push({ id: "assertion-0", status: "passed" });
  const result = scoreWebsite({ journey: selected, design });
  assert.equal(result.categories[3].score, 50);
  assert.equal(result.conclusive, 2);
  assert.equal(result.eligible, 2);
  assert.equal(result.journeyCoverage, 100);
  const allNA = scoreWebsite({ journey: journey("not_applicable"), design });
  assert.equal(allNA.categories[3].score, null);
  assert.equal(allNA.journeyCoverage, null);
});
