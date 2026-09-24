/**
 * Cards and boards for pages the site editor can arrange.
 *
 * A page opts in with plain markup:
 *   data-hb-card="key"          on each card (a link, a tile, a world)
 *   data-hb-board-list          on each container that holds cards
 *   data-hb-board-section       on each section around such a container
 *   data-hb-board-anchor        on the container the board takes the place of
 *   <script type="application/json" id="hb-hidden-cards">[{"key":"...","name":"..."}]</script>
 *   <script type="application/json" id="hb-layout">{"desktop":{...}|null,"phone":{...}|null}</script>
 *
 * Hidden cards never show. When the layout for this screen size is set, the
 * cards leave their lists and sit on one board, each at the spot and in the
 * shape saved for it. When it is not set, the page looks exactly as written.
 * The editor (hb-editor-app.js) writes both JSON blocks; this file only reads them.
 *
 * Layout: { cols, items: [{ card, x, y, w, h, shape }] }, x/y/w/h in grid cells.
 * Call HBBoard.apply() after a page builds cards with its own code.
 */
(function () {
  "use strict";
  if (window.HBBoard) return;

  const PHONE_MAX = 759;
  const DESIGN_WIDTH = 1120; // how wide the computer board is drawn when previewed on a narrow screen
  const SHAPES = {
    phone: { cols: 4, gap: 12, small: [2, 2], wide: [4, 2], tall: [2, 3], big: [4, 4], round: [2, 2] },
    desktop: { cols: 12, gap: 14, small: [3, 3], wide: [6, 3], tall: [3, 5], big: [6, 5], round: [4, 4] }
  };

  const CSS = `
[data-hb-hidden]{display:none!important}
[data-hb-emptied]{display:none!important}
.hb-board{display:grid;grid-template-columns:repeat(var(--hb-cols),minmax(0,1fr));grid-auto-rows:var(--hb-cell,80px);
  gap:var(--hb-gap);grid-auto-flow:row dense;margin:0 0 8px;transform-origin:top left}
.hb-board>[data-hb-card]{min-height:0!important;min-width:0;margin:0!important;overflow:hidden;box-sizing:border-box;position:relative}
.hb-board>.surface-row{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:16px 18px!important;
  border:1px solid var(--line);border-radius:18px;background:var(--surface);border-bottom:1px solid var(--line)}
.hb-board>.surface-row:hover{padding:16px 18px!important}
.hb-board>.surface-row .surface-state{order:-1}
.hb-board>.surface-row .surface-arrow{display:block;margin-top:auto}
.hb-board>.studio-link{grid-template-columns:1fr;align-items:start;gap:10px}
.hb-board>.world-card .world-orb{flex:1 1 0;min-height:36px;width:auto;max-width:100%;margin:10px auto}
.hb-board>.world-card p{min-height:0}
.hb-board>.hb-shape-round{display:flex!important;flex-direction:column;align-items:center;justify-content:flex-end;
  border-radius:50%!important;padding:0!important;text-align:center;background:var(--accent-pale,#d9e7df);
  border:1px solid var(--line);box-shadow:0 12px 30px rgba(39,45,40,.12)}
.hb-board>.hb-shape-round>*:not(.world-orb):not(h3):not(.surface-name):not(div){display:none!important}
.hb-board>.hb-shape-round>div:not(.world-card-head){display:contents}
.hb-board>.hb-shape-round .world-card-head,.hb-board>.hb-shape-round p,.hb-board>.hb-shape-round .card-link{display:none!important}
.hb-board>.hb-shape-round .world-orb{position:absolute;inset:0;width:100%;height:100%;max-width:none;margin:0;border-radius:50%}
.hb-board>.hb-shape-round h3,.hb-board>.hb-shape-round .surface-name{position:relative;z-index:1;margin:0 8% 14%;
  padding:6px 14px;border-radius:999px;background:var(--surface-solid,#fffdf8);border:1px solid var(--line);
  font-size:clamp(13px,1.1vw + 8px,18px)!important;line-height:1.2;letter-spacing:0;box-shadow:0 4px 12px rgba(0,0,0,.08)}
`;

  let styleEl = null;
  let override = null;
  let board = null;
  let resizeObs = null;
  let lastMode = null;

  function readJson(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent); } catch (e) { return fallback; }
  }

  function hiddenList() {
    const list = override && override.hidden ? override.hidden : readJson("hb-hidden-cards", []);
    return Array.isArray(list) ? list : [];
  }
  function hiddenKeys() {
    return new Set(hiddenList().map(x => (typeof x === "string" ? x : x && x.key)).filter(Boolean));
  }
  function layouts() {
    return (override && override.layout) || readJson("hb-layout", {}) || {};
  }
  function screenMode() {
    return innerWidth <= PHONE_MAX ? "phone" : "desktop";
  }
  function mode() {
    return (override && override.mode) || screenMode();
  }

  /** Puts every card back where the page's markup put it. */
  function restore() {
    if (board) {
      for (const card of Array.from(board.children)) {
        const home = card.__hbHome;
        if (home && home.parentNode) home.parentNode.replaceChild(card, home);
        card.classList.remove("hb-shape-small", "hb-shape-wide", "hb-shape-tall", "hb-shape-big", "hb-shape-round");
        card.style.gridColumn = "";
        card.style.gridRow = "";
        delete card.__hbHome;
      }
      board.remove();
      board = null;
    }
    if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
    document.querySelectorAll("[data-hb-emptied]").forEach(el => el.removeAttribute("data-hb-emptied"));
  }

  function sizeCells() {
    if (!board) return;
    const s = SHAPES[board.dataset.mode];
    const width = board.offsetWidth;
    const cell = Math.max(24, (width - s.gap * (s.cols - 1)) / s.cols);
    board.style.setProperty("--hb-cell", cell + "px");
    const scale = parseFloat(board.dataset.scale || "1");
    if (scale !== 1) board.style.marginBottom = -(1 - scale) * board.offsetHeight + "px";
  }

  function apply(next) {
    if (next !== undefined) override = next;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }
    restore();
    lastMode = mode();

    const hidden = hiddenKeys();
    document.querySelectorAll("[data-hb-card]").forEach(card => {
      if (hidden.has(card.getAttribute("data-hb-card"))) card.setAttribute("data-hb-hidden", "");
      else if (card.hasAttribute("data-hb-hidden")) {
        card.removeAttribute("data-hb-hidden");
        card.style.removeProperty("display");
      }
    });

    const m = lastMode;
    const layout = layouts()[m];
    const anchor = document.querySelector("[data-hb-board-anchor]");
    if (!layout || !Array.isArray(layout.items) || !anchor) return;
    const s = SHAPES[m];

    board = document.createElement("div");
    board.className = "hb-board";
    board.dataset.mode = m;
    board.style.setProperty("--hb-cols", s.cols);
    board.style.setProperty("--hb-gap", s.gap + "px");
    const parentWidth = anchor.parentNode.getBoundingClientRect().width;
    if (m === "desktop" && parentWidth < 700) {
      // Previewing the computer board on a phone: draw it full size, then shrink it to fit.
      const scale = parentWidth / DESIGN_WIDTH;
      board.style.width = DESIGN_WIDTH + "px";
      board.style.transform = `scale(${scale})`;
      board.dataset.scale = String(scale);
    }
    anchor.parentNode.insertBefore(board, anchor);

    const cards = new Map();
    document.querySelectorAll("[data-hb-card]:not([data-hb-hidden])").forEach(c => {
      if (!cards.has(c.getAttribute("data-hb-card"))) cards.set(c.getAttribute("data-hb-card"), c);
    });
    const place = (card, item) => {
      const home = document.createComment("hb-card-home");
      card.parentNode.replaceChild(home, card);
      card.__hbHome = home;
      const shape = SHAPES[m][item.shape] ? item.shape : "small";
      const [dw, dh] = SHAPES[m][shape];
      const w = Math.max(1, Math.min(s.cols, item.w || dw));
      const h = Math.max(1, item.h || dh);
      card.classList.add("hb-shape-" + shape);
      if (Number.isInteger(item.x) && Number.isInteger(item.y)) {
        card.style.gridColumn = `${Math.min(item.x, s.cols - w) + 1} / span ${w}`;
        card.style.gridRow = `${item.y + 1} / span ${h}`;
      } else {
        card.style.gridColumn = `span ${w}`;
        card.style.gridRow = `span ${h}`;
      }
      board.appendChild(card);
    };
    for (const item of layout.items) {
      const card = cards.get(item.card);
      if (!card) continue;
      place(card, item);
      cards.delete(item.card);
    }
    // Cards added after the layout was saved still show, in the next free spots.
    for (const card of cards.values()) place(card, { shape: "small" });

    document.querySelectorAll("[data-hb-board-list]").forEach(list => {
      if (list.querySelector("[data-hb-card]:not([data-hb-hidden])")) return;
      const section = list.closest("[data-hb-board-section]");
      if (section && !section.contains(board)) section.setAttribute("data-hb-emptied", "");
      else list.setAttribute("data-hb-emptied", "");
    });

    sizeCells();
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(sizeCells);
      resizeObs.observe(board);
    }
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (mode() !== lastMode) apply(); }, 150);
  });

  window.HBBoard = {
    apply,
    SHAPES,
    PHONE_MAX,
    screenMode,
    mode,
    board: () => board,
    hiddenList,
    layouts
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => apply());
  else apply();
})();
