// Report, finding inspector, and retest comparison. All page-derived text is
// inserted with textContent, never as HTML.

const CATEGORY_LABELS = {
  keyboard: 'Keyboard operation',
  forms: 'Forms and validation',
  contrast: 'Text contrast',
  semantics: 'Structure and semantics',
  reflow: 'Zoom and reflow',
};
const CATEGORY_SCOPE = {
  keyboard: 'Selected interactions tested; not every control',
  forms: 'Programmatic names; error behavior only on authorized test sites',
  contrast: 'Text axe can evaluate conclusively, AA thresholds',
  semantics: 'Button/link names, image alternatives, ARIA validity subset',
  reflow: '320 px reflow tested; text resizing not tested',
};
const CHECK_TITLES = {
  K01: 'Selected targets are reachable by keyboard',
  K02: 'Keyboard activation produces the expected state',
  F01: 'Form inputs have accessible names',
  F02: 'Errors identify the field and problem',
  F03: 'Errors are related to their field',
  C01: 'Text meets AA contrast',
  S01: 'Buttons and links have names',
  S02: 'Images have text alternatives',
  S03: 'ARIA is valid',
  R01: 'Reflow at 320 px without 2D scrolling',
  R02: 'Important controls available at narrow width',
};
const STATUS_LABELS = { passed: 'Passed', failed: 'Failed', review: 'Needs review', not_tested: 'Not tested', not_applicable: 'Not applicable' };
const STATUS_ICONS = { passed: '✓', failed: '✗', review: '?', not_tested: '–', not_applicable: 'n/a' };
const RETEST_LABELS = { resolved: 'Resolved', persistent: 'Persistent', new: 'New', unverified: 'Unverified' };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

const round = (v) => (v === null || v === undefined ? null : Math.round(v));

function verdict(status) {
  return el('span', { class: `verdict verdict-${status}` }, `${STATUS_ICONS[status]} ${STATUS_LABELS[status]}`);
}

let state = null;

export function renderReport(container, data, runId) {
  state = { container, data, runId };
  draw();
  window.removeEventListener('hashchange', draw);
  window.addEventListener('hashchange', draw);
}

