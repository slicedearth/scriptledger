import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addedSources, containsSource, parseCsp, serializeCsp } from '../../src/policies/csp.js';

describe('CSP normalization', () => {
  it('normalizes directive names, source ordering, nonces, and hashes', () => {
    const parsed = parseCsp("SCRIPT-SRC https://B.example 'nonce-secret' 'sha256-abc' https://a.example; object-src 'none'");
    expect(serializeCsp(parsed)).toBe("object-src 'none'; script-src 'nonce-*' 'sha256-*' https://a.example https://b.example");
  });

  it('uses default-src as the effective fallback', () => {
    const policy = parseCsp("default-src 'self' https://cdn.example");
    expect(containsSource(policy, 'script-src', "'self'")).toBe(true);
  });

  it('reports only newly effective script sources', () => {
    const before = parseCsp("script-src 'self'");
    const after = parseCsp("script-src 'self' https://cdn.example");
    expect(addedSources(before, after, 'script-src')).toEqual(['https://cdn.example']);
  });

  it('never preserves control characters under fuzzed source tokens', () => {
    fc.assert(fc.property(fc.string({ maxLength: 100 }), (source) => {
      expect(serializeCsp(parseCsp(`script-src ${source}`))).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/u);
    }));
  });
});
