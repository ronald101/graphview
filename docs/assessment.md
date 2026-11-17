# graphview: assessment

**The source is in good order; its weak spots were where a person touches it.** This document says what was looked at, what is sound, what was found, what version 4.1 changed, and what is still worth doing. It was written on 17 November 2026, against the working tree of version 4.0 and after the round that made version 4.1.

## 1. What was looked at

**Every source file was read, the tests were run, and the shell was used in a browser.**

- The specification, the decisions and the report; then every file of module/ and shell/, and the tests.
- `npm run check` and the browser tests, before any change: 352 of 353 unit and gate tests passed, and 109 of 109 browser tests. The one failure came from folders kept beside the work (finding 26).
- The shell at 1440, 800 and 390 pixels, in both themes, with the sample graph, a broken graph, the invented family and the random graph of 10,000 units.
- The main thread, profiled while panning, zooming and resting the pointer on 10,000 units, and the time of layouts from 1,000 to 20,000 units. The machine: an Intel Core i7-7700HQ with Intel HD Graphics 630, Chrome for Testing 157, Linux 7.0.

| Part            | Lines | Holds                                                    |
| --------------- | ----- | -------------------------------------------------------- |
| module/core     | 602   | format, loading, issues, fingerprint, paths, tokens      |
| module/settings | 4,237 | 292 settings in 31 groups, the file, the stores, handler |
| module/model    | 2,746 | the model, its rules, sources, search, scope, highlights |
| module/render   | 3,043 | the scene, shaders, camera, picking, labels, hulls       |
| module/view     | 3,920 | the viewer, the canvas, the panels, the Settings dialog  |
| module/workers  | 246   | the force layout, distances and path sets                |
| shell/          | 2,510 | the host: page, generator, files, links, routes          |
| tests/          | 6,695 | 11 gates, 360 unit and gate tests, 118 browser tests     |

The lines are those of the TypeScript, Svelte and CSS files after this round.

## 2. Verdict

**Six parts are sound; the view worked but was rough to use, and is now better.**

| Part      | State                  | Why                                                                                                                                  |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Core      | sound                  | Pure TypeScript without a browser, fixed by gates against a Python reference. Nothing to change.                                     |
| Settings  | sound, and heavy       | Every value has one home, a default, a check and a control. The price is 4,237 lines and a dialog of 292 rows.                       |
| Model     | sound                  | One object holds the state, every change goes through it, and run numbers keep slow answers from overwriting newer state.            |
| Render    | sound, two faults gone | Three instanced draws, with the transitions in the shaders. The labels cost too much on each frame, and Glide did not work.          |
| View      | improved               | It did what the specification says, but showed no state on its switches, forgot its side bar, and gave no word while it worked.      |
| Shell     | sound                  | A fair stand-in for a host. Its style sheet repeats the viewer's rules for controls.                                                 |
| Tests     | strong                 | Each requirement of sections 6 to 8 has a test named after it; the fixtures are hashed; the browser tests read a scene, not shaders. |
| Documents | strong, drifting       | The specification can rebuild the project. The report's numbers and one decision had fallen behind the code.                         |
| Tooling   | improved               | The checks follow git's own list of files, and the browser tests take a Chrome the machine already has.                              |

## 3. What is sound

**The design choices that carry the project are the right ones, and the code keeps to them.**

- **Layers with a gate.** Each layer imports only the layers below it, and G16 checks it. The core runs without a browser.
- **One model.** The canvas and the panels never talk to each other. They hear which aspects changed and redraw from the model.
- **Transitions on the graphics card.** Each instance holds a previous and a next value, and one number eases between them. The processor is idle while the picture moves.
- **One copy of the shaders' sums.** render/frame.ts computes what the shaders compute, so that picking, labels, hulls and the scene for tests agree with what is drawn.
- **Settings in layers.** Defaults, the host's values, the person's file and a graph's own view lie over each other. The file holds only what differs, and two tabs merge their changes.
- **Tests that read the picture.** The browser tests click at points of a scene snapshot in CSS pixels. They know nothing of the shaders.
- **Clean code.** No marker of unfinished work, one use of `any`, no raw HTML, no suppressed type error, and exact versions of every package.

## 4. Findings

**Twenty-nine findings: twenty-four are fixed in version 4.1, four lead to proposals in section 6, and one was the working folder's alone.** "Fixed" names the decision that records the choice.

### 4.1 Working with it

