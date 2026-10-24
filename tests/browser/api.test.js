import { test } from "node:test";
import assert from "node:assert/strict";
import { testApp } from "./helpers.js";
import { runAudit } from "../../src/runner.js";

test("API returns before browser work, supports durable cursor reconnect, cancel and missing evidence", async () => {
  let started = false;
  const app = await testApp((run, options) =>
    runAudit(run, {
      ...options,
      provider: async ({ signal }) => {
        started = true;
        return new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      },
    }),
  );
  try {
    const post = (body) =>
      fetch(`${app.origin}/api/audits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await post({ url: "http://127.0.0.1:3000/api/config" })).status,
      400,
    );
    const response = await post({ url: `${app.origin}/fixtures/broken` });
    assert.equal(response.status, 202);
    const { id } = await response.json();
    assert.equal(
      (await fetch(`${app.origin}/api/audits/${id}/report.json`)).status,
      409,
    );
    assert.equal(
      (await post({ url: `${app.origin}/fixtures/fixed` })).status,
      409,
    );
    for (let i = 0; i < 50 && !started; i++)
      await new Promise((r) => setTimeout(r, 100));
    assert.equal(started, true);
    const events = await (
      await fetch(`${app.origin}/api/audits/${id}/events?format=json`)
    ).json();
    assert.ok(events.some((e) => e.type === "frame.captured"));
    assert.deepEqual(
      events.map((e) => e.seq),
      events.map((_, i) => i + 1),
    );
    const cursor = events[0].seq,
      reconnected = await (
        await fetch(
          `${app.origin}/api/audits/${id}/events?format=json&after=${cursor}`,
        )
      ).json();
    assert.ok(reconnected.every((e) => e.seq > cursor));
    const cancel = await fetch(`${app.origin}/api/audits/${id}/cancel`, {
      method: "POST",
    });
    assert.equal(cancel.status, 202);
    let run;
    for (let i = 0; i < 50; i++) {
      run = await (await fetch(`${app.origin}/api/audits/${id}`)).json();
      if (run.status === "canceled") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(run.status, "canceled");
    assert.equal(run.summary.provisional, true);
    assert.equal(run.summary.score, null);
    assert.equal(run.results.length, 11);
    const recent = await (await fetch(`${app.origin}/api/audits`)).json();
    assert.equal(recent[0].id, id);
    const download = await fetch(`${app.origin}/api/audits/${id}/report.json`);
    assert.match(
      download.headers.get("Content-Disposition"),
      /attachment; filename="?accessbench-/,
    );
    assert.equal((await download.json()).id, id);
    assert.equal(
      (await fetch(`${app.origin}/api/audits/missing/report.json`)).status,
      404,
    );
    const evidence = await fetch(
      `${app.origin}${events.find((e) => e.type === "frame.captured").payload.url}`,
    );
    assert.equal(evidence.headers.get("Content-Type"), "image/jpeg");
    assert.ok((await evidence.arrayBuffer()).byteLength > 1000);
    assert.equal((await fetch(`${app.origin}/api/audits/missing`)).status, 404);
    assert.equal(
      (await fetch(`${app.origin}/api/audits/${id}/events?after=-1`)).status,
      400,
    );
    assert.equal(
      (
        await fetch(`${app.origin}/api/audits/${id}/cancel`, {
          method: "POST",
          headers: { Origin: "https://untrusted.example" },
        })
      ).status,
      403,
    );
  } finally {
    await app.close();
  }
});
