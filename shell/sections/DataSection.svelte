<!-- Data (specification 8.3): open and save files, fetch from the web, and share a link. -->
<script lang="ts">
  import { Section } from '../../module/index.ts';
  import type { Shell } from '../lib/shell.svelte.ts';

  let { shell }: { shell: Shell } = $props();

  let fileInput: HTMLInputElement;
  let urlInput = $state('');

  async function browse() {
    if (!(await shell.browse())) fileInput.click();
  }

  async function onFileInput(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) await shell.openText(await f.text(), f.name, null);
    (e.target as HTMLInputElement).value = '';
  }
</script>

<Section id="data" title="Data" testid="section-data" bind:open={shell.open.data}>
  <h3>File</h3>
  <div class="gv-row">
    <button type="button" onclick={browse}>Browse…</button>
    <button type="button" onclick={() => shell.save()} disabled={shell.info.refused && !shell.info.hasDoc}>Save</button>
    <input
      bind:this={fileInput}
      type="file"
      accept=".json,application/json"
      hidden
      data-testid="file-input"
      onchange={onFileInput}
    />
  </div>
  <p class="file-name" data-testid="file-name">{shell.fileName || 'No file selected'}</p>
  <p class="gv-note">Or drop a file on the page. Save writes the graph with its view settings.</p>
  <h3>Web</h3>
  <form
    class="gv-row"
    onsubmit={(e) => {
      e.preventDefault();
      if (urlInput.trim()) void shell.loadUrl(urlInput.trim());
    }}
  >
    <input class="grow" type="url" placeholder="Web address" aria-label="Web address" bind:value={urlInput} />
    <button type="submit">Fetch</button>
  </form>
  <div class="gv-row"><button type="button" onclick={() => shell.share()}>Share link</button></div>
  {#if shell.shareLink}<input class="link" readonly value={shell.shareLink} aria-label="Share link" />{/if}
  {#if shell.message}<p class="message" role="status" data-testid="message">{shell.message}</p>{/if}
</Section>
