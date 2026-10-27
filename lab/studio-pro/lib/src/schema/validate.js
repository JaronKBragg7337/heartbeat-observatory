// A small JSON Schema (draft-07 subset) validator, no dependencies, so the same .schema.json files can be
// checked in the browser and Node. Supported: type, enum, const, properties, required, additionalProperties (bool|schema),
// items, minItems, maxItems, minLength, pattern, minimum, maximum, oneOf, anyOf, allOf, not, if/then/else, $ref ("#/..."), patternProperties.
// Unknown keywords are ignored (so $comment, description, title are fine). Returns [{path, message}].
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const isType = (v, t) => (t === 'integer' ? Number.isInteger(v) : t === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeOf(v) === t);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validateSchema(value, schema, root = schema, path = '', out = [], budget = { n: 0 }) {
  if (out.length > 200) return out;
  if (schema === true || schema === undefined) return out;
  if (schema === false) { out.push({ path, message: 'not allowed' }); return out; }
  if (schema.$ref) {
    const parts = schema.$ref.replace(/^#\/?/, '').split('/').filter(Boolean); let t = root;
    for (const p of parts) t = t && t[p.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (!t) { out.push({ path, message: 'bad $ref ' + schema.$ref }); return out; }
    return validateSchema(value, t, root, path, out, budget);
  }
  const add = (message) => out.push({ path: path || '/', message });
  if (schema.type !== undefined) { const ts = Array.isArray(schema.type) ? schema.type : [schema.type]; if (!ts.some((t) => isType(value, t))) { add(`expected ${ts.join('|')}, got ${typeOf(value)}`); return out; } }
  if (schema.const !== undefined && !deepEq(value, schema.const)) add(`must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => deepEq(e, value))) add(`must be one of ${JSON.stringify(schema.enum)}`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) add('too short');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) add(`does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) add(`below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) add(`above maximum ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) add(`needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) add(`at most ${schema.maxItems} items`);
    if (schema.items) { const n = Math.min(value.length, 2000); for (let i = 0; i < n; i++) validateSchema(value[i], schema.items, root, path + '/' + i, out, budget); }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const r of schema.required || []) if (!(r in value) || value[r] === undefined) add(`missing required "${r}"`);
    const props = schema.properties || {}, pp = schema.patternProperties;
    for (const k of Object.keys(value)) {
      if (value[k] === undefined) continue;
      let matched = false;
      if (k in props) { matched = true; validateSchema(value[k], props[k], root, path + '/' + k, out, budget); }
      if (pp) for (const re of Object.keys(pp)) if (new RegExp(re).test(k)) { matched = true; validateSchema(value[k], pp[re], root, path + '/' + k, out, budget); }
      if (!matched && schema.additionalProperties !== undefined && schema.additionalProperties !== true) {
        if (schema.additionalProperties === false) out.push({ path: path + '/' + k, message: 'unknown field' });
        else validateSchema(value[k], schema.additionalProperties, root, path + '/' + k, out, budget);
      }
    }
  }
  if (schema.allOf) for (const s of schema.allOf) validateSchema(value, s, root, path, out, budget);
  if (schema.anyOf) { if (!schema.anyOf.some((s) => validateSchema(value, s, root, path, []).length === 0)) add('matches none of anyOf'); }
  if (schema.oneOf) { const n = schema.oneOf.filter((s) => validateSchema(value, s, root, path, []).length === 0).length; if (n !== 1) add(`must match exactly one of oneOf (matched ${n})`); }
  if (schema.not && validateSchema(value, schema.not, root, path, []).length === 0) add('must not match "not" schema');
  if (schema.if) {
    const ok = validateSchema(value, schema.if, root, path, []).length === 0;
    if (ok && schema.then) validateSchema(value, schema.then, root, path, out, budget);
    if (!ok && schema.else) validateSchema(value, schema.else, root, path, out, budget);
  }
  return out;
}
export const schemaOk = (value, schema) => validateSchema(value, schema).length === 0;
