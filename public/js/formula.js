// Formül sekmesi: matematiksel ifadelerden şarkı. Her bölüm x ∈ [−4.25, 4.25] aralığını süresi boyunca tarar;
// her ses örneği için ortak tanımlar + ses ifadeleri hesaplanır, ifade y (oktav, y = 0 → E4) döndürür,
// REST (ya da null) döndürürse o an susulur. Matharium videosundaki 5 bölüm hazır preset olarak gelir.

import { encodeWav } from './wav.js';

const SR = 44100;
const F_REF = 329.63; // y = 0 → E4 (videonun sesiyle doğrulandı)
const C0 = -0.33496;

// ---------- ifade yardımcıları ----------
const REST = NaN;
const HELPERS = {
  floor: Math.floor, round: Math.round, abs: Math.abs, min: Math.min, max: Math.max, exp: Math.exp,
  sin: Math.sin, cos: Math.cos, log2: Math.log2, PI: Math.PI, REST,
  mod: (a, b) => ((a % b) + b) % b,
  frac: (a) => a - Math.floor(a),
  digit: (N, base, i) => Math.floor(N / Math.pow(base, i)) % base,          // N'nin base tabanındaki i. rakamı
  seg: (p, list) => { for (const [m, a, b] of list) if (p >= a && p < b) return m; return null; }, // [nota, başlangıç, bitiş)
  note: (m) => (m == null || Number.isNaN(m) ? NaN : C0 + (m - 72) / 12),     // videodaki y = −0.33496 + (m−72)/12
  midi: (m) => (m == null ? NaN : (m - 64) / 12),                             // gerçek MIDI notası → y
};
const HKEYS = Object.keys(HELPERS);

// Tını: matharium'dan ölçülen harmonikler ve klasik dalgalar
export const TIMBRES = {
  matharium: { label: 'Matharium (ölçülen)', h: [1, 0.84, 0.49, 0.37, 0.18, 0.11, 0.07, 0.05] },
  sine: { label: 'Sinüs', h: [1] },
  square: { label: 'Kare', h: [1, 0, 1 / 3, 0, 1 / 5, 0, 1 / 7, 0, 1 / 9] },
  saw: { label: 'Testere', h: [1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7, 1 / 8] },
  triangle: { label: 'Üçgen', h: [1, 0, -1 / 9, 0, 1 / 25, 0, -1 / 49] },
  ep: { label: 'Elektrik piyano', h: [1, 0.45, 0.1, 0.2, 0.03, 0.06] },
  noise: { label: 'Gürültü (davul)', h: null },
};

// ---------- presetler ----------
const M_GAP = 0.15;
const MATHARIUM = [
  {
    name: '1/5 — 8 tabanlı melodi', duration: 13.792,
    defs: `const u = 64 * (x + 4.25) / 8.5, n = floor(u);
const N = u < 32 ? 220480139724424 : 119328291981064;
const d = digit(N, 8, n % 16);
const T = [71, 70, 68, 73, 78, 76, null, 76];`,
    voices: [{ name: 'y', color: '#ff6b5b', gain: 0.3, expr: 'd === 6 ? REST : note(T[d] - (n % 4 === 1 ? 1 : 0))' }],
  },
  {
    name: '2/5 — 16 tabanlı arpej', duration: 13.856,
    defs: `const u = 128 * (x + 4.25) / 8.5, n = floor(u), k = floor(n / 4);
const N = k < 24 ? 39634348 : 576505260;
const d = digit(N, 16, k % 8), r = n % 4;`,
    voices: [{ name: 'y', color: '#5fd3b5', gain: 0.3, expr: 'note(r === 0 ? 80 : r === 1 ? 81 : r === 2 ? (k < 16 ? 83 : 78 + d) : (k < 30 ? 85 : 81))' }],
  },
  {
    name: '3/5 — altı ses, aralık tablosu', duration: 12.669,
    defs: 'const u = 128 * (x + 4.25) / 8.5, p = mod(u, 32);',
    voices: [
      { name: 'm1', color: '#f2c14e', gain: 0.22, expr: 'note(seg(p, [[98,0,4],[96,4,6],[98,6,8],[95,8,12],[90,12,24],[84,24,26],[86,26,27],[84,27,28],[91,28,30],[93,30,31],[91,31,32]]))' },
      { name: 'm2', color: '#ff6b5b', gain: 0.2, expr: 'note(seg(p, [[76,16,20],[79,20,22],[83,22,24]]))' },
      { name: 'm3', color: '#5fd3b5', gain: 0.16, expr: 'note(seg(p, [[60,0,4],[60,6,8],[64,12,16],[64,20,22],[64,24,28],[64,30,31]]))' },
      { name: 'm4', color: '#f4f1ea', gain: 0.16, expr: 'note(seg(p, [[67,0,4],[67,6,10],[67,11,12],[71,12,16],[71,20,22],[71,24,28],[71,30,31]]))' },
      { name: 'm5', color: '#ff9b87', gain: 0.18, expr: 'note(seg(p, [[72,8,10],[72,11,12]]))' },
      { name: 'm6', color: '#7fa88f', gain: 0.16, expr: 'note(seg(p, [[84,0,12],[83,12,24]]))' },
    ],
  },
  {
    name: '4/5 — kaymalı pluck (e üstel)', duration: 12.992,
    defs: `const u = 64 * (x + 4.25) / 8.5, n = floor(u), b = floor(n / 8);
const N = [252308832243, 1080706072044, 252308832243, 1080706072044, 252308832243, 1080706072044, 110944009779, 4269093327][min(b, 7)];
const d = digit(N, 32, n % 8);`,
    voices: [{ name: 'y', color: '#ff6b5b', gain: 0.3, expr: '(d === 31 || frac(u) >= 0.88) ? REST : -0.33496 + (60 + d - 62 - 2.2 * exp(-12 * frac(u))) / 12' }],
  },
  {
    name: '5/5 — melodi + iki bas', duration: 12.299,
    defs: `const u = 64 * (x + 4.25) / 8.5, b = floor(u / 8);
const N = [110771808652, 169125, 110771808652, 169125, 110771808652, 169125, 110771808519, 460013606053][min(b, 7)];
const d = digit(N, 32, floor(u) % 8);
const v = 32 * (x + 4.25) / 8.5, w = mod(v, 8);`,
    voices: [
      { name: 'y1', color: '#f2c14e', gain: 0.26, expr: 'd === 31 ? REST : -0.33496 + (d + 8) / 12' },
      { name: 'y2', color: '#5fd3b5', gain: 0.22, expr: '-0.33496 + ((v >= 30 ? 68 : w < 2 ? 58 : w < 4 ? 46 : 59) - 62) / 12' },
      { name: 'y3', color: '#ff6b5b', gain: 0.2, expr: '-0.33496 + ((v >= 30 ? 61 : w < 4 ? 53 : 54) - 62) / 12' },
    ],
  },
];

