import {
  NORMALIZATION_VERSION,
  type CaptureSnapshot,
  type ChangeEvent,
  type PageObservation,
  type ResourceObservation,
} from '../contracts/index.js';
import { canonicalHash } from '../storage/canonical.js';
import { addedSources, constraintRemoved, containsSource, parseCsp, serializeCsp } from '../policies/csp.js';

const DETECTOR_VERSION = 'scriptledger.diff.v1';

export interface ComparisonResult {
  state: 'success' | 'partial' | 'incompatible';
  events: ChangeEvent[];
  limitations: string[];
}

interface EventInput {
  eventType: ChangeEvent['eventType'];
  route: string;
  before?: unknown;
  after?: unknown;
  reason: string;
  evidenceReferences: string[];
  complete: boolean;
}

function event(
  input: EventInput,
  currentObservedAt: string,
  previousObservedAt: string,
): ChangeEvent {
  const identity = canonicalHash({
    eventType: input.eventType,
    route: input.route,
    before: input.before,
    after: input.after,
    evidenceReferences: input.evidenceReferences,
  }).slice(7, 31);
  return {
    schemaVersion: 'scriptledger.change-event.v1',
    normalizationVersion: NORMALIZATION_VERSION,
    observedAt: currentObservedAt,
    timestampMeaning: 'first_observed',
    source: 'derived',
    state: input.complete ? 'success' : 'partial',
    completeness: input.complete ? 'complete' : 'partial',
    truncation: { truncated: false },
    eventId: `event:${identity}`,
    eventType: input.eventType,
    route: input.route,
    ...(input.before === undefined ? {} : { before: input.before }),
    ...(input.after === undefined ? {} : { after: input.after }),
    reason: input.reason,
    evidenceReferences: input.evidenceReferences,
    comparisonCompleteness: input.complete ? 'complete' : 'downgraded',
    detectorVersion: DETECTOR_VERSION,
    firstObservedAt: currentObservedAt,
    previousComparableObservedAt: previousObservedAt,
  };
}

function mapBy<T>(values: readonly T[], key: (entry: T) => string): Map<string, T> {
  return new Map(values.map((entry) => [key(entry), entry]));
}

function pageComplete(page: PageObservation): boolean {
  return page.completeness === 'complete' && !page.truncation.truncated && page.state === 'success';
}

function thirdPartyOrigins(page: PageObservation): Map<string, string[]> {
  const origins = new Map<string, string[]>();
  for (const request of page.requests) {
    if (request.classification !== 'third_party') continue;
    const references = origins.get(request.destination.origin) ?? [];
    references.push(request.requestId);
    origins.set(request.destination.origin, references);
  }
  return origins;
}

function resourcesByStableUrl(page: PageObservation): Map<string, ResourceObservation> {
  return mapBy(page.resources, (resource) => `${resource.destination.origin}|${resource.destination.pathHash}`);
}

function policyValue(page: PageObservation, type: 'content-security-policy' | 'content-security-policy-report-only') {
  return page.policies.find((policy) => policy.policyType === type && policy.present)?.value;
}

