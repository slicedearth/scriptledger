import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

describe('Pages workflow', () => {
  it('builds only synthetic data with the configured Pages base path', async () => {
    const path = resolve('.github/workflows/pages.yml');
    const source = await readFile(path, 'utf8');
    const workflow = parse(source);
    const steps = workflow.jobs.build.steps as Array<Record<string, unknown>>;
    const configureIndex = steps.findIndex((step) => step.id === 'pages');
    const buildIndex = steps.findIndex((step) => step.name === 'Build committed synthetic report');
    const build = steps[buildIndex] as { env: Record<string, string>; run: string };

    expect(configureIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThan(configureIndex);
    expect(build.run).toBe('npm run build');
    expect(build.env.SCRIPTLEDGER_BASE_PATH).toBe('${{ steps.pages.outputs.base_path }}');
    expect(source).toContain('path: site/build');
    expect(source).not.toContain('SCRIPTLEDGER_REPORT_PATH');
    expect(source).not.toContain('pull_request_target');
  });
});
