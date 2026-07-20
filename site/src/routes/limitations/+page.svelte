<script lang="ts">import PageIntro from '$lib/components/PageIntro.svelte';</script>
<svelte:head><title>Limitations · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Interpretation boundary" title="What the ledger cannot prove" summary="A bounded capture is useful evidence, but it is neither a vulnerability assessment nor a complete network sandbox." />
<article class="prose">
  <div class="callout">Missing data is not a pass. A site is never labelled safe, compromised, or malicious.</div>
  <h2>Browser and network boundary</h2><p>Playwright does not provide complete DNS pinning for all browser subrequests. ScriptLedger repeats public-address checks where interception permits, preflights top-level redirects, isolates contexts, and runs only as a local CLI, but it cannot eliminate browser, operating-system, or DNS resolver risk.</p>
  <h2>Observation boundary</h2><p>Late resources may appear after the page lifetime, service workers are blocked, cached/CDN variants may differ, and authentication flows are outside scope. Blocking a feature can make the result partial rather than absent.</p>
  <h2>Identification boundary</h2><p>Retire.js signatures and URI patterns identify candidates, not loaded behavior. URI-only versions are low confidence. OSV can be unavailable and advisory absence is not safety evidence.</p>
  <h2>Time boundary</h2><p>“First observed” refers to the capture. ScriptLedger cannot establish the exact time an external deployment changed.</p>
  <h2>Publication boundary</h2><p>Real capture data can reveal infrastructure relationships. Operators must review authorization, privacy, contractual, and disclosure obligations before publication.</p>
</article>
