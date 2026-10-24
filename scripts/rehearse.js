import { writeFile } from "node:fs/promises";
import path from "node:path";
import { config, terminal } from "../src/config.js";

const origin = `http://127.0.0.1:${config.port}`;
const headers = {
  "Content-Type": "application/json",
  ...(config.demoToken ? { Authorization: `Bearer ${config.demoToken}` } : {}),
};
async function request(url, options = {}) {
  const response = await fetch(origin + url, { ...options, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
async function audit(url, baselineRunId) {
  const { id } = await request("/api/audits", {
    method: "POST",
    body: JSON.stringify({ url, baselineRunId }),
  });
  const deadline = Date.now() + 315_000;
  while (Date.now() < deadline) {
    const run = await request(`/api/audits/${id}`);
    if (terminal(run.status)) {
      const events = await request(`/api/audits/${id}/events?format=json`);
      if (events.some((e) => e.type === "run.finished")) {
        await new Promise((r) => setTimeout(r, 200));
        return run;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Rehearsal deadline: ${id}`);
}
const settings = await request("/api/config"),
  rehearsals = [];
for (let i = 0; i < 2; i++) {
  const before = await audit(settings.fixtures.broken),
    after = await audit(settings.fixtures.fixed, before.id);
  const resolved = after.comparison.changes.filter(
    (c) => c.retest === "resolved",
  );
  const summary = {
    trial: i + 1,
    baseline: before.id,
    retest: after.id,
    elapsedMs: before.elapsedMs + after.elapsedMs,
    comparable: after.comparison.comparable,
    delta: after.comparison.delta,
    keyboardResolved: resolved.filter((c) => ["K01", "K02"].includes(c.checkId))
      .length,
    resolved: resolved.length,
    coverage: [before.summary.coverage, after.summary.coverage],
    providers: { baseline: before.providers, retest: after.providers },
    errors: [...before.errors, ...after.errors],
  };
  rehearsals.push(summary);
  console.log(JSON.stringify(summary, null, 2));
  await writeFile(
    path.join(config.dataDir, "rehearsals.json"),
    JSON.stringify(rehearsals, null, 2),
  );
}
if (rehearsals.some((r) => !r.comparable || r.keyboardResolved < 2))
  process.exitCode = 1;
