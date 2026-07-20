import { createHash } from 'node:crypto';
import { chromium, type Browser, type BrowserContext, type Page, type Request, type Response } from 'playwright';
import {
  NORMALIZATION_VERSION,
  type CaptureSnapshot,
  type ComponentIdentification,
  type DependencyEdge,
  type FrameObservation,
  type IntegrityObservation,
  type PageObservation,
  type PolicyObservation,
  type RequestObservation,
  type ResourceObservation,
  type ScriptObservation,
  type TargetConfig,
  type WorkerObservation,
  type WebSocketObservation,
} from '../contracts/index.js';
import { canonicalHash, canonicalizeSnapshot } from '../storage/canonical.js';
import {
  DestinationGuard,
  classifyDestination,
  registrableDomain,
  stripControlCharacters,
  toUrlEvidence,
  type DestinationGuardOptions,
} from '../security/url.js';
import { RetireAdapter } from '../security/retire-adapter.js';
import { validateNavigationRedirects, type RedirectProbe } from '../security/redirects.js';

export const COLLECTOR_VERSION = '0.1.0';
export const USER_AGENT = 'ScriptLedger/0.1 (+https://github.com/slicedearth/scriptledger; authorized-site-monitor)';
const HASH_BODY_LIMIT = 512 * 1024;

export interface CollectorOptions extends DestinationGuardOptions {
  browser?: Browser;
  now?: () => Date;
  redirectProbe?: RedirectProbe;
}

function base(observedAt: string, source: 'browser_network' | 'browser_dom' | 'response_header' | 'meta_element' | 'derived') {
  return {
    normalizationVersion: NORMALIZATION_VERSION,
    observedAt,
    timestampMeaning: source === 'response_header' ? 'response_observed' as const : 'first_observed' as const,
    source,
    state: 'success' as const,
    completeness: 'complete' as const,
    truncation: { truncated: false },
  };
}

function shortId(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex').slice(0, 20)}`;
}

function requestMethod(method: string): RequestObservation['method'] {
  const upper = method.toUpperCase();
  return ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(upper)
    ? upper as RequestObservation['method']
    : 'OTHER';
}

function eligibleResourceKind(resourceType: string): ResourceObservation['kind'] {
  if (resourceType === 'document') return 'document';
  if (resourceType === 'script') return 'script';
  if (resourceType === 'stylesheet') return 'stylesheet';
  if (resourceType === 'image') return 'image';
  if (resourceType === 'font') return 'font';
  if (resourceType === 'media') return 'media';
  return 'other';
}

function policy(
  pageId: string,
  observedAt: string,
  policyType: PolicyObservation['policyType'],
  delivery: PolicyObservation['delivery'],
  value: string | undefined,
): PolicyObservation {
  return {
    ...base(observedAt, delivery),
    schemaVersion: 'scriptledger.policy-observation.v1',
    pageId,
    policyType,
    delivery,
    ...(value === undefined ? {} : { value: stripControlCharacters(value, 8_192) }),
    present: value !== undefined,
  };
}

function isAllowedNavigation(url: URL, target: TargetConfig): boolean {
  const configured = new URL(target.origin);
  const sameHttpsOrigin = url.origin === configured.origin;
  const sameHttpFallback = target.allowSameOriginHttpFallback
    && url.protocol === 'http:'
    && url.hostname === configured.hostname
    && (url.port || '80') === '80';
  return (sameHttpsOrigin || sameHttpFallback) && target.routes.includes(url.pathname);
}

function observationBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function isTopLevelNavigation(request: Request, page: Page, initialUrl: string): boolean {
  if (!request.isNavigationRequest()) return false;
  try {
    return request.frame() === page.mainFrame();
  } catch {
    return request.url() === initialUrl;
  }
}

