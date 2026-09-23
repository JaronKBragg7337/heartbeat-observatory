// Run: node --test tests/editor-source.test.mjs
// Checks the site editor's page-source logic: every patch must change exactly
// the characters it means to and leave the rest of the file byte-for-byte.
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSource, sourceText, textPatch, looseTextPatch, stylePatch, removePatch, attrPatch,
  rootColors, applyPatches, fileForPath, decodeEntities, norm
} from "../hb-editor-source.js";

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<title>Old &amp; tab</title>
<style>
  :root { --bg: #070a0f; --ink:#e6edf3; --line: rgba(31, 42, 45, 0.15); --pad: 12px; }
</style>
</head>
<body>
  <h1 id="hero">Make room for <em>what comes next.</em></h1>
  <p class="dek">A place for worlds &mdash; and
     ideas.</p>
  <ul><li>One<li>Two</ul>
  <p>First<div class="card" style="color: red">Card</div>
  <a href='/school/'>Fly School</a>
  <img src="x.png" alt="x">
  <script>const d = { a: "Heartbeat \\u2014 home", b: 'It\\'s here' };</script>
</body>
</html>`;

const el = (index, tag, n = 0) => index.elements.filter(e => e.tag === tag)[n];

test("parses elements with the words they show", () => {
  const index = parseSource(PAGE);
  assert.equal(norm(sourceText(el(index, "h1"))), "Make room for what comes next.");
  assert.equal(norm(sourceText(el(index, "p"))), "A place for worlds — and ideas.");
  assert.equal(norm(sourceText(el(index, "li", 0))), "One");
  assert.equal(norm(sourceText(el(index, "li", 1))), "Two");
  // <p> is closed by <div>, as in a browser.
  assert.equal(norm(sourceText(el(index, "p", 1))), "First");
  assert.equal(el(index, "div").parent.tag, "body");
  assert.equal(norm(sourceText(el(index, "body"))).includes("Heartbeat"), false);
});

test("text patch keeps spacing and escapes new words", () => {
  const index = parseSource(PAGE);
  const p = el(index, "p");
  const patch = textPatch(p.children[0], "Worlds <and> ideas & more.");
  const out = applyPatches(PAGE, [patch]);
  assert.ok(out.includes(`<p class="dek">Worlds &lt;and&gt; ideas &amp; more.</p>`));
  assert.equal(out.replace(`Worlds &lt;and&gt; ideas &amp; more.`, "X"), PAGE.replace(/A place for worlds &mdash; and\n     ideas\./, "X"));
});

test("text patch on a heading piece leaves the inner <em> alone", () => {
  const index = parseSource(PAGE);
  const h1 = el(index, "h1");
  const patch = textPatch(h1.children[0], "Make space for");
  const out = applyPatches(PAGE, [patch]);
  assert.ok(out.includes(`<h1 id="hero">Make space for <em>what comes next.</em></h1>`));
});

test("loose patch finds words written inside a script", () => {
  const index = parseSource(PAGE);
  const r = looseTextPatch(index, "Heartbeat — home", "Heartbeat — front door");
  assert.ok(r.patch, JSON.stringify(r));
  const out = applyPatches(PAGE, [r.patch]);
  assert.ok(out.includes(`a: "Heartbeat \\u2014 front door"`));
  const r2 = looseTextPatch(index, "It's here", "It's \"there\"");
  assert.ok(r2.patch, JSON.stringify(r2));
  assert.ok(applyPatches(PAGE, [r2.patch]).includes(`b: 'It\\'s "there"'`));
});

test("loose patch refuses words that are missing or repeated", () => {
  const index = parseSource(PAGE);
  assert.equal(looseTextPatch(index, "Nowhere on the page", "x").error, "not-found");
  const twice = parseSource("<p>Same</p><p>Same</p>");
  assert.equal(looseTextPatch(twice, "Same", "x").error, "ambiguous");
});

test("loose patch never touches names in code, attributes, styles or comments", () => {
  const page = `<div class="engine" title="engine"><!-- engine --></div><style>.engine{}</style>
<script>const engine = 1; engineRoom(); const label = "Engine room";</script>`;
  const index = parseSource(page);
  assert.equal(looseTextPatch(index, "engine", "x").error, "not-found");
  const r = looseTextPatch(index, "Engine room", "Engine hall");
  assert.ok(r.patch);
  assert.ok(applyPatches(page, [r.patch]).includes(`const label = "Engine hall";`));
});

test("style patch merges into an existing style or adds one", () => {
  const index = parseSource(PAGE);
  const div = el(index, "div");
  let out = applyPatches(PAGE, [stylePatch(index, div, { color: null, background: "#112233" })]);
  assert.ok(out.includes(`<div class="card" style="background: #112233">Card</div>`));
  const h1 = el(index, "h1");
  out = applyPatches(PAGE, [stylePatch(index, h1, { "font-size": "40px" })]);
  assert.ok(out.includes(`<h1 style="font-size: 40px" id="hero">`));
  const a = el(index, "a");
  out = applyPatches(PAGE, [stylePatch(index, a, { "text-align": "center" }), attrPatch(index, a, "href", "/games/")]);
  assert.ok(out.includes(`<a style="text-align: center" href='/games/'>Fly School</a>`));
});

test("remove patch takes out the whole element and nothing else", () => {
  const index = parseSource(PAGE);
  const out = applyPatches(PAGE, [removePatch(index, el(index, "a"))]);
  assert.ok(!out.includes("Fly School"));
  assert.ok(out.includes(`<img src="x.png" alt="x">`));
});

test("root colors come with exact positions", () => {
  const index = parseSource(PAGE);
  const style = el(index, "style").children[0];
  const colors = rootColors(style.raw, style.start);
  assert.deepEqual(colors.map(c => c.name), ["--bg", "--ink", "--line"]);
  for (const c of colors) assert.equal(PAGE.slice(c.start, c.end), c.value);
  const out = applyPatches(PAGE, [{ start: colors[0].start, end: colors[0].end, expect: colors[0].value, replace: "#ffffff" }]);
  assert.ok(out.includes("--bg: #ffffff;"));
});

test("title text patch", () => {
  const index = parseSource(PAGE);
  const t = el(index, "title").children[0];
  assert.equal(t.text, "Old & tab");
  assert.ok(applyPatches(PAGE, [textPatch(t, "New & tab")]).includes("<title>New &amp; tab</title>"));
});

test("applyPatches refuses stale or overlapping patches", () => {
  assert.throws(() => applyPatches("abc", [{ start: 0, end: 1, expect: "x", replace: "y" }]), /stale/);
  assert.throws(() => applyPatches("abcdef", [
    { start: 0, end: 3, expect: "abc", replace: "" },
    { start: 2, end: 4, expect: "cd", replace: "" }
  ]), /overlap/);
});

test("site paths map to repo files", () => {
  assert.equal(fileForPath("/"), "index.html");
  assert.equal(fileForPath("/games/"), "games/index.html");
  assert.equal(fileForPath("/games"), "games/index.html");
  assert.equal(fileForPath("/games/president-sim/classic.html"), "games/president-sim/classic.html");
  assert.equal(fileForPath("/observatory.css"), "observatory.css");
});

test("entities decode", () => {
  assert.equal(decodeEntities("a &amp; b &#8212; &#x2192; &rarr; &unknown;"), "a & b — → → &unknown;");
});
