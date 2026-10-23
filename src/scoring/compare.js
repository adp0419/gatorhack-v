// Retest comparison (docs/scoring.md "Comparable retests"). Findings match by
// check ID + logical checkpoint ID + stable target identity. "Resolved" needs a
// positive re-test of the same assertion and target; absence alone is
// "Unverified".

function targetPassed(result, finding) {
  if (!result || result.status === 'not_tested' || result.status === 'not_applicable') return false;
  const identity = finding.target && finding.target.identity;
  if (result.checkId === 'K01' || result.checkId === 'K02') {
    const t = (result.targets || []).find((x) => x.identity === identity);
    return !!t && t.status === 'passed';
  }
  if (result.checkId === 'F02' || result.checkId === 'F03') {
    const key = result.checkId === 'F02' ? 'f02' : 'f03';
    const t = (result.targets || []).find((x) => `field:${x.field}` === identity);
    return !!t && t[key] === 'passed';
  }
  if (identity && identity.startsWith('axe:')) {
    const rule = identity.slice(4);
    const outcome = (result.ruleOutcomes || []).find((o) => o.rule === rule);
    return !!outcome && outcome.status === 'passed';
  }
  return result.status === 'passed';
}

export function compareRuns(baseline, current) {
  const curFindings = new Map(current.findings.map((f) => [f.key, f]));
  const baseKeys = new Set(baseline.findings.map((f) => f.key));
  const resultFor = (report, checkId, checkpointId) => report.results.find((r) => r.checkId === checkId && r.checkpointId === checkpointId);

  const items = [];
  for (const f of baseline.findings) {
    const now = curFindings.get(f.key);
    const result = resultFor(current, f.checkId, f.checkpointId);
    let status;
    let note;
    if (now && now.verification === 'confirmed') {
      status = f.verification === 'confirmed' ? 'persistent' : 'new';
      note = f.verification === 'confirmed' ? 'The same assertion fails again on the same target.' : 'Previously needed review; now confirmed.';
    } else if (targetPassed(result, f)) {
      status = 'resolved';
      note = 'The same assertion was re-tested on the same target and passed.';
    } else if (now) {
      status = 'unverified';
      note = 'The finding still needs review.';
    } else {
      status = 'unverified';
      note = result ? `The target was not positively re-tested (check is ${result.status.replace('_', ' ')}).` : 'The state or check was not re-tested.';
    }
    items.push({ key: f.key, checkId: f.checkId, title: f.title, checkpointTitle: f.checkpointTitle, baseline: f.verification, current: now ? now.verification : null, status, note });
  }
  for (const f of current.findings) {
    if (baseKeys.has(f.key) || f.verification !== 'confirmed') continue;
    items.push({ key: f.key, checkId: f.checkId, title: f.title, checkpointTitle: f.checkpointTitle, baseline: null, current: f.verification, status: 'new', note: 'Confirmed in this retest; not present in the baseline.' });
  }

  const baseCps = baseline.checkpoints.map((c) => c.id).sort();
  const curCps = current.checkpoints.filter((c) => c.reconstructed !== false).map((c) => c.id).sort();
  const sameVersions = JSON.stringify(baseline.versions) === JSON.stringify(current.versions);
  const comparable = sameVersions && JSON.stringify(baseCps) === JSON.stringify(curCps);
  const scopeNotes = [];
  if (!sameVersions) scopeNotes.push('Checklist or scoring versions differ.');
  for (const id of baseCps) if (!curCps.includes(id)) scopeNotes.push(`Baseline state ${id} was not reconstructed.`);
  for (const id of curCps) if (!baseCps.includes(id)) scopeNotes.push(`State ${id} is not in the baseline.`);

  const counts = items.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] || 0) + 1 }), {});
  return {
    baselineRunId: baseline.runId,
    comparable,
    scopeNotes,
    scoreDelta: comparable && baseline.score.overall !== null && current.score.overall !== null ? current.score.overall - baseline.score.overall : null,
    baselineScore: baseline.score.overall,
    baselineCoverage: baseline.score.coverage,
    counts,
    items,
  };
}
