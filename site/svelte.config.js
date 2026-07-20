import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { lstatSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const dataRoot = join(projectRoot, '.scriptledger');

function ownedBuildDirectory(configuredPath, parentName) {
  if (!configuredPath) return undefined;
  const resolvedPath = resolve(configuredPath);
  const parentPath = join(dataRoot, parentName);
  if (dirname(resolvedPath) !== parentPath || !basename(resolvedPath).startsWith('site-')) {
    throw new Error(`Refusing unsafe ScriptLedger ${parentName} directory: ${resolvedPath}`);
  }
  for (const path of [dataRoot, parentPath, resolvedPath]) {
    const metadata = lstatSync(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`Refusing unsafe ScriptLedger build directory: ${path}`);
    }
  }
  return resolvedPath;
}

const reportOutput = ownedBuildDirectory(process.env.SCRIPTLEDGER_REPORT_OUTPUT, 'build-staging');
const buildCache = ownedBuildDirectory(process.env.SCRIPTLEDGER_BUILD_CACHE, 'build-cache');

export default {
  preprocess: vitePreprocess(),
  kit: {
    ...(buildCache ? { outDir: buildCache } : {}),
    adapter: adapter({
      ...(reportOutput ? { pages: reportOutput, assets: reportOutput } : {}),
      fallback: undefined,
      precompress: false,
      strict: true,
    }),
  },
};
