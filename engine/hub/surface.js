// Surface system — PBR materials with calibrated, real-world texel density.
//
// WHY PROJECTION INSTEAD OF MESH UVs
// Mesh UVs make uniform texel density a per-asset chore. BoxGeometry hands every
// face UV 0..1, so a 4 m wall face and its 0.2 m return edge resolve at 20x
// different density, and bevelled corner strips get their own arbitrary UVs.
// Projecting from world position along the dominant normal axis makes density a
// function of one pair of numbers — metres per tile — uniform across every face
// of every object sharing a material, by construction.
//
// WHY A vec2 TILE RATHER THAN A SCALAR
// The photographic sources are not square. Bricks097 was measured at 16.00
// courses per tile (32 px pitch on a 512 px-tall image, autocorrelation r=1.0),
// which at a 75 mm course is exactly 1.200 m tall by 2.400 m wide. Driving that
// from a single scalar stretches the brick by 2x. Every card below carries the
// measured or published real-world size of its tile.
//
// WHAT THE SAME INJECTION BUYS FOR FREE
//   · anti-tiling — a second sample at an incommensurate scale (x0.173)
//   · ground grime — dirt accumulating toward world y = 0
//   · settled dust on up-facing normals
//   · edge wear — roughness varying with the macro sample instead of being flat
//
// NORMAL MAPS UNDER PROJECTION
// three.js computes `normal` in VIEW space and, for tangent-space normal maps,
// derives `tbn` from screen-space UV derivatives. Those derivatives describe the
// mesh's own UVs, which we are no longer sampling with — so the tangent frame
// would be wrong. Instead the frame is rebuilt analytically from the projection
// axis (which is axis-aligned and therefore exactly known) and rotated into view
// space. This is both correct and cheaper than the derivative path.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

const TEX_BASE = "/engine/hub/assets/textures/";

// ---------------------------------------------------------------------------
// Material cards (doctrine Part 4): every surface is data, not a vibe.
// `tile` is [width, height] in METRES that one texture tile covers.
// `sizeSource` records how that number was arrived at — measured vs published —
// so an estimate is never mistaken for a measurement.
// ---------------------------------------------------------------------------
export const CARDS = {
  brickRed: {
    id: "MAT-BRICK-0001", base: "Bricks097", label: "Red brick, running bond",
    tile: [2.4, 1.2], sizeSource: "measured: 32 px course pitch, 16.00 courses/tile @ 75 mm",
    roughness: 0.92, metalness: 0, maps: ["color", "normal", "rough", "ao"],
  },
  stone: {
    id: "MAT-STONE-0001", base: "Bricks075A", label: "Rough coursed stone",
    tile: [2.0, 1.0], sizeSource: "published: ambientCG 200x100 cm",
    roughness: 0.94, metalness: 0, maps: ["color", "normal", "rough", "ao"],
  },
  limestone: {
    id: "MAT-STONE-0002", base: "Travertine009", label: "Travertine / limestone ashlar",
    tile: [1.2, 1.2], sizeSource: "published: ambientCG 120x120 cm",
    roughness: 0.82, metalness: 0, maps: ["color", "normal", "rough", "ao"],
  },
  concrete: {
    id: "MAT-CONC-0001", base: "Concrete034", label: "Fine broomed concrete",
    tile: [1.1, 0.55], sizeSource: "published: ambientCG 110x55 cm",
    roughness: 0.91, metalness: 0, maps: ["color", "normal", "rough"],
  },
  paving: {
    id: "MAT-PAVE-0001", base: "PavingStones138", label: "Granite setts with moss",
    tile: [1.25, 2.5], sizeSource: "published: ambientCG 125x250 cm (pixel aspect 1:2 agrees)",
    roughness: 0.88, metalness: 0, maps: ["color", "normal", "rough", "ao"],
  },
  asphalt: {
    id: "MAT-ASPH-0001", base: "Asphalt033", label: "Weathered asphalt",
    tile: [4.0, 4.0], sizeSource: "ESTIMATE: asphalt has no periodic cue to measure",
    roughness: 0.88, metalness: 0, maps: ["color", "normal", "rough"],
  },
  grass: {
    id: "MAT-VEG-0001", base: "Grass005", label: "Mown lawn",
    tile: [2.0, 2.0], sizeSource: "ESTIMATE: blade length implies ~2 m tile",
    roughness: 0.95, metalness: 0, maps: ["color", "normal", "rough", "ao"],
  },
  bark: {
    id: "MAT-VEG-0002", base: "Bark014", label: "Tree bark",
    tile: [1.2, 1.2], sizeSource: "published: ambientCG 120x120 cm",
    roughness: 0.9, metalness: 0, maps: ["color", "normal", "rough", "ao"],
  },
  wood: {
    id: "MAT-WOOD-0001", base: "Planks037A", label: "Stained plank door",
    tile: [2.0, 2.0], sizeSource: "ESTIMATE: plank width implies ~2 m tile",
    roughness: 0.78, metalness: 0, maps: ["color", "normal", "rough", "ao"],
  },
  roof: {
    id: "MAT-ROOF-0001", base: "RoofingTiles013A", label: "Dark slate roofing",
    tile: [2.9, 2.9], sizeSource: "published: ambientCG 290x290 cm",
    roughness: 0.8, metalness: 0, maps: ["color", "normal", "rough", "ao"],
  },
};

