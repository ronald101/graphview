// Turns the model into instanced attributes. Every attribute that changes over a transition holds
// a previous and a next value: a step moves the old next value to the previous one, and the model
// gives the new next value. The shaders then ease from one to the other, which also gives the
// fade-in, fade-out and trails of moving units (specification 6.10).
import { keyId, keypairId, type Key } from '../core/index.ts';
import { drawnChevrons } from '../model/drawing.ts';
import { keypairShare, unitShares } from '../model/filterRules.ts';
import { keypairPasses, lineWeight, unitPasses, weightOf } from '../model/filters.ts';
import type { GraphModel } from '../model/model.ts';
import type { Relation } from '../model/topology.ts';
import type { FrameState } from './frame.ts';
import { LOOK, type EndBuffers } from './geometry.ts';
import { halvesOf, lookOf } from './looks.ts';
import { shapeSlot } from './shapes.ts';

/**
 * The shapes and halves of the drawing (6.18): by perspectives, an interface takes the interface shape
 * in its own type's colour, and a class unit the class shape; otherwise each unit's look decides.
 */
function drawUnits(s: FrameState) {
  const m = s.model;
  const g = m.graph;
  const shapes = s.looks.shapes;
  s.u.halves = halvesOf(m, s.looks);
  s.shapes = m.ids.map((id, i) => {
    let name = lookOf(s.looks, m.kinds.of[i]).shape;
    if (g && s.drawing === 'perspectives') {
      if (m.kinds.ends.has(i)) {
        name = m.settings.get('drawing.interfaceShape');
        s.u.halves[2 * i] = s.u.halves[2 * i + 1] = m.types.unitSlot[i] ?? m.types.other;
      } else if (m.profile.classUnit?.(g.unitInfo.get(id), g.units[i])) name = m.settings.get('drawing.classShape');
    }
    // A shape the shader does not hold draws as the first one.
    return shapes[shapeSlot(name, shapes)]?.name ?? name;
  });
  s.shapes.forEach((name, i) => (s.u.look[4 * i + LOOK.shape] = shapeSlot(name, shapes)));
}

/** New attribute arrays for the model's graph, with the values that do not change over transitions. */
export function allocate(s: FrameState) {
  const m = s.model;
  const kinds = m.settings.get('extensions.looks');
  s.looks = kinds ? { ...s.baseLooks, kinds: { ...s.baseLooks.kinds, ...kinds } } : s.baseLooks;
  s.drawing = m.settings.get('drawing.relations');
  s.chevrons = m.graph
    ? drawnChevrons(m.graph, m.relations, m.chevrons, m.kinds, s.drawing, (i, a, b) => m.perspectiveType(i, a, b))
    : [];
  const n = m.ids.length;
  const r = m.relations.length;
  const k = s.chevrons.length;
  const whole = (count: number) => Float32Array.from({ length: 2 * count }, (_, j) => (j % 2 ? 0 : 1));
  const ends = (count: number) => ({
    aPrevA: new Float32Array(3 * count),
    aNextA: new Float32Array(3 * count),
    aPrevB: new Float32Array(3 * count),
    aNextB: new Float32Array(3 * count),
    aStateA: new Float32Array(4 * count),
    aStateB: new Float32Array(4 * count),
  });
  s.u = {
    ...ends(n),
    posPrev: new Float32Array(3 * n),
    posNext: new Float32Array(3 * n),
    currentDegree: new Float32Array(2 * n),
    isOnActivePath: new Float32Array(2 * n),
    filterState: new Float32Array(2 * n).fill(1),
    halves: new Float32Array(2 * n),
    look: new Float32Array(4 * n),
  };
  s.l = {
    ...ends(r),
    aLine: new Float32Array(4 * r),
    aLine2: new Float32Array(4 * r),
    aStatic: new Float32Array(2 * r),
    aEmph: whole(r),
  };
  s.c = {
    ...ends(k),
    aChev: new Float32Array(4 * k),
    aChevState: new Float32Array(4 * k),
    aAbove: new Float32Array(2 * k),
    aEmph: whole(k),
  };
  const g = m.graph;
  s.relationsPer = new Uint32Array(n);
  drawUnits(s);
  if (g) {
    // A perspective's chevron takes the colour of its pair type; a keypair's, its keypair's type.
    const slotOf = new Map(m.types.keypair.map((t) => [t.id, t.slot]));
    m.relations.forEach((rel, i) => {
      s.relationsPer[rel.a]++;
      s.relationsPer[rel.b]++;
      s.l.aStatic[2 * i + 1] = rel.ab && rel.ba ? 0 : rel.ab ? 2 : 1;
    });
    s.chevrons.forEach((ch, i) => {
      const type = ch.perspective?.type;
      s.c.aChev[4 * i + 1] = ch.forward ? 1 : -1;
      s.c.aChev[4 * i + 2] = ch.perspective
        ? ((type != null ? slotOf.get(type) : undefined) ?? m.types.other)
        : (m.types.keypairSlot.get(keypairId(ch.from, ch.to)) ?? m.types.other);
    });
  }
  statics(s);
  s.flags = { root: [0, 0], path: [0, 0], depth: [0, 0] };
  s.forget();
}

