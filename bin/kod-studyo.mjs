#!/usr/bin/env node
// Kod Stüdyo komut satırı: kullanıcılar ve yapay zekâ ajanları için.
// Çalışan bir stüdyo varsa (masaüstü uygulaması ya da sunucu) onu kullanır, yoksa geçici olarak başlatır.

import fs from 'node:fs';
import { ensureServer, findServer, startLocalServer, api } from '../lib/client.mjs';

const HELP = `Kod Stüdyo — kodla müzik

Kullanım: kod-studyo <komut> [seçenekler]

  serve                       stüdyoyu başlat (http://localhost:4209) ve tarayıcıda aç
  mcp                         MCP sunucusu (stdio) — Claude Code / Claude Desktop / Cursor için
  status                      durum
  genres                      tarzlar
  instruments                 enstrüman ön ayarları
  format                      şarkı JSON biçimi
  songs                       hazır ve kayıtlı şarkılar
  generate [yazı] [seçenekler] şarkı üret + WAV
      --genre ID --seed N --bpm N --root C# --scale minor --mood dark|bright
      --length 1-5 --inst id,id --no-vocals --name AD --no-render --open
  render <dosya.json | hazır.json> [--name AD] [--open]   şarkı JSON'unu WAV'a render et
  formula <preset | dosya.json> [--name AD]                 formül şarkısı render et
  open <dosya.json>           şarkıyı stüdyo penceresinde aç

Çıktı JSON'dur; "wav" alanı oluşan dosyanın yoludur.
Örnek: kod-studyo generate "karanlık phonk 130 bpm" --seed 7 --length 2`;

function parseArgs(argv) {
  const pos = [], o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (['no-vocals', 'no-render', 'open', 'help'].includes(k)) o[k] = true;
      else o[k] = argv[++i];
    } else pos.push(a);
  }
  return { pos, o };
}

const print = (d) => process.stdout.write((typeof d === 'string' ? d : JSON.stringify(d, null, 1)) + '\n');

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, o } = parseArgs(rest);
  if (!cmd || cmd === 'help' || o.help || cmd === '--help' || cmd === '-h') return print(HELP);

  if (cmd === 'serve') {
    const url = (await findServer()) || (await startLocalServer({ log: (m) => print(m) }));
    const { openBrowser } = await import('../lib/headless.mjs');
    openBrowser(url);
    return; // sunucu bu süreçte çalışmaya devam eder
  }
  if (cmd === 'mcp') {
    const { runMcp } = await import('../lib/mcp.mjs');
    return runMcp({ getBase: () => ensureServer() });
  }

  const base = await ensureServer();
  const fileArg = (p) => {
    if (!p) throw new Error('dosya gerekli');
    if (fs.existsSync(p)) return { song: JSON.parse(fs.readFileSync(p, 'utf8')) };
    return { library: p };
  };
  let out;
  switch (cmd) {
    case 'status': out = await api(base, 'GET', '/api/agent'); break;
    case 'genres': out = await api(base, 'GET', '/api/agent/genres'); break;
    case 'instruments': out = await api(base, 'GET', '/api/agent/instruments'); break;
    case 'format': out = await (await fetch(base + '/api/agent/format')).text(); break;
    case 'songs': out = await api(base, 'GET', '/api/agent/library'); break;
    case 'generate':
      out = await api(base, 'POST', '/api/agent/generate', {
        prompt: pos.join(' ') || undefined, genre: o.genre, seed: o.seed, bpm: o.bpm ? +o.bpm : undefined,
        root: o.root, scale: o.scale, mood: o.mood, length: o.length ? +o.length : undefined,
        instruments: o.inst ? o.inst.split(',') : undefined, vocals: o['no-vocals'] ? false : undefined,
        name: o.name, render: !o['no-render'], open: !!o.open,
      });
      break;
    case 'render': out = await api(base, 'POST', '/api/agent/render', { ...fileArg(pos[0]), name: o.name, open: !!o.open }); break;
    case 'formula': {
      const p = pos[0];
      const body = p && fs.existsSync(p) ? { song: JSON.parse(fs.readFileSync(p, 'utf8')) } : { preset: p || 'altin' };
      out = await api(base, 'POST', '/api/agent/formula', { ...body, name: o.name });
      break;
    }
    case 'open': out = await api(base, 'POST', '/api/agent/open', fileArg(pos[0])); break;
    default: throw new Error(`bilinmeyen komut: ${cmd}\n\n${HELP}`);
  }
  print(out);
  // yerel sunucu başlatıldıysa süreç kendiliğinden bitmez; Windows'ta fetch soketleri kapanırken
  // hemen exit() libuv iddiasına takılıyor, bu yüzden kısa bir gecikmeyle çık
  setTimeout(() => process.exit(0), 50);
}

main().catch((e) => { process.stderr.write('Hata: ' + e.message + '\n'); process.exit(1); });
