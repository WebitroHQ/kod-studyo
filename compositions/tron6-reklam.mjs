// "TRON 6 — Işık" — TRON 6 reklam filmi (tron6-video/v2) için özgün müzik. 120 BPM, F majör, 24 ölçü = 48 sn.
// Filmle birebir: her bölüm (2 ölçü = 4 sn = 96 kare) bir sahnedir; 24. saniyede drop, fiberler aynı vuruşta çıkar.
// Gerçek kayıtlar (upright piyano, arp, keman, çello — VSCO 2 CE) + yumuşak sentez davul; robotik durmasın diye humanize.
// Çalıştır: node compositions/tron6-reklam.mjs  →  public/songs/tron6-reklam.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const kit = (spec, k) => Object.assign(makeTrack({ inst: 'multi', ...spec }), { kit: k });
const T = {
  piano: kit({ role: 'chords', name: 'Piyano (upright)', vol: 0.8, pan: -0.05, rev: 0.32, dly: 0.08, params: { release: 0.5, pedal: 0, width: 0.4, tone: 16000 } }, 'upright'),
  harp: kit({ role: 'melody', name: 'Arp', vol: 0.75, pan: 0.15, rev: 0.4, dly: 0.18, params: { release: 1.2, width: 0.45 } }, 'harp'),
  vln: kit({ role: 'pad', name: 'Keman seksiyonu', vol: 0.42, rev: 0.5, params: { attack: 0.35, release: 1.2, width: 0.4 } }, 'violins'),
  vlnLead: kit({ role: 'melody', name: 'Keman (melodi)', vol: 0.34, pan: -0.1, rev: 0.45, params: { attack: 0.06, release: 0.5, width: 0.2 } }, 'violins'),
  cello: kit({ role: 'pad', name: 'Çello seksiyonu', vol: 0.62, rev: 0.45, params: { attack: 0.4, release: 1.4, width: 0 } }, 'cellos'),
  pluck: makeTrack({ inst: 'pluck', role: 'counter', name: 'Parıltı (pluck)', oct: 5, vol: 0.34, pan: 0.3, rev: 0.35, dly: 0.3, params: { cutoff: 6500, decay: 0.28, wave: 1 } }),
  pad: makeTrack({ inst: 'pad', role: 'pad', name: 'Sıcak pad', oct: 3, vol: 0.26, rev: 0.55, duck: 0.3, params: { cutoff: 1200, attack: 1.0, release: 1.8 } }),
  bass: makeTrack({ inst: 'bass', role: 'bass', name: 'Bas', oct: 2, vol: 0.5, duck: 0.4, params: { cutoff: 850 } }),
  kick: makeTrack({ inst: 'kick', role: 'kick', vol: 0.8, params: { tune: 56, punch: 0.6, decay: 0.26, drive: 0.08, click: 0.45 } }),
  clap: makeTrack({ inst: 'clap', role: 'snare', vol: 0.58, rev: 0.22, params: { tone: 1600, decay: 0.18 } }),
  snare: makeTrack({ inst: 'snare', role: 'snare', name: 'Trampet (dolgu)', vol: 0.38, rev: 0.18, params: { tone: 210, snap: 0.6, decay: 0.12, drive: 0.1 } }),
  hat: makeTrack({ inst: 'hat', role: 'hat', name: 'Shaker / hat', vol: 0.62, pan: 0.22, params: { decay: 0.03, tone: 10500 } }),
  ohat: makeTrack({ inst: 'openhat', role: 'openhat', name: 'Açık hat', vol: 0.34, pan: -0.2, params: { decay: 0.22 } }),
  fx: makeTrack({ inst: 'fx', role: 'fx', vol: 0.42, rev: 0.35 }),
};

const N = (s, n, l = 1, v = 0.85, x = {}) => ({ s, n, l, v, ...x });
const hum = (v, s) => Math.max(0.3, Math.min(1, v + (((s * 7919) % 13) - 6) / 100));     // small, repeatable velocity variation
function grid(str, base = 60, vx = 0.9, vo = 0.5) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '.') continue;
    out.push(N(i, base, 1, hum(c === 'o' ? vo : vx, i)));
  }
  return out;
}
const two = (bar) => bar + bar;                    // a one-bar pattern over both bars

