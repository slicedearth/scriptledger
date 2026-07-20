<script lang="ts">
  import { report } from '$lib/report.js';
  import '../styles/global.css';
  let { children } = $props();

  const navigation = [
    ['Overview', '/'],
    ['Changes', '/changes/'],
    ['Routes', '/routes/'],
    ['Origins', '/origins/'],
    ['Graph', '/graph/'],
    ['Findings', '/findings/'],
    ['Components', '/components/'],
    ['Vulnerabilities', '/vulnerabilities/'],
  ];
</script>

<svelte:head>
  <title>ScriptLedger — web supply-chain evidence</title>
  <meta name="description" content="Bounded, evidence-backed web supply-chain observations for sites you are authorized to assess." />
</svelte:head>

<a class="skip-link" href="#main">Skip to report</a>
<header class="site-header">
  <a class="wordmark" href="/" aria-label="ScriptLedger overview"><span aria-hidden="true">SL//</span> ScriptLedger</a>
  <nav aria-label="Report navigation">
    {#each navigation as item}
      <a href={item[1]}>{item[0]}</a>
    {/each}
  </nav>
</header>

<aside class="fixture-banner" aria-label="Report status">
  <span class="signal" aria-hidden="true"></span>
  {report.synthetic ? 'Synthetic fixture · no live scan · reserved domains only' : 'Local report · no live scan · static evidence only'}
</aside>

<main id="main" tabindex="-1">
  {@render children()}
</main>

<footer>
  <div>
    <strong>ScriptLedger</strong>
    <p>Local collection. Static evidence. Human interpretation.</p>
  </div>
  <nav aria-label="Project information">
    <a href="/methodology/">Methodology</a>
    <a href="/privacy/">Privacy</a>
    <a href="/limitations/">Limitations</a>
    <a href="/demo/">About this {report.synthetic ? 'demo' : 'report'}</a>
  </nav>
</footer>
