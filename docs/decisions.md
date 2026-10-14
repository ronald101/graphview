# graphview: decisions

**Each entry records a choice the specification leaves open: the choice, the reason, and the alternative.** Entries follow the order in which the build met them.

## D1. A key's identity is its JSON text

- **Choice.** The core identifies a key by its JSON text, as the fingerprint writes it: `1` for the number, `"1"` for the text. A keypair's identity is the two texts joined by a tab.
- **Reason.** One function serves both identity and the fingerprint. JSON text never holds a raw tab, so the tab cannot be confused with a key.
- **Alternative.** A prefix per type, such as `n:1` and `s:1`. It needs a second function and gains nothing.

## D2. Path sets: extra steps are held between 0 and 20

- **Choice.** `pathSet` rounds the extra steps down and holds them between 0 and 20. The result reports the value it used.
- **Reason.** Specification C5 allows 0 to 20. Holding the value is simpler for hosts than an error.
- **Alternative.** Throw an error for values outside the range.

## D3. Path sets and rings with a unit that is not in the graph

- **Choice.** A path set from or to a missing unit reports the reason "unreachable". Rings around a missing focus are empty, and every unit is beyond.
- **Reason.** The specification names only "same-unit" and "unreachable". Both answers are true statements about the graph.
- **Alternative.** A third reason, such as "unknown-unit". It would extend the interface of C5.

## D4. The time limit is checked every 1,024 search steps

- **Choice.** The depth-first search reads the clock with `Date.now()` once every 1,024 steps.
- **Reason.** Reading the clock on every step slows the search. 1,024 steps take well under a millisecond.
- **Alternative.** `performance.now()`. It is a browser global in older runtimes, and the core must use none.

## D5. The random number generator is mulberry32

- **Choice.** Generators use mulberry32: a 32-bit state, seeded with the seed as an unsigned 32-bit number. A float is the output divided by 2^32; a whole number below n is the float times n, rounded down.
- **Reason.** It is short, fast, and uses only `Math.imul` and integer operations, so every browser gives the same output.
- **Alternative.** xoshiro128\*\* or sfc32. They have longer periods, which graphs of at most 20,000 units do not need.
- **Fixed.** The unit test "G9 the generator output for fixed seeds never changes" pins three fingerprints. Changing the generator means a new generator version.

## D6. Generator details

- **Limits.** Every family makes at most 20,000 units; communities at most 5,000, because they draw every pair.
- **Random by size.** Units split into contiguous key ranges, larger parts first. Each part gets a random spanning tree by random attachment. Extra relations come by drawing a part by its capacity, then a pair; above half the free capacity, the generator lists free pairs and shuffles them instead.
- **Random by degrees.** Stubs are shuffled and paired in order. Loops and repeats are dropped, and an odd last stub stays unused. A unit left alone joins a random other unit.
- **Small world.** Each unit rewires its forward relations with probability β to a random unit that is not itself or a neighbour. A rewire that would leave the old neighbour alone is undone, to keep rule 4.
- **Preferential growth.** The graph starts as a complete graph of m₀ + 1 units. Each new unit joins m₀ distinct units drawn from the list of relation ends.
- **Communities.** Groups are contiguous key ranges. A lone unit joins a random unit of its own group.
- **Alternative.** Other textbook variants exist for each family. These are the simplest that meet G3.

## D7. Breaking the rules on purpose

- **Choice.** Dropping reverses removes the second keypair of a seeded share of relations. Repeats copy valid rows only, alternating vertices and edges. Lone units and unknown keys take keys after the largest key.
- **Reason.** Each option then produces exactly its own issue, so graphmath's tests can count them.
- **Alternative.** Repeat any row, including broken ones. One option's issue would then hide another's.

## D8. The core's imports carry the .ts extension

- **Choice.** Files import each other as `./load.ts`, with `allowImportingTsExtensions` in tsconfig.json.
- **Reason.** Node 22 can then run the core directly, as the stand-in runner of D9 did. Vite and Vitest accept it too.
- **Alternative.** Extensionless imports. They need a bundler or a loader to run.

## D9. A stand-in test runner, used once and removed

- **Choice.** While the npm registry was refused, a small runner in scripts/offline/ ran the unchanged gate and unit tests with Node's own TypeScript support. It was removed as soon as Vitest installed, and Vitest gave the same result: 210 passed.
- **Reason.** It gave evidence for the core without changing any test.
- **Alternative.** Report the gates as "not testable" until packages install.

## D10. Small interface choices in the core

- **Graph.** Besides `units` and `keypairs`, a graph carries `unitInfo`, `keypairInfo` and `meta` as read-only fields, so the user interface can show labels, attributes and positions.
- **CSS variables.** `cssVariables(theme)` writes the tokens as `--gv-<token>`, for example `--gv-surface`.

## D11. Versions, pinned exactly on 14 October 2026

- **Runtime.** svelte 5.57.2; sigma 4.0.2, graphology 0.26.0 and graphology-layout-forceatlas2 0.10.1; @fontsource/atkinson-hyperlegible-next 5.3.0.
- **Tools.** vite 8.3.4, @sveltejs/vite-plugin-svelte 7.3.1, typescript 6.0.3, vitest 5.0.4, @playwright/test 1.64.1, svelte-check 4.7.6, prettier 3.9.10, prettier-plugin-svelte 4.1.1, @axe-core/playwright 4.13.0, @types/node 26.6.5, graphology-types 0.24.8.
- **TypeScript 6, not 7.** TypeScript 7.0.2 is the latest, but svelte-check 4.7.6 accepts only TypeScript 5 or 6. 6.0.3 is the latest version that works with it.
- **graphology-types.** The peer dependency of the ForceAtlas2 package, needed for its types.

