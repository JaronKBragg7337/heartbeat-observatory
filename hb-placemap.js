// hb-placemap.js - the shared place map for the walkable worlds (Town Square, World 2, Ashgrove, and the ones after).
// Jaron 11/5: "AIs that read the code know where the buildings are, but humans can't find them unless they wander."
// One small map button. Tap it: a full-screen top-down map of the world with an icon on every place that does
// something. Tap an icon: its name, one line on what's there, and two choices:
//   "Show me the way" - a route on the map, a marker in the world and a small arrow chip. YOU walk there.
//   "Open now"        - opens the place's page right away, for people who don't want to walk.
// Firm rules: the map NEVER moves the player (no tap-to-walk). Nothing permanent on screen but the one button
// (the route chip only shows while a route is on). The same icon means the same thing in every world.
//
// Each world hands over ONE place list, read live from the same data its doors use, so a new door shows up here
// by itself. Usage:
//   import { createPlaceMap } from "/hb-placemap.js?v=...";
//   const pm = createPlaceMap({
//     world: "Ashgrove",                          // title on the map
//     bounds: { x0, x1, z0, z1 },                 // world metres the map covers (x to the right, z down the screen)
//     drawBase(ctx, toPx, pxPerM, C) {},          // draw streets/buildings/water once (C = the shared palette)
//     places() { return [{ id, icon, name, blurb, x, z, open }] },  // open: a URL, a function, or null
//     player() { return { x, z, yaw } | null },   // null = indoors / not in the world yet (no "you are here")
//     route(ax, az, bx, bz) { return [[x, z], ...] },   // optional street route; default = straight line
//     enabled() { return true },                  // the button shows only while this is true
//     trigger: element,                           // optional: use this element (World 2's minimap) instead of a button
//     buttonPos: { top: "64px", right: "8px" },   // where the button and the route chip sit
//     onGuide(g) {}, onGuideEnd() {},              // optional: put/remove a beacon in the 3D world
//     groundPath(pts) {},                         // optional: draw the route on the ground ([[x, z], ...] from you to the
//                                                 //   place, or null to hide it). threeGroundPath() below does it for three.js.
//     content: { x0, x1, z0, z1 },                // optional: where the town really is (the map opens fitted to it and
//                                                 //   never zooms out past it); default = bounds
//     outside: "#15120e",                         // optional: what shows past the edge of the drawn map
//     onOpen() {}, onClose() {},                  // optional: stop walking input while the map is up
//   });
//   pm.open(), pm.close(), pm.guideTo(place), pm.clearGuide(), pm.guide -> { id, name, x, z, path } | null
//
// The route chip reads like directions (Jaron 11/5: "the arrow wants me to go to random corners"):
//   close to the place (under ~35 m) or in plain sight -> the arrow points straight at the place: "Sparks Hall · 43 m"
//   otherwise -> "Turn left at the corner" / "Turn right at the corner" (or "Go straight, then turn left" while that
//   corner is still far down the street), the arrow at that corner, and the distance always to the PLACE, never the corner.
//   The route you are walking is kept (not re-picked every half second), so the corner ahead does not jump about.

