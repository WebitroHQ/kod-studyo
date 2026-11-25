// Kod Stüdyo arayüzü
import { Engine, STEPS, MASTER_DEFAULT, autoMaster, songSeconds } from './engine.js';
import { INSTRUMENTS, SAMPLE_BANK, KIT_BANK } from './instruments.js';
import { GENRES, GENRE_MAP } from './genres.js';
import { generateSong, regenerateTrack, makeTrack, emptySong } from './generator.js';
import { SCALES, NOTE_NAMES, degreeToMidi, midiName, uid } from './theory.js';
import { parsePrompt, describeParse } from './prompt.js';
import { aiCompose, aiAudio, aiVoices, specToSong, loadSettings, saveSettings, serverStatus } from './ai.js';
import { encodeWav } from './wav.js';
import { setupSuno } from './suno.js';
import { setupFormula } from './formula.js';
import { PRESETS, detectInstruments, KEYWORDS, STYLE_INSTRUMENTS } from './instrumentation.js';
import { loadSamples } from './samples.js';
export { loadSamples };

const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
};

const engine = new Engine();
let song;
let sel = { track: null, sec: 0 };
let mode = 'pattern';
let settings = loadSettings();
let audioKind = 'sfx';
const history = [];

// ---------- durum yardımcıları ----------
const curPat = () => song.arrangement[sel.sec] ? song.arrangement[sel.sec].pattern : Object.keys(song.patterns)[0];
const track = (id) => song.tracks.find((t) => t.id === id);
const events = (pid, tid) => {
  const pat = song.patterns[pid] || (song.patterns[pid] = {});
  return pat[tid] || (pat[tid] = []);
};

function snapshot() {
  history.push(JSON.stringify(song));
  if (history.length > 60) history.shift();
}
function undo() {
  const prev = history.pop();
  if (!prev) return toast('Geri alınacak bir şey yok');
  song = JSON.parse(prev);
  commit(false);
  renderAll();
}

let saveTimer = null;
function commit(snap = true, render = null) {
  if (snap) snapshot();
  engine.update(song);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem('kodstudyo.song', JSON.stringify(song)); } catch { /* yok say */ } }, 400);
  if (render) render();
}

