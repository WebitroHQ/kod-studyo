// "Yüksek Skor" — RJ Pasin esintili math/emo gitar trap. Elle (AI) bestelendi, tamamen kodla sentez.
// Çalıştır: node compositions/yuksek-skor.mjs  →  public/songs/yuksek-skor.json
// D majör, 140 BPM. Araştırma notları: RJ Pasin önce prodüktör; ses tasarımı, loop tabanlı gitar,
// "metal karışık hyperpop", "video oyunu müziği gibi karmaşık riffler", math rock / emo akorları.
// Akorlar: A bölümü  G | A | F#m | Bm (IV–V–iii–vi, emo klasiği) · B bölümü  Bm | G | D | A (vi–IV–I–V)
// Kadro: double-track temiz tapping gitar, synth katmanlı + oktavörlü lead, armoni lead, drop-D breakdown,
// 808, trap davul, bitcrush'lı pitch-up vokal chop, ters gitar swell'leri.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const T = {
  tap: makeTrack({ preset: 'gtrClean', name: 'Tapping gitar (L/R)', role: 'chords', oct: 4, vol: 0.8, rev: 0.25, dly: 0.1, duck: 0.2,
    params: { drive: 0.15, bright: 0.85, double: 1, cab: 7000, vib: 0 } }),
  lead: makeTrack({ preset: 'gtrLead', name: 'Lead gitar (synth+8va)', vol: 0.9, params: { synth: 0.25, oct8: 0.3 } }),
  harm: makeTrack({ preset: 'gtrLead', name: 'Lead armoni', role: 'counter', vol: 0.6, pan: -0.4, rev: 0.3, params: { synth: 0.15 } }),
  chug: makeTrack({ preset: 'gtrPalm', name: 'Breakdown (drop-D, L/R)', vol: 0.75, params: { mute: 0.8, drive: 0.9 } }),
  kick: makeTrack({ inst: 'kick', role: 'kick', vol: 0.9, params: { tune: 48, punch: 0.9, decay: 0.34, drive: 0.4 } }),
  snare: makeTrack({ inst: 'snare', role: 'snare', vol: 0.95, rev: 0.1, params: { tone: 210, snap: 0.9, decay: 0.17, drive: 0.3 } }),
  clap: makeTrack({ inst: 'clap', role: 'snare', name: 'Clap katmanı', vol: 0.6, rev: 0.15 }),
  hat: makeTrack({ inst: 'hat', role: 'hat', vol: 0.75, pan: 0.2, params: { decay: 0.03, tone: 9000 } }),
  ohat: makeTrack({ inst: 'openhat', role: 'openhat', name: 'Crash/açık hat', vol: 0.7, pan: -0.2, params: { decay: 0.7 } }),
  b808: makeTrack({ preset: 'b808', name: '808', vol: 0.86, params: { drive: 0.55, decay: 1.5, glide: 0.08, punch: 0.55 } }),
  vox: makeTrack({ preset: 'vox', name: 'Pitch-up vokal (crush)', oct: 5, vol: 1.1, crush: 0.3, rev: 0.35, dly: 0.25,
    params: { vowel: 1, formant: 1.35, vibrato: 0.1, release: 0.12 } }),
  fx: makeTrack({ inst: 'fx', role: 'fx', vol: 0.5, rev: 0.3 }),
};

const N = (s, n, l = 1, v = 0.9, x = {}) => ({ s, n, l, v, ...x });
const split = (evs) => [evs.filter((e) => e.s < 32), evs.filter((e) => e.s >= 32).map((e) => ({ ...e, s: e.s - 32 }))];
const L = (arr, vs = 1) => arr.map(([s, n, l = 1, g = 0]) => N(s, n, l, (s % 4 === 0 ? 0.95 : 0.8) * vs, g ? { g: 1 } : {}));