const CSS = `
.hbpm-btn{position:fixed;z-index:80;width:48px;height:48px;border-radius:14px;border:1px solid rgba(255,236,206,.28);
  background:rgba(28,24,20,.86);color:#f6ead6;display:none;align-items:center;justify-content:center;padding:0;cursor:pointer;
  box-shadow:0 4px 16px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);touch-action:manipulation;
  -webkit-tap-highlight-color:transparent}
.hbpm-btn.on{display:flex}
.hbpm-btn svg{width:26px;height:26px}
.hbpm-btn:active{background:rgba(70,58,44,.92)}
.hbpm-chip{position:fixed;z-index:80;display:none;align-items:center;gap:0;max-width:min(310px,calc(100vw - 24px));height:40px;
  border-radius:999px;background:rgba(28,24,20,.9);border:1px solid rgba(132,214,152,.75);color:#eafbe9;
  font:700 13px/1 system-ui,-apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);overflow:hidden;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.hbpm-chip.on{display:flex}
.hbpm-chip.two{height:46px;border-radius:23px}
.hbpm-chip button{all:unset;cursor:pointer;height:100%;display:flex;align-items:center;-webkit-tap-highlight-color:transparent}
.hbpm-chip .go{gap:8px;padding:0 6px 0 10px;min-width:0}
.hbpm-chip .go span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hbpm-chip .go span b{display:block;font-weight:800;font-size:13.5px;line-height:1.15;overflow:hidden;text-overflow:ellipsis}
.hbpm-chip .go span small{display:block;font-weight:600;font-size:12px;line-height:1.2;color:#c6e8cc;overflow:hidden;text-overflow:ellipsis}
.hbpm-chip .arrow{width:22px;height:22px;flex:none;transition:transform .2s linear}
.hbpm-chip .x{width:40px;justify-content:center;border-left:1px solid rgba(255,255,255,.14);font-size:16px;color:#cfe7d2}
.hbpm{position:fixed;inset:0;z-index:95000;display:none;flex-direction:column;background:#1b1712;color:#f6ead6;
  font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-user-select:none;user-select:none;touch-action:none}
.hbpm.on{display:flex}
.hbpm-head{flex:none;display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 10px calc(16px + env(safe-area-inset-left));
  border-bottom:1px solid rgba(255,236,206,.12)}
.hbpm-title{flex:1;min-width:0}
.hbpm-title b{display:block;font-size:17px;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hbpm-title small{display:block;color:#bfae95;font-size:12.5px}
.hbpm-hb{all:unset;box-sizing:border-box;height:44px;min-width:44px;padding:0 14px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:7px;
  border:1px solid rgba(255,236,206,.2);background:rgba(255,236,206,.06);color:#f6ead6;font:600 14px system-ui,-apple-system,sans-serif;cursor:pointer;
  -webkit-tap-highlight-color:transparent}
.hbpm-hb:active,.hbpm-hb.on{background:rgba(255,236,206,.16)}
.hbpm-hb svg{width:20px;height:20px}
.hbpm-body{position:relative;flex:1;min-height:0;overflow:hidden}
.hbpm-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
.hbpm-icons{position:absolute;inset:0;pointer-events:none}
.hbpm-ic{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;padding:0;border:0;background:none;cursor:pointer;
  pointer-events:auto;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.hbpm-ic i{position:absolute;left:5px;top:5px;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  border:2px solid #fff8ec;box-shadow:0 2px 8px rgba(0,0,0,.45);color:#fff}
.hbpm-ic.small i{left:9px;top:9px;width:26px;height:26px;border-width:1.5px}
.hbpm-ic i svg{width:19px;height:19px}
.hbpm-ic.small i svg{width:15px;height:15px}
.hbpm-ic.sel i{transform:scale(1.22);box-shadow:0 0 0 4px rgba(255,214,120,.55),0 3px 10px rgba(0,0,0,.5)}
.hbpm-ic em{position:absolute;left:50%;top:41px;transform:translateX(-50%);white-space:nowrap;font:700 11.5px/1 system-ui,-apple-system,sans-serif;font-style:normal;
  color:#fff8ec;padding:3px 6px;border-radius:6px;background:rgba(27,23,18,.82);pointer-events:none}
.hbpm-ic em.off{display:none}
.hbpm-you{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}
.hbpm-you b{position:absolute;left:-20px;top:-20px;width:40px;height:40px;border-radius:50%;background:rgba(110,180,255,.28)}
.hbpm-you svg{position:absolute;left:-13px;top:-14px;width:26px;height:28px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))}
.hbpm-me{position:absolute;right:calc(12px + env(safe-area-inset-right));bottom:calc(14px + env(safe-area-inset-bottom))}
.hbpm-zoom{position:absolute;right:calc(12px + env(safe-area-inset-right));bottom:calc(66px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px}
.hbpm-body .hbpm-hb{background:rgba(27,23,18,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:0;width:44px}
.hbpm-sheet{position:absolute;left:0;right:0;bottom:0;display:none;padding:16px calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left));
  background:#241f19;border-top:1px solid rgba(255,236,206,.18);border-radius:18px 18px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.4);z-index:3}
.hbpm-sheet.on{display:block}
.hbpm-sheet .top{display:flex;align-items:center;gap:12px}
.hbpm-sheet .top i{flex:none;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff8ec;color:#fff}
.hbpm-sheet .top i svg{width:24px;height:24px}
.hbpm-sheet h3{margin:0;font-size:18px;line-height:1.2}
.hbpm-sheet p{margin:3px 0 0;color:#d6c6ad;font-size:14px}
.hbpm-sheet .dist{color:#bfae95;font-size:12.5px;margin-top:2px}
.hbpm-sheet .acts{display:flex;gap:10px;margin-top:14px}
.hbpm-sheet .acts button{all:unset;box-sizing:border-box;flex:1;height:50px;border-radius:13px;display:flex;align-items:center;justify-content:center;gap:8px;
  font:700 15px system-ui,-apple-system,sans-serif;cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent}
.hbpm-sheet .acts .way{background:#84d698;color:#10261a}
.hbpm-sheet .acts .now{background:rgba(255,236,206,.1);border:1px solid rgba(255,236,206,.3);color:#f6ead6}
.hbpm-sheet .acts button:active{filter:brightness(.9)}
.hbpm-sheet .acts svg{width:19px;height:19px}
.hbpm-sheet .shut{all:unset;position:absolute;right:calc(8px + env(safe-area-inset-right));top:8px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;
  color:#bfae95;font-size:20px;cursor:pointer}
.hbpm-list{position:absolute;inset:0;display:none;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:#1b1712;z-index:4;
  padding:6px calc(10px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left))}
.hbpm-list.on{display:block}
.hbpm-list h4{margin:14px 8px 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#bfae95}
.hbpm-list button{all:unset;box-sizing:border-box;width:100%;min-height:58px;display:flex;align-items:center;gap:12px;padding:8px 8px;border-radius:12px;cursor:pointer;
  -webkit-tap-highlight-color:transparent}
.hbpm-list button:active{background:rgba(255,236,206,.08)}
.hbpm-list button i{flex:none;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff8ec;color:#fff}
.hbpm-list button i svg{width:19px;height:19px}
.hbpm-list button b{display:block;font-size:15px}
.hbpm-list button small{display:block;color:#bfae95;font-size:13px;line-height:1.3}
.hbpm-list button .m{margin-left:auto;flex:none;color:#bfae95;font-size:12.5px;padding-left:8px}
@media (min-width:760px){
  .hbpm-sheet{left:auto;right:16px;bottom:16px;width:380px;border-radius:18px;border:1px solid rgba(255,236,206,.18)}
  .hbpm-sheet.on~.hbpm-me,.hbpm-sheet.on~.hbpm-zoom{right:412px}
  .hbpm-list{left:auto;width:400px;border-left:1px solid rgba(255,236,206,.12);box-shadow:-10px 0 30px rgba(0,0,0,.35)}
}
`;

// One palette for every world's map, so the three maps read as one design.
export const PALETTE = {
  ground: "#3b4a35", grass: "#4f6a44", park: "#5c7e4b", water: "#3e6f8c", road: "#2c2c2e", roadLine: "#55524c",
  walk: "#b6ab96", plaza: "#c9bc9f", block: "#a59a86", building: "#e7dcc6", buildingEdge: "#8a7f6c", shadow: "rgba(0,0,0,.18)",
  label: "#f6ead6", labelDim: "#d8cbb4", route: "#84d698", routeEdge: "#0f2416", me: "#ffffff",
};

