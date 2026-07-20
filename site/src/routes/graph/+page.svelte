<script lang="ts">
  import PageIntro from '$lib/components/PageIntro.svelte';
  import { dependencyRows, pages } from '$lib/report.js';
</script>

<svelte:head><title>Dependency graph · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Route-to-origin graph" title="Who each route reaches" summary="The visual groups route-to-origin relationships. The complete table immediately below carries the same evidence for keyboard and assistive-technology users." />

<section class="graph-canvas" aria-label="Visual route-to-origin dependency graph">
  {#each pages as page}
    <div class="graph-row">
      <div class="graph-node route">route:{page.route}</div>
      <div class="graph-arrow" aria-hidden="true">→</div>
      <div class="origin-nodes">
        {#each [...new Set(page.requests.map((entry) => entry.destination.origin))] as origin}
          <div class="graph-node">{origin}</div>
        {/each}
      </div>
    </div>
  {/each}
</section>

<div class="section-heading"><h2>Tabular alternative</h2><p>{dependencyRows.length} edges</p></div>
<!-- svelte-ignore a11y_no_noninteractive_tabindex (the scrollable table region must be keyboard-focusable) -->
<div class="table-wrap" role="region" aria-label="Dependency graph table" tabindex="0">
  <table>
    <caption>Every relationship displayed in the graph.</caption>
    <thead><tr><th scope="col">Route node</th><th scope="col">Relationship</th><th scope="col">Origin node</th></tr></thead>
    <tbody>{#each dependencyRows as row}<tr><th scope="row"><code>{row.route}</code></th><td>requested</td><td><code>{row.origin}</code></td></tr>{/each}</tbody>
  </table>
</div>
