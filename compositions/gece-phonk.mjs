// "Gece Vardiyası" — Brazilian phonk / funk automotivo. Elle (AI) bestelendi, tamamen kodla sentez.
// Çalıştır: node compositions/gece-phonk.mjs  →  public/songs/gece-phonk.json
// F# minör (frigyen renkli), 130 BPM. Melodiyi 808 cowbell taşır; distorsiyonlu 808 kick'le kilitli ve kayar;
// davul tamborzão kökenli 3+3+4+3+3 senkop; formant vokal chop; sert, ezici master.
// Bas hareketi (2 ölçüde bir): F# | F# | D | E  ·  Drop 2'de  F# | G (bII, frigyen) | D | C#

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const T = {
  bell: makeTrack({ preset: 'cowbell', name: 'Cowbell melodi', vol: 1.1, duck: 0.3, rev: 0.12, params: { drive: 0.75, decay: 0.22, tone: 3800 } }),
  bellLo: makeTrack({ preset: 'cowbell', name: 'Cowbell (alt oktav)', oct: 4, vol: 0.45, pan: -0.3, duck: 0.3, params: { drive: 0.6, decay: 0.18, tone: 2400 } }),
  b808: makeTrack({ preset: 'b808', name: '808 (ezik)', vol: 0.9, duck: 0.2, params: { drive: 0.82, decay: 1.2, glide: 0.07, punch: 0.65 } }),
  kick: makeTrack({ inst: 'kick', role: 'kick', vol: 0.95, params: { tune: 46, punch: 0.85, decay: 0.32, drive: 0.65 } }),
  clap: makeTrack({ inst: 'clap', role: 'snare', vol: 0.9, rev: 0.12, params: { tone: 1500, decay: 0.18 } }),
  snare: makeTrack({ inst: 'snare', role: 'snare', name: 'Snare katmanı', vol: 0.55, params: { tone: 220, snap: 0.9, decay: 0.12, drive: 0.5 } }),
  hat: makeTrack({ inst: 'hat', role: 'hat', vol: 0.65, pan: 0.15, params: { decay: 0.035, tone: 9000 } }),
  rim: makeTrack({ inst: 'perc', role: 'perc', name: 'Tamborzão perk', vol: 0.75, pan: -0.15, params: { kind: 0, tone: 520, decay: 0.06 } }),
  tom: makeTrack({ inst: 'perc', role: 'perc', name: 'Funk tom', vol: 0.45, pan: 0.2, params: { kind: 1, tone: 190, decay: 0.08 } }),
  vox: makeTrack({ preset: 'vox', name: 'Vokal chop', oct: 4, vol: 0.65, crush: 0.15, rev: 0.3, dly: 0.2, params: { vowel: 3, vibrato: 0.2, breath: 0.25, formant: 1, release: 0.1 } }),
  fx: makeTrack({ inst: 'fx', role: 'fx', vol: 0.55, rev: 0.3 }),
};

const N = (s, n, l = 1, v = 0.9, x = {}) => ({ s, n, l, v, ...x });
const split = (evs) => [evs.filter((e) => e.s < 32), evs.filter((e) => e.s >= 32).map((e) => ({ ...e, s: e.s - 32 }))];
// 16 karakterlik kalıbı 4 ölçüye (64 adım) yay; x=vuruş, o=hafif, 2/3/4=roll
function pattern(bars, base = 60) {
  const out = [];
  bars.forEach((str, bar) => {
    for (let i = 0; i < 16; i++) {
      const c = str[i];
      if (c === '.') continue;
      const e = N(bar * 16 + i, base, 1, c === 'o' ? 0.55 : 0.95);
      if ('234'.includes(c)) { e.r = +c; e.v = 0.8; }
      out.push(e);
    }
  });
  return out;
}

