// Local AccessBench server: API + static vanilla frontend. The audit runner
// runs in-process (architecture.md "local Node/Express runner").
import express from 'express';
import path from 'node:path';
import { config } from '../config.js';
import { apiRouter } from './routes.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});
app.use('/api', apiRouter);
app.use(express.static(path.join(config.root, 'public'), { extensions: ['html'] }));

app.listen(config.port, () => {
  console.log(`AccessBench at http://localhost:${config.port}`);
  if (!config.twinly.apiKey) console.log('Twinly key not configured: exploration will be unavailable.');
  if (!config.openai.apiKey) console.log('OpenAI key not configured: triage will be unavailable.');
});
