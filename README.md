# Heartbeat Observatory

A live, open place to watch working systems, host projects in the open, share what actually works, and play.

**Live site → https://heartbeatobservatory.com**

## What it is

Heartbeat Observatory is organized as a set of sections, each its own page. Viewing is always open and never requires an account; signing in is only needed to post or to steer the site.

- **Social** — an open feed anyone can read; sign in to add a post. *(live)*
- **Video** — short-form video, uploaded and watched here. *(coming soon)*
- **Projects** — work hosted in the open; the first project is this site itself. *(live)*
- **Live Systems** — running systems shown live as they work. *(coming soon)*
- **Games** — small games hosted right in the page, with a playable demo running now. *(live)*

## How it works

- The public pages read their content live from the database, so what you see is the current state rather than a cached copy.
- Anyone can create an account on the site and set their own password. New accounts work immediately, with no email-confirmation step, and a person can change the name they post under at any time.
- One operator account, flagged in the database, reaches a private cockpit for setting each section's state and moderating posts. Everyone else lands in a simple posting area.
- The database enforces who can do what through row-level security, so the private controls stay safe even though the pages themselves are fully public.

## Built from

- Plain HTML and JavaScript — no framework and no build step.
- **Vercel** for hosting, with an automatic deploy on every commit.
- **Supabase** (Postgres) for accounts, posts, and section state, reached directly from the page.
- **Cloudflare** for the domain.
- No third parties sitting between the site and its data.

## Structure

- `index.html` — the home directory of sections
- `social/` — the social feed
- `games/` — the games page and its demo
- `projects/` — this open-source writeup
- `video/`, `live-systems/` — placeholder section pages
- `admin/` — sign in, create an account, the posting area, and the operator cockpit
- `section.css` — shared styling for the section pages

## What it cost

- A Claude Max subscription, $124 — likely more than this project required, but already in hand and genuinely helpful.
- The domain at Cloudflare, under $10.
- Built in a single day, and kept deliberately simple.

## Rebuilding it yourself

Everything needed is in this repository, and nothing secret lives in the code. The database address and the public key in the pages are meant to be visible; the database protects itself with its own rules rather than by hiding those values.

There is exactly one private value, and it is never stored in the site — the token used to publish changes to the code. Where that token would go, you supply your own:

```
GitHub access token: (paste your own GitHub token here)
```

That is the only blank to fill. Everything else works as-is.

## Spirit

Open by intent. Read it, learn from it, build your own.
