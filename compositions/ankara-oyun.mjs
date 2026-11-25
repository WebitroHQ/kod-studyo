// "Ankara Gecesi" — yeni nesil Ankara rap oyun havası (beat). Elle (AI) bestelendi.
// Çalıştır: node compositions/ankara-oyun.mjs  →  public/songs/ankara-oyun.json
// A kürdi (A Bb C D E F G), 140 BPM yarım tempo trap. Oyun havası "kısa ve bol tekrarlı": 2 ölçülük bağlama
// riffi (Ankara tavrı: yoğun 16'lık tezene, uzun notalarda tremolo) tüm parçayı taşır; altında düm-tek-tek
// darbuka, kaşık ve def; üstünde trap davul + kayan 808; keman cevapları (VSCO 2 CE kaydı); TTS nidalar.
// Not: bu bir beat — üstüne rap okunacak alan bırakılmış (verse bölümlerinde melodi seyrek).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const shout = (name, file, extra = {}) => Object.assign(
  makeTrack({ inst: 'sampler', role: 'vox', name, vol: 0.8, rev: 0.2, dly: 0.12, ...extra, params: { rootNote: 60, oneShot: 1, gain: 1 } }),
  { sampleUrl: '/kits/ankara/' + file });

const T = {
  baglama: makeTrack({ preset: 'baglama', name: 'Bağlama (Ankara tavrı)', role: 'melody', oct: 4, vol: 1.2, pan: 0.05, rev: 0.15, dly: 0.05, params: { bright: 0.93, decay: 0.9, course: 1 } }),
  baglama2: makeTrack({ preset: 'baglama', name: 'Bağlama (oktav altı)', role: 'counter', oct: 3, vol: 0.55, pan: -0.35, rev: 0.1, params: { bright: 0.85, decay: 0.7, course: 1 } }),
  keman: Object.assign(makeTrack({ inst: 'multi', role: 'counter', name: 'Keman', oct: 4, vol: 0.9, pan: 0.3, rev: 0.3, dly: 0.1, params: { attack: 0.03, release: 0.25, width: 0 } }), { kit: 'violins' }),
  kick: makeTrack({ inst: 'kick', role: 'kick', vol: 1.0, params: { tune: 62, punch: 0.8, decay: 0.22, drive: 0.4, click: 0.7 } }),
  snare: makeTrack({ inst: 'snare', role: 'snare', vol: 0.9, rev: 0.12, params: { tone: 210, snap: 0.9, decay: 0.16, drive: 0.35 } }),
  clap: makeTrack({ inst: 'clap', role: 'snare', name: 'Clap katmanı', vol: 0.6, rev: 0.15 }),
  hat: makeTrack({ inst: 'hat', role: 'hat', vol: 0.7, pan: 0.2, params: { decay: 0.03, tone: 9000 } }),
  b808: makeTrack({ preset: 'b808', name: '808', vol: 0.45, duck: 0.25, params: { drive: 0.75, decay: 0.9, glide: 0.08, punch: 0.6, sub: 0.35, tone: 3000 } }),
  dum: makeTrack({ inst: 'perc', role: 'perc', name: 'Darbuka (düm)', vol: 0.45, params: { kind: 1, tone: 165, decay: 0.1 } }),
  tek: makeTrack({ inst: 'perc', role: 'perc', name: 'Darbuka (tek)', vol: 0.8, pan: -0.2, params: { kind: 0, tone: 720, decay: 0.045 } }),
  kasik: makeTrack({ inst: 'perc', role: 'perc', name: 'Kaşık', vol: 0.55, pan: 0.4, params: { kind: 0, tone: 1900, decay: 0.02 } }),
  def: makeTrack({ inst: 'perc', role: 'perc', name: 'Def zilleri', vol: 0.45, pan: -0.4, params: { kind: 2, decay: 0.09 } }),
  hoppa: shout('Nida: "Hoppaa!"', 'hoppa-harry.wav'),
  oley: shout('Nida: "Oleey!"', 'oley-charlie.wav', { pan: 0.2 }),
  haydi: shout('Nida: "Haydi!"', 'haydi-harry.wav'),
  ankara: shout('Nida: "Ankaraa!"', 'ankara-charlie.wav', { vol: 0.85, rev: 0.3 }),
  hey: shout('Nida: "Hey!"', 'hey-harry.wav', { pan: -0.2 }),
  fx: makeTrack({ inst: 'fx', role: 'fx', vol: 0.5, rev: 0.3 }),
};

const N = (s, n, l = 1, v = 0.9, x = {}) => ({ s, n, l, v, ...x });
const split = (evs) => [evs.filter((e) => e.s < 32), evs.filter((e) => e.s >= 32).map((e) => ({ ...e, s: e.s - 32 }))];
const rep4 = (two) => two.concat(two.map((e) => ({ ...e, s: e.s + 32 }))); // 2 ölçüyü 4 ölçüye çoğalt
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

