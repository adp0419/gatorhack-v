// K01/K02 keyboard probes (docs/checks.md "Keyboard evidence"). Probes run in
// fresh pages, measure the pointer outcome themselves, then attempt the same
// interaction with keyboard input only. Probe actions are never Twinly actions.
import { budgets } from '../config.js';
import { inPage, signatureKey } from '../runner/dom-helpers.js';
import { settle } from '../runner/browser.js';
import { restoreCheckpoint } from '../runner/restore.js';
import { makeResult, aggregate } from './registry.js';

const PER_CHECKPOINT = 3;

// Probe-selected candidates: pointer-affordance controls in navigation or the
// header that cannot take focus, plus a few native navigation links so that
// working keyboard paths are also sampled.
export async function probeCandidates(page) {
  return inPage(page, (H) => {
    const out = [];
    const regions = document.querySelectorAll('nav, header, [role="navigation"], [role="banner"]');
    const seen = new Set();
    for (const region of regions) {
      for (const el of region.querySelectorAll('*')) {
        if (seen.has(el) || !H.isVisible(el)) continue;
        const d = H.describe(el);
        if (!d.name) continue;
        const inFocusable = el.parentElement && el.parentElement.closest('a[href], button, [tabindex]');
        if (!d.focusable && d.pointerAffordance && !inFocusable && !el.querySelector('a[href], button, input, select, textarea, [tabindex]')) {
          seen.add(el);
          out.push({ ...d, kind: 'pointer_only_candidate' });
        }
      }
    }
    const links = [...document.querySelectorAll('nav a[href], [role="navigation"] a[href]')].filter(H.isVisible);
    for (const el of links.slice(0, 6)) {
      if (seen.has(el)) continue;
      const href = el.getAttribute('href') || '';
      if (href.startsWith('#') || el.href === location.href) continue;
      seen.add(el);
      out.push({ ...H.describe(el), kind: 'native_navigation' });
    }
    return out;
  });
}

export function selectTargets(checkpoints, interactions, candidatesByCheckpoint) {
  const targets = [];
  for (const cp of checkpoints) {
    const picked = new Map();
    for (const i of interactions) {
      if (i.checkpointId === cp.id && i.changed && i.target && i.target.name && !picked.has(i.target.identity)) {
        picked.set(i.target.identity, { ...pick(i.target), checkpointId: cp.id, source: 'twinly' });
      }
    }
    const cands = candidatesByCheckpoint[cp.id] || [];
    for (const kind of ['pointer_only_candidate', 'native_navigation']) {
      for (const c of cands.filter((x) => x.kind === kind)) {
        if (picked.size >= PER_CHECKPOINT) break;
        if (!picked.has(c.identity)) picked.set(c.identity, { ...pick(c), checkpointId: cp.id, source: 'probe' });
      }
    }
    targets.push(...[...picked.values()].slice(0, PER_CHECKPOINT));
  }
  return targets;
}

function pick(d) {
  return { selector: d.selector, identity: d.identity, name: d.name, role: d.role, tag: d.tag, landmark: d.landmark };
}

async function locate(page, target) {
  return inPage(
    page,
    (H, t) => {
      let el = null;
      try {
        el = document.querySelector(t.selector);
      } catch {}
      if (!el || H.describe(el).identity !== t.identity) {
        el = [...document.querySelectorAll('body *')].find((n) => H.isVisible(n) && H.describe(n).identity === t.identity) || null;
      }
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      const d = H.describe(el);
      const r = el.getBoundingClientRect();
      const nativeFocusableInside = !!el.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      return {
        ...d,
        center: { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) },
        hasKeyboardPathInside: nativeFocusableInside,
        onclick: el.hasAttribute('onclick'),
        tabindexAttr: el.getAttribute('tabindex'),
      };
    },
    target,
  );
}

async function signature(page) {
  return inPage(page, (H) => H.stateSignature());
}

