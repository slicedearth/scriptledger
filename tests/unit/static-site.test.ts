import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoReport } from '../../site/src/lib/demo-report.js';
import {
  buildLocalReportSite,
  LOCAL_REPORT_OUTPUT_MARKER,
  type StaticSiteBuildRunner,
} from '../../src/reports/static-site.js';
import { stableStringify } from '../../src/storage/canonical.js';

describe('local static report builder', () => {
  let projectRoot: string;
  let reportPath: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'scriptledger-static-site-'));
    await mkdir(join(projectRoot, 'site'), { recursive: true });
    await writeFile(join(projectRoot, 'site/package.json'), '{}\n', 'utf8');
    reportPath = join(projectRoot, 'curated-report.json');
    await writeFile(reportPath, stableStringify({
      ...demoReport,
      source: 'curated_authorized_capture',
      synthetic: false,
      title: 'Authorized portal evidence',
    }), 'utf8');
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  function successfulBuild(): StaticSiteBuildRunner {
    return async ({ outputPath }) => {
      await mkdir(outputPath, { recursive: true });
      await writeFile(join(outputPath, 'index.html'), '<h1>Local report</h1>\n', 'utf8');
    };
  }

  it('builds validated reports into a marked gitignored output directory', async () => {
    const runBuild = vi.fn(successfulBuild());
    const result = await buildLocalReportSite(reportPath, { projectRoot, runBuild });

    expect(result.outputPath).toBe(join(projectRoot, '.scriptledger/site'));
    expect(result.report.synthetic).toBe(false);
    expect(runBuild).toHaveBeenCalledOnce();
    await expect(readFile(join(result.outputPath, 'index.html'), 'utf8')).resolves.toContain('Local report');
    await expect(readFile(join(result.outputPath, '.scriptledger-report-output'), 'utf8')).resolves.toBe(LOCAL_REPORT_OUTPUT_MARKER);
  });

  it('refuses output outside a direct child of .scriptledger', async () => {
    const runBuild = vi.fn(successfulBuild());
    await expect(buildLocalReportSite(reportPath, { projectRoot, output: 'public-report', runBuild }))
      .rejects.toThrow('direct child');
    expect(runBuild).not.toHaveBeenCalled();
  });

  it('preserves an existing unmarked directory', async () => {
    const outputPath = join(projectRoot, '.scriptledger/site');
    await mkdir(outputPath, { recursive: true });
    await writeFile(join(outputPath, 'keep.txt'), 'operator data\n', 'utf8');
    const runBuild = vi.fn(successfulBuild());

    await expect(buildLocalReportSite(reportPath, { projectRoot, runBuild }))
      .rejects.toThrow('unmarked output directory');
    await expect(readFile(join(outputPath, 'keep.txt'), 'utf8')).resolves.toBe('operator data\n');
    expect(runBuild).not.toHaveBeenCalled();
  });

  it('replaces only output carrying the exact ScriptLedger marker', async () => {
    const outputPath = join(projectRoot, '.scriptledger/site');
    await mkdir(outputPath, { recursive: true });
    await writeFile(join(outputPath, '.scriptledger-report-output'), LOCAL_REPORT_OUTPUT_MARKER, 'utf8');
    await writeFile(join(outputPath, 'stale.html'), 'old\n', 'utf8');

    await buildLocalReportSite(reportPath, { projectRoot, runBuild: successfulBuild() });

    await expect(readFile(join(outputPath, 'index.html'), 'utf8')).resolves.toContain('Local report');
    await expect(readFile(join(outputPath, 'stale.html'), 'utf8')).rejects.toThrow();
  });
});
