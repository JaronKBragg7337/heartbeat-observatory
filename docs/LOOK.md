# LOOK — how worlds get their look (visual doctrine)
**Living document, June 11, 2026. Live-Reference clause applies: reality > this text.**
Consult this whenever Jaron asks for "realistic," "like downtown New York," "better
textures," "make it look alive," or any aesthetic upgrade.

## The principle (proven June 11, Marquee Row)
**Chase ALIVE, not realistic.** A photoreal texture is still frozen; a low-poly city
whose signs scroll real news and whose theater plays a real rocket launch feels more
alive than photorealism, because the motion is TRUE. Realism is expensive on phones;
aliveness is nearly free here, because the Observatory already runs the live systems
other worlds would have to fake. When "realistic" is requested, first ask: is the
real want MOTION + TRUTH on surfaces? It usually is.

## The toolbox (cheapest first)
1. **Procedural CanvasTextures** — facades, brick, posters, window grids (the kit's
   bread and butter; zero downloaded art, zero requests).
2. **Canvas TICKERS — the workhorse of "alive":** a canvas redrawn with scrolling
   text costs almost nothing and can show REAL Observatory data: the Perplexity news
   feed on a tower ticker, the social feed on a jumbotron, residents' names on a
   marquee. Real data, nothing faked, alive by definition.
3. **Shared video textures** — one <video> element projected onto one or MANY
   surfaces (same texture, offset UVs). For hero screens: theaters, one jumbotron.
   The proven pattern lives in worlds-lab/lib/v1/cinema.js.
4. **Light as paint** — emissive windows riding the day/night cycle, fog + tone
   mapping selling lamp glow without real lights, fireflies as one Points draw call.
   All proven in World 2.
5. **Hero models** — hand-built one-offs for the ~10 landmarks that carry a world's
   recognition (Fort Wayne doctrine). Everything else stays humble instanced boxes.

## Watch-fors (each has bitten or will)
- **Video decode budget:** phones run 1–3 <video> elements, never dozens. Times
  Square is one shared video + many canvas tickers, not thirty videos.
- **Pause what's far:** stop/swap media beyond hearing/seeing range (cinema.js
  already pauses on tab-hide; distance is the next gate).
- **CORS + autoplay:** sources need open CORS (Blender bucket, archive.org, NASA
  qualify); start playback from a user action; muted-first retry for phones —
  cinema.js handles all three, copy it rather than re-learn it.
- **Idle screens must SAY they're idle** ("walk to the projector to start") — an
  unlabeled black screen reads as broken. Honest empty states apply to pixels too.
- **Draw calls:** instancing + merged geometry; World 2's whole city is ~23 calls
  against a 300 budget. Every new surface idea answers "how many draw calls?"
- **Licensing:** media on surfaces is published content. Allowed: own data, NASA /
  public domain, CC with credit shown in-world (CREDITS.md trail). Never: ripped TV,
  logos, copyrighted footage. "TV news" = OUR news feed, not someone's broadcast.
- **Nothing faked:** a "live" sign renders live data or says it's a demo. A looping
  fake newscast would break the world's word.

## When realism IS the brief
Hero landmarks (recognition), materials on close-up interiors, character readability.
Even then: stylized + true-to-shape beats photoreal-and-heavy on this stack.
