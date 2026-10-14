# graphview: specification for release 1

Version 1.0, 14 October 2026. Written by the master session of the project "value Rosetta refactor" for Claude Code on the web, and for Ronald, owner of Heart of Gold (HoG). It turns "graphview: review and proposal", version 0.4, into a contract. Ronald accepted that proposal in full on 14 October 2026. He also asked that Claude Code finishes without asking him, which changes two points of the proposal. Claude Code chooses the drawing engine by a fixed rule (Part H). It works in auto mode instead of plan mode.

**Identity.** The contract for graphview's first release: what the module and the shell must do, how they must look, and the checks that decide when the work is done.

**Gist.** graphview is a graph viewer in two parts: a reusable module that draws a graph, and a run shell around it. The module reads Rosetta data in one format and shows every relation as one line in two halves, one half per direction. A person can pan, zoom, rotate, focus, select, search, and list the paths between two units. The module computes only aids for exploring and repairs nothing; it shows data issues instead. Test graphs with expected answers, fixed before any code exists, decide whether the build is right.

**Summary.**
- *Format and rules.* One JSON format carries units and keypairs. Loading follows exact rules, lists each data issue in a fixed order, and computes a fingerprint. A Python reference computes the expected answers, and the module must match them exactly (Parts A to C).
- *Interface.* The module takes four groups of inputs, sends ten events and accepts ten commands. A read-only scene lets tests check the picture without knowing the engine (Part D).
- *Release 1.* Twenty-three view functions in four groups: navigate, arrange, focus and filter, encode and explain. Each comes with its checks (Part E).
- *Look.* Slate greys for structure, three hues for meaning, one reserved colour for issues, the typeface Atkinson Hyperlegible Next, and numbered rings around the focus as the one bold element (Part F).
- *Shell, engine and build.* The shell loads, generates, breaks rules on purpose, and saves (Part G). A trial of sigma.js and G6 picks the engine by a fixed rule (Part H). The repository layout, tools and builds are fixed (Part I).
- *Gates.* Twenty gates decide when release 1 is done; release 2 and later stay out (Parts J and K).

---

## Part A. Words and rules

**A1. Each word names one thing, and the code uses the same words.**
- A *unit* is what a key identifies; the format calls its rows vertices. A *key* is a unit's identifier: a non-empty text or a whole number.
- A *keypair* is one edge row, from one unit to another. A *relation* joins two units by the keypairs in both directions, (a, b) and (b, a).
- A *half* is the part of a relation's line that shows one keypair. Seen from a unit, a keypair is *outgoing* or *incoming*: (a, b) is outgoing for a and incoming for b.
- A *path* is a sequence of units, each joined to the next by a keypair in its direction, that visits no unit twice. Its *length* is its number of steps. The *path set* of two units holds their paths from the shortest length d up to d + n, where n is the number of *extra steps*.
- The *focus* is the unit at the centre of attention, and the *radius* a number of steps around it. The *rings* group units by their steps from the focus.
- The *stored graph* is everything loaded. The *current graph* is the stored graph without superseded units and keypairs.
- An *issue* is a finding about the data, such as a keypair without its reverse. The *fingerprint* is a hash that identifies a graph's units and keypairs.
- A *host* embeds the module: the shell, graphmath or HoG. The *engine* is the drawing library under the module. An *overlay* is a result a host lays over the graph. The *view state* is everything that decides the picture apart from the data. The *scene* is a read-only description of the picture, for tests.

**A2. Rosetta's five frozen rules define valid data, and the module shows every breach without repairing it.**
1. Units and keys match one to one.
2. A keypair joins two different units, and each keypair occurs once.
3. Every keypair (a, b) has its reverse (b, a).
4. Every unit takes part in at least one relation.
5. Nothing is deleted; units and keypairs are superseded instead.

Generated graphs obey rules 1 to 4 unless the person breaks them on purpose (Part G). Rule 5 gives each graph two views, the stored graph and the current graph (B4).

**A3. The half next to a unit shows that unit's outgoing keypair.** Ronald fixed this rule on 14 October 2026. The line between units a and b splits at its midpoint. The half touching a shows (a, b), and the half touching b shows (b, a). Each half carries a small chevron in its middle, pointing away from its own unit.

---

## Part B. The format, the issues and the fingerprint

**B1. One JSON format, "graphview-graph/1", carries a graph.** This example holds one relation with attributes of its own on each keypair:

```json
{
  "format": "graphview-graph/1",
  "meta": { "name": "Two units", "description": "One relation", "fingerprint": "sha256:96a576fab450b52c4c183d8ea58a5b1706722dca0e30502bb975e6e31189d9e0" },
  "vertices": [
    { "key": 1, "label": "Project", "pos": { "x": 0, "y": 0 } },
    { "key": 2, "label": "Subject", "attrs": { "archetype": 11 } }
  ],
  "edges": [
    { "from": 1, "to": 2, "attrs": { "type": "about", "weight": 1.0 } },
    { "from": 2, "to": 1, "attrs": { "type": "has_engagement", "weight": 0.1 } }
  ]
}
```

- `format` is required and must be exactly "graphview-graph/1".
- `meta` is optional. It may hold `name`, `description` and `source` as texts; `fingerprint`, checked as B3 says; `rosetta`, where false marks "not Rosetta data"; and `generator`, `params` and `seed` for generated graphs. Other fields are kept and ignored.
- `vertices` is a required list. A row holds `key` (required), and optionally `label` (text), `attrs` (an object of any JSON values), `pos` (an object with numbers `x` and `y`, in graph coordinates with y pointing down), and `superseded` (true or false).
- `edges` is a required list. A row holds `from` and `to` (required keys), and optionally `attrs` and `superseded`.
- A key is a non-empty text without lone surrogate characters, or a whole number from −(2^53 − 1) to 2^53 − 1. The number 1 and the text "1" are different keys. A JSON number with an integral value, such as 1.0, counts as that whole number.
- The module compares keys exactly and never sorts or computes with them, except for the fingerprint. It shows a unit's label when there is one, and its key otherwise.
- The module keeps each keypair's attributes apart and never merges the attributes of a relation's two keypairs.

**B2. Loading either refuses the whole file or accepts rows one by one, and lists every issue in a fixed order.** The module refuses a file, draws nothing, and shows the reason, in four cases:

| Code | When |
|---|---|
| not-object | the file is not a JSON object |
| format | `format` is not exactly "graphview-graph/1" |
| vertices | `vertices` is not a list |
| edges | `edges` is not a list |

