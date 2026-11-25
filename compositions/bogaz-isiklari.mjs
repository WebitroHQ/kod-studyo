// "Boğaz Işıkları" — RJ Pasin esintili gitar-trap + Türk dokusu. Elle (AI) bestelendi, tamamen kodla sentez.
// Çalıştır: node compositions/bogaz-isiklari.mjs  →  public/songs/bogaz-isiklari.json
// E hicaz (frigyen dominant: E F G# A B C D), 145 BPM.
// Akorlar: Hook A  E | F | Dm | E   (hicaz kadansı)   ·   Hook B  Am | Dm | F | E
// Kadro: naylon gitar girişi, hızlı elektro gitar lickleri, bağlama cevapları, iki kanallı palm-mute ritim,
// yaylılar, 808, trap davul + darbuka, hicaz vokal chop.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const T = {
  lead: makeTrack({ preset: 'gtrLead', name: 'Lead gitar', vol: 0.95 }),
  baglama: makeTrack({ preset: 'baglama', name: 'Bağlama', role: 'counter', vol: 1.0, pan: -0.3, rev: 0.28, dly: 0.12 }),
  nylon: makeTrack({ preset: 'nylon', name: 'Naylon gitar', role: 'chords', vol: 1.1, pan: 0.2, rev: 0.3 }),
  chug: makeTrack({ preset: 'gtrPalm', name: 'Ritim (L/R)', vol: 0.65 }),
  strings: makeTrack({ preset: 'strings', name: 'Yaylılar', vol: 0.55, rev: 0.45, duck: 0.25 }),
  kick: makeTrack({ inst: 'kick', role: 'kick', vol: 0.82, params: { tune: 46, punch: 0.85, decay: 0.42, drive: 0.35 } }),
  snare: makeTrack({ inst: 'snare', role: 'snare', vol: 0.95, rev: 0.12, params: { tone: 205, snap: 0.85, decay: 0.2, drive: 0.3 } }),
  clap: makeTrack({ inst: 'clap', role: 'snare', name: 'Clap katmanı', vol: 0.6, rev: 0.18 }),
  hat: makeTrack({ inst: 'hat', role: 'hat', vol: 0.75, pan: 0.2, params: { decay: 0.035, tone: 8500 } }),
  darbuka: makeTrack({ preset: 'darbuka', name: 'Darbuka (tek)', vol: 0.8, pan: -0.15, params: { kind: 0, tone: 650, decay: 0.05 } }),
  b808: makeTrack({ preset: 'b808', name: '808', vol: 0.86, params: { drive: 0.5, decay: 1.6, glide: 0.09, punch: 0.5 } }),
  vox: makeTrack({ preset: 'vox', name: 'Hicaz vokal', vol: 0.5, rev: 0.5, dly: 0.3, params: { vowel: 0, vibrato: 0.55, breath: 0.2, formant: 1.05, release: 0.3 } }),
  fx: makeTrack({ inst: 'fx', role: 'fx', vol: 0.5, rev: 0.3 }),
};

const N = (s, n, l = 1, v = 0.9, x = {}) => ({ s, n, l, v, ...x });
const split = (evs) => [evs.filter((e) => e.s < 32), evs.filter((e) => e.s >= 32).map((e) => ({ ...e, s: e.s - 32 }))];
// [adım, nota, uzunluk, glide] → olay; güçlü vuruşlar daha vurgulu
const L = (arr, vs = 1) => arr.map(([s, n, l = 1, g = 0]) => N(s, n, l, (s % 4 === 0 ? 0.95 : 0.8) * vs, g ? { g: 1 } : {}));

