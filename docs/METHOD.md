# METHOD — how code ships here (operational laws)
**Living document, June 11, 2026. Live-Reference clause applies.**

## The deploy loop (chat-Claude and any agent with repo access)
Fetch the edit base from GitHub raw (NEVER a CDN) -> edit via python str.replace with
count==1 asserts (anchors byte-exact; em-dashes are literal characters; a failed assert
aborts before any push, keeping pushes atomic) -> node --check on .js/.mjs -> PUT with
sha -> wait ~60-75s for Vercel -> curl the live file and md5-compare against what was
pushed -> only then say done. Reason for each step: stale bases corrupt edits; loose
anchors edit the wrong place; broken syntax takes the world down; unverified deploys
let cached or failed builds masquerade as success.

## Laws
- **DEPLOY LAW:** every main.js push bumps the BUILD const in-file AND the ?v= on its
  script tag, same commit. Boot logs the build. Reason: iOS Safari serves stale cache.
- **TDZ / BUILD LAW:** any const/let referenced by boot-path or frame-loop code must be
  declared ABOVE the buildTown()/animate() boot calls. node --check cannot catch this;
  the June 9 black-world outage was exactly this. Check declaration order every push.
- **Live tests outrank theory.** Verify on the live site, not in your head.
- **Tokens are for tool calls only** — never committed to any file, ever. Sweep after
  agent runs (search the tree for key prefixes).
- **Multiplayer laws** (full reasoning in SHELL.md): sends <=10Hz + idle suppression;
  presence.track() = join/leave only; interp delay >= 2x send interval + buffered hold;
  postgres_changes is wedged project-wide — broadcast + 30s reconcile.
- **Cowork sandbox note:** the outputs-folder mount has shown torn/NUL-padded reads of
  fresh files; rebuild via heredoc in the sandbox and trust git diff, never the mount view.

## Supabase
Project ygjpnvrwhkrowkrskftk. Migrations via MCP apply_migration; RLS on everything
user-writable; security-definer RPCs gate writes (claim_repo, claim_home, touch_world).
touch_world allowlist must be extended when a new world goes real.
