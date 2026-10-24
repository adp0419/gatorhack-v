import { test } from "node:test";
import assert from "node:assert/strict";
import { testApp } from "./helpers.js";
import { newRun, runAudit } from "../../src/runner.js";
import { openBrowser, state } from "../../src/browser.js";
import {
  checkpointSignature,
  reconstructCheckpoint,
  fallbackUrl,
} from "../../src/reconstruction.js";
import { reconstructionComplete } from "../../src/retest.js";

test("provider outage reconstructs the frozen sample through labeled replay and positively verifies a fix", async () => {
  const app = await testApp();
  const unavailable = async () => {
    throw new Error("Deliberate provider outage in test harness");
  };
  try {
    const baseline = newRun(`${app.origin}/fixtures/broken`, app.origin);
    await runAudit(baseline, {
      store: app.store,
      fixtureOrigin: app.origin,
      decisionProvider: unavailable,
      provider: async ({ steps, elements }) => ({
        action: steps.length
          ? { type: "done", reason: "Test complete", commits: false }
          : {
              type: "click",
              ...elements.find((e) => e.label === "Explore projects"),
              reason: "Test-selected action",
              commits: false,
            },
      }),
    });
    assert.equal(baseline.manifest.checkpoints.length, 2);
    const retest = newRun(
      `${app.origin}/fixtures/fixed`,
      app.origin,
      baseline.id,
    );
    await runAudit(retest, {
      store: app.store,
      fixtureOrigin: app.origin,
      baseline,
      provider: unavailable,
      decisionProvider: unavailable,
    });
    assert.equal(retest.providers.twinly, "unavailable");
    assert.equal(retest.explorationStop, "plan_reconstructed_fallback");
    assert.equal(retest.explorationComplete, true);
    assert.equal(retest.comparison.comparable, true);
    assert.ok(
      retest.comparison.changes
        .filter((c) => c.checkId === "K01")
        .every((c) => c.retest === "resolved"),
    );
    const events = await app.store.events(retest.id);
    const fallbacks = events.filter(
      (e) => e.type === "reconstruction.fallback",
    );
    assert.ok(fallbacks.length > 0);
    assert.ok(fallbacks.every((e) => e.actor === "system"));
    assert.equal(
      events.some((e) => e.type === "action.executed" && e.actor === "twinly"),
      false,
    );
    assert.deepEqual(baseline.manifest.checkpoints[0].sample, [
      "id:menu-control",
    ]);
  } finally {
    await app.close();
  }
});

test("direct URL fallback must match the widget state and never invents missing sampled interactions", async () => {
  const app = await testApp();
  const session = await openBrowser({
    origin: app.origin,
    fixtureOrigin: app.origin,
  });
  try {
    const page = session.page,
      url = `${app.origin}/fixtures/fixed`;
    await page.goto(url);
    const stored = {
      id: "state-1",
      url,
      signature: checkpointSignature(await state(page)),
      sample: [],
      selected: [],
      setupActions: [
        {
          type: "key",
          keys: "cmd+l",
          reason: "Invalid replay",
          commits: false,
        },
      ],
    };
    const reasons = [];
    const options = {
      page,
      stored,
      startUrl: `${app.origin}/fixtures/broken`,
      guard: () => {},
      record: async (reason) => {
        reasons.push(reason);
        return "frame-test";
      },
    };
    const recovered = await reconstructCheckpoint(options);
    assert.equal(recovered.reconstructedBy, "direct URL fallback");
    assert.equal(recovered.setupUrl, url);
    assert.ok(
      reasons.some((r) => r.includes("recorded replay fallback failed")),
    );
    const mismatch = {
      ...stored,
      signature: {
        ...stored.signature,
        expanded: [["menu-control", "true", false]],
      },
    };
    assert.equal(
      await reconstructCheckpoint({ ...options, stored: mismatch }),
      null,
    );
    const missing = { ...stored, sample: ["id:missing"] };
    const partial = await reconstructCheckpoint({
      ...options,
      stored: missing,
    });
    assert.equal(
      reconstructionComplete({ checkpoints: [missing] }, [partial]),
      false,
    );
    await assert.rejects(
      () =>
        reconstructCheckpoint({
          ...options,
          guard: () => {
            throw new Error("Canceled");
          },
        }),
      /Canceled/,
    );
    assert.equal(fallbackUrl("https://elsewhere.example/", url), null);
    assert.equal(fallbackUrl(`${url}?commit=true`, url), null);
    assert.equal(
      fallbackUrl(
        `http://user:password@127.0.0.1:${new URL(url).port}/fixtures/fixed`,
        url,
      ),
      null,
    );
  } finally {
    await session.close();
    await app.close();
  }
});
