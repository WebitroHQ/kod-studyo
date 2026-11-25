// Tarayıcısız şarkı tarifi: yazı + seçeneklerden kural tabanlı şarkı üretir (Node'da da çalışır).
// Stüdyodaki "Motorla yap" akışının aynısı; yapay zekâ ajanları ve CLI bunu kullanır.
import { generateSong, makeTrack } from './generator.js';
import { MASTER_DEFAULT, songSeconds } from './engine.js';
import { INSTRUMENTS } from './instruments.js';
import { GENRE_MAP } from './genres.js';
import { parsePrompt } from './prompt.js';
import { PRESETS, detectInstruments } from './instrumentation.js';

// opts: { prompt, genre, seed, mood, bpm, root, scale, length, instruments: [preset id], vocals }
export function songFromRecipe(opts = {}) {
  const text = String(opts.prompt || '');
  const p = text ? parsePrompt(text) : { genre: null, bpm: null, mood: null, root: null, flags: {} };
  const genre = opts.genre && GENRE_MAP[opts.genre] ? opts.genre : p.genre || 'lofi';
  const extra = [...detectInstruments(text).filter((f) => f.preset).map((f) => f.preset), ...(opts.instruments || [])]
    .filter((id) => PRESETS[id]);
  const s = generateSong({
    genre,
    seed: opts.seed != null ? String(opts.seed) : undefined,
    mood: opts.mood || p.mood || null,
    bpm: opts.bpm || p.bpm || undefined,
    root: opts.root || p.root || undefined,
    scale: opts.scale || undefined,
    length: opts.length || 3,
    extra,
  });
  if (opts.vocals === false || (p.flags && p.flags.noVocal)) {
    const vox = s.tracks.filter((t) => t.role === 'vox').map((t) => t.id);
    s.tracks = s.tracks.filter((t) => !vox.includes(t.id));
    for (const pat of Object.values(s.patterns)) for (const id of vox) delete pat[id];
  }
  if (p.flags && p.flags.heavy808) for (const t of s.tracks) if (t.inst === 'bass808') { t.params.drive = Math.max(t.params.drive, 0.85); t.vol = Math.min(1, t.vol + 0.1); }
  if (opts.name) s.name = String(opts.name);
  return s;
}

// Dışarıdan gelen (ajanın yazdığı / dosyadan okunan) şarkıyı doğrula ve eksik alanları doldur
export function normalizeSong(s) {
  if (!s || !Array.isArray(s.tracks) || !s.patterns || !Array.isArray(s.arrangement)) throw new Error('geçersiz proje: tracks, patterns ve arrangement gerekli');
  if (!s.bpm) throw new Error('geçersiz proje: bpm yok');
  s.patternMeta = s.patternMeta || {};
  s.master = { ...MASTER_DEFAULT, ...(s.master || {}) };
  s.meta = s.meta || { genre: null, seed: null, prog: [0, 0, 0, 0] };
  for (const t of s.tracks) {
    if (!INSTRUMENTS[t.inst]) throw new Error('bilinmeyen enstrüman: ' + t.inst);
    const fresh = makeTrack({ inst: t.inst, role: t.role });
    Object.assign(fresh, t, { params: { ...fresh.params, ...(t.params || {}) } });
    Object.assign(t, fresh);
  }
  for (const a of s.arrangement) if (!s.patterns[a.pattern]) throw new Error('arrangement bilinmeyen desene bakıyor: ' + a.pattern);
  return s;
}

// Ajanlara kısa özet
export function summarize(s) {
  return {
    name: s.name, bpm: s.bpm, key: `${s.root} ${s.scale}`, genre: s.meta && s.meta.genre, seed: s.meta && s.meta.seed,
    seconds: +songSeconds(s).toFixed(1),
    tracks: s.tracks.map((t) => ({ id: t.id, name: t.name, inst: t.inst, role: t.role })),
    sections: s.arrangement.map((a) => `${a.name} (${a.pattern} ×${a.reps})`),
  };
}