function toast(msg, err = false, ms = 3200) {
  const t = $('toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(t._t); t._t = setTimeout(() => { t.className = ''; }, ms);
}

async function busy(btn, fn) {
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  try { return await fn(); } catch (e) { console.error(e); toast(e.message || String(e), true, 6000); } finally { btn.disabled = false; btn.textContent = old; }
}

// ---------- yükleme ----------
// Kanalların sampleUrl'lerindeki ses dosyalarını (kitler) yükle; JSON'a kaydedilebilir, kalıcı sample'lar
let samplesReady = Promise.resolve();

function setSong(s, msg) {
  if (song) snapshot();
  song = s;
  sel = { track: (song.tracks.find((t) => INSTRUMENTS[t.inst].kind === 'melodic') || song.tracks[0] || {}).id || null, sec: Math.min(sel.sec, song.arrangement.length - 1) };
  if (sel.sec < 0) sel.sec = 0;
  commit(false);
  renderAll();
  samplesReady = loadSamples(song).then((n) => { if (n) engine.update(song); });
  if (engine.playing) samplesReady.then(startPlay);
  if (msg) toast(msg);
}

function doGenerate(opts) {
  const keep = $('keepTempo').checked && song;
  const s = generateSong({
    genre: $('genre').value, seed: $('seed').value || undefined, mood: $('mood').value || null,
    length: +$('songLen').value,
    bpm: keep ? song.bpm : undefined, root: keep ? song.root : undefined, scale: keep ? song.scale : undefined,
    ...opts,
  });
  $('seed').value = s.meta.seed;
  setSong(s, `${s.name} · ${s.bpm} BPM · ${s.root} ${SCALES[s.scale].label}`);
}

// ---------- üst bar ----------
function renderGlobals() {
  $('bpm').value = song.bpm;
  $('swing').value = song.swing;
  $('root').value = song.root;
  $('scale').value = song.scale;
}

// ---------- aranjman ----------
function renderArr() {
  const box = $('arrChips');
  box.replaceChildren();
  song.arrangement.forEach((sec, i) => {
    const chip = h('div', { class: 'chip' + (i === sel.sec ? ' sel' : ''), 'data-i': i,
      onclick: () => { sel.sec = i; if (engine.playing && mode === 'pattern') engine.setPattern(curPat()); renderArr(); renderRack(); renderRoll(); },
      ondblclick: () => {
        const n = prompt('Bölüm adı', sec.name);
        if (n) { sec.name = n; commit(true, renderArr); }
      } },
      h('span', { class: 'name' }, sec.name),
      h('span', { class: 'pat' }, sec.pattern),
      h('button', { title: 'Tekrar azalt', onclick: (e) => { e.stopPropagation(); sec.reps = Math.max(1, sec.reps - 1); commit(true, renderArr); } }, '−'),
      h('span', { class: 'reps' }, '×' + sec.reps),
      h('button', { title: 'Tekrar artır', onclick: (e) => { e.stopPropagation(); sec.reps = Math.min(16, sec.reps + 1); commit(true, renderArr); } }, '+'),
      h('button', { title: 'Sola taşı', onclick: (e) => { e.stopPropagation(); moveSec(i, -1); } }, '◂'),
      h('button', { title: 'Sağa taşı', onclick: (e) => { e.stopPropagation(); moveSec(i, 1); } }, '▸'),
      h('button', { title: 'Bölümü sil', onclick: (e) => { e.stopPropagation(); delSec(i); } }, '×'),
    );
    box.append(chip);
  });
  const secs = songSeconds(song);
  $('patLabel').textContent = `${curPat()} · ${song.arrangement[sel.sec] ? song.arrangement[sel.sec].name : ''} · şarkı ${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`;
}

function moveSec(i, d) {
  const j = i + d;
  if (j < 0 || j >= song.arrangement.length) return;
  const a = song.arrangement;
  [a[i], a[j]] = [a[j], a[i]];
  sel.sec = j;
  commit(true, renderArr);
}
function delSec(i) {
  if (song.arrangement.length <= 1) return toast('Son bölüm silinemez');
  song.arrangement.splice(i, 1);
  // kullanılmayan desenleri temizle
  const used = new Set(song.arrangement.map((s) => s.pattern));
  for (const pid of Object.keys(song.patterns)) if (!used.has(pid)) { delete song.patterns[pid]; delete song.patternMeta[pid]; }
  sel.sec = Math.min(sel.sec, song.arrangement.length - 1);
  commit(true, () => { renderArr(); renderRack(); renderRoll(); });
}
function addSection(copy) {
  const src = curPat();
  let pid = src;
  if (copy) {
    let n = Object.keys(song.patterns).length + 1;
    while (song.patterns['P' + n]) n++;
    pid = 'P' + n;
    song.patterns[pid] = JSON.parse(JSON.stringify(song.patterns[src] || {}));
    song.patternMeta[pid] = { ...(song.patternMeta[src] || { type: 'drop' }) };
  }
  song.arrangement.splice(sel.sec + 1, 0, { name: copy ? 'Yeni ' + pid : song.arrangement[sel.sec].name, pattern: pid, reps: 1 });
  sel.sec++;
  commit(true, () => { renderArr(); renderRack(); renderRoll(); });
}

// ---------- kanal rafı ----------
function renderRack() {
  const rack = $('rack');
  rack.replaceChildren();
  const pid = curPat();
  for (const tr of song.tracks) {
    const def = INSTRUMENTS[tr.inst];
    const evs = events(pid, tr.id);
    const steps = h('div', { class: 'steps' });
    const occupied = new Array(STEPS).fill(null);
    for (const e of evs) {
      if (!occupied[e.s]) occupied[e.s] = e;
      if (def.kind === 'melodic') for (let k = 1; k < (e.l || 1) && e.s + k < STEPS; k++) if (!occupied[e.s + k]) occupied[e.s + k] = 'held';
    }
    for (let s = 0; s < STEPS; s++) {
      const o = occupied[s];
      const cls = ['cell'];
      if (Math.floor(s / 4) % 2 === 0) cls.push('beat');
      if (o === 'held') cls.push('held');
      else if (o) { cls.push('on'); if (o.v < 0.6) cls.push('soft'); }
      const cell = h('div', { class: cls.join(' '), 'data-step': s, style: `--c:${def.color}` }, o && o !== 'held' && o.r > 1 ? '×' + o.r : '');
      cell.addEventListener('mousedown', (ev) => rackClick(ev, tr, s));
      cell.addEventListener('contextmenu', (ev) => ev.preventDefault());
      steps.append(cell);
    }
    const row = h('div', { class: 'trow' + (tr.id === sel.track ? ' sel' : '') },
      h('div', { class: 'tcolor', style: `background:${def.color}` }),
      h('div', { class: 'tname', title: `${tr.name} — ${def.label} (rol: ${tr.role})`, onclick: () => selectTrack(tr.id),
        ondblclick: () => { const n = prompt('Kanal adı', tr.name); if (n) { tr.name = n; commit(true, () => { renderRack(); renderMixer(); }); } } },
      tr.name, h('small', {}, def.kind === 'melodic' ? midiName(degreeToMidi(song.root, song.scale, 0, tr.oct)) : '')),
      h('div', { class: 'tbtns' },
        h('button', { class: 'm' + (tr.mute ? ' on' : ''), title: 'Sessiz', onclick: () => { tr.mute = !tr.mute; commit(true, () => { renderRack(); renderMixer(); }); } }, 'M'),
        h('button', { class: 's' + (tr.solo ? ' on' : ''), title: 'Solo', onclick: () => { tr.solo = !tr.solo; commit(true, () => { renderRack(); renderMixer(); }); } }, 'S'),
        h('button', { title: 'Bu kanalı bu desende yeniden üret', onclick: () => regen(tr) }, '🎲'),
        h('button', { title: 'Önizle', onclick: () => engine.preview(song, tr, def.kind === 'melodic' ? degreeToMidi(song.root, song.scale, 0, tr.oct) : 60) }, '♪'),
        h('button', { title: 'Kanalı sil', onclick: () => delTrack(tr.id) }, '×'),
      ),
      steps,
    );
    rack.append(row);
  }
}

function rackClick(ev, tr, s) {
  ev.preventDefault();
  const def = INSTRUMENTS[tr.inst];
  const evs = events(curPat(), tr.id);
  const hit = evs.find((e) => e.s === s);
  snapshot();
  if (ev.button === 2) {
    // sağ tık: roll (ratchet) döngüsü
    if (hit) hit.r = hit.r >= 4 ? 1 : (hit.r || 1) + 1;
    else evs.push({ s, n: def.kind === 'melodic' ? degreeToMidi(song.root, song.scale, 0, tr.oct) : 60, l: 1, v: 0.8, r: 2 });
  } else if (hit) {
    evs.splice(evs.indexOf(hit), 1);
  } else {
    const holder = def.kind === 'melodic' && evs.find((e) => e.s < s && e.s + (e.l || 1) > s);
    if (holder) holder.l = s - holder.s; // tutulan notayı kısalt
    const n = def.kind === 'melodic' ? degreeToMidi(song.root, song.scale, 0, tr.oct) : 60;
    evs.push({ s, n, l: def.kind === 'melodic' ? +$('noteLen').value : 1, v: ev.shiftKey ? 0.5 : 0.95 });
    if (!engine.playing) engine.preview(song, tr, n);
  }
  evs.sort((a, b) => a.s - b.s);
  if (tr.id !== sel.track && def.kind === 'melodic') sel.track = tr.id;
  commit(false, () => { renderRack(); renderRoll(); });
}

function selectTrack(id) {
  sel.track = id;
  renderRack(); renderRoll(); renderParams(); renderMixer();
}

function regen(tr, pid = curPat()) {
  snapshot();
  const seed = Math.floor(Math.random() * 1e6);
  song.patterns[pid][tr.id] = regenerateTrack(song, tr.id, pid, seed);
  commit(false, () => { renderRack(); renderRoll(); });
  toast(`${tr.name} yeniden üretildi`);
}

function delTrack(id) {
  const tr = track(id);
  if (!tr || !confirm(`"${tr.name}" kanalı silinsin mi?`)) return;
  snapshot();
  song.tracks = song.tracks.filter((t) => t.id !== id);
  for (const pat of Object.values(song.patterns)) delete pat[id];
  if (sel.track === id) sel.track = song.tracks[0] ? song.tracks[0].id : null;
  commit(false, renderAll);
}

// ---------- piyano rulosu ----------
function renderRoll() {
  const roll = $('roll');
  roll.replaceChildren();
  const tr = track(sel.track);
  if (!tr || INSTRUMENTS[tr.inst].kind !== 'melodic') {
    $('rollTrack').textContent = '—';
    roll.append(h('div', { class: 'roll-empty' }, 'Melodik bir kanal seçin (kanal adına tıklayın).'));
    return;
  }
  const def = INSTRUMENTS[tr.inst];
  $('rollTrack').textContent = `${tr.name} · oktav ${tr.oct}`;
  const chromatic = $('chromatic').checked;
  const base = degreeToMidi(song.root, song.scale, 0, tr.oct);
  let rows;
  if (chromatic) { rows = []; for (let m = base + 24; m >= base - 5; m--) rows.push(m); }
  else {
    const len = SCALES[song.scale].steps.length;
    rows = []; for (let d = len * 2; d >= -2; d--) rows.push(degreeToMidi(song.root, song.scale, d, tr.oct));
  }
  const evs = events(curPat(), tr.id);
  // olay dışındaki notaları da göster (ölçek dışı)
  for (const e of evs) if (!rows.includes(e.n)) rows.push(e.n);
  rows = [...new Set(rows)].sort((a, b) => b - a);
  for (const m of rows) {
    const isRoot = (m - base) % 12 === 0;
    roll.append(h('div', { class: 'rkey' + (isRoot ? ' root' : '') }, midiName(m)));
    const line = h('div', { class: 'rline' + (isRoot ? ' rootline' : '') });
    const occ = new Array(STEPS).fill(null);
    for (const e of evs) if (e.n === m) { occ[e.s] = e; for (let k = 1; k < (e.l || 1) && e.s + k < STEPS; k++) if (!occ[e.s + k]) occ[e.s + k] = 'held'; }
    for (let s = 0; s < STEPS; s++) {
      const o = occ[s];
      const cls = ['cell'];
      if (Math.floor(s / 4) % 2 === 0) cls.push('beat');
      if (o === 'held') cls.push('held');
      else if (o) { cls.push('on'); if (o.g) cls.push('glide'); }
      const cell = h('div', { class: cls.join(' '), 'data-step': s, style: `--c:${def.color}` }, o && o !== 'held' && o.r > 1 ? '×' + o.r : '');
      cell.addEventListener('mousedown', (ev) => rollClick(ev, tr, m, s));
      line.append(cell);
    }
    roll.append(line);
  }
  // kanal ya da desen değişince notaları görünür alana kaydır
  const key = tr.id + '|' + curPat();
  if (key !== lastRollKey) {
    lastRollKey = key;
    const first = roll.querySelector('.rline .cell.on');
    roll.scrollTop = first ? Math.max(0, first.parentElement.offsetTop - roll.offsetTop - 60) : 0;
  }
}
let lastRollKey = '';

function rollClick(ev, tr, m, s) {
  ev.preventDefault();
  const evs = events(curPat(), tr.id);
  snapshot();
  const hit = evs.find((e) => e.n === m && e.s === s);
  const holder = evs.find((e) => e.n === m && e.s < s && e.s + (e.l || 1) > s);
  if (hit && ev.altKey) hit.g = hit.g ? 0 : 1;
  else if (hit) evs.splice(evs.indexOf(hit), 1);
  else if (holder) holder.l = s - holder.s;
  else {
    const e = { s, n: m, l: +$('noteLen').value, v: 0.9 };
    if (ev.altKey) e.g = 1;
    if (INSTRUMENTS[tr.inst].mono) for (const o of evs) if (o.s < s && o.s + (o.l || 1) > s) o.l = s - o.s;
    evs.push(e);
    if (!engine.playing) engine.preview(song, tr, m);
  }
  evs.sort((a, b) => a.s - b.s);
  commit(false, () => { renderRoll(); renderRack(); });
}

// ---------- enstrüman parametreleri ----------
function renderParams() {
  const box = $('params');
  box.replaceChildren();
  const tr = track(sel.track);
  if (!tr) return;
  const def = INSTRUMENTS[tr.inst];
  const knobs = h('div', { class: 'knobs' });
  const instSel = h('select', { onchange: (e) => changeInst(tr, e.target.value) },
    Object.entries(INSTRUMENTS).map(([k, v]) => h('option', { value: k, selected: k === tr.inst }, v.label)));
  const roleSel = h('select', { onchange: (e) => { tr.role = e.target.value; commit(true); } },
    ['kick', 'snare', 'hat', 'openhat', 'perc', 'bass', 'melody', 'counter', 'chords', 'pad', 'riff', 'vox', 'fx'].map((r) => h('option', { value: r, selected: r === tr.role }, r)));
  box.append(h('div', { class: 'row', style: 'margin-bottom:8px' },
    h('b', {}, tr.name), h('label', {}, 'Enstrüman ', instSel), h('label', {}, 'Rol ', roleSel),
    def.kind === 'melodic' ? h('label', {}, 'Oktav ', h('input', { type: 'number', min: 0, max: 7, value: tr.oct, style: 'width:50px', onchange: (e) => { tr.oct = +e.target.value; commit(true, () => { renderRoll(); renderRack(); }); } })) : null,
    def.kind === 'melodic' ? h('button', { title: 'Bu desendeki notaları bir oktav kaydır', onclick: () => shiftNotes(tr, 12) }, 'Notalar +8va') : null,
    def.kind === 'melodic' ? h('button', { onclick: () => shiftNotes(tr, -12) }, 'Notalar −8va') : null,
  ));
  for (const [k, p] of Object.entries(def.params)) {
    const val = h('span', { class: 'v' }, fmt(tr.params[k]));
    const input = h('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: tr.params[k] });
    input.addEventListener('input', () => { tr.params[k] = +input.value; val.textContent = fmt(+input.value); engine.update(song); });
    input.addEventListener('change', () => commit(true));
    knobs.append(h('label', { class: 'knob' }, h('span', {}, p.label, val), input));
  }
  box.append(knobs);
}
const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : (+v).toFixed(2));

function changeInst(tr, inst) {
  snapshot();
  const fresh = makeTrack({ inst, role: tr.role });
  tr.inst = inst; tr.params = fresh.params;
  if (INSTRUMENTS[inst].kind === 'melodic' && INSTRUMENTS[inst].defaultOct != null) tr.oct = INSTRUMENTS[inst].defaultOct;
  commit(false, renderAll);
}

function shiftNotes(tr, d) {
  snapshot();
  for (const e of events(curPat(), tr.id)) e.n += d;
  commit(false, () => { renderRoll(); });
}

// ---------- mikser ----------
function renderMixer() {
  const mx = $('mixer');
  mx.replaceChildren();
  for (const tr of song.tracks) {
    const def = INSTRUMENTS[tr.inst];
    const volTxt = h('span', { class: 'vol' }, Math.round(tr.vol * 100));
    const fader = h('input', { class: 'fader', type: 'range', min: 0, max: 1.2, step: 0.01, value: tr.vol, title: 'Ses' });
    fader.addEventListener('input', () => { tr.vol = +fader.value; volTxt.textContent = Math.round(tr.vol * 100); engine.update(song); });
    fader.addEventListener('change', () => commit(true));
    const mini = (label, key, min, max, title) => {
      const i = h('input', { type: 'range', min, max, step: 0.01, value: tr[key], title });
      i.addEventListener('input', () => { tr[key] = +i.value; engine.update(song); });
      i.addEventListener('change', () => commit(true));
      return h('label', { class: 'mini', title }, label, i);
    };
    mx.append(h('div', { class: 'strip' + (tr.id === sel.track ? ' sel' : ''), style: `--c:${def.color}`, onclick: (e) => { if (e.target.tagName !== 'INPUT') selectTrack(tr.id); } },
      h('div', { class: 'sname', title: tr.name }, tr.name),
      fader, volTxt,
      mini('Pan', 'pan', -1, 1, 'Pan (sol/sağ)'),
      mini('Rev', 'rev', 0, 1, 'Reverb gönderimi'),
      mini('Dly', 'dly', 0, 1, 'Delay gönderimi'),
      mini('Duck', 'duck', 0, 1, 'Sidechain: kick vurunca kıs'),
      mini('Crush', 'crush', 0, 1, 'Bitcrush (dijital kirlilik)'),
    ));
  }
}

// ---------- master ----------
const MASTER_KNOBS = {
  low: ['Bas (dB)', -6, 6, 0.1], high: ['Tiz (dB)', -6, 6, 0.1], drive: ['Saturasyon', 0, 1, 0.01],
  glue: ['Glue komp.', 0, 1, 0.01], makeup: ['Kazanç (dB)', -6, 24, 0.1], ceiling: ['Tavan (dB)', -3, 0, 0.1],
  reverb: ['Reverb süresi (sn)', 0.5, 8, 0.1], wow: ['Bant dalgası', 0, 1, 0.01], noise: ['Hışırtı', 0, 1, 0.01],
};
const MASTER_PRESETS = {
  temiz: { label: 'Temiz', low: 0, high: 0, drive: 0.05, glue: 0.3, makeup: 3, ceiling: -1 },
  sicak: { label: 'Sıcak / lo-fi', low: 1.5, high: -3.5, drive: 0.35, glue: 0.4, makeup: 3, ceiling: -1 },
  yuksek: { label: 'Yüksek & parlak', low: 1.5, high: 2, drive: 0.3, glue: 0.6, makeup: 6, ceiling: -0.3 },
  phonk: { label: 'Phonk ezici', low: 3, high: 1.5, drive: 0.7, glue: 0.7, makeup: 7, ceiling: -0.2 },
};

function renderMaster() {
  const sel_ = $('masterPreset');
  if (!sel_.options.length) {
    sel_.append(h('option', { value: '' }, '— seç —'));
    for (const [k, p] of Object.entries(MASTER_PRESETS)) sel_.append(h('option', { value: k }, p.label));
    const genre = GENRE_MAP[song.meta && song.meta.genre];
    if (genre) sel_.append(h('option', { value: 'genre' }, 'Tarzın preset\'i'));
  }
  const box = $('masterKnobs');
  box.replaceChildren();
  const m = song.master = { ...MASTER_DEFAULT, ...song.master };
  for (const [k, [label, min, max, step]] of Object.entries(MASTER_KNOBS)) {
    const val = h('span', { class: 'v' }, fmt(m[k]));
    const input = h('input', { type: 'range', min, max, step, value: m[k] });
    input.addEventListener('input', () => { m[k] = +input.value; val.textContent = fmt(m[k]); engine.update(song); });
    input.addEventListener('change', () => commit(true));
    box.append(h('label', { class: 'knob' }, h('span', {}, label, val), input));
  }
  if (song.meta && song.meta.target) $('masterTarget').value = closestTarget(song.meta.target);
}
function closestTarget(t) {
  const opts = [...$('masterTarget').options].map((o) => +o.value);
  return opts.reduce((b, o) => (Math.abs(o - t) < Math.abs(b - t) ? o : b), opts[0]);
}

// ---------- tümünü çiz ----------
function renderAll() {
  renderGlobals(); renderArr(); renderRack(); renderRoll(); renderParams(); renderMixer(); renderMaster();
}

// ---------- çalma ----------
function startPlay() {
  engine.play(song, mode, curPat(), sel.sec);
  $('btnPlay').textContent = '■'; $('btnPlay').classList.add('playing');
}
function stopPlay() {
  engine.stop();
  $('btnPlay').textContent = '▶'; $('btnPlay').classList.remove('playing');
  document.querySelectorAll('.ph').forEach((c) => c.classList.remove('ph'));
  $('lcd').textContent = '1.1.1';
}

let lastStep = -1, lastSi = -1;
function frame() {
  requestAnimationFrame(frame);
  const cur = engine.currentStep();
  if (cur && engine.playing) {
    if (mode === 'song' && cur.si >= 0 && cur.si !== lastSi) {
      lastSi = cur.si;
      if (sel.sec !== cur.si) { sel.sec = cur.si; renderArr(); renderRack(); renderRoll(); lastStep = -1; }
      document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('playing', +c.dataset.i === cur.si));
    }
    if (cur.step !== lastStep) {
      lastStep = cur.step;
      document.querySelectorAll('.ph').forEach((c) => c.classList.remove('ph'));
      if (cur.pat === curPat()) document.querySelectorAll(`.cell[data-step="${cur.step}"]`).forEach((c) => c.classList.add('ph'));
      const bar = Math.floor(cur.step / 16) + 1, beat = Math.floor((cur.step % 16) / 4) + 1, six = (cur.step % 4) + 1;
      const secName = mode === 'song' && song.arrangement[cur.si] ? song.arrangement[cur.si].name + ' ' : '';
      $('lcd').textContent = `${secName}${bar}.${beat}.${six}`;
    }
  }
  drawScope();
}