function comparePage(
  before: PageObservation,
  after: PageObservation,
  currentObservedAt: string,
  previousObservedAt: string,
): ChangeEvent[] {
  const output: ChangeEvent[] = [];
  const complete = pageComplete(before) && pageComplete(after);
  const add = (input: EventInput) => output.push(event({ ...input, complete }, currentObservedAt, previousObservedAt));

  const beforeOrigins = thirdPartyOrigins(before);
  const afterOrigins = thirdPartyOrigins(after);
  for (const [origin, references] of afterOrigins) {
    if (!beforeOrigins.has(origin)) add({ eventType: 'third_party_origin_added', route: after.route, after: origin, reason: 'A third-party origin was first observed on this route.', evidenceReferences: references, complete });
  }
  if (complete) {
    for (const [origin, references] of beforeOrigins) {
      if (!afterOrigins.has(origin)) add({ eventType: 'third_party_origin_removed', route: after.route, before: origin, reason: 'A previously observed third-party origin was not present in two complete comparable captures.', evidenceReferences: references, complete });
    }
  }

  const beforeScripts = mapBy(before.scripts.filter((script) => script.destination), (script) => `${script.destination?.origin}|${script.destination?.pathHash}`);
  const afterScripts = mapBy(after.scripts.filter((script) => script.destination), (script) => `${script.destination?.origin}|${script.destination?.pathHash}`);
  for (const [key, script] of afterScripts) {
    if (!beforeScripts.has(key) && script.destination && afterOrigins.has(script.destination.origin)) {
      add({ eventType: 'third_party_script_added', route: after.route, after: script.destination, reason: 'A new executable script was observed from a third-party origin.', evidenceReferences: [script.scriptId], complete });
    }
  }
  const beforeScriptByPath = mapBy([...beforeScripts.values()], (script) => script.destination?.pathHash ?? script.scriptId);
  for (const script of afterScripts.values()) {
    const prior = beforeScriptByPath.get(script.destination?.pathHash ?? '');
    if (prior?.destination && script.destination && prior.destination.origin !== script.destination.origin) {
      add({ eventType: 'script_origin_changed', route: after.route, before: prior.destination.origin, after: script.destination.origin, reason: 'A stable script path hash was observed on a different origin.', evidenceReferences: [prior.scriptId, script.scriptId], complete });
    }
  }

  const oldResources = resourcesByStableUrl(before);
  const newResources = resourcesByStableUrl(after);
  for (const [key, resource] of newResources) {
    const prior = oldResources.get(key);
    const beforeHash = prior?.integrity?.hashState === 'complete' ? prior.integrity.contentHash : undefined;
    const afterHash = resource.integrity?.hashState === 'complete' ? resource.integrity.contentHash : undefined;
    if (prior && beforeHash && afterHash && beforeHash !== afterHash) {
      add({ eventType: 'resource_content_changed', route: after.route, before: beforeHash, after: afterHash, reason: 'The same normalized resource URL served different completely captured content.', evidenceReferences: [prior.resourceId, resource.resourceId], complete });
    }
    const beforeSri = prior?.integrity?.integrityAttribute;
    const afterSri = resource.integrity?.integrityAttribute;
    if (!beforeSri && afterSri) add({ eventType: 'sri_added', route: after.route, after: afterSri, reason: 'An integrity attribute was added to a stable resource.', evidenceReferences: [resource.resourceId], complete });
    if (complete && beforeSri && !afterSri) add({ eventType: 'sri_removed', route: after.route, before: beforeSri, reason: 'An integrity attribute was removed from a stable eligible resource.', evidenceReferences: [prior.resourceId, resource.resourceId], complete });
  }

  const collectionAdditions: Array<{
    eventType: ChangeEvent['eventType'];
    oldKeys: Set<string>;
    newValues: Map<string, string>;
    reason: string;
  }> = [
    { eventType: 'iframe_added', oldKeys: new Set(before.frames.filter((entry) => entry.destination).map((entry) => `${entry.destination?.origin}|${entry.destination?.pathHash}`)), newValues: new Map(after.frames.filter((entry) => entry.destination).map((entry) => [`${entry.destination?.origin}|${entry.destination?.pathHash}`, entry.frameId])), reason: 'A new iframe destination was observed.' },
    { eventType: 'worker_added', oldKeys: new Set(before.workers.filter((entry) => entry.destination).map((entry) => `${entry.destination?.origin}|${entry.destination?.pathHash}`)), newValues: new Map(after.workers.filter((entry) => entry.destination).map((entry) => [`${entry.destination?.origin}|${entry.destination?.pathHash}`, entry.workerId])), reason: 'A new worker destination was observed.' },
    { eventType: 'websocket_destination_added', oldKeys: new Set(before.websockets.map((entry) => entry.destination.origin)), newValues: new Map(after.websockets.map((entry) => [entry.destination.origin, entry.websocketId])), reason: 'A new WebSocket destination was observed without retaining frame content.' },
  ];
  for (const collection of collectionAdditions) {
    for (const [key, value] of collection.newValues) {
      if (!collection.oldKeys.has(key)) add({ eventType: collection.eventType, route: after.route, after: key, reason: collection.reason, evidenceReferences: [value], complete });
    }
  }

  const oldEnforced = policyValue(before, 'content-security-policy');
  const newEnforced = policyValue(after, 'content-security-policy');
  const oldReportOnly = policyValue(before, 'content-security-policy-report-only');
  const newReportOnly = policyValue(after, 'content-security-policy-report-only');
  const policyReferences = [...new Set([...before.policies, ...after.policies]
    .filter((policy) => policy.policyType.startsWith('content-security-policy'))
    .map((policy) => `${policy.pageId}:${policy.policyType}`))];
  if (!oldEnforced && newEnforced) add({ eventType: 'csp_added', route: after.route, after: serializeCsp(parseCsp(newEnforced)), reason: 'An enforced Content Security Policy was added.', evidenceReferences: policyReferences, complete });
  if (complete && oldEnforced && !newEnforced) add({ eventType: 'csp_removed', route: after.route, before: serializeCsp(parseCsp(oldEnforced)), reason: 'An enforced Content Security Policy was removed.', evidenceReferences: policyReferences, complete });
  if (oldEnforced && !newEnforced && newReportOnly && newReportOnly !== oldReportOnly) add({ eventType: 'csp_enforcement_replaced_by_report_only', route: after.route, before: oldEnforced, after: newReportOnly, reason: 'CSP enforcement was replaced by report-only delivery.', evidenceReferences: policyReferences, complete });
  if (oldEnforced && newEnforced) {
    const oldPolicy = parseCsp(oldEnforced);
    const newPolicy = parseCsp(newEnforced);
    const sources = addedSources(oldPolicy, newPolicy, 'script-src');
    if (sources.length) add({ eventType: 'csp_script_source_added', route: after.route, before: oldPolicy.get('script-src'), after: newPolicy.get('script-src'), reason: `script-src gained ${sources.join(', ')}.`, evidenceReferences: policyReferences, complete });
    if (!containsSource(oldPolicy, 'script-src', "'unsafe-inline'") && containsSource(newPolicy, 'script-src', "'unsafe-inline'")) add({ eventType: 'csp_unsafe_inline_introduced', route: after.route, after: "'unsafe-inline'", reason: "script-src introduced 'unsafe-inline'.", evidenceReferences: policyReferences, complete });
    if (!containsSource(oldPolicy, 'script-src', "'unsafe-eval'") && containsSource(newPolicy, 'script-src', "'unsafe-eval'")) add({ eventType: 'csp_unsafe_eval_introduced', route: after.route, after: "'unsafe-eval'", reason: "script-src introduced 'unsafe-eval'.", evidenceReferences: policyReferences, complete });
    for (const [directive, eventType, reason] of [
      ['object-src', 'csp_object_none_removed', "object-src 'none' was removed."],
      ['frame-ancestors', 'csp_frame_ancestors_weakened', "frame-ancestors 'none' was removed."],
      ['base-uri', 'csp_base_uri_weakened', "base-uri 'none' was removed."],
    ] as const) {
      if (constraintRemoved(oldPolicy, newPolicy, directive, "'none'")) add({ eventType, route: after.route, before: "'none'", after: newPolicy.get(directive), reason, evidenceReferences: policyReferences, complete });
    }
  }
  return output;
}

