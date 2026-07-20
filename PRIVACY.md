# Privacy

ScriptLedger separates local collection from public presentation. The public site is generated from
a committed synthetic fixture; local captures are not uploaded by the application or CI.

## What a capture retains

- a target identifier, configured route, and capture timestamps with documented meanings;
- normalized schemes, origins, registrable domains, optional query-free bounded paths, and path
  hashes;
- resource types, initiator relationships, timing classes, response status, MIME type, and bounded
  transferred-byte observations;
- script, stylesheet, frame, worker, service-worker-attempt, fetch/XHR, and WebSocket destinations;
- integrity and crossorigin attributes;
- CSP, CSP report-only, CSP meta, Referrer-Policy, Permissions-Policy, and selected presence-only
  security headers;
- complete cryptographic hashes only for eligible, complete, bounded static resources;
- component matches, confidence, method, detector version, and limitations;
- explicit completeness, truncation, source, state, and collection-limit metadata.

## What is deliberately not retained

ScriptLedger does not retain request bodies, response bodies, POST data, cookies, authorization
headers, complete request or response headers, query-string values, URL fragments, form values,
WebSocket frame content, local storage, session storage, page HTML, or screenshots by default. It
does not use a persistent browser profile.

The collector may receive response bytes transiently for an eligible bounded first-party script or
stylesheet hash. Those bytes are discarded; only a hash is retained after complete capture is
confirmed. Third-party bodies are not fetched merely to calculate hashes.

## Storage and deletion

Generated state defaults to `.scriptledger/` in the current project and may be redirected with CLI
output options. Target allowlists and generated capture/report directories are gitignored.

To delete local evidence, remove the specific files beneath `.scriptledger/captures/` and
`.scriptledger/reports/`, or remove the `.scriptledger/` directory after confirming the path. Also
remove any operator-created backup or exported report separately. ScriptLedger has no cloud account
or server-side copy to delete.

## Public synthetic data

The committed static report contains invented names under the reserved `.invalid` namespace,
documentation-only values, and fixed timestamps. It represents product behavior, not observations
of a real organization. The site embeds no target content, favicon, image, or link.

## Optional OSV disclosure

OSV enrichment is disabled by default. When an operator explicitly enables it, the adapter sends a
normalized ecosystem, package name, and exact version to the OSV API. It does not send the target
URL, domain, route, capture ID, or evidence file. Requests, response bytes, query count, and cache
entries are bounded; the in-memory cache is keyed only by normalized package/version.

## Public-site privacy

The static site has no accounts, analytics, tracking pixels, third-party scripts, remote fonts, or
runtime API calls. Its policy sets `connect-src 'none'`. A hosting provider may independently record
ordinary delivery logs under that provider's policy.
