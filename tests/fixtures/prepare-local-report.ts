import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demoReport } from '../../site/src/lib/demo-report.js';
import { buildLocalReportSite } from '../../src/reports/static-site.js';
import { stableStringify } from '../../src/storage/canonical.js';

const reportPath = resolve('.scriptledger/local-report-test.json');
await mkdir(resolve('.scriptledger'), { recursive: true });
await writeFile(reportPath, stableStringify({
  ...demoReport,
  source: 'curated_authorized_capture',
  synthetic: false,
  title: 'Authorized portal evidence',
  summary: 'A deliberately curated local report used to verify private static-report rendering.',
  limitations: [
    'Collection is a time-bounded browser observation, not a complete network sandbox.',
    'Missing evidence is not displayed as a pass.',
  ],
}), { encoding: 'utf8', mode: 0o600 });
await buildLocalReportSite(reportPath, { output: '.scriptledger/test-site' });
