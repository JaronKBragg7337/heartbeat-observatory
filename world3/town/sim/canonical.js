/* ============================================================================
   sim/canonical.js — one canonical form for state, and its digest
   ---------------------------------------------------------------------------
   Principle taken from the-current's canonical.ts (seen in its source): a
   snapshot is only trustworthy if two hosts can agree on exactly what it says.
   Sort keys, reject non-finite numbers, then FNV-1a-64 the result. Restore
   refuses anything whose digest doesn't match.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

function normalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("state cannot hold non-finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      if (value[k] !== undefined) out[k] = normalize(value[k]);
    }
    return out;
  }
  throw new TypeError(`unsupported state type: ${typeof value}`);
}

ASH.canonicalStringify = function (value) { return JSON.stringify(normalize(value)); };

ASH.canonicalDigest = function (value) {
  const input = ASH.canonicalStringify(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
};

ASH.cloneState = function (value) { return JSON.parse(JSON.stringify(value)); };
})();