function draw() {
  const { container, data } = state;
  const { report, run } = data;
  container.replaceChildren();
  if (!report) return;
  const qid = (location.hash.match(/^#finding-(f\d+)$/) || [])[1];
  const finding = qid && report.findings.find((f) => f.qid === qid);
  if (finding) {
    container.append(inspector(finding, report));
    const heading = container.querySelector('#inspector-heading');
    if (heading) heading.focus();
    return;
  }
  container.append(summary(report, run), comparison(report), categories(report), findingsList(report), resultsTable(report), limitations(report));
}

function summary(report, run) {
  const s = report.score;
  const audited = report.checkpoints.filter((c) => c.reconstructed !== false).length;
  const scoreText = s.overall === null ? 'No score yet' : `${round(s.overall)}/100`;
  const parts = [
    s.provisional ? 'Provisional' : 'Complete for this test plan',
    s.coverage === null ? 'coverage not applicable' : `${round(s.coverage)}% planned-check coverage`,
    `${audited} of ${report.checkpoints.length} planned states audited`,
  ];
  const blockers = report.findings.filter((f) => f.blocker);
  const section = el('section', { class: 'panel', 'aria-labelledby': 'summary-heading' },
    el('h2', { id: 'summary-heading' }, 'Result'),
    el('div', { class: 'score-row' }, el('span', { class: 'score-big' }, scoreText), el('span', {}, parts.join(' · '))),
    el('p', { class: 'muted small' }, `${s.conclusive} of ${s.planned} planned checks were conclusive. The score covers only the checks and states listed below; it is not a percentage of WCAG met.`),
  );
  if (s.provisionalReasons.length) section.append(el('ul', { class: 'small' }, s.provisionalReasons.map((r) => el('li', {}, r))));
  section.append(
    el('details', {},
      el('summary', {}, 'How this score works'),
      el('p', { class: 'small' }, 'Each category score is passed checks divided by conclusive checks (passed + failed) across audited states. Scored categories count equally; categories that are entirely not applicable are excluded. Coverage is conclusive checks divided by planned applicable checks (including needs review and not tested). Severity, affected element counts, and AI triage never change the score.'),
    ),
  );
  if (blockers.length) {
    section.append(el('div', { class: 'callout', role: 'note' },
      el('strong', {}, `${blockers.length} confirmed blocker${blockers.length > 1 ? 's' : ''}: `),
      blockers.map((b, i) => [i ? '; ' : '', el('a', { href: `#finding-${b.qid}` }, `${b.title} (${b.checkpointTitle})`)]),
    ));
  }
  if (report.lifecycle !== 'completed') {
    section.append(el('p', { class: 'callout info' }, `This audit ended as “${report.lifecycle}”. Checks that did not run are shown as Not tested.`));
  }
  const providers = el('ul', { class: 'small' },
    el('li', {}, `Twinly exploration: ${report.exploration ? `${report.exploration.calls} calls, ended ${report.exploration.stopReason.replace(/_/g, ' ')}` : 'did not run'}${report.providers.twinly === 'unavailable' ? ' (Twinly was unavailable; rule-based checks still ran)' : ''}.`),
    el('li', {}, `Evidence review (OpenAI Decisions): ${triageText(report.triage)}`),
  );
  section.append(el('h3', {}, 'How this audit ran'), providers);
  section.append(el('div', { class: 'actions' },
    el('button', { type: 'button', onclick: (e) => startRetest(e.currentTarget, report) }, 'Retest after a fix'),
    el('a', { class: 'button secondary', href: `/api/audits/${encodeURIComponent(report.runId)}`, download: `accessbench-${report.runId}.json` }, 'Download JSON report'),
  ), el('p', { class: 'field-error', id: 'retest-error', hidden: true }));
  return section;
}

function triageText(t) {
  if (!t) return 'not run.';
  if (t.status === 'used') return `reviewed ${t.evaluated} findings with ${t.model}. Its estimates order and flag findings but never change verdicts or scores.`;
  if (t.status === 'not_needed') return 'not needed; there were no failed or review findings.';
  return `unavailable (${t.message || 'no response'}). Findings are ordered by rule-based priority.`;
}

async function startRetest(button, report) {
  button.disabled = true;
  button.textContent = 'Starting retest…';
  const error = document.getElementById('retest-error');
  try {
    const res = await fetch('/api/audits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baselineRunId: report.runId }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'The retest could not be started.');
    location.href = `/run?id=${encodeURIComponent(data.id)}`;
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    button.disabled = false;
    button.textContent = 'Retest after a fix';
    button.focus();
  }
}

function comparison(report) {
  const c = report.comparison;
  if (!c) return '';
  const section = el('section', { class: 'panel', 'aria-labelledby': 'compare-heading' }, el('h2', { id: 'compare-heading' }, 'Retest comparison'));
  section.append(el('p', {}, 'Compared with ', el('a', { href: `/run?id=${encodeURIComponent(c.baselineRunId)}` }, 'the baseline audit'), '. ',
    c.comparable
      ? c.scoreDelta === null ? 'Same scope; no score to compare.' : `Same scope. Score ${round(c.baselineScore)} → ${round(report.score.overall)} (${c.scoreDelta >= 0 ? '+' : ''}${round(c.scoreDelta)}).`
      : 'Not directly comparable; no score change is shown.'));
  if (c.scopeNotes.length) section.append(el('ul', { class: 'small' }, c.scopeNotes.map((n) => el('li', {}, n))));
  section.append(el('p', {}, ['resolved', 'persistent', 'new', 'unverified'].map((k) => `${RETEST_LABELS[k]}: ${c.counts[k] || 0}`).join(' · ')));
  if (c.items.length) {
    section.append(el('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Retest comparison table (scrolls horizontally)' }, el('table', {},
      el('caption', { class: 'visually-hidden' }, 'Findings compared with the baseline'),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Retest status'), el('th', { scope: 'col' }, 'Finding'), el('th', { scope: 'col' }, 'State'), el('th', { scope: 'col' }, 'Why'))),
      el('tbody', {}, c.items.map((i) => el('tr', {},
        el('td', {}, el('strong', {}, RETEST_LABELS[i.status])),
        el('td', {}, `${i.checkId}: ${i.title}`),
        el('td', {}, i.checkpointTitle),
        el('td', {}, i.note)))),
    )));
  }
  return section;
}

function categories(report) {
  return el('section', { 'aria-labelledby': 'cat-heading' },
    el('h2', { id: 'cat-heading' }, 'Categories'),
    el('ul', { class: 'categories' }, report.score.categories.map((c) => {
      const value = c.display === 'not_applicable' ? 'Not applicable' : c.display === 'not_scored' ? 'Not scored' : `${round(c.score)}/100`;
      return el('li', {},
        el('h3', {}, CATEGORY_LABELS[c.category]),
        el('p', { class: 'score-big' }, value),
        el('p', { class: 'small' }, c.coverage === null ? 'Coverage: not applicable' : `Coverage: ${round(c.coverage)}%`),
        el('p', { class: 'small' }, `${c.counts.P} passed · ${c.counts.F} failed · ${c.counts.U} unresolved · ${c.counts.A} not applicable`),
        el('p', { class: 'small muted' }, CATEGORY_SCOPE[c.category]),
      );
    })),
  );
}

function findingsList(report) {
  const section = el('section', { 'aria-labelledby': 'findings-heading' }, el('h2', { id: 'findings-heading' }, `Findings (${report.findings.length})`));
  if (!report.findings.length) {
    section.append(el('p', {}, 'No failed or review findings in the tested scope.'));
    return section;
  }
  section.append(el('p', { class: 'small muted' }, 'Ordered: confirmed blockers, then confirmed findings, then findings that need review.'));
  section.append(el('ul', { class: 'findings' }, report.findings.map((f) => {
    const retest = report.comparison && report.comparison.items.find((i) => i.key === f.key);
    return el('li', {},
      el('h3', {}, el('a', { href: `#finding-${f.qid}`, id: `link-${f.qid}` }, f.title)),
      el('p', { class: 'small' },
        f.blocker ? el('strong', { class: 'verdict-failed' }, 'Confirmed blocker · ') : '',
        f.verification === 'confirmed' ? 'Confirmed' : 'Needs review',
        ` · ${f.checkId} ${f.checkTitle} · ${f.checkpointTitle} · ${f.affectedCount} affected`,
        retest ? ` · Retest: ${RETEST_LABELS[retest.status]}` : '',
      ),
      f.triage && f.triage.impactBand ? el('p', { class: 'small muted' }, `AI-estimated impact: ${f.triage.impactBand.choice}`) : '',
    );
  })));
  return section;
}

function resultsTable(report) {
  const cps = report.checkpoints;
  return el('section', { 'aria-labelledby': 'results-heading' },
    el('h2', { id: 'results-heading' }, 'All check results'),
    el('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Check results table (scrolls horizontally)' }, el('table', {},
      el('caption', { class: 'visually-hidden' }, 'Result of each check in each audited state'),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Check'), cps.map((cp) => el('th', { scope: 'col' }, `${cp.title}${cp.reconstructed === false ? ' (not reconstructed)' : ''}`)))),
      el('tbody', {}, Object.keys(CHECK_TITLES).map((id) => el('tr', {},
        el('th', { scope: 'row' }, `${id} ${CHECK_TITLES[id]}`),
        cps.map((cp) => {
          const r = report.results.find((x) => x.checkId === id && x.checkpointId === cp.id);
          return el('td', {}, r ? [verdict(r.status), el('div', { class: 'small muted' }, r.reason || '')] : '—');
        }),
      ))),
    )),
    el('h3', {}, 'Audited states'),
    el('ol', {}, cps.map((cp) => el('li', {}, `${cp.title} — `, el('code', {}, cp.url), cp.reconstructedBy ? ` (reached by ${cp.reconstructedBy})` : '', el('div', { class: 'small muted' }, cp.setupGoal)))),
  );
}

function limitations(report) {
  if (!report.limitations || !report.limitations.length) return '';
  return el('section', { 'aria-labelledby': 'limits-heading' },
    el('h2', { id: 'limits-heading' }, 'Limitations during this audit'),
    el('ul', {}, report.limitations.map((l) => el('li', {}, `${l.count} time(s): ${l.text}.`))),
  );
}

function inspector(f, report) {
  const back = el('a', { href: '#findings-heading', onclick: (e) => {
    e.preventDefault();
    history.pushState('', document.title, location.pathname + location.search);
    draw();
    const link = document.getElementById(`link-${f.qid}`);
    if (link) link.focus();
  } }, '← Back to all findings');
  const retest = report.comparison && report.comparison.items.find((i) => i.key === f.key);
  const section = el('section', { class: 'panel inspector', 'aria-labelledby': 'inspector-heading' },
    el('p', {}, back),
    el('h2', { id: 'inspector-heading', tabindex: '-1' }, f.title),
    el('p', {},
      f.blocker ? el('strong', { class: 'verdict-failed' }, 'Confirmed blocker. ') : '',
      f.verification === 'confirmed' ? 'Confirmed by deterministic evidence.' : 'Needs review: the evidence is not conclusive.',
      retest ? ` Retest: ${RETEST_LABELS[retest.status]} — ${retest.note}` : ''),
    el('dl', {},
      el('dt', {}, 'Check'), el('dd', {}, `${f.checkId} — ${f.checkTitle}`),
      el('dt', {}, 'Related WCAG 2.2'), el('dd', {}, f.wcag.join(', ')),
      el('dt', {}, 'State'), el('dd', {}, f.checkpointTitle, ' — ', el('code', {}, f.url)),
      f.target && f.target.name ? [el('dt', {}, 'Target'), el('dd', {}, `“${f.target.name}” (${f.target.role || 'element'})`, f.target.selector ? [' — ', el('code', {}, f.target.selector)] : '')] : '',
      f.selectedBy ? [el('dt', {}, 'Selected by'), el('dd', {}, f.selectedBy)] : '',
      el('dt', {}, 'Expected'), el('dd', {}, f.expected),
      el('dt', {}, 'Observed'), el('dd', {}, f.observed),
      el('dt', {}, 'Affected'), el('dd', {}, String(f.affectedCount)),
    ),
  );
  if (f.focusSequence && f.focusSequence.length) {
    section.append(el('h3', {}, 'Keyboard focus sequence (last attempt)'), el('ol', { class: 'small' }, f.focusSequence.map((s) => el('li', {}, s))));
  }
  if (f.nodes && f.nodes.length) {
    section.append(el('h3', {}, 'Affected elements'), el('ul', { class: 'small' }, f.nodes.map((n) => el('li', {}, el('code', {}, n.selector), n.html ? [el('br'), el('code', {}, n.html)] : '', n.summary ? el('div', { class: 'muted' }, n.summary) : ''))));
  }
  section.append(el('h3', {}, 'Steps to reproduce'), el('ol', {}, f.reproduction.map((s) => el('li', {}, s))));
  section.append(el('h3', {}, 'Suggested fix'), el('p', {}, f.remedy.text));
  if (f.remedy.snippet) section.append(el('pre', {}, el('code', {}, f.remedy.snippet)), el('p', { class: 'small muted' }, 'Illustrative example; AccessBench does not see or edit your source code.'));
  if (f.helpUrl) section.append(el('p', { class: 'small' }, el('a', { href: f.helpUrl, rel: 'noreferrer' }, `About axe rule ${f.rule}`)));

  const tri = el('div', {});
  if (f.triage) {
    const t = f.triage;
    tri.append(el('ul', { class: 'small' },
      t.evidenceState ? el('li', {}, `Evidence assessment: ${t.evidenceState.choice.replace(/_/g, ' ')}`) : '',
      t.impactBand ? el('li', {}, `Estimated impact: ${t.impactBand.choice}`) : '',
      t.needsReview && t.needsReview.probability !== null ? el('li', {}, `Suggests human review: ${t.needsReview.probability >= 0.5 ? 'yes' : 'no'} (model estimate ${Math.round(t.needsReview.probability * 100)}%, not a measured accuracy)`) : '',
    ));
  } else {
    tri.append(el('p', { class: 'small' }, report.triage.status === 'used' ? 'This finding was not part of the triage request.' : `Evidence review unavailable: ${report.triage.message || 'not run'}.`));
  }
  section.append(el('h3', {}, 'AI evidence review (estimate only)'), el('p', { class: 'small muted' }, 'OpenAI Decisions output. It orders and flags findings but cannot change verification or the score.'), tri);

  if (f.evidenceIds && f.evidenceIds.length) {
    const figs = el('div', {});
    section.append(el('h3', {}, 'Evidence screenshots'), figs);
    f.evidenceIds.forEach((id, i) => {
      const src = `/api/audits/${encodeURIComponent(report.runId)}/evidence/${encodeURIComponent(id)}`;
      const cap = el('figcaption', { class: 'small muted' }, `Screenshot ${i + 1}`);
      figs.append(el('figure', {}, el('a', { href: src }, el('img', { src, alt: `Evidence screenshot ${i + 1} for: ${f.title}. Its caption describes it.`, loading: 'lazy' })), cap));
      fetch(`${src}/meta`).then((r) => (r.ok ? r.json() : null)).then((m) => {
        if (m) cap.textContent = `Screenshot ${i + 1}: ${m.caption || ''} — ${m.url}${m.viewport ? ` at ${m.viewport.width}×${m.viewport.height}` : ''}`;
      }).catch(() => {});
    });
  }
  section.append(el('p', {}, back.cloneNode(true)));
  section.lastChild.firstChild.addEventListener('click', (e) => {
    e.preventDefault();
    back.click();
  });
  return section;
}