// ---------- bağlama riffi (A kürdi: A4 69, Bb 70, C5 72, D 74, E 76, F 77, G 79) ----------
// [adım, nota, uzunluk, tremolo(ratchet)]
const RIFF = [
  [0, 76], [1, 74], [2, 76], [3, 77], [4, 76], [5, 74], [6, 72], [7, 74], [8, 76, 2, 2], [10, 74], [11, 72], [12, 70], [13, 72], [14, 69, 2, 2],
  [16, 69], [17, 70], [18, 72], [19, 74], [20, 76, 2, 2], [22, 77], [23, 76], [24, 74], [25, 72], [26, 70], [27, 72], [28, 69, 4, 3],
];
// B bölümü cevabı: üst bölgeye çıkar (F5–A5), sonra aynı yere iner
const RIFF_B = [
  [0, 81], [1, 79], [2, 81], [3, 82], [4, 81], [5, 79], [6, 77], [7, 79], [8, 81, 2, 2], [10, 79], [11, 77], [12, 76], [13, 77], [14, 74, 2, 2],
  [16, 76], [17, 77], [18, 76], [19, 74], [20, 72, 2, 2], [22, 74], [23, 72], [24, 70], [25, 72], [26, 70], [27, 69], [28, 69, 4, 3],
];
const toEvs = (r, vs = 1) => r.map(([s, n, l = 1, rr = 1]) => N(s, n, l, (s % 4 === 0 ? 0.95 : 0.8) * vs, rr > 1 ? { r: rr } : {}));

// keman: B bölümünde uzun cevap notaları, drop'ta riffi seyrek ikiler
const KEMAN_B = [N(0, 69, 6, 0.85), N(6, 70, 2, 0.8), N(8, 72, 6, 0.85), N(14, 74, 2, 0.8), N(16, 72, 4, 0.85), N(20, 70, 4, 0.8), N(24, 69, 8, 0.85)];
const KEMAN_A = [N(8, 64, 2, 0.75), N(14, 57, 2, 0.75), N(20, 64, 2, 0.75), N(28, 57, 4, 0.75)];

// ---------- davullar ----------
// trap (yarım tempo): kick senkoplu, snare 3. vuruşta; hat 8'lik + roll'lar
const KICK = ['x......x..x.....', 'x.x.......x..x..', 'x......x..x.....', 'x.x.......x.x...'];
const SNARE = ['........x.......', '........x.......', '........x.......', '........x.....x.'];
const HAT = ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.3.x.', 'x.x.x.x.x.x.x.x.', 'x.x.4.x.x.x.3.3.'];
// darbuka: Ankara oyun havası düm-tek-tek kalıbı çift zamanda (her yarım ölçüde: düm . tek tek düm . tek .)
const DUM = ['x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', 'x...x...x...x.x.'];
const TEK = ['..xx..x...xx..x.', '..xx..x...xx..x.', '..xx..x...xx..x.', '..xx..x...x2.3x.'];
const KASIK = ['x.xxx.xxx.xxx.xx', 'x.xxx.xxx.xxx.xx', 'x.xxx.xxx.xxx.xx', 'x.xxx.xxx.xxxxxx'];
const DEF = ['..x...x...x...x.', '..x...x...x...x.', '..x...x...x...x.', '..x...x...x...x.'];