Otherwise the checks run in this order, and each row gets at most one row issue, the first that applies:
1. Vertex rows, in file order: `bad-row` (not an object, or no `key`), then `bad-key` (the key is not valid), then `repeated-key` (an earlier accepted row has the same key). A row that passes becomes a unit.
2. Edge rows, in file order: `bad-row` (not an object, or no `from` or no `to`), then `bad-key`, then `loop` (from equals to), then `unknown-unit` (from or to is not an accepted unit), then `repeated-keypair` (an earlier accepted row has the same from and to). A row that passes becomes a keypair.
3. `missing-reverse` for each accepted keypair (a, b) without an accepted (b, a), in keypair order.
4. `orphan` for each unit that no accepted keypair touches, in unit order.
5. `fingerprint-mismatch` when `meta.fingerprint` is a text that differs from the stored fingerprint.

Each issue is a plain object, exactly as in the files under fixtures/expected. Rows count from 0.
- Row issues: `{ "code", "list": "vertices" | "edges", "row" }`, plus `"key"` for repeated-key and `"keypair": [from, to]` for loop, unknown-unit and repeated-keypair.
- `{ "code": "missing-reverse", "keypair": [a, b] }`, `{ "code": "orphan", "key": k }`, and `{ "code": "fingerprint-mismatch", "stated": text }`.

The module draws what it accepted. A keypair without its reverse draws its own half; the missing half appears dashed in the issue colour. An orphan unit gets a dashed outline in the issue colour. Rows that were not accepted appear only in the issues panel.

**B3. The fingerprint identifies a graph by its accepted units and keypairs only.** Labels, attributes, positions and superseded marks do not count. The algorithm, "graphview-fp/1":
1. Write each key as JSON text: a whole number in plain decimal, and a text as `JSON.stringify` writes it.
2. Build the lines: "graphview-fp/1"; "U " followed by the number of units; each unit's key text; "K " followed by the number of keypairs; each keypair as its from-text, a tab, and its to-text.
3. Sort the unit lines, and separately the keypair lines, by Unicode code points. JavaScript's default sort compares UTF-16 code units and puts "😀" before "ﬀ"; the text-keys fixture catches that mistake.
4. Join the lines with "\n", add a final "\n", encode as UTF-8, hash with SHA-256, and write "sha256:" followed by 64 lowercase hexadecimal digits.

For the pair fixture the text is `"graphview-fp/1\nU 2\n1\n2\nK 2\n1\t2\n2\t1\n"`, and the fingerprint is the one in the example above. Implement SHA-256 inside the core in plain TypeScript, so that `fingerprint()` stays synchronous and needs no imports; the Web Crypto digest is asynchronous. [VERIFIED: an independent JavaScript implementation of B2 and B3, written from these rules, matched the reference on all 27 fixtures, 14 October 2026; wrong if the reference itself misreads a rule, which the gates would then carry]

**B4. Rule 5 gives two graphs, and one look setting chooses which one the module uses.** The current graph drops the superseded units, the superseded keypairs, and every keypair that touches a superseded unit. With `look.superseded` set to "show" or "fade", the module uses the stored graph, and draws superseded parts normally or faded. With "hide", it uses the current graph for the picture, the aids and the fingerprint. The superseded fixture checks both graphs.

**B5. The Python reference decides every expected answer.** The file fixtures/reference/graphview_reference.py implements B2 to C5 in plain Python. The files under fixtures/expected hold its answers for all 27 fixtures, and fixtures/MANIFEST.sha256 fixes every file under fixtures/. When this text and the reference disagree, the reference decides, and the disagreement goes into the report. Graphmath reuses the same reference and the same files.

---

## Part C. The aids the module computes

**C1. The module computes four aids on the graph in use, and nothing else.** Results that make claims come from hosts as overlays, from release 2 on. The core exports these functions; the gate tests call them by these names.

```ts
export type Key = string | number;
export interface Graph { units: Key[]; keypairs: [Key, Key][]; /* plus private fields */ }
export type LoadResult =
  | { ok: true; graph: Graph; issues: Issue[] }
  | { ok: false; code: 'not-object' | 'format' | 'vertices' | 'edges'; message: string };
export function loadGraph(doc: unknown): LoadResult;              // B2
export function currentGraph(graph: Graph): Graph;                // B4
export function fingerprint(graph: Graph): string;                // B3
export function relationCount(graph: Graph): number;              // complete relations
export function degrees(graph: Graph): { key: Key; relations: number; outgoing: number; incoming: number }[];
export function components(graph: Graph): { sizes: number[]; parts: Key[][] };
export function rings(graph: Graph, focus: Key): { rings: Key[][]; beyond: Key[] };
export function pathSet(graph: Graph, from: Key, to: Key, extra: number,
  limits?: { count?: number; list?: number; timeMs?: number }): PathSetResult;
```

`units` and `keypairs` list the accepted rows in file order.

**C2. Degrees count, per unit, its relations and its keypairs in each direction.** `relations` is the number of distinct units joined to it by a keypair in either direction. `outgoing` and `incoming` count its keypairs. The list follows unit order.

**C3. Components are the parts of the graph, ignoring direction.** `parts` lists them in the order of their first unit in the file, each with its units in file order. `sizes` lists their sizes, largest first.

**C4. Rings group units by steps from the focus, following keypairs in their direction.** The search is breadth first and takes each unit's outgoing keypairs in file order. Ring k holds the units k steps away; `beyond` holds the units the focus cannot reach. Under rule 3, direction makes no difference; in broken data it does, and the broken-missing-reverse fixture checks it.

**C5. A path set lists the simple paths between two units, by length, and stops at its limits.** Inputs: two units, the extra steps n (a whole number from 0 to 20), a count limit (default 10,000), a list limit per length (default 200), and a time limit (default 2,000 milliseconds).
1. Find d, the fewest steps from the first unit to the second, following keypairs in their direction. If the two units are the same, report the reason "same-unit". If the second cannot be reached, report "unreachable".
2. For each length L from d to d + n, in increasing order, find every path of exactly L steps. Search depth first from the first unit, taking each unit's outgoing keypairs in file order. Never revisit a unit, never pass through the second unit before the end, and extend only to units whose fewest steps to the second unit fit in the steps left.
3. Count every path found, and keep the first ones up to the list limit for each length.
4. Stop when the total count reaches the count limit, or when the time limit has passed. The length being counted then reports its count as "at least", and longer lengths are not reported.