// ---------- tapping voicing'leri (kök, 5'li, 9'lu, 10'lu, 12'li) ----------
const VOICE = {
  G: [55, 62, 69, 71, 74], A: [57, 64, 71, 73, 76], Fsm: [54, 61, 64, 69, 73], Bm: [59, 66, 73, 74, 78], D: [62, 69, 76, 78, 81],
  Gmaj7: [55, 62, 66, 69, 71],
};
const ORDER = [0, 1, 2, 3, 4, 3, 2, 1];
function tapping(chords, vs = 1, every = 1) {
  return chords.flatMap((c, bar) => {
    const out = [];
    for (let h = 0; h < 16; h += every) out.push(N(bar * 16 + h, VOICE[c][ORDER[h % 8]], every, (h % 4 === 0 ? 0.9 : 0.7) * vs));
    return out;
  });
}

// ---------- lead riffleri ----------
const LEAD_A = [
  // G
  [0, 83], [1, 81], [2, 79], [3, 74], [4, 76, 2], [6, 78], [7, 79], [8, 81, 3, 1], [11, 78], [12, 76, 2], [14, 74, 2],
  // A
  [16, 85, 2], [18, 83], [19, 81], [20, 76], [21, 81], [22, 83, 2], [24, 85], [25, 86], [26, 88, 3, 1], [29, 85], [30, 81, 2],
  // F#m
  [32, 81, 2], [34, 78], [35, 73], [36, 78], [37, 81], [38, 85, 2], [40, 83, 3, 1], [43, 81], [44, 78, 2], [46, 76, 2],
  // Bm — hızlı koşu ve titreşimli D, sonra B bölümüne atlayan run
  [48, 86], [49, 85], [50, 83], [51, 78], [52, 74], [53, 78], [54, 83], [55, 85], [56, 86, 4], [60, 85], [61, 86], [62, 88], [63, 90],
];
const LEAD_B = [
  // Bm
  [0, 90, 2], [2, 88], [3, 86], [4, 83, 2], [6, 85], [7, 86], [8, 88, 3, 1], [11, 86], [12, 85, 2], [14, 83, 2],
  // G
  [16, 86, 2], [18, 83], [19, 79], [20, 83], [21, 86], [22, 91, 2, 1], [24, 90, 3], [27, 88], [28, 86, 2], [30, 83, 2],
  // D
  [32, 81, 2], [34, 86], [35, 90], [36, 93, 2, 1], [38, 90], [39, 86], [40, 88, 3], [43, 86], [44, 85, 2], [46, 81, 2],
  // A
  [48, 85], [49, 86], [50, 88], [51, 90], [52, 88], [53, 85], [54, 81], [55, 76], [56, 81, 4], [60, 83], [61, 85], [62, 86], [63, 88],
];
// diyatonik alt üçlü (D majör)
function thirdBelow(n) {
  const pcs = [2, 4, 6, 7, 9, 11, 1];
  const pc = ((n % 12) + 12) % 12, i = pcs.indexOf(pc);
  if (i < 0) return n - 3;
  let d = pc - pcs[(i + 5) % 7]; if (d <= 0) d += 12;
  return n - d;
}
const harmony = (riff) => riff.filter(([s, , l = 1]) => l >= 2 || s % 4 === 0).map(([s, n, l = 1, g = 0]) => [s, thirdBelow(n), l, g]);

// ---------- 808 ----------
const R808 = { G: 31, A: 33, Fsm: 30, Bm: 35, D: 26 };
const KB = [[0, 7, 10], [0, 6, 10, 11], [0, 7, 10, 13], [0, 6, 9, 12]];
function bass808(chords) {
  const out = [];
  chords.forEach((c, bar) => {
    const ks = KB[bar];
    ks.forEach((k, i) => {
      const next = i + 1 < ks.length ? ks[i + 1] : 16;
      const ev = N(bar * 16 + k, R808[c], next - k, 0.95);
      if (i === ks.length - 1 && bar % 2 === 1) { ev.n += 12; ev.g = 1; }
      out.push(ev);
    });
  });
  return out;
}

