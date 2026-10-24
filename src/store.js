import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";

export const validId = (id) => /^[a-zA-Z0-9-]{1,90}$/.test(id || "");
export class FileStore {
  constructor(root = config.dataDir) {
    this.root = path.resolve(root);
    this.chains = new Map();
  }
  file(runId, name) {
    if (!validId(runId) || !validId(name.replace(/\.(json|jpg)$/, "")))
      throw new Error("Invalid artifact ID");
    return path.join(this.root, runId, name);
  }
  async write(runId, name, value) {
    const dest = this.file(runId, name);
    await mkdir(path.dirname(dest), { recursive: true });
    const temp = `${dest}.${randomUUID()}.tmp`;
    await writeFile(
      temp,
      typeof value === "object" && !Buffer.isBuffer(value)
        ? JSON.stringify(value, null, 2)
        : value,
      { mode: 0o600 },
    );
    await rename(temp, dest);
  }
  async read(runId, name) {
    return readFile(this.file(runId, name));
  }
  async get(runId) {
    return JSON.parse(await this.read(runId, "run.json"));
  }
  async save(run) {
    await this.write(run.id, "run.json", run);
  }
  async recent(limit = 10) {
    let entries;
    try {
      entries = await readdir(this.root, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    const runs = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !validId(entry.name)) continue;
      try {
        const run = await this.get(entry.name);
        if (
          run.id !== entry.name ||
          !Number.isFinite(Date.parse(run.createdAt))
        )
          continue;
        runs.push({
          id: run.id,
          url: run.url,
          status: run.status,
          createdAt: run.createdAt,
          baselineRunId: run.baselineRunId,
          summary: run.summary,
          versions: run.manifest?.versions,
          previewEvidenceId:
            [
              run.evidence?.[0]?.id,
              run.checkpoints?.[0]?.evidenceId,
              run.manifest?.checkpoints?.[0]?.evidenceId,
              run.latestFrame?.id,
            ].find((id) => /^frame-[a-f0-9-]+$/.test(id || "")) || null,
        });
      } catch (error) {
        if (error.code !== "ENOENT" && !(error instanceof SyntaxError))
          throw error;
      }
    }
    return runs
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, limit);
  }
  async events(runId, after = 0) {
    const names = await readdir(path.join(this.root, runId));
    const items = await Promise.all(
      names
        .filter((n) => /^event-\d+\.json$/.test(n))
        .sort()
        .map((n) => this.read(runId, n).then(JSON.parse)),
    );
    return items.filter((e) => e.seq > after);
  }
  async append(run, type, phase, actor, payload) {
    const previous = this.chains.get(run.id) || Promise.resolve();
    const next = previous.then(async () => {
      const event = {
        runId: run.id,
        seq: (run.seq || 0) + 1,
        timestamp: new Date().toISOString(),
        type,
        phase,
        actor,
        payload,
      };
      await this.write(
        run.id,
        `event-${String(event.seq).padStart(6, "0")}.json`,
        event,
      );
      run.seq = event.seq;
      run.updatedAt = event.timestamp;
      await this.save(run);
      return event;
    });
    this.chains.set(
      run.id,
      next.catch(() => {}),
    );
    return next;
  }
  async frame(run, page, phase, actor = "system") {
    const id = `frame-${randomUUID()}`;
    await this.write(
      run.id,
      `${id}.jpg`,
      await page.screenshot({
        type: "jpeg",
        quality: 75,
        animations: "disabled",
        timeout: 5000,
      }),
    );
    const frame = {
      id,
      url: `/api/audits/${run.id}/evidence/${id}`,
      capturedAt: new Date().toISOString(),
      viewport: page.viewportSize(),
    };
    run.latestFrame = frame;
    await this.append(run, "frame.captured", phase, actor, frame);
    return id;
  }
}
