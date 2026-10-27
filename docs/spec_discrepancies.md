# graphview: discrepancies between the specification and the code

27 October 2026. Compares docs/specifications.md (version 2.0) with the code at commit 0d0da07 on the branch claude/stoic-hawking-4oe10d (pull request 2).

**Status: all 47 are settled, in the code or in version 2.1 of the specification; each item ends with its resolution.** The list itself is kept as it was found.

**47 discrepancies: 3 high, 18 medium, 26 low.** 18 need only the specification changed, 12 only the code, and 10 either or both; 6 concern the tests or the report, and 1 concerns CLAUDE.md.

- **High.** Opening a saved file does not apply its 2D or 3D controls or its display factors to the picture (SD-01). Keypair types pair by another rule than the one specified (SD-20). The report's gate table cites tests that were deleted (SD-60).
- **Code to fix first.** A superseded keypair fades by one direction only (SD-29). Share links that cannot be read fail silently (SD-40, SD-41). Hulls cannot be switched on above 3,000 units and do not follow the camera (SD-23, SD-24). Fit cuts off a narrow canvas (SD-25). The live region and forced labels do not do what §6.12 and §6.14 promise (SD-26, SD-27).
- **Specification to settle.** Two meanings of "degree" (SD-04), partial positions (SD-22), chevron sizes (SD-28), what the headline counts (SD-43), and which contract wins over CLAUDE.md (SD-68).
- **Tests to add.** GraphView, the line-width override, reduced motion, two error messages, and the large graph's positions (SD-62, SD-64).

## How this list was made

**Four read-only audits each took one part of the specification; every finding below was checked again in the code.** File and line references are at commit 0d0da07. Items that match the specification are not listed.

- _Severity._ High: a builder following the specification would build something different, or a document states something false. Medium: visible behaviour differs, or the specification is unclear on something a builder must decide. Low: wording, naming or a detail.
- _Kind._ Code differs; missing in code; not in the specification; specification unclear; documents.
- _Fix._ Where the change belongs: the code, the specification, or both.

---

## Sections 2 to 5: words, format, core and contracts

### SD-01. Opening a saved file does not reach the picture's controls or display factors (§5.2)

High · code differs · fix: code.

- **Specification.** `load(doc, settings?)` "applies saved settings", and its aspects are "graph, layout, and those of the settings".
- **Code.** `load` sets the mode, the display factors and the hulls switch without saying so (module/model/model.ts:141–143), then emits only graph and layout (model.ts:178, :182), and root and paths when the file has a root. The scene applies the display factors only on the display aspect and switches the camera's 2D and 3D controls only on the mode aspect (module/render/scene.ts:174–175; otherwise only when the canvas is attached, :144–146). A file saved in 3D or with other factors, opened into a running canvas, shows the depth of 3D with the drag controls of 2D, and the previous size, width and opacity factors, while the model and the panels show the saved ones. The browser test reopens the file into a canvas that already had the same settings, so it does not see this.
- **Resolution.** Code. The `graph` aspect now means that everything changed: the scene applies the display factors, palettes and camera controls on it (decisions D55). Test: §8.11, a file saved in 3D opens in 3D from a 2D canvas.

### SD-02. The scene snapshot leaves out the display factors (§5.5)

Medium · code differs · fix: code.

- **Specification.** "The snapshot must match what is drawn."
- **Code.** A unit's `opacity` and `scale` in the snapshot leave out the Display opacity and size factors (module/render/scene.ts:961–962), which the shaders apply (module/render/gpu.ts:84). Lines, chevrons and labels include them.
- **Resolution.** Code. The snapshot's unit scale and opacity include the display factors as the shaders hold them; §5.5 says so.

### SD-03. Refusal words live in two places (§3.3, §4.1)

Low · specification unclear · fix: specification or code.

- **Specification.** The table of §3.3 gives the words shown, such as "The file is not in the format graphview-graph/1."
- **Code.** The core's `message` says other words, `"format" is not "graphview-graph/1".` and `"vertices" is not a list.` (module/core/load.ts:26–29); the viewer shows its own words (module/view/words.ts:31–44). One fact lives in two places, and the specification does not say which text `LoadResult.message` carries.
- **Resolution.** Code. The core's `message` carries the words of §3.3, and the viewer shows it; §3.3 says so. Test: §8.10, each refused example shows the core's words.

