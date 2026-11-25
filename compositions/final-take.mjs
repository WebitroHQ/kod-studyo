// FINAL TAKE (Epic AI MegaJam 2026) — two cues for the game, written by Claude with Kod Stüdyo's own engine (no AI audio).
//  1) "On Set": the loop under shooting and editing. Crime-caper / spy jazz: walking upright-style bass, brushed kit,
//     muted piano stabs, a cool brass riff, low strings. D minor, 104 BPM, loops cleanly (starts and ends on Dm).
//  2) "That's a Wrap": a short triumphant brass + strings fanfare for the Director's Cut, D major, 116 BPM.
// Run: node compositions/final-take.mjs  →  public/songs/final-take-set.json, final-take-wrap.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTrack } from '../public/js/generator.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const N = (s, n, l = 1, v = 0.7) => ({ s, n, l, v });
const split = (evs) => [evs.filter((e) => e.s < 32), evs.filter((e) => e.s >= 32).map((e) => ({ ...e, s: e.s - 32 }))];

function build(T) {
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
  return { patterns, patternMeta, addPair };
}

function save(file, label, song, arrangement) {
  const dir = path.join(ROOT, 'public', 'songs');
  fs.writeFileSync(path.join(dir, file), JSON.stringify(song));
  const idxFile = path.join(dir, 'index.json');
  const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
  if (!idx.some((d) => d.file === file)) {
    idx.unshift({ file, name: label });
    fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
  }
  console.log(`yazıldı: ${song.name} — ${arrangement.length} bölüm, ${(arrangement.length * 32 * 60 / song.bpm / 4).toFixed(1)} sn`);
}

