import { describe, expect, it } from 'vitest';
import {
  buildInitialPublicReport,
  INITIAL_REPORT_LIMITATION,
} from '../../src/reports/public-report.js';
import { stableStringify } from '../../src/storage/canonical.js';
import { makeSnapshot } from '../fixtures/snapshots.js';

describe('initial public report', () => {
  it('turns one capture into a curated report without inventing changes', () => {
    const capture = makeSnapshot({ componentVersion: '3.7.1' });
    const report = buildInitialPublicReport(capture, {
      generatedAt: '2026-07-20T09:00:00.000Z',
    });

    expect(report).toMatchObject({
      source: 'curated_authorized_capture',
      synthetic: false,
      completeness: 'complete',
      capture,
      comparisonEvents: [],
    });
    expect(report.summary).toContain('no baseline comparison');
    expect(report.limitations).toContain(INITIAL_REPORT_LIMITATION);
  });

  it('preserves partial capture state and remains deterministic with a fixed timestamp', () => {
    const capture = makeSnapshot({ completeness: 'partial' });
    const options = { generatedAt: '2026-07-20T09:00:00.000Z' };
    const first = buildInitialPublicReport(capture, options);
    const second = buildInitialPublicReport(capture, options);

    expect(first.completeness).toBe('partial');
    expect(stableStringify(first)).toBe(stableStringify(second));
  });
});