```ts
interface PathSetResult {
  from: Key; to: Key; extra: number;
  shortest: number | null;                 // d, or null with a reason
  reason: 'same-unit' | 'unreachable' | null;
  lengths: { length: number; count: number; exact: boolean; paths: Key[][] }[];
  total: number;
  stopped: boolean;
  stoppedBy: 'count' | 'time' | null;
}
```

The module runs path sets in a web worker, so the page stays responsive. Two examples from the fixtures. In the database graph, from VIEWTEST_NOTE (key 79) to VIEWTEST_ACTION (key 77) with 4 extra steps, lengths 3 to 7 have 1, 1, 1, 3 and 4 paths. In the complete graph of nine units, from 1 to 2 with 7 extra steps, lengths 1 to 7 are exact: 1, 7, 42, 210, 840, 2,520 and 5,040 paths. Length 8 then reports "at least 1,340", because the count has reached 10,000. [VERIFIED: the reference's path sets equalled a brute-force count without pruning in 10,408 cases on the small fixtures, 14 October 2026; wrong if both share a misreading of C5]

---

## Part D. The module's interface

**D1. One Svelte 5 component and one plain function expose the module.** `GraphView` serves Svelte hosts; HoG and graphmath both use Svelte 5. `createGraphView(target, props)` mounts the same component for any other host, and returns an object with the commands of D7 and a `destroy()` function. Both come from module/index.ts, the module's only entry point, which also exports the core functions of C1 and the types of this part.

**D2. The module takes four groups of inputs, and only the graph is required.**

```ts
interface GraphViewProps {
  graph: unknown;                          // a graphview-graph/1 document (Part B)
  view?: Partial<ViewState>;               // D3
  overlays?: Overlay[];                    // D4: checked in release 1, drawn from release 2
  look?: Partial<Look>;                    // D5
  onselect?: (e: SelectEvent) => void;     // and the other nine events of D6
}
```

A new `graph` value replaces the graph with stable change (V11). A new `view` value merges into the current view state.

**D3. The view state is one object that a host can save, share and restore.**

```ts
interface ViewState {
  format: 'graphview-view/1';
  graph: string | null;                    // fingerprint of the graph in use when saved
  focus: Key | null;
  radius: number | null;                   // null means no limit
  beyond: 'fade' | 'hide';                 // what happens to units beyond the radius
  selection: { units: Key[]; keypairs: [Key, Key][] };
  camera: { x: number; y: number; zoom: number; angle: number };
  layout: {
    name: 'force' | 'rings' | 'circle' | 'grid' | 'given';
    seed: number;
    settings: Record<string, number | string | boolean>;
    pinned: { key: Key; x: number; y: number }[];
  };
  paths: { ends: [Key, Key] | null; extra: number; lit: { length: number; index: number } | null; showAll: number | null };
  filters: { hideLoneUnits: boolean };
  overlays: string[];                      // ids of overlays shown; release 2
  frame: number | null;                    // release 2
}
```

The camera's x and y are the graph coordinates of the view's centre. Zoom 1 shows the whole graph, and larger values zoom in. The angle is in degrees, clockwise, with 0 for north. The defaults: no focus, no radius, fade beyond, an empty selection, a camera that fits the graph, the force layout with seed 1 (the given layout when every unit has a position), no path ends with 2 extra steps, and lone units shown.

**D4. Overlays are checked in release 1 and drawn from release 2.**

```ts
interface Overlay {
  id: string; label: string;
  kind: 'set' | 'values' | 'groups' | 'path' | 'rings' | 'frames';
  items: unknown[]; badge?: string;
  graph: string;                           // fingerprint of the graph it was computed on
}
```

Release 1 accepts the list and compares each overlay's `graph` with the fingerprint of the graph in use. A mismatch is reported through the issues event as `{ "code": "overlay-mismatch", "overlay": id }`. Release 1 draws no overlays.

**D5. Look and behaviour settings shape the picture without changing the data.**

```ts
interface Look {
  theme: 'light' | 'dark' | 'system';
  tokens: Partial<Record<TokenName, string>>;     // F2's colour tokens; HoG passes its own
  font: string;                                   // a CSS font-family
  labels: { field: 'label' | 'key' | `attrs.${string}`; show: 'auto' | 'always' | 'never' };
  relations: {
    draw: 'halves' | 'arrows' | 'lines';
    icons: 'by-zoom' | 'always' | 'never';
    colour: 'neutral' | 'around-selection' | { attr: string };
  };
  superseded: 'show' | 'fade' | 'hide';
  gestures: { pan: boolean; zoom: boolean; rotate: boolean; dragUnits: boolean; keyboard: boolean };
  motion: 'on' | 'off' | 'system';
  panels: { details: boolean; paths: boolean; issues: boolean; key: boolean };
  limits: { pathCount: number; pathList: number; pathTimeMs: number; maxExtra: number };
}
```

The defaults: theme "system"; the tokens of F2; Atkinson Hyperlegible Next; labels from `label`, shown "auto"; relations as halves, icons by zoom, coloured around the selection; superseded parts faded; every gesture on; motion as the system asks; every panel on; limits 10,000, 200, 2,000 and 20. When halves are coloured by a keypair attribute, its three most frequent values take the three hues of F2 in order, and every other value takes the context grey. The key panel lists that mapping.

**D6. Ten events tell the host what happened.** Each is a callback prop that receives plain data.

| Event | When it fires | Payload |
|---|---|---|
| select | the selection changes | `{ units: Key[]; keypairs: [Key, Key][] }` |
| hover | the pointer enters or leaves a unit or a half | `{ unit: Key \| null; keypair: [Key, Key] \| null }` |
| activate | a double-click, or Enter, on a unit or a half | `{ unit: Key }` or `{ keypair: [Key, Key] }` |
| focus | the focus or the radius changes | `{ focus: Key \| null; radius: number \| null }` |
| camera | the camera moves, at most ten times a second | the camera of D3 |
| viewstate | 250 milliseconds after the last change to the view state | the view state of D3 |
| layoutsettled | a layout has finished | `{ name: string; positions: { key: Key; x: number; y: number }[] }` |
| pathset | a path set has been computed | the result of C5 |
| expandrequest | release 2; never fires in release 1 | — |
| issues | after loading, and when an overlay does not match | the issues of B2 and D4; for a refused file, one item `{ code: 'refused', refusal: code }` |

**D7. Ten commands let the host steer the module.** Each is a method of the component instance and of the object `createGraphView` returns.

| Command | Effect | Returns |
|---|---|---|
| `fit(target?: 'all' \| 'selection')` | shows all visible units, or the selection (V03) | `Promise<void>` |
| `flyTo(key)` | centres a unit (V05) | `Promise<void>` |
| `rotateTo(angle)` | turns the picture to an angle in degrees (V04) | `Promise<void>` |
| `setLayout(layout)` | runs a layout (V06 to V09) | `Promise<void>` |
| `showPaths(from, to, extra)` | opens the path explorer on two units (V17) | `Promise<PathSetResult>` |
| `spotlight(...)` | release 2 | `{ ok: false, reason: 'release-2' }` |
| `play()`, `pause()` | release 2 | `{ ok: false, reason: 'release-2' }` |
| `step(delta)`, `seek(frame)` | release 2 | `{ ok: false, reason: 'release-2' }` |
| `exportPicture({ scale?: 1 \| 2; background?: boolean })` | a PNG of the picture (V23) | `Promise<Blob>` |
| `getViewState()`, `setViewState(partial)` | reads or changes the view state | `ViewState`, `Promise<void>` |

The instance also has `getScene()` (D8). It is a reading aid for tests and hosts, not one of the ten commands.

**D8. The scene describes the picture in screen pixels, so that tests need no knowledge of the engine.**

```ts
interface Point { x: number; y: number }
interface Scene {
  graph: 'stored' | 'current'; fingerprint: string; width: number; height: number;
  camera: { x: number; y: number; zoom: number; angle: number };
  units: {
    key: Key; x: number; y: number; r: number; visible: boolean;
    state: { focus: boolean; selected: boolean; hovered: boolean; dimmed: boolean; faded: boolean;
             pinned: boolean; issue: boolean; superseded: boolean; ring: number | null };
    label: { text: string; visible: boolean; angle: number; box: { x: number; y: number; w: number; h: number } | null };
  }[];
  halves: {
    from: Key; to: Key; start: Point; end: Point; visible: boolean; missing: boolean;
    style: 'solid' | 'dashed';
    role: 'context' | 'outgoing' | 'incoming' | 'path' | 'issue' | `attr:${string}`;
    width: number; selected: boolean; hovered: boolean; icon: boolean; superseded: boolean; faded: boolean;
  }[];
  rings: { index: number; radius: number }[];
}
```

Coordinates are CSS pixels from the canvas's top left corner. A half runs from the edge of its own unit (`start`) to the middle of the line (`end`). The partner of a keypair without its reverse appears as a half with `missing: true`. The scene must match what is drawn, because the tests click at its coordinates and read its states.

---

## Part E. Release 1: twenty-three view functions

**E0. Each function has a behaviour and checks, and every check becomes a named automated test.** A test's name starts with the function's number, for example "V13 select: a click near a unit selects its outgoing keypair". Unless stated otherwise, the checks run in the browser tests against the shell's production build.

### Navigate: move the camera, never the data

**V01 Pan.** Drag the background, or press an arrow key while the canvas has keyboard focus; one press moves a tenth of the canvas. *Checks:* dragging 100 pixels to the right moves every unit 100 pixels to the right on screen (±2); an arrow key moves the camera; the camera event fires.

**V02 Zoom.** Turn the wheel or pinch around the pointer, press + or −, or use the buttons. Zoom stays between 0.25 and 40. *Checks:* the graph point under the pointer stays under it (±2 pixels); both limits hold.

**V03 Fit.** Show all visible units, or the selection, with a margin of 24 pixels. The move takes 400 milliseconds, or none when motion is off. *Check:* after fitting, every visible unit lies inside the canvas with the margin.

**V04 Rotate.** Drag with the right mouse button, press [ or ] to turn 15 degrees, or use the buttons; one button, and the key 0, return to north. Labels stay upright. *Checks:* after `rotateTo(90)`, a unit to the right of the centre appears below it; every visible label has angle 0; the camera event reports 90.

**V05 Fly to.** Move the camera so that a unit sits at the centre, zoomed in far enough to show its label. *Check:* after `flyTo(k)`, unit k sits at the canvas centre (±2 pixels) and its label is visible.

### Arrange: decide where units sit

**V06 Force layout.** ForceAtlas2, or the engine's equivalent, runs in a web worker from seeded starting positions, stops when it settles, and fires layoutsettled. *Checks:* the same graph, settings and seed give the same positions twice; another seed gives other positions; no position is missing or not a number; the random graph of 10,000 units settles within 30 seconds in the test browser.

**V07 Rings.** The focus sits at the centre, and ring k is a circle with k times the ring spacing as radius. The units of ring k sit on it, spread by angle, each near the angle of a unit in ring k − 1 that reaches it. Units beyond reach sit outside the last ring in a group labelled "beyond reach". The rings show as thin numbered circles. *Checks:* every unit's screen distance from the focus equals its ring's radius (±1 pixel); the ring numbers agree with C4 for every ring entry in fixtures/expected.

**V08 Circle and grid.** The circle layout puts the units on one circle in file order, clockwise from north. The grid layout fills rows of ⌈√n⌉ units in file order. *Check:* positions follow these rules.

**V09 Given positions.** Units take their `pos` from the data, or their pinned positions from the view state. A unit without either sits at the mean position of its placed neighbours plus a small seeded offset, or else on a circle around the rest. *Check:* the path-4 and grid-3x3 fixtures appear exactly as their positions say, up to scale (±1 pixel).

**V10 Pin.** Dragging a unit pins it where it is dropped, and layouts never move a pinned unit. The details panel unpins it. *Check:* after a drag and a new force layout, the unit has not moved (±1 pixel).

**V11 Stable change.** When the data or the settings change, units present before and after keep their places, and new units start near their placed neighbours. Changes take 500 milliseconds, or none when motion is off. *Check:* replacing path-4 with path-4 plus a fifth unit related to unit 4 leaves the four units in place (±1 pixel).

### Focus and filter: choose what to look at

**V12 Hover.** A hovered unit and its neighbours light up, and the rest dims. A hovered half lights up its keypair and the other half of its relation. *Check:* the scene's dimmed flags match the hovered unit's neighbourhood.

**V13 Select.** Click a unit, or click one half to select its keypair. Shift-click adds to the selection, and Escape clears it. With one unit selected, Tab steps through its keypairs, outgoing ones first and then incoming ones, each in file order; Enter activates the current one. When a half is shorter than 24 pixels on screen, a click on its line selects the whole relation, both keypairs. *Checks:* gate G11; Shift, Escape, Tab and Enter work as stated; the select and activate events fire with the right payloads.

**V14 Focus and radius.** "Focus here" in the details panel, or the key F with one unit selected, makes that unit the focus. A slider, or Shift with + and −, sets the radius. Units beyond the radius fade or hide, as `view.beyond` says. *Check:* in the database graph, with unit 1 as focus, radius 1 and beyond set to hide, exactly 6 units are visible.

**V15 Search.** A box finds units whose label or key contains the typed text, ignoring case, and offers up to 10 suggestions. Enter flies to the first and selects it; the key / opens the box. *Check:* typing "viewtest_n" offers VIEWTEST_NOTE, and Enter selects unit 79 and centres it.

**V16 Hide lone units.** A switch hides every unit that has no visible relation after the radius, the superseded setting and the other filters. *Checks:* in the broken-orphan fixture, unit 3 disappears; in two-pairs, no unit disappears.

**V17 Path explorer.** Choose two units: select one and Shift-click another, so that the selection holds exactly two units, or use "Paths from here". Set the extra steps from 0 to 6 with a slider, or with + and − while the panel has focus. The panel groups the paths by length, with counts, and says "at least N: counting stopped" when a limit stopped the count. Hovering a path lights it up, a click keeps it lit, and the arrow keys step through the list. "Show all" on a length lights every path of that length, and each relation's line grows wider with the number of those paths that use it. *Checks:* after `showPaths` with the ends and extra steps of each path entry in fixtures/expected, for the small fixtures and the database graph, the panel's counts equal the expected ones; the complete graph of nine shows the stop message; the pathset event carries the same numbers.

### Encode and explain: show what things mean

**V18 Relations in two halves.** Draw each relation as A3 says. At rest, halves take the context grey. Around a selected unit, its outgoing halves take the first hue and its incoming halves the second. Chevrons are 8 pixels long; they show when a half is at least 40 pixels long on screen, and always around the hovered or selected unit. Each half answers clicks over a width of 24 pixels. A missing half is dashed in the issue colour, with the issue icon at the line's middle. Two other drawings are available: "arrows", two curved arrows per relation, and "lines", one plain line per relation. A key panel explains the colours in use. *Checks:* gate G11; the scene's roles around a selected unit; the broken-missing-reverse fixture shows exactly one missing, dashed half.

**V19 Labels.** Labels show where they fit, and more appear as you zoom in. No two visible labels overlap; keep a gap of at least 2 pixels. The focus, the selection and the hovered unit always show their labels, and other labels give way. *Check:* in the database graph at three zoom levels, no two visible label boxes in the scene come closer than 2 pixels.

**V20 Details.** For a selected unit, the panel shows its key, label, relations, outgoing and incoming keypairs, ring when there is a focus, and attributes, with the buttons Focus here, Paths from here, and Pin or Unpin. For a selected keypair, it shows the relation's two keypairs side by side: from, to and attributes, with differing values marked. A click on the other column selects that keypair. *Check:* selecting the keypair from 76 to 80 in the database graph shows "about" and 1 against "has_engagement" and 0.1, both marked as differing.

**V21 Data issues.** The panel lists the issues in the order of B2, each with the issue icon, the issue in plain words, and its row or keys. A click on an issue that has something drawn flies to it. A refused file shows its reason instead of a picture. *Checks:* for every fixture, the panel lists exactly the expected issues in order; each refused fixture shows its code.

**V22 Themes.** Light, dark and "as the system", with the tokens of F2; switching takes effect at once. *Checks:* gate G15; the computed CSS custom properties equal the tokens in both themes.

**V23 Export.** Save the picture as a PNG at scale 1 or 2, with or without the background, and save the view state as a JSON file; a saved view state loads back. *Checks:* the PNG's size equals the canvas size times the scale; a view state saved and loaded again gives an equal view state and the same scene (±1 pixel).

---

## Part F. Look and feel

**F1. The picture stays quiet, so that meaning gets the colour.** The subject is the structure of Rosetta: keys and keypairs. The audience is Ronald first, building intuition for the mathematics, and later the users of HoG. The design direction is a chart instrument, like a navigator's plotting sheet: structure in slate greys on a calm surface, hairline guides, crisp type. The rings around the focus are the one bold element, drawn as numbered range rings. Leave out gradients, glow, drop shadows on graph marks, 3D effects and decorative motion. Leave out generic dashboard habits as well: grids of identical cards, labels in capitals, meta texts joined by middle dots, and arrows appended to button texts.

**F2. Thirteen colour tokens serve both themes, and the core exports them from module/core/tokens.ts.** The file exports `tokens` with a `light` and a `dark` map from token names to these values; the CSS custom properties are generated from it.

| Token | Role | Light | Dark |
|---|---|---|---|
| surface | the canvas | #F6F8F9 | #0F151A |
| plane | the shell's background | #EDF1F3 | #0A0F13 |
| panel | side panels | #FFFFFF | #141B21 |
| ink-1 | main text; focus and selection marks | #13222E | #E8EEF2 |
| ink-2 | secondary text, labels, ring numbers | #46596A | #A9B8C4 |
| muted | hints and notes | #5A6B7E | #8C9DAB |
| hairline | borders and dividers | #D5DDE2 | #24303A |
| ring | the rings around the focus | #7D8E9C | #5E7080 |
| context | units and halves at rest | #74859A | #7F909E |
| outgoing | first hue: a selected unit's outgoing halves | #2A78D6 | #3987E5 |
| incoming | second hue: its incoming halves | #EB6834 | #D95926 |
| path | third hue: lit paths | #17A070 | #199E70 |
| issue | reserved for data issues, always with an icon or a dash | #D03B3B | #D03B3B |

- Text tokens reach at least 4.5 to 1 against surface, plane and panel; mark tokens reach at least 3 to 1 against the surface. [VERIFIED by computation, 14 October 2026; gate G15 repeats the check]
- At most three hues mark categories at any time: outgoing, incoming and path, in that order. In a graph any two colours can meet, so every pair must stay distinct. These three pass every check of the data-visualisation colour validator on all pairs, in both themes, with colour-blind vision simulated. [VERIFIED by the validator against these surfaces, 14 October 2026; wrong if a later palette change skips the validator]
- The issue colour sits close to the incoming orange, so an issue is never shown by colour alone: dashes, the issue icon and the issues panel carry it.
- Focus and selection use shape and ink, never a hue.

**F3. One typeface, Atkinson Hyperlegible Next, keeps similar characters apart.** Its letterforms keep I, l and 1, and O and 0, distinct, and keys are exactly such strings. Install it from Fontsource as a package and serve it with the build; use no font service at run time. Use weights 400, 600 and 700, and tabular figures for counts and keys in panels. Graph labels are 12 pixels; interface text 14; panel headings 16 in weight 600; notes 12; nothing smaller than 11. Use sentence case everywhere. Inside HoG, the module takes HoG's font through `look.font`.

**F4. Marks are thin, and state shows through shape.**
- *Units:* circles of radius 6 pixels at every zoom, filled with the context grey, with a 1.5 pixel ring in the surface colour to separate them from lines.
- *Focus:* a 2 pixel ring in ink-1, 4 pixels outside the unit, with a soft halo of ink-1 at 12 percent opacity. *Selection:* a 3 pixel outline in ink-1 and a label in weight 700. *Hover:* a 2 pixel outline in ink-2.
- *Halves:* 1.5 pixels at rest and 3 when selected. Dimmed marks take 20 percent opacity; faded marks, superseded or beyond the radius, take 35 percent.
- *Pinned units* carry a small pin mark. *Lit paths* take the path hue at 3 pixels; "show all" widths run from 2 to 6 pixels by use.
- *Rings:* 1 pixel circles in the ring token, numbered in ink-2 at 12 pixels where each ring crosses north.
- *Issues:* 2 pixel dashes in the issue colour, and a 12 pixel icon, a triangle with an exclamation mark.

**F5. Motion only answers actions.** A layout change, a flight to a unit, a fit or a stable change may move the picture; nothing moves by itself. Moves last at most 400 milliseconds, 500 for a stable change, easing out. The force layout runs only when asked and stops when it settles. With motion "system", the module follows the system's request for reduced motion.

**F6. The shell puts controls on the left, the picture in the middle, and the module's panels on the right.**

```
┌──────────────────────────────────────────────────────────────────────┐
│ graphview   Load  Generate  Examples   Database graph, 81 units      │
├───────────────┬────────────────────────────────────┬─────────────────┤
│ Data          │                                    │ Details         │
│ Generate      │                                    │ Paths           │
│ Layout        │     the module's picture,          │ Key             │
│ Focus         │     rings around the focus         │ Data issues     │
│ Look          │                                    │                 │
│ Parameters    │          fit  zoom  rotate  north  │                 │
└───────────────┴────────────────────────────────────┴─────────────────┘
```

The header is 48 pixels high, the left column 280 pixels wide, and the right column 340. The canvas fills the rest, with its camera controls in its bottom right corner. Below a width of 960 pixels, the two columns become drawers. The header shows the graph's name with its numbers of units, relations and issues; write them as plain words, for example "81 units, 84 relations, no issues".

**F7. Every function works from the keyboard, and colour never carries meaning alone.**
- Keys on the canvas: Tab enters it; the arrows pan; + and − zoom; [ and ] rotate; 0 returns to north; F sets the focus; Shift with + and − sets the radius; Escape clears; Tab and Shift-Tab step through keypairs; Enter activates; / opens the search.
- The canvas has the role "application" and a name such as "Graph: 81 units, 84 relations". A polite live region announces changes in words, for example "Selected keypair from VIEWTEST_PROJECT to VIEWTEST_SUBJECT".
- The panels are plain HTML with headings, buttons and visible focus outlines.
- Roles differ by more than colour: chevron direction, dashes, icons and labels.
- The module follows the system's requests for reduced motion and for forced colours.

---

## Part G. The shell

**G1. The shell is a workbench around the module: it loads or generates a graph, and exposes every parameter.** It is a static single-page web app with no server. It uses the module only through module/index.ts.

**G2. Loading accepts a file, a dropped file, a web address, or an example.**
- A file picker and drag and drop read a graphview-graph/1 file.
- A web address is fetched in the browser. When the other server refuses (for example because of cross-origin rules), the shell says so and names the address.
- The Examples menu lists every fixture, grouped as valid, broken and refused, with its name and description. The build bundles the fixture files; it loads the random graph of 10,000 units only on demand.

**G3. Generating makes a graph from a family, its characteristics and a seed.** Every generated graph obeys rules 1 to 4: both keypairs of every relation, and no unit without a relation. Keys are the whole numbers 1 to n, and rows come in key order. The same family, parameters and seed give the same graph, and so the same fingerprint, in every browser. Record `generator: "graphview-gen/1"`, the family, the parameters and the seed in `meta`.

| Family | Parameters | How |
|---|---|---|
| Path | units n ≥ 2 | n − 1 relations in a row |
| Cycle | n ≥ 3 | a closed row |
| Star | n ≥ 2 | one centre, n − 1 leaves |
| Complete | 2 ≤ n ≤ 200 | every pair related |
| Grid | rows, columns ≥ 1, at least 2 units | neighbours in rows and columns |
| Tree | n ≥ 2, branching b ≥ 1 | each unit gets b children, breadth first |
| Separate components | parts c ≥ 1, units per part k ≥ 2 | c separate paths of k units |
| Random by size | n ≥ 2, relations m, parts c ≥ 1 | split the units over c parts as evenly as possible; give each part a random spanning tree; add random relations inside parts until m. Requires n ≥ 2c and n − c ≤ m ≤ the most the parts can hold |
| Random by degrees | a list of degrees | the configuration model; drop loops and repeats; join any unit left without a relation to a random unit; show the degrees reached next to the ones asked |
| Small world | n, neighbours k (even, ≥ 2), rewiring β from 0 to 1 | Watts–Strogatz; a rewired relation never becomes a loop or a repeat |
| Preferential growth | n, links per new unit m₀ ≥ 1 | Barabási–Albert: each new unit joins m₀ existing units, chosen with probability proportional to their relations |
| Communities | n, groups g, p-in, p-out | planted partition; join any unit left without a relation to a random unit of its group |

Choose one seeded random number generator, describe it in docs/decisions.md, and never change its output for a given seed under the same generator version. The shell shows the characteristics of every graph it holds: units, relations and components.

**G4. Breaking the rules on purpose makes test data for graphmath's rule switch.** The options: drop the reverse of a share of the relations, add keypairs with an unknown key, repeat rows, and add units without a relation. Such a graph gets `meta.rosetta: false`, and the shell shows the banner "Not Rosetta data". Its issues then appear exactly as B2 says.

**G5. A parameter panel shows every input of the module, and a change redraws at once.** It covers the view state and the look settings, as form controls, with a JSON view of the whole. A reset button restores the defaults.

**G6. The shell saves graphs and shares views.**
- *Save graph* downloads the rows exactly as held, broken rows included, with `meta.fingerprint` set to the stored fingerprint. Graphmath reads the same file.
- *Share link* puts the graph's source (an example's name or a web address) and the view state into the page address. Opening the address restores both. A generated graph travels as its generator, parameters and seed.

