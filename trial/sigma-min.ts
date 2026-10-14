// The smallest sigma.js page that draws a graph, for the compressed size.
import Graph from 'graphology';
import Sigma from 'sigma';
const g = new Graph();
g.addNode('1', { x: 0, y: 0, size: 6 });
g.addNode('2', { x: 1, y: 1, size: 6 });
g.addEdge('1', '2');
new Sigma(g, document.getElementById('stage') as HTMLElement);