### SD-04. "Degree" names two things; "focus" remains (§2.1, §4.2)

Medium · specification unclear · fix: specification.

- **Specification.** §2.1 defines a degree as "a unit's fewest steps from the root", and says each word names one thing; §4.2 calls the core's relation and keypair counts "degrees" (module/core/aids.ts:45). The model's `degrees` are steps from the root (module/model/model.ts:81).
- The word "focus" remains in `rings(graph, focus)` and `ringIndex`, though §2.1 no longer defines it.
- **Resolution.** Specification. §2.1 keeps "degree" for steps from the root and defines "focus"; §4.2 says the core's `degrees()` counts something else.

### SD-05. The reference does not cover all of 3.3 to 4.5 (§3.6, §1.3)

Low · specification unclear · fix: specification.

- **Specification.** "graphview_reference.py implements 3.3 to 4.5."
- **Reference.** Its path sets have no time limit and no `stoppedBy` (fixtures/reference/graphview_reference.py:269); it fails on a focus or target that is not a unit (rings :232), a case §4.4 and §4.5 define; the expected files hold component sizes but not the order of parts, so no gate checks §4.3's order.
- fixtures/reference also holds make_fixtures.py and database-2026-07-24.source.json, which §1.3 does not list; the second carries private names.
- **Resolution.** Specification. §3.6 names what the reference leaves out; §1.3 lists make_fixtures.py and the source. The source no longer carries private names (D61).

### SD-06. The hairline token is used as a mark below 3 to 1 (§4.6, §6.7)

Low · specification unclear · fix: specification.

- **Specification.** "Mark tokens reach at least 3 to 1 against the surface"; §6.7 draws lines below the threshold in the hairline colour.
- **Fact.** The hairline token reaches 1.29 to 1 in light and 1.36 to 1 in dark; G15 checks it as a border, not as a mark.
- **Resolution.** Code and specification. Lines below the threshold use the ring token, which passes 3 to 1; hairline draws borders only (§4.6, §6.7).

### SD-07. Unit tests use the default worker factory (§5.3)

Low · code differs · fix: specification.

- **Specification.** "Unit tests hand in an inline one."
- **Code.** The factory is optional (module/model/model.ts:100); the unit tests call `new GraphModel()` and rely on the default factory's inline fallback where no Worker exists (module/workers/index.ts:34).
- **Resolution.** Specification. §5.3 describes the optional factory and its inline fallback.

### SD-08. What "reach" means (§5.5, §6.11)

Low · specification unclear · fix: specification.

- **Specification.** §5.5: `reach` is "the radius within which a click picks the unit"; §6.11 adds 3 pixels of padding.
- **Code.** `reach` is the larger of the disc plus 2 and 6, 8, 10 or 12 pixels (module/render/scene.ts:599); a click up to 3 pixels beyond it can still pick the unit (scene.ts:25).
- **Resolution.** Specification. §5.5 defines `reach`, and §6.11 its padding.

### SD-09. More exports than listed (§4.1, §5.2, §5.6)

Low · not in the specification · fix: specification.

- The core also exports FORMAT, PATH_DEFAULTS, isKey, keyJson, compareCodePoints, MAX_SAFE and fingerprintOf; `cssVariables` takes an optional overrides argument (module/core/tokens.ts:54).
- module/index.ts also exports the types Relation and Chevron, and CHEVRON_AT, SPACING, FOREGROUND, MAX_TYPES, OTHER, mixColour, keyText and count.
- GraphModel also has `relationOf` and `dispose()`.
- The model's path limits (module/model/model.ts:39) repeat the core's defaults (PATH_DEFAULTS) instead of using them.
- **Resolution.** Code and specification. The model uses the core's `PATH_DEFAULTS`; §4.1, §5.2 and §5.6 name every export, `relationOf` and `dispose()`.

### SD-10. Workers import a type from the model (§5.1)

Low · code differs · fix: specification.

- **Specification.** "Each layer imports only the layers below it … workers serve the model."
- **Code.** module/workers/index.ts:4 imports the type `GraphWorker` from module/model/contracts.ts, while the model imports the workers. The dependency runs both ways, though only as a type.
- **Resolution.** Specification. §5.1 allows the workers one type import from the model.

---

## Section 6: the viewer

### SD-20. Keypair types pair by a different rule (§6.6)

