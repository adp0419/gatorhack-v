import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileStore } from "../src/store.js";
import {
  newWebsiteRun,
  runEvaluation,
  interruptWebsiteRun,
} from "../src/evaluation.js";

test("browser failure preserves independently available page measurements and raw artifacts", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "accessbench-sources-"),
  );
  const store = new FileStore(directory);
  const run = newWebsiteRun("https://public.example/", "http://127.0.0.1:3000");
  let measured = 0;
  try {
    await runEvaluation(run, {
      store,
      fixtureOrigin: "http://127.0.0.1:3000",
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      browserFactory: async () => {
        throw new Error("Browser launch failed with secret internal URL");
      },
      pageProvider: async ({ url }) => {
        measured++;
        assert.equal(url, "https://public.example/");
        return {
          status: "available",
          categories: {
            accessibility: { score: 80 },
            seo: { score: 90 },
            performance: { score: 60 },
          },
          raw: { fixture: "isolated source response" },
        };
      },
      designProvider: async () => {
        throw new Error("Must not be called without screenshots");
      },
    });
    assert.equal(measured, 1);
    assert.equal(run.status, "partial");
    assert.equal(run.summary.numericAvailable, 3);
    assert.equal(Math.round(run.summary.score), 77);
    assert.equal(run.sources.design.status, "unavailable");
    assert.equal(run.sources.lighthouse.raw, undefined);
    assert.ok(!JSON.stringify(run.errors).includes("secret internal URL"));
    assert.deepEqual(
      JSON.parse(await store.read(run.id, "pagespeed-raw.json")),
      { fixture: "isolated source response" },
    );
    assert.equal((await store.get(run.id)).summary.numericAvailable, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unknown schemas cannot be evaluated as legacy accessibility reports", async () => {
  await assert.rejects(
    () =>
      runEvaluation({ manifest: { versions: { schema: "future-v3" } } }, {}),
    /Unsupported evaluation schema/,
  );
});

test("a run canceled while queued never launches a browser or sends provider evidence", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "accessbench-canceled-"),
  );
  const run = newWebsiteRun("https://public.example/", "http://127.0.0.1:3000");
  try {
    const unexpected = async () => {
      assert.fail("Canceled work must not start");
    };
    await runEvaluation(run, {
      store: new FileStore(directory),
      fixtureOrigin: "http://127.0.0.1:3000",
      signal: AbortSignal.abort(new Error("Canceled by user")),
      browserFactory: unexpected,
      pageProvider: unexpected,
      designProvider: unexpected,
    });
    assert.equal(run.status, "canceled");
    assert.equal(run.summary.score, null);
    assert.equal(run.sources.lighthouse.status, "unavailable");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cancellation during browser launch closes the late session before navigation", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "accessbench-launch-"),
  );
  const controller = new AbortController();
  const run = newWebsiteRun("https://public.example/", "http://127.0.0.1:3000");
  let closed = false;
  try {
    await runEvaluation(run, {
      store: new FileStore(directory),
      fixtureOrigin: "http://127.0.0.1:3000",
      signal: controller.signal,
      browserFactory: async () => {
        controller.abort(new Error("Canceled during launch"));
        return {
          close: async () => {
            closed = true;
          },
          navigateStart: async () => {
            assert.fail("Must not navigate after cancellation");
          },
        };
      },
      pageProvider: async () => {
        assert.fail("Must not send the canceled target");
      },
    });
    assert.equal(closed, true);
    assert.equal(run.status, "canceled");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("interruption recovery normalizes pending sources and scores the latest persisted assertion outcomes", () => {
  const run = newWebsiteRun("https://public.example/", "http://127.0.0.1:3000");
  run.sources.lighthouse = {
    status: "available",
    categories: {
      accessibility: { score: 80 },
      seo: { score: 90 },
      performance: { score: 60 },
    },
  };
  run.providers.pagespeed = "available";
  run.journey = {
    status: "partial",
    assertions: [
      { id: "control", status: "passed" },
      { id: "destination", status: "passed" },
      { id: "content", status: "not_tested" },
    ],
  };
  run.summary = { score: 0, numericAvailable: 0 };
  interruptWebsiteRun(run, "Local runner interrupted.");
  assert.equal(run.sources.design.status, "unavailable");
  assert.equal(run.providers.gemini, "unavailable");
  assert.equal(run.journey.status, "partial");
  assert.equal(run.journey.assertions.length, 3);
  assert.equal(run.summary.score, 82.5);
  assert.equal(run.summary.numericAvailable, 4);
  assert.equal(run.summary.conclusive, 2);
  assert.equal(run.summary.eligible, 3);
  assert.equal(run.summary.provisional, true);
  assert.equal(run.summary.reportPartial, true);
});
