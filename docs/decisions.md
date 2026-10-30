# graphview: decisions

**Each entry records a choice the specification leaves open: the choice, the reason, and the alternative.** Decisions D1 to D54, made while building release 1 and the 3D viewer, are folded into docs/specifications.md. The entries below were made in the order the work met them: D55 to D64 while settling the discrepancies of docs/spec_discrepancies.md, D65 to D78 while adding interface graphs and the extension points of version 3.0, and D79 on for version 4.0.

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

## D79. Setting classes name their control; the view maps controls to components

- **Choice.** Each class of setting carries the name of its control, such as `slider`. module/view/settings/ holds one Svelte component per control, and `SettingControl` picks the component by that name.
- **Reason.** Settings sit below the model (5.1): the model reads layout, path and hull settings, and must not import Svelte components. The relation between a setting and its component stays one table in the view.
- **Alternative.** Each setting holds its component. The settings layer would then import the view, and the model with it.

## D80. The settings file holds flat keys and only the values that differ

- **Choice.** The file holds `format`, `revision`, `values` keyed by the setting's dotted key, and `pinned`. A value equal to its default is left out.
- **Reason.** A file stays valid when settings are added or renamed defaults change; the defaults stay in one place, the code; a host's database stores one small document.
- **Alternative.** The nested file of the settings analysis, or a snapshot of every value. Each would freeze the defaults of the day it was written.

## D81. Display factors and hulls stay in a graph's view, as a layer over the settings

- **Choice.** `meta.view` still carries the display factors and hulls. While that graph is open its values lie over the stored settings; a person who changes one writes the setting, and the graph's layer for that key ends.
- **Reason.** Saved files and links keep working as before, a graph opens as it was left, and a graph's values never leak into the person's settings.
- **Alternative.** Move them out of `meta.view`. Saved graphs would lose their look.

## D82. Two shell builds: static for Pages, with a server for tests and settings

- **Choice.** `build:shell` writes the static demo into dist/shell; `build:server` writes the app with its server into dist/server, and the browser tests run against it.
- **Reason.** The Pages workflow publishes dist/shell and may not change (1.3). The settings route needs a server, as a host's does.
- **Alternative.** One static build with a development-only settings route. The tests would then never run the route a host runs.

## D83. The perspective drawing keeps the chevrons that point into the interface

- **Choice.** For a relation between A and B through i, the drawing keeps the chevrons of (A, i) and (B, i). The one on A's side points toward B and carries B's perspective; the one on B's side carries A's.
- **Reason.** The request reads: two chevrons per relation, pointing at each other, each pointing at the unit whose perspective it is. These two chevrons already point that way in the keypair drawing, so their places, picking and fading carry over unchanged.
- **Alternative.** Chevrons beside the unit they point at, pointing away from each other. This reading is wrong if the host's drawing places them so; then only the places change.

## D84. The scope hides units, and the loaded graph keeps one layout

- **Choice.** Units outside the scope go as filtered units do, and every unit keeps its place. Lay out scope runs the force layout on the scope alone, on request.
- **Reason.** Nothing moves while a person grows or shrinks the scope, so units stay where they were found; no layout runs per step.
- **Alternative.** Lay out every scope afresh. Units would jump at each Expand.

## D85. Settings save half a second after the last change

- **Choice.** The registry reports each change; the store writes the file 500 milliseconds after the last one, and the dialog shows "Saving…", "Saved" or why it was not saved.
- **Reason.** A person cannot forget to save, and a slider's drag writes once.
- **Alternative.** A Save button. Changes would be lost on a reload before it.

## D86. Named defaults move under the settings; their old modules export them still

- **Choice.** The constants that hold defaults, such as `DEPTH_RULES`, `SPACING`, `CHEVRON_AT`, `TYPE_PALETTE` and `HULL_LIMIT`, now live in module/settings/defaults.ts; the modules that held them export them as before. `tokens` and `PATH_DEFAULTS` stay in the core. The registry takes its defaults from these constants, and the code reads the registry's live value wherever it used a constant. Literals in shaders and panels became settings whose default is written in the setting.
- **Reason.** The settings sit below the model (5.1), so they cannot import the model's or the renderer's constants. The exports of 5.6 and the gates keep their meaning, and each default is written once.
- **Alternative.** Leave the constants where they were and let the settings import upward. That breaks the order of the layers.

## D87. The shell's links load whole pages, as before

- **Choice.** The shell's container carries `data-sveltekit-reload`, so SvelteKit's router takes over no link. The share link reaches the address bar through the router's `goto`, as a shallow change.
- **Reason.** The shell reads its share link and its fragment once, when the page loads (8.13, 8.17). A link that did not reload the page would leave the page as it was.
- **Alternative.** Let the router handle links, and read the address again after each navigation.

