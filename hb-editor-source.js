/**
 * The page-source side of the site editor.
 *
 * The editor changes the site's real files, not an overlay stored somewhere
 * else. So for every word the admin taps on the live page, it has to find the
 * exact characters in the page's HTML file that produced it. This module does
 * that: it reads the raw file into a light tree that remembers character
 * offsets, matches live elements to it, and turns an edit into a list of
 * "replace characters a..b, which must currently read X, with Y" patches.
 *
 * The server re-checks every "must currently read X" before it writes, so a
 * wrong match fails loudly instead of changing the wrong words.
 *
 * Pure functions, no DOM required, so node can test it (tests/editor-source.test.mjs).
 */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "noscript", "template", "xmp", "iframe", "noembed", "noframes"]);
/** Text inside these never shows as words on the page. */
const HIDDEN_TEXT = new Set(["script", "style", "noscript", "template", "iframe", "noembed", "noframes"]);
/** An open <p> closes when one of these starts, as browsers do. */
const CLOSES_P = new Set(["address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figcaption",
  "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "nav", "ol", "p", "pre",
  "section", "table", "ul", "menu", "hgroup"]);

const P_TAGS = new Set(["p"]);
const P_SCOPE = new Set(["button", "table", "td", "th", "caption", "html", "body", "template", "object", "marquee"]);
const LI_TAGS = new Set(["li"]);
const LIST_SCOPE = new Set(["ul", "ol", "menu", "table", "html", "body", "template"]);
const DD_TAGS = new Set(["dt", "dd"]);
const DL_SCOPE = new Set(["dl", "table", "html", "body", "template"]);
const OPTION_TAGS = new Set(["option"]);
const SELECT_SCOPE = new Set(["select", "optgroup", "datalist"]);
const TR_TAGS = new Set(["tr"]);
const TABLE_SCOPE = new Set(["table", "thead", "tbody", "tfoot"]);
const CELL_TAGS = new Set(["td", "th"]);
const ROW_SCOPE = new Set(["tr", "table"]);

const NAMED = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", mdash: "—", ndash: "–",
  hellip: "…", middot: "·", rarr: "→", larr: "←", uarr: "↑", darr: "↓", copy: "©",
  reg: "®", trade: "™", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•",
  times: "×", deg: "°", hearts: "♥", larrow: "←", thinsp: " ", ensp: " ", emsp: " ",
  eacute: "é", egrave: "è", aacute: "á", oacute: "ó", uacute: "ú", iacute: "í",
  ntilde: "ñ", uuml: "ü", ouml: "ö", auml: "ä", laquo: "«", raquo: "»", check: "✓",
  cross: "✗", star: "☆", starf: "★", diams: "♦", para: "¶", sect: "§", plusmn: "±",
  half: "½", frac12: "½", frac14: "¼", frac34: "¾", cent: "¢", pound: "£", euro: "€",
  yen: "¥", zwj: "‍", zwnj: "‌", shy: "­" };

let decoder = null;

/**
 * Decodes HTML character references. In a browser the browser does it, so all
 * 2,000-odd names work; elsewhere a table of the common ones, and unknown names
 * are left as written.
 */
export function decodeEntities(raw) {
  if (raw.indexOf("&") < 0) return raw;
  if (typeof document !== "undefined" && document.createElement) {
    decoder = decoder || document.createElement("textarea");
    decoder.innerHTML = raw;
    return decoder.value;
  }
  return raw.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);?/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return Object.prototype.hasOwnProperty.call(NAMED, body) ? NAMED[body] : whole;
  });
}