// ---------- özgün formül şarkısı: "Sayıların Gecesi" ----------
// 140 BPM, A minör, Am–F–C–G. Her bölüm bir matematik fikri: asal sayılar → Fibonacci → π → Eno döngüleri.
// Sesler [y, genlik] döndürür: genlik üstel sönümlerle (exp) vuruşlu sesler, davullar ve 808 kayması formülle yazılır.
const COMMON = `const BPM = 140, q = t * BPM / 60, s = floor(q * 4), f = frac(q * 4), bar = floor(q / 4), st = 60 / BPM / 4;
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am F C G
const ch = PROG[bar % 4], root = ch[0];
const SC = [0, 2, 3, 5, 7, 8, 10];                                        // A doğal minör
const deg = (k) => 57 + SC[mod(k, 7)] + 12 * floor(k / 7);               // ölçek derecesi → MIDI
const pl = (k) => exp(-k * f * st);                                       // 16'lık içinde üstel sönüm`;
const BAR = 4 * 60 / 140;
const SAYILAR = [
  {
    name: 'Asal sayılar (sakin giriş)', duration: 8 * BAR,
    defs: `${COMMON}
const P = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53];   // ilk 16 asal
const i = floor(s / 2), e = frac(q * 2) * 2 * st;                          // 8'lik sayacı ve geçen süre`,
    voices: [
      { name: 'asal melodi', color: '#f2c14e', gain: 0.3, timbre: 'triangle', expr: '[midi(deg(P[i % 16] % 7 + 7)), i % 8 === 7 ? 0 : exp(-5 * e)]' },
      { name: 'pad üçlü', color: '#5fd3b5', gain: 0.14, timbre: 'sine', expr: '[midi(ch[1] + 12), min(1, t / 4)]' },
      { name: 'pad beşli', color: '#7fa88f', gain: 0.12, timbre: 'sine', expr: '[midi(ch[2] + 12), min(1, t / 4)]' },
      { name: 'bas', color: '#ff6b5b', gain: 0.2, timbre: 'sine', expr: '[midi(root - 12), 0.8 * min(1, t / 2)]' },
    ],
  },
  {
    name: 'Fibonacci arpeji', duration: 8 * BAR,
    defs: `${COMMON}
const P = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53];
const FIB3 = [0, 1, 1, 2, 0, 2, 2, 1];   // Fibonacci mod 3 (Pisano periyodu 8) → akorun hangi notası`,
    voices: [
      { name: 'Fibonacci arp', color: '#5fd3b5', gain: 0.16, timbre: 'square', expr: '[midi(ch[FIB3[s % 8]] + 12 + 12 * (floor(s / 8) % 2)), pl(9)]' },
      { name: 'asal melodi', color: '#f2c14e', gain: 0.28, timbre: 'triangle', expr: '[midi(deg(P[floor(q) % 16] % 7 + 9)), exp(-3 * frac(q) * 60 / BPM)]' },
      { name: 'bas', color: '#ff6b5b', gain: 0.28, timbre: 'sine', expr: '[midi(root - 12), exp(-2.5 * frac(q) * 60 / BPM)]' },
      { name: 'hat', color: '#f4f1ea', gain: 0.09, timbre: 'noise', expr: '[2, (s % 2 ? 0.4 : 1) * pl(70) * min(1, t / 6)]' },
    ],
  },
  {
    name: 'π rakamları (drop)', duration: 16 * BAR,
    defs: `${COMMON}
const PI = '31415926535897932384626433832795028841971693993751';   // π'nin ilk 50 rakamı
const k = floor(s / 2), dg = +PI[k % 50];
const KK = [0, 7, 10], s16 = s % 16;                                  // kick adımları
const tk = (s16 - KK.filter((v) => v <= s16).pop() + f) * st;         // son kick'ten beri geçen süre
const tS = mod(q - 1, 2) * 60 / BPM;                                   // 2. ve 4. vuruştaki snare'den beri
const tb = frac(q / 4) * 4 * 60 / BPM;                                 // ölçü başından beri
const prev = PROG[(bar + 3) % 4][0];
const roll = bar % 2 === 1 && mod(q, 4) >= 3;                          // her iki ölçüde bir son vuruşta üçleme roll`,
    voices: [
      { name: 'π melodi', color: '#f2c14e', gain: 0.42, timbre: 'matharium', expr: 'dg === 0 ? REST : [midi(deg(dg + 6)), exp(-4 * frac(q * 2) * 2 * st)]' },
      { name: 'karşı melodi', color: '#ff9b87', gain: 0.17, timbre: 'square', expr: 'k % 3 === 1 ? [midi(deg(dg % 5 + 11)), pl(16)] : REST' },
      { name: 'kick', color: '#ff6b5b', gain: 0.45, timbre: 'sine', expr: '[midi(33 + 30 * exp(-35 * tk)), exp(-5 * tk)]' },
      { name: '808', color: '#c77dff', gain: 0.28, timbre: 'sine', expr: '[midi(root + (prev - root) * exp(-25 * tb) - 24), 0.9 * exp(-0.35 * tb) * (1 - 0.6 * exp(-12 * tk))]' },
      { name: 'snare gürültü', color: '#f4f1ea', gain: 0.28, timbre: 'noise', expr: '[-0.5, exp(-14 * tS)]' },
      { name: 'snare gövde', color: '#e0d6c2', gain: 0.18, timbre: 'triangle', expr: '[midi(55 + 7 * exp(-40 * tS)), exp(-18 * tS)]' },
      { name: 'hat', color: '#9fd3ff', gain: 0.12, timbre: 'noise', expr: 'roll ? [1.5, exp(-70 * frac(q * 6) * 60 / BPM / 6)] : [1.5, (s % 2 ? 0.5 : 1) * pl(70)]' },
      { name: 'pad', color: '#5fd3b5', gain: 0.1, timbre: 'sine', expr: '[midi(ch[1] + 12), 0.6]' },
    ],
  },
  {
    name: 'Eno döngüleri (sakin kapanış)', duration: 14,
    defs: `const fade = max(0, 1 - t / D);   // D: bölüm süresi
// birbirine bölünmeyen döngü uzunlukları → aynı birleşim nadiren tekrar eder`,
    voices: [
      { name: '7.1 sn', color: '#f2c14e', gain: 0.25, timbre: 'triangle', expr: 'mod(t, 7.1) < 2.5 ? [midi(76), exp(-0.8 * mod(t, 7.1)) * fade] : REST' },
      { name: '9.3 sn', color: '#5fd3b5', gain: 0.22, timbre: 'triangle', expr: 'mod(t + 3, 9.3) < 3 ? [midi(69), exp(-0.6 * mod(t + 3, 9.3)) * fade] : REST' },
      { name: '11.7 sn', color: '#ff6b5b', gain: 0.22, timbre: 'triangle', expr: 'mod(t + 1, 11.7) < 4 ? [midi(72), exp(-0.5 * mod(t + 1, 11.7)) * fade] : REST' },
      { name: 'drone', color: '#f4f1ea', gain: 0.09, timbre: 'sine', expr: '[midi(45), fade]' },
    ],
  },
];

