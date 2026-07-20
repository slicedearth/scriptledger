import { isIP } from 'node:net';
import { lookup as systemLookup } from 'node:dns/promises';
import { createHash } from 'node:crypto';
import { domainToASCII } from 'node:url';
import { getDomain } from 'tldts';
import type { NetworkClassificationSchema, TargetConfig, UrlEvidence } from '../contracts/index.js';
import type { z } from 'zod';

export type NetworkClassification = z.infer<typeof NetworkClassificationSchema>;
export type DnsResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const MAX_DNS_RESULTS = 8;
const DNS_TIMEOUT_MS = 2_000;

export function stripControlCharacters(value: string, maximum = 2_048): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, '').slice(0, maximum);
}

function ipv4Number(address: string): number {
  return address.split('.').reduce((value, octet) => (value << 8) + Number(octet), 0) >>> 0;
}

function inIpv4Range(address: number, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (ipv4Number(base) & mask);
}

function isPublicIpv4(address: string): boolean {
  const numeric = ipv4Number(address);
  const blocked: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ];
  return !blocked.some(([base, prefix]) => inIpv4Range(numeric, base, prefix));
}

function expandIpv6(address: string): bigint | null {
  let normalized = address.toLowerCase().split('%', 1)[0] ?? '';
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/u);
  if (mapped?.[1] && isIP(mapped[1]) === 4) return 0xffff00000000n + BigInt(ipv4Number(mapped[1]));
  const sides = normalized.split('::');
  if (sides.length > 2) return null;
  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides[1] ? sides[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((sides.length === 1 && missing !== 0) || missing < 0) return null;
  const parts = [...left, ...Array<string>(missing).fill('0'), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[a-f0-9]{1,4}$/u.test(part))) return null;
  return parts.reduce((value, part) => (value << 16n) + BigInt(Number.parseInt(part, 16)), 0n);
}

function inIpv6Range(address: bigint, base: bigint, prefix: number): boolean {
  if (prefix === 0) return true;
  const shift = BigInt(128 - prefix);
  return address >> shift === base >> shift;
}

function isPublicIpv6(address: string): boolean {
  const numeric = expandIpv6(address);
  if (numeric === null) return false;
  const mappedPrefix = 0xffff00000000n;
  if (numeric >> 32n === mappedPrefix >> 32n) {
    const mapped = Number(numeric & 0xffffffffn);
    return isPublicIpv4([24, 16, 8, 0].map((shift) => String((mapped >>> shift) & 255)).join('.'));
  }
  const blocked: Array<[bigint, number]> = [
    [0n, 128],
    [1n, 128],
    [0x0064ff9b000000000000000000000000n, 96],
    [0x01000000000000000000000000000000n, 64],
    [0x20010000000000000000000000000000n, 32],
    [0x20010db8000000000000000000000000n, 32],
    [0xfc000000000000000000000000000000n, 7],
    [0xfe800000000000000000000000000000n, 10],
    [0xff000000000000000000000000000000n, 8],
  ];
  return !blocked.some(([base, prefix]) => inIpv6Range(numeric, base, prefix));
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function defaultResolver(hostname: string): Promise<Array<{ address: string; family: number }>> {
  return systemLookup(hostname, { all: true, verbatim: true });
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('DNS resolution timed out')), milliseconds);
      timer.unref();
    }),
  ]);
}

export interface DestinationGuardOptions {
  resolver?: DnsResolver;
  allowedPrivateFixtureHosts?: ReadonlySet<string>;
}

export class DestinationGuard {
  readonly #resolver: DnsResolver;
  readonly #allowedPrivateFixtureHosts: ReadonlySet<string>;
  readonly #pinnedAddresses = new Map<string, ReadonlySet<string>>();

  constructor(options: DestinationGuardOptions = {}) {
    this.#resolver = options.resolver ?? defaultResolver;
    this.#allowedPrivateFixtureHosts = options.allowedPrivateFixtureHosts ?? new Set();
  }

  async assertAllowed(rawUrl: string): Promise<URL> {
    if (/[\u0000-\u001f\u007f-\u009f]/u.test(rawUrl)) throw new Error('URL contains control characters');
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error('URL is invalid');
    }
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
      throw new Error(`URL scheme ${url.protocol || '(missing)'} is prohibited`);
    }
    if (url.username || url.password) throw new Error('Credentials in URLs are prohibited');
    if (url.hash) throw new Error('URL fragments are prohibited');
    const hostname = domainToASCII(url.hostname.toLowerCase());
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
      throw new Error('Localhost destinations are prohibited');
    }
    if (this.#allowedPrivateFixtureHosts.has(hostname)) return url;

    const family = isIP(hostname);
    if (family !== 0) {
      if (!isPublicAddress(hostname)) throw new Error(`Non-public destination ${hostname} is prohibited`);
      return url;
    }

    const results = await withTimeout(this.#resolver(hostname), DNS_TIMEOUT_MS);
    if (results.length === 0) throw new Error(`No address records were returned for ${hostname}`);
    if (results.length > MAX_DNS_RESULTS) throw new Error(`DNS result limit exceeded for ${hostname}`);
    const addresses = new Set(results.map((result) => result.address));
    if ([...addresses].some((address) => !isPublicAddress(address))) {
      throw new Error(`Non-public DNS result for ${hostname} is prohibited`);
    }
    const pinned = this.#pinnedAddresses.get(hostname);
    if (pinned && [...addresses].some((address) => !pinned.has(address))) {
      throw new Error(`DNS result changed during capture for ${hostname}`);
    }
    if (!pinned) this.#pinnedAddresses.set(hostname, addresses);
    return url;
  }
}

export function toUrlEvidence(rawUrl: string, retainPath: boolean): UrlEvidence {
  const url = new URL(stripControlCharacters(rawUrl));
  url.hostname = domainToASCII(url.hostname.toLowerCase());
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }
  const path = stripControlCharacters(decodeURI(url.pathname || '/'), 1_024);
  const evidence: UrlEvidence = {
    scheme: url.protocol.slice(0, -1) as UrlEvidence['scheme'],
    origin: url.origin,
    pathHash: `sha256:${createHash('sha256').update(path).digest('hex')}`,
    queryRedacted: Boolean(url.search),
    fragmentRedacted: Boolean(url.hash),
  };
  if (retainPath) evidence.path = path;
  return evidence;
}

export function classifyDestination(rawUrl: string, target: TargetConfig): NetworkClassification {
  const url = new URL(rawUrl);
  if (isIP(url.hostname)) return 'ip_literal';
  if (url.origin === target.origin) return 'first_party_origin';
  if (target.configuredPartnerOrigins.includes(url.origin)) return 'configured_partner';
  const registrable = getDomain(url.hostname, { allowPrivateDomains: true });
  if (registrable && target.expectedFirstPartyRegistrableDomains.includes(registrable)) {
    return 'related_first_party_origin';
  }
  return registrable ? 'third_party' : 'unknown';
}

export function registrableDomain(rawUrl: string): string | null {
  const hostname = new URL(rawUrl).hostname;
  if (isIP(hostname)) return null;
  return getDomain(hostname, { allowPrivateDomains: true });
}
