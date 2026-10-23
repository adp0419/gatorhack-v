// Twinly-directed exploration. Twinly chooses each action; this loop owns
// execution, safety review, budgets, and checkpoint selection (max three).
import { nextAction } from '../providers/twinly.js';
import { budgets, viewports } from '../config.js';
import { inPage, signatureKey, logicalCheckpointId } from './dom-helpers.js';
import { gatherFacts, reviewAction, execute, toCssPoint } from './executor.js';
import { settle } from './browser.js';

export const AUTO_OBJECTIVE =
  'You are helping an accessibility auditor explore this website. Use the mouse like a typical visitor to reach the most important ' +
  'interactions: first the main navigation (open a different page from the site menu), then a dialog or a form page if one exists. ' +
  'Visit at most two additional pages or states. Never submit forms, sign in, buy, download, or leave this website. ' +
  'Do not type into fields. When you have opened two distinct pages or states, or nothing else is relevant, finish with done.';

export async function readSignature(page) {
  return inPage(page, (H) => H.stateSignature());
}

function makeCheckpoint(sig, url, index, setupActions, sourceAction) {
  const labels = setupActions.map((a) => a.label || a.type).filter(Boolean);
  return {
    id: logicalCheckpointId(sig),
    index,
    url,
    signature: sig,
    title: sig.h1 || sig.title || sig.path,
    setupActions,
    setupGoal: labels.length
      ? `From the start page: ${labels.join(', then ')}. Reach the state titled "${sig.h1 || sig.title}" at ${sig.path}.`
      : 'Initial page as loaded.',
    sourceAction: sourceAction || null,
  };
}

export function initialCheckpoint(sig, url) {
  return makeCheckpoint(sig, url, 0, [], null);
}

// Goal used on retest so Twinly navigates back to a stored checkpoint.
export function reachGoal(checkpoint) {
  return (
    `Navigate this website to a specific page or state. ${checkpoint.setupGoal} ` +
    'Use the mouse like a typical visitor. Never submit forms, sign in, buy, download, or leave this website. ' +
    'Finish with done as soon as that page or state is shown.'
  );
}

// Runs the loop until done/fail/budget/cancel. Returns checkpoints, the
// pointer interactions Twinly performed, and the reason exploration stopped.
export async function explore({ page, target, recorder, goal = AUTO_OBJECTIVE, checkpoints, isCancelled, deadline, callBudget = budgets.twinlyCalls, stopWhen, selectCheckpoints = true }) {
  const viewport = viewports.desktop;
  const steps = [];
  const executed = [];
  const interactions = [];
  const seen = new Map(checkpoints.map((cp) => [signatureKey(cp.signature), cp]));
  let previousShot = null;
  let calls = 0;
  let blockedInARow = 0;
  let stopReason = 'budget';

  while (calls < callBudget) {
    if (isCancelled()) {
      stopReason = 'canceled';
      break;
    }
    const remaining = deadline - Date.now();
    if (remaining < 5000) {
      stopReason = 'time_budget';
      break;
    }
    const shot = await recorder.frame(page, { phase: 'exploration', actor: 'twinly', caption: 'Screen sent to Twinly', viewport });
    const elements = await inPage(page, (H, limit) => H.visibleElements(limit), 300);
    const screenshot = `data:image/jpeg;base64,${shot.buffer.toString('base64')}`;
    calls += 1;
    let proposal;
    try {
      proposal = await nextAction(
        { goal, screenshot, previousScreenshot: previousShot, steps, elements },
        Math.min(budgets.providerRequestMs, remaining - 1000),
      );
    } catch (err) {
      recorder.event('agent.error', 'exploration', 'twinly', { message: err.message, code: err.code, status: err.status });
      stopReason = 'provider_error';
      break;
    }
    previousShot = screenshot;
    const action = proposal.action;
    recorder.event('action.proposed', 'exploration', 'twinly', { call: calls, action, frame: shot.evidenceId });

    if (action.type === 'done' || action.type === 'fail') {
      stopReason = action.type === 'done' ? 'agent_done' : 'agent_fail';
      recorder.event('agent.finished', 'exploration', 'twinly', { outcome: action.type, reason: action.reason || action.text || null, blocked: action.blocked || null });
      break;
    }

    const point = ['click', 'double_click'].includes(action.type) ? toCssPoint(action.x, action.y, viewport) : null;
    const facts = await gatherFacts(page, action, point, target.origin);
    const verdict = reviewAction(action, facts);
    if (!verdict.allowed) {
      recorder.event('action.blocked', 'exploration', 'system', { action, reason: verdict.reason, target: facts.target || null });
      steps.push({ ...action, result: `Not performed: ${verdict.reason}` });
      blockedInARow += 1;
      if (verdict.stop || blockedInARow >= 2) {
        stopReason = verdict.stop ? 'committing_action' : 'blocked_actions';
        break;
      }
      continue;
    }
    blockedInARow = 0;

    const before = await readSignature(page);
    const beforeUrl = page.url();
    let outcome;
    try {
      outcome = await execute(page, action, viewport);
      await settle(page);
    } catch (err) {
      recorder.event('action.failed', 'exploration', 'system', { action, message: err.message });
      steps.push({ ...action, result: `Failed to perform: ${err.message}` });
      continue;
    }
    const after = await readSignature(page);
    const changed = signatureKey(before) !== signatureKey(after) || beforeUrl !== page.url();
    const record = { ...action, cssPoint: outcome.cssPoint || null, target: facts.target || null, beforeUrl, afterUrl: page.url(), changed };
    executed.push(record);
    steps.push({ ...action, result: changed ? `Page changed to ${after.h1 || after.title || after.path} (${after.path})` : 'No visible state change' });
    recorder.event('action.executed', 'exploration', 'twinly', { call: calls, ...record });

    const fromCp = seen.get(signatureKey(before));
    if (['click', 'double_click'].includes(action.type) && facts.target) {
      interactions.push({ checkpointId: fromCp ? fromCp.id : null, target: facts.target, before, after, changed, actor: 'twinly' });
    }

    if (selectCheckpoints && changed && !seen.has(signatureKey(after)) && checkpoints.length < budgets.maxCheckpoints) {
      const cp = makeCheckpoint(after, page.url(), checkpoints.length, executed.map(({ type, x, y, label, keys, text, cssPoint }) => ({ type, x, y, label, keys, text, cssPoint })), record);
      checkpoints.push(cp);
      seen.set(signatureKey(after), cp);
      recorder.event('checkpoint.selected', 'exploration', 'system', { checkpoint: cp });
    }
    if (stopWhen && stopWhen(after)) {
      stopReason = 'reached';
      break;
    }
  }
  return { checkpoints, interactions, executed, calls, stopReason };
}
