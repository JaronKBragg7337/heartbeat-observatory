/**
 * The site editor. Loaded by hb-editor.js only in signed-in browsers, and
 * shown only when the database says this account is the site admin.
 *
 * How it works, in behavior:
 *  - Tap Edit. Links stop navigating; tapping anything selects it.
 *  - The panel shows the words it holds, its colors and its shape. Changes
 *    show on the page right away but are not saved yet.
 *  - Publish writes them into the page's real file in the repo (one commit),
 *    through /api/site-edit. Vercel redeploys; the change is live in about a
 *    minute. Every earlier version stays in git and can be put back from the
 *    History list.
 *
 * The editor never changes words on its own. It only writes what the admin typed.
 */
import { getSupabase } from "/hb-supabase.js";
import {
  parseSource, matchElement, pairTextPieces, textPatch, looseTextPatch, stylePatch, removePatch, attrPatch,
  rootColors, applyPatches, fileForPath, norm, liveText, attr
} from "/hb-editor-source.js";

const API = "/api/site-edit";
const ADMIN_CACHE = "hb_editor_admin";

const supabase = await getSupabase();

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function isAdmin() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(ADMIN_CACHE) || "null");
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.yes;
  } catch {}
  if (!(await accessToken())) return false;
  let yes = false;
  try {
    const { data } = await supabase.rpc("is_admin");
    yes = data === true;
  } catch {}
  try { sessionStorage.setItem(ADMIN_CACHE, JSON.stringify({ yes, at: Date.now() })); } catch {}
  return yes;
}

if (await isAdmin()) start();

/* ============================================================ */

