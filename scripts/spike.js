// Provider spike (build-plan.md "First spike"): one real Twinly next-action on
// the fixture site and one real Decisions request. Never prints API keys.
// Requires the fixture server: `npm run fixtures` in another terminal.
import { chromium } from 'playwright';
import { getMe, getUsage, nextAction } from '../src/providers/twinly.js';
import { triage } from '../src/providers/decisions.js';

const target = process.argv[2] || 'http://localhost:4100/';

function show(label, value) {
  console.log(`\n## ${label}\n${JSON.stringify(value, null, 2)}`);
}

async function step(label, fn) {
  try {
    const out = await fn();
    return out;
  } catch (err) {
    show(`${label} FAILED`, { message: err.message, status: err.status, code: err.code });
    return null;
  }
}

const me = await step('GET /v1/me', getMe);
if (me) show('GET /v1/me', { key: me.key && { prefix: me.key.prefix, scopes: me.key.scopes }, can: me.can });
const usage = await step('GET /v1/usage', getUsage);
if (usage) show('GET /v1/usage', usage);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await page.goto(target);
const shot = await page.screenshot({ type: 'jpeg', quality: 70 });
const started = Date.now();
const result = await step('POST /v1/computer/next-action', () =>
  nextAction(
    {
      goal: 'Open the page where a visitor can contact this business. Do not submit any form.',
      screenshot: `data:image/jpeg;base64,${shot.toString('base64')}`,
    },
    60_000,
  ),
);
if (result) {
  show('next-action', { latencyMs: Date.now() - started, action: result.action, rawKeys: Object.keys(result.raw), usage: result.usage });
}
await browser.close();

const finding = {
  key: 'K01|cp-home|contact',
  qid: 'f1',
  checkId: 'K01',
  category: 'keyboard',
  verification: 'confirmed',
  title: 'Navigation control cannot be reached by keyboard',
  expected: 'The "Contact" navigation control receives focus through Tab from the page start.',
  observed: 'Pointer click opened /contact. 40 Tab presses never focused the control; it is a span with an onclick handler and no tabindex.',
  target: { role: 'generic', name: 'Contact', selector: 'nav li:nth-child(3) > span' },
  affectedCount: 1,
  wcag: ['2.1.1'],
};
const t0 = Date.now();
const decision = await step('POST /v1/decisions', () => triage([finding], { site: target, checklist: 'accessbench-v1' }, 60_000));
if (decision) show('decisions', { latencyMs: Date.now() - t0, ...decision });
