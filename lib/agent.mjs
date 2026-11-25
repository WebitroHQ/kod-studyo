// Ajan API'si: yapay zekâ ajanları (MCP, CLI, düz HTTP) ve kullanıcı aynı motoru kullanır.
// Şarkı üretimi Node'da (kural tabanlı besteci) yapılır; Web Audio gerektiren render işi
// bir "render işçisi"ne (gizli Electron penceresi ya da başsız Chrome/Edge) kuyrukla yollanır.
// Formül şarkıları saf JS olduğu için doğrudan Node'da render edilir.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { songFromRecipe, normalizeSong, summarize } from '../public/js/recipe.js';
import { GENRES } from '../public/js/genres.js';
import { INSTRUMENTS } from '../public/js/instruments.js';
import { PRESETS as INST_PRESETS } from '../public/js/instrumentation.js';
import { PRESETS as FORMULAS, renderSong as renderFormula } from '../public/js/formula.js';

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj, null, 1)); };
const slug = (s) => String(s || 'sarki').toLowerCase()
  .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sarki';

async function readJson(req) {
  let data = '';
  for await (const c of req) { data += c; if (data.length > 30e6) throw new Error('istek çok büyük'); }
  return data ? JSON.parse(data) : {};
}
async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

// Float32 mono → 16-bit WAV
function wavFromFloat(data, sr = 44100) {
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) { const v = Math.max(-1, Math.min(1, data[i])); buf.writeInt16LE(v < 0 ? v * 0x8000 : v * 0x7fff, 44 + i * 2); }
  return buf;
}

// API'nin kendini anlatan özeti (ajanlar GET /api/agent ile okur)
export const API_DOC = {
  app: 'Kod Stüdyo',
  about: 'Kodla müzik üreten stüdyo. Şarkılar JSON (tracks + patterns + arrangement) olarak tutulur, WAV olarak render edilir. Tüm üretim yereldir, API anahtarı gerekmez.',
  endpoints: {
    'GET /api/agent/genres': 'tarzlar (generate.genre için id)',
    'GET /api/agent/instruments': 'enstrüman ön ayarları (generate.instruments için id) ve temel enstrümanlar (song.tracks[].inst)',
    'GET /api/agent/formulas': 'formül (matematik) şarkısı ön ayarları',
    'GET /api/agent/library': 'hazır şarkılar ve ajanın kaydettiği şarkılar',
    'GET /api/agent/song?file=…': 'kayıtlı bir şarkının JSON\'u (düzenleyip /render ile yeniden render et)',
    'GET /api/agent/format': 'şarkı JSON biçiminin açıklaması',
    'POST /api/agent/generate': '{prompt?, genre?, seed?, bpm?, mood?: "dark"|"bright", root?, scale?, length?: 1-5, instruments?: [id], vocals?: bool, name?, render?: true, open?: false} → şarkı JSON + WAV yolu',
    'POST /api/agent/render': '{song | file | library, name?, open?} → WAV yolu',
    'POST /api/agent/formula': '{preset | song, name?} → WAV yolu',
    'POST /api/agent/open': '{song | file | library} → şarkıyı kullanıcının stüdyo penceresinde açar',
  },
};

export const SONG_FORMAT = `Şarkı JSON biçimi (Kod Stüdyo):
{ name, bpm, swing (0..0.5), root ("C".."B", diyez: "C#"), scale (ör. "minor","dorian","phrygian","major"),
  tracks: [{ id, name, inst, role, oct, vol 0..1.2, pan -1..1, rev 0..1, dly 0..1, duck 0..1, params:{...} }],
  patterns: { P1: { <trackId>: [ { s, n, l, v, g?, r? } ] }, ... },
  patternMeta: { P1: { type: "intro"|"verse"|"build"|"drop"|"drop2"|"break"|"outro", name } },
  arrangement: [ { name, pattern: "P1", reps } ],
  master: { low, high (dB -6..6), drive 0..1, glue 0..1, makeup dB 0..12, ceiling dB -3..0, reverb, damp, wow, noise } }
Olay: s = adım 0..31 (bir desen 2 ölçü, adım = 16'lık), n = MIDI nota (davullarda 60), l = uzunluk (adım), v = hız 0..1,
g = önceki notadan glide (808 kayması), r = ratchet 2/3/4 (hi-hat roll).
Roller: kick snare hat openhat perc bass melody counter chords pad riff vox fx.
Temel enstrümanlar: ${Object.keys(INSTRUMENTS).join(', ')}.
fx enstrümanında n=60 riser, 61 düşüş, 62 impact.
En kolay yol: /generate ile bir şarkı üret, dönen JSON'u düzenle, /render ile tekrar render et.`;

