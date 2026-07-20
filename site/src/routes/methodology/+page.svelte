<script lang="ts">import PageIntro from '$lib/components/PageIntro.svelte';</script>
<svelte:head><title>Methodology · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Methodology v1" title="Bounded observations, explicit uncertainty" summary="ScriptLedger separates collection, normalization, comparison, and publication so every conclusion can be traced to retained evidence." />
<article class="prose">
  <h2>1. Authorize and bound</h2><p>An operator supplies an exact HTTPS origin, confirms authorization, lists query-free routes, and sets navigation, request, redirect, lifetime, and retained-byte ceilings. Wildcards and credentials are rejected.</p>
  <h2>2. Observe in isolation</h2><p>Each route uses a fresh browser context with no profile, permissions, cookies, downloads, form submission, or service workers. Navigation redirects are preflighted through the same public-address and route checks before Chromium loads the page.</p>
  <h2>3. Minimize and normalize</h2><p>Queries, fragments, bodies, headers, storage, and WebSocket frames are excluded. Origins and query-free paths are normalized, repeated evidence is bounded, policy nonces and hashes are treated as volatile, and only complete bounded first-party script or stylesheet bodies are eligible for a complete hash.</p>
  <h2>4. Compare comparable evidence</h2><p>Removals require two complete observations for the relevant route. Different route sets, exhausted budgets, blocked sources, partial collection, or incompatible schema versions downgrade or prevent comparison.</p>
  <h2>5. Publish deliberately</h2><p>The local CLI writes real capture data to a gitignored directory. Static reports are a separate build input. This public site ships only the fixed synthetic fixture.</p>
</article>
