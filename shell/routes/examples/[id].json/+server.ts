// Each example's graph as JSON (specification 8.10 and 8.17), as a host's data module serves a graph to
// the viewer. The build writes every file; the page lists the examples and fetches the one chosen.
import { error } from '@sveltejs/kit';
import docs from 'virtual:example-docs';
import list from 'virtual:examples';

export const prerender = true;
export const trailingSlash = 'never';

export const entries = () => list.map((e) => ({ id: e.id }));

export function GET({ params }: { params: { id: string } }) {
  if (!Object.hasOwn(docs, params.id)) error(404, `No example called ${params.id}`);
  return new Response(JSON.stringify(docs[params.id]), { headers: { 'content-type': 'application/json' } });
}