async function tabSearch(page, target, maxKeys) {
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  const sequence = [];
  let first = null;
  for (let i = 0; i < maxKeys; i += 1) {
    await page.keyboard.press('Tab');
    const info = await inPage(
      page,
      (H, sel) => {
        const a = document.activeElement;
        if (!a || a === document.body) return { body: true };
        let t = null;
        try {
          t = document.querySelector(sel);
        } catch {}
        const d = H.describe(a);
        return { selector: d.selector, name: d.name, role: d.role, isTarget: !!t && (a === t || t.contains(a) || a.contains(t)) };
      },
      target.selector,
    );
    sequence.push(info.body ? { name: '(page body)', role: 'document' } : { name: info.name, role: info.role, selector: info.selector });
    if (info.isTarget) return { reached: true, keys: i + 1, sequence };
    if (!info.body) {
      if (first && info.selector === first) return { reached: false, keys: i + 1, sequence, cycled: true };
      if (!first) first = info.selector;
    }
  }
  return { reached: false, keys: maxKeys, sequence, cycled: false };
}

function sameOutcome(a, b) {
  return a.path === b.path && a.h1 === b.h1 && JSON.stringify(a.dialogs) === JSON.stringify(b.dialogs) && JSON.stringify(a.expanded) === JSON.stringify(b.expanded);
}

export async function probeTarget({ context, target, checkpoint, startUrl, recorder }) {
  const page = await context.newPage();
  const say = async (text, withFrame = false) => {
    let evidenceId = null;
    if (withFrame) evidenceId = (await recorder.frame(page, { phase: 'keyboard', actor: 'probe', caption: text, viewport: page.viewportSize() })).evidenceId;
    recorder.event('probe.step', 'keyboard', 'probe', { text, evidenceId, url: page.url(), target: target.name });
    return evidenceId;
  };
  const out = { target, evidenceIds: [], observations: [] };
  try {
    // 1. Pointer outcome, measured by the probe itself.
    let restored = await restoreCheckpoint(page, checkpoint, startUrl);
    if (!restored.ok) return { ...out, k01: 'not_tested', k02: 'not_tested', reason: `Could not restore the state: ${restored.reason}` };
    const before = await signature(page);
    const located = await locate(page, target);
    if (!located) return { ...out, k01: 'not_tested', k02: 'not_tested', reason: 'The selected control was not found in the restored state.' };
    out.dom = located;
    await page.mouse.click(located.center.x, located.center.y);
    await settle(page);
    const pointerAfter = await signature(page);
    const pointerChanged = signatureKey(before) !== signatureKey(pointerAfter);
    out.pointer = { before, after: pointerAfter, changed: pointerChanged };
    out.evidenceIds.push(await say(`Pointer click on “${target.name}” ${pointerChanged ? `opened ${pointerAfter.h1 || pointerAfter.path}` : 'caused no visible change'}.`, true));
    if (!pointerChanged) return { ...out, excluded: true, reason: 'The pointer interaction produced no observable state change, so it is not a sampled interaction.' };

    // 2. Keyboard-only attempts from an explicit reset; repeat once on failure.
    let attempt;
    let activation = null;
    for (let n = 1; n <= 2; n += 1) {
      restored = await restoreCheckpoint(page, checkpoint, startUrl);
      if (!restored.ok) return { ...out, k01: 'not_tested', k02: 'not_tested', reason: 'Could not reset the state for the keyboard attempt.' };
      attempt = await tabSearch(page, target, budgets.keyboardKeysPerTarget);
      out.observations.push({ attempt: n, reached: attempt.reached, keys: attempt.keys, cycled: attempt.cycled, focusSequence: attempt.sequence });
      if (!attempt.reached) {
        out.evidenceIds.push(await say(`Attempt ${n}: ${attempt.keys} Tab presses${attempt.cycled ? ' cycled through the page' : ''} without focusing “${target.name}”.`, true));
        continue;
      }
      out.evidenceIds.push(await say(`Attempt ${n}: “${target.name}” received focus after ${attempt.keys} Tab presses.`, true));
      const keys = target.role === 'link' ? ['Enter'] : ['Enter', ' '];
      activation = { attempt: n, tried: [], matched: false, changedDifferently: false };
      for (const key of keys) {
        await page.keyboard.press(key);
        await settle(page);
        const after = await signature(page);
        activation.tried.push({ key: key === ' ' ? 'Space' : key, after });
        if (sameOutcome(after, pointerAfter)) {
          activation.matched = true;
          break;
        }
        if (signatureKey(after) !== signatureKey(before)) {
          activation.changedDifferently = true;
          break;
        }
      }
      out.evidenceIds.push(await say(`Keyboard activation of “${target.name}” ${activation.matched ? 'produced the same result as the pointer' : activation.changedDifferently ? 'changed the page differently from the pointer' : 'caused no change'}.`, true));
      if (activation.matched || activation.changedDifferently) break;
    }
    out.activation = activation;

    if (attempt.reached || activation) {
      const k01 = 'passed';
      let k02;
      if (activation.matched) k02 = 'passed';
      else if (activation.changedDifferently) k02 = 'review';
      else k02 = located.nativeInteractive ? 'failed' : 'review';
      return { ...out, k01, k02, pointerChanged };
    }
    // Never reached. Confirm only with DOM evidence that no keyboard path exists.
    const noKeyboardPath = !located.focusable && !located.hasKeyboardPathInside;
    return {
      ...out,
      k01: noKeyboardPath ? 'failed' : 'review',
      k02: 'not_tested',
      pointerChanged,
      reason: noKeyboardPath
        ? `“${target.name}” is a <${located.tag}> with ${located.onclick ? 'an onclick handler' : 'pointer styling'} and no tabindex or focusable child; two keyboard attempts never focused it.`
        : `“${target.name}” is focusable but was not reached within ${budgets.keyboardKeysPerTarget} Tab presses.`,
    };
  } catch (err) {
    return { ...out, k01: 'not_tested', k02: 'not_tested', reason: `Probe error: ${err.message}` };
  } finally {
    await page.close().catch(() => {});
  }
}

