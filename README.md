# ScriptLedger

ScriptLedger is a bounded, browser-driven web supply-chain monitor for websites you own or are
explicitly authorized to assess. Its local CLI records the scripts, stylesheets, frames, workers,
network origins, and browser security policies involved in rendering a fixed route allowlist. It
then compares versioned observations and produces a static, evidence-backed report.

The project is intended for site owners, platform engineers, and defensive reviewers who need a
small, inspectable record of runtime dependencies. It does not determine that a site is safe,
malicious, or compromised.

## Safety boundary

Use ScriptLedger only against systems you own or have explicit permission to assess. Every target
must set `authorizationConfirmed: true`, use one exact HTTPS origin, list query-free routes, and
declare finite navigation, request, redirect, lifetime, and observation-byte budgets.

ScriptLedger is not an arbitrary public scanner, credentialed crawler, login automation service,
form-submission bot, exploitation framework, screenshot harvester, or content archive. The static
site has no scan endpoint and accepts no target URL. Real captures remain local unless an operator
separately reviews and curates them for publication.

## Architecture

```text
authorized targets.yml
        │ validate + public-address checks
        ▼
isolated Playwright collector ──► versioned canonical snapshots
                                         │
                                         ├── deterministic comparison events
                                         └── versioned PublicReport JSON
                                                        │
                                                        ▼
                                              inert static SvelteKit site
```

- `src/contracts/` defines strict Zod contracts and finite collection limits.
- `src/security/` validates destinations, preflights redirects, adapts Retire.js, and contains the
  disabled-by-default OSV client.
- `src/collector/` observes one bounded route in a fresh Chromium context without a stored profile.
- `src/storage/` writes deterministic canonical JSON under the gitignored local data root.
- `src/diff/` emits explainable events and suppresses unsafe removal claims from partial evidence.
- `src/reports/` validates report input and builds guarded local static output.
- `site/` prerenders either the committed synthetic report or an explicitly selected local report
  to HTML and CSS with no client JavaScript.

See [architecture](docs/architecture.md), [data contracts](docs/data-contract.md), and the
[initial architecture decision](docs/decisions/0001-bounded-static-evidence-pipeline.md).

## Requirements

- Node.js 24 or newer
- npm 11 or newer and earlier than npm 13
- Chromium installed through Playwright

## Quick start

```bash
npm ci
npm run test:browser:install
npm run verify
npm run dev
```

The development server renders only the committed synthetic `.invalid` fixture. It performs no
scan and makes no third-party request.

## Local fixture demonstration

The integration fixture binds only to loopback interfaces and simulates static and dynamic
scripts, frames, fetch, WebSocket creation, redirects, CSP variants, SRI, changed resources,
oversized responses, timeouts, and budget exhaustion.

```bash
npm run test:integration
```

Ordinary tests do not access the public internet. Browser report tests rebuild and preview the
synthetic static site locally.

## Capture workflow

Copy the example outside version control, replace its reserved origin with an authorized site, and
keep the finite route list narrow:

```bash
cp examples/targets.example.yml targets.yml
npm run cli -- validate targets.yml
npm run cli -- capture targets.yml
```

`targets.yml` and generated captures are gitignored. Capture output defaults to
`.scriptledger/captures/`. The validator resolves destinations and rejects localhost, private,
loopback, link-local, multicast, reserved, documentation, and cloud-metadata addresses. It does not
make authorization decisions for you.

## First report from one capture

You do not need to wait for a second capture to inspect the first observation:

```bash
npm run cli -- initial-report \
  .scriptledger/captures/<target>/<capture>/snapshot.json
```

The command writes a private report beneath
`.scriptledger/reports/<target>/<capture>/report.json` and prints its exact path. The initial
report contains the full captured inventory, zero change events, and an explicit limitation that no
baseline comparison was available. Build and preview that printed report path with:

```bash
npm run cli -- build-report <printed-report-path>
npm run preview:report
```

Use `--output <report.json>` to select another gitignored report path and
`--generated-at <ISO timestamp>` for deterministic output.

## Compare and report

```bash
npm run cli -- compare \
  .scriptledger/captures/<before>.json \
  .scriptledger/captures/<after>.json \
  --output .scriptledger/reports/report.json \
  --generated-at 2026-07-20T00:00:00.000Z

npm run cli -- report .scriptledger/reports/report.json
```

A comparison records exact before/after evidence, affected route, reason, detector version,
comparison completeness, and first-observed timestamps. It refuses incompatible schema versions
and does not infer removals from relevant partial captures. Supplying a fixed report timestamp
makes identical report input byte-for-byte deterministic.