// ---------- özgün formül şarkısı 2: "Altın Oran" (sakin lofi) ----------
// 80 BPM, swing'li 8'likler, Fmaj7–Em7–Dm7–Cmaj7. φ (altın oran), Collatz dizisi, e sayısı ve doğuşkan seri.
// Tüm perdelere bant "wow"u (yavaş sinüs) eklenir; plak cızırtısı bir karma fonksiyonundan gelir.
const LOFI = `const BPM = 80, bt = 60 / BPM, q = t / bt, bar = floor(q / 4), qb = mod(q, 4), tb = qb * bt;
const PHI = 1.6180339887;                                                   // altın oran
const PROG = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];   // Fmaj7 Em7 Dm7 Cmaj7
const ch = PROG[bar % 4], root = ch[0];
const SC = [0, 2, 4, 5, 7, 9, 11];                                          // Do majör
const deg = (k) => 60 + SC[mod(k, 7)] + 12 * floor(k / 7);
const SW = 0.62, fb = frac(q), late = fb >= SW;                             // swing: ikinci 8'lik geç gelir
const e8 = floor(q) * 2 + (late ? 1 : 0), te = (late ? fb - SW : fb) * bt; // swing'li 8'lik sayacı, geçen süre
const wow = 0.005 * sin(2 * PI * 0.55 * t);                                 // bant titremesi
const chAmp = (0.35 + 0.65 * exp(-0.9 * tb)) * (1 + 0.18 * sin(2 * PI * 4.2 * t));   // akor + tremolo
const hsh = (n) => frac(sin(n * 12.9898) * 43758.5453);                    // karma fonksiyonu
const pop = hsh(floor(t * 40)) > 0.94 ? exp(-10 * frac(t * 40)) : 0;      // plak cızırtısı`;
const PHI_MEL = `
const fw = (n) => floor((n + 2) / PHI) - floor((n + 1) / PHI);            // Fibonacci kelimesi: 1 0 1 1 0 1 0 1 1 …
const on = fw(e8) === 1, ei = on ? e8 : e8 - 1;                            // kelimede "00" yok → susarsa önceki çalar
const tn = on ? te : te + (late ? SW : 1 - SW) * bt;
const mel = deg(floor(frac(ei * PHI) * 9) + 7);                            // Weyl dizisi: k·φ'nin kesri → nota`;
const DRUMS = `
const KB = qb >= 2.62 ? 2.62 : 0, tk = (qb - KB) * bt;                     // kick: 1 ve 3'ün "ve"si
const tS = mod(q - 1, 2) * bt;                                              // snare: 2 ve 4`;
const chordVoices = (g) => [0, 1, 2, 3].map((i) => ({
  name: `akor ${i + 1}`, color: ['#5fd3b5', '#7fa88f', '#9fd3ff', '#c9b8ff'][i], gain: g, timbre: 'ep',
  expr: `[midi(ch[${i}] + 12) + wow + drop, chAmp * fade]`,
}));
const vinyl = { name: 'plak', color: '#8a8478', gain: 0.05, timbre: 'noise', expr: '[0, (0.12 + pop) * fade]' };
const drumVoices = [
  { name: 'kick', color: '#ff6b5b', gain: 0.4, timbre: 'sine', expr: '[midi(31 + 26 * exp(-28 * tk)), exp(-7 * tk)]' },
  { name: 'snare gürültü', color: '#f4f1ea', gain: 0.2, timbre: 'noise', expr: '[0, exp(-16 * tS)]' },
  { name: 'snare gövde', color: '#e0d6c2', gain: 0.12, timbre: 'triangle', expr: '[midi(53 + 6 * exp(-40 * tS)), exp(-22 * tS)]' },
  { name: 'hat', color: '#9fd3ff', gain: 0.08, timbre: 'noise', expr: '[0, (late ? 0.55 : 1) * exp(-55 * te)]' },
];
const LBAR = 4 * 60 / 80;
const ALTIN = [
  {
    name: 'φ: altın oran (giriş)', duration: 4 * LBAR,
    defs: `${LOFI}${PHI_MEL}
const drop = 0, fade = min(1, t / 3);`,
    voices: [
      { name: 'φ melodi', color: '#f2c14e', gain: 0.38, timbre: 'ep', expr: '[midi(mel) + wow, exp(-3 * tn) * fade]' },
      ...chordVoices(0.11),
      { name: 'bas', color: '#ff9b87', gain: 0.15, timbre: 'sine', expr: '[midi(root - 12) + wow, (0.5 + 0.5 * exp(-1.5 * tb)) * fade]' },
      vinyl,
    ],
  },
  {
    name: 'Collatz: 7 → 1', duration: 8 * LBAR,
    defs: `${LOFI}${DRUMS}
const COL = [7, 22, 11, 34, 17, 52, 26, 13, 40, 20, 10, 5, 16, 8, 4, 2, 1];   // tekse 3n+1, çiftse n/2
const c = COL[floor(q) % COL.length];
const drop = 0, fade = 1;`,
    voices: [
      { name: 'Collatz melodi', color: '#f2c14e', gain: 0.34, timbre: 'ep', expr: '[midi(deg(c % 9 + 5)) + wow, (c % 2 ? 1 : 0.6) * exp(-2.2 * fb * bt)]' },
      ...chordVoices(0.1),
      { name: 'bas', color: '#ff9b87', gain: 0.17, timbre: 'sine', expr: '[midi(root - 12) + wow, 0.9 * exp(-1.2 * tk)]' },
      ...drumVoices,
      vinyl,
    ],
  },
  {
    name: 'e: Euler sayısı', duration: 8 * LBAR,
    defs: `${LOFI}${DRUMS}
const E = '27182818284590452353602874713526624977572470936999595749669676277240766303535';   // e'nin rakamları
const dg = +E[e8 % E.length];
const n = 1 + mod(floor(q * 4), 8);                                         // doğuşkan seri: kökün 1.–8. katı
const drop = 0, fade = 1;`,
    voices: [
      { name: 'e melodi', color: '#f2c14e', gain: 0.34, timbre: 'ep', expr: 'dg === 0 ? REST : [midi(deg(dg + 5)) + wow, exp(-4 * te)]' },
      { name: 'doğuşkan arp', color: '#c77dff', gain: 0.09, timbre: 'sine', expr: '[midi(root - 12) + log2(n) + wow, exp(-9 * frac(q * 4) * bt / 4)]' },
      ...chordVoices(0.1),
      { name: 'bas', color: '#ff9b87', gain: 0.17, timbre: 'sine', expr: '[midi(root - 12) + wow, 0.9 * exp(-1.2 * tk)]' },
      ...drumVoices,
      vinyl,
    ],
  },
  {
    name: 'φ: dönüş + bant durması', duration: 4 * LBAR,
    defs: `${LOFI}${PHI_MEL}
const drop = t > D - 1.8 ? -2.5 * ((t - (D - 1.8)) / 1.8) ** 2 : 0;       // bant yavaşlıyor: perde karesel düşer
const fade = min(1, (D - t) / 2);`,
    voices: [
      { name: 'φ melodi', color: '#f2c14e', gain: 0.38, timbre: 'ep', expr: '[midi(mel) + wow + drop, exp(-3 * tn) * fade]' },
      ...chordVoices(0.11),
      { name: 'bas', color: '#ff9b87', gain: 0.15, timbre: 'sine', expr: '[midi(root - 12) + wow + drop, (0.5 + 0.5 * exp(-1.5 * tb)) * fade]' },
      vinyl,
    ],
  },
];

