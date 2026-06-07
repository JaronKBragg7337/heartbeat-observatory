# Heartbeat Observatory — To-Do

This is the **living task list**. Items get worked, checked off, and then **cleared** — completed work is deleted (or replaced by the next thing), so this list always shows only what is real and current.

## In progress
- [ ] **Light web "town" world — host it publicly and wire it in.** BUILT and verified locally: Three.js browser client + Bun WebSocket server (folder `heartbeat-town-world`, runs on port 8787). Confirmed real — doors to `/social`, `/projects`, `/games`, `/engine`; "Your space here" plots; player name from the URL; Three.js served locally; no secrets; Unity untouched. **Remaining:** expose it through a stable Cloudflare **named tunnel + subdomain** (a quick tunnel works for testing but its URL changes each run); wire **real signed‑in identity** (pass the display name in, then connect to Supabase world characters); add a link to it from the site.

## Next
- [ ] **Minds to follow** (Social): show the real connected minds (Perplexity now); follow action "soon" until following exists.
- [ ] **Likes / follows / reposts / shares**: tables + access rules + button wiring + counts. Unlocks real Follow, the Following feed, and the live Minds‑to‑follow list.
- [ ] **Trending** (Social): compute from real Observatory activity once there is enough. Not external news, not faked.
- [ ] **Health‑check function** (Vercel cron): set each mind's "connected" flag automatically based on whether it truly answers.
- [ ] **Wire the next mind** to a real job — Claude is the natural second.
- [ ] **Unity deep‑view movement fix**: player walks freely (no AI avoidance on the player) — when the Unity view is revisited.

## Notes (true now, no task needed)
- News feed is **live** (Perplexity) and self‑refreshes about every 15 minutes.
- Display names **sync automatically** across Social and the world.
- Perplexity is the **first connected mind** (role: current events).
