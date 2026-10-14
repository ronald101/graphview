# graphview release 1: report

**The build stopped after the core, because the network policy refuses the npm registry.** The core and the graph generators are done and pass every test that can run. Everything that needs an npm package is blocked: Svelte, Vite, Vitest, Playwright Test, the engines and the font. Run of 14 October 2026, branch `claude/stoic-hawking-4oe10d`.

**The refusal, exactly.** `npm view svelte version` failed with `getaddrinfo ENOTFOUND registry.npmjs.org`. The session has no DNS of its own; registry.npmjs.org is on the proxy's bypass list, so npm cannot reach it directly. A diagnostic request for the same host through the session proxy got `CONNECT tunnel failed, response 403`, and the proxy logged `gateway answered 403 to CONNECT (policy denial or upstream failure)` for `registry.npmjs.org:443`. Following the rules, the build did not try other hosts or settings.

## 1. Status

| Milestone           | Status      | Note                                                                                                                                           |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Start            | in progress | Node and Chromium recorded; package.json holds the scripts of I3 but no dependencies; no lockfile; no Vite, Vitest or Playwright configuration |
| M1 Core             | done        | gates G0 to G8, G15 and G16 pass under the stand-in runner (D9)                                                                                |
| M2 Engine trial     | not started | needs sigma.js, graphology and G6 from npm                                                                                                     |
| M3 Module           | not started | needs Svelte 5 and the engine                                                                                                                  |
| M4 Shell            | in progress | generators and rule breaking done, with G9 and G10 tests; the shell itself needs Svelte and Vite                                               |
| M5 Look             | not started | needs the module and the shell                                                                                                                 |
| M6 Speed and builds | not started | needs the builds                                                                                                                               |
| M7 Finish           | in progress | this report and a draft pull request                                                                                                           |

**Machine.** Ubuntu 24.04.5, 4 processors, 15 GiB memory, Node.js v22.22.0, npm 10.9.4. Chromium 141.0.7390.37 is preinstalled for Playwright 1.56.1; its WebGL 2 renderer is "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)". `npx playwright install` was not run, because the npm packages it belongs to cannot install.

## 2. Gates

**"Pass" below means the unchanged test file passed under the stand-in runner of scripts/offline/, not under Vitest.** Rerun with `npm run check` once packages install. Command: `node scripts/offline/run.mjs tests/gates/*.test.ts tests/unit/*.test.ts`, result 210 passed, 0 failed.

| Gate | Result       | Evidence                                                                                       |
| ---- | ------------ | ---------------------------------------------------------------------------------------------- |
| G0   | pass         | core.gate.test.ts, "G0 the fixture set is complete"                                            |
| G1   | pass         | manifest.gate.test.ts, 58 files match; also `sha256sum -c fixtures/MANIFEST.sha256`            |
| G2   | pass         | 27 of 27 fixtures, "G2 loading and issues"                                                     |
| G3   | pass         | 23 of 23 loaded fixtures, stored and current fingerprints                                      |
| G4   | pass         | 23 of 23, components and current counts                                                        |
| G5   | pass         | 22 of 22 fixtures with degrees                                                                 |
| G6   | pass         | 25 of 25 ring entries                                                                          |
| G7   | pass         | 29 path entries and the default-limits test                                                    |
| G8   | pass         | 2,628 of 3,240 pairs; 26 ms in Node                                                            |
| G9   | not testable | generators pass (14 tests in tests/unit/generate.test.ts); layout determinism needs the engine |
| G10  | pass         | 12 families, 200 seeds each, plus range and degree tests in tests/unit/generate.test.ts        |
| G11  | not testable | needs the module in a browser; npm refused                                                     |
| G12  | not testable | no view function built; npm refused                                                            |
| G13  | not testable | no component built; npm refused                                                                |
| G14  | not testable | needs the shell and @axe-core/playwright; npm refused                                          |
| G15  | pass         | tokens.gate.test.ts, 4 tests                                                                   |
| G16  | pass         | boundaries.gate.test.ts, 4 tests; module/index.ts exports the core only so far                 |
| G17  | not testable | needs the browser build; core timings in section 5                                             |
| G18  | not testable | no build tools; npm refused                                                                    |
| G19  | not testable | nothing to screenshot; npm refused                                                             |

No gate is disputed. The reference and the expected files agreed with the core everywhere.

## 3. View functions

**None of V01 to V23 is built, so none has a test.** All need the Svelte component and the engine. The core aids they rely on are done: loading and issues (V21), rings (V07, V14), path sets (V17), degrees (V20) and the tokens (V22).

| Function   | Tests    |
| ---------- | -------- |
| V01 to V23 | none yet |

## 4. Engine

**No engine is chosen.** The trial of Part H needs sigma.js 4, graphology and G6 5 from npm, which the network refuses. The rule of H4 was not applied, because no engine was measured.

## 5. Speed

**Gate G17 is not testable; these core timings in Node.js are for orientation only.** Measured on the machine of section 1, one run each.

- Loading the random graph of 10,000 units and 50,000 keypairs, with its fingerprint: 222 ms.
- The complete graph of nine, path set from 1 to 2 with 7 extra steps: 14 ms, stopped by count at 10,000.
- Gate G8, 3,240 path sets on the database graph: 26 ms in total.

## 6. Visual review

**Not done: there is no picture yet.** The eleven views of J3 wait for the module and the shell.

## 7. Decisions

docs/decisions.md holds the details.

- D1. A key's identity is its JSON text.
- D2. Extra steps are held between 0 and 20.
- D3. A missing unit makes a path set "unreachable", and rings empty.
- D4. The time limit is checked every 1,024 search steps.
- D5. The generators use mulberry32.
- D6. Generator details per family.
- D7. Breaking the rules yields exactly one issue per broken row.
- D8. Core imports carry the .ts extension.
- D9. A stand-in test runner while npm is refused.
- D10. Small interface choices in the core.

## 8. Deviations

1. **Tools are not installed or pinned (I2).** package.json lists the scripts of I3 but no dependencies, and there is no package-lock.json. Reason: the npm registry is refused.
2. **The gate tests ran under a stand-in runner, not Vitest (I3).** Reason: Vitest cannot install. The test files are unchanged.
3. **module/index.ts exports only the core (D1).** `GraphView` and `createGraphView` are missing. Reason: Svelte cannot install.
4. **No Vite, Vitest, Playwright or svelte-check configuration exists yet (M0).** Writing them without the tools would leave them untested.
5. **The trial, module, shell, screenshots and README update are missing (M2 to M6).** Reason: each needs npm packages.

## 9. Open items

1. **Allow the npm registry.** In the cloud environment's settings, under Network access, allow registry.npmjs.org (keep "Allow package managers" ticked). Steps: https://code.claude.com/docs/en/cloud-environments#network-access. The Playwright hosts of I4 may need the same.
2. **Resume the run.** Start a new session with the run prompt. It continues from the status table above: finish M0, then M2 to M7.
3. **Then remove scripts/offline/ (D9),** once `npm run check` passes with Vitest.
4. **On the ThinkPad:** nothing to check yet. The bench page comes with the shell.

## 10. How to run

- Now: `node scripts/offline/run.mjs tests/gates/*.test.ts tests/unit/*.test.ts` runs the gate and unit tests; `tsc -p .` checks the types.
- After the build: `npm ci`, then `npm test`, `npm run dev` and `npm run build`, as specification I3 says.
- The shell's address after the merge of a complete release: https://ronald101.github.io/graphview/. Pages publishes nothing until package-lock.json exists.
