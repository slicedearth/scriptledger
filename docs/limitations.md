# Limitations

- ScriptLedger is an observation tool, not proof of compromise, maliciousness, safety, or complete
  dependency inventory.
- Browser request interception is not a complete network sandbox. Top-level redirect preflight and
  observed-request validation reduce SSRF risk but do not provide universal DNS pinning for every
  Chromium subrequest.
- The collector observes a bounded page-load lifecycle without login, consent interaction, scrolling,
  clicking, form submission, or application-specific workflows. Lazy and conditional dependencies
  may not appear.
- Service workers are blocked. Their registration attempts are recorded, but service-worker-driven
  traffic and cache behavior are unsupported in the MVP.
- Transfer sizes may be absent or approximate depending on browser events and caching behavior.
- A complete resource hash exists only for an eligible complete bounded static body. Missing,
  ineligible, over-budget, third-party, and prefix-only bodies are not equivalent to unchanged.
- Retire.js signatures can produce false positives or miss minified, modified, bundled, or unknown
  libraries. URI-only component inference is low confidence.
- OSV is disabled by default. When enabled, unavailable and no-known-vulnerability are distinct, and
  neither means a site is safe. Only npm ecosystem lookups are currently represented.
- Registrable-domain relationships explain naming proximity, not organizational ownership or trust.
- CSP normalization supports deterministic comparison but is not a full browser-equivalence proof.
- Collection timestamps mean evidence was first observed then; they do not establish the exact time
  an external deployment changed.
- Snapshot history uses local JSON files and has no scheduler, database, retention policy engine, or
  multi-operator coordination.
- The default public report is synthetic. A private local report can render curated evidence, but
  it does not make the observation complete or safe to disclose. Publication still requires
  deliberate review.
- CycloneDX export is deferred because runtime web artifacts cannot yet be mapped without risking
  incorrect build-time package claims.
