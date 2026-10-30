# graphview: report

**graphview 4.0 is one viewer component for a host that supplies only graphs, and every gate passes.** Version 4.0 followed the plan of 28 October 2026 in seven milestones, each committed after its checks passed:

1. **N0 Contract.** The specification 4.0, and decisions from D79.
2. **N1 SvelteKit shell.** The shell moved to SvelteKit 3 without a change in what it shows, with a static and a server build.
3. **N2 Settings.** Every value that changes the viewer is a setting: a class per kind of control, an instance per setting, each with its default, its control, and the places that read it. The Settings dialog shows them by group, any setting can be pinned to the side bar, and a store keeps the person's file, in the browser or behind a host's route.
4. **N3 Viewer and sources.** `GraphView` became the whole viewer, with its own bar, side bar, banner and dialog; it reads a graph or a source. The shell plays the host: it serves its examples as JSON and hands them over as sources.
5. **N4 Profile and drawing.** A profile can come from JSON. Relations draw by keypairs or by perspectives: class units as boxes, interfaces as ovals named by their class, and two chevrons per relation, each pointing at the unit whose perspective it carries.
6. **N5 Data manipulation.** Search, filter rules, the selection with highlight groups, and the scope of chosen units with its +n counts, with their sections and keys.
7. **N6 Package and report.** `npm run package` makes the viewer's sources for a SvelteKit host; the README explains how a host embeds it; twenty-one views were judged.

`npm run check` passes with 353 unit and gate tests; the 109 browser tests pass against the server build. Run of 30 October 2026; `npm test` passed the same way in a fresh clone of the branch after `npm ci`.

