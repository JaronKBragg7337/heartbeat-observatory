// hb-render "make anything": words -> an hb-render scene, via the Claude API (claude-sonnet-5-5).
// Shared by the MSI endpoint (tools/anything-server.mjs) and the site function (api/render-anything.js).
// Objects come from: (a) Poly Haven CC0 models/textures/skies (catalog/polyhaven.json),
// (b) procedural builders (terrain, room, rock, tree, hull, cylinder, cone, box, sphere, plane, lathe),
// (c) a "generated" hook for a text-to-3D model (TRELLIS.2 on RunPod) that is NOT wired yet:
//     the writer may emit {"type":"generated","prompt":"..."} and the page reports it as not made.
// No secrets here: the caller passes the key in.

export const MODEL = 'claude-sonnet-5-5';

export function catalogDigest(cat, max = { models: 700, textures: 160, hdris: 70 }) {
  // sizes in meters (Poly Haven reports mm) so the writer picks a real bush, not a 20 cm groundcover
  const dim = (x) => (x.dimensions && x.dimensions.length === 3 && !x.setOf) ? ` ${x.dimensions.map((v) => (v / 1000).toFixed(1)).join('x')}m` : '';
  const m = cat.models.slice(0, max.models).map((x) => `${x.id} [${(x.tags || []).slice(0, 4).join(', ')}]${dim(x)}`).join('\n');
  const t = cat.textures.slice(0, max.textures).map((x) => `${x.id} [${(x.tags || []).slice(0, 4).join(', ')}]`).join('\n');
  const h = cat.hdris.slice(0, max.hdris).map((x) => `${x.id} [${(x.categories || []).filter((c) => !/outdoor|nature|skies|natural light/.test(c)).slice(0, 4).join(', ')}]`).join('\n');
  // Kenney low-poly props: vehicles, street props, buildings, furniture (real-world sizes after scaling)
  const k = (cat.kenney || []).map((x) => `${x.id} ${x.realDims ? '(' + x.realDims.map((v) => v.toFixed(1)).join('x') + ' m)' : ''}`).join('\n');
  const b = (cat.kits || []).filter((x) => /facade/.test(x.id)).map((x) => `${x.id} [${(x.tags || []).slice(0, 4).join(', ')}] (${x.pieces} pieces)`).join('\n');
  return { m, t, h, k, b };
}

// words -> a real Poly Haven texture for procedural surfaces ("concrete" must not look like wood)
export const MATERIAL_WORDS = {
  concrete: /^concrete|concrete/, asphalt: /^asphalt|asphalt|tarmac/, brick: /^brick|brick/, wood: /^wood|planks|parquet|wooden/, metal: /^metal|metal_plate|metal/,
  grass: /^grass|lawn|grass/, gravel: /^gravel|gravel|pebbles/, plaster: /^plaster|plaster/, tiles: /tiles/, sand: /^sand|sand/, mud: /^mud|mud/, cobble: /cobble/, snow: /snow/, marble: /marble/, rust: /rust/, leather: /leather/, fabric: /fabric/, stone: /^stone|stone|rock_wall|slate/,
};
export function pickTexture(cat, word) {
  const re = MATERIAL_WORDS[word]; if (!re) return null;
  const list = cat.textures || [];
  const byId = list.find((t) => new RegExp('^' + word).test(t.id)) || list.find((t) => re.test(t.id)) || list.find((t) => re.test((t.tags || []).join(' ')));
  return byId || null;
}