## Build a private local report

Turn a validated `PublicReport` into the useful human-readable site without publishing it:

```bash
npm run cli -- build-report .scriptledger/reports/report.json
npm run preview:report
```

The first command writes inert HTML and CSS to `.scriptledger/site/`; the second serves that
directory only on the local preview address. The builder validates the report, requires its
`source` and `synthetic` label to agree, and refuses to overwrite an unmarked directory,
symlink, or path outside a direct child of `.scriptledger/`. An alternate private output can be
selected with `--output .scriptledger/<name>`.

This command does not capture a site, upload data, or deploy anything. A real local report can
reveal routes, origins, component versions, and security controls even though ScriptLedger
minimizes retained data. Keep it private unless you have reviewed every page and deliberately
decided to publish it.

## Data handling

Retained evidence is deliberately narrow: normalized scheme/origin, optional query-free path, path
hash, resource type, initiator relationship, timing class, status, bounded byte count, selected
policy headers, DOM declarations, and complete hashes only for eligible bounded first-party static
scripts or stylesheets.

ScriptLedger does not retain request or response bodies, cookies, authorization headers, full
headers, query values, fragments, POST data, WebSocket frames, form fields, web storage, page HTML,
or screenshots by default. See [PRIVACY.md](PRIVACY.md) for the full retention and deletion model.

## Security limitations

This collector is not a complete network sandbox. Playwright cannot pin DNS for every browser
subrequest, browser processes remain part of the trusted computing base, and a hostile page can
consume resources inside the configured limits. Top-level redirects are explicitly preflighted and
every observed request is checked, but a browser may initiate a request before an interception
handler can abort it. Run captures locally in a disposable environment without credentials or
access to sensitive networks. See [threat model](docs/threat-model.md) and
[limitations](docs/limitations.md).

## Static deployment

`npm run build` always writes the public synthetic site to `site/build/` unless an operator
explicitly invokes the separate local report builder. The committed fixture uses reserved
`.invalid` names. Both output modes have no scanning capability, analytics, remote fonts, target
content, target favicon, live target links, or client JavaScript; their CSP sets
`connect-src 'none'`.

The optional Pages workflow builds only this committed fixture and is manual by default. Enabling a
hosting product or publishing any real report is a separate operator decision. The workflow reads
the repository's Pages base path and supplies it to SvelteKit, so navigation remains within a
project site such as `/scriptledger/` while ordinary local and private-report previews remain
root-based.

The CodeQL workflow scans JavaScript and TypeScript on pushes to `main`, pull requests, a weekly
schedule, and manual runs. It uses pinned actions, extended security queries, and job-scoped
`security-events: write` permission. Its first successful run activates code-scanning results for
the pushed repository; local captures and reports are not workflow inputs.

## Verification

```bash
npm test                 # unit, security, and local collector integration tests
npm run test:unit        # unit and security tests only
npm run test:integration # loopback fixture and Chromium collector tests
npm run typecheck
npm run check            # Svelte diagnostics
npm run build
npm run test:browser     # accessibility, local-only, injection, keyboard, 320px tests
npm audit --omit=dev
git diff --check
```

## Component and advisory status

Retire.js detection is isolated behind `scriptledger.retire-adapter.v1`. Content signatures are
high-confidence; URI-only inference is visibly low-confidence and includes limitations. OSV
enrichment is disabled by default and accepts only high-confidence component/version pairs. It
sends package name and version, never a target URL or domain, and distinguishes disabled,
unavailable, no-known-vulnerability, and matched states.

CycloneDX export is deferred. Runtime web observations are available first as versioned
ScriptLedger JSON so they are not mislabeled as build-time package dependencies. See
[ADR 0002](docs/decisions/0002-defer-cyclonedx.md).

## Sources and licenses

ScriptLedger is licensed under Apache-2.0. It builds on:

- [Playwright](https://playwright.dev/) for browser automation and observation (Apache-2.0);
- [Retire.js](https://retirejs.github.io/retire.js/) for local component signatures (Apache-2.0);
- [OSV](https://osv.dev/) for optional advisory enrichment;
- [tldts](https://github.com/remusao/tldts) and the Public Suffix List model for registrable-domain
  classification (MIT);
- [SvelteKit](https://svelte.dev/docs/kit) for static report generation (MIT);
- [Zod](https://zod.dev/) for runtime contract validation (MIT).

Dependency versions and transitive provenance are locked in `package-lock.json`.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [PRIVACY.md](PRIVACY.md)
before changing the collector or evidence contracts. Security reports should use the repository's
private vulnerability reporting channel.