// Icons: one look per kind of place, the same in every world. 24x24, drawn with lines (stroke = currentColor).
const P = (d) => `<path d="${d}"/>`;
const ICONS = {
  theater: { c: "#c2463e", g: "Theater", s: P("M3 8h18v11H3z") + P("M3 8l3-4M9 8l3-4M15 8l3-4") + P("M7 12h10") },
  arcade: { c: "#7a4fd0", g: "Games", s: P("M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4z") + P("M7 11.5v3M5.5 13h3") + P("M16 12h.01M18 14h.01") },
  library: { c: "#8a5a2b", g: "Library", s: P("M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z") + P("M4 20a2 2 0 0 0 2 2h13v-4") + P("M9 7h6") },
  news: { c: "#3a6ea5", g: "News", s: P("M4 5h13v14H6a2 2 0 0 1-2-2z") + P("M17 9h3v8a2 2 0 0 1-2 2") + P("M7 8h7M7 12h7M7 15h4") },
  tv: { c: "#2a8a9a", g: "TV", s: P("M3 7h18v12H3z") + P("M8 3l4 4 4-4") + P("M10 11l4 2-4 2z") },
  studio: { c: "#b8325a", g: "Studio", s: P("M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z") + P("M5 11a7 7 0 0 0 14 0") + P("M12 18v3M9 21h6") },
  sparks: { c: "#c08a1e", g: "Sparks", s: P("M12 2l2.6 6.4L21 9l-5 4.3L17.5 20 12 16.5 6.5 20 8 13.3 3 9l6.4-.6z") },
  social: { c: "#d0663a", g: "Social", s: P("M4 5h12v8H9l-4 3v-3H4z") + P("M16 9h4v8h-1v3l-4-3h-4v-2") },
  projects: { c: "#4f7d3a", g: "Projects", s: P("M3 13h8v8H3zM13 13h8v8h-8zM8 3h8v8H8z") },
  station: { c: "#4a5a8a", g: "Station", s: P("M6 3h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2z") + P("M4 10h16") + P("M8 14h.01M16 14h.01") + P("M8 18l-2 3M16 18l2 3") },
  worlds: { c: "#3d7f86", g: "Worlds", s: P("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z") + P("M3 12h18") + P("M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18") },
  home: { c: "#7d6a55", g: "Home", s: P("M3 11l9-7 9 7") + P("M5 10v10h14V10") + P("M10 20v-5h4v5") },
  lot: { c: "#6f8a3a", g: "Open lot", s: P("M6 21V4") + P("M6 4h11l-2.5 4L17 12H6") },
  post: { c: "#a0452e", g: "Post", s: P("M3 6h18v12H3z") + P("M3 7l9 6 9-6") },
  diner: { c: "#b0612a", g: "Diner", s: P("M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z") + P("M16 10h1.5a2.5 2.5 0 0 1 0 5H16") + P("M8 3v3M11 3v3M14 3v3") },
  school: { c: "#5a6e2e", g: "School", s: P("M2 9l10-5 10 5-10 5z") + P("M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5") + P("M22 9v6") },
  store: { c: "#9a6a2a", g: "Store", s: P("M4 9l1.5-5h13L20 9") + P("M4 9h16v2a3 3 0 0 1-5.3 2A3 3 0 0 1 12 14a3 3 0 0 1-2.7-1A3 3 0 0 1 4 11z") + P("M5 14v7h14v-7") },
  music: { c: "#6a4f9a", g: "Music", s: P("M9 18V5l11-2v13") + P("M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z") },
  place: { c: "#6a7480", g: "Place", s: P("M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z") + P("M12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z") },
};
// the order the list (and label priority) uses
const ORDER = ["theater", "arcade", "library", "news", "tv", "studio", "sparks", "social", "projects", "worlds", "station", "post", "diner", "school", "store", "music", "home", "lot", "place"];
const GROUPS = [["Watch and play", ["theater", "arcade", "tv", "music"]], ["Read and make", ["library", "news", "studio", "sparks", "school"]],
  ["People", ["social", "post", "diner", "store", "home"]], ["Build and travel", ["projects", "lot", "worlds", "station", "place"]]];
