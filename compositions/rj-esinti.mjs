// "Gece Sürüşü" — RJ Pasin esintili, elle (AI) bestelenmiş şarkı.
// Çalıştır: node compositions/rj-esinti.mjs  →  public/songs/rj-esinti.json
// E minör, 150 BPM, yarım tempo trap davul. Akorlar: Em | C | Am | B7 (armonik minörden B7 gerilimi),
// ara bölüm frigyen Em | F. Temiz melodik lead gitar + iki kanallı palm-mute ritim + kayan 808.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---------- kanallar ----------
const T = {
  lead: makeTrack({ inst: 'guitar', role: 'melody', name: 'Lead gitar', oct: 4, vol: 0.95, pan: 0.08, rev: 0.25, dly: 0.16, duck: 0.15,
    params: { drive: 0.32, mute: 0, power: 0, bright: 0.78, cab: 6200, double: 0, vib: 0.5, bend: 0.08 } }),
  harm: makeTrack({ inst: 'guitar', role: 'counter', name: 'Lead armoni', oct: 4, vol: 0.7, pan: -0.4, rev: 0.32, dly: 0.2, duck: 0.15,
    params: { drive: 0.3, mute: 0, power: 0, bright: 0.7, cab: 5600, double: 0, vib: 0.35, bend: 0.08 } }),
  chug: makeTrack({ inst: 'guitar', role: 'riff', name: 'Ritim (L/R)', oct: 2, vol: 0.7, rev: 0.05, duck: 0.35,
    params: { drive: 0.85, mute: 0.78, power: 1, bright: 0.55, cab: 4200, double: 1 } }),
  kick: makeTrack({ inst: 'kick', role: 'kick', vol: 0.82, params: { tune: 47, punch: 0.85, decay: 0.4, drive: 0.35 } }),
  snare: makeTrack({ inst: 'snare', role: 'snare', vol: 0.95, rev: 0.12, params: { tone: 200, snap: 0.85, decay: 0.2, drive: 0.3 } }),
  clap: makeTrack({ inst: 'clap', role: 'snare', name: 'Clap katmanı', vol: 0.65, rev: 0.18 }),
  hat: makeTrack({ inst: 'hat', role: 'hat', vol: 0.75, pan: 0.2, params: { decay: 0.035, tone: 8500 } }),
  ohat: makeTrack({ inst: 'openhat', role: 'openhat', vol: 0.4, pan: -0.2, params: { decay: 0.28 } }),
  b808: makeTrack({ inst: 'bass808', role: 'bass', name: '808', oct: 1, vol: 0.86, duck: 0.25, params: { drive: 0.5, decay: 1.6, glide: 0.09, punch: 0.5 } }),
  bell: makeTrack({ inst: 'bell', role: 'counter', name: 'Parıltı bell', oct: 5, vol: 0.45, pan: 0.3, rev: 0.4, dly: 0.25, params: { ratio: 3.5, index: 2.5, decay: 1.2 } }),
  vox: makeTrack({ inst: 'vox', role: 'vox', name: 'Vokal chop', oct: 4, vol: 0.45, rev: 0.45, dly: 0.3, params: { vowel: 0, vibrato: 0.35, breath: 0.2, formant: 1.1, release: 0.25 } }),
  pad: makeTrack({ inst: 'pad', role: 'pad', name: 'Atmosfer', oct: 3, vol: 0.3, rev: 0.5, params: { cutoff: 1100, attack: 0.6, release: 1.5 } }),
  fx: makeTrack({ inst: 'fx', role: 'fx', vol: 0.5, rev: 0.3 }),
};

// ---------- yardımcılar ----------
const N = (s, n, l = 1, v = 0.9, x = {}) => ({ s, n, l, v, ...x });
const hits = (steps, v = 0.95) => steps.map((s) => (typeof s === 'number' ? N(s, 60, 1, v) : { n: 60, l: 1, ...s }));
// 4 ölçülük (64 adım) diziyi 2 desene böl
const split = (evs) => [evs.filter((e) => e.s < 32), evs.filter((e) => e.s >= 32).map((e) => ({ ...e, s: e.s - 32 }))];
const shift = (evs, d) => evs.map((e) => ({ ...e, s: e.s + d }));

