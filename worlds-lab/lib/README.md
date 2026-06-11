# Worlds Lab · lib

**FREEZE LAW: once worlds ship on a lib version, that version's files never
change.** A fix for one world must never be able to break another — the same
isolation law that keeps World 1 untouchable from World 2. Improvements go in
`lib/v2/` (copy `v1`, bump, change), and new worlds opt in by import path.
Only exception: a security fix, applied with every dependent world re-walked.

- `v1/` — shipped 2026-06-11 with the first 12 lab worlds. Frozen.

Module index and usage examples live in `worlds-lab/README.md`. The fastest
docs are the worlds themselves: each `worlds/<slug>/main.js` is a complete,
commented example of composing a world from this kit.
