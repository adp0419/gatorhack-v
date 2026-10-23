import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreResults, scoreCategory, round } from '../src/scoring/score.js';

// Builds results for one category from a list of statuses.
function cat(category, statuses) {
  return statuses.map((status, i) => ({ category, status, checkId: `${category}-${i}`, checkpointId: 'cp' }));
}

// A category scoring `score` out of 100 with full coverage, using 4 units.
function full(category, score) {
  const passes = Math.round((score / 100) * 4);
  return cat(category, [...Array(passes).fill('passed'), ...Array(4 - passes).fill('failed')]);
}

const ALL = ['keyboard', 'forms', 'contrast', 'semantics', 'reflow'];

test('scores 50, 100, 100, 100, 100 on a complete plan give 90', () => {
  const results = [...full('keyboard', 50), ...full('forms', 100), ...full('contrast', 100), ...full('semantics', 100), ...full('reflow', 100)];
  const s = scoreResults(results);
  assert.equal(s.overall, 90);
  assert.equal(s.coverage, 100);
  assert.equal(s.provisional, false);
});

test('forms genuinely N/A with remaining 50, 100, 100, 100 gives 87.5 (displayed 88)', () => {
  const results = [...full('keyboard', 50), ...cat('forms', ['not_applicable', 'not_applicable']), ...full('contrast', 100), ...full('semantics', 100), ...full('reflow', 100)];
  const s = scoreResults(results);
  assert.equal(s.overall, 87.5);
  assert.equal(round(s.overall), 88);
  assert.equal(s.categories.find((c) => c.category === 'forms').display, 'not_applicable');
  assert.equal(s.coverage, 100);
});

test('keyboard untested with four perfect categories is 100, provisional, 80% coverage', () => {
  const results = [...cat('keyboard', ['not_tested', 'not_tested']), ...full('forms', 100), ...full('contrast', 100), ...full('semantics', 100), ...full('reflow', 100)];
  const s = scoreResults(results);
  assert.equal(s.overall, 100);
  assert.equal(s.coverage, 80);
  assert.equal(s.provisional, true);
  assert.equal(s.categories.find((c) => c.category === 'keyboard').display, 'not_scored');
});

test('category with 1 pass, 1 fail, 2 unresolved scores 50 with 50% coverage', () => {
  const c = scoreCategory(cat('keyboard', ['passed', 'failed', 'review', 'not_tested']), 'keyboard');
  assert.equal(c.score, 50);
  assert.equal(c.coverage, 50);
});

test('all applicable checks unresolved gives no score and 0% coverage', () => {
  const results = ALL.flatMap((c) => cat(c, ['review', 'not_tested']));
  const s = scoreResults(results);
  assert.equal(s.overall, null);
  assert.equal(s.display, 'no_score');
  assert.equal(s.coverage, 0);
});

test('affected node count does not change the scoring contribution', () => {
  const one = [{ category: 'contrast', status: 'failed', affected: 1 }, { category: 'contrast', status: 'passed' }];
  const twenty = [{ category: 'contrast', status: 'failed', affected: 20 }, { category: 'contrast', status: 'passed' }];
  assert.equal(scoreCategory(one, 'contrast').score, scoreCategory(twenty, 'contrast').score);
});

test('null scores are never coerced to 0 or 100', () => {
  const s = scoreResults(cat('keyboard', ['review']));
  const kb = s.categories.find((c) => c.category === 'keyboard');
  assert.equal(kb.score, null);
  assert.equal(s.overall, null);
});

test('no applicable evidence anywhere: every category N/A gives no score', () => {
  const results = ALL.flatMap((c) => cat(c, ['not_applicable']));
  const s = scoreResults(results);
  assert.equal(s.overall, null);
  assert.equal(s.coverage, null);
});

test('exploration that did not finish marks the score provisional', () => {
  const results = ALL.flatMap((c) => full(c, 100));
  assert.equal(scoreResults(results, { explorationCompleted: false }).provisional, true);
  assert.equal(scoreResults(results, { missingCheckpoints: 1 }).provisional, true);
  assert.equal(scoreResults(results).provisional, false);
});

test('full precision is kept until display', () => {
  const results = [...cat('keyboard', ['passed', 'passed', 'failed']), ...full('forms', 100)];
  const s = scoreResults(results);
  assert.ok(Math.abs(s.overall - (200 / 3 + 100) / 2) < 1e-9);
});
