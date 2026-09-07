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