export function systemPrompt(cat) {
  const d = catalogDigest(cat);
  return `You write scenes for hb-render, a small physically based renderer. Output ONLY a JSON object, no prose.

Units: meters, Y up, ground at y=0. The camera must frame the subject (2-8 m away for objects, further for landscapes).

JSON shape:
{
 "name": "short-slug", "description": "one sentence",
 "report": [ {"object":"<name>", "source":"polyhaven:<id>" | "procedural:<type>" | "generated (not available yet)" | "skipped", "note":"short plain-words note"} ],
 "camera": {"position":[x,y,z], "target":[x,y,z], "fov":40-70, "fstop":5.6-11, "focusDistance":m, "exposure":-1.5..1.5},
 "environment": {"hdri":"polyhaven:<sky id>", "rotation":0-360, "intensity":0.5-2, "sampleDirect":true},
 "lights": [ optional: {"type":"sphere","position":[..],"radius":0.05,"color":[r,g,b],"intensity":20-200 outdoors, 200-600 for a bulb lighting a room} | {"type":"spot",...} | {"type":"rect","position":corner,"u":[..],"v":[..],"intensity":5-30} ],
 "materials": { "<name>": {"baseColor":[r,g,b], "roughness":0-1, "metallic":0-1, "ior":1.33-1.6, "transmission":0-1, "absorption":[r,g,b] per m, "sheen":0-1, "clearcoat":0-1, "baseColorTexture":"polyhaven:<texture id>", "normalTexture":"polyhaven:<texture id>", "roughnessTexture":"polyhaven:<texture id>", "uvScale":repeats per meter} },
 "objects": [ ... ]
}

Object types (every object has name, type, material or materials, position [x,y,z], rotation [deg x,y,z], scale):
- {"type":"model","src":"polyhaven:<model id>"} a CC0 scanned model from the list below (sizes are real-world)
- {"type":"model","src":"kenney:<kit>/<name>"} a CC0 low-poly prop (cars, trucks, vans, dumpsters, benches, signs, poles, buildings, furniture) from the Kenney list below; real-world size is applied for you, do not add scale unless asked for a different size
- {"type":"heightfield","size":[w,d],"segments":[n,n],"dunes":{"amplitude":m,"scale":1/m},"ripples":{"amplitude":m,"wavelength":m,"direction":deg},"uvRepeat":1,"material":"..."} terrain or ground (keep heightfields under 80 m; the camera exposure for a bright sky is -1 to 0, never above 0.5)
- {"type":"plane","size":[w,d]} flat ground or water surface (give water: transmission 1, ior 1.33, roughness 0.02)
- {"type":"box","size":[x,y,z]} {"type":"sphere","radius":r} {"type":"cylinder","radius":r,"height":h} {"type":"cone","radius":r,"height":h}
- {"type":"lathe","profile":[[radius,y],...]} a turned shape (glass, bottle, vase, milkshake cup)
- {"type":"rock","size":m,"seed":n} {"type":"tree","height":m,"kind":"conifer"|"broadleaf","materials":{"bark":"...","leaves":"..."}}
- {"type":"hull","length":m,"width":m,"depth":m} a boat hull (canoe, rowboat)
- {"type":"room","width":w,"depth":d,"height":h,"window":{"y0":..,"y1":..,"z0":..,"z1":..},"materials":{"floor":"..","wall":"..","ceiling":".."}} an interior shell; add a "portal" light in the window opening for daylight: {"type":"portal","position":[-w/2,y0,z0],"u":[0,0,z1-z0],"v":[0,y1-y0,0]}
- {"type":"building","kit":"polyhaven:<kit id>","floors":1-6,"width":2-10 (3 m modules),"features":["garage","door"],"seed":any integer} a brick/industrial building facade assembled from a modular kit (listed below). Use it for "a building", warehouse, factory, old brick block; place it with position (center of the facade, y 0) and rotation; the facade faces +z. Give a new seed every time.
- {"type":"generated","prompt":"..."} ONLY when nothing above can stand in for an important object; it will not be built yet.

Rules: prefer a Poly Haven scanned model when one matches; for vehicles, street props, whole buildings and furniture use the Kenney list; otherwise build from procedural shapes (a milkshake = lathe cup + cylinder straw + sphere cream). Fog, mist, smoke, fire, rain, people and animals cannot be rendered: say so in the report and suggest the nearest visible stand-in (a misty lake = pale low-sun sky + water plane + low exposure). Keep total objects under 25, textures under 4, trees under 12. Skies must come from the sky list. Every object in the scene must appear in the report with its source.
Materials: every procedural surface that is a real-world material MUST carry "look": one of concrete, asphalt, brick, wood, metal, grass, gravel, plaster, tiles, sand, mud, cobble, snow, marble, rust, leather, fabric, stone. A matching scanned texture is attached for you (so a sidewalk with "look":"concrete" is concrete, never wood). You may still give baseColor as a tint and uvScale (repeats per meter, usually 0.5-2).
Room light: a room needs real light. Bulbs (sphere lights, radius 0.05-0.1) at intensity 200-600, scaled with the floor area (600 for 40 m2+), at least one light per 15 m2 of floor, spread over the room; a room without a window also gets a soft fill: a ceiling rect light (position = a ceiling corner, u and v along the ceiling, intensity 6-15). Window portals should cover the whole opening.
Placement: everything is dropped onto whatever is under it after you place it (ground, a table, a car roof), so give y = 0 for things on the ground and roughly the support height for things on top of other things; nothing will float or sink. Plants, rocks and props scatter naturally: vary spacing, rotation [0,random,0] and scale (0.7-1.3), use loose clusters, never an evenly spaced row; flowers are small plants placed by the dozen near their bush, not single tiny objects. Big things first in the list (ground, buildings, furniture), small things last.

Poly Haven models (id [tags]):
${d.m}

Kenney props (id (size w x h x d in meters)):
${d.k}

Building kits for {"type":"building"} (kit id):
${d.b}

Poly Haven textures (id [tags]):
${d.t}

Poly Haven skies (id [when/weather]):
${d.h}`;
}

