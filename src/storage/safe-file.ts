import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

async function readRegularFile(path: string): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      throw new Error(`Refusing to read non-regular file: ${path}`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export async function readRegularBytes(path: string): Promise<Buffer> {
  return readRegularFile(path);
}

export async function readRegularUtf8(path: string): Promise<string> {
  return (await readRegularFile(path)).toString('utf8');
}