// ---------- ana riff (Em | C | Am | B7) ----------
// [adım, nota, uzunluk, glide?]
const RIFF = [
  // Em
  [0, 76, 2], [2, 71], [3, 67], [4, 71], [5, 76], [6, 78, 2], [8, 79, 3, 1], [11, 76], [12, 74, 2], [14, 71, 2],
  // C
  [16, 79, 2], [18, 76], [19, 72], [20, 76], [21, 79], [22, 81, 2], [24, 79, 3, 1], [27, 76], [28, 74, 2], [30, 71, 2],
  // Am
  [32, 72, 2], [34, 69], [35, 64], [36, 69], [37, 72], [38, 76, 2], [40, 74, 3, 1], [43, 72], [44, 71, 2], [46, 69, 2],
  // B7
  [48, 71, 2], [50, 75], [51, 78], [52, 81, 2], [54, 79, 2, 1], [56, 78, 3], [59, 75], [60, 71, 2], [62, 78, 2, 1],
];
// B bölümü: 2. ve 4. ölçüde bir oktav yukarıdan cevap
const RIFF_B = RIFF.filter(([s]) => (s < 16) || (s >= 32 && s < 48)).concat([
  [16, 84, 2], [18, 83], [19, 79], [20, 76], [21, 79], [22, 83, 2], [24, 84, 4, 1], [28, 83, 2], [30, 79, 2],
  [48, 83, 2], [50, 81], [51, 78], [52, 75], [53, 78], [54, 81, 2], [56, 83, 4, 1], [60, 78, 2], [62, 75, 2],
]);
const toEvs = (riff, vScale = 1) => riff.map(([s, n, l = 1, g = 0]) => N(s, n, l, (s % 4 === 0 ? 0.95 : 0.82) * vScale, g ? { g: 1 } : {}));

// diyatonik alt üçlü (armoni); B7 ölçüsünde D# kullan
function thirdBelow(n, s) {
  const pcs = s >= 48 ? [4, 6, 7, 9, 11, 0, 3] : [4, 6, 7, 9, 11, 0, 2];
  const pc = ((n % 12) + 12) % 12;
  const i = pcs.indexOf(pc);
  if (i < 0) return n - 3;
  const t = pcs[(i + 5) % 7]; // iki derece aşağı
  let d = pc - t; if (d <= 0) d += 12;
  return n - d;
}
const harmony = (riff) => riff.filter(([s, , l = 1]) => l >= 2 || s % 4 === 0).map(([s, n, l = 1, g = 0]) => N(s, thirdBelow(n, s), l, 0.7, g ? { g: 1 } : {}));

// ---------- ritim gitar (palm-mute chug) ----------
const CHUG_BAR = [[0, 0.95], [2, 0.7], [3, 0.75], [6, 0.95], [7, 0.7], [10, 0.95], [12, 0.7], [14, 0.8]];
const ROOTS = [40, 36, 45, 47]; // E2, C2, A2, B2
function chug(lastBarFill = false) {
  const out = [];
  ROOTS.forEach((root, bar) => {
    for (const [s, v] of CHUG_BAR) {
      let n = root;
      if (lastBarFill && bar === 3 && s >= 12) n = s === 12 ? 42 : 43; // F#2, G2 geçiş
      out.push(N(bar * 16 + s, n, 1, v));
    }
  });
  return out;
}

