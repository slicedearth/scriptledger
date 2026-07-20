<script lang="ts">
  import PageIntro from '$lib/components/PageIntro.svelte';
  import State from '$lib/components/State.svelte';
  import { events, formatObservationDate, humanize, report } from '$lib/report.js';
</script>

<svelte:head><title>Trust changes · ScriptLedger</title></svelte:head>
<PageIntro eyebrow={`Comparison · ${report.completeness} capture evidence`} title="Recent trust changes" summary="Each event keeps its reason, route, before-and-after evidence, and comparison completeness. Collection time means first observed—not the exact time an external change happened." />

<div class="card-grid">
  {#each events as event}
    <article class="card event-card">
      <p class="meta">{event.route} · {humanize(event.eventType)}</p>
      <h2>{event.reason}</h2>
      {#if event.before !== undefined}<p><strong>Before:</strong> <code>{JSON.stringify(event.before)}</code></p>{/if}
      {#if event.after !== undefined}<p><strong>After:</strong> <code>{JSON.stringify(event.after)}</code></p>{/if}
      <p>First observed in the {formatObservationDate(event.firstObservedAt)} capture.</p>
      <State value={event.comparisonCompleteness} />
    </article>
  {/each}
</div>
