import {
  CaptureSnapshotSchema,
  NORMALIZATION_VERSION,
  type CaptureSnapshot,
  type Completeness,
  type PolicyObservation,
} from '../../src/contracts/index.js';
import { canonicalHash } from '../../src/storage/canonical.js';
import { toUrlEvidence } from '../../src/security/url.js';

export interface SnapshotFixtureOptions {
  observedAt?: string;
  completeness?: Completeness;
  thirdPartyOrigins?: string[];
  scriptOrigin?: string;
  resourceHash?: string;
  sri?: string;
  csp?: string;
  cspReportOnly?: string;
  iframeOrigin?: string;
  workerOrigin?: string;
  websocketOrigin?: string;
  componentVersion?: string;
  vulnerabilityId?: string;
}

function envelope(observedAt: string, completeness: Completeness, source: 'browser_network' | 'browser_dom' | 'response_header' | 'derived' | 'retire_js' | 'osv') {
  return {
    normalizationVersion: NORMALIZATION_VERSION,
    observedAt,
    timestampMeaning: source === 'response_header' ? 'response_observed' as const : 'first_observed' as const,
    source,
    state: completeness === 'complete' ? 'success' as const : 'partial' as const,
    completeness,
    truncation: { truncated: completeness !== 'complete' },
  };
}

