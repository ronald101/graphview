# graphview: standing rules for Claude Code

graphview is a graph viewer: a reusable module that draws Rosetta graphs, and a static shell around it. The contract is docs/graphview-specs.md. The instructions for a build run are docs/prompt.md.

## Rules
- The specification decides. When it leaves a choice open, choose the simplest option that meets it and record the choice, the reason and the alternative in docs/decisions.md.
- Never edit anything under fixtures/ or tests/gates/. Never skip, weaken or delete a test to make it pass. If an expected result looks wrong, mark it "disputed" in docs/report.md with the evidence.
- If a tool, a permission or the network refuses an action, stop that path and report it. Never work around a refusal.
- Work on a branch and deliver through a pull request. Never push to main, never force-push, and never merge.
- Keep each fact in one place. Do not copy the specification, the fixtures or the data.
- Check before claiming: run the tests, and look at screenshots before judging the look.

## Words
Use one word for one thing, as the specification defines them: unit, key, keypair, relation, half, outgoing, incoming, path, path set, focus, radius, ring, stored graph, current graph, issue, fingerprint, host, engine, overlay, view state, scene.

## Keys
Compare keys exactly: the number 1 and the text "1" are different units. Never sort or compute with keys, except in the fingerprint, which sorts by Unicode code points.

## Commands
- `npm run check`: types, formatting, unit tests and the gate tests.
- `npm run e2e`: the browser tests against the shell's production build.
- `npm test`: both.
- `npm run dev`: the shell in development.
- `npm run build`: the module library and the static shell.

## Layout
module/ (core, engine, ui, workers, index.ts), shell/, tests/ (gates, unit, e2e), fixtures/ (read-only), docs/, scripts/.
