// Lets a component follow the model: read `w.v` in a derivation to depend on the model's changes. A
// change of settings counts for every component, as any of them may show one. It takes a getter, so
// that a component handed another model follows the new one.
import { untrack } from 'svelte';
import type { Aspect } from '../model/contracts.ts';
import type { GraphModel } from '../model/model.ts';

export function watch(model: () => GraphModel, aspects?: Aspect[]): { readonly v: number } {
  let version = $state(0);
  $effect(() =>
    model().subscribe((a) => {
      if (!aspects || a.has('graph') || a.has('settings') || aspects.some((x) => a.has(x))) untrack(() => version++);
    }),
  );
  return {
    get v() {
      return version;
    },
  };
}
