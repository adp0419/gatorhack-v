import express from 'express';
import { validateTarget, TargetError } from '../runner/url-guard.js';
import { startAudit, cancelAudit, activeRunId } from '../runner/run-audit.js';
import { runExists, getRun, readEvents, subscribe, framePath, readArtifact, listRuns } from '../store/run-store.js';
import { getVariant, setVariant, VARIANTS } from '../../fixtures/variant.js';

export const apiRouter = express.Router();

// Local demo control: which version of the controlled fixture site is served.
const DEMO_URL = `http://localhost:${process.env.FIXTURE_PORT || 4100}/`;

apiRouter.get('/demo', (req, res) => {
  res.json({ url: DEMO_URL, variant: getVariant() });
});

apiRouter.post('/demo', (req, res) => {
  const { variant } = req.body || {};
  if (!VARIANTS.includes(variant)) return res.status(400).json({ error: 'Choose broken or fixed.' });
  res.json({ url: DEMO_URL, variant: setVariant(variant) });
});

function loadRun(req, res) {
  const { id } = req.params;
  if (!runExists(id)) {
    res.status(404).json({ error: 'Audit not found.' });
    return null;
  }
  return getRun(id);
}

apiRouter.get('/audits', (req, res) => {
  res.json({
    audits: listRuns()
      .slice(0, 20)
      .map(({ id, startUrl, lifecycle, createdAt, baselineRunId }) => ({ id, startUrl, lifecycle, createdAt, baselineRunId })),
  });
});

apiRouter.post('/audits', async (req, res) => {
  const { url, baselineRunId } = req.body || {};
  const running = activeRunId();
  if (running) {
    return res.status(409).json({ error: 'Another audit is running. Wait for it to finish or cancel it.', runId: running });
  }
  let baseline = null;
  if (baselineRunId) {
    if (typeof baselineRunId !== 'string' || !runExists(baselineRunId)) return res.status(400).json({ error: 'Baseline audit not found.' });
    const manifest = readArtifact(baselineRunId, 'manifest');
    const report = readArtifact(baselineRunId, 'report');
    if (!manifest || !report) return res.status(400).json({ error: 'The baseline audit has no saved plan to retest.' });
    baseline = { run: getRun(baselineRunId), manifest, report };
  }
  try {
    const target = await validateTarget(baseline ? baseline.manifest.startUrl : url);
    const run = startAudit({ target, baseline });
    res.status(202).json({ id: run.id });
  } catch (err) {
    if (err instanceof TargetError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'The audit could not be started.' });
  }
});

apiRouter.get('/audits/:id', (req, res) => {
  const run = loadRun(req, res);
  if (!run) return;
  res.json({ run, report: readArtifact(run.id, 'report'), manifest: readArtifact(run.id, 'manifest') });
});

apiRouter.post('/audits/:id/cancel', (req, res) => {
  const run = loadRun(req, res);
  if (!run) return;
  res.json({ cancelled: cancelAudit(run.id) });
});

// SSE stream with resume from Last-Event-ID or ?after=<seq>. Polling clients
// can call with ?format=json to receive the backlog once.
apiRouter.get('/audits/:id/events', (req, res) => {
  const run = loadRun(req, res);
  if (!run) return;
  const after = Number(req.get('Last-Event-ID') || req.query.after || 0) || 0;
  if (req.query.format === 'json') return res.json({ events: readEvents(run.id, after) });

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  let last = after;
  const send = (event) => {
    if (event.seq <= last) return;
    last = event.seq;
    res.write(`id: ${event.seq}\nevent: audit\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const unsubscribe = subscribe(run.id, send);
  readEvents(run.id, after).forEach(send);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

apiRouter.get('/audits/:id/evidence/:evidenceId/meta', (req, res) => {
  const run = loadRun(req, res);
  if (!run) return;
  const file = framePath(run.id, req.params.evidenceId);
  if (!file) return res.status(404).json({ error: 'Evidence not found.' });
  res.sendFile(file.replace(/\.jpg$/, '.json'));
});

apiRouter.get('/audits/:id/evidence/:evidenceId', (req, res) => {
  const run = loadRun(req, res);
  if (!run) return;
  const file = framePath(run.id, req.params.evidenceId);
  if (!file) return res.status(404).json({ error: 'Evidence not found.' });
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(file);
});