// ---------- harmony: | B♭maj9 | F/A | Dm7 | Csus4 → C |
const PROG = [
  { bass: 34, cello: 46, piano: [62, 65, 69, 72], arp: [58, 62, 65, 69, 72, 74], str: [62, 69] },
  { bass: 33, cello: 45, piano: [60, 65, 69, 72], arp: [57, 60, 65, 69, 72, 77], str: [60, 69] },
  { bass: 38, cello: 50, piano: [62, 65, 69, 72], arp: [57, 62, 65, 69, 72, 74], str: [62, 65] },
  { bass: 36, cello: 48, piano: [65, 67, 72, 76], arp: [55, 60, 65, 67, 72, 79], str: [60, 67], res: [64, 67, 72, 76] },
];
// bars of a section: which chords (2 bars per section)
const CH = (a, b) => [PROG[a], PROG[b]];

function chords(cs, style) {
  const out = [];
  cs.forEach((c, bar) => {
    const o = bar * 16;
    const pv = c.res && style !== 'whole' ? c.piano.slice(0, 2).concat([72, 76]) : c.piano;
    if (style === 'whole') c.piano.forEach((n) => out.push(N(o, n, 16, 0.62)));
    else if (style === 'stab') {
      c.piano.forEach((n) => out.push(N(o, n, 6, hum(0.72, o + n))));
      pv.forEach((n) => out.push(N(o + 6, n, 2, hum(0.5, o + n))));
      pv.forEach((n) => out.push(N(o + 10, n, 5, hum(0.6, o + n))));
    }
  });
  return out;
}
function arps(cs, rate = 2, v = 0.6, up = true) {
  const out = [];
  cs.forEach((c, bar) => {
    const seq = up ? c.arp : [...c.arp].reverse();
    for (let k = 0, s = 0; s < 16; s += rate, k++) out.push(N(bar * 16 + s, seq[k % seq.length] + 12, rate + 2, hum(v * (s % 8 === 0 ? 1.1 : 0.9), s + bar)));
  });
  return out;
}
const bassLine = (cs, pat = [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]]) =>
  cs.flatMap((c, bar) => pat.map(([s, l], j) => N(bar * 16 + s, c.bass, l, hum(j ? 0.72 : 0.9, s + bar))));
const strings = (cs, v = 0.55) => cs.flatMap((c, bar) => c.str.map((n) => N(bar * 16, n + 12, 16, v)));
const cellos = (cs, v = 0.6) => cs.map((c, bar) => N(bar * 16, c.cello, 16, v));
const pads = (cs, v = 0.45) => cs.flatMap((c, bar) => c.piano.slice(0, 3).map((n) => N(bar * 16, n - 12, 16, v)));

// melody (drop): 4 bars over the 4 chords, split over two sections
const MEL = [
  [0, 81, 3], [3, 84, 3], [6, 81, 2], [8, 79, 4], [12, 77, 4],
  [16, 72, 3], [19, 77, 3], [22, 79, 2], [24, 81, 8],
  [32, 81, 3], [35, 84, 3], [38, 86, 2], [40, 84, 4], [44, 81, 4],
  [48, 79, 3], [51, 81, 3], [54, 79, 2], [56, 76, 4], [60, 79, 4],
];
const mel = (half, v = 0.8, shift = 0) => MEL.filter(([s]) => (half ? s >= 32 : s < 32)).map(([s, n, l]) => N(s - (half ? 32 : 0), n + shift, l, hum((s % 16 === 0 ? 0.9 : 0.78) * v, s)));

// drums
const K_HALF = two('x.......x.....o.'), K_FOUR = two('x...x...x...x...');
const CLAP = two('....x.......x...');
const SHAKER = two('x.o.x.o.x.o.x.oo'), HAT16 = two('xoxoxoxoxoxoxoxo');
const OHAT = two('..x...x...x...x.');

const soft = (evs, k = 0.72) => evs.map((e) => ({ ...e, v: e.v * k }));
// the last beat of a drop section: a snare/clap fill and a harp run up into the next downbeat (no hole before 28 s / 32 s)
const FILL = { snare: [28, 29, 30, 31].map((st, k) => N(st, 60, 1, 0.5 + k * 0.12)), clapF: [N(30, 60, 1, 0.6), N(31, 60, 1, 0.75)],
  run: [77, 79, 81, 84].map((n, k) => N(28 + k, n, 3, 0.62 + k * 0.05)) };
const ids = Object.fromEntries(Object.entries(T).map(([k, t]) => [k, t.id]));
const patterns = {}, patternMeta = {};
function sec(pid, type, parts) {
  patterns[pid] = Object.fromEntries(Object.values(ids).map((id) => [id, []]));
  for (const [k, evs] of Object.entries(parts)) patterns[pid][ids[k]] = evs;
  patternMeta[pid] = { type, name: pid };
}

