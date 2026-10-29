# graphview: specifications

Version 4.0, 29 October 2026. One document for building graphview in one run.

**This document consolidates every specification of the project into one contract.** It joins the release 1 specification (version 1.0 of 14 October 2026), the two 3D specifications (docs/3d/01 and 02), the adjustments of 19 October 2026 (docs/3d/03-adjustments.md), and the choices made while building release 1 and the 3D viewer (decisions D1 to D54). Version 2.1 settles the differences between version 2.0 and the code that docs/spec_discrepancies.md lists; appendix C names the changes. Version 3.0 adds interface graphs and the extension points for other families of graphs; appendix D names the changes. Version 4.0 makes the viewer one self-contained component for a host that supplies only graphs as JSON: sources, settings with their controls and stores, the viewer's own bar and side bar, a drawing by perspectives, search, filter rules, highlights and scope. The shell becomes a SvelteKit app that simulates such a host; appendix E names the changes. Where those documents disagree, this one decides. It names no private data and no owner of private data.

**How to use it.** A builder who has this document, the fixtures and the gate tests can build graphview from an empty module and shell, without asking anything. Section 12 gives the order of work and the rules; section 11 says when the work is done.

---

## 1. Overview

### 1.1 What graphview is

**graphview is a graph viewer in 2D and 3D, with a public graph generator around it.** It has two parts. The _module_ is the viewer: it reads a graph from a source, holds its state in one model, keeps its settings, and draws the graph with WebGL, with its own bar, side bar and Settings dialog. The _shell_ is a SvelteKit app that simulates a host: it prepares graphs as JSON (examples, generated graphs, files and addresses), hands them to the viewer, and keeps the viewer's settings file on its server. A host supplies only graphs; everything else is the viewer's.

A graph is a JSON document of units and keypairs. A keypair runs from one unit to another; a keypair and its reverse make one relation. The viewer draws each relation as one line with one chevron per keypair.

The module repairs nothing. It lists every breach of the graph rules (2.2) as a data issue, and still draws what it accepted.

### 1.2 The parts

| Part     | Folder          | Does                                                                                                                                                  |
| -------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core     | module/core     | Format, loading and issues, fingerprint, degrees, components, rings, path sets, colour tokens. Pure TypeScript.                                       |
| Settings | module/settings | One class per kind of control, one instance per setting, the registry, the settings file and its stores. TypeScript with Svelte state.                |
| Model    | module/model    | The state of one viewer, its sources and contracts, and the rules for depth, filters, schema, types, layout, hulls, search, highlights and scope.     |
| Render   | module/render   | Draws the model with three.js: instanced shaders, transitions, camera, hulls, labels, picking, picture capture.                                       |
| View     | module/view     | The viewer component with its bar, side bar and Settings dialog; the canvas, the panels and the controls of the settings. Svelte 5.                   |
| Workers  | module/workers  | Force layout, distances and path sets off the main thread.                                                                                            |
| Server   | module/server   | The handler a host's settings route uses. Pure TypeScript.                                                                                            |
| Shell    | shell/          | The SvelteKit app that simulates a host: host tools (data and generator), the viewer page, the settings route, example graphs, bench and embed pages. |

### 1.3 Inputs that exist before the build

**Four inputs are fixed and read-only.** The builder never edits them.

1. fixtures/: 27 test graphs, their expected answers, an index and a manifest of hashes (11.1); in fixtures/reference, the Python reference that computed the answers, make_fixtures.py, which writes the files, and the sample graph's source.
2. tests/gates/: the gate tests G0 to G8, G15 and G16, written and checked before any module code existed.
3. CLAUDE.md: the standing rules for the builder (12.1). It names this document as the contract, with the words of 2.1 and the layout of 10.1.
4. .github/workflows/: checks on every push and pull request; publishing to GitHub Pages from main.

### 1.4 Out of scope

- No database connection, and no editing of a graph's units or keypairs. The module runs no server; it offers a handler that a host's settings route uses (5.10), and the shell's server routes only simulate a host.
- No overlays from hosts, minimap, history, lens, time player or comparison panels.
- No release-1 interface: no 2D engine, no events and commands of the old component (5.6).

---

## 2. Words and rules

### 2.1 Words

**Each word names one thing, and the code uses the same words.**

| Word                        | Meaning                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| unit                        | What a key identifies. The format calls its rows vertices.                                                                                      |
| kind, plain                 | A unit's kind: plain, or interface (3.8). A plain unit is one that is not an interface.                                                         |
| interface, end              | A unit of the interface kind; it joins two units, its ends (3.8).                                                                               |
| perspective                 | An interface's relation seen from one end toward the other, with its pair type when a profile names one (5.7).                                  |
| profile                     | What fits the module to a family of graphs: kinds, classes, pairs, checks, superseding, perspective types, a projection (5.7).                  |
| key                         | A unit's identifier: a non-empty text or a whole number.                                                                                        |
| keypair                     | One edge row, from one unit to another.                                                                                                         |
| relation                    | Two units joined by keypairs: (a, b), (b, a), or one of them in broken data. Drawn as one line.                                                 |
| outgoing, incoming          | Seen from a unit, (a, b) is outgoing for a and incoming for b.                                                                                  |
| chevron                     | The mark of one keypair on its relation's line.                                                                                                 |
| path                        | A sequence of units, each joined to the next by a keypair in its direction, that visits no unit twice. Its length is its number of steps.       |
| path set                    | The paths between two units, from the shortest length d up to d + n, where n is the number of extra steps.                                      |
| root                        | The unit the depth view centres on.                                                                                                             |
| focus                       | The unit the core's rings count from (4.4); in the viewer, the root.                                                                            |
| degree                      | A unit's fewest steps from the root; 0 for the root, −1 when the root cannot reach it. The core's `degrees()` counts something else (4.2).      |
| plane                       | A depth level behind the root, derived from the degree (6.4).                                                                                   |
| target                      | The unit the active paths run to, from the root.                                                                                                |
| stored graph, current graph | Everything loaded; and the stored graph without superseded parts (3.5).                                                                         |
| issue                       | A finding about the data, such as a keypair without its reverse.                                                                                |
| fingerprint                 | A hash that identifies a graph's units and keypairs (3.4).                                                                                      |
| type                        | A value of a unit's or a keypair's type field (6.6).                                                                                            |
| complement                  | The type of a keypair's reverse, paired with its own type (6.6).                                                                                |
| model                       | The one object that holds a viewer's state (5.2).                                                                                               |
| aspect                      | A named part of the model's state that changed (5.2).                                                                                           |
| scene                       | The renderer's read-only description of the picture, for tests (5.5).                                                                           |
| view settings               | What a saved file or link carries besides the data (5.3).                                                                                       |
| host                        | A program that embeds the module, such as the shell.                                                                                            |
| source                      | Where the viewer reads its graph: a JSON file or a document today, a host's interface later (5.8).                                              |
| setting                     | One value that changes the viewer, with a hard-coded default, its allowed values and its control (5.9).                                         |
| control                     | The kind of input that edits a setting: checkbox, slider, number, range, select, text, colour, theme colour, palette, order, set, keys or JSON. |
| settings file, store        | The settings that differ from their defaults, with the pins; and where the viewer keeps that file (5.9).                                        |
| pin                         | A setting shown in the side bar as well as in the Settings dialog (7.10).                                                                       |
| class unit                  | A unit its data marks as a class; the perspective drawing shows it as a box (3.9).                                                              |
| pair type                   | The type of a perspective, from the data or a profile (3.9).                                                                                    |
| drawing                     | How relations draw: by keypairs, or by perspectives (6.18).                                                                                     |
| selection, highlight group  | The units a person picked; a named group of units drawn emphasised while the rest dims (6.20).                                                  |
| scope                       | The units the view shows: all of them, or the neighbourhood of chosen units, grown and shrunk by hand (6.21).                                   |

### 2.2 The graph rules

**Five rules define valid data.** The module shows every breach and repairs none.

1. Units and keys match one to one.
2. A keypair joins two different units, and each keypair occurs once.
3. Every keypair (a, b) has its reverse (b, a).
4. Every unit takes part in at least one relation.
5. Nothing is deleted; units and keypairs are superseded instead.

Generated graphs obey rules 1 to 4 unless the person breaks them on purpose (8.6). Rule 5 gives each graph a stored and a current graph (3.5). Interfaces add two checks of the model's own (3.8).

### 2.3 Keys are compared exactly

**The number 1 and the text "1" are different keys.** A key's identity is its JSON text: `1` for the number, `"1"` for the text. A keypair's identity is its two key texts joined by a tab. The code never sorts or computes with keys, except in the fingerprint, which sorts by Unicode code points.

---

## 3. Data format

### 3.1 The format graphview-graph/1

**One JSON format carries a graph.** This example holds one relation with attributes of its own on each keypair:

```json
{
  "format": "graphview-graph/1",
  "meta": {
    "name": "Two units",
    "description": "One relation",
    "fingerprint": "sha256:96a576fab450b52c4c183d8ea58a5b1706722dca0e30502bb975e6e31189d9e0"
  },
  "vertices": [
    { "key": 1, "label": "Alpha", "pos": { "x": 0, "y": 0 } },
    { "key": 2, "label": "Beta", "attrs": { "type": "type_1" } }
  ],
  "edges": [
    { "from": 1, "to": 2, "attrs": { "type": "rel_ab", "weight": 1.0 } },
    { "from": 2, "to": 1, "attrs": { "type": "rel_ba", "weight": 0.1 } }
  ]
}
```

- `format` is required and must be exactly "graphview-graph/1".
- `meta` is optional. It may hold `name`, `description` and `source` as texts; `fingerprint`, checked as 3.4 says; `generator`, `params` and `seed` for generated graphs; `breaks` for graphs that break rules on purpose; `decorated` for graphs with added types (8.7); and `view`, the view settings of a saved file (8.12). Other fields are kept and ignored.
- `vertices` is a required list. A row holds `key` (required), and optionally `label` (text), `attrs` (an object of any JSON values), `pos` (an object with numbers `x` and `y`, in graph coordinates with y pointing down), `superseded` (true or false), and `interface` (true for an interface, 3.8).
- `edges` is a required list. A row holds `from` and `to` (required keys), and optionally `attrs` and `superseded`.
- The module keeps each keypair's attributes apart and never merges the attributes of a relation's two keypairs.

### 3.2 Keys

**A key is a non-empty text or a safe whole number.** A text key has no lone surrogate characters. A number key is a whole number from −(2^53 − 1) to 2^53 − 1. A JSON number with an integral value, such as 1.0, counts as that whole number. The viewer shows a unit's label when there is one, and its key as JSON text otherwise.

### 3.3 Loading, refusals and issues

**Loading either refuses the whole file or accepts rows one by one, and lists every issue in a fixed order.** The core refuses a file, draws nothing, and gives the reason in four cases:

| Code       | When                                        | Words shown                                      |
| ---------- | ------------------------------------------- | ------------------------------------------------ |
| not-object | the file is not a JSON object               | The file is not a JSON object.                   |
| format     | `format` is not exactly "graphview-graph/1" | The file is not in the format graphview-graph/1. |
| vertices   | `vertices` is not a list                    | The file has no list of vertices.                |
| edges      | `edges` is not a list                       | The file has no list of edges.                   |

`LoadResult.message` carries these words, and the viewer shows them as they are. Otherwise the checks run in this order, and each row gets at most one row issue, the first that applies:

1. Vertex rows, in file order: `bad-row` (not an object, or no `key`), then `bad-key` (the key is not valid), then `repeated-key` (an earlier accepted row has the same key). A row that passes becomes a unit.
2. Edge rows, in file order: `bad-row` (not an object, or no `from` or no `to`), then `bad-key`, then `loop` (from equals to), then `unknown-unit` (from or to is not an accepted unit), then `repeated-keypair` (an earlier accepted row has the same from and to). A row that passes becomes a keypair.
3. `missing-reverse` for each accepted keypair (a, b) without an accepted (b, a), in keypair order.
4. `orphan` for each unit that no accepted keypair touches, in unit order.
5. `fingerprint-mismatch` when `meta.fingerprint` is a text that differs from the stored fingerprint.

Each issue is a plain object, exactly as in the files under fixtures/expected. Rows count from 0.

- Row issues: `{ "code", "list": "vertices" | "edges", "row" }`, plus `"key"` for repeated-key and `"keypair": [from, to]` for loop, unknown-unit and repeated-keypair.
- `{ "code": "missing-reverse", "keypair": [a, b] }`, `{ "code": "orphan", "key": k }`, and `{ "code": "fingerprint-mismatch", "stated": text }`.

The viewer draws what was accepted (6.13). Rows that were not accepted appear only in the Data issues panel.

### 3.4 The fingerprint

**The fingerprint identifies a graph by its accepted units and keypairs only.** Labels, attributes, positions and superseded marks do not count. The algorithm, "graphview-fp/1":

1. Write each key as JSON text: a whole number in plain decimal, and a text as `JSON.stringify` writes it.
2. Build the lines: "graphview-fp/1"; "U " followed by the number of units; each unit's key text; "K " followed by the number of keypairs; each keypair as its from-text, a tab, and its to-text.
3. Sort the unit lines, and separately the keypair lines, by Unicode code points. JavaScript's default sort compares UTF-16 code units and puts "😀" before "ﬀ"; the text-keys fixture catches that mistake.
4. Join the lines with "\n", add a final "\n", encode as UTF-8, hash with SHA-256, and write "sha256:" followed by 64 lowercase hexadecimal digits.

For the pair fixture the text is `"graphview-fp/1\nU 2\n1\n2\nK 2\n1\t2\n2\t1\n"`, and the fingerprint is the one in 3.1. Implement SHA-256 inside the core in plain TypeScript, so that `fingerprint()` stays synchronous and needs no imports.

### 3.5 Stored and current graph

**Rule 5 gives two graphs.** The current graph drops the superseded units, the superseded keypairs, and every keypair that touches a superseded unit. The core computes both (G3, G4). The viewer draws the stored graph and fades the superseded parts (6.13).

### 3.6 The reference decides

**The Python reference decides every expected answer.** fixtures/reference/graphview_reference.py implements 3.3 to 4.5 in plain Python, apart from three things no gate needs: its path sets have no time limit and no `stoppedBy`; it does not handle a focus or target that is not a unit; and the expected files hold the sizes of components, not the order of their parts. fixtures/reference/make_fixtures.py writes the graphs, the expected files, the index and the manifest; only the owner of the fixtures runs it. The files under fixtures/expected hold its answers for all 27 fixtures, and fixtures/MANIFEST.sha256 fixes every file under fixtures/. When this text and the reference disagree, the reference decides, and the disagreement goes into the report as "disputed".

