// The module's only entry point (specification D1): the component, createGraphView,
// the core functions of C1, and the types of Part D.
export * from './core/index.ts';
export type * from './types.ts';
export { default as GraphView } from './ui/GraphView.svelte';
export { createGraphView, type GraphViewHandle } from './ui/create.svelte.ts';
export { defaultLook, defaultViewState } from './ui/defaults.ts';
