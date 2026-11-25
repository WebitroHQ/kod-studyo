// "Neon Yağmur" — RJ Pasin esintili gitar trap, yeni enstrümanlarla. Elle (AI) bestelendi.
// Çalıştır: node compositions/rj-neon.mjs  →  public/songs/rj-neon.json
// A majör (F#m renkli), 145 BPM yarım tempo. Akorlar: A bölümü  Dmaj7 | E | C#m7 | F#m  (IV–V–iii–vi)
//                                                    B bölümü  F#m | D | A | E          (vi–IV–I–V)
// Kadro: sentez gitar (Karplus-Strong; düzeltilmiş distorsiyon eğrisiyle temiz/crunch), gerçek kayıtlar
// (VSCO 2 CE, CC0): upright piyano, arp, keman ve çello seksiyonu. Trap davul + 808, drop-D breakdown,
// glitch arası (bitcrush'lı pitch-up vokal, ters swell), "video oyunu" hızında lead koşuları.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const kit = (kitName, spec) => Object.assign(makeTrack({ inst: 'multi', ...spec }), { kit: kitName });
// --gercek-gitar: gitarlar Karoryfer Black And Green Guitars (CC0) yeşil Gretsch kayıtlarıyla çalınır
const REALGTR = process.argv.includes('--gercek-gitar');

const T = {
  tap: makeTrack({ preset: 'gtrClean', name: 'Tapping gitar (L/R)', role: 'chords', oct: 4, vol: 0.85, rev: 0.25, dly: 0.12, duck: 0.2,
    params: { drive: 0.25, bright: 0.85, double: 1, cab: 7500, vib: 0 } }),
  lead: makeTrack({ preset: 'gtrLead', name: 'Lead gitar (synth+8va)', vol: 0.95, params: { drive: 0.45, synth: 0.2, oct8: 0.25, vib: 0.5 } }),
  harm: makeTrack({ preset: 'gtrLead', name: 'Lead armoni', role: 'counter', vol: 0.6, pan: -0.4, rev: 0.3, params: { drive: 0.4, synth: 0.1 } }),
  chug: makeTrack({ preset: 'gtrPalm', name: 'Breakdown (L/R)', vol: 0.75, params: { mute: 0.8, drive: 0.95 } }),
  piano: kit('upright', { role: 'chords', name: 'Upright piyano', oct: 4, vol: 0.7, rev: 0.35, params: { release: 0.5, pedal: 1, width: 0.3 } }),
  harp: kit('harp', { role: 'counter', name: 'Arp', oct: 5, vol: 0.6, pan: 0.3, rev: 0.35, params: { release: 1, width: 0.5 } }),
  violins: kit('violins', { role: 'pad', name: 'Keman seksiyonu', oct: 4, vol: 0.3, rev: 0.45, params: { attack: 0.6, release: 1.2, width: 0.4 } }),
  cellos: kit('cellos', { role: 'pad', name: 'Çello seksiyonu', oct: 3, vol: 0.75, rev: 0.35, params: { attack: 0.25, release: 0.8, width: 0 } }),
  kick: makeTrack({ inst: 'kick', role: 'kick', vol: 0.8, params: { tune: 60, punch: 0.85, decay: 0.24, drive: 0.4, click: 0.7 } }),
  snare: makeTrack({ inst: 'snare', role: 'snare', vol: 1.2, rev: 0.1, params: { tone: 210, snap: 0.9, decay: 0.17, drive: 0.35 } }),
  clap: makeTrack({ inst: 'clap', role: 'snare', name: 'Clap katmanı', vol: 0.65, rev: 0.15 }),
  hat: makeTrack({ inst: 'hat', role: 'hat', vol: 0.75, pan: 0.2, params: { decay: 0.03, tone: 9000 } }),
  ohat: makeTrack({ inst: 'openhat', role: 'openhat', name: 'Crash/açık hat', vol: 0.6, pan: -0.2, params: { decay: 0.7 } }),
  b808: makeTrack({ preset: 'b808', name: '808', vol: 0.5, duck: 0.25, params: { drive: 0.7, decay: 1.0, glide: 0.08, punch: 0.6, sub: 0.4, tone: 3200 } }),
  vox: makeTrack({ preset: 'vox', name: 'Pitch-up vokal (crush)', oct: 5, vol: 1.5, crush: 0.3, rev: 0.35, dly: 0.25, params: { vowel: 1, formant: 1.35, vibrato: 0.1, release: 0.12 } }),
  fx: makeTrack({ inst: 'fx', role: 'fx', vol: 0.5, rev: 0.3 }),
};

