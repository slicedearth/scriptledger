<script lang="ts">
  import State from '$lib/components/State.svelte';
  import { demoReport, events, origins, pages, humanize } from '$lib/demo-report.js';
</script>

<svelte:head><title>ScriptLedger — know what your pages depend on</title></svelte:head>

<section class="hero-grid" aria-labelledby="hero-title">
  <div class="hero-copy">
    <p class="eyebrow">Web supply-chain evidence</p>
    <h1 id="hero-title">Know what your pages depend on.</h1>
    <p class="lede">ScriptLedger records the scripts, frames, workers, origins, and browser policies involved in rendering pages you are authorized to assess—then explains what changed.</p>
    <div class="actions">
      <a class="button" href="/changes/">Review trust changes</a>
      <a class="button secondary" href="/demo/">Understand the fixture</a>
    </div>
  </div>
  <div class="hero-aside" aria-label="Synthetic report summary">
    <div class="metric"><strong>{pages.length}</strong><span>Routes observed</span></div>
    <div class="metric"><strong>{origins.length}</strong><span>Origins involved</span></div>
    <div class="metric"><strong>{events.length}</strong><span>Explainable changes</span></div>
  </div>
</section>

<section aria-labelledby="latest-heading">
  <div class="section-heading">
    <h2 id="latest-heading">Recent trust changes</h2>
    <p>First observed 20 Jul 2026</p>
  </div>
  <div class="card-grid">
    {#each events.slice(0, 3) as event}
      <article class="card event-card">
        <p class="meta">{event.route} · {humanize(event.eventType)}</p>
        <h3>{event.reason}</h3>
        <State value={event.comparisonCompleteness} />
      </article>
    {/each}
  </div>
</section>

<section aria-labelledby="ledger-heading">
  <div class="section-heading">
    <h2 id="ledger-heading">One ledger, three evidence layers</h2>
    <p>{demoReport.methodologyVersion}</p>
  </div>
  <div class="card-grid">
    <article class="card"><p class="meta">01 · Observe</p><h3>Browser reality</h3><p>Capture bounded network destinations, DOM declarations, security headers, and complete eligible hashes without retaining page content.</p></article>
    <article class="card"><p class="meta">02 · Normalize</p><h3>Comparable evidence</h3><p>Redact volatile queries, normalize origins and policies, mark partial evidence, and preserve exact source references.</p></article>
    <article class="card"><p class="meta">03 · Explain</p><h3>Trust changes</h3><p>Report precise additions, removals, origin moves, policy changes, and advisory states. There is no opaque overall score.</p></article>
  </div>
</section>
