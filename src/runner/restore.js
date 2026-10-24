// Restores an audited checkpoint in a fresh page: direct URL first, then a
// replay of the recorded pointer setup actions. Identity is always verified.
import { inPage, logicalCheckpointId } from './dom-helpers.js';
import { settle } from './browser.js';

export async function currentCheckpointId(page) {
  return logicalCheckpointId(await inPage(page, (H) => H.stateSignature()));
}

// A reloaded page matches a recorded state when its path is the same, its
// heading matches (unless none was rendered when recorded), and every dialog
// or expanded control recorded is open again. Extra controls that a page
// expands by default do not prevent a match.
export function signatureMatches(stored, current) {
  if (!stored || stored.path !== current.path) return false;
  if (stored.h1 && stored.h1 !== current.h1) return false;
  const has = (list, items) => items.every((x) => list.includes(x));
  return has(current.dialogs, stored.dialogs) && has(current.expanded, stored.expanded) && current.dialogs.length === stored.dialogs.length;
}

async function matches(page, checkpoint) {
  const sig = await inPage(page, (H) => H.stateSignature());
  return logicalCheckpointId(sig) === checkpoint.id || signatureMatches(checkpoint.signature, sig);
}

async function replay(page, url, actions, checkpoint) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await settle(page, 800);
  for (const a of actions) {
    if (!a.cssPoint || !['click', 'double_click'].includes(a.type)) continue;
    if (a.type === 'click') await page.mouse.click(a.cssPoint.x, a.cssPoint.y);
    else await page.mouse.dblclick(a.cssPoint.x, a.cssPoint.y);
    await settle(page);
  }
  if (await matches(page, checkpoint)) return true;
  await page.waitForTimeout(1200);
  return matches(page, checkpoint);
}

export async function restoreCheckpoint(page, checkpoint, startUrl) {
  try {
    await page.goto(checkpoint.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await settle(page);
    if (await matches(page, checkpoint)) return { ok: true, method: 'url' };
    await page.waitForTimeout(1200);
    if (await matches(page, checkpoint)) return { ok: true, method: 'url' };
    // States opened on the page itself (menus, dialogs): reload the page and
    // replay only the trailing actions that happened on it.
    const actions = checkpoint.setupActions || [];
    const tail = [];
    for (let i = actions.length - 1; i >= 0 && actions[i].beforeUrl && actions[i].beforeUrl === actions[i].afterUrl; i -= 1) tail.unshift(actions[i]);
    if (tail.length && tail.length < actions.length && (await replay(page, tail[0].beforeUrl, tail, checkpoint))) return { ok: true, method: 'replay' };
    if (checkpoint.setupActions && checkpoint.setupActions.length) {
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await settle(page);
      for (const a of checkpoint.setupActions) {
        if (!a.cssPoint || !['click', 'double_click'].includes(a.type)) continue;
        if (a.type === 'click') await page.mouse.click(a.cssPoint.x, a.cssPoint.y);
        else await page.mouse.dblclick(a.cssPoint.x, a.cssPoint.y);
        await settle(page);
      }
      if (await matches(page, checkpoint)) return { ok: true, method: 'replay' };
      // Menus and overlays often animate open; check once more after a pause.
      await page.waitForTimeout(1200);
      if (await matches(page, checkpoint)) return { ok: true, method: 'replay' };
    }
  } catch (err) {
    return { ok: false, reason: err.message };
  }
  return { ok: false, reason: 'The page did not match the recorded state.' };
}
