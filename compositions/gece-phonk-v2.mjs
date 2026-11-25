// "Gece Vardiyası v2" — Brazilian phonk, araştırma sonrası yeniden yapım.
// Çalıştır: node compositions/gece-phonk-v2.mjs  →  public/songs/gece-phonk-v2.json
// Uygulanan bulgular:
//  - Cowbell kancası 3–4 notalık basit döngü (rehberler); v1'de ölçü başına 9 nota geziyordu.
//  - TR-808 cowbell devre modeli (pulse %48, ~850 Hz 4. derece bant geçiren, iki aşamalı sönüm), filtre notayla kayar.
//  - 808: paralel temiz sub + kademeli distorsiyon (yumuşak doyum → sert kırpma); kick 808'den ayrı (54 Hz, tıklı).
//  - Montagem: gerçek insan sesi nidaları (public/kits/phonk, ElevenLabs TTS), kesik/perdeli kullanım.
//  - Hat'ler bitcrush'lı, perküsyon sağa sola dağıtılmış; zamanlama insanileştirilmiş; master 25 Hz highpass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const KIT = '/kits/phonk/';
const sampler = (name, file, extra = {}) => {
  const t = makeTrack({ inst: 'sampler', role: 'vox', name, vol: 0.85, rev: 0.25, dly: 0.18, ...extra, params: { rootNote: 60, oneShot: 1, gain: 1, ...(extra.params || {}) } });
  t.sampleUrl = KIT + file;
  return t;
};

