// Twinly computer-use adapter (cloud POST /v1/computer/next-action).
// Twinly proposes one action; our executor decides whether and how to run it.
import { config } from '../config.js';

export const ACTION_TYPES = ['click', 'double_click', 'type', 'key', 'scroll', 'wait', 'done', 'fail'];

export class ProviderError extends Error {
  constructor(message, { status, code, retryable = false } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function request(method, pathname, body, timeoutMs) {
  if (!config.twinly.apiKey) throw new ProviderError('Twinly key is not configured', { code: 'missing_api_key' });
  let res;
  try {
    res = await fetch(`${config.twinly.baseUrl}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.twinly.apiKey}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ProviderError(`Twinly request failed: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`, {
      code: err.name === 'TimeoutError' ? 'timeout' : 'network_error',
      retryable: true,
    });
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ProviderError(`Twinly returned non-JSON (HTTP ${res.status})`, { status: res.status, code: 'invalid_response' });
  }
  if (!res.ok) {
    const err = data.error || {};
    throw new ProviderError(err.message || `Twinly HTTP ${res.status}`, {
      status: res.status,
      code: err.code,
      retryable: res.status === 429 || (res.status >= 500 && err.code !== 'billing_unverified' && err.code !== 'billing_record_failed'),
    });
  }
  return data;
}

export function getMe(timeoutMs = 15_000) {
  return request('GET', '/me', null, timeoutMs);
}

export function getUsage(timeoutMs = 15_000) {
  return request('GET', '/usage', null, timeoutMs);
}

// Validates the provider response shape; unknown or malformed actions are
// rejected so the loop stops instead of guessing.
export function parseAction(data) {
  const action = data && data.action;
  if (!action || typeof action !== 'object' || !ACTION_TYPES.includes(action.type)) {
    throw new ProviderError('Twinly returned an unsupported action', { code: 'unsupported_action' });
  }
  const needsPoint = ['click', 'double_click'].includes(action.type);
  if (needsPoint && !(Number.isFinite(action.x) && Number.isFinite(action.y))) {
    throw new ProviderError('Twinly click action is missing coordinates', { code: 'invalid_action' });
  }
  return {
    type: action.type,
    x: action.x,
    y: action.y,
    label: action.label,
    keys: action.keys,
    text: action.text,
    direction: action.direction,
    amount: action.amount,
    seconds: action.seconds,
    reason: action.reason,
    blocked: action.blocked,
    commits: action.commits,
  };
}

export async function nextAction({ goal, screenshot, previousScreenshot, steps, elements }, timeoutMs) {
  const body = {
    model: config.twinly.model,
    goal,
    screenshot,
    ...(previousScreenshot ? { previous_screenshot: previousScreenshot } : {}),
    ...(steps && steps.length ? { steps: steps.slice(-50) } : {}),
    ...(elements && elements.length ? { elements: elements.slice(0, 300) } : {}),
  };
  const data = await request('POST', '/computer/next-action', body, timeoutMs);
  return { action: parseAction(data), raw: data, usage: data.usage || null };
}
