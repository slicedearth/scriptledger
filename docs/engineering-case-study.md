# Engineering case study

## The problem

Modern pages assemble code and policy from many origins, but a simple URL list loses initiator,
completeness, integrity, and policy context. A general-purpose crawler would also widen the safety
boundary: it might accept arbitrary targets, follow unbounded links, carry browser state, or retain
sensitive content. ScriptLedger needed useful runtime evidence without becoming that crawler.

## Authorization had to be structural

Authorization is not a banner or command-line warning. The configuration contract requires literal
confirmation, one exact HTTPS origin, a fixed query-free route list, and finite budgets. The public
site contains no collection path at all. This does not verify legal authority, but it prevents the
ordinary product flow from quietly becoming an open scanner.

## Browser fidelity conflicts with network isolation

A real browser reveals dynamic scripts, workers, frames, fetches, and policies that static HTML
parsing misses. It also executes hostile input. The collector therefore uses fresh contexts,
public-address validation, an explicit redirect preflight, request interception, no permissions or
profile, no user interaction, and hard resource limits.

Those controls reduce exposure; they do not turn Chromium into a network sandbox. In particular,
DNS pinning and redirect interception are not universal across browser subrequests. The design makes
that limitation visible instead of claiming an isolation guarantee the API cannot provide.

## Minimal retention changed the data model

Useful comparisons do not require archiving a page. URL evidence keeps normalized origin and
optional path plus a path hash while dropping query values and fragments. Selected metadata replaces
full headers. WebSocket endpoints are recorded without frames. Resource bytes are discarded and
produce a hash only when a complete eligible static body fits a strict cap.

This forces explicit states. “No hash” can mean ineligible, not captured, or incomplete; “no
advisory” can mean disabled, unavailable, or no known match. Encoding those states prevents the UI
from turning missing evidence into a pass.

## Diff correctness depended on completeness

Additions can often be supported by one observation. Removals require complete comparable evidence
on both sides. ScriptLedger checks schema and normalization versions, route sets, capture state, and
category completeness before emitting disappearance events. Each accepted event carries its reason,
route, evidence references, and two observation times rather than an unexplained score.

## Static publication reduced the public attack surface

The report application prerenders a synthetic Zod-validated fixture into HTML and CSS. There is no
client bundle, analytics endpoint, external font, live target link, or scan form. A restrictive CSP
and browser tests for injection, remote requests, accessibility, keyboard operation, and 320-pixel
overflow protect the presentation boundary.

## Component detection needed provenance

A library name inferred from a URL is not equivalent to a version found in complete content. The
Retire.js adapter records its detector version, method, evidence type, confidence, and limitations.
Optional OSV enrichment accepts only high-confidence name/version pairs and discloses no target
context. CycloneDX was deferred because an attractive standard format would be harmful if it
misrepresented runtime observations as build dependencies.

## Result

The MVP provides a coherent local path from authorized configuration to canonical snapshot,
explainable comparison, and inert static report. Its strongest property is not exhaustive coverage;
it is that collection bounds, missing evidence, inference quality, and residual risk remain visible
to the operator and report reader.
