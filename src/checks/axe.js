// axe adapter: frozen rule allowlist mapped to registry checks. IDs verified
// against the installed axe-core release (see package-lock.json).
import { AxeBuilder } from '@axe-core/playwright';
import { createRequire } from 'node:module';
import { makeResult, aggregate } from './registry.js';

const require = createRequire(import.meta.url);
export const AXE_VERSION = require('axe-core/package.json').version;

export const AXE_MAPPING = {
  F01: ['label', 'select-name'],
  C01: ['color-contrast'],
  S01: ['button-name', 'link-name', 'input-button-name'],
  S02: ['image-alt', 'input-image-alt', 'role-img-alt', 'svg-img-alt', 'area-alt'],
  S03: [
    'aria-allowed-attr', 'aria-prohibited-attr', 'aria-required-attr', 'aria-required-children',
    'aria-required-parent', 'aria-roles', 'aria-valid-attr', 'aria-valid-attr-value',
  ],
};

const ALL_RULES = [...new Set(Object.values(AXE_MAPPING).flat())];

function nodeSummary(node) {
  return {
    selector: Array.isArray(node.target) ? node.target.join(' ') : String(node.target),
    html: String(node.html || '').slice(0, 300),
    summary: String(node.failureSummary || '').slice(0, 600),
    data: (node.any || []).concat(node.all || [], node.none || []).map((c) => c.data).find((d) => d && typeof d === 'object' && 'contrastRatio' in d) || null,
  };
}

// Per-rule outcome for one checkpoint, then aggregated per check.
export function mapAxeResults(axeResults, checkpoint, extra = {}) {
  const outcome = new Map();
  const nodes = new Map();
  for (const [bucket, status] of [['violations', 'failed'], ['incomplete', 'review'], ['passes', 'passed'], ['inapplicable', 'not_applicable']]) {
    for (const rule of axeResults[bucket] || []) {
      if (!ALL_RULES.includes(rule.id)) continue;
      // A rule can appear in several buckets; keep the most decisive outcome.
      const prev = outcome.get(rule.id);
      if (!prev || aggregate([prev, status]) === status) outcome.set(rule.id, status);
      if (status === 'failed' || status === 'review') {
        nodes.set(`${rule.id}:${status}`, { rule: rule.id, status, help: rule.help, helpUrl: rule.helpUrl, impact: rule.impact, nodes: rule.nodes.map(nodeSummary) });
      }
    }
  }
  const results = [];
  for (const [checkId, rules] of Object.entries(AXE_MAPPING)) {
    const statuses = rules.filter((r) => outcome.has(r)).map((r) => outcome.get(r));
    const missing = rules.filter((r) => !outcome.has(r));
    let status = aggregate(statuses);
    // A rule the engine did not report at all is unresolved, never a pass.
    if (missing.length && status === 'passed') status = 'review';
    if (missing.length === rules.length) status = 'not_tested';
    const ruleOutcomes = rules.map((r) => ({ rule: r, status: outcome.get(r) || 'not_reported' }));
    const findings = [...nodes.values()].filter((n) => rules.includes(n.rule));
    const reason = {
      failed: `axe reported violations: ${findings.filter((f) => f.status === 'failed').map((f) => f.rule).join(', ')}.`,
      review: 'axe could not conclusively evaluate some elements.',
      passed: 'All mapped axe rules passed on applicable elements in this state.',
      not_applicable: 'No elements in this state are covered by the mapped axe rules.',
      not_tested: 'axe did not evaluate the mapped rules.',
    }[status];
    results.push(makeResult(checkId, checkpoint, status, reason, {
      method: `axe-core ${AXE_VERSION}`,
      ruleOutcomes,
      axeFindings: findings,
      ...extra,
    }));
  }
  return results;
}

export async function runAxe(page, checkpoint, extra) {
  const results = await new AxeBuilder({ page }).withRules(ALL_RULES).analyze();
  return mapAxeResults(results, checkpoint, extra);
}
