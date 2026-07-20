# Data contract

## Common envelope

Observation contracts extend a strict `EvidenceEnvelope`:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Type-specific compatibility identifier |
| `normalizationVersion` | Exact canonicalization rules (`2026-07-20.1`) |
| `observedAt` | ISO timestamp interpreted by `timestampMeaning` |
| `timestampMeaning` | Capture start, first observed, response observed, report generated, or previous comparable observation |
| `source` | Operator config, browser network/DOM, response header, meta element, derived logic, detector, OSV, or synthetic fixture |
| `state` | `success`, `partial`, `skipped`, `unsupported`, `blocked`, `timed_out`, `budget_exhausted`, `invalid`, or `failed` |
| `completeness` | `complete`, `partial`, `not_observed`, or `incompatible` |
| `truncation` | Whether values were truncated and the bounded reason/counts |

Unknown keys fail validation. Common strings are capped at 2,048 characters, short strings at 256,
safe policy values at 8,192, observations per category at 1,000, and evidence references per event
at 32. Tighter fields have tighter limits.

## Configuration

### `CaptureConfig` — `scriptledger.capture-config.v1`

Contains at most 16 targets and pins the normalization version.

### `TargetConfig`

Requires a stable lowercase ID, exact HTTPS origin, literal `authorizationConfirmed: true`, one to
32 query-free routes, and `TargetBudgets`. It may declare expected first-party registrable domains
and exact partner origins. Credentials, fragments, queries, wildcards, and arbitrary route
generation are invalid.

### `TargetBudgets`

Caps navigations, requests per route, redirects, page lifetime, and total observation bytes. Schema
ceilings prevent an operator from configuring an unbounded capture.

## Capture records

| Contract | Schema | Retained meaning |
| --- | --- | --- |
| `CaptureManifest` | `scriptledger.capture-manifest.v1` | Capture identity, collector/browser versions, config and route-set hashes, requested/completed routes, reached limits |
| `PageObservation` | `scriptledger.page-observation.v1` | One configured route, minimized final destination, redirects, bounded category arrays, popup attempts, byte/request totals, limitations |
| `RequestObservation` | `scriptledger.request-observation.v1` | Method class, resource type, minimized destination, registrable domain, trust classification, initiator/redirect links, selected response metadata |
| `ResourceObservation` | `scriptledger.resource-observation.v1` | Document/script/stylesheet or other resource metadata plus optional integrity evidence |
| `ScriptObservation` | `scriptledger.script-observation.v1` | External or inline declaration, module/async/defer flags, SRI and crossorigin attributes |
| `FrameObservation` | `scriptledger.frame-observation.v1` | Minimized destination, name presence, and bounded sandbox token set |
| `WorkerObservation` | `scriptledger.worker-observation.v1` | Dedicated/shared/service-worker-attempt type, destination, and whether policy blocked it |
| `WebSocketObservation` | `scriptledger.websocket-observation.v1` | Minimized endpoint and a literal guarantee that frames were not retained |
| `PolicyObservation` | `scriptledger.policy-observation.v1` | Selected CSP, referrer, permissions, transport, content-type, and cross-origin policy presence/value plus delivery source |
| `IntegrityObservation` | `scriptledger.integrity-observation.v1` | SRI/crossorigin declarations and complete, prefix-only, not-captured, or ineligible hash state |
| `DependencyEdge` | `scriptledger.dependency-edge.v1` | Route/request relationships with bounded evidence references |

`UrlEvidence` retains scheme, normalized origin, an optional query-free path, a SHA-256 path hash,
and explicit query/fragment redaction flags. It never carries userinfo, query values, or fragments.
`NetworkClassification` is one of exact first-party origin, related first party, configured partner,
third party, IP literal, or unknown.

### `CaptureSnapshot` — `scriptledger.capture-snapshot.v1`

Combines one manifest, bounded page observations, component identifications, vulnerability
observations, and dependency edges. It is the canonical local JSON export.

## Detection and advisory records

### `ComponentIdentification` — `scriptledger.component-identification.v1`

Records resource reference, detector and version, content/URI/metadata/combined method, component,
optional version, high/medium/low confidence, evidence type, and explicit limitations. A URI-derived
version can never silently masquerade as a content signature.

### `VulnerabilityObservation` — `scriptledger.vulnerability-observation.v1`

Records component reference, advisory identifier, optional bounded summary, affected flag, OSV
database, and one of `matched`, `no_known_vulnerability`, `unavailable`, or `disabled`. No-known is
not a safety claim.

## Comparison and reporting

### `ChangeEvent` — `scriptledger.change-event.v1`

Supports third-party, script, content, frame, worker, WebSocket, CSP, SRI, component-version, and
vulnerability event types. Every event includes bounded before/after values, a reason, route,
evidence references, comparison completeness, detector version, first-observed time, and previous
comparable time.

### `PublicReport` — `scriptledger.public-report.v1`

Contains one snapshot, bounded comparison events, methodology version, overall completeness,
limitations, and a literal source of `synthetic_fixture` or `curated_authorized_capture`.
`synthetic` must be true exactly for `synthetic_fixture`; inconsistent labels fail validation.
An initial report from one snapshot has an empty comparison-event array and an explicit limitation
that no baseline was supplied; it does not fabricate additions or changes.

## Compatibility rules

- Incompatible schema or normalization versions are refused.
- Material route-set or collection-mode differences downgrade comparison confidence.
- A relevant partial capture suppresses removal and disappearance events.
- Missing, not observed, blocked, unavailable, and confirmed absent are not interchangeable.
- Nonces and deliberately volatile policy material are normalized only where doing so preserves
  policy semantics.
- A caller-supplied fixed report timestamp is required for byte-identical report output.
