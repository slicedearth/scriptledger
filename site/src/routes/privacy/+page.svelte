<script lang="ts">import PageIntro from '$lib/components/PageIntro.svelte'; import { report } from '$lib/report.js';</script>
<svelte:head><title>Privacy · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Data handling" title="Retain evidence, not page content" summary="ScriptLedger minimizes capture output by design and keeps real observations local unless an operator deliberately curates a report." />
<article class="prose">
  <h2>Collected</h2><p>Normalized origins, optional query-free paths, path hashes, resource types, status codes, selected safe headers, policy values, DOM attributes, bounded timings and sizes, completeness states, and evidence references.</p>
  <h2>Deliberately excluded</h2><p>Request and response bodies, cookies, authorization headers, full header sets, query values, fragments, POST data, WebSocket frames, form values, HTML, local storage, session storage, and screenshots by default.</p>
  <h2>Local storage and deletion</h2><p>Generated captures default to <code>.scriptledger/captures/</code> and local sites to <code>.scriptledger/site/</code>; both are ignored by Git. Delete those directories to remove generated output. Browser contexts are temporary and are closed after each route.</p>
  <h2>Optional disclosure</h2><p>OSV enrichment is disabled by default. When explicitly enabled for a high-confidence match, it sends only a normalized npm package name and version—not the target URL or domain.</p>
  <h2>{report.synthetic ? 'Public surface' : 'Local report surface'}</h2><p>{report.synthetic ? 'This site contains fixed synthetic data, no accounts, no analytics, no remote fonts, and no connection to a collector.' : 'This site contains curated local evidence but no accounts, analytics, remote fonts, collector connection, or runtime report fetch. Treat the generated files as potentially sensitive.'}</p>
</article>
