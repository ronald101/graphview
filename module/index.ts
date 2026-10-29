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
export { JsonFileSource, DocumentSource, type GraphSource } from './model/source.ts';
export { profileFromJson } from './model/profileJson.ts';
export { isProfileJson, type ProfileJson, type KindJson } from './settings/profileJson.ts';
export { PUBLIC_LOOKS, halfSlots, type Look, type Looks } from './render/looks.ts';
export { UNIT_SHAPES, type UnitShape } from './render/shapes.ts';
export { DEPTH_RULES, SPACING, FOREGROUND, CHEVRON_AT, depthState, plane } from './model/depth.ts';
export { TYPE_PALETTE, MAX_TYPES, OTHER, mixColour } from './model/typeRegistry.ts';
export type { SceneSnapshot } from './render/scene.ts';
export { default as GraphView } from './view/GraphView.svelte';
export { default as GraphCanvas } from './view/GraphCanvas.svelte';
export type { CanvasHandle } from './view/handle.ts';
export { default as RootPanel } from './view/RootPanel.svelte';
export { default as PathsPanel } from './view/PathsPanel.svelte';
export { default as InspectorPanel } from './view/InspectorPanel.svelte';
export { default as FiltersPanel } from './view/FiltersPanel.svelte';
export { default as DisplayPanel } from './view/DisplayPanel.svelte';
export { default as IssuesPanel } from './view/IssuesPanel.svelte';
export { default as TypesPanel } from './view/TypesPanel.svelte';
export { default as Section } from './view/Section.svelte';
export { default as RangeSlider } from './view/RangeSlider.svelte';
export { default as SettingsDialog } from './view/settings/SettingsDialog.svelte';
export { default as SettingControl } from './view/settings/SettingControl.svelte';
export { default as SettingRow } from './view/settings/SettingRow.svelte';
export { default as PinnedPanel } from './view/settings/PinnedPanel.svelte';
export { issueWords, keyText, count, fill, say } from './view/words.ts';
export { viewCss } from './view/css.ts';
export {
  Setting,
  CheckboxSetting,
  SliderSetting,
  NumberSetting,
  RangeSetting,
  SelectSetting,
  TextSetting,
  ColourSetting,
  ThemeColourSetting,
  PaletteSetting,
  OrderSetting,
  SetSetting,
  KeysSetting,
  JsonSetting,
  type Control,
  type Applies,
  type ThemeColour,
  type Palette,
} from './settings/setting.svelte.ts';
export {
  SettingsRegistry,
  createRegistry,
  viewerSettings,
  SETTING_GROUPS,
  GRAPH_LAYER,
  type SettingKey,
  type SettingValue,
  type SettingValues,
  type ViewerSettings,
  type Refusal,
} from './settings/registry.ts';
export {
  SETTINGS_FORMAT,
  emptySettingsFile,
  readSettingsFile,
  parseSettingsFile,
  type SettingsFile,
} from './settings/file.ts';
export {
  HttpSettingsStore,
  BrowserSettingsStore,
  MemorySettingsStore,
  FallbackSettingsStore,
  SettingsConflict,
  type SettingsStore,
} from './settings/stores.ts';
export { SettingsSaver, mergeFiles, type SaveState } from './settings/saver.svelte.ts';
export { createSettingsHandler, type SettingsHandlerOptions, type SettingsRequest } from './settings/handler.ts';
export { UNIT_SECTIONS, type SectionProps, type UnitSections } from './view/inspector/sections.ts';