High · code differs · fix: code or specification.

- **Specification.** "Keypair types pair by how often the type of a keypair meets the type of its reverse, the most frequent pair first, and within a pair the type met first goes forward."
- **Code.** Types are taken in order of their own frequency; each takes its most frequent free partner, and the more frequent type goes forward (module/model/typeRegistry.ts:69, :86, :89). With A–B ×3, A–C ×3, A–D ×3 and B–E ×4, the code pairs A with B and leaves E alone; the specification pairs B with E first, then A with C. The public sample is renamed by the specification's rule (shell/lib/anonymize.ts), so the two rules live side by side.
- **Resolution.** Code. `pairTypes` follows the rule of §6.6; the sample's names come from the same rule (D61). Test: §6.6, the pairing of A–B, A–C, A–D and B–E.

### SD-21. A backward type ignores a custom forward colour (§6.6)

Low · code differs · fix: code.

- **Specification.** "A backward keypair type takes its forward type's colour mixed 42 percent toward the surface."
- **Code.** The tint mixes the palette's default, not a custom colour the person chose for the forward type (module/model/typeRegistry.ts:127–131).
- **Resolution.** Code. The tint follows a custom forward colour. Test: §6.6, a complement's default colour.

### SD-22. Partial positions are thrown away (§6.1)

Medium · specification unclear · fix: specification or code.

- **Specification.** "Units get given positions when every unit has one, else a force layout", and then: "a unit without one sits at the mean of its placed neighbours plus a seeded offset".
- **Code.** Given positions are used only when every unit has `pos` (module/model/model.ts:221); otherwise the force layout runs from seeded starts and ignores the positions that exist (model.ts:223–229). The fallback for units without a position (module/model/layout.ts:37–59) therefore never runs. The specification describes a case that cannot occur.
- **Resolution.** Code and specification. The unused fallback is gone; §6.1 says that partial positions are not used. Test: §6.1, given positions only when every unit has one.

### SD-23. The Hulls switch cannot show hulls above 3,000 units (§6.9)

Medium · code differs · fix: code or specification.

- **Specification.** "Graphs over 3,000 units start without hulls. The Hulls switch in the top bar turns them off and on."
- **Code.** Above 3,000 units hulls are blocked outright (module/render/scene.ts:718), while the model keeps `hulls = true`, so the switch shows on and cannot bring them back. §6.16 ("hulls stop above 3,000 units") agrees with the code; §6.9 does not.
- **Resolution.** Code. Above 3,000 units hulls start off, and the switch turns them on (D56); §6.9 and §6.16 agree. Tests: §5.2 model test and §6.9 on 10,000 units.

### SD-24. Hull opacity does not follow the camera; faint units leave their hulls (§6.9)

Medium · code differs · fix: code.

- **Specification.** "Their opacity grows from 0.05 to 0.16 with the camera's distance."
- **Code.** Opacity is set only when hulls are rebuilt: on type or display changes and during transitions (module/render/scene.ts:188, :451, :458, :752). Zooming, turning and Fit do not rebuild, so the opacity stays as it was. Not in the specification: units below opacity 0.1 are left out of hulls (scene.ts:726), so an active path, which dims everything else to 0.05, makes the hulls vanish.
- **Resolution.** Code. Hull opacity follows every camera move (D57), and a path no longer changes the hulls. Test: §6.9, hulls unchanged by a path.

### SD-25. Fit can cut off the sides of a narrow canvas (§6.3)

Medium · code differs · fix: code.

- **Specification.** "`fit()` shows the whole extent from straight above with a margin of 15 percent."
- **Code.** The distance uses the vertical field of view only, `(EXTENT / 2 / tan(fov / 2)) × 1.15` (module/render/scene.ts:807). On a canvas narrower than it is tall, such as a phone, the sides of the graph fall outside the view.
- **Resolution.** Code. Fit spans the canvas's width as well as its height. Test: §6.3, Fit on a canvas narrower than tall.

### SD-26. The live region says the last change, not the one the specification names (§6.14)

Medium · code differs · fix: code.