if (REALGTR) {
  // tapping: iki ayrı kanal (sol/sağ) → insanileştirme her birine farklı mikro zamanlama verir = gerçek double-track
  T.tap = kit('gtrgreen', { role: 'chords', name: 'Gretsch tapping (sol)', oct: 4, vol: 0.55, pan: -0.6, rev: 0.25, dly: 0.1, duck: 0.2, params: { release: 0.3, width: 0 } });
  T.tapR = kit('gtrgreen', { role: 'chords', name: 'Gretsch tapping (sağ)', oct: 4, vol: 0.55, pan: 0.6, rev: 0.25, dly: 0.1, duck: 0.2, params: { release: 0.3, width: 0 } });
  // lead: uzun notalar normal çalım, hızlı koşular staccato
  T.lead = kit('gtrgreen', { role: 'melody', name: 'Gretsch lead', oct: 4, vol: 1.3, pan: 0.08, rev: 0.25, dly: 0.16, duck: 0.15, params: { release: 0.25, width: 0 } });
  T.leadStac = kit('gtrstac', { role: 'melody', name: 'Gretsch lead (staccato koşular)', oct: 4, vol: 2.0, pan: 0.08, rev: 0.2, dly: 0.12, params: { release: 0.08, width: 0 } });
  T.harm = kit('gtrgreen', { role: 'counter', name: 'Gretsch armoni', oct: 4, vol: 0.6, pan: -0.4, rev: 0.3, params: { release: 0.25, width: 0 } });
  T.chugStac = kit('gtrstac', { role: 'riff', name: 'Breakdown atak (staccato)', oct: 2, vol: 0.7, params: { release: 0.05, width: 0 } });
}

const N = (s, n, l = 1, v = 0.9, x = {}) => ({ s, n, l, v, ...x });
const split = (evs) => [evs.filter((e) => e.s < 32), evs.filter((e) => e.s >= 32).map((e) => ({ ...e, s: e.s - 32 }))];
const L = (arr, vs = 1) => arr.map(([s, n, l = 1, g = 0]) => N(s, n, l, (s % 4 === 0 ? 0.95 : 0.8) * vs, g ? { g: 1 } : {}));

// ---------- tapping voicing'leri (kök, 5'li, 9'lu/7'li, 10'lu, 12'li) ----------
const V = {
  Dmaj7: [62, 69, 76, 78, 81], E: [64, 71, 78, 80, 83], Csm: [61, 68, 71, 76, 80], Fsm: [54, 61, 68, 69, 73], D: [62, 69, 76, 78, 81], A: [57, 64, 71, 73, 76],
};
const ORDER = [0, 1, 2, 3, 4, 3, 2, 1];
const tapping = (chords, vs = 1, every = 1) => chords.flatMap((c, bar) => {
  const out = [];
  for (let h = 0; h < 16; h += every) out.push(N(bar * 16 + h, V[c][ORDER[h % 8]], every, (h % 4 === 0 ? 0.9 : 0.7) * vs));
  return out;
});
// piyano blok akorları (kök + üçlü + yedili, sol el bas)
const PIANO = { Dmaj7: [50, 57, 61, 66], E: [52, 59, 64, 68], Csm: [49, 56, 59, 64], Fsm: [42, 57, 61, 64], D: [50, 57, 62, 66], A: [45, 57, 61, 64] };
const pianoBlocks = (chords, v = 0.6, beats = [0]) => chords.flatMap((c, bar) => beats.flatMap((b) => PIANO[c].map((n) => N(bar * 16 + b, n, 16 - b, v))));
// yaylılar: akorun üst üç notası, uzun
const strings = (chords, v = 0.6) => chords.flatMap((c, bar) => PIANO[c].slice(1).map((n) => N(bar * 16, n + 12, 16, v)));

