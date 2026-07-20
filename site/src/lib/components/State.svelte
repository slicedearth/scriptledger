<script lang="ts">
  let { value }: { value: string } = $props();
</script>

<span class="state" data-state={value}>{value.replaceAll('_', ' ')}</span>