## D12. The browser tests use the preinstalled Chromium in cloud sessions

- **Choice.** playwright.config.ts launches /opt/pw-browsers/chromium (Chromium 141) when it exists and the run is not on CI. On CI, Playwright's own browser is used.
- **Reason.** Playwright 1.64.1 downloads its browser from storage.googleapis.com, which the network policy refuses. The preinstalled browser needs no download, and Playwright 1.64.1 drives it.
- **Alternative.** Pin @playwright/test 1.56.1, the version the preinstalled browser belongs to. That would break the rule of the latest stable versions.

## D13. The engine is sigma.js, by step 3 of the trial's rule

- **Choice.** sigma.js 4.0.2 with graphology. @antv/g6 5.1.1 stayed on the branch engine-trial and left package.json.
- **Reason.** docs/engine-trial.md gives the numbers and the step.
- **Alternative.** None: the rule decides.

## D14. The module does its own hit-testing and draws its own marks

- **Choice.** sigma.js draws units and relation lines. The module computes every position on screen through the adapter, picks units and halves from that geometry, and draws rings, chevrons, labels, issue marks and state marks on a 2D canvas over the engine.
- **Reason.** Engine picking missed overlapping lines in the trial, and the scene must match what is drawn. One geometry serves the scene, the clicks and the tests.
- **Alternative.** sigma.js's own edge picking and labels. They cannot give the 24-pixel click width, the label boxes, or the 2-pixel label gap the specification asks for.

## D15. The force layout: when it settles, and large graphs

- **Choice.** ForceAtlas2 from graphology runs in batches of 25 iterations. It stops when the mean step per iteration falls below 0.02 percent of the layout's size, or after 1,500 iterations; above 2,000 units, after 300 iterations, with a Barnes–Hut θ of 1 instead of 0.5. Pinned units are fixed.
- **Reason.** V06 asks that 10,000 units settle within 30 seconds. With θ 0.5 one iteration took 118 ms in Node; with θ 1 it took 35 ms. The stop rule uses no clock, so the result stays deterministic.
- **Alternative.** A time limit. It would make the positions depend on the machine's speed.

## D16. What a click picks

- **Choice.** A click inside a unit's circle picks the unit. Outside it, the nearer wins: a unit's edge within 3 pixels, or a line within 12 pixels. On a line, the half is the one on the click's side of the middle. Where a half is shorter than 24 pixels, the click picks the whole relation.
- **Reason.** In dense force layouts, units sit close to other units' lines. Picking what lies under the pointer gave the right keypair in every G11 click.
- **Alternative.** Units always first, within 9 pixels. It picked a neighbouring unit instead of the line in the database graph.

## D17. The shell starts a new view for each new source

- **Choice.** Loading an example, a file, an address or a generated graph mounts a fresh component. Replacing the graph in place, as `window.graphview.replace` does, keeps the places of the units that stay (V11).
- **Reason.** Two examples share keys such as 1 to 4 without being the same units. Stable change between them would carry positions over by accident.
- **Alternative.** Stable change for every new graph. That is what D2 says for the component's `graph` input, and the component still does it.

## D18. Line widths and unit sizes are calibrated to pixels

- **Choice.** The sigma.js adapter passes each line's width times 2 as sigma's edge size, and the unit radius, 6, as sigma's node size.
- **Reason.** Measured in a screenshot, sigma draws an edge of size s about s / 2 pixels thick, and a node of size 6 with a radius of 6 pixels.
- **Alternative.** A custom edge program. It would add code for no gain.

## D19. Labels keep clear of units, ring numbers and controls

- **Choice.** Label placement treats every visible unit's circle, the ring numbers, the camera controls and the search button as obstacles, with the same 2-pixel gap as between labels.
- **Reason.** Labels drawn over other units and over the controls failed the visual review (F1: crisp type).
- **Alternative.** Labels against labels only, as V19 requires at the least.

## D20. Ring 1 starts half a step from north

- **Choice.** In the rings layout, ring 1's units start half an angle step clockwise from north. Outer rings turn to follow their parents.
- **Reason.** The ring numbers sit where each ring crosses north (F4); a unit there would hide behind its number.
- **Alternative.** Start at north and move the numbers. F4 fixes their place.

## D21. Type declarations come from svelte2tsx

- **Choice.** `npm run build:module` runs Vite in library mode, then writes declarations with svelte2tsx 0.7.61, a pinned development dependency.
- **Reason.** Vite does not write declarations for Svelte components; svelte2tsx is the tool svelte-check itself uses.
- **Alternative.** @sveltejs/package. It ships uncompiled components and rewrites imports, which the workers' `new URL(...)` references do not survive.

## D22. Browser tests that measure run alone

- **Choice.** playwright.config.ts has two projects. "chromium" runs the browser tests on 4 workers. "speed" runs G17 and the two tests on 10,000 units afterwards, on 1 worker.
- **Reason.** In software rendering, four tests at once share four processors. The 10,000-unit tests then took twice as long, and the speed numbers would not describe one viewer.
- **Alternative.** All tests on 1 worker. The run would take about four times as long.

## D23. How G11 reaches its zoom levels

- **Choice.** For the long-half clicks, each tested relation is centred and drawn 600 pixels long, so each half is 294 pixels. For the short-half clicks, it is drawn 40 pixels long in a window 280 pixels wide.
- **Reason.** J2 asks for halves of at least 40 pixels; at 200 pixels another unit of the dense database graph lay under one click point. For the pair and the triangle, no zoom within V02's limits makes a half shorter than 24 pixels in the 660-pixel canvas of a 1280-pixel window; in a 280-pixel window it does.
- **Alternative.** Leave the short-half check out for the pair and the triangle.