// pull the JSON object out of a reply, repairing trailing commas / comments
export function parseSceneText(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('scene writer returned no JSON');
  try { return JSON.parse(m[0]); }
  catch (e) { return JSON.parse(m[0].replace(/,\s*([\]}])/g, '$1').replace(/\/\/[^\n]*/g, '')); }
}

// nearest catalog ids by shared name tokens, for "not in the catalog; nearest: ..." messages
function nearest(id, ids, n = 3) {
  const toks = String(id).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  return ids.map((x) => { const xt = x.toLowerCase().split(/[^a-z0-9]+/); return [x, toks.filter((t) => xt.some((y) => y.includes(t) || t.includes(y))).length]; })
    .filter((p) => p[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map((p) => p[0]);
}

const OBJECT_TYPES = new Set(['model', 'heightfield', 'plane', 'box', 'sphere', 'cylinder', 'cone', 'lathe', 'rock', 'tree', 'hull', 'room', 'building', 'generated', 'portal', 'bottle', 'bottle_fill', 'mesh']);

// check a raw writer scene against the catalog BEFORE rendering; returns plain-words errors (empty = fine)
export function validateScene(scene, cat) {
  const errs = [];
  if (!scene || typeof scene !== 'object') return ['the reply is not a scene object'];
  const modelIds = cat.models.map((m) => m.id), kenneyIds = (cat.kenney || []).map((k) => k.id), texIds = cat.textures.map((t) => t.id), skyIds = cat.hdris.map((h) => h.id), kitIds = (cat.kits || []).map((k) => k.id);
  const mats = scene.materials || {};
  const sky = String(scene.environment?.hdri || '').replace(/^polyhaven:/, '');
  if (sky && !skyIds.includes(sky)) errs.push(`sky "${sky}" is not in the sky list; nearest: ${nearest(sky, skyIds).join(', ') || 'none'}`);
  for (const [name, m] of Object.entries(mats)) for (const k of ['baseColorTexture', 'normalTexture', 'roughnessTexture']) {
    const v = m && m[k]; if (typeof v === 'string' && v.startsWith('polyhaven:') && !texIds.includes(v.slice(10))) errs.push(`material "${name}": texture ${v} not in the catalog; nearest: ${nearest(v.slice(10), texIds).join(', ') || 'use "look" instead'}`);
  }
  for (const ob of scene.objects || []) {
    const nm = ob.name || ob.type;
    if (!OBJECT_TYPES.has(ob.type)) { errs.push(`object "${nm}": unknown type "${ob.type}"`); continue; }
    if (ob.type === 'model') {
      const src = String(ob.src || '');
      if (src.startsWith('polyhaven:') && !modelIds.includes(src.slice(10))) errs.push(`object "${nm}": model ${src} not in the catalog; nearest: ${nearest(src.slice(10), modelIds).join(', ') || 'none (build it from shapes)'}`);
      else if (src.startsWith('kenney:') && !kenneyIds.includes(src)) errs.push(`object "${nm}": ${src} not in the Kenney list; nearest: ${nearest(src.slice(7), kenneyIds.map((k) => k.slice(7))).map((k) => 'kenney:' + k).join(', ') || 'none'}`);
      else if (!/^(polyhaven:|kenney:|https?:|assets\/)/.test(src)) errs.push(`object "${nm}": model src must be polyhaven:<id> or kenney:<kit>/<name>`);
    }
    if (ob.type === 'building') { const kid = String(ob.kit || '').replace(/^polyhaven:/, ''); if (kid && !kitIds.includes(kid)) errs.push(`object "${nm}": building kit "${kid}" unknown; use ${kitIds.filter((k) => /facade/.test(k)).join(' or ')}`); }
    const needsMat = !['model', 'building', 'generated', 'portal', 'bottle_fill'].includes(ob.type);
    const partMats = ob.materials ? Object.values(ob.materials) : [];
    if (needsMat && !ob.material && !partMats.length) errs.push(`object "${nm}": no material given (name one from "materials")`);
    for (const mname of [ob.material, ...partMats]) if (typeof mname === 'string' && !mats[mname]) errs.push(`object "${nm}": material "${mname}" is not defined in "materials"`);
  }
  return errs;
}

// the shared write loop: ask once, validate, send the exact errors back once for a corrected scene, resolve.
// call({ system, user }) -> { text, usage?, model? }
export async function writeSceneWith(call, { prompt, catalog }) {
  const system = systemPrompt(catalog);
  const request = `Scene request: ${String(prompt).slice(0, 600)}\nReturn the JSON object only.`;
  let r = await call({ system, user: request });
  let scene = parseSceneText(r.text);
  const errs = validateScene(scene, catalog);
  let corrected = null;
  if (errs.length) {
    const user2 = `${request}\n\nYour previous JSON had these problems, fix every one of them and return the corrected FULL JSON object only (same scene, same objects, corrected ids/materials; use "look" for plain surfaces):\n- ${errs.join('\n- ')}\n\nPrevious JSON:\n${JSON.stringify(scene)}`;
    r = await call({ system, user: user2 });
    try { scene = parseSceneText(r.text); corrected = errs; } catch (e) { /* keep the first scene; resolveScene skips what it cannot find */ }
  }
  const resolved = resolveScene(scene, catalog);
  if (corrected) resolved.report.push({ object: '(writer)', source: 'corrected once', note: `first draft had ${corrected.length} problem(s): ${corrected.slice(0, 3).join('; ').slice(0, 300)}` });
  return { scene: resolved, usage: r.usage, model: r.model, corrected: !!corrected };
}

export async function writeScene({ prompt, apiKey, workspaceId, catalog, fetchImpl = fetch, maxTokens = 12000 }) {
  const headers = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  if (workspaceId) headers['anthropic-workspace-id'] = workspaceId;
  const call = async ({ system, user }) => {
    const body = { model: MODEL, max_tokens: maxTokens, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }] };
    const r = await fetchImpl('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('scene writer upstream ' + r.status + ': ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    if (j.stop_reason === 'max_tokens') throw new Error('the scene came out too long to finish; try a simpler sentence');
    return { text: (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n'), usage: j.usage, model: j.model };
  };
  return writeSceneWith(call, { prompt, catalog });
}

// turn polyhaven:<id> references into real CDN URLs (+ file maps for models) and sanity-fix the scene
export function resolveScene(scene, cat) {
  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  const models = byId(cat.models), textures = byId(cat.textures), hdris = byId(cat.hdris);
  const report = Array.isArray(scene.report) ? scene.report : [];
  const note = (object, source, text) => report.push({ object, source, note: text });
  const sky = hdris[(scene.environment?.hdri || '').replace(/^polyhaven:/, '')] || cat.hdris.find((h) => /clear|puresky/.test(h.id)) || cat.hdris[0];
  scene.environment = { ...(scene.environment || {}), hdri: sky.hdr1k || sky.hdr2k, hdriId: sky.id, sampleDirect: scene.environment?.sampleDirect ?? true };
  scene.materials = scene.materials || {};
  const kenney = Object.fromEntries((cat.kenney || []).map((x) => [x.id, x]));
  // a "portal" written as an object is really a window light: move it to lights
  scene.lights = Array.isArray(scene.lights) ? scene.lights : [];
  scene.objects = (scene.objects || []).filter((ob) => {
    if (ob.type !== 'portal') return true;
    scene.lights.push({ type: 'portal', name: ob.name, position: ob.position || [0, 1, 0], u: ob.u || [0, 0, 1], v: ob.v || [0, 1, 0], intensity: ob.intensity ?? 1 });
    note(ob.name || 'portal', 'procedural:portal light', 'window light (moved from objects to lights)');
    return false;
  });
  // transforms the writer got wrong (scale 1 instead of [1,1,1], nulls, strings) become sane numbers
  const vec3 = (v, def) => { if (typeof v === 'number' && Number.isFinite(v)) return [v, v, v]; if (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x))) return v; return def; };
  for (const ob of scene.objects) { ob.position = vec3(ob.position, [0, 0, 0]); ob.rotation = vec3(ob.rotation, [0, 0, 0]); ob.scale = vec3(ob.scale, [1, 1, 1]); }
  // furniture written outside its own room is pulled inside (the writer counts from the wrong corner sometimes)
  const room = scene.objects.find((o) => o.type === 'room');
  if (room) {
    const c = room.position, w = room.width ?? 4, d = room.depth ?? 4;
    for (const ob of scene.objects) {
      if (['room', 'building', 'heightfield', 'plane', 'generated'].includes(ob.type)) continue;
      const nx = Math.max(c[0] - w / 2 + 0.4, Math.min(c[0] + w / 2 - 0.4, ob.position[0])), nz = Math.max(c[2] - d / 2 + 0.4, Math.min(c[2] + d / 2 - 0.4, ob.position[2]));
      if (nx !== ob.position[0] || nz !== ob.position[2]) { note(ob.name, 'procedural:room fit', `moved inside the room (${ob.position[0].toFixed(1)},${ob.position[2].toFixed(1)} -> ${nx.toFixed(1)},${nz.toFixed(1)})`); ob.position = [nx, ob.position[1], nz]; }
    }
    for (const lt of scene.lights || []) if (Array.isArray(lt.position) && lt.type !== 'portal') { lt.position[0] = Math.max(c[0] - w / 2 + 0.3, Math.min(c[0] + w / 2 - 0.3, lt.position[0])); lt.position[2] = Math.max(c[2] - d / 2 + 0.3, Math.min(c[2] + d / 2 - 0.3, lt.position[2])); }
    // timid room light gets raised: bulbs scale with the floor area, at least one light per 15 m2, a fill when there is no window
    const area = w * d, h = room.height ?? 2.7, minBulb = Math.min(600, Math.max(200, 200 + area * 10));
    const bulbs = scene.lights.filter((l) => /sphere|point|spot/.test(l.type));
    for (const l of bulbs) if ((l.intensity ?? 0) < minBulb) { note(l.name || l.type, 'procedural:light', `bulb raised ${l.intensity ?? 0} -> ${minBulb} for a ${area.toFixed(0)} m2 room`); l.intensity = minBulb; }
    const want = Math.ceil(area / 15);
    if (bulbs.length < want) { for (let i = bulbs.length; i < want; i++) { const gx = c[0] - w / 2 + (w / (want + 1)) * (i + 1), gz = c[2]; scene.lights.push({ type: 'sphere', name: 'fill bulb ' + (i + 1), position: [gx, c[1] + h - 0.3, gz], radius: 0.07, color: [1, 0.9, 0.75], intensity: minBulb }); } note('room light', 'procedural:light', `${want - bulbs.length} bulb(s) added so the ${area.toFixed(0)} m2 room has one per 15 m2`); }
    const hasWindow = !!room.window || scene.lights.some((l) => l.type === 'portal');
    if (!hasWindow && !scene.lights.some((l) => l.type === 'rect')) { scene.lights.push({ type: 'rect', name: 'ceiling fill', position: [c[0] - w / 2 + 0.5, c[1] + h - 0.05, c[2] - d / 2 + 0.5], u: [w - 1, 0, 0], v: [0, 0, d - 1], color: [1, 0.95, 0.85], intensity: 8 }); note('ceiling fill', 'procedural:light', 'soft ceiling light added: the room has no window'); }
  }
  // objects that name a material that does not exist get a plain grey one instead of failing the whole scene
  for (const ob of scene.objects) {
    const need = [ob.material, ...(ob.materials ? Object.values(ob.materials) : [])].filter((m) => typeof m === 'string');
    for (const mname of need) if (!scene.materials[mname]) { scene.materials[mname] = { baseColor: [0.6, 0.6, 0.6], roughness: 0.7 }; note(ob.name, 'skipped', `material "${mname}" was not defined; plain grey used`); }
    if (!ob.material && !ob.materials && !['model', 'building', 'generated', 'bottle_fill'].includes(ob.type)) { scene.materials._default = scene.materials._default || { baseColor: [0.6, 0.6, 0.6], roughness: 0.7 }; ob.material = '_default'; note(ob.name, 'skipped', 'no material given; plain grey used'); }
  }
  for (const [name, m] of Object.entries(scene.materials)) {
    // "look": attach a scanned texture set for real-world surfaces on procedural shapes
    const look = String(m.look || '').toLowerCase().trim();
    if (look && !m.baseColorTexture) {
      const t = pickTexture(cat, look);
      if (t) {
        m.baseColorTexture = t.diffuse; if (t.normal) m.normalTexture = t.normal; if (t.roughness) m.roughnessTexture = t.roughness;
        if (!m.uvScale) m.uvScale = 1.0;
        if (!m.baseColor) m.baseColor = [1, 1, 1];
        note(name, 'polyhaven:' + t.id, `${look} look from the scanned texture ${t.id}`);
        if (look === 'metal' && m.metallic === undefined) m.metallic = 0.8;
      } else note(name, 'skipped', `no ${look} texture in the catalog, plain color used`);
    }
    for (const k of ['baseColorTexture', 'normalTexture', 'roughnessTexture']) {
      if (typeof m[k] === 'string' && m[k].startsWith('polyhaven:')) {
        const t = textures[m[k].slice(10)];
        if (!t) { delete m[k]; note(name, 'skipped', `texture ${m[k]} not in the catalog, used a plain color`); continue; }
        m[k] = k === 'baseColorTexture' ? t.diffuse : k === 'normalTexture' ? t.normal : t.roughness;
        if (!m[k]) delete m[k];
      }
    }
  }
  const objects = [];
  for (const ob of scene.objects || []) {
    if (ob.type === 'model' && typeof ob.src === 'string' && ob.src.startsWith('polyhaven:')) {
      const id = ob.src.slice(10); const md = models[id];
      if (!md) { note(ob.name, 'skipped', `model ${id} is not in the catalog`); continue; }
      ob.src = md.gltf; ob.files = md.files; ob.polyhavenId = id; if (md.node !== undefined) ob.node = md.node;
    } else if (ob.type === 'model' && typeof ob.src === 'string' && ob.src.startsWith('kenney:')) {
      const kd = kenney[ob.src];
      if (!kd) { note(ob.name, 'skipped', `${ob.src} is not in the Kenney list`); continue; }
      const f = kd.scaleToMeters || 1, s = ob.scale || [1, 1, 1];
      ob.src = kd.src; ob.scale = [s[0] * f, s[1] * f, s[2] * f]; ob.kenneyId = kd.id;
    } else if (ob.type === 'building') {
      const kid = String(ob.kit || '').replace(/^polyhaven:/, '');
      const kd = (cat.kits || []).find((k) => k.id === kid) || (cat.kits || []).find((k) => /facade/.test(k.id));
      if (!kd) { note(ob.name, 'skipped', 'no building kit in the catalog'); continue; }
      ob.src = kd.gltf; ob.files = kd.files; ob.kit = kd.id; ob.seed = ob.seed ?? Math.floor(Math.random() * 1e9);
      note(ob.name, 'assembled:' + kd.id, `facade assembled from the kit: ${ob.floors || 2} floors, ${ob.width || 4} modules, seed ${ob.seed}`);
    } else if (ob.type === 'generated') {
      note(ob.name, 'generated (not available yet)', `text-to-3D (TRELLIS.2 on RunPod) is a hook only; "${(ob.prompt || '').slice(0, 80)}" was not built`);
      continue;
    }
    objects.push(ob);
  }
  scene.objects = objects;
  if (!scene.camera) scene.camera = { position: [3, 1.5, 4], target: [0, 0.5, 0], fov: 50, exposure: 0 };
  scene.render = { width: 1280, height: 720, samples: 64, maxBounces: 6, rrStart: 3, clamp: 12, denoise: true, denoiseIterations: 2, denoiseSigma: 0.2, ...(scene.render || {}) };
  scene.time = scene.time || 0;
  scene.rest = true; // the engine drops every prop onto what is under it (nothing floats)
  scene.report = report;
  return scene;
}
