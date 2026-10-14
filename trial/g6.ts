// Trial page for G6 5 (AntV).
import { Graph as G6Graph, type GraphData, type NodeData } from '@antv/g6';
import type { Key } from '../module/core/index.ts';
import {
  animate, COLOURS, fixture, id, nextFrame, relations, ringLayout, seededPositions, type TrialEngine,
} from './shared.ts';

const container = document.getElementById('stage') as HTMLDivElement;
let graph: G6Graph | null = null;
let current: Awaited<ReturnType<typeof fixture>>['graph'];
let baseZoom = 1;
let hovered = false;
const centre = (): [number, number] => [container.clientWidth / 2, container.clientHeight / 2];

function data(positions: Map<string, { x: number; y: number }>, halves: boolean): GraphData {
  const nodes: NodeData[] = current.units.map((k) => {
    const p = positions.get(id(k))!;
    return { id: id(k), data: { label: current.unitInfo.get(id(k))?.label ?? String(k) }, style: { x: p.x, y: p.y } };
  });
  const edges: GraphData['edges'] = [];
  for (const [a, b] of relations(current)) {
    const ia = id(a);
    const ib = id(b);
    if (!halves) {
      edges.push({ id: `${ia}\t${ib}`, source: ia, target: ib });
      continue;
    }
    // #fn halves
    const pa = positions.get(ia)!;
    const pb = positions.get(ib)!;
    const m = `m:${ia}\t${ib}`;
    nodes.push({ id: m, data: { mid: true }, style: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, size: 0.1, fill: 'transparent' } });
    edges.push({ id: `${ia}\t${ib}`, source: ia, target: m, style: { endArrow: true } });
    edges.push({ id: `${ib}\t${ia}`, source: ib, target: m, style: { endArrow: true } });
    // #end
  }
  return { nodes, edges };
}

function create(d: GraphData, labels: boolean, layout?: object): G6Graph {
  return new G6Graph({
    container,
    width: container.clientWidth,
    height: container.clientHeight,
    animation: false,
    data: d,
    layout: layout as never,
    node: {
      style: {
        size: (n: NodeData) => (n.data?.mid ? 0.1 : 12),
        fill: (n: NodeData) => (n.data?.mid ? 'transparent' : COLOURS.unit),
        labelText: labels ? (n: NodeData) => (n.data?.mid ? '' : String(n.data?.label ?? '')) : undefined,
        labelFontSize: 12,
      },
      // #fn hover
      state: { inactive: { fill: COLOURS.dim }, active: { fill: COLOURS.unit, stroke: '#13222E', lineWidth: 2 } },
      // #end
    },
    edge: {
      style: { stroke: COLOURS.half, lineWidth: 1.5, endArrowSize: 6, increasedLineWidthForHitTesting: 8 },
    },
    // #fn hover
    behaviors: [
      { type: 'fix-element-size', enable: true },
      { type: 'hover-activate', degree: 2, state: 'active', inactiveState: 'inactive', onHover: () => (hovered = true), onHoverEnd: () => (hovered = false) },
    ],
    // #end
  });
}

const engine: TrialEngine = {
  lastClick: null,
  async load(name, mode, halves) {
    current = (await fixture(name)).graph;
    graph?.destroy();
    let positions = new Map<string, { x: number; y: number }>();
    if (mode === 'given') {
      for (const k of current.units) positions.set(id(k), current.unitInfo.get(id(k))!.pos!);
    } else {
      // Lay out with G6's own ForceAtlas2 first, so that the timing below covers drawing only.
      const start = seededPositions(current);
      const pre = create(data(start, false), false, { type: 'force-atlas2', preventOverlap: true, kr: 20 });
      await pre.render();
      for (const k of current.units) {
        const [x, y] = pre.getElementPosition(id(k));
        positions.set(id(k), { x, y });
      }
      pre.destroy();
    }
    const t0 = performance.now();
    graph = create(data(positions, halves), name !== 'random-10k');
    await graph.render();
    await graph.fitView({ when: 'always', direction: 'both' }, false);
    await nextFrame();
    const firstPictureMs = performance.now() - t0;
    baseZoom = graph.getZoom();
    (window as unknown as { g6: G6Graph }).g6 = graph;
    graph.on('edge:click', (e: { target: { id: string } }) => (engine.lastClick = e.target.id));
    return { firstPictureMs };
  },
  // #fn zoom
  setCamera(zoom, angleDeg) {
    const [cx, cy] = centre();
    graph!.zoomTo(baseZoom * zoom, false, [cx, cy]);
    graph!.rotateTo(angleDeg, false, [cx, cy]);
  },
  // #end
  async frameRelation(a, b, lengthPx) {
    const g = graph!;
    await g.rotateTo(0, false);
    const pa = engine.screen(a);
    const pb = engine.screen(b);
    const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    await g.zoomTo(g.getZoom() * (lengthPx / len), false, [(pa.x + pb.x) / 2, (pa.y + pb.y) / 2]);
    const qa = engine.screen(a);
    const qb = engine.screen(b);
    const [cx, cy] = centre();
    await g.translateBy([cx - (qa.x + qb.x) / 2, cy - (qa.y + qb.y) / 2], false);
    await nextFrame();
  },
  screen(key: Key) {
    const [x, y] = graph!.getViewportByCanvas(graph!.getElementPosition(id(key)));
    return { x, y };
  },
  // #fn rings
  async rings(focus) {
    const g = graph!;
    const spacing = 60;
    const layout = ringLayout(current, focus, spacing);
    await g.rotateTo(0, false);
    const positions = new Map([...layout].map(([k, p]) => [k, { x: p.x, y: p.y }]));
    const d = data(positions, true);
    const depth = Math.max(...[...layout.values()].map((p) => p.ring));
    for (let r = 1; r <= depth; r++) {
      d.nodes!.unshift({
        id: `ring${r}`,
        type: 'circle',
        data: { mid: true },
        style: { x: 0, y: 0, size: 2 * r * spacing, fill: 'transparent', stroke: COLOURS.ring, lineWidth: 1, zIndex: -1 },
      });
    }
    g.setData(d);
    await g.render();
    await g.fitView({ when: 'always', direction: 'both' }, false);
    await nextFrame();
    const c = engine.screen(focus);
    const [x, y] = g.getViewportByCanvas([spacing, 0]);
    return { circles: depth, spacingPx: Math.hypot(x - c.x, y - c.y) };
  },
  // #end
  // #fn hull
  async hull(keys) {
    graph!.setPlugins([{ type: 'hull', key: 'viewpoints', members: keys.map(id), fill: COLOURS.hull, fillOpacity: 0.13, stroke: COLOURS.hull }]);
    await graph!.draw();
    await nextFrame();
    return { drawn: graph!.getPluginInstance('viewpoints') !== undefined };
  },
  // #end
  highlighted() {
    if (!hovered) return [];
    return current.units.filter((k) => graph!.getElementState(id(k)).includes('active'));
  },
  frames(kind) {
    const g = graph!;
    const [cx, cy] = centre();
    g.zoomTo(baseZoom, false, [cx, cy]);
    g.rotateTo(0, false, [cx, cy]);
    return animate((t) => {
      if (kind === 'zoom') g.zoomTo(baseZoom * Math.pow(8, t), false, [cx, cy]);
      else g.rotateTo(360 * t, false, [cx, cy]);
    });
  },
};

(window as unknown as { trial: TrialEngine }).trial = engine;
document.body.dataset.ready = 'true';