### 3.7 Rows with id, source and target

**The shell also reads plain row files.** A JSON object without `format`, whose rows use `id`, and `source` and `target` (or the lists `nodes` and `links`), converts to graphview-graph/1 when a vertex has an `id` and no `key`, or an edge has a `source` or a `target`. Then `id` becomes `key` (a row's own `key` wins), `label` (or else `name`) becomes `label`, `x` and `y` become `pos` when both are numbers, and every other field becomes an attribute; an edge's `id`, a `name` beside a `label`, and an `x` or `y` that cannot become `pos` are dropped. `meta.name` is the document's `name`, or "Imported graph"; `meta.source` says "converted from rows with id, source and target"; the document's own `meta` fields come on top. The loader then flags repeated ids as repeated-key and edges to unknown ids as unknown-unit. A document with a `format` field passes unchanged. The shell says "The file … was read as rows with id, source and target." after opening such a file, and "The address was read as rows with id, source and target." after fetching one.

### 3.8 Kinds of unit and interfaces

**A unit is plain or an interface.** A vertex row with `"interface": true` is an interface; any other value, or none, makes a plain unit. The core reads the field into the unit's information (`UnitInfo.interface`) and does nothing else with it: the fingerprint, the core's issues, the gates and the reference ignore it.

**An interface joins two units, its ends.** Its ends are the units it shares a relation with, in the order of those relations (6.2). An interface graph routes a relation between A and B through an interface i, with four keypairs: (A, i), (i, B), (B, i) and (i, A). Direct relations stay allowed. A graph is fully interfaced when every relation runs through an interface, and partly interfaced when some do:

```
  fully interfaced                      partly interfaced
  A ──(i)── B                            A ──(i)── B
   \       /                              \       /
   (k)   (j)                               \     /
     \   /                                   \   /
       C                                       C
  (1,10) (10,2) (2,10) (10,1)            (1,10) (10,2) (2,10) (10,1)
  (2,11) (11,3) (3,11) (11,2)            (2,3) (3,2)
  (1,12) (12,3) (3,12) (12,1)            (1,3) (3,1)
```

Here A, B and C are the plain units 1, 2 and 3, and i, j and k the interfaces 10, 11 and 12. The shell holds both graphs as examples (8.10).

**The model checks interfaces, with issues of its own.** They follow the core's issues, in this order, and count like them in the headline and the banner.

| Code             | When                                                  | Words, for example                                                               |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `interface-ends` | An interface with other than two ends; by unit order. | The interface i joins 3 units, not 2.                                            |
| `interface-pair` | Two interfaces related directly; by relation order.   | The interfaces k and l are related directly; an interface joins two plain units. |

A lone interface is also an orphan (3.3): "The interface x joins no units, not 2." follows the core's words. A relation between two plain units raises no issue.

**A profile may change two of these rules (5.7).** It may allow the self-relation of a unit: an interface with one end, whose keypairs join that end both ways; then that interface raises no `interface-ends`. And it may ask for interfaces everywhere; then each relation between two plain units raises an issue after the interface issues, in relation order:

| Code              | When                                                            | Words, for example                                                                |
| ----------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `direct-relation` | Two plain units related directly, while the profile forbids it. | The units a and b are related directly; every relation runs through an interface. |

### 3.9 Classes and perspectives in the data

**A host may describe classes and perspectives in the data; the perspective drawing, the filter rules, the search and the inspector read them.** Every field is optional and sits in `attrs`; a profile may rename it (5.7).

| Field       | Row                    | Holds                                                                                                                                                                            |
| ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`     | vertex                 | The unit's class, as text: what an interface's oval says, and what class rules test.                                                                                             |
| `classUnit` | vertex                 | `true` for a class unit, which the perspective drawing shows as a box.                                                                                                           |
| `pair`      | vertex of an interface | Its member pair: `{ "type": text, "perspectives": [{ "type": text, "from": key, "to": key }, …] }`. A perspective runs from the unit it starts at to the unit at the other side. |
| `pairType`  | edge                   | The pair type of the perspective the keypair belongs to.                                                                                                                         |

- The perspective from A to B through the interface i holds the keypairs (A, i) and (i, B). Without `pair`, its type is the `pairType` of (A, i), or else that keypair's type (6.6).
- The core reads none of these fields: the fingerprint, the issues, the gates and the reference ignore them.

---

## 4. The core

### 4.1 Functions

**The core exports these functions; the gate tests call them by these names.**

```ts
export type Key = string | number;
export interface Graph {
  units: Key[]; // accepted units, in file order
  keypairs: [Key, Key][]; // accepted keypairs, in file order
  readonly unitInfo: ReadonlyMap<string, UnitInfo>; // by key id: label, attrs, pos, superseded
  readonly keypairInfo: ReadonlyMap<string, KeypairInfo>; // by keypair id: attrs, superseded
  readonly meta: Record<string, unknown>;
}
export type LoadResult =
  | { ok: true; graph: Graph; issues: Issue[] }
  | { ok: false; code: 'not-object' | 'format' | 'vertices' | 'edges'; message: string };
export function loadGraph(doc: unknown): LoadResult; // 3.3
export function currentGraph(graph: Graph): Graph; // 3.5
export function fingerprint(graph: Graph): string; // 3.4
export function relationCount(graph: Graph): number; // complete relations
export function degrees(graph: Graph): { key: Key; relations: number; outgoing: number; incoming: number }[];
export function components(graph: Graph): { sizes: number[]; parts: Key[][] };
export function rings(graph: Graph, focus: Key): { rings: Key[][]; beyond: Key[] };
export function ringIndex(graph: Graph, focus: Key): number[]; // each unit's ring, −1 beyond
export function pathSet(
  graph: Graph,
  from: Key,
  to: Key,
  extra: number,
  limits?: { count?: number; list?: number; timeMs?: number },
): PathSetResult;
export function keyId(k: Key): string; // 2.3
export function keypairId(a: Key, b: Key): string;
export const tokens: Record<'light' | 'dark', Record<TokenName, string>>; // 4.6
export function cssVariables(theme: 'light' | 'dark'): string; // --gv-<token>: value; …
```

The core also exports the constants `FORMAT`, `PATH_DEFAULTS` and `MAX_SAFE`, the helpers `isKey`, `keyJson`, `compareCodePoints` and `fingerprintOf(units, keypairs)`, and the types `TokenName` and `Theme`; `cssVariables` takes optional token overrides as a second argument. The core imports only the core and uses no browser globals (G16).

### 4.2 Degrees

**`degrees()` counts, per unit, its relations and its keypairs in each direction.** The name stays because the gates call it; these counts are not the viewer's degrees (2.1). `relations` is the number of distinct units joined to it by a keypair in either direction. `outgoing` and `incoming` count its keypairs. The list follows unit order.

### 4.3 Components

**Components are the parts of the graph, ignoring direction.** `parts` lists them in the order of their first unit in the file, each with its units in file order. `sizes` lists their sizes, largest first.

### 4.4 Rings

**Rings group units by steps from a unit, following keypairs in their direction.** The search is breadth first and takes each unit's outgoing keypairs in file order. Ring k holds the units k steps away; `beyond` holds the units that cannot be reached. A focus that is not in the graph gives empty rings and every unit beyond. The viewer's degrees are these ring numbers (6.4).

### 4.5 Path sets

**A path set lists the simple paths between two units, by length, and stops at its limits.** Inputs: two units, the extra steps n (rounded down and held between 0 and 20), a count limit (default 10,000), a list limit per length (default 200), and a time limit (default 2,000 milliseconds).

1. Find d, the fewest steps from the first unit to the second, following keypairs in their direction. If the two units are the same, report "same-unit". If the second cannot be reached, or either unit is missing, report "unreachable".
2. For each length L from d to d + n, in increasing order, find every path of exactly L steps. Search depth first from the first unit, taking each unit's outgoing keypairs in file order. Never revisit a unit, never pass through the second unit before the end, and extend only to units whose fewest steps to the second unit fit in the steps left.
3. Count every path found, and keep the first ones up to the list limit for each length.
4. Stop when the total count reaches the count limit, or when the time limit has passed; read the clock with `Date.now()` once every 1,024 search steps. The length being counted then reports its count as "at least", and longer lengths are not reported.

```ts
interface PathSetResult {
  from: Key;
  to: Key;
  extra: number;
  shortest: number | null; // d, or null with a reason
  reason: 'same-unit' | 'unreachable' | null;
  lengths: { length: number; count: number; exact: boolean; paths: Key[][] }[];
  total: number;
  stopped: boolean;
  stoppedBy: 'count' | 'time' | null;
}
```

Two examples from the fixtures. In the database graph, from unit 79 to unit 77 with 4 extra steps, lengths 3 to 7 have 1, 1, 1, 3 and 4 paths. In the complete graph of nine units, from 1 to 2 with 7 extra steps, lengths 1 to 7 are exact: 1, 7, 42, 210, 840, 2,520 and 5,040 paths; length 8 reports "at least 1,340".

### 4.6 Colour tokens

**Thirteen colour tokens serve both themes; module/core/tokens.ts exports them.** `cssVariables(theme)` writes them as CSS custom properties named `--gv-<token>`.

| Token    | Role                                        | Light   | Dark    |
| -------- | ------------------------------------------- | ------- | ------- |
| surface  | the canvas                                  | #F6F8F9 | #0F151A |
| plane    | the page's background                       | #EDF1F3 | #0A0F13 |
| panel    | side panels                                 | #FFFFFF | #141B21 |
| ink-1    | main text; root, target and inspected marks | #13222E | #E8EEF2 |
| ink-2    | secondary text and labels                   | #46596A | #A9B8C4 |
| muted    | hints and notes                             | #5A6B7E | #8C9DAB |
| hairline | borders and dividers                        | #D5DDE2 | #24303A |
| ring     | guides; lines below the weight threshold    | #7D8E9C | #5E7080 |
| context  | units and lines without a type              | #74859A | #7F909E |
| outgoing | first hue                                   | #2A78D6 | #3987E5 |
| incoming | second hue                                  | #EB6834 | #D95926 |
| path     | the active path and its glow                | #17A070 | #199E70 |
| issue    | data issues, always with an icon or a dash  | #D03B3B | #D03B3B |

- Text tokens reach at least 4.5 to 1 against surface, plane and panel; mark tokens reach at least 3 to 1 against the surface (G15). Hairline draws borders only, never a mark.
- The issue colour is never shown alone: dashes, the issue icon and the Data issues panel carry it.
- Root, target and inspection show by shape and ink, never by a hue.
- These values are the defaults of the Theme settings (5.9): a host or a person may change them, and G15 tests the defaults.

---

## 5. Architecture and contracts

### 5.1 Layers and imports

**Each layer imports only the layers below it.** core ← settings ← model ← render ← view; workers serve the model, and import from it only the type `GraphWorker`; server serves hosts, and imports only the core and the settings. The module imports nothing outside module/. The shell reaches the module only through module/index.ts, or its CSS (G16). module/settings, module/server and module/model run without a browser, apart from the model's worker factory and the browser store (5.9).

### 5.2 The model

**Every change goes to the model first; the model then tells its listeners which aspects changed, and they redraw from the model.** The canvas and the panels never talk to each other. `GraphModel` holds one viewer's state:

| Field                                       | Holds                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| doc, stored, graph, issues, refused         | the document; the graph as loaded, and the graph shown (the same unless the profile projects it, 5.7); its issues; or the refusal            |
| profile, superseded                         | the profile (5.7); whether each unit is superseded, by its row or by the profile                                                             |
| kinds                                       | each unit's kind, each interface's ends, and the interface issues (3.8)                                                                      |
| schema                                      | the reflected fields: unit and keypair type fields, time fields, weight fields (6.6)                                                         |
| ids, index, relations, chevrons, relationOf | key ids, their places, one record per relation (its two units and which keypairs exist), one record per keypair, and each keypair's relation |
| types                                       | the type registry (6.6)                                                                                                                      |
| positions, laidOut                          | each unit's x and y, scaled to an extent of 1,000, y up; whether the layout is done                                                          |
| mode                                        | '2d' or '3d'; default '2d'                                                                                                                   |
| root, degrees                               | the root and every unit's degree                                                                                                             |
| target, paths, choice                       | the path end, its path set, the chosen path                                                                                                  |
| filters, overrides, hulls                   | 6.7, 6.8, 6.9; hulls default on, and start off for a graph over 3,000 units                                                                  |
| inspected                                   | a unit, a keypair, a relation, or nothing                                                                                                    |
| theme                                       | 'light' or 'dark'                                                                                                                            |
| settings                                    | the settings registry (5.9); the model is its only writer                                                                                    |
| source                                      | the source of the graph held (5.8)                                                                                                           |
| selection, highlights                       | the selected units and the highlight groups (6.20)                                                                                           |
| scope                                       | the scope (6.21)                                                                                                                             |
| rules                                       | the filter rules (6.7)                                                                                                                       |

Its methods:

| Method                                                                      | Does                                                                                                                                                              | Aspects                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `load(doc, settings?)`                                                      | Loads a graph, resets the view state, reflects the schema, builds the types, lays out, then applies saved settings. Resolves false when a newer load replaced it. | graph, layout, and those of the settings       |
| `setMode(mode)`                                                             | 2D or 3D.                                                                                                                                                         | mode                                           |
| `setRoot(key \| null)`                                                      | Makes a unit the root and asks the worker for degrees; a new root drops the path.                                                                                 | root, paths                                    |
| `setTarget(key \| null)`                                                    | Asks the worker for the path set from the root, with 2 extra steps; chooses the first path of the first length with paths.                                        | paths                                          |
| `reversePath()`                                                             | The target becomes the root, and the paths run back.                                                                                                              | root, paths                                    |
| `choosePath({length, index})`                                               | Makes another path active.                                                                                                                                        | paths                                          |
| `setFilters(part)`                                                          | 6.7                                                                                                                                                               | filters                                        |
| `setOverrides(part)`                                                        | 6.8                                                                                                                                                               | display                                        |
| `setHulls(on)`                                                              | 6.9                                                                                                                                                               | display                                        |
| `setTypeLabel(kind, id, label)`, `setTypeColour(kind, id, colour)`          | Custom type names and colours; they survive a theme change.                                                                                                       | types                                          |
| `inspect(what)`                                                             | What the inspector shows.                                                                                                                                         | inspect                                        |
| `setTheme(theme)`                                                           | Rebuilds the type colours for the theme.                                                                                                                          | theme, types                                   |
| `loadFrom(source, settings?)`                                               | Reads the source and loads its document as `load` does; a source that fails gives a refusal (5.8).                                                                | as `load`                                      |
| `setSetting(key, value)`, `resetSettings(keys?)`, `applySettingsFile(file)` | Changes settings through the registry; a value outside a setting's allowed values is refused and reported.                                                        | settings, and the aspects each setting touches |
| `select(keys, how)`                                                         | Replaces, adds to, toggles in or clears the selection.                                                                                                            | selection, highlight                           |
| `setHighlight(name, on)`, `saveHighlight(name)`, `removeHighlight(name)`    | Turns a highlight group on or off, saves the selection as a group, or removes a saved group.                                                                      | highlight                                      |
| `setRule(rule)`, `clearRules()`                                             | Sets or clears filter rules (6.7).                                                                                                                                | filters                                        |
| `showNeighbourhood(keys)`, `expand(keys)`, `hide(keys)`, `showAll()`        | Sets, grows or shrinks the scope, or ends it (6.21).                                                                                                              | scope                                          |
| `subscribe(listener)`                                                       | Returns an unsubscribe function.                                                                                                                                  | —                                              |
| `dispose()`                                                                 | Ends the model's workers.                                                                                                                                         | —                                              |

The `graph` aspect means that everything changed: a listener that hears it redraws every part, the mode, display factors, palettes and camera controls included. The `settings` aspect comes with the keys that changed (`model.changedSettings`); a listener redraws what those settings touch.

Its queries: `label(key)`, `find(text)` (a label, a key as JSON text, or a bare word naming a text key), `keypairsOf(key)` (outgoing first, then incoming, each in file order), `activePath()`, `unitType(key)`, `keypairType(a, b)`, `kindOf(key)`, `endsOf(key)` (an interface's ends, or null), `perspectivesOf(key)` (5.7), `pathSteps()`, `planeCounts()`, `fieldRange(field, kind)`, `settings()`, `relationCount()`.

`setTarget` asks with the core's default limits (`PATH_DEFAULTS`). A slow answer never overwrites a newer state: each load has a run number, and each answer checks it, and checks that the root or target it was asked for is still the one held.

### 5.3 Contracts

**module/model/contracts.ts holds the types the parts share.**

```ts
type Mode = '2d' | '3d';
type Aspect =
  | 'graph'
  | 'layout'
  | 'mode'
  | 'root'
  | 'paths'
  | 'filters'
  | 'types'
  | 'display'
  | 'inspect'
  | 'theme'
  | 'settings'
  | 'selection'
  | 'highlight'
  | 'scope';
type Listener = (aspects: ReadonlySet<Aspect>) => void;
interface TypeInfo {
  id: string;
  label: string;
  colour: string;
  count: number;
  slot: number;
}
interface TypePair {
  forward: string;
  backward: string | null;
}
interface Filters {
  timeField: string | null;
  from: number | null;
  to: number | null;
  weightField: string | null;
  threshold: number | null;
}
interface Overrides {
  size: number;
  width: number;
  opacity: number;
}
type Inspected =
  { kind: 'unit'; key: Key } | { kind: 'keypair'; from: Key; to: Key } | { kind: 'relation'; a: Key; b: Key } | null;
interface PathChoice {
  length: number;
  index: number;
}
interface PathStep {
  key: Key;
  label: string;
  to: { type: string | null; weight: number | null } | null; // keypair to the next unit
  from: { type: string | null; weight: number | null } | null;
} // and back
interface PlaneCounts {
  first: number;
  second: number;
  third: number;
  farBack: number;
  deepest: number | null;
}
interface ViewSettings {
  mode: Mode;
  root: Key | null;
  target: Key | null;
  path: PathChoice | null;
  filters: Partial<Filters>;
  overrides: Overrides;
  hulls: boolean;
  types: {
    unit: Record<string, { label?: string; colour?: string }>;
    keypair: Record<string, { label?: string; colour?: string }>;
  };
  camera: { position: [number, number, number]; target: [number, number, number] } | null;
}
interface GraphWorker {
  distances(root: Key): Promise<number[]>;
  paths(from: Key, to: Key, extra: number, limits: PathLimits): Promise<PathSetResult>;
  terminate(): void;
}
type FilterMode = 'show' | 'fade' | 'hide';
interface FilterRule {
  field: 'class' | 'type' | 'kind' | 'pairType' | 'superseded' | 'degree';
  value: string | null; // the class, type, kind or pair type; null for superseded and degree
  range: [number, number] | null; // degree only
  mode: FilterMode;
}
type SelectHow = 'replace' | 'add' | 'toggle' | 'remove' | 'clear';
interface HighlightGroup {
  name: string;
  keys: Key[];
  on: boolean;
  saved: boolean; // saved from the selection by a person
}
interface Scope {
  centres: Key[];
  units: Key[];
}
```

The model takes an optional worker factory `(units, keypairs) => GraphWorker` in its constructor. The default factory starts a Web Worker, or runs the same functions inline where no Worker exists, as in unit tests.

### 5.4 Workers

**Distances, path sets and the force layout run off the main thread.** The graph worker keeps one graph and answers `distances` with `ringIndex` and `paths` with `pathSet`. The layout worker runs the force layout (6.1). Where no Worker exists, the same functions run inline.

### 5.5 The scene snapshot

**The renderer describes the picture in CSS pixels, so tests need no knowledge of the shaders.** `getScene()` returns the state after the current transition step:

```ts
interface SceneSnapshot {
  width: number;
  height: number;
  settled: boolean;
  mode: Mode;
  drawing: 'keypairs' | 'perspectives';
  root: Key | null;
  target: Key | null;
  hasPath: boolean;
  units: {
    key: Key;
    kind: string;
    shape: string;
    ends: Key[] | null;
    halves: [string, string];
    degree: number | null;
    plane: number | null;
    type: string | null;
    x: number;
    y: number;
    z: number;
    scale: number;
    opacity: number;
    glow: number;
    visible: boolean;
    onPath: boolean;
    sx: number;
    sy: number;
    reach: number;
    selected: boolean;
    emphasis: number; // 1 in an active highlight group, 0 otherwise
    inScope: boolean;
    outside: number; // relations to units outside the scope
  }[];
  lines: {
    a: Key;
    b: Key;
    keypairs: [boolean, boolean];
    visible: boolean;
    above: boolean;
    strength: number;
    onPath: boolean;
    opacity: number;
    sx: number;
    sy: number;
  }[];
  chevrons: {
    from: Key;
    to: Key;
    at: number;
    visible: boolean;
    opacity: number;
    flow: number;
    type: string | null;
    colour: string;
    sx: number;
    sy: number;
    perspective: { from: Key; to: Key } | null; // in the perspective drawing
    points: Key; // the unit the chevron points at
  }[];
  hulls: { type: string; members: number; opacity: number }[];
  labels: { key: Key; text: string }[];
}
```

`chevrons` lists the chevrons the drawing draws: one per keypair by keypairs, one per perspective by perspectives (6.18), where `type` is the pair type. `sx` and `sy` are screen points: a unit's centre, a line's middle, a chevron's centre. A unit's `scale` and `opacity` include the Display factors (6.8). `reach` is the radius of a unit's click target: the larger of 6, 8, 10 or 12 pixels by plane and its drawn disc plus 2 pixels; picking adds 3 pixels of padding (6.11). `flow` is 1 along the active path, −1 against it, 0 otherwise. A unit's `kind` is "plain", "interface" or a kind of the profile, and `shape` the name of its look's shape (5.7); `ends` are an interface's ends, null for a plain unit; `halves` are the colours of its two halves, the first end's side first (6.17), and a plain unit's type colour twice. The snapshot must match what is drawn: tests click at its points.

### 5.6 The module's entry point

**module/index.ts is the module's only entry point.** It exports the core (4.1), the contracts (5.3), `GraphModel` with the types `Relation` and `Chevron`, `EXTENT` and `EXTRA_STEPS`, the kinds of 3.8 (`kindOfUnit`, and the types `Kind`, `Kinds` and `KindIssue`), the extension points of 5.7 (`PUBLIC_PROFILE`, `INTERFACE`, `PUBLIC_LOOKS`, `halfSlots`, `UNIT_SHAPES`, `UNIT_SECTIONS`, and the types `Profile`, `KindRule`, `Check`, `CheckIssue`, `Look`, `Looks`, `UnitShape`, `SectionProps` and `UnitSections`), the depth rules of 6.4 (`DEPTH_RULES`, `SPACING`, `FOREGROUND`, `CHEVRON_AT`, `depthState`, `plane`), the type palette (`TYPE_PALETTE`, `MAX_TYPES`, `OTHER`, `mixColour`), the `SceneSnapshot` type, the components `GraphCanvas`, `GraphView`, `RootPanel`, `PathsPanel`, `InspectorPanel`, `FiltersPanel`, `DisplayPanel`, `TypesPanel`, `IssuesPanel`, `Section` and `RangeSlider`, and the word helpers of 7.8 (`issueWords`, `keyText`, `count`). A host makes a model, hands it to `GraphCanvas` and the panels it wants, and calls the model's methods. `GraphView` is the composite for hosts without a layout of their own (7.9).

Version 4.0 adds: the sources of 5.8 (`JsonFileSource`, `DocumentSource` and the type `GraphSource`); the settings of 5.9 (`Setting` and its classes, `SettingsRegistry`, `createRegistry`, `SETTING_GROUPS`, the stores `HttpSettingsStore`, `BrowserSettingsStore`, `MemorySettingsStore` and `FallbackSettingsStore`, and the types `SettingsFile`, `SettingsStore` and `Control`); `createSettingsHandler` (5.10); `profileFromJson` and the type `ProfileJson` (5.7); the contracts of 5.3; and the components `SettingsDialog`, `SettingControl`, `PinnedPanel`, `SearchPanel`, `ScopePanel` and `HighlightsPanel`.

### 5.7 Extending graphview

**A host fits the module to a family of graphs without editing it, through four extension points.** The shell uses the defaults; another build passes its own.

| Point    | Given to                                                     | Holds                                                                                                      | Default                                                      |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Profile  | `new GraphModel(makeWorker, profile)`; GraphView's `profile` | kinds, classes, declared pairs, checks, a superseded rule, perspective types, a projection                 | `PUBLIC_PROFILE`: the interface kind                         |
| Looks    | GraphCanvas's and GraphView's `looks`                        | each kind's shape, whether it joins hulls, and the colours of its halves; the shapes the unit shader holds | `PUBLIC_LOOKS`: plain as a disc, interface as a divided disc |
| Sections | InspectorPanel's and GraphView's `sections`                  | the inspector's section for each kind of unit                                                              | `UNIT_SECTIONS`: plain and interface                         |
| Words    | each check of the profile                                    | the words for the issues the check finds                                                                   | the module's words for its own codes (7.8)                   |

**The profile** (`Profile`, module/model/profile.ts):

- `kinds`: kind rules, tried in order; a unit that none claims is plain. A rule has an `id`, `claims(info, key)`, and `joins`: whether its units join two others, as interfaces do. Units of a joining kind have ends, and the interface checks of 3.8 apply to them.
- `classOf(info, key)`: a unit's class, the type that colours it and counts in the Types panel (6.6). Without it, the type field decides.
- `pairs`: complementary pairs of keypair types, [forward, backward], ahead of the pairs the data shows (6.6). A pair whose types the data lacks is left out; a type whose partner is declared elsewhere stays alone.
- `checks`: each with its `codes`, `find(graph, kinds, relations)` on the stored graph, and `words(issue, name)`. Their issues follow the interface checks', in the order of the checks.
- `superseded(graph, key)`: whether a unit is superseded besides its row's mark, such as by a relation that supersedes it. The picture fades it and its keypairs as 6.13 says.
- `perspective(graph, interface, from, to)`: the pair type of an interface's relation seen from one end toward the other. `perspectivesOf(key)` gives an interface's perspectives: from its first end to its second and back; one for an interface with one end; none otherwise. The inspector shows a perspective's type at the top of its column (7.4).
- `project(graph, kinds)`: the graph the viewer shows, made from the stored graph, such as each interface folded into its relation's line. The model then holds both: `stored` as loaded, and `graph` as shown. Issues, the fingerprint and saving follow the stored graph; the picture, the paths and the panels follow the shown graph.

**Looks** (`Looks`, module/render/looks.ts) map each kind to its look: a `shape` name, `hulls`, and optionally `halves(model, index)`, the palette slots of a unit's two halves, which `halfSlots` gives by default (6.17). A kind without a look draws as plain. `shapes` lists the unit shapes, each a name and GLSL statements over `uv` and `col` that return how far the point lies from the centre, 1 at the edge, and may change its colour; a shape may read the unit's two colours, the direction between its ends, and the surface colour. The ring, the outline and the glow follow every shape's edge.

**Sections** (`UnitSections`, module/view/inspector/sections.ts) give a Svelte component per kind of unit, with the props `model`, `inspected` and `version`. A kind without one shows plain's section.

**A profile can come from JSON**, so that a host configures the viewer without code. `profileFromJson(json)` builds a `Profile` from:

```ts
interface ProfileJson {
  kinds?: { id: string; field: string; equals: unknown; joins: boolean }[]; // a unit is of the first kind whose attribute field equals the value
  classField?: string; // default 'class' (3.9)
  classUnitField?: string; // default 'classUnit'
  pairField?: string; // default 'pair'
  pairTypeField?: string; // default 'pairType'
  pairs?: [string, string][]; // declared complementary pair types
  supersededBy?: string[]; // a unit that starts a perspective of one of these types is superseded
  selfRelations?: 'allowed' | 'issue'; // default 'issue' (3.8)
  directRelations?: 'allowed' | 'issue'; // default 'allowed' (3.8)
}
```

The kind rule `{ "field": "interface", "equals": true }` is the public interface kind; a JSON profile without `kinds` keeps it. The perspective type of a profile from JSON reads the interface's `pair` field (3.9). The unit shapes gain `box` (a square with rounded corners) and `oval` (a disc twice as wide as high), for the perspective drawing (6.18).

### 5.8 Sources

**The viewer reads its graph from a source, so that a host can change how graphs arrive without changing the viewer.**

```ts
interface GraphSource {
  readonly name: string; // a name for messages and file names
  load(): Promise<unknown>; // a graphview-graph/1 document, or rows that the importer converts (3.7)
}
```

- `JsonFileSource(address | File)` fetches an address or reads a file, and parses its JSON. `DocumentSource(doc, name)` hands over a document already in memory.
- `model.loadFrom(source, settings)` reads the source and loads the document as `load` does (5.2). A source that fails gives a refusal with the code `source` and the words "The graph could not be read: <reason>."
- A later source may also offer `subgraph(keys, hops)` and `search(text, limit)`. The scope (6.21) and the search (6.19) ask it when it does, and work on the loaded graph when it does not.

### 5.9 Settings

**Every value that changes the viewer is a setting: one instance of a class per kind of control, each with a hard-coded default.** module/settings/registry.ts lists them, in the groups the Settings dialog shows; their defaults are the values sections 4 to 9 give.

```ts
type Control =
  | 'checkbox'
  | 'slider'
  | 'number'
  | 'range'
  | 'select'
  | 'text'
  | 'colour'
  | 'theme-colour'
  | 'palette'
  | 'order'
  | 'set'
  | 'keys'
  | 'json';
abstract class Setting<T> {
  readonly key: string; // 'labels.size'
  readonly label: string; // 'Label size'
  readonly group: string; // 'Labels'
  readonly description: string;
  readonly default: T; // hard-coded
  readonly applies: 'live' | 'load'; // at once, or with the next graph
  readonly control: Control;
  value: T; // Svelte state
  pinned: boolean; // shown in the side bar too
  check(v: unknown): T | undefined; // the value when it is allowed
}
```

| Class                | Value                             | Control      | Holds besides           |
| -------------------- | --------------------------------- | ------------ | ----------------------- |
| `CheckboxSetting`    | boolean                           | checkbox     | —                       |
| `SliderSetting`      | number                            | slider       | min, max, step, unit    |
| `NumberSetting`      | number                            | number       | min, max, step, whole   |
| `RangeSetting`       | [number, number]                  | range        | min, max, step          |
| `SelectSetting`      | text                              | select       | options                 |
| `TextSetting`        | text                              | text         | pattern                 |
| `ColourSetting`      | a colour or a token name          | colour       | whether tokens may name |
| `ThemeColourSetting` | { light, dark }                   | theme colour | —                       |
| `PaletteSetting`     | { light: colours, dark: colours } | palette      | most colours            |
| `OrderSetting`       | a list of texts in order          | order        | the items               |
| `SetSetting`         | a list of texts                   | set          | the items               |
| `KeysSetting`        | key → action                      | keys         | the actions             |
| `JsonSetting`        | any JSON value                    | json         | —                       |

- A `SettingsRegistry` holds every setting by key: `get(key)` reads, `set(key, value)` checks and writes, `reset(keys)` returns to the defaults, and `subscribe(listener)` reports the keys that changed. The model owns one registry and is its only writer (5.2).
- Each setting reaches every place that uses its value: shader inputs for the picture, the model's rules for layout, paths, filters, scope and hulls, CSS custom properties `--gv-*` for text and panels, and the words of 6.14 and 7.8. No value is written twice in the code.
- `applies: 'load'` marks the settings that take effect with the next graph, such as the layout's; the Settings dialog says so.
- The view's controls belong to the view: module/view/settings/ holds one Svelte component per control, and `SettingControl` picks it by the setting's control (D79).

**The settings file.** A store keeps the values that differ from their defaults, and the pins:

```json
{ "format": "graphview-settings/1", "revision": 3, "values": { "labels.size": 14 }, "pinned": ["display.size"] }
```

- Keys that name no setting, and refused values, stay in the file and are reported; they are not applied. A file of another format is set aside with a note.
- The stores: `HttpSettingsStore(address)` reads and writes the file through a host's route (5.10); `BrowserSettingsStore(key)` keeps it in browser storage; `MemorySettingsStore` holds it, for tests; `FallbackSettingsStore(first, second)` uses the second store when the first cannot be reached.
- The values come in layers, each over the one before: the defaults; the host's base values (GraphView's `settings` prop); the stored file; and, for the display factors and hulls only, a graph's own `meta.view` (8.12) while that graph is open. A change saves to the store half a second after the last one.
- The file holds settings only. Type names and colours, the root, the path, the filters' window and the camera belong to a graph and travel in its `meta.view`.

### 5.10 The settings handler

**A host keeps the viewer's settings file through one handler, so that the file's rules stay in the module.** `createSettingsHandler({ read, write })` returns the `GET` and `PUT` functions of a SvelteKit route; `read()` resolves to the stored text or null, and `write(text)` stores it.

- GET answers the file, or an empty file of revision 0.
- PUT takes a file and checks its format. A revision other than the stored one is refused with status 409 and the stored file; otherwise the file is stored with its revision raised by one, and answered.
- The shell stores the file at data/graphview-settings.json, outside the build and outside git. A host may store it anywhere, such as in its own database.

---

## 6. The viewer

### 6.1 Layout

**Units get given positions when every unit has one, else a force layout; both scale to an extent of 1,000.**

- _Given positions:_ each unit's `pos`. When only some units have one, the force layout runs and does not use them.
- _Force layout:_ ForceAtlas2 from graphology, in the layout worker, from seeded starting positions (mulberry32, seed 1). It runs in batches of 25 iterations and stops when the mean step per iteration falls below 0.02 percent of the layout's size, or after 1,500 iterations. Above 500 units it uses the Barnes–Hut approximation; above 2,000 units it stops after 300 iterations, with a Barnes–Hut θ of 1. No clock decides, so the result is deterministic (G9).
- _Scaling:_ the larger side of the bounding box becomes 1,000 world units, centred on 0. The data's y points down; the scene's y points up.
- The layout happens once per load. A new graph starts afresh: no root, no path, no inspection, filters from its own fields.

### 6.2 Drawing

**Three instanced draws carry the picture: units, lines and chevrons.** three.js on WebGL 2, with `ShaderMaterial`s that carry the module's own shaders. Every instance holds a previous and a next value of each attribute; one uniform eases between them (6.10).

| Mark    | Drawing                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit    | A disc of radius 6 world units, in its type colour or the context colour, with a thin ring in the surface colour to separate it from lines. The root, the target and the inspected unit carry an ink-1 outline. An interface is a divided disc (6.17).                                                                                                                                                                  |
| Line    | One per relation, drawn in screen space, 1.5 pixels wide, in the context colour; brightened above the weight threshold (6.7); in the path colour on the active path. A line's opacity and width follow its two ends along its length.                                                                                                                                                                                   |
| Chevron | One per keypair, at a third of the line from its first unit for (a, b) and at two thirds for (b, a), pointing in its keypair's direction, in its keypair type's colour. 14 pixels at full size, scaled like its ends by depth (6.4) and by the size factor (6.8), and 1.2 times on the active path; the glyph fills about 8 by 11 of those pixels. Hidden on a line shorter than 1.5 chevrons on screen; fades in by 2. |

Lines stay neutral and chevrons carry the type: a line in a type's colour would hide the chevrons of that colour on it.

### 6.3 2D and 3D

**2D and 3D are the same scene; 2D keeps every unit on z = 0.** Only the 2D and 3D buttons switch; a click on the graph never does. The first picture in 3D is the 2D picture with every setting applied.

|                                                 | 2D                                 | 3D                             |
| ----------------------------------------------- | ---------------------------------- | ------------------------------ |
| Depth                                           | z = 0 for every unit               | z by plane (6.4)               |
| Sizes, opacities, colours, glow, filters, hulls | as 3D                              | 6.4 to 6.9                     |
| Camera                                          | looks straight down; does not turn | turns freely around its target |
| Left drag, one finger                           | pan                                | turn                           |
| Right drag                                      | pan                                | pan                            |
| Wheel, pinch                                    | zoom                               | zoom                           |

Switching to 2D eases the camera back to straight above its target. The perspective camera keeps its field of view; `fit()` shows the whole extent from straight above with a margin of 15 percent, across the canvas's width as well as its height.

### 6.4 Root and depth

**A root gives every unit its degree, and the degree decides its plane, size and opacity.** Clicking a unit makes it the root; the camera's centre moves to the root over the transition, keeping its direction and distance.

The plane of degree d is 0 for d ≤ 1, d − 1 for d ≥ 2, at most 6; units the root does not reach sit on plane 6. Planes are 300 world units apart, so plane p sits at z = −300 p.

| Units                                          | z            | Size           | Opacity |
| ---------------------------------------------- | ------------ | -------------- | ------- |
| No root                                        | 0            | 1              | 1       |
| Root, degree 1                                 | 0            | 1              | 1       |
| Degree 2                                       | −300         | 0.6            | 0.6     |
| Degree 3 and more, or out of reach             | −300 × plane | 0.25           | 0.15    |
| On the active path                             | 0            | 1.2, with glow | 1       |
| Not on the active path, while a path is active | as above     | as above       | 0.05    |

In 2D, z is 0 throughout and the rest stays. The shaders compute these values from two attributes per unit, `currentDegree` and `isOnActivePath`; module/model/depth.ts holds the same rules for picking, panels and tests.

### 6.5 Paths

**With a root, a target gives the shortest paths and those one and two steps longer.** The model asks the worker for the path set with 2 extra steps and the limits 10,000, 200 and 2,000 ms. The first path of the first length with paths becomes active.

- The active path's units and lines come to z = 0, at 1.2 times their size, with a glow in the path colour; everything else dims to 0.05.
- On the path, the chevron along the travel direction stays lit; the opposing one dims to 0.15.
- Reverse path swaps root and target and computes the paths back.
- A new root drops the target and its paths.

### 6.6 Types and palette

A profile may give unit types as classes, and declare pairs of keypair types (5.7); this section describes the default, the type fields.

**Types are found in the data, paired, and coloured from a fixed palette.**

_Schema reflection._ The type field of units, and separately of keypairs, is the first of type, kind, category, archetype, group and class that rows carry; "type" always counts, the others only when they name fewer groups than there are rows. Time fields hold ISO date texts, or numbers in fields named time, timestamp, date, created, updated, at, when, created_at or updated_at. Weight fields are numeric keypair fields with at least two distinct values, "weight" first.

_Pairs._ Keypair types pair by how often the type of a keypair meets the type of its reverse, the most frequent pair first, and within a pair the type met first goes forward. A type that is its own reverse pairs with itself. A type without a typed reverse has no complement.

_Palette._ Types take colours in order of frequency (unit types) or pair order (keypair types):

| Slot | Light   | Dark    |
| ---- | ------- | ------- |
| 1    | #2A78D6 | #3987E5 |
| 2    | #EB6834 | #D95926 |
| 3    | #1BAF7A | #199E70 |
| 4    | #EDA100 | #C98500 |
| 5    | #E87BA4 | #D55181 |
| 6    | #008300 | #008300 |
| 7    | #6250D6 | #9085E9 |

Further types take the context colour. A backward keypair type takes its forward type's colour, custom or default, mixed 42 percent toward the surface. At most 64 types per kind reach the shaders; the last slot holds the rest. Custom names and colours replace the defaults and survive a theme change. Colours reach the shaders as uniforms, so a change redraws without rebuilding anything. Because three light slots fall short of 3 to 1 contrast, the Types section names every type next to its swatch.

### 6.7 Filters

**A time window and a weight threshold compound.**

- A unit passes the time window when its time lies inside it, or it has none. A keypair passes when its own time passes and both its units pass. A line shows while one of its keypairs passes.
- A line is above the threshold when one of its keypairs reaches it. Above: width × (1 + 2 × strength), colour brightened toward white by 35 percent of the strength, where strength = (w − min) / (max − min) over the weight field's range, or 1 when every weight is equal. Below: 1 pixel, the ring colour at 60 percent opacity, no chevrons.
- Without a threshold every line counts as above, with strength 0.
- Rows that enter or leave the window fade over the transition; a line's strength eases too.

**Filter rules narrow the view further, by what units and keypairs are.** Each rule tests one thing, and what fails it fades or hides:

- a unit's class (3.9) or type (6.6), and its kind: each value shown, faded or hidden; the Types panel and the Filters panel share these states;
- a keypair's pair type (3.9), or else its type: shown, faded or hidden;
- superseded parts: shown at 35 percent (6.13), faded further, or hidden;
- a range of relations per unit: units outside it fade or hide.

A faded mark draws at `filters.fadeOpacity` of its opacity (default 0.15) and answers no click; a hidden one goes as the time window's do. A keypair fails when one of its units fails or its own type fails, and a line fails when all of its keypairs fail. Rules compound with the time window and the threshold.

### 6.8 Display overrides

**Three factors scale the picture in the shaders:** unit size, line width and opacity, each from 0.25 (size, width and opacity) to 3 (size, width) or 1 (opacity), default 1. They apply to every mark at once: the size factor to units and chevrons, the width factor to lines, and the opacity factor to every mark and label. The three factors are settings (5.9); a graph's `meta.view` still carries them, and sets them while that graph is open.

### 6.9 Hulls

**Hulls wrap close units of one type.** A hull wraps units of one unit type that lie within one median relation length of each other, joined in chains, at least three units. Each unit widens by 18 world units on every axis, so flat groups have volume. Hulls are convex, semi-transparent, in their type's colour; their opacity grows from 0.05 to 0.16 with the camera's distance, and follows every camera move. They follow the units, rebuilt every fourth frame of a transition. Units the filters hide, and superseded units, leave their hulls. An active path dims the hulls with everything else (6.5) and does not change them. Graphs over 3,000 units start without hulls, unless their saved settings say otherwise. The Hulls switch in the top bar turns them on and off at any size; a graph of at most 3,000 units keeps the switch's last state.

### 6.10 Transitions

**Every change eases over 450 milliseconds with a cubic ease-out.** Moves, depth changes, path changes, filter changes and fades share one mechanism: the previous and next values of each attribute, and one uniform t. With reduced motion, changes are instant. Inspection marks change at once; nothing moves for them.

### 6.11 Picking

**Each line has three click targets: its two chevrons and the line; each unit has a sphere.** Picking casts the pointer's ray; it uses no extra meshes.

- _Units_ answer within at least 6, 8, 10 or 12 pixels on the first, second, third and further planes, or the drawn disc plus 2 pixels when larger, plus 3 pixels of padding. Among units under the point, a drawn disc that covers it, with those 3 pixels, wins, the front one first; past the drawings, the nearest centre wins.
- _Chevrons_ answer within a capsule across the line that covers the glyph, plus 4 pixels.
- _Lines_ answer within half their drawn width plus 1 pixel (at least 1 pixel, without the active path's extra width), plus 6 pixels.
- A point on a target picks it: units before chevrons before lines. A point only in a padding picks the nearest target.
- Hidden or faint marks (opacity below 0.1, the opacity factor of 6.8 included) are not targets. Relations whose box on screen lies far from the pointer are skipped.

A click on a unit makes it the root; Shift and a click on another unit makes it the target; any hit opens in the inspector. A drag of more than 4 pixels is no click. The pointer shows a hand over a target, checked once the pointer rests for 50 ms.

### 6.12 Labels

**Labels show where they fit, at 12 pixels.** Candidates are the units in front of the camera that the filters show, with opacity at least 0.35, superseded fading and the opacity factor included, at most 300 per frame. The root, the target, the inspected unit and the active path's units always show when they are on screen, whatever their opacity: they come first, in ink-1, and a forced label that does not fit still shows. The others follow by plane, then by number of relations, in ink-2, never closer than 2 pixels to another label. Each label tries the right of its unit, then the left, below and above. Labels draw at their unit's opacity plus 0.2, and carry a 3-pixel halo in the surface colour.

### 6.13 Issues in the picture

**Broken data stays visible.** A keypair without its reverse keeps its own chevron; the missing keypair's half of the line is dashed in the issue colour. Superseded units draw at 35 percent opacity, and so does the chevron of a keypair that is superseded or touches a superseded unit; a line fades when all its keypairs do. Refused files show their words (3.3) instead of a picture. Every issue is listed in the Data issues panel.

### 6.14 Keyboard and live region

**Every function works from the keyboard.** The canvas takes focus with Tab; it has the role "application" and the name "Graph in 2D: 81 units, 84 relations" (or 3D).

| Key            | Does                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Arrows         | pan a tenth of the view                                                                                                               |
| + or =, −      | zoom by 1.25                                                                                                                          |
| [ and ]        | turn 15 degrees around the camera's up axis, the graph's y axis, in 3D only                                                           |
| 0              | fit                                                                                                                                   |
| Tab, Shift+Tab | step through the inspected unit's keypairs, outgoing first, then incoming, each in file order; past the last, focus leaves the canvas |
| Enter          | on a keypair, inspect its far unit; on a unit, make it the root                                                                       |
| F              | make the inspected unit the root                                                                                                      |
| Shift+Enter    | make the inspected unit the target                                                                                                    |
| Escape         | clear the target, else the root, else the selection; and the inspector                                                                |
| /              | open the search field (6.19)                                                                                                          |
| S              | show the neighbourhood of the inspected unit (6.21)                                                                                   |
| A              | show all units, ending the scope                                                                                                      |

A click with Ctrl (Cmd on macOS) adds a unit to the selection or takes it out (6.20). The keys are a setting, `keyboard.bindings` (5.9).

A polite live region says what changed, one message per action: "Graph loaded: 81 units", "3D view" or "2D view", "Root unit_79", "Root cleared", "Shortest path from unit_79 to unit_77: 3 steps" ("1 step"), "No path from … to …", "Path cleared", "Inspecting unit …", "Inspecting keypair from … to …", "Inspecting relation between … and …", "Inspector cleared". When one action makes several changes, the inspector's words give way to the others: a click that makes a unit the root says "Root unit_79", and Escape says "Root cleared".

### 6.15 Picture

**Save picture copies the picture as on screen.** The WebGL canvas and the label layer, at the canvas's own pixel size, as a PNG. With Background off, the background is transparent.

### 6.16 Speed

**The viewer stays usable on 10,000 units.** Hidden instances move past the far plane, so they cost no fragments. Picking reuses one snapshot of positions per state and camera. Labels are capped (6.12); hulls start off above 3,000 units (6.9).

### 6.17 Interfaces in the picture

**An interface is a disc divided between its two ends.** A line in the surface colour cuts it in two along the bisector of the angle between the directions to its two ends, as seen on screen, in 2D and 3D and at every point of a transition. When the interface sits on the straight line between its ends, the cut is perpendicular to that line; elsewhere each end's line still enters the half of that end. Each half takes the type colour of the end on its side, or the context colour for an end without a type. An interface with one end shows that end's colour on both halves. One with no end or more than two ends shows the context colour on both, and so does a half whose end is itself an interface.

**Otherwise an interface is a unit like any other.** Its size, opacity, depth, picking, labels, filters and fading follow the unit rules, and it counts as a step in depth and paths. It joins no hull, whatever its type.

### 6.18 Relation drawings

**Relations draw by keypairs or by perspectives; the setting `drawing.relations` chooses.** The module's default is keypairs, so every rule of 6.2 to 6.17 holds unchanged; a host with interface graphs sets perspectives as its base value.

|                                             | Keypairs              | Perspectives                                       |
| ------------------------------------------- | --------------------- | -------------------------------------------------- |
| Plain unit                                  | disc                  | disc; a class unit (3.9) a box                     |
| Interface                                   | divided disc (6.17)   | oval in its type's colour, labelled with its class |
| Chevrons on a relation through an interface | four, one per keypair | two, one per perspective                           |
| A chevron points                            | along its keypair     | at the unit whose perspective it is                |
| A chevron is named and coloured by          | its keypair's type    | the perspective's pair type                        |

- The relation between A and B through the interface i keeps the chevrons of (A, i) and (B, i). The chevron on A's side points toward B and carries B's perspective; the chevron on B's side points toward A and carries A's perspective. So the two chevrons point at each other, each at the unit whose perspective it is.
- An interface with one end carries one chevron on its line, pointing at that end. A direct relation, and an interface with more than two ends, draw by keypairs.
- An interface's label is its class when it has one, else its label or key.
- Picking, labels, the inspector and the scene snapshot follow the drawing. A chevron of the perspective drawing picks its perspective: the inspector shows the perspective's type, its two keypairs and its two ends.

### 6.19 Search

**One field searches the loaded graph by label, key, class and attribute values, and lists what it finds by rank.** The field sits in the viewer's bar. Enter shows the first result; the Search section lists up to `search.limit` results (default 50).

- Each unit is indexed by its label, its key as JSON text, its class and type, and the texts and numbers of its attributes, in lower case.
- Rank: an exact label or key first; then labels that start with the text; then labels with a word that starts with it; then labels that contain it; then attribute values that contain it. Ties go to the unit with more relations, then to file order.
- A result's row names the unit, its class or type, and where the text matched. Its buttons: Show (its neighbourhood, 6.21), Root, Paths to (as Shift and a click), Highlight (adds it to the group Search results, 6.20) and Inspect.
- The live region says "3 results for "unit_7"", or "No result for "x"".

### 6.20 Selection and highlights

**A selection marks units by hand; highlight groups draw units emphasised while the rest dims.**

- A click with Ctrl (Cmd on macOS) adds a unit to the selection, or takes it out. With Box selection on in the viewer's bar, a drag draws a box and the units drawn inside it join the selection; with Ctrl they leave it. Escape clears the selection once the target and the root are clear.
- The Highlights section lists the groups: Selection; Search results; Neighbours, the units within `highlight.hops` steps of the selection (default 1); Issues, the units that data issues name; and the groups a person saved from the selection under a name.
- Each group is on or off; Selection is on by default. While a group is on, its units carry the outline of 6.2 and draw at `highlight.scale` of their size (default 1.15), their labels show as forced labels do (6.12), and every other unit, line and chevron draws at `highlight.dim` of its opacity (default 0.25).
- With one unit selected and `highlight.direction` on, the chevrons of its outgoing keypairs take the outgoing colour and those of its incoming keypairs the incoming colour (4.6); their shapes still show the direction.
- Highlights change no scope and no filter; picking ignores the dimming.

### 6.21 Scope

**The scope chooses which units of the loaded graph the view shows: all of them, or the neighbourhood of chosen units.**

- Show neighbourhood takes the chosen units and the units within `scope.hops` steps of them, in either direction (default 1, from 1 to 3), up to `scope.limit` units (default 500): nearer units first, then those with more relations. It comes from a search result, the inspector, the Scope section, or the key S on the inspected unit.
- Expand adds the neighbours of the chosen units; Hide takes units out; Show all ends the scope. The Scope section names the scope's centre units and its size, and offers these actions and Lay out scope.
- A unit with relations to units outside the scope shows their number after its label, such as "unit_7 +12".
- Units outside the scope go as filtered units do (6.7): they fade out over the transition and answer no click. The layout keeps every place, so a scope that grows or shrinks moves no unit. Lay out scope runs the force layout on the scope alone, from the current places.
- Fit fits the scope when there is one. Making a unit outside the scope the root, the target or the inspected unit adds it to the scope.

---

## 7. Panels

### 7.1 Shared components

**Panels are plain HTML with headings, buttons and visible focus outlines.**

- _Section:_ a heading with a disclosure button (aria-expanded) and a body that opens and closes.
- _RangeSlider:_ two native range inputs on one track, named "<label>, lowest" and "<label>, highest", with the range written as "low to high".
- _UnitField:_ one row: a label, a text field with the placeholder "label or key" that offers unit names, Set and Reset. Enter sets.

### 7.2 Root and depth

**One row sets the root; four rows count the planes.** The row reads "Root [label or key] Set Reset". A click on a unit shows its label in the field and makes it the root; Set makes the typed unit the root and inspects it; Reset clears the root, the field and the inspector. A text that names no unit says "No unit has the label or key …".

Four rows always show: First plane (degree 1), Second plane (degree 2), Third plane (degree 3), Far back planes (degree 4 and more); without a root each reads "none". Below them, "Deepest plane at degree: n", the highest degree reached. The root and units out of reach are not counted.

### 7.3 Paths

**In this order:** "From <root> to <target>" with a Reverse path button; the row "Paths to [label or key] Set Reset"; a menu of paths; a table of the active path.

- Shift and a click on a unit shows its label in the field and finds the paths; Set does the same for a typed unit; Reset clears the target, the field and the inspector, and keeps the root. Without a root, Set says "Set a root first: paths run from the root."
- The menu groups paths by length: "Shortest: length L, N paths", "Shortest + 1: …", "Shortest + 2: …" ("at least N" when counting stopped), up to 50 paths per length, each written with its group first: "Shortest: unit_a → unit_b → …". The first shortest path starts chosen; choosing another makes it active and updates the table.
- The table has the columns Unit label, To label, To weight, From label, From weight: per unit, the type label and weight of the keypair to the next unit, and of the keypair back.
- "No path leads from the root to this unit." and "The root and this unit are the same." replace the menu when they apply.
- Set with an empty field says "Type a label or a key." The table's caption reads "Each row: a unit, the keypair to the next unit, and the keypair back from it." Without paths, a note reads "With a root, Shift-click a unit, or type it above, for the paths to it."

### 7.4 Inspector

**The inspector shows what was clicked.**

- _Unit:_ key, label, type, depth ("the root", "degree 2, second plane", "out of reach", or "no root") and attributes.
- _Interface:_ "Interface between A and B", or "Interface joining 3 units" when it has other than two ends; then what a unit shows; then its keypairs with each end, in two columns, one for each direction through it: "A to i" and "i to B", then "B to i" and "i to A". A missing keypair shows "Missing" with the issue icon.
- _Keypair_ (a chevron): "Keypair from A to B", its type and attributes, and "Its reverse is the other chevron of this line." or "This keypair has no reverse."
- _Relation_ (a line): "Relation between A and B", with both keypairs side by side; a missing keypair shows "Missing" with the issue icon.
- Types show by their label, with the data's value in brackets when the label was changed.

### 7.5 Filters

**A two-knob time window and a weight threshold.** A field menu appears when a graph has more than one time or weight field. The threshold slider reads "At least <value>", or "Threshold off" while no threshold is set. "Clear filters" resets both. Without times or weights the panel says so.

### 7.6 Display

**Three sliders:** Unit size, Line width, Opacity, each with its value.

### 7.7 Types

**Unit types, and keypair types side by side with their complements.** "Units by type (field)" lists each unit type with a colour input, an editable name and its count. "Keypairs by type (field)" is a table with the columns Type and Complement; each cell holds a colour input and an editable name, or "the same type", or "none". A host may put its own controls first under each heading. Each type has a three-way switch, Shown, Faded or Hidden, which sets its filter rule (6.7).

### 7.8 Data issues

**The panel lists the issues in the order of 3.3, each with the issue icon and plain words.** For example: "Row 5 of vertices repeats the key 4.", "Row 3 of edges joins 3 to itself.", "Row 6 of edges names a unit that does not exist: 4 to 8.", "Row 7 of edges repeats the keypair 3 to 4.", "The keypair from 2 to 3 has no reverse.", "The unit 5 takes part in no relation.", "The stated fingerprint differs from the data." The interface issues follow (3.8). Issues about rows name keys; "has no reverse", "takes part in no relation" and the interface issues name units by their labels, or by their keys when they have none. Each item carries its code as `data-code`. "No issues." when there are none.

### 7.9 GraphView

**GraphView is the whole viewer in one component: its bar, the canvas, its side bar and the Settings dialog.** It makes its own model and needs nothing from its host but a graph.

- The bar: 2D and 3D, Hulls, Fit, the drawing (Keypairs or Perspectives, 6.18), the search field (6.19), Box selection (6.20), Panels (opens and closes the side bar), and Settings (opens the dialog, 7.10).
- Above the canvas, the rule banner of 8.1 shows while the graph has issues.
- The side bar holds these sections, in this order: Search, Scope, Root and depth, Paths, Inspector, Highlights, Filters, Types, Display, Data issues and Pinned settings. Each opens and closes; Display ends with Save picture and its Background switch (6.15).
- Props: `graph` (a document) or `source` (5.8); `settings` (the host's base values, 5.9); `settingsStore` (a `BrowserSettingsStore` unless given); `view` (view settings to apply, 5.3); the extension points `profile`, `looks` and `sections` (5.7); and the callbacks `onready`, `onroot`, `oninspect`, `onselect`, `onsettings` and `onpicture`.
- The props `theme` and `motion` remain as base values of the settings `theme.scheme` and `motion.enabled`.

### 7.10 The Settings dialog and pins

**The Settings dialog shows every setting, grouped, each with its control; a pin shows a setting in the side bar as well.**

- The bar's Settings button opens a modal dialog with the heading "Settings". A filter field narrows the list by label, key or description. The groups follow module/settings/registry.ts; each opens and closes.
- Each row holds the setting's label, its control, its default when the value differs ("Default: 12"), Reset and Pin. A setting that takes effect with the next graph says "Applies to the next graph". Refused input says why, such as "From 8 to 24".
- The footer holds Reset all, Import… (a settings file), Export (downloads graphview-settings.json), Close, and the store's state: "Saved", "Saving…" or "Not saved: <reason>".
- The side bar's Pinned settings section shows the pinned settings with the same controls, each with its pin to unpin it. Without pins it says "Pin a setting in the Settings dialog to keep it here."

### 7.11 Search, Scope and Highlights

**Three sections serve 6.19 to 6.21.**

- _Search:_ the results of the bar's field, as 6.19 describes, or "Type in the search field above the canvas." before a search.
- _Scope:_ "All units" without a scope; with one, "Neighbourhood of <names>, <n> units", with the hops (from 1 to 3), Expand selected, Hide selected, Lay out scope and Show all.
- _Highlights:_ one row per group, with its switch, its name and its number of units; Save selection as… with a name field; Clear selection; and the Direction switch.

---

## 8. The shell

### 8.1 Page layout

**The host tools on the left, the viewer filling the rest.** The shell plays the host: its Data and Generate sections choose a graph and hand it to the viewer as JSON. The viewer brings its own bar, canvas and side bar (7.9).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Host  graphview                        Sample graph, 81 units, 84 relations, no issues │
├────────────────┬─────────────────────────────────────────────────────────────────┤
│ ▾ Data         │ [2D][3D] ☑ Hulls Fit  Keypairs ▾  [search…]  ▢ Box  Panels  Settings │
│ ▾ Generate     ├───────────────────────────────────────────┬─────────────────────┤
│                │                                           │ ▾ Search            │
│                │              the canvas                   │ ▸ Scope             │
│                │                                           │ ▾ Root and depth    │
│                │                                           │ ▾ Paths             │
│                │                                           │ ▾ Inspector         │
│                │                                           │ ▸ Highlights        │
│                │                                           │ ▸ Filters           │
│                │                                           │ ▸ Types             │
│                │                                           │ ▸ Display           │
│                │                                           │ ▾ Data issues       │
│                │                                           │ ▾ Pinned settings   │
└────────────────┴───────────────────────────────────────────┴─────────────────────┘
```

The top bar is 48 pixels high and the host tools 300 pixels wide; the viewer's side bar is 360 pixels wide. Host opens and closes the host tools, and the viewer's Panels its side bar; each section opens and closes, and starts open as drawn (▾) or closed (▸). At a width of 900 pixels or less, both start closed and open as drawers over the canvas. The viewer shows the rule banner "This graph breaks the graph rules; the data issues panel lists each breach." above its canvas while a graph has issues (7.9). A file dropped anywhere on the page opens.

### 8.2 Top bar

**The top bar holds the host, not the view.** Host, the name graphview, and the headline. The view's controls are the viewer's own (7.9). There is no Load and no Generate button. The headline reads "<name>, <n> units, <m> relations, <k> issues" in plain words ("no issues", "1 issue"), or "Refused file". <m> counts the relations with both keypairs, as `relationCount` does; a relation with one keypair still draws its line.

### 8.3 Data

**Two groups: File and Web.** The picture is the viewer's (7.9).

- _File:_ Browse… opens a JSON file; Save writes the graph with its view (8.12); the selected file's name shows below, or "No file selected". A note says a file can be dropped on the page.
- _Web:_ a Web address field and Fetch; Share link (8.13), with the link shown in a read-only field and put on the clipboard.
- Messages appear under the groups, such as "Saved <name>.", "Overwrote <name>.", "Downloaded <name>.", "The server at <address> refused the request, or sent no JSON.", "The link is on the clipboard." or "Copy the link below."

A loaded file updates the whole page: headline, sections, panels and fields follow the model.

### 8.4 Generate

**One menu chooses an example or a family; nothing is made until Generate.** The menu groups: Examples, Examples with issues, Files the viewer refuses, Families. Below it:

1. The family's parameters, each a field named as in 8.5: n, rows, columns, branching b, parts c, units per part k, relations m, degrees, β, m₀, groups g, p-in, p-out (families only).
2. Seed.
3. Relations through interfaces (share): from 0 to 1 by 0.05, default 0 (8.16).
4. "Break the rules", a disclosure with: Drop reverse keypairs (share), Unknown keys, Repeated rows, Lone units (families only).
5. "Add types, weights and times": on, it turns on "Unit types to add" (default 5, at most 64), "Relation types to add" (default 4, at most 13) and the next two sliders.
6. Weights: a two-knob slider from 0 to 1, default 0 to 1.
7. Times: a two-knob slider over 2024-01-01 to 2028-12-31, by days, default 2026-01-01 to 2026-12-31.
8. The Generate button.
9. "Reached: …" for Random by degrees: the degrees each unit reached.
10. Explanation, a disclosure that follows every change (8.8).

Generate makes the chosen example or family with these settings, in this order: the family's graph or the example; types, weights and times; broken rules; relations through interfaces. Then the page follows the new graph. The shell starts with the sample graph.

### 8.5 Families

**Every generated graph obeys rules 1 to 4; keys are the whole numbers 1 to n, in key order.** The same family, parameters and seed give the same graph, and the same fingerprint, in every browser. `meta` records `generator: "graphview-gen/1"`, the family, the parameters and the seed. Every family makes at most 20,000 units; communities at most 5,000.

| Family              | Parameters (default)                                                        | How                                                                                                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path                | n ≥ 2 (8)                                                                   | n − 1 relations in a row                                                                                                                                                                                                                                                  |
| Cycle               | n ≥ 3 (8)                                                                   | a closed row                                                                                                                                                                                                                                                              |
| Star                | n ≥ 2 (8)                                                                   | one centre, n − 1 leaves                                                                                                                                                                                                                                                  |
| Complete            | 2 ≤ n ≤ 200 (6)                                                             | every pair related                                                                                                                                                                                                                                                        |
| Grid                | rows, columns (4, 5), at least 2 units                                      | neighbours in rows and columns                                                                                                                                                                                                                                            |
| Tree                | n ≥ 2, branching b ≥ 1 (15, 2)                                              | unit i joins unit ⌊(i − 2)/b⌋ + 1                                                                                                                                                                                                                                         |
| Separate components | parts c ≥ 1, units per part k ≥ 2 (3, 4)                                    | c separate paths of k units                                                                                                                                                                                                                                               |
| Random by size      | n, relations m, parts c (30, 40, 2)                                         | units in contiguous key ranges, larger parts first; a random spanning tree per part by random attachment; random relations inside parts until m. Requires n ≥ 2c and n − c ≤ m ≤ what the parts hold. Above half the free capacity, list the free pairs and shuffle them. |
| Random by degrees   | a list of degrees (3, 3, 2, 2, 2, 1, 1)                                     | configuration model: shuffle the stubs and pair them in order; drop loops and repeats; an odd last stub stays unused; a unit left alone joins a random other unit; show the degrees reached                                                                               |
| Small world         | n > k, k even ≥ 2, β from 0 to 1 (30, 4, 0.1)                               | Watts–Strogatz: each unit rewires its forward relations with chance β to a random unit that is neither itself nor a neighbour; a rewire that would leave the old neighbour alone is undone                                                                                |
| Preferential growth | n ≥ m₀ + 1, m₀ ≥ 1 (40, 2)                                                  | Barabási–Albert: start from a complete graph of m₀ + 1 units; each new unit joins m₀ distinct units drawn from the list of relation ends                                                                                                                                  |
| Communities         | 2g ≤ n ≤ 5,000, groups g ≥ 1, p-in and p-out from 0 to 1 (40, 4, 0.3, 0.02) | planted partition over contiguous key ranges; a lone unit joins a random unit of its group                                                                                                                                                                                |

The random numbers come from mulberry32: a 32-bit state seeded with the seed as an unsigned 32-bit number; a float is the output divided by 2^32; a whole number below n is the float times n, rounded down. Its output for a given seed never changes under the same generator version.

### 8.6 Breaking the rules

**Breaking rules on purpose makes test data with known issues.** Dropping reverses removes the second keypair of a seeded share of relations. Unknown keys add keypairs to a key after the largest key. Repeated rows copy valid rows only, alternating vertices and edges. Lone units take keys after the largest key. The graph records the options in `meta.breaks`; each option produces exactly its own issue, and the issues appear as 3.3 says.

### 8.7 Types, weights and times

**"Add types, weights and times" fills each row that lacks a value; the seed decides every value.**

- Units without a type get one of type_1 to type_n, n from "Unit types to add" (default 5, at most 64), in the type field the graph's units already use, else `type`.
- Relations whose keypairs carry no type get one of n complementary pairs, n from "Relation types to add" (default 4, at most 13): rel_ab and rel_ba, rel_cd and rel_dc, rel_ef and rel_fe, and so on to rel_yz and rel_zy. A relation's first keypair takes the forward name, its reverse the complement. A keypair whose reverse carries a type of its own stays without one.
- Keypairs without a numeric weight get one at random between the Weights knobs.
- Units without a time get a date (`created`, YYYY-MM-DD) at random between the Times knobs. Keypairs without a time get a date between the later of their units' dates and the upper knob.
- The graph records `meta.decorated`.

### 8.8 Explanation

**The explanation describes what Generate will make, with headings, and follows every change.**

- For a family: "Family: <name>", named as in the menu, with what the family is and how many relations it makes; then "Parameters", each parameter with its current value and what it does, and the seed ("the same family, parameters and seed give the same graph").
- For an example: "Example: <name>", its description, its number of units, and the family it belongs to or is close to, or that it belongs to none; broken examples say they break a rule on purpose; refused ones say the viewer refuses them.
- "Types, weights and times": off, the graph keeps what it brings; on, each setting with its value, naming the relation types it will use.
- "Break the rules", when any option is above 0, each option with its value.

### 8.9 Types and look

**Types, theme and motion are the viewer's.** The Types panel is a section of the viewer's side bar (7.7). Theme (As the system, Light, Dark) and Motion (As the system, On, Off) are the settings `theme.scheme` and `motion.enabled`, in the Settings dialog; the shell's page follows the viewer's theme.

### 8.10 Examples

**The examples are the fixtures as they are, then the shell's own.** The shell serves each as JSON at /graphview/examples/<id>.json, written at build time, and hands it to the viewer through a `JsonFileSource`, as a host's data module would (8.17).

- The database fixture is the sample graph, with the id `sample`: 81 units and 84 relations, labels `unit_<key>`, unit types `type_<n>`, keypair types in complementary pairs (rel_ab and rel_ba, rel_cd and rel_dc, rel_ef and rel_fe), and weights. Its description reads "A hierarchy of parts with a few relations across it: hubs with many leaves. Units carry types; keypairs carry types and weights."
- Every other example keeps its fixture's name as its id.
- The random graph of 10,000 units is not bundled as data; it loads on demand from its own file.
- The shell's own examples sit in shell/examples, in name order, each with its file name as its id: the interface graphs of 3.8, "Fully interfaced graph" (interfaces-full) and "Partly interfaced graph" (interfaces-partial), with types on the plain units; and "Broken interfaces" (broken-interfaces), with an interface that joins three units, one that joins one, and two interfaces related directly. A name that starts with "broken-" lists the example among those with issues.

The menu lists the fixtures in fixture order, then the shell's examples: 26 loadable, of which 9 have issues, and 4 refused.

### 8.11 Opening files

**Browse uses the browser's file picker when it offers one, and a file input otherwise.** With the File System Access API, Browse keeps the file's handle, so Save can write back to it. Opening reads `meta.view` and restores the view (8.12). A file that is not JSON says "The file <name> is not valid JSON."

### 8.12 Saving files

**Save writes the whole graph with its view, and asks before it overwrites the open file.**

- The saved document is the graph as held, broken rows included, with `meta.fingerprint` set to the stored fingerprint and `meta.view` set to the view settings (5.3): mode, root, target, chosen path, filters, display, hulls, custom type names and colours, and the camera.
- With an open file's handle, Save asks "The file <name> exists. Overwrite it?". Yes overwrites it. No, or no handle, opens the browser's save dialog with the suggested name `<graph name>.json`, which warns before it replaces a file. Without that dialog, the file downloads.
- There is no separate Save view or Load view.

### 8.13 Share links

**A share link carries the graph's source and the view.** The query holds `example=<id>` (with `decorate=<options>` when types were added, and `interfaces=<share>` when the share is above 0), or `url=<address>`, or `gen=<JSON of family, params, seed, breaks, decorate, interfaces>`, where interfaces is present when above 0; then `mode=2d|3d`, and with a root `view=<JSON of mode, root, target, path>`. Opening the link restores the graph, the mode, the root, the target and the chosen path.

- The link is checked: the example and the family must exist, the seed must be a whole number, and every parameter, break and decorate option must be a number, or a list of numbers where its default is one. A missing one takes its default. The share of interfaces must be a number from 0 to 1; missing, it is 0.
- A link that cannot be read says "The graph in the link could not be read." or "The view in the link could not be read." A link whose graph cannot be read shows the sample graph, in the link's mode, without the link's view.
- A graph opened from a file has no source a link can carry: Share link then says "A graph opened from a file cannot travel in a link; save the file instead."
- Share link puts the link in the address bar and in a read-only field, and copies it to the clipboard.

### 8.14 The bench page

**Under the fragment #bench, a page measures speed on the machine in front of it.** It shows the browser and the WebGL renderer, and a Run button. Run loads the sample graph and the random graph of 10,000 units at their given positions, and measures for each: the time to the first picture; the frame times, median and 95th percentile, while zooming from 1 to 8 over 2 seconds in 2D; and while turning a full turn over 2 seconds in 3D. `window.bench.run()` returns the rows for tests.

### 8.15 The test hook

**The shell exposes `window.graphview` for browser tests and the console.** It holds `model`, `canvas()` (the canvas component with `clickAt`, `pickAt`, `fit`, `getScene`, `whenSettled`, `getCamera`, `setCamera`, `picture`), `ready()` (the count of finished loads), `nextReady()`, `loadExample(id, withAttributes, interfaces)`, `generate(family, params, seed, breaks, withAttributes, interfaces)` and `setLook({ theme, motion })`, which sets the viewer's settings `theme.scheme` and `motion.enabled`. `interfaces` is the share of 8.16, default 0. The page under the fragment #embed shows `GraphView` alone with the sample graph, as the simplest host embeds it; `window.embed` holds `model()` and `events()`, the callbacks GraphView made, in order.

### 8.16 Relations through interfaces

**A seeded share of the relations gets an interface between its two units.** shell/lib/interfaces.ts transforms any document, examples included:

- The relations come in the order of their first rows; each draws once from the generator's random numbers, seeded with the seed XOR 0x1b873593, and goes through an interface when the draw is below the share. 0 changes nothing; 1 takes every relation.
- Each chosen relation gets a new vertex row: the key `i1`, `i2` and so on, as texts, skipping any key a vertex or an edge row already names; the same text as its label; `"interface": true`; the point halfway between its units when both have a position; and `"superseded": true` when every row of the relation is superseded. New rows follow the vertices.
- Each edge row (a, b) of a chosen relation becomes (a, i) and (i, b) in its place, both with the row's other fields, attributes and superseded mark included. Rows that are not edges between two different keys stay as they are.

The explanation (8.8) gains "Relations through interfaces": off, or the share with its meaning.

### 8.17 Routes and builds

**The shell is a SvelteKit app under the base path /graphview.**

| Route                           | Does                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/graphview/`                   | the host tools and the viewer; the fragments `#bench` and `#embed` show the pages of 8.14 and 8.15 |
| `/graphview/api/settings`       | GET and PUT of the viewer's settings file, through the module's handler (5.10)                     |
| `/graphview/examples/<id>.json` | each example's graph, as a host's data module would serve it; written at build time                |

- `npm run build:shell` builds the static demo into dist/shell, for GitHub Pages. It has no server route, so the viewer keeps its settings in browser storage there, through a `FallbackSettingsStore`.
- `npm run build:server` builds the app with its server into dist/server; the browser tests run against it with `vite preview`.
- The shell's page renders in the browser only. The viewer itself also renders on a server without error, as a host's server-side rendering needs (11.3).

---

## 9. Look and feel

### 9.1 Direction

**The picture stays quiet, so that meaning gets the colour.** Structure in slate greys on a calm surface, hairline guides and crisp type, like a navigator's plotting sheet. Colour marks types, the path and issues; the glow belongs to the active path only. Leave out gradients, drop shadows on marks, decorative motion, grids of identical cards, labels in capitals, meta texts joined by middle dots, and arrows appended to button texts. Use sentence case everywhere.

### 9.2 Typeface

**Atkinson Hyperlegible Next keeps similar characters apart.** Its letterforms keep I, l and 1, and O and 0, distinct, and keys are exactly such strings. Install it from Fontsource as a package and serve it with the build; use no font service at run time. Weights 400, 600 and 700; tabular figures for counts and keys. Graph labels 12 pixels; interface text 14; section headings 15 in weight 600; panel subheadings, sidebar headings and explanation headings 13 in weight 600, and tables 13; the name in the top bar 16 in weight 700; notes 12; nothing smaller than 11.

### 9.3 Accessibility

**Colour never carries meaning alone.** Types are named next to their swatches; issues carry icons and dashes; the root, target and inspected unit carry outlines. Every control has a name; sections are headings with disclosure buttons; focus outlines are visible. axe finds no serious or critical violation, in both themes, with every section open (G14). The module follows the system's request for reduced motion.

### 9.4 Motion

**Motion only answers actions.** A load, a new root, a path, a filter or a mode switch may move the picture, over 450 milliseconds; nothing moves by itself. With Motion "As the system", the viewer follows the system's request for reduced motion.

---

## 10. Repository, tools and builds

### 10.1 Repository layout

```
CLAUDE.md                 standing rules for the builder
README.md                 what graphview is, how to run and embed it
docs/                     the specification and its page, the requests (docs/3d), decisions, report, discrepancies, screenshots
fixtures/                 test graphs, expected answers, the reference; read-only
module/index.ts           the module's only entry point
module/core/              pure TypeScript: format, issues, fingerprint, aids, tokens
module/settings/          the setting classes, the registry of settings, the settings file and its stores
module/model/             the model, its sources, contracts and rules
module/render/            the three.js scene and its parts: buffers, camera, picking, hulls, labels, snapshot, shapes, looks; shaders/ for the GLSL
module/view/              Svelte components: the viewer, canvas, panels, sections, the Settings dialog; inspector/ for the inspector's sections; settings/ for the controls of the settings
module/workers/           force layout, distances and path sets
module/server/            the settings handler for a host's route
shell/                    the SvelteKit app: routes/ for the page, the settings route and the example graphs; lib/ for the host's store, examples, generators, types and times, interfaces, explanations, files, links and the importer; sections/ for the host sections; examples/ for the shell's own examples; the bench and embed pages
data/                     the shell's settings file; not in git
tests/gates/              gate tests fixed before the build; read-only
tests/unit/               unit tests
tests/e2e/                browser tests
scripts/                  type declarations, screenshots, the specification page, session start
.github/workflows/        checks on every push; publishing to GitHub Pages from main
```

### 10.2 Tools and versions

**Few tools, pinned exactly; package-lock.json is committed.** TypeScript in strict mode with module resolution "bundler" and `allowImportingTsExtensions`; files import each other with the .ts extension.

| Kind        | Packages                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime     | svelte 5.57.2; three 0.186.1; graphology 0.26.0 and graphology-layout-forceatlas2 0.10.1; @fontsource/atkinson-hyperlegible-next 5.3.0                                                                                                                                                                                                                                                                               |
| Development | vite 8.3.4; @sveltejs/vite-plugin-svelte 7.3.1; @sveltejs/kit 3.1.0 with @sveltejs/adapter-node 6.0.0 and @sveltejs/adapter-static 4.0.0; @sveltejs/package 3.0.1; typescript 6.0.3; vitest 5.0.4; @playwright/test 1.64.1; svelte-check 4.7.6; svelte2tsx 0.7.61; prettier 3.9.10 with prettier-plugin-svelte 4.1.1; @axe-core/playwright 4.13.0; @types/node 26.6.5; @types/three 0.186.0; graphology-types 0.24.8 |

TypeScript 6, not 7: svelte-check 4.7.6 accepts only TypeScript 5 or 6. Add no other runtime dependency without a reason in docs/decisions.md.

### 10.3 Scripts

| Script                 | Does                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run dev`          | the shell for development, with its server, at /graphview/                                                 |
| `npm run check`        | svelte-check, `prettier --check .`, and Vitest on tests/gates and tests/unit                               |
| `npm run build:module` | the module as a library into dist/module, with CSS, then type declarations with svelte2tsx                 |
| `npm run build:shell`  | the shell as static files into dist/shell, for the base path /graphview/ (8.17)                            |
| `npm run build:server` | the shell with its server into dist/server (8.17)                                                          |
| `npm run package`      | the module as Svelte sources for a SvelteKit host, into dist/package, with svelte-package                  |
| `npm run build`        | the module, both shell builds and the package                                                              |
| `npm run e2e`          | builds the server build, serves it with `vite preview` on port 4173 under /graphview/, and runs Playwright |
| `npm test`             | `check`, then `e2e`                                                                                        |

The module build and the package keep svelte, three and graphology external.

### 10.4 Browser tests

**Playwright runs Chromium with WebGL 2 on SwiftShader.** The window is 1280 by 800; the launch flags are `--use-angle=swiftshader --enable-unsafe-swiftshader`. Two projects: "chromium" runs the browser tests on 4 workers; "speed" runs the speed tests and the 10,000-unit test afterwards, on 1 worker, so that measurements do not share processors. Tests that load a heavy scene wait for quick frames and leave the page before they end. In a cloud session without Playwright's download, use the preinstalled Chromium (/opt/pw-browsers/chromium) when not on CI.

### 10.5 Continuous checks and publishing

**checks.yml runs `npm test` on every push and pull request; pages.yml publishes dist/shell to GitHub Pages after each push to main.** The shell's address is https://ronald101.github.io/graphview/, and the bench page is at #bench.

---

## 11. Tests and gates

### 11.1 Fixtures

**27 fixtures under fixtures/graphs, indexed in fixtures/index.json.**

| Group   | Fixtures                                                                                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid   | pair, path-4, triangle, cycle-5, cycle-6, star-6, complete-4, two-pairs, grid-3x3, petersen, complete-9, text-keys, superseded, database-2026-07-24 (81 units, 84 relations), random-10k (10,000 units with given positions) |
| Broken  | broken-missing-reverse, broken-loop, broken-repeated-keypair, broken-unknown-unit, broken-repeated-key, broken-orphan, broken-bad-rows, broken-mixed                                                                         |
| Refused | load-error-not-object, load-error-format, load-error-vertices, load-error-edges                                                                                                                                              |

fixtures/expected/<name>.json holds each fixture's load result, issues, fingerprints (stored and current), counts, components, degrees, rings and path entries. The database fixture is the sample graph (8.10). Its source once carried private names; the repository keeps only SHA-256 hashes of those terms (tests/unit/privateWords.ts), and tests scan every text file and the built shell against them (11.3, 11.4).

### 11.2 Gates

**Twenty gates decide when the work is done.** G0 to G8, G15 and G16 exist before the build and are read-only.

| Gate | What it checks                                                                                                                                                                                                                                            | Where                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| G0   | the fixture set holds 27 graphs                                                                                                                                                                                                                           | tests/gates/core.gate.test.ts        |
| G1   | every file under fixtures/ matches its hash in the manifest; none is missing or extra                                                                                                                                                                     | tests/gates/manifest.gate.test.ts    |
| G2   | loading and issues equal the expected results, in order; refusals carry the expected code                                                                                                                                                                 | tests/gates/core.gate.test.ts        |
| G3   | the fingerprints of the stored and the current graph                                                                                                                                                                                                      | tests/gates/core.gate.test.ts        |
| G4   | counts and components of both graphs                                                                                                                                                                                                                      | tests/gates/core.gate.test.ts        |
| G5   | degrees                                                                                                                                                                                                                                                   | tests/gates/core.gate.test.ts        |
| G6   | rings, as sets per ring                                                                                                                                                                                                                                   | tests/gates/core.gate.test.ts        |
| G7   | path sets: shortest, reason, stop, total, counts by length, listed paths as sets, and the default limits                                                                                                                                                  | tests/gates/core.gate.test.ts        |
| G8   | the database graph: 2,628 of 3,240 pairs have exactly one path within two extra steps                                                                                                                                                                     | tests/gates/core.gate.test.ts        |
| G9   | determinism: layouts and generators give the same result for the same seed; three fingerprints of fixed seeds never change                                                                                                                                | tests/unit                           |
| G10  | every generator family, over 200 seeds, gives graphs without issues and with the characteristics asked                                                                                                                                                    | tests/unit                           |
| G11  | three click targets per line: a click on each chevron inspects its keypair, a click on the line inspects the relation, and a click beside each within its padding still picks it                                                                          | tests/e2e                            |
| G12  | every requirement of sections 6 to 8 has at least one passing test named after it; a test's name starts with its section, such as "§6.4 Root and depth: …"                                                                                                | tests/unit, tests/e2e                |
| G13  | every change reaches the listeners through the model, with the aspects of 5.2; saved settings bring a graph back as it was left                                                                                                                           | tests/unit                           |
| G14  | axe finds no serious or critical violation in the shell, in both themes, with every section open; the keyboard map of 6.14 and the live region work                                                                                                       | tests/e2e                            |
| G15  | the colour tokens equal 4.6, with their contrast                                                                                                                                                                                                          | tests/gates/tokens.gate.test.ts      |
| G16  | the module imports nothing outside module/; the core imports only the core and uses no browser globals; the shell reaches the module only through module/index.ts                                                                                         | tests/gates/boundaries.gate.test.ts  |
| G17  | speed in the test browser: the sample graph's first picture within 1 second; the random graph's within 5 seconds at given positions; the complete graph of nine's path set within 2 seconds; median zoom frame on the sample graph within 50 milliseconds | tests/e2e, numbers in the report     |
| G18  | the module build, both shell builds and the package succeed, and every browser test runs against the shell's server build under /graphview/                                                                                                               | `npm run build`, `npm run e2e`       |
| G19  | a visual review of sixteen fixed views (11.5)                                                                                                                                                                                                             | docs/report.md and docs/screenshots/ |

### 11.3 Unit tests

**Unit tests cover what the gates do not.** At least: keys near the integer limits; schema reflection; depth rules and planes in 2D and 3D; filters and line weights; picking geometry and hull groups; the type registry's pairing, colours and custom names; the worker against the core; the model's consolidation, aspects, planes, paths, reverse, path steps, find, reset on a new graph, settings round trip, refusals, and a newer load winning; label placement (no two labels closer than 2 pixels, obstacles kept clear, forced labels first); the generators; types, weights and times (ranges, complements, each row that lacks a value, determinism); the explanations, with every family's relation count; parameter names; the examples and every text file of the repository (no private term); share links and their checks; the importer; given positions only when every unit has one; hulls above 3,000 units; kinds, ends and the interface issues; the halves' colours and the unit shapes; relations through interfaces at 0, a share and 1, by seed; share links with interfaces; a profile with invented names that adds a kind with its own shape, look, check, words and section, classes, declared pairs, a superseded rule, perspective types and a projection, without editing the module.

Version 4.0 adds: every setting's check (allowed and refused values for each class); the registry's defaults equal the values sections 4 to 9 give; the settings file round trip, with unknown keys and refused values kept and reported; the layers of values, a graph's `meta.view` included; the stores (memory, browser with a stand-in storage, fallback); the handler's revision rule and its 409; the sources; a profile from JSON (kinds by a field, perspectives from `pair`, superseding by pair type, self-relations allowed, direct relations reported); the perspective drawing's chevrons (which keypairs, where they point, their types); the search ranking; filter rules on units, keypairs and lines; highlight groups and the selection; the scope (hops, limit, ranking, counts outside, the root added); and `GraphView` rendered on a server without error.

### 11.4 Browser tests

**Browser tests run against the production build, through `window.graphview` and the scene snapshot.** At least:

- _Viewer:_ lines and chevrons per relation and keypair, in type colours; 2D keeps z = 0 with 3D's sizes and opacities, and the 3D button moves units back by plane; clicks never switch modes; the Root field by label or key, Reset; a far-plane unit answers a click within its reach; Shift-click paths with menu, table, reverse and reset; the Paths field; Escape; three click targets and their paddings (G11); the weight threshold; the time window with fade-in; a type colour reaching the picture in 2D and 3D; a renamed type in the inspector and the path table; display overrides in pixels, line width included; hulls and their switch, unchanged by a path; issues and the missing reverse; one superseded keypair; Fit on a canvas narrower than tall; picking and labels with the opacity factor; reduced motion; the keyboard map and the live region, one message per action.
- _Shell:_ the top bar's contents; sidebars and sections; drawers below 900 pixels; the menu's groups; nothing happens until Generate; every example loads with the right headline or refusal code; random by degrees shows "Reached"; breaking rules shows the banner and the issues; the theme reaches the page and the picture; the bench page shows the browser and the renderer; GraphView on the embed page; refused files show the core's words; the built files carry no private term.
- _Data:_ Browse with the file picker; the file input and the importer; Save with the overwrite question, Save under a new name, and reopening restores the view; download where no picker exists; the picture's size and background; Fetch, and a refused address; a file that is not JSON; a file saved in 3D reopened from a 2D canvas; share links of an example and of a generated graph; links that cannot be read; Share link on a graph from a file.
- _Generate:_ "Add types, weights and times" opens Types and turns on sliders and numbers; generated types, complements, weights and times fall in their ranges; an example keeps what it brings; the explanation follows each change.
- _Interfaces:_ the three interface examples load with their kinds; in 2D, and in 3D with a root and a turned camera, each half of an interface shows the colour of the end on its side, in pixels; one end, no end, too many ends and an interface as an end give their colours; the inspector's interface section and the live region; the interface issues; the Generate setting and its link.
- _Large graph:_ the random graph loads at its given positions, compared with the fixture's; a root counts every unit on its plane as the expected rings say; a pick answers; hulls start off and the switch turns them on.

- _Version 4.0:_ the viewer's bar and side bar; the Settings dialog (open, filter, a slider that changes the picture, Reset, Reset all, an import and an export); a pin that shows a setting in the side bar; settings that survive a reload through /graphview/api/settings; a refused value; the drawing switch, with two chevrons per relation through an interface pointing at their units and named by pair type; the search field with Show, Root and Highlight; filter rules that fade and hide, from the Types panel too; a click with Ctrl and a box selection; a highlight group dimming the rest; the scope with Expand, Hide, "+n" labels and Show all; the keys S, A, / and Escape.

### 11.5 Visual review

**Take each screenshot, look at it, and judge it against section 9.** Fix what fails, and record a verdict and a note per view in the report. scripts/screenshots.mjs takes them at 1440 by 900 from the production build.

1. Sample graph, 2D, light.
2. The same, dark.
3. Root unit 1 in 2D, light.
4. Keypair 76 to 80 in the inspector, light.
5. Paths 79 to 77, one step longer chosen, dark.
6. broken-mixed with its issues, light.
7. superseded, light.
8. The random graph of 10,000 units, dark.
9. Generate with a small-world graph and the explanation open, light.
10. text-keys with labels, light.
11. The shell at 800 pixels with the Controls drawer open, light.
12. 3D first picture of the sample graph with hulls, light.
13. 3D, root unit 1, camera turned to show the planes, light.
14. 3D, path 79 to 77, turned, dark.
15. Generate, communities with types, the Types section open, light.
16. 3D, communities, threshold 0.6 and a time window, light.
17. Fully interfaced graph, close to the interface between A and B, 2D, light.
18. Grid with half of the relations through interfaces and types, 3D, root unit 6, turned and close to the interface i2, dark.

---

## 12. Building it in one run

### 12.1 Rules of work

**The builder works alone and reports at the end.**

- Do not ask questions. Where this document leaves a choice open, choose the simplest option that meets it, and record the choice, the reason and the alternative in docs/decisions.md.
- If a tool, a permission or the network refuses an action, stop that path and report it with its exact message. Never work around a refusal.
- Never edit anything under fixtures/ or tests/gates/. Never skip, weaken or delete a test to make it pass. If an expected result looks wrong, mark it "disputed" in the report with the evidence.
- Work on a branch and deliver through a pull request. Never push to main, never force-push, and never merge.
- Keep each fact in one place. Do not copy this document, the fixtures or the data.
- Check before claiming: run the tests, and look at screenshots before judging the look.
- Use one word for one thing, as 2.1 defines them. Compare keys exactly.
- Write documents in short sentences of about 15 to 20 words, plain words, a bold lead sentence per section, and checked numbers.

### 12.2 Milestones

**Work through these in order; after each, run its checks, update the report, commit and push.**

| Milestone           | Work                                                                                                                                                                                      | Check                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| M0 Start            | Record Node.js and the browser's WebGL renderer. Create package.json, the configurations and the scripts of 10.3, with the versions of 10.2. Create docs/decisions.md and docs/report.md. | `npm run check` runs; G1 passes                  |
| M1 Core             | module/core: 3.3 to 4.6, SHA-256 in plain TypeScript; unit tests for keys near the limits.                                                                                                | G0 to G8, G15, G16                               |
| M2 Model            | module/model and module/workers: 3.8, 5.2 to 5.4, the profile of 5.7, 6.1, 6.4 to 6.7, 6.9 geometry; unit tests of 11.3.                                                                  | G9, G13                                          |
| M3 Render and view  | module/render and module/view: 5.5, 5.6, the looks and sections of 5.7, sections 6 and 7.                                                                                                 | G11, G16                                         |
| M4 Shell            | Section 8: layout, Data, Generate with families, breaking rules, types, relations through interfaces, explanation, examples, files, share links, bench page, embed page, test hook.       | G10; every example loads                         |
| M5 Look             | The eighteen screenshots of 11.5, judged and fixed; axe in both themes.                                                                                                                   | G14, G19                                         |
| M6 Speed and builds | G17 numbers; both builds; every browser test against the production build; README.                                                                                                        | G17, G18; `npm test` passes from a clean install |
| M7 Finish           | Complete the report; open the pull request.                                                                                                                                               | 12.4                                             |

**Version 4.0 follows the same rules in its own milestones.**

| Milestone              | Work                                                                                                         | Check                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| N0 Contract            | This version of the specification; decisions D79 and on.                                                     | the specification page builds             |
| N1 SvelteKit shell     | The shell on SvelteKit (8.17), the same page as before; both shell builds.                                   | every earlier test passes                 |
| N2 Settings            | 5.9, 5.10, 7.10: the classes, the registry, the stores, the handler, the dialog and pins; every value wired. | the tests of 11.3 and 11.4 for settings   |
| N3 Viewer and sources  | 5.8, 7.9, 8.1 to 8.10: the viewer's bar and side bar; the shell as host; examples served as JSON.            | the shell's tests, updated to 8.1 and 8.2 |
| N4 Profile and drawing | 3.8, 3.9, 5.7, 6.18: the profile from JSON and the perspective drawing.                                      | the drawing's tests                       |
| N5 Data manipulation   | 6.7, 6.19 to 6.21, 7.7, 7.11.                                                                                | their tests                               |
| N6 Package and report  | `npm run package`; the README for hosts; the report.                                                         | `npm test` passes from a clean install    |

### 12.3 Report

**docs/report.md has these sections, in this order:** status per milestone; gates G0 to G19 with pass, fail, not testable or disputed, and the evidence; requirements of sections 6 to 8 with their tests; speed with the machine; the visual review; decisions in short; deviations with reasons; open items; how to run.

### 12.4 Done

**The work is done when four things hold.**

1. Every gate passes, or is marked "not testable" for a reason outside the code, such as a refused download.
2. docs/report.md is complete.
3. A pull request from the working branch to main carries the report's summary.
4. Nothing was pushed to main, and nothing under fixtures/ or tests/gates/ changed.

---

## Appendix A. Where each source went

| Source                                                 | Sections                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release 1 specification, Parts A to C                  | 2, 3, 4                                                                                                                                                                                                                                                                                                                                                                                         |
| Release 1, Part D (component, events, commands, scene) | replaced by 5                                                                                                                                                                                                                                                                                                                                                                                   |
| Release 1, Part E (V01 to V23)                         | carried into 6 and 7: pan, zoom, fit, turn, given positions, force layout, inspector, issues, themes and picture remain; rings became planes, focus became the root, search became the Root and Paths fields, the path explorer became Paths; circle and grid layouts, pins, stable change, hover highlighting, hiding lone units, the arrows and lines drawings and the key panel were dropped |
| Release 1, Part F (look)                               | 4.6, 9                                                                                                                                                                                                                                                                                                                                                                                          |
| Release 1, Part G (shell)                              | 8                                                                                                                                                                                                                                                                                                                                                                                               |
| Release 1, Part H (engine trial)                       | closed: the one viewer draws with three.js                                                                                                                                                                                                                                                                                                                                                      |
| Release 1, Parts I to K                                | 10, 11, 1.4                                                                                                                                                                                                                                                                                                                                                                                     |
| 3D specification 01                                    | 3.7, 6.2, 6.4, 6.5, 6.11, 5.4                                                                                                                                                                                                                                                                                                                                                                   |
| 3D specification 02                                    | 6.6 to 6.10, 6.11, 6.4, 6.5                                                                                                                                                                                                                                                                                                                                                                     |
| Adjustments of 19 October 2026                         | 6.3, 7.2, 7.3, 7.7, 8.1 to 8.12, 6.15                                                                                                                                                                                                                                                                                                                                                           |
| Decisions D1 to D54                                    | folded into the sections they decide                                                                                                                                                                                                                                                                                                                                                            |
| Request of 27 October 2026                             | interface graphs and extension points: 2.1, 3.1, 3.8, 5.2, 5.5 to 5.7, 6.2, 6.17, 7.4, 7.8, 7.9, 8.4, 8.10, 8.13, 8.15, 8.16, 11                                                                                                                                                                                                                                                                |

## Appendix B. Sources

- graphview specification for release 1, version 1.0, 14 October 2026.
- Custom 3D graph viewer with egocentric depth projection and pathfinding (docs/3d/01).
- Advanced high-quality 3D graph viewer with Svelte (docs/3d/02).
- Adjustments of 19 October 2026 (docs/3d/03-adjustments.md).
- Decisions D1 to D54 of release 1 and the 3D work, folded into this text.
- The discrepancies between version 2.0 and the code (docs/spec_discrepancies.md), settled in version 2.1.
- The request of 27 October 2026: interface graphs in the public version, with exactly two kinds of unit, and a source ready for other families of graphs; decisions D65 to D78.
- Near-shortest paths: T. H. Byers and M. S. Waterman, Operations Research 32 (1984) 1381–1384; W. M. Carlyle and R. K. Wood, Networks 46 (2005) 98–109. Counting simple paths is #P-complete: L. G. Valiant, SIAM Journal on Computing 8 (1979) 410–421.
- Atkinson Hyperlegible Next: https://fontsource.org/fonts/atkinson-hyperlegible-next.

## Appendix C. Changes in version 2.1

Version 2.1 settles every item of docs/spec_discrepancies.md. Where the code was wrong, the code changed and this text stayed; where this text was unclear or silent, it now says what the code does.

| Section    | Change                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.3, 3.6   | fixtures/reference holds make_fixtures.py and the sample's source; what the reference leaves out; CLAUDE.md names this document as the contract.                      |
| 2.1, 4.2   | "Degree" is steps from the root; the core's `degrees()` counts relations and keypairs. "Focus" is defined.                                                            |
| 3.3        | The core's refusal message is the text the viewer shows.                                                                                                              |
| 3.7        | The importer's conversion rule, dropped fields, meta and messages.                                                                                                    |
| 4.1, 5.6   | Every export is named.                                                                                                                                                |
| 4.6, 6.7   | Lines below the threshold use the ring token at 60 percent opacity; equal weights have strength 1; strength eases.                                                    |
| 5.1 to 5.5 | Workers import one type from the model; the graph aspect means everything changed; `dispose()`; the default worker factory; the snapshot's display factors and reach. |
| 6.1        | Given positions only when every unit has one; Barnes–Hut from 500 units.                                                                                              |
| 6.2, 6.8   | Shader materials; chevron sizes follow depth, the size factor and the path.                                                                                           |
| 6.3        | Fit spans the canvas's width as well as its height.                                                                                                                   |
| 6.6        | A backward type's tint follows a custom forward colour.                                                                                                               |
| 6.9, 6.16  | Hulls start off above 3,000 units and the switch still works; opacity follows the camera; a path dims hulls without changing them.                                    |
| 6.11, 6.12 | Picking and labels include the opacity factor; forced labels always show.                                                                                             |
| 6.14       | The turn axis; every live-region message, one per action.                                                                                                             |
| 7.3 to 7.8 | Path menu entries carry their group; "Threshold off"; which issues name labels.                                                                                       |
| 8.1 to 8.5 | The drawer boundary at 900 pixels; what the headline counts; messages; parameter names and limits.                                                                    |
| 8.7, 8.8   | Types, weights and times fill each row that lacks a value; explanations use the menu's names.                                                                         |
| 8.10       | The examples are the fixtures as they are; the sample graph is anonymous in the fixtures themselves.                                                                  |
| 8.13, 8.15 | Share links are checked; a file's graph cannot travel in a link; the embed page.                                                                                      |
| 9.2, 10.1  | Text sizes of 13 and 16 pixels; the repository layout.                                                                                                                |
| 11         | Tests cite their sections; the private-term check uses hashes; the new tests.                                                                                         |

## Appendix D. Changes in version 3.0

Version 3.0 adds interface graphs and the extension points. The source was split along its seams first, without a change in behaviour (D65 to D67).

| Section        | Change                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1, 2.2       | The words kind, plain, interface, end, perspective and profile; interfaces add two checks of the model's own.                                                  |
| 3.1, 3.8       | The vertex field `interface`; kinds, ends, fully and partly interfaced graphs; the issues interface-ends and interface-pair.                                   |
| 5.2, 5.5, 5.6  | The model's profile, stored graph, kinds and superseded units, `kindOf`, `endsOf`, `perspectivesOf`; the snapshot's kind, shape, ends and halves; new exports. |
| 5.7            | Extending graphview: profiles, looks, sections and words.                                                                                                      |
| 6.2, 6.6, 6.17 | The divided disc of an interface; types may come from a profile's classes and declared pairs.                                                                  |
| 7.4, 7.8, 7.9  | The interface's inspector section; the interface issues' words; GraphView's `profile`, `looks` and `sections`.                                                 |
| 8.4, 8.10      | Generate's "Relations through interfaces (share)" and the order of its steps; the shell's own examples.                                                        |
| 8.13, 8.15     | Links and the test hook carry the share of interfaces.                                                                                                         |
| 8.16           | Relations through interfaces.                                                                                                                                  |
| 10.1, 11, 12.2 | The new folders; the new unit and browser tests; views 17 and 18; the milestones.                                                                              |

## Appendix E. Changes in version 4.0

Version 4.0 makes the viewer one self-contained component for a host that supplies only graphs, and turns the shell into a SvelteKit app that simulates such a host.

| Section                           | Change                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1, 1.2, 1.4                     | The viewer and the host; the settings and server parts; the module runs no server but offers a handler.                                                                            |
| 2.1                               | The words source, setting, control, settings file and store, pin, class unit, pair type, drawing, selection, highlight group and scope.                                            |
| 3.8, 3.9                          | A profile may allow self-relations and report direct relations; classes and perspectives in the data.                                                                              |
| 4.6                               | The tokens are the defaults of the Theme settings.                                                                                                                                 |
| 5.1 to 5.3, 5.5, 5.6              | The settings layer; the model's settings, source, selection, highlights, scope and rules, with their methods and aspects; the snapshot's drawing, emphasis and scope; new exports. |
| 5.7                               | A profile from JSON; the shapes box and oval.                                                                                                                                      |
| 5.8 to 5.10                       | Sources, settings and the settings handler.                                                                                                                                        |
| 6.7, 6.8, 6.14                    | Filter rules; the display factors as settings; the keys S and A, Ctrl and a click, and / for search.                                                                               |
| 6.18 to 6.21                      | The perspective drawing, search, selection and highlights, and the scope.                                                                                                          |
| 7.7, 7.9 to 7.11                  | The Types panel's switches; GraphView as the whole viewer; the Settings dialog and pins; the Search, Scope and Highlights sections.                                                |
| 8.1 to 8.3, 8.9, 8.10, 8.15, 8.17 | The shell as host: its page, top bar and Data section; types and look in the viewer; examples served as JSON; the hook's look; routes and builds.                                  |
| 10.1 to 10.3, 11, 12.2            | The new folders, packages and scripts; the new tests; G18 over every build; the milestones N0 to N6.                                                                               |
