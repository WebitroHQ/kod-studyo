// Enstrümantasyon bilgi tabanı: hangi tarzda hangi enstrümanlar çalınır, ve yazıdaki
// enstrüman kelimeleri ne anlama gelir. Hem kod motoru (preset'ler) hem Suno modu (model tarifleri) kullanır.
// Kaynak: yaygın prodüksiyon pratiği; RJ Pasin için röportajlar (hızlı elektro gitar lickleri,
// agresif elektronik beat, yer yer synth gibi duyulan gitar, ağır edit/stutter).

// ---------- kod motoru preset'leri ----------
// Her preset bir kanal tarifi: enstrüman + ayarlar + varsayılan rol/miks
export const PRESETS = {
  // gitarlar
  gtrDist: { label: 'Elektro – distorsiyonlu', group: 'Gitar', inst: 'guitar', role: 'riff', oct: 2, vol: 0.6, duck: 0.3, params: { drive: 0.85, mute: 0.35, power: 1, bright: 0.55, cab: 4200, double: 1 } },
  gtrPalm: { label: 'Elektro – palm-mute ritim (L/R)', group: 'Gitar', inst: 'guitar', role: 'riff', oct: 2, vol: 0.5, duck: 0.35, params: { drive: 0.85, mute: 0.78, power: 1, bright: 0.55, cab: 4200, double: 1 } },
  gtrClean: { label: 'Elektro – temiz', group: 'Gitar', inst: 'guitar', role: 'chords', oct: 3, vol: 0.6, rev: 0.25, dly: 0.12, params: { drive: 0.12, mute: 0, power: 0, bright: 0.75, cab: 7000, double: 0, vib: 0.2 } },
  gtrLead: { label: 'Elektro – melodik lead (RJ)', group: 'Gitar', inst: 'guitar', role: 'melody', oct: 4, vol: 0.7, pan: 0.08, rev: 0.25, dly: 0.16, duck: 0.15, params: { drive: 0.32, mute: 0, power: 0, bright: 0.78, cab: 6200, double: 0, vib: 0.5, bend: 0.08 } },
  gtrSolo: { label: 'Elektro – solo (overdrive)', group: 'Gitar', inst: 'guitar', role: 'melody', oct: 4, vol: 0.6, rev: 0.3, dly: 0.2, params: { drive: 0.7, mute: 0, power: 0, bright: 0.7, cab: 5000, vib: 0.7, bend: 0.12 } },
  acoustic: { label: 'Akustik gitar', group: 'Gitar', inst: 'acoustic', role: 'chords', oct: 3, vol: 0.65, rev: 0.2 },
  nylon: { label: 'Klasik (naylon) gitar', group: 'Gitar', inst: 'acoustic', role: 'melody', oct: 4, vol: 0.6, rev: 0.25, params: { bright: 0.45, body: 0.8, decay: 2 } },
  baglama: { label: 'Bağlama (saz)', group: 'Gitar', inst: 'baglama', role: 'melody', oct: 4, vol: 0.6, rev: 0.25 },
  // bas
  b808: { label: '808', group: 'Bas', inst: 'bass808', role: 'bass', oct: 1, vol: 0.85, duck: 0.3 },
  bassgtr: { label: 'Bas gitar', group: 'Bas', inst: 'bassgtr', role: 'bass', oct: 1, vol: 0.8, duck: 0.2 },
  slap: { label: 'Slap bas', group: 'Bas', inst: 'bassgtr', role: 'bass', oct: 1, vol: 0.75, params: { slap: 1, tone: 1800 } },
  synthbass: { label: 'Synth bas', group: 'Bas', inst: 'bass', role: 'bass', oct: 2, vol: 0.7, duck: 0.4 },
  // klavye / synth
  piano: { label: 'E-piyano', group: 'Klavye', inst: 'piano', role: 'chords', oct: 4, vol: 0.45, rev: 0.25 },
  organ: { label: 'Org', group: 'Klavye', inst: 'organ', role: 'chords', oct: 4, vol: 0.45, rev: 0.15 },
  pad: { label: 'Synth pad', group: 'Klavye', inst: 'pad', role: 'pad', oct: 3, vol: 0.35, rev: 0.45 },
  lead: { label: 'Synth lead', group: 'Klavye', inst: 'lead', role: 'melody', oct: 4, vol: 0.45, rev: 0.3, dly: 0.2 },
  pluck: { label: 'Pluck / arp', group: 'Klavye', inst: 'pluck', role: 'counter', oct: 5, vol: 0.4, dly: 0.25 },
  bell: { label: 'Bell', group: 'Klavye', inst: 'bell', role: 'counter', oct: 5, vol: 0.4, rev: 0.35 },
  cowbell: { label: '808 cowbell', group: 'Klavye', inst: 'cowbell', role: 'melody', oct: 5, vol: 0.7, duck: 0.3 },
  // orkestra / üflemeli
  strings: { label: 'Yaylılar', group: 'Orkestra', inst: 'strings', role: 'pad', oct: 4, vol: 0.55, rev: 0.4 },
  violin: { label: 'Keman (lead)', group: 'Orkestra', inst: 'strings', role: 'melody', oct: 5, vol: 0.55, rev: 0.35, params: { vib: 0.8, attack: 0.08 } },
  pizz: { label: 'Yaylı spiccato', group: 'Orkestra', inst: 'strings', role: 'counter', oct: 4, vol: 0.5, params: { spic: 1 } },
  brass: { label: 'Brass', group: 'Orkestra', inst: 'brass', role: 'chords', oct: 4, vol: 0.5, rev: 0.2 },
  flute: { label: 'Flüt / ney', group: 'Orkestra', inst: 'flute', role: 'counter', oct: 5, vol: 0.5, rev: 0.4, dly: 0.15 },
  // vokal / davul ekleri
  vox: { label: 'Vokal chop', group: 'Vokal', inst: 'vox', role: 'vox', oct: 4, vol: 0.45, rev: 0.4, dly: 0.25 },
  darbuka: { label: 'Darbuka', group: 'Davul', inst: 'perc', role: 'perc', vol: 0.6, params: { kind: 1, tone: 320, decay: 0.06 } },
  shaker: { label: 'Shaker', group: 'Davul', inst: 'perc', role: 'perc', vol: 0.4, params: { kind: 2, decay: 0.05 } },
};