export function keyboardResults(checkpoint, probes, { reconstructed = true } = {}) {
  const mine = probes.filter((p) => p.target.checkpointId === checkpoint.id && !p.excluded);
  const build = (checkId) => {
    if (!reconstructed) return makeResult(checkId, checkpoint, 'not_tested', 'The state could not be reconstructed.');
    if (!mine.length) {
      return makeResult(checkId, checkpoint, 'not_tested', 'No pointer interaction with an observable result was selected in this state.', { method: 'keyboard probe' });
    }
    const key = checkId === 'K01' ? 'k01' : 'k02';
    const status = aggregate(mine.map((p) => p[key]));
    const reason = {
      passed: checkId === 'K01' ? 'Every selected control was reached with Tab.' : 'Keyboard activation matched the pointer outcome for every reached control.',
      failed: checkId === 'K01' ? 'At least one selected control has no keyboard path.' : 'At least one reached control did not respond to keyboard activation.',
      review: 'Keyboard evidence is inconclusive for at least one selected control.',
      not_tested: checkId === 'K02' ? 'Activation could not be attempted because the control never received focus.' : 'The probe could not run.',
    }[status] || '';
    return makeResult(checkId, checkpoint, status, reason, {
      method: 'keyboard probe (Tab/Shift+Tab traversal, Enter/Space activation)',
      viewport: { width: 1280, height: 800 },
      targets: mine.map((p) => ({ ...p.target, status: p[key], reason: p.reason || null, pointer: p.pointer, activation: p.activation || null, observations: p.observations, dom: p.dom })),
      evidenceIds: mine.flatMap((p) => p.evidenceIds).filter(Boolean),
    });
  };
  return [build('K01'), build('K02')];
}
