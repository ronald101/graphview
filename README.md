# graphview

**graphview draws graphs of units and keypairs, in 2D and 3D, and lets a person explore them.** It has two parts. The _viewer_ is one Svelte 5 component, `GraphView`, for a host that supplies only graphs: it brings its own bar, canvas, side bar and Settings dialog, keeps its settings, and searches, filters, highlights and narrows the graph it was given. The _shell_ is a SvelteKit app that plays such a host, with example graphs and a graph generator. A graph is a JSON document of units and keypairs; a keypair and its reverse make one relation, drawn as one line with a chevron for each direction.

The viewer repairs nothing. It lists every breach of the graph rules as a data issue.

## Documents

docs/specifications.md is the contract: everything needed to build graphview in one run. docs/specifications.html is the same text as a page with a table of contents; `node scripts/specifications-html.mjs` makes it from the Markdown. docs/3d holds the requests it grew from. docs/report.md says what was built, which tests pass and what is open. docs/decisions.md records the choices the specification left open.

## Run the shell

You need Node.js 22.17 or later.

```sh
npm ci
npm run dev        # the shell with its server at http://localhost:5173/graphview/
npm run build      # dist/module (library), dist/shell (static), dist/server (with its server), dist/package (for hosts)
npm test           # types, format, unit and gate tests, then the browser tests against dist/server
```

The browser tests need Playwright's Chromium: `npx playwright install --with-deps chromium`.

After a merge to main, GitHub Pages publishes the static shell at https://ronald101.github.io/graphview/; there the viewer keeps its settings in the browser. Add `#bench` to measure speed on your machine, or `#embed` to see `GraphView` alone on a page.

## Use the shell

- **Top bar.** Host opens and closes the host tools; the headline names the graph and counts its units, relations and issues.
- **Host tools.** Data: Browse opens a JSON file, Save writes the graph with its view settings and asks before it overwrites the open file, Fetch loads an address, Share link makes a link to the graph and its view. Generate: choose an example or a family, change its settings, then press Generate. "Relations through interfaces (share)" puts that share of the relations through an interface; "Add types, weights and times" adds unit types, relation types in complementary pairs, weights and dates. The Explanation describes the choice and each setting.
- **The viewer's bar.** 2D and 3D; Hulls; Fit; the drawing, Keypairs or Perspectives; the search field; Box selection; Panels opens and closes the side bar; Settings opens the dialog with every setting, where any setting can be pinned to the side bar.
- **The side bar.** Search lists the results by rank, each with Show (its neighbourhood), Root, Paths to, Highlight and Inspect. Scope shows all units or a neighbourhood, grown and shrunk with Expand selected and Hide selected, and laid out alone. Root and depth, Paths, and the Inspector follow clicks. Highlights turns groups on: the selection, highlighted search results, neighbours, units with issues, and saved groups. Filters holds the time window, the weight threshold and the rules for kinds, superseded parts and relations per unit; Types shows, fades or hides each type and renames and recolours it. Display holds the sizes and Save picture. Data issues lists every breach.
- **Pointer and keys.** A click on a unit makes it the root, Shift and a click the path's end, Ctrl (Cmd) and a click adds it to the selection. On the canvas: the arrows pan, + and − zoom, [ and ] turn in 3D, 0 fits, Tab steps through the inspected unit's keypairs, Enter follows a keypair or makes a unit the root, F makes it the root, Shift+Enter the path's end, S shows its neighbourhood, A shows all units, / opens the search, Escape clears the path, the root, then the selection.

The shell also reads JSON files whose rows use `id`, `source` and `target`. The example "Classes and perspectives" opens as a host with interface graphs would show it: with a profile as JSON, by perspectives.

## Embed the viewer in a SvelteKit host

**Get the package.** `npm run package` writes the viewer as Svelte sources to dist/package; package.json points `exports` there. A host depends on a checkout by path, such as `"graphview": "file:../graphview"`, and installs svelte, three, graphology and graphology-layout-forceatlas2 itself.

**Show a graph.** The host hands the viewer a graph, or a source to read one from, and the base values of the settings it wants. Everything else is the viewer's.

```svelte
<script lang="ts">
  import { GraphView, HttpSettingsStore, JsonFileSource } from 'graphview';

  let { id } = $props();
  // The host's own data route answers the graph as JSON.
  const source = $derived(new JsonFileSource(`/graphs/${id}.json`));
  const store = new HttpSettingsStore('/api/viewer-settings');
</script>

<div style="height: 80vh">
  <GraphView
    {source}
    settingsStore={store}
    settings={{ 'drawing.relations': 'perspectives', 'extensions.profile': { directRelations: 'issue' } }}
    onroot={(e) => console.log('root', e.root)}
    oninspect={(e) => console.log('inspected', e)}
  />
</div>
```

- `graph` takes a document instead of a source; a new graph or source loads, and `onready` follows the newest. `view` applies saved view settings, the camera included.
- `settings` holds base values: the person's own values in the stored file lie over them. `theme` and `motion` are base values too.
- `bind:this` gives the component's `model` (the state and every command), `getScene()` and `getCanvas()`.
- Without `settingsStore`, the settings live in browser storage.

