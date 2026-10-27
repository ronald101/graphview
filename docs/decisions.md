# graphview: decisions

**Each entry records a choice the specification leaves open: the choice, the reason, and the alternative.** Decisions D1 to D54, made while building release 1 and the 3D viewer, are folded into docs/specifications.md. The entries below were made in the order the work met them: D55 to D64 while settling the discrepancies of docs/spec_discrepancies.md, and D65 to D78 while adding interface graphs and the extension points of version 3.0.

## D55. A file's saved settings reach every part of the picture

- **Choice.** The `graph` aspect means that everything changed. The scene then applies the colours, palettes, display factors and camera controls, as if each of their aspects had been emitted.
- **Reason.** `load` applies saved settings before it emits; one rule in the listener covers them all, and no setting can be forgotten.
- **Alternative.** `load` emits every aspect a setting touched. Each new setting would need its own emit.

## D56. Hulls above 3,000 units: off at the start, the switch still works

- **Choice.** A graph over 3,000 units starts with hulls off, unless its saved settings say otherwise. The switch turns them on at any size. A smaller graph keeps the switch's last state.
- **Reason.** The limit protects speed on load; a person who turns hulls on has chosen to pay for them.
- **Alternative.** Block hulls above 3,000 units. The switch would then show a state it cannot deliver.

## D57. Hull opacity follows the camera through the controls' change event

- **Choice.** Every camera move fires the orbit controls' change event; the scene then sets the opacity of the hull meshes without building them again.
- **Reason.** Mouse, keys, Fit and code all move the camera through the controls, so one listener covers them.
- **Alternative.** Rebuild the hulls on every camera move. It costs a hull computation per frame.

## D58. The live region says one message per action

- **Choice.** Messages that arrive in the same task are joined into one. When there are others, messages about the inspector give way, so a click that sets the root says "Root unit_79".
- **Reason.** A click and Escape each change two things at once; the person asked for the first, and the inspector follows from it.
- **Alternative.** Say every message, joined. The region would read "Root unit_79. Inspecting unit unit_79", twice the words for one action.

## D59. Types, weights and times: which field, and partly typed relations

- **Choice.** A unit without a type gets one in the type field the graph's units already use, else `type`. A relation gets a complementary pair only when none of its keypairs carries a type; a keypair whose reverse carries one stays without.
- **Reason.** Writing `type` beside another type field would make the model read `type` and drop the others. A fresh pair beside an existing type would break the complement rule.
- **Alternative.** Always write `type`, and give every untyped keypair a forward name.

## D60. Share links: what is checked, and what a broken link keeps

- **Choice.** A link's family and example must exist and its seed must be a whole number; every setting must be a number, or numbers where the default is a list. A missing setting takes its default. A link whose graph cannot be read shows the sample graph in the link's mode, without its view.
- **Reason.** The links the shell makes always carry every setting, so defaults only fill links written by hand. A view belongs to its own graph.
- **Alternative.** Refuse links with missing settings, and keep the view on the sample graph.

## D61. The sample graph is anonymous in the fixture itself

- **Choice.** The sample's source in fixtures/reference carries neutral labels, types and weights; make_fixtures.py regenerated the fixtures once, with the owner's approval and the read-only rule lifted for that change only. The shell shows the fixtures as they are.
- **Reason.** A public repository must not hold the private names at all; a build-time transform would hide them from the page but not from the repository.
- **Alternative.** Keep the private fixture and transform it at build time. The names would stay in the repository and its history.

## D62. Private terms are checked by hashes of phrases

- **Choice.** tests/unit/privateWords.ts holds SHA-256 hashes of lower-case phrases of up to six words. A text is split into words of letters, digits and underscores; each phrase that starts with a listed first word is hashed and compared.
- **Reason.** The list names nothing, yet finds the terms in any case and spacing; the first-word filter keeps the scan fast on the whole repository.
- **Alternative.** A plain list of words. It would put the private names back into the repository.

## D63. GraphView is tested through an embed page of the shell

- **Choice.** The shell shows GraphView alone under #embed, with the sample graph, and exposes `window.embed` with the model and the events GraphView sent.
- **Reason.** The test then runs against the production build like every other browser test, and the page doubles as the simplest embedding example.
- **Alternative.** A separate test page outside the shell. It needs its own build.

## D64. The far-plane picking test: one zoom step, and the rule of 6.11

- **Choice.** After Fit and the root, the test zooms in one step before it probes the deep units. Where a deep unit's centre picks another unit, the test checks the rule of 6.11: the other unit is in front, and the point lies within its reach. Before, it required the two centres to lie within 2 pixels of each other.
- **Reason.** Fit now spans the canvas's width (6.3). The test's canvas is narrower than tall, so the graph shows 21 percent smaller. Unit 76 on plane 3 then lies 4.4 pixels from unit 10 on plane 1, which is drawn over it; and the most isolated deep unit lies 17.5 pixels from its nearest neighbour, below the 18 the probe needs. Both follow from the fix; neither is a defect.
- **Alternative.** A wider window for this test. It would hide the narrow canvas that the other tests now cover.

## D65. The source is split along its seams, behind the same facades

- **Choice.** `GraphModel` stays the one facade; its topology, placement and queries live in their own files. `Scene` conducts the buffers, picking, hulls, camera, labels and snapshot, each in its own file, with the GLSL in render/shaders/. The shell keeps its state and actions in one store, shell/lib/shell.svelte.ts, with one component per left section. No source file exceeds 400 lines.
- **Reason.** Interface graphs, and later kinds, then change small files with one job each. The public API and every test stay as they were.
- **Alternative.** Keep the large files and add to them. Each change would touch a file with many jobs.

