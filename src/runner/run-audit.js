// Audit orchestration: exploration -> keyboard probes -> other checks ->
// evidence review -> scoring/report. Lifecycle is separate from provisionality.
import { budgets, versions, viewports, config } from '../config.js';
import { createRun, updateRun, saveArtifact } from '../store/run-store.js';
import { launchBrowser, newAuditContext, settle } from './browser.js';
import { makeRecorder } from './recorder.js';
import { explore, initialCheckpoint, readSignature } from './explore.js';

const active = new Map();

export function activeRunId() {
  for (const [id, ctl] of active) if (!ctl.finished) return id;
  return null;
}

export function cancelAudit(runId) {
  const ctl = active.get(runId);
  if (!ctl || ctl.finished) return false;
  ctl.cancelled = true;
  return true;
}

export function startAudit({ target, baseline = null }) {
  const run = createRun({
    startUrl: target.url,
    origin: target.origin,
    mode: target.authorization ? 'authorized' : 'public',
    baselineRunId: baseline ? baseline.run.id : null,
    runner: 'local',
  });
  const ctl = { cancelled: false, finished: false };
  active.set(run.id, ctl);
  runAudit(run, target, baseline, ctl)
    .catch((err) => {
      console.error(`[run ${run.id}]`, err);
    })
    .finally(() => {
      ctl.finished = true;
    });
  return run;
}

async function runAudit(run, target, baseline, ctl) {
  const recorder = makeRecorder(run.id);
  const startedAt = Date.now();
  const deadline = startedAt + budgets.runnerDeadlineMs;
  const isCancelled = () => ctl.cancelled || Date.now() > deadline;
  const limitations = [];
  const providers = { twinly: config.twinly.apiKey ? 'pending' : 'not_configured', decisions: config.openai.apiKey ? 'pending' : 'not_configured' };
  let lifecycle = 'failed';
  let browser;

  updateRun(run.id, { lifecycle: 'running', startedAt: new Date(startedAt).toISOString() });
  recorder.event('run.started', 'setup', 'system', { url: target.url, mode: run.mode, baselineRunId: run.baselineRunId });

  try {
    browser = await launchBrowser();
    const context = await newAuditContext(browser, {
      target,
      viewport: viewports.desktop,
      log: (entry) => limitations.push(entry),
    });
    const page = await context.newPage();
    const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await settle(page, 800);
    if (!response || response.status() >= 400) {
      throw new Error(`The page could not be loaded (HTTP ${response ? response.status() : 'no response'}).`);
    }

    const startSig = await readSignature(page);
    const checkpoints = [initialCheckpoint(startSig, page.url())];
    recorder.event('checkpoint.selected', 'exploration', 'system', { checkpoint: checkpoints[0] });

    // Phase 1: Twinly exploration (or baseline reconstruction on retest).
    recorder.event('phase.started', 'exploration', 'system', { label: baseline ? 'Twinly reconstruction of baseline states' : 'Twinly exploration' });
    let exploration;
    if (config.twinly.apiKey) {
      exploration = await explore({
        page,
        target,
        recorder,
        checkpoints,
        isCancelled,
        deadline: Math.min(deadline, Date.now() + budgets.explorationMs),
      });
      providers.twinly = exploration.stopReason === 'provider_error' ? 'unavailable' : 'used';
    } else {
      exploration = { checkpoints, interactions: [], executed: [], calls: 0, stopReason: 'not_configured' };
    }
    recorder.event('phase.finished', 'exploration', 'system', {
      stopReason: exploration.stopReason,
      calls: exploration.calls,
      checkpoints: checkpoints.length,
    });

    const manifest = {
      versions,
      budgets,
      viewports,
      startUrl: target.url,
      origin: target.origin,
      authorizationMode: run.mode,
      navigationPolicy: 'same-origin top-level navigation; public subresources only',
      checkpoints: checkpoints.map(({ id, url, title, setupGoal, setupActions, signature }) => ({ id, url, title, setupGoal, setupActions, signature })),
      createdAt: new Date().toISOString(),
    };
    saveArtifact(run.id, 'manifest', manifest);

    lifecycle = ctl.cancelled ? 'canceled' : exploration.stopReason === 'agent_done' || exploration.stopReason === 'reached' ? 'completed' : 'partial';
    saveArtifact(run.id, 'report', {
      runId: run.id,
      exploration: { stopReason: exploration.stopReason, calls: exploration.calls, completed: exploration.stopReason === 'agent_done' },
      checkpoints: manifest.checkpoints,
      providers,
      limitations,
    });
  } catch (err) {
    lifecycle = ctl.cancelled ? 'canceled' : 'failed';
    recorder.event('run.error', 'setup', 'system', { message: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
    updateRun(run.id, { lifecycle, finishedAt: new Date().toISOString(), providers });
    recorder.event('run.finished', 'report', 'system', { lifecycle, elapsedMs: Date.now() - startedAt });
  }
}
