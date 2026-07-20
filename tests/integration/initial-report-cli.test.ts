import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PublicReportSchema } from '../../src/contracts/index.js';
import { INITIAL_REPORT_LIMITATION } from '../../src/reports/public-report.js';
import { stableStringify } from '../../src/storage/canonical.js';
import { makeSnapshot } from '../fixtures/snapshots.js';

const execute = promisify(execFile);

describe('initial-report CLI', () => {
  let workingDirectory: string;
  let snapshotPath: string;
  const repositoryRoot = resolve(import.meta.dirname, '../..');
  const generatedAt = '2026-07-20T09:00:00.000Z';

  beforeAll(async () => {
    workingDirectory = await mkdtemp(join(tmpdir(), 'scriptledger-initial-report-'));
    snapshotPath = join(workingDirectory, 'snapshot.json');
    await writeFile(snapshotPath, stableStringify(makeSnapshot()), 'utf8');
  });

  afterAll(async () => {
    await rm(workingDirectory, { recursive: true, force: true });
  });

  it('writes a private initial report to the default local report path', async () => {
    const cliPath = join(repositoryRoot, 'src/cli/index.ts');
    const tsxLoaderPath = join(repositoryRoot, 'node_modules/tsx/dist/loader.mjs');
    const { stdout } = await execute(process.execPath, [
      '--import',
      tsxLoaderPath,
      cliPath,
      'initial-report',
      snapshotPath,
      '--generated-at',
      generatedAt,
    ], { cwd: workingDirectory });
    const reportPath = join(
      workingDirectory,
      '.scriptledger/reports/fixture-site/capture-20260720080000/report.json',
    );
    const report = PublicReportSchema.parse(JSON.parse(await readFile(reportPath, 'utf8')));

    expect(stdout).toContain('Created initial report with no baseline comparison');
    expect(report.generatedAt).toBe(generatedAt);
    expect(report.comparisonEvents).toEqual([]);
    expect(report.limitations).toContain(INITIAL_REPORT_LIMITATION);
  });
});
