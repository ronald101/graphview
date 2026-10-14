// The engine adapter for sigma.js 4 with graphology (chosen by the trial, docs/engine-trial.md).
import Graph from 'graphology';
import Sigma from 'sigma';
import { extremityArrow, layerPlain, pathCurved, pathLine } from 'sigma/rendering';
import type { Engine, EngineCamera, EngineSegment, EngineUnit } from './types.ts';

const UNIT_RADIUS = 6;
const MID = 'm:';

export function createSigmaEngine(container: HTMLElement, surface: () => string): Engine {
  const graph = new Graph({ multi: false, allowSelfLoops: false });
  const callbacks: (() => void)[] = [];
  // sigma's y axis points up; the module's points down.
  const toSigma = (x: number, y: number) => ({ x, y: -y });
  let extent = { minX: -1, minY: -1, maxX: 1, maxY: 1 };

  const sigma = new Sigma(graph, container, {
    primitives: {
      edges: { paths: [pathLine(), pathCurved()], extremities: [extremityArrow()], layers: [layerPlain()] },
    },
    styles: {
      nodes: {
        x: { attribute: 'x' },
        y: { attribute: 'y' },
        size: { attribute: 'size' },
        color: { attribute: 'color' },
        visibility: { whenData: { hidden: true }, then: 'hidden', else: 'visible' },
        backdropVisibility: { whenData: { mid: true }, then: 'hidden', else: 'visible' },
        backdropColor: () => surface(),
        backdropShadowBlur: 0,
        backdropShadowColor: 'rgba(0,0,0,0)',
        backdropPadding: 1.5,
        labelVisibility: 'hidden',
      },
      edges: {
        size: { attribute: 'size' },
        color: { attribute: 'color' },
        path: { attribute: 'path', defaultValue: 'line' },
        head: { attribute: 'head', defaultValue: 'none' },
        visibility: { whenData: { hidden: true }, then: 'hidden', else: 'visible' },
      },
    },
    settings: {
      renderLabels: false,
      enableEdgeEvents: false,
      enableCameraZooming: false,
      enableCameraPanning: false,
      enableCameraRotation: false,
      enableCameraMouseRotation: false,
      enableNodeDrag: false,
      zoomToSizeRatioFunction: () => 1,
      itemSizesReference: 'screen',
      stagePadding: 24,
      minCameraRatio: null,
      maxCameraRatio: null,
      hideEdgesOnMove: false,
      hideLabelsOnMove: false,
    },
  });
  sigma.on('afterRender', () => callbacks.forEach((c) => c()));

  const midOf = (relation: string) => MID + relation;
  function placeMid(relation: string, a: string, b: string) {
    const pa = graph.getNodeAttributes(a);
    const pb = graph.getNodeAttributes(b);
    const id = midOf(relation);
    const at = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    if (graph.hasNode(id)) graph.mergeNodeAttributes(id, at);
    else graph.addNode(id, { ...at, size: 0.01, color: 'rgba(0,0,0,0)', mid: true, a, b });
  }

  const engine: Engine = {
    setItems(units: EngineUnit[], segments: EngineSegment[]) {
      graph.clear();
      for (const u of units) {
        const p = toSigma(u.x, u.y);
        graph.addNode(u.id, { ...p, size: UNIT_RADIUS, color: u.color, hidden: u.hidden });
      }
      for (const s of segments) {
        const attrs = {
          size: s.width,
          color: s.color,
          hidden: s.hidden,
          path: s.shape === 'arc' ? 'curved' : 'line',
          head: s.shape === 'arc' ? 'arrow' : 'none',
        };
        if (s.shape === 'half') {
          placeMid(s.relation, s.from, s.to);
          graph.addEdgeWithKey(s.id, s.from, midOf(s.relation), attrs);
        } else graph.addEdgeWithKey(s.id, s.from, s.to, attrs);
      }
      sigma.setCustomBBox(bbox());
    },
    setPositions(positions) {
      for (const [id, p] of positions) if (graph.hasNode(id)) graph.mergeNodeAttributes(id, toSigma(p.x, p.y));
      graph.forEachNode((id, a) => {
        if (a.mid) placeMid(id.slice(MID.length), a.a, a.b);
      });
    },
    setStyles(units, segments) {
      for (const [id, s] of units) if (graph.hasNode(id)) graph.mergeNodeAttributes(id, s);
      for (const [id, s] of segments)
        if (graph.hasEdge(id)) graph.mergeEdgeAttributes(id, { color: s.color, size: s.width, hidden: s.hidden });
    },
    setExtent(e) {
      extent = e;
      sigma.setCustomBBox(bbox());
    },
    setCamera(c: EngineCamera) {
      const f = framed(c.x, c.y);
      sigma.getCamera().setState({ x: f.x, y: f.y, ratio: 1 / c.zoom, angle: (c.angle * Math.PI) / 180 });
    },
    project(x, y) {
      return sigma.graphToViewport(toSigma(x, y));
    },
    unproject(x, y) {
      const p = sigma.viewportToGraph({ x, y });
      return { x: p.x, y: -p.y };
    },
    scale() {
      const a = engine.project(0, 0);
      const b = engine.project(1, 0);
      return Math.hypot(b.x - a.x, b.y - a.y);
    },
    resize() {
      sigma.resize();
    },
    render() {
      sigma.refresh();
    },
    onRender(callback) {
      callbacks.push(callback);
    },
    canvases() {
      return [...container.querySelectorAll('canvas')];
    },
    destroy() {
      sigma.kill();
    },
  };

  function bbox() {
    const a = toSigma(extent.minX, extent.minY);
    const b = toSigma(extent.maxX, extent.maxY);
    return {
      x: [Math.min(a.x, b.x), Math.max(a.x, b.x)] as [number, number],
      y: [Math.min(a.y, b.y), Math.max(a.y, b.y)] as [number, number],
    };
  }
  /** Graph coordinates to sigma's framed coordinates, which its camera uses. */
  function framed(x: number, y: number) {
    return sigma.viewportToFramedGraph(sigma.graphToViewport(toSigma(x, y)));
  }

  return engine;
}
