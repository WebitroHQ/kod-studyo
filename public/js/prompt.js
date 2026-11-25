// AI'sız komut çözücü: "karanlık brazilian phonk 130 bpm F#" → üretici ayarları.
// Anahtar yokken de yazıyla şarkı istemeyi sağlar.

import { GENRES } from './genres.js';
import { NOTE_NAMES } from './theory.js';

const KEYWORDS = {
  brazilian_phonk: ['brazil', 'brezilya', 'automotivo', 'funk', 'tamborz', 'montagem', 'brazilian'],
  drift_phonk: ['drift', 'kordhell', 'araba', 'gaz'],
  memphis_phonk: ['memphis', 'old school phonk', 'eski phonk', 'cassette', 'kaset'],
  rj_type: ['rj', 'pasin', 'gitar', 'guitar', 'djent', 'glitch', 'metal'],
  rj_emo: ['emo', 'math rock', 'mathrock', 'tapping', 'midwest'],
  trap: ['trap', '808 trap'],
  drill: ['drill'],
  boombap: ['boom bap', 'boombap', '90s', '90lar', 'oldschool rap', 'eski rap'],
  lofi: ['lofi', 'lo-fi', 'ders', 'chill', 'sakin', 'çalışma', 'calisma', 'study'],
  house: ['house', 'deep house'],
  techno: ['techno', 'tekno', 'rave', 'berlin'],
  dnb: ['dnb', 'drum and bass', 'drum & bass', 'jungle', 'neuro'],
  synthwave: ['synthwave', 'retrowave', '80s', '80ler', 'outrun'],
  hyperpop: ['hyperpop', 'hyper pop', 'digicore'],
  ambient: ['ambient', 'ambiyans', 'meditasyon', 'uyku', 'drone'],
  reggaeton: ['reggaeton', 'regaeton', 'dembow', 'latin'],
  afrobeats: ['afro', 'afrobeat', 'amapiano'],
  pop: ['pop'],
  rock: ['rock', 'grunge', 'punk', 'metal'],
  akustik: ['akustik pop', 'folk', 'akustik şarkı', 'kamp ateşi', 'unplugged'],
  arabesk: ['arabesk', 'türk pop', 'turk pop', 'fantezi', 'türkü', 'turku', 'hicaz', 'bağlama', 'saz'],
};

const DARK_WORDS = ['karanlık', 'karanlik', 'dark', 'sert', 'agresif', 'aggressive', 'kötü', 'evil', 'gece', 'korku', 'hüzün', 'huzun', 'sad', 'üzgün'];
const BRIGHT_WORDS = ['mutlu', 'neşeli', 'neseli', 'happy', 'aydınlık', 'aydinlik', 'yaz', 'summer', 'parlak', 'bright', 'pozitif'];

export function parsePrompt(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  let genre = null, bestScore = 0;
  for (const g of GENRES) {
    const words = KEYWORDS[g.id] || [];
    let score = 0;
    for (const w of words) if (t.includes(w)) score += w.length;
    if (t.includes('phonk') && g.family === 'Phonk') score += 3;
    if (score > bestScore) { bestScore = score; genre = g.id; }
  }
  if (!genre && t.includes('phonk')) genre = 'brazilian_phonk';

  const bpmMatch = t.match(/(\d{2,3})\s*(bpm)?/);
  let bpm = null;
  if (bpmMatch) { const v = +bpmMatch[1]; if (v >= 50 && v <= 200) bpm = v; }

  let mood = null;
  if (DARK_WORDS.some((w) => t.includes(w))) mood = 'dark';
  if (BRIGHT_WORDS.some((w) => t.includes(w))) mood = 'bright';

  let root = null;
  const keyMatch = text.match(/\b([A-G])(#|b)?(?:\s*(?:m|min|minor|maj|major))?(?![\w#])/);
  if (keyMatch) {
    let name = keyMatch[1] + (keyMatch[2] === '#' ? '#' : '');
    if (keyMatch[2] === 'b') name = NOTE_NAMES[(NOTE_NAMES.indexOf(keyMatch[1]) + 11) % 12];
    if (NOTE_NAMES.includes(name)) root = name;
  }

  const flags = {
    heavy808: /808|bas|bass/.test(t) && /(ağır|agir|sert|heavy|distor)/.test(t),
    noVocal: /(vokalsiz|vokal olmadan|no vocal|enstrümantal|enstrumantal)/.test(t),
  };
  return { genre, bpm, mood, root, flags };
}

export function describeParse(p) {
  const parts = [];
  if (p.genre) parts.push('tarz: ' + GENRES.find((g) => g.id === p.genre).name);
  if (p.bpm) parts.push(p.bpm + ' BPM');
  if (p.mood) parts.push(p.mood === 'dark' ? 'karanlık' : 'aydınlık');
  if (p.root) parts.push('ton: ' + p.root);
  if (p.flags.heavy808) parts.push('ağır 808');
  if (p.flags.noVocal) parts.push('vokalsiz');
  return parts.join(' · ') || 'anlaşılamadı, seçili tarz kullanılacak';
}
