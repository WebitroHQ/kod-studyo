// Vokal kiti üretici: ElevenLabs seslendirmesiyle (ücretsiz planda açık) kısa nidalar üretir,
// sessizliği kırpar, normalize eder ve WAV olarak public/kits/<kit>/ altına yazar.
// Müzik API'si ücretli planda; bu araç yalnızca TTS kullanır (karakter başına küçük kota).
// Kullanım: node tools/kit-uret.mjs phonk
// Anahtar: kod-studyo/.env içindeki ELEVENLABS_API_KEY (ekrana yazılmaz).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const KEY = ((env.match(/^ELEVENLABS_API_KEY=(.*)$/m) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.error('.env içinde ELEVENLABS_API_KEY yok'); process.exit(1); }

const KITS = {
  // funk/montagem nidaları: kısa, bağırarak, kuru (reverb'ü stüdyo ekler)
  phonk: {
    voices: ['Harry', 'Charlie'],
    items: [
      ['ei', 'Ei!'], ['vai', 'Vai!'], ['toma', 'Toma!'], ['vem', 'Vem!'], ['uh', 'Uh!'], ['aah', 'Aaaaah!'],
    ],
  },
  // Ankara oyun havası / düğün nidaları
  ankara: {
    voices: ['Harry', 'Charlie'],
    items: [
      ['hoppa', 'Hoppaa!'], ['oley', 'Oleey!'], ['haydi', 'Haydi!'], ['ankara', 'Ankaraa!'], ['hey', 'Hey!'],
    ],
  },
};

const SR = 24000; // pcm_44100 yalnızca Pro planda; ücretsizde 24 kHz PCM açık

async function voiceIds(names) {
  const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } });
  if (!r.ok) throw new Error('ses listesi alınamadı: ' + r.status);
  const all = (await r.json()).voices || [];
  return names.map((n) => {
    const v = all.find((x) => x.name.toLowerCase().startsWith(n.toLowerCase()));
    if (!v) throw new Error('ses bulunamadı: ' + n);
    return { name: n, id: v.voice_id };
  });
}

async function tts(voiceId, text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_24000`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true } }),
  });
  if (!r.ok) throw new Error(`TTS hatası ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const s = new Float32Array(buf.length / 2);
  for (let i = 0; i < s.length; i++) s[i] = buf.readInt16LE(i * 2) / 32768;
  return s;
}

// baştaki/sondaki sessizliği kırp (−45 dB eşik, 5 ms pay), uçlara kısa fade, tepe −1 dB'e normalize
function trim(x) {
  const th = Math.pow(10, -45 / 20);
  let a = 0, b = x.length - 1;
  while (a < x.length && Math.abs(x[a]) < th) a++;
  while (b > a && Math.abs(x[b]) < th) b--;
  a = Math.max(0, a - Math.round(0.005 * SR)); b = Math.min(x.length - 1, b + Math.round(0.03 * SR));
  const y = x.slice(a, b + 1);
  const fi = Math.round(0.002 * SR), fo = Math.round(0.02 * SR);
  for (let i = 0; i < fi && i < y.length; i++) y[i] *= i / fi;
  for (let i = 0; i < fo && i < y.length; i++) y[y.length - 1 - i] *= i / fo;
  let pk = 0; for (const v of y) pk = Math.max(pk, Math.abs(v));
  const g = pk > 0 ? Math.pow(10, -1 / 20) / pk : 1;
  for (let i = 0; i < y.length; i++) y[i] *= g;
  return y;
}

function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}

const kitName = process.argv[2] || 'phonk';
const kit = KITS[kitName];
if (!kit) { console.error('bilinmeyen kit: ' + kitName); process.exit(1); }
const dir = path.join(ROOT, 'public', 'kits', kitName);
fs.mkdirSync(dir, { recursive: true });
const voices = await voiceIds(kit.voices);
const manifest = [];
for (const v of voices) {
  for (const [id, text] of kit.items) {
    const file = `${id}-${v.name.toLowerCase()}.wav`;
    const out = path.join(dir, file);
    if (!fs.existsSync(out)) {
      const s = trim(await tts(v.id, text));
      fs.writeFileSync(out, wav(s));
      console.log(`yazıldı ${file} (${(s.length / SR).toFixed(2)} sn)`);
    }
    manifest.push({ file, text, voice: v.name });
  }
}
fs.writeFileSync(path.join(dir, 'kit.json'), JSON.stringify({ kit: kitName, source: 'ElevenLabs TTS (eleven_multilingual_v2)', items: manifest }, null, 2) + '\n');
console.log(`kit hazır: public/kits/${kitName} (${manifest.length} örnek)`);
