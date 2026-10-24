import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createApp } from "../../src/server.js";
import { FileStore } from "../../src/store.js";
import { runAudit, newRun } from "../../src/runner.js";

export async function testApp(startRunner, createRun = newRun) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "accessbench-browser-"));
  const store = new FileStore(dir),
    server = http.createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  // Exercise the actual engine's outage path, never spend provider credits in tests.
  const offlineRunner = (run, options) =>
    runAudit(run, {
      ...options,
      provider: async () => {
        throw new Error("Deliberate provider outage in test harness");
      },
      decisionProvider: async () => {
        throw new Error("Deliberate triage outage in test harness");
      },
    });
  const { app, running } = createApp({
    store,
    port,
    startRunner: startRunner || offlineRunner,
    createRun,
  });
  server.on("request", app);
  return {
    origin: `http://127.0.0.1:${port}`,
    store,
    close: async () => {
      for (const controller of running.values())
        controller.abort(new Error("Test complete"));
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await rm(dir, { recursive: true, force: true });
    },
  };
}
