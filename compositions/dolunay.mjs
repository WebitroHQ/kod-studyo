// "Dolunay" — referans parçanın (Full Moon 2.0) ölçülen tarz özelliklerine göre yazılmış ÖZGÜN parça.
// Melodi/akorlar kopya değildir; referanstan yalnızca ölçülebilir tarz bilgisi alındı (tools/referans-analiz.py):
//  - tempo ≈113.5 BPM, üstünde 3:2 (üçleme) vurgu → üçleme hat/perküsyon
//  - F majör/miksolidyen renk (E♭ var, E yok), bas notaları F, A, C, G
//  - parlak, yüksek perdeli (F5–F6) çan/pluck melodili sakin girişler, ani sessiz kırılmalar
//  - ağır distorsiyonlu, çok yüksek sesli drop'lar; ayrı bir "808 bölümü" (alt bas ağırlıklı)
//  - genel denge: alt bas + bas baskın, orta/tiz geri
// Çalıştır: node compositions/dolunay.mjs  →  public/songs/dolunay.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const T = {
  bell: makeTrack({ inst: 'bell', role: 'melody', name: 'Çan melodi', oct: 5, vol: 0.7, pan: 0.05, rev: 0.35, dly: 0.2, params: { ratio: 3.01, index: 2.2, decay: 1.4 } }),
  pluck: makeTrack({ inst: 'pluck', role: 'counter', name: 'Pluck (ikileme)', oct: 5, vol: 0.45, pan: -0.25, rev: 0.25, dly: 0.25, params: { cutoff: 4500, decay: 0.35, wave: 1 } }),
  lead: makeTrack({ inst: 'lead', role: 'melody', name: 'Distorsiyonlu lead', oct: 4, vol: 0.55, duck: 0.35, rev: 0.2, params: { cutoff: 3000, detune: 28, drive: 0.7, attack: 0.004, release: 0.15 } }),
  pad: makeTrack({ inst: 'pad', role: 'pad', name: 'Pad', oct: 3, vol: 0.6, rev: 0.5, duck: 0.4, params: { cutoff: 1600, attack: 0.8, release: 1.5 } }),
  kick: makeTrack({ inst: 'kick', role: 'kick', vol: 1.2, params: { tune: 56, punch: 0.9, decay: 0.3, drive: 0.6, click: 0.7 } }),
  clap: makeTrack({ inst: 'clap', role: 'snare', vol: 0.9, rev: 0.15, params: { tone: 1500, decay: 0.2 } }),
  snare: makeTrack({ inst: 'snare', role: 'snare', name: 'Snare katmanı', vol: 0.6, params: { tone: 220, snap: 0.9, decay: 0.14, drive: 0.6 } }),
  hat: makeTrack({ inst: 'hat', role: 'hat', vol: 0.95, pan: 0.2, crush: 0.08, params: { decay: 0.035, tone: 9000 } }),
  ohat: makeTrack({ inst: 'openhat', role: 'openhat', name: 'Açık hat', vol: 0.45, pan: -0.2, params: { decay: 0.3 } }),
  rim: makeTrack({ inst: 'perc', role: 'perc', name: 'Üçleme perk', vol: 0.55, pan: -0.3, params: { kind: 0, tone: 600, decay: 0.05 } }),
  b808: makeTrack({ preset: 'b808', name: '808 (ağır distorsiyon)', vol: 0.75, duck: 0.15, params: { drive: 0.9, decay: 1.4, glide: 0.09, punch: 0.6, sub: 0.6, tone: 3500 } }),
  aah: Object.assign(makeTrack({ inst: 'sampler', role: 'vox', name: 'Vokal "aah" (perde düşük)', vol: 0.7, rev: 0.45, dly: 0.3, crush: 0.15, params: { rootNote: 60, oneShot: 1, gain: 1 } }), { sampleUrl: '/kits/phonk/aah-charlie.wav' }),
  fx: makeTrack({ inst: 'fx', role: 'fx', vol: 0.55, rev: 0.3 }),
};

