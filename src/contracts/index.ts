import { z } from 'zod';

export const NORMALIZATION_VERSION = '2026-07-20.1' as const;

export const LIMITS = {
  targets: 16,
  routes: 32,
  requestsPerRoute: 500,
  observationsPerCategory: 1_000,
  evidenceReferences: 32,
  string: 2_048,
  shortString: 256,
  headerValue: 8_192,
  reportEvents: 2_000,
  totalObservationBytes: 50 * 1024 * 1024,
} as const;

export const ResultStateSchema = z.enum([
  'success',
  'partial',
  'skipped',
  'unsupported',
  'blocked',
  'timed_out',
  'budget_exhausted',
  'invalid',
  'failed',
]);

export const CompletenessSchema = z.enum([
  'complete',
  'partial',
  'not_observed',
  'incompatible',
]);

export const TimestampMeaningSchema = z.enum([
  'capture_started',
  'first_observed',
  'response_observed',
  'report_generated',
  'previous_comparable_observation',
]);

export const ObservationSourceSchema = z.enum([
  'operator_config',
  'browser_network',
  'browser_dom',
  'response_header',
  'meta_element',
  'derived',
  'retire_js',
  'osv',
  'synthetic_fixture',
]);

export const TruncationSchema = z
  .object({
    truncated: z.boolean(),
    reason: z.string().max(LIMITS.shortString).optional(),
    originalCount: z.number().int().nonnegative().optional(),
    retainedCount: z.number().int().nonnegative().optional(),
  })
  .strict();

export const EvidenceEnvelopeSchema = z
  .object({
    schemaVersion: z.string().min(1).max(64),
    normalizationVersion: z.literal(NORMALIZATION_VERSION),
    observedAt: z.iso.datetime(),
    timestampMeaning: TimestampMeaningSchema,
    source: ObservationSourceSchema,
    state: ResultStateSchema,
    completeness: CompletenessSchema,
    truncation: TruncationSchema,
  })
  .strict();

const identifier = z.string().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const boundedString = z.string().max(LIMITS.string);
const shortString = z.string().max(LIMITS.shortString);

export const UrlEvidenceSchema = z
  .object({
    scheme: z.enum(['http', 'https', 'ws', 'wss']),
    origin: z.string().min(1).max(512),
    path: z.string().min(1).max(1_024).optional(),
    pathHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    queryRedacted: z.boolean(),
    fragmentRedacted: z.boolean(),
  })
  .strict();

export const NetworkClassificationSchema = z.enum([
  'first_party_origin',
  'related_first_party_origin',
  'configured_partner',
  'third_party',
  'ip_literal',
  'unknown',
]);

export const TargetBudgetsSchema = z
  .object({
    maxNavigations: z.number().int().min(1).max(LIMITS.routes),
    maxRequestsPerRoute: z.number().int().min(1).max(LIMITS.requestsPerRoute),
    maxRedirects: z.number().int().min(0).max(10),
    maxPageLifetimeMs: z.number().int().min(1_000).max(120_000),
    maxTotalObservationBytes: z.number().int().min(1_024).max(LIMITS.totalObservationBytes),
  })
  .strict();

const exactHttpsOrigin = z.url().superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== 'https:') context.addIssue({ code: 'custom', message: 'Origin must use HTTPS' });
  if (url.username || url.password) context.addIssue({ code: 'custom', message: 'Credentials are prohibited' });
  if (url.pathname !== '/' || url.search || url.hash) {
    context.addIssue({ code: 'custom', message: 'Origin must not include a path, query, or fragment' });
  }
});

const queryFreeRoute = z.string().min(1).max(1_024).superRefine((value, context) => {
  if (!value.startsWith('/') || value.startsWith('//')) {
    context.addIssue({ code: 'custom', message: 'Route must be an absolute path' });
  }
  if (value.includes('*') || value.includes('?') || value.includes('#') || /[\u0000-\u001f\u007f]/u.test(value)) {
    context.addIssue({ code: 'custom', message: 'Route must be query-free and contain no control characters' });
  }
});

export const TargetConfigSchema = z
  .object({
    id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]*$/),
    origin: exactHttpsOrigin,
    authorizationConfirmed: z.literal(true),
    routes: z.array(queryFreeRoute).min(1).max(LIMITS.routes),
    budgets: TargetBudgetsSchema,
    retainQueryFreePaths: z.boolean(),
    allowSameOriginHttpFallback: z.boolean(),
    expectedFirstPartyRegistrableDomains: z
      .array(z.string().min(1).max(253).regex(/^[a-z0-9.-]+$/i))
      .max(16)
      .default([]),
    configuredPartnerOrigins: z.array(z.url()).max(32).default([]),
  })
  .strict();

export const CaptureConfigSchema = z
  .object({
    schemaVersion: z.literal('scriptledger.capture-config.v1'),
    normalizationVersion: z.literal(NORMALIZATION_VERSION),
    targets: z.array(TargetConfigSchema).min(1).max(LIMITS.targets),
  })
  .strict();

