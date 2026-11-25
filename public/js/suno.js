// "Şarkı iste" (Suno modu): tek kutuya yaz → ElevenLabs Music ile vokalli/enstrümantal tam şarkı.
// İstersen önce ücretsiz plan çıkar (bölümler + sözler), düzenle, sonra üret.

import { STYLE_INSTRUMENTS, detectInstruments } from './instrumentation.js';

// Tarz şablonları: sanatçı adı yerine tarifi gönderiyoruz (müzik modelleri sanatçı adlarını reddedebiliyor).
export const STYLE_TEMPLATES = [
  { id: '', label: 'Serbest (sadece yazdığım)', styles: [] },
  { id: 'rj', label: 'RJ Pasin tarzı', styles: ['guitar-driven trap', 'melodic electric guitar riffs', 'glitchy stutter edits', 'hard 808 bass', 'hyperpop and djent influences', 'short catchy loop-based structure', '150 bpm'] },
  { id: 'rjemo', label: 'RJ tarzı – math/emo gitar', styles: ['math rock guitar tapping', 'midwest emo chords', 'guitar-driven trap', 'hard 808', 'metalcore breakdown', 'hyperpop sound design', 'glitchy edits', 'major key', '140 bpm'] },
  { id: 'brphonk', label: 'Brazilian phonk / funk automotivo', styles: ['brazilian phonk', 'funk automotivo', 'distorted 808 cowbell melody', 'heavily distorted 808 bass', 'aggressive', '130 bpm'] },
  { id: 'drift', label: 'Drift phonk', styles: ['drift phonk', 'cowbell riff', 'sliding distorted 808', 'dark', 'memphis vocal chops', '125 bpm'] },
  { id: 'trap', label: 'Trap', styles: ['modern trap', 'hard 808s', 'rolling hi-hats', 'dark melodic'] },
  { id: 'trrap', label: 'Türkçe rap', styles: ['turkish rap', 'hip hop', 'punchy drums', 'melodic hook'] },
  { id: 'pop', label: 'Pop', styles: ['catchy pop', 'radio ready', 'big chorus'] },
  { id: 'rock', label: 'Rock', styles: ['rock', 'live band', 'driving drums', 'distorted guitars'] },
  { id: 'metal', label: 'Metal / djent', styles: ['progressive metal', 'djent', 'tight palm-muted riffs', 'heavy'] },
  { id: 'lofi', label: 'Lo-fi', styles: ['lo-fi hip hop', 'warm', 'vinyl crackle', 'jazzy chords', 'relaxed'] },
  { id: 'arabesk', label: 'Arabesk / Türk pop', styles: ['turkish arabesque', 'emotional', 'string section', 'baglama', 'oriental scales'] },
  { id: 'edm', label: 'EDM / house', styles: ['edm', 'four on the floor', 'big drop', 'festival'] },
  { id: 'reggaeton', label: 'Reggaeton', styles: ['reggaeton', 'dembow rhythm', 'latin'] },
  { id: 'ambient', label: 'Ambient / sinematik', styles: ['cinematic ambient', 'atmospheric', 'slow evolving'] },
];

