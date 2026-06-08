# Heartbeat Observatory

A public, living web platform at **heartbeatobservatory.com** — part social space, part walkable world, part window into AI minds doing real work. One rule governs everything: **what is shown is real, and what is not real yet is left honestly empty rather than faked.**

This README, with `TODO.md`, is the current source of truth. If something here and something elsewhere disagree, this wins — update this.

## Live right now
- **Home** (`/`) — entry to the sections.
- **Social** (`/social`) — the **Signal Feed**: real posts, a working composer, profile editing, mobile tabs. The **News panel is live** (powered by Perplexity). Trending, Following, likes/follows are honestly marked not‑yet‑built.
- **The Engine** (`/engine`) — the **walkable sim world hub**: a 3‑D town you move around on a phone or computer, where **each building is a door** to another section. You **see other people move with you** in real time; when someone leaves, their character keeps **roaming as a ghost** and turns live again when they return; you can **claim an empty plot with a GitHub link** and it becomes a building everyone sees. A **message bubble** rides along on every page (and becomes a phone inside the world). The old desktop‑only Unity build is retired.
- **Projects** (`/projects`), **Games** (`/games`) — sections; Games hosts small in‑page games.
- **Standards** (`/standards`) — the platform's rules; agreeing gates sign‑up.

## Honesty principle (load-bearing)
Value is judged on the work, not on who made it ("You Over Myself"). Nothing is faked: an AI mind shows as **connected only when its connection genuinely works**, and empty panels say so plainly.

## The minds
Six AI minds are keyed into the system. **Their keys live only in Vercel's environment — never in the browser and never in this repo.** Each becomes "connected" only when genuinely doing a real job.
- **Perplexity — CONNECTED.** Role: *current events*. Powers the live News feed.
- **Claude, Grok (xAI), ChatGPT (OpenAI), Gemini, DeepSeek** — keys stored, not yet wired. Each connects the same secret‑safe way once its job is built.

## Architecture
- **Vercel** hosts the public site and the **secret‑safe backend functions**. API keys live only in Vercel's environment; a function uses a key on the server and returns only a finished, safe result — the key never reaches the browser. Proven by `/api/news`.
- **Supabase** is the single source of truth **and the live, real‑time layer**: accounts, posts, the minds, and the people moving around in the world all run through it.
- **One identity across everything:** signing in once makes you a person here, a poster on Social, and a character in the world. Display names sync automatically.
- **No always‑on personal machine is required.** The world is part of the site and its live presence runs through Supabase, so everything stays up on its own — no localhost, no tunnel, no laptop kept awake.

## The walkable world (the Engine's sim hub)
The Engine is a walkable 3‑D **hub** anyone can enter from a phone or a computer. You move around a small town; **each building is a door** — walk into one and it takes you straight to that section of the site (Social, Games, Projects, and any new section gets its own building). It is built as a **lightweight web world (Three.js), not Unity**: the old Unity build was desktop‑only, with a poor floor and players roaming off the map, so it was **retired and replaced**. Seeing other people move around with you runs through **Supabase**, the same system that already powers the rest of the site — no separate server, no localhost, no tunnel.

## Intended goals
- A living world that is honest, where AI minds do **real jobs you can watch**.
- **One identity, one world, on phone and computer**, sharing the same people and the same state.
- A place that **grows with its community** — new sections appear as new buildings; others claim spaces (**now live** — claim a plot with a GitHub link) — judged on the work, not on who is behind it.
- **Automation that keeps it fresh on its own** (scheduled server functions), so it lives without being hand‑fed.

## Open issues — to fix next
These are the live gaps as of the latest walk‑through. Files named are in this repo; tables named are in Supabase (its *publishable* key is the only public‑safe credential — see the secrets note below).

1. **Returning players duplicate into copies.** When a player leaves, their character becomes a roaming ghost; when they come back the ghost should vanish and they should be live again — instead the ghost stays, and repeating leave/return spawns many copies. Cause: world identity uses a fresh random per‑session id (`myId` in `engine/hub/main.js`), so a returning person looks like a brand‑new id and their old ghost is never matched or removed. Fix by identifying each person by their **stable account id** (`world_characters.auth_user_id`), not a per‑session id, so a return reliably removes their ghost and nothing duplicates.

2. **The world empties out over time.** After everyone has been gone a while there are no ghosts and no characters at all. Ghosts today exist only for people whose leaving was seen in the current browser session, so they disappear on reload. Fix by driving the world's population from the shared **`world_characters`** table, so the town stays populated even when you arrive to an otherwise empty session.

3. **Show every registered account.** Three accounts exist, so there should be three figures in the world — **live when that person is present, a roaming ghost when away** — and every new sign‑up should appear automatically. Drive this from **`world_characters` / `people`** plus the existing presence signal (`world_presence`), not from real‑time presence alone. (Issues 1–3 are really one change: the world's people come from accounts, keyed by `auth_user_id`; present = live, away = ghost.)

4. **Messaging must be one real system.** The message bubble / in‑world phone (`bubble.js`) currently has no way to type and is not connected to the accounts' messaging — they should be the **same** system. Account messaging already lives in the **`messages`** table (`sender_id`, `recipient_id`, `sender_handle`, `recipient_handle`, `body`, `created_at`). Give the bubble a composer (type + send) that writes to `messages` and reads real threads from it, so the bubble and the account inbox are one shared system — not two. Keep the honesty rule: show real messages or an honest empty state, never invented threads.

5. **Third‑person preview before entering.** Like the old world, the start screen should let you watch the whole town from an overview / third‑person camera — seeing characters and minds roaming — before you choose to enter and take control. Add an orbiting overview on the entry screen in `engine/hub/main.js`, then "Enter" drops you into first‑person control.

## Working docs & a note on secrets
- **`TODO.md`** — the living task list (worked, checked off, cleared as done).
- **Operational credentials are deliberately NOT in this public repo.** A token committed to a public repo is detected and revoked automatically, which would break the workflow — so tokens and passwords are held privately and shared directly with whoever does privileged work. The only key‑like value safe in public client code is Supabase's *publishable* key, which is designed to be public.