async function installSafetyHooks(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const deny = () => false;
    HTMLFormElement.prototype.submit = deny as unknown as typeof HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.requestSubmit = deny as unknown as typeof HTMLFormElement.prototype.requestSubmit;
    document.addEventListener('submit', (event) => event.preventDefault(), true);
    const root = globalThis as typeof globalThis & { __scriptledgerServiceWorkerAttempts?: string[] };
    root.__scriptledgerServiceWorkerAttempts = [];
    const recordServiceWorkerAttempt = (scriptURL: string | URL) => {
      root.__scriptledgerServiceWorkerAttempts?.push(String(scriptURL).slice(0, 2_048));
      return Promise.reject(new DOMException('Service workers are blocked by ScriptLedger', 'NotAllowedError'));
    };
    if ('ServiceWorkerContainer' in globalThis) {
      Object.defineProperty(ServiceWorkerContainer.prototype, 'register', { configurable: true, value: recordServiceWorkerAttempt });
    }
    try {
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: recordServiceWorkerAttempt } });
    } catch { /* Playwright still blocks the underlying service worker subsystem. */ }
  });
}

interface PageCollection {
  page: PageObservation;
  edges: DependencyEdge[];
  components: ComponentIdentification[];
}

async function collectPage(
  browser: Browser,
  target: TargetConfig,
  route: string,
  observedAt: string,
  guard: DestinationGuard,
  redirectProbe?: RedirectProbe,
): Promise<PageCollection> {
  const pageId = shortId('page', `${target.id}:${route}`);
  const requests: RequestObservation[] = [];
  const resources: ResourceObservation[] = [];
  const scripts: ScriptObservation[] = [];
  const frames: FrameObservation[] = [];
  const workers: WorkerObservation[] = [];
  const websockets: WebSocketObservation[] = [];
  const policies: PolicyObservation[] = [];
  const limitations: string[] = [];
  const edges: DependencyEdge[] = [];
  const components: ComponentIdentification[] = [];
  const retireAdapter = new RetireAdapter();
  const requestIds = new WeakMap<Request, string>();
  const requestKeys = new Map<string, string>();
  const resourceByUrl = new Map<string, ResourceObservation>();
  const pendingResponses = new Set<Promise<void>>();
  let popupAttempts = 0;
  let redirectCount = 0;
  let retainedObservationBytes = 0;
  let budgetReached = false;
  let timedOut = false;
  let navigationFailed = false;
  let totalNetworkRequests = 0;
  const navigationUrl = new URL(route, target.origin).toString();

  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: 'block',
    permissions: [],
    userAgent: USER_AGENT,
    viewport: { width: 1_280, height: 800 },
    javaScriptEnabled: true,
    bypassCSP: false,
  });
  await context.clearCookies();
  await context.clearPermissions();
  await installSafetyHooks(context);

  await context.route('**/*', async (intercepted) => {
    const request = intercepted.request();
    if (budgetReached) {
      await intercepted.abort('blockedbyclient');
      return;
    }
    totalNetworkRequests += 1;
    if (totalNetworkRequests > target.budgets.maxRequestsPerRoute) {
      budgetReached = true;
      limitations.push('Request budget exhausted.');
      await intercepted.abort('blockedbyclient');
      return;
    }
    const key = `${request.method()}:${request.resourceType()}:${request.url().split(/[?#]/u, 1)[0] ?? ''}`;
    const existing = requestKeys.get(key);
    const requestId = existing ?? shortId('request', `${pageId}:${key}`);
    requestIds.set(request, requestId);
    if (request.redirectedFrom()) redirectCount += 1;

    let state: RequestObservation['state'] = 'success';
    let completeness: RequestObservation['completeness'] = 'complete';
    let blockedReason: string | undefined;
    try {
      const checked = await guard.assertAllowed(request.url());
      if (isTopLevelNavigation(request, page, navigationUrl) && !isAllowedNavigation(checked, target)) {
        throw new Error('Navigation is outside the exact authorized route allowlist');
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method().toUpperCase())) {
        throw new Error('Non-idempotent browser requests are blocked');
      }
      if (redirectCount > target.budgets.maxRedirects) throw new Error('Redirect budget exhausted');
    } catch (error) {
      state = redirectCount > target.budgets.maxRedirects ? 'budget_exhausted' : 'blocked';
      completeness = 'partial';
      blockedReason = error instanceof Error ? stripControlCharacters(error.message, 256) : 'Request blocked';
      if (isTopLevelNavigation(request, page, navigationUrl)) navigationFailed = true;
    }

    if (!existing) {
      const destination = toUrlEvidence(request.url(), target.retainQueryFreePaths);
      const observation: RequestObservation = {
        ...base(observedAt, 'browser_network'),
        schemaVersion: 'scriptledger.request-observation.v1',
        requestId,
        pageId,
        method: requestMethod(request.method()),
        resourceType: stripControlCharacters(request.resourceType(), 256),
        destination,
        registrableDomain: registrableDomain(request.url()),
        classification: classifyDestination(request.url(), target),
        ...(request.redirectedFrom() ? { redirectedFromRequestId: requestIds.get(request.redirectedFrom()!) ?? shortId('request', request.redirectedFrom()!.url()) } : {}),
        state,
        completeness,
        truncation: { truncated: false },
        ...(blockedReason ? { blockedReason } : {}),
      };
      const bytes = observationBytes(observation);
      if (retainedObservationBytes + bytes > target.budgets.maxTotalObservationBytes) {
        budgetReached = true;
        limitations.push('Observation byte budget exhausted.');
        await intercepted.abort('blockedbyclient');
        return;
      }
      retainedObservationBytes += bytes;
      requests.push(observation);
      requestKeys.set(key, requestId);
      edges.push({
        ...base(observedAt, 'derived'),
        schemaVersion: 'scriptledger.dependency-edge.v1',
        edgeId: shortId('edge', `${pageId}:${destination.origin}`),
        pageId,
        from: pageId,
        to: shortId('origin', destination.origin),
        relationship: request.redirectedFrom() ? 'redirected_to' : 'requested',
        evidenceReferences: [requestId],
      });
    }

    if (blockedReason) await intercepted.abort('blockedbyclient');
    else await intercepted.continue();
  });

  const page = await context.newPage();
  page.on('dialog', (dialog) => void dialog.dismiss());
  page.on('popup', (popup) => {
    popupAttempts += 1;
    void popup.close();
  });
  page.on('worker', (worker) => {
    const destination = toUrlEvidence(worker.url(), target.retainQueryFreePaths);
    workers.push({
      ...base(observedAt, 'browser_network'),
      schemaVersion: 'scriptledger.worker-observation.v1',
      workerId: shortId('worker', `${pageId}:${destination.origin}:${destination.pathHash}`),
      pageId,
      workerType: 'dedicated',
      destination,
      blockedByPolicy: false,
    });
  });
  page.on('websocket', (socket) => {
    const destination = toUrlEvidence(socket.url(), target.retainQueryFreePaths);
    websockets.push({
      ...base(observedAt, 'browser_network'),
      schemaVersion: 'scriptledger.websocket-observation.v1',
      websocketId: shortId('websocket', `${pageId}:${destination.origin}:${destination.pathHash}`),
      pageId,
      destination,
      framesRetained: false,
    });
  });

  page.on('response', (response) => {
    const work = recordResponse(response).finally(() => pendingResponses.delete(work));
    pendingResponses.add(work);
  });

  async function recordResponse(response: Response): Promise<void> {
    const request = response.request();
    const requestId = requestIds.get(request);
    if (!requestId) return;
    const requestObservation = requests.find((entry) => entry.requestId === requestId);
    if (!requestObservation) return;
    const headers = await response.allHeaders();
    requestObservation.responseStatus = response.status();
    requestObservation.mimeType = stripControlCharacters((headers['content-type'] ?? '').split(';', 1)[0] ?? '', 256);
    const contentLength = Number.parseInt(headers['content-length'] ?? '', 10);
    if (Number.isFinite(contentLength) && contentLength >= 0) requestObservation.transferredBytes = contentLength;
    const destination = requestObservation.destination;
    const kind = eligibleResourceKind(request.resourceType());
    const resourceId = shortId('resource', `${pageId}:${destination.origin}:${destination.pathHash}:${kind}`);
    let integrity: IntegrityObservation | undefined;
    const sameOrigin = destination.origin === target.origin;
    const hashEligible = sameOrigin && (kind === 'script' || kind === 'stylesheet');
    if (hashEligible && Number.isFinite(contentLength) && contentLength >= 0 && contentLength <= HASH_BODY_LIMIT) {
      try {
        const body = await response.body();
        if (body.byteLength === contentLength) {
          if (kind === 'script') {
            components.push(...retireAdapter.identifyContent(body.toString('utf8'), resourceId, observedAt));
          }
          integrity = {
            ...base(observedAt, 'browser_network'),
            schemaVersion: 'scriptledger.integrity-observation.v1',
            resourceId,
            contentHash: `sha256:${createHash('sha256').update(body).digest('hex')}`,
            hashState: 'complete',
            eligibilityReason: 'Complete bounded first-party static resource body captured for hashing.',
          };
        }
      } catch {
        limitations.push(`Complete body unavailable for ${resourceId}.`);
      }
    }
    integrity ??= {
      ...base(observedAt, 'browser_network'),
      schemaVersion: 'scriptledger.integrity-observation.v1',
      resourceId,
      hashState: hashEligible ? 'not_captured' : 'ineligible',
      eligibilityReason: hashEligible ? 'Response size was unknown, oversized, or the complete body was unavailable.' : 'Only bounded first-party JavaScript and stylesheet bodies are eligible.',
    };
    const resource: ResourceObservation = {
      ...base(observedAt, 'browser_network'),
      schemaVersion: 'scriptledger.resource-observation.v1',
      resourceId,
      pageId,
      requestId,
      kind,
      destination,
      ...(requestObservation.mimeType ? { mimeType: requestObservation.mimeType } : {}),
      responseStatus: response.status(),
      ...(requestObservation.transferredBytes === undefined ? {} : { transferredBytes: requestObservation.transferredBytes }),
      integrity,
    };
    if (!resourceByUrl.has(response.url())) {
      const bytes = observationBytes(resource);
      if (retainedObservationBytes + bytes > target.budgets.maxTotalObservationBytes) {
        budgetReached = true;
        limitations.push('Observation byte budget exhausted.');
      } else {
        resources.push(resource);
        resourceByUrl.set(response.url(), resource);
        retainedObservationBytes += bytes;
        if (kind === 'script') components.push(...retireAdapter.identifyUri(response.url(), resourceId, observedAt));
      }
    }
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      const securityHeaders: Array<[PolicyObservation['policyType'], string]> = [
        ['content-security-policy', 'content-security-policy'],
        ['content-security-policy-report-only', 'content-security-policy-report-only'],
        ['referrer-policy', 'referrer-policy'],
        ['permissions-policy', 'permissions-policy'],
        ['strict-transport-security', 'strict-transport-security'],
        ['x-content-type-options', 'x-content-type-options'],
        ['cross-origin-opener-policy', 'cross-origin-opener-policy'],
        ['cross-origin-resource-policy', 'cross-origin-resource-policy'],
      ];
      for (const [type, name] of securityHeaders) policies.push(policy(pageId, observedAt, type, 'response_header', headers[name]));
    }
  }

  try {
    await validateNavigationRedirects(navigationUrl, target, guard, redirectProbe);
    await page.goto(navigationUrl, { waitUntil: 'domcontentloaded', timeout: target.budgets.maxPageLifetimeMs });
    await page.waitForLoadState('networkidle', { timeout: Math.min(2_000, target.budgets.maxPageLifetimeMs) }).catch(() => undefined);
    await Promise.allSettled([...pendingResponses]);
  } catch (error) {
    timedOut = error instanceof Error && /timeout/iu.test(error.message);
    navigationFailed = true;
    limitations.push(timedOut ? 'Page lifetime budget exhausted.' : `Navigation failed: ${stripControlCharacters(error instanceof Error ? error.message : 'unknown error', 256)}`);
  }

  if (!page.isClosed() && !navigationFailed) {
    const domScripts = await page.locator('script').evaluateAll((elements) => elements.map((element) => ({
      src: element.getAttribute('src'),
      type: element.getAttribute('type'),
      async: element.hasAttribute('async'),
      defer: element.hasAttribute('defer'),
      integrity: element.getAttribute('integrity'),
      crossorigin: element.getAttribute('crossorigin'),
    })));
    for (const [index, script] of domScripts.slice(0, 1_000).entries()) {
      const resolved = script.src ? new URL(script.src, page.url()).toString() : undefined;
      let destination;
      try { destination = resolved ? toUrlEvidence(resolved, target.retainQueryFreePaths) : undefined; } catch { destination = undefined; }
      const scriptId = shortId('script', `${pageId}:${destination?.origin ?? 'inline'}:${destination?.pathHash ?? index}`);
      const resource = resolved ? resourceByUrl.get(resolved) : undefined;
      if (resource?.integrity) {
        if (script.integrity) resource.integrity.integrityAttribute = stripControlCharacters(script.integrity, 2_048);
        if (script.crossorigin) resource.integrity.crossoriginAttribute = stripControlCharacters(script.crossorigin, 256);
      }
      scripts.push({
        ...base(observedAt, 'browser_dom'),
        schemaVersion: 'scriptledger.script-observation.v1',
        scriptId,
        pageId,
        ...(resource ? { requestId: resource.requestId } : {}),
        ...(destination ? { destination } : {}),
        inline: !script.src,
        module: script.type === 'module',
        async: script.async,
        defer: script.defer,
        ...(script.integrity ? { integrityAttribute: stripControlCharacters(script.integrity, 2_048) } : {}),
        ...(script.crossorigin ? { crossoriginAttribute: stripControlCharacters(script.crossorigin, 256) } : {}),
      });
    }

    const stylesheetData = await page.locator('link[rel~="stylesheet"]').evaluateAll((elements) => elements.map((element) => ({
      href: element.getAttribute('href'),
      integrity: element.getAttribute('integrity'),
      crossorigin: element.getAttribute('crossorigin'),
    })));
    for (const stylesheet of stylesheetData.slice(0, 1_000)) {
      if (!stylesheet.href) continue;
      const resolved = new URL(stylesheet.href, page.url()).toString();
      const resource = resourceByUrl.get(resolved);
      if (resource?.integrity) {
        if (stylesheet.integrity) resource.integrity.integrityAttribute = stripControlCharacters(stylesheet.integrity, 2_048);
        if (stylesheet.crossorigin) resource.integrity.crossoriginAttribute = stripControlCharacters(stylesheet.crossorigin, 256);
      }
    }

    for (const [index, frame] of page.frames().filter((candidate) => candidate !== page.mainFrame()).slice(0, 1_000).entries()) {
      const url = frame.url();
      let destination;
      try { destination = url && url !== 'about:blank' ? toUrlEvidence(url, target.retainQueryFreePaths) : undefined; } catch { destination = undefined; }
      frames.push({
        ...base(observedAt, 'browser_dom'),
        schemaVersion: 'scriptledger.frame-observation.v1',
        frameId: shortId('frame', `${pageId}:${destination?.origin ?? 'blank'}:${destination?.pathHash ?? index}`),
        pageId,
        ...(destination ? { destination } : {}),
        namePresent: Boolean(frame.name()),
        sandboxTokens: [],
      });
    }

    const cspMeta = await page.locator('meta[http-equiv]').evaluateAll((elements) => elements.map((element) => ({
      equiv: element.getAttribute('http-equiv')?.toLowerCase(),
      content: element.getAttribute('content'),
    })));
    for (const meta of cspMeta) {
      if (meta.equiv === 'content-security-policy') policies.push(policy(pageId, observedAt, 'content-security-policy', 'meta_element', meta.content ?? undefined));
    }
    const attempts = await page.evaluate(() => (globalThis as typeof globalThis & { __scriptledgerServiceWorkerAttempts?: string[] }).__scriptledgerServiceWorkerAttempts ?? []);
    for (const [index, attempt] of attempts.slice(0, 100).entries()) {
      let destination;
      try { destination = toUrlEvidence(new URL(attempt, page.url()).toString(), target.retainQueryFreePaths); } catch { destination = undefined; }
      workers.push({
        ...base(observedAt, 'browser_dom'),
        schemaVersion: 'scriptledger.worker-observation.v1',
        workerId: shortId('worker', `${pageId}:service:${destination?.pathHash ?? index}`),
        pageId,
        workerType: 'service_worker_registration_attempt',
        ...(destination ? { destination } : {}),
        blockedByPolicy: true,
      });
    }
  }

  const blockedRequest = requests.some((request) => request.state !== 'success');
  const complete = !budgetReached && !timedOut && !navigationFailed && !blockedRequest;
  let finalDestination;
  try {
    finalDestination = page.url() && page.url() !== 'about:blank' ? toUrlEvidence(page.url(), target.retainQueryFreePaths) : undefined;
  } catch {
    finalDestination = undefined;
  }
  const pageObservation: PageObservation = {
    ...base(observedAt, 'browser_network'),
    schemaVersion: 'scriptledger.page-observation.v1',
    pageId,
    targetId: target.id,
    route,
    ...(finalDestination ? { finalDestination } : {}),
    redirectCount,
    requests,
    resources,
    scripts,
    frames,
    workers,
    websockets,
    policies,
    popupAttempts,
    requestCount: totalNetworkRequests,
    retainedObservationBytes,
    limitations: [...new Set(limitations)].slice(0, 32),
    state: timedOut ? 'timed_out' : budgetReached ? 'budget_exhausted' : navigationFailed ? 'failed' : blockedRequest ? 'partial' : 'success',
    completeness: complete ? 'complete' : 'partial',
    truncation: { truncated: budgetReached, ...(budgetReached ? { reason: limitations.at(-1) ?? 'Collection budget exhausted', retainedCount: requests.length } : {}) },
  };
  await context.close();
  return { page: pageObservation, edges, components };
}

