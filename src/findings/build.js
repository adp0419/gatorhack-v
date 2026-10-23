// Turns failed/review check results into findings with stable keys,
// reproduction steps, and remedies. Verification comes only from check
// evidence; triage answers are attached separately and never promote.
import { CHECK_BY_ID } from '../checks/registry.js';
import { REMEDIES, DEFAULT_IMPACT } from './remedies.js';

const IMPACT_ORDER = ['critical', 'high', 'moderate', 'low', 'unclear'];

function pathOf(url) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function setupSteps(checkpoint) {
  const steps = [`Open ${checkpoint.url}.`];
  if (checkpoint.setupNeeded && checkpoint.setupActions && checkpoint.setupActions.length) {
    steps[0] = 'Open the start page.';
    for (const a of checkpoint.setupActions) steps.push(`Click “${a.label || 'the recorded control'}”.`);
  }
  return steps;
}

function base(result, checkpoint, target, extra) {
  const check = CHECK_BY_ID[result.checkId];
  const identity = target ? target.identity || target.selector || 'page' : 'page';
  return {
    key: `${result.checkId}|${result.checkpointId}|${identity}`,
    checkId: result.checkId,
    category: result.category,
    checkTitle: check.title,
    wcag: check.wcag,
    checkpointId: result.checkpointId,
    checkpointTitle: checkpoint.title,
    url: checkpoint.url,
    verification: result.status === 'failed' ? 'confirmed' : 'needs_review',
    status: result.status,
    target: target || null,
    remedy: REMEDIES[result.checkId],
    defaultImpact: result.status === 'failed' ? DEFAULT_IMPACT[result.checkId] : 'unclear',
    evidenceIds: result.evidenceIds || [],
    blocker: false,
    ...extra,
  };
}

function keyboardFindings(result, checkpoint) {
  return result.targets
    .filter((t) => t.status === 'failed' || t.status === 'review')
    .map((t) => {
      const last = t.observations && t.observations[t.observations.length - 1];
      const seq = last ? last.focusSequence.map((s) => s.name || s.role).slice(0, 12) : [];
      const pointerDest = t.pointer && t.pointer.after ? t.pointer.after.h1 || t.pointer.after.path : 'a new state';
      const isK01 = result.checkId === 'K01';
      const blocker = result.status === 'failed' && t.status === 'failed' && isK01 && !!(t.pointer && t.pointer.changed);
      return base(result, checkpoint, t, {
        title: isK01 ? `“${t.name}” cannot be reached with the keyboard` : `“${t.name}” does not respond to keyboard activation`,
        expected: isK01 ? `“${t.name}” receives focus through Tab, like other controls.` : `Pressing Enter or Space on “${t.name}” opens ${pointerDest}, as a click does.`,
        observed: t.reason || (isK01 ? `Focus never reached “${t.name}”.` : 'Keyboard activation did not reproduce the pointer result.'),
        affectedCount: 1,
        blocker,
        focusSequence: seq,
        pointerResult: pointerDest,
        selectedBy: t.source === 'twinly' ? 'Twinly exploration' : 'keyboard probe',
        reproduction: [
          ...setupSteps(checkpoint),
          `Click “${t.name}” with a mouse: it opens ${pointerDest}.`,
          `Reload, then press Tab repeatedly from the top of the page${seq.length ? `; focus moves through ${seq.slice(0, 6).join(', ')}${seq.length > 6 ? ', …' : ''}` : ''}.`,
          isK01 ? `Observe that “${t.name}” never receives focus.` : `When “${t.name}” has focus, press Enter${t.role === 'link' ? '' : ' or Space'}: nothing equivalent happens.`,
        ],
      });
    });
}