/** The values that change only with the settings: the fades of superseded parts and the chevrons' places. */
export function statics(s: FrameState) {
  const m = s.model;
  const g = m.graph;
  if (!g) return;
  const fade = s.rules.superseded;
  const at = s.rules.chevrons.at;
  g.units.forEach((_, i) => (s.u.look[4 * i + LOOK.fade] = m.superseded[i] ? fade : 1));
  m.relations.forEach((rel, i) => (s.l.aStatic[2 * i] = relationFade(m, rel, fade)));
  s.chevrons.forEach((ch, i) => {
    s.c.aChev[4 * i] = ch.forward ? at.forward : at.backward;
    s.c.aChev[4 * i + 3] = keypairFade(m, ch.from, ch.to, fade);
  });
  s.forget();
}

/** A keypair fades when it, or one of its units, is superseded. */
function keypairFade(m: GraphModel, a: Key, b: Key, fade: number): number {
  const unitGone = (k: Key) => m.superseded[m.index.get(keyId(k))!] === 1;
  const gone = unitGone(a) || unitGone(b) || m.graph!.keypairInfo.get(keypairId(a, b))?.superseded;
  return gone ? fade : 1;
}

/** A relation's line fades when every keypair it has fades. */
function relationFade(m: GraphModel, rel: Relation, fade: number): number {
  const fades = [
    rel.ab ? keypairFade(m, rel.ka, rel.kb, fade) : null,
    rel.ba ? keypairFade(m, rel.kb, rel.ka, fade) : null,
  ];
  return fades.every((f) => f === null || f < 1) ? fade : 1;
}

/**
 * One step: the model's state becomes the next value of every attribute. On the first step, the
 * previous values equal the next ones, so that nothing moves in.
 */
