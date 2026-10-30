<!-- The Settings dialog (specification 7.10): every setting, grouped, each with its control; a filter;
     Reset all, Import…, Export and Close; and whether the settings are saved. -->
<script lang="ts">
  import type { GraphModel } from '../../model/model.ts';
  import { parseSettingsFile } from '../../settings/file.ts';
  import type { SettingsSaver } from '../../settings/saver.svelte.ts';
  import Section from '../Section.svelte';
  import { say } from '../words.ts';
  import SettingRow from './SettingRow.svelte';

  interface Props {
    model: GraphModel;
    open: boolean;
    /** Saves the settings; without one, nothing is kept. */
    saver?: SettingsSaver | null;
  }
  let { model, open = $bindable(false), saver = null }: Props = $props();
  let dialog: HTMLDialogElement;
  let filter = $state('');
  let note = $state('');
  let picker: HTMLInputElement | undefined = $state();
  const t = (text: string, vars?: Record<string, string>) => say(model, text, vars);

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  const groups = $derived.by(() => {
    const f = filter.trim().toLowerCase();
    return model.settings
      .groups()
      .map((g) => ({
        title: g.title,
        settings: f
          ? g.settings.filter((s) =>
              [s.label, s.key, s.description, t(s.label), t(s.description)].some((x) => x.toLowerCase().includes(f)),
            )
          : g.settings,
      }))
      .filter((g) => g.settings.length > 0);
  });

  const status = $derived.by(() => {
    const s = saver?.state;
    if (!s) return t('Not saved: no store');
    if (s.kind === 'saving') return t('Saving…');
    if (s.kind === 'failed') return t('Not saved: {reason}', { reason: s.reason });
    return t('Saved');
  });

  function exportFile() {
    const text = `${JSON.stringify(model.settings.file(), null, 2)}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graphview-settings.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const r = parseSettingsFile(await file.text());
    if (!r.ok) {
      note = t(r.reason);
      return;
    }
    model.importSettings(r.file);
    note = model.settings.notes.length
      ? model.settings.notes.map((n) => t(n)).join(' ')
      : t('Imported {name}.', { name: file.name });
  }
</script>

<dialog
  bind:this={dialog}
  class="gv-dialog gv-ui"
  aria-labelledby="gv-settings-h"
  data-testid="settings-dialog"
  onclose={() => (open = false)}
>
  {#if open}
    <header class="gv-dialog-head">
      <h2 id="gv-settings-h">{t('Settings')}</h2>
      <input
        type="search"
        class="gv-grow"
        aria-label={t('Filter the settings')}
        placeholder={t('Filter by name, key or description')}
        bind:value={filter}
      />
    </header>
    <div class="gv-dialog-body">
      {#each groups as g (g.title)}
        <Section
          id="gv-set-{g.title.toLowerCase().replace(/\W+/g, '-')}"
          title={t(g.title)}
          open={filter.trim() !== ''}
        >
          {#each g.settings as s (s.key)}<SettingRow setting={s} {model} prefix="gv-set" />{/each}
        </Section>
      {:else}
        <p class="gv-note">{t('No setting matches.')}</p>
      {/each}
    </div>
    <footer class="gv-dialog-foot">
      <button type="button" onclick={() => model.resetSettings()}>{t('Reset all')}</button>
      <button type="button" onclick={() => picker?.click()}>{t('Import…')}</button>
      <input
        bind:this={picker}
        type="file"
        accept=".json,application/json"
        hidden
        onchange={(e) => importFile((e.target as HTMLInputElement).files?.[0])}
      />
      <button type="button" onclick={exportFile}>{t('Export')}</button>
      <span class="gv-grow gv-note" role="status" data-testid="settings-status">{note || status}</span>
      <button type="button" onclick={() => (open = false)}>{t('Close')}</button>
    </footer>
  {/if}
</dialog>
