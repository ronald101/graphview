<!-- Items in an order: each can move up or down, and where not every item must take part, be left out. -->
<script lang="ts">
  import type { OrderSetting } from '../../settings/setting.svelte.ts';
  import { say } from '../words.ts';
  import type { ControlProps } from './control.ts';

  let { setting, model, label, set }: ControlProps<OrderSetting<string>> = $props();
  const words = (item: string) => say(model, setting.items.find(([i]) => i === item)?.[1] ?? item);
  /** The chosen items in their order, then the others. */
  const rows = $derived([...setting.value, ...setting.items.map(([i]) => i).filter((i) => !setting.value.includes(i))]);

  function move(item: string, by: -1 | 1) {
    const list = [...setting.value];
    const i = list.indexOf(item);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set(list);
  }
</script>

<ol class="gv-order" aria-label={label}>
  {#each rows as item (item)}
    {@const on = setting.value.includes(item)}
    {@const at = setting.value.indexOf(item)}
    <li>
      {#if setting.all}
        <span>{words(item)}</span>
      {:else}
        <label class="gv-check"
          ><input
            type="checkbox"
            checked={on}
            onchange={(e) =>
              set(
                (e.target as HTMLInputElement).checked
                  ? [...setting.value, item]
                  : setting.value.filter((i) => i !== item),
              )}
          />
          {words(item)}</label
        >
      {/if}
      <button
        type="button"
        aria-label={say(model, 'Move {item} up', { item: words(item) })}
        disabled={!on || at === 0}
        onclick={() => move(item, -1)}>↑</button
      >
      <button
        type="button"
        aria-label={say(model, 'Move {item} down', { item: words(item) })}
        disabled={!on || at === setting.value.length - 1}
        onclick={() => move(item, 1)}>↓</button
      >
    </li>
  {/each}
</ol>
