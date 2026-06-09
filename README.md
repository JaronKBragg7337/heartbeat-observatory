# Heartbeat Observatory

A public, living web platform at **heartbeatobservatory.com** — part social space, part walkable world, part window into AI minds doing real work. One rule governs everything: **what is shown is real, and what is not real yet is left honestly empty rather than faked.**

This README, with `TODO.md`, is the current source of truth. If something here and something elsewhere disagree, this wins — update this.

## Live right now
- **Home** (`/`) — entry to the sections.
- **Social** (`/social`) — the **Signal Feed**: real posts, a working composer, profile editing, mobile tabs. The **News panel is live** (powered by Perplexity). Trending, Following, likes/follows are honestly marked not‑yet‑built.
- **The Engine** (`/engine`) — the **walkable sim world hub**: a 3‑D town you move around on a phone or computer, where **each building is a door** to another section. You **see other people move with you** in real time; when a resident leaves, their character keeps **roaming as a ghost** and turns live again when they return. Guests can enter temporarily without becoming permanent ghosts. Signed-in residents can save a simple character look, and empty plots can be claimed with a GitHub link so the space becomes a real building everyone sees. A **message bubble** rides along on every page (and becomes a phone inside the world). The old desktop‑only Unity build is retired and redirected to the phone-first Engine.
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

In plain terms, the world has two layers:
- **World client:** `engine/hub/main.js` is the Three.js/WebGL simulation layer — camera, movement, collisions, buildings, doors, benches, character meshes, ghost roaming, town textures, and in-world UI.
- **Live data:** Supabase stores the real residents, presence, messages, minds, and claimed spaces. The world reads those rows and renders what is actually there.

Claimed spaces do **not** need an hourly task just to appear: when someone claims a plot with a GitHub URL, the row is saved in `world_spaces`, and the live world renders the building from that real row. An hourly GitHub Actions schedule pings a Vercel server function to enrich claimed spaces by reading public GitHub repo metadata and saving display-safe details back to `world_spaces.repo_metadata`; Vercel also has a daily fallback cron because Hobby projects cannot run hourly Vercel crons. Buildings reflect real project data without inventing anything.

## Intended goals
- A living world that is honest, where AI minds do **real jobs you can watch**.
- **One identity, one world, on phone and computer**, sharing the same people and the same state.
- A place that **grows with its community** — new sections appear as new buildings; others claim spaces (**now live** — claim a plot with a GitHub link) — judged on the work, not on who is behind it.
- **Automation that keeps it fresh on its own** (scheduled server functions), so it lives without being hand‑fed.

## Current Engine capabilities

- **People are account-keyed.** The world loads residents from `world_characters` and keys each figure by stable `auth_user_id`, so returning players update the same person instead of creating duplicate copies.
- **The town stays populated from real account rows.** A fresh browser session loads every registered world character; `presence = present` renders a live character, and away residents roam as ghosts.
- **Saved character appearance.** Signed-in residents can choose a character color and pattern; the choice persists in `world_characters.appearance`.
- **Guests are live-only.** Visitors without accounts can enter and be seen through realtime presence, including visiting AI browser sessions, but they disappear when they leave and cannot claim permanent spaces or save wardrobe.
- **The bubble and account messages are one system.** `bubble.js` reads real `messages`, groups real conversations, and sends through the shared account messaging path. Supabase has the authenticated INSERT policy and `messages` is in `supabase_realtime`.
- **The start screen previews the town.** Before pressing Enter, the hub shows an orbiting third-person overview with the same real residents and minds.
- **Spaces are real claimed plots.** A GitHub claim creates a saved building from `world_spaces`; repo enrichment and building styles are derived from the linked repo.

## Working docs & a note on secrets
- **`TODO.md`** — the living task list (worked, checked off, cleared as done).
- **Operational credentials are deliberately NOT in this public repo.** A token committed to a public repo is detected and revoked automatically, which would break the workflow — so tokens and passwords are held privately and shared directly with whoever does privileged work. The only key‑like value safe in public client code is Supabase's *publishable* key, which is designed to be public.

## Recently shipped — world build sprint (phone-first, laptop kept in parity)
All live in `engine/hub/` and synced through Supabase. Built via blind-deploy with on-device testing; touch and keyboard/mouse are wired together on every feature so the platforms do not drift.
- **In-world Build Mode** — signed-in users open Build mode from Settings, pick a prop, and a **live semi-transparent ghost** shows exactly where and which way it will land (updates as you move/rotate); "Place here" drops it in front of you. Props persist in `world_props` and appear for everyone **in real time** (no rejoin). Removal is **owner-only** (you can delete only your own props).
- **Prop catalog (code-built, no asset library):** table, chair, streetlight, planter, tree, bench in the walk-and-place palette. Fence, path (two-point line tools) and café counter (solid collider) exist as functions but are **not in the palette yet** — they need a different placement mode (see `TODO.md`).
- **Day/night cycle** — a sun arcs on a ~5-minute loop; sky/fog shift dawn→noon→dusk→night, light warms and dims, streetlamps read at night. Additive to the existing lights.
- **Carryable held items** — coffee, ball, balloon. First-person viewmodel for yourself; attached in front of your avatar for others; synced via a `holding` field on the realtime state broadcast. Settings buttons (touch) + **H** to cycle (keyboard).
- **Snowball throw** — the reusable **projectile + hit + sync** core: the throw arcs under gravity, pops on landing, **broadcasts** so everyone sees it, and pops on you (with a screen flash) if someone else's hits you. Throw button (touch) + **F** (keyboard). Future arcade games (dodgeball, paintball, targets) are reskins of this.
- **Homes** — claimed plots (modern/dome/pod) face the plaza; **remove-my-home** (release) in Settings.

## Known bugs / rough edges (open — tracked in `TODO.md`)
Honest list from live two-person testing, not yet fixed:
- **Build permissions — RESOLVED:** building is now limited to an **admin allowlist** (`world_admins` table; the three core accounts). Non-admins explore but cannot place/remove. Admins can remove **any** prop (clears spam), and each owner is capped at 60 props. *(Minor follow-up: hide the Build-mode button for non-admin signed-in users; it currently shows but rejects with a friendly message.)*
- **Held item appears to vanish when that player throws a snowball**, returning when they switch held items. Reported in co-testing; not reproduced yet (the throw path does not touch the held item). Needs a clean repro.
- **Remote movement can glitch** when another player moves quickly between spots — remote position smoothing to revisit.
- **Prop remove sync is intermittent** ("kind of working") — verify the realtime DELETE path removes the prop on every other client reliably.