// ---------- Hook A lead: hızlı 16'lık koşular + bend'li uzun notalar ----------
const LEAD_A = [
  // E
  [0, 76], [1, 77], [2, 80], [3, 81], [4, 83, 2], [6, 81], [7, 80], [8, 77], [9, 80], [10, 76, 3], [13, 74], [14, 76, 2, 1],
  // F
  [16, 77, 2], [18, 81], [19, 84], [20, 81, 2], [22, 77], [23, 76], [24, 77, 3, 1], [27, 81], [28, 80, 2], [30, 77], [31, 76],
  // Dm
  [32, 74, 2], [34, 77], [35, 81], [36, 86, 2], [38, 84], [39, 81], [40, 83], [41, 81], [42, 77, 2], [44, 76], [45, 77], [46, 74, 2],
  // E — inen koşu ve titreşimli bitiş
  [48, 71], [49, 76], [50, 80], [51, 83], [52, 88, 3, 1], [55, 86], [56, 84], [57, 83], [58, 81], [59, 80], [60, 77, 2], [62, 76, 2],
];
// ---------- Hook B lead (Am | Dm | F | E), bir oktav yukarıda ----------
const LEAD_B = [
  [0, 81, 2], [2, 84], [3, 88, 2, 1], [5, 84], [6, 81], [7, 83], [8, 84, 3], [11, 83], [12, 81, 2], [14, 80, 2],
  [16, 77, 2], [18, 81], [19, 86, 2], [21, 84], [22, 81], [23, 77], [24, 81, 3, 1], [27, 80], [28, 81, 2], [30, 86, 2, 1],
  [32, 84, 2], [34, 81], [35, 77], [36, 81], [37, 84], [38, 89, 2, 1], [40, 88, 3], [43, 86], [44, 84, 2], [46, 81, 2],
  [48, 80], [49, 81], [50, 83], [51, 84], [52, 83], [53, 81], [54, 80], [55, 77], [56, 76, 4], [60, 71], [61, 76], [62, 80], [63, 83],
];
// ---------- Bağlama bölümü melodisi (E | F | Dm | E) ----------
const BAGLAMA_C = [
  [0, 71, 2], [2, 72], [3, 71], [4, 69, 2], [6, 68], [7, 69], [8, 71, 4], [12, 72, 2], [14, 71, 2],
  [16, 69, 2], [18, 71], [19, 72], [20, 74, 2], [22, 72], [23, 71], [24, 69, 4], [28, 68, 2], [30, 65, 2],
  [32, 74, 2], [34, 72], [35, 71], [36, 69, 2], [38, 65], [39, 68], [40, 69, 4], [44, 71, 2], [46, 72, 2],
  [48, 71, 2], [50, 69], [51, 68], [52, 65, 2], [54, 68, 2, 1], [56, 64, 8],
];
// gitar bağlamaya ölçü sonlarında cevap verir
const LEAD_C = [[12, 88], [13, 86], [14, 84], [15, 83], [28, 84], [29, 81], [30, 80], [31, 77], [44, 86], [45, 84], [46, 83], [47, 81], [60, 83], [61, 80], [62, 77], [63, 76]];
// Hook B'de bağlama melodiyi bir oktav aşağıdan, seyreltilmiş olarak ikiler
const BAGLAMA_B = LEAD_B.filter(([s, , l = 1]) => l >= 2 || s % 4 === 0).map(([s, n, l = 1, g = 0]) => [s, n - 12, l, g]);

// ---------- naylon gitar arpejleri (8'lik) ----------
const ARP = {
  E: [52, 59, 64, 68, 71, 68, 64, 59], F: [53, 60, 65, 69, 72, 69, 65, 60],
  Dm: [50, 57, 62, 65, 69, 65, 62, 57], Am: [45, 52, 57, 60, 64, 60, 57, 52],
};
const arp = (chords, vs = 0.75) => chords.flatMap((c, bar) => ARP[c].map((n, i) => N(bar * 16 + i * 2, n, 2, (i % 4 === 0 ? 0.85 : 0.7) * vs)));

// ---------- yaylılar ----------
const STR = { E: [52, 56, 59, 64], F: [53, 57, 60, 65], Dm: [50, 53, 57, 62], Am: [57, 60, 64, 69] };
const strings = (chords) => chords.flatMap((c, bar) => STR[c].map((n) => N(bar * 16, n, 16, 0.75)));