// ---------- davullar ----------
const kick = () => KB.flatMap((b, i) => b.map((s) => N(i * 16 + s, 60, 1, 0.95)));
const snare = (roll = false) => {
  const e = [N(8, 60), N(24, 60), N(31, 60, 1, 0.45), N(40, 60), N(56, 60), N(62, 60, 1, 0.5)];
  return roll ? e.filter((x) => x.s < 59).concat([N(59, 60, 1, 0.6), N(60, 60, 1, 0.7, { r: 2 }), N(61, 60, 1, 0.8, { r: 2 }), N(62, 60, 1, 0.85, { r: 3 }), N(63, 60, 1, 0.95, { r: 4 })]) : e;
};
const clap = () => [8, 24, 40, 56].map((s) => N(s, 60, 1, 0.9));
function hats(dense = false) {
  const rolls = { 12: 3, 30: 2, 38: 2, 44: 3, 60: 4, 62: 3 };
  const out = [];
  for (let s = 0; s < 64; s += 2) {
    const e = N(s, 60, 1, s % 4 === 0 ? 0.85 : 0.6);
    if (rolls[s]) { e.r = rolls[s]; e.v = 0.7; }
    out.push(e);
    if (dense && s >= 48 && !rolls[s]) out.push(N(s + 1, 60, 1, 0.45));
  }
  return out;
}

// ---------- breakdown (drop-D, yarım tempo, kick ile aynı anda) ----------
// djent senkopu; 4. ölçüde tritone (G#) ve yarım ton (D#) gerilimi
const BD_HITS = [0, 3, 6, 8, 11, 14];
function breakdown() {
  const chug = [], kk = [], b8 = [];
  for (let bar = 0; bar < 4; bar++) {
    for (const s of BD_HITS) {
      let n = 38;
      if (bar === 3 && s >= 8) n = s === 8 ? 44 : s === 11 ? 39 : 38;
      if (bar === 1 && s === 14) n = 41;
      chug.push(N(bar * 16 + s, n, s === 0 ? 3 : 1, s === 0 ? 1 : 0.85));
      kk.push(N(bar * 16 + s, 60, 1, s === 0 ? 1 : 0.85));
    }
    b8.push(N(bar * 16, 26, 6, 0.95), N(bar * 16 + 8, 26, 6, 0.9));
  }
  return {
    chug, kick: kk, b808: b8,
    snare: [8, 24, 40, 56].map((s) => N(s, 60, 1, 1)),
    clap: [8, 24, 40, 56].map((s) => N(s, 60, 1, 0.9)),
    ohat: [0, 16, 32, 48].map((s) => N(s, 60, 1, 0.8)),
    hat: [4, 12, 20, 28, 36, 44, 52, 60].map((s) => N(s, 60, 1, 0.55)),
    fx: [N(0, 62, 1, 0.9)],
  };
}

// ---------- desenler ----------
const ids = Object.fromEntries(Object.entries(T).map(([k, t]) => [k, t.id]));
const patterns = {}, patternMeta = {};
function addPair(prefix, type, parts) {
  const halves = [{}, {}];
  for (const [k, evs] of Object.entries(parts)) { const [a, b] = split(evs); halves[0][ids[k]] = a; halves[1][ids[k]] = b; }
  [0, 1].forEach((i) => {
    const pid = prefix + (i + 1);
    patterns[pid] = Object.fromEntries(Object.values(ids).map((id) => [id, halves[i][id] || []]));
    patternMeta[pid] = { type, name: pid };
  });
}
const A = ['G', 'A', 'Fsm', 'Bm'], B = ['Bm', 'G', 'D', 'A'];

