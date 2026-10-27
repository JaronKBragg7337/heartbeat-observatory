import { allocate } from './buffer.js';
import { clamp, seededRandom } from './dsp.js';

export const CONTACT_MATERIALS = Object.freeze({
  generic: { modes: [330, 517, 803], damping: 8, noise: 0.22, brightness: 0.5 },
  wood: { modes: [180, 317, 523], damping: 9, noise: 0.28, brightness: 0.35 },
  metal: { modes: [740, 1319, 2137], damping: 2.2, noise: 0.08, brightness: 0.9 },
  steel: { modes: [820, 1471, 2389], damping: 1.8, noise: 0.07, brightness: 1 },
  glass: { modes: [1047, 1867, 2793], damping: 1.5, noise: 0.035, brightness: 1 },
  stone: { modes: [130, 233, 419], damping: 13, noise: 0.36, brightness: 0.3 },
  concrete: { modes: [105, 197, 337], damping: 14, noise: 0.4, brightness: 0.25 },
  rubber: { modes: [85, 143, 229], damping: 22, noise: 0.12, brightness: 0.1 },
  water: { modes: [420, 691, 1123], damping: 6, noise: 0.55, brightness: 0.65 },
  sand: { modes: [70, 113, 181], damping: 25, noise: 0.8, brightness: 0.2 },
});

const idHash = (text) => { let h = 2166136261; for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const material = (id, overrides) => ({ id, ...(CONTACT_MATERIALS[id] || CONTACT_MATERIALS.generic), ...(overrides?.[id] || {}) });

export function contactSound(contact, { sampleRate = 48000, materialOverrides = {}, maxDuration = 2 } = {}) {
  const ids = contact.materialIds || contact.materials || [contact.materialId || 'generic', 'generic'];
  const a = material(ids[0] || 'generic', materialOverrides), b = material(ids[1] || 'generic', materialOverrides);
  const speed = Math.max(0, contact.impactSpeed ?? contact.speed ?? 0), mass = Math.max(0.0001, contact.mass ?? 1);
  if (!(speed > 0)) return { buffer: allocate(1, sampleRate, 2), parameters: { materialIds: [a.id, b.id], impactSpeed: speed, mass, amplitude: 0, duration: 1 / sampleRate } };
  const amplitude = clamp(0.08 + 0.22 * Math.log1p(speed) + 0.05 * Math.log1p(mass), 0.02, 0.85);
  const decay = clamp(0.6 * Math.sqrt(mass) * (16 / (a.damping + b.damping)), 0.025, maxDuration);
  const length = Math.ceil(Math.min(maxDuration, decay * 5 + 0.02) * sampleRate), out = allocate(length, sampleRate, 2);
  const random = seededRandom(idHash(a.id + '/' + b.id)), massPitch = Math.pow(1 / mass, 1 / 6), modes = [...a.modes, ...b.modes].sort((x, y) => x - y).slice(0, 6);
  let low = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate, attack = Math.min(1, t * sampleRate / 3);
    let sample = 0;
    for (let m = 0; m < modes.length; m++) {
      const frequency = modes[m] * massPitch * (1 + 0.025 * Math.min(speed, 10)), damping = (a.damping + b.damping) * 0.5 * (1 + m * 0.3) / Math.sqrt(mass);
      sample += Math.sin(2 * Math.PI * frequency * t) * Math.exp(-damping * t) / (1 + m * 0.7);
    }
    const white = random() * 2 - 1; low += (0.08 + 0.3 * (a.brightness + b.brightness) / 2) * (white - low);
    sample = sample * 0.25 + (white - low) * (a.noise + b.noise) * Math.exp(-t * 55);
    const pan = clamp(contact.pan || 0, -1, 1);
    out.channels[0][i] = sample * amplitude * attack * Math.cos((pan + 1) * Math.PI / 4);
    out.channels[1][i] = sample * amplitude * attack * Math.sin((pan + 1) * Math.PI / 4);
  }
  return {
    buffer: out,
    parameters: { materialIds: [a.id, b.id], impactSpeed: speed, mass, amplitude, decay, modes, duration: out.duration, model: 'modal-contact/1' },
  };
}