**G7. A bench page measures speed on the machine in front of it.** Under the address fragment `#bench`, it loads the database graph and the random graph of 10,000 units with given positions. It measures the time to the first picture, and the frame times while zooming from 1 to 8 and while rotating a full turn, each over 2 seconds. It shows the browser and the graphics information, so that Ronald can run it on his ThinkPad.

---

## Part H. The engine trial

**H1. A short trial of two engines decides the module's engine by a fixed rule.** The candidates are sigma.js 4, with graphology, and G6 5 from AntV, each in its latest stable version. Build each in a folder trial/<engine>/, as small pages that the trial's browser tests drive.

**H2. The trial draws two graphs and six functions in each engine.**
- *Graphs:* the database graph, laid out by each engine's force layout, and the random graph of 10,000 units, at its given positions.
- *Functions:* zoom; rotate; rings around a focus; hover with neighbours; one group drawn as a hull, the 26 units with keys 7 to 32, which are the viewpoint types; and relations in two clickable halves with direction icons, by the rule of A3.

**H3. The trial measures the same things in the same headless browser.**
- Time to the first picture: from handing the graph to the engine to the first drawn frame.
- Frame times, median and 95th percentile, while zooming from 1 to 8 and while rotating a full turn, each over 2 seconds of animation.
- Accuracy of halves: 100 clicks chosen by a fixed seed, at a quarter and three quarters along relations of the database graph, zoomed so that each half is at least 40 pixels long; the share that selects the right keypair.
- The JavaScript heap after loading the random graph, the compressed size of a minimal page, and the lines of code each function needed.

