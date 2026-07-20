<script lang="ts">
  import PageIntro from '$lib/components/PageIntro.svelte';
  import State from '$lib/components/State.svelte';
  import { origins } from '$lib/report.js';
</script>

<svelte:head><title>Origin inventory · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Trust boundary" title="Origin inventory" summary="Origins are grouped without collapsing ports or schemes. Registrable-domain context supports explainable first-party, partner, and third-party classifications." />

<!-- svelte-ignore a11y_no_noninteractive_tabindex (the scrollable table region must be keyboard-focusable) -->
<div class="table-wrap" role="region" aria-label="Observed origins" tabindex="0">
  <table>
    <caption>Normalized origins observed across the captured routes.</caption>
    <thead><tr><th scope="col">Origin</th><th scope="col">Classification</th><th scope="col">Routes</th><th scope="col">Requests</th></tr></thead>
    <tbody>
      {#each origins as origin}
        <tr>
          <th scope="row"><code>{origin.origin}</code></th>
          <td><State value={origin.classification} /></td>
          <td>{origin.routes.join(', ')}</td>
          <td>{origin.requests}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
