// Labels on their own canvas over the picture (specification 6.12): where they fit, forced ones first.
import { keyId, tokens, type Key } from '../core/index.ts';
import { plane } from '../model/depth.ts';
import type { FrameState } from './frame.ts';
import { LABEL_HEIGHT, placeLabels } from './labels.ts';

/** Labels show for units at least this opaque, at most this many at a time. */
const LABEL_OPACITY = 0.35;
const LABEL_LIMIT = 300;

export class LabelLayer {
  /** The labels drawn, for the snapshot. */
  placed: { key: Key; text: string }[] = [];
  private widths = new Map<string, number>();

  clear() {
    this.placed = [];
  }

  draw(s: FrameState, canvas: HTMLCanvasElement) {
    const g = s.gpu;
    const m = s.model;
    if (!g) return;
    const dpr = devicePixelRatio;
    const [w, h] = [Math.round(g.width * dpr), Math.round(g.height * dpr)];
    if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.placed = [];
    if (!m.graph || !m.laidOut) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const font = `400 12px 'Atkinson Hyperlegible Next', system-ui, sans-serif`;
    ctx.font = font;
    const snap = s.snapshot();
    const forced = new Set(
      [m.root, m.target, m.inspected?.kind === 'unit' ? m.inspected.key : null, ...(m.activePath() ?? [])]
        .filter((k): k is Key => k !== null)
        .map(keyId),
    );
    const order: number[] = [];
    for (let i = 0; i < m.ids.length; i++) {
      const v = snap.st[i];
      const sc = snap.screen[i];
      // Units the filters hide have no label; faded ones keep theirs while they are opaque enough.
      // The tolerance keeps a superseded unit, at 0.35 in single precision, a candidate.
      if (sc.behind || s.now(s.u.filterState, i, 2, 0) < 0.5) continue;
      if (!forced.has(m.ids[i]) && v.s.opacity * v.filter * m.overrides.opacity < LABEL_OPACITY - 1e-6) continue;
      if (sc.x < -50 || sc.y < -20 || sc.x > g.width + 50 || sc.y > g.height + 20) continue;
      order.push(i);
    }
    const planeOf = (i: number) => (m.degrees ? plane(m.degrees[i]) : 0);
    order.sort(
      (p, q) =>
        +forced.has(m.ids[q]) - +forced.has(m.ids[p]) ||
        planeOf(p) - planeOf(q) ||
        s.relationsPer[q] - s.relationsPer[p],
    );
    const candidates = order.slice(0, LABEL_LIMIT).map((i) => ({
      index: i,
      x: snap.screen[i].x,
      y: snap.screen[i].y,
      r: Math.max(4, s.unitReach(i, snap) - 2),
      text: m.label(m.graph!.units[i]),
      forced: forced.has(m.ids[i]),
    }));
    const measure = (t: string) => {
      let v = this.widths.get(t);
      if (v === undefined) this.widths.set(t, (v = ctx.measureText(t).width));
      return v;
    };
    const t = tokens[m.theme];
    const byIndex = new Map(candidates.map((c) => [c.index, c]));
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of placeLabels(candidates, measure, g.width, g.height)) {
      const c = byIndex.get(p.index)!;
      const v = snap.st[p.index];
      ctx.globalAlpha = Math.min(1, v.s.opacity * v.filter * m.overrides.opacity + 0.2);
      ctx.strokeStyle = t.surface;
      ctx.lineWidth = 3;
      ctx.strokeText(c.text, p.box.x, p.box.y + LABEL_HEIGHT / 2);
      ctx.fillStyle = c.forced ? t['ink-1'] : t['ink-2'];
      ctx.fillText(c.text, p.box.x, p.box.y + LABEL_HEIGHT / 2);
      this.placed.push({ key: m.graph.units[p.index], text: c.text });
    }
    ctx.globalAlpha = 1;
  }
}
