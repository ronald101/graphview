// The module's only entry point: the core, the model and its contracts, and the view's components.
export * from './core/index.ts';
export type * from './model/contracts.ts';
export { GraphModel, EXTENT, EXTRA_STEPS, type Relation, type Chevron } from './model/model.ts';
export { kindOfUnit, type Kind, type KindIssue, type Kinds } from './model/kinds.ts';
export {
  INTERFACE,
  PUBLIC_PROFILE,
  type Check,
  type CheckIssue,
  type KindRule,
  type Profile,
} from './model/profile.ts';
export { PUBLIC_LOOKS, halfSlots, type Look, type Looks } from './render/looks.ts';
export { UNIT_SHAPES, type UnitShape } from './render/shapes.ts';
export { DEPTH_RULES, SPACING, FOREGROUND, CHEVRON_AT, depthState, plane } from './model/depth.ts';
export { TYPE_PALETTE, MAX_TYPES, OTHER, mixColour } from './model/typeRegistry.ts';
export type { SceneSnapshot } from './render/scene.ts';
export { default as GraphView } from './view/GraphView.svelte';
export { default as GraphCanvas } from './view/GraphCanvas.svelte';
export { default as RootPanel } from './view/RootPanel.svelte';
export { default as PathsPanel } from './view/PathsPanel.svelte';
export { default as InspectorPanel } from './view/InspectorPanel.svelte';
export { default as FiltersPanel } from './view/FiltersPanel.svelte';
export { default as DisplayPanel } from './view/DisplayPanel.svelte';
export { default as IssuesPanel } from './view/IssuesPanel.svelte';
export { default as TypesPanel } from './view/TypesPanel.svelte';
export { default as Section } from './view/Section.svelte';
export { default as RangeSlider } from './view/RangeSlider.svelte';
export { issueWords, keyText, count } from './view/words.ts';
export { UNIT_SECTIONS, type SectionProps, type UnitSections } from './view/inspector/sections.ts';