function start() {
  const pageFile = fileForPath(location.pathname);

  /* ---------- UI shell, in a shadow root so no page's styles reach it ---------- */
  const host = document.createElement("div");
  host.setAttribute("data-hb-editor", "");
  // A zero-size host. A full-screen host with pointer-events:none looked harmless, but iPhone Safari then
  // scrolled the page instead of the panel on every swipe (Jaron, 2026-09-23). Each piece is fixed on its own.
  host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483646;";
  document.body.appendChild(host);
  const ui = host.attachShadow({ mode: "open" });
  ui.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .pill { position: fixed; left: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); pointer-events: auto;
    background: #1f2a2d; color: #fff; border: 1px solid rgba(255,255,255,.25); border-radius: 999px;
    padding: 10px 16px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,.3); cursor: pointer; }
  .pill .n { background: #e23a45; border-radius: 999px; padding: 1px 7px; margin-left: 6px; font-size: 12px; }
  .bar { position: fixed; left: 0; right: 0; top: 0; pointer-events: auto; display: none; z-index: 6;
    background: #1f2a2d; color: #fff; padding: calc(8px + env(safe-area-inset-top)) 8px 8px;
    gap: 5px; align-items: center; box-shadow: 0 2px 12px rgba(0,0,0,.3); overflow-x: auto; }
  @media (max-width: 480px) { .bar .title { display: none; } .bar button { padding: 8px 8px; } }
  .bar.on { display: flex; }
  .bar .title { flex: 1; font-size: 13px; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  button { font: inherit; cursor: pointer; border-radius: 10px; border: 1px solid #c9ccc6; background: #fff; color: #1f2a2d;
    padding: 9px 12px; font-size: 14px; min-height: 40px; }
  .bar button { background: transparent; color: #fff; border-color: rgba(255,255,255,.3); padding: 8px 10px; font-size: 13px; }
  .bar button.go { background: #3fb950; border-color: #3fb950; color: #06210c; font-weight: 700; }
  .bar button:disabled { opacity: .45; }
  .box { position: fixed; pointer-events: none; border: 2px solid #e23a45; border-radius: 4px; display: none;
    box-shadow: 0 0 0 2000px rgba(0,0,0,.0); transition: all .08s; }
  .hover { position: fixed; pointer-events: none; border: 1px dashed #e23a45; display: none; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 62vh; max-height: 62dvh; overflow-y: auto; pointer-events: auto;
    overscroll-behavior: contain; touch-action: pan-y; z-index: 5;
    background: #fbfaf7; color: #1f2a2d; border-radius: 16px 16px 0 0; box-shadow: 0 -4px 24px rgba(0,0,0,.25);
    padding: 14px 16px calc(16px + env(safe-area-inset-bottom)); display: none; -webkit-overflow-scrolling: touch; }
  .sheet.on { display: block; }
  .sheet.compact { max-height: 34vh; max-height: 34dvh; }
  .grab { position: fixed; z-index: 3; width: 44px; height: 44px; min-height: 0; padding: 0; border-radius: 12px;
    background: #1f2a2d; color: #fff; border: 2px solid #fff; font-size: 20px; line-height: 1; touch-action: none;
    box-shadow: 0 3px 10px rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; }
  .drop { position: fixed; pointer-events: none; border: 2px dashed #e23a45; border-radius: 14px; background: rgba(226,58,69,.08); display: none; }
  .cardbox { position: fixed; pointer-events: none; border: 2px solid #e23a45; border-radius: 18px; display: none; }
  @media (min-width: 760px) { .sheet { left: auto; right: 16px; bottom: 16px; width: 420px; border-radius: 16px; max-height: 80vh; } }
  .head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .head .what { flex: 1; font-weight: 700; font-size: 16px; }
  .small { font-size: 12px; color: #596769; line-height: 1.5; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #596769; margin: 16px 0 8px; font-weight: 700; }
  textarea, input[type=text] { width: 100%; font-size: 16px; padding: 10px 12px; border: 1px solid #c9ccc6;
    border-radius: 10px; background: #fff; color: #1f2a2d; line-height: 1.45; }
  textarea { min-height: 64px; resize: vertical; }
  textarea:disabled { background: #eeede8; color: #82908f; }
  .field { margin-bottom: 10px; }
  .row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
  .row label { flex: 1 1 120px; font-size: 14px; }
  .row input[type=color] { width: 48px; height: 40px; padding: 2px; border: 1px solid #c9ccc6; border-radius: 10px; background: #fff; }
  .row input[type=range] { flex: 1 1 140px; }
  .row .val { min-width: 44px; text-align: right; font-size: 13px; color: #596769; }
  .seg { display: inline-flex; border: 1px solid #c9ccc6; border-radius: 10px; overflow: hidden; }
  .seg button { border: none; border-radius: 0; min-height: 36px; padding: 6px 12px; }
  .seg button.on { background: #1f2a2d; color: #fff; }
  .danger { color: #b3261e; border-color: #e6b3ae; }
  .item { border-top: 1px solid #e3e1da; padding: 10px 0; display: flex; gap: 10px; align-items: flex-start; }
  .item:first-child { border-top: none; }
  .item .t { flex: 1; font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
  .swatch { width: 22px; height: 22px; border-radius: 6px; border: 1px solid #c9ccc6; display: inline-block; vertical-align: middle; }
  .toast { position: fixed; left: 50%; transform: translateX(-50%); top: calc(64px + env(safe-area-inset-top)); pointer-events: none;
    background: #1f2a2d; color: #fff; padding: 10px 14px; border-radius: 10px; font-size: 14px; max-width: 92vw;
    box-shadow: 0 4px 16px rgba(0,0,0,.3); display: none; line-height: 1.45; }
  .toast.on { display: block; }
  .toast.err { background: #b3261e; }
</style>
<button class="pill" id="pill">Edit</button>
<div class="bar" id="bar">
  <div class="title" id="bartitle">Tap anything to change it</div>
  <button id="bLayout" style="display:none">Layout</button>
  <button id="bPage">Page</button>
  <button id="bChanges">Changes</button>
  <button class="go" id="bPublish" disabled>Publish</button>
  <button id="bDone">Done</button>
</div>
<div class="hover" id="hover"></div>
<div class="box" id="box"></div>
<div class="cardbox" id="cardbox"></div>
<div id="handles"></div>
<div class="drop" id="drop"></div>
<div class="sheet" id="sheet"></div>
<div class="toast" id="toast"></div>`;

  const $ = id => ui.getElementById(id);
  const sheet = $("sheet"), box = $("box"), toast = $("toast");

  // The panel keeps its own swipes: it scrolls, and at its top or bottom edge the swipe stops there
  // instead of carrying on into the page behind it.
  let touchY = 0;
  sheet.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (e.target.closest && e.target.closest("input[type=range]")) return;
    const dy = e.touches[0].clientY - touchY;
    const atTop = sheet.scrollTop <= 0;
    const atBottom = sheet.scrollTop + sheet.clientHeight >= sheet.scrollHeight - 1;
    if (sheet.scrollHeight <= sheet.clientHeight || (atTop && dy > 0) || (atBottom && dy < 0)) e.preventDefault();
    e.stopPropagation();
  }, { passive: false });

  /* ---------- state ---------- */
  let editing = false;
  let tapStyle = null;
  let source = null;          // { file, sha, index }
  const sheets = new Map();   // linked stylesheet file -> { sha, src, colors }
  let selected = null;
  let childTrail = [];
  /** Live element -> pending change. */
  const pending = new Map();
  /** Stylesheet or page color edits: key -> { file, name, patch, revert } */
  const colorEdits = new Map();
  let titleEdit = null;
  /** Hidden-cards list and board layouts not yet published; null means "as the file says". */
  let hiddenDraft = null;
  let layoutDraft = null;
  /** "phone" or "desktop" while arranging the board, else null. */
  let arranging = null;

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));

  function say(text, isError) {
    toast.textContent = text;
    toast.className = "toast on" + (isError ? " err" : "");
    clearTimeout(say.t);
    say.t = setTimeout(() => { toast.className = "toast"; }, isError ? 7000 : 3500);
  }

  const ERRORS = {
    "not-configured": "The editor isn't switched on yet. The site needs its GitHub key (SITE_EDITOR_GITHUB_TOKEN) added in Vercel. Nothing was saved.",
    "sign-in-required": "You're signed out. Sign in at /admin and try again.",
    "session-not-valid": "Your sign-in expired. Sign in again at /admin.",
    "admin-only": "This account isn't the site admin.",
    "accounts-unreachable": "Couldn't reach the account service (Supabase) to confirm you're the admin. Nothing was saved.",
    "admin-check-failed": "The admin check failed on the account service (Supabase). Nothing was saved.",
    "file-changed": "This page's file changed since you opened the editor. Reload the page and make the change again. Nothing was saved.",
    "no-such-file": "This page isn't a plain file in the site, so it can't be edited here.",
    "file-too-large": "This page's file is too big to edit from here.",
    "github-error": "GitHub didn't accept the save. Try again in a minute. Nothing was saved.",
    "no-changes": "Nothing to save."
  };
  const errorText = code => ERRORS[code] || `Something went wrong (${code}). Nothing was saved.`;

  async function api(method, query, body) {
    const token = await accessToken();
    const r = await fetch(API + (query || ""), {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await r.json(); } catch {}
    if (!r.ok) throw new Error(data.error || `http-${r.status}`);
    return data;
  }

  async function loadSource() {
    const got = await api("GET", "?file=" + encodeURIComponent(pageFile));
    source = { file: got.file, sha: got.sha, index: parseSource(got.content) };
    resolvedCache = new WeakMap();
  }

  /**
   * Where an element's words live, worked out the first time it is tapped,
   * while the page still shows exactly what the file says. Typing changes the
   * page, so it is never worked out again from edited words.
   */
  let resolvedCache = new WeakMap();
  function resolved(el) {
    if (!resolvedCache.has(el)) resolvedCache.set(el, wordPieces(el));
    return resolvedCache.get(el);
  }

  /* ---------- names people use for things ---------- */
  const NAMES = { h1: "Main heading", h2: "Heading", h3: "Heading", h4: "Heading", h5: "Heading", h6: "Heading",
    p: "Paragraph", a: "Link", button: "Button", li: "List item", ul: "List", ol: "List", img: "Picture",
    section: "Section", header: "Top area", footer: "Bottom area", nav: "Menu", main: "Main area", article: "Card",
    aside: "Side box", span: "Words", strong: "Bold words", em: "Slanted words", b: "Bold words", i: "Slanted words",
    small: "Small words", label: "Label", body: "Whole page", div: "Block", figure: "Picture box", blockquote: "Quote",
    td: "Table cell", th: "Table heading", table: "Table", input: "Input box", form: "Form" };
  const nameOf = el => NAMES[el.tagName.toLowerCase()] || "Block";

  /* ---------- selection box follows the element ---------- */
  function place(el, node) {
    if (!el || !el.isConnected) { node.style.display = "none"; return; }
    const r = el.getBoundingClientRect();
    node.style.display = "block";
    node.style.left = r.left - 2 + "px";
    node.style.top = r.top - 2 + "px";
    node.style.width = r.width + 4 + "px";
    node.style.height = r.height + 4 + "px";
  }
  function follow() {
    if (editing && selected) place(selected, box);
    if (arranging) placeHandles();
    requestAnimationFrame(follow);
  }
  requestAnimationFrame(follow);

  /* ---------- entering and leaving edit mode ---------- */
  const isOurs = e => e.composedPath().includes(host);

  function blockClick(e) {
    if (!editing || isOurs(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.type !== "click") return;
    const target = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    if (arranging) {
      const card = target && target.closest("[data-hb-card]");
      if (card && boardEl() && boardEl().contains(card)) renderCardSheet(card);
      return;
    }
    if (target && target !== document.documentElement) select(target, true);
  }
  for (const type of ["click", "submit", "dblclick", "auxclick"]) document.addEventListener(type, blockClick, true);
  document.addEventListener("mouseover", e => {
    if (!editing || arranging || isOurs(e) || matchMedia("(pointer: coarse)").matches) return;
    place(e.target, $("hover"));
  }, true);

  $("pill").onclick = async () => {
    if (editing) return;
    $("pill").textContent = "Opening…";
    try {
      await loadSource();
    } catch (err) {
      $("pill").textContent = "Edit";
      say(errorText(err.message), true);
      return;
    }
    editing = true;
    tapStyle = document.createElement("style");
    tapStyle.setAttribute("data-hb-editor", "");
    // No tap flash, and no iPhone link-preview bubble on a long press while editing.
    tapStyle.textContent = "*{-webkit-tap-highlight-color:transparent!important;-webkit-touch-callout:none!important}" +
      "[data-hb-card]{-webkit-user-select:none!important;user-select:none!important}";
    document.head.appendChild(tapStyle);
    $("bLayout").style.display = window.HBBoard && jsonBlock("hb-layout") ? "" : "none";
    $("pill").style.display = "none";
    $("bar").classList.add("on");
    $("bartitle").textContent = "Tap anything to change it";
    refreshCount();
  };

  $("bDone").onclick = () => {
    if (count() && !confirm("You have changes that aren't published. Leave edit mode anyway? They stay on this screen until you reload, but won't be saved.")) return;
    if (arranging) stopArranging();
    editing = false;
    if (tapStyle) tapStyle.remove();
    selected = null;
    sheet.className = "sheet";
    box.style.display = "none";
    $("hover").style.display = "none";
    $("bar").classList.remove("on");
    $("pill").style.display = "";
    refreshCount();
  };

  window.addEventListener("beforeunload", e => {
    if (count()) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- pending changes ---------- */
  function entryFor(el) {
    if (!pending.has(el)) {
      pending.set(el, {
        el,
        srcEl: null,
        words: new Map(),       // live text node -> { original, now, patchFn }
        styles: {},             // prop -> value | null
        originalStyle: el.getAttribute("style"),
        remove: false,
        originalDisplay: el.style.display,
        href: null,
        originalHref: el.getAttribute("href")
      });
    }
    return pending.get(el);
  }
  function isEmptyEntry(p) {
    return !p.remove && !p.words.size && !Object.keys(p.styles).length && p.href === null;
  }
  function count() {
    let n = colorEdits.size + (titleEdit ? 1 : 0) + hiddenChanges().length + layoutChanges().length;
    for (const p of pending.values()) {
      n += p.words.size + Object.keys(p.styles).length + (p.remove ? 1 : 0) + (p.href !== null ? 1 : 0);
    }
    return n;
  }
  function refreshCount() {
    const n = count();
    $("bPublish").disabled = !n;
    $("bChanges").textContent = n ? `Changes (${n})` : "Changes";
    $("pill").innerHTML = n ? `Edit <span class="n">${n}</span>` : "Edit";
  }

  /* ---------- selecting an element ---------- */
  function select(el, fresh) {
    if (fresh) childTrail = [];
    selected = el;
    $("hover").style.display = "none";
    place(el, box);
    renderElementSheet();
    // Keep the chosen element above the panel.
    const r = el.getBoundingClientRect();
    const panelTop = innerHeight * 0.38;
    if (r.top > panelTop || r.bottom < 60) window.scrollBy({ top: r.top - 80, behavior: "smooth" });
  }

  /** Where each word piece of the selected element lives in the file. */
  function wordPieces(el) {
    const srcEl = source.index && matchElement(source.index, el, tag => Array.from(document.getElementsByTagName(tag)));
    const direct = Array.from(el.childNodes).filter(n => n.nodeType === 3 && norm(n.nodeValue));
    const pieces = [];
    const paired = srcEl ? pairTextPieces(el, srcEl) : null;
    for (const node of direct) {
      const original = node.nodeValue;
      const pair = paired && paired.find(p => p.live === node);
      if (pair) {
        pieces.push({ node, original, make: words => textPatch(pair.src, words) });
        continue;
      }
      const loose = looseTextPatch(source.index, norm(original), "x");
      if (loose.patch) {
        pieces.push({ node, original, make: words => looseTextPatch(source.index, norm(original), words).patch });
      } else {
        pieces.push({ node, original, why: loose.error === "ambiguous"
          ? `These exact words appear ${loose.count} times in this page's file, so the editor can't tell which one this is.`
          : "These words come from the database or another file, not this page's file, so they can't be changed here yet." });
      }
    }
    return { srcEl, pieces };
  }

  function toHex(color) {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(color || "");
    if (!m) {
      if (/^#[0-9a-f]{6}$/i.test(color)) return { hex: color.toLowerCase(), a: 1 };
      if (/^#[0-9a-f]{3}$/i.test(color)) return { hex: "#" + color.slice(1).split("").map(c => c + c).join("").toLowerCase(), a: 1 };
      if (/^#[0-9a-f]{8}$/i.test(color)) return { hex: color.slice(0, 7).toLowerCase(), a: parseInt(color.slice(7), 16) / 255 };
      return { hex: "#000000", a: 0 };
    }
    const hex = "#" + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, "0")).join("");
    let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { hex, a };
  }
  function withAlpha(hex, a) {
    if (a >= 1) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(a * 100) / 100})`;
  }

  function renderElementSheet() {
    const el = selected;
    const { srcEl, pieces } = resolved(el);
    const p = pending.get(el);
    const cs = getComputedStyle(el);
    const inFile = !!srcEl;
    const bg = toHex(cs.backgroundColor), fg = toHex(cs.color);
    const size = Math.round(parseFloat(cs.fontSize) || 16);
    const radius = Math.round(parseFloat(cs.borderTopLeftRadius) || 0);
    const pad = Math.round(parseFloat(cs.paddingTop) || 0);
    const align = cs.textAlign === "start" ? "left" : cs.textAlign === "end" ? "right" : cs.textAlign;
    const bold = (parseInt(cs.fontWeight, 10) || 400) >= 600;
    const isLink = el.tagName === "A";
    const hasWordsBelow = !pieces.length && norm(liveText(el));

    let html = `<div class="head"><div class="what">${esc(nameOf(el))}</div>
      ${el.parentElement && el !== document.body ? `<button id="up">Bigger area</button>` : ""}
      ${childTrail.length ? `<button id="down">Smaller</button>` : ""}
      <button id="close">Close</button></div>`;

    const card = el.closest("[data-hb-card]");
    if (card && jsonBlock("hb-hidden-cards")) {
      html += `<h3>Card</h3><div class="row"><label>Part of the card “${esc(cardName(card))}”</label><button class="danger" id="hideCard">Hide this card</button></div>`;
    }

    html += `<h3>Words</h3>`;
    if (pieces.length) {
      pieces.forEach((piece, k) => {
        const now = p?.words.get(piece.node)?.now ?? norm(piece.node.nodeValue);
        html += `<div class="field"><textarea data-k="${k}" ${piece.why ? "disabled" : ""} rows="${Math.min(8, Math.ceil(now.length / 34) + 1)}">${esc(now)}</textarea>
          ${piece.why ? `<div class="small">${esc(piece.why)}</div>` : ""}</div>`;
      });
    } else if (hasWordsBelow) {
      html += `<div class="small">The words here are inside smaller pieces. Tap the words themselves to change them.</div>`;
    } else {
      html += `<div class="small">No words in this piece.</div>`;
    }

    if (isLink) {
      const href = p?.href ?? el.getAttribute("href") ?? "";
      html += `<h3>Link goes to</h3><div class="field"><input type="text" id="href" value="${esc(href)}" ${inFile ? "" : "disabled"} autocapitalize="off" autocorrect="off" spellcheck="false"></div>`;
    }

    html += `<h3>Look</h3>`;
    if (!inFile) {
      html += `<div class="small">This piece is made by the page's code while it runs, not written in the page's file, so its look can't be saved from here.</div>`;
    } else {
      html += `
      <div class="row"><label>Background${bg.a === 0 ? ` <span class="small">(none now)</span>` : ""}</label><input type="color" id="bg" value="${bg.a === 0 ? "#ffffff" : bg.hex}"><button id="bgClear">None</button></div>
      <div class="row"><label>Text color</label><input type="color" id="fg" value="${fg.hex}"></div>
      <div class="row"><label>Text size</label><button id="fsDown">A−</button><span class="val" id="fsVal">${size}px</span><button id="fsUp">A+</button></div>
      <div class="row"><label>Bold</label><div class="seg"><button id="bOff" class="${bold ? "" : "on"}">Normal</button><button id="bOn" class="${bold ? "on" : ""}">Bold</button></div></div>
      <div class="row"><label>Line up</label><div class="seg">
        ${["left", "center", "right"].map(a => `<button data-align="${a}" class="${align === a ? "on" : ""}">${a[0].toUpperCase() + a.slice(1)}</button>`).join("")}</div></div>
      <div class="row"><label>Rounded corners</label><input type="range" id="rad" min="0" max="48" value="${Math.min(radius, 48)}"><span class="val" id="radVal">${radius}px</span></div>
      <div class="row"><label>Space inside</label><input type="range" id="pad" min="0" max="64" value="${Math.min(pad, 64)}"><span class="val" id="padVal">${pad}px</span></div>
      ${el !== document.body ? `<h3>Remove</h3><button class="danger" id="remove">${p?.remove ? "Put it back" : "Take this off the page"}</button>` : ""}
      ${p && Object.keys(p.styles).length ? `<div class="row" style="margin-top:12px"><button id="resetLook">Undo look changes here</button></div>` : ""}`;
    }
    sheet.innerHTML = html;
    sheet.className = "sheet on";
    $("bartitle").textContent = nameOf(el);

    ui.getElementById("close").onclick = () => { sheet.className = "sheet"; selected = null; box.style.display = "none"; };
    const hideBtn = ui.getElementById("hideCard");
    if (hideBtn) hideBtn.onclick = () => {
      hideCard(card);
      sheet.className = "sheet"; selected = null; box.style.display = "none";
    };
    const up = ui.getElementById("up");
    if (up) up.onclick = () => { childTrail.push(el); select(el.parentElement, false); };
    const down = ui.getElementById("down");
    if (down) down.onclick = () => select(childTrail.pop(), false);

    sheet.querySelectorAll("textarea[data-k]").forEach(ta => {
      const piece = pieces[+ta.dataset.k];
      ta.oninput = () => {
        const words = ta.value.replace(/\s*\n\s*/g, " ");
        const entry = entryFor(el);
        if (norm(words) === norm(piece.original)) {
          entry.words.delete(piece.node);
          piece.node.nodeValue = piece.original;
        } else {
          const lead = /^\s*/.exec(piece.original)[0], trail = /\s*$/.exec(piece.original)[0];
          piece.node.nodeValue = lead + words.trim() + trail;
          entry.words.set(piece.node, { original: piece.original, now: words.trim(), make: piece.make });
        }
        if (isEmptyEntry(entry)) pending.delete(el);
        refreshCount();
      };
    });

    if (!inFile) return;
    const entry = () => { const e = entryFor(el); e.srcEl = srcEl; return e; };
    const setStyle = (prop, value) => {
      const e = entry();
      e.styles[prop] = value;
      if (value === null) el.style.removeProperty(prop); else el.style.setProperty(prop, value);
      refreshCount();
    };

    const href = ui.getElementById("href");
    if (href) href.oninput = () => {
      const e = entry();
      e.href = href.value.trim() === (e.originalHref || "") ? null : href.value.trim();
      if (isEmptyEntry(e)) pending.delete(el);
      refreshCount();
    };
    ui.getElementById("bg").oninput = ev => setStyle("background", withAlpha(ev.target.value, bg.a > 0 ? bg.a : 1));
    ui.getElementById("bgClear").onclick = () => setStyle("background", "none");
    ui.getElementById("fg").oninput = ev => setStyle("color", withAlpha(ev.target.value, fg.a || 1));
    let fs = size;
    const fsShow = () => { ui.getElementById("fsVal").textContent = fs + "px"; setStyle("font-size", fs + "px"); };
    ui.getElementById("fsDown").onclick = () => { fs = Math.max(8, fs - 1); fsShow(); };
    ui.getElementById("fsUp").onclick = () => { fs = Math.min(120, fs + 1); fsShow(); };
    ui.getElementById("bOff").onclick = () => { setStyle("font-weight", "400"); renderElementSheet(); };
    ui.getElementById("bOn").onclick = () => { setStyle("font-weight", "700"); renderElementSheet(); };
    sheet.querySelectorAll("[data-align]").forEach(b => { b.onclick = () => { setStyle("text-align", b.dataset.align); renderElementSheet(); }; });
    const rad = ui.getElementById("rad");
    rad.oninput = () => { ui.getElementById("radVal").textContent = rad.value + "px"; setStyle("border-radius", rad.value + "px"); };
    const pad2 = ui.getElementById("pad");
    pad2.oninput = () => { ui.getElementById("padVal").textContent = pad2.value + "px"; setStyle("padding", pad2.value + "px"); };
    const rm = ui.getElementById("remove");
    if (rm) rm.onclick = () => {
      const e = entry();
      if (!e.remove && !confirm("Take this off the page? You can put it back before you publish, and from History after.")) return;
      e.remove = !e.remove;
      el.style.display = e.remove ? "none" : e.originalDisplay;
      if (e.remove) { sheet.className = "sheet"; selected = null; box.style.display = "none"; say("Taken off. Publish to save it."); }
      if (isEmptyEntry(e)) pending.delete(el);
      refreshCount();
      if (!e.remove) renderElementSheet();
    };
    const reset = ui.getElementById("resetLook");
    if (reset) reset.onclick = () => {
      const e = entry();
      e.styles = {};
      if (e.originalStyle === null) el.removeAttribute("style"); else el.setAttribute("style", e.originalStyle);
      if (isEmptyEntry(e)) pending.delete(el);
      refreshCount();
      renderElementSheet();
    };
  }

  /* ---------- the Page panel: tab title, page colors, history ---------- */
  async function loadSheets() {
    const links = Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'));
    for (const link of links) {
      const url = new URL(link.getAttribute("href"), location.href);
      if (url.origin !== location.origin) continue;
      const file = fileForPath(url.pathname);
      if (sheets.has(file) || !file.endsWith(".css")) continue;
      try {
        const got = await api("GET", "?file=" + encodeURIComponent(file));
        sheets.set(file, { sha: got.sha, src: got.content, colors: rootColors(got.content) });
      } catch {}
    }
  }

  function pageColors() {
    const out = [];
    for (const el of source.index.elements) {
      if (el.tag !== "style" || !el.children[0]) continue;
      const text = el.children[0];
      for (const c of rootColors(text.raw, text.start)) out.push({ ...c, file: source.file });
    }
    for (const [file, s] of sheets) for (const c of s.colors) out.push({ ...c, file });
    // A page's own color wins over the shared stylesheet's, as it does in the browser.
    const seen = new Set();
    return out.filter(c => (seen.has(c.name) ? false : (seen.add(c.name), true)));
  }

  const friendly = name => name.replace(/^--/, "").replace(/[-_]+/g, " ");

  async function renderPageSheet() {
    selected = null;
    box.style.display = "none";
    sheet.className = "sheet on";
    sheet.innerHTML = `<div class="head"><div class="what">This page</div><button id="close">Close</button></div><div class="small">Loading…</div>`;
    ui.getElementById("close").onclick = () => { sheet.className = "sheet"; };
    await loadSheets();
    const titleEl = source.index.elements.find(e => e.tag === "title");
    const titleText = titleEl && titleEl.children[0];
    const colors = pageColors();

    let html = `<div class="head"><div class="what">This page</div><button id="close">Close</button></div>`;
    if (titleText) {
      html += `<h3>Name in the browser tab</h3><div class="field"><input type="text" id="ptitle" value="${esc(titleEdit ? titleEdit.now : norm(titleText.text))}"></div>`;
    }
    html += `<h3>Colors</h3>`;
    if (!colors.length) html += `<div class="small">This page doesn't keep its colors in named settings. Tap a block and use its Background instead.</div>`;
    const shared = colors.some(c => c.file !== source.file);
    if (shared) html += `<div class="small" style="margin-bottom:8px">Colors marked "shared" come from a stylesheet other pages use too. Changing them changes those pages.</div>`;
    colors.forEach((c, k) => {
      const key = c.file + c.name;
      const now = colorEdits.get(key)?.value ?? c.value;
      const { hex } = toHex(now);
      html += `<div class="row"><label>${esc(friendly(c.name))}${c.file !== source.file ? ` <span class="small">(shared)</span>` : ""}</label>
        <input type="color" data-c="${k}" value="${hex}"></div>`;
    });
    if (jsonBlock("hb-hidden-cards")) {
      const hidden = currentHidden();
      html += `<h3>Hidden cards</h3>` + (hidden.length
        ? hidden.map(c => `<div class="item"><div class="t">${esc(c.name || c.key)}</div><button data-show="${esc(c.key)}">Show again</button></div>`).join("")
        : `<div class="small">None. Tap a card and choose Hide this card.</div>`);
    }
    html += `<h3>History</h3><div class="small">Every save is kept. Put back any earlier version of this page.</div><div id="hist"><div class="small">Loading…</div></div>`;
    sheet.innerHTML = html;
    ui.getElementById("close").onclick = () => { sheet.className = "sheet"; };

    sheet.querySelectorAll("[data-show]").forEach(b => {
      b.onclick = () => { showCard(b.dataset.show); renderPageSheet(); };
    });

    const pt = ui.getElementById("ptitle");
    if (pt) pt.oninput = () => {
      const words = pt.value.trim();
      if (words === norm(titleText.text)) titleEdit = null;
      else titleEdit = { now: words, patch: () => textPatch(titleText, words) };
      document.title = words;
      refreshCount();
    };

    sheet.querySelectorAll("input[data-c]").forEach(input => {
      const c = colors[+input.dataset.c];
      const key = c.file + c.name;
      input.oninput = () => {
        const { a } = toHex(c.value);
        const value = withAlpha(input.value, a > 0 ? a : 1);
        document.documentElement.style.setProperty(c.name, value);
        if (value === c.value) colorEdits.delete(key);
        else colorEdits.set(key, { file: c.file, name: c.name, value,
          patch: { start: c.start, end: c.end, expect: c.value, replace: value } });
        refreshCount();
      };
    });

    try {
      const { commits } = await api("GET", "?history=" + encodeURIComponent(source.file));
      const hist = ui.getElementById("hist");
      if (!hist) return;
      hist.innerHTML = commits.map((c, k) => `<div class="item"><div class="t">${esc(c.message)}<div class="small">${esc(new Date(c.date).toLocaleString())}${k === 0 ? " · now live" : ""}</div></div>
        ${k === 0 ? "" : `<button data-restore="${esc(c.sha)}">Put back</button>`}</div>`).join("") || `<div class="small">No history found.</div>`;
      hist.querySelectorAll("[data-restore]").forEach(b => {
        b.onclick = async () => {
          if (!confirm("Put this page back the way it was at that save? The current version stays in History too.")) return;
          b.disabled = true;
          try {
            await api("POST", "", { action: "restore", file: source.file, commit: b.dataset.restore });
            say("Put back. Live in about a minute. Reload then to see it.");
            await loadSource();
            renderPageSheet();
          } catch (err) {
            b.disabled = false;
            say(errorText(err.message), true);
          }
        };
      });
    } catch (err) {
      const hist = ui.getElementById("hist");
      if (hist) hist.innerHTML = `<div class="small">${esc(errorText(err.message))}</div>`;
    }
  }
  $("bPage").onclick = () => renderPageSheet().catch(err => say(errorText(err.message), true));

  /* ---------- the Changes list ---------- */
  function describe() {
    const items = [];
    const short = s => (s.length > 70 ? s.slice(0, 67) + "…" : s);
    if (titleEdit) items.push({ text: `Tab name → "${short(titleEdit.now)}"`, undo: () => { titleEdit = null; document.title = norm(source.index.elements.find(e => e.tag === "title").children[0].text); } });
    for (const [key, c] of colorEdits) items.push({ text: `<span class="swatch" style="background:${esc(c.value)}"></span> ${esc(friendly(c.name))}`, html: true,
      undo: () => { colorEdits.delete(key); document.documentElement.style.removeProperty(c.name); } });
    for (const ch of hiddenChanges()) items.push({ text: ch.hidden ? `Card hidden: ${ch.name}` : `Card shown again: ${ch.name}`, undo: () => {
      hiddenDraft = ch.hidden ? currentHidden().filter(c => c.key !== ch.key) : currentHidden().concat([{ key: ch.key, name: ch.name }]);
      if (!hiddenChanges().length) hiddenDraft = null;
      previewBoard();
    } });
    for (const m of layoutChanges()) items.push({ text: `${m === "phone" ? "Phone" : "Computer"} layout ${currentLayouts()[m] ? "arranged" : "cleared"}`, undo: () => {
      layoutDraft = { ...currentLayouts(), [m]: fileLayouts()[m] };
      if (!layoutChanges().length) layoutDraft = null;
      previewBoard();
    } });
    for (const p of pending.values()) {
      for (const [node, w] of p.words) items.push({ text: `"${short(norm(w.original))}" → "${short(w.now)}"`,
        undo: () => { node.nodeValue = w.original; p.words.delete(node); if (isEmptyEntry(p)) pending.delete(p.el); } });
      if (Object.keys(p.styles).length) items.push({ text: `${nameOf(p.el)}: look changed (${Object.keys(p.styles).join(", ").replace(/-/g, " ")})`,
        undo: () => { p.styles = {}; if (p.originalStyle === null) p.el.removeAttribute("style"); else p.el.setAttribute("style", p.originalStyle); if (isEmptyEntry(p)) pending.delete(p.el); } });
      if (p.href !== null) items.push({ text: `Link → ${short(p.href)}`, undo: () => { p.href = null; if (isEmptyEntry(p)) pending.delete(p.el); } });
      if (p.remove) items.push({ text: `${nameOf(p.el)} taken off: "${short(norm(liveText(p.el)) || "(no words)")}"`,
        undo: () => { p.remove = false; p.el.style.display = p.originalDisplay; if (isEmptyEntry(p)) pending.delete(p.el); } });
    }
    return items;
  }
  function renderChanges() {
    selected = null;
    box.style.display = "none";
    const items = describe();
    sheet.innerHTML = `<div class="head"><div class="what">Changes not published yet</div><button id="close">Close</button></div>` +
      (items.length ? items.map((it, k) => `<div class="item"><div class="t">${it.html ? it.text : esc(it.text)}</div><button data-u="${k}">Undo</button></div>`).join("")
        : `<div class="small">None yet. Tap anything on the page to change it.</div>`);
    sheet.className = "sheet on";
    ui.getElementById("close").onclick = () => { sheet.className = "sheet"; };
    sheet.querySelectorAll("[data-u]").forEach(b => { b.onclick = () => { items[+b.dataset.u].undo(); refreshCount(); renderChanges(); }; });
  }
  $("bChanges").onclick = renderChanges;

  /* ---------- cards and the board ---------- */
  function jsonBlock(id) {
    return source && source.index.elements.find(e => e.tag === "script" && attr(e, "id") === id) || null;
  }
  function fileJson(id, fallback) {
    const el = jsonBlock(id);
    try { return el && el.children[0] ? JSON.parse(el.children[0].raw) : fallback; } catch { return fallback; }
  }
  const asCard = c => (typeof c === "string" ? { key: c, name: c } : c);
  const fileHidden = () => (fileJson("hb-hidden-cards", []) || []).map(asCard);
  const currentHidden = () => (hiddenDraft || fileHidden()).map(asCard);
  const fileLayouts = () => ({ desktop: null, phone: null, ...(fileJson("hb-layout", {}) || {}) });
  const currentLayouts = () => layoutDraft || fileLayouts();
  const boardEl = () => (window.HBBoard ? HBBoard.board() : null);
  const cardName = card => norm((card.querySelector("h3, .surface-name") || card).textContent).slice(0, 60) || card.getAttribute("data-hb-card");

  function hiddenChanges() {
    if (!hiddenDraft) return [];
    const before = new Map(fileHidden().map(c => [c.key, c]));
    const after = new Map(currentHidden().map(c => [c.key, c]));
    const out = [];
    for (const [key, c] of after) if (!before.has(key)) out.push({ key, name: c.name || key, hidden: true });
    for (const [key, c] of before) if (!after.has(key)) out.push({ key, name: c.name || key, hidden: false });
    return out;
  }
  function layoutChanges() {
    if (!layoutDraft) return [];
    const f = fileLayouts();
    return ["phone", "desktop"].filter(m => JSON.stringify(layoutDraft[m] ?? null) !== JSON.stringify(f[m] ?? null));
  }

  function jsonPatch(id, value) {
    const el = jsonBlock(id);
    const text = JSON.stringify(value).replace(/</g, "\\u003c");
    const t = el.children[0];
    return t ? { start: t.start, end: t.end, expect: t.raw, replace: text } : { start: el.startEnd, end: el.startEnd, expect: "", replace: text };
  }

  function previewBoard() {
    if (!window.HBBoard) return;
    const draft = hiddenDraft || layoutDraft || arranging;
    HBBoard.apply(draft ? { hidden: currentHidden(), layout: currentLayouts(), mode: arranging || undefined } : null);
    refreshCount();
  }

  function hideCard(card) {
    const key = card.getAttribute("data-hb-card");
    if (currentHidden().some(c => c.key === key)) return;
    hiddenDraft = currentHidden().concat([{ key, name: cardName(card) }]);
    if (!hiddenChanges().length) hiddenDraft = null;
    previewBoard();
    say(`“${cardName(card)}” hidden. Publish to save it. Page → Hidden cards brings it back.`);
  }
  function showCard(key) {
    hiddenDraft = currentHidden().filter(c => c.key !== key);
    if (!hiddenChanges().length) hiddenDraft = null;
    previewBoard();
  }

  /* Layout: a grid of square cells. Each card has a spot (x, y) and a shape. */
  const shapeTable = m => HBBoard.SHAPES[m];
  const SHAPE_NAMES = { small: "Small", wide: "Wide", tall: "Tall", big: "Big", round: "Round" };

  function defaultShape(key) {
    if (key.startsWith("world-")) return "round";
    if (key.startsWith("studio-")) return "wide";
    return "small";
  }

  /** A first arrangement: every visible card, in page order, packed row by row. */
  function startingLayout(m) {
    const t = shapeTable(m);
    const items = [];
    let x = 0, y = 0, rowH = 0;
    const seen = new Set();
    document.querySelectorAll("[data-hb-card]:not([data-hb-hidden])").forEach(card => {
      const key = card.getAttribute("data-hb-card");
      if (seen.has(key)) return;
      seen.add(key);
      const shape = defaultShape(key);
      const [w, h] = t[shape];
      if (x + w > t.cols) { x = 0; y += rowH; rowH = 0; }
      items.push({ card: key, x, y, w, h, shape });
      x += w;
      rowH = Math.max(rowH, h);
    });
    return { cols: t.cols, items };
  }

  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  /** Anything the moved card now covers slides down below it, and so on down the board. */
  function settle(items, moved) {
    const queue = [moved];
    let guard = 0;
    while (queue.length && guard++ < 2000) {
      const m = queue.shift();
      for (const o of items) {
        if (o === m || !overlaps(o, m)) continue;
        o.y = m.y + m.h;
        queue.push(o);
      }
    }
  }

  function draftLayout(m) {
    if (!layoutDraft) layoutDraft = JSON.parse(JSON.stringify(fileLayouts()));
    if (!layoutDraft[m]) layoutDraft[m] = startingLayout(m);
    return layoutDraft[m];
  }

  function renderLayoutSheet() {
    selected = null;
    box.style.display = "none";
    $("cardbox").style.display = "none";
    const has = !!currentLayouts()[arranging];
    sheet.innerHTML = `<div class="head"><div class="what">Arrange the board</div><button id="layDone">Done arranging</button></div>
      <div class="row"><label>Arranging for</label><div class="seg">
        <button data-mode="phone" class="${arranging === "phone" ? "on" : ""}">Phone</button>
        <button data-mode="desktop" class="${arranging === "desktop" ? "on" : ""}">Computer</button></div></div>
      <div class="small">Drag a card by its ✥ handle. Tap a card to change its shape or hide it.
        ${arranging === "desktop" && innerWidth <= HBBoard.PHONE_MAX ? "This is the computer board, shrunk to fit your screen." : ""}
        ${!has ? "No layout saved for this one yet; the page shows its normal list." : ""}</div>
      <div class="row" style="margin-top:10px">${has ? `<button class="danger" id="layClear">Back to the normal list</button>` : `<button id="layStart">Start a board</button>`}</div>`;
    sheet.className = "sheet on compact";
    ui.getElementById("layDone").onclick = stopArranging;
    sheet.querySelectorAll("[data-mode]").forEach(b => { b.onclick = () => { arranging = b.dataset.mode; previewBoard(); renderLayoutSheet(); }; });
    const clear = ui.getElementById("layClear");
    if (clear) clear.onclick = () => {
      if (!confirm("Clear this board? The page goes back to its normal list for this screen size. Undo is in Changes.")) return;
      layoutDraft = { ...currentLayouts(), [arranging]: null };
      if (!layoutChanges().length) layoutDraft = null;
      previewBoard();
      renderLayoutSheet();
    };
    const startBtn = ui.getElementById("layStart");
    if (startBtn) startBtn.onclick = () => { draftLayout(arranging); previewBoard(); renderLayoutSheet(); };
  }

  function renderCardSheet(card) {
    const key = card.getAttribute("data-hb-card");
    const layout = currentLayouts()[arranging];
    const item = layout && layout.items.find(i => i.card === key);
    const shape = item ? item.shape : "small";
    place(card, $("cardbox"));
    sheet.innerHTML = `<div class="head"><div class="what">${esc(cardName(card))}</div><button id="back">Back</button></div>
      <div class="row"><div class="seg">${Object.keys(SHAPE_NAMES).map(s2 => `<button data-shape="${s2}" class="${s2 === shape ? "on" : ""}">${SHAPE_NAMES[s2]}</button>`).join("")}</div></div>
      <div class="row"><button class="danger" id="hideCard">Hide this card</button></div>`;
    sheet.className = "sheet on compact";
    ui.getElementById("back").onclick = renderLayoutSheet;
    ui.getElementById("hideCard").onclick = () => { hideCard(card); renderLayoutSheet(); };
    sheet.querySelectorAll("[data-shape]").forEach(b => {
      b.onclick = () => {
        const lay = draftLayout(arranging);
        let it = lay.items.find(i => i.card === key);
        if (!it) { it = { card: key, x: 0, y: 0, w: 1, h: 1, shape: "small" }; lay.items.push(it); }
        const [w, h] = shapeTable(arranging)[b.dataset.shape];
        Object.assign(it, { shape: b.dataset.shape, w, h, x: Math.min(it.x || 0, shapeTable(arranging).cols - w) });
        settle(lay.items, it);
        previewBoard();
        renderCardSheet(card);
      };
    });
  }

  /* Handles: one per card, drawn by the editor over the page, never inside the page's own markup. */
  let dragging = null;
  function placeHandles() {
    const wrap = $("handles");
    const b = boardEl();
    const cards = b && !dragging ? Array.from(b.querySelectorAll(":scope > [data-hb-card]")) : [];
    if (dragging) return;
    while (wrap.children.length > cards.length) wrap.lastChild.remove();
    cards.forEach((card, k) => {
      let h = wrap.children[k];
      if (!h) {
        h = document.createElement("button");
        h.className = "grab";
        h.textContent = "✥";
        h.setAttribute("aria-label", "Drag this card");
        h.addEventListener("pointerdown", startDrag);
        wrap.appendChild(h);
      }
      h.dataset.card = card.getAttribute("data-hb-card");
      const r = card.getBoundingClientRect();
      const round = card.classList.contains("hb-shape-round");
      h.style.left = r.left + (round ? r.width / 2 - 22 : r.width - 50) + "px";
      h.style.top = r.top + 6 + "px";
      h.style.display = r.bottom < 0 || r.top > innerHeight ? "none" : "flex";
    });
  }

  function startDrag(e) {
    e.preventDefault();
    const key = e.currentTarget.dataset.card;
    const b = boardEl();
    const card = b && b.querySelector(`:scope > [data-hb-card="${CSS.escape(key)}"]`);
    if (!card) return;
    const lay = draftLayout(arranging);
    let item = lay.items.find(i => i.card === key);
    if (!item) {
      const [w, h] = shapeTable(arranging).small;
      item = { card: key, x: 0, y: 0, w, h, shape: "small" };
      lay.items.push(item);
    }
    const scale = parseFloat(b.dataset.scale || "1");
    const cell = parseFloat(getComputedStyle(b).getPropertyValue("--hb-cell")) || 80;
    const step = cell + shapeTable(arranging).gap;
    const cr = card.getBoundingClientRect();
    dragging = { key, card, item, scale, step, offX: (e.clientX - cr.left) / scale, offY: (e.clientY - cr.top) / scale,
      px: e.clientX, py: e.clientY, col: item.x, row: item.y, pointerId: e.pointerId, handle: e.currentTarget };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.addEventListener("pointermove", moveDrag);
    e.currentTarget.addEventListener("pointerup", endDrag);
    e.currentTarget.addEventListener("pointercancel", endDrag);
    card.style.zIndex = "5";
    card.style.opacity = ".92";
    card.style.transition = "none";
    sheet.className = "sheet";
    $("cardbox").style.display = "none";
    requestAnimationFrame(dragFrame);
  }
  function moveDrag(e) {
    if (!dragging) return;
    dragging.px = e.clientX;
    dragging.py = e.clientY;
  }
  function dragFrame() {
    if (!dragging) return;
    const d = dragging;
    // Near the top or bottom of the screen, the page scrolls so a card can travel the whole board.
    if (d.py < 90) window.scrollBy(0, -12);
    else if (d.py > innerHeight - 90) window.scrollBy(0, 12);
    const b = boardEl();
    const br = b.getBoundingClientRect();
    const cols = shapeTable(arranging).cols;
    const bx = (d.px - br.left) / d.scale - d.offX;
    const by = (d.py - br.top) / d.scale - d.offY;
    d.col = Math.max(0, Math.min(cols - d.item.w, Math.round(bx / d.step)));
    d.row = Math.max(0, Math.round(by / d.step));
    d.card.style.transform = `translate(${bx - d.item.x * d.step}px, ${by - d.item.y * d.step}px)`;
    const drop = $("drop");
    drop.style.display = "block";
    drop.style.left = br.left + d.col * d.step * d.scale + "px";
    drop.style.top = br.top + d.row * d.step * d.scale + "px";
    drop.style.width = (d.item.w * d.step - shapeTable(arranging).gap) * d.scale + "px";
    drop.style.height = (d.item.h * d.step - shapeTable(arranging).gap) * d.scale + "px";
    d.handle.style.left = d.px - 22 + "px";
    d.handle.style.top = d.py - 22 + "px";
    requestAnimationFrame(dragFrame);
  }
  function endDrag() {
    const d = dragging;
    if (!d) return;
    dragging = null;
    d.handle.removeEventListener("pointermove", moveDrag);
    d.handle.removeEventListener("pointerup", endDrag);
    d.handle.removeEventListener("pointercancel", endDrag);
    $("drop").style.display = "none";
    d.card.style.transform = "";
    d.card.style.zIndex = "";
    d.card.style.opacity = "";
    d.card.style.transition = "";
    d.item.x = d.col;
    d.item.y = d.row;
    settle(draftLayout(arranging).items, d.item);
    previewBoard();
    renderLayoutSheet();
  }

  function startArranging() {
    selected = null;
    box.style.display = "none";
    arranging = HBBoard.screenMode();
    previewBoard();
    renderLayoutSheet();
  }
  function stopArranging() {
    arranging = null;
    $("handles").innerHTML = "";
    $("cardbox").style.display = "none";
    sheet.className = "sheet";
    previewBoard();
  }
  $("bLayout").onclick = () => (arranging ? stopArranging() : startArranging());

  /* ---------- publishing ---------- */
  function buildPagePatches() {
    const patches = [];
    const removed = [];
    for (const p of pending.values()) if (p.remove && p.srcEl) removed.push([p.srcEl.start, p.srcEl.end]);
    const insideRemoved = patch => removed.some(([a, b]) => patch.start >= a && patch.end <= b && !(patch.start === a && patch.end === b));
    for (const p of pending.values()) {
      if (p.remove && p.srcEl) { patches.push(removePatch(source.index, p.srcEl)); continue; }
      for (const w of p.words.values()) patches.push(w.make(w.now));
      if (p.srcEl && Object.keys(p.styles).length) {
        const sp = stylePatch(source.index, p.srcEl, p.styles);
        if (sp) patches.push(sp);
      }
      if (p.srcEl && p.href !== null) patches.push(attrPatch(source.index, p.srcEl, "href", p.href));
    }
    if (titleEdit) patches.push(titleEdit.patch());
    for (const c of colorEdits.values()) if (c.file === source.file) patches.push(c.patch);
    if (hiddenChanges().length) patches.push(jsonPatch("hb-hidden-cards", currentHidden()));
    if (layoutChanges().length) patches.push(jsonPatch("hb-layout", currentLayouts()));
    return patches.filter(pt => pt && !insideRemoved(pt));
  }

  function summary() {
    const words = [];
    for (const p of pending.values()) for (const w of p.words.values()) words.push(`"${w.now.slice(0, 40)}"`);
    const bits = [];
    if (words.length) bits.push("words " + words.slice(0, 2).join(", ") + (words.length > 2 ? ` +${words.length - 2}` : ""));
    const looks = [...pending.values()].filter(p => Object.keys(p.styles).length).length;
    if (looks) bits.push(`look of ${looks} piece${looks === 1 ? "" : "s"}`);
    const removed = [...pending.values()].filter(p => p.remove).length;
    if (removed) bits.push(`took off ${removed}`);
    if ([...colorEdits.values()].some(c => c.file === source.file)) bits.push("colors");
    if (titleEdit) bits.push("tab name");
    const hc = hiddenChanges();
    if (hc.length) bits.push(hc.map(c => (c.hidden ? "hid " : "showed ") + c.name).join(", "));
    for (const m of layoutChanges()) bits.push(`${m === "phone" ? "phone" : "computer"} layout`);
    return bits.join("; ");
  }

  $("bPublish").onclick = async () => {
    const btn = $("bPublish");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      const patches = buildPagePatches();
      // Check locally first; the server checks again before it writes.
      if (patches.length) applyPatches(source.index.src, patches);
      if (patches.length) {
        await api("POST", "", { action: "publish", file: source.file, sha: source.sha, patches, summary: summary() });
      }
      // The page file is saved; forget its changes before touching any shared stylesheet.
      pending.clear();
      titleEdit = null;
      for (const [key, c] of colorEdits) if (c.file === source.file) colorEdits.delete(key);
      if (hiddenDraft || layoutDraft) {
        // The file now says what the drafts said; make the page's own copy say it too.
        const liveHidden = document.getElementById("hb-hidden-cards");
        const liveLayout = document.getElementById("hb-layout");
        if (liveHidden) liveHidden.textContent = JSON.stringify(currentHidden());
        if (liveLayout) liveLayout.textContent = JSON.stringify(currentLayouts());
        hiddenDraft = null;
        layoutDraft = null;
      }
      await loadSource();
      previewBoard();
      const bySheet = new Map();
      for (const c of colorEdits.values()) {
        if (!bySheet.has(c.file)) bySheet.set(c.file, []);
        bySheet.get(c.file).push(c.patch);
      }
      for (const [file, list] of bySheet) {
        await api("POST", "", { action: "publish", file, sha: sheets.get(file).sha, patches: list, summary: "colors" });
        for (const [key, c] of colorEdits) if (c.file === file) colorEdits.delete(key);
        sheets.delete(file);
      }
      sheet.className = "sheet";
      selected = null;
      box.style.display = "none";
      say("Saved. It will be live in about a minute.");
    } catch (err) {
      say(errorText(err.message === "stale" || err.message === "overlap" ? "file-changed" : err.message), true);
    } finally {
      btn.textContent = "Publish";
      refreshCount();
    }
  };
}
