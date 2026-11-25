// Kod Stüdyo MCP sunucusu (stdio, JSON-RPC 2.0, satır başına bir mesaj).
// Ajanlar bu araçlarla şarkı üretir, düzenler, render eder ve kullanıcının stüdyo penceresinde açar.
// stdout yalnızca protokole ayrılmıştır; tüm günlükler stderr'e yazılır.

import readline from 'node:readline';
import { api } from './client.mjs';

const VERSION = '0.2.0';
const songInput = {
  song: { type: 'object', description: 'Şarkı JSON nesnesi (biçim için song_format aracına bakın)' },
  file: { type: 'string', description: 'Kayıtlı .kodstudyo.json dosyasının yolu (generate_song / list_songs çıktısındaki "file")' },
  library: { type: 'string', description: 'Hazır şarkı dosya adı (list_songs → bundled[].library)' },
};

const TOOLS = [
  { name: 'studio_status', description: 'Stüdyo çalışıyor mu, render işçisi ve kullanıcı penceresi açık mı, dosyalar nereye kaydediliyor.', inputSchema: { type: 'object', properties: {} },
    run: (b) => api(b, 'GET', '/api/agent') },
  { name: 'list_genres', description: 'Kullanılabilir müzik tarzları (generate_song.genre için id, tempo aralığı, açıklama).', inputSchema: { type: 'object', properties: {} },
    run: (b) => api(b, 'GET', '/api/agent/genres') },
  { name: 'list_instruments', description: 'Enstrüman ön ayarları (generate_song.instruments için id: gitar türleri, bağlama, 808, yaylılar…) ve şarkı JSON\'unda kullanılabilecek temel enstrümanlar.', inputSchema: { type: 'object', properties: {} },
    run: (b) => api(b, 'GET', '/api/agent/instruments') },
  { name: 'song_format', description: 'Şarkı JSON biçiminin açıklaması: notaları, kanalları, bölümleri ve master ayarlarını elle yazmak/düzenlemek için.', inputSchema: { type: 'object', properties: {} },
    run: (b) => fetch(b + '/api/agent/format').then((r) => r.text()) },
  {
    name: 'generate_song',
    description: 'Yapay zekâ anahtarı gerektirmeden, kural tabanlı besteciyle tam bir şarkı üretir, .kodstudyo.json olarak kaydeder ve WAV\'a render eder. Türkçe ya da İngilizce yazı (prompt) verilebilir: tarz, tempo, ton, ruh hali ve enstrümanlar yazıdan anlaşılır. Aynı seed aynı şarkıyı verir.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Ör. "karanlık brazilian phonk 130 bpm ağır 808" ya da "sakin lofi, piyano ve gitar"' },
        genre: { type: 'string', description: 'Tarz id (list_genres). prompt\'tan anlaşılanı ezer.' },
        seed: { type: ['string', 'number'], description: 'Tekrar üretilebilirlik için tohum' },
        bpm: { type: 'number' }, root: { type: 'string', description: 'Ton kökü: C, C#, D … B' },
        scale: { type: 'string', description: 'minor, major, dorian, phrygian, harmonicMinor …' },
        mood: { type: 'string', enum: ['dark', 'bright'] },
        length: { type: 'number', description: '1 kısa (~30-50 sn), 3 orta (varsayılan), 5 uzun' },
        instruments: { type: 'array', items: { type: 'string' }, description: 'Eklenecek enstrüman ön ayarı id\'leri (list_instruments → presets)' },
        vocals: { type: 'boolean', description: 'false: vokal kanallarını çıkar' },
        name: { type: 'string', description: 'Şarkı ve dosya adı' },
        render: { type: 'boolean', description: 'false: yalnızca JSON üret, render etme (hızlı)' },
        open_in_studio: { type: 'boolean', description: 'true: kullanıcının stüdyo penceresinde aç' },
      },
    },
    run: (b, a) => api(b, 'POST', '/api/agent/generate', { ...a, open: a.open_in_studio }),
  },
  {
    name: 'render_song',
    description: 'Bir şarkı JSON\'unu (düzenlenmiş ya da elle yazılmış) WAV\'a render eder ve kaydeder. Akış: generate_song → get_song → JSON\'u düzenle → render_song.',
    inputSchema: { type: 'object', properties: { ...songInput, name: { type: 'string' }, open_in_studio: { type: 'boolean' } } },
    run: (b, a) => api(b, 'POST', '/api/agent/render', { ...a, open: a.open_in_studio }),
  },
  { name: 'list_songs', description: 'Hazır şarkılar (library) ve ajanın daha önce kaydettiği şarkı dosyaları.', inputSchema: { type: 'object', properties: {} },
    run: (b) => api(b, 'GET', '/api/agent/library') },
  {
    name: 'get_song', description: 'Kayıtlı ya da hazır bir şarkının tam JSON\'unu döndürür (düzenlemek için).',
    inputSchema: { type: 'object', properties: { file: songInput.file, library: songInput.library } },
    run: (b, a) => api(b, 'GET', '/api/agent/song?' + new URLSearchParams(Object.entries(a).filter(([, v]) => v))),
  },
  { name: 'list_formula_presets', description: 'Matematik formülleriyle yazılmış şarkı ön ayarları (asal sayılar, π, φ, Collatz…).', inputSchema: { type: 'object', properties: {} },
    run: (b) => api(b, 'GET', '/api/agent/formulas') },
  {
    name: 'render_formula',
    description: 'Formül şarkısını WAV\'a render eder. preset ya da kendi formül şarkın: {timbre, gap, sections:[{name, duration, defs, voices:[{name, gain, timbre, expr}]}]}. expr, y (oktav; midi(m) ile MIDI notası) ya da [y, genlik] döndüren JS ifadesidir; t saniye, x −4.25..4.25, D bölüm süresi.',
    inputSchema: { type: 'object', properties: { preset: { type: 'string' }, song: { type: 'object' }, name: { type: 'string' } } },
    run: (b, a) => api(b, 'POST', '/api/agent/formula', a),
  },
  {
    name: 'open_in_studio', description: 'Şarkıyı kullanıcının stüdyo penceresinde açar (pencere kapalıysa açılır); kullanıcı orada dinleyip elle düzenleyebilir.',
    inputSchema: { type: 'object', properties: songInput },
    run: (b, a) => api(b, 'POST', '/api/agent/open', a),
  },
];

