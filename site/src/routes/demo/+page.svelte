<script lang="ts">
  import PageIntro from '$lib/components/PageIntro.svelte';
  import { demoReport } from '$lib/demo-report.js';
</script>
<svelte:head><title>Synthetic demo · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Committed fixture" title="A report with no real target" summary="The storefront, partners, component matches, advisory, hashes, and dates shown here are invented to exercise the complete report interface safely." />
<article class="prose">
  <h2>Why synthetic?</h2><p>A public dependency report can disclose how a real site is assembled. ScriptLedger therefore makes publication a separate, deliberate act. The portfolio build accepts no URL and contains no collector.</p>
  <h2>Reserved names</h2><p>Every destination uses a reserved <code>.invalid</code> domain. The advisory identifier begins with <code>OSV-SYNTHETIC</code> and is not an external database record.</p>
  <h2>What this fixture exercises</h2><p>Two routes, first-party and partner origins, a third-party telemetry destination, a frame, a WebSocket, CSP enforcement and report-only delivery, SRI, complete and ineligible hashes, high- and low-confidence component matches, and five change-event types.</p>
  <h2>Contract identity</h2>
  <dl class="definition-list">
    <dt>Report schema</dt><dd><code>{demoReport.schemaVersion}</code></dd>
    <dt>Normalization</dt><dd><code>{demoReport.normalizationVersion}</code></dd>
    <dt>Methodology</dt><dd><code>{demoReport.methodologyVersion}</code></dd>
    <dt>Completeness</dt><dd>{demoReport.completeness}</dd>
    <dt>Source</dt><dd>{demoReport.source.replaceAll('_', ' ')}</dd>
  </dl>
</article>