export const PRESETS = {
  altin: { label: 'Altın Oran — sakin lofi formül şarkısı (φ, Collatz, e)', timbre: 'ep', gap: 0, sections: ALTIN },
  sayilar: { label: 'Sayıların Gecesi — özgün formül şarkısı (asal, Fibonacci, π, Eno)', timbre: 'triangle', gap: 0, sections: SAYILAR },
  matharium: { label: 'Matharium (videodaki 5 bölüm)', timbre: 'matharium', gap: M_GAP, sections: MATHARIUM },
  merdiven: {
    label: 'Örnek: pentatonik merdiven', timbre: 'triangle', gap: 0.1,
    sections: [{
      name: 'Merdiven', duration: 8,
      defs: 'const u = 32 * (x + 4.25) / 8.5, n = floor(u);\nconst P = [0, 2, 4, 7, 9];',
      voices: [
        { name: 'melodi', color: '#f2c14e', gain: 0.3, expr: 'midi(64 + P[n % 5] + 12 * floor(n / 5) % 24)' },
        { name: 'bas', color: '#5fd3b5', gain: 0.25, expr: 'midi(40 + (floor(n / 8) % 2 ? 5 : 0))' },
      ],
    }],
  },
  eno: {
    label: 'Örnek: Eno döngüleri (uyumsuz periyotlar)', timbre: 'sine', gap: 0.1,
    sections: [{
      name: 'Döngüler', duration: 20,
      defs: '// her ses farklı uzunlukta bir döngü: birbirine bölünmediği için aynı birleşim nadiren tekrarlar',
      voices: [
        { name: '7.1 sn', color: '#f2c14e', gain: 0.25, expr: 'mod(t, 7.1) < 2.5 ? midi(76) : REST' },
        { name: '9.3 sn', color: '#5fd3b5', gain: 0.25, expr: 'mod(t + 3, 9.3) < 3 ? midi(69) : REST' },
        { name: '11.7 sn', color: '#ff6b5b', gain: 0.25, expr: 'mod(t + 1, 11.7) < 4 ? midi(73) : REST' },
        { name: 'drone', color: '#f4f1ea', gain: 0.15, expr: 'midi(45)' },
      ],
    }],
  },
};

