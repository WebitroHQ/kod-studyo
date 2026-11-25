// VSCO 2 Community Edition (CC0, github.com/sgossner/VSCO-2-CE) gerçek enstrüman kayıtlarını indirir,
// ffmpeg ile kısaltıp MP3'e çevirir ve stüdyonun çok örnekli kit biçimine (public/kits/<kit>/kit.json) dönüştürür.
// Kullanım: node tools/vsco-indir.mjs [kit ...]   (kitler: upright violins cellos harp flute)
// Upright piyano: Simon Dalzell (Ivy Audio) kaydı; Versilian Studios dağıtım izni veriyor, atıf teşvik ediliyor.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = 'sgossner/VSCO-2-CE';
const KARO = 'sfzinstruments/karoryfer.black-and-green-guitars';
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const nameToMidi = (s) => { const m = s.match(/([A-G](?:#|b)?)(-?\d)/); return m ? 12 * (+m[2] + 1) + NOTE[m[1]] : null; };
// Karoryfer adları küçük harf ve bemol: twang_ab3_mf_rr1.wav — ve bir oktav yukarıdan etiketli
// (akort ölçümüyle doğrulandı: "e3" dosyası 82.4 Hz = E2), bu yüzden −12
const lowerToMidi = (s) => { const m = s.match(/_([a-g]b?)(\d)_/); if (!m) return null; const nm = m[1][0].toUpperCase() + (m[1][1] || ''); return 12 * (+m[2] + 1) + NOTE[nm] - 12; };

// her kit: klasör, dosya → { note, vel } çözümleyici, kesme süresi
const KITS = {
  upright: {
    dir: 'Keys/Upright Piano', seconds: 9, label: 'Upright piyano (Ivy Audio / VSCO 2 CE)',
    parse: (f) => { const m = f.match(/Player_dyn(\d)_rr1_(\d{3})\.wav$/); return m ? { note: 21 + 2 * +m[2], vel: +m[1] } : null; },
  },
  violins: {
    dir: 'Strings/Violin Section/susVib', seconds: 7, label: 'Keman seksiyonu (sustain, vibrato)',
    parse: (f) => { const m = f.match(/_v(\d)\.wav$/); const n = nameToMidi(f); return m && n ? { note: n, vel: +m[1] } : null; },
  },
  cellos: {
    dir: 'Strings/Cello Section/susvib', seconds: 7, label: 'Çello seksiyonu (sustain, vibrato)',
    parse: (f) => { const m = f.match(/_v(\d)_1\.wav$/); const n = nameToMidi(f); return m && n ? { note: n, vel: +m[1] >= 3 ? 2 : 1 } : null; },
  },
  harp: {
    dir: 'Strings/Harp', seconds: 6, label: 'Arp',
    parse: (f) => { const n = nameToMidi(f.replace('KSHarp_', '')); return n && /_mf\.wav$/.test(f) ? { note: n, vel: 1 } : null; },
  },
  // Karoryfer Black And Green Guitars (CC0): yeşil Gretsch hollowbody, temiz elektro
  gtrgreen: {
    repo: KARO, branch: 'main', dir: 'Samples/green/ord', seconds: 6, label: 'Elektro gitar — Gretsch (Karoryfer, temiz)',
    license: 'CC0 1.0 (Karoryfer Black And Green Guitars)',
    parse: (f) => { const m = f.match(/_(mf|f)_rr1\.wav$/); const n = lowerToMidi(f); return m && n ? { note: n, vel: m[1] === 'f' ? 2 : 1 } : null; },
  },
  gtrstac: {
    repo: KARO, branch: 'main', dir: 'Samples/green/stac', seconds: 1.5, label: 'Elektro gitar — Gretsch staccato (Karoryfer)',
    license: 'CC0 1.0 (Karoryfer Black And Green Guitars)',
    parse: (f) => { const n = lowerToMidi(f); return /_rr1\.wav$/.test(f) && n ? { note: n, vel: 1 } : null; },
  },
  flute: {
    dir: 'Woodwinds/Flute/susvib', seconds: 5, label: 'Flüt (sustain, vibrato)',
    parse: (f) => { const m = f.match(/_v1_1\.wav$/); const n = nameToMidi(f.replace('LDFlute_susvib_', '')); return m && n ? { note: n, vel: 1 } : null; },
  },
};

async function list(dir, repo = REPO) {
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURI(dir)}`, { headers: { 'user-agent': 'kod-studyo' } });
  if (!r.ok) throw new Error(`liste alınamadı ${dir}: ${r.status}`);
  return (await r.json()).filter((x) => x.type === 'file' && x.name.endsWith('.wav'));
}

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(KITS);
const tmp = path.join(ROOT, 'exports', '_indirme');
fs.mkdirSync(tmp, { recursive: true });
for (const name of want) {
  const kit = KITS[name];
  if (!kit) { console.error('bilinmeyen kit: ' + name); continue; }
  const outDir = path.join(ROOT, 'public', 'kits', name);
  fs.mkdirSync(outDir, { recursive: true });
  const repo = kit.repo || REPO, branch = kit.branch || 'master';
  const RAW = `https://raw.githubusercontent.com/${repo}/${branch}/`;
  const files = (await list(kit.dir, repo)).map((f) => ({ ...f, z: kit.parse(f.name) })).filter((f) => f.z);
  const zones = [];
  let bytes = 0;
  for (const f of files) {
    const mp3 = f.name.replace(/\.wav$/, '.mp3');
    const dst = path.join(outDir, mp3);
    if (!fs.existsSync(dst)) {
      // bağlantı koparsa 4 kez dene (büyük WAV'larda ECONNRESET görüldü)
      let data = null;
      for (let attempt = 1; attempt <= 4 && !data; attempt++) {
        try {
          const r = await fetch(RAW + `${kit.dir}/${f.name}`.split("/").map(encodeURIComponent).join("/")); // "#" parça işareti sanılmasın
          if (!r.ok) throw new Error('HTTP ' + r.status);
          data = Buffer.from(await r.arrayBuffer());
        } catch (e) { console.warn(`deneme ${attempt} başarısız: ${f.name} (${e.message})`); await new Promise((res) => setTimeout(res, 1500 * attempt)); }
      }
      if (!data) { console.warn('atlandı', f.name); continue; }
      const wav = path.join(tmp, f.name);
      fs.writeFileSync(wav, data);
      bytes += f.size;
      // sessizlikle başlıyorsa kırp, süreyi kısalt, sonda 0.6 sn fade, 192 kbps MP3
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav,
        '-af', `silenceremove=start_periods=1:start_threshold=-60dB,atrim=0:${kit.seconds},afade=t=out:st=${kit.seconds - 0.6}:d=0.6`,
        '-codec:a', 'libmp3lame', '-b:a', '192k', dst]);
      fs.unlinkSync(wav);
    }
    zones.push({ note: f.z.note, vel: f.z.vel, file: mp3 });
  }
  zones.sort((a, b) => a.vel - b.vel || a.note - b.note);
  fs.writeFileSync(path.join(outDir, 'kit.json'), JSON.stringify({
    kit: name, label: kit.label, license: kit.license || 'CC0 1.0 (VSCO 2 Community Edition, Versilian Studios)', source: `https://github.com/${repo}/tree/${branch}/${kit.dir}`, zones,
  }, null, 1) + '\n');
  console.log(`${name}: ${zones.length} örnek (${(bytes / 1e6).toFixed(0)} MB indirildi) → public/kits/${name}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
