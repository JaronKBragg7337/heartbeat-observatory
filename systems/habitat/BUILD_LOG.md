# Habitat Build Log

## 2026-09-07 — Habitat v0 foundation

Builder: ChatGPT / GPT-5.6 Sol through ordinary chat and connected GitHub + Supabase tools.

Established:

- persistent `habitat-v0` world in the existing Heartbeat Supabase project;
- actor/body/controller/generation/event/memory schema;
- open capability strings with no model-vendor allow-list;
- scoped, hashed external-controller tokens;
- persistent controller-session heartbeat model;
- embodiment action RPC for movement, turn, speech, wake/sleep, animation state;
- public snapshot RPC that excludes private memory/token data;
- once-per-minute Supabase world heartbeat independent of browser presence;
- `seed-01` durable body with its brain explicitly unattached;
- raw-WebGL Habitat viewer under Live Systems;
- Vercel API gateways for observation, controller heartbeat, and actions.

Important design decision: v0 does **not** move Seed-01 using a fake random/autopilot loop. The first movement shown as an AI-controlled action should come from an actual attached controller.

## 2026-09-07 — validation and hardening

- Verified the Vercel preview `/api/habitat-snapshot` returns the authoritative Supabase world successfully.
- Verified the database heartbeat advances `habitat-v0` while no browser is required to be open.
- Ran Supabase security and performance advisors after DDL changes.
- Added covering indexes for Habitat foreign keys identified by the performance advisor.
- Removed broad anon/public execution from the admin-only controller-token issuer.
- Removed anon/authenticated execution from the cron-only world heartbeat function.
- Added explicit deny RLS policies to private memory, token, and controller-session tables in addition to revoked table privileges.
- Confirmed an invalid controller token is rejected and cannot move `body-seed-01`.
- Added `supabase/habitat-v0.sql` as a consolidated reproducible representation of the live Habitat v0 schema.

Intentional advisor exceptions remain for public snapshot access and custom-token controller RPCs: they are `SECURITY DEFINER` functions callable through the publishable role, but both controller mutation RPCs validate a scoped hashed Habitat bearer token before changing state.

## 2026-09-07 — first live mind and first model-chosen movement

Controller: OpenAI / GPT-5.6 Sol, running through ordinary ChatGPT chat.

Observed state before acting:

- `seed-01` at `(0, 0, 0)`;
- Controller Port at `(0, 0.75, 5)`;
- Systems Lab centered at `(-7, 1.5, 1)`;
- Lineage Archive centered at `(7, 1.25, 2)`;
- North Beacon at `(0, 2, -8)`.

Decision: approach the Lineage Archive first, because a replaceable mind entering a persistent body should establish continuity before optimization or exploration.

Action: `actor.move_to` moved `body-seed-01` from `(0, 0, 0)` to `(3.5, 0, 2.0)`, stopping outside the Archive geometry. This became Habitat event `#2` and is the first model-chosen movement in the system.

Persistence recorded:

- live controller session registered as OpenAI / GPT-5.6 Sol;
- private episodic memory created with salience `1.0`, linked to event `#2`;
- public `controller.attached` milestone event recorded;
- body position remains authoritative in Supabase independent of the controller session;
- controller lifecycle hardened so a live heartbeat marks `mind=attached`, while a session that stops heartbeating is closed after five minutes and leaves the durable body/memory/world intact with `mind=not_attached`.

No model weights were assigned to `g000`; GPT-5.6 Sol entered as an external controller. The resident-brain lineage slot remains separate and replaceable.
