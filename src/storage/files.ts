import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { CaptureSnapshotSchema, PublicReportSchema, type CaptureSnapshot, type PublicReport } from '../contracts/index.js';
import { canonicalizeSnapshot, stableStringify } from './canonical.js';

export const DEFAULT_CAPTURE_ROOT = '.scriptledger/captures';

async function atomicWrite(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, value, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, path);
}

export async function writeSnapshot(snapshot: CaptureSnapshot, root = DEFAULT_CAPTURE_ROOT): Promise<string> {
  const validated = CaptureSnapshotSchema.parse(canonicalizeSnapshot(snapshot));
  const directory = resolve(root, validated.manifest.targetId, validated.manifest.captureId.replace(':', '-'));
  const path = join(directory, 'snapshot.json');
  await atomicWrite(path, stableStringify(validated));
  return path;
}

export async function readSnapshot(path: string): Promise<CaptureSnapshot> {
  return CaptureSnapshotSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}

export async function writePublicReport(report: PublicReport, path: string): Promise<string> {
  const validated = PublicReportSchema.parse(report);
  const resolved = resolve(path);
  await atomicWrite(resolved, stableStringify(validated));
  return resolved;
}
