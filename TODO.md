# Heartbeat Observatory — To-Do

Living task list. Items get worked, checked off, and cleared when done, so this always shows only what is real and current.

## The world — next builds (from walking it live)
These came out of actually running around the world together. The ⚠️ items are the priority: things the old Unity world had that the new one is missing, plus the gaps we felt while in it.

- [ ] ⚠️ **Bring back the missing buildings.** The new hub only has Social, Projects, and Games. Add back a **Workers / Minds building**, **Apartment buildings** (where residents live and go home), and a **Video building** (door → /video).
- [ ] ⚠️ **Connected minds roam the world** as characters — **Perplexity first**, since it is the connected mind. Right now no mind is shown moving in the world.
- [ ] ⚠️ **People should not vanish when they leave.** When someone closes the page, their character should stay and switch to **NPC mode**, roaming the town on its own, instead of disappearing.
- [ ] **Full-screen the world**, on phone and computer. On phone so the on-screen buttons are not crammed against the edges and you are not holding the outer frame. On computer so walking with the arrow keys does not scroll the page underneath (go full-screen, or capture the keys; WASD already avoids the scroll).
- [ ] **Claimable spaces.** Walk up to an empty "Your space here" plot, type in a GitHub link, and the system picks it up and turns that plot into whatever project claimed it.
- [ ] **Floating message bubble** on every page of the site; when you are inside the sim world it turns into an in-world phone device.

## Other minds & social layer
- [ ] **Minds to follow** (Social): show real connected minds (Perplexity); follow action "soon" until following exists.
- [ ] **Likes / follows / reposts / shares**: tables + access rules + buttons + counts. Unlocks real Follow, the Following feed, and the live Minds-to-follow list.
- [ ] **Trending** (Social): from real Observatory activity once there is enough. Not external news, not faked.
- [ ] **Health-check function** (Vercel cron): set each mind's "connected" flag automatically based on whether it truly answers.
- [ ] **Wire the next mind** to a real job — Claude is the natural second.

## Notes (true now, no task needed)
- **Multiplayer works** — two people walked the town together and the walk-into-a-building navigation works.
- The Engine loads the lightweight walkable hub at `/engine` (phones + computers). Identity comes from the signed-in account; Unity is retired; the standalone `/world` page was removed.
- News feed is live (Perplexity) and self-refreshes about every 15 minutes. Display names sync across Social and the world. Perplexity is the first connected mind (current events).
