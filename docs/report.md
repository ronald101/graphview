# graphview release 1: report

**Release 1 is built, and every gate passes.** The module, the shell, the engine trial and all twenty gates are done. `npm test` passed from a clean install: 214 unit and gate tests, and 204 browser tests against the production build under /graphview/. On GitHub Actions, the checks workflow also passed on the pull request, with Playwright's own browser. Run of 14 October 2026, branch `claude/stoic-hawking-4oe10d`.

**The run met two network refusals, and stopped both paths.** First, the npm registry was refused; the run stopped after the core. Ronald then allowed registry.npmjs.org, and the run continued. Second, Playwright 1.64.1 could not download its browser: the proxy answered 403 for storage.googleapis.com. The browser tests use the Chromium that the cloud machine has preinstalled (decision D12).

**One setting of this session needed care.** Its proxy bypass list sends registry.npmjs.org around the proxy, but the session has no DNS of its own. After Ronald's change, npm reached the registry only with `NO_PROXY=localhost,127.0.0.1` set for each npm command. No host other than the npm registry was used.

## 1. Status

| Milestone           | Status | Note                                                                           |
| ------------------- | ------ | ------------------------------------------------------------------------------ |
| M0 Start            | done   | tools pinned (D11); Node.js v22.22.0; Chromium 141 with WebGL 2 on SwiftShader |
| M1 Core             | done   | gates G0 to G8, G15 and G16 pass                                               |
| M2 Engine trial     | done   | sigma.js, by step 3 of the rule; docs/engine-trial.md; branch engine-trial     |
| M3 Module           | done   | V01 to V23 in four groups; G11, G12 and G13 pass                               |
| M4 Shell            | done   | G9 and G10 pass; every example loads in a browser test                         |
| M5 Look             | done   | eleven screenshots reviewed; G14 and G19 pass                                  |
| M6 Speed and builds | done   | G17 and G18 pass; README written; clean install passes                         |
| M7 Finish           | done   | this report; the pull request                                                  |

**Machine.** Ubuntu 24.04.5, 4 processors, 15 GiB memory, no graphics card. Node.js v22.22.0, npm 10.9.4. Chromium 141.0.7390.37, WebGL 2 renderer "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)".

## 2. Gates

| Gate | Result | Evidence                                                                                                                                                               |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | pass   | tests/gates/core.gate.test.ts, "G0 the fixture set is complete"                                                                                                        |
| G1   | pass   | tests/gates/manifest.gate.test.ts: 58 files match                                                                                                                      |
| G2   | pass   | 27 of 27 fixtures, "G2 loading and issues"                                                                                                                             |
| G3   | pass   | 23 of 23 loaded fixtures, stored and current fingerprints                                                                                                              |
| G4   | pass   | 23 of 23                                                                                                                                                               |
| G5   | pass   | 22 of 22                                                                                                                                                               |
| G6   | pass   | 25 of 25 ring entries                                                                                                                                                  |
| G7   | pass   | 29 path entries and "G7 default limits"                                                                                                                                |
| G8   | pass   | 2,628 of 3,240 pairs                                                                                                                                                   |
| G9   | pass   | tests/unit/generate.test.ts (14 tests) and tests/unit/layout.test.ts (4 tests); browser test "V06 force layout: the same seed gives the same positions"                |
| G10  | pass   | tests/unit/generate.test.ts: 12 families, 200 seeds each, plus 2 tests                                                                                                 |
| G11  | pass   | tests/e2e/halves.spec.ts: 16 tests; pair, triangle and path-4, every relation; 20 seeded relations of the database graph; angles 0, 90 and 215                         |
| G12  | pass   | every function V01 to V23 has passing browser tests; section 3                                                                                                         |
| G13  | pass   | tests/e2e/events.spec.ts: 6 tests; ten events, ten commands, release-2 answers, createGraphView                                                                        |
| G14  | pass   | tests/e2e/a11y.spec.ts: axe finds no serious or critical violation, light and dark, two graphs each; keyboard map; live region                                         |
| G15  | pass   | tests/gates/tokens.gate.test.ts, 4 tests; V22 checks the computed properties                                                                                           |
| G16  | pass   | tests/gates/boundaries.gate.test.ts, 4 tests                                                                                                                           |
| G17  | pass   | section 5                                                                                                                                                              |
| G18  | pass   | `npm run build` builds dist/module and dist/shell; `npm run e2e` serves dist/shell with `vite preview` under /graphview/; the checks workflow on GitHub Actions passed |
| G19  | pass   | section 6; docs/screenshots/                                                                                                                                           |

