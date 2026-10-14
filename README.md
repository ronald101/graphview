# graphview

**graphview draws Rosetta graphs and lets a person explore them.** It has two parts: a reusable Svelte 5 module, and a static run shell around it. Rosetta is the data of Heart of Gold (HoG): units joined by keypairs in both directions. Each relation appears as one line in two halves, one per direction, and each half can be clicked.

The module repairs nothing. It shows every breach of Rosetta's five rules as a data issue.

## The specification

docs/graphview-specs.md is the contract for release 1. docs/report.md says what was built, which gates pass, and what is open. docs/decisions.md records the choices the specification left open. docs/engine-trial.md explains why the engine is sigma.js.

## Run the shell

You need Node.js 22.

```sh
npm ci
npm run dev        # the shell at http://localhost:5173/graphview/
npm run build      # the module into dist/module, the shell into dist/shell
npm test           # types, format, unit and gate tests, then the browser tests
```

The browser tests need Playwright's Chromium: `npx playwright install --with-deps chromium`.

After a merge to main, GitHub Pages publishes the shell at https://ronald101.github.io/graphview/. Add `#bench` to that address to measure speed on your machine.

## Embed the module in a Svelte 5 host

Import the component from module/index.ts, the module's only entry point. Only `graph` is required: a document in the format graphview-graph/1.

```svelte
<script lang="ts">
  import { GraphView, type ViewState } from 'graphview/module/index.ts';

  let { doc } = $props();
  let view: ReturnType<typeof GraphView>;
</script>

<div style="height: 600px">
  <GraphView
    bind:this={view}
    graph={doc}
    look={{ theme: 'system', font: 'inherit' }}
    onselect={(e) => console.log('selected', e.units, e.keypairs)}
    onviewstate={(v: ViewState) => localStorage.setItem('view', JSON.stringify(v))}
  />
</div>

<button onclick={() => view.fit('all')}>Fit</button>
```

The component fills its container. It takes four groups of inputs (`graph`, `view`, `overlays`, `look`), sends ten events as callback props, and has ten commands, such as `fit`, `flyTo`, `showPaths` and `exportPicture`. Specification Part D lists them all.

A host without Svelte uses `createGraphView(element, props)`. It returns the same commands, `update(props)` and `destroy()`.

The core works without a browser. `loadGraph`, `fingerprint`, `components`, `rings` and `pathSet` come from the same entry point. Graphmath checks its own results against the same fixtures.

## Layout of the repository

- module/: core (format, issues, fingerprint, aids, tokens), engine (the sigma.js adapter), ui (the component), workers.
- shell/: the run shell.
- fixtures/: 27 test graphs, their expected answers, and the Python reference. Read-only.
- tests/: gates (fixed before the build), unit tests, browser tests.
- docs/: the specification, the run prompt, the report, decisions, the engine trial, screenshots.
