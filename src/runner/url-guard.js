// Target validation (architecture.md "Concrete browsing restrictions").
// URL strings alone are not trusted: hostnames are resolved and every address
// must be public unless the origin is a server-configured authorized target.
import dns from 'node:dns/promises';
import net from 'node:net';
import { authorizationFor } from '../config.js';

export class TargetError extends Error {}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const V4_BLOCKED = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([base, bits]) => [ipv4ToInt(base), bits]);

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => (n >>> (32 - bits)) === (base >>> (32 - bits)));
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (lower === '::' || lower === '::1') return true;
    const first = parseInt(lower.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    if (lower.startsWith('64:ff9b:')) return true; // NAT64 can reach private v4
    if (lower.startsWith('2001:db8:')) return true; // documentation
    return false;
  }
  return true;
}

const lookupCache = new Map();

export async function hostIsPublic(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return !isPrivateAddress(host);
  const cached = lookupCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.ok;
  let ok = false;
  try {
    const addrs = await dns.lookup(host, { all: true, verbatim: true });
    ok = addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    ok = false;
  }
  lookupCache.set(host, { ok, expires: Date.now() + 60_000 });
  return ok;
}

export async function validateTarget(input) {
  let url;
  try {
    url = new URL(String(input || '').trim());
  } catch {
    throw new TargetError('Enter a full web address starting with https:// or http://.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new TargetError('Only http and https addresses can be audited.');
  if (url.username || url.password) throw new TargetError('Addresses containing credentials cannot be audited.');
  url.hash = '';
  const authorization = authorizationFor(url.href);
  if (!authorization) {
    if (url.port && !['80', '443'].includes(url.port)) throw new TargetError('Only standard web ports (80 and 443) can be audited.');
    if (!(await hostIsPublic(url.hostname))) {
      throw new TargetError('This address resolves to a private, local, or reserved network and cannot be audited.');
    }
  }
  return { url: url.href, origin: url.origin, authorization };
}

// Used by the browser network guard for every subrequest.
export async function requestAllowed(requestUrl, authorization) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return false;
  }
  if (['data:', 'blob:', 'about:'].includes(url.protocol)) return true;
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (authorization && authorization.allowPrivateNetwork && url.origin === authorization.origin) return true;
  return hostIsPublic(url.hostname);
}
