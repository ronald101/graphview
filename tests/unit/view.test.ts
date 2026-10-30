// The viewer on a server (specification 7.9 and 8.17): GraphView renders without a browser, as a host's
// server-side rendering needs; the canvas, the model's graph and the settings start in the browser.
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { DocumentSource } from '../../module/model/source.ts';
import { MemorySettingsStore } from '../../module/settings/stores.ts';
import GraphView from '../../module/view/GraphView.svelte';

const triangle = {
  format: 'graphview-graph/1',
  vertices: [{ key: 1 }, { key: 2 }, { key: 3 }],
  edges: [
    { from: 1, to: 2 },
    { from: 2, to: 1 },
    { from: 2, to: 3 },
    { from: 3, to: 2 },
  ],
};

describe('§7.9 GraphView on a server', () => {
  test('it renders its bar, canvas and side bar without error, from a graph or a source', () => {
    for (const props of [
      { graph: triangle },
      { source: new DocumentSource(triangle, 'triangle'), settingsStore: new MemorySettingsStore() },
    ]) {
      const { body } = render(GraphView, { props });
      expect(body).toContain('role="toolbar"');
      expect(body).toContain('data-testid="canvas"');
      for (const title of ['Root and depth', 'Paths', 'Inspector', 'Filters', 'Types', 'Display', 'Data issues'])
        expect(body).toContain(title);
      // No graph is loaded yet, so there is no rule banner, and the Settings dialog stays closed.
      expect(body).not.toContain('data-testid="rules-banner"');
      expect(body).not.toContain('gv-dialog-head');
    }
  });
});
