# graphview

graphview is a graph viewer in two parts: a reusable module that draws a graph and lets you explore it, and a run shell around the module. It shows Rosetta graphs, the data of Heart of Gold, where units are joined by keypairs in both directions. Every relation appears as one line in two halves, one per direction, and each half can be clicked.

**Status.** Release 1 is being built from its specification. Until then this repository holds the contract and the test data:

- docs/graphview-specs.md: the specification of release 1.
- docs/prompt.md: the instructions for the build run with Claude Code on the web.
- fixtures/: 27 test graphs with expected answers, and the Python reference that computed them.
- tests/gates/: tests fixed before the build; the module must pass them.

After the first release, the shell will be published at https://ronald101.github.io/graphview/.
