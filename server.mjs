// Kod Stüdyo yerel sunucusu: statik dosyalar + opsiyonel AI proxy'si.
// Anahtarlar .env dosyasından (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY) ya da arayüzden gelen başlıklardan okunur.
// Anahtar yoksa stüdyo tamamen AI'sız çalışmaya devam eder.
// Ajan API'si (lib/agent.mjs): yapay zekâ ajanları şarkı üretir/render eder; ayrıntı: GET /api/agent.
// Doğrudan çalıştırma: node server.mjs [--worker]  (--worker: başsız Chrome/Edge ile render işçisini hemen aç)
// Masaüstü uygulaması (electron/main.mjs) startServer() ile içeriden başlatır.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAgent } from './lib/agent.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));   // uygulama dosyaları (pakette salt okunur)
const PUBLIC = path.join(ROOT, 'public');
let DATA = ROOT;                                             // yazılabilir klasör: exports/ ve .env

// basit .env okuyucu (önce veri klasörü, sonra uygulama klasörü)
function loadEnv(dir) {
  try {
    for (const line of fs.readFileSync(path.join(dir, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* .env yok */ }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const anthropicKey = (req) => req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY || '';
const elevenKey = (req) => req.headers['x-elevenlabs-key'] || process.env.ELEVENLABS_API_KEY || '';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 20e6) reject(new Error('istek çok büyük')); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

// ---------- Claude ile besteleme ----------
const SECTION_TYPES = ['intro', 'verse', 'build', 'drop', 'drop2', 'break', 'outro'];
const ROLES = ['kick', 'snare', 'hat', 'openhat', 'perc', 'bass', 'melody', 'counter', 'chords', 'pad', 'riff', 'vox', 'fx'];

function songSchema(instruments, scales, notes) {
  const num = { type: 'number' }, int = { type: 'integer' }, str = { type: 'string' };
  const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
  return obj({
    name: str,
    explanation: str,
    bpm: int,
    swing: num,
    root: { type: 'string', enum: notes },
    scale: { type: 'string', enum: scales },
    tracks: { type: 'array', items: obj({ key: str, name: str, inst: { type: 'string', enum: instruments }, role: { type: 'string', enum: ROLES }, oct: int, vol: num, pan: num, rev: num, dly: num, duck: num }) },
    patterns: { type: 'array', items: obj({
      id: str,
      type: { type: 'string', enum: SECTION_TYPES },
      parts: { type: 'array', items: obj({ track: str, events: { type: 'array', items: obj({ s: int, n: int, l: int, v: num, g: { type: 'boolean' }, r: int }) } }) },
    }) },
    arrangement: { type: 'array', items: obj({ name: str, pattern: str, reps: int }) },
    master: obj({ low: num, high: num, drive: num, glue: num, makeup: num, ceiling: num }),
  });
}

function systemPrompt(ctx) {
  return `Sen "Kod Stüdyo" adlı tarayıcı DAW'ının bestecisisin. Sesler tamamen kodla sentezleniyor; sen notaları ve mikser ayarlarını JSON olarak yazıyorsun, kullanıcı sonra her şeyi elle düzenleyebiliyor.

Motor kuralları:
- Her desen (pattern) 2 ölçü = 32 adım, her adım bir 16'lık nota. s = 0..31.
- Olay: s (adım), n (MIDI nota; davullarda 60 yaz), l (uzunluk, adım cinsinden, 1..32), v (hız 0..1), g (true = önceki notadan glide/slide; 808 kaymaları için), r (ratchet: 1 normal, 2/3/4 = o adımda hızlı tekrar, hi-hat roll ve stutter için).
- fx enstrümanında n=60 riser, 61 düşüş, 62 impact; riser için l uzun (16-32) olmalı.
- Enstrümanlar ve tipik oktavları: ${ctx.instruments}.
- Roller: ${ROLES.join(', ')}. Her kanalın bir rolü olsun.
- Mikser: vol 0..1.2, pan -1..1, rev/dly 0..1 (reverb/delay send), duck 0..1 (kick'e sidechain).
- Master: low/high dB -6..6, drive 0..1 (saturasyon), glue 0..1 (kompresör), makeup dB 0..12, ceiling dB -3..0.
- Bölüm tipleri: ${SECTION_TYPES.join(', ')}. arrangement, desen id'lerine reps (tekrar sayısı) ile referans verir. Toplam 12-20 desen tekrarı iyi bir uzunluktur.

Müzikal beklenti:
- Seçilen ölçek ve ton dışına çıkma (bilinçli kromatik geçiş hariç). Melodiler tekrar eden motif + varyasyon olsun; bar 2 bar 1'e cevap versin.
- Bas, kick ile kilitlensin. Drop'lar en dolu bölüm; intro/break daha boş.
- Brazilian/drift phonk: 808 cowbell (inst "cowbell", oct 5) ana melodi, distorsiyonlu 808 (bass808) kick'i takip eder ve glide yapar, sert master (drive 0.6+, makeup 6).
- RJ Pasin tarzı: distorsiyonlu elektro gitar riffi (guitar, oct 2, palm mute chug) + gitar lead, glitch/stutter için r=3/4 kullan.

Bilinen tarzlar: ${ctx.genres}.
explanation alanına Türkçe, 1-3 cümlelik kısa bir açıklama yaz.`;
}

async function compose(req, res) {
  const key = anthropicKey(req);
  if (!key) return json(res, 400, { error: 'Anthropic API anahtarı yok. Ayarlardan ekleyin veya .env dosyasına yazın.' });
  let Anthropic;
  try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); }
  catch { return json(res, 500, { error: 'Sunucuda @anthropic-ai/sdk kurulu değil: kod-studyo klasöründe "npm install" çalıştırın.' }); }

  const body = await readBody(req);
  const client = new Anthropic({ apiKey: key });
  const user = body.song
    ? `Mevcut şarkı (JSON):\n${JSON.stringify(body.song)}\n\nİstek: ${body.prompt}\n\nŞarkının tamamını güncellenmiş haliyle döndür. İstenmeyen kısımları koru.`
    : `İstek: ${body.prompt}\n${body.hint ? 'İpucu: ' + body.hint : ''}\nSıfırdan tam bir şarkı besteleyip döndür.`;
  try {
    const stream = client.beta.messages.stream({
      model: body.model || 'claude-opus-5-5',
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: body.effort || 'medium', format: { type: 'json_schema', schema: songSchema(body.instruments, body.scales, body.notes) } },
      system: systemPrompt({ instruments: body.instrumentInfo, genres: body.genreInfo }),
      messages: [{ role: 'user', content: user }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') return json(res, 422, { error: 'Model isteği reddetti.' });
    if (msg.stop_reason === 'max_tokens') return json(res, 422, { error: 'Yanıt çok uzun kesildi; daha kısa bir şarkı isteyin.' });
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let spec;
    try { spec = JSON.parse(text); } catch { return json(res, 502, { error: 'Model geçerli JSON döndürmedi.' }); }
    json(res, 200, { spec, model: msg.model, usage: msg.usage });
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    json(res, status >= 400 && status < 600 ? status : 500, { error: (e && e.message) || String(e) });
  }
}

// ---------- ElevenLabs ses üretimi ----------
async function elevenAudio(req, res) {
  const key = elevenKey(req);
  if (!key) return json(res, 400, { error: 'ElevenLabs API anahtarı yok. Ayarlardan ekleyin veya .env dosyasına yazın.' });
  const body = await readBody(req);
  let url, payload;
  if (body.kind === 'music') {
    url = 'https://api.elevenlabs.io/v1/music';
    payload = { prompt: body.prompt, music_length_ms: Math.round((body.seconds || 15) * 1000), force_instrumental: !!body.instrumental };
  } else if (body.kind === 'voice') {
    if (!body.voiceId) return json(res, 400, { error: 'Ses (voice) seçilmedi.' });
    url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(body.voiceId)}?output_format=mp3_44100_128`;
    payload = { text: body.prompt, model_id: 'eleven_multilingual_v2' };
  } else {
    url = 'https://api.elevenlabs.io/v1/sound-generation';
    payload = { text: body.prompt, duration_seconds: Math.min(22, Math.max(0.5, body.seconds || 2)) };
  }
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' }, body: JSON.stringify(payload) });
    if (!r.ok) return json(res, r.status, { error: `ElevenLabs hatası ${r.status}: ${(await r.text()).slice(0, 400)}` });
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, { 'content-type': r.headers.get('content-type') || 'audio/mpeg' });
    res.end(buf);
  } catch (e) { json(res, 500, { error: e.message }); }
}

async function elevenVoices(req, res) {
  const key = elevenKey(req);
  if (!key) return json(res, 400, { error: 'ElevenLabs API anahtarı yok.' });
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
    if (!r.ok) return json(res, r.status, { error: `ElevenLabs hatası ${r.status}` });
    const data = await r.json();
    json(res, 200, { voices: (data.voices || []).map((v) => ({ id: v.voice_id, name: v.name })) });
  } catch (e) { json(res, 500, { error: e.message }); }
}

// ---------- Şarkı iste (Suno modu): ElevenLabs Music ----------
// /v1/music/plan kredi harcamaz: bölümler, stiller ve sözlerden oluşan düzenlenebilir plan döner.
// /v1/music plan (ya da düz prompt) ile vokalli/enstrümantal tam şarkı üretir.
const lib = () => path.join(DATA, 'exports', 'sarkilar');

async function elevenJson(key, url, payload) {
  const r = await fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) {
    const txt = await r.text();
    let msg = `ElevenLabs hatası ${r.status}: ${txt.slice(0, 400)}`;
    if (r.status === 402 || /paid_plan_required/.test(txt)) msg = 'ElevenLabs Music API ücretsiz hesapta kapalı; ücretli bir ElevenLabs planı gerekiyor. (Anahtar doğru, hesap planı yetmiyor.)';
    else if (r.status === 401) msg = 'ElevenLabs anahtarı geçersiz ya da bu işlem için yetkisi yok.';
    else if (r.status === 429) msg = 'ElevenLabs hız/kota sınırı: biraz bekleyip tekrar deneyin.';
    else if (/bad_prompt|artist|copyright/i.test(txt)) msg = 'ElevenLabs isteği reddetti (sanatçı adı ya da telifli içerik olabilir). İsteği sanatçı adı geçmeden tarif edin. Ayrıntı: ' + txt.slice(0, 300);
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r;
}

async function musicPlan(req, res) {
  const key = elevenKey(req);
  if (!key) return json(res, 400, { error: 'ElevenLabs API anahtarı yok. ⚙ ayarlarından ekleyin veya .env dosyasına yazın.' });
  const body = await readBody(req);
  if (!body.prompt) return json(res, 400, { error: 'İstek boş.' });
  try {
    const payload = { prompt: body.prompt, model_id: 'music_v1' };
    if (body.seconds) payload.music_length_ms = Math.round(Math.min(600, Math.max(10, body.seconds)) * 1000);
    const r = await elevenJson(key, 'https://api.elevenlabs.io/v1/music/plan', payload);
    json(res, 200, { plan: await r.json() });
  } catch (e) { json(res, e.status || 500, { error: e.message }); }
}

async function musicCompose(req, res) {
  const key = elevenKey(req);
  if (!key) return json(res, 400, { error: 'ElevenLabs API anahtarı yok. ⚙ ayarlarından ekleyin veya .env dosyasına yazın.' });
  const body = await readBody(req);
  const payload = { model_id: 'music_v1' };
  if (body.plan) payload.composition_plan = body.plan;
  else {
    if (!body.prompt) return json(res, 400, { error: 'İstek boş.' });
    payload.prompt = body.prompt;
    payload.force_instrumental = !!body.instrumental;
    if (body.seconds) payload.music_length_ms = Math.round(Math.min(600, Math.max(10, body.seconds)) * 1000);
  }
  try {
    const r = await elevenJson(key, 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', payload);
    const audio = Buffer.from(await r.arrayBuffer());
    const songId = r.headers.get('song-id') || r.headers.get('x-song-id') || null;
    fs.mkdirSync(lib(), { recursive: true });
    const slug = String(body.title || body.prompt || 'sarki').toLowerCase()
      .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sarki';
    const base = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${slug}`;
    fs.writeFileSync(path.join(lib(), base + '.mp3'), audio);
    const meta = { file: `/exports/sarkilar/${base}.mp3`, title: body.title || body.prompt || 'Şarkı', prompt: body.prompt || null, plan: body.plan || null, instrumental: !!body.instrumental, songId, createdAt: new Date().toISOString(), bytes: audio.length };
    fs.writeFileSync(path.join(lib(), base + '.json'), JSON.stringify(meta, null, 1));
    json(res, 200, meta);
  } catch (e) { json(res, e.status || 500, { error: e.message }); }
}

function musicLibrary(req, res) {
  let items = [];
  try {
    items = fs.readdirSync(lib()).filter((f) => f.endsWith('.json'))
      .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(lib(), f), 'utf8')); } catch { return null; } })
      .filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch { /* klasör yok */ }
  json(res, 200, { items });
}