// ---------------------------------------------------------------------------
// Texture loading
// ---------------------------------------------------------------------------
const texCache = new Map();
let loaded = false;

/** Quality gate: weak phones skip normal/AO entirely to save bandwidth and fill. */
function quality() {
  const tier = (typeof window !== "undefined" && window.HBDevice && window.HBDevice.tier) || "desktop";
  if (tier === "mobile-lite") return { normal: false, ao: false, aniso: 2 };
  if (tier === "mobile-high") return { normal: true, ao: false, aniso: 4 };
  return { normal: true, ao: true, aniso: 8 };
}

function loadTex(url, srgb, aniso, renderer) {
  const key = url + (srgb ? "|s" : "|l");
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.TextureLoader().load(url);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = renderer
    ? Math.min(aniso, renderer.capabilities.getMaxAnisotropy())
    : aniso;
  texCache.set(key, t);
  return t;
}

/**
 * Preload every card's maps. Resolves when all requests have settled.
 * Construct scene objects only after this resolves — building a CanvasTexture or
 * material from a not-yet-present map yields something that renders solid black
 * and looks like a lighting bug, which is an expensive thing to chase.
 */
export function loadSurfaces(renderer) {
  const q = quality();
  const jobs = [];
  for (const card of Object.values(CARDS)) {
    for (const m of card.maps) {
      if (m === "normal" && !q.normal) continue;
      if (m === "ao" && !q.ao) continue;
      const url = `${TEX_BASE}${card.base}_${m}.webp`;
      const t = loadTex(url, m === "color", q.aniso, renderer);
      jobs.push(new Promise((res) => {
        if (t.image && t.image.width) return res();
        const done = () => res();
        t.addEventListener?.("dispose", done);
        // TextureLoader sets image asynchronously; poll cheaply rather than
        // depending on an event three does not reliably emit for cached hits.
        const t0 = performance.now();
        const tick = () => {
          if (t.image && t.image.width) return res();
          if (performance.now() - t0 > 20000) return res(); // never hang the world
          requestAnimationFrame(tick);
        };
        tick();
      }));
    }
  }
  return Promise.all(jobs).then(() => { loaded = true; });
}

export function surfacesReady() { return loaded; }

// ---------------------------------------------------------------------------
// Shader injection
// ---------------------------------------------------------------------------
const PARS = /* glsl */ `
  varying vec3 vProjPos;
  varying vec3 vProjNrm;
  varying float vHbWorldY;
`;

const VERT_TAIL = /* glsl */ `
  #ifdef PROJ_LOCAL
    vProjPos = position;
    vProjNrm = normal;
  #else
    vProjPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vProjNrm = mat3(modelMatrix) * normal;
  #endif
  vHbWorldY = (modelMatrix * vec4(position, 1.0)).y;
`;

// Shared projection: pick the dominant normal axis and return both the UV and
// the world-space tangent/bitangent that go with it.
const PROJ_FN = /* glsl */ `
  void hbProject(vec3 pos, vec3 nrm, vec2 tile, out vec2 puv, out vec3 T, out vec3 B) {
    vec3 an = abs(normalize(nrm));
    if (an.y >= an.x && an.y >= an.z) {        // floors / roofs
      puv = vec2(pos.x, pos.z); T = vec3(1.0, 0.0, 0.0); B = vec3(0.0, 0.0, 1.0);
    } else if (an.x >= an.z) {                 // walls facing +/-X
      puv = vec2(pos.z, pos.y); T = vec3(0.0, 0.0, 1.0); B = vec3(0.0, 1.0, 0.0);
    } else {                                   // walls facing +/-Z
      puv = vec2(pos.x, pos.y); T = vec3(1.0, 0.0, 0.0); B = vec3(0.0, 1.0, 0.0);
    }
    puv /= tile;
  }
`;

