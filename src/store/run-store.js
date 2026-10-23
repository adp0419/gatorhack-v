// File-backed run store. One runner writes each run; events are append-only
// with a monotonic sequence so readers can resume from any point.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { config } from '../config.js';

const bus = new EventEmitter();
bus.setMaxListeners(100);
const seqByRun = new Map();

function runDir(runId) {
  if (!/^[a-z0-9-]+$/.test(runId)) throw new Error('invalid run id');
  return path.join(config.runsDir, runId);
}

function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function createRun(run) {
  const id = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(4).toString('hex')}`;
  const dir = runDir(id);
  fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });
  const record = { id, lifecycle: 'queued', createdAt: new Date().toISOString(), ...run };
  writeJson(path.join(dir, 'run.json'), record);
  fs.writeFileSync(path.join(dir, 'events.jsonl'), '');
  seqByRun.set(id, 0);
  return record;
}

export function runExists(runId) {
  try {
    return fs.existsSync(path.join(runDir(runId), 'run.json'));
  } catch {
    return false;
  }
}

export function getRun(runId) {
  return JSON.parse(fs.readFileSync(path.join(runDir(runId), 'run.json'), 'utf8'));
}

export function updateRun(runId, patch) {
  const next = { ...getRun(runId), ...patch, updatedAt: new Date().toISOString() };
  writeJson(path.join(runDir(runId), 'run.json'), next);
  return next;
}

export function listRuns() {
  if (!fs.existsSync(config.runsDir)) return [];
  return fs
    .readdirSync(config.runsDir)
    .filter((id) => runExists(id))
    .map((id) => getRun(id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Events are written before they are announced to listeners.
export function appendEvent(runId, { type, phase, actor = 'system', payload = {} }) {
  const seq = (seqByRun.get(runId) ?? readEvents(runId).length) + 1;
  seqByRun.set(runId, seq);
  const event = { runId, seq, timestamp: new Date().toISOString(), type, phase, actor, payload };
  fs.appendFileSync(path.join(runDir(runId), 'events.jsonl'), `${JSON.stringify(event)}\n`);
  bus.emit(runId, event);
  return event;
}

export function readEvents(runId, afterSeq = 0) {
  const file = path.join(runDir(runId), 'events.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((e) => e.seq > afterSeq);
}

export function subscribe(runId, listener) {
  bus.on(runId, listener);
  return () => bus.off(runId, listener);
}

export function saveFrame(runId, buffer, meta = {}) {
  const evidenceId = `frame-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const dir = path.join(runDir(runId), 'frames');
  fs.writeFileSync(path.join(dir, `${evidenceId}.jpg`), buffer);
  writeJson(path.join(dir, `${evidenceId}.json`), { evidenceId, capturedAt: new Date().toISOString(), ...meta });
  return evidenceId;
}

export function framePath(runId, evidenceId) {
  if (!/^frame-[a-z0-9-]+$/.test(evidenceId)) return null;
  const file = path.join(runDir(runId), 'frames', `${evidenceId}.jpg`);
  return fs.existsSync(file) ? file : null;
}

export function saveArtifact(runId, name, data) {
  writeJson(path.join(runDir(runId), `${name}.json`), data);
}

export function readArtifact(runId, name) {
  const file = path.join(runDir(runId), `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
