// The inspector's sections (specification 7.4): one for each kind of unit, one for a keypair and
// one for a relation. A host adds sections for its own kinds; the panel looks them up by kind and
// never switches on kinds.
import type { Component } from 'svelte';
import type { Inspected } from '../../model/contracts.ts';
import type { GraphModel } from '../../model/model.ts';
import InterfaceSection from './InterfaceSection.svelte';
import KeypairSection from './KeypairSection.svelte';
import RelationSection from './RelationSection.svelte';
import UnitSection from './UnitSection.svelte';

export type Shown = NonNullable<Inspected>;
export type UnitShown = Shown & { kind: 'unit' };

/** A section's props: the model, what it shows, and a count that changes when its words may change. */
export interface SectionProps<I extends Shown = Shown> {
  model: GraphModel;
  inspected: I;
  version: number;
}

/** Sections for units, by kind; plain's serves the kinds without one. */
export type UnitSections = Record<string, Component<SectionProps<UnitShown>>>;

export const UNIT_SECTIONS: UnitSections = { plain: UnitSection, interface: InterfaceSection };

/** The section for what the inspector shows; a unit's by its kind, from the host's sections first. */
export function sectionFor(m: GraphModel, i: Shown, sections: UnitSections = {}): Component<SectionProps> {
  if (i.kind === 'keypair') return KeypairSection as Component<SectionProps>;
  if (i.kind === 'relation') return RelationSection as Component<SectionProps>;
  const kind = m.kindOf(i.key);
  return (sections[kind] ?? UNIT_SECTIONS[kind] ?? UNIT_SECTIONS.plain) as Component<SectionProps>;
}