const svg = (inner, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export function iconSVG(kind) { return svg((ICONS[kind] || ICONS.place).s); }
export function iconColor(kind) { return (ICONS[kind] || ICONS.place).c; }
const MAP_SVG = svg(P("M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z") + P("M9 4v14M15 6v14"));
const LIST_SVG = svg(P("M8 6h13M8 12h13M8 18h13") + P("M3.5 6h.01M3.5 12h.01M3.5 18h.01"), 2.2);
const ME_SVG = svg(P("M12 2v3M12 19v3M2 12h3M19 12h3") + P("M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"));
const WALK_SVG = svg(P("M13 4a1.5 1.5 0 1 0 0 .01") + P("M10 21l2-6 3 3v3M9 12l1-4 4 1 2 3h3M10 8l-3 3"));
const OPEN_SVG = svg(P("M14 4h6v6M20 4l-9 9") + P("M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"));
const ARROW_SVG = `<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 18-7-4-7 4z" fill="#84d698" stroke="#0f2416" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function createPlaceMap(cfg) {
  const o = Object.assign({ world: "Map", arrive: 3.2, buttonPos: { top: "calc(env(safe-area-inset-top) + 64px)", right: "calc(env(safe-area-inset-right) + 10px)" },
    enabled: () => true, player: () => null, places: () => [], route: null, maxZoom: 6, near: 35, outside: "#15120e" }, cfg);
  if (!document.getElementById("hbpm-css")) { const st = document.createElement("style"); st.id = "hbpm-css"; st.textContent = CSS; document.head.appendChild(st); }
  const B = o.bounds, bw = B.x1 - B.x0, bh = B.z1 - B.z0;
  // the part of the map that is really the town: the map opens fitted to it and never zooms out past it
  const CB = o.content || B, cw = CB.x1 - CB.x0, ch = CB.z1 - CB.z0;

  // ---- the button (or the world's own trigger, e.g. World 2's minimap) + the route chip ----
  let btn = o.trigger || null;
  if (!btn) {
    btn = document.createElement("button"); btn.type = "button"; btn.className = "hbpm-btn"; btn.innerHTML = MAP_SVG;
    btn.setAttribute("aria-label", "Map: where every place is"); btn.id = "hbpmButton";
    Object.assign(btn.style, o.buttonPos); document.body.appendChild(btn);
  }
  btn.addEventListener("click", (e) => { e.stopPropagation(); open(); });
  const chip = document.createElement("div"); chip.className = "hbpm-chip"; chip.id = "hbpmChip";
  chip.innerHTML = `<button type="button" class="go" aria-label="Open the map with your route">${ARROW_SVG}<span></span></button><button type="button" class="x" aria-label="Stop showing the way">&#x2715;</button>`;
  const chipPos = o.chipPos || (o.trigger ? null : { top: `calc(${o.buttonPos.top} + 56px)`, right: o.buttonPos.right });
  if (chipPos) Object.assign(chip.style, chipPos);
  (o.chipParent || document.body).appendChild(chip);
  chip.querySelector(".go").addEventListener("click", (e) => { e.stopPropagation(); open(); });
  chip.querySelector(".x").addEventListener("click", (e) => { e.stopPropagation(); clearGuide(); });
  for (const el of [btn, chip]) for (const ev of ["pointerdown", "touchstart", "mousedown"]) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  // ---- the full-screen map ----
  const root = document.createElement("div"); root.className = "hbpm"; root.id = "hbpm"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", o.world + " map");
  root.innerHTML = `
    <div class="hbpm-head">
      <div class="hbpm-title"><b>${esc(o.world)}</b><small>Tap a place to find it</small></div>
      <button type="button" class="hbpm-hb list-btn" aria-label="List of places">${LIST_SVG}<span>Places</span></button>
      <button type="button" class="hbpm-hb close-btn" aria-label="Close the map">&#x2715;</button>
    </div>
    <div class="hbpm-body">
      <canvas class="hbpm-canvas"></canvas>
      <div class="hbpm-icons"></div>
      <div class="hbpm-sheet" role="region" aria-label="Place">
        <button type="button" class="shut" aria-label="Close this place">&#x2715;</button>
        <div class="top"><i></i><div><h3></h3><p></p><div class="dist"></div></div></div>
        <div class="acts"><button type="button" class="way">${WALK_SVG}<span>Show me the way</span></button><button type="button" class="now">${OPEN_SVG}<span>Open now</span></button></div>
      </div>
      <div class="hbpm-zoom"><button type="button" class="hbpm-hb zin" aria-label="Zoom in">+</button><button type="button" class="hbpm-hb zout" aria-label="Zoom out">&minus;</button></div>
      <button type="button" class="hbpm-hb hbpm-me" aria-label="Show where I am">${ME_SVG}</button>
      <div class="hbpm-list" role="list" aria-label="Places"></div>
    </div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const meEl = document.createElement("div"); meEl.className = "hbpm-you"; meEl.setAttribute("aria-label", "You are here"); meEl.setAttribute("role", "img");
  meEl.innerHTML = `<b></b><svg viewBox="-12 -14 24 26" aria-hidden="true"><path d="M0 -12 L8.5 9 L0 4.5 L-8.5 9 Z" fill="#4aa3ff" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  root.querySelector(".hbpm-icons").after(meEl);
  const body = $(".hbpm-body"), cv = $(".hbpm-canvas"), iconsEl = $(".hbpm-icons"), sheet = $(".hbpm-sheet"), listEl = $(".hbpm-list"), listBtn = $(".list-btn");
  for (const ev of ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "touchend", "mousedown", "mouseup", "wheel", "keydown"]) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== "wheel" && ev !== "touchmove" });

  let isOpen = false, places = [], sel = null, guide = null, base = null, baseRes = 1, view = null, raf = 0;
  let W = 0, H = 0, dpr = 1;

  // ---- the base drawing: once per world, at a resolution that stays sharp when zoomed ----
  function buildBase() {
    const fit = fitScale();
    baseRes = Math.min(2600 / Math.max(bw, bh), Math.max(2, fit * Math.min(o.maxZoom, 4) * Math.min(2, window.devicePixelRatio || 1)));
    base = document.createElement("canvas"); base.width = Math.round(bw * baseRes); base.height = Math.round(bh * baseRes);
    const ctx = base.getContext("2d");
    ctx.fillStyle = PALETTE.ground; ctx.fillRect(0, 0, base.width, base.height);
    const toPx = (x, z) => [(x - B.x0) * baseRes, (z - B.z0) * baseRes];
    try { o.drawBase && o.drawBase(ctx, toPx, baseRes, PALETTE); } catch (e) { console.warn("[placemap] base", e); }
  }
  // the whole town on screen (a small margin), measured on the town itself, not the empty land around it
  function fitScale() { return Math.min((W || innerWidth) / cw, (H || innerHeight * 0.8) / ch) * 0.94; }
  const toScr = (x, z) => [(x - view.cx) * view.s + W / 2, (z - view.cz) * view.s + H / 2];
  function clampView() {
    const fit = fitScale(); view.s = Math.max(fit, Math.min(fit * o.maxZoom, view.s));
    const hw = W / 2 / view.s, hh = H / 2 / view.s;
    view.cx = cw / 2 < hw ? (CB.x0 + CB.x1) / 2 : Math.max(CB.x0 + hw, Math.min(CB.x1 - hw, view.cx));
    view.cz = ch / 2 < hh ? (CB.z0 + CB.z1) / 2 : Math.max(CB.z0 + hh, Math.min(CB.z1 - hh, view.cz));
  }
  function resize() {
    const r = body.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  // ---- places: read live from the world every time the map opens ----
  function readPlaces() {
    let list = [];
    try { list = (o.places() || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z) && p.name); } catch (e) { console.warn("[placemap] places", e); }
    const seen = new Set();
    list = list.filter((p) => { const k = p.id || p.name + "@" + Math.round(p.x) + "," + Math.round(p.z); if (seen.has(k)) return false; seen.add(k); p.id = k; return true; });
    list.sort((a, b) => ORDER.indexOf(a.icon) - ORDER.indexOf(b.icon) || a.name.localeCompare(b.name));
    return list;
  }
  function buildIcons() {
    iconsEl.innerHTML = "";
    for (const p of places) {
      const b = document.createElement("button"); b.type = "button"; b.className = "hbpm-ic" + (p.small ? " small" : ""); b.dataset.id = p.id;
      b.setAttribute("aria-label", p.name);
      b.innerHTML = `<i style="background:${iconColor(p.icon)}">${iconSVG(p.icon)}</i><em>${esc(p.short || p.name)}</em>`;
      b.addEventListener("click", (e) => { e.stopPropagation(); if (moved) return; select(p, false); });
      p._el = b; p._em = b.querySelector("em");
      iconsEl.appendChild(b);
    }
  }
  function buildList() {
    const me = o.player();
    let html = "";
    for (const [title, kinds] of GROUPS) {
      const rows = places.filter((p) => kinds.includes(p.icon) || (title === "Build and travel" && !ORDER.includes(p.icon)));
      if (!rows.length) continue;
      html += `<h4>${title}</h4>`;
      for (const p of rows) {
        const d = me ? Math.round(Math.hypot(p.x - me.x, p.z - me.z)) : null;
        html += `<button type="button" role="listitem" data-id="${esc(p.id)}"><i style="background:${iconColor(p.icon)}">${iconSVG(p.icon)}</i><span><b>${esc(p.name)}</b><small>${esc(p.blurb || "")}</small></span>${d != null ? `<span class="m">${d} m</span>` : ""}</button>`;
      }
    }
    listEl.innerHTML = html || `<h4>No places yet</h4>`;
    for (const b of listEl.querySelectorAll("button[data-id]")) b.addEventListener("click", () => { const p = places.find((q) => q.id === b.dataset.id); showList(false); if (p) select(p, true); });
  }
  function showList(on) { listEl.classList.toggle("on", on); listBtn.classList.toggle("on", on); if (on) { buildList(); listEl.scrollTop = 0; } }
  listBtn.addEventListener("click", () => showList(!listEl.classList.contains("on")));

  // ---- the place card ----
  function select(p, center) {
    sel = p;
    for (const q of places) q._el && q._el.classList.toggle("sel", q === p);
    if (!p) { sheet.classList.remove("on"); draw(); return; }
    const ic = sheet.querySelector(".top i"); ic.style.background = iconColor(p.icon); ic.innerHTML = iconSVG(p.icon);
    sheet.querySelector("h3").textContent = p.name;
    sheet.querySelector("p").textContent = p.blurb || "";
    const me = o.player();
    sheet.querySelector(".dist").textContent = me ? Math.round(Math.hypot(p.x - me.x, p.z - me.z)) + " m from you" : "";
    const now = sheet.querySelector(".now");
    now.style.display = p.open ? "" : "none";
    if (p.open) now.querySelector("span").textContent = p.openLabel || "Open now";
    sheet.classList.add("on");
    if (center) {   // bring it into the part of the map the card does not cover
      view.s = Math.max(view.s, fitScale() * 2);
      const cover = W < 760 ? sheet.offsetHeight : 0;
      view.cx = p.x + (W >= 760 ? 200 / view.s : 0); view.cz = p.z + cover / 2 / view.s; clampView();
    }
    draw();
  }
  $(".shut").addEventListener("click", () => select(null));
  $(".way").addEventListener("click", () => { if (!sel) return; const p = sel; guideTo(p); close(); });
  $(".now").addEventListener("click", () => { if (!sel || !sel.open) return; const p = sel; close(); openPlace(p); });
  function openPlace(p) {
    if (typeof p.open === "function") { try { p.open(); } catch (e) { console.warn("[placemap] open", e); } return; }
    if (p.external) { try { window.open(p.open, "_blank", "noopener"); } catch (e) {} return; }
    const t = (() => { try { return window.top || window; } catch (e) { return window; } })();
    t.location.assign(p.open);
  }

  // ---- show me the way: a route, a chip, a world marker. Never moves the player. ----
  function routeFor(g) {
    const me = o.player(); if (!me) return [[g.x, g.z]];
    let path = null;
    try { path = o.route ? o.route(me.x, me.z, g.x, g.z) : null; } catch (e) { path = null; }
    return path && path.length ? path : [[g.x, g.z]];
  }
  function guideTo(p) {
    if (guide) clearGuide(false);
    guide = { id: p.id, name: p.name, icon: p.icon, x: p.x, z: p.z, path: null };
    guide.path = routeFor(guide);
    try { o.onGuide && o.onGuide(guide); } catch (e) {}
    paintChip();
  }
  function clearGuide(arrived) {
    if (!guide) return;
    const g = guide; guide = null; chip.classList.remove("on"); setGround(null);
    try { o.onGuideEnd && o.onGuideEnd(g, !!arrived); } catch (e) {}
  }
  // where you stand on the route: the leg you are walking (or null when you are off it), the next corner, the turn there.
  // The route is a list of street corners ending at the place; it is re-made from where you stand every half second.
  const ON_LEG = 10, AT_CORNER = 6, STRAIGHT = 30 * Math.PI / 180;
  // keep the route you are walking. A fresh one replaces it only when you have left it, when the place comes into plain
  // sight (a one-point route), or when the fresh one is clearly shorter. So the corner ahead never jumps about.
  function remaining(path, me) {
    let leg = -1, best = ON_LEG, foot = null;
    for (let i = 0; i + 1 < path.length; i++) { const s = segDist(me.x, me.z, path[i], path[i + 1]); if (s[0] <= best + 0.5) { best = Math.min(best, s[0]); leg = i; foot = [s[1], s[2]]; } }
    if (leg < 0) return Infinity;
    let L = Math.hypot(path[leg + 1][0] - foot[0], path[leg + 1][1] - foot[1]);
    for (let i = leg + 1; i + 1 < path.length; i++) L += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
    return L;
  }
  function refreshRoute(me) {
    const fresh = routeFor(guide), old = guide.path;
    if (!old || fresh.length <= 1 || old.length <= 1) { guide.path = fresh; return; }
    const keep = remaining(old, me);
    if (keep === Infinity) { guide.path = fresh; guide.passed = []; return; }
    let fl = Math.hypot(fresh[0][0] - me.x, fresh[0][1] - me.z);
    for (let i = 0; i + 1 < fresh.length; i++) fl += Math.hypot(fresh[i + 1][0] - fresh[i][0], fresh[i + 1][1] - fresh[i][1]);
    if (fl < keep - 15) { guide.path = fresh; guide.passed = []; }
  }
  function segDist(px, pz, a, b) {
    const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / L2));
    return [Math.hypot(px - a[0] - vx * t, pz - a[1] - vz * t), a[0] + vx * t, a[1] + vz * t];
  }
  const turnAt = (a, c, n) => {   // signed turn at c going a -> c -> n; x to the right, z down the map: positive = right
    const ax = c[0] - a[0], az = c[1] - a[1], bx = n[0] - c[0], bz = n[1] - c[1];
    return Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
  };
  // a route as a person reads it: only real corners. A short jog (crossing at a corner, a few metres) becomes one corner,
  // and points on a straight line (every junction you walk straight through) are dropped.
  function simplify(src) {
    const p = src.map((q) => [q[0], q[1]]);
    for (let i = 1; i + 2 < p.length;) {
      if (Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) < 8) p.splice(i, 2, [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2]);
      else i++;
    }
    for (let i = 1; i + 1 < p.length;) {
      if (Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) < 0.3 || Math.abs(turnAt(p[i - 1], p[i], p[i + 1])) < STRAIGHT * 0.67) p.splice(i, 1);
      else i++;
    }
    return p;
  }
  function steer(me) {
    const raw = (guide.path && guide.path.length ? guide.path : [[guide.x, guide.z]]).slice();
    const end = raw[raw.length - 1];
    if (Math.hypot(end[0] - guide.x, end[1] - guide.z) > 0.5) raw.push([guide.x, guide.z]);
    const path = simplify(raw);
    const d = Math.hypot(guide.x - me.x, guide.z - me.z);
    // close (with a little give so it does not flicker at 35 m), or the route is one straight line: aim at the place
    const near = d < (guide.direct ? o.near + 5 : o.near);
    let leg = -1, foot = null, best = ON_LEG;
    for (let i = 0; i + 1 < path.length; i++) { const s = segDist(me.x, me.z, path[i], path[i + 1]); if (s[0] <= best + 0.5) { best = Math.min(best, s[0]); leg = i; foot = [s[1], s[2]]; } }
    // the corner ahead: the end of the leg you are on (or the first point when you are off the route); skip one you are standing at
    let ci = leg >= 0 ? leg + 1 : 0;
    // a corner you have reached counts as passed (so wandering a step back does not flip the words); forget it 25 m on
    const passed = guide.passed || (guide.passed = []);
    for (let k = passed.length - 1; k >= 0; k--) if (Math.hypot(passed[k][0] - me.x, passed[k][1] - me.z) > 25) passed.splice(k, 1);
    while (ci < path.length - 1) {
      const q = path[ci];
      if (Math.hypot(q[0] - me.x, q[1] - me.z) < AT_CORNER) { passed.push([q[0], q[1]]); ci++; continue; }
      if (passed.some((r) => Math.hypot(q[0] - r[0], q[1] - r[1]) < 7)) { ci++; continue; }
      break;
    }
    const ground = [[me.x, me.z]].concat(leg >= 0 && foot && Math.hypot(foot[0] - me.x, foot[1] - me.z) > 1.5 ? [foot] : [], path.slice(ci));
    if (near || ci >= path.length - 1) return { mode: "place", aim: [guide.x, guide.z], d, ground };
    const c = path[ci], nx = path[ci + 1];
    let from = ci > 0 ? path[ci - 1] : [me.x, me.z];
    if (Math.hypot(c[0] - from[0], c[1] - from[1]) < 0.5) from = [me.x, me.z];
    const ang = turnAt(from, c, nx);
    const mode = Math.abs(ang) < STRAIGHT ? "straight" : ang > 0 ? "right" : "left";
    // a turn far down the street reads "Go straight, then turn left"; close to it, "Turn left at the corner"
    const far = mode !== "straight" && Math.hypot(c[0] - me.x, c[1] - me.z) > o.near + 10;
    return { mode, far, aim: c, d, ground };
  }
  let groundSent = null;
  function setGround(pts) {
    if (!o.groundPath) return;
    if (!pts) { if (groundSent) { groundSent = null; try { o.groundPath(null); } catch (e) {} } return; }
    // only re-send when you have moved a metre or the route changed (the world rebuilds one small mesh)
    if (groundSent && groundSent.length === pts.length && pts.every((q, i) => Math.abs(q[0] - groundSent[i][0]) + Math.abs(q[1] - groundSent[i][1]) < (i ? 0.3 : 1))) return;
    groundSent = pts.map((q) => [q[0], q[1]]);
    if (guide) guide.ahead = groundSent;   // the worlds' own minimaps draw this (what is still ahead of you)
    try { o.groundPath(groundSent); } catch (e) { console.warn("[placemap] ground path", e); }
  }
  const TURN_TEXT = { left: "Turn left at the corner", right: "Turn right at the corner", straight: "Go straight" };
  function paintChip() {
    if (!guide) { chip.classList.remove("on"); setGround(null); return; }
    const me = o.player(), span = chip.querySelector(".go span"), ar = chip.querySelector(".arrow");
    if (!me) { span.textContent = guide.name; ar.style.transform = ""; chip.classList.remove("two"); chip.classList.add("on"); guide.step = null; setGround(null); return; }
    const st = steer(me), dm = Math.round(st.d) + " m";
    guide.direct = st.mode === "place"; guide.step = st.mode; guide.aim = st.aim;
    const dx = st.aim[0] - me.x, dz = st.aim[1] - me.z, s = Math.sin(me.yaw || 0), c = Math.cos(me.yaw || 0);
    const f = -dx * s - dz * c, r = dx * c - dz * s;
    ar.style.transform = `rotate(${Math.atan2(r, f)}rad)`;
    const words = st.mode === "place" ? "" : st.far ? "Go straight, then turn " + st.mode : TURN_TEXT[st.mode];
    guide.words = words;
    const text = st.mode === "place" ? guide.name + " · " + dm : words + " · " + guide.name + " " + dm;
    if (chip.dataset.text !== text) {
      chip.dataset.text = text;
      if (st.mode === "place") { span.textContent = guide.name + " · " + dm; chip.classList.remove("two"); }
      else { span.innerHTML = `<b>${esc(words)}</b><small>${esc(guide.name)} · ${dm}</small>`; chip.classList.add("two"); }
      chip.querySelector(".go").setAttribute("aria-label", text + ". Open the map with your route");
    }
    chip.classList.add("on");
    setGround(st.ground);
  }
  let tick = 0;
  setInterval(() => {
    const en = !!o.enabled();
    if (!o.trigger) btn.classList.toggle("on", en && !isOpen);
    if (!guide) return;
    if (!en) { chip.classList.remove("on"); setGround(null); return; }
    const me = o.player();
    if (me && Math.hypot(guide.x - me.x, guide.z - me.z) < o.arrive) { const name = guide.name; clearGuide(true); toast("You're at " + name); return; }
    if (me && ++tick % 2 === 0) refreshRoute(me);
    paintChip();
  }, 250);
  let toastEl = null, toastT = 0;
  function toast(text) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.setAttribute("role", "status");
      Object.assign(toastEl.style, { position: "fixed", left: "50%", top: "calc(env(safe-area-inset-top) + 64px)", transform: "translateX(-50%)", zIndex: 81, padding: "10px 16px", borderRadius: "999px",
        background: "rgba(28,24,20,.92)", border: "1px solid rgba(132,214,152,.75)", color: "#eafbe9", font: "700 14px system-ui,-apple-system,sans-serif", pointerEvents: "none", transition: "opacity .3s", opacity: 0 });
      document.body.appendChild(toastEl); }
    toastEl.textContent = text; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; }, 2600);
  }

  // ---- drawing ----
  function draw() {
    if (!isOpen) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(drawNow);
  }
  function drawNow() {
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = o.outside; ctx.fillRect(0, 0, W, H);
    const a = toScr(B.x0, B.z0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, a[0], a[1], bw * view.s, bh * view.s);
    // the route
    const me = o.player();
    if (guide) {
      const pts = (me && groundSent) || (me ? [[me.x, me.z]] : []).concat(guide.path || [[guide.x, guide.z]]);   // the part still ahead of you
      ctx.lineJoin = ctx.lineCap = "round";
      for (const [col, w] of [[PALETTE.routeEdge, 8], [PALETTE.route, 4.5]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(col === PALETTE.route ? [] : []); ctx.beginPath();
        pts.forEach((q, i) => { const m = toScr(q[0], q[1]); i ? ctx.lineTo(m[0], m[1]) : ctx.moveTo(m[0], m[1]); }); ctx.stroke();
      }
      const e = toScr(guide.x, guide.z); ctx.fillStyle = PALETTE.route; ctx.strokeStyle = PALETTE.routeEdge; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(e[0], e[1], 7, 0, 7); ctx.fill(); ctx.stroke();
    }
    placeIcons(me);
    // you are here: a ring + an arrow pointing where you face (above the icons, so a door never hides you)
    if (me) {
      const m = toScr(me.x, me.z), ang = Math.atan2(-Math.cos(me.yaw || 0), -Math.sin(me.yaw || 0));
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 380);
      meEl.style.display = ""; meEl.style.transform = `translate(${m[0]}px,${m[1]}px)`;
      meEl.querySelector("b").style.transform = `scale(${1 + 0.22 * pulse})`;
      meEl.querySelector("svg").style.transform = `rotate(${ang + Math.PI / 2}rad)`;
    } else meEl.style.display = "none";
    if (me) raf = requestAnimationFrame(drawNow);   // keep the "you are here" pulse alive while open
  }
  function placeIcons(me) {
    const taken = [];
    if (me) { const m = toScr(me.x, me.z); taken.push([m[0] - 14, m[1] - 14, m[0] + 14, m[1] + 14]); }
    const hit = (r) => taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]);
    // icons first (all of them), nudged apart when two doors sit side by side, then labels where they fit
    const vis = [];
    for (const p of places) {
      const s = toScr(p.x, p.z), on = s[0] > -30 && s[0] < W + 30 && s[1] > -30 && s[1] < H + 30;
      p._t = s; p._s = [s[0], s[1]]; p._el.style.display = on ? "" : "none";
      if (on) vis.push(p);
    }
    // a bunch of doors close together (Ashgrove's east avenue): lay that bunch out as a neat little grid around its middle,
    // in map order (top to bottom, then left to right), so every icon is tappable; a leader line marks each real door
    const R = (p) => (p.small ? 14 : 19);
    const grp = vis.map((_, i) => i), root = (i) => (grp[i] === i ? i : (grp[i] = root(grp[i])));
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      if (Math.hypot(a._t[0] - b._t[0], a._t[1] - b._t[1]) < R(a) + R(b)) grp[root(i)] = root(j);
    }
    const bunches = new Map();
    vis.forEach((p, i) => { const r = root(i); if (!bunches.has(r)) bunches.set(r, []); bunches.get(r).push(p); });
    for (const list of bunches.values()) {
      if (list.length < 3) continue;
      let mx = 0, my = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of list) { mx += p._t[0]; my += p._t[1]; x0 = Math.min(x0, p._t[0]); x1 = Math.max(x1, p._t[0]); y0 = Math.min(y0, p._t[1]); y1 = Math.max(y1, p._t[1]); }
      mx /= list.length; my /= list.length;
      const n = list.length, tall = y1 - y0 >= x1 - x0;
      const cols = tall ? Math.min(n, Math.max(2, Math.round(Math.sqrt(n / 1.5)))) : Math.ceil(Math.sqrt(n * 1.5)), rows = Math.ceil(n / cols), gap = 44;
      const sorted = list.slice().sort((a, b) => (tall ? a._t[1] - b._t[1] || a._t[0] - b._t[0] : a._t[0] - b._t[0] || a._t[1] - b._t[1]));
      sorted.forEach((p, k) => {
        const r = tall ? Math.floor(k / cols) : k % rows, c = tall ? k % cols : Math.floor(k / rows);
        p._s = [mx + (c - (cols - 1) / 2) * gap, my + (r - (rows - 1) / 2) * gap];
      });
    }
    for (let it = 0; it < 24; it++) {
      let any = false;
      for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i], b = vis[j], need = (a.small ? 14 : 19) + (b.small ? 14 : 19);
        let dx = b._s[0] - a._s[0], dy = b._s[1] - a._s[1], d = Math.hypot(dx, dy);
        if (d >= need) continue;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const push = (need - d) / 2 + 0.5, ux = dx / d, uy = dy / d;
        a._s[0] -= ux * push; a._s[1] -= uy * push; b._s[0] += ux * push; b._s[1] += uy * push; any = true;
      }
      if (!any) break;
    }
    for (const p of vis) {
      const s = p._s; p._el.style.transform = `translate(${s[0]}px,${s[1]}px)`;
      const r = p.small ? 13 : 17; taken.push([s[0] - r, s[1] - r, s[0] + r, s[1] + r]);
    }
    // where an icon was nudged, a thin line + dot marks the real door
    const ctx = cv.getContext("2d");
    for (const p of vis) if (Math.hypot(p._s[0] - p._t[0], p._s[1] - p._t[1]) > 5) {
      ctx.strokeStyle = "rgba(255,248,236,.85)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p._t[0], p._t[1]); ctx.lineTo(p._s[0], p._s[1]); ctx.stroke();
      ctx.fillStyle = iconColor(p.icon); ctx.strokeStyle = "#fff8ec"; ctx.beginPath(); ctx.arc(p._t[0], p._t[1], 4, 0, 7); ctx.fill(); ctx.stroke();
    }
    const zoomed = view.s / fitScale();
    for (const p of places) {
      if (p._el.style.display === "none") continue;
      if (p.small && zoomed < 1.8 && p !== sel) { p._em.classList.add("off"); continue; }
      const text = p.short || p.name, w = text.length * 6.6 + 12, s = p._s, r = [s[0] - w / 2, s[1] + 19, s[0] + w / 2, s[1] + 37];
      const show = p === sel || !hit(r);
      p._em.classList.toggle("off", !show);
      if (show) taken.push(r);
    }
  }

  // ---- pan + pinch + wheel. A drag never counts as a tap on an icon. ----
  const pts = new Map(); let moved = false, start = null;
  body.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".hbpm-sheet,.hbpm-list,.hbpm-zoom,.hbpm-me")) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]); moved = false;
    start = { cx: view.cx, cz: view.cz, s: view.s, pts: new Map(pts) };
    try { cv.setPointerCapture && e.target === cv && cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  body.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    const ids = [...pts.keys()];
    if (ids.length === 1) {
      const a = start.pts.get(ids[0]); if (!a) return;
      const dx = e.clientX - a[0], dy = e.clientY - a[1];
      if (Math.hypot(dx, dy) > 8) moved = true;
      if (moved) { view.cx = start.cx - dx / view.s; view.cz = start.cz - dy / view.s; clampView(); draw(); }
    } else if (ids.length >= 2) {
      const a0 = start.pts.get(ids[0]), a1 = start.pts.get(ids[1]); if (!a0 || !a1) { start = { cx: view.cx, cz: view.cz, s: view.s, pts: new Map(pts) }; return; }
      const b0 = pts.get(ids[0]), b1 = pts.get(ids[1]);
      const d0 = Math.hypot(a0[0] - a1[0], a0[1] - a1[1]) || 1, d1 = Math.hypot(b0[0] - b1[0], b0[1] - b1[1]) || 1;
      moved = true;
      const r = body.getBoundingClientRect(), mx = (a0[0] + a1[0]) / 2 - r.left, my = (a0[1] + a1[1]) / 2 - r.top;
      const wx = start.cx + (mx - W / 2) / start.s, wz = start.cz + (my - H / 2) / start.s;
      view.s = start.s * d1 / d0; clampView();
      const nx = (b0[0] + b1[0]) / 2 - r.left, ny = (b0[1] + b1[1]) / 2 - r.top;
      view.cx = wx - (nx - W / 2) / view.s; view.cz = wz - (ny - H / 2) / view.s; clampView(); draw();
    }
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    start = pts.size ? { cx: view.cx, cz: view.cz, s: view.s, pts: new Map(pts) } : null;
    if (!pts.size) setTimeout(() => { moved = false; }, 0);
  };
  body.addEventListener("pointerup", up); body.addEventListener("pointercancel", up);
  cv.addEventListener("click", () => { if (!moved && sel) select(null); });
  body.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); }, { passive: false });
  function zoomAt(k, cx, cy) {
    const r = body.getBoundingClientRect(), mx = (cx == null ? r.left + W / 2 : cx) - r.left, my = (cy == null ? r.top + H / 2 : cy) - r.top;
    const wx = view.cx + (mx - W / 2) / view.s, wz = view.cz + (my - H / 2) / view.s;
    view.s *= k; clampView();
    view.cx = wx - (mx - W / 2) / view.s; view.cz = wz - (my - H / 2) / view.s; clampView(); draw();
  }
  $(".zin").addEventListener("click", () => zoomAt(1.5));
  $(".zout").addEventListener("click", () => zoomAt(1 / 1.5));
  $(".hbpm-me").addEventListener("click", () => { const me = o.player(); if (!me) return; view.cx = me.x; view.cz = me.z; view.s = Math.max(view.s, fitScale() * 2.2); clampView(); draw(); });
  $(".close-btn").addEventListener("click", () => close());
  // while the map is up the world gets no keys (no walking behind the map); Esc steps back: list, card, map
  addEventListener("keydown", (e) => {
    if (!isOpen) return;
    e.stopImmediatePropagation();
    if (e.key === "Escape") { e.preventDefault(); if (listEl.classList.contains("on")) showList(false); else if (sel) select(null); else close(); }
  }, true);
  addEventListener("resize", () => { if (!isOpen) return; resize(); clampView(); draw(); });

  function open() {
    if (isOpen || !o.enabled()) return;
    isOpen = true; root.classList.add("on");
    if (!o.trigger) btn.classList.remove("on");
    try { o.onOpen && o.onOpen(); } catch (e) {}
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    resize();
    if (!base) buildBase();
    places = readPlaces(); buildIcons();
    const me = o.player();
    // open fitted to the town itself. When the town's shape is close to the screen's, fill the screen with it (no
    // empty border); a wide town on a tall phone opens filling the height, around you; small worlds open whole.
    const fit = fitScale(), cover = Math.max(W / cw, H / ch) * 1.01;
    view = { s: fit, cx: (CB.x0 + CB.x1) / 2, cz: (CB.z0 + CB.z1) / 2 };
    if (cover / fit < 1.6) { view.s = cover; if (me) { view.cx = me.x; view.cz = me.z; } }
    if (me && Math.max(cw, ch) > 200 && W < 700) { view.s = Math.max(fit * 1.6, cover); view.cx = me.x; view.cz = me.z; }
    clampView();
    select(null); showList(false);
    if (guide) {   // a route is on: show you and the place together, the card open
      const g = places.find((p) => p.id === guide.id) || Object.assign({ icon: "place", blurb: "", open: null }, guide);
      select(g, false);
      if (me) {
        const cover = W < 760 ? sheet.offsetHeight : 0, side = W >= 760 ? 400 : 0;
        view.cx = (me.x + g.x) / 2; view.cz = (me.z + g.z) / 2;
        view.s = Math.min(view.s, (W - side - 80) / Math.max(20, Math.abs(g.x - me.x)), (H - cover - 120) / Math.max(20, Math.abs(g.z - me.z)));
        clampView();
        view.cx += side / 2 / view.s; view.cz += cover / 2 / view.s; clampView();
      }
    }
    draw();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; root.classList.remove("on"); cancelAnimationFrame(raf); sel = null;
    if (!o.trigger && o.enabled()) btn.classList.add("on");
    try { o.onClose && o.onClose(); } catch (e) {}
  }

  const api = {
    open, close, guideTo, clearGuide: () => clearGuide(false),
    get isOpen() { return isOpen; }, get guide() { return guide && { id: guide.id, name: guide.name, x: guide.x, z: guide.z, path: guide.path, step: guide.step || null, aim: guide.aim || null, words: guide.words || "", ground: groundSent }; },
    places: () => readPlaces().map((p) => ({ id: p.id, icon: p.icon, name: p.name, blurb: p.blurb, x: p.x, z: p.z, open: typeof p.open === "function" ? "fn" : p.open || null })),
    select: (id) => { const p = places.find((q) => q.id === id); if (p) select(p, true); return !!p; },
    rebuildBase: () => { base = null; },
    button: btn, chip, root,
  };
  if (typeof window !== "undefined") window.__placeMap = api;   // tests + dev tools
  return api;
}

