// Restores an audited checkpoint in a fresh page: direct URL first, then a
// replay of the recorded pointer setup actions. Identity is always verified.
import { inPage, logicalCheckpointId } from './dom-helpers.js';
import { settle } from './browser.js';

export async function currentCheckpointId(page) {
  return logicalCheckpointId(await inPage(page, (H) => H.stateSignature()));
}

export async function restoreCheckpoint(page, checkpoint, startUrl) {
  try {
    await page.goto(checkpoint.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await settle(page);
    if ((await currentCheckpointId(page)) === checkpoint.id) return { ok: true, method: 'url' };
    if (checkpoint.setupActions && checkpoint.setupActions.length) {
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await settle(page);
      for (const a of checkpoint.setupActions) {
        if (!a.cssPoint || !['click', 'double_click'].includes(a.type)) continue;
        if (a.type === 'click') await page.mouse.click(a.cssPoint.x, a.cssPoint.y);
        else await page.mouse.dblclick(a.cssPoint.x, a.cssPoint.y);
        await settle(page);
      }
      if ((await currentCheckpointId(page)) === checkpoint.id) return { ok: true, method: 'replay' };
    }
  } catch (err) {
    return { ok: false, reason: err.message };
  }
  return { ok: false, reason: 'The page did not match the recorded state.' };
}
