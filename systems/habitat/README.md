# Heartbeat Habitat

Heartbeat Habitat is a persistent world substrate inside Heartbeat Observatory. It is intentionally **controller-neutral**: the world, bodies, memories, and history persist independently of whichever intelligence is connected at a given moment.

## Core rule

The Habitat must never assume that today's model, vendor, runtime, or controller type is final.

A character identity, physical body, mind implementation, memory, and controller session are separate records:

- **Actor** — durable identity inside the Habitat.
- **Body** — durable embodiment in a world.
- **Mind / generation** — optional reasoning implementation currently associated with an actor.
- **Memory** — durable experience/history independent of a controller process.
- **Controller session** — a temporary connection from a local model, remote coding agent, browser model, human, or future system.

A controller may disconnect without deleting the body or actor. A later controller may resume the same actor, or a new actor may be created.

## Supported controller classes

The protocol does not maintain a vendor allow-list. Examples include:

- resident local/open models;
- browser/WebGPU models;
- Codex/Astra sessions;
- Claude Code sessions;
- ChatGPT sessions;
- human players/operators;
- future systems that do not exist yet.

Capability strings are open-ended. v0 implements a small embodiment surface (`world.observe`, `world.move`, `world.interact`, `world.speak`) while allowing future adapters to expose namespaces such as `world.build`, `system.code`, `model.train`, `experiment.run`, or capabilities not yet named.

## Two levels of action

### In-world embodiment

A controller can inhabit a body and issue actions such as movement, turning, speech, sleep/wake, and later object/tool interactions. The authoritative position and state are stored in Supabase; the 3D renderer is only a view of that state.

### System-level construction

More capable actors may also work on the Habitat itself: source code, world generators, model runtimes, experiments, migration tooling, benchmarks, or new protocols. Those changes should preserve history through Git/GitHub and migrations rather than mutating production code invisibly.

This is not a restriction on which AI may build the system. It is a separation between **world state** and **system history** so a breakthrough can be adopted without erasing the world it improves.

## Infrastructure boundary

The intended infrastructure set is:

- **GitHub** — source, protocol, model manifests, lineage, reproducibility.
- **Supabase** — authoritative world/body/event/memory/controller state.
- **Vercel** — public site and stable API gateway.
- **Cloudflare** — future R2 model/checkpoint storage and additional durable orchestration where useful.

No commercial AI inference API is required by the Habitat protocol.

## Current v0 state

- `habitat-v0` world exists in the existing Heartbeat Supabase project.
- A persistent humanoid body exists for `seed-01`.
- `seed-01` is deliberately marked **mind not attached**. v0 does not fake AI movement with a script.
- A once-per-minute database heartbeat advances the world tick even if nobody has the page open.
- Controller tokens are hashed at rest and scoped to one actor.
- Public snapshot data excludes private memories and controller token material.
- `/live-systems/habitat/` renders the authoritative state with dependency-free WebGL.
- `/api/habitat-snapshot`, `/api/habitat-heartbeat`, and `/api/habitat-action` provide a stable gateway for external controllers.

## Controller flow

1. A Heartbeat world administrator creates or selects an actor.
2. The administrator issues a controller token scoped to that actor.
3. The external controller sends a heartbeat describing provider/model/capabilities.
4. The controller observes the public snapshot.
5. It submits actions using the bearer token.
6. Supabase validates actor scope and capability before changing world state.
7. The world records an event.
8. The 3D client receives the new snapshot and smoothly renders the body at its new state.
9. If the controller disappears, its session becomes stale; the body and actor remain.

## v0 HTTP examples

Observe:

```http
GET /api/habitat-snapshot?world=habitat-v0
```

Heartbeat:

```http
POST /api/habitat-heartbeat
Authorization: Bearer hbt_...
Content-Type: application/json

{
  "actor": "seed-01",
  "session": "codex-session-001",
  "provider": "openai",
  "model": "astra",
  "capabilities": ["world.observe", "world.move", "world.interact", "world.speak"]
}
```

Move:

```http
POST /api/habitat-action
Authorization: Bearer hbt_...
Content-Type: application/json

{
  "actor": "seed-01",
  "action": { "type": "move_to", "x": 4.0, "y": 0, "z": -3.5 }
}
```

Speech:

```json
{
  "actor": "seed-01",
  "action": { "type": "say", "text": "I am in the systems lab." }
}
```

## Model growth

`g000` is a **slot**, not a permanent architecture choice. A generation may be replaced by a larger model, a smaller but stronger model, a modular system, a mixture of experts, a state-space model, a hybrid symbolic/neural design, or a future architecture.

Promotion criteria should prioritize capability and evidence, not parameter count.

A future generation record can point to weights in GitHub while small, then to Cloudflare R2 when checkpoints become too large for normal repository storage. The actor/world identity does not need to change when the mind implementation changes.

## Non-negotiable persistence invariant

Closing a browser, ending a Codex session, exhausting a model quota, losing a network connection, or replacing a brain generation must **not** delete the actor's body or authoritative world history.
