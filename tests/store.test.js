import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileStore } from "../src/store.js";
test("append persists monotonic events before cursor reads; artifact traversal rejected", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "accessbench-"));
  try {
    const store = new FileStore(dir),
      run = { id: "test-run" };
    await Promise.all(
      Array.from({ length: 10 }, (_, n) =>
        store.append(run, "test", "test", "system", { n }),
      ),
    );
    const events = await store.events(run.id, 5);
    assert.deepEqual(
      events.map((e) => e.seq),
      [6, 7, 8, 9, 10],
    );
    assert.equal((await store.get(run.id)).seq, 10);
    assert.throws(() => store.file("../etc", "run.json"));
    assert.throws(() => store.file("test", "../x.json"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("recent runs are bounded and ordered, ignoring incomplete or corrupt directories", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "accessbench-recent-"));
  try {
    const store = new FileStore(dir);
    assert.deepEqual(await store.recent(), []);
    for (let i = 0; i < 12; i++)
      await store.save({
        id: `run-${i}`,
        url: "https://example.com",
        status: "partial",
        createdAt: new Date(i * 1000).toISOString(),
        summary: { score: 80, coverage: 50, provisional: true },
      });
    await mkdir(path.join(dir, "corrupt"));
    await writeFile(path.join(dir, "corrupt", "run.json"), "{");
    await mkdir(path.join(dir, "unfinished"));
    const recent = await store.recent();
    assert.equal(recent.length, 10);
    assert.deepEqual(
      recent.slice(0, 2).map((r) => r.id),
      ["run-11", "run-10"],
    );
    assert.equal(recent[0].summary.coverage, 50);
    assert.equal("findings" in recent[0], false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("recent preview references prefer initial evidence, retain legacy captures and reject unsafe IDs", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "accessbench-previews-"));
  try {
    const store = new FileStore(dir);
    const base = {
      url: "https://example.com",
      status: "partial",
      createdAt: new Date().toISOString(),
    };
    await store.save({
      ...base,
      id: "initial",
      evidence: [{ id: "frame-abc" }],
      latestFrame: { id: "frame-def" },
    });
    await store.save({
      ...base,
      id: "legacy",
      manifest: { checkpoints: [{ evidenceId: "frame-cab" }] },
    });
    await store.save({
      ...base,
      id: "unsafe",
      evidence: [{ id: "../../secret" }],
      latestFrame: { id: 'frame-abc" onerror="alert(1)' },
    });
    const recent = await store.recent();
    assert.equal(
      recent.find((r) => r.id === "initial").previewEvidenceId,
      "frame-abc",
    );
    assert.equal(
      recent.find((r) => r.id === "legacy").previewEvidenceId,
      "frame-cab",
    );
    assert.equal(recent.find((r) => r.id === "unsafe").previewEvidenceId, null);
    assert.equal("evidence" in recent[0], false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
