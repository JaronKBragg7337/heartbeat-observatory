// The alien-looking ship (SH17; BIBLE-v3 3.3). Game fiction, never explained in Game 1. This is a LOOK only: no people, no signs, no
// architecture. It comes close to a port, a convoy or a lone pilot, holds, and leaves faster than anything we have.
// The rule: nothing about it should read as a human design decision. No seams, no windows, no flame, no lettering, no symmetry
// a drawing office would choose.
export default {
  id: 'alien', name: 'The alien-looking ship', kind: 'alien', home: 'unknown',
  tagline: 'Seen. Not understood. Gone.',
  ethos: 'Smooth, dark and slightly wrong. A hull with no seams that seems to have been poured rather than built, a surface that shifts colour as you move, no engines you can point at and no lights you can read. It does not appear to want anything, which is worse.',
  palette: { primary: 0x15181f, secondary: 0x2a3340, accent: 0x7fffd4, trim: 0x3a2a55, dark: 0x050608, light: 0xcfe8f5, extra: [0xff6ad5, 0x6ad5ff, 0xe6ff6a] },
  lights: { ambient: 0xaaf0e0, work: 0xaaf0e0, signal: 0x7fffd4 },
  materials: [
    { id: 'poured-hull', name: 'Poured hull', color: 0x15181f, roughness: 0.18, metalness: 0.7, use: 'the whole body: seamless, with a faint pearl sheen; no panel lines, no rivets, no markings' },
    { id: 'shift-sheen', name: 'Shifting sheen', color: 0x3a2a55, roughness: 0.1, metalness: 0.9, use: 'an iridescent layer: the colour slides from violet through teal to green with the view angle (thin-film look)' },
    { id: 'quiet-light', name: 'Quiet light', color: 0x7fffd4, roughness: 0.2, metalness: 0.0, use: 'one slow pulse of pale teal along an edge, never in a pattern a person could read' },
  ],
  signs: {
    font: 'none: nothing a human can read', fontStack: 'sans-serif', weight: 400, upper: false, tracking: 0,
    plate: { bg: 0x050608, fg: 0x7fffd4, edge: 0x2a3340, radius: 0.5, rivets: false },
    warning: { bg: 0x050608, fg: 0x7fffd4, stripe: [0x050608, 0x2a3340] },
    banner: { bg: 0x050608, fg: 0x7fffd4 },
    emblem: { shape: 'none', fg: 0x7fffd4, bg: 0x050608, meaning: 'none: it carries no mark that a human has ever matched to anything' },
    numbering: { pattern: 'none', example: 'none' },
    places: ['where it was', 'where it is not', 'at the edge of sight'],
    slogans: ['(no text)', '(no text)', '(no text)'],
    graffiti: ['(nobody dares)', '(scanner log only)'],
  },
  livery: {
    hull: 0x15181f, hullAlt: 0x2a3340, belly: 0x050608, trim: 0x3a2a55, accent: 0x7fffd4, engineGlow: 0x7fffd4,
    stripe: { kind: 'none', colors: [0x7fffd4], widthFrac: 0, note: 'no stripe. A single pale teal pulse travels slowly along one edge, and the thin-film sheen slides with the view angle' },
    shape: 'A long smooth body with no clear front: swollen where a human ship would be narrow, tapered where it would be broad, as if poured. No windows, no visible engines, no landing gear, no guns, no symmetry that looks planned. About the size of a corvette (~40 m), but hard to judge.',
    registryPrefix: '', nameStyle: 'none: the scanner logs it as UNKNOWN-n',
    weathering: { grime: 0, scorch: 0, patchwork: 0 }, navBeacon: 0x7fffd4,
    motion: 'It holds at a standoff, then accelerates past what the drive tables allow, with no flame and no sound; the sky darkens briefly where it was.',
    iridescence: { a: 0x3a2a55, b: 0x2affc4, c: 0x6a3aff, filmNm: [380, 520] },
  },
};