// 1  0–4 sn  karanlık: çello + pad, her vuruşta bir port yanar → arp her vuruşta bir nota (2. vuruştan itibaren)
sec('S1', 'intro', {
  cello: [N(0, 41, 32, 0.55)], pad: pads(CH(0, 0), 0.35), fx: [N(0, 60, 30, 0.5)],
  harp: [72, 74, 77, 79, 81, 84].map((n, k) => N(8 + 4 * k, n, 6, 0.7 + k * 0.03)),
  pluck: [72, 74, 77, 79, 81, 84].map((n, k) => N(8 + 4 * k, n, 1, 0.45)),
});
// 2  4–8 sn  stüdyo: ritim girer (hafif), piyano + bas; kelimeler vuruşla döner
sec('S2', 'verse', {
  kick: soft(grid(K_HALF), 0.7), clap: grid(CLAP, 60, 0.7), hat: grid(SHAKER, 60, 0.75, 0.4), piano: soft(chords(CH(0, 1), 'stab'), 0.8), bass: soft(bassLine(CH(0, 1)), 0.7),
  pad: pads(CH(0, 1), 0.3), fx: [N(0, 62, 1, 0.75)],
});
// 3  8–12 sn  parçalar vuruşlarda kalkar: arp vurguları
sec('S3', 'verse', {
  kick: soft(grid(K_HALF), 0.7), clap: grid(CLAP, 60, 0.7), hat: grid(SHAKER, 60, 0.75, 0.4), piano: soft(chords(CH(2, 3), 'stab'), 0.8), bass: soft(bassLine(CH(2, 3)), 0.7),
  harp: [N(12, 77, 4, 0.7), N(16, 79, 4, 0.72), N(20, 81, 4, 0.74), N(24, 84, 4, 0.76)], pad: pads(CH(2, 3), 0.3),
});
// 4  12–16 sn  LED makroları: yaylılar girer
sec('S4', 'verse', {
  kick: soft(grid(K_HALF), 0.7), clap: grid(CLAP, 60, 0.7), hat: grid(HAT16, 60, 0.6, 0.32), piano: soft(chords(CH(0, 1), 'stab'), 0.8), bass: soft(bassLine(CH(0, 1)), 0.7),
  vln: strings(CH(0, 1), 0.5), pluck: arps(CH(0, 1), 2, 0.5),
});
// 5  16–20 sn  kontrol kartı
sec('S5', 'verse', {
  kick: soft(grid(K_HALF), 0.7), clap: grid(CLAP, 60, 0.7), hat: grid(HAT16, 60, 0.6, 0.32), piano: soft(chords(CH(2, 3), 'stab'), 0.8), bass: soft(bassLine(CH(2, 3)), 0.7),
  vln: strings(CH(2, 3), 0.5), pluck: arps(CH(2, 3), 2, 0.5), harp: arps(CH(2, 3), 4, 0.5, false),
});
// 6  20–24 sn  parçalar yerine oturur, ışıklar söner: yükseliş, son yarım ölçü sessizlik ("Ve en güzel kısmı…")
sec('S6', 'build', {
  kick: grid('x.......x.......x...x...'), clap: grid('....x.......x...'),
  snare: [...grid('........x.x.x.x.', 60, 0.6), ...[16, 17, 18, 19, 20, 21, 22, 23].map((s, k) => N(s, 60, 1, 0.45 + k * 0.06))],
  hat: grid('xoxoxoxoxoxoxoxoxoxoxoxo', 60, 0.6, 0.32), piano: chords(CH(0, 1), 'stab').filter((e) => e.s < 24), bass: bassLine(CH(0, 1)).filter((e) => e.s < 24),
  vln: [N(0, 74, 24, 0.5), N(0, 81, 24, 0.5)], fx: [N(4, 60, 20, 0.85)],
});
// 7–8  24–32 sn  DROP: fiberler patlar — tam kadro, melodi arp + keman
sec('D1', 'drop', {
  kick: grid(K_FOUR), clap: grid(CLAP).concat(FILL.clapF), snare: FILL.snare, hat: grid(HAT16, 60, 0.7, 0.35), ohat: grid(OHAT, 60, 0.6), piano: chords(CH(0, 1), 'stab'), bass: bassLine(CH(0, 1)),
  vln: strings(CH(0, 1), 0.55), cello: cellos(CH(0, 1)), harp: mel(0).concat(FILL.run), vlnLead: mel(0, 0.7), pluck: mel(0, 0.6, 12), fx: [N(0, 62, 1, 1.0)],
});
sec('D2', 'drop', {
  kick: grid(K_FOUR), clap: grid(CLAP).concat(FILL.clapF), snare: FILL.snare, hat: grid(HAT16, 60, 0.7, 0.35), ohat: grid(OHAT, 60, 0.6), piano: chords(CH(2, 3), 'stab'), bass: bassLine(CH(2, 3)),
  vln: strings(CH(2, 3), 0.55), cello: cellos(CH(2, 3)), harp: mel(1).concat(FILL.run), vlnLead: mel(1, 0.7), pluck: mel(1, 0.6, 12),
});
// 9  32–36 sn  yıldız tavan: rüya gibi ara — davul yok, arp akışı, yaylılar
sec('B1', 'break', {
  harp: arps(CH(0, 1), 1, 0.45), vln: strings(CH(0, 1), 0.45), cello: cellos(CH(0, 1), 0.5), pad: pads(CH(0, 1), 0.4),
  hat: grid('................................'.slice(0, 24) + 'x.x.xoxo', 60, 0.5, 0.3), fx: [N(16, 60, 16, 0.55)],
});
// 10  36–40 sn  ses modu: her vuruşta kick (ışıklar vuruşla yanar)
sec('M1', 'drop2', {
  kick: grid(K_FOUR), clap: grid(CLAP), hat: grid(HAT16, 60, 0.7, 0.35), ohat: grid(OHAT, 60, 0.6), piano: chords(CH(2, 3), 'stab'), bass: bassLine(CH(2, 3)),
  vln: strings(CH(2, 3), 0.55), harp: mel(0), vlnLead: mel(0, 0.6), fx: [N(0, 62, 1, 0.7)],
});
// 11  40–44 sn  kapanış: melodi çözülür, ritim incelir
sec('E1', 'outro', {
  kick: grid('x...............x...............'), clap: grid('....x.......x...'), hat: grid(SHAKER.slice(0, 16), 60, 0.55, 0.3),
  piano: chords(CH(0, 1), 'whole'), vln: strings(CH(0, 1), 0.5), cello: cellos(CH(0, 1), 0.55), bass: [N(0, 34, 14, 0.7), N(16, 33, 14, 0.7)],
  harp: [N(0, 81, 4, 0.75), N(4, 79, 4, 0.7), N(8, 77, 8, 0.72), N(16, 76, 4, 0.7), N(20, 77, 12, 0.75)],
});
// 12  44–48 sn  son akor: Fadd9, arp yukarı süzülür
sec('E2', 'outro', {
  piano: [N(0, 53, 32, 0.6), N(0, 60, 32, 0.55), N(0, 67, 32, 0.5), N(0, 69, 32, 0.55), N(0, 72, 32, 0.5)], cello: [N(0, 41, 32, 0.55)],
  vln: [N(0, 77, 32, 0.45), N(0, 81, 32, 0.4)], pad: [N(0, 53, 32, 0.35), N(0, 57, 32, 0.35), N(0, 60, 32, 0.35)],
  harp: [65, 69, 72, 74, 77, 81, 84, 89].map((n, k) => N(k, n, 24, 0.55 + k * 0.03)), bass: [N(0, 29, 20, 0.6)],
});

