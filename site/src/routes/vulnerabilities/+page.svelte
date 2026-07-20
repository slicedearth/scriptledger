<script lang="ts">
  import PageIntro from '$lib/components/PageIntro.svelte';
  import State from '$lib/components/State.svelte';
  import { humanize, report } from '$lib/report.js';
</script>

<svelte:head><title>Vulnerability findings · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Optional advisory enrichment" title="Vulnerability findings" summary="OSV lookups are disabled by default in the collector and run only for high-confidence package and version matches. No advisory result is ever a claim that a site is safe." />

{#if report.synthetic}<div class="callout" role="note">This page demonstrates a fictional advisory identifier. It does not describe a real package or vulnerability.</div>{/if}
{#if report.capture.vulnerabilities.length}
  <div class="card-grid">
    {#each report.capture.vulnerabilities as vulnerability}
      <article class="card event-card"><p class="meta">{vulnerability.database} · {humanize(vulnerability.lookupState)}</p><h2>{vulnerability.advisoryId}</h2><p>{vulnerability.summary ?? 'Summary not retained.'}</p><State value={vulnerability.lookupState} /></article>
    {/each}
  </div>
{:else}
  <p class="callout">Advisory evidence was not observed. This is not a pass.</p>
{/if}