const scopeBuf = new Float32Array(2048);
function drawScope() {
  const an = engine.analyser;
  const cv = $('scope'), c = cv.getContext('2d');
  c.fillStyle = '#0d0f12'; c.fillRect(0, 0, cv.width, cv.height);
  if (!an) return;
  an.getFloatTimeDomainData(scopeBuf);
  c.strokeStyle = '#ff8a2a'; c.lineWidth = 1.2; c.beginPath();
  let peak = 0;
  for (let i = 0; i < cv.width; i++) {
    const v = scopeBuf[Math.floor((i / cv.width) * scopeBuf.length)];
    const y = cv.height / 2 - v * cv.height * 0.48;
    i ? c.lineTo(i, y) : c.moveTo(i, y);
  }
  for (const v of scopeBuf) peak = Math.max(peak, Math.abs(v));
  c.stroke();
  const db = 20 * Math.log10(peak + 1e-6);
  $('meterBar').style.width = Math.max(0, Math.min(100, ((db + 36) / 36) * 100)) + '%';
}

// ---------- AI ----------
async function runAI(edit) {
  const text = $('prompt').value.trim();
  if (!text) return toast('Önce ne istediğini yaz');
  const btn = edit ? $('btnPromptEdit') : $('btnPromptAI');
  await busy(btn, async () => {
    $('promptInfo').textContent = 'Claude besteliyor… (30 sn – birkaç dk sürebilir)';
    const parsed = parsePrompt(text);
    const hint = parsed.genre ? `Tarz ipucu: ${GENRE_MAP[parsed.genre].name}` : '';
    const data = await aiCompose(text, edit ? song : null, settings, hint);
    const s = specToSong(data.spec, edit ? song : null);
    if (!edit && parsed.genre) s.meta.genre = parsed.genre;
    setSong(s, 'AI şarkısı yüklendi');
    $('promptInfo').textContent = (data.spec.explanation || '') + ` (${data.model})`;
  });
  $('promptInfo').textContent ||= '';
}

