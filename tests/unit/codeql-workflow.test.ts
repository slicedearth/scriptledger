import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

describe('CodeQL workflow', () => {
  it('is valid, least-privilege, pinned, and enabled for main and pull requests', async () => {
    const path = resolve('.github/workflows/codeql.yml');
    const source = await readFile(path, 'utf8');

    expect(() => parse(source)).not.toThrow();
    expect(source).toContain('push:\n    branches: [main]');
    expect(source).toContain('pull_request:\n    branches: [main]');
    expect(source).toContain('schedule:');
    expect(source).toContain('workflow_dispatch:');
    expect(source).toContain('permissions: {}');
    expect(source).toContain('security-events: write');
    expect(source).not.toContain('pull_request_target');
    expect(source.match(/github\/codeql-action\/(?:init|analyze)@[a-f0-9]{40}/gu)).toHaveLength(2);
  });
});
