<script lang="ts">
  import App from '../App.svelte';
  import Bench from '../Bench.svelte';
  import Embed from '../Embed.svelte';
  import '../shell.css';

  // The fragment picks the page once, when it loads: #bench and #embed show the pages of 8.14 and 8.15.
  const pages: Record<string, typeof App> = { '#bench': Bench, '#embed': Embed };
  const Page = pages[location.hash] ?? App;
</script>

<Page />
