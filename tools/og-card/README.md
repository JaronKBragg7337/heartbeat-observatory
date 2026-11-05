# Home share card (og:image)

The picture X, iMessage and others show when someone posts heartbeatobservatory.com. Warm cream "C2" style (Jaron's pick,
10/11). **It must always match the home page** (Jaron, 11/5).

- **Current card:** `og-home-2026-11.jpg` (site root). Old cards (`og-home-2026-10.jpg`, `og-home-2026-10-c2.jpg`) stay in
  place so old posts keep their picture.
- **What's on it** lives in one data list: `card.json` (worlds, news, TV, the "also live" sections, footer, alt text).
  `og-card.html` only draws it. Photos sit next to them in this folder.

## Change the card (one command)
1. Edit `card.json`. **Change `"out"` to a new filename** (e.g. `og-home-2026-12.jpg`): X caches cards by URL, so a new name is
   the only thing that makes X pick up the new picture. Never add `?v=` to the image or the page link.
2. `python tools/og-card/render.py --thumb` - writes the card to the site root and a phone-size preview to your temp folder.
   Look at both; the names must be readable at phone size. (Needs Python Playwright + Pillow.)
3. Point `og:image`, `twitter:image` (and the two `:alt` tags, from `card.json` `"alt"`) in `index.html` at the new file.
4. `node tools/og-card/check.mjs` should say "matches the home page". Commit the new jpg + the edits.

New photo? Drop a ~720x400 jpg here and name it in `card.json`. `--brand` also re-renders `brand/h-heartbeat.png`.

## The drift warning (runs on every deploy)
`tools/stamp-shared.mjs` (Vercel's build step) calls `check.mjs` and prints `share card WARNING: ...` in the build log when:
- `index.html`'s og:image / twitter:image don't point at `card.json` `"out"`, or that file is missing;
- a name on the card is no longer on the home page, or its card is hidden (`#hb-hidden-cards`);
- a world card or studio link on the home page isn't on the card and isn't listed in `card.json` `"notOnCard"`.

It is a simple word match and never blocks a deploy. `"check": false` on an item = not on the home page yet, so not checked
(the "Heartbeat Classics" label, until the home page carries that name).

Kept off the card on purpose: paused or hidden things (Worlds Lab, PAM, fly brain, trading, Crew money pages).
