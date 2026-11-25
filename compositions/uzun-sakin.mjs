// "Uzun Sakin Oda" — çalışırken / kod yazarken uzun süre arkada çalacak, kendini tekrar etmeyen sakin müzik.
// Çalıştır: node compositions/uzun-sakin.mjs [seed]  →  public/songs/uzun-sakin.json
//
// Yöntem:
//  - Brian Eno "Music for Airports": farklı uzunluktaki döngüler (23, 29, 37, 41 adım) birbirine bölünmediği için
//    aynı birleşim parça boyunca neredeyse hiç tekrar etmez. Döngü notaları D majör pentatoniktir
//    (D E F# A B) → hangi akorun üstüne düşerse düşsün çatışmaz.
//  - C418/Minecraft havası: keçeli piyano, seyrek melodi, maj7/9 akorlar, uzun reverb, hafif bant sıcaklığı.
//  - Akorlar 2 ölçüde bir, yumuşak geçiş tablosuyla (Markov) seçilir; yoğunluk eğrisi parçayı nefes aldırır.
//  - Seed ile tekrarlanabilir: aynı seed aynı parçayı verir, farklı seed yeni bir parça.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';
import { makeRng } from '../public/js/theory.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEED = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'uzun-sakin-1';
// --gercek: sentez yerine gerçek kayıtlar (VSCO 2 CE, CC0): upright piyano, keman/çello seksiyonu, arp, flüt
const REAL = process.argv.includes('--gercek');
const rng = makeRng(SEED);

const BPM = 72, PATS = 72, STEPS = 32;          // 72 desen × 2 ölçü ≈ 8 dk
const TOTAL = PATS * STEPS;

const T = {
  bass: makeTrack({ inst: 'felt', role: 'bass', name: 'Piyano (bas)', oct: 2, vol: 0.75, rev: 0.35, params: { felt: 0.8, sustain: 1.3, hammer: 0.2 } }),
  chords: makeTrack({ inst: 'felt', role: 'chords', name: 'Piyano (akor)', oct: 3, vol: 0.7, rev: 0.45, params: { felt: 0.75, sustain: 1.1, hammer: 0.25 } }),
  loops: makeTrack({ inst: 'felt', role: 'counter', name: 'Piyano (Eno döngüleri)', oct: 5, vol: 0.62, rev: 0.6, dly: 0.12, params: { felt: 0.7, sustain: 1.2, hammer: 0.3, width: 0.8 } }),
  melody: makeTrack({ inst: 'felt', role: 'melody', name: 'Piyano (melodi)', oct: 5, vol: 0.85, rev: 0.5, dly: 0.1, params: { felt: 0.6, sustain: 1, hammer: 0.35 } }),
  pad: makeTrack({ inst: 'pad', role: 'pad', name: 'Sıcak pad', oct: 4, vol: 0.28, rev: 0.6, params: { cutoff: 850, attack: 2.5, release: 3, detune: 9 } }),
  bell: makeTrack({ inst: 'bell', role: 'counter', name: 'Uzak çan', oct: 6, vol: 0.5, pan: -0.3, rev: 0.7, dly: 0.3, params: { ratio: 2, index: 1, decay: 3.5 } }),
  strings: makeTrack({ inst: 'strings', role: 'pad', name: 'Yaylılar', oct: 4, vol: 0.25, rev: 0.6, params: { attack: 2, release: 2.5, bright: 1500, vib: 0.25 } }),
  flute: makeTrack({ inst: 'flute', role: 'counter', name: 'Flüt (yankı)', oct: 5, vol: 0.28, pan: 0.25, rev: 0.6, dly: 0.2, params: { breath: 0.3, vib: 0.35, attack: 0.2, release: 0.8 } }),
};

if (REAL) {
  const kitTrack = (old, kit, params) => Object.assign(makeTrack({ inst: 'multi', role: old.role, name: old.name, oct: old.oct, vol: old.vol, pan: old.pan, rev: old.rev, dly: old.dly, params }), { kit });
  T.bass = kitTrack({ ...T.bass, vol: 0.55 }, 'upright', { release: 0.6, pedal: 1, width: 0 });
  T.chords = kitTrack(T.chords, 'upright', { release: 0.5, pedal: 1, width: 0.3, tone: 9000 });
  T.loops = kitTrack({ ...T.loops, vol: 1.0 }, 'upright', { release: 0.5, pedal: 1, width: 0.7, tone: 10000 });
  T.melody = kitTrack({ ...T.melody, vol: 1.0 }, 'upright', { release: 0.45, pedal: 1, width: 0.3 });
  T.strings = kitTrack({ ...T.strings, vol: 0.25 }, 'violins', { attack: 1.2, release: 1.8, width: 0.4 });
  T.flute = kitTrack({ ...T.flute, vol: 0.5 }, 'flute', { attack: 0.12, release: 0.6, width: 0 });
  T.bell = kitTrack({ ...T.bell, name: 'Arp', vol: 0.55 }, 'harp', { release: 1.5, width: 0.5 });
  T.cello = makeTrack({ inst: 'multi', role: 'pad', name: 'Çello seksiyonu', oct: 3, vol: 0.9, rev: 0.5, params: { attack: 1.5, release: 2, width: 0 } });
  T.cello.kit = 'cellos';
}