// Enstrüman seçici: [Türkçe etiket, modele giden tarif]
export const INSTRUMENT_GROUPS = [
  ['Gitarlar', [
    ['Distorsiyonlu elektro', 'distorted electric guitar'], ['Temiz elektro', 'clean electric guitar'],
    ['Melodik elektro lead', 'melodic electric guitar lead'], ['Palm-mute riff', 'palm-muted electric guitar riffs'],
    ['Gitar solosu', 'expressive electric guitar solo'], ['Akustik gitar', 'acoustic guitar'], ['Klasik (naylon)', 'nylon-string classical guitar'],
    ['12 telli', '12-string acoustic guitar'], ['Funk gitar', 'funky rhythm guitar'], ['Slide gitar', 'slide guitar'], ['Tremolo picking', 'tremolo-picked guitar'],
  ]],
  ['Bas', [
    ['808', '808 bass'], ['Bas gitar', 'electric bass guitar'], ['Slap bas', 'slap bass'], ['Synth bas', 'synth bass'], ['Kontrbas', 'upright bass'], ['Reese bas', 'reese bass'],
  ]],
  ['Davul / perküsyon', [
    ['Trap davul', 'trap drums with rolling hi-hats'], ['Akustik davul seti', 'live acoustic drum kit'], ['Rock davul', 'hard-hitting rock drums'],
    ['Breakbeat', 'breakbeat drums'], ['808 cowbell', '808 cowbell'], ['Brezilya perküsyonu', 'brazilian funk percussion'],
    ['Konga / shaker', 'congas and shakers'], ['Darbuka', 'darbuka'], ['Davul (Türk)', 'turkish davul drum'],
  ]],
  ['Klavye / synth', [
    ['Piyano', 'piano'], ['Rhodes', 'rhodes electric piano'], ['Org', 'hammond organ'], ['Synth lead', 'synth lead'],
    ['Synth pad', 'lush synth pads'], ['Arpej', 'arpeggiated synth'], ['Supersaw', 'supersaw chords'], ['Bell', 'bell melody'],
  ]],
  ['Yaylı / üflemeli', [
    ['Yaylılar', 'string section'], ['Keman', 'violin'], ['Çello', 'cello'], ['Brass', 'brass section'],
    ['Saksafon', 'saxophone'], ['Trompet', 'trumpet'], ['Flüt', 'flute'], ['Klarnet', 'clarinet'],
  ]],
  ['Türk / dünya', [
    ['Bağlama (saz)', 'baglama saz'], ['Ud', 'oud'], ['Kanun', 'kanun zither'], ['Ney', 'ney flute'], ['Zurna', 'zurna'],
    ['Sitar', 'sitar'], ['Koto', 'koto'],
  ]],
  ['Vokal', [
    ['Erkek vokal', 'male vocals'], ['Kadın vokal', 'female vocals'], ['Rap', 'rap vocals'], ['Melodik rap', 'melodic rap vocals'],
    ['Vokal chop', 'chopped vocal samples'], ['Koro', 'choir'], ['Fısıltı', 'whispered vocals'], ['Autotune', 'autotuned vocals'],
  ]],
];

export const LANGS = [
  ['tr', 'Türkçe', 'turkish lyrics'], ['en', 'İngilizce', 'english lyrics'], ['pt', 'Portekizce', 'portuguese lyrics'],
  ['es', 'İspanyolca', 'spanish lyrics'], ['', 'Farketmez', ''],
];

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

