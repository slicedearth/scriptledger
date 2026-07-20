import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { CaptureConfigSchema, type CaptureConfig } from './index.js';
import { DestinationGuard, isPublicAddress } from '../security/url.js';
import { isIP } from 'node:net';

export async function validateCaptureConfig(
  input: unknown,
  guard = new DestinationGuard(),
): Promise<CaptureConfig> {
  const config = CaptureConfigSchema.parse(input);
  const targetIds = new Set<string>();
  for (const target of config.targets) {
    if (targetIds.has(target.id)) throw new Error(`Duplicate target ID: ${target.id}`);
    targetIds.add(target.id);
    const hostname = new URL(target.origin).hostname;
    if (isIP(hostname) && !isPublicAddress(hostname)) {
      throw new Error(`Target ${target.id} uses a non-public address`);
    }
    await guard.assertAllowed(target.origin);
  }
  return config;
}

export async function loadCaptureConfig(path: string, guard?: DestinationGuard): Promise<CaptureConfig> {
  const source = await readFile(path, 'utf8');
  const parsed = path.endsWith('.json') ? JSON.parse(source) : parse(source);
  return validateCaptureConfig(parsed, guard);
}
