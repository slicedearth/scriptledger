#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { captureTarget } from '../collector/collector.js';
import { loadCaptureConfig } from '../contracts/config.js';
import { PublicReportSchema } from '../contracts/index.js';
import { compareSnapshots } from '../diff/compare.js';
import { buildPublicReport } from '../reports/public-report.js';
import { readSnapshot, writePublicReport, writeSnapshot } from '../storage/files.js';

function usage(): never {
  console.error(`Usage:
  scriptledger validate <targets.yml>
  scriptledger capture <targets.yml> [--output <directory>]
  scriptledger compare <before.json> <after.json> [--output <report.json>] [--generated-at <ISO timestamp>]
  scriptledger report <public-report.json>`);
  process.exit(2);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const [, , command, ...positionals] = process.argv;
  if (!command) usage();
  if (command === 'validate') {
    const path = positionals[0];
    if (!path) usage();
    const config = await loadCaptureConfig(resolve(path));
    console.log(`Valid authorized configuration for ${config.targets.length} bounded target(s).`);
    return;
  }
  if (command === 'capture') {
    const path = positionals[0];
    if (!path) usage();
    const config = await loadCaptureConfig(resolve(path));
    const root = option('--output');
    for (const target of config.targets) {
      const snapshot = await captureTarget(target);
      const written = await writeSnapshot(snapshot, root);
      console.log(written);
    }
    return;
  }
  if (command === 'compare') {
    const beforePath = positionals[0];
    const afterPath = positionals[1];
    if (!beforePath || !afterPath) usage();
    const before = await readSnapshot(resolve(beforePath));
    const after = await readSnapshot(resolve(afterPath));
    const comparison = compareSnapshots(before, after);
    if (comparison.state === 'incompatible') throw new Error(comparison.limitations.join(' '));
    const generatedAt = option('--generated-at') ?? new Date().toISOString();
    const report = buildPublicReport(after, comparison.events, { generatedAt, limitations: comparison.limitations });
    const output = option('--output');
    if (output) console.log(await writePublicReport(report, output));
    else console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (command === 'report') {
    const path = positionals[0];
    if (!path) usage();
    const report = PublicReportSchema.parse(JSON.parse(await readFile(resolve(path), 'utf8')));
    console.log(`${report.title}\n${report.comparisonEvents.length} change event(s); completeness: ${report.completeness}.`);
    return;
  }
  usage();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'ScriptLedger failed.');
  process.exitCode = 1;
});
