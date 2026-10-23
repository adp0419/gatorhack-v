// Check registry accessbench-v1 (docs/checks.md "Scored checklist").
// Each check produces exactly one result per audited checkpoint.

export const CATEGORIES = [
  { id: 'keyboard', label: 'Keyboard operation', scope: 'Selected interactions only; not every control' },
  { id: 'forms', label: 'Forms and validation', scope: 'Programmatic names; error behavior only on authorized test sites' },
  { id: 'contrast', label: 'Text contrast', scope: 'Text axe can evaluate conclusively, AA thresholds' },
  { id: 'semantics', label: 'Structure and semantics', scope: 'Button/link names, image alternatives, ARIA validity subset' },
  { id: 'reflow', label: 'Zoom and reflow', scope: '320 px reflow tested; text resizing not tested' },
];

export const CHECKS = [
  { id: 'K01', category: 'keyboard', title: 'Selected targets are reachable by keyboard', wcag: ['2.1.1'] },
  { id: 'K02', category: 'keyboard', title: 'Keyboard activation produces the expected state', wcag: ['2.1.1'] },
  { id: 'F01', category: 'forms', title: 'Form inputs have programmatic accessible names', wcag: ['1.3.1', '4.1.2'] },
  { id: 'F02', category: 'forms', title: 'Validation errors identify the field and problem in text', wcag: ['3.3.1'] },
  { id: 'F03', category: 'forms', title: 'Validation errors are programmatically related to the field', wcag: ['1.3.1'] },
  { id: 'C01', category: 'contrast', title: 'Text meets AA contrast thresholds', wcag: ['1.4.3'] },
  { id: 'S01', category: 'semantics', title: 'Buttons and links have accessible names', wcag: ['4.1.2', '2.4.4'] },
  { id: 'S02', category: 'semantics', title: 'Images have text alternatives', wcag: ['1.1.1'] },
  { id: 'S03', category: 'semantics', title: 'ARIA attributes, roles, and relationships are valid', wcag: ['1.3.1', '4.1.2'] },
  { id: 'R01', category: 'reflow', title: 'Content reflows at 320 CSS pixels without two-dimensional scrolling', wcag: ['1.4.10'] },
  { id: 'R02', category: 'reflow', title: 'Important controls remain available at narrow width', wcag: ['1.4.10'] },
];

export const CHECK_BY_ID = Object.fromEntries(CHECKS.map((c) => [c.id, c]));

export const STATUSES = ['passed', 'failed', 'review', 'not_tested', 'not_applicable'];

export const STATUS_LABELS = {
  passed: 'Passed',
  failed: 'Failed',
  review: 'Needs review',
  not_tested: 'Not tested',
  not_applicable: 'Not applicable',
};

export function makeResult(checkId, checkpoint, status, reason, extra = {}) {
  if (!STATUSES.includes(status)) throw new Error(`invalid status ${status}`);
  return {
    checkId,
    category: CHECK_BY_ID[checkId].category,
    checkpointId: checkpoint.id,
    checkpointTitle: checkpoint.title,
    url: checkpoint.url,
    status,
    reason,
    observations: [],
    evidenceIds: [],
    targets: [],
    method: null,
    viewport: null,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

// Aggregates per-target/per-rule outcomes into one check/state verdict:
// any failure fails; otherwise unresolved -> review; otherwise passes pass;
// only conclusively inapplicable -> N/A; nothing evaluated -> not_tested.
export function aggregate(statuses) {
  if (!statuses.length) return 'not_tested';
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('review')) return 'review';
  if (statuses.includes('passed')) return 'passed';
  if (statuses.every((s) => s === 'not_applicable')) return 'not_applicable';
  return 'not_tested';
}
