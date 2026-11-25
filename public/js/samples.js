// Örnek (sample) ve çok örnekli kit yükleyici: stüdyo ve ajan render işçisi ortak kullanır.
import { SAMPLE_BANK, KIT_BANK } from './instruments.js';

export async function loadSamples(s) {
  const need = s.tracks.filter((t) => t.sampleUrl && !SAMPLE_BANK.has(t.sampleUrl));
  const kits = [...new Set(s.tracks.filter((t) => t.inst === 'multi' && t.kit && !KIT_BANK.has(t.kit)).map((t) => t.kit))];
  if (!need.length && !kits.length) return 0;
  const dec = new OfflineAudioContext(1, 1, 44100);
  // çok örnekli kitler: kit.json → bölgeler
  await Promise.all(kits.map(async (name) => {
    try {
      const manifest = await (await fetch(`/kits/${name}/kit.json`)).json();
      const kit = { name, zones: [] };
      KIT_BANK.set(name, kit);
      await Promise.all(manifest.zones.map(async (z) => {
        try {
          // dosya adlarında "#" var (F#3): kodlanmazsa URL parçası sanılır
          const ab = await (await fetch(`/kits/${encodeURIComponent(name)}/${encodeURIComponent(z.file)}`)).arrayBuffer();
          kit.zones.push({ note: z.note, vel: z.vel || 1, buffer: await dec.decodeAudioData(ab) });
        } catch (e) { console.warn('örnek atlandı', name, z.file, e); }
      }));
      // kayıtların seviyeleri kitten kite çok farklı: ortalama tepe değerini −6 dBFS'ye çek
      const peaks = kit.zones.map((z) => { let pk = 0; const d = z.buffer.getChannelData(0); for (let i = 0; i < d.length; i += 4) pk = Math.max(pk, Math.abs(d[i])); return pk; });
      const avg = peaks.reduce((a, b) => a + b, 0) / Math.max(1, peaks.length);
      kit.norm = avg > 0 ? 0.5 / avg : 1;
    } catch (e) { console.warn('kit yüklenemedi', name, e); KIT_BANK.delete(name); }
  }));
  await Promise.all(need.map(async (t) => {
    try {
      const ab = await (await fetch(t.sampleUrl)).arrayBuffer();
      SAMPLE_BANK.set(t.sampleUrl, await dec.decodeAudioData(ab));
    } catch (e) { console.warn('sample yüklenemedi', t.sampleUrl, e); }
  }));
  return need.length + kits.length;
}
