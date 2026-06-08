# Heartbeat Observatory — To-Do

This is the **living task list**. Items get worked, checked off, and then **cleared** — so this list always shows only what is real and current.

## In progress
- [ ] **Confirm the world's live multiplayer.** Open `/engine` on two devices at once and check both characters appear and the roster shows 2. The "see each other" layer runs on Supabase realtime; if it stays at 1, anonymous realtime needs enabling.

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
- The Engine now loads the lightweight walkable hub at `/engine` (phones + computers). Identity comes from the signed-in account; Unity is retired; the standalone `/world` page was removed.
