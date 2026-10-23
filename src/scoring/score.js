// Score model equal-categories-v1 (docs/scoring.md). Pure functions only.
// Severity, affected-node counts, and Decisions output never change points.
import { CATEGORIES } from '../checks/registry.js';

export function categoryCounts(results, categoryId) {
  const mine = results.filter((r) => r.category === categoryId);
  const count = (s) => mine.filter((r) => r.status === s).length;
  const P = count('passed');
  const F = count('failed');
  const U = count('review') + count('not_tested');
  const A = count('not_applicable');
  return { P, F, U, A, D: P + F, E: P + F + U, total: mine.length };
}

export function scoreCategory(results, categoryId) {
  const c = categoryCounts(results, categoryId);
  let display;
  if (c.total > 0 && c.A === c.total) display = 'not_applicable';
  else if (c.D === 0) display = 'not_scored';
  else display = 'scored';
  return {
    category: categoryId,
    counts: c,
    score: c.D > 0 ? (100 * c.P) / c.D : null,
    coverage: c.E > 0 ? (100 * c.D) / c.E : null,
    display,
  };
}

export function scoreResults(results, { explorationCompleted = true, missingCheckpoints = 0 } = {}) {
  const categories = CATEGORIES.map((cat) => scoreCategory(results, cat.id));
  const scored = categories.filter((c) => c.score !== null);
  const covered = categories.filter((c) => c.counts.E > 0);
  const overall = scored.length ? scored.reduce((sum, c) => sum + c.score, 0) / scored.length : null;
  const coverage = covered.length ? covered.reduce((sum, c) => sum + c.coverage, 0) / covered.length : null;
  const conclusive = categories.reduce((n, c) => n + c.counts.D, 0);
  const planned = categories.reduce((n, c) => n + c.counts.E, 0);

  const provisionalReasons = [];
  if (results.some((r) => r.status === 'review' || r.status === 'not_tested')) provisionalReasons.push('Some planned checks need review or were not tested.');
  if (!explorationCompleted) provisionalReasons.push('Exploration did not finish normally.');
  if (missingCheckpoints > 0) provisionalReasons.push(`${missingCheckpoints} planned state(s) could not be reconstructed.`);

  return {
    model: 'equal-categories-v1',
    overall,
    coverage,
    conclusive,
    planned,
    categories,
    provisional: provisionalReasons.length > 0,
    provisionalReasons,
    display: overall === null ? 'no_score' : 'scored',
  };
}

// Rounding happens only for display.
export function round(value) {
  return value === null || value === undefined ? null : Math.round(value);
}