export function escapeHtmlText(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(text) {
  return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Collapses runs of whitespace the way the page shows them. */
export function norm(text) {
  return String(text).replace(/[\s ]+/g, " ").trim();
}

/**
 * Reads raw HTML into a tree whose every node knows its character range.
 * Elements: { type:"el", tag, start, startEnd, end, attrs:[{name,value,rawStart,rawEnd,quote}], children, parent }
 * Text:     { type:"text", start, end, raw, text }
 * `end` is the offset after the end tag, or after the last child when the tag was never closed.
 */
export function parseSource(src) {
  const root = { type: "el", tag: "#root", start: 0, startEnd: 0, end: src.length, attrs: [], children: [], parent: null };
  const all = [];
  let cur = root;
  let i = 0;

  /** Closes the nearest open element named in `tags`, unless an element in `stop` comes first. */
  const closeImplied = (tags, stop, at) => {
    let n = cur;
    while (n && n !== root && !stop.has(n.tag)) {
      if (tags.has(n.tag)) {
        while (cur !== n) { cur.end = at; cur.innerEnd = at; cur = cur.parent; }
        n.end = at; n.innerEnd = at; cur = n.parent;
        return;
      }
      n = n.parent;
    }
  };
  const addText = (start, end) => {
    if (end <= start) return;
    const raw = src.slice(start, end);
    const node = { type: "text", start, end, raw, text: decodeEntities(raw), parent: cur };
    cur.children.push(node);
    cur.lastChildEnd = end;
  };

  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { addText(i, src.length); break; }
    if (lt > i) addText(i, lt);
    i = lt;

    if (src.startsWith("<!--", i)) {
      const endC = src.indexOf("-->", i + 4);
      const stop = endC < 0 ? src.length : endC + 3;
      cur.children.push({ type: "comment", start: i, end: stop, parent: cur });
      cur.lastChildEnd = stop;
      i = stop;
      continue;
    }
    if (src[i + 1] === "!" || src[i + 1] === "?") {
      const gt = src.indexOf(">", i);
      i = gt < 0 ? src.length : gt + 1;
      continue;
    }
    if (src[i + 1] === "/") {
      const m = /^<\/([a-zA-Z][a-zA-Z0-9-]*)[^>]*>?/.exec(src.slice(i, i + 200));
      if (!m) { addText(i, i + 1); i += 1; continue; }
      const tag = m[1].toLowerCase();
      const stop = i + m[0].length;
      let n = cur;
      while (n && n !== root && n.tag !== tag) n = n.parent;
      if (n && n !== root) {
        while (cur !== n) { cur.end = i; cur.innerEnd = i; cur = cur.parent; }
        n.innerEnd = i;
        n.end = stop;
        cur = n.parent;
        cur.lastChildEnd = stop;
      }
      i = stop;
      continue;
    }
    if (!/[a-zA-Z]/.test(src[i + 1] || "")) { addText(i, i + 1); i += 1; continue; }

    // Start tag.
    const nameMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(src.slice(i, i + 100));
    const tag = nameMatch[1].toLowerCase();
    let j = i + nameMatch[0].length;
    const attrs = [];
    let selfClosing = false;
    while (j < src.length) {
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === ">") { j++; break; }
      if (src[j] === "/" && src[j + 1] === ">") { selfClosing = true; j += 2; break; }
      if (src[j] === "/") { j++; continue; }
      const nameStart = j;
      while (j < src.length && !/[\s=>]/.test(src[j]) && !(src[j] === "/" && src[j + 1] === ">")) j++;
      const name = src.slice(nameStart, j).toLowerCase();
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === "=") {
        j++;
        while (j < src.length && /\s/.test(src[j])) j++;
        const q = src[j];
        if (q === "\"" || q === "'") {
          const valEnd = src.indexOf(q, j + 1);
          const stop = valEnd < 0 ? src.length : valEnd;
          attrs.push({ name, nameStart, rawStart: j + 1, rawEnd: stop, quote: q, value: decodeEntities(src.slice(j + 1, stop)) });
          j = stop + 1;
        } else {
          const valStart = j;
          while (j < src.length && !/[\s>]/.test(src[j])) j++;
          attrs.push({ name, nameStart, rawStart: valStart, rawEnd: j, quote: "", value: decodeEntities(src.slice(valStart, j)) });
        }
      } else if (name) {
        attrs.push({ name, nameStart, rawStart: j, rawEnd: j, quote: null, value: "" });
      } else {
        j++;
      }
    }

    // Implied end tags, as a browser would do them.
    if (CLOSES_P.has(tag)) closeImplied(P_TAGS, P_SCOPE, i);
    if (tag === "li") closeImplied(LI_TAGS, LIST_SCOPE, i);
    if (tag === "dt" || tag === "dd") closeImplied(DD_TAGS, DL_SCOPE, i);
    if (tag === "option" || tag === "optgroup") closeImplied(OPTION_TAGS, SELECT_SCOPE, i);
    if (tag === "tr") closeImplied(TR_TAGS, TABLE_SCOPE, i);
    if (tag === "td" || tag === "th") closeImplied(CELL_TAGS, ROW_SCOPE, i);

    const el = { type: "el", tag, start: i, startEnd: j, end: j, innerEnd: j, attrs, children: [], parent: cur };
    cur.children.push(el);
    cur.lastChildEnd = j;
    all.push(el);
    i = j;

    if (VOID.has(tag) || selfClosing) continue;
    if (RAW_TEXT.has(tag)) {
      const lower = src.toLowerCase();
      const endAt = lower.indexOf("</" + tag, j);
      const stop = endAt < 0 ? src.length : endAt;
      if (stop > j) {
        const raw = src.slice(j, stop);
        const decoded = tag === "textarea" || tag === "title" ? decodeEntities(raw) : raw;
        el.children.push({ type: "text", start: j, end: stop, raw, text: decoded, parent: el, rawText: true });
      }
      el.innerEnd = stop;
      const gt = endAt < 0 ? src.length : src.indexOf(">", endAt);
      el.end = gt < 0 ? src.length : gt + 1;
      cur.lastChildEnd = el.end;
      i = el.end;
      continue;
    }
    cur = el;
  }
  while (cur && cur !== root) { cur.end = src.length; cur.innerEnd = src.length; cur = cur.parent; }
  return { src, root, elements: all };
}