export function makeSnapshot(options: SnapshotFixtureOptions = {}): CaptureSnapshot {
  const observedAt = options.observedAt ?? '2026-07-20T08:00:00.000Z';
  const completeness = options.completeness ?? 'complete';
  const pageId = 'page:fixture';
  const thirdPartyOrigins = options.thirdPartyOrigins ?? [];
  const requests = thirdPartyOrigins.map((origin, index) => ({
    ...envelope(observedAt, completeness, 'browser_network'),
    schemaVersion: 'scriptledger.request-observation.v1' as const,
    requestId: `request:third-${index}`,
    pageId,
    method: 'GET' as const,
    resourceType: 'script',
    destination: toUrlEvidence(`${origin}/asset-${index}.js`, true),
    registrableDomain: null,
    classification: 'third_party' as const,
    responseStatus: 200,
  }));
  const scriptDestination = options.scriptOrigin ? toUrlEvidence(`${options.scriptOrigin}/app.js`, true) : undefined;
  const resourceDestination = toUrlEvidence('https://assets.owned.example/app.js', true);
  const integrity = {
    ...envelope(observedAt, completeness, 'browser_network'),
    schemaVersion: 'scriptledger.integrity-observation.v1' as const,
    resourceId: 'resource:app',
    ...(options.sri ? { integrityAttribute: options.sri } : {}),
    ...(options.resourceHash ? { contentHash: options.resourceHash } : {}),
    hashState: options.resourceHash ? 'complete' as const : 'not_captured' as const,
    eligibilityReason: options.resourceHash ? 'Complete bounded fixture content.' : 'Fixture content was not captured.',
  };
  const policies: PolicyObservation[] = [];
  if (options.csp) policies.push({
    ...envelope(observedAt, completeness, 'response_header'),
    schemaVersion: 'scriptledger.policy-observation.v1',
    pageId,
    policyType: 'content-security-policy',
    delivery: 'response_header',
    value: options.csp,
    present: true,
  });
  if (options.cspReportOnly) policies.push({
    ...envelope(observedAt, completeness, 'response_header'),
    schemaVersion: 'scriptledger.policy-observation.v1',
    pageId,
    policyType: 'content-security-policy-report-only',
    delivery: 'response_header',
    value: options.cspReportOnly,
    present: true,
  });
  const componentVersion = options.componentVersion;
  const component = componentVersion ? {
    ...envelope(observedAt, completeness, 'retire_js'),
    schemaVersion: 'scriptledger.component-identification.v1' as const,
    componentId: `component:jquery-${componentVersion.replaceAll('.', '-')}`,
    resourceId: 'resource:app',
    detector: 'retire.js' as const,
    detectorVersion: '5.4.3',
    identificationMethod: 'content_signature' as const,
    component: 'jquery',
    version: componentVersion,
    confidence: 'high' as const,
    evidenceType: 'bounded complete resource content signature',
    limitations: [],
  } : undefined;
  const snapshot = {
    schemaVersion: 'scriptledger.capture-snapshot.v1' as const,
    normalizationVersion: NORMALIZATION_VERSION,
    observedAt,
    timestampMeaning: 'capture_started' as const,
    source: 'browser_network' as const,
    state: completeness === 'complete' ? 'success' as const : 'partial' as const,
    completeness,
    truncation: { truncated: completeness !== 'complete' },
    manifest: {
      schemaVersion: 'scriptledger.capture-manifest.v1' as const,
      normalizationVersion: NORMALIZATION_VERSION,
      observedAt,
      timestampMeaning: 'capture_started' as const,
      source: 'operator_config' as const,
      state: completeness === 'complete' ? 'success' as const : 'partial' as const,
      completeness,
      truncation: { truncated: completeness !== 'complete' },
      captureId: `capture:${observedAt.replaceAll(/[^0-9]/gu, '').slice(0, 14)}`,
      targetId: 'fixture-site',
      collectorVersion: '0.1.0',
      browserName: 'chromium' as const,
      browserVersion: 'fixture',
      configurationHash: canonicalHash({ target: 'fixture-site' }),
      routeSetHash: canonicalHash(['/']),
      routesRequested: 1,
      routesCompleted: completeness === 'complete' ? 1 : 0,
      limitsReached: completeness === 'complete' ? [] : ['fixture limit'],
    },
    pages: [{
      ...envelope(observedAt, completeness, 'browser_network'),
      schemaVersion: 'scriptledger.page-observation.v1' as const,
      pageId,
      targetId: 'fixture-site',
      route: '/',
      finalDestination: toUrlEvidence('https://owned.example/', true),
      redirectCount: 0,
      requests,
      resources: [{
        ...envelope(observedAt, completeness, 'browser_network'),
        schemaVersion: 'scriptledger.resource-observation.v1' as const,
        resourceId: 'resource:app',
        pageId,
        requestId: 'request:app',
        kind: 'script' as const,
        destination: resourceDestination,
        responseStatus: 200,
        integrity,
      }],
      scripts: scriptDestination ? [{
        ...envelope(observedAt, completeness, 'browser_dom'),
        schemaVersion: 'scriptledger.script-observation.v1' as const,
        scriptId: 'script:app',
        pageId,
        destination: scriptDestination,
        inline: false,
        module: false,
        async: false,
        defer: false,
        ...(options.sri ? { integrityAttribute: options.sri } : {}),
      }] : [],
      frames: options.iframeOrigin ? [{
        ...envelope(observedAt, completeness, 'browser_dom'),
        schemaVersion: 'scriptledger.frame-observation.v1' as const,
        frameId: 'frame:one',
        pageId,
        destination: toUrlEvidence(`${options.iframeOrigin}/frame`, true),
        namePresent: false,
        sandboxTokens: [],
      }] : [],
      workers: options.workerOrigin ? [{
        ...envelope(observedAt, completeness, 'browser_network'),
        schemaVersion: 'scriptledger.worker-observation.v1' as const,
        workerId: 'worker:one',
        pageId,
        workerType: 'dedicated' as const,
        destination: toUrlEvidence(`${options.workerOrigin}/worker.js`, true),
        blockedByPolicy: false,
      }] : [],
      websockets: options.websocketOrigin ? [{
        ...envelope(observedAt, completeness, 'browser_network'),
        schemaVersion: 'scriptledger.websocket-observation.v1' as const,
        websocketId: 'websocket:one',
        pageId,
        destination: toUrlEvidence(`${options.websocketOrigin}/socket`, true),
        framesRetained: false as const,
      }] : [],
      policies,
      popupAttempts: 0,
      requestCount: requests.length,
      retainedObservationBytes: 4_096,
      limitations: completeness === 'complete' ? [] : ['Fixture capture is partial.'],
    }],
    components: component ? [component] : [],
    vulnerabilities: options.vulnerabilityId && component ? [{
      ...envelope(observedAt, completeness, 'osv'),
      schemaVersion: 'scriptledger.vulnerability-observation.v1' as const,
      vulnerabilityId: `vulnerability:${options.vulnerabilityId}`,
      componentId: component.componentId,
      advisoryId: options.vulnerabilityId,
      affected: true,
      lookupState: 'matched' as const,
      database: 'OSV' as const,
    }] : [],
    dependencyEdges: [],
  };
  return CaptureSnapshotSchema.parse(snapshot);
}