export async function captureTarget(target: TargetConfig, options: CollectorOptions = {}): Promise<CaptureSnapshot> {
  const ownBrowser = !options.browser;
  const browser = options.browser ?? await chromium.launch({ headless: true });
  const now = options.now ?? (() => new Date());
  const observedAt = now().toISOString();
  const guard = new DestinationGuard(options);
  const pages: PageObservation[] = [];
  const edges: DependencyEdge[] = [];
  const components: ComponentIdentification[] = [];
  try {
    for (const route of target.routes.slice(0, target.budgets.maxNavigations)) {
      const collected = await collectPage(browser, target, route, observedAt, guard, options.redirectProbe);
      pages.push(collected.page);
      edges.push(...collected.edges);
      components.push(...collected.components);
    }
    const browserVersion = browser.version();
    const limitsReached = pages.flatMap((page) => page.limitations.filter((entry) => /budget/iu.test(entry)));
    const complete = pages.length === target.routes.length && pages.every((page) => page.completeness === 'complete');
    const captureId = shortId('capture', `${target.id}:${observedAt}`);
    const snapshot: CaptureSnapshot = {
      schemaVersion: 'scriptledger.capture-snapshot.v1',
      normalizationVersion: NORMALIZATION_VERSION,
      observedAt,
      timestampMeaning: 'capture_started',
      source: 'browser_network',
      state: complete ? 'success' : 'partial',
      completeness: complete ? 'complete' : 'partial',
      truncation: { truncated: !complete, ...(complete ? {} : { reason: limitsReached[0] ?? 'One or more routes were incomplete' }) },
      manifest: {
        schemaVersion: 'scriptledger.capture-manifest.v1',
        normalizationVersion: NORMALIZATION_VERSION,
        observedAt,
        timestampMeaning: 'capture_started',
        source: 'operator_config',
        state: complete ? 'success' : 'partial',
        completeness: complete ? 'complete' : 'partial',
        truncation: { truncated: limitsReached.length > 0, ...(limitsReached.length ? { reason: limitsReached[0] } : {}) },
        captureId,
        targetId: target.id,
        collectorVersion: COLLECTOR_VERSION,
        browserName: 'chromium',
        browserVersion: stripControlCharacters(browserVersion, 256),
        configurationHash: canonicalHash(target),
        routeSetHash: canonicalHash([...target.routes].sort()),
        routesRequested: target.routes.length,
        routesCompleted: pages.filter((page) => page.state === 'success').length,
        limitsReached: [...new Set(limitsReached)],
      },
      pages,
      components: [...new Map(components.map((component) => [component.componentId, component])).values()],
      vulnerabilities: [],
      dependencyEdges: [...new Map(edges.map((edge) => [edge.edgeId, edge])).values()],
    };
    return canonicalizeSnapshot(snapshot);
  } finally {
    if (ownBrowser) await browser.close();
  }
}