**H4. The rule picks the engine without asking anyone.**
1. Each engine must pass every one of these: all six functions work on the database graph, and the halves accuracy is 100 percent. An engine that fails any of them drops out.
2. If both remain, choose sigma.js, unless G6's median zoom frame time on the random graph is at most half of sigma.js's and G6's time to first picture is no worse. Then choose G6.
3. If neither remains, choose the engine that passed more of them; on a tie, choose sigma.js. List the missing items as open work in the report.

**H5. The trial leaves evidence, and then leaves the working branch.** Write docs/engine-trial.md with the measurements in a table, the rule's step that decided, and screenshots under docs/screenshots/trial/. Push the trial code as the branch engine-trial, then remove the folder trial/ from the working branch. The module hides the engine behind one adapter under module/engine/, so a later change of engine changes only that adapter. Ronald may overrule the choice after measuring on his ThinkPad with the bench page. The cloud machine has no graphics card, so the trial's speeds are relative. [INFERRED from the documented cloud machine: four processors and 16 GB of memory, no graphics card listed; WebGL 2 runs on software rendering in headless Chromium, VERIFIED in a container without a graphics card, 14 October 2026]

---

## Part I. Repository, tools and builds

**I1. One repository holds the module, the shell, the shared formats and the test graphs.**

```
CLAUDE.md                 standing rules for Claude Code
README.md                 what graphview is, how to run and embed it
docs/                     this specification, the run prompt, decisions, the trial, the report, screenshots
fixtures/                 test graphs, expected answers, the reference; read-only
module/index.ts           the module's only entry point
module/core/              pure TypeScript: format, issues, fingerprint, aids, tokens; no imports outside core
module/engine/            the one adapter to the drawing engine
module/ui/                the component, panels and controls
module/workers/           web workers for layouts and path sets
shell/                    the run shell: a static single-page app
trial/                    the engine trial, only until the decision
tests/gates/              gate tests fixed before the build; read-only
tests/unit/               unit and component tests
tests/e2e/                browser tests
scripts/                  the session start script and other helpers
.github/workflows/        checks on every push; publishing to GitHub Pages from main
.claude/settings.json     permissions and the session start hook for Claude Code
```