// ---------- derleme ve sentez ----------
export function compileSection(sec) {
  const body = `${sec.defs || ''}\nreturn [${sec.voices.map((v) => `(${v.expr || 'REST'})`).join(', ')}];`;
  const make = new Function(...HKEYS, `return function (x, t, D) {\n${body}\n};`);
  return make(...HKEYS.map((k) => HELPERS[k]));
}

// Bir bölümün tüm seslerinin y dizilerini örnek örnek hesapla
export function evaluate(sec, sr = SR) {
  const fn = compileSection(sec);
  const len = Math.floor(sec.duration * sr);
  const ys = sec.voices.map(() => new Float32Array(len));
  const amps = sec.voices.map(() => new Float32Array(len).fill(1));
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const x = -4.25 + (8.5 * t) / sec.duration;
    const r = fn(x, t, sec.duration);
    for (let v = 0; v < ys.length; v++) {
      let y = r[v], a = 1;
      if (Array.isArray(y)) { a = y[1]; y = y[0]; }   // [y, genlik] biçimi: vuruşlu sesler, sönümler
      ys[v][i] = y == null || !Number.isFinite(y) ? NaN : y;
      amps[v][i] = Number.isFinite(a) ? Math.max(0, a) : 0;
    }
  }
  ys.amps = amps;
  return ys;
}

