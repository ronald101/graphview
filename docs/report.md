# graphview: report

**graphview draws interface graphs, its source is ready for other families of graphs, and every gate passes.** This round followed the plan of 27 October 2026 in four steps, each committed after its tests passed:

1. **Seams, no change in behaviour.** The model, the scene and the shell split along their seams; issue words, inspector sections and unit shapes moved into registries. No source file is far above 400 lines; model.ts, the largest, has 407.
2. **Interface graphs.** A vertex row with `"interface": true` is an interface, drawn as a disc divided between the colours of its two ends, in 2D and 3D. The model reports interfaces with other than two ends and interfaces related directly. The shell has a fully and a partly interfaced example, a broken one, and Generate's "Relations through interfaces (share)".
3. **Extension points.** A profile for the model, looks for the canvas and sections for the inspector let another build add kinds, classes, declared pairs, checks, a superseded rule, perspective types and a projection without editing the module. A test profile with invented names proves it.
4. **Guard and document.** The private class, pair-type and space names joined the hashed term list; the specification is version 3.0.

`npm run check` passes with 282 unit and gate tests; the 96 browser tests pass against the production build. Run of 27 October 2026. The public repository starts from this tree, as one commit without history (section 7).

**Not verified here: 60 frames per second on graphics hardware.** This machine draws with SwiftShader, in software. The bench page (#bench) measures it on a real machine.

## 1. Status

| Milestone           | Status | Note                                                                                 |
| ------------------- | ------ | ------------------------------------------------------------------------------------ |
| M0 Start            | done   | Node.js v22.22.0; Chromium 141 with WebGL 2 on SwiftShader; tools as §10.2 pins them |
| M1 Core             | done   | G0 to G8, G15 and G16 pass                                                           |
| M2 Model            | done   | G9 and G13 pass                                                                      |
| M3 Render and view  | done   | G11 passes; GraphView tested on the embed page                                       |
| M4 Shell            | done   | G10 passes; every example loads with its headline or refusal                         |
| M5 Look             | done   | G14 and G19 pass; eighteen screenshots, views 17 and 18 new                          |
| M6 Speed and builds | done   | G17 and G18 pass; `npm run check` and every browser test pass                        |
| M7 Finish           | done   | this report; the public repository's first commit                                    |
| N0 Contract         | done   | specification 4.0; decisions D79 to D88                                              |
| N1 SvelteKit shell  | done   | the same page on SvelteKit 3; dist/shell and dist/server build; every test passes    |

## 2. Gates

| Gate | Status | Evidence                                                                                                                                                                |
| ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | pass   | tests/gates/core.gate.test.ts: 27 fixtures                                                                                                                              |
| G1   | pass   | tests/gates/manifest.gate.test.ts: every file matches fixtures/MANIFEST.sha256                                                                                          |
| G2   | pass   | tests/gates/core.gate.test.ts: loading, issues in order, refusal codes                                                                                                  |
| G3   | pass   | tests/gates/core.gate.test.ts: stored and current fingerprints                                                                                                          |
| G4   | pass   | tests/gates/core.gate.test.ts: counts and components of both graphs                                                                                                     |
| G5   | pass   | tests/gates/core.gate.test.ts: degrees                                                                                                                                  |
| G6   | pass   | tests/gates/core.gate.test.ts: rings as sets                                                                                                                            |
| G7   | pass   | tests/gates/core.gate.test.ts: path sets and the default limits                                                                                                         |
| G8   | pass   | tests/gates/core.gate.test.ts: 2,628 of 3,240 pairs have exactly one path within two extra steps                                                                        |
| G9   | pass   | tests/unit/layout.test.ts and tests/unit/generate.test.ts: the same seed gives the same layout and graph; three fixed fingerprints                                      |
| G10  | pass   | tests/unit/generate.test.ts: every family over 200 seeds, without issues and with the characteristics asked                                                             |
| G11  | pass   | tests/e2e/view.spec.ts: "§6.11 and §7.4 Picking and the inspector (G11)" and "§6.11 Picking (G11): the hit zones reach past the drawing"                                |
| G12  | pass   | every subsection of sections 6 to 8 has a passing test named after it (section 3)                                                                                       |
| G13  | pass   | tests/unit/model.test.ts: changes reach listeners through the model by aspect, saved settings bring a graph back; tests/e2e/data.spec.ts: a file reopened from 2D or 3D |
| G14  | pass   | tests/e2e/a11y.spec.ts: axe in both themes on the sample and broken-mixed, with every section open; the keyboard and live-region tests in tests/e2e/view.spec.ts        |
| G15  | pass   | tests/gates/tokens.gate.test.ts                                                                                                                                         |
| G16  | pass   | tests/gates/boundaries.gate.test.ts                                                                                                                                     |
| G17  | pass   | section 4: the sample's first picture in 405 ms, the random graph's in 516 ms, the complete graph of nine's path set in 7.6 ms, the sample's median zoom frame 33.4 ms  |
| G18  | pass   | `npm run build` builds the module and the shell; every browser test runs against the shell's production build under /graphview/                                         |
| G19  | pass   | section 5: eighteen views taken, looked at and judged                                                                                                                   |

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
| 6.9 Hulls                         | e2e/large.spec.ts (with types on 10,000 units, hulls start off; the switch in the top bar…); e2e/view.spec.ts (they wrap close units of one type; the switch in the top bar turns the…); unit/model.test.ts (§6.9 and §6.11 Picking geometry and hull groups)                                                                                                                                                                                                      |
| 6.10 Transitions                  | e2e/view.spec.ts (with Motion "As the system", reduced motion makes changes instant; Mot…)                                                                                                                                                                                                                                                                                                                                                                         |
| 6.11 Picking                      | e2e/view.spec.ts (a unit on a far plane answers a click; deeper units reach further); e2e/view.spec.ts (three click targets on one line: the forward chevron, the backward che…); e2e/view.spec.ts (the hit zones reach past the drawing: a click beside a chevron or a li…); e2e/view.spec.ts (a unit drawn fainter than 0.1, the display opacity included, answers n…); unit/model.test.ts (§6.9 and §6.11 Picking geometry and hull groups)                     |
| 6.12 Labels                       | e2e/view.spec.ts (the inspected unit keeps its label on a far plane, where faint units h…); unit/model.test.ts (§6.12 Labels)                                                                                                                                                                                                                                                                                                                                      |
| 6.13 Issues in the picture        | e2e/view.spec.ts (a broken graph lists its issues; a keypair without its reverse keeps o…); e2e/view.spec.ts (a superseded keypair fades its own chevron; the line fades when both k…)                                                                                                                                                                                                                                                                             |
| 6.14 Keyboard and live region     | e2e/a11y.spec.ts (Tab reaches the canvas, which has the role application and a name with…); e2e/view.spec.ts (arrows pan, + and − zoom, [ and ] turn in 3D, 0 fits; Tab steps throug…); e2e/view.spec.ts (it says what changed, in words); e2e/view.spec.ts (a click on a unit says "Root …" once, not the inspection that comes wi…)                                                                                                                              |
| 6.15 Picture                      | e2e/data.spec.ts (Save picture writes the picture as on screen, with its background or w…)                                                                                                                                                                                                                                                                                                                                                                         |
| 6.16 Speed                        | e2e/large.spec.ts (the random graph of 10,000 units loads at its given positions, and a r…); e2e/speed.spec.ts (the path set of the complete graph of nine is answered within 2 second…); e2e/speed.spec.ts (first pictures and zoom frames, measured by the bench page)                                                                                                                                                                                           |
| 6.17 Interfaces in the picture    | e2e/interfaces.spec.ts (in 2D each half shows the colour of the end on its side); e2e/interfaces.spec.ts (in 3D, with a root and a turned camera, the halves still face their en…); e2e/interfaces.spec.ts (one end shows on both halves; a broken interface, and an end that is o…); unit/interfaces.test.ts (§6.17 Interfaces in the picture)                                                                                                                    |
| 7.1 Shared components             | e2e/shell.spec.ts (they open and close; the canvas takes the room)                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7.2 Root and depth                | e2e/view.spec.ts (the field sets the root by label or key; Reset clears the field and th…)                                                                                                                                                                                                                                                                                                                                                                         |
| 7.3 Paths                         | e2e/view.spec.ts (Shift-click finds the shortest path and those one and two steps longer…); e2e/view.spec.ts (the field finds the target by label or by key; Escape clears the path,…)                                                                                                                                                                                                                                                                             |
| 7.4 Inspector                     | e2e/interfaces.spec.ts (an interface shows the units it joins, then its keypairs each way thro…); e2e/view.spec.ts (three click targets on one line: the forward chevron, the backward che…)                                                                                                                                                                                                                                                                       |
| 7.5 Filters                       | e2e/view.spec.ts (lines below the weight threshold stay thin and grey without chevrons; …)                                                                                                                                                                                                                                                                                                                                                                         |
| 7.6 Display                       | e2e/view.spec.ts (unit size and opacity change in the shaders)                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7.7 Types                         | e2e/view.spec.ts (a renamed type shows in the inspector and the path table)                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.8 Data issues                   | e2e/interfaces.spec.ts (the broken interfaces example lists each interface issue in words); e2e/view.spec.ts (a broken graph lists its issues; a keypair without its reverse keeps o…)                                                                                                                                                                                                                                                                             |
| 7.9 GraphView                     | e2e/embed.spec.ts (one component shows the bar, the canvas and the panels, and tells its …)                                                                                                                                                                                                                                                                                                                                                                        |
| 8.1 Page layout                   | e2e/shell.spec.ts (they open and close; the canvas takes the room); e2e/shell.spec.ts (at 900 pixels or less the sidebars start closed and open over the canv…)                                                                                                                                                                                                                                                                                                    |
| 8.2 Top bar                       | e2e/shell.spec.ts (the 2D and 3D buttons, Hulls and Fit; no Load or Generate button)                                                                                                                                                                                                                                                                                                                                                                               |
| 8.3 Data                          | e2e/data.spec.ts (Fetch loads an address that answers; a refused address is named)                                                                                                                                                                                                                                                                                                                                                                                 |
| 8.4 Generate                      | e2e/generate.spec.ts ("Add types, weights and times" opens Types and turns on the sliders an…); e2e/shell.spec.ts (the menu groups examples, examples with issues, refused files and fami…); e2e/shell.spec.ts (choosing an example or a family changes nothing until Generate)                                                                                                                                                                                    |
| 8.5 Families                      | e2e/shell.spec.ts (random by degrees shows the degrees reached next to the ones asked); unit/generate.test.ts (§8.5 Families (G10): every family gives graphs without issues and with…); unit/generate.test.ts (§8.5 Families (G9): generators are deterministic)                                                                                                                                                                                                  |
| 8.6 Breaking the rules            | e2e/shell.spec.ts (breaking them on purpose shows the banner and the issues); unit/generate.test.ts (§8.6 Breaking the rules)                                                                                                                                                                                                                                                                                                                                      |
| 8.7 Types, weights and times      | e2e/generate.spec.ts (a family gets unit types, complementary relation types, and weights an…); e2e/generate.spec.ts (an example with types keeps what it brings and gains what it lacks); unit/shell.test.ts (§8.7 Types, weights and times)                                                                                                                                                                                                                      |
| 8.8 Explanation                   | e2e/generate.spec.ts (it names the family or example, explains each setting with its value, …); unit/shell.test.ts (§8.8 Explanation)                                                                                                                                                                                                                                                                                                                              |
| 8.9 Types and Look sections       | e2e/shell.spec.ts (the theme takes effect at once, in the page and in the picture, with t…)                                                                                                                                                                                                                                                                                                                                                                        |
| 8.10 Examples                     | e2e/interfaces.spec.ts (the interface examples load, with the kind of every unit); e2e/shell.spec.ts (the example ${f.fixture} loads); unit/shell.test.ts (§8.10 Examples)                                                                                                                                                                                                                                                                                         |
| 8.11 Opening files                | e2e/data.spec.ts (Browse opens the picked file; its name shows, and the headline and pan…); e2e/data.spec.ts (a file that is not JSON says so, and the graph stays); e2e/data.spec.ts (a file saved in 3D opens in 3D from a 2D canvas; a drag turns the view…)                                                                                                                                                                                                    |
| 8.12 Saving files                 | e2e/data.spec.ts (Save writes the graph with its view; Save again asks before it overwri…); e2e/data.spec.ts (where the browser cannot pick files, Save downloads the graph with its…)                                                                                                                                                                                                                                                                             |
| 8.13 Share links                  | e2e/data.spec.ts (a link restores the example, the mode, the root and the path); e2e/data.spec.ts (a link that cannot be read says so, and the sample graph shows without…); e2e/data.spec.ts (Share link on a graph from a file says it cannot travel in a link); e2e/data.spec.ts (a link of a generated graph carries its family, parameters, seed and t…); unit/interfaces.test.ts (§8.13 Share links with interfaces); unit/shell.test.ts (§8.13 Share links) |
| 8.14 The bench page               | e2e/shell.spec.ts (it shows the browser and the graphics information)                                                                                                                                                                                                                                                                                                                                                                                              |
| 8.15 The test hook                | e2e/shell.spec.ts (window.graphview holds the model, the canvas and the commands)                                                                                                                                                                                                                                                                                                                                                                                  |
| 8.16 Relations through interfaces | e2e/interfaces.spec.ts (the Generate setting puts the share through interfaces, and the link k…); unit/interfaces.test.ts (§8.16 Relations through interfaces)                                                                                                                                                                                                                                                                                                     |

## 4. Speed

**Measured in the test browser on this machine: Chromium 141 on SwiftShader, 4 processors of an Intel Xeon at 2.10 GHz, 15 GB of memory, Linux 6.18.** The numbers come from tests/e2e/speed.spec.ts, which runs alone after the other tests.

| Measure                                     | Sample graph  | Random graph of 10,000 units               | Limit (G17)  |
| ------------------------------------------- | ------------- | ------------------------------------------ | ------------ |
| First picture                               | 405 ms        | 516 ms                                     | 1 s; 5 s     |
| Zoom frames over 2 s in 2D, median and 95th | 33.4, 50.1 ms | 2,983.2 ms, 1 frame                        | median 50 ms |
| Turn frames over 2 s in 3D, median and 95th | 33.4, 66.7 ms | 16.7, 2,849.8 ms, 5 frames, 1 of them full | none         |

The path set of the complete graph of nine, from unit 1 to unit 2 with 2 extra steps, took 7.6 ms for 50 paths, the worker's round trip included; the limit is 2 seconds. The random graph's frames show what software drawing costs: one full frame of 10,000 units takes about 3 seconds, as before this round. Units now carry their ends for interfaces; the sample's frame times did not change. Graphics hardware is needed for the random graph's frame times; the bench page measures them.

## 5. Visual review

**Eighteen views, taken with scripts/screenshots.mjs at 1440 by 900 from the production build, and looked at one by one.** Views 1 to 16 are those of the last round; this round added 17 and 18. Two findings were fixed before the final pictures: hulls stayed bright behind an active path (now they dim with it), and superseded units had no labels (now they keep faded ones).

| View                                                    | Verdict | Note                                                                                                      |
| ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| 01 Sample graph, 2D, light                              | pass    | Types in colour, chevrons in their keypair types' colours, hulls behind, labels clear of each other.      |
| 02 The same, dark                                       | pass    | The same picture on the dark surface; hulls and labels stay readable.                                     |
| 03 Root unit 1 in 2D, light                             | pass    | The view centres on unit_1; far units fade; the planes count 5, 48, 13 and 14; deepest degree 4.          |
| 04 Keypair 76 to 80 in the inspector, light             | pass    | "Keypair from unit_76 to unit_80", type rel_cd, weight 1, and the note on its reverse.                    |
| 05 Paths 79 to 77, one step longer, dark                | pass    | The path in green with its glow; everything else dims, hulls included; the table lists types and weights. |
| 06 broken-mixed with its issues, light                  | pass    | The rule banner, the dashed half of the missing reverse, the lone unit 5, seven issues with icons.        |
| 07 superseded, light                                    | pass    | Units 3 and 6 and the relation 1 to 4 at 35 percent, with faded labels.                                   |
| 08 The random graph of 10,000 units, dark               | pass    | Given positions, hulls off above 3,000 units, labels capped; dense at Fit, as expected.                   |
| 09 Generate, small world, explanation open, light       | pass    | Fields n, k and β; "Family: Small world" with n × k/2 relations; each parameter with its value.           |
| 10 text-keys with labels, light                         | pass    | Look-alike keys stay distinct in Atkinson Hyperlegible Next.                                              |
| 11 The shell at 800 pixels, Controls drawer open, light | pass    | The drawer lies over the canvas; the top bar fits.                                                        |
| 12 3D first picture of the sample with hulls, light     | pass    | The same as 2D until a root or a turn.                                                                    |
| 13 3D, root unit 1, turned, light                       | pass    | The planes show: deeper units smaller and fainter; hulls follow their units.                              |
| 14 3D, path 79 to 77, turned, dark                      | pass    | The path at the front with its glow; the rest and the hulls dim.                                          |
| 15 Generate, communities with types, Types open, light  | pass    | Fields groups g, p-in and p-out; unit types with swatches, editable names and counts.                     |
| 16 3D, communities, threshold 0.6 and a time window     | pass    | "At least 0.6"; lines below the threshold thin, in the ring colour, without chevrons.                     |
| 17 Fully interfaced graph, close to i, 2D, light        | pass    | Blue half toward A, orange toward B, a surface-coloured line across the relation; the label clear.        |
| 18 3D grid, half through interfaces, root 6, dark       | pass    | i2 cut across the bend between 6 and 11: green toward the root, blue toward 11; deeper units fade.        |

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
- **Two files are near the size target.** model.ts has 407 lines and the shell's store 372; the target was about 400.
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
npm run build      # the module into dist/module, the static shell into dist/shell, the shell with its server into dist/server
npm run check      # types, format, unit and gate tests
npm run e2e        # the browser tests against the server build
npm test           # both
node scripts/specifications-html.mjs   # docs/specifications.html from the Markdown
```

The browser tests need Playwright's Chromium: `npx playwright install --with-deps chromium`. In a cloud session without that download, they use the preinstalled Chromium at /opt/pw-browsers/chromium.
