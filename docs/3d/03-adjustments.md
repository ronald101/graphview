# Adjustments of 19 October 2026

Ronald's requests after the 3D upgrade, in his order. Names of the private data and its owner are left out, as he asked. Report section 12 maps each request to its code and tests.

## General

1. Sidebars open and close; sections within them open and close.
2. When a setting changes, update the model first, then its picture.
3. Check the source for correctness and efficiency, and refactor where needed. The architecture is modular and contract based.
4. 2D shows the colours and other settings too, like the 3D view's first picture.
5. A click on the graph never switches between 2D and 3D; the 2D and 3D buttons do. The 3D view starts as a 2D view with every setting applied. The original 2D view looks obsolete and points at duplicate functions and inconsistencies: check, and refactor if needed.
6. No reference to the private data or its owner; the example based on it is anonymized. The graph generator is a public tool.

## Top bar

1. No Load button and no Generate button.
2. The choice of example moves to the Generate section; an example is made only when Generate is pressed, and its settings can be changed.
3. The hulls switch and the Fit button move to the top bar.

## Data

1. Three groups: File, Picture, Web.
2. File: a Browse button, a Save button, and the selected file's name. Save on an open file that exists asks before it overwrites, as standard file handling does. It saves the whole graph with its view settings. Save view and Load view go.
3. Picture: saving a picture did not work. No scale: save it as on screen; keep the background.
4. Web: keep Save (Share link) and Fetch.
5. A file that loads updates the whole interface.

## Generate

1. The example choice lives here. Generate by example or by specification only when Generate is pressed.
2. "Add types, weights and times" opens Types and turns on the weight and time sliders.
3. Sliders have two knobs, a lowest and a highest value; generated values fall at random between them.
4. The interface follows each generation.
5. Below the Generate button, an Explanation that opens and closes: each parameter with its current value, what the family is, with headings, updated on every change.

## Types

1. Types sit in the left sidebar under Generate.
2. With "Add types" on, units without a type get one of a number of types (default 5): type_1, type_2 and so on.
3. Keypairs without a type get one of a number of relation types (default 4). A relation type is always a complementary pair: {rel_ab, rel_ba}, {rel_cd, rel_dc}, {rel_ef, rel_fe} and so on.
4. Two columns: colour and label, and the complement's colour and label. Names can be changed.

## Root and depth

1. One row: the label Root, a field "label or key", Set, and Reset (formerly Clear root).
2. A click on a unit shows its label in the field and makes it the root. Reset clears the field and the inspector.
3. Units on plane 4 can be clicked (a click there showed the relation); the clickable area grows on deeper planes.
4. Always four rows: first plane, second plane, third plane, far back planes; and "Deepest plane at degree: n".

## Paths

1. In order: "From unit To unit" with a Reverse path button; a row with the label "Paths to", a field "label or key", Set and Reset; a menu of shortest, shortest + 1 and shortest + 2; a table with unit label, to label, to weight, from label, from weight.
2. Shift and a click on a unit shows its label in the field and finds the paths. Reset clears the field and the inspector.
3. With paths found, the menu offers the shortest (chosen first), + 1 and + 2. Choosing one shows that path and updates the fields.
