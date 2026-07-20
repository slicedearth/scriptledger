# ADR 0002: Defer CycloneDX export

**Status:** Accepted

**Date:** 2026-07-20

## Context

ScriptLedger observes runtime web resources, origins, frames, workers, and inferred components. A
CycloneDX software bill of materials normally describes packaged components with established
identity and dependency semantics. A requested URL or low-confidence URI signature is not enough to
claim that the corresponding build-time package is present.

## Decision

Use `scriptledger.capture-snapshot.v1` and `scriptledger.public-report.v1` as the export formats for
the MVP. Preserve component detector method, confidence, evidence type, and limitations alongside
runtime dependency edges. Do not emit CycloneDX until a later mapping can distinguish observed web
artifacts from packages and represent uncertain identities without overstating them.

## Consequences

- Consumers receive transparent canonical JSON rather than a familiar SBOM envelope.
- No runtime URL is mislabeled as a build dependency.
- A future experimental exporter will require fixtures, compatibility tests, provenance fields, and
  a separate decision record before it can be enabled.