// ---------- davullar (yarım tempo trap) ----------
const KICK_BARS = [[0, 7, 10], [0, 6, 10, 11], [0, 7, 10, 13], [0, 6, 9, 12]];
const kick = () => KICK_BARS.flatMap((b, i) => b.map((s) => N(i * 16 + s, 60, 1, 0.95)));
const snare = (rollEnd = false) => {
  const evs = [N(8, 60), N(24, 60), N(31, 60, 1, 0.45), N(40, 60), N(56, 60), N(62, 60, 1, 0.5)];
  if (rollEnd) return evs.filter((e) => e.s < 59).concat([N(59, 60, 1, 0.6), N(60, 60, 1, 0.7, { r: 2 }), N(61, 60, 1, 0.8, { r: 2 }), N(62, 60, 1, 0.85, { r: 3 }), N(63, 60, 1, 0.95, { r: 4 })]);
  return evs;
};
const clap = () => [8, 24, 40, 56].map((s) => N(s, 60, 1, 0.9));
function hats(dense = false) {
  const out = [];
  const rolls = { 12: 3, 30: 2, 38: 2, 44: 3, 60: 4, 62: 3 };
  for (let s = 0; s < 64; s += 2) {
    const e = N(s, 60, 1, s % 4 === 0 ? 0.85 : 0.6);
    if (rolls[s]) { e.r = rolls[s]; e.v = 0.7; }
    out.push(e);
    if (dense && s >= 48 && !rolls[s]) out.push(N(s + 1, 60, 1, 0.45));
  }
  return out;
}
const ohats = () => [N(14, 60, 1, 0.7), N(46, 60, 1, 0.7)];

// ---------- 808 (kick'e kilitli, akor kökü, kaymalar) ----------
const B808 = [
  N(0, 28, 7), N(7, 28, 3), N(10, 40, 6, 0.9, { g: 1 }),
  N(16, 36, 6), N(22, 36, 4), N(26, 36, 1), N(27, 40, 5, 0.9, { g: 1 }),
  N(32, 33, 7), N(39, 33, 3), N(42, 33, 3), N(45, 45, 3, 0.9, { g: 1 }),
  N(48, 35, 6), N(54, 35, 3), N(57, 35, 3), N(60, 39, 2, 0.9, { g: 1 }), N(62, 40, 2, 0.9, { g: 1 }),
];

// ---------- bell parıltıları (B bölümü) ----------
const BELL = [N(3, 83, 2), N(11, 79, 2), N(19, 79, 2), N(27, 84, 2), N(35, 81, 2), N(43, 76, 2), N(51, 83, 2), N(59, 87, 3)];

// ---------- pad akorları ----------
const PAD = [N(0, 52, 16), N(0, 55, 16), N(0, 59, 16), N(16, 48, 16), N(16, 52, 16), N(16, 55, 16),
  N(32, 45, 16), N(32, 48, 16), N(32, 52, 16), N(48, 47, 16), N(48, 51, 16), N(48, 54, 16), N(48, 57, 16)];

// ---------- desenleri kur ----------
const patterns = {}, patternMeta = {};
const ids = Object.fromEntries(Object.entries(T).map(([k, t]) => [k, t.id]));
function addPair(prefix, type, parts) {
  const halves = [{}, {}];
  for (const [k, evs] of Object.entries(parts)) {
    const [a, b] = split(evs);
    halves[0][ids[k]] = a; halves[1][ids[k]] = b;
  }
  [1, 2].forEach((i) => {
    const pid = prefix + i;
    patterns[pid] = Object.fromEntries(Object.values(ids).map((id) => [id, halves[i - 1][id] || []]));
    patternMeta[pid] = { type, name: prefix + i };
  });
}

// Intro: temiz lead + pad, ikinci yarıda hat ve riser
addPair('I', 'intro', {
  lead: toEvs(RIFF, 0.85),
  pad: PAD,
  hat: hats().filter((e) => e.s >= 48).map((e) => ({ ...e, v: e.v * 0.6 })),
  fx: [N(48, 60, 16, 0.8)],
});
// Hook A
addPair('A', 'drop', {
  lead: toEvs(RIFF), chug: chug(), kick: kick(), snare: snare(), clap: clap(), hat: hats(), ohat: ohats(), b808: B808,
  fx: [N(0, 62, 1, 0.8)],
});
// Hook B: oktav cevabı, armoni, bell, yoğun hat, snare roll
addPair('B', 'drop2', {
  lead: toEvs(RIFF_B), harm: harmony(RIFF_B), chug: chug(true), kick: kick(), snare: snare(true), clap: clap(), hat: hats(true), ohat: ohats(), b808: B808, bell: BELL,
  fx: [N(0, 62, 1, 0.8)],
});
// Outro: lead tek başına söner, son ölçüde uzun E5
const outroLead = toEvs(RIFF.filter(([s]) => s < 48), 0.8).concat([N(48, 76, 14, 0.85)]);
addPair('O', 'outro', { lead: outroLead, pad: PAD.filter((e) => e.s < 48).concat([N(48, 52, 16), N(48, 55, 16), N(48, 59, 16)]), bell: [N(51, 83, 6, 0.7)], fx: [N(48, 61, 16, 0.6)] });