export const RequestObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.request-observation.v1'),
  requestId: identifier,
  pageId: identifier,
  method: z.enum(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', 'OTHER']),
  resourceType: shortString,
  destination: UrlEvidenceSchema,
  registrableDomain: z.string().max(253).nullable(),
  classification: NetworkClassificationSchema,
  redirectedFromRequestId: identifier.optional(),
  initiatorRequestId: identifier.optional(),
  responseStatus: z.number().int().min(100).max(599).optional(),
  mimeType: shortString.optional(),
  transferredBytes: z.number().int().nonnegative().optional(),
  blockedReason: shortString.optional(),
}).strict();

export const IntegrityObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.integrity-observation.v1'),
  resourceId: identifier,
  integrityAttribute: boundedString.optional(),
  crossoriginAttribute: shortString.optional(),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  hashState: z.enum(['complete', 'prefix_only', 'not_captured', 'ineligible']),
  eligibilityReason: shortString,
}).strict();

export const ResourceObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.resource-observation.v1'),
  resourceId: identifier,
  pageId: identifier,
  requestId: identifier,
  kind: z.enum(['document', 'script', 'stylesheet', 'image', 'font', 'media', 'other']),
  destination: UrlEvidenceSchema,
  mimeType: shortString.optional(),
  responseStatus: z.number().int().min(100).max(599).optional(),
  transferredBytes: z.number().int().nonnegative().optional(),
  integrity: IntegrityObservationSchema.optional(),
}).strict();

export const ScriptObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.script-observation.v1'),
  scriptId: identifier,
  pageId: identifier,
  requestId: identifier.optional(),
  destination: UrlEvidenceSchema.optional(),
  inline: z.boolean(),
  module: z.boolean(),
  async: z.boolean(),
  defer: z.boolean(),
  integrityAttribute: boundedString.optional(),
  crossoriginAttribute: shortString.optional(),
}).strict();

export const FrameObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.frame-observation.v1'),
  frameId: identifier,
  pageId: identifier,
  destination: UrlEvidenceSchema.optional(),
  namePresent: z.boolean(),
  sandboxTokens: z.array(shortString).max(32),
}).strict();

export const WorkerObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.worker-observation.v1'),
  workerId: identifier,
  pageId: identifier,
  workerType: z.enum(['dedicated', 'shared', 'service_worker_registration_attempt']),
  destination: UrlEvidenceSchema.optional(),
  blockedByPolicy: z.boolean(),
}).strict();

export const WebSocketObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.websocket-observation.v1'),
  websocketId: identifier,
  pageId: identifier,
  destination: UrlEvidenceSchema,
  framesRetained: z.literal(false),
}).strict();

export const PolicyObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.policy-observation.v1'),
  pageId: identifier,
  policyType: z.enum([
    'content-security-policy',
    'content-security-policy-report-only',
    'referrer-policy',
    'permissions-policy',
    'strict-transport-security',
    'x-content-type-options',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
  ]),
  delivery: z.enum(['response_header', 'meta_element']),
  value: z.string().max(LIMITS.headerValue).optional(),
  present: z.boolean(),
}).strict();

export const PageObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.page-observation.v1'),
  pageId: identifier,
  targetId: identifier,
  route: queryFreeRoute,
  finalDestination: UrlEvidenceSchema.optional(),
  redirectCount: z.number().int().nonnegative().max(10),
  requests: z.array(RequestObservationSchema).max(LIMITS.observationsPerCategory),
  resources: z.array(ResourceObservationSchema).max(LIMITS.observationsPerCategory),
  scripts: z.array(ScriptObservationSchema).max(LIMITS.observationsPerCategory),
  frames: z.array(FrameObservationSchema).max(LIMITS.observationsPerCategory),
  workers: z.array(WorkerObservationSchema).max(LIMITS.observationsPerCategory),
  websockets: z.array(WebSocketObservationSchema).max(LIMITS.observationsPerCategory),
  policies: z.array(PolicyObservationSchema).max(64),
  popupAttempts: z.number().int().nonnegative().max(100),
  requestCount: z.number().int().nonnegative(),
  retainedObservationBytes: z.number().int().nonnegative(),
  limitations: z.array(shortString).max(32),
}).strict();

export const ComponentIdentificationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.component-identification.v1'),
  componentId: identifier,
  resourceId: identifier,
  detector: z.literal('retire.js'),
  detectorVersion: shortString,
  identificationMethod: z.enum(['content_signature', 'uri_pattern', 'metadata', 'combined']),
  component: shortString,
  version: shortString.optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  evidenceType: shortString,
  limitations: z.array(shortString).max(8),
}).strict();

export const VulnerabilityObservationSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.vulnerability-observation.v1'),
  vulnerabilityId: identifier,
  componentId: identifier,
  advisoryId: shortString,
  summary: boundedString.optional(),
  affected: z.boolean(),
  lookupState: z.enum(['matched', 'no_known_vulnerability', 'unavailable', 'disabled']),
  database: z.literal('OSV'),
}).strict();

