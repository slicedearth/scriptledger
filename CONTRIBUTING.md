# Contributing

ScriptLedger is a defensive tool with a deliberately narrow operating boundary. Contributions are
welcome when they preserve authorization, bounded collection, minimal retention, deterministic
evidence, and an inert public site.

## Development setup

```bash
npm ci
npm run test:browser:install
npm run verify
```

Node.js 24 or newer is required. Tests must use reserved domains, documentation addresses, injected
resolvers, or the loopback fixture. Do not add a test that contacts the public internet.

## Change requirements

- Add or update a versioned Zod contract before changing persisted evidence.
- Keep all strings, collections, response reads, redirects, requests, and lifetimes bounded.
- Preserve explicit missing, partial, skipped, unavailable, and incompatible states.
- Never infer a removal from incomplete comparable evidence.
- Keep real targets, captures, cookies, browser profiles, secrets, screenshots, and generated reports
  out of commits.
- Keep the static site synthetic, script-free, analytics-free, and closed to scan requests.
- Document detector provenance and confidence; do not turn uncertain matches into facts.
- Add a decision record for a material safety, compatibility, or data-model tradeoff.

## Verification

Before proposing a change, run:

```bash
npm test
npm run typecheck
npm run check
npm run build
npm run test:browser
npm audit --omit=dev
git diff --check
```

Review the staged diff and confirm no local evidence or secret is present. Do not bypass repository
hooks or verification failures. Report vulnerabilities through the private process in
`SECURITY.md`, not a public issue.
