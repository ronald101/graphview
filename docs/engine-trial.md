# Engine trial: sigma.js 4 against G6 5

**The rule of specification H4 chose sigma.js, at step 3.** Neither engine reached 100 percent halves accuracy, so both dropped out at step 1. sigma.js then passed more of the step-1 items: 6 of 7 against 5 of 7.

The trial ran on 14 October 2026 in the cloud session: Ubuntu 24.04, 4 processors, 15 GiB memory, no graphics card. Chromium 141 rendered WebGL 2 in software (SwiftShader). Speeds are therefore relative, not absolute. The trial code is on the branch `engine-trial`, in trial/.

## Versions

sigma 4.0.2 with graphology 0.26.0 and graphology-layout-forceatlas2 0.10.1; @antv/g6 5.1.1. Both are the latest stable versions on the day.

## Step 1: functions and accuracy

| Item                                                       | sigma.js                       | G6                                                    |
| ---------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| Zoom: distances double at zoom 2                           | pass, ratio 2.000              | pass, ratio 2.000                                     |
| Rotate: a vector turns 90 degrees                          | pass, clockwise                | pass, counter-clockwise                               |
| Rings around unit 1                                        | pass, 4 circles, 0.00 px error | pass, 4 circles, 0.00 px error                        |
| Hover lights the unit and its 5 neighbours                 | pass, 6 of 6                   | pass, 6 of 6                                          |
| Hull around units 7 to 32                                  | pass                           | pass                                                  |
| Two clickable halves with direction icons, relation 1 to 7 | pass                           | fail: the click at a quarter hit the relation 42 to 3 |
| Halves accuracy, 100 seeded clicks                         | 96 percent                     | 70 percent                                            |
| Items passed                                               | 6 of 7                         | 5 of 7                                                |

**Every miss was a click on a spot where another line or unit lies under the pointer.** sigma.js missed 4 clicks, all on the relation 2 to 65, which its layout draws almost on top of 2 to 67. G6 missed 30 clicks; its force layout of the database graph is much denser, so other relations cross the click points. The clicks were made with each relation 400 pixels long on screen, so each half was 200 pixels long; the rule asks for at least 40.

## Step 2 and step 3

Step 2 needs both engines to remain, so it did not apply. Step 3 chose sigma.js: it passed more items. For the record, step 2 would also have chosen sigma.js, because G6's first picture of the random graph was 24 times slower.

## Measurements

| Measurement                                                         | sigma.js                          | G6                       |
| ------------------------------------------------------------------- | --------------------------------- | ------------------------ |
| First picture, database graph                                       | 279 ms                            | 201 ms                   |
| First picture, random graph of 10,000 units                         | 435 ms                            | 10,605 ms                |
| Zoom 1 to 8 on the database graph, median and 95th percentile frame | 33.2 and 50.0 ms                  | 33.3 and 50.0 ms         |
| Full turn on the database graph, median and 95th percentile frame   | 33.3 and 33.4 ms                  | 33.3 and 49.9 ms         |
| Zoom on the random graph                                            | 4 frames in 2 s; slowest 3,717 ms | 1 frame in 2 s; 7,566 ms |
| Full turn on the random graph                                       | 1 frame in 2 s; 2,417 ms          | 1 frame in 2 s; 7,616 ms |
| JavaScript heap after loading the random graph                      | 39.7 MB                           | 398.4 MB                 |
| Minimal page, compressed (gzip)                                     | 105.1 KiB                         | 388.5 KiB                |

**Frame times on the random graph mean little here.** Software rendering draws so few frames in 2 seconds that a median of 1 to 4 frames is noise. Ronald's bench page will measure them on real graphics hardware.

The first picture is measured from handing the laid-out graph to the engine to the next drawn frame. Both force layouts ran before the clock started.

## Lines of code per function

Counted between markers in trial/sigma.ts and trial/g6.ts, non-empty lines.

| Function              | sigma.js | G6  |
| --------------------- | -------- | --- |
| Zoom and rotate       | 4        | 5   |
| Rings                 | 27       | 24  |
| Hover with neighbours | 22       | 5   |
| Hull                  | 16       | 6   |
| Halves                | 6        | 6   |

G6 needs fewer lines for hover and hull, because it has them built in. sigma.js needs a drawing layer of its own for rings and the hull.

## Open work from the trial

1. **Halves accuracy below 100 percent.** Engine picking cannot tell overlapping lines apart. The module therefore does its own hit-testing on the scene's geometry: it picks the nearest line within 12 pixels, then the half by the click's position along it. Gate G11 tests that.
2. **Two G6 settings were needed for fairness.** Without `fix-element-size`, G6 units grow with zoom and cover the lines. `hover-activate` needed degree 2, because each half ends at a hidden middle point.
3. **G6's rings screenshot shows no circles.** The check passed on positions read from G6; the drawing of the circle elements did not appear in the screenshot. This did not change the result.

## Screenshots

Under docs/screenshots/trial/, one per engine for each step: `<engine>-database.png`, `-rotated.png`, `-hover.png`, `-halves.png`, `-hull.png`, `-rings.png` and `-random-10k.png`. The hull stays drawn in the rings screenshots, because the steps ran in order on one page.
