# Run prompt: build graphview release 1

**For Ronald.** Start a session at claude.ai/code on the repository ronald101/graphview, choose Auto in the mode menu, and send this one line:

> Read docs/prompt.md and carry it out from start to finish without asking me anything.

Everything Claude Code needs is in this repository. The rest of this file speaks to Claude Code.

---

<context>
graphview is a graph viewer in two parts. The *module* draws a graph and lets a person explore it; the *shell* is a static web app around it that loads, generates and saves graphs and exposes every parameter. Three programs will embed the module: the shell, graphmath (a mathematics application) and HoG (Heart of Gold, Ronald's knowledge system). All three use Svelte 5.

The data comes from Rosetta, HoG's foundation: units identified by keys, and keypairs from one unit to another. Five frozen rules define valid data. The module shows every breach of those rules and repairs nothing.

Ronald owns the project. He accepted the design on 14 October 2026 and asked that you finish the build without asking him anything. He reviews the result as a pull request when you are done. He reads documents best when they are short, plain and exact.

You run as a Claude Code cloud session on Ubuntu 24.04 with four processors, 16 GB of memory, no graphics card, and Node.js 22. The repository is public. Your session works on its own branch.
</context>

<documents>
Read these in full before you write any code:
1. CLAUDE.md: the standing rules.
2. docs/graphview-specs.md: the contract. Everything you build follows it. Its Part J says when you are done.
3. fixtures/index.json and fixtures/reference/graphview_reference.py: the test graphs and the reference computation that produced the expected answers in fixtures/expected/.
4. tests/gates/: the gate tests your code must pass. They were run against an independent implementation before this session and passed.
</documents>

<settled>
These points are decided. Build on them; do not reopen them.
- The specification is the contract. Where it leaves a choice open, you decide (see the rules below).
- The half of a relation's line next to a unit shows that unit's outgoing keypair (specification A3).
- The drawing engine is chosen by the trial's fixed rule (specification Part H), not by taste.
- The files under fixtures/ and tests/gates/ are fixed. The repository's settings deny edits to them.
- Release 1 holds the twenty-three view functions V01 to V23. Release 2 appears only as the interface stubs of specification K1.
</settled>

<goal>
Build graphview release 1 as the specification defines it, and finish without asking Ronald anything. You are done when the four conditions of specification J4 hold: every gate passes or is "not testable" for a reason outside the code; docs/report.md is complete; a pull request titled "graphview release 1" is open; and nothing was pushed to main, and nothing under fixtures/ or tests/gates/ changed.

Why it matters: Ronald wants a ready graphical module that he can reuse in HoG and graphmath, and a first, clean experience of Claude Code on the web. The gates let anyone check "done" without asking him.
</goal>

<milestones>
Work through these in order. After each milestone, run its checks, update the status table in docs/report.md, commit with a clear message, and push your branch.

M0. Start.
- Run `node --version` and record it. Install Chromium for the tests: `npx playwright install --with-deps chromium` (specification I4). Launch it headless and record the WebGL 2 renderer string.
- Create package.json, the TypeScript, Vite, Vitest, Prettier and Playwright configurations, and the scripts of specification I3. Use the latest stable versions and pin them exactly (specification I2).
- Make `npm run check` run Vitest on tests/gates and tests/unit. At this point the gate tests fail because the module does not exist yet; that is expected.
- Create docs/decisions.md and docs/report.md, with the report's sections from the report block below.
- Check: `npm run check` runs; the manifest gate G1 passes.

M1. The core.
- Write module/core: loading and issues, the current graph, the fingerprint with SHA-256 in plain TypeScript, relation counts, degrees, components, rings, path sets, and the colour tokens (specification Parts B, C and F2).
- Add unit tests for cases the gates do not cover, such as keys near the integer limits.
- Check: gates G0 to G8, G15 and G16 pass.

M2. The engine trial.
- Build the trial of specification Part H for sigma.js 4 and G6 5, with its browser tests and measurements.
- Apply the rule of H4, write docs/engine-trial.md with the numbers, the deciding step and the screenshots, push the trial code as the branch engine-trial, and remove trial/ from your branch.
- Check: docs/engine-trial.md names the engine and the rule's step that chose it.

M3. The module.
- Write module/engine (the one adapter), module/ui, module/workers and module/index.ts: the component, `createGraphView`, the inputs, the ten events, the ten commands and the scene (specification Part D).
- Build the view functions V01 to V23 in four groups, in this order: navigate, arrange, focus and filter, encode and explain. Commit after each group.
- Check: gates G11, G12 and G13 pass for the functions built so far, and G16 still passes.

M4. The shell.
- Build the shell of specification Part G: loading, examples, generators, breaking the rules, the parameter panel, saving, share links and the bench page.
- Check: gates G9 and G10 pass; the browser tests cover loading every example.

M5. The look.
- Take the eleven screenshots of specification J3, look at each one, and judge it against Part F. Fix what fails and take them again.
- Run the accessibility checks of gate G14 in both themes.
- Check: gates G14 and G19 pass, with a verdict and a note per view in the report.

M6. Speed and builds.
- Measure gate G17 and record the numbers. Make both builds work, and run every browser test against the production build under /graphview/ (gate G18).
- Write README.md: what graphview is, how to run the shell, how to embed the module in a Svelte 5 host, and where the specification lives.
- Check: `npm test` passes from a clean install (`rm -rf node_modules && npm ci && npm test`).

M7. Finish.
- Complete docs/report.md. Open a pull request from your branch to main titled "graphview release 1", with the report's summary as its description.
- Check: the conditions of specification J4 hold. Then send the final message described in the report block.
</milestones>

<rules>
- Do not ask questions. When the specification leaves a choice open, choose the simplest option that meets it, write the choice, the reason and the alternative in docs/decisions.md, and continue.
- If a tool, a permission or the network refuses an action, stop that path. Never work around a refusal: no other download hosts, no disabled checks, no changed settings. Write the refusal and its exact message in the report, continue with the work that does not depend on it, and mark the gates that depend on it "not testable".
- Never edit, skip, weaken or delete a test to make it pass. Never change anything under fixtures/ or tests/gates/. If an expected result looks wrong, mark the gate "disputed" in the report with the evidence, leave the test as it is, and continue.
- Work on your session's branch. Commit after each milestone, push your branch, and open the pull request at the end. Never push to main, never force-push, and never merge.
- Build release 1 only. Do not add features beyond the specification.
- Check before you claim: run the tests before reporting a result, and look at a screenshot before judging the look.
- Write documents for Ronald in his style: short sentences of about 15 to 20 words, plain words, one point per paragraph, a bold lead sentence per section, and numbers that you have checked. Keep code comments short and in English.
- Keep each fact in one place: no copies of the specification, the fixtures or the data.
- If the session pauses, for example at a usage limit, continue from the status table in docs/report.md when it resumes.
</rules>

<report>
docs/report.md has these sections, in this order:
1. Status: one row per milestone, with done, in progress or not started.
2. Gates: one row per gate G0 to G19, with pass, fail, not testable or disputed, and the evidence (a test name, a number or a file).
3. View functions: one row per function V01 to V23, with the names of its tests.
4. Engine: the chosen engine, the rule's step that chose it, and the trial's numbers.
5. Speed: the numbers of gate G17, with the machine they were measured on.
6. Visual review: one row per view of gate G19, with the verdict and a note.
7. Decisions: a short list; docs/decisions.md holds the details.
8. Deviations: every place where the build differs from the specification, with the reason.
9. Open items: what is left, and what Ronald should check on his ThinkPad.
10. How to run: the commands, and the shell's address on GitHub Pages after the merge.

The pull request's description is the summary of sections 1, 2, 4 and 9, with a link to the report.

Your final message in the session has at most ten lines: what was built; how many gates pass; the chosen engine; the pull request's link; the open items; and Ronald's next steps, which are to review and merge the pull request, so that GitHub Pages publishes the shell, and to run the bench page on his ThinkPad.
</report>

<request>
Begin with M0 now, and work through M7 without asking anything. Stop only when the conditions of specification J4 hold, or when every remaining step depends on a refused action. In that case, complete the report, open the pull request with what exists, and send the final message.
</request>