// ---------- WAV'ı diske kaydet (kod-studyo/exports) ----------
async function saveExport(req, res, url) {
  const name = (url.searchParams.get('name') || 'sarki.wav').replace(/[^\p{L}\p{N}\-. ]+/gu, '_').slice(0, 120);
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 300e6) return json(res, 413, { error: 'dosya çok büyük' }); chunks.push(c); }
  const dir = path.join(DATA, 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name.endsWith('.wav') ? name : name + '.wav');
  fs.writeFileSync(file, Buffer.concat(chunks));
  json(res, 200, { path: file, bytes: size });
}

// ---------- sunucu ----------
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

async function handler(req, res, agent) {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/status') return json(res, 200, { app: 'kod-studyo', version: VERSION, anthropic: !!process.env.ANTHROPIC_API_KEY, elevenlabs: !!process.env.ELEVENLABS_API_KEY });
    if (await agent(req, res, url)) return;
    if (url.pathname === '/api/ai/compose' && req.method === 'POST') return await compose(req, res);
    if (url.pathname === '/api/ai/audio' && req.method === 'POST') return await elevenAudio(req, res);
    if (url.pathname === '/api/ai/voices') return await elevenVoices(req, res);
    if (url.pathname === '/api/export' && req.method === 'POST') return await saveExport(req, res, url);
    if (url.pathname === '/api/music/plan' && req.method === 'POST') return await musicPlan(req, res);
    if (url.pathname === '/api/music/compose' && req.method === 'POST') return await musicCompose(req, res);
    if (url.pathname === '/api/music/library') return musicLibrary(req, res);
    if (url.pathname.startsWith('/exports/')) {
      const EXP = path.join(DATA, 'exports');
      const f = path.normalize(path.join(DATA, decodeURIComponent(url.pathname)));
      if (!f.startsWith(EXP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      const type = f.endsWith('.mp3') ? 'audio/mpeg' : f.endsWith('.wav') ? 'audio/wav' : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'content-length': fs.statSync(f).size });
      return fs.createReadStream(f).pipe(res);
    }

    let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('bulunamadı'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { if (!res.headersSent) json(res, 500, { error: e.message }); }
}

// opts: { port, dataDir, hooks: { ensureWorker, openUi }, log }
export function startServer(opts = {}) {
  DATA = opts.dataDir || ROOT;
  fs.mkdirSync(DATA, { recursive: true });
  loadEnv(DATA); loadEnv(ROOT);
  const agent = createAgent({ dataDir: () => DATA, publicDir: PUBLIC, hooks: opts.hooks || {} });
  const server = http.createServer((req, res) => handler(req, res, agent));
  server.requestTimeout = 0;   // render istekleri dakikalar sürebilir
  const port = opts.port != null ? opts.port : +(process.env.PORT || 4209);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const url = `http://localhost:${server.address().port}`;
      (opts.log || console.log)(`Kod Stüdyo: ${url}`);
      resolve({ server, url, port: server.address().port });
    });
  });
}

// doğrudan çalıştırıldıysa: node server.mjs [--worker]
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { launchHeadlessWorker, openBrowser } = await import('./lib/headless.mjs');
  let worker = null, url = '';
  const ensureWorker = () => { if (!worker || worker.exitCode != null) worker = launchHeadlessWorker(url); };
  ({ url } = await startServer({ hooks: { ensureWorker, openUi: () => openBrowser(url) } }));
  if (process.argv.includes('--worker')) ensureWorker();
  const stop = () => { if (worker) worker.kill(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