// ---------- 808: A G F E (kürdi bas inişi) ----------
const ROOTS = [33, 31, 29, 28];
function bass808() {
  const out = [];
  ROOTS.forEach((r, bar) => {
    const ks = [];
    for (let i = 0; i < 16; i++) if (KICK[bar][i] === 'x') ks.push(i);
    ks.forEach((k, j) => {
      const next = j + 1 < ks.length ? ks[j + 1] : 16;
      const ev = N(bar * 16 + k, r, next - k, 0.95);
      if (j === 0 && bar > 0) ev.g = 1;
      if (j === ks.length - 1 && bar === 3) { ev.n = r + 12; ev.g = 1; }
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
const perc = (vs = 1) => ({
  dum: grid(DUM).map((e) => ({ ...e, v: e.v * vs })), tek: grid(TEK).map((e) => ({ ...e, v: e.v * vs })),
  kasik: grid(KASIK).map((e) => ({ ...e, v: e.v * 0.8 * vs })), def: grid(DEF).map((e) => ({ ...e, v: e.v * vs })),
});

// Giriş: bağlama riffi + darbuka/kaşık, sonda "Haydi!" + riser
addPair('I', 'intro', {
  baglama: rep4(toEvs(RIFF, 0.9)), ...perc(0.85),
  haydi: [N(60, 60, 1, 1)], fx: [N(32, 60, 32, 0.8)],
});
// Nakarat (drop): tam kadro
addPair('A', 'drop', {
  baglama: rep4(toEvs(RIFF)), baglama2: rep4(toEvs(RIFF.filter(([s]) => s % 2 === 0), 0.8)).map((e) => ({ ...e, n: e.n - 12 })),
  keman: rep4(KEMAN_A), kick: grid(KICK), snare: grid(SNARE), clap: grid(SNARE), hat: grid(HAT), b808: bass808(), ...perc(),
  hoppa: [N(0, 60, 1, 1)], oley: [N(30, 60, 1, 0.9)], hey: [N(46, 60, 1, 0.85), N(47, 60, 1, 0.8)], fx: [N(0, 62, 1, 0.9)],
});
// Verse (rap alanı): bağlama seyrek, davul + darbuka, 808
addPair('V', 'verse', {
  baglama: rep4(toEvs(RIFF.filter(([s]) => s < 8 || (s >= 16 && s < 22)), 0.75)),
  kick: grid(KICK), snare: grid(SNARE), clap: grid(SNARE), hat: grid(HAT), b808: bass808(), ...perc(0.85),
});
// Kırılma: keman uzun cümle, def + darbuka, kick yok; sonda "Ankaraa!"
addPair('K', 'break', {
  keman: rep4(KEMAN_B), baglama2: rep4(toEvs(RIFF.filter(([s]) => s % 4 === 0), 0.6)).map((e) => ({ ...e, n: e.n - 12 })),
  dum: grid(DUM).filter((e) => e.s % 8 === 0), tek: grid(TEK).map((e) => ({ ...e, v: e.v * 0.7 })), def: grid(DEF),
  b808: [N(0, 33, 16), N(16, 31, 16, 0.9, { g: 1 }), N(32, 29, 16, 0.9, { g: 1 }), N(48, 28, 12, 0.9, { g: 1 })],
  ankara: [N(56, 60, 1, 1)], snare: [N(56, 60, 1, 0.6), N(58, 60, 1, 0.7), N(60, 60, 1, 0.8, { r: 2 }), N(62, 60, 1, 0.9, { r: 4 })],
  fx: [N(32, 60, 32, 0.85)],
});
// Nakarat 2: üst bölge riffi + keman ikilemesi + yoğun hat
addPair('B', 'drop2', {
  baglama: rep4(toEvs(RIFF_B)), keman: rep4(toEvs(RIFF_B.filter(([s, , l = 1]) => l >= 2 || s % 4 === 0), 0.75)).map((e) => ({ ...e, n: e.n - 12, r: undefined })),
  baglama2: rep4(toEvs(RIFF.filter(([s]) => s % 2 === 0), 0.8)).map((e) => ({ ...e, n: e.n - 12 })),
  kick: grid(KICK), snare: grid(SNARE), clap: grid(SNARE), hat: grid(HAT.map((h, i) => (i % 2 ? 'x.x.x.x.x.3.3.x.' : h))), b808: bass808(), ...perc(),
  hoppa: [N(0, 60, 1, 1)], oley: [N(14, 60, 1, 0.9), N(46, 60, 1, 0.9)], hey: [N(30, 60, 1, 0.85), N(62, 60, 1, 0.85)], fx: [N(0, 62, 1, 0.9)],
});
// Çıkış: bağlama tek başına, son "Oleey!"
addPair('O', 'outro', {
  baglama: toEvs(RIFF, 0.85).concat([N(32, 69, 8, 0.9, { r: 3 })]), ...perc(0.7),
  oley: [N(32, 60, 1, 1)], fx: [N(32, 62, 1, 0.8)],
});

const arrangement = [
  ['Giriş', 'I1'], ['Giriş', 'I2'],
  ['Nakarat', 'A1'], ['Nakarat', 'A2'], ['Nakarat', 'A1'], ['Nakarat', 'A2'],
  ['Verse (rap)', 'V1'], ['Verse (rap)', 'V2'], ['Verse (rap)', 'V1'], ['Verse (rap)', 'V2'],
  ['Kırılma', 'K1'], ['Kırılma', 'K2'],
  ['Nakarat 2', 'B1'], ['Nakarat 2', 'B2'], ['Nakarat 2', 'B1'], ['Nakarat 2', 'B2'],
  ['Nakarat', 'A1'], ['Nakarat', 'A2'],
  ['Çıkış', 'O1'], ['Çıkış', 'O2'],
].map(([name, pattern]) => ({ name, pattern, reps: 1 }));

const song = {
  name: 'Ankara Gecesi (yeni nesil Ankara rap oyun havası)',
  bpm: 140, swing: 0.05, humanize: 5, root: 'A', scale: 'phrygian',
  tracks: Object.values(T),
  patterns, patternMeta, arrangement,
  master: { low: 1.5, high: 2, drive: 0.35, glue: 0.55, makeup: 5, ceiling: -0.4, reverb: 1.6 },
  meta: { genre: 'trap', seed: 'ankara-gecesi', prog: [0, 6, 5, 4], target: -9, composedBy: 'Claude (elle besteleme)' },
};

const dir = path.join(ROOT, 'public', 'songs');
fs.writeFileSync(path.join(dir, 'ankara-oyun.json'), JSON.stringify(song));
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
if (!idx.some((d) => d.file === 'ankara-oyun.json')) {
  idx.unshift({ file: 'ankara-oyun.json', name: 'Ankara Gecesi — yeni nesil Ankara rap oyun havası (Claude besteledi)' });
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
}
const count = Object.values(patterns).reduce((a, p) => a + Object.values(p).reduce((b, e) => b + e.length, 0), 0);
console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${count} nota, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
