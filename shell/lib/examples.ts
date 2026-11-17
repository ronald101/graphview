// The examples: every fixture, grouped as valid, broken and refused, then the shell's own (specification
// 8.10). The page holds only their list; each graph comes as JSON from the shell's route, as a host's
// data module serves it, and reaches the viewer through a JsonFileSource.
import { resolve } from '$app/paths';
import list from 'virtual:examples';
import { JsonFileSource } from '../../module/index.ts';

export interface Example {
  id: string;
  group: 'valid' | 'broken' | 'refused';
  name: string;
  description: string;
  units: number | null;
}

const REFUSED: Record<string, string> = {
  'load-error-not-object': 'The file is not a JSON object.',
  'load-error-format': 'The format field is wrong.',
  'load-error-vertices': 'The vertices are not a list.',
  'load-error-edges': 'The edges are not a list.',
};

export const examples: Example[] = list.map((e) => ({
  id: e.id,
  group: e.group,
  units: e.units,
  name: e.name ?? e.id.replace(/-/g, ' ').replace(/^./, (x) => x.toUpperCase()),
  description: e.description ?? REFUSED[e.id] ?? '',
}));

/** Where the shell serves an example's graph. */
export const exampleUrl = (id: string): string => resolve('/examples/[id].json', { id });

/** An example's graph as a source the viewer reads. */
export const exampleSource = (id: string) => new JsonFileSource(exampleUrl(id));

/** The document of an example. */
export const exampleDoc = (id: string): Promise<unknown> => exampleSource(id).load();
