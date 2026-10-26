// hb-project/1 JSON Schema (draft-07 subset). One manifest describes a whole project: scenes, songs, shots and evidence.
// Big data is never inside the manifest: audio, textures, meshes, video, simulation chunks and history streams are hash-addressed
// blobs ("sha256:<hex>") listed under assets. Items point at assets/entities/histories/other items through refs, which makes the
// dependency graph (and the dependency hash that tells you a render is stale).
export const PROJECT_MINOR = 1;
export const ITEM_TYPES = ['scene', 'song', 'shot', 'evidence'];
export const ASSET_ROLES = ['original', 'derivative', 'render', 'evidence', 'history', 'recipe', 'model', 'texture', 'audio', 'video', 'other'];
const str = { type: 'string', minLength: 1 };
const hash = { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' };
const strs = { type: 'array', items: str };
const rational = { type: ['string', 'integer'], pattern: '^-?\\d+(/\\d+)?$' };

export const project1Schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://heartbeatobservatory.com/schema/hb-project-1.schema.json',
  title: 'hb-project/1 manifest',
  type: 'object',
  required: ['format', 'minor', 'projectId', 'name', 'assets', 'entities', 'items', 'histories', 'clocks'],
  properties: {
    format: { const: 'hb-project/1' }, minor: { type: 'integer', minimum: 0 }, projectId: str, name: { type: 'string' },
    created: { type: 'string' }, modified: { type: 'string' }, revision: { type: 'integer', minimum: 0 },
    tool: { type: 'object', properties: { name: str, version: { type: 'string' } } },
    toolVersions: { type: 'object' }, seeds: { type: 'object' },
    units: { type: 'object', properties: { length: { type: 'string' }, time: { type: 'string' }, angle: { type: 'string' }, mass: { type: 'string' } } },
    rights: { type: 'object', properties: { license: { type: 'string' }, holder: { type: 'string' }, note: { type: 'string' } } },
    clocks: { type: 'array', items: { type: 'object', required: ['id', 'kind'], properties: { id: str, kind: { enum: ['linear', 'piecewise', 'musical'] } } } },
    assets: { type: 'object', additionalProperties: { $ref: '#/$defs/asset' } },
    entities: { type: 'object', additionalProperties: { $ref: '#/$defs/entity' } },
    materials: { type: 'object', additionalProperties: { $ref: '#/$defs/material' } },
    rigs: { type: 'object', additionalProperties: { $ref: '#/$defs/rig' } },
    clips: { type: 'object', additionalProperties: { $ref: '#/$defs/clip' } },
    machines: { type: 'object', additionalProperties: { $ref: '#/$defs/machine' } },
    items: { type: 'object', additionalProperties: { $ref: '#/$defs/item' } },
    histories: { type: 'object', additionalProperties: { $ref: '#/$defs/historyRef' } },
    exports: { type: 'object', additionalProperties: { $ref: '#/$defs/export' } },
    checkpoints: { type: 'object', additionalProperties: { type: 'object', required: ['revision', 'docHash'], properties: { revision: { type: 'integer' }, docHash: hash, label: { type: 'string' } } } },
    lineage: { type: 'object', properties: { parent: { type: 'object' }, branch: { type: 'string' } } },
    migrations: { type: 'array', items: { type: 'object' } },
    undoStack: { type: 'array', items: { type: 'integer' } }, redoStack: { type: 'array', items: { type: 'integer' } },
    log: { type: 'object' },
  },
  $defs: {
    asset: {
      type: 'object', required: ['id', 'hash', 'bytes', 'mediaType', 'role'],
      properties: {
        id: str, hash, bytes: { type: 'integer', minimum: 0 }, mediaType: str, role: { enum: ASSET_ROLES }, name: { type: 'string' },
        hashKind: { enum: ['bytes', 'chunks'] }, chunks: { type: 'array', items: hash }, chunkBytes: { type: 'integer' },
        source: { type: 'object' }, rights: { type: 'object' }, derivedFrom: strs, units: { type: 'object' }, format: { type: 'string' },
        previous: { type: 'array', items: hash }, interrupted: { type: 'boolean' }, note: { type: 'string' }, created: { type: 'string' },
      },
    },
    entity: { type: 'object', required: ['id', 'kind'], properties: { id: str, kind: str, label: { type: 'string' }, materialId: str, assetId: str, parent: str, scene: str, order: { type: 'integer' }, visible: { type: 'boolean' }, locked: { type: 'boolean' }, transform: { $ref: '#/$defs/transform' }, rights: { type: 'object' }, data: { type: 'object' }, created: { type: 'string' } } },
    transform: { type: 'object', properties: { position: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 }, rotation: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }, scale: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 } }, additionalProperties: false },
    rig: { type: 'object', required: ['id', 'name', 'joints'], properties: { id: str, name: { type: 'string' }, joints: { type: 'object', additionalProperties: { type: 'object', required: ['name', 't', 'r', 's', 'order'], properties: { name: str, parent: { type: ['string', 'null'] }, t: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 }, r: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }, s: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 }, order: { type: 'integer' } } } }, constraints: { type: 'object', additionalProperties: { type: 'object', required: ['id', 'type'], properties: { id: str, type: { enum: ['twoBoneIK', 'fabrik', 'lookAt', 'footPlant'] }, weight: { type: 'number' }, enabled: { type: 'boolean' } } } }, limits: { type: 'object', additionalProperties: { type: 'object', properties: { minInteriorDeg: { type: 'number' }, maxInteriorDeg: { type: 'number' }, maxBendDeg: { type: 'number' }, hinge: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 } } } }, ragdoll: { type: 'object', additionalProperties: { type: 'number' } }, source: { type: 'object' } } },
    clip: { type: 'object', required: ['id', 'name', 'duration', 'loop', 'tracks'], properties: { id: str, name: { type: 'string' }, rig: str, duration: { type: 'number', minimum: 0 }, loop: { type: 'boolean' }, tracks: { type: 'object', additionalProperties: { type: 'object', required: ['id', 'path', 'times', 'values'], properties: { id: str, joint: str, name: str, path: { enum: ['rotation', 'translation', 'scale', 'morph', 'prop'] }, interp: { enum: ['step', 'linear', 'cubic', 'bezier'] }, times: { type: 'array', items: { type: 'number' } }, values: { type: 'array', items: { type: 'array', items: { type: 'number' } } } } } }, events: { type: 'array' }, rootMotion: { type: 'object' }, contacts: { type: 'object' }, source: { type: 'object' } } },
    machine: { type: 'object', required: ['id', 'name', 'rig', 'initial', 'states'], properties: { id: str, name: { type: 'string' }, rig: str, initial: str, params: { type: 'object' }, states: { type: 'object' }, transitions: { type: 'array' } } },
    material: { type: 'object', required: ['id', 'name', 'props'], properties: { id: str, name: { type: 'string' }, props: { type: 'object' }, units: { type: 'object' }, source: { type: 'object' } } },
    refs: { type: 'object', properties: { assets: strs, entities: strs, histories: strs, items: strs }, additionalProperties: false },
    item: {
      type: 'object', required: ['id', 'type', 'name', 'data'],
      properties: { id: str, type: { enum: ITEM_TYPES }, name: { type: 'string' }, data: { type: 'object' }, refs: { $ref: '#/$defs/refs' }, builtFrom: hash, created: { type: 'string' }, modified: { type: 'string' }, note: { type: 'string' } },
      allOf: [
        { if: { properties: { type: { const: 'scene' } }, required: ['type'] }, then: { properties: { data: { type: 'object', properties: { title: { type: 'string' }, root: str, assets: { type: 'array', items: { type: 'object', required: ['asset'], properties: { asset: str, role: { type: 'string' }, transform: { type: 'object' } } } }, histories: strs, units: { type: 'object' }, camera: { type: 'object' } } } } } },
        { if: { properties: { type: { const: 'song' } }, required: ['type'] }, then: { properties: { data: { type: 'object', properties: { title: { type: 'string' }, tempo: { type: 'object', properties: { clock: str, bpm: rational } }, recipes: { type: 'array', items: { type: 'object' } }, parts: { type: 'array', items: { type: 'object' } }, histories: strs } } } } },
        { if: { properties: { type: { const: 'shot' } }, required: ['type'] }, then: { properties: { data: { type: 'object', properties: { scene: str, from: rational, to: rational, clock: str, camera: { type: 'object' }, note: { type: 'string' } } } } } },
        { if: { properties: { type: { const: 'evidence' } }, required: ['type'] }, then: { properties: { data: { type: 'object', required: ['kind', 'assets'], properties: { kind: { enum: ['image', 'video', 'audio', 'sensor', 'text', 'recipe', 'other'] }, assets: { type: 'array', minItems: 1, items: str }, basis: { enum: ['seen', 'rebuilt', 'patched', 'made', 'unknown'] }, method: { type: 'string' }, range: { type: 'object' }, region: { type: 'object' }, calibration: { type: 'object' } } } } } },
      ],
    },
    historyRef: {
      type: 'object', required: ['namespace', 'historyId', 'asset'],
      properties: { namespace: { type: 'string', pattern: '^[a-z0-9][a-z0-9_-]{0,63}$' }, historyId: str, asset: str, format: { const: 'hb-history/2' }, counts: { type: 'object' }, labels: { type: 'object' }, source: { type: 'object' }, imported: { type: 'object' }, created: { type: 'string' } },
    },
    export: {
      type: 'object', required: ['exportId', 'outputHash', 'projectRevision'],
      properties: { exportId: str, outputHash: hash, outputAsset: str, projectRevision: { type: 'integer' }, docHash: hash, depHash: hash, itemId: str, sourceRanges: { type: 'array', items: { type: 'object' } }, settings: { type: 'object' }, rights: { type: 'object' }, tool: { type: 'object' }, created: { type: 'string' } },
    },
  },
};