export function createAgent({ dataDir, publicDir, hooks = {} }) {
  const outDir = () => path.join(dataDir(), 'exports', 'ajan');
  const queue = [];          // bekleyen render işleri
  const waiting = [];        // iş bekleyen işçi istekleri (long-poll)
  const jobs = new Map();    // id → { resolve, reject, job }
  let lastWorker = 0, lastUi = 0, inboxSeq = 0;
  const inbox = [];

  const workerAlive = () => Date.now() - lastWorker < 30000;
  const uiAlive = () => Date.now() - lastUi < 6000;

  function dispatch() {
    while (queue.length && waiting.length) {
      const res = waiting.shift();
      if (res.writableEnded) continue;
      const job = queue.shift();
      json(res, 200, job);
    }
  }

  function renderOnWorker(song, name) {
    const id = crypto.randomUUID().slice(0, 8);
    const job = { id, name, song };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { jobs.delete(id); reject(new Error('render zaman aşımı (10 dk); render işçisi çalışmıyor olabilir')); }, 600000);
      jobs.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      queue.push(job);
      if (!workerAlive() && hooks.ensureWorker) {
        Promise.resolve(hooks.ensureWorker()).catch((e) => { jobs.delete(id); clearTimeout(timer); reject(e); });
      }
      dispatch();
    });
  }

  function saveSong(song, base) {
    fs.mkdirSync(outDir(), { recursive: true });
    const file = path.join(outDir(), base + '.kodstudyo.json');
    fs.writeFileSync(file, JSON.stringify(song, null, 1));
    return file;
  }
  function saveWav(buf, base) {
    fs.mkdirSync(outDir(), { recursive: true });
    const file = path.join(outDir(), base + '.wav');
    fs.writeFileSync(file, buf);
    return { wav: file, url: `/exports/ajan/${encodeURIComponent(base)}.wav` };
  }

  function libraryList() {
    let bundled = [];
    try { bundled = JSON.parse(fs.readFileSync(path.join(publicDir, 'songs', 'index.json'), 'utf8')); } catch { /* yok */ }
    let saved = [];
    try { saved = fs.readdirSync(outDir()).filter((f) => f.endsWith('.kodstudyo.json')).map((f) => path.join(outDir(), f)); } catch { /* yok */ }
    return { bundled: bundled.map((b) => ({ library: b.file, name: b.name })), saved };
  }

  function resolveSong(body) {
    let s = body.song;
    if (typeof s === 'string') s = JSON.parse(s);
    if (!s && body.file) {
      const f = path.isAbsolute(body.file) ? body.file : path.join(outDir(), body.file);
      s = JSON.parse(fs.readFileSync(f, 'utf8'));
    }
    if (!s && body.library) {
      const f = path.normalize(path.join(publicDir, 'songs', path.basename(body.library)));
      s = JSON.parse(fs.readFileSync(f, 'utf8'));
    }
    if (!s) throw Object.assign(new Error('şarkı yok: song, file ya da library gönderin'), { status: 400 });
    return normalizeSong(s);
  }

  function openInUi(song) {
    inbox.push({ seq: ++inboxSeq, at: Date.now(), song });
    if (inbox.length > 5) inbox.shift();
    const shown = uiAlive();
    if (!shown && hooks.openUi) hooks.openUi();
    return shown ? 'açık stüdyo penceresine gönderildi' : 'stüdyo penceresi açılıyor';
  }

  async function renderAndSave(song, base) {
    const { buf, seconds } = await renderOnWorker(song, base);
    return { ...saveWav(buf, base), seconds };
  }

  // ---------- HTTP yönlendirme ----------
  return async function handle(req, res, url) {
    const p = url.pathname;
    try {
      // işçi
      if (p === '/api/worker/next') {
        lastWorker = Date.now();
        if (queue.length) return json(res, 200, queue.shift());
        waiting.push(res);
        const t = setTimeout(() => { const i = waiting.indexOf(res); if (i >= 0) waiting.splice(i, 1); if (!res.writableEnded) { res.writeHead(204); res.end(); } }, 20000);
        res.on('close', () => { clearTimeout(t); const i = waiting.indexOf(res); if (i >= 0) waiting.splice(i, 1); });
        return true;
      }
      if (p === '/api/worker/done' && req.method === 'POST') {
        lastWorker = Date.now();
        const j = jobs.get(url.searchParams.get('id'));
        const buf = await readRaw(req);
        if (j) { jobs.delete(url.searchParams.get('id')); j.resolve({ buf, seconds: +url.searchParams.get('seconds') || 0 }); }
        json(res, 200, { ok: true });
        return true;
      }
      if (p === '/api/worker/fail' && req.method === 'POST') {
        const j = jobs.get(url.searchParams.get('id'));
        const body = await readJson(req).catch(() => ({}));
        if (j) { jobs.delete(url.searchParams.get('id')); j.reject(new Error('render hatası: ' + (body.error || 'bilinmiyor'))); }
        json(res, 200, { ok: true });
        return true;
      }
      // stüdyo arayüzü: ajanın gönderdiği şarkıları alır
      if (p === '/api/ui/inbox') {
        lastUi = Date.now();
        const after = +url.searchParams.get('after') || 0;
        json(res, 200, { seq: inboxSeq, now: Date.now(), items: inbox.filter((i) => i.seq > after) });
        return true;
      }
      if (!p.startsWith('/api/agent')) return false;

      if (p === '/api/agent' || p === '/api/agent/') return json(res, 200, { ...API_DOC, worker: workerAlive(), ui: uiAlive(), dataDir: dataDir() }), true;
      if (p === '/api/agent/format') return res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }), res.end(SONG_FORMAT), true;
      if (p === '/api/agent/genres') return json(res, 200, GENRES.map((g) => ({ id: g.id, name: g.name, family: g.family, desc: g.desc, bpm: g.bpm }))), true;
      if (p === '/api/agent/instruments') {
        return json(res, 200, {
          presets: Object.entries(INST_PRESETS).map(([id, v]) => ({ id, label: v.label, group: v.group })),
          instruments: Object.entries(INSTRUMENTS).map(([id, v]) => ({ id, label: v.label || id, kind: v.kind })),
        }), true;
      }
      if (p === '/api/agent/formulas') {
        return json(res, 200, Object.entries(FORMULAS).map(([id, f]) => ({ id, label: f.label, sections: f.sections.map((s) => s.name), seconds: +f.sections.reduce((a, s) => a + s.duration + (f.gap || 0), 0).toFixed(1) }))), true;
      }
      if (p === '/api/agent/library') return json(res, 200, libraryList()), true;
      if (p === '/api/agent/song') {
        const song = resolveSong({ file: url.searchParams.get('file'), library: url.searchParams.get('library') });
        return json(res, 200, song), true;
      }

      if (req.method !== 'POST') return json(res, 405, { error: 'POST kullanın' }), true;
      const body = await readJson(req);

      if (p === '/api/agent/generate') {
        const song = songFromRecipe(body);
        const base = slug(body.name || song.name);
        const file = saveSong(song, base);
        const out = { summary: summarize(song), file };
        if (body.open) out.open = openInUi(song);
        if (body.render !== false) Object.assign(out, await renderAndSave(song, base));
        if (body.include_song) out.song = song;
        return json(res, 200, out), true;
      }
      if (p === '/api/agent/render') {
        const song = resolveSong(body);
        const base = slug(body.name || song.name);
        const out = { summary: summarize(song), file: saveSong(song, base) };
        if (body.open) out.open = openInUi(song);
        Object.assign(out, await renderAndSave(song, base));
        return json(res, 200, out), true;
      }
      if (p === '/api/agent/formula') {
        let fsong = body.song;
        if (typeof fsong === 'string') fsong = JSON.parse(fsong);
        if (!fsong) fsong = FORMULAS[body.preset];
        if (!fsong || !Array.isArray(fsong.sections)) return json(res, 400, { error: 'preset ya da song (sections dizisi) gerekli. Ön ayarlar: ' + Object.keys(FORMULAS).join(', ') }), true;
        const { data, total } = renderFormula(fsong);
        const base = 'formul-' + slug(body.name || body.preset || fsong.label || 'formul');
        return json(res, 200, { ...saveWav(wavFromFloat(data), base), seconds: +total.toFixed(1) }), true;
      }
      if (p === '/api/agent/open') return json(res, 200, { result: openInUi(resolveSong(body)) }), true;
      return json(res, 404, { error: 'bilinmeyen uç: ' + p, help: 'GET /api/agent' }), true;
    } catch (e) {
      if (!res.headersSent) json(res, e.status || 500, { error: e.message });
      return true;
    }
  };
}