// Suno şablonu → kod motoru tarzı
const STYLE_TO_GENRE = { rjemo: 'rj_emo', rj: 'rj_type', brphonk: 'brazilian_phonk', drift: 'drift_phonk', trap: 'trap', trrap: 'trap', pop: 'pop', rock: 'rock', metal: 'rock', lofi: 'lofi', arabesk: 'arabesk', edm: 'house', reggaeton: 'reggaeton', ambient: 'ambient' };

function promptLocal(hint = {}) {
  const text = $('prompt').value.trim();
  if (!text && !hint.style) return toast('Önce ne istediğini yaz');
  const p = parsePrompt(text);
  if (!p.genre && STYLE_TO_GENRE[hint.style]) p.genre = STYLE_TO_GENRE[hint.style];
  const found = detectInstruments(text).filter((f) => f.preset);
  // Suno ekranında elle seçilen (tarzın varsayılanı olmayan) enstrümanları da ekle
  const defaults = new Set((STYLE_INSTRUMENTS[hint.style] || { suno: [] }).suno);
  for (const sn of hint.instruments || []) {
    if (defaults.has(sn)) continue;
    const kw = KEYWORDS.find(([, s]) => s === sn);
    if (kw && kw[2] && !found.some((f) => f.preset === kw[2])) found.push({ word: sn, suno: sn, preset: kw[2] });
  }
  $('promptInfo').textContent = 'Anlaşılan: ' + describeParse(p) + (found.length ? ' · enstrüman: ' + found.map((f) => PRESETS[f.preset].label).join(', ') : '');
  if (p.genre) $('genre').value = p.genre;
  if (p.mood) $('mood').value = p.mood;
  $('seed').value = String(Math.floor(Math.random() * 1e6));
  const s = generateSong({ genre: $('genre').value, seed: $('seed').value, mood: p.mood, bpm: p.bpm || undefined, root: p.root || undefined, length: +$('songLen').value, extra: found.map((f) => f.preset) });
  if (p.flags.noVocal) {
    const vox = s.tracks.filter((t) => t.role === 'vox').map((t) => t.id);
    s.tracks = s.tracks.filter((t) => !vox.includes(t.id));
    for (const pat of Object.values(s.patterns)) for (const id of vox) delete pat[id];
  }
  if (p.flags.heavy808) for (const t of s.tracks) if (t.inst === 'bass808') { t.params.drive = Math.max(t.params.drive, 0.85); t.vol = Math.min(1, t.vol + 0.1); }
  setSong(s, s.name);
  updateGenreDesc();
}

