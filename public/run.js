import { renderReport } from './report.js';

const params = new URLSearchParams(location.search);
const runId = params.get('id');
const $ = (id) => document.getElementById(id);

const PHASES = {
  setup: 'Setup',
  exploration: 'Twinly exploration',
  keyboard: 'Keyboard checks',
  checks: 'Other accessibility checks',
  triage: 'Evidence review',
  report: 'Report',
};
const ACTORS = { twinly: 'Twinly', probe: 'Probe', system: 'System' };

let lastSeq = 0;
let startedAt = null;
let finished = false;
let source = null;
let pollTimer = null;
let lastFrameAt = null;

function announce(text) {
  $('announcer').textContent = text;
}

function describeAction(a) {
  if (!a) return '';
  const label = a.label ? ` “${a.label}”` : '';
  switch (a.type) {
    case 'click': return `Click${label}`;
    case 'double_click': return `Double-click${label}`;
    case 'type': return `Type “${a.text}”`;
    case 'key': return `Press ${a.keys}`;
    case 'scroll': return `Scroll ${a.direction || 'down'}`;
    case 'wait': return `Wait ${a.seconds || 1}s`;
    default: return a.type;
  }
}

function logLine(event, text) {
  const li = document.createElement('li');
  const actor = document.createElement('span');
  actor.className = 'actor';
  actor.textContent = ACTORS[event.actor] || event.actor;
  const time = new Date(event.timestamp).toLocaleTimeString();
  li.append(actor, ` ${text} `);
  const t = document.createElement('span');
  t.className = 'muted small';
  t.textContent = time;
  li.append(t);
  const log = $('log');
  const nearBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
  log.append(li);
  if (nearBottom) log.scrollTop = log.scrollHeight;
}

function setPhase(phase) {
  if (!PHASES[phase]) return;
  if ($('phase').textContent !== PHASES[phase]) {
    $('phase').textContent = PHASES[phase];
    announce(`Phase: ${PHASES[phase]}`);
  }
}

function showFrame(payload, timestamp) {
  const img = $('frame');
  const url = `/api/audits/${encodeURIComponent(runId)}/evidence/${encodeURIComponent(payload.evidenceId)}`;
  img.src = url;
  img.alt = `Screenshot of ${payload.url}. ${payload.caption || ''} Details are in the action trail.`;
  lastFrameAt = new Date(timestamp);
  $('frame-caption').textContent = `${payload.caption || 'Browser screenshot'} — ${payload.url} — captured ${lastFrameAt.toLocaleTimeString()}`;
  const link = $('frame-link');
  link.href = url;
  link.hidden = false;
}

function addCheckpoint(cp) {
  const list = $('checkpoints');
  if (list.querySelector('.muted')) list.replaceChildren();
  if (list.querySelector(`[data-id="${CSS.escape(cp.id)}"]`)) return;
  const li = document.createElement('li');
  li.dataset.id = cp.id;
  li.textContent = `${cp.title} (${new URL(cp.url).pathname})`;
  list.append(li);
}