export function compareSnapshots(before: CaptureSnapshot, after: CaptureSnapshot): ComparisonResult {
  const limitations: string[] = [];
  if (before.schemaVersion !== after.schemaVersion || before.normalizationVersion !== after.normalizationVersion) {
    return { state: 'incompatible', events: [], limitations: ['Snapshot schema or normalization versions are incompatible.'] };
  }
  if (before.manifest.routeSetHash !== after.manifest.routeSetHash) limitations.push('Configured route sets differ; route-level comparisons are partial.');
  if (before.completeness !== 'complete' || after.completeness !== 'complete') limitations.push('At least one capture is partial; removals are suppressed for affected routes.');
  const previousPages = mapBy(before.pages, (page) => page.route);
  const events: ChangeEvent[] = [];
  for (const page of after.pages) {
    const previous = previousPages.get(page.route);
    if (!previous) {
      limitations.push(`Route ${page.route} has no previous comparable observation.`);
      continue;
    }
    events.push(...comparePage(previous, page, after.observedAt, before.observedAt));
  }

  const beforeComponents = mapBy(before.components, (component) => component.component);
  for (const component of after.components) {
    const previous = beforeComponents.get(component.component);
    if (previous?.version && component.version && previous.version !== component.version) {
      events.push(event({ eventType: 'component_version_changed', route: '/', before: previous.version, after: component.version, reason: `The identified ${component.component} version changed.`, evidenceReferences: [previous.componentId, component.componentId], complete: before.completeness === 'complete' && after.completeness === 'complete' }, after.observedAt, before.observedAt));
    }
  }

  const beforeVulnerabilities = mapBy(before.vulnerabilities.filter((item) => item.affected), (item) => item.advisoryId);
  const afterVulnerabilities = mapBy(after.vulnerabilities.filter((item) => item.affected), (item) => item.advisoryId);
  for (const [id, vulnerability] of afterVulnerabilities) {
    if (!beforeVulnerabilities.has(id)) events.push(event({ eventType: 'vulnerability_appeared', route: '/', after: id, reason: 'A known vulnerability was identified for a high-confidence component match.', evidenceReferences: [vulnerability.vulnerabilityId], complete: true }, after.observedAt, before.observedAt));
  }
  if (before.completeness === 'complete' && after.completeness === 'complete') {
    for (const [id, vulnerability] of beforeVulnerabilities) {
      if (!afterVulnerabilities.has(id)) events.push(event({ eventType: 'vulnerability_disappeared', route: '/', before: id, reason: 'A previously identified vulnerability was not present in the current complete component results.', evidenceReferences: [vulnerability.vulnerabilityId], complete: true }, after.observedAt, before.observedAt));
    }
  }
  events.sort((left, right) => `${left.route}:${left.eventType}:${left.eventId}`.localeCompare(`${right.route}:${right.eventType}:${right.eventId}`));
  return { state: limitations.length ? 'partial' : 'success', events, limitations };
}
