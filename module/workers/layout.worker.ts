// Web worker for the force layout.
import { forceLayout, type ForceInput } from './force.ts';

self.onmessage = (e: MessageEvent<{ id: number; input: ForceInput }>) => {
  const out = forceLayout(e.data.input);
  (self as unknown as Worker).postMessage({ id: e.data.id, out });
};
