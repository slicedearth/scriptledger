import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { TargetConfig } from '../contracts/index.js';
import { DestinationGuard, stripControlCharacters } from './url.js';

export interface RedirectStep {
  url: string;
  status: number;
  location?: string;
}

export type RedirectProbe = (url: URL, timeoutMs: number) => Promise<{ status: number; location?: string }>;

function exactNavigationAllowed(url: URL, target: TargetConfig): boolean {
  const configured = new URL(target.origin);
  const sameHttpsOrigin = url.origin === configured.origin;
  const sameHttpFallback = target.allowSameOriginHttpFallback
    && url.protocol === 'http:'
    && url.hostname === configured.hostname
    && (url.port || '80') === '80';
  return (sameHttpsOrigin || sameHttpFallback) && target.routes.includes(url.pathname);
}

const defaultProbe: RedirectProbe = (url, timeoutMs) => new Promise((resolve, reject) => {
  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const request = transport(url, {
    method: 'HEAD',
    headers: {
      'user-agent': 'ScriptLedger/0.1 redirect-preflight',
      accept: 'text/html,application/xhtml+xml',
    },
    maxHeaderSize: 16 * 1024,
    timeout: timeoutMs,
  }, (response) => {
    const location = response.headers.location;
    response.destroy();
    resolve({
      status: response.statusCode ?? 0,
      ...(typeof location === 'string' ? { location: stripControlCharacters(location, 2_048) } : {}),
    });
  });
  request.on('timeout', () => request.destroy(new Error('Redirect preflight timed out')));
  request.on('error', reject);
  request.end();
});

export async function validateNavigationRedirects(
  initialUrl: string,
  target: TargetConfig,
  guard: DestinationGuard,
  probe: RedirectProbe = defaultProbe,
): Promise<RedirectStep[]> {
  const steps: RedirectStep[] = [];
  let current = new URL(initialUrl);
  for (let redirectCount = 0; redirectCount <= target.budgets.maxRedirects; redirectCount += 1) {
    await guard.assertAllowed(current.toString());
    if (!exactNavigationAllowed(current, target)) throw new Error('Redirect destination is outside the exact authorized route allowlist');
    const response = await probe(current, Math.min(target.budgets.maxPageLifetimeMs, 10_000));
    const step: RedirectStep = { url: current.toString(), status: response.status, ...(response.location ? { location: response.location } : {}) };
    steps.push(step);
    if (response.status < 300 || response.status > 399 || !response.location) return steps;
    if (redirectCount === target.budgets.maxRedirects) throw new Error('Redirect budget exhausted during preflight');
    current = new URL(response.location, current);
  }
  throw new Error('Redirect budget exhausted during preflight');
}
