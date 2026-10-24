import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreRing,
  scoreLegend,
  healthCategoryCard,
} from "../public/components.js";

test("composite rings use equal segments for scored numeric categories and retain measured zero", () => {
  const categories = [
    { id: "accessibility", score: 80 },
    { id: "seo", score: 90 },
    { id: "performance", score: 0 },
    { id: "functionality", score: null },
    { id: "design", score: 100 },
  ];
  const svg = scoreRing(categories);
  assert.equal((svg.match(/data-score-segment=/g) || []).length, 3);
  assert.match(svg, /data-score-segment="performance" data-score="0"/);
  assert.doesNotMatch(svg, /data-score-segment="(?:design|functionality)"/);
  const tracks = [
    ...svg.matchAll(/class="score-ring-track"[^>]*stroke-dasharray="([\d.]+)/g),
  ].map((m) => Number(m[1]));
  assert.equal(tracks.length, 3);
  assert.ok(tracks.every((n) => Math.abs(n - (100 / 3 - 4.5)) < 1e-10));
  const fills = [
    ...svg.matchAll(/class="score-ring-fill"[^>]*stroke-dasharray="([\d.]+)/g),
  ].map((m) => Number(m[1]));
  assert.equal(fills.length, 2, "a zero score never paints a rounded dot");
  assert.ok(Math.abs(fills[0] - tracks[0] * 0.8) < 1e-10);
  assert.ok(Math.abs(fills[1] - tracks[1] * 0.9) < 1e-10);
  assert.match(scoreLegend(categories), /performance/);
  assert.doesNotMatch(scoreLegend(categories), /functionality|design/);
});

test("single full ring, absent values and invalid values remain distinct", () => {
  assert.match(
    scoreRing([{ id: "seo", score: 100 }]),
    /class="score-ring-fill"[^>]*stroke-dasharray="100 0"/,
  );
  for (const score of [null, undefined, NaN, Infinity, -1, 101, "80"]) {
    const svg = scoreRing([{ id: "seo", score }]);
    assert.match(svg, /score-ring-empty/);
    assert.doesNotMatch(svg, /score-ring-fill|data-score-segment/);
  }
  assert.match(healthCategoryCard({ id: "seo", score: null }), /Not scored/);
  assert.match(healthCategoryCard({ id: "seo", score: 0 }), /data-score="0"/);
  assert.match(
    scoreRing([{ id: "seo", score: 82.5 }]),
    /stroke-dasharray="82.5 17.5"/,
  );
});
