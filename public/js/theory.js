// Nota, ölçek, akor yardımcıları ve seed'li rastgele sayı üreteci.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES = {
  minor: { label: 'Minör', steps: [0, 2, 3, 5, 7, 8, 10] },
  phrygian: { label: 'Frigyen (karanlık)', steps: [0, 1, 3, 5, 7, 8, 10] },
  harmonicMinor: { label: 'Armonik minör', steps: [0, 2, 3, 5, 7, 8, 11] },
  dorian: { label: 'Doryen', steps: [0, 2, 3, 5, 7, 9, 10] },
  major: { label: 'Majör', steps: [0, 2, 4, 5, 7, 9, 11] },
  mixolydian: { label: 'Miksolidyen', steps: [0, 2, 4, 5, 7, 9, 10] },
  hijaz: { label: 'Hicaz', steps: [0, 1, 4, 5, 7, 8, 10] },
  pentMinor: { label: 'Pentatonik minör', steps: [0, 3, 5, 7, 10] },
  pentMajor: { label: 'Pentatonik majör', steps: [0, 2, 4, 7, 9] },
};

export const noteIndex = (name) => Math.max(0, NOTE_NAMES.indexOf(name));
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const midiName = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

// Ölçek derecesini (negatif ya da ölçek boyunu aşan olabilir) MIDI notasına çevirir.
export function degreeToMidi(root, scale, degree, octave) {
  const st = (SCALES[scale] || SCALES.minor).steps;
  const len = st.length;
  const oct = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return 12 * (octave + 1 + oct) + noteIndex(root) + st[idx];
}

// Verilen MIDI notasının ölçekteki en yakın derecesi.
export function midiToDegree(root, scale, midi, octave) {
  let best = 0, bestDist = 1e9;
  for (let d = -14; d <= 21; d++) {
    const dist = Math.abs(degreeToMidi(root, scale, d, octave) - midi);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

// Ölçeğe kilitli nota listesi (piyano rulosu satırları için), yukarıdan aşağı.
export function scaleRows(root, scale, octave, count) {
  const rows = [];
  for (let d = count - 1; d >= 0; d--) rows.push(degreeToMidi(root, scale, d, octave));
  return rows;
}

export function chordNotes(root, scale, degree, octave, size = 3) {
  const out = [];
  for (let i = 0; i < size; i++) out.push(degreeToMidi(root, scale, degree + i * 2, octave));
  return out;
}

// mulberry32: aynı seed her zaman aynı şarkıyı verir.
export function makeRng(seed) {
  let a = hashSeed(seed);
  const rnd = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rnd.int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  rnd.pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  rnd.chance = (p) => rnd() < p;
  rnd.weighted = (pairs) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let x = rnd() * total;
    for (const [v, w] of pairs) { if ((x -= w) <= 0) return v; }
    return pairs[pairs.length - 1][0];
  };
  return rnd;
}

function hashSeed(seed) {
  const s = String(seed);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const uid = () => Math.random().toString(36).slice(2, 8);
