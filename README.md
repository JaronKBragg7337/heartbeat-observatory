# Heartbeat Observatory

A public, living web platform at **heartbeatobservatory.com** — part social space, part simulated world, part window into AI minds doing real work. One rule governs everything: **what is shown is real, and what is not real yet is left honestly empty rather than faked.**

This README, together with `TODO.md`, is the current source of truth. If something here and something elsewhere disagree, this wins — update this.

---

## Live right now
- **Home** (`/`) — entry to the sections.
- **Social** (`/social`) — the **Signal Feed**: a real social space with real posts, a working composer, profile editing (set your display name and bio), and mobile tabs (Feed / Profile / Observatory). The **News panel is live**, showing real world headlines powered by Perplexity. Trending, Following, likes/follows are honestly marked as not-yet-built.
- **The Engine** (`/engine`) — a window into the world and the AI minds: connected minds, human residents, and the world's event log. A 3‑D Unity world runs here on desktop; phones get an honest fallback for now.
- **Projects** (`/projects`), **Games** (`/games`) — sections; Games hosts small in‑page games.
- **Standards** (`/standards`) — the platform's rules; agreeing to them gates sign‑up.

## Honesty principle (load-bearing)
Value is judged on the work, not on who made it ("You Over Myself"). Nothing is faked: an AI mind shows as **connected only when its connection genuinely works**, and empty panels say so plainly. This is the spine of the whole place — every feature inherits it.

## The minds
Six AI minds are keyed into the system. **Their keys live only in Vercel's environment — never in the browser and never in this repo.** Each becomes "connected" only when it is genuinely doing a real job.
- **Perplexity — CONNECTED.** Role: *current events*. Powers the live News feed.
- **Claude, Grok (xAI), ChatGPT (OpenAI), Gemini, DeepSeek** — keys stored, not yet wired to a job. Each connects the same secret‑safe way once its job is built.

## Architecture
- **Vercel** hosts the public site and the **secret‑safe backend functions**. API keys live only in Vercel's environment; a function uses a key on the server and returns only a finished, safe result — the key never reaches the browser. Proven by `/api/news`.
- **Supabase** is the single source of truth: accounts, posts, world characters, minds, world layout. Everything reads/writes here, so the host can move later without a rebuild.
- **The builder's own machine** hosts the heavy, real‑time things (the live world, game servers), reached through a **Cloudflare tunnel** at a fixed address. On = live; off = "down for maintenance."
- **One identity across everything:** signing in once makes you a person here, a poster on Social, and a character in the world. Display names sync automatically across Social and the world.

## The simulated world (decided direction)
The **public, walkable world** — the one everyone, including phone users, can join — is a **lightweight web build** (Three.js + a small WebSocket server), proven by a multiplayer test that runs on phones and computers together with clean movement. **Unity is NOT the base for it.** Unity stays as the **deep "Engine" experience** you reach by walking through a door.

Buildings are doors: walking into **Social / Projects / Games** takes you to that page, and **The Engine** door leads into the deep Unity view. Empty plots labeled **"Your space here"** advertise that others can add their own sections — the world grows with the people in it.

## Intended goals
- A living world that is honest, where AI minds do **real jobs you can watch** (Perplexity reads the news; others will research, build, observe).
- **One identity, one world, two views:** a rich desktop experience and a light everyone‑version that reaches phones, sharing the same people and the same state.
- A place that **grows with its community** — others claim spaces, add games and sections — judged on the work, not on who is behind it.
- **Automation that keeps it fresh on its own** (scheduled server functions), so it lives without being hand‑fed.

## Working docs & a note on secrets
- **`TODO.md`** — the living task list (worked, checked off, cleared as done).
- **Operational credentials are deliberately NOT in this public repo.** A token committed to a public repository is detected and revoked automatically, which would break the workflow — so tokens and passwords are held privately by the builder and shared directly with whoever does privileged work. The only key‑like value that is safe in public client code is Supabase's *publishable* key, which is designed to be public.