// ---------- akorlar ----------
// bas (oktav 2), sol el voicing (oktav 3–4), pad notaları
const CH = {
  D: { bass: 38, voice: [50, 57, 64, 66], pad: [62, 66, 69] },       // Dmaj9 (D A E F#)
  Bm: { bass: 47, voice: [54, 57, 62, 66], pad: [62, 66, 69] },      // Bm7
  G: { bass: 43, voice: [50, 54, 59, 62], pad: [59, 62, 66] },       // Gmaj7
  Em: { bass: 40, voice: [47, 50, 55, 62], pad: [59, 62, 67] },      // Em9-ish (E B D G)
  A: { bass: 45, voice: [52, 57, 59, 64], pad: [57, 61, 64] },       // Asus2 → A
  Fsm: { bass: 42, voice: [49, 52, 57, 61], pad: [57, 61, 64] },     // F#m7
};
const NEXT = {
  D: [['G', 3], ['Bm', 3], ['Em', 1], ['A', 1]],
  Bm: [['G', 3], ['Em', 2], ['D', 1], ['Fsm', 1]],
  G: [['D', 3], ['Em', 2], ['A', 2], ['Bm', 1]],
  Em: [['A', 3], ['G', 2], ['Bm', 1]],
  A: [['D', 3], ['Bm', 2], ['G', 1]],
  Fsm: [['G', 3], ['Bm', 2]],
};
const chords = ['D'];
for (let i = 1; i < PATS; i++) chords.push(rng.weighted(NEXT[chords[i - 1]]));
chords[PATS - 1] = 'D'; if (chords[PATS - 2] === 'D') chords[PATS - 2] = 'G';

// ---------- yoğunluk eğrisi (9 bölüm × 8 desen) ----------
const ARC = [0.2, 0.35, 0.5, 0.65, 0.82, 0.55, 0.75, 0.45, 0.2];
const intensity = (p) => ARC[Math.min(ARC.length - 1, Math.floor((p / PATS) * ARC.length))];

// ---------- olayları mutlak adımlarla topla ----------
const ev = Object.fromEntries(Object.keys(T).map((k) => [k, []]));
if (!ev.cello) ev.cello = [];
const N = (g, n, l, v, x = {}) => ({ g, n, l, v: +v.toFixed(2), ...x });
const hum = (g) => 0.9 + 0.1 * (((g * 7919) % 13) / 13);

for (let p = 0; p < PATS; p++) {
  const g0 = p * STEPS, c = CH[chords[p]], I = intensity(p);
  // bas: akorun kökü, uzun
  if (I >= 0.3 || p % 2 === 0) ev.bass.push(N(g0, c.bass, 32, 0.45 * hum(g0)));
  // sol el: düşük yoğunlukta blok akor, yüksekte yavaş arpej
  if (I < 0.45) c.voice.forEach((n, i) => ev.chords.push(N(g0 + i, n, 31 - i, 0.32)));
  else c.voice.forEach((n, i) => { ev.chords.push(N(g0 + i * 4, n, 28 - i * 4, 0.38 * hum(g0 + i))); ev.chords.push(N(g0 + 16 + i * 4, n, 16 - i * 4, 0.3 * hum(g0 + 16 + i))); });
  // pad
  if (I >= 0.3) c.pad.forEach((n) => ev.pad.push(N(g0, n, 32, 0.5)));
  // yaylılar: yoğun bölümlerde şişer
  if (I >= 0.6) c.pad.forEach((n) => ev.strings.push(N(g0, REAL ? n : n - 12, 32, 0.5)));
  if (REAL && I >= 0.5) ev.cello.push(N(g0, c.bass + 12, 32, 0.45));
}

// Eno döngüleri: [uzunluk (adım), [ofset, nota], eşik]
const LOOPS = [
  [23, [[0, 78], [11, 81]], 0.3],   // F#5, A5
  [29, [[0, 86]], 0.5],              // D6
  [37, [[0, 83], [17, 76]], 0.62],   // B5, E5
];
for (const [len, notes, th] of LOOPS) {
  for (let start = 0; start < TOTAL; start += len) {
    if (intensity(Math.floor(start / STEPS)) < th) continue;
    for (const [off, n] of notes) {
      const g = start + off;
      if (g < TOTAL - 8) ev.loops.push(N(g, n, 12, 0.36 * hum(g)));
    }
  }
}
// uzak çan: 41 adımlık döngü
for (let g = 13; g < TOTAL - 16; g += 41) if (intensity(Math.floor(g / STEPS)) >= 0.5) ev.bell.push(N(g, rng.pick([93, 90, 86]), 16, 0.32));