const MAP_FRAG = /* glsl */ `
  vec2 hbUv; vec3 hbT; vec3 hbB;
  hbProject(vProjPos, vProjNrm, uTile, hbUv, hbT, hbB);

  vec4 sampledDiffuseColor = texture2D(map, hbUv);
  // Gamma below 1 lifts a crushed photographic albedo without blowing highlights.
  // A colour tint cannot do this: multiplying only ever darkens (Part 4B).
  sampledDiffuseColor.rgb = pow(sampledDiffuseColor.rgb, vec3(uGamma)) * uGain;

  // Anti-tiling. 0.173 is deliberately incommensurate with 1.0 so the macro
  // pattern never lines up with the base tile grid.
  vec3 hbMacro = texture2D(map, hbUv * 0.173 + vec2(0.37, 0.61)).rgb;
  float hbMacroLum = dot(hbMacro, vec3(0.299, 0.587, 0.114));
  sampledDiffuseColor.rgb *= mix(1.0, 0.68 + 0.72 * hbMacroLum, uMacro);

  // Grime accumulates from the ground up — strongest at the base of a wall.
  float hbGrime = 1.0 - smoothstep(0.0, uGrimeH, max(vHbWorldY, 0.0));
  hbGrime *= 0.65 + 0.35 * hbMacroLum;
  sampledDiffuseColor.rgb *= mix(1.0, 0.58, hbGrime * uGrime);

  // Dust settles on up-facing surfaces and desaturates them toward pale grey.
  float hbDust = clamp(normalize(vProjNrm).y, 0.0, 1.0) * uDust * (0.55 + 0.45 * hbMacroLum);
  sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.62, 0.58, 0.50), hbDust * 0.5);

  diffuseColor *= sampledDiffuseColor;
`;

const ROUGH_FRAG = /* glsl */ `
  float roughnessFactor = roughness;
  {
    vec2 rUv; vec3 rT; vec3 rB;
    hbProject(vProjPos, vProjNrm, uTile, rUv, rT, rB);
    #ifdef USE_ROUGHNESSMAP
      roughnessFactor *= texture2D(roughnessMap, rUv).g;
    #endif
    float rWear = dot(texture2D(map, rUv * 0.173 + vec2(0.37, 0.61)).rgb, vec3(0.299, 0.587, 0.114));
    roughnessFactor *= mix(0.86, 1.14, rWear);
    roughnessFactor = clamp(roughnessFactor, 0.04, 1.0);
  }
`;

// Rebuild the tangent frame from the projection axis instead of UV derivatives,
// then rotate it into view space to match three's `normal`.
const NORMAL_FRAG = /* glsl */ `
  #ifdef USE_NORMALMAP_TANGENTSPACE
  {
    vec2 nUv; vec3 nT; vec3 nB;
    hbProject(vProjPos, vProjNrm, uTile, nUv, nT, nB);
    vec3 mapN = texture2D(normalMap, nUv).xyz * 2.0 - 1.0;
    mapN.xy *= normalScale;
    vec3 Nv = normalize(normal);
    vec3 Tv = normalize(mat3(viewMatrix) * nT);
    Tv = normalize(Tv - Nv * dot(Nv, Tv));      // Gram-Schmidt against the real normal
    vec3 Bv = cross(Nv, Tv);
    normal = normalize(mat3(Tv, Bv, Nv) * mapN);
  }
  #endif
`;

const AO_FRAG = /* glsl */ `
  #ifdef USE_AOMAP
  {
    vec2 aUv; vec3 aT; vec3 aB;
    hbProject(vProjPos, vProjNrm, uTile, aUv, aT, aB);
    float ambientOcclusion = (texture2D(aoMap, aUv).r - 1.0) * aoMapIntensity + 1.0;
    reflectedLight.indirectDiffuse *= ambientOcclusion;
    #if defined( USE_ENVMAP ) && defined( STANDARD )
      float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
      reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
    #endif
  }
  #endif
`;

const matCache = new Map();

/**
 * Build (or fetch from cache) a projected PBR material for a card.
 * @param {keyof CARDS} key
 * @param {object} opts tile, local, macro, grime, grimeHeight, dust, gamma, gain,
 *                      roughness, metalness, normalScale, aoIntensity, color
 */
