// "Sakin Oda" — çalışırken / kod yazarken arka planda dinlenecek sakin müzik.
// Minecraft (C418) havası: seyrek, yumuşak piyano, majör7 akorlar, bol reverb, sıcak pad, ara ara bell pırıltısı.
// Davul yok, tempo yavaş, melodi dikkat çekmeyecek kadar seyrek. F majör, 70 BPM, ~2.5 dk.
// Çalıştır: node compositions/sakin-calisma.mjs  →  public/songs/sakin-calisma.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const T = {
  piano: makeTrack({ inst: 'piano', role: 'chords', name: 'Piyano', oct: 4, vol: 0.7, rev: 0.45, dly: 0.08, params: { tone: 0.15, decay: 4, trem: 0 } }),
  melody: makeTrack({ inst: 'piano', role: 'melody', name: 'Piyano (melodi)', oct: 5, vol: 0.85, pan: 0.1, rev: 0.5, dly: 0.12, params: { tone: 0.2, decay: 4, trem: 0 } }),
  pad: makeTrack({ inst: 'pad', role: 'pad', name: 'Sıcak pad', oct: 4, vol: 0.35, rev: 0.6, params: { cutoff: 900, attack: 1.5, release: 2.5, detune: 10 } }),
  drone: makeTrack({ inst: 'pad', role: 'bass', name: 'Alçak drone', oct: 2, vol: 0.45, rev: 0.3, params: { cutoff: 350, attack: 2, release: 2.5, detune: 6 } }),
  bell: makeTrack({ inst: 'bell', role: 'counter', name: 'Pırıltı', oct: 6, vol: 0.45, pan: -0.25, rev: 0.6, dly: 0.3, params: { ratio: 2, index: 1.2, decay: 3 } }),
  strings: makeTrack({ inst: 'strings', role: 'pad', name: 'Yaylılar', oct: 4, vol: 0.4, rev: 0.5, params: { attack: 1.2, release: 1.8, bright: 1800, vib: 0.3 } }),
  flute: makeTrack({ inst: 'flute', role: 'counter', name: 'Flüt', oct: 5, vol: 0.35, pan: 0.2, rev: 0.5, params: { breath: 0.25, vib: 0.4, attack: 0.12, release: 0.5 } }),
};

// hafif insan dokunuşu: aynı adımda hep aynı ama adımdan adıma değişen küçük hız farkları
const hum = (s) => 0.9 + 0.1 * (((s * 7) % 5) / 5);
const N = (s, n, l = 1, v = 0.6) => ({ s, n, l, v: +(v * hum(s)).toFixed(2) });
const split = (evs) => [evs.filter((e) => e.s < 32), evs.filter((e) => e.s >= 32).map((e) => ({ ...e, s: e.s - 32 }))];

// ---------- akorlar (sol el: kök, 5'li, 10'lu, 7'li) ----------
const CH = {
  Fmaj7: { bass: 41, lh: [41, 48, 57, 64], pad: [57, 60, 64], hi: [84, 88, 91, 93] },
  Am7: { bass: 45, lh: [45, 52, 60, 55], pad: [55, 60, 64], hi: [88, 91, 84] },
  Dm7: { bass: 38, lh: [38, 45, 53, 60], pad: [57, 60, 65], hi: [86, 89, 93] },
  Bbmaj7: { bass: 46, lh: [46, 53, 62, 57], pad: [57, 62, 65], hi: [86, 89, 93] },
  Csus: { bass: 48, lh: [48, 55, 65, 64], pad: [55, 60, 65], hi: [84, 91] },
  CmajE: { bass: 40, lh: [40, 48, 55, 59], pad: [55, 59, 64], hi: [84, 88] },
};
// sol el: çeyrek nota yavaş arpej
const leftHand = (chords, v = 0.55) => chords.flatMap((c, bar) => CH[c].lh.map((n, i) => N(bar * 16 + i * 4, n, 16 - i * 4, v)));
// seyrek sol el (nefes bölümü): sadece kök + 10'lu
const leftSparse = (chords) => chords.flatMap((c, bar) => [N(bar * 16, CH[c].lh[0], 16, 0.5), N(bar * 16 + 8, CH[c].lh[2], 8, 0.45)]);
const pad = (chords, v = 0.5) => chords.flatMap((c, bar) => CH[c].pad.map((n) => N(bar * 16, n, 16, v)));
const drone = (chords) => chords.map((c, bar) => N(bar * 16, CH[c].bass, 16, 0.55));
const strings = (chords) => chords.flatMap((c, bar) => CH[c].pad.map((n) => N(bar * 16, n, 16, 0.55)));
// bell: her ölçüde bir, farklı vuruşlarda
const BELL_AT = [10, 6, 14, 2];
const bells = (chords, every = 1) => chords.flatMap((c, bar) => (bar % every ? [] : [N(bar * 16 + BELL_AT[bar % 4], CH[c].hi[bar % CH[c].hi.length], 8, 0.4)]));

