import { describe, expect, it, vi } from 'vitest';
import type { TargetConfig } from '../../src/contracts/index.js';
import { validateNavigationRedirects, type RedirectProbe } from '../../src/security/redirects.js';
import { DestinationGuard } from '../../src/security/url.js';

const target: TargetConfig = {
  id: 'redirect-fixture',
  origin: 'https://owned.example',
  authorizationConfirmed: true,
  routes: ['/', '/landing'],
  budgets: {
    maxNavigations: 2,
    maxRequestsPerRoute: 20,
    maxRedirects: 2,
    maxPageLifetimeMs: 5_000,
    maxTotalObservationBytes: 1_048_576,
  },
  retainQueryFreePaths: true,
  allowSameOriginHttpFallback: false,
  expectedFirstPartyRegistrableDomains: ['owned.example'],
  configuredPartnerOrigins: [],
};

const publicResolver = async () => [{ address: '1.1.1.1', family: 4 }];

describe('navigation redirect preflight', () => {
  it('revalidates every same-origin redirect before navigation', async () => {
    const probe = vi.fn<RedirectProbe>()
      .mockResolvedValueOnce({ status: 302, location: '/landing' })
      .mockResolvedValueOnce({ status: 200 });
    const steps = await validateNavigationRedirects('https://owned.example/', target, new DestinationGuard({ resolver: publicResolver }), probe);
    expect(steps.map((step) => [step.status, step.location])).toEqual([[302, '/landing'], [200, undefined]]);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('rejects a redirect to a private destination before probing it', async () => {
    const probe = vi.fn<RedirectProbe>().mockResolvedValueOnce({ status: 302, location: 'http://169.254.169.254/latest/meta-data/' });
    await expect(validateNavigationRedirects('https://owned.example/', target, new DestinationGuard({ resolver: publicResolver }), probe)).rejects.toThrow(/Non-public destination/u);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('rejects a public redirect outside the exact route allowlist', async () => {
    const probe = vi.fn<RedirectProbe>().mockResolvedValueOnce({ status: 302, location: 'https://other.example/landing' });
    await expect(validateNavigationRedirects('https://owned.example/', target, new DestinationGuard({ resolver: publicResolver }), probe)).rejects.toThrow(/allowlist/u);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('fails when the configured redirect cap is exceeded', async () => {
    const probe = vi.fn<RedirectProbe>()
      .mockResolvedValueOnce({ status: 302, location: '/landing' })
      .mockResolvedValueOnce({ status: 302, location: '/' })
      .mockResolvedValueOnce({ status: 302, location: '/landing' });
    await expect(validateNavigationRedirects('https://owned.example/', target, new DestinationGuard({ resolver: publicResolver }), probe)).rejects.toThrow(/budget/u);
  });
});
