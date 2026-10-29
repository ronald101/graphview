# graphview

**graphview draws graphs of units and keypairs, in 2D and 3D, and lets a person explore them.** It has two parts: a reusable Svelte 5 module, and a static shell around it with a graph generator. A graph is a JSON document of units and keypairs; a keypair and its reverse make one relation, drawn as one line with a chevron for each direction.

The module repairs nothing. It lists every breach of the graph rules as a data issue.

## Documents

docs/specifications.md is the contract: everything needed to build graphview in one run. docs/specifications.html is the same text as a page with a table of contents; `node scripts/specifications-html.mjs` makes it from the Markdown. docs/3d holds the requests it grew from: the 3D view and the adjustments of 19 October 2026. docs/report.md says what was built, which tests pass and what is open. docs/decisions.md records the choices the specification left open.

## Run the shell

You need Node.js 22.17 or later. The shell is a SvelteKit app that plays the host.

```sh
npm ci
npm run dev        # the shell with its server at http://localhost:5173/graphview/
npm run build      # the module into dist/module, the static shell into dist/shell, the shell with its server into dist/server
npm test           # types, format, unit and gate tests, then the browser tests against dist/server
```

The browser tests need Playwright's Chromium: `npx playwright install --with-deps chromium`.

After a merge to main, GitHub Pages publishes the shell at https://ronald101.github.io/graphview/. Add `#bench` to that address to measure speed on your machine, or `#embed` to see `GraphView` alone on a page (shell/Embed.svelte), as the simplest host embeds it.

## Use the shell

- **Top bar.** 2D and 3D switch the view; clicks on the graph never do. Hulls draws outlines around close units of one type. Fit shows the whole graph. Controls and Panels open and close the sidebars; each section in them opens and closes too.
- **Data.** File: Browse opens a JSON file, Save writes the graph with its view settings (mode, root, path, filters, display, type names and colours, camera) and asks before it overwrites the open file. Picture: Save picture writes the picture as on screen, with or without its background. Web: Fetch loads a JSON file from an address; Share link makes a link to the graph and its view.
- **Generate.** Choose an example or a family, change its settings, then press Generate. "Relations through interfaces (share)" puts that share of the relations through an interface: a unit drawn as a disc divided between the colours of the two units it joins. "Add types, weights and times" adds what a graph lacks: unit types type_1, type_2 and so on, relation types in complementary pairs (rel_ab and rel_ba, rel_cd and rel_dc …), and weights and dates within the ranges of the two-knob sliders. The Explanation below the button describes the family or example and each setting with its value.
- **Types.** Unit types, and keypair types side by side with their complements. Every colour and name can be changed.
- **Root and depth.** Click a unit, or type its label or key, to make it the root. In 3D the other units step back by their degree: degree 1 in front, degree 2 one plane back, degree 3 and more further back. 2D keeps them on one plane with the same sizes, opacities and colours. The panel counts the units on the first, second and third planes and the far back planes.
- **Paths.** Shift-click a unit, or type it, for the shortest paths from the root and those one and two steps longer. The menu picks the path; the table lists each step's keypairs, their types and weights. Reverse path swaps the ends.
- **Inspector.** A unit, a chevron (one keypair) or a line (both keypairs of a relation). An interface shows the two units it joins and its keypairs each way through it.
- **Filters and Display.** A time window and a weight threshold; unit size, line width and opacity.
- **Keyboard.** On the canvas: the arrows pan, + and − zoom, [ and ] turn in 3D, 0 fits, Tab steps through the inspected unit's keypairs, Enter follows a keypair or makes a unit the root, Shift+Enter makes it the path's end, Escape clears, / opens the Root field.

The shell also reads JSON files whose rows use `id`, `source` and `target`.

**Interface graphs.** A vertex row with `"interface": true` is an interface: it joins two units, its ends, through four keypairs, (A, i), (i, B), (B, i) and (i, A). Direct relations stay allowed. The examples "Fully interfaced graph" and "Partly interfaced graph" show both; "Broken interfaces" shows the two interface issues.