export function attr(el, name) {
  const a = el.attrs.find(x => x.name === name);
  return a ? a.value : null;
}

/** The words a source element shows, script and style left out. */
export function sourceText(node) {
  if (node.type === "text") return node.text;
  if (node.type !== "el" || HIDDEN_TEXT.has(node.tag)) return "";
  let out = "";
  for (const c of node.children) out += sourceText(c);
  return out;
}

/** The same, for a live DOM element. Skips anything the editor itself added. */
export function liveText(node) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return "";
  const tag = node.tagName.toLowerCase();
  if (HIDDEN_TEXT.has(tag) || (node.hasAttribute && node.hasAttribute("data-hb-editor"))) return "";
  let out = "";
  for (const c of node.childNodes) out += liveText(c);
  return out;
}

/** The pieces of a node that count when lining up live and source children: elements and text with words in it. */
function meaningfulSource(el) {
  return el.children.filter(c => c.type === "el" || (c.type === "text" && norm(c.text)));
}
function meaningfulLive(el) {
  return Array.from(el.childNodes).filter(c =>
    (c.nodeType === 1 && !c.hasAttribute("data-hb-editor")) || (c.nodeType === 3 && norm(c.nodeValue)));
}

/**
 * Finds the source element that produced a live element.
 * Tries, in order: same tag and same words; same id; same tag and class.
 * When several match, the live page must have the same number of look-alikes,
 * and the Nth live one is the Nth source one. Anything else is "not found".
 *
 * `liveAll(tag)` returns the live elements with that tag in document order.
 */
export function matchElement(index, liveEl, liveAll) {
  const tag = liveEl.tagName.toLowerCase();
  if (tag === "html" || tag === "head" || tag === "body") {
    return index.elements.find(e => e.tag === tag) || null;
  }
  const liveId = liveEl.getAttribute("id");
  const words = norm(liveText(liveEl));
  const sameTag = index.elements.filter(e => e.tag === tag);
  const liveSameTag = liveAll(tag).filter(n => !n.closest || !n.closest("[data-hb-editor]"));

  const pick = (srcCands, liveCands) => {
    if (srcCands.length === 1 && liveCands.length <= 1) return srcCands[0];
    if (srcCands.length > 1 && srcCands.length === liveCands.length) {
      const k = liveCands.indexOf(liveEl);
      return k >= 0 ? srcCands[k] : null;
    }
    return null;
  };

  if (liveId) {
    const byId = sameTag.filter(e => attr(e, "id") === liveId);
    if (byId.length === 1) return byId[0];
  }
  // Same words. Elements with no words at all are left to the class test.
  if (words) {
    const src = sameTag.filter(e => norm(sourceText(e)) === words);
    const live = liveSameTag.filter(n => norm(liveText(n)) === words);
    const hit = pick(src, live);
    if (hit) return hit;
  }
  const cls = liveEl.getAttribute("class");
  const clsNorm = norm(cls || "");
  const src = sameTag.filter(e => norm(attr(e, "class") || "") === clsNorm);
  const live = liveSameTag.filter(n => norm(n.getAttribute("class") || "") === clsNorm);
  return pick(src, live);
}

