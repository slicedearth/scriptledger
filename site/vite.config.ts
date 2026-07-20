import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { PublicReportSchema } from '../src/contracts/index.js';

const virtualReportId = 'virtual:scriptledger-report';
const resolvedVirtualReportId = `\0${virtualReportId}`;

function serializedReport(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function reportSource(): Plugin {
  return {
    name: 'scriptledger-report-source',
    resolveId(id) {
      return id === virtualReportId ? resolvedVirtualReportId : undefined;
    },
    load(id) {
      if (id !== resolvedVirtualReportId) return undefined;
      const configuredPath = process.env.SCRIPTLEDGER_REPORT_PATH;
      if (!configuredPath) {
        const fixturePath = resolve(import.meta.dirname, 'src/lib/demo-report.ts');
        return `export { demoReport as default } from ${JSON.stringify(fixturePath)};`;
      }
      const reportPath = resolve(configuredPath);
      this.addWatchFile(reportPath);
      const report = PublicReportSchema.parse(JSON.parse(readFileSync(reportPath, 'utf8')));
      return `const report = ${serializedReport(report)}; export default report;`;
    },
  };
}

export default defineConfig({
  plugins: [reportSource(), sveltekit()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
