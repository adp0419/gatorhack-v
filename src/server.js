import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { config, terminal } from "./config.js";
import { FileStore, validId } from "./store.js";
import { validateStart, fixturePath } from "./policy.js";
import { fixtureHtml } from "./fixtures.js";
import { newRun, runAudit } from "./runner.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function createApp({
  store = new FileStore(),
  port = config.port,
  startRunner = runAudit,
} = {}) {
  const app = express(),
    running = new Map();
  let launching = false;
  const fixtureOrigin = `http://127.0.0.1:${port}`;
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    if (
      config.host === "127.0.0.1" &&
      !["127.0.0.1", "localhost"].includes(req.hostname)
    )
      return res
        .status(403)
        .json({ error: "Unexpected host for the local runner." });
    next();
  });
  app.use(express.json({ limit: "8kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (!req.path.startsWith("/fixtures/"))
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
    next();
  });
  app.get("/fixtures/:variant", (req, res, next) => {
    if (!fixturePath(req.path)) return next();
    res.type("html").send(fixtureHtml(req.params.variant));
  });
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const expected = config.demoToken;
    if (expected) {
      const supplied = Buffer.from(
          req.get("Authorization")?.replace(/^Bearer /, "") || "",
        ),
        actual = Buffer.from(expected);
      if (
        supplied.length !== actual.length ||
        !timingSafeEqual(supplied, actual)
      )
        return res.status(401).json({ error: "Demo access token required." });
    }
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      const origin = req.get("Origin");
      if (origin && origin !== `${req.protocol}://${req.get("host")}`)
        return res
          .status(403)
          .json({ error: "Cross-origin writes are blocked." });
    }
    next();
  });
  app.get("/api/config", (_req, res) =>
    res.json({
      mode: config.publicTargets
        ? "public-local-runner"
        : "allowlisted-local-runner",
      publicTargets: config.publicTargets,
      allowedOrigins: config.allowedOrigins,
      fixtures: {
        broken: `${fixtureOrigin}/fixtures/broken`,
        fixed: `${fixtureOrigin}/fixtures/fixed`,
        negative: `${fixtureOrigin}/fixtures/negative`,
      },
      providers: { twinly: !!config.twinlyKey, decisions: !!config.openaiKey },
      hosting: "Public deployment not verified",
    }),
  );
  app.get("/api/audits", async (_req, res, next) => {
    try {
      res.json(await store.recent());
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/audits", async (req, res, next) => {
    if (launching || running.size)
      return res.status(409).json({
        error:
          "One audit can run at a time. Cancel or wait for the active run.",
      });
    launching = true;
    try {
      if (typeof req.body?.url !== "string")
        return res.status(400).json({ error: "Enter a website URL." });
      const target = await validateStart(req.body.url, {
        allowedOrigins: config.allowedOrigins,
        fixtureOrigin,
        publicTargets: config.publicTargets,
      });
      let baseline;
      if (req.body.baselineRunId) {
        if (!validId(req.body.baselineRunId))
          throw new Error("Invalid baseline run");
        baseline = await store.get(req.body.baselineRunId);
        if (!terminal(baseline.status))
          throw new Error("Baseline must have finished");
        const before = new URL(baseline.url);
        if (before.origin !== target.origin)
          throw new Error("Retest must use the baseline origin");
      }
      const run = newRun(target.href, fixtureOrigin, baseline?.id);
      await store.save(run);
      const controller = new AbortController();
      running.set(run.id, controller);
      res.status(202).json({ id: run.id, url: `/#run/${run.id}` });
      // Local runner owns this process. This adapter is deliberately not used
      // in serverless functions, where a detached Sandbox must own the work.
      setImmediate(() =>
        startRunner(run, {
          store,
          fixtureOrigin,
          signal: controller.signal,
          baseline,
        })
          .catch((error) =>
            console.error("Runner persistence failed:", error.message),
          )
          .finally(() => running.delete(run.id)),
      );
    } catch (error) {
      res.status(400).json({
        error: error.code === "ENOENT" ? "Baseline not found" : error.message,
      });
    } finally {
      launching = false;
    }
  });
  app.param("id", (req, res, next, id) =>
    validId(id) ? next() : res.status(400).json({ error: "Invalid run ID" }),
  );
  app.get("/api/audits/:id", async (req, res, next) => {
    try {
      const run = await store.get(req.params.id);
      let alive = false;
      try {
        if (run.runnerPid) {
          process.kill(run.runnerPid, 0);
          alive = true;
        }
      } catch {}
      const expired =
        run.deadlineAt && Date.now() > Date.parse(run.deadlineAt) + 5000;
      if (
        !terminal(run.status) &&
        ((!alive &&
          !running.has(run.id) &&
          Date.now() - Date.parse(run.createdAt) > 5000) ||
          expired)
      ) {
        run.status = "partial";
        run.errors.push(
          expired
            ? "Runner deadline exceeded."
            : "Local runner stopped before final persistence.",
        );
        run.explorationComplete = false;
        if (run.summary) run.summary.provisional = true;
        await store.save(run);
      }
      res.json(run);
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/audits/:id/report.json", async (req, res, next) => {
    try {
      const run = await store.get(req.params.id);
      if (!terminal(run.status))
        return res
          .status(409)
          .json({ error: "The report is available when the audit finishes." });
      res.attachment(`accessbench-${run.id}.json`).json(run);
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/audits/:id/events", async (req, res, next) => {
    try {
      await store.get(req.params.id);
      const cursor = Number(req.get("Last-Event-ID") || req.query.after || 0);
      if (!Number.isSafeInteger(cursor) || cursor < 0)
        return res.status(400).json({ error: "Invalid event cursor" });
      if (!req.accepts("text/event-stream") || req.query.format === "json")
        return res.json(await store.events(req.params.id, cursor));
      res.set({
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      });
      res.flushHeaders();
      let seq = cursor,
        closed = false,
        busy = false;
      req.on("close", () => {
        closed = true;
        clearInterval(timer);
      });
      const flush = async () => {
        if (busy || closed) return;
        busy = true;
        try {
          for (const event of await store.events(req.params.id, seq)) {
            if (closed) break;
            res.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
            seq = event.seq;
          }
          const run = await store.get(req.params.id);
          if (terminal(run.status)) {
            clearInterval(timer);
            res.end();
          } else res.write(": heartbeat\n\n");
        } catch {
          clearInterval(timer);
          res.end();
        } finally {
          busy = false;
        }
      };
      const timer = setInterval(flush, 1000);
      await flush();
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/audits/:id/evidence/:evidenceId", async (req, res, next) => {
    try {
      if (!/^frame-[a-f0-9-]+$/.test(req.params.evidenceId))
        return res.sendStatus(400);
      res
        .type("jpg")
        .send(await store.read(req.params.id, `${req.params.evidenceId}.jpg`));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/audits/:id/cancel", async (req, res, next) => {
    try {
      const run = await store.get(req.params.id);
      if (terminal(run.status)) return res.json({ status: run.status });
      const controller = running.get(req.params.id);
      if (controller) controller.abort(new Error("Canceled by user"));
      else {
        run.status = "canceled";
        run.explorationComplete = false;
        await store.save(run);
      }
      res.status(202).json({ status: "canceling" });
    } catch (error) {
      next(error);
    }
  });
  app.use(express.static(path.join(root, "public")));
  app.use((error, req, res, _next) =>
    res.status(error.code === "ENOENT" ? 404 : 500).json({
      error:
        error.code === "ENOENT"
          ? "Run or evidence not found"
          : "Request could not be completed",
    }),
  );
  return { app, running };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (config.host !== "127.0.0.1" && !config.demoToken)
    throw new Error(
      "Configure ACCESSBENCH_DEMO_TOKEN before exposing the runner.",
    );
  const { app, running } = createApp();
  const server = app.listen(config.port, config.host, () =>
    console.log(`AccessBench: http://${config.host}:${config.port}`),
  );
  server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? `Port ${config.port} is already in use. Stop the existing server or set PORT to another port.`
        : error.message,
    );
    process.exitCode = 1;
  });
  for (const event of ["SIGINT", "SIGTERM"])
    process.on(event, () => {
      for (const controller of running.values())
        controller.abort(new Error("Server shutting down"));
      server.close();
      setTimeout(() => process.exit(), 3000).unref();
    });
}