function synthVoice(y, gain, harm, amp) {
  const len = y.length, out = new Float32Array(len);
  const hsum = harm ? harm.reduce((a, b) => a + Math.abs(b), 0) || 1 : 1;
  let seed = 22222;
  const k = Math.max(1, Math.round(0.003 * SR)); // 3 ms yumuşatma (tık önleme)
  let phase = 0, env = 0, prevY = NaN;
  for (let i = 0; i < len; i++) {
    const on = !Number.isNaN(y[i]);
    if (on) phase += (2 * Math.PI * F_REF * Math.pow(2, y[i])) / SR;
    // hedef zarf: açık nota 1, sus 0; perde sıçramasında kısa bir çukur
    let target = on ? 1 : 0;
    if (on && !Number.isNaN(prevY) && Math.abs(y[i] - prevY) > 1 / 24) env = Math.min(env, 0.15);
    env += (target - env) / k;
    prevY = on ? y[i] : NaN;
    if (env < 1e-4) continue;
    let s = 0;
    if (!harm) { seed = (seed * 1664525 + 1013904223) >>> 0; s = seed / 2147483648 - 1; } // gürültü (davul)
    else for (let h = 0; h < harm.length; h++) if (harm[h]) s += harm[h] * Math.sin((h + 1) * phase);
    out[i] = (s / hsum) * env * gain * (amp ? amp[i] : 1);
  }
  return out;
}

// Tüm bölümleri art arda render et → { buffer: Float32Array, starts: [...] }
export function renderSong(song, onlySection = null) {
  const songTimbre = song.timbre || 'matharium';
  const secs = onlySection == null ? song.sections : [song.sections[onlySection]];
  const starts = [];
  let total = 0;
  for (const s of secs) { starts.push(total); total += s.duration + (song.gap || 0); }
  const out = new Float32Array(Math.ceil(total * SR));
  secs.forEach((sec, si) => {
    const ys = evaluate(sec);
    const off = Math.round(starts[si] * SR);
    sec.voices.forEach((v, vi) => {
      const tb = TIMBRES[v.timbre || songTimbre] || TIMBRES.matharium;
      const a = synthVoice(ys[vi], v.gain ?? 0.25, tb.h, ys.amps[vi]);
      for (let i = 0; i < a.length; i++) out[off + i] += a[i];
    });
  });
  let pk = 0;
  for (const v of out) pk = Math.max(pk, Math.abs(v));
  if (pk > 0) { const g = 0.89 / pk; for (let i = 0; i < out.length; i++) out[i] *= g; }
  return { data: out, starts, total };
}

export function toAudioBuffer(data) {
  const buf = new AudioBuffer({ length: data.length, sampleRate: SR, numberOfChannels: 1 });
  buf.copyToChannel(data, 0);
  return buf;
}

// ---------- arayüz ----------
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const LS = 'kodstudyo.formula';