| No. | Finding                                                                                                                                                                     | State       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | The wheel zoomed toward the centre of the view, so every zoom needed a pan after it.                                                                                        | fixed, D118 |
| 2   | Fit and the keys jumped, though 6.10 says every change eases. The camera could move only while the units' transition ran.                                                   | fixed, D119 |
| 3   | The setting Glide lost three fifths of each drag and never moved on: 115 world units for a drag that should move 295.                                                       | fixed, D120 |
| 4   | Nothing named a mark before a click, and a click on a unit moves the whole picture. Chevrons and lines never carry a label.                                                 | fixed, D121 |
| 5   | A layout gave no word while it ran: 3 seconds for 1,000 units, 9 to 12 for 2,000, 6 for 5,000 and 24 for 20,000. The canvas showed the graph before under the new headline. | fixed, D122 |
| 6   | A second graph waited for the first one's layout to end, though that result was thrown away.                                                                                | fixed, D122 |
| 7   | Panning 10,000 units took 33 milliseconds a frame. The labels were ordered anew on each frame, and every unit's state was built again, though only the camera had moved.    | fixed, D127 |
| 8   | Zooming into 10,000 units took 67 milliseconds a frame with the main thread idle: the renderer's smoothing of edges cost three frames in four on integrated graphics.       | fixed, D131 |
| 9   | The side bar forgot its open sections and whether it showed, and its width was fixed at 360 pixels.                                                                         | fixed, D123 |
| 10  | A click could show nothing of what was clicked: the Inspector closed, or scrolled away below the search results.                                                            | fixed, D124 |
| 11  | A closed section hid that a filter was on or that units were selected. The rule banner pointed to a panel at the foot of the side bar.                                      | fixed, D125 |
| 12  | Search results could not be seen while the side bar was closed, and Escape did not leave the search field.                                                                  | fixed, 6.19 |

### 4.2 The look

| No. | Finding                                                                                                                                              | State       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 13  | 2D and 3D looked the same whichever was in use, and so did Panels, Host and a pin.                                                                   | fixed, D126 |
| 14  | Search, number and address fields had no room inside: their text touched the border.                                                                 | fixed       |
| 15  | Boxes to tick and sliders drew in the browser's blue, the first type hue, against 9.1.                                                               | fixed, D126 |
| 16  | The table of keypair types cut its names to a few letters.                                                                                           | fixed       |
| 17  | Search results joined their notes with a middle dot, which 9.1 rules out.                                                                            | fixed       |
| 18  | At 800 pixels the bar wrapped to two rows. The layout test caught a first fix that put Panels under the Host drawer; it now keeps to the right edge. | fixed       |

### 4.3 Correctness and structure

| No. | Finding                                                                                                                                                        | State        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 19  | 7.9 names the callback `onselect`; the component did not have it.                                                                                              | fixed        |
| 20  | GraphView never ended its model, so the graph worker lived on after the component was gone. A host that shows viewers on several pages gathered workers.       | fixed        |
| 21  | "This file was refused." did not pass through the setting "Panel texts" (D92).                                                                                 | fixed        |
| 22  | The view uses fixed ids, such as gv-search, gv-root and gv-view-panels. Two viewers on one page share them, and labels and the / key then reach the wrong one. | proposal 6.1 |
| 23  | Counts are written in English in the code: "81 units", "no issues", "1 step". The words setting cannot change them.                                            | proposal 6.2 |
| 24  | The Data issues panel renders every issue. A broken graph of 20,000 units makes tens of thousands of rows.                                                     | proposal 6.3 |
| 25  | Nine files pass 400 lines, with model.ts at 819; D65 and the report still said none did. shell.css repeats view.css's rules for controls.                      | proposal 6.5 |

### 4.4 Tooling and documents

| No. | Finding                                                                                                                                                                             | State                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 26  | The scan for private names and the format check failed on folders kept beside the work. The scan kept its own list of what git leaves out.                                          | fixed, D129; owner's |
| 27  | The working folder's .gitignore had lost the line data/, which version 4.0 holds. There, one run of `npm run dev` made `npm run check` fail on the settings files the server wrote. | the folder's alone   |
| 28  | The browser tests could not run without Playwright's own download, though the machine has a Chrome.                                                                                 | fixed, D130          |
| 29  | The report said 273 settings in 26 groups (there were 287 in 31), that model.ts had 407 lines, and that 60 frames per second on graphics hardware could not be measured.            | fixed in the report  |

## 5. What version 4.1 changed

**The round changed what a person touches, and left the core, the format, the gates and the fixtures as they were.**

