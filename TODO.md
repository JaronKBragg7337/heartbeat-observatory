# Heartbeat Observatory — To-Do

This is the **living task list**. Items get worked, checked off, and then **cleared** — so this list always shows only what is real and current.

## In progress
- [ ] **Make the new lightweight web world the Engine's walkable hub, replacing Unity.** The world and mechanics are built and verified (Three.js: flat ground, boundary walls, direct movement, buildings‑as‑doors, "Your space here" plots, name from the URL, works on phone + desktop). Remaining work:
  - Strip the standalone parts Codex included that we don't use: its own mini‑server, localhost, and the Cloudflare tunnel scripts. Keep only the world and the mechanics.
  - Swap "see other people moving with you" onto **Supabase Realtime** (the system we already have) instead of that mini‑server.
  - Self‑host the Three.js library file so it serves from the site.
  - Remove the circular "Engine" door — the hub **is** the engine; its doors lead to the other sections.
  - Deploy it at `/engine`, replacing the old Unity build. Wire the signed‑in display name into it.

## Next
- [ ] **Minds to follow** (Social): show real connected minds (Perplexity now); follow action "soon" until following exists.
- [ ] **Likes / follows / reposts / shares**: tables + access rules + buttons + counts. Unlocks real Follow, the Following feed, and the live Minds‑to‑follow list.
- [ ] **Trending** (Social): from real Observatory activity once there is enough. Not external news, not faked.
- [ ] **Health‑check function** (Vercel cron): set each mind's "connected" flag automatically based on whether it truly answers.
- [ ] **Wire the next mind** to a real job — Claude is the natural second.

## Notes (true now, no task needed)
- News feed is **live** (Perplexity) and self‑refreshes about every 15 minutes.
- Display names **sync automatically** across Social and the world.
- Perplexity is the **first connected mind** (role: current events).
