<!-- One setting (specification 7.10): its label, its control, its default when the value differs, Reset
     and Pin; whether it waits for the next graph; and why a value was refused. -->
<script lang="ts">
  import type { GraphModel } from '../../model/model.ts';
  import { same, type Setting } from '../../settings/setting.svelte.ts';
  import { watch } from '../watch.svelte.ts';
  import { say } from '../words.ts';
  import SettingControl from './SettingControl.svelte';
  import { describe } from './words.ts';

  interface Props {
    setting: Setting;
    model: GraphModel;
    /** Ids differ where a setting shows twice, in the dialog and in the side bar. */
    prefix: string;
  }
  let { setting, model, prefix }: Props = $props();
  const w = watch(() => model, []);
  const t = (text: string, vars?: Record<string, string>) => say(model, text, vars);
  const id = $derived(`${prefix}-${setting.key.replace(/[^\w-]/g, '-')}`);
  const label = $derived(t(setting.label));
  /** Fields with one input take the label; the others name their own parts. */
  const single = $derived(
    ['checkbox', 'slider', 'number', 'select', 'text', 'colour', 'theme-colour', 'json'].includes(setting.control),
  );
  let refused = $state('');

  const mark = $derived.by(() => {
    void w.v;
    return {
      differs: !same(setting.value, setting.default),
      own: model.settings.isStored(setting.key) || model.settings.inGraphLayer(setting.key),
    };
  });

  function set(value: unknown) {
    const why = value === undefined ? setting.allowed() : model.setSetting(setting.key, value);
    refused = why ? t(why) : '';
  }
</script>

<div class="gv-setting" data-key={setting.key} data-testid="setting-{setting.key}">
  <div class="gv-setting-head">
    {#if single}<label for={id}>{label}</label>{:else}<span id="{id}-label">{label}</span>{/if}
    <span class="gv-setting-actions">
      <button
        type="button"
        aria-label={t('Reset {label}', { label })}
        disabled={!mark.own}
        onclick={() => {
          refused = '';
          model.resetSettings([setting.key]);
        }}>{t('Reset')}</button
      >
      <button
        type="button"
        aria-pressed={setting.pinned}
        aria-label={t(setting.pinned ? 'Unpin {label}' : 'Pin {label}', { label })}
        onclick={() => model.pinSetting(setting.key, !setting.pinned)}>{t(setting.pinned ? 'Unpin' : 'Pin')}</button
      >
    </span>
  </div>
  <div class="gv-setting-control">
    <SettingControl {setting} {model} {id} {label} {set} />
  </div>
  {#if refused}<p class="gv-note gv-refusal" role="alert">{refused}</p>{/if}
  {#if mark.differs}<p class="gv-note">
      {t('Default: {value}', { value: describe(model, setting, setting.default) })}
    </p>{/if}
  {#if setting.applies === 'load'}<p class="gv-note">{t('Applies to the next graph')}</p>{/if}
  <p class="gv-note gv-setting-about">{t(setting.description)}</p>
</div>
