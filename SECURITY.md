# Security policy

## Supported version

ScriptLedger is pre-1.0. Security fixes are made on the current `main` branch; older snapshots are
not maintained as supported release lines.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability, bypass, leaked capture, or unsafe network
behavior. Use GitHub's **Private vulnerability reporting** or open a private **Security Advisory**
for the repository. Include the affected version or commit, a minimal reproduction using reserved
or loopback fixture data, impact, and any suggested mitigation.

Do not include credentials, cookies, browser state, private target URLs, or real capture data in a
report. If the repository has not yet enabled private reporting, wait for a maintainer-provided
private channel rather than disclosing the issue publicly.

## Scope

High-priority reports include:

- a destination-validation or redirect path that reaches a prohibited address;
- retained secrets, bodies, query values, form data, browser storage, or WebSocket frames;
- report injection that can execute code in the static site;
- authorization or budget checks that can be bypassed;
- real target evidence included in a public or CI artifact;
- dependency or workflow changes that create an unexpected execution path.

Expected limitations documented in `docs/limitations.md` are not automatically vulnerabilities,
but a practical bypass of their mitigations is in scope.

## Automated code scanning

The repository includes a pinned CodeQL workflow for JavaScript and TypeScript. It runs on pushes
to `main`, pull requests targeting `main`, a weekly schedule, and manual dispatch. Results are
uploaded to the repository's code-scanning interface with job-scoped permissions. The workflow
does not read target configuration, captures, or private reports.

## Safe research

Use only systems you own, systems for which you have explicit permission, or the included local
fixtures. Do not test a report against third-party infrastructure. Keep proofs bounded and avoid
collecting personal data.
