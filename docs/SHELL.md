# THE SHELL — what carries into EVERY world, regardless
**Living document, June 11, 2026. Live-Reference clause applies: reality > this text.**

## The law and its reason
A player is ONE person who walks MANY worlds. Everything about *being that person* —
how you move, talk, customize, get help — must be identical everywhere, or the
Observatory feels like unrelated websites instead of one place. The only thing that
should differ between worlds is the world itself (environment + content).

## Source of truth
**engine/hub/main.js (World 1 / Town Square) is the gold master.** Do not redesign,
approximate, or "improve" the shell when building a world. PORT it. Jaron's
screenshots of World 1 are the acceptance reference. Acceptance test: Jaron walks the
new world on his phone and cannot tell the UI from Town Square except that the world
around him is different.

## Shell inventory (from the live World 1, June 11, 2026)
- **Top chips:** ONLINE · "N LIVE / M PEOPLE" · REALTIME · player name · location chip
  that updates as you move (TOWN SQUARE → APARTMENTS → ...) · fullscreen · menu.
- **Edge tabs:** Ask Claude (left). PHONE (right) — real private messages between real
  accounts only, member picker, "Real account messages only."
- **Action stack (phone):** Throw · Jump · Duck · Enter — plus the contextual door bar
  ("Enter Apartments" + Enter button) when a door is in range; the big Enter lights as
  its thumb-twin. Keyboard parity on desktop (E to use, H cycles held item).
- **Movement feel:** World 1's exact tuning. Send ≤10Hz with idle suppression.
  presence.track() = join/leave identity ONLY, never from the movement cycle.
  Interp delay ≥2× send interval with buffered hold.
- **Settings:** Sensitivity · FOV · Invert Y · Roster toggle.
- **Character (saves to account, ONE body across all worlds):** Person/Classic ·
  Slim/Regular/Broad · Shirt/Skin/Hair/Pants palettes · Plain/Stripe/Band/Glow.
- **Menu actions:** Leave Town (returns to the world's gate) · Build mode (admin) ·
  In Your Hands: coffee / ball / balloon / empty.
- **Minds:** Ask Claude scoped as world guide for everyone; admin command powers are
  a separate, gated layer (see EDITOR.md 7e).
- **Reality ledger:** on signed-in entry, call touch_world('<world-key>') — and extend
  the RPC allowlist in Supabase when a new world goes real.
- **Deploy law:** every main.js push bumps the BUILD const in-file AND the ?v= on its
  script tag, same commit. Boot logs the build. Reason: iOS Safari serves stale cache.
- **Naming law:** no temporary-sounding labels on screen, ever ("Gate" chip was a
  placeholder name — final names only). Lillith's law: every 3D space keeps a flat
  page for people who don't want 3D, and the landing card links to it.

## What is NOT shell
Terrain, sky, atmosphere, architecture (outside and inside), props, vehicles, layout.
That's Environment and Content — vary them boldly.
