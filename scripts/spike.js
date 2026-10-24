// Real provider feasibility. Google receives a public URL; Twinly/Gemma
// receive the controlled fixture's actual screenshots. No mock providers.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { fixtureHtml } from "../src/fixtures.js";
import { FileStore } from "../src/store.js";
import { newWebsiteRun, runEvaluation } from "../src/evaluation.js";
import { measurePage } from "../src/website-sources.js";

const publicUrl = process.argv[2] || "https://example.com/";
const store = new FileStore();
const spikeId = `spike-${randomUUID()}`;
const started = Date.now();
let lighthouse;
try {
  const result = await measurePage({ url: publicUrl });
  await store.write(spikeId, "pagespeed-raw.json", result.raw);
  const { raw: _raw, ...normalized } = result;
  lighthouse = normalized;
} catch (error) {
  if (error.raw) await store.write(spikeId, "pagespeed-raw.json", error.raw);
  lighthouse = { status: "unavailable", reason: error.message };
}
await store.write(spikeId, "pagespeed.json", lighthouse);
const server = http.createServer((_req, response) => {
  response.setHeader("Content-Type", "text/html");
  response.end(fixtureHtml("fixed"));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const fixtureOrigin = `http://127.0.0.1:${server.address().port}`;
try {
  const run = newWebsiteRun(`${fixtureOrigin}/fixtures/fixed`, fixtureOrigin);
  await store.save(run);
  await runEvaluation(run, { store, fixtureOrigin });
  const outcome = {
    spikeId,
    runId: run.id,
    elapsedMs: Date.now() - started,
    publicMeasurements: {
      status: lighthouse.status,
      reason: lighthouse.reason,
      version: lighthouse.lighthouseVersion,
      strategy: lighthouse.strategy,
    },
    fixtureProviders: run.providers,
    journey: {
      goal: run.journey.goal,
      status: run.journey.status,
      assertions: run.journey.assertions.map(({ id, status }) => ({
        id,
        status,
      })),
    },
    errors: run.errors,
  };
  await store.write(spikeId, "outcome.json", outcome);
  console.log(JSON.stringify(outcome, null, 2));
  if (
    lighthouse.status !== "available" ||
    run.providers.gemini !== "available" ||
    run.journey.status !== "completed"
  )
    process.exitCode = 1;
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
