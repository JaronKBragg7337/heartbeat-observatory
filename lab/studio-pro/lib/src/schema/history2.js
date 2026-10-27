// hb-history/2 JSON Schema (draft-07 subset). One record per line in a .history.jsonl file; "k" says which kind.
// The schema checks SHAPE. src/history/validate.js checks MEANING (references, clocks, causes, coverage).
// Rules that make this format honest:
//  - causes (event IDs) are separate from actor (who/what acted) and ancestry (entities this one descends from) and produces (things made).
//  - basis (seen | rebuilt | patched | made | unknown) can sit on entities, events, tracks, track segments and evidence regions.
//    basisOrigin says where the label came from: record (written by the source tool), declared (told at import), inferred (adapter rule), missing.
//  - flags[] marks anything unknown, missing, placeholder, truncated, generated or not mapped. Nothing is dropped silently.
//  - data{} keeps source fields that have no v2 home, verbatim.
export const BASIS = ['seen', 'rebuilt', 'patched', 'made', 'unknown'];
export const BASIS_ORIGIN = ['record', 'declared', 'inferred', 'missing'];
export const TRACK_TYPES = ['position', 'velocity', 'kinematics', 'pose', 'audio', 'midi', 'automation', 'observation', 'measurement', 'relation', 'field', 'camera'];
export const FLAG_STATUS = ['missing', 'unknown', 'inferred', 'unmapped', 'placeholder', 'generated', 'lossy', 'truncated', 'assumed', 'unresolved'];
export const COVERAGE_STATUS = ['complete', 'sampled', 'derived', 'partial', 'unknown'];
export const EVIDENCE_KINDS = ['image', 'video', 'audio', 'sensor', 'text', 'recipe', 'other'];

const str = { type: 'string', minLength: 1 };
const ids = { type: 'array', items: str };
const flags = { type: 'array', items: { type: 'object', required: ['field', 'status'], properties: { field: { type: 'string' }, status: { enum: FLAG_STATUS }, note: { type: 'string' } } } };
const time = { type: 'object', required: ['clock', 'tick'], properties: { clock: str, tick: { type: 'integer' }, end: { type: 'integer' }, approx: { type: 'boolean' } }, additionalProperties: false };
const common = { basis: { enum: BASIS }, basisOrigin: { enum: BASIS_ORIGIN }, flags, data: { type: 'object' }, supersedes: str, note: { type: 'string' } };

