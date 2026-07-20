import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  NORMALIZATION_VERSION,
  type ComponentIdentification,
} from '../contracts/index.js';

interface RetireMatch {
  component: string;
  version?: string;
  detection?: string;
}

interface RetireModule {
  version: string;
  replaceVersion(source: string): string;
  scanUri(uri: string, repository: unknown): RetireMatch[];
  scanFileContent(content: string, repository: unknown, hasher: { sha1(value: string): string }): RetireMatch[];
}

const require = createRequire(import.meta.url);
const retire = require('retire') as RetireModule;
export const RETIRE_ADAPTER_VERSION = 'scriptledger.retire-adapter.v1';

// A deliberately small, versioned subset of public Retire.js extractors. The adapter can accept a
// separately reviewed repository snapshot without changing capture contracts or network behavior.
const REPOSITORY_SOURCE = 'https://github.com/RetireJS/retire.js/tree/master/repository';
const REPOSITORY_VERSION = 'scriptledger-retire-subset.2026-07-20';
const rawRepository = {
  jquery: {
    vulnerabilities: [],
    extractors: {
      uri: ['/(§§version§§)/jquery(\\.min)?\\.js'],
      filename: ['jquery-(§§version§§)(\\.min)?\\.js'],
      filecontent: ['/\\*!? jQuery v(§§version§§)', '\\* jQuery JavaScript Library v(§§version§§)'],
      hashes: {},
    },
  },
  lodash: {
    vulnerabilities: [],
    extractors: {
      uri: ['/lodash[.-](§§version§§)(\\.min)?\\.js'],
      filename: ['lodash[.-](§§version§§)(\\.min)?\\.js'],
      filecontent: ['/\\** @license\\s+Lodash <https://lodash.com/>\\s+\\* Copyright OpenJS Foundation[^@]+@license MIT\\s+\\* Based on Underscore.js (§§version§§)'],
      hashes: {},
    },
  },
};

const bundledRepository = JSON.parse(retire.replaceVersion(JSON.stringify(rawRepository))) as unknown;

export interface RetireAdapterOptions {
  repository?: unknown;
  repositoryVersion?: string;
}

export class RetireAdapter {
  readonly #repository: unknown;
  readonly repositoryVersion: string;

  constructor(options: RetireAdapterOptions = {}) {
    this.#repository = options.repository ?? bundledRepository;
    this.repositoryVersion = options.repositoryVersion ?? REPOSITORY_VERSION;
  }

  identifyUri(uri: string, resourceId: string, observedAt: string): ComponentIdentification[] {
    return this.#toIdentifications(retire.scanUri(uri, this.#repository), resourceId, observedAt, 'uri_pattern');
  }

  identifyContent(content: string, resourceId: string, observedAt: string): ComponentIdentification[] {
    const hasher = { sha1: (value: string) => createHash('sha1').update(value).digest('hex') };
    return this.#toIdentifications(retire.scanFileContent(content, this.#repository, hasher), resourceId, observedAt, 'content_signature');
  }

  #toIdentifications(
    matches: RetireMatch[],
    resourceId: string,
    observedAt: string,
    method: ComponentIdentification['identificationMethod'],
  ): ComponentIdentification[] {
    return matches.slice(0, 16).map((match) => {
      const evidenceType = method === 'content_signature' ? 'bounded complete resource content signature' : 'normalized resource URI pattern';
      const limitations = method === 'content_signature'
        ? [`Extractor repository ${this.repositoryVersion}; signatures are identifiers, not proof of loaded behavior.`]
        : ['Version inferred from a URI pattern and not verified against content.', `Extractor source: ${REPOSITORY_SOURCE}`];
      return {
        schemaVersion: 'scriptledger.component-identification.v1',
        normalizationVersion: NORMALIZATION_VERSION,
        observedAt,
        timestampMeaning: 'first_observed',
        source: 'retire_js',
        state: 'success',
        completeness: method === 'content_signature' ? 'complete' : 'partial',
        truncation: { truncated: false },
        componentId: `component:${createHash('sha256').update(`${resourceId}:${match.component}:${match.version ?? 'unknown'}:${method}`).digest('hex').slice(0, 20)}`,
        resourceId,
        detector: 'retire.js',
        detectorVersion: `${RETIRE_ADAPTER_VERSION}/retire.js@${retire.version}/${this.repositoryVersion}`,
        identificationMethod: method,
        component: match.component.slice(0, 256),
        ...(match.version ? { version: match.version.slice(0, 256) } : {}),
        confidence: method === 'content_signature' ? 'high' : 'low',
        evidenceType,
        limitations,
      };
    });
  }
}
