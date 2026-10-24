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

test('a redirect landing origin is admitted only when it is public', async () => {
  const { admitLandingOrigin } = await import('../src/runner/url-guard.js');
  const target = { origin: 'https://8.8.8.8', allowedOrigins: ['https://8.8.8.8'], authorization: null };
  assert.equal(await admitLandingOrigin(target, 'https://1.1.1.1/home'), true);
  assert.deepEqual(target.allowedOrigins, ['https://8.8.8.8', 'https://1.1.1.1']);
  assert.equal(await admitLandingOrigin(target, 'http://127.0.0.1/'), false);
  assert.equal(await admitLandingOrigin(target, 'https://8.8.8.8:8443/'), false);
  assert.equal(target.allowedOrigins.length, 2);
});

test('reloaded states match recorded ones despite default-expanded menus', async () => {
  const { signatureMatches } = await import('../src/runner/restore.js');
  const plain = { path: '/mac/', h1: '', dialogs: [], expanded: [] };
  const searchOpen = { path: '/mac/', h1: 'Mac', dialogs: [], expanded: ['Mac and iPhone', 'Search apple.com'] };
  const fresh = { path: '/mac/', h1: 'Mac', dialogs: [], expanded: ['Mac and iPhone'] };
  assert.equal(signatureMatches(plain, fresh), true);
  assert.equal(signatureMatches(searchOpen, fresh), false);
  assert.equal(signatureMatches(searchOpen, { ...fresh, expanded: ['Mac and iPhone', 'Search apple.com'] }), true);
  assert.equal(signatureMatches({ ...plain, h1: 'Other' }, fresh), false);
  assert.equal(signatureMatches(plain, { ...fresh, path: '/ipad/' }), false);
  assert.equal(signatureMatches({ ...plain, dialogs: [] }, { ...fresh, dialogs: ['Cookie consent'] }), false);
});
