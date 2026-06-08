# Heartbeat Observatory — To-Do

Living task list. Items get worked, checked off, and cleared when done, so this always shows only what is real and current.

## Open issues — fix next
No known Engine hub blockers from the latest walk-through are open. The next work is deeper identity, homes, social actions, and more connected minds without inventing content.

## Done in the world (cleared)
- [x] Buildings back: a **Workshop**, two **Apartment buildings**, and a **Video** door (→ /video), each with a visible door.
- [x] **Connected minds roam** — Perplexity walks the town, labeled with its job.
- [x] **People become ghosts on leave** — away residents keep roaming, and returning updates the same account-keyed character instead of duplicating.
- [x] **Full-screen** on phone and computer (with an iPhone-specific fallback); arrow keys no longer scroll the page underneath.
- [x] **Claimable spaces** — walk to a plot, paste a GitHub link, and it becomes a building everyone sees (saved in `world_spaces`).
- [x] **Account-keyed residents** — the world loads `world_characters`, keys people by `auth_user_id`, and shows each account live when present or as a roaming ghost when away.
- [x] **Saved character customization** — signed-in residents can choose a color and pattern that persists in `world_characters.appearance`.
- [x] **Guest mode** — visitors without accounts can enter live through realtime presence, but disappear when they leave and do not become permanent ghosts.
- [x] **Floating message bubble** on every page; it becomes a phone inside the world and uses the same real `messages` system as account messaging.
- [x] **Third-person start preview** — the entry screen watches the real town from an orbiting overview before Enter switches to first-person control.
- [x] **Town polish pass** — apartment doors work, world typing no longer steals spaces from text fields, benches face the square, and ground/path materials have subtle texture.
- [x] **Retired Unity path sealed** — `/engine/world` redirects to the phone-first Engine, with a fallback page explaining the move.
- [x] **GitHub space enrichment schedule** — GitHub Actions pings `/api/enrich-world-spaces` hourly, with a daily Vercel fallback cron; the server function reads public repo metadata and writes display-safe details through a secret-checked Supabase RPC.
- [x] **Claimed-space building styles** — claimed buildings now vary from real GitHub link/project metadata and can update when enrichment arrives.
- [x] **Public Projects polish** — Projects reads like a visitor-facing showcase instead of internal setup notes.

## World enrichment — next
- [ ] **Character wardrobe depth**: expand saved appearance beyond color/pattern into a small set of real selectable shapes or accessories.
- [ ] **Apartment destinations**: decide whether apartment doors should go to a real resident/home view, profile, or stay pointed at the main page until those homes exist.
- [ ] **Project-space detail doors**: let claimed buildings open the real GitHub repo and, when present, the real project homepage.
- [ ] **GitHub README summaries**: optionally enrich spaces with short, clearly source-backed README summaries. No fake screenshots or made-up project claims.

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