async function runAudio() {
  const text = $('audioPrompt').value.trim();
  if (!text) return toast('Ne üretileceğini yaz');
  await busy($('btnAudio'), async () => {
    $('audioInfo').textContent = 'ElevenLabs üretiyor…';
    const extra = audioKind === 'voice' ? { voiceId: $('voiceSel').value } : audioKind === 'music' ? { instrumental: true } : {};
    const ab = await aiAudio(audioKind, text, +$('audioSecs').value || 3, settings, extra);
    await addSampleTrack(ab, (audioKind === 'voice' ? 'Vokal: ' : audioKind === 'music' ? 'Müzik: ' : 'Sample: ') + text.slice(0, 18), audioKind !== 'sfx');
    $('audioInfo').textContent = 'Sampler kanalı eklendi. Rafta adımlara tıklayarak çal.';
  });
}

async function addSampleTrack(arrayBuffer, name, long) {
  engine.ensure(song);
  const buf = await engine.ctx.decodeAudioData(arrayBuffer.slice(0));
  const id = 'smp_' + uid();
  SAMPLE_BANK.set(id, buf);
  snapshot();
  const tr = makeTrack({ inst: 'sampler', role: 'vox', name, vol: 0.8, rev: 0.15 });
  tr.sample = id;
  song.tracks.push(tr);
  // uzun örnekler (vokal/müzik) desenin başında bir kez çalsın
  events(curPat(), tr.id).push({ s: 0, n: 60, l: long ? 32 : 1, v: 0.9 });
  sel.track = tr.id;
  commit(false, renderAll);
  toast(`${name} (${buf.duration.toFixed(1)} sn) eklendi — not: örnekler proje JSON'una kaydedilmez`);
}

