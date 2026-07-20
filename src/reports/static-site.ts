import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublicReportSchema, type PublicReport } from '../contracts/index.js';
import { readRegularUtf8 } from '../storage/safe-file.js';

export const LOCAL_REPORT_OUTPUT_MARKER = 'scriptledger.local-report-output.v1\n';

export interface StaticSiteBuildContext {
  projectRoot: string;
  reportPath: string;
  outputPath: string;
  cachePath: string;
}

export type StaticSiteBuildRunner = (context: StaticSiteBuildContext) => Promise<void>;

export interface StaticSiteBuildOptions {
  output?: string;
  projectRoot?: string;
  runBuild?: StaticSiteBuildRunner;
}

export interface StaticSiteBuildResult {
  outputPath: string;
  report: PublicReport;
}

function isInside(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
}

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Refusing unsafe build directory: ${path}`);
  }
}

async function assertReplaceableOutput(outputPath: string): Promise<boolean> {
  let metadata;
  try {
    metadata = await lstat(outputPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Refusing to replace unsafe output path: ${outputPath}`);
  }
  const markerPath = join(outputPath, '.scriptledger-report-output');
  let marker: string;
  try {
    marker = await readRegularUtf8(markerPath);
  } catch {
    throw new Error(`Refusing to replace unmarked output directory: ${outputPath}`);
  }
  if (marker !== LOCAL_REPORT_OUTPUT_MARKER) {
    throw new Error(`Refusing to replace output with an unknown marker: ${outputPath}`);
  }
  return true;
}

async function runSiteBuild(context: StaticSiteBuildContext): Promise<void> {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await new Promise<void>((resolveBuild, rejectBuild) => {
    const child = spawn(executable, ['run', 'build', '--workspace', 'site'], {
      cwd: context.projectRoot,
      env: {
        ...process.env,
        SCRIPTLEDGER_REPORT_PATH: context.reportPath,
        SCRIPTLEDGER_REPORT_OUTPUT: context.outputPath,
        SCRIPTLEDGER_BUILD_CACHE: context.cachePath,
      },
      stdio: 'inherit',
    });
    child.once('error', rejectBuild);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(`Static report build failed${signal ? ` with signal ${signal}` : ` with exit code ${code ?? 'unknown'}`}.`));
    });
  });
}

export async function buildLocalReportSite(
  reportPathInput: string,
  options: StaticSiteBuildOptions = {},
): Promise<StaticSiteBuildResult> {
  const projectRoot = resolve(options.projectRoot ?? fileURLToPath(new URL('../../', import.meta.url)));
  const reportPath = resolve(reportPathInput);
  const report = PublicReportSchema.parse(JSON.parse(await readFile(reportPath, 'utf8')));
  const dataRoot = resolve(projectRoot, '.scriptledger');
  const outputPath = resolve(projectRoot, options.output ?? '.scriptledger/site');

  if (dirname(outputPath) !== dataRoot) {
    throw new Error('Local report output must be a direct child of the project .scriptledger directory.');
  }
  if (['build-cache', 'build-staging'].includes(outputPath.slice(dataRoot.length + 1))) {
    throw new Error('That output name is reserved for ScriptLedger build internals.');
  }
  if (isInside(outputPath, reportPath)) {
    throw new Error('The report input cannot be stored inside the generated output directory.');
  }

  await readFile(resolve(projectRoot, 'site/package.json'), 'utf8');
  await ensureDirectory(dataRoot);
  const outputExists = await assertReplaceableOutput(outputPath);
  const stagingRoot = join(dataRoot, 'build-staging');
  const cacheRoot = join(dataRoot, 'build-cache');
  await ensureDirectory(stagingRoot);
  await ensureDirectory(cacheRoot);
  const stagingPath = await mkdtemp(join(stagingRoot, 'site-'));
  const cachePath = await mkdtemp(join(cacheRoot, 'site-'));

  try {
    await (options.runBuild ?? runSiteBuild)({ projectRoot, reportPath, outputPath: stagingPath, cachePath });
    const indexMetadata = await lstat(join(stagingPath, 'index.html')).catch(() => undefined);
    if (!indexMetadata?.isFile() || indexMetadata.isSymbolicLink()) {
      throw new Error('Static report build did not produce a safe index.html file.');
    }
    await writeFile(join(stagingPath, '.scriptledger-report-output'), LOCAL_REPORT_OUTPUT_MARKER, { encoding: 'utf8', flag: 'wx' });
    if (outputExists) await rm(outputPath, { recursive: true });
    await rename(stagingPath, outputPath);
    return { outputPath, report };
  } finally {
    await rm(stagingPath, { recursive: true, force: true });
    await rm(cachePath, { recursive: true, force: true });
  }
}
