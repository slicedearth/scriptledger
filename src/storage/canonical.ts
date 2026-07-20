import { createHash } from 'node:crypto';
import type { CaptureSnapshot, PageObservation } from '../contracts/index.js';

const VOLATILE_HASH_KEYS = new Set([
  'observedAt',
  'firstObservedAt',
  'previousComparableObservedAt',
  'generatedAt',
]);

function canonicalValue(value: unknown, omitVolatile: boolean): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry, omitVolatile));
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => entry !== undefined && !(omitVolatile && VOLATILE_HASH_KEYS.has(key)))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalValue(entry, omitVolatile)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value, false), null, 2)}\n`;
}

export function canonicalHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(canonicalValue(value, true))).digest('hex')}`;
}

function sorted<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => key(left).localeCompare(key(right)));
}

function canonicalPage(page: PageObservation): PageObservation {
  return {
    ...page,
    requests: sorted(page.requests, (entry) => entry.requestId),
    resources: sorted(page.resources, (entry) => entry.resourceId),
    scripts: sorted(page.scripts, (entry) => entry.scriptId),
    frames: sorted(page.frames, (entry) => entry.frameId),
    workers: sorted(page.workers, (entry) => entry.workerId),
    websockets: sorted(page.websockets, (entry) => entry.websocketId),
    policies: sorted(page.policies, (entry) => `${entry.policyType}:${entry.delivery}`),
    limitations: [...page.limitations].sort(),
  };
}

export function canonicalizeSnapshot(snapshot: CaptureSnapshot): CaptureSnapshot {
  return {
    ...snapshot,
    manifest: { ...snapshot.manifest, limitsReached: [...snapshot.manifest.limitsReached].sort() },
    pages: sorted(snapshot.pages.map(canonicalPage), (entry) => entry.route),
    components: sorted(snapshot.components, (entry) => entry.componentId),
    vulnerabilities: sorted(snapshot.vulnerabilities, (entry) => entry.vulnerabilityId),
    dependencyEdges: sorted(snapshot.dependencyEdges, (entry) => entry.edgeId),
  };
}
