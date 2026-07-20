import {
  NORMALIZATION_VERSION,
  PublicReportSchema,
  type CaptureSnapshot,
  type ChangeEvent,
  type PublicReport,
} from '../contracts/index.js';

export interface PublicReportOptions {
  generatedAt: string;
  title?: string;
  summary?: string;
  synthetic?: boolean;
  limitations?: string[];
}

export function buildPublicReport(
  capture: CaptureSnapshot,
  comparisonEvents: ChangeEvent[],
  options: PublicReportOptions,
): PublicReport {
  const report: PublicReport = {
    schemaVersion: 'scriptledger.public-report.v1',
    normalizationVersion: NORMALIZATION_VERSION,
    generatedAt: options.generatedAt,
    timestampMeaning: 'report_generated',
    source: options.synthetic ? 'synthetic_fixture' : 'curated_authorized_capture',
    synthetic: options.synthetic ?? false,
    completeness: capture.completeness,
    truncation: capture.truncation,
    title: options.title ?? `Supply-chain evidence for ${capture.manifest.targetId}`,
    summary: options.summary ?? 'A bounded observation report. Findings describe observed evidence and do not label a site safe, compromised, or malicious.',
    capture,
    comparisonEvents,
    methodologyVersion: 'scriptledger.methodology.v1',
    limitations: [
      'Collection is a time-bounded browser observation, not a complete network sandbox.',
      'A missing observation is not proof that a resource or control was absent.',
      ...(options.limitations ?? []),
    ],
  };
  return PublicReportSchema.parse(report);
}
