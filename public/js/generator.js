// Kural tabanlı besteci. AI yok: tarz profili + seed → tam şarkı.
// Aynı seed + aynı ayarlar her zaman aynı şarkıyı üretir.

import { GENRE_MAP, GENRES } from './genres.js';
import { INSTRUMENTS, defaultParams } from './instruments.js';
import { makeRng, degreeToMidi, chordNotes, SCALES, NOTE_NAMES, uid } from './theory.js';
import { STEPS, MASTER_DEFAULT } from './engine.js';
import { PRESETS } from './instrumentation.js';

const DARK = ['phrygian', 'minor', 'harmonicMinor', 'hijaz', 'pentMinor', 'dorian'];
const BRIGHT = ['major', 'mixolydian', 'pentMajor', 'dorian'];

// Bölüm tiplerine göre hangi roller çalar
const ACTIVE = {
  intro: ['melody', 'chords', 'pad', 'vox', 'perc', 'counter', 'fx'],
  verse: ['kick', 'snare', 'hat', 'openhat', 'perc', 'bass', 'chords', 'pad', 'riff', 'counter'],
  build: ['hat', 'snare', 'melody', 'chords', 'pad', 'riff', 'perc', 'fx'],
  drop: null, // hepsi
  drop2: null,
  break: ['chords', 'pad', 'melody', 'vox', 'counter', 'fx'],
  outro: ['kick', 'hat', 'melody', 'chords', 'pad', 'perc', 'counter'],
};
const VARIANT = { intro: 'A', verse: 'A', drop: 'A', outro: 'A', drop2: 'B', break: 'B', build: 'B' };

export function makeTrack(spec) {
  // preset: instrumentation.js'teki hazır kanal tarifi; spec'teki alanlar onu ezer
  if (spec.preset && PRESETS[spec.preset]) {
    const pr = PRESETS[spec.preset];
    spec = { ...pr, name: pr.label, ...spec, params: { ...(pr.params || {}), ...(spec.params || {}) } };
  }
  const def = INSTRUMENTS[spec.inst];
  return {
    id: uid(),
    name: spec.name || def.label,
    inst: spec.inst,
    role: spec.role || (def.kind === 'drum' ? 'perc' : 'melody'),
    params: { ...defaultParams(spec.inst), ...(spec.params || {}) },
    oct: spec.oct != null ? spec.oct : def.defaultOct != null ? def.defaultOct : 4,
    vol: spec.vol != null ? spec.vol : 0.8,
    pan: spec.pan || 0,
    rev: spec.rev || 0,
    dly: spec.dly || 0,
    duck: spec.duck || 0,
    crush: spec.crush || 0,
    mute: false,
    solo: false,
  };
}

export function emptySong() {
  return {
    name: 'Yeni şarkı', bpm: 130, swing: 0, root: 'F', scale: 'phrygian',
    tracks: [], patterns: { P1: {} }, patternMeta: { P1: { type: 'drop' } },
    arrangement: [{ name: 'A', pattern: 'P1', reps: 2 }],
    master: { ...MASTER_DEFAULT }, meta: { genre: null, seed: null },
  };
}

