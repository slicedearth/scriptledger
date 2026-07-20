<script lang="ts">
  import PageIntro from '$lib/components/PageIntro.svelte';
  import State from '$lib/components/State.svelte';
  import { report } from '$lib/report.js';
</script>

<svelte:head><title>Component inventory · ScriptLedger</title></svelte:head>
<PageIntro eyebrow="Versioned detector adapter" title="Component inventory" summary="Component matches keep their detector version, method, confidence, evidence type, and limitations. A filename or URI inference remains visibly low confidence." />

<!-- svelte-ignore a11y_no_noninteractive_tabindex (the scrollable table region must be keyboard-focusable) -->
<div class="table-wrap" role="region" aria-label="Detected components" tabindex="0">
  <table><caption>{report.synthetic ? 'Synthetic component identifications.' : 'Detected component identifications.'}</caption><thead><tr><th scope="col">Component</th><th scope="col">Version</th><th scope="col">Confidence</th><th scope="col">Method</th><th scope="col">Limitation</th></tr></thead>
    <tbody>{#each report.capture.components as component}<tr><th scope="row">{component.component}</th><td><code>{component.version ?? 'Unknown'}</code></td><td><State value={component.confidence} /></td><td>{component.identificationMethod.replaceAll('_', ' ')}</td><td>{component.limitations.join(' ')}</td></tr>{/each}</tbody>
  </table>
</div>
