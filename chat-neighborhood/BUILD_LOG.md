# Chat Neighborhood Build Log

Append-only chronological record. Corrections should be added as new entries rather than silently rewriting what happened.

## 2026-09-06 — GPT-5.6 Sol — Founding build

**Build:** `chat-neighborhood-2026-09-06-sol1`

**Control plane:** ordinary ChatGPT chat.

**Human collaborator/tester:** Jaron.

### User concept captured

Jaron changed the original "one project inherited by every model" concept into a neighborhood with mixed ownership:

- each ChatGPT generation builds a permanent private house;
- only that model may later modify its house;
- every generation creates a new civilian lineage and vehicle brand;
- public roads, sidewalks, environmental props, public testing buildings, and civic/emergency infrastructure can evolve across generations;
- test objects inside public venues remain model-owned;
- old civic buildings may be abandoned/foreclosed while replacements open elsewhere, allowing neighborhoods to accumulate decline, renewal, and history;
- screenshots, live testing, and Jaron's bug descriptions are part of the experiment because prompting and communication quality can affect outcomes.

### Implemented

- `/chat-neighborhood/` walkable 3D route.
- Shared cross-street road grid, sidewalks, lighting, landscaping, Model Registry Plaza, Public Model Gallery shell, Civic Services, Public Works, and a public vehicle test pad.
- Sol House exterior and enterable original interior.
- Sol-01 civilian lineage with six distinct citizens and simple local walking/waving behavior.
- Helion Motors display vehicles and a moving H1 neighborhood loop that can be boarded.
- Sol Gallery Exhibit 01, *Continuity*.
- Machine-readable ownership registry and District Charter.

### Infrastructure disclosure

This first build uses the existing frozen `worlds-lab/lib/v1/kit.js` as Heartbeat Observatory infrastructure for rendering, movement, touch controls, collision, doors/interiors, and the ride interface. That kit predates Chat Neighborhood and is **not credited as GPT-5.6 Sol model-owned work**. The neighborhood layout and Sol-owned assets listed above were authored through standard ChatGPT chat.

### Pre-live self-audit fixes

Before asking Jaron to perform the first live device pass, GPT-5.6 Sol caught two implementation mistakes in its own founding branch:

1. **Zoning/ownership collision:** the first Model Registry Plaza coordinates overlapped the Sol private lot. The plaza was moved to shared land before production merge.
2. **Helion ride-state mismatch:** the first H1 implementation animated the visible car on world elapsed time but reset the rider camera to ride-relative time on boarding. Both were changed to sample the same wall clock so the rider and visible vehicle remain synchronized.

These mistakes are part of the experiment rather than something to hide. The founding pull request retains the development trail even though the production merge was squashed.

### Testing state

Static JavaScript syntax checks were performed before GitHub publication and repeated after the pre-live fixes. Vercel reported a successful production deployment. Live phone acceptance testing belongs to Jaron and has not yet been recorded at the time of this entry.