// ---------- ana giriş ----------
export function generateSong(opts = {}) {
  const genre = GENRE_MAP[opts.genre] || GENRES[0];
  const seed = opts.seed != null ? String(opts.seed) : String(Math.floor(Math.random() * 1e6));
  const rng = makeRng(seed + '|song');

  const bpm = opts.bpm || rng.int(genre.bpm[0], genre.bpm[1]);
  let scales = genre.scales;
  if (opts.mood === 'dark') scales = scales.filter((s) => DARK.includes(s));
  if (opts.mood === 'bright') scales = scales.filter((s) => BRIGHT.includes(s));
  if (!scales.length) scales = opts.mood === 'bright' ? ['major'] : opts.mood === 'dark' ? ['phrygian'] : genre.scales;
  const scale = opts.scale && SCALES[opts.scale] ? opts.scale : rng.pick(scales);
  const root = opts.root && NOTE_NAMES.includes(opts.root) ? opts.root : rng.pick(genre.roots);
  const prog = rng.pick(genre.progressions);

  const tracks = genre.tracks.map(makeTrack);
  // yazıdan/kullanıcıdan gelen enstrümanlar: aynı roldeki kanalın yerine geçer, rol yoksa eklenir
  // Kural: bas tek olur (son istenen kazanır); ilk melodik enstrüman ana melodiyi, sonrakiler
  // karşı melodiyi alır; akor enstrümanları akor/pad rolüne oturur. En fazla 5 ek kanal.
  const NEXT_ROLE = { melody: 'counter', counter: 'counter', chords: 'pad', pad: 'pad', riff: 'riff' };
  const used = new Set();
  for (const pid of [...new Set(opts.extra || [])].slice(0, 5)) {
    if (!PRESETS[pid]) continue;
    const tr = makeTrack({ preset: pid });
    let role = tr.role;
    if (role === 'bass') {
      const i = tracks.findIndex((t) => t.role === 'bass');
      if (i >= 0) tracks.splice(i, 1);
      tracks.push(tr); used.add('bass'); continue;
    }
    while (used.has(role) && NEXT_ROLE[role] && NEXT_ROLE[role] !== role) role = NEXT_ROLE[role];
    tr.role = role;
    const i = used.has(role) ? -1 : tracks.findIndex((t) => t.role === role);
    if (i >= 0) tracks[i] = tr; else tracks.push(tr);
    used.add(role);
  }
  const song = {
    name: `${genre.name.split(/ [/(]/)[0]} #${seed}`,
    bpm, swing: genre.swing || 0, root, scale,
    tracks, patterns: {}, patternMeta: {}, arrangement: [],
    master: { ...MASTER_DEFAULT, ...genre.master },
    meta: { genre: genre.id, seed, prog, target: genre.target || -10 },
  };

  // her bölüm tipi için bir desen
  const typeToPat = {};
  for (const [name, type, reps] of genre.structure) {
    if (!typeToPat[type]) {
      const pid = 'P' + (Object.keys(song.patterns).length + 1);
      typeToPat[type] = pid;
      song.patternMeta[pid] = { type, name };
      song.patterns[pid] = buildPattern(song, genre, type);
    }
    const factor = opts.length || 3; // 1 kısa, 3 orta, 5 uzun
    song.arrangement.push({ name, pattern: typeToPat[type], reps: type === 'build' ? reps : Math.max(1, Math.round(reps * factor)) });
  }
  return song;
}

function buildPattern(song, genre, type) {
  const pat = {};
  const active = ACTIVE[type];
  // önce davullar (bas kick'e bakıyor)
  const order = [...song.tracks].sort((a, b) => kindRank(a) - kindRank(b));
  for (const tr of order) {
    if (active && !active.includes(tr.role)) { pat[tr.id] = []; continue; }
    pat[tr.id] = makePart(song, genre, tr, type, pat, song.meta.seed);
  }
  return pat;
}

const kindRank = (tr) => (tr.role === 'kick' ? 0 : INSTRUMENTS[tr.inst].kind === 'drum' ? 1 : 2);

// Tek bir kanalı (bir desen için) yeniden üret — kullanıcının "zar" butonu
export function regenerateTrack(song, trackId, patId, newSeed) {
  const genre = GENRE_MAP[song.meta && song.meta.genre] || guessGenre(song);
  const tr = song.tracks.find((t) => t.id === trackId);
  const type = (song.patternMeta[patId] && song.patternMeta[patId].type) || 'drop';
  if (!tr) return [];
  return makePart(song, genre, tr, type, song.patterns[patId] || {}, newSeed);
}

function guessGenre(song) {
  return GENRES.reduce((best, g) => (Math.abs((g.bpm[0] + g.bpm[1]) / 2 - song.bpm) < Math.abs((best.bpm[0] + best.bpm[1]) / 2 - song.bpm) ? g : best), GENRES[0]);
}

