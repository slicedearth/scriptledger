import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DestinationGuard,
  classifyDestination,
  isPublicAddress,
  registrableDomain,
  stripControlCharacters,
  toUrlEvidence,
} from '../../src/security/url.js';
import { TargetConfigSchema } from '../../src/contracts/index.js';

describe('address safety', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '192.0.2.1',
    '198.51.100.2',
    '203.0.113.4',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
  ])('rejects non-public or reserved address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111', '2001:4860:4860::8888'])('accepts public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it('rejects userinfo, blocked schemes, localhost, and private DNS results', async () => {
    const guard = new DestinationGuard({ resolver: async () => [{ address: '10.0.0.4', family: 4 }] });
    await expect(guard.assertAllowed('https://user:secret@example.com/')).rejects.toThrow(/Credentials/u);
    await expect(guard.assertAllowed('file:///etc/passwd')).rejects.toThrow(/scheme/u);
    await expect(guard.assertAllowed('javascript:alert(1)')).rejects.toThrow(/scheme/u);
    await expect(guard.assertAllowed('data:text/html,fixture')).rejects.toThrow(/scheme/u);
    await expect(guard.assertAllowed('https://localhost/')).rejects.toThrow(/Localhost/u);
    await expect(guard.assertAllowed('https://example.com/')).rejects.toThrow(/Non-public DNS/u);
  });

  it('rejects changed DNS answers during the same capture', async () => {
    let call = 0;
    const guard = new DestinationGuard({ resolver: async () => [{ address: call++ === 0 ? '1.1.1.1' : '8.8.8.8', family: 4 }] });
    await expect(guard.assertAllowed('https://example.com/')).resolves.toBeInstanceOf(URL);
    await expect(guard.assertAllowed('https://example.com/next')).rejects.toThrow(/changed during capture/u);
  });

  it('caps DNS answers', async () => {
    const guard = new DestinationGuard({ resolver: async () => Array.from({ length: 9 }, (_, index) => ({ address: `8.8.8.${index + 1}`, family: 4 })) });
    await expect(guard.assertAllowed('https://example.com/')).rejects.toThrow(/limit/u);
  });
});

describe('URL evidence minimization', () => {
  it('redacts query values and fragments while retaining a query-free path', () => {
    const evidence = toUrlEvidence('https://EXAMPLE.com:443/account/view?token=secret#private', true);
    expect(evidence).toMatchObject({
      origin: 'https://example.com',
      path: '/account/view',
      queryRedacted: true,
      fragmentRedacted: true,
    });
    expect(JSON.stringify(evidence)).not.toContain('secret');
    expect(JSON.stringify(evidence)).not.toContain('private');
  });

  it('strips control characters and caps retained values', () => {
    expect(stripControlCharacters('safe\u0000\u001ftext', 8)).toBe('safetext');
  });

  it('normalizes host casing for bounded URL inputs', () => {
    fc.assert(fc.property(
      fc.domain(),
      (domain) => {
        const upper = domain.toUpperCase();
        const evidence = toUrlEvidence(`https://${upper}/`, false);
        expect(evidence.origin).toBe(`https://${domain.toLowerCase()}`);
      },
    ));
  });

  it('uses public-suffix-aware registrable domains for explainable grouping', () => {
    const target = TargetConfigSchema.parse({
      id: 'domain-fixture',
      origin: 'https://app.example.co.uk',
      authorizationConfirmed: true,
      routes: ['/'],
      budgets: {
        maxNavigations: 1,
        maxRequestsPerRoute: 10,
        maxRedirects: 1,
        maxPageLifetimeMs: 1_000,
        maxTotalObservationBytes: 4_096,
      },
      retainQueryFreePaths: true,
      allowSameOriginHttpFallback: false,
      expectedFirstPartyRegistrableDomains: ['example.co.uk'],
      configuredPartnerOrigins: ['https://partner.example.net'],
    });

    expect(registrableDomain('https://static.example.co.uk/runtime.js')).toBe('example.co.uk');
    expect(classifyDestination('https://static.example.co.uk/runtime.js', target)).toBe('related_first_party_origin');
    expect(classifyDestination('https://partner.example.net/runtime.js', target)).toBe('configured_partner');
    expect(classifyDestination('https://cdn.example.org/runtime.js', target)).toBe('third_party');
    expect(classifyDestination('https://8.8.8.8/runtime.js', target)).toBe('ip_literal');
  });
});
