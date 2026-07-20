<script lang="ts">
  let { eyebrow, title, summary }: { eyebrow: string; title: string; summary: string } = $props();
</script>

<header class="page-intro">
  <p class="eyebrow">{eyebrow}</p>
  <h1>{title}</h1>
  <p class="lede">{summary}</p>
</header>