// ---------- cowbell melodileri (F#5 = 78; F# G A B C# D E) ----------
// Bir ölçülük ritim + nota listesi; ikinci ölçü cevap verir. Notalar 2 ölçüde bir 808 kökünü izler.
const RIT = 'x.xx.x.x.xx.x.x.';
function bellBar(notes, bar) {
  const out = []; let k = 0;
  for (let i = 0; i < 16; i++) if (RIT[i] === 'x') out.push(N(bar * 16 + i, notes[k++ % notes.length], 1, i % 4 === 0 ? 0.95 : 0.82));
  return out;
}
// A motifi: F# etrafında dönen, C#'ye sıçrayıp inen
const BELL_A = [
  ...bellBar([78, 78, 81, 78, 85, 83, 81, 78, 79], 0),
  ...bellBar([78, 78, 81, 78, 85, 86, 85, 83, 81], 1),
  ...bellBar([74, 74, 78, 74, 81, 79, 78, 74, 76], 2), // D
  ...bellBar([76, 76, 80, 76, 83, 81, 80, 78, 76], 3), // E (G# geçişli → F#'ye çeker)
];
// B motifi: daha tiz, frigyen G ile karanlık
const BELL_B = [
  ...bellBar([90, 85, 90, 88, 85, 83, 85, 81, 79], 0),
  ...bellBar([91, 86, 91, 90, 86, 83, 86, 79, 83], 1), // G (bII)
  ...bellBar([86, 81, 86, 85, 81, 78, 81, 76, 78], 2), // D
  ...bellBar([85, 80, 85, 83, 80, 77, 80, 73, 77], 3), // C# (dominant, E#=77)
];
const lower = (evs, v = 0.75) => evs.filter((e) => e.s % 2 === 0).map((e) => ({ ...e, n: e.n - 12, v: e.v * v }));

// ---------- davullar (tamborzão: 3+3+4+3+3) ----------
const KICK = ['x..x..x...x..x..', 'x..x..x...x..x..', 'x..x..x...x..x..', 'x..x..x.x.x..x.x'];
const CLAP = ['....x.......x...', '....x.......x...', '....x.......x...', '....x.......x.x.'];
const RIM = ['..x..x.x..x.x...', '.x..x..x.x..x..x', '..x..x.x..x.x...', '.x..x..x.x.2x.3.'];
const TOM = ['.......x.......x', '......x.......x.', '.......x.......x', '..........x.x.xx'];
const HAT = ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.3.4.x.'];

// ---------- 808: kick vuruşlarında, 2 ölçüde bir kök, ölçü sonu kayması ----------
function bass808(roots) {
  const out = [];
  roots.forEach((r, bar) => {
    const ks = [];
    for (let i = 0; i < 16; i++) if (KICK[bar][i] === 'x') ks.push(i);
    ks.forEach((k, j) => {
      const next = j + 1 < ks.length ? ks[j + 1] : 16;
      const ev = N(bar * 16 + k, r, next - k, 0.95);
      if (j === ks.length - 1) { ev.n = r + 12; ev.g = 1; }      // ölçü sonunda oktav yukarı kayma
      if (j === 0 && bar > 0) ev.g = 1;                          // ölçü başında köke geri kayış
      out.push(ev);
    });
  });
  return out;
}
const ROOTS_A = [30, 30, 26, 28];   // F#1 F#1 D1 E1
const ROOTS_B = [30, 31, 26, 25];   // F#1 G1 D1 C#1

// ---------- vokal chop ----------
const VOX_A = [N(6, 66, 2, 0.85), N(14, 69, 1, 0.8), N(22, 66, 2, 0.85), N(30, 73, 2, 0.85, { g: 1 }), N(38, 62, 2, 0.85), N(46, 66, 1, 0.8), N(54, 64, 2, 0.85), N(62, 68, 2, 0.85, { g: 1 })];

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