**I2. The tools are few, current and pinned.** Use the latest stable versions, at the time of the run, of Svelte 5, Vite, TypeScript, Vitest, Playwright Test, svelte-check and Prettier. Run TypeScript in strict mode with the module resolution "bundler"; the gate tests import the core as a folder. Add the chosen engine and its layout packages, the Fontsource package of Atkinson Hyperlegible Next, and @axe-core/playwright. Add no other runtime dependency without a reason recorded in docs/decisions.md. Pin exact versions, commit package-lock.json, and record the versions in docs/decisions.md.

**I3. The scripts are fixed, so that people and workflows run the same commands.**

| Script | Does |
|---|---|
| `npm run dev` | starts the shell for development |
| `npm run check` | svelte-check, `prettier --check`, and Vitest on tests/gates and tests/unit |
| `npm run build:module` | builds the module as a library into dist/module, with types and CSS |
| `npm run build:shell` | builds the shell as static files into dist/shell, for the base path /graphview/ |
| `npm run build` | both builds |
| `npm run e2e` | builds the shell, serves it with `vite preview` under /graphview/, and runs Playwright |
| `npm test` | `check`, then `e2e` |

**I4. The browser tests use Playwright's Chromium.** Install it with `npx playwright install --with-deps chromium`. In a cloud session, that download needs the environment's network to allow cdn.playwright.dev and playwright.download.prss.microsoft.com. If it fails with the system packages, try `npx playwright install chromium` and launch it. The session start script repeats the install in each new session.