function handle(event) {
  if (event.seq <= lastSeq) return;
  lastSeq = event.seq;
  const p = event.payload || {};
  if (event.phase) setPhase(event.phase);
  switch (event.type) {
    case 'run.started':
      startedAt = new Date(event.timestamp);
      logLine(event, `Audit started for ${p.url}${p.baselineRunId ? ' (retest of an earlier audit)' : ''}.`);
      break;
    case 'phase.started':
      logLine(event, `${p.label || PHASES[event.phase]} started.`);
      break;
    case 'phase.finished':
      if (event.phase === 'exploration') logLine(event, `Exploration ended (${p.stopReason.replace(/_/g, ' ')}) after ${p.calls} Twinly calls.`);
      break;
    case 'frame.captured':
      showFrame(p, event.timestamp);
      break;
    case 'action.proposed':
      $('current-action').textContent = `Twinly proposes: ${describeAction(p.action)}${p.action.reason ? ` — ${p.action.reason}` : ''}`;
      logLine(event, `proposed: ${describeAction(p.action)}.`);
      break;
    case 'action.executed':
      $('current-action').textContent = `Executed: ${describeAction(p)}${p.changed ? '' : ' (no visible change)'}`;
      logLine(event, `executed: ${describeAction(p)}${p.changed ? ` → ${new URL(p.afterUrl).pathname}` : ' (no visible change)'}.`);
      break;
    case 'action.blocked':
      logLine(event, `blocked Twinly's ${describeAction(p.action)}: ${p.reason}`);
      break;
    case 'action.failed':
      logLine(event, `could not perform ${describeAction(p.action)}: ${p.message}`);
      break;
    case 'agent.finished':
      logLine(event, `${p.outcome === 'done' ? 'finished exploring' : 'stopped'}${p.reason ? `: ${p.reason}` : ''}.`);
      break;
    case 'agent.error':
      logLine(event, `Twinly is unavailable: ${p.message}`);
      break;
    case 'checkpoint.selected':
      addCheckpoint(p.checkpoint);
      logLine(event, `selected audited state ${p.checkpoint.index + 1}: ${p.checkpoint.title}.`);
      break;
    case 'probe.step':
      logLine(event, p.text);
      if (p.evidenceId) showFrame({ evidenceId: p.evidenceId, url: p.url, caption: p.text }, event.timestamp);
      break;
    case 'check.completed':
      logLine(event, `${p.checkId} on ${p.checkpointTitle}: ${p.label}.`);
      break;
    case 'triage.finished':
      logLine(event, p.status === 'used' ? `Decisions reviewed ${p.count} findings.` : `Evidence review unavailable: ${p.message}`);
      break;
    case 'run.error':
      logLine(event, `Error: ${p.message}`);
      break;
    case 'run.finished':
      finished = true;
      $('lifecycle').textContent = p.lifecycle;
      $('cancel').hidden = true;
      $('current-action').textContent = '';
      announce(`Audit ${p.lifecycle}. Results are below.`);
      logLine(event, `Audit ${p.lifecycle}.`);
      stopStreams();
      loadRun(true);
      break;
    default:
      break;
  }
}

function stopStreams() {
  if (source) source.close();
  source = null;
  clearInterval(pollTimer);
}

function connect() {
  source = new EventSource(`/api/audits/${encodeURIComponent(runId)}/events?after=${lastSeq}`);
  source.addEventListener('audit', (e) => handle(JSON.parse(e.data)));
  source.onopen = () => {
    $('connection').hidden = true;
  };
  source.onerror = () => {
    if (finished) return;
    source.close();
    $('connection').hidden = false;
    $('connection').textContent = `Live connection lost. The last screenshot is from ${lastFrameAt ? lastFrameAt.toLocaleTimeString() : 'earlier'}; checking for updates…`;
    // Polling fallback, then try the stream again.
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, 3000);
    setTimeout(() => {
      if (!finished) {
        clearInterval(pollTimer);
        connect();
      }
    }, 10_000);
  };
}

async function poll() {
  try {
    const res = await fetch(`/api/audits/${encodeURIComponent(runId)}/events?format=json&after=${lastSeq}`);
    const { events } = await res.json();
    events.forEach(handle);
  } catch {}
}

async function loadRun(withReport) {
  const res = await fetch(`/api/audits/${encodeURIComponent(runId)}`);
  if (!res.ok) {
    $('run-heading').textContent = 'Audit not found';
    return null;
  }
  const data = await res.json();
  $('target').textContent = data.run.startUrl;
  $('lifecycle').textContent = data.run.lifecycle;
  document.title = `AccessBench — ${new URL(data.run.startUrl).host}`;
  $('run-heading').textContent = `Audit of ${new URL(data.run.startUrl).host}${data.run.baselineRunId ? ' (retest)' : ''}`;
  if (data.run.startedAt) startedAt = new Date(data.run.startedAt);
  const running = ['queued', 'running'].includes(data.run.lifecycle);
  $('cancel').hidden = !running;
  if (withReport && data.report) renderReport($('report'), data, runId);
  return data;
}

$('cancel').addEventListener('click', async () => {
  $('cancel').disabled = true;
  await fetch(`/api/audits/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
  announce('Cancel requested. Collected evidence is kept.');
});

setInterval(() => {
  if (!startedAt) return;
  const end = finished ? null : new Date();
  if (!end) return;
  const s = Math.round((end - startedAt) / 1000);
  $('elapsed').textContent = `${Math.floor(s / 60)}m ${s % 60}s`;
}, 1000);

if (!runId) {
  $('run-heading').textContent = 'No audit selected';
} else {
  const data = await loadRun(true);
  if (data) {
    if (['queued', 'running'].includes(data.run.lifecycle)) {
      connect();
    } else {
      finished = true;
      await poll();
      if (data.run.finishedAt && data.run.startedAt) {
        const s = Math.round((new Date(data.run.finishedAt) - new Date(data.run.startedAt)) / 1000);
        $('elapsed').textContent = `${Math.floor(s / 60)}m ${s % 60}s`;
      }
    }
  }
}
