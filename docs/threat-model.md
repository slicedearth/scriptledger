# Threat model

## Assets and trust boundaries

Protected assets include the operator's workstation and network, credentials and browser state,
private infrastructure relationships, accurate evidence semantics, static-site visitors, CI
integrity, and the distinction between synthetic and real captures. Target responses and every
value derived from them are untrusted. Chromium, Node.js, installed dependencies, DNS, the operating
system, and CI runners are part of the trusted computing base.

## Threats and controls

| Threat | Primary controls | Residual risk |
| --- | --- | --- |
| Malicious target responses | Fresh context, no permissions/profile, forms and non-idempotent requests blocked, popups closed, service workers blocked, hard lifetime/request/byte caps | Browser parser and engine vulnerabilities remain possible |
| SSRF | Exact HTTPS target, public-address validation, unsafe IPv4/IPv6 rejection, DNS-result cap, destination checks on observed requests | Browser interception is not a complete network firewall |
| DNS rebinding | Repeated-resolution consistency checks, bounded results, public-only addresses, local execution | Playwright cannot pin every subrequest to a validated DNS answer |
| Redirect abuse | Bounded explicit top-level preflight and per-hop revalidation | Subresource redirect interception has browser API limitations |
| Oversized or slow content | Declared and actual body caps, total observation budget, request budget, navigation/lifetime timeouts, partial states | A response can consume some browser resources before abortion |
| Browser escape | Current locked Playwright/Chromium, isolated context, no credentials, no sensitive browser profile | A Chromium zero-day could escape the intended boundary; use OS isolation for hostile sites |
| Data exfiltration | No secrets or stored session, no form interaction, no request bodies retained, public site `connect-src 'none'` | A target can observe the collector's normal page requests and source IP |
| Report injection | Strict contracts, control stripping and caps, Svelte escaping, no client JS, restrictive CSP, hostile-string browser tests | A future renderer or unsafe HTML feature could reopen this class |
| Dependency compromise | Exact lockfile, minimal dependencies, local adapters, production audit, SHA-pinned workflow actions | Registry, transitive package, browser, and action compromise cannot be eliminated |
| Accidental publication | Gitignored captures/targets/reports, synthetic-only site source and CI, no capture artifact upload | An operator can still deliberately stage or copy a real report |
| Secret leakage | No credential workflow, ignored `.env`/cookies/storage state/keys, no full headers or bodies, staged-diff review | Secrets embedded in allowed paths or manually curated prose require human review |
| CI supply-chain risk | Read-only default permissions, locked install, SHA-pinned actions, synthetic/loopback tests, no secrets, explicit timeout | Hosted runner and pinned upstream action remain trusted components |

## Security invariants

- The public site cannot start a collection.
- Authorization is explicit and target routes are finite.
- Prohibited destinations fail closed.
- A missing value is never automatically a pass or confirmed absence.
- Relevant partial evidence cannot create a removal claim.
- Real evidence is never an ordinary CI or deployment input.
- No response body, credential, browser storage, or WebSocket frame becomes persisted evidence.

## Recommended operating environment

Run captures from a disposable, patched machine or container with no logged-in browser state, no
cloud instance credentials, and no route to sensitive internal networks. Review target scope and
the output directory before and after collection. Treat generated evidence as potentially
sensitive even though content retention is minimized.