// ---------- parça üretimi ----------
function makePart(song, genre, tr, type, pat, seed) {
  const variant = VARIANT[type] || 'A';
  const rng = makeRng(`${seed}|${tr.role}|${tr.inst}|${variant}`);
  const fillRng = makeRng(`${seed}|${tr.role}|${type}|fill`);
  const ctx = {
    song, genre, tr, type, variant, rng, fillRng,
    prog: (song.meta && song.meta.prog) || [0, 0, 0, 0],
    chordRate: genre.chordRate || 16,
    half: variant === 'B' ? 1 : 0,
  };
  const kind = INSTRUMENTS[tr.inst].kind;
  let evs;
  if (tr.role === 'fx') evs = fxPart(ctx);
  else if (type === 'build' && tr.role === 'snare') evs = buildRoll(ctx);
  else if (kind === 'drum') evs = drumPart(ctx);
  else if (tr.role === 'bass') evs = bassPart(ctx, kickSteps(song, pat));
  else if (tr.role === 'chords' || tr.role === 'pad') {
    let cfg = tr.role === 'pad' ? { style: 'sustain', size: 3 } : genre.chords || { style: 'sustain', size: 3 };
    // akustik/temiz gitar akorları tutulmaz, taranır
    if (tr.inst === 'acoustic' || (tr.inst === 'guitar' && tr.params.drive < 0.3)) cfg = { style: 'strum', size: 4 };
    if (tr.inst === 'guitar' && tr.params.power >= 0.5) cfg = { style: 'stabs', size: 1 };
    evs = chordPart(ctx, cfg);
  }
  else if (tr.role === 'riff') evs = riffPart(ctx);
  else if (tr.role === 'vox') evs = voxPart(ctx);
  else evs = melodyPart(ctx, tr.role === 'counter' ? genre.counter || { style: 'sparse', range: [2, 9], rhythms: ['..x.....x.......'] } : genre.melody || { style: 'motif', range: [0, 8], rhythms: ['x.x.x...x.x.x...'] });

  if (type === 'outro') evs = evs.filter((e) => e.s < 16 || tr.role === 'kick' || tr.role === 'hat');
  if (genre.glitch && (type === 'drop' || type === 'drop2') && ['kick', 'snare', 'riff', 'hat', 'vox'].includes(tr.role)) evs = glitch(ctx, evs);
  return evs.sort((a, b) => a.s - b.s);
}

function chordDegAt(ctx, s) {
  const perPat = Math.max(1, Math.round(STEPS / ctx.chordRate));
  const idx = ctx.half * perPat + Math.floor(s / ctx.chordRate);
  return ctx.prog[idx % ctx.prog.length];
}

const mid = (ctx, deg, octShift = 0) => degreeToMidi(ctx.song.root, ctx.song.scale, deg, ctx.tr.oct + octShift);

function parseDrum(str, rng, humanize = 0.08) {
  const s32 = str.length >= 32 ? str.slice(0, 32) : (str + str).slice(0, 32);
  const out = [];
  for (let i = 0; i < 32; i++) {
    const c = s32[i];
    if (c === '.') continue;
    const v = (c === 'o' ? 0.5 : 0.95) * (1 - rng() * humanize);
    const ev = { s: i, v: +v.toFixed(2) };
    if ('234'.includes(c)) { ev.r = +c; ev.v = 0.8; }
    out.push(ev);
  }
  return out;
}

function drumPart(ctx) {
  const { genre, tr, rng, variant, type, fillRng } = ctx;
  const list = (genre.drums && genre.drums[tr.role]) || (genre.drums && genre.drums[tr.inst]);
  if (!list || !list.length) return [];
  const a = list[Math.floor(rng() * list.length)];
  const b = variant === 'B' && list.length > 1 ? list[(list.indexOf(a) + 1) % list.length] : a;
  let evs = parseDrum(a.slice(0, 16), rng).filter((e) => e.s < 16).concat(parseDrum(b.slice(0, 16), rng).filter((e) => e.s < 16).map((e) => ({ ...e, s: e.s + 16 })));
  if (tr.role === 'hat' && genre.hatRolls) {
    const p = genre.hatRolls * (variant === 'B' ? 1.4 : 1);
    evs = evs.map((e) => (e.s > 0 && !e.r && rng.chance(p * 0.35) ? { ...e, r: rng.pick([2, 3, 3, 4]), v: 0.75 } : e));
  }
  // bar sonu fill
  if ((type === 'drop' || type === 'drop2' || type === 'verse') && genre.fills && fillRng.chance(genre.fills)) {
    if (tr.role === 'snare') {
      const kind = fillRng.int(0, 2);
      evs = evs.filter((e) => e.s < 28);
      if (kind === 0) evs.push({ s: 28, v: 0.6 }, { s: 29, v: 0.7 }, { s: 30, v: 0.8, r: 2 }, { s: 31, v: 0.9, r: 2 });
      else if (kind === 1) evs.push({ s: 28, v: 0.95 }, { s: 30, v: 0.7, r: 3 }, { s: 31, v: 0.8, r: 3 });
      else evs.push({ s: 29, v: 0.6 }, { s: 31, v: 0.9, r: 4 });
    }
    if (tr.role === 'hat' && fillRng.chance(0.5)) {
      evs = evs.filter((e) => e.s < 28);
      evs.push({ s: 28, v: 0.7, r: 3 }, { s: 30, v: 0.75, r: 4 });
    }
  }
  if (type === 'intro' && tr.role === 'perc') evs = evs.filter((e) => e.s >= 16);
  return evs;
}

