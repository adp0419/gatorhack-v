// Audits AccessBench's own interface (design.md "Accessibility acceptance"):
// axe WCAG A/AA scan of each view, 320px reflow, and a keyboard pass.
// Usage: node scripts/self-audit.js <runId> [baseUrl]
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'node:fs';

const runId = process.argv[2];
const base = process.argv[3] || 'http://localhost:3000';
const shotsDir = process.env.SHOTS_DIR || null;
if (!runId) {
  console.error('Usage: node scripts/self-audit.js <runId> [baseUrl]');
  process.exit(1);
}

const browser = await chromium.launch();
let problems = 0;

async function audit(label, url, { width = 1280, prepare } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  if (prepare) await prepare(page);
  await page.waitForTimeout(500);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const v = axe.violations.map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`);
  console.log(`\n# ${label} @${width}px`);
  console.log(`  axe violations: ${v.length ? v.join('; ') : 'none'}; incomplete: ${axe.incomplete.map((x) => x.id).join(', ') || 'none'}`);
  console.log(`  horizontal overflow: ${overflow > 1 ? `${overflow}px` : 'none'}`);
  problems += v.length + (overflow > 1 ? 1 : 0);
  if (shotsDir) {
    fs.mkdirSync(shotsDir, { recursive: true });
    await page.screenshot({ path: `${shotsDir}/${label.replace(/\W+/g, '-')}-${width}.png`, fullPage: true });
  }
  return page;
}

for (const width of [1280, 320]) {
  await (await audit('start', `${base}/`, { width })).close();
  await (await audit('run report', `${base}/run?id=${runId}`, { width })).close();
  const report = await (await fetch(`${base}/api/audits/${runId}`)).json();
  const qid = report.report && report.report.findings[0] && report.report.findings[0].qid;
  if (qid) await (await audit('finding inspector', `${base}/run?id=${runId}#finding-${qid}`, { width })).close();
}

// Keyboard: reach the URL field, submit empty, check error focus, then open a
// finding from the report and return.
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${base}/`);
await page.keyboard.press('Tab');
const skip = await page.evaluate(() => document.activeElement.textContent.trim());
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
const field = await page.evaluate(() => document.activeElement.id);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const afterSubmit = await page.evaluate(() => ({ focus: document.activeElement.id, error: document.getElementById('url-error').textContent }));
console.log(`\n# keyboard\n  first Tab: "${skip}"; third Tab focus: #${field}; empty submit -> focus #${afterSubmit.focus}, error "${afterSubmit.error}"`);

await page.goto(`${base}/run?id=${runId}`, { waitUntil: 'networkidle' });
const link = page.locator('.findings a').first();
if (await link.count()) {
  await link.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const opened = await page.evaluate(() => document.activeElement.id);
  await page.locator('.inspector a').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const returned = await page.evaluate(() => document.activeElement.id);
  console.log(`  open finding -> focus #${opened}; back -> focus #${returned}`);
}
await browser.close();
console.log(`\nTotal problems: ${problems}`);
process.exitCode = problems ? 1 : 0;
