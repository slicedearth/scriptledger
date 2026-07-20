import { describe, expect, it } from 'vitest';
import { CaptureConfigSchema, NORMALIZATION_VERSION, TargetConfigSchema } from '../../src/contracts/index.js';

const validTarget = {
  id: 'authorized-site',
  origin: 'https://portal.example.invalid',
  authorizationConfirmed: true,
  routes: ['/', '/help'],
  budgets: {
    maxNavigations: 2,
    maxRequestsPerRoute: 80,
    maxRedirects: 4,
    maxPageLifetimeMs: 15_000,
    maxTotalObservationBytes: 4_194_304,
  },
  retainQueryFreePaths: true,
  allowSameOriginHttpFallback: false,
  expectedFirstPartyRegistrableDomains: ['example.invalid'],
  configuredPartnerOrigins: [],
};

describe('target contracts', () => {
  it('accepts an exact authorized HTTPS origin with bounded routes', () => {
    expect(TargetConfigSchema.parse(validTarget).id).toBe('authorized-site');
  });

  it.each([
    ['embedded credentials', { origin: 'https://user:secret@portal.example.invalid' }],
    ['an origin path', { origin: 'https://portal.example.invalid/account' }],
    ['a fragment', { origin: 'https://portal.example.invalid/#fragment' }],
    ['wildcard authorization', { authorizationConfirmed: '*' }],
    ['an unbounded route wildcard', { routes: ['/*'] }],
    ['a query-bearing route', { routes: ['/help?token=secret'] }],
    ['a non-HTTPS origin', { origin: 'http://portal.example.invalid' }],
    ['a non-origin partner URL', { configuredPartnerOrigins: ['https://user:secret@partner.example.invalid/path'] }],
  ])('rejects %s', (_label, change) => {
    expect(() => TargetConfigSchema.parse({ ...validTarget, ...change })).toThrow();
  });

  it('requires a versioned capture document', () => {
    const parsed = CaptureConfigSchema.parse({
      schemaVersion: 'scriptledger.capture-config.v1',
      normalizationVersion: NORMALIZATION_VERSION,
      targets: [validTarget],
    });
    expect(parsed.targets).toHaveLength(1);
  });
});
