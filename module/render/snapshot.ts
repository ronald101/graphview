// The scene for tests and hosts (specification 5.5): every unit, line and chevron as drawn now, in
// CSS pixels, so that tests need no knowledge of the shaders.
import { keyId, type Key } from '../core/index.ts';
import { plane } from '../model/depth.ts';
import type { Drawing } from '../model/drawing.ts';
import { along } from '../model/picking.ts';
import { paletteOf } from '../model/typeRegistry.ts';
import type { FrameState } from './frame.ts';
import { drawColours } from './rules.ts';

export interface SceneSnapshot {
  width: number;
  height: number;
  settled: boolean;
  mode: '2d' | '3d';
  /** The relation drawing (6.18). */
  drawing: Drawing;
  root: Key | null;
  target: Key | null;
  hasPath: boolean;
  units: {
    key: Key;
    /** Plain, or an interface, or a kind of the profile (model/kinds.ts). */
    kind: string;
    /** The name of the shape it is drawn with: its kind's look's (render/looks.ts), or the perspective drawing's (6.18). */
    shape: string;
    /** An interface's ends, in the order of its relations; null for a plain unit. */
    ends: Key[] | null;
    /** The colours of the unit's halves: the first end's side, then the second's (render/looks.ts). */
    halves: [string, string];
    degree: number | null;
    plane: number | null;
    type: string | null;
    x: number;
    y: number;
    z: number;
    scale: number;
    opacity: number;
    glow: number;
    visible: boolean;
    onPath: boolean;
    sx: number;
    sy: number;
    /** The radius, in pixels, within which a click picks this unit. */
    reach: number;
    selected: boolean;
    /** 1 in a highlight group that is on, 0 otherwise (6.20). */
    emphasis: number;
    /** Whether the scope holds it; every unit, without a scope (6.21). */
    inScope: boolean;
    /** Its relations to units outside the scope. */
    outside: number;
  }[];
  lines: {
    a: Key;
    b: Key;
    /** Whether the keypairs (a, b) and (b, a) exist. */
    keypairs: [boolean, boolean];
    visible: boolean;
    above: boolean;
    strength: number;
    onPath: boolean;
    opacity: number;
    sx: number;
    sy: number;
  }[];
  chevrons: {
    from: Key;
    to: Key;
    at: number;
    visible: boolean;
    opacity: number;
    flow: number;
    type: string | null;
    colour: string;
    sx: number;
    sy: number;
    /** The perspective it carries in the perspective drawing: from the unit it starts at to the other end. */
    perspective: { from: Key; to: Key } | null;
    /** The unit it points at. */
    points: Key;
  }[];
  hulls: { type: string; members: number; opacity: number }[];
  labels: { key: Key; text: string }[];
}

/** What the other layers add: whether the transition is over, the hull groups and the labels drawn. */
export interface SnapshotExtras {
  settled: boolean;
  hulls: { type: string; members: number }[];
  labels: { key: Key; text: string }[];
}

export function sceneSnapshot(s: FrameState, extras: SnapshotExtras): SceneSnapshot {
  const g = s.gpu;
  const m = s.model;
  const graph = m.graph;
  const snap = s.snapshot();
  const onPath = new Set((m.activePath() ?? []).map(keyId));
  // The display factors as drawn: the shaders' values, which follow the model's overrides.
  const size = g ? g.uniforms.uSizeScale.value : m.overrides.size;
  const opacity = g ? g.uniforms.uOpacityScale.value : m.overrides.opacity;
  const palette = paletteOf(m.types.unit, m.types.look);
  const selected = new Set(m.selection.map(keyId));
  const inside = m.inScope();
  const colours = drawColours(m);
  const units: SceneSnapshot['units'] = (graph?.units ?? []).map((k, i) => {
    const v = snap.st[i];
    const d = m.degrees ? m.degrees[i] : null;
    return {
      key: k,
      kind: m.kinds.of[i],
      shape: s.shapes[i],
      ends: m.endsOf(k),
      halves: [palette[s.u.halves[2 * i]], palette[s.u.halves[2 * i + 1]]],
      degree: d,
      plane: d === null ? null : plane(d, s.rules.depth),
      type: m.unitType(k)?.id ?? null,
      x: v.p[0],
      y: v.p[1],
      z: v.p[2],
      scale: v.s.scale * size * s.grow(i),
      opacity: v.s.opacity * v.filter * opacity * s.unitDim(i),
      glow: v.s.glow,
      visible: s.now(s.u.filterState, i, 2, 0) > 0.5,
      onPath: onPath.has(m.ids[i]),
      sx: snap.screen[i].x,
      sy: snap.screen[i].y,
      reach: s.unitReach(i, snap),
      selected: selected.has(m.ids[i]),
      emphasis: s.highlighted(i) ? 1 : 0,
      inScope: inside ? inside[i] === 1 : true,
      outside: s.outside?.[i] ?? 0,
    };
  });
  const lines: SceneSnapshot['lines'] = m.relations.map((rel, i) => {
    const p = g ? g.project(along(snap.st[rel.a].p, snap.st[rel.b].p, 0.5)) : { x: 0, y: 0 };
    return {
      a: rel.ka,
      b: rel.kb,
      keypairs: [rel.ab, rel.ba],
      visible: s.now(s.l.aLine, i, 4, 0) > 0.5,
      above: s.now(s.l.aLine, i, 4, 2) > 0.5,
      strength: s.now(s.l.aLine2, i, 4, 0),
      onPath: s.now(s.l.aLine2, i, 4, 2) > 0.5,
      opacity: s.lineOpacity(i, snap) * s.lineDim(i),
      sx: p.x,
      sy: p.y,
    };
  });
  const chevrons: SceneSnapshot['chevrons'] = s.chevrons.map((ch, i) => {
    const rel = m.relations[ch.rel];
    const at = s.chevronAt(i);
    const p = g ? g.project(along(snap.st[rel.a].p, snap.st[rel.b].p, at)) : { x: 0, y: 0 };
    const { from, to, perspective } = ch;
    // A perspective's chevron is named and coloured by its pair type (6.18).
    const type = perspective
      ? perspective.type === null
        ? null
        : (m.types.keypair.find((t) => t.id === perspective.type) ?? { id: perspective.type, colour: undefined })
      : m.keypairType(from, to);
    return {
      from,
      to,
      at,
      visible: s.chevronOpacity(i, snap) > s.rules.pointer.minOpacity,
      opacity: s.chevronOpacity(i, snap) * s.chevronDim(i),
      flow: s.now(s.c.aChevState, i, 4, 0),
      type: type?.id ?? null,
      // One selected unit colours its chevrons by direction (6.20).
      colour: [type?.colour ?? m.types.look.other, colours.outgoing, colours.incoming][s.c.aEmph[2 * i + 1]],
      sx: p.x,
      sy: p.y,
      perspective: perspective ? { from: perspective.from, to: perspective.to } : null,
      points: ch.points,
    };
  });
  return {
    width: g?.width ?? 0,
    height: g?.height ?? 0,
    settled: extras.settled,
    mode: m.mode,
    drawing: s.drawing,
    root: m.root,
    target: m.target,
    hasPath: m.activePath() !== null,
    units,
    lines,
    chevrons,
    hulls: g && g.hullCount() ? extras.hulls.map((h) => ({ ...h, opacity: g.hullOpacity() })) : [],
    labels: [...extras.labels],
  };
}
