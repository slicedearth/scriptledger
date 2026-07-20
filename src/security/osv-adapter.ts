import { createHash } from 'node:crypto';
import {
  NORMALIZATION_VERSION,
  type ComponentIdentification,
  type VulnerabilityObservation,
} from '../contracts/index.js';
import { stripControlCharacters } from './url.js';

const RESPONSE_LIMIT = 1_048_576;

export interface OsvAdapterOptions {
  enabled?: boolean;
  timeoutMs?: number;
  maxQueries?: number;
  fetchImpl?: typeof fetch;
}

interface OsvResponse {
  vulns?: Array<{ id?: unknown; summary?: unknown }>;
}

export class OsvAdapter {
  readonly #enabled: boolean;
  readonly #timeoutMs: number;
  readonly #maxQueries: number;
  readonly #fetch: typeof fetch;
  readonly #cache = new Map<string, VulnerabilityObservation[]>();
  #queries = 0;

  constructor(options: OsvAdapterOptions = {}) {
    this.#enabled = options.enabled ?? false;
    this.#timeoutMs = Math.min(Math.max(options.timeoutMs ?? 3_000, 250), 10_000);
    this.#maxQueries = Math.min(Math.max(options.maxQueries ?? 20, 1), 50);
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async query(component: ComponentIdentification): Promise<VulnerabilityObservation[]> {
    const observedAt = component.observedAt;
    if (!this.#enabled || component.confidence !== 'high' || !component.version) {
      return [this.#state(component, observedAt, this.#enabled ? 'unavailable' : 'disabled')];
    }
    const key = `${component.component.toLowerCase()}@${component.version}`;
    const cached = this.#cache.get(key);
    if (cached) return structuredClone(cached);
    if (this.#queries >= this.#maxQueries) return [this.#state(component, observedAt, 'unavailable')];
    this.#queries += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    timer.unref();
    try {
      const response = await this.#fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ package: { ecosystem: 'npm', name: component.component }, version: component.version }),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok) return [this.#state(component, observedAt, 'unavailable')];
      const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
      if (Number.isFinite(declaredLength) && declaredLength > RESPONSE_LIMIT) return [this.#state(component, observedAt, 'unavailable')];
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > RESPONSE_LIMIT) return [this.#state(component, observedAt, 'unavailable')];
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as OsvResponse;
      const records = (parsed.vulns ?? []).slice(0, 100).flatMap((entry) => {
        if (typeof entry.id !== 'string' || !entry.id) return [];
        return [{
          schemaVersion: 'scriptledger.vulnerability-observation.v1' as const,
          normalizationVersion: NORMALIZATION_VERSION,
          observedAt,
          timestampMeaning: 'first_observed' as const,
          source: 'osv' as const,
          state: 'success' as const,
          completeness: 'complete' as const,
          truncation: { truncated: false },
          vulnerabilityId: `vulnerability:${createHash('sha256').update(`${component.componentId}:${entry.id}`).digest('hex').slice(0, 20)}`,
          componentId: component.componentId,
          advisoryId: stripControlCharacters(entry.id, 256),
          ...(typeof entry.summary === 'string' ? { summary: stripControlCharacters(entry.summary, 2_048) } : {}),
          affected: true,
          lookupState: 'matched' as const,
          database: 'OSV' as const,
        }];
      });
      const output = records.length ? records : [this.#state(component, observedAt, 'no_known_vulnerability')];
      this.#cache.set(key, output);
      return structuredClone(output);
    } catch {
      return [this.#state(component, observedAt, 'unavailable')];
    } finally {
      clearTimeout(timer);
    }
  }

  #state(
    component: ComponentIdentification,
    observedAt: string,
    lookupState: VulnerabilityObservation['lookupState'],
  ): VulnerabilityObservation {
    return {
      schemaVersion: 'scriptledger.vulnerability-observation.v1',
      normalizationVersion: NORMALIZATION_VERSION,
      observedAt,
      timestampMeaning: 'first_observed',
      source: 'osv',
      state: lookupState === 'disabled' ? 'skipped' : lookupState === 'unavailable' ? 'failed' : 'success',
      completeness: lookupState === 'unavailable' ? 'partial' : 'complete',
      truncation: { truncated: false },
      vulnerabilityId: `vulnerability:${createHash('sha256').update(`${component.componentId}:${lookupState}`).digest('hex').slice(0, 20)}`,
      componentId: component.componentId,
      advisoryId: lookupState,
      affected: false,
      lookupState,
      database: 'OSV',
    };
  }
}