function buildRoll(ctx) {
  const evs = [];
  for (let s = 0; s < 16; s += 4) evs.push({ s, v: 0.45 + s / 80 });
  for (let s = 16; s < 24; s += 2) evs.push({ s, v: 0.6 + (s - 16) / 60 });
  for (let s = 24; s < 32; s++) evs.push({ s, v: 0.75 + (s - 24) / 40, r: s >= 28 ? 2 : 1 });
  return evs;
}

function fxPart(ctx) {
  const { type } = ctx;
  if (type === 'build') return [{ s: 0, n: 60, l: 32, v: 0.9 }];
  if (type === 'drop' || type === 'drop2') return [{ s: 0, n: 62, l: 1, v: 0.9 }];
  if (type === 'break') return [{ s: 0, n: 61, l: 16, v: 0.8 }];
  if (type === 'intro') return [{ s: 16, n: 60, l: 16, v: 0.7 }];
  return [];
}

export function kickSteps(song, pat) {
  const kick = song.tracks.find((t) => t.role === 'kick' || t.inst === 'kick');
  if (!kick || !pat[kick.id]) return [];
  return pat[kick.id].map((e) => e.s);
}

function bassPart(ctx, kicks) {
  const { genre, rng } = ctx;
  const cfg = genre.bass || { mode: 'root', glide: 0, octJump: 0, maxLen: 8 };
  let starts = [];
  const mode = cfg.mode;
  if (mode === 'kick') starts = kicks.length ? [...new Set(kicks)] : [0, 10, 16, 26];
  else if (mode === 'offbeat') for (let s = 2; s < 32; s += 4) starts.push(s);
  else if (mode === 'rolling') for (let s = 0; s < 32; s++) { if (s % 4 !== 0) starts.push(s); }
  else if (mode === 'eighths') for (let s = 0; s < 32; s += 2) starts.push(s);
  else if (mode === 'sustain') for (let s = 0; s < 32; s += ctx.chordRate) starts.push(s);
  else if (mode === 'syncopated') starts = [0, 3, 6, 10, 13, 16, 19, 22, 26, 29];
  else if (mode === 'walk') for (let s = 0; s < 32; s += 4) { if (s % 8 === 0 || rng.chance(0.6)) starts.push(s); }
  else { for (let s = 0; s < 32; s += ctx.chordRate) starts.push(s); starts.push(...[6, 10, 22, 26].filter(() => rng.chance(0.35))); }
  starts = [...new Set(starts)].filter((s) => s < 32).sort((a, b) => a - b);
  // bas ritmini hafif çeşitlendir (kick modunda değil)
  const evs = [];
  let prev = null;
  starts.forEach((s, i) => {
    const next = i + 1 < starts.length ? starts[i + 1] : 32;
    let deg = chordDegAt(ctx, s);
    let oct = 0;
    if (mode === 'walk' && s % 8 !== 0) deg += rng.pick([1, 2, 4, -1]);
    else if (mode === 'eighths' && cfg.octJump && (s / 2) % 2 === 1 && rng.chance(0.7)) oct = 1;
    else if (rng.chance(cfg.octJump || 0)) oct = 1;
    else if (rng.chance(0.12) && mode === 'kick') deg += 4;
    const n = mid(ctx, deg, oct);
    const l = Math.max(1, Math.min(next - s, cfg.maxLen || 8));
    const ev = { s, n, l, v: mode === 'rolling' ? (s % 2 ? 0.7 : 0.9) : 0.95 };
    if (prev != null && prev !== n && rng.chance(cfg.glide || 0)) ev.g = 1;
    evs.push(ev);
    prev = n;
  });
  return evs;
}