// ---------- lead riffleri ----------
const LEAD_A = [
  [0, 81], [1, 78], [2, 76], [3, 74], [4, 73, 2], [6, 74], [7, 76], [8, 78, 3, 1], [11, 76], [12, 74, 2], [14, 73, 2],
  [16, 80, 2], [18, 78], [19, 76], [20, 71], [21, 76], [22, 78, 2], [24, 80], [25, 81], [26, 83, 3, 1], [29, 80], [30, 78, 2],
  [32, 76, 2], [34, 73], [35, 68], [36, 73], [37, 76], [38, 80, 2], [40, 78, 3, 1], [43, 76], [44, 73, 2], [46, 71, 2],
  [48, 73], [49, 76], [50, 78], [51, 81], [52, 85, 3, 1], [55, 83], [56, 81], [57, 80], [58, 78], [59, 76], [60, 73, 2], [62, 78, 2, 1],
];
const LEAD_B = [
  [0, 90, 2], [2, 88], [3, 85], [4, 81, 2], [6, 83], [7, 85], [8, 88, 3, 1], [11, 85], [12, 83, 2], [14, 81, 2],
  [16, 86, 2], [18, 81], [19, 78], [20, 81], [21, 86], [22, 90, 2, 1], [24, 88, 3], [27, 86], [28, 85, 2], [30, 81, 2],
  [32, 85, 2], [34, 88], [35, 93], [36, 92], [37, 88], [38, 85, 2], [40, 88, 3, 1], [43, 85], [44, 81, 2], [46, 76, 2],
  [48, 80], [49, 81], [50, 83], [51, 85], [52, 83], [53, 80], [54, 76], [55, 71], [56, 76, 4], [60, 78], [61, 80], [62, 81], [63, 83],
];
// A majörde diyatonik alt üçlü
function thirdBelow(n) {
  const pcs = [9, 11, 1, 2, 4, 6, 8];
  const pc = ((n % 12) + 12) % 12, i = pcs.indexOf(pc);
  if (i < 0) return n - 3;
  let d = pc - pcs[(i + 5) % 7]; if (d <= 0) d += 12;
  return n - d;
}
const harmony = (riff) => riff.filter(([s, , l = 1]) => l >= 2 || s % 4 === 0).map(([s, n, l = 1, g = 0]) => [s, thirdBelow(n), l, g]);

// ---------- 808 + davullar ----------
const KB = [[0, 7, 10], [0, 6, 10, 11], [0, 7, 10, 13], [0, 6, 9, 12]];
const R808 = { Dmaj7: 26, E: 28, Csm: 25, Fsm: 30, D: 26, A: 33 };
const bass808 = (chords) => chords.flatMap((c, bar) => KB[bar].map((k, i, ks) => {
  const next = i + 1 < ks.length ? ks[i + 1] : 16;
  const ev = N(bar * 16 + k, R808[c], next - k, 0.95);
  if (i === ks.length - 1 && bar % 2 === 1) { ev.n += 12; ev.g = 1; }
  if (i === 0 && bar > 0) ev.g = 1;
  return ev;
}));
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