// ======================================================================== 1) ON SET (loop)
{
  const T = {
    kick: makeTrack({ inst: 'kick', name: 'Kick (soft)', vol: 0.55 }),
    snare: makeTrack({ inst: 'snare', name: 'Rim / brush', vol: 0.4, rev: 0.25 }),
    hat: makeTrack({ inst: 'hat', name: 'Ride / brush hat', vol: 0.35, pan: 0.2 }),
    bass: makeTrack({ inst: 'bassgtr', role: 'bass', name: 'Walking bass', oct: 2, vol: 0.85 }),
    piano: makeTrack({ inst: 'piano', role: 'chords', name: 'Piano stabs', oct: 4, vol: 0.55, pan: -0.15, rev: 0.3, params: { tone: 0.35, decay: 1.2, trem: 0 } }),
    brass: makeTrack({ inst: 'brass', role: 'melody', name: 'Brass riff', oct: 4, vol: 0.55, pan: 0.15, rev: 0.35 }),
    strings: makeTrack({ inst: 'strings', role: 'pad', name: 'Low strings', oct: 3, vol: 0.35, rev: 0.45, params: { attack: 0.6, release: 1.2, bright: 1400, vib: 0.2 } }),
    bell: makeTrack({ inst: 'bell', role: 'counter', name: 'Vibes', oct: 6, vol: 0.3, pan: 0.3, rev: 0.5, dly: 0.2 }),
  };
  const { patterns, patternMeta, addPair } = build(T);

  // two-bar grid = 32 steps (16ths); a 4-bar phrase = 64 steps. Chords: Dm7 | Bbmaj7 | Gm7 | A7
  const ROOTS = { Dm: 38, Bb: 34, Gm: 31, A: 33, Eb: 39 };
  const walk = {
    Dm: [38, 41, 43, 44], Bb: [34, 38, 41, 40], Gm: [31, 34, 38, 37], A: [33, 37, 40, 39], Eb: [39, 43, 46, 45],
  };
  const PIANO = { Dm: [62, 65, 69, 72], Bb: [62, 65, 69, 70], Gm: [62, 65, 67, 70], A: [61, 64, 67, 69], Eb: [63, 67, 70, 74] };
  const STR = { Dm: [50, 57], Bb: [46, 53], Gm: [43, 50], A: [45, 52], Eb: [51, 58] };
  const prog = (chords) => chords;
  const bassLine = (ch, v = 0.75) => ch.flatMap((c, bar) => walk[c].map((n, i) => N(bar * 16 + i * 4, n, 3, v + (i === 0 ? 0.1 : 0))));
  // muted piano on the off-beats ("and" of 2 and 4), short
  const stabs = (ch, v = 0.5) => ch.flatMap((c, bar) => [6, 14].flatMap((st) => PIANO[c].map((n) => N(bar * 16 + st, n, 1, v))));
  const strings = (ch, v = 0.5) => ch.flatMap((c, bar) => STR[c].map((n) => N(bar * 16, n, 16, v)));
  const kick = (bars) => Array.from({ length: bars }, (_, b) => [N(b * 16, 60, 1, 0.6), N(b * 16 + 8, 60, 1, 0.45)]).flat();
  const rim = (bars) => Array.from({ length: bars }, (_, b) => [N(b * 16 + 4, 60, 1, 0.55), N(b * 16 + 12, 60, 1, 0.6)]).flat();
  // swung ride: 1, 2 & a, 3, 4 & a
  const ride = (bars) => Array.from({ length: bars }, (_, b) => [0, 4, 7, 8, 12, 15].map((s) => N(b * 16 + s, 60, 1, s % 4 ? 0.35 : 0.55))).flat();
  // the hook: a cool, sneaky brass riff (D dorian-ish), call in bars 1-2, answer in 3-4
  const RIFF = [[0, 62, 2], [3, 65, 1], [4, 67, 2], [7, 69, 3], [12, 72, 2], [14, 70, 2], [16, 69, 6], [24, 67, 2], [26, 65, 2], [28, 62, 4],
                [32, 62, 2], [35, 65, 1], [36, 67, 2], [39, 69, 3], [44, 74, 4], [48, 73, 6], [56, 69, 6]].map(([s, n, l]) => N(s, n, l, 0.65));
  const VIB = [[10, 81, 4], [26, 77, 4], [42, 81, 4], [58, 76, 6]].map(([s, n, l]) => N(s, n, l, 0.4));

  const A = prog(['Dm', 'Bb', 'Gm', 'A']);
  const B = prog(['Eb', 'Dm', 'Eb', 'A']);
  addPair('I', 'intro', { bass: bassLine(A, 0.65), hat: ride(4), strings: strings(A, 0.4) });
  addPair('A', 'verse', { bass: bassLine(A), kick: kick(4), snare: rim(4), hat: ride(4), piano: stabs(A), strings: strings(A, 0.35) });
  addPair('H', 'drop', { bass: bassLine(A), kick: kick(4), snare: rim(4), hat: ride(4), piano: stabs(A, 0.45), brass: RIFF, strings: strings(A, 0.4) });
  addPair('B', 'break', { bass: bassLine(B, 0.7), hat: ride(4), piano: stabs(B, 0.4), strings: strings(B, 0.5), bell: VIB });
  const seq = [['Intro', 'I1'], ['Intro', 'I2'], ['Groove', 'A1'], ['Groove', 'A2'], ['Hook', 'H1'], ['Hook', 'H2'],
               ['Bridge', 'B1'], ['Bridge', 'B2'], ['Hook', 'H1'], ['Hook', 'H2'], ['Groove', 'A1'], ['Groove', 'A2']];
  const arrangement = seq.map(([name, pattern]) => ({ name, pattern, reps: 1 }));
  const song = {
    name: 'Final Take — On Set (loop)', bpm: 104, swing: 0.18, root: 'D', scale: 'minor',
    tracks: Object.values(T), patterns, patternMeta, arrangement,
    master: { low: 1, high: 0.5, drive: 0.15, glue: 0.4, makeup: 5, ceiling: -1, reverb: 1.6 },
    meta: { genre: 'jazz_caper', seed: 'final-take-set', target: -14, composedBy: 'Claude (elle besteleme)' },
  };
  save('final-take-set.json', 'Final Take — On Set (spy jazz loop, Claude besteledi)', song, arrangement);
}

