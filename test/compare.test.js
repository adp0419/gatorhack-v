import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRuns } from '../src/scoring/compare.js';
import { buildFindings, orderFindings } from '../src/findings/build.js';

const cp = { id: 'cp-services-1', title: 'Services', url: 'http://x/services', setupActions: [] };
const versions = { checklist: 'accessbench-v1' };

function k01(status, targetStatus) {
  return {
    checkId: 'K01', category: 'keyboard', checkpointId: cp.id, status, evidenceIds: [], observations: [],
    targets: [{ identity: 'navigation|contact', name: 'Contact', role: 'generic', status: targetStatus, pointer: { changed: true, after: { h1: 'Contact us', path: '/contact' } }, observations: [{ focusSequence: [] }], reason: 'no keyboard path' }],
  };
}

function report(results, overall = 50) {
  return { runId: 'r', versions, checkpoints: [cp], results, findings: buildFindings(results, [cp]), score: { overall, coverage: 100 } };
}

test('a failing keyboard target that passes on retest is resolved, with a score delta', () => {
  const base = report([k01('failed', 'failed')], 50);
  const cur = report([k01('passed', 'passed')], 100);
  const c = compareRuns(base, cur);
  assert.equal(c.items[0].status, 'resolved');
  assert.equal(c.comparable, true);
  assert.equal(c.scoreDelta, 50);
});

test('the same failure again is persistent', () => {
  const c = compareRuns(report([k01('failed', 'failed')]), report([k01('failed', 'failed')]));
  assert.equal(c.items[0].status, 'persistent');
});

test('a disappeared target or untested check is unverified, not resolved', () => {
  const missing = { ...k01('not_tested', 'not_tested'), targets: [] };
  const c = compareRuns(report([k01('failed', 'failed')]), report([missing]));
  assert.equal(c.items[0].status, 'unverified');
});

test('a new confirmed failure is reported as new', () => {
  const c = compareRuns(report([k01('passed', 'passed')]), report([k01('failed', 'failed')]));
  assert.equal(c.items.length, 1);
  assert.equal(c.items[0].status, 'new');
});

test('changed scope is not directly comparable and has no score delta', () => {
  const base = report([k01('failed', 'failed')]);
  const cur = { ...report([k01('passed', 'passed')]), checkpoints: [{ ...cp, id: 'cp-other' }] };
  const c = compareRuns(base, cur);
  assert.equal(c.comparable, false);
  assert.equal(c.scoreDelta, null);
});

test('pointer-only navigation with a confirmed K01 failure is a blocker ordered first', () => {
  const contrast = {
    checkId: 'C01', category: 'contrast', checkpointId: cp.id, status: 'failed', evidenceIds: [],
    axeFindings: [{ rule: 'color-contrast', status: 'failed', help: 'contrast', nodes: [{ selector: 'p', summary: '' }] }],
  };
  const findings = orderFindings(buildFindings([contrast, k01('failed', 'failed')], [cp]));
  assert.equal(findings[0].checkId, 'K01');
  assert.equal(findings[0].blocker, true);
  assert.equal(findings[1].blocker, false);
});

test('triage cannot promote a review finding above confirmed findings', () => {
  const review = { ...k01('review', 'review') };
  const contrast = {
    checkId: 'C01', category: 'contrast', checkpointId: cp.id, status: 'failed', evidenceIds: [],
    axeFindings: [{ rule: 'color-contrast', status: 'failed', help: 'contrast', nodes: [{ selector: 'p', summary: '' }] }],
  };
  const findings = buildFindings([review, contrast], [cp]);
  findings.find((f) => f.checkId === 'K01').triage = { impactBand: { choice: 'critical' } };
  const ordered = orderFindings(findings);
  assert.equal(ordered[0].checkId, 'C01');
  assert.equal(ordered[1].verification, 'needs_review');
});
