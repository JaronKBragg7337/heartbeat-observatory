# Heartbeat News — the daily writer's job

Runs every morning after 9:30 AM (America/Indiana/Indianapolis), after the Codex (7:30) and DeepSeek (9:00) watch
writers have filed. One run = one episode file. The page picks it up within ten minutes of the deploy and swaps to it
at the next story break; until then it keeps looping the last show.

## Steps
1. Today's date in America/Indiana/Indianapolis = `D` (YYYY-MM-DD).
2. Read the day's captures from the public watch repo: `git clone --depth 5 https://github.com/JaronKBragg7337/watch`
   then `codex/D.md`, `deepseek/D.md`, `claude/D.md` (whichever exist; Claude's usually lands in the afternoon, so a
   morning run often has Codex + DeepSeek only). Also read `FORMAT.md` once so the labels make sense.
   If none of the three exist for `D`, stop: write nothing, push nothing. The page keeps looping the last show.
3. Write `news/episodes/D.json` in this repo. Copy the shape of the newest file in `news/episodes/` exactly.
4. Update `news/episodes/index.json`: `latest` = `D`, and add `D` to the front of `episodes`.
5. Run `node news/tools/check-episode.mjs news/episodes/D.json`. Fix every ERROR. Read the warnings.
6. Commit only those two files as `news: episode D` and push to `main`. If the push fails, retry up to 4 times
   (2 s, 4 s, 8 s, 16 s); if it still fails, say why in the run output.

## What goes in the show
- **Every story comes from the captures.** No outside facts, no invented numbers. A capture's `[claim]` stays a claim on
  air ("Reuters quotes...", "that is a claim"), and the segment's `status` is `claim` or `mixed`. `[observed]` = `observed`.
  `[theory]` items stay out, or are said plainly as a pattern someone is watching.
- **Sources:** each story's `sources` are the URLs the capture cites for it (name them by outlet).
- **Length follows the news.** One segment per story worth telling. A thin day is 5-7 segments; a big day 12-18.
  2-6 lines per segment. Lead with the biggest story of the day. Group small items (e.g. a "Tech" or "Hometown" block).
- **Fixed segments:** `open` first (Vex greets, Joe names the day, a two-line tease), a `wire` segment near the end
  (leave `lines: []`; the page fills it from the live Perplexity headlines), `close` last (sign-off, "new show after
  nine thirty"). Use `kind: "breaking"` for at most one story that broke in the last 24 h. `weather` and `sports`
  kinds get their own colours on the wall.
- **Indiana / Fort Wayne (domain 11) gets its own segment** whenever the captures have anything there.
- **Domains 09 and 10** (market resolution rules, catalysts) are for the traders; mention only if it is real news.

## How it should read
- Two hosts. **AI Robot Vex**: precise, numbers-first, dry; a rare one-line robot aside. **Alien Joe**: plain-spoken,
  an outsider noticing what humans do; warmth, the occasional wry line. Straight news. No jokes on deaths, disease or
  disasters. Alternate who speaks; either can lead a story.
- **Written for the ear.** Short sentences. Spell numbers the way they should be said ("six dollars and fifty-three
  cents", "one hundred five", "twenty twenty-six"). Write A.I., C.D.C., F.D.A. with periods so the synth spells them.
  Digits and symbols are fine in `strap`, `graphic` and `ticker`, which are read by eye.
- `strap`: the lower-third headline, ALL CAPS, under ~60 characters. `graphic`: `kicker`, `title`, up to 4 `stats`
  (`label`/`value`), up to 4 `bullets` — this is what the LED wall shows. `ticker`: 10-15 ALL-CAPS one-liners.
- `shot` on a line is optional (`wide`, `two`, `vex`, `joe`, `wall`); the director picks the rest.
- `writer`: say which job wrote it (e.g. "Claude, daily news job"). `sources` (episode level): the capture files you read, with URLs.