export const DependencyEdgeSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.dependency-edge.v1'),
  edgeId: identifier,
  pageId: identifier,
  from: identifier,
  to: identifier,
  relationship: z.enum(['requested', 'redirected_to', 'embedded_frame', 'created_worker', 'opened_websocket']),
  evidenceReferences: z.array(identifier).min(1).max(LIMITS.evidenceReferences),
}).strict();

export const CaptureManifestSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.capture-manifest.v1'),
  captureId: identifier,
  targetId: identifier,
  collectorVersion: shortString,
  browserName: z.literal('chromium'),
  browserVersion: shortString,
  configurationHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  routeSetHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  routesRequested: z.number().int().nonnegative(),
  routesCompleted: z.number().int().nonnegative(),
  limitsReached: z.array(shortString).max(32),
}).strict();

export const CaptureSnapshotSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.capture-snapshot.v1'),
  manifest: CaptureManifestSchema,
  pages: z.array(PageObservationSchema).max(LIMITS.routes),
  components: z.array(ComponentIdentificationSchema).max(LIMITS.observationsPerCategory),
  vulnerabilities: z.array(VulnerabilityObservationSchema).max(LIMITS.observationsPerCategory),
  dependencyEdges: z.array(DependencyEdgeSchema).max(LIMITS.observationsPerCategory),
}).strict();

export const ChangeEventTypeSchema = z.enum([
  'third_party_origin_added',
  'third_party_origin_removed',
  'third_party_script_added',
  'script_origin_changed',
  'resource_content_changed',
  'iframe_added',
  'worker_added',
  'websocket_destination_added',
  'csp_added',
  'csp_removed',
  'csp_enforcement_replaced_by_report_only',
  'csp_script_source_added',
  'csp_unsafe_inline_introduced',
  'csp_unsafe_eval_introduced',
  'csp_object_none_removed',
  'csp_frame_ancestors_weakened',
  'csp_base_uri_weakened',
  'sri_added',
  'sri_removed',
  'component_version_changed',
  'vulnerability_appeared',
  'vulnerability_disappeared',
]);

export const ChangeEventSchema = EvidenceEnvelopeSchema.extend({
  schemaVersion: z.literal('scriptledger.change-event.v1'),
  eventId: identifier,
  eventType: ChangeEventTypeSchema,
  route: queryFreeRoute,
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  reason: boundedString,
  evidenceReferences: z.array(identifier).min(1).max(LIMITS.evidenceReferences),
  comparisonCompleteness: z.enum(['complete', 'downgraded', 'incompatible']),
  detectorVersion: shortString,
  firstObservedAt: z.iso.datetime(),
  previousComparableObservedAt: z.iso.datetime(),
}).strict();

export const PublicReportSchema = z
  .object({
    schemaVersion: z.literal('scriptledger.public-report.v1'),
    normalizationVersion: z.literal(NORMALIZATION_VERSION),
    generatedAt: z.iso.datetime(),
    timestampMeaning: z.literal('report_generated'),
    source: z.enum(['synthetic_fixture', 'curated_authorized_capture']),
    synthetic: z.boolean(),
    completeness: CompletenessSchema,
    truncation: TruncationSchema,
    title: shortString,
    summary: boundedString,
    capture: CaptureSnapshotSchema,
    comparisonEvents: z.array(ChangeEventSchema).max(LIMITS.reportEvents),
    methodologyVersion: shortString,
    limitations: z.array(boundedString).max(64),
  })
  .strict();

export type CaptureConfig = z.infer<typeof CaptureConfigSchema>;
export type TargetConfig = z.infer<typeof TargetConfigSchema>;
export type CaptureManifest = z.infer<typeof CaptureManifestSchema>;
export type PageObservation = z.infer<typeof PageObservationSchema>;
export type RequestObservation = z.infer<typeof RequestObservationSchema>;
export type ResourceObservation = z.infer<typeof ResourceObservationSchema>;
export type ScriptObservation = z.infer<typeof ScriptObservationSchema>;
export type FrameObservation = z.infer<typeof FrameObservationSchema>;
export type WorkerObservation = z.infer<typeof WorkerObservationSchema>;
export type WebSocketObservation = z.infer<typeof WebSocketObservationSchema>;
export type PolicyObservation = z.infer<typeof PolicyObservationSchema>;
export type IntegrityObservation = z.infer<typeof IntegrityObservationSchema>;
export type ComponentIdentification = z.infer<typeof ComponentIdentificationSchema>;
export type VulnerabilityObservation = z.infer<typeof VulnerabilityObservationSchema>;
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;
export type CaptureSnapshot = z.infer<typeof CaptureSnapshotSchema>;
export type ChangeEvent = z.infer<typeof ChangeEventSchema>;
export type PublicReport = z.infer<typeof PublicReportSchema>;
export type ResultState = z.infer<typeof ResultStateSchema>;
export type Completeness = z.infer<typeof CompletenessSchema>;
export type UrlEvidence = z.infer<typeof UrlEvidenceSchema>;