const N = (s, n, l = 1, v = 0.9, x = {}) => ({ s, n, l, v, ...x });
const split = (evs) => [evs.filter((e) => e.s < 32), evs.filter((e) => e.s >= 32).map((e) => ({ ...e, s: e.s - 32 }))];
function grid(bars, base = 60) {
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

// ---------- melodi (F miksolidyen: F G A B♭ C D E♭) — özgün ----------
// A: F | F/A | B♭ | C      B: Dm | B♭ | F/A | E♭
const MEL_A = [
  [0, 84, 3], [3, 81, 3], [6, 77, 2], [8, 79, 2], [10, 81, 2], [12, 84, 4],
  [16, 86, 3], [19, 84, 3], [22, 81, 2], [24, 82, 2], [26, 81, 2], [28, 77, 4],
  [32, 77, 3], [35, 82, 3], [38, 86, 2], [40, 84, 4], [44, 82, 2], [46, 81, 2],
  [48, 79, 3], [51, 84, 3], [54, 87, 2], [56, 86, 2], [58, 84, 2], [60, 79, 4],
];
const MEL_B = [
  [0, 86, 3], [3, 89, 3], [6, 86, 2], [8, 84, 2], [10, 81, 2], [12, 86, 4],
  [16, 82, 3], [19, 86, 3], [22, 89, 2], [24, 87, 2], [26, 86, 2], [28, 82, 4],
  [32, 81, 3], [35, 84, 3], [38, 89, 2], [40, 87, 2], [42, 86, 2], [44, 84, 4],
  [48, 87, 3], [51, 86, 3], [54, 84, 2], [56, 82, 2], [58, 79, 2], [60, 82, 4],
];
const mel = (m, vs = 1, shift = 0) => m.map(([s, n, l]) => N(s, n + shift, l, (s % 8 === 0 ? 0.95 : 0.82) * vs));

// akorlar (pad) ve 808 kökleri
const CH = { F: [65, 69, 72], FA: [65, 69, 72], Bb: [65, 70, 74], C: [67, 72, 76 - 1], Dm: [62, 65, 69], Eb: [63, 67, 70] };
CH.C = [67, 70, 72]; // C7sus renk (E yerine B♭: miksolidyen)
const ROOT808 = { F: 29, FA: 33, Bb: 34, C: 36, Dm: 38, Eb: 39 };
const A = ['F', 'FA', 'Bb', 'C'], B = ['Dm', 'Bb', 'FA', 'Eb'];
const pad = (chords, v = 0.5) => chords.flatMap((c, bar) => CH[c].map((n) => N(bar * 16, n - 12, 16, v)));

// ---------- davullar (113 BPM; snare 2 ve 4; üçleme hat) ----------
const KICK = ['x......x..x.....', 'x.........x..x..', 'x......x..x.....', 'x.......x.x..x.x'];
const CLAP = ['....x.......x...', '....x.......x...', '....x.......x...', '....x.......x.x.'];
// 3 = o adımı üçe böl → 16'lık üçleme hissi (referanstaki 3:2 vurgusu)
const HAT = ['x.3.x.3.x.3.x.3.', 'x.3.x.3.x.3.x33.', 'x.3.x.3.x.3.x.3.', 'x.3.x.3.3.3.4.4.'];
const RIM = ['..3...3...3...3.', '..3...3.3...3...', '..3...3...3...3.', '..3...3...3.3.3.'];
function bass808(chords, long = false) {
  const out = [];
  chords.forEach((c, bar) => {
    const ks = [];
    for (let i = 0; i < 16; i++) if (KICK[bar][i] === 'x') ks.push(i);
    if (long) { out.push(N(bar * 16, ROOT808[c], 14, 0.95, bar ? { g: 1 } : {}), N(bar * 16 + 14, ROOT808[c] + 12, 2, 0.9, { g: 1 })); return; }
    ks.forEach((k, j) => {
      const next = j + 1 < ks.length ? ks[j + 1] : 16;
      const ev = N(bar * 16 + k, ROOT808[c], next - k, 0.95);
      if (j === 0 && bar > 0) ev.g = 1;
      if (j === ks.length - 1 && bar % 2 === 1) { ev.n += 12; ev.g = 1; }
      out.push(ev);
    });
  });
  return out;
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

// Giriş: çan melodisi + pad, davul yok
addPair('I', 'intro', { bell: mel(MEL_A, 0.8), pluck: mel(MEL_A, 0.6), pad: pad(A, 0.4) });
// Yükseliş: üçleme hat ve perk girer, clap, sonda vokal + riser
addPair('U', 'build', {
  bell: mel(MEL_A, 0.85), pluck: mel(MEL_A, 0.6), pad: pad(A, 0.45), hat: grid(HAT).map((e) => ({ ...e, v: e.v * 0.7 })), rim: grid(RIM),
  clap: grid(CLAP).filter((e) => e.s >= 32), aah: [N(48, 53, 1, 0.9)], fx: [N(32, 60, 32, 0.85)],
});
// Drop 1: tam kadro, distorsiyonlu lead melodiyi alt oktavda ikiler
addPair('A', 'drop', {
  bell: mel(MEL_A), lead: mel(MEL_A, 0.85, -12), pad: pad(A, 0.4), kick: grid(KICK), clap: grid(CLAP), snare: grid(CLAP), hat: grid(HAT), rim: grid(RIM),
  ohat: [N(0, 60, 1, 0.7)], b808: bass808(A), fx: [N(0, 62, 1, 0.9)],
});
// Kırılma: ani sessizlik — sadece çan, son vuruşta vokal
addPair('K', 'break', { bell: mel(MEL_A.filter(([s]) => s < 24), 0.7), aah: [N(56, 55, 1, 0.9)], fx: [N(32, 60, 32, 0.9)] });
// Drop 2: B melodisi, daha sert
addPair('B', 'drop2', {
  bell: mel(MEL_B), lead: mel(MEL_B, 0.85, -12), pluck: mel(MEL_B, 0.5), pad: pad(B, 0.4), kick: grid(KICK), clap: grid(CLAP), snare: grid(CLAP),
  hat: grid(HAT.map((h, i) => (i % 2 ? 'x.3.x.3.x.3.3.3.' : h))), rim: grid(RIM), ohat: [N(0, 60, 1, 0.7), N(32, 60, 1, 0.7)], b808: bass808(B), fx: [N(0, 62, 1, 0.9)],
});
// 808 bölümü: alt bas ağırlıklı, uzun kaymalı 808 + kick/clap, melodi yok
addPair('S', 'verse', {
  b808: bass808(A, true), kick: grid(KICK), clap: grid(CLAP), hat: grid(HAT).map((e) => ({ ...e, v: e.v * 0.6 })),
  aah: [N(0, 53, 1, 0.8), N(32, 50, 1, 0.8)], fx: [N(0, 62, 1, 0.9)],
});
// Çıkış: çan + pad söner
addPair('O', 'outro', { bell: mel(MEL_A, 0.7).filter((e) => e.s < 48).concat([N(48, 77, 16, 0.7)]), pad: pad(['F', 'FA', 'Bb', 'F'], 0.35), fx: [N(48, 61, 16, 0.6)] });

const seq = [
  ['Giriş', 'I1'], ['Giriş', 'I2'], ['Giriş', 'I1'], ['Giriş', 'I2'],
  ['Yükseliş', 'U1'], ['Yükseliş', 'U2'], ['Yükseliş', 'U1'], ['Yükseliş', 'U2'],
  ['Drop', 'A1'], ['Drop', 'A2'], ['Drop', 'A1'], ['Drop', 'A2'],
  ['Kırılma', 'K1'], ['Kırılma', 'K2'],
  ['Drop 2', 'B1'], ['Drop 2', 'B2'], ['Drop 2', 'B1'], ['Drop 2', 'B2'], ['Drop', 'A1'], ['Drop', 'A2'],
  ['Giriş (dönüş)', 'I1'], ['Giriş (dönüş)', 'I2'],
  ['808 bölümü', 'S1'], ['808 bölümü', 'S2'], ['808 bölümü', 'S1'], ['808 bölümü', 'S2'],
  ['Drop 2', 'B1'], ['Drop 2', 'B2'], ['Drop', 'A1'], ['Drop', 'A2'],
  ['Çıkış', 'O1'], ['Çıkış', 'O2'],
];
const arrangement = seq.map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'Dolunay (Full Moon tarzında, özgün)',
  bpm: 113.5, swing: 0, humanize: 4, root: 'F', scale: 'mixolydian',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 2, high: 3.5, drive: 0.55, glue: 0.65, makeup: 6, ceiling: -0.3, reverb: 1.8 },
  meta: { genre: 'drift_phonk', seed: 'dolunay', prog: [0, 0, 3, 4], target: -7, composedBy: 'Claude (referans analizine göre özgün besteleme)' },
};

const dir = path.join(ROOT, 'public', 'songs');
fs.writeFileSync(path.join(dir, 'dolunay.json'), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === 'dolunay.json')) {
  idx.unshift({ file: 'dolunay.json', name: 'Dolunay — Full Moon 2.0 tarzında özgün parça (Claude)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
