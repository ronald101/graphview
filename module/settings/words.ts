// The viewer's words, as the settings of the group "Words" start: placeholders in braces stand for the
// values the viewer fills in (specification 7.8 and 6.14).

export const ISSUE_TEMPLATES: Record<string, string> = {
  'bad-row': 'Row {row} of {list} is not a valid row.',
  'bad-key': 'Row {row} of {list} has a key that is not valid.',
  'repeated-key': 'Row {row} of vertices repeats the key {key}.',
  loop: 'Row {row} of edges joins {from} to itself.',
  'unknown-unit': 'Row {row} of edges names a unit that does not exist: {from} to {to}.',
  'repeated-keypair': 'Row {row} of edges repeats the keypair {from} to {to}.',
  'missing-reverse': 'The keypair from {from} to {to} has no reverse.',
  orphan: 'The unit {unit} takes part in no relation.',
  'fingerprint-mismatch': 'The stated fingerprint differs from the data.',
  'interface-ends': 'The interface {unit} joins {ends}, not 2.',
  'interface-pair': 'The interfaces {a} and {b} are related directly; an interface joins two plain units.',
  'direct-relation': 'The units {a} and {b} are related directly; every relation runs through an interface.',
};

export const LIVE_TEMPLATES: Record<string, string> = {
  graphLoaded: 'Graph loaded: {units}',
  mode2d: '2D view',
  mode3d: '3D view',
  root: 'Root {unit}',
  rootCleared: 'Root cleared',
  pathCleared: 'Path cleared',
  noPath: 'No path from {from} to {to}',
  shortest: 'Shortest path from {from} to {to}: {steps}',
  inspectorCleared: 'Inspector cleared',
  inspectUnit: 'Inspecting unit {unit}',
  inspectInterface: 'Inspecting interface {unit}',
  inspectKeypair: 'Inspecting keypair from {from} to {to}',
  inspectRelation: 'Inspecting relation between {a} and {b}',
};

export const REFUSAL_TEXTS: Record<string, string> = {
  source: 'The graph could not be read: {reason}.',
  'not-object': 'The file is not a JSON object.',
  format: 'The file is not in the format graphview-graph/1.',
  vertices: 'The file has no list of vertices.',
  edges: 'The file has no list of edges.',
};

export const CANVAS_NAME = 'Graph in {mode}: {units}, {relations}';

export const HINT_TEXTS: Record<string, string> = {
  '2d': 'Drag to pan, wheel to zoom.',
  '3d': 'Drag to turn, right-drag to pan, wheel to zoom.',
  more: 'Click a unit to make it the root; Shift-click another for paths.',
};
