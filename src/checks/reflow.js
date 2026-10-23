// R01/R02 at 320 CSS pixels. Raw overflow is only a candidate; exempt
// two-dimensional content (tables, code, maps, media) goes to review.
import { viewports } from '../config.js';
import { inPage } from '../runner/dom-helpers.js';
import { settle } from '../runner/browser.js';
import { restoreCheckpoint } from '../runner/restore.js';
import { makeResult } from './registry.js';

const measureOverflow = (H) => {
  const vw = document.documentElement.clientWidth;
  const scrollWidth = document.documentElement.scrollWidth;
  const EXEMPT = 'table, pre, code, canvas, svg, video, iframe, map, [role="img"], [role="grid"], [role="table"], math';
  const offenders = [];
  if (scrollWidth > vw + 1) {
    for (const el of document.body.querySelectorAll('*')) {
      if (!H.isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right <= vw + 1) continue;
      // Report the outermost overflowing element only.
      const parent = el.parentElement;
      if (parent && parent !== document.body && parent.getBoundingClientRect().right > vw + 1) continue;
      offenders.push({
        selector: H.selector(el),
        tag: el.tagName.toLowerCase(),
        width: Math.round(r.width),
        right: Math.round(r.right),
        exempt: !!el.closest(EXEMPT) || el.matches(EXEMPT),
        hasText: H.clean(el.innerText).length > 0,
        text: H.clean(el.innerText).slice(0, 80),
      });
      if (offenders.length >= 10) break;
    }
  }
  return { viewportWidth: vw, scrollWidth, offenders };
};

const controlsAtNarrow = (H, identities) => {
  const out = [];
  const all = [...document.querySelectorAll('a[href], button, [role="button"], [role="link"], [onclick], [tabindex]')];
  for (const identity of identities) {
    const el = all.find((n) => H.describe(n).identity === identity);
    if (!el) {
      out.push({ identity, present: false });
      continue;
    }
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    const visible = H.isVisible(el);
    const inView = r.left >= 0 && r.right <= document.documentElement.clientWidth + 1;
    const hit = visible ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
    out.push({ identity, name: H.name(el), present: true, visible, inView, hittable: !!hit && (hit === el || el.contains(hit)) });
  }
  const toggle = [...document.querySelectorAll('button, [role="button"]')].find(
    (b) => H.isVisible(b) && (b.hasAttribute('aria-expanded') || b.hasAttribute('aria-controls') || /menu|navigation/i.test(H.name(b))),
  );
  return { controls: out, menuToggle: toggle ? H.selector(toggle) : null };
};

export async function runReflow({ context, checkpoint, startUrl, controlIdentities, recorder }) {
  const page = await context.newPage();
  try {
    const restored = await restoreCheckpoint(page, checkpoint, startUrl);
    if (!restored.ok) return { reconstructed: false, reason: restored.reason };
    await page.setViewportSize(viewports.narrow);
    await settle(page, 600);
    const overflow = await inPage(page, measureOverflow);
    await page.evaluate(() => window.scrollTo(0, 0));
    const frame = await recorder.frame(page, { phase: 'checks', actor: 'probe', caption: 'Page at 320 CSS pixels wide', viewport: viewports.narrow });
    let narrow = await inPage(page, controlsAtNarrow, controlIdentities);
    let replacementUsed = false;
    const missing = narrow.controls.filter((c) => !(c.visible && c.hittable));
    if (missing.length && narrow.menuToggle) {
      await page.locator(narrow.menuToggle).first().click().catch(() => {});
      await settle(page, 400);
      const reopened = await inPage(page, controlsAtNarrow, missing.map((c) => c.identity));
      replacementUsed = true;
      narrow = {
        menuToggle: narrow.menuToggle,
        controls: narrow.controls.map((c) => reopened.controls.find((r) => r.identity === c.identity && r.visible && r.hittable) || c),
      };
    }
    return { reconstructed: true, overflow, narrow, replacementUsed, evidenceId: frame.evidenceId };
  } catch (err) {
    return { reconstructed: false, reason: `Reflow probe error: ${err.message}` };
  } finally {
    await page.close().catch(() => {});
  }
}

export function reflowResults(checkpoint, outcome) {
  if (!outcome.reconstructed) {
    return [
      makeResult('R01', checkpoint, 'not_tested', `The state could not be reproduced at narrow width: ${outcome.reason}`),
      makeResult('R02', checkpoint, 'not_tested', `The state could not be reproduced at narrow width: ${outcome.reason}`),
    ];
  }
  const common = { method: 'geometry and hit testing at 320x800', viewport: { width: 320, height: 800 }, evidenceIds: [outcome.evidenceId] };
  const { overflow, narrow } = outcome;
  let r01;
  let r01Reason;
  if (overflow.scrollWidth <= overflow.viewportWidth + 1) {
    r01 = 'passed';
    r01Reason = 'No horizontal scrolling at 320 CSS pixels. (Clipped or hidden content is not measured by this check.)';
  } else if (overflow.offenders.some((o) => !o.exempt && o.hasText)) {
    r01 = 'failed';
    r01Reason = `The page scrolls horizontally (${overflow.scrollWidth}px content in a ${overflow.viewportWidth}px viewport) because non-exempt text content does not reflow.`;
  } else {
    r01 = 'review';
    r01Reason = 'The page scrolls horizontally, but only content that may be exempt (tables, code, media) or non-text elements overflow.';
  }
  const tested = narrow.controls.filter((c) => c.present);
  let r02;
  let r02Reason;
  if (!tested.length) {
    r02 = 'not_tested';
    r02Reason = 'No important controls from the desktop state could be identified at narrow width.';
  } else if (tested.every((c) => c.visible && c.hittable && c.inView)) {
    r02 = 'passed';
    r02Reason = outcome.replacementUsed ? 'All important controls were available, some through a responsive menu.' : 'All important controls were visible and operable at 320 CSS pixels.';
  } else {
    r02 = 'review';
    r02Reason = 'Some important controls were not visible or not operable at narrow width and no replacement was confirmed.';
  }
  return [
    makeResult('R01', checkpoint, r01, r01Reason, { ...common, observations: [overflow], targets: overflow.offenders }),
    makeResult('R02', checkpoint, r02, r02Reason, { ...common, observations: [narrow], targets: tested }),
  ];
}