// ---- the route on the ground: a line of small soft-green arrowheads, every couple of metres from your feet to the place.
// One mesh, one draw call, a fixed-size buffer (no allocation while you walk). The arrowheads are spaced from the PLACE
// backwards, so the ones ahead of you stay put as you walk instead of sliding along with you.
// groundDarts(pts, opt) -> Float32Array of triangles (x, y, z per vertex, 6 vertices per arrowhead) + the count.
export function groundDarts(pts, opt = {}) {
  const yAt = opt.y || (() => 0), lift = opt.lift == null ? 0.06 : opt.lift, sp = opt.spacing || 2.4, max = opt.max || 320;
  const size = opt.size || 1, skip = opt.skip == null ? 1.6 : opt.skip;
  const out = opt.out || new Float32Array(max * 18);
  if (!pts || pts.length < 2) return { data: out, count: 0 };
  let L = 0; const seg = [];
  for (let i = 0; i + 1 < pts.length; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); L += l; }
  let n = 0, s = L % sp, i = 0, acc = 0;
  if (s < skip) s += sp * Math.ceil((skip - s) / sp);
  const tip = 0.42 * size, back = 0.28 * size, wing = 0.42 * size, notch = 0.05 * size;
  for (; s < L - 0.8 && n < max; s += sp) {
    while (i < seg.length - 1 && acc + seg[i] < s) { acc += seg[i]; i++; }
    const l = seg[i] || 1, t = (s - acc) / l, a = pts[i], b = pts[i + 1];
    const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l, nx = -uz, nz = ux;
    const cx = a[0] + (b[0] - a[0]) * t, cz = a[1] + (b[1] - a[1]) * t, y = yAt(cx, cz) + lift;
    const T0 = [cx + ux * tip, cz + uz * tip], L0 = [cx - ux * back + nx * wing, cz - uz * back + nz * wing];
    const R0 = [cx - ux * back - nx * wing, cz - uz * back - nz * wing], N0 = [cx - ux * notch, cz - uz * notch];
    const tri = [T0, L0, N0, T0, N0, R0], o = n * 18;
    for (let k = 0; k < 6; k++) { out[o + k * 3] = tri[k][0]; out[o + k * 3 + 1] = y; out[o + k * 3 + 2] = tri[k][1]; }
    n++;
  }
  return { data: out, count: n };
}
// the same for a three.js world: pass THREE (the world's own copy), its scene and its ground height
export function threeGroundPath(THREE, scene, opt = {}) {
  const max = opt.max || 320, buf = new Float32Array(max * 18);
  const geo = new THREE.BufferGeometry(), attr = new THREE.BufferAttribute(buf, 3);
  attr.setUsage && attr.setUsage(THREE.DynamicDrawUsage); geo.setAttribute("position", attr); geo.setDrawRange(0, 0);
  const mat = new THREE.MeshBasicMaterial({ color: opt.color || 0x84d698, transparent: true, opacity: opt.opacity || 0.6, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.visible = false; mesh.name = "PlaceMapGroundPath";
  scene.add(mesh);
  const fn = (pts) => {
    if (!pts) { mesh.visible = false; geo.setDrawRange(0, 0); return; }
    const r = groundDarts(pts, Object.assign({}, opt, { max, out: buf }));
    geo.setDrawRange(0, r.count * 6); attr.needsUpdate = true; mesh.visible = r.count > 0;
  };
  fn.mesh = mesh;
  return fn;
}

if (typeof window !== "undefined") window.HBPlaceMap = { create: createPlaceMap, PALETTE, iconSVG, iconColor, groundDarts, threeGroundPath };