- **Specification.** The region says "Root unit_79", "Shortest path from … to …: 3 steps", "Root cleared", and so on.
- **Code.**
  - Escape clears the root and then the inspector in the same handler (module/view/GraphCanvas.svelte:144–145), so "Inspector cleared" replaces "Root cleared" before it is shown.
  - A click on a unit sets the root or target and then inspects the unit (GraphCanvas.svelte:185), so "Inspecting unit …" replaces "Root …" and "Shortest path …" at once. The browser test calls the model directly and does not see this.
  - A one-step path reads "1 steps" (module/view/words.ts:58).
  - "2D view", "Inspecting unit …", "Inspecting relation …" and "Inspector cleared" are said but not specified.
- **Resolution.** Code. One message per action, the inspector's words giving way (D58), and "1 step"; §6.14 lists every message. Test: §6.14, a click on a unit says "Root …".

### SD-27. Forced labels can be missing or overlap (§6.12)

Medium · code differs · fix: code or specification.

- **Specification.** The root, the target, the inspected unit and the path's units "always show"; labels are "never closer than 2 pixels to another label".
- **Code.**
  - Forced units must first pass the 0.35 opacity test (module/render/scene.ts:891). An inspected unit on plane 2 or deeper (0.15), or off the active path (0.05), gets no label.
  - A forced label that does not fit is drawn anyway, over other labels (module/render/labels.ts:89).
  - The opacity test ignores the Display opacity factor, and labels draw at their unit's opacity plus 0.2 (scene.ts:922).
- **Resolution.** Code and specification. Forced labels skip the opacity test, which now includes the opacity factor; §6.12 says that forced labels always show and may overlap. Test: §6.12.

### SD-28. Chevrons change size with depth, the size factor and the path (§6.2, §6.8)

Medium · not in the specification · fix: specification.

- **Specification.** "Chevron: one per keypair, 14 pixels." §6.8 says the size factor applies to units.
- **Code.** The size is `uChevronPx × uSizeScale × (the ends' depth scale) × (1 + 0.2 on the path)` (module/render/gpu.ts:260). Chevrons shrink to 3.5 pixels on far planes, which also changes when the short-line rule hides them; they follow the unit-size factor; and they grow 1.2 times and glow on the active path. The glyph fills about 8 by 11 pixels of its 14-pixel square (gpu.ts:291).
- **Resolution.** Specification. §6.2 and §6.8 describe how chevron sizes follow depth, the size factor and the path.

### SD-29. A superseded keypair fades by one direction only (§3.5, §6.13)

Medium · code differs · fix: code.

- **Specification.** "Superseded units and relations draw at 35 percent opacity."
- **Code.** A relation's fade checks its units and only the keypair (a, b) (module/render/scene.ts:270–276), and both chevrons share that value (scene.ts:259). A superseded (b, a) alone fades nothing, not even its own chevron; a superseded (a, b) also fades the live (b, a) chevron. The result depends on the order of the rows. The superseded fixture supersedes both keypairs, so no test catches it.
- **Resolution.** Code. Each chevron fades by its own keypair; a line fades when all its keypairs do (§3.5, §6.13). Test: §6.13, one superseded keypair.

### SD-30. Lines below the threshold, equal weights and strength changes (§6.7)

Low · not in the specification / code differs · fix: specification and code.

- Lines below the threshold are also dimmed to 60 percent (module/render/gpu.ts:184); the specification names only width, colour and chevrons.
- When every weight is equal, the strength is 1 (module/model/filters.ts:57); the specification's formula divides by zero there.
- The strength has no previous value (module/render/scene.ts:398), so width and brightness jump instead of easing, against §6.2's "a previous and a next value of each attribute".
- **Resolution.** Code and specification. Strength keeps a previous and a next value and eases; §6.7 adds the 60 percent and equal weights.

### SD-31. Picking details (§6.11)

Low · code differs · fix: specification.

- The faintness test for units ignores the Display opacity factor (module/render/scene.ts:648); the tests for lines and chevrons include it.
- "A drawn disc that covers it" is the disc plus 3 pixels (scene.ts:660).
- A line's half width has a floor of 1 pixel and ignores the path's extra width (scene.ts:693).
- **Resolution.** Code and specification. Unit picking includes the opacity factor; §6.11 describes the padding and the line's half width. Test: §6.11, a faint unit answers no click.

### SD-32. Shader material (§6.2)

Low · code differs · fix: specification.

- **Specification.** "three.js on WebGL 2, with raw shader materials."
- **Code.** `THREE.ShaderMaterial` (module/render/gpu.ts:472), which adds three.js's built-in uniforms and prefixes.
- **Resolution.** Specification. §6.2 names `ShaderMaterial`.

