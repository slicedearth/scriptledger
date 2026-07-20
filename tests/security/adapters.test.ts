import { describe, expect, it, vi } from 'vitest';
import { OsvAdapter } from '../../src/security/osv-adapter.js';
import { RetireAdapter } from '../../src/security/retire-adapter.js';

const observedAt = '2026-07-20T08:00:00.000Z';

describe('Retire.js adapter', () => {
  it('labels URI-only version evidence as low confidence', () => {
    const results = new RetireAdapter().identifyUri('https://cdn.example.invalid/3.7.1/jquery.min.js', 'resource:one', observedAt);
    expect(results[0]).toMatchObject({
      detector: 'retire.js',
      component: 'jquery',
      version: '3.7.1',
      identificationMethod: 'uri_pattern',
      confidence: 'low',
      completeness: 'partial',
    });
  });

  it('labels bounded complete content signatures as high confidence', () => {
    const results = new RetireAdapter().identifyContent('/*! jQuery v3.7.1 */', 'resource:one', observedAt);
    expect(results[0]).toMatchObject({
      component: 'jquery',
      version: '3.7.1',
      identificationMethod: 'content_signature',
      confidence: 'high',
    });
  });
});

describe('OSV adapter', () => {
  const component = new RetireAdapter().identifyContent('/*! jQuery v3.7.1 */', 'resource:one', observedAt)[0]!;

  it('is disabled by default and makes no request', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await new OsvAdapter({ fetchImpl }).query(component);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result[0]?.lookupState).toBe('disabled');
  });

  it('sends only normalized package and version and retains bounded advisory fields', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ vulns: [{ id: 'GHSA-demo-0000', summary: 'Synthetic advisory' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const result = await new OsvAdapter({ enabled: true, fetchImpl }).query(component);
    const request = fetchImpl.mock.calls[0]!;
    expect(request[0]).toBe('https://api.osv.dev/v1/query');
    expect(JSON.parse(String(request[1]?.body))).toEqual({ package: { ecosystem: 'npm', name: 'jquery' }, version: '3.7.1' });
    expect(result[0]).toMatchObject({ advisoryId: 'GHSA-demo-0000', lookupState: 'matched', affected: true });
  });

  it('reports an oversized response as unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'content-length': '1048577' },
    }));
    const result = await new OsvAdapter({ enabled: true, fetchImpl }).query(component);
    expect(result[0]?.lookupState).toBe('unavailable');
  });
});