- **Camera.** module/render/camera.ts eases on its own clock; module/render/scene.ts counts the camera into "settled" and asks the controls again while Glide runs.
- **Speed.** module/render/labelLayer.ts orders labels once per change of the model; module/render/frame.ts keeps the units' states while only the camera moves; the canvas goes without the renderer's smoothing above 3,000 units.
- **Layout.** module/workers/index.ts lets a model give up a layout; the canvas says "Laying out … units…".
- **View.** GraphView keeps the side bar's state in settings, has an edge to drag, brings the Inspector into view, counts in headings, and ends its model when it goes. GraphCanvas names what the pointer rests on.
- **Look.** module/view/view.css and shell/shell.css: filled switches, fields with room, slate ticks and sliders, a readable table of pairs.
- **Settings.** Five new ones: `pointer.hoverLabel`, `layout.busyAfter`, `panels.shown`, `panels.reveal`, `renderer.antialiasUpTo`. One new default: `camera.zoomToCursor` is on.
- **Tests.** Seven unit tests and nine browser tests are new; no test was skipped, weakened or deleted.
- **Documents.** The specification is version 4.1 with appendix F; decisions D118 to D132; the report; the README; instructions.html, which says how to run it and what to check by hand.

## 6. Worth doing next

**Seven proposals, the most useful first: four from the findings, and three seen on the way.** None is needed for version 4.1 to be complete.

1. **Ids of the viewer's own.** Give each GraphView a prefix for its ids, with Svelte's `$props.id()`, and look fields up inside the component. Two viewers on one page then work, which a host with a comparison page will want.
2. **Counts through the words.** Let `count()` take its words from the setting "Panel texts", with a form for none, one and many. Then a host can change the language of every text.
3. **A window on long lists.** Show the first few hundred issues and search results, with "and 12,400 more". The panel stays quick whatever the data.
4. **The layout's step at 2,000 units.** A graph of 2,000 units runs up to 1,500 rounds and takes 9 to 12 seconds; one of 5,000 runs 300 rounds and takes 6. Let the rounds fall evenly with the size. This changes 6.1, so the owner decides.
5. **Smaller files and one style sheet.** Move the model's reading of settings into a file of its own (about 110 lines), and let the shell wear the viewer's rules for controls instead of repeating them. Then correct D65.
6. **A view of the settings that differ.** The dialog has 292 rows in 31 groups. A switch "Only changed" would show a person what they set.
7. **One save queue per file.** The settings handler runs every person's save through one queue. A queue per file, or the store's own compare-and-set, serves a host with many people better.

## 7. The working folder

**Version 4.1 is one commit on top of pull request 1, and four folders beside the work are the owner's to exclude.**

- **Git.** Version 4.0 is pull request 1: nine commits, open since 30 October 2026, with its checks passed. This clone had never fetched its branch. The working folder held the same files without their history, on a checkout of version 3.0, and the round first took them for work without a commit. Version 4.1 is one commit on top of that pull request's head, on the branch claude/fluid-viewer-ui. The session's first push was refused for want of a sign-in to GitHub, which the owner then gave (docs/report.md, section 7). Git has no name and address set on this machine, so the commit carries those of the commits before it.
- **The folders beside the work.** 01_graphview, 02_graphview and 03_graphview are copies of earlier versions and hold private names; graphview-docs holds a settings analysis. A stray `git add -A` would take them into a public repository. These lines in .git/info/exclude keep them out of git, of the format check and of the scan:

```
/01_graphview/
/02_graphview/
/03_graphview/
/graphview-docs/
```

- **A refusal.** The session's permission system refused the write to .git/info/exclude. The rules of CLAUDE.md say to stop there and report it, so the lines above are left to the owner. Until then `npm run check` fails in this folder on those four folders, and on nothing else.

## 8. How it was checked

**Every claim above was run or measured, on this machine.**

- svelte-check: no errors in 911 files. Prettier: every file of the repository passes; the four folders beside the work were left out by hand.
- Unit and gate tests: 359 of 360 pass. The one that fails is the scan of 11.1, on 02_graphview and 03_graphview only.
- Browser tests: 118 of 118 pass against the server build, on SwiftShader as 10.4 says.
- `npm run build`: the module, both shells and the package build.
- A clean copy of the tree, after `npm ci`: `npm run check` passes with all 360 tests, the 118 browser tests pass, and `npm run build` ends without an error.
- instructions.html: each of its twenty-four checks by hand was walked through on the built shell, with the pointer, the keys and motion on; the page was looked at in both themes and at the width of a phone.
- Speed: docs/report.md, section 4, on SwiftShader and on the Intel HD Graphics 630.
- The look: the twenty-one views of 11.5 were taken again and looked at one by one; docs/report.md, section 5.