// ---------- kelime → enstrüman ----------
// suno: modele giden tarif, preset: kod motoru kanalı (yoksa null)
export const KEYWORDS = [
  [['akustik', 'acoustic'], 'acoustic guitar', 'acoustic'],
  [['naylon', 'klasik gitar', 'nylon', 'flamenko'], 'nylon-string classical guitar', 'nylon'],
  [['palm', 'chug', 'djent', 'metal'], 'palm-muted electric guitar riffs', 'gtrPalm'],
  [['distorsiyon', 'distorsiyonlu', 'distorted', 'rock gitar', 'ağır gitar'], 'distorted electric guitar', 'gtrDist'],
  [['temiz gitar', 'clean gitar', 'clean guitar'], 'clean electric guitar', 'gtrClean'],
  [['solo'], 'expressive electric guitar solo', 'gtrSolo'],
  [['elektro gitar', 'elektrik gitar', 'electric guitar', 'gitar', 'guitar'], 'melodic electric guitar lead', 'gtrLead'],
  [['bağlama', 'baglama', 'saz'], 'baglama saz', 'baglama'],
  [['ud', 'oud'], 'oud', 'baglama'],
  [['slap'], 'slap bass', 'slap'],
  [['bas gitar', 'bass guitar'], 'electric bass guitar', 'bassgtr'],
  [['808'], '808 bass', 'b808'],
  [['piyano', 'piano'], 'piano', 'piano'],
  [['rhodes', 'elektrik piyano'], 'rhodes electric piano', 'piano'],
  [['org', 'organ', 'hammond'], 'hammond organ', 'organ'],
  [['keman', 'violin'], 'violin', 'violin'],
  [['yaylı', 'yayli', 'strings', 'orkestra', 'çello', 'cello'], 'string section', 'strings'],
  [['trompet', 'trumpet', 'brass', 'nefesli', 'saksafon', 'saxophone', 'sax'], 'brass section', 'brass'],
  [['flüt', 'flut', 'flute', 'ney'], 'flute', 'flute'],
  [['darbuka'], 'darbuka', 'darbuka'],
  [['shaker', 'konga', 'conga'], 'congas and shakers', 'shaker'],
  [['cowbell', 'kovbel'], '808 cowbell', 'cowbell'],
  [['bell', 'çan'], 'bell melody', 'bell'],
  [['synth', 'sentezleyici'], 'synth lead', 'lead'],
  [['pad', 'atmosfer'], 'lush synth pads', 'pad'],
  [['arp', 'arpej'], 'arpeggiated synth', 'pluck'],
  [['vokal chop', 'chop'], 'chopped vocal samples', 'vox'],
  // vokal türleri (yalnızca Suno modu; kod motorunda karşılığı yok)
  [['erkek vokal', 'erkek sesi', 'male vocal'], 'male vocals', null],
  [['kadın vokal', 'kadin vokal', 'kadın sesi', 'female vocal'], 'female vocals', null],
  [['melodik rap', 'melodic rap'], 'melodic rap vocals', null],
  [['rap'], 'rap vocals', null],
  [['koro', 'choir'], 'choir', null],
  [['fısıltı', 'fisilti', 'whisper'], 'whispered vocals', null],
  [['autotune', 'oto tune'], 'autotuned vocals', null],
];