// ---------- ritim gitar ----------
const CROOT = { E: 40, F: 41, Dm: 38, Am: 45 };
const CHUG = [[0, 0.95], [2, 0.7], [3, 0.75], [6, 0.95], [7, 0.7], [10, 0.95], [12, 0.7], [14, 0.8]];
const chug = (chords) => chords.flatMap((c, bar) => CHUG.map(([s, v]) => N(bar * 16 + s, CROOT[c], 1, v)));

// ---------- 808 ----------
const R808 = { E: 28, F: 29, Dm: 26, Am: 33 };
function bass808(chords) {
  const KB = [[0, 7, 10], [0, 6, 10, 11], [0, 7, 10, 13], [0, 6, 9, 12]];
  const out = [];
  chords.forEach((c, bar) => {
    const ks = KB[bar];
    ks.forEach((k, i) => {
      const next = i + 1 < ks.length ? ks[i + 1] : 16;
      let n = R808[c];
      const ev = N(bar * 16 + k, n, next - k, 0.95);
      if (i === ks.length - 1 && bar % 2 === 1) { ev.n = n + 12; ev.g = 1; } // ölçü sonunda oktav kayması
      out.push(ev);
    });
  });
  return out;
}

// ---------- davullar ----------
const KICK_BARS = [[0, 7, 10], [0, 6, 10, 11], [0, 7, 10, 13], [0, 6, 9, 12]];
const kick = () => KICK_BARS.flatMap((b, i) => b.map((s) => N(i * 16 + s, 60, 1, 0.95)));
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
// darbuka "tek"leri (düm'ü kick veriyor): maksum benzeri senkop
const darbuka = () => [0, 1, 2, 3].flatMap((bar) => [3, 6, 10, 11, 14].map((s) => N(bar * 16 + s, 60, 1, s === 6 || s === 14 ? 0.8 : 0.55)));

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
const A = ['E', 'F', 'Dm', 'E'], B = ['Am', 'Dm', 'F', 'E'];