### SD-33. Barnes–Hut from 500 units (§6.1)

Low · not in the specification · fix: specification.

- **Code.** `barnesHutOptimize` is on above 500 units (module/workers/force.ts:35); the specification mentions Barnes–Hut only above 2,000 units, with θ 1.
- **Resolution.** Specification. §6.1 says Barnes–Hut from 500 units.

### SD-34. "Around the vertical" (§6.14)

Low · specification unclear · fix: specification.

- **Code.** [ and ] turn around the camera's up axis, the scene's y axis, which lies in the graph's plane (module/render/scene.ts:833), as the mouse does. Since 2D looks straight down the z axis, "vertical" could be read as z.
- **Resolution.** Specification. §6.14 names the camera's up axis.

---

## Sections 7 and 8: panels and shell

### SD-40. A share link that cannot be read shows no message (§8.13)

Medium · code differs · fix: code.

- **Specification.** "A link that cannot be read says 'The graph in the link could not be read.' or 'The view in the link could not be read.'"
- **Code.** The start-up sets the message (shell/App.svelte:328) and then calls Generate, which clears it first (App.svelte:278, :346). The message never shows. Only `readLink` is unit-tested.
- **Resolution.** Code. The link's message shows after the graph loads. Test: §8.13, a link that cannot be read.

### SD-41. Share links are not checked beyond JSON (§8.13)

Medium · code differs · fix: code.

- **Specification.** An unreadable link leaves the sample graph.
- **Code.** `readLink` checks only that the JSON parses (shell/lib/share.ts:61–80). `gen={}` throws at `paramsText(s.params)` (App.svelte:336), so nothing loads and no message shows; an unknown family breaks the explanation (shell/lib/explain.ts:113–115); an unknown example id shows "Cannot generate: No example called …" and an empty canvas.
- **Resolution.** Code. Links are checked: family, settings, seed and example (D60). Tests: §8.13, unit and browser.

### SD-42. Share links: sources and side effects (§8.13)

Low · specification unclear / not in the specification · fix: specification.

- A graph opened from a file has no source in the link (shell/lib/share.ts:25–32); its link reopens the sample graph with the file's root and path.
- Share link also rewrites the address bar (App.svelte:223) and says "The link is on the clipboard." or "Copy the link below." (App.svelte:226, :228).
- The `view` parameter repeats `mode` (share.ts:34).
- **Resolution.** Code and specification. Share link on a file's graph says that it cannot travel in a link; §8.13 describes the address bar, the messages and the view's mode. Test: §8.13.

### SD-43. The headline counts complete relations only (§8.2, §2.1)

Medium · specification unclear · fix: specification.

- **Specification.** §2.1 defines a relation as "(a, b), (b, a), or one of them in broken data"; §8.2 shows "<m> relations".
- **Code.** The headline counts relations with both keypairs (module/model/model.ts:477–479), as the core's `relationCount` and the expected files do. broken-missing-reverse reads "1 relation" although it draws two lines.
- **Resolution.** Specification. §8.2 says that the headline counts relations with both keypairs.

### SD-44. "Add types, weights and times" decides once per graph (§8.7)

Medium · code differs · fix: code or specification.

- **Specification.** "Units without a type get one … Keypairs without a weight get one … Units without a time get a date."
- **Code.** `missing()` decides for the whole graph (shell/lib/decorate.ts:57–67): if any unit has a type, any keypair a weight, or any row a date, nothing of that kind is added anywhere. Any of type, kind, category, archetype, group and class counts as a type.
- **Resolution.** Code. Each row that lacks a value gets one (D59); §8.7 says so. Test: §8.7, each row that lacks a value.

### SD-45. Explanations: relation counts and family names (§8.8)

Low · missing in code · fix: code.

- **Specification.** "Family: <name>" with what the family is "and how many relations it makes".
- **Code.** Grid, Tree, Separate components, Random by degrees, Small world, Preferential growth and Communities give no relation count (shell/lib/explain.ts:35–87). The headings say "Complete graph", "Small world (Watts–Strogatz)" and "Preferential growth (Barabási–Albert)" (explain.ts:31, :65, :74), while the menu and §8.5 say "Complete", "Small world" and "Preferential growth" (shell/lib/generate.ts:41, :47, :48).
- **Resolution.** Code. Every family's explanation gives its relation count and the menu's name. Test: §8.8.