function voicing(ctx, deg, size) {
  const base = mid(ctx, 0);
  return chordNotes(ctx.song.root, ctx.song.scale, deg, ctx.tr.oct, size).map((n) => (n > base + 14 ? n - 12 : n));
}

function chordPart(ctx, cfg) {
  const { rng } = ctx;
  const style = (cfg && cfg.style) || 'sustain';
  const size = (cfg && cfg.size) || 3;
  const evs = [];
  const rate = ctx.chordRate >= 32 ? 32 : Math.min(ctx.chordRate, 16);
  for (let seg = 0; seg < 32; seg += rate) {
    const notes = voicing(ctx, chordDegAt(ctx, seg), size);
    let hits;
    if (style === 'sustain') hits = [[seg, rate]];
    else if (style === 'tap') {
      // kök, 5'li, 9'lu, 10'lu, 12'li — midwest emo / math rock tapping kalıbı
      const degs = [0, 4, 8, 9, 11].map((x) => chordDegAt(ctx, seg) + x);
      const ns = degs.map((d) => mid(ctx, d));
      const order = rng.pick([[0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 1], [0, 1, 3, 2, 4, 2, 3, 1], [4, 3, 2, 1, 0, 1, 2, 3]]);
      for (let h = 0; h < rate; h++) evs.push({ s: seg + h, n: ns[order[h % order.length]], l: 1, v: h % 4 === 0 ? 0.9 : 0.7 });
      continue;
    }
    else if (style === 'strum') {
      const tmpl = rng.pick([[0, 3, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 10, 12], [0, 6, 8, 11, 14]]);
      hits = tmpl.filter((x) => x < rate).map((x, i, arr) => [seg + x, Math.max(1, (arr[i + 1] != null ? arr[i + 1] : rate) - x)]);
    }
    else if (style === 'stabs') {
      const tmpl = rng.pick([[2, 6, 10, 14], [0, 6, 10], [0, 3, 6, 10, 12], [2, 6, 10, 14]]);
      hits = tmpl.filter((h) => h < rate).map((h) => [seg + h, 2]);
    } else if (style === 'pump') { hits = []; for (let h = 0; h < rate; h += 2) hits.push([seg + h, 2]); }
    else if (style === 'arp') {
      for (let h = 0; h < rate; h++) evs.push({ s: seg + h, n: notes[h % notes.length] + (Math.floor(h / notes.length) % 2) * 12, l: 1, v: 0.6 });
      continue;
    } else hits = [[seg, rate]];
    for (const [s, l] of hits) for (const n of notes) evs.push({ s, n, l, v: style === 'sustain' ? 0.7 : 0.8 });
  }
  return evs;
}

