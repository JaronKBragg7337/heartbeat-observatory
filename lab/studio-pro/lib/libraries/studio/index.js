export const VERSION = '1.0.0';
export { StudioSession, emptyStudio, STUDIO_FORMAT, MASTER_PRESETS } from './session.js';
export { StudioTime, studioClocks, frameClock } from './time.js';
export { detectPitch, pitchPlan, correctVocal, scaleMidi, midiName, NOTE_NAMES, SCALES } from './pitch.js';
export { encodeMIDI, decodeMIDI } from './midi.js';
export { renderTrack, renderSession, sessionLength, exportWAV, exportStems } from './render.js';
export { saveStudioToProject, openStudioFromProject, exportSessionToProject, exportCoverArt, exportMusicVideo } from './project.js';