// getBase: çalışan stüdyonun adresini döndüren (gerekirse başlatan) fonksiyon
export function runMcp({ getBase, name = 'kod-studyo' }) {
  let basePromise = null;
  const base = () => (basePromise ||= Promise.resolve(getBase()).catch((e) => { basePromise = null; throw e; }));
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
  const rl = readline.createInterface({ input: process.stdin });
  let pending = 0, closed = false;
  const done = () => { if (closed && pending === 0) setTimeout(() => process.exit(0), 50); };

  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); }
    const { id, method, params = {} } = msg;
    if (id === undefined) return; // bildirim (notifications/initialized vb.)
    try {
      if (method === 'initialize') {
        return send({ jsonrpc: '2.0', id, result: {
          protocolVersion: params.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name, version: VERSION },
          instructions: 'Kod Stüdyo: yerel, anahtarsız müzik üretimi. Şarkı üretmek için generate_song; düzenlemek için get_song + song_format + render_song; kullanıcıya göstermek için open_in_studio. WAV dosyaları "wav" alanındaki yola kaydedilir.',
        } });
      }
      if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
      if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS.map(({ run, ...t }) => t) } });
      if (method === 'tools/call') {
        const tool = TOOLS.find((t) => t.name === params.name);
        if (!tool) return send({ jsonrpc: '2.0', id, error: { code: -32602, message: 'bilinmeyen araç: ' + params.name } });
        try {
          pending++;
          let out;
          try { out = await tool.run(await base(), params.arguments || {}); }
          catch (e) {
            // stüdyo kapanmış olabilir (ör. kullanıcı uygulamayı kapattı): yeniden bul/başlat, bir kez dene
            if (!/fetch failed|ECONNREFUSED/.test(String(e && (e.cause && e.cause.code || e.message)))) throw e;
            basePromise = null;
            out = await tool.run(await base(), params.arguments || {});
          } finally { pending--; setImmediate(done); }
          const text = typeof out === 'string' ? out : JSON.stringify(out, null, 1);
          return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
        } catch (e) {
          return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Hata: ' + e.message }], isError: true } });
        }
      }
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'desteklenmeyen yöntem: ' + method } });
    } catch (e) {
      send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
    }
  });
  rl.on('close', () => { closed = true; done(); });   // giriş kapandı: süren araç çağrıları bitince çık
}
