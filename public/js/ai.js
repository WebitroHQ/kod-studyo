// AI istemcisi: Claude (besteleme/düzenleme) ve ElevenLabs (ses örneği, vokal, müzik).
// Anahtarlar tarayıcıda saklanır ve yalnızca yerel sunucuya başlık olarak gider.

import { INSTRUMENTS } from './instruments.js';
import { GENRES } from './genres.js';
import { SCALES, NOTE_NAMES, clamp } from './theory.js';
import { makeTrack } from './generator.js';
import { MASTER_DEFAULT } from './engine.js';

const LS = 'kodstudyo.ai';
export function loadSettings() {
  try { return { model: 'claude-opus-5-5', effort: 'medium', ...JSON.parse(localStorage.getItem(LS) || '{}') }; }
  catch { return { model: 'claude-opus-5-5', effort: 'medium' }; }
}
export function saveSettings(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* depolama kapalı */ } }

function headers(s) {
  const h = { 'content-type': 'application/json' };
  if (s.anthropicKey) h['x-anthropic-key'] = s.anthropicKey;
  if (s.elevenKey) h['x-elevenlabs-key'] = s.elevenKey;
  return h;
}

export async function serverStatus() {
  try { return await (await fetch('/api/status')).json(); } catch { return { anthropic: false, elevenlabs: false, offline: true }; }
}

// Şarkıyı AI'ya gönderilecek sade biçime çevir
export function songToSpec(song) {
  return {
    name: song.name, bpm: song.bpm, swing: song.swing, root: song.root, scale: song.scale,
    tracks: song.tracks.map((t) => ({ key: t.id, name: t.name, inst: t.inst, role: t.role, oct: t.oct, vol: t.vol, pan: t.pan, rev: t.rev, dly: t.dly, duck: t.duck })),
    patterns: Object.entries(song.patterns).map(([id, pat]) => ({
      id, type: (song.patternMeta[id] && song.patternMeta[id].type) || 'drop',
      parts: Object.entries(pat).filter(([, evs]) => evs.length).map(([track, events]) => ({ track, events: events.map((e) => ({ s: e.s, n: e.n != null ? e.n : 60, l: e.l || 1, v: e.v != null ? e.v : 0.9, g: !!e.g, r: e.r || 1 })) })),
    })),
    arrangement: song.arrangement,
    master: song.master,
  };
}

// AI çıktısını doğrulayıp stüdyo şarkısına çevir
export function specToSong(spec, prev) {
  const keyToId = {};
  const prevTracks = new Map((prev ? prev.tracks : []).map((t) => [t.id, t]));
  const tracks = (spec.tracks || []).filter((t) => INSTRUMENTS[t.inst]).map((t) => {
    const old = prevTracks.get(t.key);
    const tr = old && old.inst === t.inst ? { ...old } : makeTrack({ inst: t.inst, role: t.role });
    Object.assign(tr, {
      name: t.name || tr.name, role: t.role || tr.role,
      oct: clamp(Math.round(t.oct != null ? t.oct : tr.oct), 0, 7),
      vol: clamp(+t.vol || 0.8, 0, 1.2), pan: clamp(+t.pan || 0, -1, 1),
      rev: clamp(+t.rev || 0, 0, 1), dly: clamp(+t.dly || 0, 0, 1), duck: clamp(+t.duck || 0, 0, 1),
    });
    keyToId[t.key] = tr.id;
    return tr;
  });
  const patterns = {}, patternMeta = {};
  for (const p of spec.patterns || []) {
    const pat = {};
    for (const tr of tracks) pat[tr.id] = [];
    for (const part of p.parts || []) {
      const id = keyToId[part.track];
      if (!id) continue;
      pat[id] = (part.events || [])
        .filter((e) => Number.isFinite(e.s) && e.s >= 0 && e.s < 32)
        .map((e) => {
          const ev = { s: Math.round(e.s), n: clamp(Math.round(e.n || 60), 0, 127), l: clamp(Math.round(e.l || 1), 1, 32), v: clamp(+e.v || 0.9, 0.05, 1) };
          if (e.g) ev.g = 1;
          if (e.r > 1) ev.r = clamp(Math.round(e.r), 2, 4);
          return ev;
        })
        .sort((a, b) => a.s - b.s);
    }
    patterns[p.id] = pat;
    patternMeta[p.id] = { type: p.type || 'drop', name: p.id };
  }
  if (!Object.keys(patterns).length) throw new Error('AI hiç desen üretmedi.');
  let arrangement = (spec.arrangement || []).filter((a) => patterns[a.pattern]).map((a) => ({ name: a.name || a.pattern, pattern: a.pattern, reps: clamp(Math.round(a.reps || 1), 1, 16) }));
  if (!arrangement.length) arrangement = Object.keys(patterns).map((id) => ({ name: id, pattern: id, reps: 2 }));
  const m = spec.master || {};
  return {
    name: spec.name || 'AI şarkısı',
    bpm: clamp(Math.round(spec.bpm || 120), 40, 220),
    swing: clamp(+spec.swing || 0, 0, 0.6),
    root: NOTE_NAMES.includes(spec.root) ? spec.root : 'C',
    scale: SCALES[spec.scale] ? spec.scale : 'minor',
    tracks, patterns, patternMeta, arrangement,
    master: {
      ...MASTER_DEFAULT,
      low: clamp(+m.low || 0, -6, 6), high: clamp(+m.high || 0, -6, 6), drive: clamp(+m.drive || 0, 0, 1),
      glue: clamp(+m.glue || 0, 0, 1), makeup: clamp(+m.makeup || 0, -6, 12), ceiling: clamp(m.ceiling != null ? +m.ceiling : -0.8, -3, 0),
    },
    meta: { genre: prev && prev.meta ? prev.meta.genre : null, seed: 'ai-' + Date.now().toString(36), prog: [0, 0, 0, 0], target: -10, ai: true },
  };
}

export async function aiCompose(prompt, song, settings, hint) {
  const body = {
    prompt, hint,
    song: song ? songToSpec(song) : null,
    model: settings.model, effort: settings.effort,
    instruments: Object.keys(INSTRUMENTS).filter((k) => k !== 'sampler'),
    scales: Object.keys(SCALES), notes: NOTE_NAMES,
    instrumentInfo: Object.entries(INSTRUMENTS).filter(([k]) => k !== 'sampler').map(([k, v]) => `${k} (${v.label}${v.defaultOct != null ? ', oct ' + v.defaultOct : ', davul'})`).join('; '),
    genreInfo: GENRES.map((g) => `${g.name} ${g.bpm[0]}-${g.bpm[1]} BPM: ${g.desc}`).join(' | '),
  };
  const r = await fetch('/api/ai/compose', { method: 'POST', headers: headers(settings), body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({ error: 'Sunucu yanıtı okunamadı' }));
  if (!r.ok) throw new Error(data.error || `Hata ${r.status}`);
  return data;
}

export async function aiAudio(kind, prompt, seconds, settings, extra = {}) {
  const r = await fetch('/api/ai/audio', { method: 'POST', headers: headers(settings), body: JSON.stringify({ kind, prompt, seconds, ...extra }) });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || `Hata ${r.status}`);
  }
  return r.arrayBuffer();
}

export async function aiVoices(settings) {
  const r = await fetch('/api/ai/voices', { headers: headers(settings) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Hata ${r.status}`);
  return data.voices;
}