// ---------- melodiler (sağ el, seyrek) ----------
const M = (arr, v = 0.6) => arr.map(([s, n, l]) => N(s, n, l, v));
const MEL_A = M([[6, 72, 6], [12, 76, 4], [18, 79, 6], [24, 76, 8], [32, 77, 4], [36, 76, 2], [38, 74, 6], [44, 72, 4], [48, 74, 4], [52, 69, 12]]);
const MEL_A2 = M([[6, 72, 6], [12, 76, 4], [18, 79, 6], [24, 76, 8], [32, 81, 6], [38, 79, 2], [40, 77, 8], [48, 76, 4], [52, 77, 12]]);
const MEL_B = M([[2, 81, 2], [4, 79, 2], [6, 76, 6], [12, 72, 4], [16, 76, 6], [22, 79, 2], [24, 81, 8], [32, 77, 6], [38, 74, 2], [40, 72, 8], [48, 72, 4], [52, 77, 4], [56, 76, 8]]);

const A = ['Fmaj7', 'Am7', 'Dm7', 'Bbmaj7'];
const B = ['Fmaj7', 'Am7', 'Bbmaj7', 'Csus'];
const C = ['Dm7', 'Bbmaj7', 'Fmaj7', 'CmajE'];

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

// Giriş: pad + drone, birkaç yüksek piyano notası
addPair('I', 'intro', {
  pad: pad(A, 0.45), drone: drone(A),
  melody: M([[8, 84, 8], [28, 88, 8], [44, 86, 8], [60, 81, 4]], 0.4),
});
// A: sol el arpej + seyrek melodi
addPair('A', 'verse', { piano: leftHand(A), melody: MEL_A, pad: pad(A, 0.4), drone: drone(A), bell: bells(A, 2) });
// A tekrarı: melodinin ikinci yarısı değişiyor
addPair('Q', 'verse', { piano: leftHand(A), melody: MEL_A2, pad: pad(A, 0.4), drone: drone(A), bell: bells(A, 2) });
// B: yeni ilerleme, bell'ler her ölçüde
addPair('B', 'drop', { piano: leftHand(B, 0.58), melody: MEL_B, pad: pad(B, 0.45), drone: drone(B), bell: bells(B) });
// C: nefes — melodi yok, yaylılar şişer
addPair('C', 'break', { piano: leftSparse(C), strings: strings(C), drone: drone(C), bell: [N(10, 88, 8, 0.35), N(42, 84, 8, 0.35)] });
// A' (flüt eşlik eder)
addPair('F', 'drop2', { piano: leftHand(A), melody: MEL_A2, flute: MEL_A2.map((e) => ({ ...e, v: 0.45 })), pad: pad(A, 0.4), drone: drone(A), strings: strings(A).map((e) => ({ ...e, v: 0.35 })) });
// Kapanış: yavaş arpej, son akor uzun çınlar
addPair('O', 'outro', {
  piano: leftHand(['Fmaj7', 'Bbmaj7'], 0.5).concat([41, 48, 57, 64, 67].map((n, i) => N(32 + i, n, 32 - i, 0.5))),
  melody: M([[8, 76, 8], [24, 77, 8], [36, 79, 28]], 0.45),
  pad: pad(['Fmaj7', 'Bbmaj7', 'Fmaj7', 'Fmaj7'], 0.4), drone: drone(['Fmaj7', 'Bbmaj7', 'Fmaj7', 'Fmaj7']),
  bell: [N(58, 93, 6, 0.3)],
});

const seq = [
  ['Giriş', 'I1'], ['Giriş', 'I2'],
  ['A', 'A1'], ['A', 'A2'], ['A', 'Q1'], ['A', 'Q2'],
  ['B', 'B1'], ['B', 'B2'], ['B', 'B1'], ['B', 'B2'],
  ['Nefes', 'C1'], ['Nefes', 'C2'],
  ['A (flüt)', 'F1'], ['A (flüt)', 'F2'], ['A', 'A1'], ['A', 'A2'],
  ['B', 'B1'], ['B', 'B2'],
  ['Kapanış', 'O1'], ['Kapanış', 'O2'],
];
const arrangement = seq.map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'Sakin Oda (çalışırken dinlemelik)',
  bpm: 70, swing: 0, root: 'F', scale: 'major',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 0, high: -1.5, drive: 0, glue: 0.2, makeup: 6, ceiling: -1, reverb: 3.2 },
  meta: { genre: 'ambient', seed: 'sakin-oda', prog: [0, 2, 1, 3], target: -16, composedBy: 'Claude (elle besteleme)' },
};

const dir = path.join(ROOT, 'public', 'songs');
fs.writeFileSync(path.join(dir, 'sakin-calisma.json'), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === 'sakin-calisma.json')) {
  idx.unshift({ file: 'sakin-calisma.json', name: 'Sakin Oda — çalışırken dinlemelik, Minecraft havası (Claude besteledi)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
