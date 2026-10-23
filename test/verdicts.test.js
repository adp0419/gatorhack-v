import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from '../src/checks/registry.js';
import { mapAxeResults, AXE_MAPPING } from '../src/checks/axe.js';

const cp = { id: 'cp-home-1', title: 'Home', url: 'http://x/' };

function rule(id, nodes = []) {
  return { id, help: id, helpUrl: '', impact: 'serious', nodes };
}

test('aggregate: failure dominates, then review, then pass, then N/A', () => {
  assert.equal(aggregate(['passed', 'failed', 'review']), 'failed');
  assert.equal(aggregate(['passed', 'review']), 'review');
  assert.equal(aggregate(['passed', 'not_applicable']), 'passed');
  assert.equal(aggregate(['not_applicable', 'not_applicable']), 'not_applicable');
  assert.equal(aggregate([]), 'not_tested');
  assert.equal(aggregate(['not_tested', 'not_applicable']), 'not_tested');
});

test('axe: an empty violations array with no reported rules is not a pass', () => {
  const results = mapAxeResults({ violations: [], passes: [], incomplete: [], inapplicable: [] }, cp);
  for (const r of results) assert.equal(r.status, 'not_tested');
});

test('axe: decisive violation fails the mapped check even with passes', () => {
  const all = Object.values(AXE_MAPPING).flat();
  const results = mapAxeResults(
    {
      violations: [rule('color-contrast', [{ target: ['.tagline'], html: '<p>', failureSummary: 'low' }])],
      passes: all.filter((r) => r !== 'color-contrast').map((r) => rule(r)),
      incomplete: [],
      inapplicable: [],
    },
    cp,
  );
  const byId = Object.fromEntries(results.map((r) => [r.checkId, r]));
  assert.equal(byId.C01.status, 'failed');
  assert.equal(byId.C01.axeFindings[0].nodes.length, 1);
  assert.equal(byId.S01.status, 'passed');
});

test('axe: incomplete results become review, all-inapplicable becomes N/A', () => {
  const all = Object.values(AXE_MAPPING).flat();
  const results = mapAxeResults(
    {
      violations: [],
      passes: [],
      incomplete: [rule('color-contrast', [{ target: ['h1'], html: '<h1>', failureSummary: '?' }])],
      inapplicable: all.filter((r) => r !== 'color-contrast').map((r) => rule(r)),
    },
    cp,
  );
  const byId = Object.fromEntries(results.map((r) => [r.checkId, r]));
  assert.equal(byId.C01.status, 'review');
  assert.equal(byId.S02.status, 'not_applicable');
});

test('axe: a partially reported rule set never yields a pass', () => {
  const results = mapAxeResults({ violations: [], passes: [rule('button-name')], incomplete: [], inapplicable: [] }, cp);
  const s01 = results.find((r) => r.checkId === 'S01');
  assert.equal(s01.status, 'review');
});