const T = {
  bell: makeTrack({ preset: 'cowbell', name: 'Cowbell kanca', vol: 1.0, duck: 0.25, rev: 0.1, params: { drive: 0.55, decay: 0.3, tone: 900, q: 3 } }),
  bellLo: makeTrack({ preset: 'cowbell', name: 'Cowbell alt oktav', oct: 4, vol: 0.5, pan: -0.35, duck: 0.25, params: { drive: 0.4, decay: 0.25, tone: 900, q: 3 } }),
  bellHi: makeTrack({ preset: 'cowbell', name: 'Cowbell üst (drop 2)', oct: 6, vol: 0.4, pan: 0.35, rev: 0.2, params: { drive: 0.3, decay: 0.2, tone: 900, q: 3 } }),
  b808: makeTrack({ preset: 'b808', name: '808', vol: 0.95, duck: 0.15, params: { drive: 0.7, decay: 1.0, glide: 0.07, punch: 0.6, sub: 0.55, tone: 3200 } }),
  kick: makeTrack({ inst: 'kick', role: 'kick', vol: 0.95, params: { tune: 56, punch: 0.8, decay: 0.28, drive: 0.5, click: 0.65 } }),
  clap: makeTrack({ inst: 'clap', role: 'snare', vol: 0.9, rev: 0.12, params: { tone: 1500, decay: 0.16 } }),
  snare: makeTrack({ inst: 'snare', role: 'snare', name: 'Snare katmanı', vol: 0.6, params: { tone: 230, snap: 0.9, decay: 0.12, drive: 0.5 } }),
  hat: makeTrack({ inst: 'hat', role: 'hat', vol: 0.75, pan: 0.2, crush: 0.3, params: { decay: 0.035, tone: 9000 } }),
  rim: makeTrack({ inst: 'perc', role: 'perc', name: 'Tamborzão perk', vol: 0.75, pan: -0.25, params: { kind: 0, tone: 520, decay: 0.06 } }),
  shaker: makeTrack({ inst: 'perc', role: 'perc', name: 'Shaker', vol: 0.5, pan: 0.35, params: { kind: 2, decay: 0.05 } }),
  vai: sampler('Vokal: "Vai!"', 'vai-harry.wav'),
  ei: sampler('Vokal: "Ei!"', 'ei-charlie.wav', { pan: 0.15 }),
  toma: sampler('Vokal: "Toma!"', 'toma-harry.wav', { vol: 0.9 }),
  aah: sampler('Vokal: "Aah" (perde düşük)', 'aah-charlie.wav', { vol: 0.8, rev: 0.45, dly: 0.3, crush: 0.15 }),
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

// ---------- cowbell kancası: 4 nota (F#5 78, A5 81, B5 83, C#6 85) ----------
const HOOK1 = [[0, 78], [2, 78], [3, 81], [5, 78], [7, 85], [8, 83], [10, 81], [11, 78], [13, 81], [14, 78]];
const HOOK2 = [[0, 78], [2, 78], [3, 81], [5, 78], [7, 85], [8, 83], [10, 81], [11, 78], [13, 85], [14, 83]];
const hook = (vs = 1) => [HOOK1, HOOK2, HOOK1, HOOK2].flatMap((b, bar) => b.map(([s, n]) => N(bar * 16 + s, n, 1, (s % 4 === 0 ? 0.95 : 0.85) * vs)));
const octave = (evs, d, keepEvery = 1, vs = 0.8) => evs.filter((e, i) => i % keepEvery === 0).map((e) => ({ ...e, n: e.n + d, v: e.v * vs }));

// ---------- davullar (tamborzão 3+3+4+3+3) ----------
const KICK = ['x..x..x...x..x..', 'x..x..x...x..x..', 'x..x..x...x..x..', 'x..x..x.x.x..x.x'];
const CLAP = ['....x.......x...', '....x.......x...', '....x.......x...', '....x.......x.x.'];
const RIM = ['..x..x.x..x.x...', '.x..x..x.x..x..x', '..x..x.x..x.x...', '.x..x..x.x.2x.3.'];
const HAT = ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.3.4.x.'];
const SHAKER = ['.xxx.xxx.xxx.xxx', '.xxx.xxx.xxx.xxx', '.xxx.xxx.xxx.xxx', '.xxx.xxx.xxx.xxx'];

// ---------- 808: kick vuruşlarında; F# F# D E kökleri, ölçü sonu kaymaları ----------
function bass808(roots) {
  const out = [];
  roots.forEach((r, bar) => {
    const ks = [];
    for (let i = 0; i < 16; i++) if (KICK[bar][i] === 'x') ks.push(i);
    ks.forEach((k, j) => {
      const next = j + 1 < ks.length ? ks[j + 1] : 16;
      const ev = N(bar * 16 + k, r, next - k, 0.95);
      if (j === ks.length - 1 && bar % 2 === 1) { ev.n = r + 12; ev.g = 1; }
      if (j === 0 && bar > 0 && roots[bar - 1] !== r) ev.g = 1;
      out.push(ev);
    });
  });
  return out;
}
const ROOTS = [30, 30, 26, 28];

// ---------- vokal yerleşimi (montagem) ----------
// "Vai!" 4 ölçüde bir başta; "Ei!" ara vuruşlarda ve stutter; perdeyi n ile değiştiriyoruz (60 = orijinal)
const VAI = [N(0, 60, 1, 1), N(32, 60, 1, 0.95)];
const EI = [N(22, 60, 1, 0.85), N(30, 60, 1, 0.8, { r: 2 }), N(54, 60, 1, 0.85), N(60, 62, 1, 0.8, { r: 3 }), N(62, 63, 1, 0.85, { r: 4 })];

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

// Intro: kanca tek başına (alt oktav), shaker; sonda "Toma!" + riser
addPair('I', 'intro', {
  bell: hook(0.8), shaker: grid(SHAKER).filter((e) => e.s >= 32).map((e) => ({ ...e, v: e.v * 0.7 })),
  hat: grid(HAT).filter((e) => e.s >= 48).map((e) => ({ ...e, v: e.v * 0.6 })),
  toma: [N(60, 60, 1, 1)], fx: [N(32, 60, 32, 0.85)],
});
// Drop
addPair('A', 'drop', {
  bell: hook(), bellLo: octave(hook(), -12, 2), b808: bass808(ROOTS), kick: grid(KICK), clap: grid(CLAP), snare: grid(CLAP),
  hat: grid(HAT), rim: grid(RIM), shaker: grid(SHAKER).map((e) => ({ ...e, v: e.v * 0.6 })), vai: VAI, ei: EI, fx: [N(0, 62, 1, 0.9)],
});
// Kırılma: kick ve clap yok; 808 uzun kayar; "Aah" perdesi düşük ve geniş; kanca yarım
addPair('K', 'break', {
  bell: hook(0.75).filter((e) => e.s % 4 === 0 || e.s >= 56),
  b808: [N(0, 30, 14), N(14, 42, 2, 0.9, { g: 1 }), N(16, 30, 16, 0.9, { g: 1 }), N(32, 26, 16), N(48, 28, 12), N(60, 40, 4, 0.9, { g: 1 })],
  aah: [N(0, 55, 1, 0.9), N(16, 53, 1, 0.85), N(32, 50, 1, 0.9), N(48, 52, 1, 0.85)],
  hat: grid(['....x.......x...', '....x.......x...', '..x...x...x...x.', 'x.x.x.x.3.3.4.4.']),
  shaker: grid(SHAKER).map((e) => ({ ...e, v: e.v * 0.5 })),
  clap: [N(56, 60, 1, 0.6), N(58, 60, 1, 0.7), N(60, 60, 1, 0.8, { r: 2 }), N(62, 60, 1, 0.9, { r: 4 })],
  toma: [N(62, 60, 1, 1)], fx: [N(0, 61, 16, 0.7), N(32, 60, 32, 0.9)],
});
// Drop 2: üst oktav cowbell katmanı, yoğun hat, daha fazla "ei" stutter
addPair('B', 'drop2', {
  bell: hook(), bellLo: octave(hook(), -12, 2), bellHi: octave(hook(), 12, 1, 0.7), b808: bass808(ROOTS), kick: grid(KICK), clap: grid(CLAP), snare: grid(CLAP),
  hat: grid(HAT.map((h, i) => (i % 2 ? 'x.x.x.x.x.x.3.x.' : h))), rim: grid(RIM), shaker: grid(SHAKER).map((e) => ({ ...e, v: e.v * 0.7 })),
  vai: VAI, ei: EI.concat([N(6, 60, 1, 0.75), N(38, 60, 1, 0.75)]), fx: [N(0, 62, 1, 0.9)],
});
// Outro
addPair('O', 'outro', {
  bell: hook(0.8).filter((e) => e.s < 32).concat([N(32, 78, 2, 0.8)]),
  b808: [N(0, 30, 16), N(16, 30, 16), N(32, 30, 16, 0.8)],
  hat: grid(HAT).filter((e) => e.s < 32), aah: [N(32, 48, 1, 0.8)],
  fx: [N(32, 62, 1, 0.9), N(32, 61, 32, 0.6)],
});

const arrangement = [
  ['Intro', 'I1'], ['Intro', 'I2'],
  ['Drop', 'A1'], ['Drop', 'A2'], ['Drop', 'A1'], ['Drop', 'A2'],
  ['Kırılma', 'K1'], ['Kırılma', 'K2'],
  ['Drop 2', 'B1'], ['Drop 2', 'B2'], ['Drop 2', 'B1'], ['Drop 2', 'B2'],
  ['Drop', 'A1'], ['Drop', 'A2'],
  ['Outro', 'O1'], ['Outro', 'O2'],
].map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'Gece Vardiyası v2 (Brazilian phonk)',
  bpm: 130, swing: 0, humanize: 6, root: 'F#', scale: 'minor',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 1, high: 2.5, drive: 0.55, glue: 0.6, makeup: 6, ceiling: -0.3, reverb: 1.4 },
  meta: { genre: 'brazilian_phonk', seed: 'gece-vardiyasi-v2', prog: [0, 0, 5, 6], target: -8.5, composedBy: 'Claude (elle besteleme, araştırma sonrası)' },
};

const dir = path.join(ROOT, 'public', 'songs');
fs.writeFileSync(path.join(dir, 'gece-phonk-v2.json'), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === 'gece-phonk-v2.json')) {
  idx.unshift({ file: 'gece-phonk-v2.json', name: 'Gece Vardiyası v2 — Brazilian phonk, gerçek vokal nidalı (Claude besteledi)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
