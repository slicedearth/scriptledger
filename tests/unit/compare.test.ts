import { describe, expect, it } from 'vitest';
import { compareSnapshots } from '../../src/diff/compare.js';
import { buildPublicReport } from '../../src/reports/public-report.js';
import { stableStringify } from '../../src/storage/canonical.js';
import { makeSnapshot } from '../fixtures/snapshots.js';

describe('snapshot comparison', () => {
  it('detects explainable dependency, integrity, component, vulnerability, and CSP changes', () => {
    const before = makeSnapshot({
      observedAt: '2026-07-19T08:00:00.000Z',
      thirdPartyOrigins: ['https://old.third.invalid'],
      scriptOrigin: 'https://old.third.invalid',
      resourceHash: `sha256:${'a'.repeat(64)}`,
      sri: 'sha384-before',
      csp: "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      componentVersion: '3.6.0',
    });
    const after = makeSnapshot({
      observedAt: '2026-07-20T08:00:00.000Z',
      thirdPartyOrigins: ['https://new.third.invalid'],
      scriptOrigin: 'https://new.third.invalid',
      resourceHash: `sha256:${'b'.repeat(64)}`,
      csp: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://new.third.invalid; object-src 'self'; frame-ancestors 'self'; base-uri 'self'",
      iframeOrigin: 'https://frame.third.invalid',
      workerOrigin: 'https://worker.third.invalid',
      websocketOrigin: 'wss://socket.third.invalid',
      componentVersion: '3.7.1',
      vulnerabilityId: 'GHSA-synthetic-demo',
    });
    const result = compareSnapshots(before, after);
    const types = new Set(result.events.map((entry) => entry.eventType));
    for (const expectedType of [
      'third_party_origin_added',
      'third_party_origin_removed',
      'third_party_script_added',
      'script_origin_changed',
      'resource_content_changed',
      'iframe_added',
      'worker_added',
      'websocket_destination_added',
      'csp_script_source_added',
      'csp_unsafe_inline_introduced',
      'csp_unsafe_eval_introduced',
      'csp_object_none_removed',
      'csp_frame_ancestors_weakened',
      'csp_base_uri_weakened',
      'sri_removed',
      'component_version_changed',
      'vulnerability_appeared',
    ] as const) expect(types.has(expectedType)).toBe(true);
    expect(result.events.every((entry) => entry.reason && entry.evidenceReferences.length > 0)).toBe(true);
    expect(result.events[0]?.firstObservedAt).toBe('2026-07-20T08:00:00.000Z');
  });

  it('does not create false removals from a partial capture', () => {
    const before = makeSnapshot({ thirdPartyOrigins: ['https://old.third.invalid'], sri: 'sha384-before' });
    const after = makeSnapshot({ observedAt: '2026-07-21T08:00:00.000Z', completeness: 'partial' });
    const result = compareSnapshots(before, after);
    expect(result.state).toBe('partial');
    expect(result.events.map((entry) => entry.eventType)).not.toContain('third_party_origin_removed');
    expect(result.events.map((entry) => entry.eventType)).not.toContain('sri_removed');
  });

  it('distinguishes CSP addition, report-only replacement, SRI addition, and vulnerability disappearance', () => {
    const empty = makeSnapshot({ observedAt: '2026-07-18T08:00:00.000Z', componentVersion: '3.7.1' });
    const enforced = makeSnapshot({
      observedAt: '2026-07-19T08:00:00.000Z',
      csp: "default-src 'self'; script-src 'self'",
      sri: 'sha384-added',
      componentVersion: '3.7.1',
      vulnerabilityId: 'GHSA-synthetic-demo',
    });
    const reportOnly = makeSnapshot({
      observedAt: '2026-07-20T08:00:00.000Z',
      cspReportOnly: "default-src 'self'; script-src 'self'",
      sri: 'sha384-added',
      componentVersion: '3.7.1',
    });
    const additionTypes = compareSnapshots(empty, enforced).events.map((entry) => entry.eventType);
    expect(additionTypes).toContain('csp_added');
    expect(additionTypes).toContain('sri_added');
    const replacementTypes = compareSnapshots(enforced, reportOnly).events.map((entry) => entry.eventType);
    expect(replacementTypes).toContain('csp_removed');
    expect(replacementTypes).toContain('csp_enforcement_replaced_by_report_only');
    expect(replacementTypes).toContain('vulnerability_disappeared');
  });

  it('refuses incompatible schema or normalization versions', () => {
    const before = makeSnapshot();
    const after = { ...makeSnapshot({ observedAt: '2026-07-21T08:00:00.000Z' }), normalizationVersion: 'future-version' } as unknown as typeof before;
    expect(compareSnapshots(before, after)).toMatchObject({ state: 'incompatible', events: [] });
  });

  it('produces byte-identical derived reports with a fixed report timestamp', () => {
    const before = makeSnapshot({ observedAt: '2026-07-19T08:00:00.000Z' });
    const after = makeSnapshot({ observedAt: '2026-07-20T08:00:00.000Z', thirdPartyOrigins: ['https://new.third.invalid'] });
    const comparison = compareSnapshots(before, after);
    const options = { generatedAt: '2026-07-20T09:00:00.000Z', synthetic: true } as const;
    expect(stableStringify(buildPublicReport(after, comparison.events, options))).toBe(stableStringify(buildPublicReport(after, comparison.events, options)));
  });
});
