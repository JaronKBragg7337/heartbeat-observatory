/* ============================================================================
   destinations.js — buildings you walk into that take you somewhere
   ---------------------------------------------------------------------------
   World 1 proved the pattern: the Games building has arcade cabinets that open
   real game pages, the Library's shelves link to Wikipedia, the Theater plays
   actual films. A building is only interesting if being inside it does
   something.

   Ashgrove already generates the right rooms — a town hall, a library, a post
   office, a school, a store, a clinic. This file gives them somewhere to go.
   It reads the town; it never modifies it. Nothing here is in town/.

   How it works: the town already tracks which building you are standing in
   (T.Player.building, set by its own interior detection). When that building
   has a destination, the shell offers it, and the action key opens it. Door
   prompts still win — you should never be offered a journey while your hand
   is on a doorknob.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN;
if (!T) return;

/* Keyed by the town's own building key, so this survives the town being
   regenerated, growing, or renumbering its ids. */
const DESTINATIONS = {
  townHall: {
    icon: "worlds",   // the place map icon (/hb-placemap.js; same icon in every world)
    label: "the noticeboard",
    verb: "Read the noticeboard",
    blurb: "Every world in the Observatory, and the way back.",
    kind: "worlds",
  },
  library: {
    icon: "library",   // the place map icon (/hb-placemap.js; same icon in every world)
    label: "the shelves",
    verb: "Read the shelves",
    blurb: "Pages written here on the Observatory, and the open shelves of the world: the same eight as the Town Square library.",
    kind: "list",
    rows: [
      { name: "Written Here", url: "/library/", note: "the Observatory's own library" },
      { name: "Project Gutenberg", url: "https://www.gutenberg.org", note: "free classic books", external: true },
      { name: "Open Library", url: "https://openlibrary.org", note: "borrow and read", external: true },
      { name: "Standard Ebooks", url: "https://standardebooks.org", note: "beautiful free ebooks", external: true },
      { name: "LibriVox", url: "https://librivox.org", note: "free audiobooks", external: true },
      { name: "Wikipedia", url: "https://www.wikipedia.org", note: "the encyclopedia", external: true },
      { name: "Wikisource", url: "https://wikisource.org", note: "original texts", external: true },
      { name: "Khan Academy", url: "https://www.khanacademy.org", note: "free lessons", external: true },
      { name: "OpenStax", url: "https://openstax.org", note: "free textbooks", external: true },
    ],
  },
  postOffice: {
    icon: "post",   // the place map icon (/hb-placemap.js; same icon in every world)
    label: "the counter",
    verb: "Collect your post",
    blurb: "Your messages — the same inbox the phone carries.",
    kind: "phone-messages",
  },
  school: {
    icon: "school",   // the place map icon (/hb-placemap.js; same icon in every world)
    label: "the reading corner",
    verb: "Open a book",
    blurb: "Project Gutenberg — public-domain books, free to read.",
    kind: "link",
    url: "https://www.gutenberg.org",
    external: true,
  },
  store: {
    icon: "social",   // the place map icon (/hb-placemap.js; same icon in every world)
    label: "the notice wall",
    verb: "Read the notice wall",
    blurb: "What people in the Observatory are posting.",
    kind: "link",
    url: "/social/",
    external: false,
  },
  diner: {
    icon: "diner",   // the place map icon (/hb-placemap.js; same icon in every world)
    label: "the booth",
    verb: "Sit at the booth",
    blurb: "Who else is in Ashgrove right now.",
    kind: "phone-people",
  },
};

const WORLDS = [
  { name: "Town Square", url: "/engine/hub/", note: "World 1 — the original" },
  { name: "World 2 · the city", url: "/world2/", note: "the bigger one" },
  { name: "Ashgrove", url: "/world3/", note: "you are here", here: true },
];

const D = (T.Destinations = { current: null, open: false, table: DESTINATIONS });

/* The place map (world3/placemap.js) reads every place from T.PlaceSources: each file that makes a door adds its own
   list there, built from the same table its doors use, so a new destination shows up on the map by itself. */
(T.PlaceSources = T.PlaceSources || []).push(function () {
  const out = [];
  for (const b of (T.Town && T.Town.buildings) || []) {
    const dest = DESTINATIONS[b.key];
    if (!dest) continue;
    const back = b.def.porch ? -(b.def.porch.depth || 2.2) - 1.6 : b.def.portico ? -4.2 : -2.6;   // just outside the front door
    const open = dest.kind === "link" ? dest.url
      : dest.kind === "phone-messages" || dest.kind === "phone-people"
        ? (T.Shell && T.Shell.openPhone ? () => T.Shell.openPhone(dest.kind === "phone-people" ? "people" : "messages") : null)
        : () => show(Object.assign({ buildingId: b.id }, dest));
    out.push({ id: "ash-" + b.id, icon: dest.icon || "place", name: b.def.label, blurb: dest.blurb, x: b.tx(b.def.w / 2, back), z: b.tz(b.def.w / 2, back),
      open, external: !!dest.external });
  }
  return out;
});

