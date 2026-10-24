// Audit orchestration: exploration -> keyboard probes -> other checks ->
// evidence review -> scoring/report. Lifecycle is separate from provisionality,
// and a canceled or partial run still produces an honest report.
import { budgets, versions, viewports, config } from '../config.js';
import { createRun, updateRun, saveArtifact, listRuns, appendEvent } from '../store/run-store.js';
import { launchBrowser, newAuditContext, settle } from './browser.js';
import { makeRecorder } from './recorder.js';
import { explore, initialCheckpoint, readSignature, reachGoal } from './explore.js';
import { logicalCheckpointId } from './dom-helpers.js';
import { admitLandingOrigin } from './url-guard.js';
import { restoreCheckpoint, signatureMatches } from './restore.js';
import { CHECKS, STATUS_LABELS, makeResult } from '../checks/registry.js';
import { runAxe } from '../checks/axe.js';
import { probeCandidates, selectTargets, probeTarget, keyboardResults } from '../checks/keyboard.js';
import { hasFormControls, runFormRecipe, formResults } from '../checks/forms.js';
import { runReflow, reflowResults } from '../checks/reflow.js';
import { buildFindings, orderFindings } from '../findings/build.js';
import { triage } from '../providers/decisions.js';
import { scoreResults } from '../scoring/score.js';
import { compareRuns } from '../scoring/compare.js';

const active = new Map();

const PROBE_TIMEOUT_MS = 45_000;
const STATE_CHECKS_TIMEOUT_MS = 90_000;

class StepTimeout extends Error {}

// Page operations can hang on heavy sites (page.evaluate has no timeout).
// On timeout, every page in the context is closed so pending operations
// reject, and the caller records the step as not tested.
async function guard(context, ms, fn) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new StepTimeout(`timed out after ${Math.round(ms / 1000)} s`)), Math.max(ms, 1000));
  });
  try {
    return await Promise.race([fn(), timeout]);
  } catch (err) {
    if (err instanceof StepTimeout) await Promise.all(context.pages().map((pg) => pg.close().catch(() => {})));
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Runs left queued/running by a previous server process can never finish.
export function markOrphanedRuns() {
  for (const run of listRuns()) {
    if (!['queued', 'running'].includes(run.lifecycle) || active.has(run.id)) continue;
    appendEvent(run.id, { type: 'run.error', phase: 'report', actor: 'system', payload: { message: 'The runner stopped before this audit finished (server restarted).' } });
    updateRun(run.id, { lifecycle: 'failed', finishedAt: new Date().toISOString() });
    appendEvent(run.id, { type: 'run.finished', phase: 'report', actor: 'system', payload: { lifecycle: 'failed', elapsedMs: null } });
  }
}

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
    .catch((err) => console.error(`[run ${run.id}]`, err))
    .finally(() => {
      ctl.finished = true;
    });
  return run;
}

// Retest: Twinly navigates back to each stored checkpoint using its goal;
// a direct URL/replay restore is the labeled fallback.
async function reconstruct({ page, target, recorder, baseline, isCancelled, deadline, providers }) {
  const checkpoints = [];
  const startSig = await readSignature(page);
  const first = initialCheckpoint(startSig, page.url());
  first.reconstructed = true;
  first.reconstructedBy = 'start page';
  checkpoints.push(first);
  recorder.event('checkpoint.selected', 'exploration', 'system', { checkpoint: first });
  let calls = 0;
  for (const stored of baseline.manifest.checkpoints.slice(1)) {
    if (isCancelled()) break;
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await settle(page);
    let by = null;
    if (config.twinly.apiKey && providers.twinly !== 'unavailable') {
      const exp = await explore({
        page,
        target,
        recorder,
        goal: reachGoal(stored),
        checkpoints: [first],
        isCancelled,
        deadline: Math.min(deadline, Date.now() + 60_000),
        callBudget: 4,
        stopWhen: (sig) => logicalCheckpointId(sig) === stored.id || signatureMatches(stored.signature, sig),
        selectCheckpoints: false,
      });
      calls += exp.calls;
      if (exp.stopReason === 'provider_error') providers.twinly = 'unavailable';
      else providers.twinly = 'used';
      const reached = await readSignature(page);
      if (logicalCheckpointId(reached) === stored.id || signatureMatches(stored.signature, reached)) by = 'twinly';
    }
    if (!by) {
      const restored = await restoreCheckpoint(page, stored, target.url);
      if (restored.ok) by = restored.method === 'url' ? 'direct URL (fallback)' : 'recorded replay (fallback)';
      recorder.event('reconstruction.fallback', 'exploration', 'system', { checkpointId: stored.id, ok: restored.ok, method: restored.method || null });
    }
    const cp = { ...stored, index: checkpoints.length, url: by ? page.url() : stored.url, reconstructed: !!by, reconstructedBy: by };
    checkpoints.push(cp);
    recorder.event('checkpoint.selected', 'exploration', 'system', { checkpoint: cp });
  }
  return { checkpoints, interactions: [], calls, stopReason: isCancelled() ? 'canceled' : 'reconstructed' };
}