**Not verified here: 60 frames per second on graphics hardware.** This machine draws with SwiftShader, in software. The bench page (#bench) measures it on a real machine.

## 1. Status

| Milestone              | Status | Note                                                                                  |
| ---------------------- | ------ | ------------------------------------------------------------------------------------- |
| M0 Start               | done   | Node.js v22.22.0; Chromium 141 with WebGL 2 on SwiftShader; tools as §10.2 pins them  |
| M1 Core                | done   | G0 to G8, G15 and G16 pass                                                            |
| M2 Model               | done   | G9 and G13 pass                                                                       |
| M3 Render and view     | done   | G11 passes; GraphView tested on the embed page                                        |
| M4 Shell               | done   | G10 passes; every example loads with its headline or refusal                          |
| M5 Look                | done   | G14 and G19 pass; eighteen screenshots, views 17 and 18 new                           |
| M6 Speed and builds    | done   | G17 and G18 pass; `npm run check` and every browser test pass                         |
| M7 Finish              | done   | this report; the public repository's first commit                                     |
| N0 Contract            | done   | specification 4.0; decisions D79 to D88                                               |
| N1 SvelteKit shell     | done   | the same page on SvelteKit 3; dist/shell and dist/server build; every test passes     |
| N2 Settings            | done   | 273 settings in 26 groups, every value wired; dialog, pins, stores, route; 11.3, 11.4 |
| N3 Viewer and sources  | done   | sources; examples as JSON; the shell as host; the profile from JSON came with it      |
| N4 Profile and drawing | done   | the perspective drawing: chevrons, boxes, ovals, picking, inspector; Drawing settings |
| N5 Data manipulation   | done   | search, filter rules, selection and highlight groups, scope; their sections and keys  |
| N6 Package and report  | done   | `npm run package`; the README for hosts; twenty-one views; this report                |

## 2. Gates

| Gate | Status | Evidence                                                                                                                                                                             |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G0   | pass   | tests/gates/core.gate.test.ts: 27 fixtures                                                                                                                                           |
| G1   | pass   | tests/gates/manifest.gate.test.ts: every file matches fixtures/MANIFEST.sha256                                                                                                       |
| G2   | pass   | tests/gates/core.gate.test.ts: loading, issues in order, refusal codes                                                                                                               |
| G3   | pass   | tests/gates/core.gate.test.ts: stored and current fingerprints                                                                                                                       |
| G4   | pass   | tests/gates/core.gate.test.ts: counts and components of both graphs                                                                                                                  |
| G5   | pass   | tests/gates/core.gate.test.ts: degrees                                                                                                                                               |
| G6   | pass   | tests/gates/core.gate.test.ts: rings as sets                                                                                                                                         |
| G7   | pass   | tests/gates/core.gate.test.ts: path sets and the default limits                                                                                                                      |
| G8   | pass   | tests/gates/core.gate.test.ts: 2,628 of 3,240 pairs have exactly one path within two extra steps                                                                                     |
| G9   | pass   | tests/unit/layout.test.ts and tests/unit/generate.test.ts: the same seed gives the same layout and graph; three fixed fingerprints                                                   |
| G10  | pass   | tests/unit/generate.test.ts: every family over 200 seeds, without issues and with the characteristics asked                                                                          |
| G11  | pass   | tests/e2e/view.spec.ts: "§6.11 and §7.4 Picking and the inspector (G11)" and "§6.11 Picking (G11): the hit zones reach past the drawing"                                             |
| G12  | pass   | every subsection of sections 6 to 8 has a passing test named after it (section 3)                                                                                                    |
| G13  | pass   | tests/unit/model.test.ts: changes reach listeners through the model by aspect, saved settings bring a graph back; tests/e2e/data.spec.ts: a file reopened from 2D or 3D              |
| G14  | pass   | tests/e2e/a11y.spec.ts: axe in both themes on the sample and broken-mixed, with every section open; the keyboard and live-region tests in tests/e2e/view.spec.ts                     |
| G15  | pass   | tests/gates/tokens.gate.test.ts                                                                                                                                                      |
| G16  | pass   | tests/gates/boundaries.gate.test.ts                                                                                                                                                  |
| G17  | pass   | section 4: the sample's first picture in 284 ms, the random graph's in 827 ms, the complete graph of nine's path set in 6.7 ms, the sample's median zoom frame 33.3 ms               |
| G18  | pass   | `npm run build` builds the module, both shells and the package; every browser test runs against the shell's server build under /graphview/; a scratch host built and ran the package |
| G19  | pass   | section 5: twenty-one views taken, looked at and judged                                                                                                                              |

The gate tests in tests/gates/ did not change, and neither did fixtures/ in this round. The fixtures changed once before, with the owner's approval (section 7).

## 3. Requirements and their tests

**Every subsection of sections 6 to 8 has at least one test whose name starts with it.** Unit tests are in tests/unit, browser tests in tests/e2e.

| Section                           | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6.1 Layout                        | unit/layout.test.ts (§6.1 Layout (G9): layouts are deterministic)                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6.2 Drawing                       | e2e/view.spec.ts (each relation is one line; each keypair is one chevron, a third of the…)                                                                                                                                                                                                                                                                                                                                                                         |
| 6.3 2D and 3D                     | e2e/view.spec.ts (in 2D a root keeps every unit on one plane, with the sizes, opacities …); e2e/view.spec.ts (clicks never switch between 2D and 3D); e2e/view.spec.ts (Fit on a canvas narrower than tall shows the whole graph)                                                                                                                                                                                                                                  |
| 6.4 Root and depth                | unit/model.test.ts (§6.4 Depth rules)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6.5 Paths                         | e2e/view.spec.ts (Shift-click finds the shortest path and those one and two steps longer…)                                                                                                                                                                                                                                                                                                                                                                         |
| 6.6 Types and palette             | e2e/view.spec.ts (a new colour reaches the picture through the palette, in 2D and 3D, wi…); unit/model.test.ts (§6.6 Schema reflection); unit/model.test.ts (§6.6 Type registry)                                                                                                                                                                                                                                                                                   |
| 6.7 Filters                       | e2e/view.spec.ts (lines below the weight threshold stay thin and grey without chevrons; …); e2e/view.spec.ts (the time window and the weight threshold compound; rows that enter the…); unit/model.test.ts (§6.7 Filters)                                                                                                                                                                                                                                          |
| 6.8 Display overrides             | e2e/view.spec.ts (unit size and opacity change in the shaders); e2e/view.spec.ts (the line-width factor widens the lines in pixels)                                                                                                                                                                                                                                                                                                                                |
| 6.9 Hulls                         | e2e/large.spec.ts (with types on 10,000 units, hulls start off; the switch in the viewer…); e2e/view.spec.ts (they wrap close units of one type; the switch in the top bar turns the…); unit/model.test.ts (§6.9 and §6.11 Picking geometry and hull groups)                                                                                                                                                                                                       |
| 6.10 Transitions                  | e2e/view.spec.ts (with Motion "As the system", reduced motion makes changes instant; Mot…)                                                                                                                                                                                                                                                                                                                                                                         |
| 6.11 Picking                      | e2e/view.spec.ts (a unit on a far plane answers a click; deeper units reach further); e2e/view.spec.ts (three click targets on one line: the forward chevron, the backward che…); e2e/view.spec.ts (the hit zones reach past the drawing: a click beside a chevron or a li…); e2e/view.spec.ts (a unit drawn fainter than 0.1, the display opacity included, answers n…); unit/model.test.ts (§6.9 and §6.11 Picking geometry and hull groups)                     |
| 6.12 Labels                       | e2e/view.spec.ts (the inspected unit keeps its label on a far plane, where faint units h…); unit/model.test.ts (§6.12 Labels)                                                                                                                                                                                                                                                                                                                                      |
| 6.13 Issues in the picture        | e2e/view.spec.ts (a broken graph lists its issues; a keypair without its reverse keeps o…); e2e/view.spec.ts (a superseded keypair fades its own chevron; the line fades when both k…)                                                                                                                                                                                                                                                                             |
| 6.14 Keyboard and live region     | e2e/a11y.spec.ts (Tab reaches the canvas, which has the role application and a name with…); e2e/view.spec.ts (arrows pan, + and − zoom, [ and ] turn in 3D, 0 fits; Tab steps throug…); e2e/view.spec.ts (it says what changed, in words); e2e/view.spec.ts (a click on a unit says "Root …" once, not the inspection that comes wi…)                                                                                                                              |
| 6.15 Picture                      | e2e/data.spec.ts (Save picture writes the picture as on screen, with its background or w…)                                                                                                                                                                                                                                                                                                                                                                         |
| 6.16 Speed                        | e2e/large.spec.ts (the random graph of 10,000 units loads at its given positions, and a r…); e2e/speed.spec.ts (the path set of the complete graph of nine is answered within 2 second…); e2e/speed.spec.ts (first pictures and zoom frames, measured by the bench page)                                                                                                                                                                                           |
| 6.17 Interfaces in the picture    | e2e/interfaces.spec.ts (in 2D each half shows the colour of the end on its side); e2e/interfaces.spec.ts (in 3D, with a root and a turned camera, the halves still face their en…); e2e/interfaces.spec.ts (one end shows on both halves; a broken interface, and an end that is o…); unit/interfaces.test.ts (§6.17 Interfaces in the picture)                                                                                                                    |
| 6.18 Relation drawings            | e2e/drawing.spec.ts (the invented family opens by perspectives; each relation through an interf…); e2e/drawing.spec.ts (the bar switches to keypairs and back; the units stay where they are, …); e2e/drawing.spec.ts (a chevron of the perspective drawing picks its perspective; the inspector…); unit/drawing.test.ts (§6.18 Relation drawings)                                                                                                                 |
| 6.19 Search                       | e2e/find.spec.ts (the bar searches as a person types; the Search section lists the results by…); unit/narrowing.test.ts (§6.19 Search)                                                                                                                                                                                                                                                                                                                             |
| 6.20 Selection and highlights     | e2e/find.spec.ts (Ctrl and a click toggle a unit; one selected unit colours its chevrons by d…); e2e/find.spec.ts (with Box selection on, a drag selects the units drawn inside the box;…); unit/narrowing.test.ts (§6.20 Selection and highlights)                                                                                                                                                                                                                |
| 6.21 Scope                        | e2e/find.spec.ts (S shows the inspected unit's neighbourhood; outside units go; labels count …); unit/narrowing.test.ts (§6.21 Scope)                                                                                                                                                                                                                                                                                                                              |
| 7.1 Shared components             | e2e/shell.spec.ts (they open and close, starting as drawn; the canvas takes the room)                                                                                                                                                                                                                                                                                                                                                                              |
| 7.2 Root and depth                | e2e/view.spec.ts (the field sets the root by label or key; Reset clears the field and th…)                                                                                                                                                                                                                                                                                                                                                                         |
| 7.3 Paths                         | e2e/view.spec.ts (Shift-click finds the shortest path and those one and two steps longer…); e2e/view.spec.ts (the field finds the target by label or by key; Escape clears the path,…)                                                                                                                                                                                                                                                                             |
| 7.4 Inspector                     | e2e/interfaces.spec.ts (an interface shows the units it joins, then its keypairs each way thro…); e2e/view.spec.ts (three click targets on one line: the forward chevron, the backward che…)                                                                                                                                                                                                                                                                       |
| 7.5 Filters                       | e2e/view.spec.ts (lines below the weight threshold stay thin and grey without chevrons; …)                                                                                                                                                                                                                                                                                                                                                                         |
| 7.6 Display                       | e2e/view.spec.ts (unit size and opacity change in the shaders)                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7.7 Types                         | e2e/view.spec.ts (a renamed type shows in the inspector and the path table)                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.8 Data issues                   | e2e/interfaces.spec.ts (the broken interfaces example lists each interface issue in words); e2e/view.spec.ts (a broken graph lists its issues; a keypair without its reverse keeps o…)                                                                                                                                                                                                                                                                             |
| 7.9 GraphView                     | e2e/embed.spec.ts (one component shows the bar, the canvas and the panels, and tells its …); unit/view.test.ts (§7.9 GraphView on a server)                                                                                                                                                                                                                                                                                                                        |
| 7.10 The Settings dialog and pins | e2e/settings.spec.ts (every group, a filter, a slider that changes the picture, Reset and Reset all; a pin; a refused value; Export and Import); unit/settings.test.ts (§5.9 and §5.10: every class's check, the defaults, the layers, the file, the stores, the saver, the handler)                                                                                                                                                                               |
| 7.11 Search, Scope and Highlights | e2e/find.spec.ts (the Search section, the Scope section's words and actions, the Highlights section's count)                                                                                                                                                                                                                                                                                                                                                       |
| 8.1 Page layout                   | e2e/shell.spec.ts (they open and close, starting as drawn; the canvas takes the room); e2e/shell.spec.ts (at 900 pixels or less the sidebars start closed and open over the canv…)                                                                                                                                                                                                                                                                                 |
| 8.2 Top bar                       | e2e/shell.spec.ts (Host, graphview and the headline; the view's controls are in the viewer's bar)                                                                                                                                                                                                                                                                                                                                                                  |
| 8.3 Data                          | e2e/data.spec.ts (Fetch loads an address that answers; a refused address is named)                                                                                                                                                                                                                                                                                                                                                                                 |
| 8.4 Generate                      | e2e/generate.spec.ts ("Add types, weights and times" turns on the numbers of types and the s…); e2e/shell.spec.ts (the menu groups examples, examples with issues, refused files and fami…); e2e/shell.spec.ts (choosing an example or a family changes nothing until Generate)                                                                                                                                                                                    |
| 8.5 Families                      | e2e/shell.spec.ts (random by degrees shows the degrees reached next to the ones asked); unit/generate.test.ts (§8.5 Families (G10): every family gives graphs without issues and with…); unit/generate.test.ts (§8.5 Families (G9): generators are deterministic)                                                                                                                                                                                                  |
| 8.6 Breaking the rules            | e2e/shell.spec.ts (breaking them on purpose shows the banner and the issues); unit/generate.test.ts (§8.6 Breaking the rules)                                                                                                                                                                                                                                                                                                                                      |
| 8.7 Types, weights and times      | e2e/generate.spec.ts (a family gets unit types, complementary relation types, and weights an…); e2e/generate.spec.ts (an example with types keeps what it brings and gains what it lacks); unit/shell.test.ts (§8.7 Types, weights and times)                                                                                                                                                                                                                      |
| 8.8 Explanation                   | e2e/generate.spec.ts (it names the family or example, explains each setting with its value, …); unit/shell.test.ts (§8.8 Explanation)                                                                                                                                                                                                                                                                                                                              |
| 8.9 Types and look                | e2e/shell.spec.ts (the viewer's theme takes effect at once, in the page and in the pictur…)                                                                                                                                                                                                                                                                                                                                                                        |
| 8.10 Examples                     | e2e/interfaces.spec.ts (the interface examples load, with the kind of every unit); e2e/shell.spec.ts (the example ${f.fixture} loads); unit/shell.test.ts (§8.10 Examples); unit/data.test.ts (§5.8 Sources; §5.7 A profile from JSON; §3.8 The rules a profile may change)                                                                                                                                                                                        |
| 8.11 Opening files                | e2e/data.spec.ts (Browse opens the picked file; its name shows, and the headline and pan…); e2e/data.spec.ts (a file that is not JSON says so, and the graph stays); e2e/data.spec.ts (a file saved in 3D opens in 3D from a 2D canvas; a drag turns the view…)                                                                                                                                                                                                    |
| 8.12 Saving files                 | e2e/data.spec.ts (Save writes the graph with its view; Save again asks before it overwri…); e2e/data.spec.ts (where the browser cannot pick files, Save downloads the graph with its…)                                                                                                                                                                                                                                                                             |
| 8.13 Share links                  | e2e/data.spec.ts (a link restores the example, the mode, the root and the path); e2e/data.spec.ts (a link that cannot be read says so, and the sample graph shows without…); e2e/data.spec.ts (Share link on a graph from a file says it cannot travel in a link); e2e/data.spec.ts (a link of a generated graph carries its family, parameters, seed and t…); unit/interfaces.test.ts (§8.13 Share links with interfaces); unit/shell.test.ts (§8.13 Share links) |
| 8.14 The bench page               | e2e/shell.spec.ts (it shows the browser and the graphics information)                                                                                                                                                                                                                                                                                                                                                                                              |
| 8.15 The test hook                | e2e/shell.spec.ts (window.graphview holds the model, the canvas and the commands)                                                                                                                                                                                                                                                                                                                                                                                  |
| 8.16 Relations through interfaces | e2e/interfaces.spec.ts (the Generate setting puts the share through interfaces, and the link k…); unit/interfaces.test.ts (§8.16 Relations through interfaces)                                                                                                                                                                                                                                                                                                     |

## 4. Speed

**Measured in the test browser on this machine: Chromium 141 on SwiftShader, 4 processors of an Intel Xeon at 2.10 GHz, 15 GB of memory, Linux 6.18.** The numbers come from tests/e2e/speed.spec.ts, which runs alone after the other tests.

| Measure                                     | Sample graph  | Random graph of 10,000 units | Limit (G17)  |
| ------------------------------------------- | ------------- | ---------------------------- | ------------ |
| First picture                               | 284 ms        | 827 ms                       | 1 s; 5 s     |
| Zoom frames over 2 s in 2D, median and 95th | 33.3, 50 ms   | 4,349.9 ms, 1 frame          | median 50 ms |
| Turn frames over 2 s in 3D, median and 95th | 33.3, 83.3 ms | 16.7, 8,483 ms, 5 frames     | none         |

The path set of the complete graph of nine, from unit 1 to unit 2 with 2 extra steps, took 6.7 ms for 50 paths, the worker's round trip included; the limit is 2 seconds. These are the numbers of the run of 30 October 2026, from test-results/speed.json. The random graph's frames show what software drawing costs: one full frame of 10,000 units took 4.3 seconds to zoom and up to 8.5 seconds to turn, where version 3.0 took about 3 seconds. Version 4.0 gives each line and chevron one more attribute, for highlights; this run does not tell that cost apart from the machine's load. The sample's median frame times did not change. Graphics hardware is needed for the random graph's frame times; the bench page measures them.

## 5. Visual review

**Twenty-one views, taken with scripts/screenshots.mjs at 1440 by 900 from the static build, and looked at one by one.** Version 4.0 retook views 1 to 18 in the new layout (the host tools on the left, the viewer with its bar and side bar on the right) and added 19 to 21. The first pass found four faults, fixed before the final pictures. The host tools lacked the viewer's text and panel properties, so their two-knob sliders drew as a dark bar without knobs; the shell now wears them too. The Data issues and Types sections sat below the fold in views 6 and 15; the script scrolls them into view. The bar's labels wrapped at 800 pixels; the bar now wraps whole controls. View 19 was too close to show both ends of the teaching.

| View                                                    | Verdict | Note                                                                                                                                      |
| ------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Sample graph, 2D, light                              | pass    | Types in colour, chevrons in their keypair types' colours, hulls behind, labels clear of each other; the new layout.                      |
| 02 The same, dark                                       | pass    | The same picture on the dark surface; the host tools and the side bar follow the viewer's theme.                                          |
| 03 Root unit 1 in 2D, light                             | pass    | The view centres on unit_1; far units fade; the planes count 5, 48, 13 and 14; deepest degree 4.                                          |
| 04 Keypair 76 to 80 in the inspector, light             | pass    | "Keypair from unit_76 to unit_80", type rel_cd, weight 1, and the note on its reverse.                                                    |
| 05 Paths 79 to 77, one step longer, dark                | pass    | The path in green with its glow; everything else dims; the table lists types and weights.                                                 |
| 06 broken-mixed with its issues, light                  | pass    | The rule banner above the canvas, the dashed half of the missing reverse, the lone unit 5, seven issues with icons.                       |
| 07 superseded, light                                    | pass    | Units 3 and 6 and the relation 1 to 4 at 35 percent, with faded labels.                                                                   |
| 08 The random graph of 10,000 units, dark               | pass    | Given positions, hulls off above 3,000 units, labels capped; dense at Fit, as expected.                                                   |
| 09 Generate, small world, explanation open, light       | pass    | Fields n, k and β; "Family: Small world" with n × k/2 relations; the sliders with their knobs, off until types.                           |
| 10 text-keys with labels, light                         | pass    | Look-alike keys stay distinct in Atkinson Hyperlegible Next.                                                                              |
| 11 The shell at 800 pixels, Host drawer open, light     | pass    | The drawer lies over the canvas; the viewer's side bar starts closed; the bar wraps whole controls.                                       |
| 12 3D first picture of the sample with hulls, light     | pass    | The same as 2D until a root or a turn.                                                                                                    |
| 13 3D, root unit 1, turned, light                       | pass    | The planes show: deeper units smaller and fainter; hulls follow their units.                                                              |
| 14 3D, path 79 to 77, turned, dark                      | pass    | The path at the front with its glow; the rest and the hulls dim.                                                                          |
| 15 Generate, communities with types, Types open, light  | pass    | The numbers of types in Generate; the viewer's Types section with swatches, names, counts and Shown switches.                             |
| 16 3D, communities, threshold 0.6 and a time window     | pass    | "At least 0.6"; lines below the threshold thin, in the ring colour, without chevrons.                                                     |
| 17 Fully interfaced graph, close to i, 2D, light        | pass    | Blue half toward A, orange toward B, a surface-coloured line across the relation; the label clear.                                        |
| 18 3D grid, half through interfaces, root 6, dark       | pass    | i2 cut across the bend between 6 and 11: green toward the root, blue toward 11; deeper units fade.                                        |
| 19 Classes and perspectives, by perspectives, light     | pass    | The teaching as an oval named Teaching; its two chevrons point at each other; Algebra, superseded, fades.                                 |
| 20 Sample, scope around unit_7, unit_10 selected, light | pass    | Only the neighbourhood shows, with +n after labels; unit_10 grows with its outline; its chevrons in the direction colours; the rest dims. |
| 21 The Settings dialog, filtered to Drawing, dark       | pass    | The four drawing settings with their controls, Reset and Pin; the store says Saved.                                                       |

## 6. Decisions in short

Decisions D1 to D54 are folded into the specification. docs/decisions.md holds the choices of this round:

- D55. A new graph's aspect means that everything changed, so a file's settings reach the whole picture.
- D56. Above 3,000 units hulls start off, and the switch still turns them on.
- D57. Hull opacity follows the camera through the controls' change event.
- D58. The live region says one message per action; the inspector's words give way.
- D59. Types go into the field the graph already uses; partly typed relations keep what they have.
- D60. Share links are checked; missing settings take their defaults; a broken link keeps only its mode.
- D61. The sample graph is anonymous in the fixture itself.
- D62. Private terms are checked by hashes of phrases.
- D63. GraphView is tested on the shell's embed page.
- D64. The far-plane picking test zooms one step and checks the rule of 6.11.
- D65. The source splits along its seams, behind the same facades.
- D66. Registries instead of switches: issue words, inspector sections, unit shapes.
- D67. The shell's store is a class with runes; each left section takes it as a prop.
- D68. Interfaces are a kind of unit: the core reads the field, the model checks it.
- D69. An interface's ends are its neighbours; two interfaces related directly are an issue.
- D70. The divided disc's line bisects the angle toward its two ends, as seen.
- D71. Units carry their ends and pack three values into one attribute: 14 of WebGL's 16.
- D72. Interfaces come last in Generate, with text keys i1, i2 and so on.
- D73. The shell's own examples sit in shell/examples.
- D74. A link leaves out a share of interfaces of 0, so older links read as before.
- D75. Each layer takes its own extension point: profile, looks, sections.
- D76. A profile's checks bring their own words.
- D77. A projection keeps the stored graph beside the shown one.
- D78. Joining kinds share the interface checks; perspectives follow the ends.

Version 4.0 adds:

- D79. Setting classes name their control; the view maps controls to components.
- D80. The settings file holds flat keys and only the values that differ.
- D81. Display factors and hulls stay in a graph's view, as a layer over the settings.
- D82. Two shell builds: static for Pages, with a server for tests and settings.
- D83. The perspective drawing keeps the chevrons that point into the interface.
- D84. The scope hides units, and the loaded graph keeps one layout.
- D85. Settings save half a second after the last change.
- D86. Named defaults move under the settings; their old modules export them still.
- D87. The shell's links load whole pages, as before.
- D88. SvelteKit's options live in the shell's Vite configuration; the mode picks the adapter.
- D89. The settings handler lives in the settings layer.
- D90. The shell keeps one settings file per browser.
- D91. A save that meets another revision merges its own changes.
- D92. Panel texts pass through the setting "Panel texts".
- D93. Inventory items that are not settings.
- D94. The shell reads files and addresses itself; examples reach the viewer as sources.
- D95. The shell attaches to GraphView's model once it is on the page.
- D96. The hook's look is a base value.
- D97. GraphView applies the narrow-page rule to its own side bar.
- D98. Only the newest graph reports ready.
- D99. The setting "Profile" is read at each load.
- D100. The drawing chooses among the model's chevrons.
- D101. What the perspective drawing leaves to the keypairs.
- D102. A profile may name the keypairs' type field.
- D103. Every profile's perspectives fall back to the keypair's type.
- D104. The box is a rounded square and the oval half as high as a disc.
- D105. The shell opens the invented family with base values.
- D106. The drawing's settings form a group of their own.
- D107. Filter rules and the scope ride on the filter states.
- D108. Highlights live in the unit's free look slot and a new pair of attributes.
- D109. The group Search results holds what a person highlights.
- D110. Search ranks keys, classes and types with attribute values.
- D111. How the scope grows, shrinks and lays out.
- D112. Direction colours are on by default.
- D113. The live region speaks for search, selection and scope.
- D114. Enter in the search field shows the first result.
- D115. Search, highlights and scope have settings groups of their own.
- D116. The narrowing state lives beside the model.

## 7. Deviations

- **fixtures/ changed once.** CLAUDE.md keeps fixtures/ read-only. Ronald approved one change to anonymize the sample graph; the rule in .claude/settings.json was lifted for that change and restored after it. make_fixtures.py regenerated the files. Fingerprints, counts, rings, paths and the index stayed the same; only labels, attributes, meta texts and an unused field changed (D61).
- **CLAUDE.md was rewritten**, with Ronald's approval: it names docs/specifications.md as the contract, with its words and layout.
- **Tests that changed, and why.**
  - The far-plane picking test zooms one step and checks the rule of 6.11 instead of a 2-pixel distance, because Fit now spans the width (D64).
  - Two unit tests read the old fixture's attributes; they now read the neutral ones, and the case of a type field named archetype with two weight fields moved to a graph of its own.
  - The tests of the shell's sample transform went with the transform; the fixtures themselves are now scanned.
  - The test of the unused partial-positions fallback went with the fallback; a test of the rule that replaced it checks that partial positions are not used.
  - Every test title now starts with its section (G12).
  - This round, two browser tests follow version 3.0 of the specification: the explanation's exact headings gained "Relations through interfaces" (8.8, 8.16), and the menu's example count adds the shell's own examples to the fixtures (8.10). Both stay exact.
  - Version 4.0 moved the shell to SvelteKit, which starts the page after its router loads. The embed and speed tests therefore wait for the page's hook after the navigation; their checks did not change. The scan for private terms reads every text file of the server build, at any depth, where it read the top folder of dist/shell's assets (8.17).
  - The scan of every committed text file skips .svelte-kit and data as well, which git leaves out like dist: the build's output and the settings files the shell's server writes (D90).
  - Two unit tests follow renamed or extended functions: the model's `settings()` is `viewSettings()`, since `settings` is the registry (5.2), and `plane` takes the depth rules as a second argument, so a test maps degrees to planes with an arrow function.
  - With the shell as host (N3), the browser tests follow 8.1 to 8.4 and 8.9: the top bar holds Host, the name and the headline, and the view's controls are found in the viewer's bar; the sidebars are #host and the viewer's side bar; the sections are checked against how 8.1 draws them, open or closed; the numbers of types to add sit in Generate, which no longer opens Types; the theme is set in the Settings dialog; Save picture is reached by opening Display. The scan of the server build reads files only, since the examples route's build folder is named <id>.json. No check was dropped; the layout test gained the widths and heights of 8.1, and the narrow test checks that the drawers leave the canvas its size.
  - With the perspective drawing (N4), the shapes the unit shader holds gained box and oval, so the test of a host's added shape expects it after all of them (`UNIT_SHAPES.length`) where it expected the third place; and the Settings dialog has 28 groups, with Drawing.
  - With data manipulation (N5), / opens the search field, as 6.14 now says, where it opened the Root field; the layout test lists the sections Search, Scope and Highlights in their places; and the Settings dialog has 31 groups.
- **Two files are near the size target.** model.ts has 407 lines and the shell's store 372; the target was about 400.
- **The owner pushed the branch.** This session's git proxy refused the push with 403, since the repository was not attached to the session. The branch therefore went to the owner as a git bundle, and the owner pushed it. Once the repository was attached, this session opened the pull request (12.4).
- **The public repository starts over.** Its history held private names, so Ronald deleted it and created it again, empty. Its first commit holds this tree without history, pushed to main with his approval; later work goes through branches and pull requests.

## 8. Open items

- **60 frames per second on graphics hardware.** Open #bench on a machine with a graphics card and read the frame times.
- **GitHub Pages.** Publishing runs from main once the repository's Pages source is GitHub Actions.
- **The private version.** Deeper classes, typed interfaces and their pair types come later, locally, through a profile, looks and sections (5.7); nothing private is in this repository.

## 9. How to run

You need Node.js 22.17 or later.

```sh
npm ci
npm run dev        # the shell with its server at http://localhost:5173/graphview/
npm run build      # the module into dist/module, the static shell into dist/shell, the shell with its server into dist/server, the package into dist/package
npm run package    # only the package: the viewer's Svelte sources for a SvelteKit host
npm run check      # types, format, unit and gate tests
npm run e2e        # the browser tests against the server build
npm test           # both
node scripts/specifications-html.mjs   # docs/specifications.html from the Markdown
```

The browser tests need Playwright's Chromium: `npx playwright install --with-deps chromium`. In a cloud session without that download, they use the preinstalled Chromium at /opt/pw-browsers/chromium.
