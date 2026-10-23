// Runtime configuration. Budgets, viewports and versions are recorded in every
// run manifest so a retest can reuse them (docs/scoring.md "Freeze the plan").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export const config = {
  root,
  port: Number(process.env.PORT || 3000),
  runsDir: path.join(root, 'runs'),
  twinly: {
    baseUrl: (process.env.TWINLY_URL || 'https://advktwnedlgnhswpxokg.supabase.co/functions/v1/twinly-api/v1').replace(/\/+$/, ''),
    apiKey: process.env.TWINLY_KEY || process.env.TWINLY_API_KEY || '',
    model: 'twinly-core',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    decisionsUrl: 'https://api.openai.com/v1/decisions',
    model: 'gpt-6-luna',
  },
  // Server-configured targets that may use loopback/private addresses and
  // active form validation. A visitor-entered URL never grants this.
  authorizedTargets: readJson(path.join(root, 'config', 'authorized-targets.json'), { targets: [] }).targets,
};

export const versions = {
  checklist: 'accessbench-v1',
  scoring: 'equal-categories-v1',
  explorationPrompt: 'explore-v1',
  triagePrompt: 'triage-v1',
};

export const budgets = {
  twinlyCalls: 12,
  explorationMs: 180_000,
  providerRequestMs: 30_000,
  runnerDeadlineMs: 300_000,
  maxCheckpoints: 3,
  keyboardKeysPerTarget: 40,
  maxKeyboardTargets: 4,
};

export const viewports = {
  desktop: { width: 1280, height: 800 },
  narrow: { width: 320, height: 800 },
};

export function authorizationFor(url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return null;
  }
  return config.authorizedTargets.find((t) => t.origin === origin) || null;
}