// Intro: cowbell tek başına + vokal, ikinci yarıda hat ve riser
addPair('I', 'intro', {
  bell: BELL_A.map((e) => ({ ...e, v: e.v * 0.8 })), vox: VOX_A.filter((e) => e.s < 32),
  hat: pattern(HAT).filter((e) => e.s >= 32).map((e) => ({ ...e, v: e.v * 0.6 })),
  fx: [N(32, 60, 32, 0.85)],
});
// Drop 1
addPair('A', 'drop', {
  bell: BELL_A, bellLo: lower(BELL_A), b808: bass808(ROOTS_A), kick: pattern(KICK), clap: pattern(CLAP), snare: pattern(CLAP),
  hat: pattern(HAT), rim: pattern(RIM), vox: VOX_A, fx: [N(0, 62, 1, 0.9)],
});
// Kırılma: kick yok, 808 uzun kayar, cowbell yarı yoğunlukta, vokal öne çıkar, riser
addPair('K', 'break', {
  bell: BELL_A.filter((e) => e.s % 4 === 0 || e.s >= 48),
  b808: [N(0, 30, 14), N(14, 42, 2, 0.9, { g: 1 }), N(16, 30, 16, 0.9, { g: 1 }), N(32, 26, 16), N(48, 28, 12), N(60, 40, 4, 0.9, { g: 1 })],
  vox: VOX_A.map((e) => ({ ...e, l: e.l + 1 })),
  hat: pattern(['....x.......x...', '....x.......x...', '..x...x...x...x.', 'x.x.x.x.3.3.4.4.']),
  clap: [N(56, 60, 1, 0.6), N(58, 60, 1, 0.7), N(60, 60, 1, 0.8, { r: 2 }), N(62, 60, 1, 0.9, { r: 4 })],
  fx: [N(0, 61, 16, 0.7), N(32, 60, 32, 0.9)],
});
// Drop 2: tiz/karanlık B motifi, frigyen G, ekstra tom ve roll'lar
addPair('B', 'drop2', {
  bell: BELL_B, bellLo: lower(BELL_B), b808: bass808(ROOTS_B), kick: pattern(KICK), clap: pattern(CLAP), snare: pattern(CLAP),
  hat: pattern(HAT.map((h, i) => (i % 2 ? 'x.x.x.x.x.x.3.x.' : h))), rim: pattern(RIM), tom: pattern(TOM),
  vox: VOX_A.map((e) => ({ ...e, n: e.n + 12 })), fx: [N(0, 62, 1, 0.9)],
});
// Outro: cowbell + 808 söner, son impact
addPair('O', 'outro', {
  bell: BELL_A.filter((e) => e.s < 32).map((e) => ({ ...e, v: e.v * 0.8 })).concat([N(32, 78, 2, 0.8)]),
  b808: [N(0, 30, 16), N(16, 30, 16), N(32, 30, 16, 0.8)],
  hat: pattern(HAT).filter((e) => e.s < 32),
  vox: [N(38, 66, 6, 0.8, { g: 1 })],
  fx: [N(32, 62, 1, 0.9), N(32, 61, 32, 0.6)],
});

const arrangement = [
  ['Intro', 'I1'], ['Intro', 'I2'],
  ['Drop', 'A1'], ['Drop', 'A2'], ['Drop', 'A1'], ['Drop', 'A2'],
  ['Kırılma', 'K1'], ['Kırılma', 'K2'],
  ['Drop 2', 'B1'], ['Drop 2', 'B2'], ['Drop 2', 'B1'], ['Drop 2', 'B2'],
  ['Drop', 'A1'], ['Drop', 'A2'], ['Drop', 'A1'], ['Drop', 'A2'],
  ['Outro', 'O1'], ['Outro', 'O2'],
].map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'Gece Vardiyası (Brazilian phonk)',
  bpm: 130, swing: 0, root: 'F#', scale: 'minor',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 3, high: 1.5, drive: 0.65, glue: 0.65, makeup: 6, ceiling: -0.3, reverb: 1.4 },
  meta: { genre: 'brazilian_phonk', seed: 'gece-vardiyasi', prog: [0, 0, 5, 6], target: -8.5, composedBy: 'Claude (elle besteleme)' },
};

const dir = path.join(ROOT, 'public', 'songs');
fs.writeFileSync(path.join(dir, 'gece-phonk.json'), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === 'gece-phonk.json')) {
  idx.unshift({ file: 'gece-phonk.json', name: 'Gece Vardiyası — Brazilian phonk (Claude besteledi)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