const seq = [['Karanlık', 'S1'], ['Stüdyo', 'S2'], ['Parçalar', 'S3'], ['LED', 'S4'], ['Kart', 'S5'], ['Yükseliş', 'S6'],
  ['Drop', 'D1'], ['Drop', 'D2'], ['Yıldız tavan', 'B1'], ['Ses modu', 'M1'], ['Kapanış', 'E1'], ['Son akor', 'E2']];
const arrangement = seq.map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'TRON 6 — Işık (reklam müziği)',
  bpm: 120, swing: 0, humanize: 7, root: 'F', scale: 'major',
  tracks: Object.values(T), patterns, patternMeta, arrangement,
  master: { low: 0, high: 3, drive: 0.12, glue: 0.45, makeup: 3, ceiling: -1, reverb: 1.7 },
  meta: { genre: 'pop', seed: 'tron6', prog: [0, 0, 3, 4], target: -12, composedBy: 'Claude (TRON 6 reklam filmi için, filme kilitli)' },
};

const dir = path.join(ROOT, 'public', 'songs');
fs.writeFileSync(path.join(dir, 'tron6-reklam.json'), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === 'tron6-reklam.json')) {
  idx.unshift({ file: 'tron6-reklam.json', name: 'TRON 6 — Işık (reklam filmi müziği, Claude)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
