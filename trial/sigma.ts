// Trial page for sigma.js 4 with graphology.
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { extremityArrow, layerPlain, pathLine } from 'sigma/rendering';
import type { Key } from '../module/core/index.ts';
import {
  animate, convexHull, COLOURS, fixture, id, nextFrame, relations, ringLayout, seededPositions, type TrialEngine,
} from './shared.ts';

const container = document.getElementById('stage') as HTMLDivElement;
const overlay = document.getElementById('overlay') as HTMLCanvasElement;
let sigma: Sigma | null = null;
let g = new Graph();
let ringCircles: { focus: Key; radii: number[] } | null = null;
let hullKeys: Key[] | null = null;
let hovered: string | null = null;

function drawOverlay() {
  const ctx = overlay.getContext('2d')!;
  const dpr = devicePixelRatio;
  overlay.width = container.clientWidth * dpr;
  overlay.height = container.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!sigma) return;
  // #fn rings
  if (ringCircles) {
    const c = engine.screen(ringCircles.focus);
    ctx.strokeStyle = COLOURS.ring;
    ctx.lineWidth = 1;
    for (const r of ringCircles.radii) {
      const f = g.getNodeAttributes(id(ringCircles.focus));
      const p = sigma.graphToViewport({ x: f.x + r, y: f.y });
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.hypot(p.x - c.x, p.y - c.y), 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  // #end
  // #fn hull
  if (hullKeys) {
    const hull = convexHull(hullKeys.map((k) => engine.screen(k)));
    ctx.fillStyle = COLOURS.hull + '22';
    ctx.strokeStyle = COLOURS.hull;
    ctx.beginPath();
    hull.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // #end
}

function addMidpoints(halves: boolean) {
  for (const n of g.filterNodes((_, a) => a.mid)) g.dropNode(n);
  for (const [a, b] of relations(currentGraph)) {
    const ia = id(a);
    const ib = id(b);
    if (!halves) {
      g.addEdgeWithKey(`${ia}\t${ib}`, ia, ib, { size: 1 });
      continue;
    }
    // #fn halves
    const m = `m:${ia}\t${ib}`;
    const pa = g.getNodeAttributes(ia);
    const pb = g.getNodeAttributes(ib);
    g.addNode(m, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, size: 0.01, color: 'rgba(0,0,0,0)', mid: true });
    g.addEdgeWithKey(`${ia}\t${ib}`, ia, m, { size: 1.5, head: 'arrow' });
    g.addEdgeWithKey(`${ib}\t${ia}`, ib, m, { size: 1.5, head: 'arrow' });
    // #end
  }
}

let currentGraph: Awaited<ReturnType<typeof fixture>>['graph'];

const engine: TrialEngine = {
  lastClick: null,
  async load(name, mode, halves) {
    const { graph } = await fixture(name);
    currentGraph = graph;
    sigma?.kill();
    ringCircles = hullKeys = null;
    g = new Graph();
    const start = seededPositions(graph);
    for (const k of graph.units) {
      const info = graph.unitInfo.get(id(k));
      const p = mode === 'given' && info?.pos ? { x: info.pos.x, y: -info.pos.y } : start.get(id(k))!;
      g.addNode(id(k), { ...p, size: 6, color: COLOURS.unit, label: info?.label ?? String(k) });
    }
    if (mode === 'force') {
      for (const [a, b] of relations(graph)) g.addEdge(id(a), id(b));
      forceAtlas2.assign(g, { iterations: 500, settings: forceAtlas2.inferSettings(g) });
      g.clearEdges();
    }
    addMidpoints(halves);
    const t0 = performance.now();
    // Sigma draws its first frame inside the constructor; the next frame shows it.
    const s = new Sigma(g, container, {
      primitives: { edges: { paths: [pathLine()], extremities: [extremityArrow()], layers: [layerPlain()] } },
      styles: {
        // #fn hover
        nodes: {
          x: { attribute: 'x' },
          y: { attribute: 'y' },
          size: { attribute: 'size' },
          label: { attribute: 'label' },
          color: (a, st, gs) => (gs.hasHighlighted && !st.isHighlighted && !a.mid ? COLOURS.dim : (a.color as string)),
        },
        // #end
        edges: { size: { attribute: 'size' }, color: COLOURS.half, head: { attribute: 'head', defaultValue: 'none' } },
      },
      settings: { enableEdgeEvents: true, edgePickingPadding: 4, pickingDownSizingRatio: 1, renderLabels: name !== 'random-10k', stagePadding: 24 },
    });
    sigma = s;
    await nextFrame();
    const firstPictureMs = performance.now() - t0;
    s.on('afterRender', drawOverlay);
    s.on('clickEdge', ({ edge }) => (engine.lastClick = edge));
    s.on('doubleClickEdge', ({ edge }) => (engine.lastClick = edge));
    // #fn hover
    s.on('enterNode', ({ node }) => {
      hovered = node;
      const near = new Set([node]);
      for (const [a, b] of currentGraph.keypairs) {
        if (id(a) === node) near.add(id(b));
        if (id(b) === node) near.add(id(a));
      }
      for (const n of g.nodes()) s.setNodeState(n, { isHighlighted: near.has(n) });
      s.setGraphState({ hasHighlighted: true });
    });
    s.on('leaveNode', () => {
      hovered = null;
      for (const n of g.nodes()) s.setNodeState(n, { isHighlighted: false });
      s.setGraphState({ hasHighlighted: false });
    });
    // #end
    return { firstPictureMs };
  },
  // #fn zoom
  setCamera(zoom, angleDeg) {
    sigma!.getCamera().setState({ ratio: 1 / zoom, angle: (angleDeg * Math.PI) / 180 });
    sigma!.refresh();
  },
  // #end
  async frameRelation(a, b, lengthPx) {
    const s = sigma!;
    s.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
    s.refresh();
    const pa = engine.screen(a);
    const pb = engine.screen(b);
    const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const mid = s.viewportToFramedGraph({ x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 });
    s.getCamera().setState({ x: mid.x, y: mid.y, ratio: len / lengthPx });
    s.refresh();
    await nextFrame();
  },
  screen(key) {
    const a = g.getNodeAttributes(id(key));
    return sigma!.graphToViewport({ x: a.x, y: a.y });
  },
  // #fn rings
  async rings(focus) {
    const spacing = 10;
    const layout = ringLayout(currentGraph, focus, spacing);
    for (const [k, p] of layout) g.mergeNodeAttributes(k, { x: p.x, y: -p.y });
    addMidpoints(true);
    const depth = Math.max(...[...layout.values()].map((p) => p.ring));
    ringCircles = { focus, radii: Array.from({ length: depth }, (_, i) => (i + 1) * spacing) };
    sigma!.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
    sigma!.refresh();
    await nextFrame();
    const c = engine.screen(focus);
    const f = g.getNodeAttributes(id(focus));
    const p = sigma!.graphToViewport({ x: f.x + spacing, y: f.y });
    return { circles: ringCircles.radii.length, spacingPx: Math.hypot(p.x - c.x, p.y - c.y) };
  },
  // #end
  // #fn hull
  async hull(keys) {
    hullKeys = keys;
    sigma!.refresh();
    await nextFrame();
    return { drawn: true };
  },
  // #end
  highlighted() {
    if (!hovered) return [];
    return currentGraph.units.filter((k) => sigma!.getNodeState(id(k)).isHighlighted);
  },
  frames(kind) {
    const cam = sigma!.getCamera();
    cam.setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
    return animate((t) => {
      if (kind === 'zoom') cam.setState({ ratio: 1 / Math.pow(8, t) });
      else cam.setState({ angle: 2 * Math.PI * t });
    });
  },
};

(window as unknown as { trial: TrialEngine }).trial = engine;
document.body.dataset.ready = 'true';
