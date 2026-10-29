// Labels on their own canvas over the picture (specification 6.12): where they fit, forced ones first,
// by the settings of the group "Labels".
import { keyId, type Key } from '../core/index.ts';
import { plane } from '../model/depth.ts';
import type { FrameState } from './frame.ts';
import { placeLabels, type LabelPosition } from './labels.ts';

export class LabelLayer {
  /** The labels drawn, for the snapshot. */
  placed: { key: Key; text: string }[] = [];
  private widths = new Map<string, number>();
  private font = '';

  clear() {
    this.placed = [];
  }

  /** Draws the labels at the device's pixel ratio, or at another for a picture. */
  draw(s: FrameState, canvas: HTMLCanvasElement, dpr = devicePixelRatio) {
    const g = s.gpu;
    const m = s.model;
    if (!g) return;
    const [w, h] = [Math.round(g.width * dpr), Math.round(g.height * dpr)];
    if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.placed = [];
    if (!m.graph || !m.laidOut) return;
    const set = m.settings;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const font = `${set.get('labels.weight')} ${set.get('labels.size')}px ${set.get('typography.family')}`;
    // Widths belong to a font.
    if (font !== this.font) [this.font, this.widths] = [font, new Map()];
    ctx.font = font;
    const snap = s.snapshot();
    const marks = set.get('labels.forced');
    const forced = new Set(
      [
        marks.includes('root') ? m.root : null,
        marks.includes('target') ? m.target : null,
        marks.includes('inspected') && m.inspected?.kind === 'unit' ? m.inspected.key : null,
        ...(marks.includes('path') ? (m.activePath() ?? []) : []),
      ]
        .filter((k): k is Key => k !== null)
        .map(keyId),
    );
    const least = set.get('labels.minOpacity');
    const minFilter = set.get('labels.minFilter');
    const margin = { x: set.get('labels.screenMargin.x'), y: set.get('labels.screenMargin.y') };
    const opacity = m.overrides.opacity;
    const order: number[] = [];
    for (let i = 0; i < m.ids.length; i++) {
      const v = snap.st[i];
      const sc = snap.screen[i];
      // Units the filters hide have no label; faded ones keep theirs while they are opaque enough.
      // The tolerance keeps a superseded unit, at 0.35 in single precision, a candidate.
      if (sc.behind || s.now(s.u.filterState, i, 2, 0) < minFilter) continue;
      if (!forced.has(m.ids[i]) && v.s.opacity * v.filter * opacity < least - 1e-6) continue;
      if (sc.x < -margin.x || sc.y < -margin.y || sc.x > g.width + margin.x || sc.y > g.height + margin.y) continue;
      order.push(i);
    }
    const planeOf = (i: number) => (m.degrees ? plane(m.degrees[i], s.rules.depth) : 0);
    const rules = {
      forced: (p: number, q: number) => +forced.has(m.ids[q]) - +forced.has(m.ids[p]),
      plane: (p: number, q: number) => planeOf(p) - planeOf(q),
      relations: (p: number, q: number) => s.relationsPer[q] - s.relationsPer[p],
    };
    const by = set.get('labels.order').map((k) => rules[k]);
    order.sort((p, q) => {
      for (const f of by) {
        const d = f(p, q);
        if (d) return d;
      }
      return 0;
    });
    const showKey = set.get('labels.text') === 'key';
    const clear = set.get('labels.minReach');
    const extra = s.rules.pointer.drawnExtra;
    const candidates = order.slice(0, set.get('labels.maxCandidates')).map((i) => ({
      index: i,
      x: snap.screen[i].x,
      y: snap.screen[i].y,
      r: Math.max(clear, s.unitReach(i, snap) - extra),
      text: s.labelText(i, showKey),
      forced: forced.has(m.ids[i]),
    }));
    const measure = (t: string) => {
      let v = this.widths.get(t);
      if (v === undefined) this.widths.set(t, (v = ctx.measureText(t).width));
      return v;
    };
    const tall = set.get('labels.boxHeight');
    const placement = {
      gap: set.get('labels.gap'),
      height: tall,
      side: set.get('labels.offset.side'),
      vertical: set.get('labels.offset.vertical'),
      positions: set.get('labels.positions') as LabelPosition[],
      cell: set.get('performance.labelGridCell'),
    };
    const byIndex = new Map(candidates.map((c) => [c.index, c]));
    const [halo, haloWidth] = [m.colour(set.get('labels.halo.colour')), set.get('labels.halo.width')];
    const [ink, plain] = [m.colour(set.get('labels.forcedColour')), m.colour(set.get('labels.colour'))];
    const boost = set.get('labels.opacityBoost');
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of placeLabels(candidates, measure, g.width, g.height, set.get('labels.maxPlaced'), [], placement)) {
      const c = byIndex.get(p.index)!;
      const v = snap.st[p.index];
      ctx.globalAlpha = Math.min(1, v.s.opacity * v.filter * opacity + boost);
      if (haloWidth > 0) {
        ctx.strokeStyle = halo;
        ctx.lineWidth = haloWidth;
        ctx.strokeText(c.text, p.box.x, p.box.y + tall / 2);
      }
      ctx.fillStyle = c.forced ? ink : plain;
      ctx.fillText(c.text, p.box.x, p.box.y + tall / 2);
      this.placed.push({ key: m.graph.units[p.index], text: c.text });
    }
    ctx.globalAlpha = 1;
  }
}
