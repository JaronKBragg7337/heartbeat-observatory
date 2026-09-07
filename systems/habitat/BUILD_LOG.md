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