export function surface(key, opts = {}) {
  const card = CARDS[key];
  if (!card) throw new Error(`surface("${key}"): no such material card`);
  const q = quality();

  const tile = opts.tile || card.tile;
  const o = {
    tileX: tile[0], tileY: tile[1],
    local: opts.local ?? false,
    macro: opts.macro ?? 0.5,
    grime: opts.grime ?? 0.42,
    grimeHeight: opts.grimeHeight ?? 1.5,
    dust: opts.dust ?? 0.3,
    gamma: opts.gamma ?? 1,
    gain: opts.gain ?? 1,
    roughMul: opts.roughness ?? 1,
    metalMul: opts.metalness ?? 1,
    normalScale: opts.normalScale ?? 1,
    aoIntensity: opts.aoIntensity ?? 1,
    color: opts.color ?? 0xffffff,
  };
  const ck = `${card.id}|${JSON.stringify(o)}`;
  if (matCache.has(ck)) return matCache.get(ck);

  const has = (m) => card.maps.includes(m);
  const mat = new THREE.MeshStandardMaterial({
    map: loadTex(`${TEX_BASE}${card.base}_color.webp`, true, q.aniso),
    normalMap: has("normal") && q.normal ? loadTex(`${TEX_BASE}${card.base}_normal.webp`, false, q.aniso) : null,
    roughnessMap: has("rough") ? loadTex(`${TEX_BASE}${card.base}_rough.webp`, false, q.aniso) : null,
    aoMap: has("ao") && q.ao ? loadTex(`${TEX_BASE}${card.base}_ao.webp`, false, q.aniso) : null,
    color: o.color,
    roughness: THREE.MathUtils.clamp(card.roughness * o.roughMul, 0.04, 1),
    metalness: THREE.MathUtils.clamp(card.metalness * o.metalMul, 0, 1),
    aoMapIntensity: o.aoIntensity,
  });
  if (mat.normalMap) mat.normalScale = new THREE.Vector2(o.normalScale, o.normalScale);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTile = { value: new THREE.Vector2(o.tileX, o.tileY) };
    shader.uniforms.uMacro = { value: o.macro };
    shader.uniforms.uGrime = { value: o.grime };
    shader.uniforms.uGrimeH = { value: o.grimeHeight };
    shader.uniforms.uDust = { value: o.dust };
    shader.uniforms.uGamma = { value: o.gamma };
    shader.uniforms.uGain = { value: o.gain };

    const decls =
      `uniform vec2 uTile;\nuniform float uMacro;\nuniform float uGrime;\n` +
      `uniform float uGrimeH;\nuniform float uDust;\nuniform float uGamma;\n` +
      `uniform float uGain;\n${PARS}\n${PROJ_FN}`;

    shader.vertexShader = `${o.local ? "#define PROJ_LOCAL\n" : ""}${PARS}\n${shader.vertexShader}`
      .replace("#include <fog_vertex>", `#include <fog_vertex>\n${VERT_TAIL}`);

    shader.fragmentShader = `${o.local ? "#define PROJ_LOCAL\n" : ""}${decls}\n${shader.fragmentShader}`
      .replace("#include <map_fragment>", MAP_FRAG)
      .replace("#include <roughnessmap_fragment>", ROUGH_FRAG)
      .replace("#include <normal_fragment_maps>", NORMAL_FRAG)
      .replace("#include <aomap_fragment>", AO_FRAG);
  };
  // Distinct key so three compiles and caches one program per option set.
  mat.customProgramCacheKey = () => ck;

  matCache.set(ck, mat);
  return mat;
}

/** Machine-readable material report (doctrine Part 9.1) — sizes and provenance. */
export function surfaceReport() {
  return {
    generatedAt: new Date().toISOString(),
    loaded,
    quality: quality(),
    cards: Object.entries(CARDS).map(([k, c]) => ({
      key: k, id: c.id, label: c.label, base: c.base,
      tileMetres: c.tile, sizeSource: c.sizeSource,
      roughness: c.roughness, metalness: c.metalness, maps: c.maps,
      // Courses per tile only means something for coursed masonry.
      coursesPerTile: k === "brickRed" ? +(c.tile[1] / 0.075).toFixed(2) : null,
    })),
    materialsBuilt: matCache.size,
    texturesLoaded: texCache.size,
  };
}
