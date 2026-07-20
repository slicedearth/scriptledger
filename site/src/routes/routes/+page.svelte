<script lang="ts">
  import PageIntro from '$lib/components/PageIntro.svelte';
  import State from '$lib/components/State.svelte';
  import { pages, report } from '$lib/report.js';
</script>

<svelte:head><title>Route inventory · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Capture inventory" title="Route inventory" summary="Configured routes are the top-level navigation boundary. Counts describe retained observations, not every byte the browser received." />

<!-- svelte-ignore a11y_no_noninteractive_tabindex (the scrollable table region must be keyboard-focusable) -->
<div class="table-wrap" role="region" aria-label="Captured routes" tabindex="0">
  <table>
    <caption>{pages.length} bounded route(s) in this {report.synthetic ? 'synthetic' : 'local'} capture.</caption>
    <thead><tr><th scope="col">Route</th><th scope="col">State</th><th scope="col">Requests</th><th scope="col">Scripts</th><th scope="col">Frames</th><th scope="col">Policies</th><th scope="col">Retained evidence</th></tr></thead>
    <tbody>
      {#each pages as page}
        <tr>
          <th scope="row"><code>{page.route}</code></th>
          <td><State value={page.completeness} /></td>
          <td>{page.requestCount}</td>
          <td>{page.scripts.length}</td>
          <td>{page.frames.length}</td>
          <td>{page.policies.length}</td>
          <td>{page.retainedObservationBytes.toLocaleString()} bytes</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
