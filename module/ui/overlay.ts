// The 2D layer over the engine: rings, chevrons, missing halves, issue icons, state marks and labels (Part F).
import { keyId } from '../core/index.ts';
import { UNIT_RADIUS, type Controller } from './controller.ts';
import { SPACING } from './layouts.ts';
import { withAlpha } from './colour.ts';

/** Draws the overlay for the current picture. `scale` enlarges it for exported pictures. */
export function drawOverlay(ctx: CanvasRenderingContext2D, c: Controller, scale = 1) {
  const t = c.colours;
  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(scale, scale);
  if (!c.graph) {
    ctx.restore();
    return;
  }
  const pts = c.projectAll();
  const vis = c.visibility();
  c.layoutLabels(pts);
  const font = c.look.font;
  const onScreen = (p: { x: number; y: number }, m = 40) =>
    p.x > -m && p.y > -m && p.x < c.width + m && p.y < c.height + m;

  // Rings: thin circles numbered where they cross north on screen (F4).
  if (c.ring && c.view.layout.name === 'rings' && c.view.focus !== null) {
    const centre = pts.get(keyId(c.view.focus));
    const unit = c.pixelScale();
    if (centre) {
      ctx.strokeStyle = t.ring;
      ctx.lineWidth = 1;
      ctx.font = `400 12px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let k = 1; k <= c.ring.depth; k++) {
        const r = k * SPACING * unit;
        ctx.beginPath();
        ctx.arc(centre.x, centre.y, r, 0, 2 * Math.PI);
        ctx.stroke();
        const w = ctx.measureText(String(k)).width + 6;
        ctx.fillStyle = t.surface;
        ctx.fillRect(centre.x - w / 2, centre.y - r - 8, w, 16);
        ctx.fillStyle = t['ink-2'];
        ctx.fillText(String(k), centre.x, centre.y - r);
      }
      if (c.ring.beyondAt && c.ring.beyond.length) {
        const ids = c.ring.beyond.map(keyId).filter((id) => vis.get(id));
        const ps = ids.map((id) => pts.get(id)!).filter(Boolean);
        if (ps.length) {
          const minX = Math.min(...ps.map((p) => p.x));
          const minY = Math.min(...ps.map((p) => p.y));
          ctx.textAlign = 'left';
          ctx.fillStyle = t['ink-2'];
          ctx.fillText('beyond reach', minX - UNIT_RADIUS, minY - 18);
        }
      }
    }
  }

  // Missing halves and chevrons (A3, V18).
  const around = c.iconUnits();
  const path = c.pathLit();
  const attr = c.attrColours();
  const lit = c.lit();
  for (const g of c.relationGeometry(pts)) {
    const r = g.r;
    if (!vis.get(r.ia) || !vis.get(r.ib)) continue;
    if (!onScreen(g.pa, g.len) && !onScreen(g.pb, g.len)) continue;
    const mid = { x: (g.pa.x + g.pb.x) / 2, y: (g.pa.y + g.pb.y) / 2 };
    const faded = c.isBeyond(r.ia) || c.isBeyond(r.ib);
    for (const [from, to, pf, exists] of [
      [r.a, r.b, g.pa, r.ab],
      [r.b, r.a, g.pb, r.ba],
    ] as const) {
      const dx = mid.x - pf.x;
      const dy = mid.y - pf.y;
      const l = Math.hypot(dx, dy);
      if (l < 1) continue;
      const ux = dx / l;
      const uy = dy / l;
      if (!exists) {
        ctx.strokeStyle = t.issue;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(pf.x + ux * UNIT_RADIUS, pf.y + uy * UNIT_RADIUS);
        ctx.lineTo(mid.x, mid.y);
        ctx.stroke();
        ctx.setLineDash([]);
        issueIcon(ctx, mid.x, mid.y, t.issue, t.surface);
        continue;
      }
      if (c.look.relations.draw !== 'halves') continue;
      if (!c.showIcon(g.half, keyId(from), keyId(to), around)) continue;
      // An 8-pixel chevron in the middle of the half, pointing away from its own unit.
      const cx = pf.x + ux * (UNIT_RADIUS + (l - UNIT_RADIUS) / 2);
      const cy = pf.y + uy * (UNIT_RADIUS + (l - UNIT_RADIUS) / 2);
      const role = c.halfRole(from, to, false, path.keypairs, attr);
      let a = lit && !lit.keypairs.has(`${keyId(from)}\t${keyId(to)}`) ? 0.2 : faded ? 0.35 : 1;
      if (c.look.superseded === 'fade' && c.isKeypairSuperseded(from, to)) a = Math.min(a, 0.35);
      ctx.strokeStyle = withAlpha(c.roleColour(role, attr), a);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - ux * 4 - uy * 4, cy - uy * 4 + ux * 4);
      ctx.lineTo(cx + ux * 4, cy + uy * 4);
      ctx.lineTo(cx - ux * 4 + uy * 4, cy - uy * 4 - ux * 4);
      ctx.stroke();
    }
  }

  // Unit marks: issues, focus, selection, hover and pins (F4).
  const sel = new Set(c.view.selection.units.map(keyId));
  for (const k of c.graph.units) {
    const id = keyId(k);
    if (!vis.get(id)) continue;
    const p = pts.get(id);
    if (!p || !onScreen(p)) continue;
    if (c.issueUnits.has(id) && c.issues.some((i) => i.code === 'orphan' && keyId(i.key) === id)) {
      ctx.strokeStyle = t.issue;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_RADIUS + 3, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (c.view.focus !== null && keyId(c.view.focus) === id) {
      ctx.fillStyle = withAlpha(t['ink-1'], 0.12);
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_RADIUS + 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = t['ink-1'];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_RADIUS + 4, 0, 2 * Math.PI);
      ctx.stroke();
    }
    if (sel.has(id)) {
      ctx.strokeStyle = t['ink-1'];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_RADIUS + 1.5, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (c.hover.unit !== null && keyId(c.hover.unit) === id) {
      ctx.strokeStyle = t['ink-2'];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_RADIUS + 1, 0, 2 * Math.PI);
      ctx.stroke();
    }
    if (c.isPinned(id)) {
      ctx.strokeStyle = t['ink-1'];
      ctx.fillStyle = t['ink-1'];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 4, p.y - 4);
      ctx.lineTo(p.x + 9, p.y - 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x + 10, p.y - 10, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // Labels: upright, never closer than 2 pixels (V19). Selected labels in weight 700.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const l of c.labels) {
    const k = c.graph.units[l.index];
    const id = keyId(k);
    const bold = sel.has(id);
    const dim = lit && !lit.units.has(id);
    ctx.font = `${bold ? 700 : 400} 12px ${font}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = withAlpha(t.surface, 0.85);
    const text = c.labelText(k);
    const x = l.box.x;
    const y = l.box.y + l.box.h / 2;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = withAlpha(bold ? t['ink-1'] : t['ink-2'], dim ? 0.35 : 1);
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

/** The issue icon: a 12-pixel triangle with an exclamation mark (F4). */
export function issueIcon(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, ground: string) {
  ctx.fillStyle = colour;
  ctx.strokeStyle = ground;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x + 6, y + 5);
  ctx.lineTo(x - 6, y + 5);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.fillStyle = ground;
  ctx.fillRect(x - 0.75, y - 2.5, 1.5, 4);
  ctx.fillRect(x - 0.75, y + 2.5, 1.5, 1.5);
}