// ---------- breakdown (F# palm-mute, b2 ve tritone gerilimi) ----------
function breakdown() {
  const HITS = [0, 3, 6, 8, 11, 14], chug = [], kk = [], b8 = [], cello = [];
  for (let bar = 0; bar < 4; bar++) {
    for (const s of HITS) {
      let n = 42; // F#2
      if (bar === 3 && s >= 8) n = s === 8 ? 48 : s === 11 ? 43 : 42; // C (tritone), G (b2)
      if (bar === 1 && s === 14) n = 45;
      chug.push(N(bar * 16 + s, n, s === 0 ? 3 : 1, s === 0 ? 1 : 0.85));
      kk.push(N(bar * 16 + s, 60, 1, s === 0 ? 1 : 0.85));
    }
    b8.push(N(bar * 16, 30, 6, 0.95), N(bar * 16 + 8, 30, 6, 0.9));
    cello.push(N(bar * 16, bar === 3 ? 43 : 42, 16, 0.8)); // çello pedalı (F#2, son ölçüde G2)
  }
  return {
    chug, kick: kk, b808: b8, cellos: cello,
    snare: [8, 24, 40, 56].map((s) => N(s, 60, 1, 1)), clap: [8, 24, 40, 56].map((s) => N(s, 60, 1, 0.9)),
    ohat: [0, 16, 32, 48].map((s) => N(s, 60, 1, 0.8)), hat: [4, 12, 20, 28, 36, 44, 52, 60].map((s) => N(s, 60, 1, 0.55)),
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
const A = ['Dmaj7', 'E', 'Csm', 'Fsm'], B = ['Fsm', 'D', 'A', 'E'];

// Intro: upright piyano + arp arpejleri, ikinci yarıda tapping gitar girer; sonda ters gitar swell'i
addPair('I', 'intro', {
  piano: pianoBlocks(A, 0.55), harp: tapping(A, 0.7, 2).map((e) => ({ ...e, n: e.n + 12, l: 4 })),
  tap: tapping(A, 0.75).filter((e) => e.s >= 32),
  lead: [N(56, 81, 8, 0.9, { rv: 1 })], hat: hats().filter((e) => e.s >= 48).map((e) => ({ ...e, v: e.v * 0.6 })),
  fx: [N(48, 60, 16, 0.8)],
});
// Drop A
addPair('A', 'drop', {
  tap: tapping(A, 0.8), lead: L(LEAD_A), piano: pianoBlocks(A, 0.45), kick: kick(), snare: snare(), clap: clap(), hat: hats(), b808: bass808(A),
  ohat: [N(0, 60, 1, 0.7)], fx: [N(0, 62, 1, 0.8)],
});
// Breakdown
addPair('K', 'verse', breakdown());
// Glitch arası
patterns.S1 = Object.fromEntries(Object.values(ids).map((id) => [id, []]));
Object.assign(patterns.S1, {
  [ids.vox]: [N(0, 81, 1, 0.85, { r: 2 }), N(2, 85, 1), N(4, 78, 2, 0.85, { g: 1 }), N(8, 81, 1, 0.8, { r: 3 }), N(12, 76, 2),
    N(16, 83, 1, 0.85, { r: 2 }), N(18, 88, 1), N(20, 81, 2, 0.85, { g: 1 }), N(24, 81, 1, 0.8, { r: 4 })],
  [ids.tap]: tapping(['Fsm', 'D'], 0.7, 2).filter((e) => e.s % 8 < 4),
  [ids.harp]: [N(0, 85, 8, 0.7), N(16, 86, 8, 0.7)],
  [ids.lead]: [N(10, 85, 1, 0.85, { r: 3 }), N(14, 88, 2, 0.9, { g: 1 }), N(24, 88, 8, 0.9, { rv: 1 })],
  [ids.kick]: [N(0, 60), N(19, 60, 1, 0.8)],
  [ids.snare]: [N(16, 60), N(28, 60, 1, 0.8, { r: 2 }), N(29, 60, 1, 0.85, { r: 3 }), N(30, 60, 1, 0.9, { r: 4 }), N(31, 60, 1, 1, { r: 4 })],
  [ids.hat]: [0, 4, 8, 12, 16, 20].map((s) => N(s, 60, 1, 0.6)).concat([N(24, 60, 1, 0.7, { r: 4 }), N(26, 60, 1, 0.75, { r: 4 })]),
  [ids.b808]: [N(0, 30, 14), N(16, 26, 12, 0.9, { g: 1 })],
  [ids.fx]: [N(16, 60, 16, 0.85)],
});
patternMeta.S1 = { type: 'break', name: 'S1' };
// Drop B: yüksek lead + armoni, keman seksiyonu şişer, arp pırıltısı, yoğun hat
addPair('B', 'drop2', {
  tap: tapping(B, 0.75), lead: L(LEAD_B), harm: L(harmony(LEAD_B), 0.75), violins: strings(B, 0.6),
  harp: tapping(B, 0.6, 2).map((e) => ({ ...e, n: e.n + 12, l: 3 })),
  kick: kick(), snare: snare(true), clap: clap(), hat: hats(true), b808: bass808(B), ohat: [N(0, 60, 1, 0.75)],
  vox: [N(14, 86, 2, 0.6, { g: 1 }), N(46, 88, 2, 0.6, { g: 1 })], fx: [N(0, 62, 1, 0.8)],
});
// Outro: piyano + arp, tapping söner, son akor çınlar (Dmaj7'de çözülmeden)
addPair('O', 'outro', {
  piano: pianoBlocks(['Dmaj7', 'E', 'Csm'], 0.5).concat(PIANO.Dmaj7.map((n) => N(48, n, 16, 0.5))),
  harp: tapping(['Dmaj7', 'E', 'Csm', 'Dmaj7'], 0.55, 2).map((e) => ({ ...e, n: e.n + 12, l: 4 })),
  tap: tapping(['Dmaj7', 'E'], 0.6),
  lead: L(LEAD_A.filter(([s]) => s < 16), 0.7).concat([N(48, 78, 14, 0.8)]),
  fx: [N(48, 61, 16, 0.6)],
});

if (REALGTR) {
  for (const pat of Object.values(patterns)) {
    const lead = pat[ids.lead] || [];
    pat[ids.leadStac] = lead.filter((e) => (e.l || 1) === 1 && !e.rv && !e.g);
    pat[ids.lead] = lead.filter((e) => (e.l || 1) > 1 || e.rv || e.g);
    pat[ids.tapR] = (pat[ids.tap] || []).map((e) => ({ ...e, v: +(e.v * 0.95).toFixed(2) }));
    pat[ids.chugStac] = (pat[ids.chug] || []).map((e) => ({ ...e, l: 1, v: +(e.v * 0.9).toFixed(2) }));
  }
}

const arrangement = [
  ['Intro (piyano + arp)', 'I1'], ['Intro → swell', 'I2'],
  ['Drop', 'A1'], ['Drop', 'A2'], ['Drop', 'A1'], ['Drop', 'A2'],
  ['Breakdown', 'K1'], ['Breakdown', 'K2'],
  ['Glitch', 'S1'],
  ['Drop B', 'B1'], ['Drop B', 'B2'], ['Drop B', 'B1'], ['Drop B', 'B2'],
  ['Drop', 'A1'], ['Drop', 'A2'],
  ['Outro', 'O1'], ['Outro', 'O2'],
].map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'Neon Yağmur (RJ esintisi, yeni enstrümanlar)',
  bpm: 145, swing: 0, humanize: 4, root: 'A', scale: 'major',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 1, high: 1.5, drive: 0.3, glue: 0.5, makeup: 5, ceiling: -0.5, reverb: 1.8, damp: 0.45 },
  meta: { genre: 'rj_emo', seed: 'neon-yagmur', prog: [3, 4, 2, 5], target: -9.5, composedBy: 'Claude (elle besteleme)' },
};

const dir = path.join(ROOT, 'public', 'songs');
const OUT = REALGTR ? 'rj-neon-gitar.json' : 'rj-neon.json';
if (REALGTR) { song.name = 'Neon Yağmur — gerçek Gretsch gitarlı'; song.humanize = 6; }
fs.writeFileSync(path.join(dir, OUT), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === OUT)) {
  idx.unshift({ file: OUT, name: REALGTR ? 'Neon Yağmur — gerçek Gretsch gitar + piyano/arp/yaylılar (Claude besteledi)' : 'Neon Yağmur — RJ esintisi, gerçek piyano/arp/yaylılar (Claude besteledi)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