## D66. Registries instead of switches

- **Choice.** Issue words sit in one record keyed by code; inspector sections in one record of components keyed by what is inspected; unit shapes in a list of GLSL measures, and each unit carries the slot of its shape. The canvas keeps its tests on the inspected kind: they decide what a click or key does, not how a kind looks.
- **Reason.** A new code, kind or shape adds one entry, and the type check finds a missing one.
- **Alternative.** Switch statements. Each new kind would edit every one of them.

## D67. The shell's store is a class with runes

- **Choice.** `Shell` holds the shared state as `$state` fields, with the actions as methods. `connect()` registers its effects while the page starts. Each section takes the store as a prop.
- **Reason.** The sections share one state, and a reader sees where it comes from.
- **Alternative.** Svelte context, or state at module level. Context hides the source; module-level state would be shared by two shells on one page.

## D68. Interfaces are a kind of unit: the core reads the field, the model checks it

- **Choice.** A vertex row's `"interface": true` reaches `UnitInfo.interface`, and nothing else in the core. The model derives each unit's kind and each interface's ends, and adds two issue codes of its own after the core's.
- **Reason.** The fingerprint, the core's issues, the gates and the Python reference stay as they are; the interface rules live where the viewer's other rules live.
- **Alternative.** Interface issues in the core. The gates and the reference would have to change with them.

## D69. An interface's ends are its neighbours; two interfaces related directly are an issue

- **Choice.** The ends are the units an interface shares a relation with, in relation order. Other than two ends is one issue; a relation between two interfaces is another. A relation between two plain units is never an issue.
- **Reason.** The rule needs no direction and no extra field, and a broken interface still draws: one end shows on both halves, other counts show the context colour.
- **Alternative.** Ends declared in the row. Data and relations could then disagree, a second source for one fact.

## D70. The divided disc's line bisects the angle toward its two ends, as seen

- **Choice.** The shader projects the interface and its two ends at every frame, and cuts the disc along the bisector of the angle between the directions to the ends. On the straight line between them, the cut is perpendicular to it.
- **Reason.** Each end's line then enters the half of that end, even when the interface sits off the straight line between its ends, in 2D and in 3D with depth planes.
- **Alternative.** A cut across the straight direction from one end to the other. An interface beyond one of its ends would show that end's line entering the other end's half.

## D71. Units carry their ends, and pack three values into one attribute

- **Choice.** Every unit carries two ends, as lines do; only interfaces fill them. Outline, fade and shape share one `look` attribute, and the two halves' palette slots replace the single type slot.
- **Reason.** Units then use 14 vertex attributes, under the 16 that WebGL 2 guarantees, with room for one more.
- **Alternative.** Separate attributes. Units would use all 16, and the next shape would not fit.

## D72. Interfaces come last in Generate, with text keys

- **Choice.** Generate runs the family or example, then types, weights and times, then broken rules, then relations through interfaces. New interfaces take the text keys i1, i2 and so on, skipping keys already named, with the same text as their label.
- **Reason.** Breaking rules works on whole-number keys. Text keys never collide with number keys (2.3), and choosing them needs no arithmetic on keys.
- **Alternative.** Whole numbers above the largest key. That computes with keys, which 2.3 forbids.

## D73. The shell's own examples sit in shell/examples

- **Choice.** The interface examples are files in shell/examples, listed after the fixtures; a name starting with "broken-" puts one among the examples with issues.
- **Reason.** fixtures/ is read-only and belongs to the reference, which knows nothing of interfaces.
- **Alternative.** New fixtures. They would need the owner's approval, and the reference would have to describe interfaces.

## D74. A link leaves out a share of interfaces of 0

- **Choice.** An example link carries `interfaces=<share>` only above 0, and a generated graph's JSON carries `interfaces` only above 0. Missing means 0.
- **Reason.** Every link made before reads back exactly as it did.
- **Alternative.** Always write the share. Older links would read back with a field they never had.

## D75. Each layer takes its own extension point

- **Choice.** The model takes a profile; the canvas takes looks; the inspector takes sections. GraphView passes on all three.
- **Reason.** Each layer imports only the layers below it (5.1): the model never holds GLSL or Svelte components.
- **Alternative.** One object for every layer. The model would then carry the renderer's and the view's parts.

## D76. A profile's checks bring their own words

- **Choice.** A check names its codes and gives the words for its issues; the module's words cover only its own codes.
- **Reason.** A check's code and its words change together, so they stay in one place.
- **Alternative.** Words registered in the view by code. One fact would live in two places.

## D77. A projection keeps the stored graph beside the shown one

- **Choice.** With a projection the model holds `stored`, the graph as loaded, and `graph`, the graph shown. Issues, the fingerprint and saving follow the stored graph; the picture, the paths and the panels follow the shown one.
- **Reason.** A way of looking at the data must not change the data, or what is wrong with it.
- **Alternative.** Replace the graph. The interface issues would vanish with the folded interfaces, and a saved file would carry the wrong fingerprint.

## D78. Joining kinds share the interface checks; perspectives follow the ends

- **Choice.** Every kind that joins units has ends and the two interface checks, with the interface's words. An interface's perspectives run from its first end to its second and back; one end gives one perspective.
- **Reason.** A family with several classes of interface keeps them as classes of one kind; a separate joining kind is still an interface in every rule.
- **Alternative.** Codes per kind, such as `<kind>-ends`. More codes, and more words, for one rule.