export function setupFormula({ getCtx, toast, onAddToStudio }) {
  const $ = (id) => document.getElementById(id);
  let song;
  try { song = JSON.parse(localStorage.getItem(LS) || 'null'); } catch { song = null; }
  if (!song || !Array.isArray(song.sections)) song = clone(PRESETS.matharium);
  let cur = 0, playing = null, cache = null; // cache: son render (oynatma + grafik için)

  Object.entries(PRESETS).forEach(([k, p]) => $('fxPreset').append(h('option', { value: k }, p.label)));
  Object.entries(TIMBRES).forEach(([k, t]) => $('fxTimbre').append(h('option', { value: k }, t.label)));

  const save = () => { try { localStorage.setItem(LS, JSON.stringify(song)); } catch { /* yok say */ } };
  // formül değişti: grafiği yeniden hesapla (aynı bölüm nesnesi olduğu için önbellek kendiliğinden yenilenmez)
  const dirty = () => { cache = null; graphData = null; save(); drawGraph(); };

  function renderTabs() {
    const box = $('fxSections');
    box.replaceChildren();
    song.sections.forEach((s, i) => box.append(h('button', { type: 'button', class: i === cur ? 'on' : '', onclick: () => { cur = i; renderEditor(); } }, `${i + 1}/${song.sections.length}`)));
    box.append(h('button', { type: 'button', title: 'Bu bölümün kopyasını ekle', onclick: () => { song.sections.splice(cur + 1, 0, clone(song.sections[cur])); cur++; dirty(); renderEditor(); } }, '+'));
    if (song.sections.length > 1) box.append(h('button', { type: 'button', title: 'Bölümü sil', onclick: () => { song.sections.splice(cur, 1); cur = Math.max(0, cur - 1); dirty(); renderEditor(); } }, '×'));
  }

  function renderEditor() {
    stop();
    renderTabs();
    $('fxTimbre').value = song.timbre || 'matharium';
    const sec = song.sections[cur];
    const ed = $('fxEditor');
    ed.replaceChildren();
    const name = h('input', { value: sec.name });
    name.addEventListener('change', () => { sec.name = name.value; dirty(); });
    const dur = h('input', { type: 'number', min: 1, max: 600, step: 0.001, value: sec.duration, style: 'width:90px' });
    dur.addEventListener('change', () => { sec.duration = Math.max(1, +dur.value || 10); dirty(); });
    const defs = h('textarea', { rows: Math.max(3, (sec.defs || '').split('\n').length + 1), spellcheck: 'false', class: 'code' });
    defs.value = sec.defs || '';
    defs.addEventListener('change', () => { sec.defs = defs.value; dirty(); });
    ed.append(
      h('div', { class: 'row' }, h('label', {}, 'Bölüm ', name), h('label', {}, 'Süre (sn) ', dur)),
      h('label', { class: 'col' }, h('span', {}, 'Ortak tanımlar ', h('small', { class: 'hint' }, '(x: −4.25→4.25, t: saniye; JS satırları)')), defs),
    );
    sec.voices.forEach((v, i) => {
      const expr = h('textarea', { rows: Math.max(1, Math.ceil((v.expr || '').length / 70)), spellcheck: 'false', class: 'code' });
      expr.value = v.expr;
      expr.addEventListener('change', () => { v.expr = expr.value; dirty(); });
      const col = h('input', { type: 'color', value: v.color || '#f2c14e' });
      col.addEventListener('input', () => { v.color = col.value; save(); drawGraph(); });
      const gain = h('input', { type: 'range', min: 0, max: 0.6, step: 0.01, value: v.gain ?? 0.25, title: 'Ses seviyesi' });
      gain.addEventListener('change', () => { v.gain = +gain.value; dirty(); });
      const nm = h('input', { value: v.name, style: 'width:70px' });
      nm.addEventListener('change', () => { v.name = nm.value; save(); });
      const tsel = h('select', { title: 'Bu sesin tınısı' }, h('option', { value: '' }, 'şarkının tınısı'), Object.entries(TIMBRES).map(([k, tt]) => h('option', { value: k }, tt.label)));
      tsel.value = v.timbre || '';
      tsel.addEventListener('change', () => { v.timbre = tsel.value || undefined; dirty(); });
      ed.append(h('div', { class: 'fxvoice' },
        h('div', { class: 'row' }, col, nm, tsel, h('span', { class: 'spacer' }), gain,
          h('button', { type: 'button', title: 'Sesi sil', onclick: () => { sec.voices.splice(i, 1); dirty(); renderEditor(); } }, '×')),
        expr));
    });
    ed.append(h('button', { type: 'button', onclick: () => { sec.voices.push({ name: 'y' + (sec.voices.length + 1), color: '#f4f1ea', gain: 0.25, expr: 'midi(64)' }); dirty(); renderEditor(); } }, '+ Ses ekle'));
    drawGraph();
  }

  // ---------- grafik (videodaki gibi: eksenler, basamaklı çizgiler, oynatırken parlayan nokta) ----------
  let graphData = null;
  function computeGraph() {
    const sec = song.sections[cur];
    const res = 2400, sr = res / sec.duration;
    try {
      const ys = evaluate(sec, sr);
      $('fxError').textContent = '';
      graphData = { ys, sec };
    } catch (e) {
      $('fxError').textContent = 'Formül hatası: ' + e.message;
      graphData = null;
    }
  }
  function drawGraph(progress = 1) {
    if (!graphData || graphData.sec !== song.sections[cur]) computeGraph();
    const cv = $('fxCanvas'), c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    c.fillStyle = '#12110f'; c.fillRect(0, 0, W, H);
    $('fxLabel').textContent = `${cur + 1} / ${song.sections.length}`;
    if (!graphData) return;
    const { ys, sec } = graphData;
    let lo = Infinity, hi = -Infinity;
    for (const y of ys) for (const v of y) if (!Number.isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
    lo = Math.min(lo, -0.2); hi = Math.max(hi, 0.2);
    const pad = (hi - lo) * 0.12;
    const X = (x) => ((x + 4.25) / 8.5) * (W - 40) + 20;
    const Y = (y) => H - 20 - ((y - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 40);
    // eksenler
    c.strokeStyle = '#8a8478'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(10, Y(0)); c.lineTo(W - 10, Y(0)); c.moveTo(X(0), 10); c.lineTo(X(0), H - 10); c.stroke();
    c.fillStyle = '#8a8478'; c.font = 'italic 16px Georgia, serif'; c.fillText('x', W - 22, Y(0) + 18); c.fillText('y', X(0) + 8, 22);
    const n = ys[0] ? ys[0].length : 0;
    const upto = Math.floor(n * progress);
    ys.forEach((y, vi) => {
      const color = sec.voices[vi].color || '#f2c14e';
      c.strokeStyle = color; c.lineWidth = 2; c.beginPath();
      let pen = false, last = null;
      for (let i = 0; i < upto; i++) {
        const v = y[i];
        const px = X(-4.25 + (8.5 * i) / n);
        if (Number.isNaN(v)) { pen = false; continue; }
        const py = Y(v);
        if (!pen) { c.moveTo(px, py); pen = true; } else c.lineTo(px, py);
        last = [px, py];
      }
      c.stroke();
      if (progress < 1 && last) {
        c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 14;
        c.beginPath(); c.arc(last[0], last[1], 6, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
      }
    });
  }

  // ---------- çalma ----------
  function stop() {
    if (playing) { try { playing.src.stop(); } catch { /* zaten durdu */ } cancelAnimationFrame(playing.raf); playing = null; }
    $('fxPlay').textContent = '▶ Bölümü çal'; $('fxPlayAll').textContent = '▶ Hepsini çal';
    drawGraph();
  }
  function play(all) {
    stop();
    let r;
    try { r = renderSong(song, all ? null : cur); } catch (e) { toast('Formül hatası: ' + e.message, true, 6000); return; }
    const ctx = getCtx();
    const src = ctx.createBufferSource(); src.buffer = toAudioBuffer(r.data); src.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.05; src.start(t0);
    playing = { src, raf: 0 };
    (all ? $('fxPlayAll') : $('fxPlay')).textContent = '■ Durdur';
    const startIdx = all ? 0 : cur;
    const tick = () => {
      if (!playing) return;
      const t = ctx.currentTime - t0;
      if (t > r.total) { stop(); return; }
      // hangi bölümdeyiz?
      let si = 0;
      while (si + 1 < r.starts.length && t >= r.starts[si + 1]) si++;
      const sec = song.sections[startIdx + si];
      if (startIdx + si !== cur) { cur = startIdx + si; renderTabs(); renderEditorQuiet(); }
      drawGraph(Math.max(0, Math.min(1, (t - r.starts[si]) / sec.duration)));
      playing.raf = requestAnimationFrame(tick);
    };
    src.onended = () => { if (playing && playing.src === src) stop(); };
    tick();
  }
  // oynatma sırasında bölüm değişince editörü sessizce güncelle (çalmayı durdurmadan)
  function renderEditorQuiet() { const p = playing; playing = null; renderEditor(); playing = p; }

  $('fxPlay').addEventListener('click', () => (playing ? stop() : play(false)));
  $('fxPlayAll').addEventListener('click', () => (playing ? stop() : play(true)));
  $('fxPreset').addEventListener('change', () => {
    const p = PRESETS[$('fxPreset').value];
    if (!p) return;
    song = clone(p); cur = 0; dirty(); renderEditor();
    $('fxPreset').value = '';
  });
  $('fxTimbre').addEventListener('change', () => { song.timbre = $('fxTimbre').value; dirty(); });
  $('fxWav').addEventListener('click', () => {
    try {
      const r = renderSong(song);
      const blob = encodeWav(toAudioBuffer(r.data));
      const a = h('a', { href: URL.createObjectURL(blob), download: 'formul-sarki.wav' });
      document.body.append(a); a.click(); a.remove();
      toast(`WAV hazır: ${r.total.toFixed(1)} sn`);
    } catch (e) { toast('Formül hatası: ' + e.message, true, 6000); }
  });
  $('fxStudio').addEventListener('click', async () => {
    try {
      const r = renderSong(song);
      const ab = await encodeWav(toAudioBuffer(r.data)).arrayBuffer();
      onAddToStudio(ab, 'Formül şarkısı');
    } catch (e) { toast('Formül hatası: ' + e.message, true, 6000); }
  });
  renderEditor();
  return { stop };
}