// ---------- dosya ----------
function saveJson() {
  const blob = new Blob([JSON.stringify(song, null, 1)], { type: 'application/json' });
  download(blob, (song.name || 'sarki').replace(/[^\p{L}\p{N}\-]+/gu, '_') + '.kodstudyo.json');
}
function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function exportWav() {
  await busy($('btnWav'), async () => {
    toast('Render ediliyor…', false, 10000);
    await samplesReady;
    const buf = await engine.render(song);
    const blob = encodeWav(buf);
    const name = (song.name || 'sarki').replace(/[^\p{L}\p{N}\-]+/gu, '_') + '.wav';
    download(blob, name);
    // sunucudaki exports/ klasörüne de kaydet
    let saved = '';
    try {
      const r = await fetch('/api/export?name=' + encodeURIComponent(name), { method: 'POST', body: blob });
      if (r.ok) saved = ' · exports/' + name;
    } catch { /* sunucu yoksa yalnızca indirme */ }
    toast(`WAV hazır: ${buf.duration.toFixed(1)} sn${saved}`);
  });
}

// ---------- kurulum ----------
function updateGenreDesc() {
  const g = GENRE_MAP[$('genre').value];
  $('genreDesc').textContent = g ? `${g.desc} (${g.bpm[0]}–${g.bpm[1]} BPM)` : '';
}

