import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRegularBytes, readRegularUtf8 } from '../../src/storage/safe-file.js';

describe('regular file reads', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'scriptledger-safe-file-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads a regular file through its opened descriptor', async () => {
    const path = join(directory, 'report.txt');
    await writeFile(path, 'bounded evidence\n', 'utf8');

    await expect(readRegularUtf8(path)).resolves.toBe('bounded evidence\n');
    await expect(readRegularBytes(path)).resolves.toEqual(Buffer.from('bounded evidence\n'));
  });

  it('refuses to follow a symbolic link', async () => {
    const target = join(directory, 'target.txt');
    const link = join(directory, 'report.txt');
    await writeFile(target, 'outside evidence\n', 'utf8');
    await symlink(target, link);

    await expect(readRegularUtf8(link)).rejects.toThrow();
  });
});