// Intro: naylon gitar arpeji + yaylılar; ikinci yarıda hat ve riser
addPair('I', 'intro', {
  nylon: arp(A), strings: strings(A).map((e) => ({ ...e, v: 0.55 })),
  hat: hats().filter((e) => e.s >= 48).map((e) => ({ ...e, v: e.v * 0.6 })),
  fx: [N(48, 60, 16, 0.8)],
});
// Hook A
addPair('A', 'drop', {
  lead: L(LEAD_A), chug: chug(A), kick: kick(), snare: snare(), clap: clap(), hat: hats(), darbuka: darbuka(), b808: bass808(A),
  fx: [N(0, 62, 1, 0.8)],
});
// Bağlama bölümü: bağlama önde, gitar cevaplar, davul hafif
addPair('C', 'break', {
  baglama: L(BAGLAMA_C), lead: L(LEAD_C, 0.8), strings: strings(A).map((e) => ({ ...e, v: 0.6 })), nylon: arp(A, 0.55),
  darbuka: darbuka(), kick: [0, 16, 32, 48].map((s) => N(s, 60, 1, 0.8)), b808: A.map((c, bar) => N(bar * 16, R808[c], 14, 0.85)),
});
// Ara (glitch, yarım tempo): hicaz vokal + stutter
const SW = {
  vox: [N(0, 71, 2, 0.8), N(2, 72, 1, 0.8, { g: 1 }), N(3, 71), N(4, 69, 2), N(6, 68, 2, 0.85, { g: 1 }), N(8, 65, 2), N(10, 64, 6, 0.9, { g: 1 })],
  lead: [N(16, 76, 1, 0.9, { r: 3 }), N(18, 80, 1, 0.85, { r: 2 }), N(20, 83, 2), N(22, 88, 2, 0.9, { g: 1 }), N(24, 86), N(25, 84), N(26, 83), N(27, 81), N(28, 80, 1, 0.8, { r: 4 }), N(30, 77, 2)],
  strings: [52, 56, 59].map((n) => N(0, n, 16, 0.6)).concat([53, 57, 60].map((n) => N(16, n, 16, 0.6))),
  chug: [N(0, 40, 2, 0.95), N(16, 41, 2, 0.95)],
  kick: [N(0, 60), N(19, 60, 1, 0.8)], snare: [N(16, 60)], clap: [N(16, 60)],
  hat: [0, 4, 8, 12, 16, 20, 24].map((s) => N(s, 60, 1, 0.6)).concat([N(28, 60, 1, 0.7, { r: 4 })]),
  b808: [N(0, 28, 14), N(16, 29, 12, 0.9, { g: 1 }), N(28, 28, 4, 0.9, { g: 1 })],
};
for (const pid of ['S1', 'S2']) {
  patterns[pid] = Object.fromEntries(Object.values(ids).map((id) => [id, []]));
  for (const [k, evs] of Object.entries(SW)) patterns[pid][ids[k]] = evs.map((e) => ({ ...e }));
  patternMeta[pid] = { type: 'break', name: pid };
}
patterns.S2[ids.snare] = [N(16, 60), N(24, 60, 1, 0.6), N(26, 60, 1, 0.7), N(28, 60, 1, 0.8, { r: 2 }), N(29, 60, 1, 0.85, { r: 2 }), N(30, 60, 1, 0.9, { r: 3 }), N(31, 60, 1, 1, { r: 4 })];
patterns.S2[ids.fx] = [N(16, 60, 16, 0.85)];
// Hook B: yeni akorlar, yüksek lead, bağlama ikilemesi, yaylılar, yoğun hat
addPair('B', 'drop2', {
  lead: L(LEAD_B), baglama: L(BAGLAMA_B, 0.75), strings: strings(B).map((e) => ({ ...e, v: 0.55 })), chug: chug(B),
  kick: kick(), snare: snare(true), clap: clap(), hat: hats(true), darbuka: darbuka(), b808: bass808(B), fx: [N(0, 62, 1, 0.8)],
});
// Outro: naylon arpej, son ölçüde gitarın uzun E'si
addPair('O', 'outro', {
  nylon: arp(A, 0.7), strings: strings(A).map((e) => ({ ...e, v: 0.5 })),
  lead: L(LEAD_A.filter(([s]) => s < 16), 0.7).concat([N(48, 76, 14, 0.85)]),
  baglama: [N(52, 71, 2, 0.6), N(54, 68, 2, 0.6, { g: 1 }), N(56, 64, 8, 0.65)],
  fx: [N(48, 61, 16, 0.6)],
});

const arrangement = [
  ['Giriş (naylon)', 'I1'], ['Giriş (naylon)', 'I2'],
  ['Hook', 'A1'], ['Hook', 'A2'], ['Hook', 'A1'], ['Hook', 'A2'],
  ['Bağlama', 'C1'], ['Bağlama', 'C2'],
  ['Ara (hicaz)', 'S1'], ['Ara → yükseliş', 'S2'],
  ['Hook B', 'B1'], ['Hook B', 'B2'], ['Hook B', 'B1'], ['Hook B', 'B2'],
  ['Hook', 'A1'], ['Hook', 'A2'],
  ['Kapanış', 'O1'], ['Kapanış', 'O2'],
].map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'Boğaz Işıkları (RJ esintisi × hicaz)',
  bpm: 145, swing: 0, root: 'E', scale: 'hijaz',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 1.5, high: 1.8, drive: 0.3, glue: 0.5, makeup: 5, ceiling: -0.4, reverb: 2 },
  meta: { genre: 'rj_type', seed: 'bogaz-isiklari', prog: [0, 1, 6, 0], target: -9.5, composedBy: 'Claude (elle besteleme)' },
};

const dir = path.join(ROOT, 'public', 'songs');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'bogaz-isiklari.json'), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === 'bogaz-isiklari.json')) {
  idx.unshift({ file: 'bogaz-isiklari.json', name: 'Boğaz Işıkları — RJ esintisi × hicaz (Claude besteledi)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