function setupControls() {
  // tarz listesi (aileye göre gruplu, Phonk başta)
  const fam = {};
  for (const g of GENRES) (fam[g.family] = fam[g.family] || []).push(g);
  for (const [f, list] of Object.entries(fam)) {
    $('genre').append(h('optgroup', { label: f === 'Phonk' ? '★ Phonk ailesi' : f }, list.map((g) => h('option', { value: g.id }, g.name))));
  }
  $('genre').addEventListener('change', updateGenreDesc);
  NOTE_NAMES.forEach((n) => $('root').append(h('option', { value: n }, n)));
  Object.entries(SCALES).forEach(([k, s]) => $('scale').append(h('option', { value: k }, s.label)));
  const groups = {};
  for (const [id, pr] of Object.entries(PRESETS)) (groups[pr.group] = groups[pr.group] || []).push([id, pr]);
  for (const [g, list] of Object.entries(groups)) $('addInst').append(h('optgroup', { label: g }, list.map(([id, pr]) => h('option', { value: 'p:' + id }, pr.label))));
  $('addInst').append(h('optgroup', { label: 'Ham enstrümanlar' }, Object.entries(INSTRUMENTS).map(([k, v]) => h('option', { value: 'i:' + k }, v.label))));

  $('bpm').addEventListener('change', () => { song.bpm = Math.max(40, Math.min(220, +$('bpm').value || 120)); commit(true, renderArr); });
  $('swing').addEventListener('input', () => { song.swing = +$('swing').value; engine.update(song); });
  $('swing').addEventListener('change', () => commit(true));
  $('root').addEventListener('change', () => transposeSong(NOTE_NAMES.indexOf($('root').value) - NOTE_NAMES.indexOf(song.root), $('root').value));
  $('scale').addEventListener('change', () => { song.scale = $('scale').value; commit(true, () => { renderRoll(); renderRack(); }); });

  $('btnPlay').addEventListener('click', () => (engine.playing ? stopPlay() : startPlay()));
  document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    document.querySelectorAll('#modeSeg button').forEach((x) => x.classList.toggle('on', x === b));
    if (engine.playing) startPlay();
  }));

  $('btnGenerate').addEventListener('click', () => doGenerate());
  $('btnDice').addEventListener('click', () => { $('seed').value = String(Math.floor(Math.random() * 1e6)); doGenerate(); });
  $('btnPromptLocal').addEventListener('click', () => promptLocal());
  $('btnPromptAI').addEventListener('click', () => runAI(false));
  $('btnPromptEdit').addEventListener('click', () => runAI(true));

  document.querySelectorAll('#audioKind button').forEach((b) => b.addEventListener('click', async () => {
    audioKind = b.dataset.kind;
    document.querySelectorAll('#audioKind button').forEach((x) => x.classList.toggle('on', x === b));
    $('voiceSel').hidden = audioKind !== 'voice';
    $('audioSecs').value = audioKind === 'music' ? 20 : 3;
    if (audioKind === 'voice' && !$('voiceSel').options.length) {
      try {
        const voices = await aiVoices(settings);
        voices.forEach((v) => $('voiceSel').append(h('option', { value: v.id }, v.name)));
      } catch (e) { toast(e.message, true); }
    }
  }));
  $('btnAudio').addEventListener('click', runAudio);
  $('fileSample').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await addSampleTrack(await f.arrayBuffer(), f.name.replace(/\.[^.]+$/, ''), false); } catch (err) { toast('Ses dosyası okunamadı: ' + err.message, true); }
    e.target.value = '';
  });

  $('btnAddSec').addEventListener('click', () => addSection(true));
  $('btnLinkSec').addEventListener('click', () => addSection(false));
  $('btnAddTrack').addEventListener('click', () => {
    snapshot();
    const v = $('addInst').value;
    const tr = v.startsWith('p:') ? makeTrack({ preset: v.slice(2) }) : makeTrack({ inst: v.slice(2) });
    // yeni kanalı mevcut desen için hemen doldur, boş kalmasın
    if (song.meta && song.meta.genre) { song.tracks.push(tr); song.patterns[curPat()][tr.id] = regenerateTrack(song, tr.id, curPat(), Math.floor(Math.random() * 1e6)); song.tracks.pop(); }
    song.tracks.push(tr);
    sel.track = tr.id;
    commit(false, renderAll);
  });
  $('btnClearPat').addEventListener('click', () => {
    snapshot();
    for (const k of Object.keys(song.patterns[curPat()])) song.patterns[curPat()][k] = [];
    commit(false, () => { renderRack(); renderRoll(); });
  });
  $('chromatic').addEventListener('change', renderRoll);
  $('btnRegenRoll').addEventListener('click', () => { const tr = track(sel.track); if (tr) regen(tr); });

  $('masterPreset').addEventListener('change', () => {
    const v = $('masterPreset').value;
    let p = MASTER_PRESETS[v];
    if (v === 'genre') p = (GENRE_MAP[song.meta && song.meta.genre] || {}).master;
    if (!p) return;
    const { label, ...vals } = p;
    song.master = { ...MASTER_DEFAULT, ...song.master, ...vals };
    commit(true, renderMaster);
  });
  $('btnAutoMaster').addEventListener('click', () => busy($('btnAutoMaster'), async () => {
    const target = +$('masterTarget').value;
    $('masterInfo').textContent = 'Analiz ediliyor…';
    await samplesReady;
    const { master, result } = await autoMaster(engine, song, target, (i, r, mk) => {
      $('masterInfo').textContent = `Tur ${i + 1}: RMS ${r.rmsDb.toFixed(1)} dB, tepe ${r.peakDb.toFixed(1)} dB, kazanç ${mk.toFixed(1)} dB`;
    });
    snapshot();
    song.master = master;
    commit(false, renderMaster);
    $('masterInfo').textContent = `Bitti: RMS ${result.rmsDb.toFixed(1)} dB (hedef ${target}), tepe ${result.peakDb.toFixed(1)} dB, kazanç ${master.makeup.toFixed(1)} dB`;
  }));

  fetch('/songs/index.json').then((r) => r.json()).then((list) => {
    for (const d of list) $('demoSel').append(h('option', { value: d.file }, d.name));
  }).catch(() => {});
  $('demoSel').addEventListener('change', async () => {
    const f = $('demoSel').value; if (!f) return;
    try { setSong(normalize(await (await fetch('/songs/' + f)).json()), 'Hazır şarkı yüklendi'); } catch (err) { toast('Yüklenemedi: ' + err.message, true); }
    $('demoSel').value = '';
  });
  $('btnUndo').addEventListener('click', undo);
  $('btnSave').addEventListener('click', saveJson);
  $('btnWav').addEventListener('click', exportWav);
  $('fileOpen').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { setSong(normalize(JSON.parse(await f.text())), 'Proje açıldı'); } catch (err) { toast('Proje okunamadı: ' + err.message, true); }
    e.target.value = '';
  });

  // ayarlar
  $('btnSettings').addEventListener('click', async () => {
    $('setAnthropic').value = settings.anthropicKey || '';
    $('setEleven').value = settings.elevenKey || '';
    $('setModel').value = settings.model;
    $('setEffort').value = settings.effort;
    const st = await serverStatus();
    $('serverKeys').textContent = `Sunucu .env: Anthropic ${st.anthropic ? 'var' : 'yok'}, ElevenLabs ${st.elevenlabs ? 'var' : 'yok'}.`;
    $('dlgSettings').showModal();
  });
  // Kaydet ve Enter aynı yoldan geçer; Vazgeç (type=button) yalnızca kapatır.
  $('dlgSettings').querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    settings = { ...settings, anthropicKey: $('setAnthropic').value.trim(), elevenKey: $('setEleven').value.trim(), model: $('setModel').value, effort: $('setEffort').value };
    saveSettings(settings);
    $('dlgSettings').close();
    const parts = [settings.anthropicKey ? 'Anthropic ✓' : 'Anthropic yok', settings.elevenKey ? 'ElevenLabs ✓' : 'ElevenLabs yok'];
    toast('Ayarlar kaydedildi: ' + parts.join(' · '));
    $('voiceSel').replaceChildren(); // yeni anahtarla ses listesi yeniden yüklensin
  });

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); engine.playing ? stopPlay() : startPlay(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });
}