No gate is disputed. The core matched the reference and the expected files everywhere.

## 3. View functions

Every test named here passes. "Browser" tests run against the shell's production build.

| Function                    | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V01 Pan                     | V01 pan: dragging 100 pixels to the right moves every unit 100 pixels to the right; V01 pan: an arrow key moves the camera, and the camera event fires                                                                                                                                                                                                                                                                                                            |
| V02 Zoom                    | V02 zoom: the graph point under the pointer stays under it; V02 zoom: zoom stays between 0.25 and 40                                                                                                                                                                                                                                                                                                                                                              |
| V03 Fit                     | V03 fit: after fitting, every visible unit lies inside the canvas with the margin; V03 fit: fitting the selection shows the selected units                                                                                                                                                                                                                                                                                                                        |
| V04 Rotate                  | V04 rotate: a unit to the right of the centre appears below it, labels stay upright; V04 rotate: brackets turn 15 degrees and 0 returns to north                                                                                                                                                                                                                                                                                                                  |
| V05 Fly to                  | V05 fly to: the unit sits at the canvas centre and its label is visible                                                                                                                                                                                                                                                                                                                                                                                           |
| V06 Force layout            | V06 force layout: the same seed gives the same positions, another seed others, none missing; V06 force layout: the random graph of 10,000 units settles within 30 seconds                                                                                                                                                                                                                                                                                         |
| V07 Rings                   | 24 tests, one per ring entry of fixtures/expected, such as "V07 rings: database-2026-07-24, focus 1, stored graph: ring numbers agree with C4 and units sit on their rings"; the random graph's entry checks ring sizes                                                                                                                                                                                                                                           |
| V08 Circle and grid         | V08 circle: units sit on one circle in file order, clockwise from north; V08 grid: rows of the rounded-up square root of n units, in file order                                                                                                                                                                                                                                                                                                                   |
| V09 Given positions         | V09 given positions: path-4 appears exactly as its positions say, up to scale; the same for grid-3x3; V09 given positions: a unit without a position sits near its placed neighbours                                                                                                                                                                                                                                                                              |
| V10 Pin                     | V10 pin: after a drag and a new force layout, the unit has not moved; V10 pin: the details panel unpins a unit                                                                                                                                                                                                                                                                                                                                                    |
| V11 Stable change           | V11 stable change: replacing path-4 with path-4 plus a fifth unit leaves the four units in place; V11 stable change: superseded parts hidden and shown keep the other units in place                                                                                                                                                                                                                                                                              |
| V12 Hover                   | V12 hover: the hovered unit and its neighbours light up, the rest dims; V12 hover: a hovered half lights its keypair and the other half of its relation                                                                                                                                                                                                                                                                                                           |
| V13 Select                  | V13 select: a click on a unit selects it, and the select event fires; Shift adds to the selection, and Escape clears it; Tab steps through the keypairs, outgoing first, and Enter activates the current one; a double click on a unit activates it; a click on a short line selects the whole relation; and G11                                                                                                                                                  |
| V14 Focus and radius        | V14 focus and radius: database graph, focus 1, radius 1, beyond hidden: exactly 6 units are visible; F sets the focus, Shift with plus and minus sets the radius, beyond fades; Focus here in the details panel sets the focus                                                                                                                                                                                                                                    |
| V15 Search                  | V15 search: typing viewtest_n offers VIEWTEST_NOTE, and Enter selects unit 79 and centres it                                                                                                                                                                                                                                                                                                                                                                      |
| V16 Hide lone units         | V16 hide lone units: in broken-orphan, unit 3 disappears; in two-pairs, no unit disappears; units left alone by the radius disappear too                                                                                                                                                                                                                                                                                                                          |
| V17 Path explorer           | 26 tests, one per path entry of the small fixtures and the database graph, such as "V17 path explorer: complete-9, 1 to 2, 7 extra, limit 10000, stored graph"; V17 path explorer: two selected units open it; hovering lights a path; a click keeps it lit; arrows step; V17 path explorer: plus and minus change the extra steps while the panel has focus                                                                                                      |
| V18 Relations in two halves | V18 relations in two halves: around a selected unit, outgoing halves take the first hue and incoming the second; each half runs from its own unit to the middle, chevrons by length; broken-missing-reverse shows exactly one missing, dashed half; a selected keypair widens to 3 pixels, and the key panel explains the colours; the other drawings, arrows and lines, are available; colour by keypair attribute takes the three most frequent values; and G11 |
| V19 Labels                  | V19 labels: at three zoom levels, no two visible label boxes come closer than 2 pixels; V19 labels: the selection, the focus and the hovered unit always show their labels                                                                                                                                                                                                                                                                                        |
| V20 Details                 | V20 details: the keypair from 76 to 80 shows "about" and 1 against "has_engagement" and 0.1, marked as differing; V20 details: a selected unit shows its key, label, relations, keypairs, ring and attributes                                                                                                                                                                                                                                                     |
| V21 Data issues             | 27 tests, one per fixture, such as "V21 data issues: broken-mixed lists exactly the expected issues, in order"; V21 data issues: a click on an issue that has something drawn flies to it                                                                                                                                                                                                                                                                         |
| V22 Themes                  | V22 themes: the computed custom properties equal the tokens, light; the same, dark; V22 themes: switching takes effect at once, and "as the system" follows the system                                                                                                                                                                                                                                                                                            |
| V23 Export                  | V23 export: the PNG at scale 1 is the canvas size times 1; the same at scale 2; V23 export: a view state saved and loaded again gives an equal view state and the same scene; V23 export: the Save picture button downloads a PNG                                                                                                                                                                                                                                 |