### SD-46. Two examples name no family (§8.8)

Low · missing in code · fix: code.

- **Code.** text-keys and superseded have no entry in the example-family list (shell/lib/explain.ts:91–106), so their explanation names no family.
- **Resolution.** Code. text-keys and superseded name their family. Test: §8.8.

### SD-47. Parameter fields carry code names; two constraints are unspecified (§8.4, §8.5)

Low · code differs / not in the specification · fix: both.

- The fields are labelled with code keys: b, pIn, pOut, beta, m0 (App.svelte:499; generate.ts:43–49), not branching b, p-in, p-out, β, m₀.
- Small world requires n > k (generate.ts:247) and Communities n ≥ 2g (generate.ts:297); neither is in §8.5.
- **Resolution.** Code and specification. The fields carry readable names; §8.4 and §8.5 list them and the limits. Tests: §8.8 unit test, §8.8 browser test.

### SD-48. The drawer width boundary (§8.1)

Low · code differs · fix: specification.

- **Specification.** "Below a width of 900 pixels both sidebars start closed."
- **Code.** At exactly 900 pixels the drawers apply too (`innerWidth > 900`, App.svelte:46; `max-width: 900px`, shell/shell.css:135).
- **Resolution.** Specification. §8.1 says 900 pixels or less. Test: §8.1, at 900 and 901 pixels.

### SD-49. "At least off" (§7.5)

Low · code differs · fix: code.

- **Specification.** The threshold reads "At least <value>" or "off".
- **Code.** Without a threshold it reads "At least off" (module/view/FiltersPanel.svelte:72).
- **Resolution.** Code. The panel reads "Threshold off"; §7.5 says so. Test: §6.7 and §7.5.

### SD-50. Path menu entries carry their group (§7.3)

Low · code differs · fix: specification.

- **Specification.** Each path is written "unit_a → unit_b → …".
- **Code.** Each entry starts with its group, "Shortest: unit_a → …" (module/view/PathsPanel.svelte:107). Not specified: "Type a label or a key." on an empty Set, the hint under the panel, and the table caption.
- **Resolution.** Specification. §7.3 describes the group in each entry and the three notes.

### SD-51. Issue words use labels for two issues (§7.8)

Low · specification unclear · fix: specification.

- **Code.** "has no reverse" and "takes part in no relation" name units by label (module/view/words.ts:23, :25); the other issues print keys (words.ts:15–21). The examples in §7.8 show keys only.
- **Resolution.** Specification. §7.8 says which issues name labels.

### SD-52. The importer adds and drops fields (§3.7)

Low · code differs / not in the specification · fix: specification.

- An edge's `id` is dropped, a vertex's `name` is dropped when it also has a `label`, and `x` or `y` is dropped unless both are numbers (shell/lib/importer.ts:6–7, :38–43).
- A row's `key` wins over its `id`; a file converts when any vertex has an `id` or any edge a `source` or `target` (importer.ts:23–25).
- The importer sets `meta.name` to "Imported graph" and `meta.source` (importer.ts:29–31).
- After a fetch the message reads "The address was read as rows with id, source and target." (App.svelte:209), not "The file …".
- **Resolution.** Specification. §3.7 describes the importer's rule, fields, meta and messages.

---

## Sections 1 and 9 to 12: look, tools, tests and documents

### SD-60. The report's gate table cites deleted tests (§11.2)

High · documents · fix: report.

- docs/report.md section 2 still marks G11, G12 and G13 "pass" with evidence from deleted files: halves.spec.ts, events.spec.ts and the V01–V23 tests (report.md:44–46). Section 12.3 of the same report calls these gates retired.
- G9 cites a browser test "V06 force layout" that no longer exists (report.md:42); G14 credits a11y.spec.ts with the keyboard map and live region, which are tested in view.spec.ts; G15 cites V22.
- The specification's G11 to G13 do have tests that the report does not cite: three click targets (tests/e2e/view.spec.ts), and the model's aspects and saved settings (tests/unit/model.test.ts).
- **Resolution.** Report. docs/report.md was written afresh, with the current gates and their evidence.

### SD-61. The report does not follow §12.3

Medium · documents · fix: report.

