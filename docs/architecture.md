# Architecture

## Boundary

ScriptLedger has two deliberately separate execution planes:

1. A local CLI validates a finite authorized target configuration and collects bounded evidence in
   an isolated Chromium context.
2. A static SvelteKit application renders a previously prepared `PublicReport`; it has no collector,
   URL input, account, data service, or runtime network access.

There is no runtime database. Canonical JSON files form the local evidence ledger.

## Modules

| Module | Responsibility | Trust boundary |
| --- | --- | --- |
| `src/contracts` | Strict schemas, finite limits, versions, config loading | Rejects unknown fields and invalid states |
| `src/security/url.ts` | URL minimization, public-address checks, DNS result caps and pin consistency | Treats all target-derived destinations as hostile |
| `src/security/redirects.ts` | Bounded top-level redirect preflight | Revalidates each hop before browser navigation |
| `src/collector` | Fresh Chromium contexts and bounded observations | Receives hostile page behavior without credentials |
| `src/security/retire-adapter.ts` | Versioned local component matching | Keeps inference method and confidence visible |
| `src/security/osv-adapter.ts` | Optional advisory query | Disabled by default; sends package/version only |
| `src/storage` | Canonical sort/serialize and gitignored writes | Keeps timestamps outside derived evidence identities |
| `src/diff` | Comparable evidence and explainable events | Downgrades or refuses incomplete comparisons |
| `src/reports` | Validated report assembly | Allows synthetic or deliberately curated input only |
| `site` | Static human-readable evidence | Contains committed synthetic data and no client JS |

## Capture sequence

1. Parse YAML or JSON through `CaptureConfigSchema`; unknown keys fail.
2. Confirm literal operator authorization, exact HTTPS origin, query-free allowlisted routes, and
   finite budgets.
3. Resolve the origin through `DestinationGuard`; reject credentials, prohibited schemes, unsafe
   IP ranges, too many DNS answers, and inconsistent repeated DNS results.
4. Preflight each top-level redirect with bounded `HEAD` requests, validating the next location
   before following it.
5. Start a fresh no-profile Chromium context with permissions omitted, service workers blocked,
   downloads rejected, a fixed user agent, and request interception.
6. Reject non-idempotent requests, observed unsafe destinations, and requests beyond the route
   budget. Close and count popups. Record service-worker registration attempts without enabling
   registrations.
7. Observe network and DOM declarations. Retain selected response metadata and discard content.
   Eligible same-origin static JavaScript and stylesheet bodies may be read only within a strict
   cap; a hash is emitted only for a complete body.
8. Mark any limit, timeout, blocked source, or unavailable category as partial rather than absent.
9. Validate and canonically write the snapshot.

Playwright route interception has a redirect caveat: browser route handlers are not a complete
network sandbox. The explicit preflight reduces top-level redirect risk, while exact routes,
public-address checks, local execution, and a closed public surface reduce remaining risk.

## Evidence identity and determinism

Every persisted record carries a schema version, normalization version, source, state,
completeness, truncation object, timestamp, and timestamp meaning. IDs derive from normalized
evidence, not volatile query values. Canonical serialization sorts object keys and set-like
collections; report generation requires an explicit timestamp for byte-stable output.

Meaningful distinctions remain intact: scheme and non-default port, route, origin classification,
enforced versus report-only CSP, complete versus unavailable content hashes, and high versus low
component confidence.

## Static report design

SvelteKit prerenders twelve routes using adapter-static. `csr = false` prevents a client bundle.
The CSP permits local styles and images only, and sets scripts and connections to `none`. Report
values pass through Svelte's escaped interpolation. Tables use keyboard-focusable labelled regions,
the dependency graph has a complete table alternative, status text accompanies color, and the CSS
contains 320-pixel overflow and reduced-motion accommodations.

## Deployment separation

CI installs from the lockfile and runs only synthetic or loopback fixtures. The optional manual
Pages workflow builds `site/build/` from committed synthetic input. Neither workflow reads target
configuration, runs a live capture, uses a secret, nor uploads local capture artifacts.