**I5. Continuous checks and publishing are already set up.** .github/workflows/checks.yml runs `npm test` on every push and pull request, once package-lock.json exists. .github/workflows/pages.yml publishes dist/shell to GitHub Pages after each push to main, once package.json has the script build:shell. The shell's address will be https://ronald101.github.io/graphview/. Claude Code on the web cannot change files under .github/workflows; if a workflow needs a change, describe it in the report. [INFERRED from a public issue report about cloud sessions, closed as not planned in June 2026; wrong if GitHub access in cloud sessions has gained the workflow scope since]

---

## Part J. Gates and done

**J1. Twenty gates decide when release 1 is done.** Gates G0 to G8, G15 and G16 are test files under tests/gates, written and checked before any module code existed. They are read-only. The other gates are tests and records that Claude Code writes, following this specification.

| Gate | What it checks | Where |
|---|---|---|
| G0 | the fixture set holds 27 graphs | tests/gates/core.gate.test.ts |
| G1 | every file under fixtures/ matches its hash in the manifest; none is missing or extra | tests/gates/manifest.gate.test.ts |
| G2 | loading and issues equal the expected results, in order; refusals carry the expected code | tests/gates/core.gate.test.ts |
| G3 | the fingerprints of the stored and the current graph | tests/gates/core.gate.test.ts |
| G4 | counts and components of both graphs | tests/gates/core.gate.test.ts |
| G5 | degrees | tests/gates/core.gate.test.ts |
| G6 | rings, as sets per ring | tests/gates/core.gate.test.ts |
| G7 | path sets: shortest, reason, stop, total, counts by length, listed paths as sets, and the default limits | tests/gates/core.gate.test.ts |
| G8 | the database graph: 2,628 of 3,240 pairs have exactly one path within two extra steps | tests/gates/core.gate.test.ts |
| G9 | determinism: layouts and generators give the same result for the same seed | tests/unit |
| G10 | every generator family, over 200 seeds, gives graphs without issues and with the characteristics asked | tests/unit |
| G11 | the halves rule, below | tests/e2e |
| G12 | each function V01 to V23 has at least one passing browser test named after it | tests/e2e |
| G13 | every event fires with its payload; every command works; the release 2 commands answer `{ ok: false, reason: 'release-2' }` | tests/e2e |
| G14 | axe finds no serious or critical violation in the shell, in both themes; the keyboard map of F7 works | tests/e2e |
| G15 | the colour tokens equal F2, with their contrast | tests/gates/tokens.gate.test.ts |
| G16 | the module imports nothing outside module/; the core imports only the core and uses no browser globals; the shell reaches the module only through module/index.ts | tests/gates/boundaries.gate.test.ts |
| G17 | speed in the test browser: the database graph's first picture within 1 second; the random graph's first picture within 5 seconds at given positions; the complete graph of nine's path set answered within 2 seconds; median zoom frame time on the database graph within 50 milliseconds | tests/e2e, numbers in the report |
| G18 | both builds succeed, and every browser test runs against the shell's production build under /graphview/ | `npm run build`, `npm run e2e` |
| G19 | a visual review of eleven fixed views, below | docs/report.md and docs/screenshots/ |

