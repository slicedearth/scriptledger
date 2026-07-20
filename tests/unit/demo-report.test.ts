import { describe, expect, it } from 'vitest';
import { PublicReportSchema } from '../../src/contracts/index.js';
import { demoReport } from '../../site/src/lib/demo-report.js';

describe('public demo fixture', () => {
  it('is a complete versioned synthetic PublicReport', () => {
    expect(() => PublicReportSchema.parse(demoReport)).not.toThrow();
    expect(demoReport).toMatchObject({
      schemaVersion: 'scriptledger.public-report.v1',
      source: 'synthetic_fixture',
      synthetic: true,
      completeness: 'complete',
    });
  });

  it('uses only reserved invalid domains and synthetic advisories', () => {
    const origins = demoReport.capture.pages.flatMap((page) => page.requests.map((request) => request.destination.origin));
    expect(origins.every((origin) => new URL(origin).hostname.endsWith('.invalid'))).toBe(true);
    expect(demoReport.capture.vulnerabilities.every((entry) => entry.advisoryId.startsWith('OSV-SYNTHETIC-'))).toBe(true);
  });

  it('rejects a report whose source and synthetic label disagree', () => {
    expect(() => PublicReportSchema.parse({
      ...demoReport,
      source: 'curated_authorized_capture',
      synthetic: true,
    })).toThrow('synthetic must be true exactly when source is synthetic_fixture');
  });
});
