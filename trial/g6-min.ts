// The smallest G6 page that draws a graph, for the compressed size.
import { Graph } from '@antv/g6';
const g = new Graph({
  container: 'stage',
  data: { nodes: [{ id: '1', style: { x: 50, y: 50 } }, { id: '2', style: { x: 150, y: 150 } }], edges: [{ source: '1', target: '2' }] },
});
g.render();