## 4. Engine

**sigma.js 4.0.2 with graphology, chosen by step 3 of rule H4.** Neither engine reached 100 percent halves accuracy, so both dropped out at step 1. sigma.js passed 6 of the 7 step-1 items, G6 5 of 7.

| Measurement                         | sigma.js   | G6 5.1.1                                          |
| ----------------------------------- | ---------- | ------------------------------------------------- |
| Six functions on the database graph | 6 of 6     | 5 of 6: a click on a half hit a crossing relation |
| Halves accuracy, 100 seeded clicks  | 96 percent | 70 percent                                        |
| First picture, database graph       | 279 ms     | 201 ms                                            |
| First picture, random graph         | 435 ms     | 10,605 ms                                         |
| Heap after the random graph         | 39.7 MB    | 398.4 MB                                          |
| Minimal page, gzip                  | 105.1 KiB  | 388.5 KiB                                         |

docs/engine-trial.md holds the full table, the frame times and the screenshots. The module does its own hit-testing on the scene's geometry, so engine picking does not decide which keypair a click selects (D14, D16).

## 5. Speed

**Gate G17 passes on the machine of section 1.** Numbers from the clean-install run of `npm test`, file test-results/speed.json, measured by the bench page and alone on one worker.

| Measurement                                                     | Limit | Result                            |
| --------------------------------------------------------------- | ----- | --------------------------------- |
| Database graph, first picture                                   | 1 s   | 246 ms                            |
| Random graph of 10,000 units, first picture at given positions  | 5 s   | 3,628 ms                          |
| Complete graph of nine, path set from 1 to 2 with 7 extra steps | 2 s   | 34 ms, stopped by count at 10,000 |
| Database graph, median zoom frame from 1 to 8                   | 50 ms | 33.3 ms (95th percentile 66.6 ms) |

Other numbers from the same run:

- Database graph, full turn: median 33.4 ms, 95th percentile 50.1 ms.
- Random graph: 2 frames in 2 seconds of zooming, the slower 10,066 ms; 2 frames in 2 seconds of turning, 2,067 ms. Software rendering draws 50,000 halves slowly; the bench page on real graphics hardware will tell more.
- Force layout of the random graph: 20.3 s from the command to the settled event (V06 limit 30 s).
- An earlier run of the same gate measured the database graph's first picture at 719 ms. The number varies with the worker's start.

## 6. Visual review

The eleven views of J3, judged against Part F. Files under docs/screenshots/.

