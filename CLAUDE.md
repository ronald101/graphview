# graphview: standing rules for Claude Code

graphview is a graph viewer: a reusable Svelte 5 module that draws graphs of units and keypairs in 2D and 3D, and a static shell around it. The contract is docs/specifications.md; docs/specifications.html is the same text as a page.

## Rules

- The specification decides. When it leaves a choice open, choose the simplest option that meets it and record the choice, the reason and the alternative in docs/decisions.md.
- Never edit anything under fixtures/ or tests/gates/. Never skip, weaken or delete a test to make it pass. If an expected result looks wrong, mark it "disputed" in docs/report.md with the evidence.
- If a tool, a permission or the network refuses an action, stop that path and report it. Never work around a refusal.
- Work on a branch and deliver through a pull request. Never push to main, never force-push, and never merge.
- Keep each fact in one place. Do not copy the specification, the fixtures or the data.
- Check before claiming: run the tests, and look at screenshots before judging the look.

## Words

Use one word for one thing, as section 2.1 of the specification defines them: unit, kind, plain, interface, end, key, keypair, relation, outgoing, incoming, chevron, path, path set, root, degree, plane, target, stored graph, current graph, issue, fingerprint, type, complement, perspective, profile, model, aspect, scene, view settings, host.

## Keys

Compare keys exactly: the number 1 and the text "1" are different units. Never sort or compute with keys, except in the fingerprint, which sorts by Unicode code points.

## Commands

- `npm run check`: types, formatting, unit tests and the gate tests.
- `npm run e2e`: the browser tests against the shell's production build.
- `npm test`: both.
- `npm run dev`: the shell in development.
- `npm run build`: the module library and the static shell.
- `node scripts/specifications-html.mjs`: docs/specifications.html from docs/specifications.md.

## Layout

module/ (core, model, render, view, workers, index.ts), shell/, tests/ (gates, unit, e2e), fixtures/ (read-only), docs/, scripts/.
