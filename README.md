# Heartbeat Observatory

A public, living web platform at **heartbeatobservatory.com** — part social space, part walkable world, part window into AI minds doing real work. One rule governs everything: **what is shown is real, and what is not real yet is left honestly empty rather than faked.**

This README, with `TODO.md`, is the current source of truth. If something here and something elsewhere disagree, this wins — update this.

## Live right now
- **Home** (`/`) — entry to the sections.
- **Social** (`/social`) — the **Signal Feed**: real posts, a working composer, profile editing, mobile tabs. The **News panel is live** (powered by Perplexity). Trending, Following, likes/follows are honestly marked not‑yet‑built.
- **The Engine** (`/engine`) — the **walkable sim world hub**: a 3‑D town you move around in, where each building is a door to another section. It now runs as the lightweight web hub on phones and computers, having replaced the old desktop‑only build onto a new lightweight web world build. The old Unity build is retired.
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
- A place that **grows with its community** — new sections appear as new buildings; others claim spaces — judged on the work, not on who is behind it.
- **Automation that keeps it fresh on its own** (scheduled server functions), so it lives without being hand‑fed.

## Working docs & a note on secrets
- **`TODO.md`** — the living task list (worked, checked off, cleared as done).
- **Operational credentials are deliberately NOT in this public repo.** A token committed to a public repo is detected and revoked automatically, which would break the workflow — so tokens and passwords are held privately and shared directly with whoever does privileged work. The only key‑like value safe in public client code is Supabase's *publishable* key, which is designed to be public.
