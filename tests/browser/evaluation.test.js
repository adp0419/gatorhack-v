import { test } from "node:test";
import assert from "node:assert/strict";
import { testApp } from "./helpers.js";
import { newWebsiteRun, runEvaluation } from "../../src/evaluation.js";

const waitFor = async (app, id, predicate) => {
  for (let i = 0; i < 100; i++) {
    const run = await (await fetch(`${app.origin}/api/audits/${id}`)).json();
    if (predicate(run)) return run;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Evaluation did not reach the expected state");
};
const start = async (app) => {
  const response = await fetch(`${app.origin}/api/audits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${app.origin}/fixtures/fixed` }),
  });
  assert.equal(response.status, 202);
  return (await response.json()).id;
};

test("v2 pipeline preserves a real fixture journey and qualitative review when hosted measurements cannot run", async () => {
  let reviews = 0;
  const app = await testApp(
    (run, options) =>
      runEvaluation(run, {
        ...options,
        provider: async ({ elements }) => {
          // Harness-only provider selection. All execution and verification below
          // runs against Chromium; this is never claimed as a live Twinly call.
          const element = elements.find(
            (item) => item.label === "Explore projects",
          );
          assert.ok(element);
          return {
            action: {
              type: "click",
              x: element.x,
              y: element.y,
              reason: "Test-selected project navigation",
              commits: false,
            },
          };
        },
        pageProvider: async () => {
          throw new Error("Local URLs must never reach PageSpeed");
        },
        designProvider: async ({
          screenshots,
          evidence,
          journey,
          measurements,
        }) => {
          reviews++;
          assert.ok(screenshots.length >= 1 && screenshots.length <= 3);
          assert.ok(
            screenshots.every(
              (s) => Buffer.from(s.data, "base64").byteLength > 1000,
            ),
          );
          assert.equal(journey.status, "completed");
          assert.equal(measurements.status, "unavailable");
          return {
            status: "available",
            model: "isolated-test-provider",
            promptVersion: "test-only",
            summary: "Qualitative review from the isolated test harness.",
            observations: [
              {
                category: "design",
                title: "Navigation clarity",
                observation: "Project links became visible.",
                evidenceIds: [evidence[0].id],
              },
            ],
            recommendations: [
              {
                category: "design",
                title: "Review navigation",
                recommendation: "Keep the navigation labels clear.",
                evidenceIds: [evidence[0].id],
                priority: "low",
              },
            ],
            limitations: ["Test harness output; no live Gemini call."],
            raw: { harness: true },
          };
        },
      }),
    newWebsiteRun,
  );
  try {
    const id = await start(app);
    const run = await waitFor(app, id, (r) => r.status === "partial");
    assert.equal(reviews, 1);
    assert.equal(run.manifest.versions.schema, "website-evaluation-v2");
    assert.equal(run.manifest.versions.scoring, "website-health-v2");
    assert.deepEqual(run.providers, {
      pagespeed: "unavailable",
      twinly: "available",
      gemini: "available",
    });
    assert.equal(run.journey.status, "completed");
    assert.equal(run.summary.numericAvailable, 1);
    assert.equal(run.summary.score, 100);
    assert.equal(run.summary.provisional, true);
    assert.equal(run.summary.journeyCoverage, 100);
    assert.equal(run.summary.categories.length, 4);
    assert.ok(!run.summary.categories.some((c) => c.id === "design"));
    assert.ok(
      run.findings.some(
        (f) =>
          f.source === "Gemini qualitative review" &&
          f.verification === "suggestion",
      ),
    );
    assert.equal(run.sources.design.raw, undefined);
    assert.deepEqual(JSON.parse(await app.store.read(id, "gemini-raw.json")), {
      harness: true,
    });
    const persisted = JSON.parse(await app.store.read(id, "report.json"));
    assert.deepEqual(persisted.journey.assertions, run.journey.assertions);
    const events = await app.store.events(id);
    assert.deepEqual(
      events.map((e) => e.seq),
      events.map((_, i) => i + 1),
    );
    assert.ok(
      events.findIndex((e) => e.type === "journey.selected") <
        events.findIndex((e) => e.type === "action.executed"),
    );
    const frame = events.find((e) => e.type === "frame.captured").payload;
    assert.equal((await fetch(`${app.origin}${frame.url}`)).status, 200);
    const unsupported = await fetch(`${app.origin}/api/audits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `${app.origin}/fixtures/fixed`,
        baselineRunId: id,
      }),
    });
    assert.equal(unsupported.status, 400);
    assert.match(
      (await unsupported.json()).error,
      /comparisons are not supported/,
    );
  } finally {
    await app.close();
  }
});

test("v2 cancellation retains screenshots and unavailable sources without inventing outcomes", async () => {
  let started = false,
    reviewed = false;
  const app = await testApp(
    (run, options) =>
      runEvaluation(run, {
        ...options,
        provider: async ({ signal }) => {
          started = true;
          return new Promise((_, reject) => {
            if (signal.aborted) return reject(signal.reason);
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          });
        },
        designProvider: async () => {
          reviewed = true;
          throw new Error("Should not run after cancellation");
        },
      }),
    newWebsiteRun,
  );
  try {
    const id = await start(app);
    await waitFor(app, id, () => started);
    assert.equal(
      (await fetch(`${app.origin}/api/audits/${id}/cancel`, { method: "POST" }))
        .status,
      202,
    );
    const run = await waitFor(app, id, (r) => r.status === "canceled");
    assert.equal(reviewed, false);
    assert.equal(run.summary.score, null);
    assert.equal(run.summary.provisional, true);
    assert.equal(run.journey.status, "unavailable");
    assert.deepEqual(run.journey.assertions, []);
    assert.equal(run.sources.design.status, "unavailable");
    assert.ok(
      (await app.store.events(id)).some((e) => e.type === "frame.captured"),
    );
    assert.equal(
      (await fetch(`${app.origin}/api/audits/${id}/report.json`)).status,
      200,
    );
  } finally {
    await app.close();
  }
});