/**
 * The editable word pieces of a live element whose children still line up with
 * the source. Returns [{ live: TextNode, src: textNode }] or null when the page's
 * code has changed this element since it loaded (then the loose search is used).
 */
export function pairTextPieces(liveEl, srcEl) {
  const L = meaningfulLive(liveEl);
  const S = meaningfulSource(srcEl);
  if (L.length !== S.length) return null;
  const pairs = [];
  for (let k = 0; k < L.length; k++) {
    const l = L[k], s = S[k];
    if (l.nodeType === 3) {
      if (s.type !== "text" || norm(l.nodeValue) !== norm(s.text) || s.rawText) return null;
      pairs.push({ live: l, src: s });
    } else if (s.type !== "el" || s.tag !== l.tagName.toLowerCase()) {
      return null;
    }
  }
  return pairs;
}

/** A patch that swaps a text node's words, keeping the spacing around them as it was in the file. */
export function textPatch(srcText, newWords) {
  const raw = srcText.raw;
  const lead = /^[\s]*/.exec(raw)[0];
  const trail = /[\s]*$/.exec(raw.slice(lead.length))[0];
  return {
    start: srcText.start,
    end: srcText.end,
    expect: raw,
    replace: lead + escapeHtmlText(newWords) + trail
  };
}

/** Escapes words for the inside of a JS string that uses `quote`, keeping it ASCII-safe only if the original was. */
export function escapeJs(text, quote, asciiOnly) {
  let out = "";
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + quote;
    else if (ch === "\n") out += "\\n";
    else if (quote === "`" && ch === "$") out += "\\$";
    else if (ch === "<" && quote !== null) out += "\\u003c";
    else if (asciiOnly && code > 126) {
      if (code > 0xffff) {
        const s = ch;
        out += "\\u" + s.charCodeAt(0).toString(16).padStart(4, "0") + "\\u" + s.charCodeAt(1).toString(16).padStart(4, "0");
      } else out += "\\u" + code.toString(16).padStart(4, "0");
    } else out += ch;
  }
  return out;
}

function toJsAscii(text) {
  let out = "";
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code > 126) {
      for (let k = 0; k < ch.length; k++) out += "\\u" + ch.charCodeAt(k).toString(16).padStart(4, "0");
    } else out += ch;
  }
  return out;
}

function allIndexes(hay, needle) {
  const out = [];
  if (!needle) return out;
  let at = hay.indexOf(needle);
  while (at >= 0) { out.push(at); at = hay.indexOf(needle, at + needle.length); }
  return out;
}

/** Offsets that fall inside <script> or <style> content, for choosing how to escape. */
function scriptRanges(index) {
  return index.elements.filter(e => e.tag === "script").map(e => [e.startEnd, e.innerEnd]);
}

/**
 * The fallback for words the page builds with its own code (lists, cards made
 * from data in a <script>). Looks for the exact old words written in any of the
 * forms a file might hold them, and succeeds only when there is exactly one.
 * Returns { patch } or { error }.
 */
