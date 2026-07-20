<script lang="ts">
  import PageIntro from '$lib/components/PageIntro.svelte';
  import { humanize, report } from '$lib/report.js';
</script>
<svelte:head><title>About this report · ScriptLedger</title></svelte:head>
<PageIntro eyebrow={report.synthetic ? 'Committed fixture' : 'Local static report'} title={report.synthetic ? 'A report with no real target' : 'A report built from local evidence'} summary={report.synthetic ? 'The storefront, partners, component matches, advisory, hashes, and dates shown here are invented to exercise the complete report interface safely.' : 'This static site was generated locally from a deliberately curated report. It does not connect to a collector or upload the underlying evidence.'} />
<article class="prose">
  {#if report.synthetic}
    <h2>Why synthetic?</h2><p>A public dependency report can disclose how a real site is assembled. ScriptLedger therefore makes publication a separate, deliberate act. The portfolio build accepts no URL and contains no collector.</p>
    <h2>Reserved names</h2><p>Every destination uses a reserved <code>.invalid</code> domain. The advisory identifier begins with <code>OSV-SYNTHETIC</code> and is not an external database record.</p>
    <h2>What this fixture exercises</h2><p>Two routes, first-party and partner origins, a third-party telemetry destination, a frame, a WebSocket, CSP enforcement and report-only delivery, SRI, complete and ineligible hashes, high- and low-confidence component matches, and five change-event types.</p>
  {:else}
    <h2>Local by default</h2><p>The report HTML and its source JSON remain under <code>.scriptledger/</code>. The generated pages contain no collector, account, analytics, or runtime request for report data.</p>
    <h2>Publication is separate</h2><p>A local report may disclose target architecture, dependency origins, versions, and security controls. Review every page before deliberately copying it to a public host.</p>
    <h2>What this report covers</h2><p>{report.capture.pages.length} bounded route(s), {report.capture.components.length} component identification(s), and {report.comparisonEvents.length} explainable change event(s), subject to the completeness and limitations recorded below.</p>
  {/if}
  <h2>Contract identity</h2>
  <dl class="definition-list">
    <dt>Report schema</dt><dd><code>{report.schemaVersion}</code></dd>
    <dt>Normalization</dt><dd><code>{report.normalizationVersion}</code></dd>
    <dt>Methodology</dt><dd><code>{report.methodologyVersion}</code></dd>
    <dt>Completeness</dt><dd>{report.completeness}</dd>
    <dt>Source</dt><dd>{humanize(report.source)}</dd>
  </dl>
</article>