// Ara bölüm (frigyen Em | F, yarım-yarım tempo, stutter)
const SW_LEAD = [N(0, 76, 1, 0.9, { r: 3 }), N(2, 79, 2), N(4, 78), N(6, 76, 2), N(8, 71, 4), N(12, 74, 2), N(14, 76, 2),
  N(16, 77, 2), N(18, 76), N(19, 72), N(20, 77, 2), N(22, 81, 2), N(24, 79, 4, 0.9, { g: 1 }), N(28, 77, 2, 0.85, { r: 2 }), N(30, 76, 2)];
const SW = {
  lead: SW_LEAD,
  vox: [N(4, 71, 2, 0.8), N(10, 67, 2, 0.75), N(20, 69, 2, 0.8), N(26, 72, 3, 0.85, { g: 1 })],
  pad: [N(0, 52, 16), N(0, 55, 16), N(0, 59, 16), N(16, 53, 16), N(16, 57, 16), N(16, 60, 16)],
  chug: [N(0, 40, 2, 0.95), N(16, 41, 2, 0.95)],
  kick: [N(0, 60), N(19, 60, 1, 0.8)],
  snare: [N(16, 60)], clap: [N(16, 60)],
  hat: [0, 4, 8, 12, 16, 20, 24].map((s) => N(s, 60, 1, 0.6)).concat([N(28, 60, 1, 0.7, { r: 4 })]),
  b808: [N(0, 28, 14), N(16, 29, 12, 0.9, { g: 1 }), N(28, 28, 4, 0.9, { g: 1 })],
};
for (const pid of ['S1', 'S2']) {
  patterns[pid] = Object.fromEntries(Object.values(ids).map((id) => [id, []]));
  for (const [k, evs] of Object.entries(SW)) patterns[pid][ids[k]] = evs.map((e) => ({ ...e }));
  patternMeta[pid] = { type: 'break', name: pid };
}
// S2: snare roll + riser ile hook'a hazırlık
patterns.S2[ids.snare] = [N(16, 60), N(24, 60, 1, 0.6), N(26, 60, 1, 0.7), N(28, 60, 1, 0.8, { r: 2 }), N(29, 60, 1, 0.85, { r: 2 }), N(30, 60, 1, 0.9, { r: 3 }), N(31, 60, 1, 1, { r: 4 })];
patterns.S2[ids.fx] = [N(16, 60, 16, 0.85)];

const arrangement = [
  ['Intro', 'I1'], ['Intro', 'I2'],
  ['Hook', 'A1'], ['Hook', 'A2'], ['Hook', 'A1'], ['Hook', 'A2'],
  ['Ara (frigyen)', 'S1'], ['Ara → yükseliş', 'S2'],
  ['Hook B', 'B1'], ['Hook B', 'B2'], ['Hook B', 'B1'], ['Hook B', 'B2'],
  ['Hook', 'A1'], ['Hook', 'A2'],
  ['Outro', 'O1'], ['Outro', 'O2'],
].map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'Gece Sürüşü (RJ Pasin esintisi)',
  bpm: 150, swing: 0, root: 'E', scale: 'minor',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 1.5, high: 2, drive: 0.3, glue: 0.5, makeup: 5, ceiling: -0.4, reverb: 1.8 },
  meta: { genre: 'rj_type', seed: 'gece-surusu', prog: [0, 5, 3, 4], target: -9.5, composedBy: 'Claude (elle besteleme)' },
};

const dir = path.join(ROOT, 'public', 'songs');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'rj-esinti.json'), JSON.stringify(song));
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
