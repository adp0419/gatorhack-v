import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCssPoint, reviewAction, mapKey } from '../src/runner/executor.js';
import { isPrivateAddress } from '../src/runner/url-guard.js';
import { parseAction } from '../src/providers/twinly.js';

const vp = { width: 1280, height: 800 };

test('normalized coordinates scale to CSS pixels and clamp to the viewport', () => {
  assert.deepEqual(toCssPoint(500, 500, vp), { x: 640, y: 400 });
  assert.deepEqual(toCssPoint(0, 0, vp), { x: 0, y: 0 });
  assert.deepEqual(toCssPoint(1000, 1000, vp), { x: 1279, y: 799 });
  assert.deepEqual(toCssPoint(1200, -5, vp), { x: 1279, y: 0 });
});

test('committing actions stop exploration regardless of target', () => {
  const v = reviewAction({ type: 'click', x: 1, y: 1, commits: true }, { target: { submits: false } });
  assert.equal(v.allowed, false);
  assert.equal(v.stop, true);
});

test('a false commits flag does not authorize a form submission', () => {
  assert.equal(reviewAction({ type: 'click', commits: false }, { target: { submits: true } }).allowed, false);
});

test('cross-origin, download and account controls are refused', () => {
  assert.equal(reviewAction({ type: 'click' }, { target: { crossOrigin: true } }).allowed, false);
  assert.equal(reviewAction({ type: 'click' }, { target: { download: true } }).allowed, false);
  assert.equal(reviewAction({ type: 'click' }, { target: { sensitive: true } }).allowed, false);
  assert.equal(reviewAction({ type: 'click' }, {}).allowed, false);
  assert.equal(reviewAction({ type: 'click' }, { target: {} }).allowed, true);
});

test('Enter inside a form is refused as implicit submission', () => {
  assert.equal(reviewAction({ type: 'key', keys: 'return' }, { focusedInForm: true }).allowed, false);
  assert.equal(reviewAction({ type: 'key', keys: 'return' }, { focusedInForm: false }).allowed, true);
  assert.equal(reviewAction({ type: 'key', keys: 'cmd+l' }, {}).allowed, false);
});

test('sensitive typing is refused', () => {
  assert.equal(reviewAction({ type: 'type', text: '4111 1111 1111 1111' }, {}).allowed, false);
  assert.equal(reviewAction({ type: 'type', text: 'hello' }, { focusedSensitive: true }).allowed, false);
  assert.equal(reviewAction({ type: 'type', text: 'bikes' }, {}).allowed, true);
});

test('key names map to Playwright keys', () => {
  assert.equal(mapKey('return'), 'Enter');
  assert.equal(mapKey('Shift+Tab'), 'Shift+Tab');
  assert.equal(mapKey('cmd+l'), null);
});

test('malformed or unsupported Twinly actions are rejected', () => {
  assert.throws(() => parseAction({ action: { type: 'drag' } }));
  assert.throws(() => parseAction({ action: { type: 'click' } }));
  assert.throws(() => parseAction({}));
  assert.equal(parseAction({ action: { type: 'done', text: 'ok' } }).type, 'done');
});

test('private, loopback, link-local and metadata addresses are blocked', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '128.84.21.199', '2606:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
});
