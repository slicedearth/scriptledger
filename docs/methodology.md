# Methodology

## 1. Authorize and bound

The operator supplies one exact HTTPS origin, literal authorization confirmation, a finite list of
query-free routes, and hard budgets. ScriptLedger validates the contract and resolves destinations
before collection. It cannot prove ownership or permission; authorization remains the operator's
responsibility.

## 2. Observe a minimal page lifecycle

Each route receives a fresh no-profile Chromium context. The collector grants no permissions,
accepts no downloads, blocks service workers, rejects non-idempotent requests, closes and counts
popups, installs no cookies, and performs no scripted interaction beyond navigation and a bounded
settling period.

Network listeners classify documents, scripts, stylesheets, frames, fetch/XHR, workers, and
WebSocket endpoints. DOM inspection adds script, iframe, CSP meta, integrity, and crossorigin
declarations visible after the bounded lifecycle. Selected response headers are retained; full
headers and content are not.

## 3. Minimize

URLs are reduced to scheme, normalized origin, optional bounded query-free path, and path hash.
Queries and fragments are redacted. Control characters are stripped, strings and collections are
capped, duplicate evidence is normalized, and WebSocket frames are never observed or stored.

Static body hashing is intentionally narrow. Only complete bounded JavaScript or stylesheet bytes
eligible under the first-party policy produce a complete SHA-256. Prefix-only or over-budget reads
produce a non-complete state, not a misleading hash. Third-party response bodies are not acquired
solely for hashing.

## 4. Classify with explainable context

Exact target origin is first party. Other origins sharing an expected registrable domain may be
related first party. Operator-declared exact origins are partners. Remaining public origins are
third party; IP literals and unresolved cases remain explicit. Classification uses tldts rather than
naive last-two-label parsing.

Retire.js matches are attributed to the adapter version and method. Content signatures may be high
confidence; URI inference remains low confidence. OSV is disabled unless explicitly enabled and is
queried only for a high-confidence name/version pair.

## 5. Compare comparable evidence

Canonical snapshots preserve meaningful scheme, port, route, policy-delivery, and completeness
differences while removing set ordering, host casing, default ports, query values, and intentionally
volatile policy tokens. The comparison emits named events with before/after evidence and reasons;
it has no opaque score.

Removal or disappearance requires two complete comparable categories. Incompatible schema versions
are refused. Other source, route-set, limit, or collection-mode differences downgrade confidence and
are recorded as limitations.

Collection time means **first observed**, not the exact time an external deployment changed. Report
language should use forms such as “First observed in the 20 July 2026 capture.”

## 6. Publish deliberately

Local reports remain under `.scriptledger/`. The committed public site uses a fixed synthetic
`PublicReport` with reserved domains. Publication of any authorized capture requires separate human
review for scope, consent, infrastructure sensitivity, completeness, and accidental secrets.
