import { encodeWAV, decodeWAV } from '../audio/wav.js';
import { exportWAV, exportStems } from './render.js';
import { StudioSession } from './session.js';

export async function saveStudioToProject(session, project, { itemId = 'song', namespace = 'studio', name = session.state.name } = {}) {
  const mediaAssets = {};
  for (const [id, buffer] of session.media) mediaAssets[id] = await project.addAsset(encodeWAV(buffer, { bitDepth: 32 }), { name: `${id}.wav`, mediaType: 'audio/wav', role: session.state.media[id].basis === 'seen' ? 'original' : 'derivative', source: session.state.media[id].source, rights: session.state.media[id].rights }, `store ${id}`);
  if (!project.doc.histories[namespace]) await project.importHistory(session.history.history, { namespace });
  const state = session.toJSON(); state.mediaAssets = mediaAssets;
  if (project.doc.items[itemId]) await project.transact('save Studio session', (tx) => tx.updateItem(itemId, { name, data: { studio: state, histories: [namespace], tempo: { clock: 'music', bpm: project.doc.items[itemId].data.tempo?.bpm || '120' } }, refs: { assets: Object.values(mediaAssets), histories: [namespace] } }), { actor: 'viewer' });
  else await project.transact('create Studio song', (tx) => tx.addItem('song', { id: itemId, name, data: { studio: state, histories: [namespace], tempo: { clock: 'music', bpm: '120' } }, refs: { assets: Object.values(mediaAssets), histories: [namespace] } }), { actor: 'viewer' });
  await project.save(); return { itemId, namespace, mediaAssets };
}

export async function openStudioFromProject(project, { itemId = 'song', namespace = 'studio' } = {}) {
  const item = project.doc.items[itemId]; if (!item?.data.studio) throw new Error('item has no Studio session');
  const state = item.data.studio, media = new Map();
  for (const [id, asset] of Object.entries(state.mediaAssets || {})) media.set(id, decodeWAV(await project.readAsset(asset)));
  const session = new StudioSession({ state, media, namespace });
  if (project.doc.histories[namespace]) session.history.history = await project.getHistory(namespace);
  return session;
}

export async function exportSessionToProject(session, project, { itemId = 'song', stems = true, bitDepth = 24 } = {}) {
  const mix = exportWAV(session, { bitDepth }), mixExport = await project.recordExport({ itemId, outputBytes: mix.bytes, name: `${session.state.name}-master.wav`, mediaType: 'audio/wav', settings: { kind: 'master', ...session.state.master, bitDepth, measuredLUFS: mix.rendered.master.loudness.integrated, truePeak: mix.rendered.master.truePeak }, sourceRanges: [{ historyId: session.history.history.historyId, clock: 'audio', from: 0, to: mix.rendered.length }] });
  let stemResult = null;
  if (stems) {
    const exported = exportStems(session, { bitDepth }), exports = {};
    for (const file of exported.files) exports[file.id] = await project.recordExport({ itemId, outputBytes: file.bytes, name: file.name, mediaType: 'audio/wav', settings: { kind: 'pre-master stem', track: file.id, origin: 0, bitDepth } });
    const manifestBytes = new TextEncoder().encode(JSON.stringify(exported.manifest, null, 2));
    const manifest = await project.recordExport({ itemId, outputBytes: manifestBytes, name: `${session.state.name}-stems.json`, mediaType: 'application/json', settings: { kind: 'stem manifest', ...exported.manifest } });
    stemResult = { exports, manifest, recombinationMaxError: exported.recombinationMaxError };
  }
  return { mix: mixExport, stems: stemResult, measured: mix.rendered.master.loudness };
}

export async function exportCoverArt(session, project, renderHook, { itemId = 'song', settings = {} } = {}) {
  if (typeof renderHook !== 'function') throw new TypeError('cover art needs an hb-project renderer hook');
  const result = await renderHook({ session: session.toJSON(), itemId, kind: 'cover-art', settings });
  const bytes = result.bytes || result, mediaType = result.mediaType || 'image/png';
  return project.recordExport({ itemId, outputBytes: bytes, name: result.name || `${session.state.name}-cover.png`, mediaType, settings: { kind: 'cover-art', ...settings }, rights: result.rights });
}

export async function exportMusicVideo(session, project, renderHook, { itemId = 'song', settings = {} } = {}) {
  if (typeof renderHook !== 'function') throw new TypeError('music video needs an hb-project renderer hook');
  const result = await renderHook({ session: session.toJSON(), itemId, kind: 'music-video', picture: session.state.picture, lyrics: session.state.lyrics, settings });
  const bytes = result.bytes || result, mediaType = result.mediaType || 'video/mp4';
  return project.recordExport({ itemId, outputBytes: bytes, name: result.name || `${session.state.name}-video.mp4`, mediaType, settings: { kind: 'music-video', clock: session.state.picture?.clockId, ...settings }, rights: result.rights });
}