**Keep the settings on the server.** One file per person, through the viewer's own handler, which checks the format and the revisions:

```ts
// src/routes/api/viewer-settings/+server.ts
import type { RequestEvent } from '@sveltejs/kit';
import { createSettingsHandler } from 'graphview';

export const { GET, PUT } = createSettingsHandler<RequestEvent>({
  read: (event) => db.readSettings(event.locals.user),
  write: (text, event) => db.writeSettings(event.locals.user, text),
});
```

The file holds only the values that differ from their defaults, and the pins: `{ "format": "graphview-settings/1", "revision": 3, "values": { "labels.size": 14 }, "pinned": ["display.size"] }`.

**The data.** A graph is `graphview-graph/1`: vertices with a `key`, an optional `label` and `attrs`, and edges `from` and `to`. A vertex with `"interface": true` is an interface: it joins two units, its ends, through four keypairs. A host may describe classes and perspectives in `attrs` (specification 3.9):

```json
{
  "format": "graphview-graph/1",
  "vertices": [
    { "key": "course", "label": "Course", "attrs": { "class": "Class", "classUnit": true } },
    { "key": "ada", "label": "Ada", "attrs": { "class": "Person" } },
    { "key": "algebra", "label": "Algebra", "attrs": { "class": "Course" } },
    {
      "key": "t1",
      "interface": true,
      "attrs": {
        "class": "Teaching",
        "pair": {
          "type": "teaching",
          "perspectives": [
            { "type": "teaches", "from": "ada", "to": "algebra" },
            { "type": "taughtBy", "from": "algebra", "to": "ada" }
          ]
        }
      }
    }
  ],
  "edges": [
    { "from": "ada", "to": "t1", "attrs": { "pairType": "teaches" } },
    { "from": "t1", "to": "algebra", "attrs": { "pairType": "teaches" } },
    { "from": "algebra", "to": "t1", "attrs": { "pairType": "taughtBy" } },
    { "from": "t1", "to": "ada", "attrs": { "pairType": "taughtBy" } }
  ]
}
```

A **profile as JSON**, in the setting `extensions.profile`, tells the viewer how to read it: kinds by a field, the field names, declared pairs, the pair types that supersede a unit, and whether self-relations and direct relations are issues. Its defaults read the fields above:

```json
{ "supersededBy": ["replacedBy"], "selfRelations": "allowed", "directRelations": "issue" }
```

By perspectives, class units draw as boxes and interfaces as ovals named by their class; each relation through an interface has two chevrons, each pointing at the unit whose perspective it carries and named by its pair type. shell/examples/classes-and-perspectives.json is a complete example, and shell/lib/twin.ts its profile.

**A host with its own layout** makes a `GraphModel`, hands it to `GraphCanvas` and to the panels it wants (`SearchPanel`, `ScopePanel`, `RootPanel`, `PathsPanel`, `InspectorPanel`, `HighlightsPanel`, `FiltersPanel`, `TypesPanel`, `DisplayPanel`, `IssuesPanel`, `PinnedPanel`, `SettingsDialog`), and calls the model's methods. Every change goes to the model first; the model tells its listeners which aspects changed, and the canvas and the panels redraw from it. module/model/contracts.ts holds the contracts. The core works without a browser: `loadGraph`, `fingerprint`, `components`, `rings` and `pathSet` come from the same entry point.

## Extending graphview

A host fits graphview to its own family of graphs without editing the module (specification 5.7). A **profile** tells the model the kinds of unit, their classes, declared pairs of keypair types, checks of its own, what supersedes a unit, the pair type of each perspective of an interface, and an optional projection of the graph it shows. **Looks** tell the canvas how each kind draws, with GLSL for new shapes. **Sections** give the inspector a component per kind. The defaults are the public ones: plain units and interfaces.

An invented example: towns, hubs drawn as squares, and a check that a hub has at least three relations.

```ts
import { GraphModel, INTERFACE, PUBLIC_LOOKS, UNIT_SHAPES, type Check, type Profile, type Looks } from 'graphview';

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

`GraphView` takes the same as props: `profile`, `looks` and `sections`. A profile as JSON (above) covers the declarative part of a profile without code. tests/unit/profile.test.ts holds this example with a superseded rule, perspective types and a projection that folds interfaces into lines.

## Layout of the repository

- module/: core (format, issues, fingerprint, aids, tokens), settings (the setting classes, the registry, the settings file, its stores and handler), model (the state, its sources, contracts and rules), render (the WebGL scene), view (the viewer, canvas, panels and Settings dialog), workers. module/index.ts is its only entry point.
- shell/: the SvelteKit app that plays the host: routes/ for the page, the settings route and the example graphs; lib/ for the host's own parts; sections/ for its Data and Generate sections; examples/ for its own example graphs.
- fixtures/: test graphs, their expected answers, and the Python reference. Read-only.
- tests/: gates (fixed before the build), unit tests, browser tests.
- docs/: the specification, the requests, the report, decisions, screenshots.
- scripts/: type declarations, the package's last step, screenshots, the specification page.
