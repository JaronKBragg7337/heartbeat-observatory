import { ClockSet } from '../../src/time/clock.js';

export function studioClocks({ sampleRate = 48000, ppq = 960, bpm = 120, fps = 30, fpsDen = 1 } = {}) {
  return [
    { id: 'audio', kind: 'linear', rate: [sampleRate, 1], unit: 'sample' },
    { id: 'music', kind: 'musical', ppq, tempo: [{ beat: '0', bpm: String(bpm) }], meter: [{ bar: 1, num: 4, den: 4 }] },
    { id: 'picture', kind: 'linear', rate: [fps, fpsDen], unit: 'frame' },
  ];
}

export class StudioTime {
  constructor(clocks) { this.clocks = new ClockSet(clocks); }
  tick(at = 0, target = 'audio') {
    if (Number.isInteger(at)) return target === 'audio' ? at : this.clocks.convert('audio', at, target, { round: 'nearest' }).tick;
    if (!at || !at.clock || !Number.isInteger(at.tick)) throw new TypeError('time must be an audio sample or {clock,tick}');
    return at.clock === target ? at.tick : this.clocks.convert(at.clock, at.tick, target, { round: 'nearest' }).tick;
  }
  seconds(tick, clock = 'audio') { return this.clocks.toProjectNumber(clock, tick); }
  secondsTick(seconds, target = 'audio') {
    const converted = this.clocks.fromProject(target, typeof seconds === 'number' && !Number.isInteger(seconds) ? String(seconds) : seconds, { round: 'nearest' });
    return converted.tick;
  }
  position(tick) { return this.clocks.position('music', this.tick(tick, 'music')); }
}

export const frameClock = (id, numerator, denominator = 1, offset = '0') => ({ id, kind: 'linear', rate: [numerator, denominator], unit: 'frame', toProject: { offset, scale: '1' } });
