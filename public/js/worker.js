// Render işçisi: sunucudaki iş kuyruğunu dinler, şarkı JSON'unu Web Audio ile WAV'a çevirip geri yollar.
// Masaüstü uygulamasında gizli pencerede, Node modunda başsız (headless) Chrome/Edge'de çalışır.
import { Engine } from './engine.js';
import { encodeWav } from './wav.js';
import { loadSamples } from './samples.js';
import { normalizeSong } from './recipe.js';

const engine = new Engine();
const logEl = document.getElementById('log');
const log = (m) => { logEl.textContent = `${new Date().toLocaleTimeString()} ${m}\n` + logEl.textContent.slice(0, 4000); };

async function run(job) {
  const song = normalizeSong(job.song);
  await loadSamples(song);
  const buf = await engine.render(song);
  return { blob: encodeWav(buf), seconds: buf.duration };
}

async function loop() {
  for (;;) {
    let job = null;
    try {
      const r = await fetch('/api/worker/next', { cache: 'no-store' });
      if (r.status === 200) job = await r.json();
    } catch { await new Promise((ok) => setTimeout(ok, 2000)); continue; }
    if (!job) continue;
    log(`iş ${job.id}: ${job.song && job.song.name}`);
    try {
      const t0 = performance.now();
      const { blob, seconds } = await run(job);
      await fetch(`/api/worker/done?id=${job.id}&seconds=${seconds.toFixed(2)}`, { method: 'POST', body: blob });
      log(`bitti ${job.id}: ${seconds.toFixed(1)} sn ses, ${((performance.now() - t0) / 1000).toFixed(1)} sn sürdü`);
    } catch (e) {
      await fetch(`/api/worker/fail?id=${job.id}`, { method: 'POST', body: JSON.stringify({ error: String(e && e.message || e) }) });
      log(`hata ${job.id}: ${e.message}`);
    }
  }
}
loop();
