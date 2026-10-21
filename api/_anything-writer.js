// hb-render "make anything": words -> an hb-render scene, via the Claude API (claude-sonnet-5-5).
// Shared by the MSI endpoint (tools/anything-server.mjs) and the site function (api/render-anything.js).
// Objects come from: (a) Poly Haven CC0 models/textures/skies (catalog/polyhaven.json),
// (b) procedural builders (terrain, room, rock, tree, hull, cylinder, cone, box, sphere, plane, lathe),
// (c) a "generated" hook for a text-to-3D model (TRELLIS.2 on RunPod) that is NOT wired yet:
//     the writer may emit {"type":"generated","prompt":"..."} and the page reports it as not made.
// No secrets here: the caller passes the key in.

export const MODEL = 'claude-sonnet-5-5';

export function catalogDigest(cat, max = { models: 260, textures: 120, hdris: 60 }) {
  const m = cat.models.slice(0, max.models).map((x) => `${x.id} [${(x.tags || []).slice(0, 5).join(', ')}]`).join('\n');
  const t = cat.textures.slice(0, max.textures).map((x) => `${x.id} [${(x.tags || []).slice(0, 4).join(', ')}]`).join('\n');
  const h = cat.hdris.slice(0, max.hdris).map((x) => `${x.id} [${(x.categories || []).filter((c) => !/outdoor|nature|skies|natural light/.test(c)).slice(0, 4).join(', ')}]`).join('\n');
  return { m, t, h };
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
 "lights": [ optional: {"type":"sphere","position":[..],"radius":0.05,"color":[r,g,b],"intensity":20-200} | {"type":"spot",...} | {"type":"rect","position":corner,"u":[..],"v":[..],"intensity":5-30} ],
 "materials": { "<name>": {"baseColor":[r,g,b], "roughness":0-1, "metallic":0-1, "ior":1.33-1.6, "transmission":0-1, "absorption":[r,g,b] per m, "sheen":0-1, "clearcoat":0-1, "baseColorTexture":"polyhaven:<texture id>", "normalTexture":"polyhaven:<texture id>", "roughnessTexture":"polyhaven:<texture id>", "uvScale":repeats per meter} },
 "objects": [ ... ]
}

Object types (every object has name, type, material or materials, position [x,y,z], rotation [deg x,y,z], scale):
- {"type":"model","src":"polyhaven:<model id>"} a CC0 scanned model from the list below (sizes are real-world)
- {"type":"heightfield","size":[w,d],"segments":[n,n],"dunes":{"amplitude":m,"scale":1/m},"ripples":{"amplitude":m,"wavelength":m,"direction":deg},"uvRepeat":1,"material":"..."} terrain or ground (keep heightfields under 80 m; the camera exposure for a bright sky is -1 to 0, never above 0.5)
- {"type":"plane","size":[w,d]} flat ground or water surface (give water: transmission 1, ior 1.33, roughness 0.02)
- {"type":"box","size":[x,y,z]} {"type":"sphere","radius":r} {"type":"cylinder","radius":r,"height":h} {"type":"cone","radius":r,"height":h}
- {"type":"lathe","profile":[[radius,y],...]} a turned shape (glass, bottle, vase, milkshake cup)
- {"type":"rock","size":m,"seed":n} {"type":"tree","height":m,"kind":"conifer"|"broadleaf","materials":{"bark":"...","leaves":"..."}}
- {"type":"hull","length":m,"width":m,"depth":m} a boat hull (canoe, rowboat)
- {"type":"room","width":w,"depth":d,"height":h,"window":{"y0":..,"y1":..,"z0":..,"z1":..},"materials":{"floor":"..","wall":"..","ceiling":".."}} an interior shell; add a "portal" light in the window opening for daylight: {"type":"portal","position":[-w/2,y0,z0],"u":[0,0,z1-z0],"v":[0,y1-y0,0]}
- {"type":"generated","prompt":"..."} ONLY when nothing above can stand in for an important object; it will not be built yet.

Rules: prefer a Poly Haven model when one matches; otherwise build from procedural shapes (a milkshake = lathe cup + cylinder straw + sphere cream). Fog, mist, smoke, fire, rain, people and animals cannot be rendered: say so in the report and suggest the nearest visible stand-in (a misty lake = pale low-sun sky + water plane + low exposure). Keep total objects under 25, textures under 4, trees under 12. Skies must come from the sky list. Every object in the scene must appear in the report with its source.

Poly Haven models (id [tags]):
${d.m}

Poly Haven textures (id [tags]):
${d.t}

Poly Haven skies (id [when/weather]):
${d.h}`;
}

export async function writeScene({ prompt, apiKey, workspaceId, catalog, fetchImpl = fetch, maxTokens = 6000 }) {
  const body = {
    model: MODEL, max_tokens: maxTokens,
    system: systemPrompt(catalog),
    messages: [{ role: 'user', content: `Scene request: ${String(prompt).slice(0, 600)}\nReturn the JSON object only.` }],
  };
  const headers = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  if (workspaceId) headers['anthropic-workspace-id'] = workspaceId;
  const r = await fetchImpl('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('scene writer upstream ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('scene writer returned no JSON');
  const scene = JSON.parse(m[0]);
  return { scene: resolveScene(scene, catalog), usage: j.usage, model: j.model };
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
  for (const [name, m] of Object.entries(scene.materials)) {
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
      ob.src = md.gltf; ob.files = md.files; ob.polyhavenId = id;
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
  scene.report = report;
  return scene;
}