// ---------- melodi: motif hafızalı seyrek cümleler ----------
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83]; // D4..B5 pentatonik
const nearestIdx = (n) => PENTA.reduce((b, x, i) => (Math.abs(x - n) < Math.abs(PENTA[b] - n) ? i : b), 0);
function makeMotif() {
  const rhythm = rng.pick([[0, 6, 12, 18, 24], [0, 4, 10, 16, 22, 28], [2, 8, 12, 20, 26], [0, 6, 8, 14, 24]]);
  let idx = rng.int(4, 7);
  return rhythm.map((s, i) => {
    if (i > 0) idx = Math.max(0, Math.min(PENTA.length - 1, idx + rng.pick([-2, -1, -1, 1, 1, 2, 0])));
    return [s, idx];
  });
}
let motif = makeMotif();
for (let p = 2; p < PATS - 2; p += 2) {
  const I = intensity(p);
  if (I < 0.45 || !rng.chance(0.55 + I * 0.3)) continue;
  if (rng.chance(0.25)) motif = makeMotif();                      // ara ara yeni fikir
  const shift = rng.pick([0, 0, 1, -1, 2]);                        // motifi pentatonikte kaydır
  const g0 = p * STEPS;
  const ph = motif.map(([s, idx], i) => {
    const k = Math.max(0, Math.min(PENTA.length - 1, idx + shift));
    const last = i === motif.length - 1;
    return N(g0 + s, PENTA[k], last ? 20 : 6, (0.5 + (s % 8 === 0 ? 0.08 : 0)) * hum(g0 + s));
  });
  ev.melody.push(...ph);
  // akorun çok dışına düşen uzun son notayı akor tonuna çek
  const lastN = ph[ph.length - 1];
  const ct = CH[chords[p]].pad;
  if (!ct.some((x) => (x - lastN.n) % 12 === 0)) lastN.n = PENTA[nearestIdx(ct[1] + 12)];
  // yoğun bölümde flüt, cümlenin yankısını bir sonraki ölçüde çalar
  if (I >= 0.7 && rng.chance(0.6)) ev.flute.push(...ph.slice(0, 3).map((e) => ({ ...e, g: e.g + 16, v: 0.4, l: 5 })));
}

// ---------- desenlere böl ----------
const ids = Object.fromEntries(Object.entries(T).map(([k, t]) => [k, t.id]));
const patterns = {}, patternMeta = {};
const SECTION_NAMES = ['Uyanış', 'Sabah', 'Akış', 'Derinlik', 'Doruk', 'Nefes', 'İkinci dalga', 'Dinginlik', 'Kapanış'];
const arrangement = [];
for (let p = 0; p < PATS; p++) {
  const pid = 'P' + (p + 1);
  patterns[pid] = Object.fromEntries(Object.values(ids).map((id) => [id, []]));
  patternMeta[pid] = { type: 'drop', name: pid };
  arrangement.push({ name: `${SECTION_NAMES[Math.min(8, Math.floor((p / PATS) * 9))]} · ${chords[p].replace('Fsm', 'F#m')}`, pattern: pid, reps: 1 });
}
for (const [k, list] of Object.entries(ev)) {
  for (const e of list) {
    const p = Math.floor(e.g / STEPS);
    if (p >= PATS) continue;
    patterns['P' + (p + 1)][ids[k]].push({ s: e.g % STEPS, n: e.n, l: e.l, v: e.v, ...(e.g2 ? {} : {}) });
  }
}
for (const pat of Object.values(patterns)) for (const evs of Object.values(pat)) evs.sort((a, b) => a.s - b.s);

const song = {
  name: 'Uzun Sakin Oda (~8 dk, tekrar etmeyen)',
  bpm: BPM, swing: 0, humanize: 8, root: 'D', scale: 'major',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 0, high: 1, drive: 0.05, glue: 0.2, makeup: 6, ceiling: -1, reverb: 4.5, damp: 0.45, wow: 0.2, noise: 0.12 },
  meta: { genre: 'ambient', seed: SEED, prog: [0, 3, 5, 4], target: -16, composedBy: 'Claude (Eno döngüleri + motif hafızası)' },
};

const dir = path.join(ROOT, 'public', 'songs');
const OUT = REAL ? 'uzun-sakin-gercek.json' : 'uzun-sakin.json';
if (REAL) song.name = 'Uzun Sakin Oda — gerçek enstrümanlar (~8 dk)';
fs.writeFileSync(path.join(dir, OUT), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === OUT)) {
  idx.unshift({ file: OUT, name: REAL ? 'Uzun Sakin Oda — gerçek enstrümanlar (upright piyano, yaylılar, arp), ~8 dk' : 'Uzun Sakin Oda — ~8 dk, kendini tekrar etmeyen çalışma müziği (Claude)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(ev).reduce((a, l) => a + l.length, 0);
console.log(`yazıldı: ${song.name} — ${PATS} desen, ${count} nota, ${(TOTAL * 60 / BPM / 4 / 60).toFixed(1)} dk · akorlar: ${chords.slice(0, 12).join(' ')} …`);