export function step(s: FrameState, first: boolean, marks: string[]) {
  const m = s.model;
  const g = m.graph!;
  s.applied++;
  const n = m.ids.length;
  const seq = m.activePath();
  const onPathV = new Uint8Array(n);
  const onPathRel = new Uint8Array(m.relations.length);
  const flowOf = new Map<string, number>();
  if (seq) {
    for (const k of seq) onPathV[m.index.get(keyId(k))!] = 1;
    for (let i = 0; i + 1 < seq.length; i++) {
      const rel = m.relationOf.get(keypairId(seq[i], seq[i + 1]));
      if (rel !== undefined) onPathRel[rel] = 1;
      flowOf.set(keypairId(seq[i], seq[i + 1]), 1);
      flowOf.set(keypairId(seq[i + 1], seq[i]), -1);
    }
  }
  // How much of each unit and keypair shows: the time window, the filter rules and the scope (6.7, 6.21).
  const f = m.filters;
  const rules = m.schema.rules;
  const facts = m.ruleFacts();
  const pass = unitShares(n, m.rules, facts, s.rules.fade);
  const inside = m.inScope();
  s.outside = m.outside();
  g.units.forEach((k, i) => {
    if (!unitPasses(g, k, f, rules) || (inside && !inside[i])) pass[i] = 0;
  });
  const keypairShows = (a: Key, b: Key) => {
    if (!keypairPasses(g, a, b, f, rules)) return 0;
    const units = Math.min(pass[m.index.get(keyId(a))!], pass[m.index.get(keyId(b))!]);
    return keypairShare(m.rules, facts, a, b, units, s.rules.fade);
  };
  const span = m.fieldRange(f.weightField, 'weight');
  const pair = (arr: Float32Array, i: number, next: number) => {
    arr[2 * i] = first ? next : arr[2 * i + 1];
    arr[2 * i + 1] = next;
  };
  const u = s.u;
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < 3; d++) {
      const next = d < 2 ? m.positions[2 * i + d] : 0;
      u.posPrev[3 * i + d] = first ? next : u.posNext[3 * i + d];
      u.posNext[3 * i + d] = next;
    }
    pair(u.currentDegree, i, m.degrees ? m.degrees[i] : 0);
    pair(u.isOnActivePath, i, onPathV[i]);
    pair(u.filterState, i, pass[i]);
    u.look[4 * i + LOOK.marked] = marks.includes(m.ids[i]) ? 1 : 0;
  }
  const flag = (both: number[], next: number) => [first ? next : both[1], next];
  s.flags = {
    root: flag(s.flags.root, m.degrees ? 1 : 0),
    path: flag(s.flags.path, seq ? 1 : 0),
    depth: flag(s.flags.depth, m.mode === '3d' ? 1 : 0),
  };
  // Ends of lines, chevrons and interfaces copy their units' values.
  const copyEnds = (b: EndBuffers, i: number, ua: number, ub: number) => {
    for (let d = 0; d < 3; d++) {
      b.aPrevA[3 * i + d] = u.posPrev[3 * ua + d];
      b.aNextA[3 * i + d] = u.posNext[3 * ua + d];
      b.aPrevB[3 * i + d] = u.posPrev[3 * ub + d];
      b.aNextB[3 * i + d] = u.posNext[3 * ub + d];
    }
    const st = (j: number): [number, number, number, number] => [
      u.currentDegree[2 * j],
      u.currentDegree[2 * j + 1],
      u.isOnActivePath[2 * j],
      u.isOnActivePath[2 * j + 1],
    ];
    b.aStateA.set(st(ua), 4 * i);
    b.aStateB.set(st(ub), 4 * i);
  };
  // An interface with one end has it on both sides.
  for (const [i, e] of m.kinds.ends) if (e.length) copyEnds(u, i, e[0], e[e.length > 1 ? 1 : 0]);
  m.relations.forEach((rel, i) => {
    copyEnds(s.l, i, rel.a, rel.b);
    // A line shows as much as its most shown keypair.
    const visible = Math.max(rel.ab ? keypairShows(rel.ka, rel.kb) : 0, rel.ba ? keypairShows(rel.kb, rel.ka) : 0);
    const w = lineWeight(
      rel.ab ? weightOf(g, rel.ka, rel.kb, f.weightField) : null,
      rel.ba ? weightOf(g, rel.kb, rel.ka, f.weightField) : null,
      f,
      span,
    );
    const L = s.l.aLine;
    L[4 * i] = first ? +visible : L[4 * i + 1];
    L[4 * i + 1] = +visible;
    L[4 * i + 2] = first ? +w.above : L[4 * i + 3];
    L[4 * i + 3] = +w.above;
    const L2 = s.l.aLine2;
    L2[4 * i] = first ? w.strength : L2[4 * i + 1];
    L2[4 * i + 1] = w.strength;
    L2[4 * i + 2] = first ? onPathRel[i] : L2[4 * i + 3];
    L2[4 * i + 3] = onPathRel[i];
  });
  s.chevrons.forEach((ch, i) => {
    const rel = m.relations[ch.rel];
    copyEnds(s.c, i, rel.a, rel.b);
    const S = s.c.aChevState;
    const flow = flowOf.get(keypairId(ch.from, ch.to)) ?? 0;
    S[4 * i] = first ? flow : S[4 * i + 1];
    S[4 * i + 1] = flow;
    const shows = keypairShows(ch.from, ch.to);
    S[4 * i + 2] = first ? shows : S[4 * i + 3];
    S[4 * i + 3] = shows;
    s.c.aAbove[2 * i] = s.l.aLine[4 * ch.rel + 2];
    s.c.aAbove[2 * i + 1] = s.l.aLine[4 * ch.rel + 3];
  });
}

/**
 * The highlights (6.20), at once and without a transition: units of the groups that are on grow and
 * carry the outline while every other unit dims, and so does every line and chevron that touches no
 * highlighted unit. With one unit selected, its chevrons take the direction's colours.
 */
export function emphasize(s: FrameState) {
  const m = s.model;
  const on = m.emphasis();
  const whole = (a: number, b: number) => (on === null || on[a] || on[b] ? 1 : 0);
  for (let i = 0; i < m.ids.length; i++) s.u.look[4 * i + LOOK.emphasis] = on === null ? 0 : on[i] ? 1 : -1;
  m.relations.forEach((rel, i) => (s.l.aEmph[2 * i] = whole(rel.a, rel.b)));
  const one = s.rules.highlight.direction && m.selection.length === 1 ? keyId(m.selection[0]) : null;
  s.chevrons.forEach((ch, i) => {
    const rel = m.relations[ch.rel];
    s.c.aEmph[2 * i] = whole(rel.a, rel.b);
    s.c.aEmph[2 * i + 1] = one === null ? 0 : keyId(ch.from) === one ? 1 : keyId(ch.to) === one ? 2 : 0;
  });
  s.forget();
}