// ======================================================================== 2) THAT'S A WRAP (fanfare)
{
  const T = {
    kick: makeTrack({ inst: 'kick', name: 'Timpani-ish kick', vol: 0.7, rev: 0.3 }),
    snare: makeTrack({ inst: 'snare', name: 'Snare roll', vol: 0.45, rev: 0.4 }),
    brass: makeTrack({ inst: 'brass', role: 'melody', name: 'Brass fanfare', oct: 4, vol: 0.75, rev: 0.45 }),
    brass2: makeTrack({ inst: 'brass', role: 'chords', name: 'Brass chords', oct: 3, vol: 0.55, pan: -0.2, rev: 0.45 }),
    strings: makeTrack({ inst: 'strings', role: 'pad', name: 'Strings', oct: 4, vol: 0.55, pan: 0.2, rev: 0.55, params: { attack: 0.25, release: 1.5, bright: 2600, vib: 0.4 } }),
    bass: makeTrack({ inst: 'bassgtr', role: 'bass', name: 'Bass', oct: 2, vol: 0.7 }),
    bell: makeTrack({ inst: 'bell', role: 'counter', name: 'Glock', oct: 6, vol: 0.4, rev: 0.6 }),
  };
  const { patterns, patternMeta, addPair } = build(T);
  const roll = (from, to, v0, v1) => Array.from({ length: to - from }, (_, i) => N(from + i, 60, 1, v0 + (v1 - v0) * i / (to - from)));
  const CH = { D: [62, 66, 69], G: [62, 67, 71], A: [61, 64, 69], Bm: [62, 66, 71] };
  const chords = (list, len = 16, v = 0.6) => list.flatMap((c, i) => CH[c].map((n) => N(i * len, n - 12, len, v)));
  const strings = (list, len = 16, v = 0.55) => list.flatMap((c, i) => CH[c].map((n) => N(i * len, n, len, v)));
  const bass = (list, len = 16) => list.map((c, i) => N(i * len, { D: 38, G: 43, A: 45, Bm: 47 }[c], len, 0.8));
  // the fanfare: D - A - D up to F#, a triumphant rise
  const FAN = [[0, 62, 2], [2, 62, 1], [3, 62, 1], [4, 69, 6], [10, 69, 2], [12, 71, 2], [14, 73, 2],
               [16, 74, 8], [24, 73, 2], [26, 71, 2], [28, 69, 4], [32, 71, 4], [36, 74, 4], [40, 78, 10], [50, 76, 2], [52, 74, 12]].map(([s, n, l]) => N(s, n, l, 0.8));
  addPair('R', 'intro', { snare: roll(16, 32, 0.25, 0.75).concat(roll(48, 64, 0.3, 0.85)), kick: [N(0, 60, 1, 0.8), N(32, 60, 1, 0.8), N(60, 60, 1, 0.9)], strings: strings(['D', 'A'], 32, 0.4), bass: bass(['D', 'A'], 32) });
  addPair('F', 'drop', { brass: FAN, brass2: chords(['D', 'G', 'A', 'D']), strings: strings(['D', 'G', 'A', 'D']), bass: bass(['D', 'G', 'A', 'D']),
    kick: [0, 16, 32, 48].map((s) => N(s, 60, 1, 0.8)), bell: [[20, 86, 4], [44, 90, 6], [56, 86, 8]].map(([s, n, l]) => N(s, n, l, 0.45)) });
  addPair('E', 'outro', { brass: [N(0, 74, 28, 0.85), N(0, 78, 28, 0.7)], brass2: chords(['D'], 32, 0.7), strings: strings(['D'], 32, 0.6).concat([N(0, 86, 30, 0.4)]),
    bass: [N(0, 38, 30, 0.85)], kick: [N(0, 60, 1, 0.9)], snare: roll(0, 6, 0.6, 0.2) });
  const seq = [['Roll', 'R1'], ['Roll', 'R2'], ['Fanfare', 'F1'], ['Fanfare', 'F2'], ['Hold', 'E1']];
  const arrangement = seq.map(([name, pattern]) => ({ name, pattern, reps: 1 }));
  const song = {
    name: "Final Take — That's a Wrap (fanfare)", bpm: 116, swing: 0, root: 'D', scale: 'major',
    tracks: Object.values(T), patterns, patternMeta, arrangement,
    master: { low: 1, high: 1.5, drive: 0.2, glue: 0.5, makeup: 5, ceiling: -1, reverb: 2.4 },
    meta: { genre: 'orchestral', seed: 'final-take-wrap', target: -12, composedBy: 'Claude (elle besteleme)' },
  };
  save('final-take-wrap.json', "Final Take — That's a Wrap (fanfare, Claude besteledi)", song, arrangement);
}