/* ------------------------------------------------------------------ css - */
const style = document.createElement("style");
style.textContent = `
.w3-dest{position:fixed;inset:0;z-index:90050;display:none;align-items:center;justify-content:center;
  background:rgba(4,7,10,.72);backdrop-filter:blur(6px);padding:22px}
.w3-dest.open{display:flex}
.w3-card{width:min(420px,92vw);max-height:82vh;overflow:auto;background:#0e1417;border:1px solid #243036;
  border-radius:16px;color:#e6edf1;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.6)}
.w3-card h2{margin:0;padding:16px 18px 4px;font-size:17px}
.w3-card .sub{padding:0 18px 14px;color:#93a4b3;font-size:13.5px;line-height:1.5}
.w3-card a.row,.w3-card button.row{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;
  padding:14px 18px;border:0;border-top:1px solid #1b262c;background:transparent;color:#e6edf1;
  font:inherit;font-size:14px;text-align:left;text-decoration:none;cursor:pointer}
.w3-card a.row:hover,.w3-card button.row:hover{background:#131c22}
.w3-card .row small{color:#7d909c;font-size:12px}
.w3-card .row.here{opacity:.5;cursor:default}
.w3-close{display:block;width:100%;padding:14px;border:0;border-top:1px solid #1b262c;background:#121b20;
  color:#cdd6db;font:600 14px system-ui,sans-serif;cursor:pointer;border-radius:0 0 16px 16px}
`;
document.head.appendChild(style);

const overlay = document.createElement("div");
overlay.className = "w3-dest";
document.body.appendChild(overlay);
overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

function close() { overlay.classList.remove("open"); D.open = false; }

function show(dest) {
  let rows = "";
  if (dest.kind === "worlds") {
    rows = WORLDS.map((w) => w.here
      ? `<span class="row here"><span>${w.name}</span><small>${w.note}</small></span>`
      : `<a class="row" href="${w.url}"><span>${w.name}</span><small>${w.note} &rarr;</small></a>`).join("");
  } else if (dest.kind === "list") {
    rows = dest.rows.map((r) => `<a class="row" href="${r.url}"${r.external ? ' target="_blank" rel="noopener noreferrer"' : ""}>
      <span>${r.name}</span><small>${r.note}${r.external ? " &nearr;" : " &rarr;"}</small></a>`).join("");
  } else if (dest.kind === "link") {
    rows = `<a class="row" href="${dest.url}"${dest.external ? ' target="_blank" rel="noopener noreferrer"' : ""}>
      <span>${dest.url.replace(/^https?:\/\//, "")}</span><small>${dest.external ? "opens a new tab" : "same site"} &rarr;</small></a>`;
  }
  overlay.innerHTML = `<div class="w3-card">
      <h2>${cap(dest.label)}</h2>
      <div class="sub">${dest.blurb}</div>
      ${rows}
      <button class="w3-close" type="button">Back to the town</button>
    </div>`;
  overlay.querySelector(".w3-close").addEventListener("click", close);
  overlay.classList.add("open");
  D.open = true;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* --------------------------------------------------------------- public - */
D.show = show;   // eastside.js opens its Arcade card with the same look

/* What, if anything, the building the player is standing in offers. */
D.here = function () {
  const b = T.Player && T.Player.building;
  if (!b) return null;
  const dest = DESTINATIONS[b.key];
  if (!dest) return null;
  return Object.assign({ buildingId: b.id }, dest);
};

/* Returns true when it handled the action, so the caller can fall through to
   doors and NPCs when it did not. */
D.use = function (shell) {
  if (D.open) { close(); return true; }
  const dest = D.here();
  if (!dest) return false;
  if (dest.kind === "phone-messages" || dest.kind === "phone-people") {
    if (shell && shell.openPhone) shell.openPhone(dest.kind === "phone-people" ? "people" : "messages");
    return true;
  }
  show(dest);
  return true;
};

addEventListener("keydown", (e) => { if (e.key === "Escape" && D.open) close(); });

console.log("%cWORLD3", "color:#8fd0ff;font-weight:bold",
  `${Object.keys(DESTINATIONS).length} buildings lead somewhere`);
})();