// Intro: tapping tek başına; son ölçüde ters gitar swell'i drop'a çekiyor
addPair('I', 'intro', {
  tap: tapping(A, 0.85),
  lead: [N(56, 83, 8, 0.9, { rv: 1 })],
  hat: hats().filter((e) => e.s >= 48).map((e) => ({ ...e, v: e.v * 0.6 })),
  fx: [N(48, 60, 16, 0.8)],
});
// Drop A
addPair('A', 'drop', {
  tap: tapping(A, 0.8), lead: L(LEAD_A), kick: kick(), snare: snare(), clap: clap(), hat: hats(), b808: bass808(A),
  ohat: [N(0, 60, 1, 0.7)], fx: [N(0, 62, 1, 0.8)],
});
// Breakdown
addPair('K', 'verse', breakdown());
// Glitch: bitcrush'lı pitch-up vokal, kesik tapping, ters swell
patterns.S1 = Object.fromEntries(Object.values(ids).map((id) => [id, []]));
Object.assign(patterns.S1, {
  [ids.vox]: [N(0, 83, 1, 0.85, { r: 2 }), N(2, 86), N(4, 81, 2, 0.85, { g: 1 }), N(8, 83, 1, 0.8, { r: 3 }), N(12, 79, 2),
    N(16, 85, 1, 0.85, { r: 2 }), N(18, 88), N(20, 81, 2, 0.85, { g: 1 }), N(24, 83, 1, 0.8, { r: 4 })],
  [ids.tap]: tapping(['G', 'A'], 0.7, 2).filter((e) => e.s % 8 < 4),
  [ids.lead]: [N(10, 86, 1, 0.85, { r: 3 }), N(14, 88, 2, 0.9, { g: 1 }), N(24, 88, 8, 0.9, { rv: 1 })],
  [ids.kick]: [N(0, 60), N(19, 60, 1, 0.8)],
  [ids.snare]: [N(16, 60), N(28, 60, 1, 0.8, { r: 2 }), N(29, 60, 1, 0.85, { r: 3 }), N(30, 60, 1, 0.9, { r: 4 }), N(31, 60, 1, 1, { r: 4 })],
  [ids.hat]: [0, 4, 8, 12, 16, 20].map((s) => N(s, 60, 1, 0.6)).concat([N(24, 60, 1, 0.7, { r: 4 }), N(26, 60, 1, 0.75, { r: 4 })]),
  [ids.b808]: [N(0, 31, 14), N(16, 33, 12, 0.9, { g: 1 })],
  [ids.fx]: [N(16, 60, 16, 0.85)],
});
patternMeta.S1 = { type: 'break', name: 'S1' };
// Drop B: vi–IV–I–V, yüksek lead + armoni, yoğun hat, snare roll
addPair('B', 'drop2', {
  tap: tapping(B, 0.75), lead: L(LEAD_B), harm: L(harmony(LEAD_B), 0.75), kick: kick(), snare: snare(true), clap: clap(),
  hat: hats(true), b808: bass808(B), ohat: [N(0, 60, 1, 0.75)], vox: [N(14, 86, 2, 0.6, { g: 1 }), N(46, 88, 2, 0.6, { g: 1 })], fx: [N(0, 62, 1, 0.8)],
});
// Outro: tapping söner, çözülmeden Gmaj7'de kalır (emo kapanışı)
addPair('O', 'outro', {
  tap: tapping(['G', 'A', 'Fsm'], 0.75).concat(tapping(['Gmaj7'], 0.6).map((e) => ({ ...e, s: e.s + 48 }))),
  lead: L(LEAD_A.filter(([s]) => s < 16), 0.7).concat([N(48, 78, 14, 0.8)]),
  fx: [N(48, 61, 16, 0.6)],
});

const arrangement = [
  ['Intro (tapping)', 'I1'], ['Intro → swell', 'I2'],
  ['Drop', 'A1'], ['Drop', 'A2'], ['Drop', 'A1'], ['Drop', 'A2'],
  ['Breakdown', 'K1'], ['Breakdown', 'K2'],
  ['Glitch', 'S1'],
  ['Drop B', 'B1'], ['Drop B', 'B2'], ['Drop B', 'B1'], ['Drop B', 'B2'],
  ['Drop', 'A1'], ['Drop', 'A2'],
  ['Outro', 'O1'], ['Outro', 'O2'],
].map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'Yüksek Skor (RJ esintisi, math/emo)',
  bpm: 140, swing: 0, root: 'D', scale: 'major',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 1.5, high: 2, drive: 0.35, glue: 0.55, makeup: 5, ceiling: -0.4, reverb: 1.8 },
  meta: { genre: 'rj_emo', seed: 'yuksek-skor', prog: [3, 4, 2, 5], target: -9.5, composedBy: 'Claude (elle besteleme)' },
};

const dir = path.join(ROOT, 'public', 'songs');
fs.writeFileSync(path.join(dir, 'yuksek-skor.json'), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === 'yuksek-skor.json')) {
  idx.unshift({ file: 'yuksek-skor.json', name: 'Yüksek Skor — RJ esintisi, math/emo gitar trap (Claude besteledi)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