**J2. Gate G11 tests the halves rule by clicking where the scene says.** The test covers every relation of the pair, triangle and path-4 fixtures, and 20 relations of the database graph chosen by a fixed seed. It runs at angles 0, 90 and 215 degrees, at a zoom where each half is at least 40 pixels long. There, a click a quarter of the way from unit a to unit b selects the keypair (a, b), and a click three quarters of the way selects (b, a). At a zoom where a half is shorter than 24 pixels, a click on the line selects both keypairs.

**J3. Gate G19 reviews eleven views by eye.** Take each screenshot, look at it, and judge it against Part F; fix what fails, and record a verdict and a note per view in the report.
1. The database graph, force layout, light theme.
2. The same in the dark theme.
3. Rings around unit 1, light.
4. The keypair from 76 to 80 selected, with the details panel, light.
5. The path explorer from 79 to 77 with 4 extra steps and one path lit, dark.
6. The broken-mixed fixture with the issues panel, light.
7. The superseded fixture with superseded parts faded, light.
8. The random graph of 10,000 units, whole, dark.
9. The shell's generate panel with a small-world graph, light.
10. The text-keys fixture with labels, light.
11. The shell at a width of 800 pixels, with its drawers, light.

**J4. Release 1 is done when four things hold.**
1. Every gate passes, or is marked "not testable" with a reason outside the code, such as a refused download.
2. docs/report.md gives, per gate, its result; per function, its tests; the measurements; the decisions; every deviation from this specification with its reason; and the list of screenshots.
3. A pull request from the working branch to main, titled "graphview release 1", carries the report's summary.
4. Nothing was pushed to main, and no file under fixtures/ or tests/gates/ was changed.

---

## Part K. Not in release 1

**K1. Release 2 and later stay out, but the interface already names them.**
- *Release 2:* minimap; history; tree from the focus; between two units; no overlap; box select, isolate and invert; common neighbours; expand on demand; overlays and legend; frames; spotlight.
- *Later:* the lens, 3D, the time slider and comparison panels.
- The commands spotlight, play and pause, step and seek answer `{ ok: false, reason: 'release-2' }`, and the event expandrequest never fires.
- No server, no database connection, and no editing of the graph's data.

---

## Sources

- "graphview: review and proposal", version 0.4, 14 October 2026, project "value Rosetta refactor": the view functions, parameters, look, engines and shell. Accepted by Ronald on 14 October 2026.
- "Rosetta foundation: rules register", version 0.3.0, 14 October 2026: the five frozen rules, and the names outgoing and incoming.
- databasedump.txt, the database dump of 24 July 2026: vertex rows 1 to 81 and edge rows 1 to 168, the source of the database graph fixture.
- Claude Code on the web: https://code.claude.com/docs/en/claude-code-on-the-web, https://code.claude.com/docs/en/cloud-environments, https://code.claude.com/docs/en/permissions and https://code.claude.com/docs/en/permission-modes, read 14 October 2026.
- Playwright downloads in cloud sessions: https://github.com/anthropics/claude-code/issues/15583. Workflow files in cloud sessions: issue 61189, mirrored at https://claudeissues.com/issue/61189-bug-claude-code-on-the-web-git-push-and-github-mcp-refuse-changes-under-github-w.
- GitHub Pages workflow and pinned action versions: https://vite.dev/guide/static-deploy.
- Near-shortest paths: T. H. Byers and M. S. Waterman, Operations Research 32 (1984) 1381–1384; W. M. Carlyle and R. K. Wood, Networks 46 (2005) 98–109. Counting simple paths is #P-complete: L. G. Valiant, SIAM Journal on Computing 8 (1979) 410–421.
- Colour checks: the data-visualisation validator of Claude's skills, all pairs, protanopia, deuteranopia and tritanopia simulated, and the WCAG contrast formula, 14 October 2026.
- Atkinson Hyperlegible Next: https://fontsource.org/fonts/atkinson-hyperlegible-next.