async function runAudit(run, target, baseline, ctl) {
  const recorder = makeRecorder(run.id);
  const startedAt = Date.now();
  const deadline = startedAt + budgets.runnerDeadlineMs;
  const isCancelled = () => ctl.cancelled || Date.now() > deadline;
  const limitations = [];
  const providers = {
    twinly: config.twinly.apiKey ? 'not_used' : 'not_configured',
    decisions: config.openai.apiKey ? 'not_used' : 'not_configured',
  };
  const results = [];
  let checkpoints = [];
  let exploration = null;
  let samples = { keyboardTargets: [] };
  let triageMeta = { status: 'not_run' };
  let lifecycle = 'failed';
  let fatal = null;
  let browser;

  updateRun(run.id, { lifecycle: 'running', startedAt: new Date(startedAt).toISOString() });
  recorder.event('run.started', 'setup', 'system', { url: target.url, mode: run.mode, baselineRunId: run.baselineRunId });

  try {
    browser = await launchBrowser();
    const context = await newAuditContext(browser, { target, viewport: viewports.desktop, log: (entry) => limitations.push(entry) });
    const page = await context.newPage();
    const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await settle(page, 800);
    if (!response || response.status() >= 400) {
      throw new Error(`The page could not be loaded (HTTP ${response ? response.status() : 'no response'}).`);
    }
    if (!(await admitLandingOrigin(target, page.url()))) {
      throw new Error(`The start page redirected to ${new URL(page.url()).origin}, which cannot be audited.`);
    }
    if (target.allowedOrigins.length > 1) {
      recorder.event('scope.updated', 'setup', 'system', { allowedOrigins: target.allowedOrigins, note: `The start page redirected to ${new URL(page.url()).origin}; navigation within it is allowed.` });
    }

    // Phase 1: Twinly exploration, or reconstruction of the baseline plan.
    recorder.event('phase.started', 'exploration', 'system', { label: baseline ? 'Twinly reconstruction of the baseline states' : 'Twinly exploration' });
    if (baseline) {
      exploration = await reconstruct({ page, target, recorder, baseline, isCancelled, deadline, providers });
      checkpoints = exploration.checkpoints;
    } else {
      const startSig = await readSignature(page);
      checkpoints = [initialCheckpoint(startSig, page.url())];
      checkpoints[0].reconstructed = true;
      recorder.event('checkpoint.selected', 'exploration', 'system', { checkpoint: checkpoints[0] });
      if (config.twinly.apiKey) {
        exploration = await explore({ page, target, recorder, checkpoints, isCancelled, deadline: Math.min(deadline, Date.now() + budgets.explorationMs) });
        providers.twinly = exploration.stopReason === 'provider_error' ? 'unavailable' : 'used';
        checkpoints.forEach((cp) => {
          cp.reconstructed = true;
        });
      } else {
        exploration = { checkpoints, interactions: [], calls: 0, stopReason: 'not_configured' };
      }
    }
    recorder.event('phase.finished', 'exploration', 'system', { stopReason: exploration.stopReason, calls: exploration.calls, checkpoints: checkpoints.length });
    await page.close();
    const live = checkpoints.filter((cp) => cp.reconstructed);

    // Phase 2: keyboard probes on selected interactions.
    recorder.event('phase.started', 'keyboard', 'system', { label: 'Keyboard checks' });
    if (baseline) {
      const ids = new Set(live.map((c) => c.id));
      samples = { keyboardTargets: (baseline.manifest.samples?.keyboardTargets || []).filter((t) => ids.has(t.checkpointId)) };
    } else {
      const candidates = {};
      for (const cp of live) {
        if (isCancelled()) break;
        try {
          await guard(context, Math.min(PROBE_TIMEOUT_MS, deadline - Date.now()), async () => {
            const p = await context.newPage();
            const restored = await restoreCheckpoint(p, cp, target.url);
            candidates[cp.id] = restored.ok ? await probeCandidates(p) : [];
            if (!restored.ok) recorder.event('run.error', 'keyboard', 'system', { message: `Could not reload ${cp.title} for keyboard probes: ${restored.reason}` });
            cp.setupNeeded = restored.method === 'replay';
            await p.close();
          });
        } catch (err) {
          candidates[cp.id] = [];
          recorder.event('run.error', 'keyboard', 'system', { message: `Selecting keyboard targets in ${cp.title} ${err.message}.` });
        }
      }
      samples = { keyboardTargets: selectTargets(live, exploration.interactions || [], candidates) };
    }
    saveManifest(run, target, checkpoints, samples);
    const probes = [];
    for (const t of samples.keyboardTargets) {
      if (isCancelled()) break;
      const cp = live.find((c) => c.id === t.checkpointId);
      recorder.event('probe.step', 'keyboard', 'probe', { text: `Testing “${t.name}” in ${cp.title} (selected by ${t.source === 'twinly' ? 'Twinly exploration' : 'the keyboard probe'}).` });
      try {
        probes.push(await guard(context, Math.min(PROBE_TIMEOUT_MS, deadline - Date.now()), () => probeTarget({ context, target: t, checkpoint: cp, startUrl: target.url, recorder })));
      } catch (err) {
        recorder.event('probe.step', 'keyboard', 'probe', { text: `Probe of “${t.name}” ${err.message}; it is recorded as not tested.` });
        probes.push({ target: t, k01: 'not_tested', k02: 'not_tested', reason: `The keyboard probe ${err.message}.`, evidenceIds: [], observations: [] });
      }
    }
    for (const cp of live) {
      for (const r of keyboardResults(cp, probes)) {
        if (isCancelled() && r.status === 'not_tested') continue;
        pushResult(results, r, recorder, 'keyboard');
      }
    }

    // Phase 3: axe-mapped checks, forms, and reflow per checkpoint.
    recorder.event('phase.started', 'checks', 'system', { label: 'Other accessibility checks' });
    for (const cp of live) {
      if (isCancelled()) break;
      try {
        await guard(context, Math.min(STATE_CHECKS_TIMEOUT_MS, deadline - Date.now()), async () => {
          const p = await context.newPage();
          const restored = await restoreCheckpoint(p, cp, target.url);
          if (!restored.ok) {
            await p.close();
            const reason = `This state could not be reloaded for testing: ${restored.reason}`;
            for (const check of ['F01', 'F02', 'F03', 'C01', 'S01', 'S02', 'S03', 'R01', 'R02']) pushResult(results, makeResult(check, cp, 'not_tested', reason), recorder, 'checks');
            return;
          }
          await recorder.frame(p, { phase: 'checks', actor: 'probe', caption: `Running checks on ${cp.title}`, viewport: viewports.desktop });
          try {
            for (const r of await runAxe(p, cp, { viewport: viewports.desktop })) pushResult(results, r, recorder, 'checks');
          } catch (err) {
            recorder.event('run.error', 'checks', 'system', { message: `axe failed on ${cp.title}: ${err.message}` });
          }
          const controls = await hasFormControls(p);
          await p.close();
          const recipe = target.authorization && (target.authorization.formRecipes || []).find((r) => r.path === new URL(cp.url).pathname);
          const recipeOutcome = controls && recipe ? await runFormRecipe({ context, checkpoint: cp, startUrl: target.url, recipe, recorder }) : null;
          for (const r of formResults(cp, { hasControls: controls, recipeOutcome, authorized: !!target.authorization })) pushResult(results, r, recorder, 'checks');

          if (isCancelled()) return;
          const identities = samples.keyboardTargets.filter((t) => t.checkpointId === cp.id).map((t) => t.identity);
          const reflow = await runReflow({ context, checkpoint: cp, startUrl: target.url, controlIdentities: identities, recorder });
          for (const r of reflowResults(cp, reflow)) pushResult(results, r, recorder, 'checks');
        });
      } catch (err) {
        if (!(err instanceof StepTimeout)) throw err;
        recorder.event('run.error', 'checks', 'system', { message: `Checks on ${cp.title} ${err.message}.` });
        for (const check of ['F01', 'F02', 'F03', 'C01', 'S01', 'S02', 'S03', 'R01', 'R02']) {
          if (!results.some((r) => r.checkId === check && r.checkpointId === cp.id)) pushResult(results, makeResult(check, cp, 'not_tested', `Checks on this state ${err.message}.`), recorder, 'checks');
        }
      }
    }
  } catch (err) {
    fatal = err;
    recorder.event('run.error', 'setup', 'system', { message: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  try {
    if (!checkpoints.length) {
      lifecycle = ctl.cancelled ? 'canceled' : 'failed';
    } else {
      // Every planned check/state keeps a result; nothing silently disappears.
      fillMissing(results, checkpoints, ctl.cancelled ? 'The audit was canceled before this check ran.' : fatal ? `The audit stopped early: ${fatal.message}` : Date.now() > deadline ? 'The audit reached its time budget before this check ran.' : 'This check did not run.');

      recorder.event('phase.started', 'triage', 'system', { label: 'Evidence review' });
      let findings = buildFindings(results, checkpoints);
      if (!findings.length) {
        triageMeta = { status: 'not_needed' };
      } else if (!config.openai.apiKey) {
        triageMeta = { status: 'unavailable', message: 'OpenAI key is not configured.' };
      } else {
        try {
          const out = await triage(findings, { site: target.origin, checklist: versions.checklist, mode: run.mode });
          findings = findings.map((f) => (out.answers[f.key] ? { ...f, triage: out.answers[f.key] } : f));
          triageMeta = { status: 'used', model: out.model, promptVersion: out.promptVersion, evaluated: out.evaluatedKeys.length, usage: out.usage };
          providers.decisions = 'used';
        } catch (err) {
          triageMeta = { status: 'unavailable', message: err.message, code: err.code || null };
          providers.decisions = 'unavailable';
        }
      }
      recorder.event('triage.finished', 'triage', 'system', { status: triageMeta.status, count: triageMeta.evaluated || 0, message: triageMeta.message || null });
      findings = orderFindings(findings);

      const explorationCompleted = !!exploration && ['agent_done', 'reconstructed'].includes(exploration.stopReason);
      const missing = checkpoints.filter((c) => !c.reconstructed).length;
      const score = scoreResults(results, { explorationCompleted, missingCheckpoints: missing });
      if (ctl.cancelled) lifecycle = 'canceled';
      else if (fatal || Date.now() > deadline || !explorationCompleted || missing) lifecycle = 'partial';
      else lifecycle = 'completed';

      const report = {
        runId: run.id,
        versions,
        lifecycle,
        startUrl: target.url,
        mode: run.mode,
        baselineRunId: run.baselineRunId,
        checkpoints: checkpoints.map(({ id, index, url, title, setupGoal, setupActions, reconstructed, reconstructedBy, setupNeeded }) => ({ id, index, url, title, setupGoal, setupActions, reconstructed, reconstructedBy: reconstructedBy || null, setupNeeded: !!setupNeeded })),
        exploration: exploration ? { stopReason: exploration.stopReason, calls: exploration.calls, completed: explorationCompleted } : null,
        results,
        findings,
        score,
        triage: triageMeta,
        providers,
        limitations: summarizeLimitations(limitations),
        samples,
        generatedAt: new Date().toISOString(),
      };
      if (baseline) report.comparison = compareRuns(baseline.report, report);
      saveArtifact(run.id, 'report', report);
    }
  } catch (err) {
    lifecycle = 'failed';
    recorder.event('run.error', 'report', 'system', { message: `Report could not be built: ${err.message}` });
    console.error(err);
  }
  updateRun(run.id, { lifecycle, finishedAt: new Date().toISOString(), providers });
  recorder.event('run.finished', 'report', 'system', { lifecycle, elapsedMs: Date.now() - startedAt });
}

// One result per check/state; a step that finishes after its timeout was
// already recorded as not tested and is ignored.
function pushResult(results, result, recorder, phase) {
  if (results.some((r) => r.checkId === result.checkId && r.checkpointId === result.checkpointId)) return;
  results.push(result);
  recorder.event('check.completed', phase, 'probe', { checkId: result.checkId, checkpointTitle: result.checkpointTitle, status: result.status, label: STATUS_LABELS[result.status] });
}

function fillMissing(results, checkpoints, reason) {
  for (const cp of checkpoints) {
    for (const check of CHECKS) {
      if (results.some((r) => r.checkId === check.id && r.checkpointId === cp.id)) continue;
      results.push(makeResult(check.id, cp, 'not_tested', cp.reconstructed === false ? 'This baseline state could not be reconstructed.' : reason));
    }
  }
}

function summarizeLimitations(entries) {
  const counts = {};
  for (const e of entries) counts[e.kind] = (counts[e.kind] || 0) + 1;
  return Object.entries(counts).map(([kind, count]) => ({
    kind,
    count,
    text: {
      network_blocked: 'requests to private or disallowed addresses were blocked',
      mutating_request_aborted: 'data-changing requests (for example form posts) were blocked on this public site',
      navigation_blocked: 'navigations to other sites were blocked',
      popup_closed: 'popup windows were closed',
    }[kind] || kind,
    examples: entries.filter((e) => e.kind === kind).slice(0, 3).map((e) => e.url),
  }));
}

function saveManifest(run, target, checkpoints, samples) {
  saveArtifact(run.id, 'manifest', {
    versions,
    budgets,
    viewports,
    startUrl: target.url,
    origin: target.origin,
    allowedOrigins: target.allowedOrigins,
    authorizationMode: run.mode,
    navigationPolicy: 'same-origin top-level navigation; public subresources only',
    checkpoints: checkpoints.map(({ id, url, title, setupGoal, setupActions, signature }) => ({ id, url, title, setupGoal, setupActions, signature })),
    samples,
    createdAt: new Date().toISOString(),
  });
}