- docs/report.md is titled "release 1: report"; its status table lists release 1's milestones, not §12.2's; it keeps an Engine section; its sections 11 and 12 follow "How to run".
- Speed and visual review appear twice and disagree: section 5 gives the complete graph of nine with 7 extra steps (34 ms, stopped at 10,000), section 12.4 with 2 (5 ms, 50 paths); section 6 reviews eleven views, section 12.5 sixteen.
- Deviations still cite release 1's I2, I4 and F7; two of them are no longer deviations under §10.2.
- **Resolution.** Report. docs/report.md follows §12.3, once.

### SD-62. Requirements without a test (G12)

Medium · missing · fix: tests.

- GraphView (§7.9) has no test.
- The line-width override (§6.8) is not tested; the Display test checks unit size and opacity only.
- Reduced motion and "As the system" (§6.10, §9.4) are not tested.
- "The file … is not valid JSON." (§8.11) and "The view in the link could not be read." (§8.13) are not tested.
- **Resolution.** Tests. GraphView (§7.9), the line width (§6.8), reduced motion (§6.10), a file that is not JSON (§8.11), and the view in a link (§8.13).

### SD-63. Tests are not named after the requirements (G12)

Low · code differs · fix: tests or specification.

- **Specification.** G12: "every requirement of sections 6 to 8 has at least one passing test named after it."
- **Tests.** Names cite retired sources or unrelated gates: "spec 01 §…", "spec 02 §…", "(specification V19)" (tests/unit/model.test.ts), "Keyboard (F7)" (tests/e2e/view.spec.ts), "G7 bench" (tests/e2e/shell.spec.ts, while G7 is path sets), "(G15 tokens)".
- **Resolution.** Tests. Every test name starts with its section; every subsection of sections 6 to 8 has one.

### SD-64. The large-graph test does not check positions (§11.4)

Medium · missing · fix: tests.

- **Specification.** "The random graph loads at its given positions."
- **Test.** tests/e2e/large.spec.ts checks 10,000 units with finite screen points; it never compares them with the fixture's positions.
- **Resolution.** Test. The large-graph test compares every position with the fixture's.

### SD-65. Text sizes outside §9.2

Low · code differs · fix: code or specification.

- 13-pixel text: panel h4 and tables (module/view/view.css:92, :158), sidebar h3 and explanation h4 (shell/shell.css:155, :197). The top-bar name is 16 pixels in weight 700 (shell.css:65). §9.2 lists 12, 14 and 15 pixels.
- **Resolution.** Specification. §9.2 lists the 13- and 16-pixel sizes.

### SD-66. Imports without .ts (§10.2)

Low · code differs · fix: tests.

- tests/unit/core.test.ts:4 and tests/unit/generate.test.ts:4 import '../../module/core' without the extension.
- **Resolution.** Tests. The imports carry .ts.

### SD-67. Scripts: one unlisted, one undeclared package (§10.1, §10.2)

Low · not in the specification · fix: both.

- scripts/specifications-html.mjs is not in §10.1's list.
- scripts/screenshots.mjs:6 imports 'playwright', which package.json does not declare; it arrives only as a dependency of @playwright/test, so its version is not pinned.
- **Resolution.** Code and specification. scripts/screenshots.mjs imports `@playwright/test`; §10.1 lists the specification page's script.

### SD-68. CLAUDE.md names another contract (§1.3)

Medium · specification unclear · fix: specification or CLAUDE.md (by its owner).

- CLAUDE.md says "The contract is docs/graphview-specs.md", lists the layout "module/ (core, engine, ui, workers, index.ts)", and keeps the words focus, radius, ring, half, engine and overlay. The specification says it decides where documents disagree and uses another layout. CLAUDE.md is a fixed input the builder may not edit, so the specification should say which one wins.
- **Resolution.** CLAUDE.md. Its owner approved a rewrite: it names docs/specifications.md as the contract, with its words and layout; §1.3 says so.

---

## What matches

The audits found no difference in: the depth table, planes and transitions; the palette, its 42 percent tint and 64 slots; the force layout's stop rule and scaling; the picking radii and paddings; label size, gap and order; the keyboard keys and the canvas name; every panel's structure; the family algorithms and mulberry32; breaking rules; the bench page and the test hook; tool versions, scripts, Playwright and workflow settings; the gate tests G0 to G8, G15 and G16; the sixteen screenshots; and fixtures/ and tests/gates/, unchanged since they were added.
