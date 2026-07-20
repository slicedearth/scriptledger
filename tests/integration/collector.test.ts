import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captureTarget } from '../../src/collector/collector.js';
import { CaptureSnapshotSchema, type TargetConfig } from '../../src/contracts/index.js';
import { startFixtureSite, type FixtureSite } from '../fixtures/site-server.js';

let fixture: FixtureSite;

beforeAll(async () => {
  fixture = await startFixtureSite();
});

afterAll(async () => {
  await fixture.close();
});

function target(overrides: Partial<TargetConfig> = {}): TargetConfig {
  return {
    id: 'fixture-site',
    origin: fixture.origin,
    authorizationConfirmed: true,
    routes: ['/'],
    budgets: {
      maxNavigations: 1,
      maxRequestsPerRoute: 40,
      maxRedirects: 4,
      maxPageLifetimeMs: 10_000,
      maxTotalObservationBytes: 4_194_304,
    },
    retainQueryFreePaths: true,
    allowSameOriginHttpFallback: false,
    expectedFirstPartyRegistrableDomains: [],
    configuredPartnerOrigins: [],
    ...overrides,
  };
}

async function fixtureBrowser() {
  return chromium.launch({
    headless: true,
    args: [
      '--no-proxy-server',
      '--host-resolver-rules=MAP third-party.example 127.0.0.1',
    ],
  });
}

describe('bounded browser collection', () => {
  it('captures scripts, frames, workers, destinations, policies, SRI, and complete bounded hashes', async () => {
    const browser = await fixtureBrowser();
    try {
      const snapshot = await captureTarget(target(), {
        browser,
        allowedPrivateFixtureHosts: new Set(['localhost', 'third-party.example']),
        redirectProbe: async () => ({ status: 200 }),
        now: () => new Date('2026-07-20T08:00:00.000Z'),
      });
      expect(() => CaptureSnapshotSchema.parse(snapshot)).not.toThrow();
      const page = snapshot.pages[0]!;
      expect(page.completeness).toBe('complete');
      expect(page.popupAttempts).toBeGreaterThan(0);
      expect(page.scripts.some((script) => script.destination?.origin === fixture.thirdPartyOrigin)).toBe(true);
      expect(page.frames).not.toHaveLength(0);
      expect(page.workers.some((worker) => worker.workerType === 'dedicated')).toBe(true);
      expect(page.workers.some((worker) => worker.workerType === 'service_worker_registration_attempt' && worker.blockedByPolicy)).toBe(true);
      expect(page.websockets[0]?.framesRetained).toBe(false);
      expect(page.policies.some((entry) => entry.policyType === 'content-security-policy' && entry.delivery === 'response_header' && entry.present)).toBe(true);
      expect(page.policies.some((entry) => entry.policyType === 'content-security-policy-report-only' && entry.present)).toBe(true);
      expect(page.resources.some((resource) => resource.kind === 'script' && resource.integrity?.hashState === 'complete')).toBe(true);
      expect(page.resources.some((resource) => resource.destination.path === '/large.js' && resource.integrity?.hashState === 'not_captured')).toBe(true);
      expect(page.resources.some((resource) => resource.integrity?.integrityAttribute === 'sha384-fixture')).toBe(true);
      expect(snapshot.components.some((component) => component.component === 'jquery' && component.version === '3.7.1')).toBe(true);
      const serialized = JSON.stringify(snapshot);
      expect(serialized).not.toContain('not-retained');
      expect(serialized).not.toContain('never-retained');
    } finally {
      await browser.close();
    }
  });

  it('marks a capture partial without retaining requests beyond the configured budget', async () => {
    const browser = await fixtureBrowser();
    try {
      const snapshot = await captureTarget(target({ budgets: { ...target().budgets, maxRequestsPerRoute: 1 } }), {
        browser,
        allowedPrivateFixtureHosts: new Set(['localhost', 'third-party.example']),
        redirectProbe: async () => ({ status: 200 }),
        now: () => new Date('2026-07-20T08:00:00.000Z'),
      });
      expect(snapshot.completeness).toBe('partial');
      expect(snapshot.pages[0]?.state).toBe('budget_exhausted');
      expect(snapshot.pages[0]?.requests.length).toBeLessThanOrEqual(1);
      expect(snapshot.pages[0]?.limitations).toContain('Request budget exhausted.');
    } finally {
      await browser.close();
    }
  });

  it('marks page lifetime exhaustion without discarding the navigation evidence', async () => {
    const browser = await fixtureBrowser();
    try {
      const snapshot = await captureTarget(target({ routes: ['/slow'], budgets: { ...target().budgets, maxPageLifetimeMs: 1_000 } }), {
        browser,
        allowedPrivateFixtureHosts: new Set(['localhost', 'third-party.example']),
        redirectProbe: async () => ({ status: 200 }),
        now: () => new Date('2026-07-20T08:00:00.000Z'),
      });
      expect(snapshot.pages[0]?.state).toBe('timed_out');
      expect(snapshot.pages[0]?.requests.some((request) => request.destination.path === '/slow')).toBe(true);
    } finally {
      await browser.close();
    }
  });
});
