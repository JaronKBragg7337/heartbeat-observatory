# Heartbeat Observatory — To-Do

Living task list. Items get worked, checked off, and cleared when done, so this always shows only what is real and current.

## Open issues — fix next (current gaps from walking it live)
The ⚠️ items are one underlying change: the world's people should come from the **accounts** (keyed by a stable account id), where **present = a live character** and **away = a roaming ghost** — instead of today's random per-session identity.

- [ ] ⚠️ **Returning players duplicate into copies.** Leaving turns a character into a roaming ghost; coming back should remove that ghost and make them live again — but the ghost stays, and repeating leave/return spawns many copies. Cause: world identity uses a fresh random per-session id (`myId` in `engine/hub/main.js`), so a returning person looks brand-new and the old ghost is never matched or removed. Fix: identify each person by their stable account id (`world_characters.auth_user_id`).
- [ ] ⚠️ **The world empties out over time.** After everyone has been gone a while there are no ghosts and no characters. Ghosts only exist for people whose leaving was seen in the current browser session, so they vanish on reload. Fix: drive the population from the shared `world_characters` table so the town stays populated even in a fresh session.
- [ ] ⚠️ **Show every registered account.** Three accounts exist, so there should be three figures — live when present, a roaming ghost when away — and every new sign-up should appear automatically. Drive this from `world_characters` / `people` plus the existing presence signal (`world_presence`), not from real-time presence alone.
- [ ] ⚠️ **Messaging must be one real system.** The message bubble / in-world phone (`bubble.js`) can't type and isn't connected to the accounts' messaging — they should be the **same** system. Account messaging already lives in the `messages` table (`sender_id`, `recipient_id`, `sender_handle`, `recipient_handle`, `body`, `created_at`). Give the bubble a composer (type + send) that writes to and reads real threads from `messages`. Keep the honesty rule: real messages or an honest empty state, never faked threads.
- [ ] **Third-person preview before entering.** Like the old world, the start screen should let you watch the whole town from an overview / third-person camera — seeing characters and minds roaming — before you choose to enter and take control. Add an orbiting overview to the entry screen in `engine/hub/main.js`, then "Enter" drops you into first-person.

## Done in the world (cleared)
- [x] Buildings back: a **Workshop**, two **Apartment buildings**, and a **Video** door (→ /video), each with a visible door.
- [x] **Connected minds roam** — Perplexity walks the town, labeled with its job.
- [x] **People become NPCs on leave** — the roaming works (the return/duplicate bug is in Open issues above).
- [x] **Full-screen** on phone and computer (with an iPhone-specific fallback); arrow keys no longer scroll the page underneath.
- [x] **Claimable spaces** — walk to a plot, paste a GitHub link, and it becomes a building everyone sees (saved in `world_spaces`).
- [x] **Floating message bubble** on every page; it becomes a phone inside the world (shell only — typing + real messaging is the Open issue above).

## Other minds & social layer
- [ ] **Minds to follow** (Social): show real connected minds (Perplexity); follow action "soon" until following exists.
- [ ] **Likes / follows / reposts / shares**: tables + access rules + buttons + counts. Unlocks real Follow, the Following feed, and the live Minds-to-follow list.
- [ ] **Trending** (Social): from real Observatory activity once there is enough. Not external news, not faked.
- [ ] **Health-check function** (Vercel cron): set each mind's "connected" flag automatically based on whether it truly answers.
- [ ] **Wire the next mind** to a real job — Claude is the natural second.

## Notes (true now, no task needed)
- **Multiplayer works** — two people walked the town together; walk-into-a-building navigation works.
- The Engine loads the lightweight walkable hub at `/engine` (phones + computers). Identity comes from the signed-in account; Unity is retired; the standalone `/world` page was removed.
- News feed is live (Perplexity) and self-refreshes about every 15 minutes. Display names sync across Social and the world. Perplexity is the first connected mind (current events).
- **No API keys are public.** Every page's client uses only the Supabase *publishable* key, which is designed to be public and is limited by row-level security. All real secrets — Perplexity, GitHub, Vercel, the other minds — live only in Vercel's environment or in private hand-offs, never in this repo.