// Motif tabanlı melodi: bar 1 = soru, bar 2 = cevap (son kısım değişir ve köke çözülür)
function melodyPart(ctx, cfg) {
  const { rng } = ctx;
  const style = cfg.style || 'motif';
  const [lo, hi] = cfg.range || [0, 8];
  const rhythm = rng.pick(cfg.rhythms || ['x.x.x...x.x.x...']);
  const hits = [];
  for (let i = 0; i < 16; i++) {
    if (rhythm[i] !== 'x') continue;
    let l = 1;
    while (i + l < 16 && rhythm[i + l] === '-') l++;
    hits.push({ s: i, l });
  }
  if (!hits.length) return [];
  const chordTones = [0, 2, 4, 7];
  let deg = style === 'sparse' ? rng.pick([2, 4, 7]) : rng.pick([0, 0, 2, 4]);
  const degs = [];
  for (let i = 0; i < hits.length; i++) {
    if (i > 0) {
      const move = rng.weighted(style === 'cowbell'
        ? [[0, 3], [1, 3], [-1, 3], [2, 1.5], [-2, 1.5], [7, 0.8], [-7, 0.5]]
        : [[0, 1.5], [1, 3], [-1, 3], [2, 2], [-2, 2], [3, 0.8], [-3, 0.8], [4, 0.5]]);
      deg += move;
    }
    if (hits[i].s % 8 === 0 && style !== 'cowbell') {
      // güçlü vuruşta akor tonuna yaklaş
      const rel = deg - chordDegAt(ctx, hits[i].s);
      const nearest = chordTones.reduce((b, c) => (Math.abs(c - (((rel % 7) + 7) % 7)) < Math.abs(b - (((rel % 7) + 7) % 7)) ? c : b), 0);
      deg = deg - ((((rel % 7) + 7) % 7) - nearest);
    }
    deg = fold(deg, lo, hi);
    degs.push(deg);
  }
  const evs = [];
  hits.forEach((h, i) => evs.push({ s: h.s, n: mid(ctx, degs[i] + (style === 'cowbell' ? 0 : 0)), l: h.l, v: h.s % 4 === 0 ? 0.95 : 0.8 }));
  // bar 2: tekrar + cevap
  const answerFrom = Math.floor(hits.length * (style === 'cowbell' ? 0.6 : 0.5));
  hits.forEach((h, i) => {
    let d = degs[i];
    if (i >= answerFrom) {
      d = degs[i] + rng.pick([-2, -1, 1, 2, 0]);
      if (i === hits.length - 1) d = rng.pick([0, 0, 4, 7]);
      d = fold(d, lo, hi);
    }
    if (ctx.variant === 'B' && style !== 'cowbell' && i < answerFrom) d += rng.pick([0, 0, 2, -2]);
    evs.push({ s: h.s + 16, n: mid(ctx, d), l: h.l, v: h.s % 4 === 0 ? 0.95 : 0.8 });
  });
  if (style === 'sparse') evs.forEach((e) => { e.l = Math.max(e.l, 4); });
  return evs;
}

// dereceyi [lo, hi] aralığına oktav kaydırarak katla; aralık oktavdan darsa sınıra kıstır
function fold(d, lo, hi) {
  while (d > hi && d - 7 >= lo) d -= 7;
  while (d < lo && d + 7 <= hi) d += 7;
  return Math.min(hi, Math.max(lo, d));
}

function riffPart(ctx) {
  const { rng, genre } = ctx;
  const chug = (genre.riff && genre.riff.chug) || 0.6;
  const bar = [];
  for (let i = 0; i < 16; i++) {
    if (i % 4 === 0 || rng.chance(chug * 0.55)) bar.push(i);
  }
  const evs = [];
  for (const half of [0, 16]) {
    for (const i of bar) {
      const s = i + half;
      const root = chordDegAt(ctx, s);
      let deg = root;
      if (i % 4 !== 0 && rng.chance(0.22)) deg = root + rng.pick([1, 3, 5, 7]);
      if (half === 16 && i >= 12) deg = root + rng.pick([0, 1, 3, 4]);
      evs.push({ s, n: mid(ctx, deg), l: 1, v: i % 4 === 0 ? 0.95 : 0.75 });
    }
  }
  return evs;
}

function voxPart(ctx) {
  const { rng, genre } = ctx;
  const density = (genre.vox && genre.vox.density) || 0.25;
  const evs = [];
  for (let s = 0; s < 32; s++) {
    const strong = s % 4 === 2 || s % 8 === 6;
    if (rng.chance(strong ? density : density * 0.25)) {
      const deg = chordDegAt(ctx, s) + rng.pick([0, 2, 4, 7]);
      const ev = { s, n: mid(ctx, deg), l: rng.pick([1, 2, 2, 3]), v: 0.85 };
      if (rng.chance(0.25)) ev.g = 1;
      evs.push(ev);
    }
  }
  return evs;
}

// stutter / glitch: rastgele bir yarım vuruşu kesik tekrara çevir
function glitch(ctx, evs) {
  const rng = makeRng(`${ctx.song.meta.seed}|glitch|${ctx.type}`);
  if (!rng.chance(ctx.genre.glitch * 2)) return evs;
  const at = rng.pick([12, 14, 28, 30]);
  const out = evs.filter((e) => e.s < at || e.s >= at + 2);
  const src = evs.find((e) => e.s >= at - 4 && e.s < at + 2);
  if (src) out.push({ ...src, s: at, r: 4, v: 0.85 }, { ...src, s: at + 1, r: 3, v: 0.75 });
  return out;
}

export function genreList() { return GENRES; }