function axeFindings(result, checkpoint) {
  return (result.axeFindings || [])
    .filter((f) => (result.status === 'failed' ? f.status === 'failed' : f.status === 'review'))
    .map((f) => {
      const first = f.nodes[0] || {};
      const contrast = first.data && first.data.contrastRatio ? ` Measured contrast ${first.data.contrastRatio}:1 (${first.data.fgColor} on ${first.data.bgColor}); required ${first.data.expectedContrastRatio}.` : '';
      return base(result, checkpoint, { identity: `axe:${f.rule}`, selector: first.selector, rule: f.rule }, {
        key: `${result.checkId}|${result.checkpointId}|axe:${f.rule}`,
        title: f.help,
        expected: CHECK_BY_ID[result.checkId].title + '.',
        observed: `${f.nodes.length} element(s) ${f.status === 'failed' ? 'fail' : 'could not be conclusively evaluated for'} axe rule ${f.rule}.${contrast}`,
        affectedCount: f.nodes.length,
        nodes: f.nodes.slice(0, 20),
        rule: f.rule,
        helpUrl: f.helpUrl,
        reproduction: [
          ...setupSteps(checkpoint),
          `Inspect ${first.selector ? `the element matching \`${first.selector}\`` : 'the affected elements'}${f.nodes.length > 1 ? ` and ${f.nodes.length - 1} more` : ''}.`,
          first.summary ? first.summary.split('\n').slice(0, 3).join(' ') : `Run axe rule ${f.rule} on this page.`,
        ],
      });
    });
}

function formFindings(result, checkpoint) {
  const key = result.checkId === 'F02' ? 'f02' : 'f03';
  return (result.targets || [])
    .filter((t) => t[key] === 'failed' || t[key] === 'review')
    .map((t) =>
      base(result, checkpoint, { identity: `field:${t.field}`, selector: t.field, name: t.accessibleName || '(no name)' }, {
        title: result.checkId === 'F02' ? 'Validation error does not identify the field' : 'Validation error is not connected to its field',
        expected: result.checkId === 'F02' ? 'The error text names the invalid field and the problem.' : 'The field references its error message programmatically.',
        observed: `After entering “${t.value}” and submitting: error text ${t.errorTexts.length ? `“${t.errorTexts.join(' ')}”` : 'did not appear'}; field accessible name “${t.accessibleName || ''}”; aria-describedby text: ${t.describedBy.length ? `“${t.describedBy.join(' ')}”` : 'none'}.`,
        affectedCount: 1,
        reproduction: [...setupSteps(checkpoint), `Enter “${t.value}” in \`${t.field}\`.`, 'Press the submit button (the test site does not send anything).', `Read the error message: ${t.errorTexts.length ? `“${t.errorTexts.join(' ')}”` : 'none appears'}.`],
      }),
    );
}

function reflowFindings(result, checkpoint) {
  if (result.checkId === 'R01') {
    const offenders = (result.targets || []).filter((o) => (result.status === 'failed' ? !o.exempt && o.hasText : true));
    const first = offenders[0] || {};
    const obs = result.observations[0] || {};
    return [
      base(result, checkpoint, { identity: 'page-reflow', selector: first.selector }, {
        title: result.status === 'failed' ? 'Content does not reflow at 320 CSS pixels' : 'Horizontal scrolling at 320 CSS pixels needs review',
        expected: 'At 320 CSS pixels wide, content fits the width without horizontal scrolling (except genuine two-dimensional content).',
        observed: `Content is ${obs.scrollWidth}px wide in a ${obs.viewportWidth}px viewport. Overflowing: ${offenders.map((o) => `${o.tag} (${o.width}px${o.text ? `, “${o.text.slice(0, 40)}”` : ''})`).join('; ')}.`,
        affectedCount: offenders.length,
        nodes: offenders.map((o) => ({ selector: o.selector, html: '', summary: `${o.width}px wide, right edge at ${o.right}px` })),
        reproduction: [...setupSteps(checkpoint), 'Set the browser window or device emulation to 320 CSS pixels wide.', `Scroll horizontally: ${first.selector ? `\`${first.selector}\`` : 'content'} extends past the right edge.`],
      }),
    ];
  }
  const missing = (result.targets || []).filter((c) => !(c.visible && c.hittable && c.inView));
  return [
    base(result, checkpoint, { identity: 'narrow-controls' }, {
      title: 'Some controls may be unavailable at narrow width',
      expected: 'Important controls stay visible and operable at 320 CSS pixels, in place or through a responsive menu.',
      observed: `Not confirmed available: ${missing.map((c) => c.name || c.identity).join(', ')}.`,
      affectedCount: missing.length,
      reproduction: [...setupSteps(checkpoint), 'Set the width to 320 CSS pixels.', 'Look for the listed controls, including inside any menu.'],
    }),
  ];
}

export function buildFindings(results, checkpoints) {
  const byId = Object.fromEntries(checkpoints.map((cp) => [cp.id, cp]));
  const findings = [];
  for (const r of results) {
    if (r.status !== 'failed' && r.status !== 'review') continue;
    const cp = byId[r.checkpointId];
    if (!cp) continue;
    if (r.checkId === 'K01' || r.checkId === 'K02') findings.push(...keyboardFindings(r, cp));
    else if (r.checkId === 'F02' || r.checkId === 'F03') findings.push(...formFindings(r, cp));
    else if (r.checkId === 'R01' || r.checkId === 'R02') findings.push(...reflowFindings(r, cp));
    else findings.push(...axeFindings(r, cp));
  }
  findings.forEach((f, i) => {
    f.qid = `f${i + 1}`;
  });
  return findings;
}

// Confirmed blockers, then confirmed findings, then review findings; impact
// (triage when available, otherwise rule default) and stable keys within.
export function orderFindings(findings) {
  const group = (f) => (f.blocker ? 0 : f.verification === 'confirmed' ? 1 : 2);
  const impact = (f) => {
    const band = f.triage && f.triage.impactBand && f.triage.impactBand.choice;
    return IMPACT_ORDER.indexOf(band && band !== 'unclear' ? band : f.defaultImpact);
  };
  return [...findings].sort((a, b) => group(a) - group(b) || impact(a) - impact(b) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export { pathOf };
