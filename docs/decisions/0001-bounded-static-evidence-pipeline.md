# ADR 0001: Bounded local capture and static evidence reports

**Status:** Accepted

**Date:** 2026-07-20

## Context

ScriptLedger needs browser-derived evidence for explicitly authorized sites while keeping the
public portfolio surface inert, synthetic, and inexpensive to host. Captures may include
sensitive infrastructure relationships, so collection and publication cannot share an online
request path.

## Decision

Use a Node.js 24-or-newer, strict TypeScript, ESM command-line collector with Playwright Chromium.
Validate every configured navigation and observed network destination against explicit budgets and
public-address rules. Store versioned canonical JSON under a gitignored local data root, with
completeness and truncation states on every evidence category.

Generate an adapter-static SvelteKit site from a versioned `PublicReport`. The committed site data
is a fixed synthetic fixture using reserved names and documentation addresses. The site has no scan
endpoint, accounts, analytics, remote fonts, target embeds, or runtime data service.

Adopt the reference projects' deterministic contracts, source attribution, bounded collection,
neutral failure language, accessible static reporting, SHA-pinned CI actions, and verification-rich
commits. Differ intentionally by keeping capture execution local instead of deploying a collector,
using one npm workspace instead of a mixed-language pipeline, and avoiding a runtime database.

Use Apache License 2.0. The closest defensive-tool reference uses Apache-2.0 and ScriptLedger's
collector and policy adapters benefit from its explicit patent grant. The evidence format remains
source-attributed; publishing third-party observations may require separate permission.

## Consequences

- Static hosting cannot initiate or schedule a capture.
- Real captures stay outside version control unless an operator deliberately curates a publication.
- Playwright cannot provide a complete network sandbox or DNS pinning for all browser subrequests;
  exact navigation allowlists, repeated public-address checks, isolated contexts, and local-only
  execution reduce rather than eliminate that risk.
- JSON remains transparent and reviewable, but large histories will eventually need partitioning.
- CycloneDX export is deferred because runtime web observations must not be represented as build-time
  package dependencies without a defensible mapping.