export const history2Schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://heartbeatobservatory.com/schema/hb-history-2.schema.json',
  title: 'hb-history/2 record',
  description: 'One line of a hb-history/2 JSONL file. See src/schema/history2.js for the rules.',
  type: 'object',
  required: ['k'],
  properties: { k: { enum: ['meta', 'entity', 'event', 'track', 'evidence', 'coverage', 'checkpoint', 'edit', 'branch', 'export'] } },
  allOf: [
    { if: { properties: { k: { const: 'meta' } }, required: ['k'] }, then: { $ref: '#/$defs/meta' } },
    { if: { properties: { k: { const: 'entity' } }, required: ['k'] }, then: { $ref: '#/$defs/entity' } },
    { if: { properties: { k: { const: 'event' } }, required: ['k'] }, then: { $ref: '#/$defs/event' } },
    { if: { properties: { k: { const: 'track' } }, required: ['k'] }, then: { $ref: '#/$defs/track' } },
    { if: { properties: { k: { const: 'evidence' } }, required: ['k'] }, then: { $ref: '#/$defs/evidence' } },
    { if: { properties: { k: { const: 'coverage' } }, required: ['k'] }, then: { $ref: '#/$defs/coverage' } },
    { if: { properties: { k: { const: 'checkpoint' } }, required: ['k'] }, then: { $ref: '#/$defs/checkpoint' } },
    { if: { properties: { k: { const: 'edit' } }, required: ['k'] }, then: { $ref: '#/$defs/edit' } },
    { if: { properties: { k: { const: 'branch' } }, required: ['k'] }, then: { $ref: '#/$defs/branch' } },
    { if: { properties: { k: { const: 'export' } }, required: ['k'] }, then: { $ref: '#/$defs/export' } },
  ],
  $defs: {
    meta: {
      type: 'object', required: ['k', 'format', 'historyId', 'namespace', 'clocks'],
      properties: {
        k: { const: 'meta' }, format: { const: 'hb-history/2' }, minor: { type: 'integer' },
        historyId: str, namespace: { type: 'string', pattern: '^[a-z0-9][a-z0-9_-]{0,63}$' },
        projectId: str, runId: str, branchId: str, created: { type: 'string' },
        tools: { type: 'array', items: { type: 'object', required: ['name'], properties: { name: str, version: { type: 'string' } } } },
        seeds: { type: 'object' },
        clocks: { type: 'array', minItems: 1, items: { type: 'object', required: ['id', 'kind'], properties: { id: str, kind: { enum: ['linear', 'piecewise', 'musical'] } } } },
        units: { type: 'object' },
        idSpaces: { type: 'array', items: { type: 'object', required: ['prefix', 'kind'], properties: { prefix: str, kind: str, basis: { enum: BASIS }, basisOrigin: { enum: BASIS_ORIGIN }, implicit: { type: 'boolean' }, generation: { type: 'string' }, note: { type: 'string' } } } },
        symbols: { type: 'object' },
        basisDefinitions: { type: 'object' },
        source: { type: 'object' },
        import: { type: 'object' },
        notes: { type: 'array', items: { type: 'string' } },
        flags,
      },
    },
    entity: {
      type: 'object', required: ['k', 'id', 'kind'],
      properties: {
        k: { const: 'entity' }, id: str, kind: str, label: { type: 'string' }, ...common,
        materialId: str, assetHash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
        source: { type: 'object' }, rights: { type: 'object' }, parent: str, attachedTo: str, generation: { type: ['integer', 'string'] },
        evidence: ids, created: time,
      },
    },
    event: {
      type: 'object', required: ['k', 'eventId', 'seq', 'at', 'type'],
      properties: {
        k: { const: 'event' }, eventId: str, seq: { type: 'integer', minimum: 0 }, at: time, type: str,
        subject: str, targets: ids, actor: str, ancestry: ids, produces: ids, causes: ids, origin: { type: 'string' },
        evidence: ids, result: {}, confidence: { type: 'number', minimum: 0, maximum: 1 }, uncertainty: { type: 'object' }, method: { type: 'string' }, ...common,
      },
    },
    track: {
      type: 'object', required: ['k', 'trackId', 'type', 'clock', 'columns'],
      properties: {
        k: { const: 'track' }, trackId: str, subject: str, type: { enum: TRACK_TYPES }, clock: str,
        interp: { enum: ['none', 'step', 'linear', 'slerp', 'cubic', 'unknown'] },
        columns: { type: 'array', minItems: 1, items: { type: 'object', required: ['name', 'unit'], properties: { name: str, unit: { type: 'string' }, unitOrigin: { enum: BASIS_ORIGIN }, uncertainty: {}, kind: { type: 'string' } } } },
        samples: { type: 'array', items: { type: 'array' } },
        media: { type: 'object', properties: { asset: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' }, mediaType: { type: 'string' }, range: { type: 'object' } } },
        uncertainty: { type: 'object' },
        segments: { type: 'array', items: { type: 'object', required: ['from', 'to', 'basis'], properties: { from: { type: 'integer' }, to: { type: 'integer' }, basis: { enum: BASIS }, basisOrigin: { enum: BASIS_ORIGIN }, evidence: ids, method: { type: 'string' }, confidence: { type: 'number' } } } },
        coverage: str, label: { type: 'string' }, evidence: ids, ...common,
      },
    },
    evidence: {
      type: 'object', required: ['k', 'evidenceId', 'kind', 'asset'],
      properties: {
        k: { const: 'evidence' }, evidenceId: str, kind: { enum: EVIDENCE_KINDS },
        asset: { type: 'object', properties: { hash: { type: ['string', 'null'] }, path: { type: 'string' }, mediaType: { type: 'string' }, resolved: { type: 'boolean' } } },
        range: { type: 'object', required: ['clock', 'from', 'to'], properties: { clock: str, from: { type: 'integer' }, to: { type: 'integer' } } },
        region: { type: 'object', properties: { space: { enum: ['pixel', 'uv', 'world'] }, rect: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }, frame: { type: 'string' } } },
        calibration: { type: 'object' }, method: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 }, error: { type: 'object' }, ...common,
      },
    },
    coverage: {
      type: 'object', required: ['k', 'coverageId', 'scope', 'status'],
      properties: {
        k: { const: 'coverage' }, coverageId: str, status: { enum: COVERAGE_STATUS },
        scope: { type: 'object', required: ['kind'], properties: { kind: { enum: ['history', 'events', 'track', 'entity', 'region'] }, ref: { type: 'string' } } },
        sampling: { type: 'object' },
        gaps: { type: 'array', items: { type: 'object', required: ['from', 'to'], properties: { from: { type: 'integer' }, to: { type: 'integer' }, clock: str, reason: { type: 'string' } } } },
        recordedKinds: { type: 'array', items: { type: 'string' } }, excludedKinds: { type: 'array', items: { type: 'string' } },
        capacity: { type: 'integer' }, recorded: { type: 'integer' }, dropped: { type: 'integer' }, overflow: { type: ['integer', 'boolean'] }, flags, data: { type: 'object' }, note: { type: 'string' },
      },
    },
    checkpoint: {
      type: 'object', required: ['k', 'checkpointId', 'at', 'subsystem'],
      properties: {
        k: { const: 'checkpoint' }, checkpointId: str, at: time, subsystem: str,
        state: { type: 'object', properties: { asset: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' } } },
        includes: { type: 'array', items: { type: 'string' } }, assets: { type: 'array', items: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' } },
        rng: { type: 'object' }, note: { type: 'string' }, flags, data: { type: 'object' },
      },
    },
    edit: {
      type: 'object', required: ['k', 'editId', 'op'],
      properties: { k: { const: 'edit' }, editId: str, at: time, op: str, target: str, params: {}, actor: str, branchId: str, parentEdit: str, causes: ids, inverse: {}, supersedes: str, flags, data: { type: 'object' }, note: { type: 'string' } },
    },
    branch: {
      type: 'object', required: ['k', 'branchId'],
      properties: { k: { const: 'branch' }, branchId: str, name: { type: 'string' }, from: { type: 'object', properties: { branchId: str, editId: str, checkpointId: str } }, created: time, flags, data: { type: 'object' }, note: { type: 'string' } },
    },
    export: {
      type: 'object', required: ['k', 'exportId', 'outputHash'],
      properties: {
        k: { const: 'export' }, exportId: str, at: time, projectRevision: { type: ['integer', 'string'] },
        sourceRanges: { type: 'array', items: { type: 'object', required: ['clock', 'from', 'to'], properties: { historyId: str, clock: str, from: { type: 'integer' }, to: { type: 'integer' } } } },
        settings: { type: 'object' }, outputHash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' }, rights: { type: 'object' }, tool: { type: 'object' }, flags, data: { type: 'object' }, note: { type: 'string' },
      },
    },
  },
};