## D88. SvelteKit's options live in the shell's Vite configuration; the mode picks the adapter

- **Choice.** shell/vite.config.ts passes the options to the `sveltekit` plugin: the shell's folder, the base path /graphview and the adapter. The mode `static` builds with adapter-static into dist/shell; any other mode builds with adapter-node into dist/server.
- **Reason.** SvelteKit 3 reads no svelte.config.js. A mode works on every system, where an environment variable set in a script does not.
- **Alternative.** An environment variable, or a second Vite configuration.

## D89. The settings handler lives in the settings layer

- **Choice.** `createSettingsHandler` is module/settings/handler.ts, beside the file's rules; no folder of the module is called server.
- **Reason.** SvelteKit refuses to let browser code import any module inside a folder named server, and module/index.ts serves the browser and the server alike. The handler uses only `Request` and `Response`, so it is safe in both.
- **Alternative.** Two entry points, one for servers. A host would then import from two places, and G16 allows the shell one.

## D90. The shell keeps one settings file per browser

- **Choice.** The shell's route names each browser with a cookie at its first visit and keeps that browser's file at data/settings/<name>.json. The handler hands the route's request event to `read` and `write`, so that a host can tell people apart the same way.
- **Reason.** A host such as the one the shell simulates keeps settings per person. One shared file would also let the browser tests, which run side by side, change each other's settings.
- **Alternative.** One file for every visitor, as 5.10 first said. Tests would need to reset it, and could not run in parallel.

## D91. A save that meets another revision merges its own changes

- **Choice.** The viewer remembers the keys and pins it changed since its last save. When the store answers with another revision, the viewer puts those changes over the stored file, saves that, and takes the result, so that both viewers' changes stay.
- **Reason.** Two tabs of one person save to one file. Refusing the second would lose its changes; overwriting would lose the first tab's.
- **Alternative.** The last save wins, or the person chooses. The first loses changes; the second asks a question for a case a merge settles.

## D92. Panel texts pass through the setting "Panel texts"

- **Choice.** Every fixed text of the module's panels, bar, dialog and inspector goes through `say(model, text)`, which looks the English text up in the setting `words.panels` and fills in its braces. The issues, the live region, the refusals, the canvas's name and its hint have settings of their own.
- **Reason.** A host can change any wording, or the language, without editing the module, and texts the setting does not name stay as written.
- **Alternative.** Keys for every text. A translator would then need a list of keys, and the code would lose its readable texts.

## D93. Inventory items that are not settings

