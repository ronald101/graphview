// Finding and narrowing (specification 6.19 to 6.21): the search, the highlight groups and the scope.
import { CheckboxSetting, NumberSetting, SliderSetting } from '../setting.svelte.ts';

export const searchSettings = () =>
  [
    new NumberSetting({
      key: 'search.limit',
      group: 'Search',
      label: 'Results',
      description: 'The most results the Search section lists.',
      default: 50,
      min: 1,
      max: 1000,
      whole: true,
    }),
  ] as const;

export const highlightSettings = () =>
  [
    new NumberSetting({
      key: 'highlight.hops',
      group: 'Highlights',
      label: 'Neighbour steps',
      description: 'The group Neighbours holds the units within this many steps of the selection.',
      default: 1,
      min: 1,
      max: 5,
      whole: true,
    }),
    new SliderSetting({
      key: 'highlight.scale',
      group: 'Highlights',
      label: 'Size of highlighted units',
      description: 'Units of a group that is on draw at this factor of their size.',
      default: 1.15,
      min: 1,
      max: 3,
      step: 0.05,
    }),
    new SliderSetting({
      key: 'highlight.dim',
      group: 'Highlights',
      label: 'Opacity of the rest',
      description: 'While a group is on, every other unit, line and chevron draws at this factor of its opacity.',
      default: 0.25,
      min: 0,
      max: 1,
      step: 0.01,
    }),
    new CheckboxSetting({
      key: 'highlight.direction',
      group: 'Highlights',
      label: 'Direction',
      description:
        'With one unit selected, the chevrons of its outgoing keypairs take the outgoing colour and those of its incoming keypairs the incoming colour.',
      default: true,
    }),
  ] as const;

export const scopeSettings = () =>
  [
    new NumberSetting({
      key: 'scope.hops',
      group: 'Scope',
      label: 'Steps',
      description: 'Show neighbourhood takes the units within this many steps of the chosen units, either way.',
      default: 1,
      min: 1,
      max: 3,
      whole: true,
    }),
    new NumberSetting({
      key: 'scope.limit',
      group: 'Scope',
      label: 'Most units',
      description: 'A scope holds at most this many units: nearer units first, then those with more relations.',
      default: 500,
      min: 1,
      max: 20000,
      whole: true,
    }),
  ] as const;