## Embed the module in a Svelte 5 host

The module's only entry point is module/index.ts. The simplest host uses `GraphView`, which holds its own model, the canvas, a bar and the panels:

```svelte
<script lang="ts">
  import { GraphView } from 'graphview/module/index.ts';
  let { doc } = $props();
</script>

<div style="height: 600px">
  <GraphView graph={doc} theme="system" onroot={(e) => console.log('root', e.root)} />
</div>
```

A host that lays out its own page makes a `GraphModel`, hands it to `GraphCanvas` and to the panels it wants (`RootPanel`, `PathsPanel`, `InspectorPanel`, `FiltersPanel`, `DisplayPanel`, `TypesPanel`, `IssuesPanel`), and calls the model's methods: `load`, `setMode`, `setRoot`, `setTarget`, `choosePath`, `setFilters`, `setOverrides`, `setTypeLabel`, `setTypeColour`, `setHulls`, `inspect`. Every change goes to the model first; the model tells its listeners which aspects changed, and the canvas and the panels redraw from it. module/model/contracts.ts holds the contracts.

The core works without a browser: `loadGraph`, `fingerprint`, `components`, `rings` and `pathSet` come from the same entry point.

## Extending graphview

A host fits graphview to its own family of graphs without editing the module (specification 5.7). A **profile** tells the model the kinds of unit, their classes, declared pairs of keypair types, checks of its own, what supersedes a unit, the pair type of each perspective of an interface, and an optional projection of the graph it shows. **Looks** tell the canvas how each kind draws, with GLSL for new shapes. **Sections** give the inspector a component per kind. The defaults are the public ones: plain units and interfaces.

An invented example: towns, hubs drawn as squares, and a check that a hub has at least three relations.

```ts
import {
  GraphModel,
  INTERFACE,
  PUBLIC_LOOKS,
  UNIT_SHAPES,
  type Check,
  type Profile,
  type Looks,
} from 'graphview/module/index.ts';

const hubFew: Check = {
  codes: ['hub-few'],
  find: (g, kinds, relations) =>
    kinds.of.flatMap((kind, i) => {
      const n = relations.filter((r) => r.a === i || r.b === i).length;
      return kind === 'hub' && n < 3 ? [{ code: 'hub-few', key: g.units[i], relations: n }] : [];
    }),
  words: (issue, name) => `The hub ${name(issue.key as string)} has ${issue.relations} relations, fewer than 3.`,
};

const profile: Profile = {
  kinds: [INTERFACE, { id: 'hub', claims: (info) => info?.attrs?.role === 'hub', joins: false }],
  classOf: (info) => (typeof info?.attrs?.region === 'string' ? info.attrs.region : null),
  pairs: [['road-out', 'road-in']],
  checks: [hubFew],
};

const looks: Looks = {
  kinds: { ...PUBLIC_LOOKS.kinds, hub: { shape: 'square', hulls: false } },
  shapes: [...UNIT_SHAPES, { name: 'square', glsl: 'return max(abs(uv.x), abs(uv.y));' }],
};

const model = new GraphModel(undefined, profile); // then <GraphCanvas {model} {looks} />
```

`GraphView` takes the same as props: `profile`, `looks` and `sections`. tests/unit/profile.test.ts holds this example with a superseded rule, perspective types and a projection that folds interfaces into lines.

## Layout of the repository

- module/: core (format, issues, fingerprint, aids, tokens), model (the state and its contracts), render (the WebGL scene), view (the canvas and panels), workers.
- shell/: the shell, a SvelteKit app: routes/ for its pages, lib/ for the host's own parts.
- fixtures/: test graphs, their expected answers, and the Python reference. Read-only.
- tests/: gates (fixed before the build), unit tests, browser tests.
- docs/: the specification, the requests, the report, decisions, screenshots.