export function detectInstruments(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  const out = [];
  const taken = new Set();
  for (const [words, suno, preset] of KEYWORDS) {
    const hit = words.find((w) => (w.length <= 3 ? new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'u').test(t) : t.includes(w)));
    if (!hit) continue;
    // "gitar" genel kelimesi, daha özel bir gitar türü zaten bulunduysa tekrar eklenmesin
    if (preset === 'gtrLead' && out.some((o) => PRESETS[o.preset] && PRESETS[o.preset].group === 'Gitar') && !t.includes('lead')) continue;
    if (taken.has(suno)) continue;
    taken.add(suno);
    out.push({ word: hit, suno, preset });
  }
  return out;
}

// ---------- tarz → tipik enstrümantasyon ----------
// Anahtarlar: hem Suno şablon id'leri hem kod motoru tarz id'leri
export const STYLE_INSTRUMENTS = {
  rj: {
    why: 'Agresif elektronik beat üstünde hızlı, çevik elektro gitar lickleri; gitar yer yer synth gibi; ağır edit/stutter; altta 808.',
    suno: ['melodic electric guitar lead', 'clean electric guitar', 'palm-muted electric guitar riffs', 'trap drums with rolling hi-hats', '808 bass', 'arpeggiated synth'],
  },
  brphonk: {
    why: 'Melodi 808 cowbell\'den gelir; bas distorsiyonlu 808; davul tamborzão/funk kalıbı; bazen vokal chop.',
    suno: ['808 cowbell', '808 bass', 'brazilian funk percussion', 'chopped vocal samples'],
  },
  drift: {
    why: 'Cowbell riffi, uzun kayan 808, karanlık pad, Memphis vokal parçaları.',
    suno: ['808 cowbell', '808 bass', 'trap drums with rolling hi-hats', 'lush synth pads', 'chopped vocal samples'],
  },
  rjemo: {
    why: 'Majör tonda temiz tapping arpejleri (math rock / midwest emo akorları), hızlı lead, sert trap davul ve 808; araya metalcore breakdown ve hyperpop ses tasarımı.',
    suno: ['clean electric guitar', 'tremolo-picked guitar', 'melodic electric guitar lead', 'palm-muted electric guitar riffs', 'trap drums with rolling hi-hats', '808 bass', 'chopped vocal samples'],
  },
  trap: { why: 'Bell/piyano/pluck melodi, uzun 808, hat roll\'lu davul, pad.', suno: ['trap drums with rolling hi-hats', '808 bass', 'bell melody', 'piano', 'lush synth pads'] },
  trrap: { why: 'Rap vokal öne; sade piyano/yaylı loop, 808, sert davul.', suno: ['rap vocals', 'trap drums with rolling hi-hats', '808 bass', 'piano', 'string section'] },
  pop: { why: 'Piyano/gitar akorları, bas gitar ya da synth bas, temiz davul, akılda kalan vokal.', suno: ['piano', 'clean electric guitar', 'electric bass guitar', 'lush synth pads', 'live acoustic drum kit'] },
  rock: { why: 'Distorsiyonlu ritim gitar + lead, bas gitar, akustik davul seti.', suno: ['distorted electric guitar', 'expressive electric guitar solo', 'electric bass guitar', 'hard-hitting rock drums'] },
  metal: { why: 'Palm-mute riffler, distorsiyonlu lead, bas gitar, çift pedal davul.', suno: ['palm-muted electric guitar riffs', 'distorted electric guitar', 'electric bass guitar', 'hard-hitting rock drums'] },
  lofi: { why: 'Rhodes/piyano caz akorları, yumuşak bas, swing davul, bazen akustik/naylon gitar.', suno: ['rhodes electric piano', 'nylon-string classical guitar', 'upright bass', 'congas and shakers'] },
  arabesk: { why: 'Yaylılar, bağlama/ud, darbuka, piyano; duygusal makamsal melodi.', suno: ['string section', 'baglama saz', 'oud', 'darbuka', 'piano'] },
  edm: { why: 'Supersaw akorlar, synth lead, sidechain\'li bas, four-on-the-floor.', suno: ['supersaw chords', 'synth lead', 'synth bass', 'arpeggiated synth'] },
  reggaeton: { why: 'Dembow davul, pluck/piyano melodi, 808 ya da synth bas, latin perküsyon.', suno: ['synth lead', 'piano', '808 bass', 'congas and shakers'] },
  ambient: { why: 'Pad\'ler, bell\'ler, yaylılar, bol reverb; davul yok ya da çok az.', suno: ['lush synth pads', 'bell melody', 'string section'] },
};

// kod motoru tarz id'lerini bilgi tabanı anahtarlarına bağla
export const GENRE_TO_STYLE = {
  rj_type: 'rj', rj_emo: 'rjemo', brazilian_phonk: 'brphonk', drift_phonk: 'drift', memphis_phonk: 'drift', trap: 'trap', drill: 'trap',
  boombap: 'lofi', lofi: 'lofi', house: 'edm', techno: 'edm', dnb: 'edm', synthwave: 'edm', hyperpop: 'edm',
  ambient: 'ambient', reggaeton: 'reggaeton', afrobeats: 'reggaeton', pop: 'pop', rock: 'rock', arabesk: 'arabesk', akustik: 'pop',
};