export function setupSuno({ getSettings, toast, onLocal, onAddToStudio }) {
  const $ = (id) => document.getElementById(id);
  const picked = new Set();
  const auto = new Set();   // sistemin seçtikleri (kullanıcı dokununca manuel olur)
  const chips = new Map();  // tarif → çip
  let plan = null;

  STYLE_TEMPLATES.forEach((t) => $('snStyle').append(h('option', { value: t.id }, t.label)));
  LANGS.forEach(([v, l]) => $('snLang').append(h('option', { value: v }, l)));

  // enstrüman çipleri
  const box = $('snInstr');
  for (const [group, items] of INSTRUMENT_GROUPS) {
    const row = h('div', { class: 'chipgroup' }, h('span', { class: 'glabel' }, group));
    for (const [label, en] of items) {
      const chip = h('button', { type: 'button', class: 'ichip', title: en, onclick: () => {
        picked.has(en) ? picked.delete(en) : picked.add(en);
        auto.delete(en);
        paint(en);
        updatePreview();
      } }, label);
      chips.set(en, chip);
      row.append(chip);
    }
    box.append(row);
  }

  function paint(en) {
    const c = chips.get(en);
    if (c) { c.classList.toggle('on', picked.has(en)); c.classList.toggle('auto', auto.has(en)); }
  }
  // Otomatik enstrüman seçimi: tarzın tipik enstrümanları + yazıda geçen enstrümanlar.
  // Kullanıcının elle açıp kapattıklarına dokunmaz.
  let manualOff = new Set();
  function autoPick() {
    const want = new Set();
    const info = STYLE_INSTRUMENTS[$('snStyle').value];
    if (info) info.suno.forEach((x) => want.add(x));
    const found = detectInstruments($('snText').value);
    found.forEach((f) => want.add(f.suno));
    if (instrumental()) for (const x of [...want]) if (/vocal|rap|choir/.test(x)) want.delete(x);
    for (const en of [...auto]) if (!want.has(en)) { auto.delete(en); picked.delete(en); paint(en); }
    for (const en of want) {
      if (!chips.has(en)) continue;
      if (picked.has(en) && !auto.has(en)) continue; // zaten elle seçilmiş
      if (manualOff.has(en)) continue;
      picked.add(en); auto.add(en); paint(en);
    }
    const why = [];
    if (info) why.push('Bu tarzda tipik: ' + info.why);
    if (found.length) why.push('Yazından algılanan: ' + found.map((f) => f.word).join(', '));
    $('snWhy').textContent = why.join(' · ');
  }
  chips.forEach((c, en) => c.addEventListener('click', () => { if (!picked.has(en)) manualOff.add(en); else manualOff.delete(en); }));

  const headers = () => {
    const s = getSettings(), hd = { 'content-type': 'application/json' };
    if (s.elevenKey) hd['x-elevenlabs-key'] = s.elevenKey;
    return hd;
  };
  const instrumental = () => $('snVocal').value === 'inst';

  function buildPrompt() {
    const parts = [];
    const text = $('snText').value.trim();
    if (text) parts.push(text);
    const tpl = STYLE_TEMPLATES.find((t) => t.id === $('snStyle').value);
    if (tpl && tpl.styles.length) parts.push('Style: ' + tpl.styles.join(', '));
    if (picked.size) parts.push('Instruments: ' + [...picked].join(', '));
    if (instrumental()) parts.push('Instrumental only, no vocals.');
    else {
      const lang = LANGS.find(([v]) => v === $('snLang').value);
      if (lang && lang[2]) parts.push('Vocals with ' + lang[2] + '.');
      const lyrics = $('snLyrics').value.trim();
      if (lyrics) parts.push('Use these lyrics:\n' + lyrics);
    }
    return parts.join('\n');
  }
  function updatePreview() { $('snPreview').textContent = buildPrompt() || '—'; }
  let typeT = null;
  $('snText').addEventListener('input', () => { clearTimeout(typeT); typeT = setTimeout(() => { autoPick(); updatePreview(); }, 250); });
  $('snLyrics').addEventListener('input', updatePreview);
  ['snStyle', 'snLang', 'snVocal'].forEach((id) => $(id).addEventListener('change', () => {
    $('snLyricsWrap').hidden = instrumental();
    if (id === 'snStyle') manualOff = new Set();
    autoPick();
    updatePreview();
  }));
  $('snStyle').value = 'rj';
  autoPick();
  updatePreview();

  async function call(url, body, btn, label) {
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = label;
    try {
      const r = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({ error: 'Sunucu yanıtı okunamadı' }));
      if (!r.ok) throw new Error(data.error || 'Hata ' + r.status);
      return data;
    } finally { btn.disabled = false; btn.textContent = old; }
  }

  const title = () => ($('snTitle').value.trim() || $('snText').value.trim().slice(0, 40) || 'Şarkı');
  const seconds = () => +$('snLen').value;

  $('snQuick').addEventListener('click', async () => {
    const prompt = buildPrompt();
    if (!prompt) return toast('Önce ne istediğini yaz');
    try {
      $('snStatus').textContent = 'Şarkı üretiliyor… (genelde 30 sn – 2 dk)';
      const meta = await call('/api/music/compose', { prompt, seconds: seconds(), instrumental: instrumental(), title: title() }, $('snQuick'), 'Üretiliyor…');
      $('snStatus').textContent = 'Hazır: ' + meta.title;
      await loadLibrary(meta.file);
    } catch (e) { $('snStatus').textContent = ''; toast(e.message, true, 8000); }
  });

  $('snPlan').addEventListener('click', async () => {
    const prompt = buildPrompt();
    if (!prompt) return toast('Önce ne istediğini yaz');
    try {
      $('snStatus').textContent = 'Plan çıkarılıyor (kredi harcamaz)…';
      const data = await call('/api/music/plan', { prompt, seconds: seconds() }, $('snPlan'), 'Planlanıyor…');
      plan = data.plan;
      if (instrumental()) plan.sections.forEach((s) => { s.lines = []; });
      renderPlan();
      $('snStatus').textContent = 'Planı düzenleyebilirsin; sonra "Bu planla üret".';
    } catch (e) { $('snStatus').textContent = ''; toast(e.message, true, 8000); }
  });

  function renderPlan() {
    const ed = $('snPlanEd');
    ed.replaceChildren();
    ed.hidden = !plan;
    if (!plan) return;
    const glob = h('input', { class: 'wide', value: (plan.positive_global_styles || []).join(', ') });
    glob.addEventListener('change', () => { plan.positive_global_styles = splitList(glob.value); });
    const neg = h('input', { class: 'wide', value: (plan.negative_global_styles || []).join(', ') });
    neg.addEventListener('change', () => { plan.negative_global_styles = splitList(neg.value); });
    ed.append(h('h3', {}, 'Plan'), h('label', { class: 'col' }, 'Genel stiller', glob), h('label', { class: 'col' }, 'İstenmeyenler', neg));
    plan.sections.forEach((sec, i) => {
      const name = h('input', { value: sec.section_name });
      name.addEventListener('change', () => { sec.section_name = name.value || 'Bölüm'; });
      const dur = h('input', { type: 'number', min: 3, max: 120, value: Math.round(sec.duration_ms / 1000), style: 'width:64px' });
      dur.addEventListener('change', () => { sec.duration_ms = Math.min(120000, Math.max(3000, Math.round(+dur.value * 1000))); updateTotal(); });
      const st = h('input', { class: 'wide', value: (sec.positive_local_styles || []).join(', ') });
      st.addEventListener('change', () => { sec.positive_local_styles = splitList(st.value); });
      const ly = h('textarea', { rows: Math.max(2, Math.min(8, sec.lines.length || 2)), placeholder: 'Söz yok (enstrümantal bölüm)' });
      ly.value = (sec.lines || []).join('\n');
      ly.addEventListener('change', () => { sec.lines = ly.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 30); });
      ed.append(h('div', { class: 'secedit' },
        h('div', { class: 'row' }, h('b', {}, `${i + 1}.`), name, h('label', {}, 'sn ', dur), h('span', { class: 'spacer' }),
          h('button', { type: 'button', title: 'Bölümü sil', onclick: () => { plan.sections.splice(i, 1); renderPlan(); } }, '×')),
        h('label', { class: 'col' }, 'Bölüm stili', st),
        h('label', { class: 'col' }, 'Sözler', ly)));
    });
    const total = h('span', { class: 'hint' });
    const updateTotal = () => { total.textContent = 'Toplam: ' + Math.round(plan.sections.reduce((a, s) => a + s.duration_ms, 0) / 1000) + ' sn'; };
    updateTotal();
    const go = h('button', { type: 'button', class: 'accent' }, 'Bu planla üret');
    go.addEventListener('click', async () => {
      try {
        $('snStatus').textContent = 'Şarkı plana göre üretiliyor…';
        const meta = await call('/api/music/compose', { plan, title: title(), prompt: buildPrompt() }, go, 'Üretiliyor…');
        $('snStatus').textContent = 'Hazır: ' + meta.title;
        await loadLibrary(meta.file);
      } catch (e) { $('snStatus').textContent = ''; toast(e.message, true, 8000); }
    });
    ed.append(h('div', { class: 'row' }, total, h('span', { class: 'spacer' }), go));
  }
  const splitList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

  $('snLocal').addEventListener('click', () => onLocal({ text: $('snText').value, style: $('snStyle').value, instruments: [...picked] }));

  async function loadLibrary(highlight) {
    let items = [];
    try { items = (await (await fetch('/api/music/library')).json()).items || []; } catch { /* sunucu yok */ }
    const list = $('snLib');
    list.replaceChildren();
    if (!items.length) list.append(h('p', { class: 'hint' }, 'Henüz şarkı yok.'));
    for (const it of items) {
      const audio = h('audio', { controls: true, preload: 'none', src: it.file });
      list.append(h('div', { class: 'libitem' + (it.file === highlight ? ' new' : '') },
        h('div', { class: 'row' }, h('b', {}, it.title), h('span', { class: 'hint' }, new Date(it.createdAt).toLocaleString('tr-TR')),
          h('span', { class: 'spacer' }),
          h('a', { class: 'btn', href: it.file, download: '' }, 'İndir'),
          h('button', { type: 'button', onclick: () => onAddToStudio(it) }, 'Stüdyoya ekle')),
        audio,
        it.prompt ? h('details', {}, h('summary', {}, 'İstek'), h('pre', {}, it.prompt)) : null));
      if (it.file === highlight) setTimeout(() => audio.play().catch(() => {}), 50);
    }
  }
  loadLibrary();
  return { buildPrompt };
}
