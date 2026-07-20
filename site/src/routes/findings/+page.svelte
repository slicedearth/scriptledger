<script lang="ts">
  import PageIntro from '$lib/components/PageIntro.svelte';
  import State from '$lib/components/State.svelte';
  import { pages } from '$lib/demo-report.js';

  const policies = pages.flatMap((page) => page.policies.map((entry) => ({ route: page.route, ...entry })));
  const integrity = pages.flatMap((page) => page.resources.filter((resource) => resource.integrity).map((resource) => ({ route: page.route, resource })));
</script>

<svelte:head><title>CSP and SRI findings · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Browser policy" title="CSP & SRI findings" summary="Policy presence and integrity evidence are reported exactly. Report-only CSP is not presented as enforcement, and unavailable hashes are not presented as a pass." />

<section aria-labelledby="csp-heading">
  <div class="section-heading"><h2 id="csp-heading">Content policies</h2><p>{policies.length} observations</p></div>
  <div class="card-grid">
    {#each policies as policyEntry}
      <article class="card"><p class="meta">{policyEntry.route} · {policyEntry.delivery}</p><h3>{policyEntry.policyType}</h3><p><code>{policyEntry.value}</code></p><State value={policyEntry.present ? 'present' : 'not_observed'} /></article>
    {/each}
  </div>
</section>

<section aria-labelledby="sri-heading">
  <div class="section-heading"><h2 id="sri-heading">Integrity evidence</h2><p>Complete hashes are labelled</p></div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (the scrollable table region must be keyboard-focusable) -->
  <div class="table-wrap" role="region" aria-label="Evidence findings" tabindex="0">
    <table><caption>Integrity evidence for retained script resources.</caption><thead><tr><th scope="col">Route</th><th scope="col">Resource</th><th scope="col">SRI</th><th scope="col">Hash state</th><th scope="col">Reason</th></tr></thead>
      <tbody>{#each integrity as item}<tr><td><code>{item.route}</code></td><th scope="row"><code>{item.resource.destination.origin}{item.resource.destination.path}</code></th><td>{item.resource.integrity?.integrityAttribute ?? 'Not observed'}</td><td><State value={item.resource.integrity?.hashState ?? 'not_observed'} /></td><td>{item.resource.integrity?.eligibilityReason}</td></tr>{/each}</tbody>
    </table>
  </div>
</section>
