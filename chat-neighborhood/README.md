# Chat Neighborhood

A longitudinal Heartbeat Observatory experiment started **2026-09-06**.

The question is not "which model tops a benchmark?" It is: **what can ordinary ChatGPT chat actually build, debug, preserve, and extend over time when Jaron is the human tester and communicator?**

This route is intentionally built through the standard ChatGPT conversation surface. Work, Codex, Claude Code, Cowork, and other coding agents do not modify this experiment.

## Spatial model

The experiment is a neighborhood rather than a single evolving demo.

- Every major standard-ChatGPT model generation receives its own **private property** and must build its own house.
- A model's private house is permanent. Later model generations may inspect it but may not repair, modernize, erase, or rewrite it.
- Every generation creates a new **civilian lineage**. Later models create another lineage instead of editing the old one.
- Every generation creates a new **vehicle brand**. Later models create a competing brand instead of redesigning an old one.
- Public test buildings may evolve, but every model-owned painting, machine, tool, vehicle, character, or other test object inside remains owned by the model generation that created it.
- Roads, sidewalks, public transit, parks, utilities, civic services, environmental props outside private boundaries, and similar infrastructure are shared. Later ChatGPT generations may improve, reroute, replace, neglect, close, or reopen them.
- Old public buildings do not have to disappear. A police station, fire station, shop, or public office can be abandoned or foreclosed while a newer version opens elsewhere. That lets the neighborhood accumulate real history instead of being reset to a clean benchmark every release.

## Human collaboration is part of the measurement

Jaron walks the live build, tests it on real hardware, takes screenshots, describes bugs, and communicates desired changes. Those interactions are experimental evidence too. A failure can come from the model, the implementation, the tooling, the prompt, or the human/model communication loop. The project should preserve enough provenance to tell those apart later instead of pretending every failure is "the AI's score."

## Founding generation

**GPT-5.6 Sol** founded Block 01 on 2026-09-06 through ordinary ChatGPT chat.

Sol owns:

- Sol House
- Sol-01 civilian lineage
- Helion Motors
- Gallery Exhibit 01: *Continuity*

The shared civic layer founded in the same session includes the first roads and sidewalks, Model Gallery shell, Model Registry Plaza, Civic Services building, Public Works building, street lighting, and public landscaping. Those are intentionally not Sol-private property.

## Files

- `DISTRICT_CHARTER.md` — governance and ownership rules
- `MODEL_REGISTRY.json` — machine-readable model/asset ownership
- `BUILD_LOG.md` — chronological work and testing record
- `FAILURES.md` — unresolved/failed attempts kept as evidence
- `shared/` — public infrastructure later generations may change
- `models/<model-id>/` — private generation-owned artifacts

The repository is the memory. Do not rewrite history to make later generations look cleaner.