- **Choice.** The settings leave out what belongs to a graph (the root, the target, the path, the inspected part, the camera, type names and colours, the filters' window), what is fixed when the code is built (the font files' weights), the core's limits that the gates fix (the path search's most extra steps), and the parts of the extension points that are code (checks, perspectives, projections, shapes' GLSL, inspector sections). The declarative parts of the profile come with version 4.0's profile from JSON (5.7).
- **Reason.** A graph's own state travels in its `meta.view`; build-time values cannot change while the viewer runs; the gates fix the core's limits; code cannot live in a JSON file.
- **Alternative.** Settings for them too. They would either do nothing or break the rules above.

## D94. The shell reads files and addresses itself; examples reach the viewer as sources

- **Choice.** The shell serves each example at /graphview/examples/<id>.json, written at build time, and hands GraphView a `JsonFileSource` of it; when types or interfaces are added, a source of the shell's reads that file and prepares the document on the way. A file or an address the shell reads itself, converts rows (3.7), and hands over as a `DocumentSource`.
- **Reason.** The words about files and addresses ("The file … is not valid JSON.", "The server at … refused the request, or sent no JSON.") are the host's, and a file that cannot be read leaves the viewer's graph as it was. The examples take the path a host's data module takes.
- **Alternative.** Hand every file and address to the viewer as a `JsonFileSource`. A file that failed would then replace the graph with the refusal "source", and the shell would lose its messages.

## D95. The shell attaches to GraphView's model once it is on the page

- **Choice.** The shell takes GraphView's `model` and `getCanvas()` from the component after it mounts. It follows the model's aspects for the headline and the page's colours, and it hands graphs to GraphView only through its props.
- **Reason.** GraphView makes its own model and needs nothing from its host but a graph (7.9); the shell plays such a host.
- **Alternative.** A `model` prop. Every host would then build and own a model, which 7.9 keeps inside the viewer.

## D96. The hook's look is a base value

- **Choice.** `setLook({ theme, motion })` sets GraphView's `theme` and `motion` props, the base values of `theme.scheme` and `motion.enabled`.
- **Reason.** A test's look stays out of the person's settings file, and the Settings dialog shows no change the person did not make.
- **Alternative.** Set the person's values. Each test would write its look into the settings file.

## D97. GraphView applies the narrow-page rule to its own side bar

- **Choice.** On a page 900 pixels wide or less, GraphView starts its side bar closed and draws it as a drawer over the canvas.
- **Reason.** 8.1's rule covers the viewer's side bar, which the host does not lay out; the viewer keeps the rule in any host.
- **Alternative.** A prop for whether the side bar starts open. Each host would repeat the rule.

## D98. Only the newest graph reports ready

- **Choice.** GraphView calls `onready` for the newest `graph` or `source` it was given, after the canvas settles, and not for a load that a newer one overtook.
- **Reason.** A load that finishes while a newer one runs would otherwise tell the host that the newer graph is shown; the shell's hook waits on these calls.
- **Alternative.** Report every finished load with its source, and let hosts match them.

## D99. The setting "Profile" is read at each load

- **Choice.** When `extensions.profile` holds a profile as JSON, each load builds the model's profile from it; when it is empty, the profile given to the model serves. The rules of 3.8 that a profile may change act where the kinds are found, so the issues follow the profile of the load.
- **Reason.** The profile decides the kinds, the issues and the superseded units of the stored graph, which a load computes; the setting applies with the next graph, as its mark says.
- **Alternative.** Recompute the kinds of the open graph at once. That would repeat the load's work outside a load.

## D100. The drawing chooses among the model's chevrons

- **Choice.** The model keeps one chevron per keypair, as 5.2 says. A pure function, `drawnChevrons` in module/model/drawing.ts, gives the chevrons a drawing draws, each with its keypair, the unit it points at and, by perspectives, the perspective it carries; the renderer's buffers, picking and snapshot read that list.
- **Reason.** The drawing is a way of looking at the same graph: the paths, filters, issues and inspector keep working on keypairs, and a switch rebuilds only the picture.
- **Alternative.** A second set of chevrons in the model for each drawing. Every listener would then need to know which set is current.

## D101. What the perspective drawing leaves to the keypairs

- **Choice.** A relation between two interfaces, and an interface with no end or more than two ends, draw by keypairs; an interface with one end keeps only the chevron of (i, A), and draws none when that keypair is missing.
- **Reason.** A perspective runs between the two ends of one interface; these cases have no such pair, and they are the issues of 3.8, which the keypairs show as they are.
- **Alternative.** Guess a perspective for broken interfaces. The picture would then show relations the data does not have.

## D102. A profile may name the keypairs' type field

- **Choice.** `Profile.keypairTypeField` names the attribute that holds a keypair's type; when any keypair carries it, it replaces the type field the schema finds. A profile from JSON names its pair type field.
- **Reason.** In the form of 3.9 the pair type is the keypair's type: it colours the chevrons in both drawings, fills the Types panel and pairs the complements, through the same type registry as before.
- **Alternative.** A second registry for pair types. The panel, the inspector and the colours would then each need two sources of types.

## D103. Every profile's perspectives fall back to the keypair's type

- **Choice.** `perspectiveType(interface, from, to)` is the profile's perspective type, else the type of the keypair from that end into the interface, for any profile.
- **Reason.** 3.9 states the fallback for data; it applies just as well to graphs that carry only keypair types, so that their perspective drawing is named and coloured.
- **Alternative.** Only a profile from JSON falls back. The public profile's perspectives would then stay unnamed.

## D104. The box is a rounded square and the oval half as high as a disc

- **Choice.** `box` measures `(x⁴ + y⁴)^¼`, a square with rounded corners; `oval` measures `length(x, 2y)`, as wide as a disc and half as high. Both fit the unit's square, so its size, reach and picking stay those of a disc.
- **Reason.** Both measures grow evenly from the centre, so the ring, the outline and the glow follow their edges as they follow a disc's.
- **Alternative.** A wider quad for ovals. The unit shader, the picker and the labels would then each need the shape's proportions.

## D105. The shell opens the invented family with base values

- **Choice.** The shell gives the viewer `extensions.profile` and `drawing.relations` as base values with the examples of shell/lib/twin.ts, and none with other graphs.
- **Reason.** A host with interface graphs sets its profile and drawing as base values; the shell simulates such a host for that family, while the fixtures keep the public profile, whose types come from their type field.
- **Alternative.** One profile for every graph. A profile from JSON reads classes from `class`, so the fixtures would lose their types.

## D106. The drawing's settings form a group of their own

- **Choice.** The group Drawing, after Root and depth, holds the drawing, the two shapes and the class labels: 28 groups in all.
- **Reason.** The drawing touches units, lines and labels alike, so none of their groups is its home; its key names the group.
- **Alternative.** Put the drawing under Units or Chevrons. A person would look for it in the other.

## D107. Filter rules and the scope ride on the filter states

- **Choice.** A unit's filter state is the time window's 1 or 0, times its share by the rules (1, `filters.fadeOpacity` or 0), times 0 outside the scope; a keypair's is the lesser of its units' and of the rules that name it; a line's the most of its keypairs'. The shaders already multiply these states into opacity, and picking already skips units below `pointer.minFilter`.
- **Reason.** Fading, hiding and the scope then ease over the transition like the time window, and a faded unit answers no click without a rule of its own.
- **Alternative.** Separate attributes for rules and scope. The shaders, picking, labels and hulls would each need to read them.

## D108. Highlights live in the unit's free look slot and a new pair of attributes

- **Choice.** The unit's fourth look value marks it highlighted (1), dimmed (−1) or neither (0), with the size and dim factors as shader inputs; lines and chevrons gain `aEmph`: whole or dimmed, and for chevrons the direction's colour. Highlights change at once, without a transition. A line or chevron stays whole when it touches a highlighted unit. Picking reads none of it.
- **Reason.** Units already use 14 of 16 vertex attributes (D71); the free look value fits. A selected unit's relations stay readable, and its direction colours stay visible.
- **Alternative.** Dim every line not between two highlighted units. One selected unit would then sit alone, its coloured chevrons dimmed.

## D109. The group Search results holds what a person highlights

- **Choice.** A result's Highlight button adds that unit to the group Search results and turns the group on; typing a search changes no group.
- **Reason.** 6.19 says Highlight adds the result to the group; a group that followed every keystroke would light half the graph while a person types.
- **Alternative.** The group holds every current result.

## D110. Search ranks keys, classes and types with attribute values

- **Choice.** Exact matches are a label, a key as JSON text, or a text key without its quotes; keys, classes and types that only contain the text rank with attribute values, fifth.
- **Reason.** A person types a key as it reads, without quotes; a key or class that merely contains the text is as weak a match as an attribute value.
- **Alternative.** Index only the JSON text of keys. Text keys would then never match exactly.

## D111. How the scope grows, shrinks and lays out

- **Choice.** Expand adds the neighbours of the chosen units, those with more relations first, while the scope holds fewer than `scope.limit`; Hide without a scope makes one of every other unit; a scope lists its units in file order; Lay out scope runs the force layout on the scope's units alone and scales the result back to the box they had.
- **Reason.** The limit keeps a scope readable however it grows; file order makes the scope the same however it was reached; keeping the box leaves the camera and the other units where they are.
- **Alternative.** No limit for Expand, and a free layout. A few clicks could then show the whole graph, and the scope would jump away from the rest.

## D112. Direction colours are on by default

- **Choice.** `highlight.direction` starts on.
- **Reason.** It acts only while exactly one unit is selected, when the direction of its keypairs is what a person looks for.
- **Alternative.** Off, with the switch in the Highlights section to turn it on.

## D113. The live region speaks for search, selection and scope

- **Choice.** Besides 6.19's words for the search, it says "2 units selected", "Selection cleared", "Showing 7 units around unit_7" and "Showing all units"; inspection words go first when inspecting a unit also grows the scope.
- **Reason.** Every change a person makes is said in words (6.14); the inspection is what a click is about.
- **Alternative.** Silence for the selection and the scope.

## D114. Enter in the search field shows the first result

- **Choice.** Enter shows the first result's neighbourhood and opens it in the inspector, as its Show button and the inspector together would.
- **Reason.** "Show" is the word 6.19 uses for a result's neighbourhood; the inspector names what was shown.
- **Alternative.** Enter inspects the first result only. The view would then not change.

## D115. Search, highlights and scope have settings groups of their own

- **Choice.** The groups Search, Highlights and Scope follow Filters: 31 groups in all.
- **Reason.** Each answers its own section of the side bar, where a person looks for it.
- **Alternative.** One group for all three.

## D116. The narrowing state lives beside the model

- **Choice.** module/model/narrowing.ts holds the selection, the groups, the search, the rules and the scope; the model owns one and offers the methods and fields of 5.2, which emit the aspects. Pure functions in filterRules.ts, search.ts and reach.ts do the work.
- **Reason.** model.ts was already the largest file; the narrowing has a state and rules of its own that tests can reach directly.
- **Alternative.** All of it in model.ts.
