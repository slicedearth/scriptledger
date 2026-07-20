import { createServer, type ServerResponse } from 'node:http';
import { lstat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL_REPORT_OUTPUT_MARKER } from '../src/reports/static-site.js';
import { readRegularBytes, readRegularUtf8 } from '../src/storage/safe-file.js';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function isInside(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
}

function contentType(path: string): string {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
  } as Record<string, string>)[extname(path)] ?? 'application/octet-stream';
}

function respond(response: ServerResponse, status: number, body = ''): void {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dataRoot = join(projectRoot, '.scriptledger');
const outputPath = resolve(projectRoot, option('--output') ?? '.scriptledger/site');
const port = Number(option('--port') ?? 4173);

if (dirname(outputPath) !== dataRoot) {
  throw new Error('Preview output must be a direct child of the project .scriptledger directory.');
}
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('Preview port must be an integer from 1 to 65535.');
}

for (const path of [dataRoot, outputPath]) {
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Refusing unsafe preview directory: ${path}`);
  }
}
const markerPath = join(outputPath, '.scriptledger-report-output');
if (await readRegularUtf8(markerPath).catch(() => undefined) !== LOCAL_REPORT_OUTPUT_MARKER) {
  throw new Error('Refusing to preview output without the exact ScriptLedger ownership marker.');
}

const server = createServer((request, response) => {
  void (async () => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      respond(response, 405, 'Method not allowed.\n');
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    } catch {
      respond(response, 400, 'Invalid request path.\n');
      return;
    }
    if (pathname.split('/').some((segment) => segment.startsWith('.'))) {
      respond(response, 404, 'Not found.\n');
      return;
    }
    const candidate = resolve(outputPath, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!isInside(outputPath, candidate)) {
      respond(response, 404, 'Not found.\n');
      return;
    }
    const body = await readRegularBytes(candidate).catch(() => undefined);
    if (!body) {
      respond(response, 404, 'Not found.\n');
      return;
    }
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': body.byteLength,
      'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'Content-Type': contentType(candidate),
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  })().catch(() => respond(response, 500, 'Failed to read report output.\n'));
});

await new Promise<void>((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(port, '127.0.0.1', resolveListen);
});
console.log(`Local report preview: http://127.0.0.1:${port}/`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
