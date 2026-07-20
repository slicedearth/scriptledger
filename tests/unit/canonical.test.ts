import { describe, expect, it } from 'vitest';
import { canonicalHash, stableStringify } from '../../src/storage/canonical.js';

describe('canonical JSON', () => {
  it('sorts object keys and preserves array order', () => {
    expect(stableStringify({ z: 1, a: { d: 2, b: 3 }, list: ['b', 'a'] })).toBe(
      '{\n  "a": {\n    "b": 3,\n    "d": 2\n  },\n  "list": [\n    "b",\n    "a"\n  ],\n  "z": 1\n}\n',
    );
  });

  it('excludes observation timestamps from evidence hashes', () => {
    const first = canonicalHash({ id: 'resource:1', observedAt: '2026-07-20T00:00:00.000Z' });
    const second = canonicalHash({ observedAt: '2026-07-21T00:00:00.000Z', id: 'resource:1' });
    expect(first).toBe(second);
  });
});