function transposeSong(semi, root) {
  snapshot();
  song.root = root;
  for (const pat of Object.values(song.patterns)) {
    for (const [tid, evs] of Object.entries(pat)) {
      const tr = track(tid);
      if (!tr || INSTRUMENTS[tr.inst].kind !== 'melodic' || tr.inst === 'sampler') continue;
      for (const e of evs) e.n += semi > 6 ? semi - 12 : semi < -6 ? semi + 12 : semi;
    }
  }
  commit(false, () => { renderRoll(); renderRack(); });
}

function normalize(s) {
  if (!s || !Array.isArray(s.tracks) || !s.patterns || !Array.isArray(s.arrangement)) throw new Error('geçersiz proje');
  s.patternMeta = s.patternMeta || {};
  s.master = { ...MASTER_DEFAULT, ...(s.master || {}) };
  s.meta = s.meta || { genre: null, seed: null, prog: [0, 0, 0, 0] };
  for (const t of s.tracks) {
    if (!INSTRUMENTS[t.inst]) throw new Error('bilinmeyen enstrüman: ' + t.inst);
    const fresh = makeTrack({ inst: t.inst, role: t.role });
    Object.assign(fresh, t, { params: { ...fresh.params, ...(t.params || {}) } });
    Object.assign(t, fresh);
  }
  return s;
}

// ---------- görünüm: Şarkı iste / Stüdyo ----------
function setView(v) {
  document.body.classList.toggle('v-suno', v === 'suno');
  document.body.classList.toggle('v-formul', v === 'formul');
  if (v !== 'formul' && formula) formula.stop();
  document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  try { localStorage.setItem('kodstudyo.view', v); } catch { /* yok say */ }
  if (v === 'studio') renderAll();
}

// ---------- başlat ----------
setupControls();
document.querySelectorAll('#viewSeg button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
setupSuno({
  getSettings: () => settings,
  toast,
  onLocal: (hint) => {
    $('prompt').value = hint.text.trim();
    setView('studio');
    promptLocal(hint);
  },
  onAddToStudio: async (it) => {
    try {
      const ab = await (await fetch(it.file)).arrayBuffer();
      setView('studio');
      await addSampleTrack(ab, it.title.slice(0, 24), true);
    } catch (e) { toast('Eklenemedi: ' + e.message, true); }
  },
});
var formula = setupFormula({
  getCtx: () => engine.ensure(song) || engine.ctx,
  toast,
  onAddToStudio: async (ab, name) => { setView('studio'); await addSampleTrack(ab, name, true); },
});
let startView = 'suno';
try { startView = localStorage.getItem('kodstudyo.view') || 'suno'; } catch { /* yok say */ }
let saved = null;
try { saved = JSON.parse(localStorage.getItem('kodstudyo.song') || 'null'); } catch { /* yok */ }
if (saved) {
  try { song = normalize(saved); } catch { song = null; }
}
if (!song) {
  $('genre').value = 'brazilian_phonk';
  $('seed').value = '2026';
  song = generateSong({ genre: 'brazilian_phonk', seed: '2026' });
} else {
  if (song.meta && song.meta.genre) $('genre').value = song.meta.genre;
  if (song.meta && song.meta.seed) $('seed').value = song.meta.seed;
}
sel.track = (song.tracks.find((t) => INSTRUMENTS[t.inst].kind === 'melodic') || song.tracks[0] || {}).id;
updateGenreDesc();
engine.update(song);
renderAll();
samplesReady = loadSamples(song);
requestAnimationFrame(frame);
setView(startView);
serverStatus().then((st) => {
  const hasAI = st.anthropic || settings.anthropicKey;
  $('promptInfo').textContent = hasAI ? 'AI hazır.' : 'AI anahtarı yok: "Motorla yap" anahtarsız çalışır; AI için ⚙ ayarlarına anahtar ekle.';
});
window.kodStudyo = { get song() { return song; }, engine, loadSamples };

// ajan gelen kutusu: bir yapay zekâ ajanı "stüdyoda aç" dediğinde şarkı buraya düşer
let inboxSeq = -1;
async function pollInbox() {
  try {
    const r = await fetch('/api/ui/inbox?after=' + Math.max(0, inboxSeq), { cache: 'no-store' });
    const d = await r.json();
    // ilk sorguda yalnızca az önce gönderilenleri al (ajan pencereyi bu şarkı için açmış olabilir)
    const fresh = d.items.filter((it) => inboxSeq >= 0 || d.now - it.at < 20000);
    for (const it of fresh) { setView('studio'); setSong(normalize(it.song), 'Ajandan geldi: ' + (it.song.name || 'şarkı')); }
    inboxSeq = d.seq;
  } catch { /* sunucu yok: dosyadan açılmış olabilir */ }
  setTimeout(pollInbox, 2000);
}
pollInbox();