| View                                                    | Verdict        | Note                                                                                                                 |
| ------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| 01 Database graph, force layout, light                  | pass           | Slate structure on a calm surface. Labels keep clear of units and controls. The two largest hubs stay crowded.       |
| 02 The same, dark                                       | pass           | Dark tokens throughout; labels and chevrons stay legible.                                                            |
| 03 Rings around unit 1, light                           | pass           | Thin numbered rings, numbers at north, focus ring with halo. With 84 relations crossing the rings, the view is busy. |
| 04 Keypair 76 to 80 with details, light                 | pass           | The selected half is 3 pixels. The two keypairs stand side by side; every differing value carries "≠".               |
| 05 Path explorer, 79 to 77, 4 extra, one path lit, dark | pass           | The lit path takes the path hue at 3 pixels; the panel groups paths by length.                                       |
| 06 broken-mixed with the issues panel, light            | pass           | Dashed issue half with the icon, dashed outline on the orphan, "Not Rosetta data" banner, seven issues in order.     |
| 07 superseded, faded, light                             | pass           | Units 3 and 6 and the relation 1 to 4 at 35 percent.                                                                 |
| 08 Random graph of 10,000 units, whole, dark            | pass with note | At 6 pixels, 10,000 units fill the canvas as one field; labels fit only at the rim. Zooming in reads it.             |
| 09 Generate panel with a small-world graph, light       | pass           | The panel and the graph side by side; the header reads "Small world, seed 1, 30 units, 60 relations, no issues".     |
| 10 text-keys with labels, light                         | pass           | I, l, 1, O and 0 stay distinct; the emoji key shows.                                                                 |
| 11 The shell at 800 pixels, light                       | pass           | Both columns are drawers; the controls drawer is open.                                                               |

Fixed during the review: labels covering other units and the controls (D19), relation widths drawn at half their size (D18), ring numbers hidden by units (D20), and a header that named the unit count twice.

## 7. Decisions

docs/decisions.md holds the details.

- D1 to D4: key identity, the extra-steps range, missing units, and the time-limit check.
- D5 to D7: the random number generator, generator details, and rule breaking.
- D8 and D9: core imports with .ts, and the stand-in test runner used before npm was allowed.
- D10: small interface choices in the core.
- D11 and D12: pinned versions, TypeScript 6, and the preinstalled browser.
- D13 and D14: sigma.js, and the module's own hit-testing and marks.
- D15: when the force layout stops, and large graphs.
- D16 to D20: what a click picks, a fresh view per source, calibrated widths, label obstacles, and ring 1's start.
- D21 to D23: type declarations, tests that run alone, and G11's zoom levels.

## 8. Deviations

1. **TypeScript 6.0.3, not 7.0.2 (I2).** svelte-check 4.7.6 accepts only TypeScript 5 or 6 (D11).
2. **The browser tests in this session use the preinstalled Chromium 141, not Playwright 1.64.1's own (I4).** The download host was refused. On GitHub Actions, the workflow installs Playwright's own browser (D12).
3. **`npm run build:module` also writes type declarations,** with svelte2tsx after Vite (D21). The script's name and purpose are those of I3.
4. **Two development dependencies beyond I2's list:** svelte2tsx (D21) and graphology-types, the type peer of the ForceAtlas2 package (D11).
5. **The canvas does not adapt its colours to forced colours (F7).** The panels and buttons use system colours there; the picture keeps the tokens. Open item 4.
6. **G11's short-half check runs in a 280-pixel window for the pair and the triangle (D23).** In the normal window no allowed zoom makes their halves that short.

## 9. Open items

1. **Review and merge the pull request.** GitHub Pages then publishes the shell at https://ronald101.github.io/graphview/.
2. **Run the bench page on the ThinkPad:** https://ronald101.github.io/graphview/#bench, then Run. It measures the first picture, zoom frames and turn frames for the database graph and the random graph of 10,000 units. If sigma.js disappoints there, H5 allows overruling the engine; only module/engine/ changes.
3. **Look at the picture on real graphics hardware.** The review here used software rendering. Check the 10,000-unit view (08) and the zoom frame times there.
4. **Forced colours in the canvas.** A later change can map the tokens to system colours when the system asks for forced colours (deviation 5).
5. **The session environment.** New cloud sessions need registry.npmjs.org allowed, as Ronald set it. In this container, npm also needed `NO_PROXY=localhost,127.0.0.1`, because the proxy bypass list named the registry while the container had no DNS. The session start hook runs `npm ci` without that setting and may fail the same way; check .session-start.log.
6. **Workflows need no change.** checks.yml ran `npm test` on the pull request and passed. pages.yml publishes after the merge.

## 10. How to run

- `npm ci`, then `npx playwright install --with-deps chromium` for the browser tests.
- `npm run check`: svelte-check, Prettier, and Vitest on tests/gates and tests/unit.
- `npm run e2e`: builds the shell and runs the browser tests under /graphview/; `npm test` runs both.
- `npm run dev`: the shell at http://localhost:5173/graphview/. `npm run build`: dist/module and dist/shell.
- `node scripts/screenshots.mjs` retakes the eleven screenshots, with the production build served on port 4173.
- After the merge: https://ronald101.github.io/graphview/, and #bench for the bench page.