export function looseTextPatch(index, oldWords, newWords) {
  const src = index.src;
  const scripts = scriptRanges(index);
  const inScript = at => scripts.some(([a, b]) => at >= a && at < b);
  const forms = [];
  const seen = new Set();
  const add = (needle, kind) => {
    if (!needle || seen.has(needle)) return;
    seen.add(needle);
    forms.push({ needle, kind });
  };
  add(oldWords, "plain");
  add(escapeHtmlText(oldWords), "html");
  add(toJsAscii(oldWords), "js-ascii");
  add(toJsAscii(oldWords).replace(/'/g, "\\'"), "js-ascii-sq");
  add(oldWords.replace(/'/g, "\\'"), "js-sq");
  add(oldWords.replace(/"/g, "\\\""), "js-dq");

  const styles = index.elements.filter(e => e.tag === "style").map(e => [e.startEnd, e.innerEnd]);
  const comments = [];
  (function walk(n) { for (const c of n.children || []) { if (c.type === "comment") comments.push([c.start, c.end]); else if (c.type === "el") walk(c); } })(index.root);
  const inside = (ranges, at) => ranges.some(([a, b]) => at >= a && at < b);
  const wordChar = ch => !!ch && /[A-Za-z0-9_$]/.test(ch);

  /** Only words people see: page text, or text inside a quoted string in a script. Never a name in code. */
  const plausible = (at, len) => {
    const needle = src.slice(at, at + len);
    if (wordChar(needle[0]) && wordChar(src[at - 1])) return false;
    if (wordChar(needle[needle.length - 1]) && wordChar(src[at + len])) return false;
    if (inside(styles, at) || inside(comments, at)) return false;
    if (inScript(at)) {
      const lineStart = src.lastIndexOf("\n", at) + 1;
      const before = src.slice(lineStart, at).replace(/\\./g, "");
      return ["\"", "'", "`"].some(q => before.split(q).length % 2 === 0);
    }
    // In markup: must be text between tags, not inside a tag's attributes.
    return src.lastIndexOf("<", at) <= src.lastIndexOf(">", at - 1);
  };

  const hits = [];
  for (const f of forms) {
    for (const at of allIndexes(src, f.needle)) if (plausible(at, f.needle.length)) hits.push({ at, ...f });
  }
  // One occurrence can match two forms when they are identical in that spot; keep distinct offsets.
  const unique = [];
  for (const h of hits) if (!unique.some(u => u.at === h.at)) unique.push(h);

  if (unique.length === 0) return { error: "not-found" };
  if (unique.length > 1) return { error: "ambiguous", count: unique.length };
  const h = unique[0];
  let replace;
  if (inScript(h.at)) {
    const before = src.slice(Math.max(0, h.at - 2000), h.at);
    const quote = (() => {
      const m = /(["'`])[^"'`]*$/.exec(before);
      return m ? m[1] : "\"";
    })();
    replace = escapeJs(newWords, quote, h.kind.startsWith("js-ascii"));
  } else {
    replace = escapeHtmlText(newWords);
  }
  return { patch: { start: h.at, end: h.at + h.needle.length, expect: h.needle, replace } };
}

/* ---------------- styles ---------------- */

export function parseStyle(text) {
  const out = [];
  for (const part of String(text || "").split(";")) {
    const k = part.indexOf(":");
    if (k < 0) continue;
    const prop = part.slice(0, k).trim().toLowerCase();
    const value = part.slice(k + 1).trim();
    if (prop) out.push([prop, value]);
  }
  return out;
}

export function serializeStyle(decls) {
  return decls.map(([p, v]) => `${p}: ${v}`).join("; ");
}

/**
 * A patch that sets or clears inline style properties on a source element.
 * `changes` is { prop: value | null }.
 */
export function stylePatch(index, el, changes) {
  const src = index.src;
  const styleAttr = el.attrs.find(a => a.name === "style");
  const decls = parseStyle(styleAttr ? styleAttr.value : "");
  for (const [prop, value] of Object.entries(changes)) {
    const k = decls.findIndex(d => d[0] === prop);
    if (value === null || value === "") { if (k >= 0) decls.splice(k, 1); }
    else if (k >= 0) decls[k][1] = value;
    else decls.push([prop, value]);
  }
  const text = serializeStyle(decls);
  if (styleAttr && styleAttr.quote !== null) {
    const q = styleAttr.quote || "\"";
    const value = q === "'" ? text.replace(/&/g, "&amp;").replace(/'/g, "&#39;") : escapeAttr(text);
    if (styleAttr.quote === "") {
      return { start: styleAttr.rawStart, end: styleAttr.rawEnd, expect: src.slice(styleAttr.rawStart, styleAttr.rawEnd), replace: `"${escapeAttr(text)}"` };
    }
    return { start: styleAttr.rawStart, end: styleAttr.rawEnd, expect: src.slice(styleAttr.rawStart, styleAttr.rawEnd), replace: value };
  }
  if (!text) return null;
  const at = el.start + 1 + el.tag.length;
  return { start: at, end: at, expect: "", replace: ` style="${escapeAttr(text)}"` };
}

/** A patch that takes an element out of the file entirely. */
export function removePatch(index, el) {
  return { start: el.start, end: el.end, expect: index.src.slice(el.start, el.end), replace: "" };
}

/* ---------------- colors in stylesheets ---------------- */

const COLOR_VALUE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/;

/**
 * The color variables a stylesheet sets on :root, with where each value sits.
 * `offset` is where the CSS text starts inside the file (0 for a .css file).
 */
export function rootColors(css, offset = 0) {
  const out = [];
  const blockRe = /:root\s*(?:,[^{]*)?\{([^}]*)\}/g;
  let m;
  while ((m = blockRe.exec(css))) {
    const bodyStart = m.index + m[0].indexOf("{") + 1;
    const declRe = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)/g;
    let d;
    while ((d = declRe.exec(m[1]))) {
      const value = d[2].trim();
      if (!COLOR_VALUE.test(value)) continue;
      const valueAt = bodyStart + d.index + d[0].indexOf(d[2]) + (d[2].length - d[2].trimStart().length);
      if (out.some(o => o.name === d[1])) continue; // first definition only; later ones are usually dark-mode
      out.push({ name: d[1], value, start: offset + valueAt, end: offset + valueAt + value.length });
    }
  }
  return out;
}

/** Applies patches to a string, last first, after checking each one. Throws on any mismatch or overlap. */
export function applyPatches(src, patches) {
  const sorted = patches.slice().sort((a, b) => b.start - a.start || b.end - a.end);
  let prevStart = Infinity;
  let out = src;
  for (const p of sorted) {
    if (!(Number.isInteger(p.start) && Number.isInteger(p.end) && p.start >= 0 && p.end >= p.start && p.end <= src.length)) {
      throw new Error("bad-range");
    }
    if (p.end > prevStart) throw new Error("overlap");
    if (src.slice(p.start, p.end) !== p.expect) throw new Error("stale");
    out = out.slice(0, p.start) + p.replace + out.slice(p.end);
    prevStart = p.start;
  }
  return out;
}

/** Which repo file serves a site path. "/games/" and "/games" -> "games/index.html". */
export function fileForPath(pathname) {
  let p = decodeURIComponent(String(pathname || "/")).split("?")[0].split("#")[0];
  if (!p.startsWith("/")) p = "/" + p;
  if (p.endsWith("/")) p += "index.html";
  else if (!/\.[a-z0-9]+$/i.test(p.split("/").pop())) p += "/index.html";
  return p.slice(1);
}

/** A patch that sets one attribute on a source element (a link's address, for example). */
export function attrPatch(index, el, name, value) {
  const a = el.attrs.find(x => x.name === name);
  if (a && a.quote !== null && a.quote !== "") {
    const encoded = a.quote === "'" ? value.replace(/&/g, "&amp;").replace(/'/g, "&#39;") : escapeAttr(value);
    return { start: a.rawStart, end: a.rawEnd, expect: index.src.slice(a.rawStart, a.rawEnd), replace: encoded };
  }
  if (a) {
    const from = a.nameStart;
    const to = a.quote === null ? a.nameStart + name.length : a.rawEnd;
    return { start: from, end: to, expect: index.src.slice(from, to), replace: `${name}="${escapeAttr(value)}"` };
  }
  const at = el.start + 1 + el.tag.length;
  return { start: at, end: at, expect: "", replace: ` ${name}="${escapeAttr(value)}"` };
}
