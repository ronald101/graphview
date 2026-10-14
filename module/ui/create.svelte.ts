// createGraphView: mounts the component for hosts that do not use Svelte (specification D1).
import { mount, unmount } from 'svelte';
import GraphView from './GraphView.svelte';
import type { GraphViewCommands, GraphViewProps } from '../types.ts';

export type GraphViewHandle = GraphViewCommands & {
  /** Replaces some of the inputs. */
  update(props: Partial<GraphViewProps>): void;
  destroy(): void;
};

export function createGraphView(target: HTMLElement, props: GraphViewProps): GraphViewHandle {
  const state = $state({ ...props });
  const instance = mount(GraphView, { target, props: state }) as unknown as GraphViewCommands;
  return {
    fit: (t) => instance.fit(t),
    flyTo: (k) => instance.flyTo(k),
    rotateTo: (a) => instance.rotateTo(a),
    setLayout: (l) => instance.setLayout(l),
    showPaths: (f, t, e) => instance.showPaths(f, t, e),
    spotlight: (...a) => instance.spotlight(...a),
    play: () => instance.play(),
    pause: () => instance.pause(),
    step: (d) => instance.step(d),
    seek: (f) => instance.seek(f),
    exportPicture: (o) => instance.exportPicture(o),
    getViewState: () => instance.getViewState(),
    setViewState: (p) => instance.setViewState(p),
    getScene: () => instance.getScene(),
    update(next) {
      Object.assign(state, next);
    },
    destroy() {
      void unmount(instance);
    },
  };
}
