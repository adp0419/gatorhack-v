import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { openBrowser } from "../../src/browser.js";
import { FileStore } from "../../src/store.js";
import { runJourney } from "../../src/journey.js";

// Deterministic providers below test the executor/assertions; they are never
// product walkthroughs or evidence of a live Twinly call.
test("frozen single journeys depend on independently observed endpoints", async (t) => {
  let scenario = "success";
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    if (req.url === "/fixtures/fixed") {
      res.end(`<html><head><title>Services</title></head><body><h1>Services</h1>
        <a id="pricing" href="/fixtures/negative">Pricing</a>
        <button id="details" aria-controls="panel" aria-expanded="false">Service details</button>
        <div id="panel" hidden><h2>Service details</h2><p>Support for your team.</p></div>
        <form><button id="submit">Send inquiry</button></form>
        <script>
          document.querySelector('#details').onclick = function () {
            ${scenario === "nochange" ? "" : "this.setAttribute('aria-expanded','true'); document.querySelector('#panel').hidden = false;"}
          };
        </script></body></html>`);
    } else {
      if (["error", "restricted-error"].includes(scenario))
        res.statusCode = 404;
      if (scenario === "gateway") res.statusCode = 502;
      res.end(
        ["error", "restricted-error"].includes(scenario)
          ? "<html><head><title>Not found</title></head><body><h1>404 Not found</h1></body></html>"
          : scenario === "gateway"
            ? "<html><head><title>Gateway response</title></head><body></body></html>"
            : scenario === "wrong"
              ? "<html><head><title>Unrelated</title></head><body><h1>Weather forecast</h1></body></html>"
              : "<html><head><title>Pricing</title></head><body><h1>Pricing</h1><p>Plans for teams.</p></body></html>",
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "accessbench-journey-"),
  );
  const store = new FileStore(directory);
  const session = await openBrowser({ origin, fixtureOrigin: origin });
  async function runCase(mode, target = "pricing", stop = "done") {
    scenario = mode;
    session.restrictions.length = 0;
    await session.navigateStart(`${origin}/fixtures/fixed`);
    const run = {
      id: randomUUID(),
      url: `${origin}/fixtures/fixed`,
      landedUrl: `${origin}/fixtures/fixed`,
      manifest: {},
      providers: { twinly: "pending" },
      seq: 0,
    };
    let called = 0;
    let frozen;
    const events = [];
    const emit = async (type, phase, actor, payload) => {
      await store.append(run, type, phase, actor, payload);
      events.push({ type, payload });
      if (mode === "restricted-error" && type === "action.executed") {
        session.restrictions.push({
          reason: "Test policy restriction during action",
        });
      }
      if (type === "journey.selected") {
        assert.equal(
          session.page.url(),
          `${origin}/fixtures/fixed`,
          "selection is saved before navigation",
        );
        frozen = JSON.stringify((await store.get(run.id)).manifest.journeyPlan);
      }
    };
    const provider = async ({ goal }) => {
      assert.ok(goal.length <= 2000);
      assert.ok(
        goal.startsWith("Use same-origin, non-submitting actions only."),
      );
      if (mode === "outage") throw new Error("Deliberate test provider outage");
      if (mode === "no-selection" || called++)
        return { action: { type: stop, reason: "Test stop", commits: false } };
      const box = await session.page.locator(`#${target}`).boundingBox();
      return {
        action: {
          type: "click",
          x: ((box.x + box.width / 2) / 1280) * 1000,
          y: ((box.y + box.height / 2) / 800) * 1000,
          commits: mode === "policy",
          reason: "Test provider selected a target",
        },
      };
    };
    const journey = await runJourney({ run, store, session, provider, emit });
    assert.ok(run.checkpoints.length >= 1 && run.checkpoints.length <= 3);
    assert.ok(run.checkpoints[0].evidenceId);
    if (frozen)
      assert.equal(
        JSON.stringify(run.manifest.journeyPlan),
        frozen,
        "observed outcomes never revise the frozen plan",
      );
    return { run, journey, events };
  }
  try {
    await t.test(
      "successful navigation verifies three distinct planned outcomes",
      async () => {
        const { journey, events } = await runCase("success");
        assert.equal(journey.status, "completed");
        assert.equal(journey.plan.assertions.length, 3);
        assert.deepEqual(
          journey.assertions.map((item) => item.status),
          ["passed", "passed", "passed"],
        );
        assert.equal(journey.steps.length, 1);
        assert.ok(
          events.findIndex((event) => event.type === "journey.selected") <
            events.findIndex((event) => event.type === "action.executed"),
        );
        assert.ok(
          journey.steps[0].beforeEvidenceId && journey.steps[0].afterEvidenceId,
        );
      },
    );
    await t.test(
      "associated reveal controls verify actual visible content",
      async () => {
        const { journey } = await runCase("success", "details");
        assert.equal(journey.status, "completed");
        assert.equal(journey.assertions[2].status, "passed");
      },
    );
    await t.test(
      "provider done cannot turn an unchanged control into success",
      async () => {
        const { journey } = await runCase("nochange", "details");
        assert.equal(journey.status, "partial");
        assert.equal(journey.stop, "done");
        assert.deepEqual(
          journey.assertions.map((item) => item.status),
          ["passed", "not_tested", "not_tested"],
        );
        assert.equal(journey.plan.assertions.length, 3);
      },
    );
    await t.test(
      "right URL with unrelated visible content remains uncertain",
      async () => {
        const { journey } = await runCase("wrong");
        assert.equal(journey.status, "partial");
        assert.equal(journey.assertions[1].status, "passed");
        assert.equal(journey.assertions[2].status, "review");
      },
    );
    await t.test(
      "reproducible endpoint error is a confirmed blocker",
      async () => {
        const { journey, events } = await runCase("error");
        assert.equal(journey.status, "blocked");
        assert.equal(journey.assertions[2].status, "failed");
        assert.ok(events.some((event) => event.type === "probe.observed"));
        assert.equal(
          journey.steps.length,
          1,
          "verification reload is a probe, not a fabricated Twinly action",
        );
      },
    );
    await t.test(
      "HTTP infrastructure errors and policy restrictions cannot confirm a site defect",
      async () => {
        for (const mode of ["gateway", "restricted-error"]) {
          const { journey } = await runCase(mode);
          assert.equal(journey.status, "partial", mode);
          assert.equal(journey.assertions[2].status, "review", mode);
        }
      },
    );
    await t.test(
      "selection stop and provider outage retain initial evidence without a score",
      async () => {
        for (const mode of ["outage", "no-selection"]) {
          const { journey } = await runCase(mode);
          assert.equal(journey.status, "unavailable");
          assert.deepEqual(journey.assertions, []);
          assert.equal(journey.steps.length, 0);
        }
      },
    );
    await t.test(
      "committing proposals stop before plan execution",
      async () => {
        const { journey } = await runCase("policy");
        assert.equal(journey.status, "unavailable");
        assert.equal(journey.stop, "policy boundary");
        assert.equal(journey.steps.length, 0);
        assert.equal(session.page.url(), `${origin}/fixtures/fixed`);
      },
    );
  } finally {
    await session.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
