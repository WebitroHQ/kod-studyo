// Tamamen kodla sentezlenen enstrümanlar. Hiç sample dosyası yok.
// Her enstrüman: play(ctx, out, t, note, p, st)
//   note = { midi, vel(0-1), len(saniye), glideFrom(midi|null) }
//   p    = enstrüman parametreleri, st = kanalın çalışma durumu (mono sesler için)

import { midiToFreq, clamp } from './theory.js';

// ---------- ortak yardımcılar ----------
const noiseCache = new Map();
function noiseBuffer(ctx) {
  const key = ctx.sampleRate;
  if (!noiseCache.has(key)) {
    const len = ctx.sampleRate * 2;
    const buf = new AudioBuffer({ length: len, sampleRate: ctx.sampleRate, numberOfChannels: 1 });
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(key, buf);
  }
  return noiseCache.get(key);
}

const curveCache = new Map();
export function driveCurve(amount) {
  const k = Math.round(clamp(amount, 0, 1) * 100);
  if (!curveCache.has(k)) {
    // Eski eşleme (1 + k·0.6) 0.35'te bile 22× sürüş veriyordu → her şey kare dalgaya eziliyordu.
    // Yeni eşleme karesel: 0.2 → 1.4×, 0.35 → 2.1×, 0.7 → 5.4×, 1 → 10×.
    const a = k / 100;
    const n = 2048, c = new Float32Array(n), drive = 1 + a * a * 9;
    const norm = Math.tanh(drive);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(x * drive) / norm;
    }
    curveCache.set(k, c);
  }
  return curveCache.get(k);
}

function shaper(ctx, amount) {
  const ws = ctx.createWaveShaper();
  ws.curve = driveCurve(amount);
  ws.oversample = '2x';
  return ws;
}

function noiseSrc(ctx, t) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.loopStart = Math.random() * 1.5;
  return src;
}

// Basit AD zarfı olan VCA
function vca(ctx, t, peak, attack, decay, sustainUntil = 0, release = 0.05) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  if (sustainUntil > 0) {
    g.gain.setTargetAtTime(peak * 0.7, t + attack, decay);
    g.gain.setTargetAtTime(0.0001, t + sustainUntil, release);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  return g;
}

function stopAll(nodes, t) { for (const n of nodes) { try { n.stop(t); } catch { /* zaten durdu */ } } }

// Mono enstrümanlar için önceki sesi kısa bir fade ile kes
function choke(st, t) {
  if (st && st.voice) {
    const { gain, srcs } = st.voice;
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(0.0001, t, 0.008);
      stopAll(srcs, t + 0.08);
    } catch { /* yok say */ }
    st.voice = null;
  }
}

// %d doluluk oranlı pulse dalga (Fourier serisi) — 808 cowbell osilatörleri için
const pulseCache = new Map();
function pulseWave(ctx, duty) {
  const key = ctx.sampleRate + '|' + duty;
  let w = pulseCache.get(key);
  if (!w || w.ctx !== ctx) {
    const N = 96, real = new Float32Array(N), imag = new Float32Array(N);
    for (let k = 1; k < N; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    w = { ctx, wave: ctx.createPeriodicWave(real, imag) };
    pulseCache.set(key, w);
  }
  return w.wave;
}

// sert kırpma: ±0.7 üstünü düz keser (tanh'dan sonra ikinci distorsiyon kademesi)
let hardCurve = null;
function hardClipCurve() {
  if (!hardCurve) {
    const n = 2048; hardCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; hardCurve[i] = Math.max(-0.7, Math.min(0.7, x)) / 0.7; }
  }
  return hardCurve;
}

// ---------- Karplus-Strong gitar tamponu ----------
// Döngü filtresi periyodu kesirli kısaltır ve N tamsayıdır; kalan akort hatası playbackRate ile
// düzeltilir (düzeltmesiz yüksek notalar 40+ sent tiz çıkıyordu).
// pick: pena konumu (tel boyunca 0..0.5) → tarak filtresiyle tını, variant: double-track için farklı tel gürültüsü
const ksCache = new Map();
function pluckBuffer(sampleRate, midi, bright, decaySec, variant = 0, pick = 0.18) {
  const key = `${sampleRate}|${midi}|${bright.toFixed(2)}|${decaySec.toFixed(1)}|${variant}|${pick}`;
  if (ksCache.has(key)) return ksCache.get(key);
  const f = midiToFreq(midi);
  const len = Math.floor(sampleRate * decaySec);
  const buf = new AudioBuffer({ length: len, sampleRate, numberOfChannels: 1 });
  const out = buf.getChannelData(0);
  // yazılan örnek, bir sonraki okunacak örnekle (wNext ağırlıkla) karışıyor → periyot N - wNext
  const wNext = 0.5 * (0.5 + bright * 0.5);
  const N = Math.max(2, Math.round(sampleRate / f + wNext));
  const rate = f / (sampleRate / (N - wNext));
  let seed = (midi * 7919 + variant * 104729) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  const exc = new Float32Array(N);
  for (let i = 0; i < N; i++) exc[i] = rnd();
  for (let pass = 0; pass < Math.round((1 - bright) * 4); pass++) {
    for (let i = 1; i < N; i++) exc[i] = 0.5 * (exc[i] + exc[i - 1]);
  }
  const P = Math.max(1, Math.round(pick * N));
  const ring = new Float32Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) { ring[i] = exc[i] - exc[(i - P + N) % N]; mean += ring[i]; }
  mean /= N;
  for (let i = 0; i < N; i++) ring[i] -= mean; // DC kaldır
  const fb = Math.pow(0.001, 1 / (f * decaySec));
  const s1 = 0.5 + bright * 0.5, s0 = 0.5 - bright * 0.5;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % N;
    const v = ring[idx];
    out[i] = v;
    ring[idx] = fb * (0.5 * (v + ring[next]) * s1 + v * s0);
    idx = next;
  }
  const res = { buf, rate };
  ksCache.set(key, res);
  return res;
}

// Ters çevrilmiş dilim: notanın ilk `seconds` saniyesi tersten → "reverse swell"
const revCache = new WeakMap();
function reversedSlice(buf, seconds) {
  const len = Math.max(1, Math.min(buf.length, Math.floor(seconds * buf.sampleRate)));
  let m = revCache.get(buf);
  if (!m) { m = new Map(); revCache.set(buf, m); }
  if (m.has(len)) return m.get(len);
  const out = new AudioBuffer({ length: len, sampleRate: buf.sampleRate, numberOfChannels: 1 });
  const src = buf.getChannelData(0), dst = out.getChannelData(0);
  for (let i = 0; i < len; i++) dst[i] = src[len - 1 - i];
  m.set(len, out);
  return out;
}

// ---------- formant tablosu (vokal) ----------
const VOWELS = [
  { n: 'a', f: [800, 1150, 2900], g: [1, 0.5, 0.25] },
  { n: 'e', f: [400, 1600, 2700], g: [1, 0.35, 0.25] },
  { n: 'i', f: [300, 2200, 3000], g: [1, 0.25, 0.2] },
  { n: 'o', f: [450, 800, 2830], g: [1, 0.45, 0.15] },
  { n: 'u', f: [325, 700, 2530], g: [1, 0.3, 0.1] },
];

const P = (label, min, max, def, step = 0.01) => ({ label, min, max, def, step });

// ---------- enstrümanlar ----------
export const INSTRUMENTS = {
  kick: {
    label: 'Kick', kind: 'drum', color: '#ff5d5d',
    params: { tune: P('Ton', 30, 90, 54, 1), punch: P('Vuruş', 0, 1, 0.6), decay: P('Uzunluk', 0.1, 1.2, 0.32), drive: P('Distorsiyon', 0, 1, 0.2), click: P('Tık', 0, 1, 0.5) },
    // Gövde: hızlı perde düşüşlü sinüs (808 bridged-T rezonansı ~50 Hz). Tık: kısa bant sınırlı gürültü + kare darbe.
    // Varsayılan ton 54 Hz ve kısa sönüm: 808 basın alt bölgesine çamur yapmasın diye.
    play(ctx, out, t, n, p) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const base = p.tune;
      o.frequency.setValueAtTime(base * (4 + p.punch * 4), t);
      o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.018);
      o.frequency.exponentialRampToValueAtTime(base, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel, t + 0.0015);
      g.gain.setTargetAtTime(n.vel * 0.55, t + 0.02, 0.05);
      g.gain.setTargetAtTime(0.0001, t + 0.06, p.decay / 4);
      const pre = ctx.createGain(); pre.gain.value = 1 + p.drive * 4;
      const ws = shaper(ctx, p.drive);
      const post = ctx.createGain(); post.gain.value = 1 / (1 + p.drive * 1.5);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;
      o.connect(g).connect(pre).connect(ws).connect(post).connect(hp).connect(out);
      // tık
      const c = noiseSrc(ctx), cf = ctx.createBiquadFilter(), cg = vca(ctx, t, n.vel * p.click * 0.6, 0.0005, 0.008);
      cf.type = 'bandpass'; cf.frequency.value = 4000; cf.Q.value = 0.8;
      c.connect(cf).connect(cg).connect(out);
      const sq = ctx.createOscillator(); sq.type = 'square'; sq.frequency.value = 1100;
      const sg = vca(ctx, t, n.vel * p.click * 0.25, 0.0003, 0.004);
      sq.connect(sg).connect(out);
      o.start(t); c.start(t); sq.start(t);
      stopAll([o, c, sq], t + p.decay + 0.15);
    },
  },

  snare: {
    label: 'Snare', kind: 'drum', color: '#ffb35d',
    params: { tone: P('Gövde', 120, 300, 190, 1), snap: P('Tel', 0, 1, 0.7), decay: P('Uzunluk', 0.05, 0.6, 0.2), drive: P('Distorsiyon', 0, 1, 0.1) },
    play(ctx, out, t, n, p) {
      const ws = shaper(ctx, p.drive); ws.connect(out);
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(p.tone * 1.6, t); o.frequency.exponentialRampToValueAtTime(p.tone, t + 0.04);
      const og = vca(ctx, t, n.vel * 0.7, 0.001, p.decay * 0.6);
      o.connect(og).connect(ws);
      const ns = noiseSrc(ctx), nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1500;
      const ng = vca(ctx, t, n.vel * p.snap, 0.001, p.decay);
      ns.connect(nf).connect(ng).connect(ws);
      o.start(t); ns.start(t); stopAll([o, ns], t + p.decay + 0.1);
    },
  },

  clap: {
    label: 'Clap', kind: 'drum', color: '#ffd45d',
    params: { tone: P('Ton', 800, 3000, 1400, 10), decay: P('Uzunluk', 0.05, 0.6, 0.22), spread: P('Yayılım', 0.004, 0.02, 0.01, 0.001) },
    play(ctx, out, t, n, p) {
      const ns = noiseSrc(ctx), f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = p.tone; f.Q.value = 1.2;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      for (let i = 0; i < 3; i++) {
        const tt = t + i * p.spread;
        g.gain.setValueAtTime(n.vel, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + p.spread * 0.9);
      }
      const t2 = t + 3 * p.spread;
      g.gain.setValueAtTime(n.vel * 0.9, t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + p.decay);
      ns.connect(f).connect(g).connect(out);
      ns.start(t); ns.stop(t2 + p.decay + 0.05);
    },
  },

  hat: {
    label: 'Hi-hat', kind: 'drum', color: '#9dff8a',
    params: { tone: P('Parlaklık', 5000, 12000, 8000, 50), decay: P('Uzunluk', 0.02, 0.5, 0.05) },
    play(ctx, out, t, n, p) {
      // 808 tarzı: 6 kare dalga + highpass
      const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21], srcs = [];
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = p.tone * 1.25;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = p.tone;
      const g = vca(ctx, t, n.vel * 0.35, 0.001, p.decay);
      for (const r of ratios) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 40 * r;
        o.connect(bp); o.start(t); srcs.push(o);
      }
      bp.connect(hp).connect(g).connect(out);
      stopAll(srcs, t + p.decay + 0.05);
    },
  },

  openhat: {
    label: 'Açık hat', kind: 'drum', color: '#7dffc4',
    params: { tone: P('Parlaklık', 5000, 12000, 7500, 50), decay: P('Uzunluk', 0.1, 1, 0.35) },
    play(ctx, out, t, n, p, st) { INSTRUMENTS.hat.play(ctx, out, t, n, p, st); },
  },

  cowbell: {
    label: '808 Cowbell', kind: 'melodic', color: '#ff7ad9', defaultOct: 5,
    params: { decay: P('Uzunluk', 0.05, 1, 0.3), drive: P('Distorsiyon', 0, 1, 0.5), tone: P('Filtre merkezi (Hz @540)', 500, 3000, 850, 10), q: P('Filtre Q', 1, 8, 3, 0.1) },
    // TR-808 devre modeli (Werner/Abel/Smith 2014; Frisnit yeniden yapımı): ~%48 doluluk oranlı iki pulse osilatör
    // (540 ve 800 Hz oranı), arkasından 4. derece bant geçiren filtre (~850 Hz, Q≈4), keskin atak + iki aşamalı sönüm.
    // Phonk'ta cowbell sample'ı perdelenerek çalındığı için filtre merkezi de notayla birlikte kayar.
    play(ctx, out, t, n, p) {
      const base = midiToFreq(n.midi);
      const ratio = base / 540;
      const wave = pulseWave(ctx, 0.48);
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.setPeriodicWave(wave); o2.setPeriodicWave(wave);
      o1.frequency.value = base; o2.frequency.value = base * (800 / 540);
      const fc = Math.min(12000, p.tone * ratio);
      const bp1 = ctx.createBiquadFilter(), bp2 = ctx.createBiquadFilter();
      bp1.type = bp2.type = 'bandpass'; bp1.frequency.value = bp2.frequency.value = fc; bp1.Q.value = bp2.Q.value = p.q;
      const mk = ctx.createGain(); mk.gain.value = 2.2 + p.q * 0.6; // dar filtre seviyesini telafi et
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(n.vel, t + 0.0007);
      g.gain.setTargetAtTime(n.vel * 0.28, t + 0.001, 0.008);          // 1. aşama: hızlı düşüş
      g.gain.setTargetAtTime(0.0001, t + 0.03, p.decay / 3.5);          // 2. aşama: uzun kuyruk
      // kademeli distorsiyon: yumuşak doyum → sert kırpma (phonk'ta cowbell sert ve öne çıkar)
      const pre = ctx.createGain(); pre.gain.value = 1 + p.drive * 5;
      const soft = shaper(ctx, p.drive * 0.6);
      const hard = ctx.createWaveShaper(); hard.curve = hardClipCurve(); hard.oversample = '2x';
      const post = ctx.createGain(); post.gain.value = 0.55 / (1 + p.drive * 0.8);
      const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3000; pres.Q.value = 0.9; pres.gain.value = 2 + p.drive * 3;
      o1.connect(bp1); o2.connect(bp1); bp1.connect(bp2).connect(mk).connect(g).connect(pre).connect(soft).connect(hard).connect(post).connect(pres).connect(out);
      o1.start(t); o2.start(t); stopAll([o1, o2], t + p.decay * 1.6 + 0.1);
    },
  },

  bass808: {
    label: '808 Bas', kind: 'melodic', color: '#c77dff', mono: true, defaultOct: 1,
    params: { decay: P('Uzunluk', 0.2, 3, 1.1), drive: P('Distorsiyon', 0, 1, 0.45), glide: P('Glide süresi', 0.02, 0.3, 0.08), punch: P('Vuruş', 0, 1, 0.5), sub: P('Temiz sub', 0, 1, 0.5), tone: P('Ton (filtre)', 800, 8000, 3500, 10) },
    // Paralel iki yol: temiz sinüs sub (yalnızca temel frekans) + distorsiyonlu yol (yumuşak doyum → sert kırpma).
    // Distorsiyon harmonikleri 808'in küçük hoparlörlerde de duyulmasını sağlar; sub ayrı tutulduğu için alt uç
    // çamurlaşmaz. 28 Hz highpass sub-sonik enerjiyi keser.
    play(ctx, out, t, n, p, st) {
      choke(st, t);
      const f = midiToFreq(n.midi);
      const mkOsc = () => {
        const o = ctx.createOscillator(); o.type = 'sine';
        if (n.glideFrom != null) {
          o.frequency.setValueAtTime(midiToFreq(n.glideFrom), t);
          o.frequency.exponentialRampToValueAtTime(f, t + p.glide);
        } else {
          o.frequency.setValueAtTime(f * (1 + p.punch * 1.5), t);
          o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
        }
        return o;
      };
      const oSub = mkOsc(), oDist = mkOsc();
      const len = Math.min(n.len, p.decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(n.vel, t + 0.003);
      g.gain.setTargetAtTime(n.vel * 0.65, t + 0.04, p.decay * 0.5);
      g.gain.setTargetAtTime(0.0001, t + len, 0.035);
      const subG = ctx.createGain(); subG.gain.value = 0.35 + p.sub * 0.65;
      const pre = ctx.createGain(); pre.gain.value = 1 + p.drive * 9;
      const soft = shaper(ctx, Math.min(1, p.drive * 0.8 + 0.1));
      const hard = ctx.createWaveShaper(); hard.curve = hardClipCurve(); hard.oversample = '2x';
      const dG = ctx.createGain(); dG.gain.value = p.drive * 0.55;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.tone; lp.Q.value = 0.6;
      const hpD = ctx.createBiquadFilter(); hpD.type = 'highpass'; hpD.frequency.value = f * 1.5; // distorsiyon yolu sub'ı tekrar etmesin
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;
      oSub.connect(subG).connect(hp);
      oDist.connect(pre).connect(soft).connect(hard).connect(hpD).connect(lp).connect(dG).connect(hp);
      hp.connect(g).connect(out);
      oSub.start(t); oDist.start(t);
      stopAll([oSub, oDist], t + len + 0.3);
      st.voice = { gain: g, srcs: [oSub, oDist] };
    },
  },

  bass: {
    label: 'Synth Bas', kind: 'melodic', color: '#8a7dff', mono: true, defaultOct: 2,
    params: { cutoff: P('Filtre', 100, 3000, 600, 10), reso: P('Rezonans', 0, 15, 4, 0.1), env: P('Filtre zarfı', 0, 1, 0.5), wave: P('Dalga (0 saw/1 kare)', 0, 1, 0, 1), detune: P('Kalınlık', 0, 30, 8, 1) },
    play(ctx, out, t, n, p, st) {
      choke(st, t);
      const f = midiToFreq(n.midi);
      const type = p.wave >= 0.5 ? 'square' : 'sawtooth';
      const srcs = [-1, 1].map((d) => {
        const o = ctx.createOscillator(); o.type = type; o.detune.value = d * p.detune;
        if (n.glideFrom != null) { o.frequency.setValueAtTime(midiToFreq(n.glideFrom), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); }
        else o.frequency.value = f;
        return o;
      });
      const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2; srcs.push(sub);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = p.reso;
      lp.frequency.setValueAtTime(p.cutoff + p.env * 4000, t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(60, p.cutoff), t + 0.18);
      const g = vca(ctx, t, n.vel * 0.45, 0.004, 0.15, n.len, 0.05);
      for (const s of srcs) { s.connect(lp); s.start(t); }
      lp.connect(g).connect(out);
      stopAll(srcs, t + n.len + 0.4);
      st.voice = { gain: g, srcs };
    },
  },

  lead: {
    label: 'Supersaw Lead', kind: 'melodic', color: '#5dd6ff', defaultOct: 4,
    params: { cutoff: P('Filtre', 300, 12000, 4000, 10), detune: P('Genişlik', 0, 50, 18, 1), attack: P('Atak', 0.001, 0.5, 0.005, 0.001), release: P('Bırakma', 0.02, 1.5, 0.2), drive: P('Distorsiyon', 0, 1, 0.1) },
    play(ctx, out, t, n, p) {
      const f = midiToFreq(n.midi), srcs = [];
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.cutoff; lp.Q.value = 1;
      const merger = ctx.createGain(); merger.gain.value = 0.22;
      for (const d of [-1, -0.4, 0, 0.4, 1]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d * p.detune;
        if (n.glideFrom != null) { o.frequency.setValueAtTime(midiToFreq(n.glideFrom), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); }
        o.connect(merger); o.start(t); srcs.push(o);
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel * 0.5, t + p.attack);
      g.gain.setTargetAtTime(n.vel * 0.38, t + p.attack, 0.1);
      g.gain.setTargetAtTime(0.0001, t + Math.max(n.len, p.attack), p.release / 3);
      merger.connect(shaper(ctx, p.drive)).connect(lp).connect(g).connect(out);
      stopAll(srcs, t + n.len + p.release + 0.2);
    },
  },

  pluck: {
    label: 'Pluck', kind: 'melodic', color: '#5dffe0', defaultOct: 4,
    params: { cutoff: P('Parlaklık', 500, 9000, 3000, 10), decay: P('Uzunluk', 0.05, 1.5, 0.3), wave: P('Dalga (0 saw/1 kare)', 0, 1, 1, 1) },
    play(ctx, out, t, n, p) {
      const o = ctx.createOscillator(); o.type = p.wave >= 0.5 ? 'square' : 'sawtooth'; o.frequency.value = midiToFreq(n.midi);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(p.cutoff, t); lp.frequency.exponentialRampToValueAtTime(200, t + p.decay);
      const g = vca(ctx, t, n.vel * 0.35, 0.002, p.decay);
      o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + p.decay + 0.1);
    },
  },

  bell: {
    label: 'FM Bell', kind: 'melodic', color: '#fff27a', defaultOct: 5,
    params: { ratio: P('Oran', 1, 7, 3.5, 0.01), index: P('Metallik', 0, 10, 4, 0.1), decay: P('Uzunluk', 0.2, 4, 1.6) },
    play(ctx, out, t, n, p) {
      const f = midiToFreq(n.midi);
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
      car.frequency.value = f; mod.frequency.value = f * p.ratio;
      mg.gain.setValueAtTime(f * p.index, t); mg.gain.exponentialRampToValueAtTime(f * 0.1 + 1, t + p.decay);
      mod.connect(mg).connect(car.frequency);
      const g = vca(ctx, t, n.vel * 0.35, 0.002, p.decay);
      car.connect(g).connect(out);
      car.start(t); mod.start(t); stopAll([car, mod], t + p.decay + 0.1);
    },
  },

  piano: {
    label: 'E-Piyano', kind: 'melodic', color: '#ffc4a3', defaultOct: 4,
    params: { tone: P('Parlaklık', 0, 1, 0.4), decay: P('Uzunluk', 0.3, 4, 1.8), trem: P('Tremolo', 0, 1, 0.2) },
    play(ctx, out, t, n, p) {
      const f = midiToFreq(n.midi), srcs = [];
      const sum = ctx.createGain();
      [[1, 1], [2, 0.35 * p.tone + 0.05], [3, 0.15 * p.tone], [4.02, 0.08 * p.tone]].forEach(([h, a]) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * h;
        const og = ctx.createGain(); og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(a * 0.05 + 0.0001, t + p.decay * (h === 1 ? 1 : 0.4));
        o.connect(og).connect(sum); o.start(t); srcs.push(o);
      });
      const trem = ctx.createGain();
      if (p.trem > 0) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.value = p.trem * 0.3;
        lfo.connect(lg).connect(trem.gain); lfo.start(t); srcs.push(lfo);
      }
      const end = Math.min(n.len + 0.3, p.decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel * 0.3, t + 0.004);
      g.gain.setTargetAtTime(0.0001, t + end, 0.12);
      sum.connect(trem).connect(g).connect(out);
      stopAll(srcs, t + end + 0.6);
    },
  },

  felt: {
    label: 'Keçeli Piyano', kind: 'melodic', color: '#f3e3c3', defaultOct: 4,
    params: {
      felt: P('Keçe (yumuşaklık)', 0, 1, 0.7), sustain: P('Sönüm süresi', 0.3, 2, 1), pedal: P('Pedal (1 = bas)', 0, 1, 1, 1),
      detune: P('Tel ayrışması (sent)', 0, 4, 1.2, 0.1), hammer: P('Çekiç sesi', 0, 1, 0.35), width: P('Stereo yayılım', 0, 1, 0.5),
    },
    // Toplamalı piyano modeli: inharmonik kısmi sesler f_n = n·f0·√(1+B·n²), kısmi başına üstel sönüm (yüksekler hızlı),
    // iki aşamalı sönüm (hızlı ilk düşüş + uzun kuyruk), ilk 4 kısmide iki tel → hafif dalgalanma, kısa çekiç gürültüsü.
    // Keçe arttıkça üst kısmiler zayıflar ve atak yumuşar (C418 tarzı "felt piano").
    play(ctx, out, t, n, p) {
      const f0 = midiToFreq(n.midi);
      const B = Math.min(0.002, 0.00012 * Math.pow(2, (n.midi - 48) / 18));
      const soft = p.felt;
      const bright = Math.max(0.1, (1 - soft * 0.6) * (0.6 + n.vel * 0.6));
      const base = p.sustain * (2.2 + 4.5 * Math.pow(2, -(n.midi - 48) / 24)); // pesler daha uzun çınlar
      const releaseTau = p.pedal >= 0.5 ? 0.9 : 0.12;
      const end = t + n.len;
      // pes notalar ortada kalır (bas mono), üst notalar klavyedeki yerine göre yayılır
      const pan = ctx.createStereoPanner(); pan.pan.value = n.midi < 52 ? 0 : Math.max(-0.8, Math.min(0.8, ((n.midi - 64) / 36) * p.width));
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000 + (1 - soft) * 8000 + n.vel * 3000; lp.Q.value = 0.5;
      const bus = ctx.createGain(); bus.gain.value = 0.22;
      const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 3500; air.gain.value = 3; // tel/oda parlaklığı
      bus.connect(lp).connect(air).connect(pan).connect(out);
      const atk = 0.002 + soft * 0.009;
      const srcs = [];
      const maxN = Math.max(3, Math.min(18, Math.floor(14000 / f0)));
      for (let k = 1; k <= maxN; k++) {
        const fk = k * f0 * Math.sqrt(1 + B * k * k);
        if (fk > 15000) break;
        const amp = (1 / Math.pow(k, 1.1)) * Math.exp(-(k - 1) * (1 - bright) * 0.35);
        const tau = base / (1 + 0.35 * (k - 1));
        const strings = k <= 4 ? [-1, 1] : [0];
        for (const d of strings) {
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.value = fk * Math.pow(2, (d * p.detune) / 1200);
          const g = ctx.createGain();
          const a = amp * n.vel / strings.length;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(a, t + atk);
          g.gain.setTargetAtTime(a * 0.45, t + atk, Math.min(0.35, tau * 0.12)); // hızlı ilk sönüm
          g.gain.setTargetAtTime(0.0001, t + atk + 0.25, tau);                    // uzun kuyruk
          g.gain.setTargetAtTime(0.0001, end, releaseTau);                         // damper / pedal
          o.connect(g).connect(bus);
          o.start(t); srcs.push(o);
        }
      }
      if (p.hammer > 0) {
        const ns = noiseSrc(ctx), nf = ctx.createBiquadFilter(), ng = vca(ctx, t, p.hammer * n.vel * 0.12, 0.001, 0.025);
        nf.type = 'lowpass'; nf.frequency.value = 900 + (1 - soft) * 2500;
        ns.connect(nf).connect(ng).connect(bus); ns.start(t); srcs.push(ns);
      }
      stopAll(srcs, end + releaseTau * 5 + 0.2);
    },
  },

  pad: {
    label: 'Pad', kind: 'melodic', color: '#7da8ff', defaultOct: 3,
    params: { cutoff: P('Filtre', 200, 6000, 1400, 10), attack: P('Atak', 0.01, 2, 0.4), release: P('Bırakma', 0.1, 3, 0.9), detune: P('Genişlik', 0, 40, 14, 1) },
    play(ctx, out, t, n, p) {
      const f = midiToFreq(n.midi), srcs = [];
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.cutoff;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel * 0.16, t + p.attack);
      g.gain.setTargetAtTime(0.0001, t + Math.max(n.len, p.attack), p.release / 3);
      for (const d of [-1, 0, 1]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d * p.detune;
        o.connect(lp); o.start(t); srcs.push(o);
      }
      lp.connect(g).connect(out);
      stopAll(srcs, t + n.len + p.release + 0.2);
    },
  },

  guitar: {
    label: 'Elektro Gitar', kind: 'melodic', color: '#ff8a5d', defaultOct: 2,
    params: {
      drive: P('Distorsiyon', 0, 1, 0.75), mute: P('Palm mute', 0, 1, 0.3), power: P('Power chord', 0, 1, 1, 1),
      bright: P('Parlaklık', 0, 1, 0.6), cab: P('Kabin', 1500, 8000, 4200, 50),
      double: P('Double-track (geniş)', 0, 1, 0, 1), vib: P('Vibrato', 0, 1, 0), bend: P('Bend/slide süresi', 0.02, 0.3, 0.09),
      synth: P('Synth katmanı', 0, 1, 0), oct8: P('Oktavör (+8va)', 0, 1, 0),
    },
    // Glide (g) = önceki notadan bend. Double-track = iki ayrı çekim, sol/sağ.
    // rev = ters nota (swell), synth = gitarı synth'e benzeten kare dalga katmanı, oct8 = oktavör
    play(ctx, out, t, n, p) {
      const decay = 0.3 + (1 - p.mute) * 2.2;
      const notes = p.power >= 0.5 ? [n.midi, n.midi + 7, n.midi + 12] : [n.midi];
      if (p.oct8 > 0 && p.power < 0.5) notes.push(n.midi + 12);
      const layers = p.double >= 0.5 ? [{ pan: -0.7, dt: 0, v: 0 }, { pan: 0.7, dt: 0.011, v: 1 }] : [{ pan: 0, dt: 0, v: 0 }];
      const len = n.rev ? n.len : Math.min(n.len + 0.05, decay);
      const srcs = [];
      for (const L of layers) {
        const tt = t + L.dt;
        const sum = ctx.createGain();
        notes.forEach((m, i) => {
          const { buf, rate } = pluckBuffer(ctx.sampleRate, m, p.bright, n.rev ? 2.8 : Math.min(decay + 0.4, 2.8), L.v);
          const s = ctx.createBufferSource();
          s.buffer = n.rev ? reversedSlice(buf, len * rate) : buf;
          const detune = L.v ? 1.0012 : 1;
          if (n.rev) s.playbackRate.value = rate * detune;
          else if (n.glideFrom != null) {
            s.playbackRate.setValueAtTime(rate * detune * Math.pow(2, (n.glideFrom - n.midi) / 12), tt);
            s.playbackRate.exponentialRampToValueAtTime(rate * detune, tt + p.bend);
          } else s.playbackRate.value = rate * detune;
          if (p.vib > 0 && len > 0.25 && !n.rev) {
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = 5.2 + L.v * 0.4;
            lg.gain.setValueAtTime(0, tt); lg.gain.linearRampToValueAtTime(rate * 0.009 * p.vib, tt + Math.min(0.35, len * 0.6));
            lfo.connect(lg).connect(s.playbackRate); lfo.start(tt); srcs.push(lfo);
          }
          const octLayer = p.oct8 > 0 && p.power < 0.5 && i === notes.length - 1;
          const sg = ctx.createGain(); sg.gain.value = octLayer ? 0.6 * p.oct8 : i === 0 ? 0.9 : 0.55;
          s.connect(sg).connect(sum); s.start(n.rev ? tt : tt + i * 0.005); srcs.push(s);
        });
        if (p.synth > 0) {
          // synth katmanı: kare dalga + kapanan filtre, gitar zarfıyla
          const f0 = midiToFreq(n.midi);
          const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f0 * (L.v ? 1.003 : 1);
          if (n.glideFrom != null && !n.rev) { o.frequency.setValueAtTime(midiToFreq(n.glideFrom), tt); o.frequency.exponentialRampToValueAtTime(f0, tt + p.bend); }
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
          const og = ctx.createGain();
          if (n.rev) {
            lp.frequency.setValueAtTime(300, tt); lp.frequency.exponentialRampToValueAtTime(5000, tt + len);
            og.gain.setValueAtTime(0.0001, tt); og.gain.exponentialRampToValueAtTime(0.5 * p.synth, tt + len);
          } else {
            lp.frequency.setValueAtTime(6000, tt); lp.frequency.exponentialRampToValueAtTime(500, tt + Math.max(0.1, len));
            og.gain.setValueAtTime(0.5 * p.synth, tt); og.gain.exponentialRampToValueAtTime(0.0001, tt + len + 0.1);
          }
          o.connect(lp).connect(og).connect(sum); o.start(tt); srcs.push(o);
        }
        if (!n.rev) {
          // pena sesi
          const pk = noiseSrc(ctx), pf = ctx.createBiquadFilter(), pg = vca(ctx, tt, 0.25 * n.vel, 0.0005, 0.012);
          pf.type = 'bandpass'; pf.frequency.value = 3200; pf.Q.value = 0.7;
          pk.connect(pf).connect(pg).connect(sum); pk.start(tt); srcs.push(pk);
        }
        // amfi: highpass → ön kazanç → asimetrik kırpma → orta tepe → kabin (2 kutuplu) → presence
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = p.mute > 0.5 ? 110 : 80;
        const pre = ctx.createGain(); pre.gain.value = 1 + p.drive * 7;
        const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 750; mid.gain.value = 2 + p.drive * 2; mid.Q.value = 0.8;
        const scoop = ctx.createBiquadFilter(); scoop.type = 'peaking'; scoop.frequency.value = 350; scoop.gain.value = -2 * p.drive; scoop.Q.value = 1;
        const cab1 = ctx.createBiquadFilter(); cab1.type = 'lowpass'; cab1.frequency.value = p.cab; cab1.Q.value = 0.8;
        const cab2 = ctx.createBiquadFilter(); cab2.type = 'lowpass'; cab2.frequency.value = p.cab * 1.4; cab2.Q.value = 0.5;
        const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2600; pres.gain.value = 2.5; pres.Q.value = 1.2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(n.vel * 0.28, tt);
        if (n.rev) g.gain.setTargetAtTime(0.0001, tt + len - 0.01, 0.004);
        else g.gain.setTargetAtTime(0.0001, tt + len, p.mute > 0.5 ? 0.02 : 0.07);
        const pan = ctx.createStereoPanner(); pan.pan.value = L.pan;
        sum.connect(hp).connect(pre).connect(shaper(ctx, p.drive)).connect(scoop).connect(mid).connect(cab1).connect(cab2).connect(pres).connect(g).connect(pan).connect(out);
      }
      stopAll(srcs, t + len + 0.5);
    },
  },

  vox: {
    label: 'Vokal Chop', kind: 'melodic', color: '#ff9de2', defaultOct: 4,
    params: { vowel: P('Sesli (a e i o u)', 0, 4, 0, 1), vibrato: P('Vibrato', 0, 1, 0.3), breath: P('Nefes', 0, 1, 0.15), formant: P('Formant kaydır', 0.7, 1.5, 1, 0.01), release: P('Bırakma', 0.03, 1, 0.15) },
    // Formant sentezi: testere dişi kaynak + 3 bant geçiren filtre (ünlü harf rezonansları)
    play(ctx, out, t, n, p) {
      const f = midiToFreq(n.midi), srcs = [];
      const v = VOWELS[clamp(Math.round(p.vowel), 0, 4)];
      const src = ctx.createOscillator(); src.type = 'sawtooth'; src.frequency.value = f;
      if (n.glideFrom != null) { src.frequency.setValueAtTime(midiToFreq(n.glideFrom), t); src.frequency.exponentialRampToValueAtTime(f, t + 0.08); }
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f * 0.012 * p.vibrato;
      lfo.connect(lg).connect(src.frequency);
      const sum = ctx.createGain();
      const ns = noiseSrc(ctx), ng = ctx.createGain(); ng.gain.value = p.breath * 0.4;
      v.f.forEach((ff, i) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff * p.formant; bp.Q.value = 8 + i * 4;
        const bg = ctx.createGain(); bg.gain.value = v.g[i] * 3;
        src.connect(bp); ns.connect(ng).connect(bp); bp.connect(bg).connect(sum);
      });
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel * 0.5, t + 0.02);
      g.gain.setTargetAtTime(0.0001, t + n.len, p.release / 3);
      sum.connect(g).connect(out);
      src.start(t); lfo.start(t); ns.start(t); srcs.push(src, lfo, ns);
      stopAll(srcs, t + n.len + p.release + 0.2);
    },
  },

  perc: {
    label: 'Perküsyon', kind: 'drum', color: '#ff9b6b',
    params: { tone: P('Ton', 150, 900, 420, 1), decay: P('Uzunluk', 0.02, 0.5, 0.08), kind: P('Tip (0 rim/1 tom/2 shaker)', 0, 2, 0, 1) },
    play(ctx, out, t, n, p) {
      const kind = Math.round(p.kind);
      if (kind === 2) {
        const ns = noiseSrc(ctx), bp = ctx.createBiquadFilter(); bp.type = 'highpass'; bp.frequency.value = 6000;
        const g = vca(ctx, t, n.vel * 0.3, 0.01, p.decay);
        ns.connect(bp).connect(g).connect(out); ns.start(t); ns.stop(t + p.decay + 0.1);
        return;
      }
      const o = ctx.createOscillator(); o.type = kind === 1 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(p.tone * (kind === 1 ? 1.5 : 1), t); o.frequency.exponentialRampToValueAtTime(p.tone, t + 0.03);
      const g = vca(ctx, t, n.vel * (kind === 1 ? 0.7 : 0.45), 0.001, kind === 1 ? p.decay * 3 : p.decay);
      const bp = ctx.createBiquadFilter(); bp.type = kind === 1 ? 'lowpass' : 'bandpass'; bp.frequency.value = kind === 1 ? 2000 : p.tone * 2;
      o.connect(bp).connect(g).connect(out); o.start(t); o.stop(t + p.decay * 3 + 0.1);
    },
  },

  fx: {
    label: 'Riser / FX', kind: 'drum', color: '#b0b0b0',
    params: { len: P('Süre (sn, kısa notada)', 0.5, 8, 2.5, 0.1), type: P('Tip (0 riser/1 düşüş/2 impact)', 0, 2, 0, 1) },
    // Nota 60 = riser, 61 = düşüş, 62 = impact; başka nota → parametredeki tip. Uzun nota kendi süresini kullanır.
    play(ctx, out, t, n, p) {
      const type = n.midi >= 60 && n.midi <= 62 ? n.midi - 60 : Math.round(p.type);
      p = { ...p, len: n.len > 0.4 ? n.len : p.len };
      const ns = noiseSrc(ctx), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
      const g = ctx.createGain();
      if (type === 2) {
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.5);
        const og = vca(ctx, t, n.vel, 0.002, 1.5); o.connect(og).connect(out); o.start(t); o.stop(t + 1.7);
        f.frequency.value = 800; g.gain.setValueAtTime(n.vel * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        ns.connect(f).connect(g).connect(out); ns.start(t); ns.stop(t + 1.3);
        return;
      }
      const up = type === 0;
      f.frequency.setValueAtTime(up ? 300 : 8000, t); f.frequency.exponentialRampToValueAtTime(up ? 9000 : 200, t + p.len);
      g.gain.setValueAtTime(up ? 0.0001 : n.vel * 0.3, t);
      g.gain.exponentialRampToValueAtTime(up ? n.vel * 0.35 : 0.0001, t + p.len);
      ns.connect(f).connect(g).connect(out); ns.start(t); ns.stop(t + p.len + 0.05);
    },
  },

  acoustic: {
    label: 'Akustik Gitar', kind: 'melodic', color: '#e8c07a', defaultOct: 3,
    params: { bright: P('Parlaklık', 0, 1, 0.7), body: P('Gövde', 0, 1, 0.6), decay: P('Sönüm', 0.5, 4, 2.4), strum: P('Akor tarama (ms)', 0, 40, 12, 1), bend: P('Slide süresi', 0.02, 0.3, 0.1) },
    // Aynı anda başlayan notalar akor olarak "taranır" (strum): her tel birkaç ms gecikmeli
    play(ctx, out, t, n, p, st) {
      let idx = 0;
      if (st) { idx = st.lastT === t ? (st.strumIdx || 0) + 1 : 0; st.strumIdx = idx; st.lastT = t; }
      const tt = t + idx * p.strum / 1000;
      const { buf, rate } = pluckBuffer(ctx.sampleRate, n.midi, p.bright, p.decay, 0, 0.22);
      const s = ctx.createBufferSource(); s.buffer = buf;
      if (n.glideFrom != null) { s.playbackRate.setValueAtTime(rate * Math.pow(2, (n.glideFrom - n.midi) / 12), tt); s.playbackRate.exponentialRampToValueAtTime(rate, tt + p.bend); }
      else s.playbackRate.value = rate;
      const b1 = ctx.createBiquadFilter(); b1.type = 'peaking'; b1.frequency.value = 105; b1.Q.value = 1.4; b1.gain.value = 3 + p.body * 5;
      const b2 = ctx.createBiquadFilter(); b2.type = 'peaking'; b2.frequency.value = 230; b2.Q.value = 1.2; b2.gain.value = 1 + p.body * 3;
      const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 500; mud.Q.value = 1; mud.gain.value = -2;
      const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 5000; air.gain.value = 3;
      const g = ctx.createGain();
      const len = Math.min(n.len + 0.2, p.decay);
      g.gain.setValueAtTime(n.vel * 0.5, tt); g.gain.setTargetAtTime(0.0001, tt + len, 0.12);
      s.connect(b1).connect(b2).connect(mud).connect(air).connect(g).connect(out);
      s.start(tt); s.stop(tt + len + 0.8);
    },
  },

  bassgtr: {
    label: 'Bas Gitar', kind: 'melodic', color: '#b48cff', mono: true, defaultOct: 1,
    params: { tone: P('Ton (filtre)', 300, 4000, 1100, 10), slap: P('Slap', 0, 1, 0), decay: P('Sönüm', 0.4, 3, 1.6), drive: P('Kirli', 0, 1, 0.15) },
    play(ctx, out, t, n, p, st) {
      choke(st, t);
      const bright = 0.35 + p.slap * 0.55;
      const { buf, rate } = pluckBuffer(ctx.sampleRate, n.midi, bright, p.decay, 0, p.slap > 0.5 ? 0.06 : 0.14);
      const s = ctx.createBufferSource(); s.buffer = buf;
      if (n.glideFrom != null) { s.playbackRate.setValueAtTime(rate * Math.pow(2, (n.glideFrom - n.midi) / 12), t); s.playbackRate.exponentialRampToValueAtTime(rate, t + 0.07); }
      else s.playbackRate.value = rate;
      const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = midiToFreq(n.midi);
      const sg = ctx.createGain(); sg.gain.value = 0.35;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.tone + p.slap * 2500; lp.Q.value = 0.7;
      const mix = ctx.createGain();
      const g = ctx.createGain();
      const len = Math.min(n.len, p.decay);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel * 0.6, t + 0.004);
      g.gain.setTargetAtTime(0.0001, t + len, 0.03);
      s.connect(mix); sub.connect(sg).connect(mix);
      mix.connect(shaper(ctx, p.drive)).connect(lp).connect(g).connect(out);
      s.start(t); sub.start(t);
      stopAll([s, sub], t + len + 0.3);
      st.voice = { gain: g, srcs: [s, sub] };
    },
  },

  baglama: {
    label: 'Bağlama (saz)', kind: 'melodic', color: '#d9a35c', defaultOct: 4,
    params: { bright: P('Parlaklık', 0, 1, 0.92), decay: P('Sönüm', 0.3, 3, 1.3), course: P('Çift tel (koro)', 0, 1, 1, 1), bend: P('Glissando süresi', 0.02, 0.3, 0.07) },
    // Çift telli "koro": ikinci tel birkaç sent kalın ve hafif gecikmeli → saz parıltısı
    play(ctx, out, t, n, p) {
      const strings = p.course >= 0.5 ? [[0, 0], [1, 0.004]] : [[0, 0]];
      const sum = ctx.createGain(), srcs = [];
      for (const [v, dt] of strings) {
        const { buf, rate } = pluckBuffer(ctx.sampleRate, n.midi, p.bright, p.decay, v, 0.07);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const det = v ? 1.0025 : 1;
        if (n.glideFrom != null) { s.playbackRate.setValueAtTime(rate * det * Math.pow(2, (n.glideFrom - n.midi) / 12), t + dt); s.playbackRate.exponentialRampToValueAtTime(rate * det, t + dt + p.bend); }
        else s.playbackRate.value = rate * det;
        s.connect(sum); s.start(t + dt); srcs.push(s);
      }
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
      const nasal = ctx.createBiquadFilter(); nasal.type = 'peaking'; nasal.frequency.value = 1400; nasal.Q.value = 1.5; nasal.gain.value = 5;
      const g = ctx.createGain(); const len = Math.min(n.len + 0.15, p.decay);
      g.gain.setValueAtTime(n.vel * 0.45, t); g.gain.setTargetAtTime(0.0001, t + len, 0.08);
      sum.connect(hp).connect(nasal).connect(g).connect(out);
      stopAll(srcs, t + len + 0.6);
    },
  },

  strings: {
    label: 'Yaylılar', kind: 'melodic', color: '#9fd3ff', defaultOct: 4,
    params: { attack: P('Atak', 0.02, 1.5, 0.25), release: P('Bırakma', 0.1, 2, 0.6), bright: P('Parlaklık', 500, 6000, 2600, 10), vib: P('Vibrato', 0, 1, 0.5), spic: P('Spiccato (kısa)', 0, 1, 0, 1) },
    play(ctx, out, t, n, p) {
      const f = midiToFreq(n.midi), srcs = [];
      const short = p.spic >= 0.5;
      const atk = short ? 0.01 : p.attack, rel = short ? 0.08 : p.release;
      const len = short ? Math.min(n.len, 0.12) : n.len;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.bright;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;
      const form = ctx.createBiquadFilter(); form.type = 'peaking'; form.frequency.value = 1100; form.Q.value = 1; form.gain.value = 3;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.3;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006 * p.vib, t + 0.4);
      lfo.connect(lg); lfo.start(t); srcs.push(lfo);
      for (const d of [-9, -3, 3, 9]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
        if (n.glideFrom != null) { o.frequency.setValueAtTime(midiToFreq(n.glideFrom), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12); }
        lg.connect(o.frequency); o.connect(lp); o.start(t); srcs.push(o);
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel * 0.13, t + atk);
      g.gain.setTargetAtTime(0.0001, t + Math.max(len, atk), rel / 3);
      lp.connect(hp).connect(form).connect(g).connect(out);
      stopAll(srcs, t + len + rel + 0.3);
    },
  },

  organ: {
    label: 'Org (Hammond)', kind: 'melodic', color: '#c9a0ff', defaultOct: 4,
    params: { drawbar: P('Dolgunluk', 0, 1, 0.6), leslie: P('Leslie hızı', 0, 8, 5.5, 0.1), perc: P('Perküsyon', 0, 1, 0.5), drive: P('Kirli', 0, 1, 0.2) },
    play(ctx, out, t, n, p) {
      const f = midiToFreq(n.midi), srcs = [];
      const sum = ctx.createGain();
      [[0.5, 0.6], [1, 1], [1.5, 0.5 * p.drawbar], [2, 0.7 * p.drawbar], [3, 0.4 * p.drawbar], [4, 0.3 * p.drawbar]].forEach(([hm, a]) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * hm;
        const og = ctx.createGain(); og.gain.value = a * 0.25; o.connect(og).connect(sum); o.start(t); srcs.push(o);
      });
      if (p.perc > 0) {
        const o = ctx.createOscillator(); o.frequency.value = f * 3;
        const og = vca(ctx, t, p.perc * 0.3, 0.002, 0.25); o.connect(og).connect(sum); o.start(t); srcs.push(o);
      }
      const trem = ctx.createGain(); trem.gain.value = 0.85;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = p.leslie; lg.gain.value = 0.15;
      lfo.connect(lg).connect(trem.gain); lfo.start(t); srcs.push(lfo);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel * 0.3, t + 0.006);
      g.gain.setTargetAtTime(0.0001, t + n.len, 0.03);
      sum.connect(shaper(ctx, p.drive)).connect(trem).connect(g).connect(out);
      stopAll(srcs, t + n.len + 0.3);
    },
  },

  brass: {
    label: 'Brass', kind: 'melodic', color: '#ffd27a', defaultOct: 4,
    params: { swell: P('Açılma', 0.01, 0.4, 0.07), bright: P('Parlaklık', 800, 6000, 3200, 10), vib: P('Vibrato', 0, 1, 0.25), release: P('Bırakma', 0.05, 1, 0.18) },
    play(ctx, out, t, n, p) {
      const f = midiToFreq(n.midi), srcs = [];
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(p.bright, t + p.swell);
      lp.frequency.setTargetAtTime(p.bright * 0.7, t + p.swell, 0.2);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.005 * p.vib, t + 0.35);
      lfo.connect(lg); lfo.start(t); srcs.push(lfo);
      for (const d of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
        if (n.glideFrom != null) { o.frequency.setValueAtTime(midiToFreq(n.glideFrom), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); }
        lg.connect(o.frequency); o.connect(lp); o.start(t); srcs.push(o);
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel * 0.22, t + p.swell);
      g.gain.setTargetAtTime(0.0001, t + Math.max(n.len, p.swell), p.release / 3);
      lp.connect(g).connect(out);
      stopAll(srcs, t + n.len + p.release + 0.3);
    },
  },

  flute: {
    label: 'Flüt / Ney', kind: 'melodic', color: '#bff5d8', defaultOct: 5,
    params: { breath: P('Nefes', 0, 1, 0.35), vib: P('Vibrato', 0, 1, 0.5), attack: P('Atak', 0.01, 0.3, 0.06), release: P('Bırakma', 0.05, 1, 0.2) },
    play(ctx, out, t, n, p) {
      const f = midiToFreq(n.midi);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
      const o2g = ctx.createGain(); o2g.gain.value = 0.12;
      if (n.glideFrom != null) {
        o.frequency.setValueAtTime(midiToFreq(n.glideFrom), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
        o2.frequency.setValueAtTime(midiToFreq(n.glideFrom) * 2, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.1);
      }
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008 * p.vib, t + 0.3);
      lfo.connect(lg).connect(o.frequency);
      const ns = noiseSrc(ctx), nb = ctx.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = f * 2; nb.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = p.breath * 0.5;
      const sum = ctx.createGain();
      o.connect(sum); o2.connect(o2g).connect(sum); ns.connect(nb).connect(ng).connect(sum);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(n.vel * 0.35, t + p.attack);
      g.gain.setTargetAtTime(0.0001, t + Math.max(n.len, p.attack), p.release / 3);
      sum.connect(g).connect(out);
      const srcs = [o, o2, ns, lfo];
      for (const x of srcs) x.start(t);
      stopAll(srcs, t + n.len + p.release + 0.3);
    },
  },

  multi: {
    label: 'Kayıtlı Enstrüman (kit)', kind: 'melodic', color: '#ffe9a8', defaultOct: 4,
    params: {
      attack: P('Atak', 0.001, 2, 0.003, 0.001), release: P('Bırakma', 0.03, 4, 0.35, 0.01), pedal: P('Pedal (1 = bas)', 0, 1, 0, 1),
      tone: P('Parlaklık (filtre)', 800, 20000, 20000, 10), width: P('Stereo yayılım', 0, 1, 0.3), gain: P('Kazanç', 0, 2, 1),
    },
    // Gerçek kayıtlardan çok örnekli enstrüman (public/kits/<kit>/kit.json). En yakın örnek seçilir ve perdesi
    // playbackRate ile kaydırılır; hız (velocity) yüksekse varsa güçlü dinamik katmanı kullanılır.
    play(ctx, out, t, n, p, st, track) {
      const kit = KIT_BANK.get(track && track.kit);
      if (!kit || !kit.zones.length) return;
      const layers = [...new Set(kit.zones.map((z) => z.vel))].sort((a, b) => a - b);
      const want = layers[Math.min(layers.length - 1, Math.floor(n.vel * layers.length * 0.999))];
      let best = null;
      for (const z of kit.zones) {
        if (z.vel !== want || !z.buffer) continue;
        if (!best || Math.abs(z.note - n.midi) < Math.abs(best.note - n.midi) || (Math.abs(z.note - n.midi) === Math.abs(best.note - n.midi) && z.note > best.note)) best = z;
      }
      if (!best) return;
      const s = ctx.createBufferSource(); s.buffer = best.buffer;
      const rate = Math.pow(2, (n.midi - best.note) / 12);
      if (n.glideFrom != null) { s.playbackRate.setValueAtTime(rate * Math.pow(2, (n.glideFrom - n.midi) / 12), t); s.playbackRate.exponentialRampToValueAtTime(rate, t + 0.12); }
      else s.playbackRate.value = rate;
      const g = ctx.createGain();
      // örnekler zaten dinamik katmanlıdır; hız farkını yumuşak bir eğriyle uygula
      const amp = p.gain * (kit.norm || 1) * (0.35 + 0.65 * n.vel);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp, t + p.attack);
      const rel = p.pedal >= 0.5 ? Math.max(p.release, 1.5) : p.release;
      const end = t + Math.max(n.len, p.attack);
      g.gain.setTargetAtTime(0.0001, end, rel / 3);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(20000, p.tone); lp.Q.value = 0.5;
      const pan = ctx.createStereoPanner(); pan.pan.value = n.midi < 52 ? 0 : Math.max(-0.7, Math.min(0.7, ((n.midi - 64) / 36) * p.width));
      s.connect(lp).connect(g).connect(pan).connect(out);
      s.start(t);
      s.stop(Math.min(t + best.buffer.duration / rate + 0.05, end + rel * 2 + 0.1));
    },
  },

  sampler: {
    label: 'Sampler', kind: 'melodic', color: '#e0e0e0', defaultOct: 4,
    params: { rootNote: P('Kök nota (MIDI)', 24, 96, 60, 1), start: P('Başlangıç (sn)', 0, 30, 0, 0.01), gain: P('Kazanç', 0, 2, 1), oneShot: P('Tamamını çal (1)', 0, 1, 1, 1) },
    play(ctx, out, t, n, p, st, track) {
      const buf = SAMPLE_BANK.get(track && (track.sample || track.sampleUrl));
      if (!buf) return;
      const s = ctx.createBufferSource(); s.buffer = buf;
      s.playbackRate.value = Math.pow(2, (n.midi - p.rootNote) / 12);
      const g = ctx.createGain(); g.gain.value = n.vel * p.gain;
      s.connect(g).connect(out);
      const off = clamp(p.start, 0, buf.duration - 0.01);
      if (p.oneShot >= 0.5) s.start(t, off);
      else {
        g.gain.setValueAtTime(n.vel * p.gain, t + n.len); g.gain.linearRampToValueAtTime(0, t + n.len + 0.03);
        s.start(t, off); s.stop(t + n.len + 0.05);
      }
    },
  },
};

// Sampler kanallarının ses tamponları (çalışma zamanı; JSON'a yazılmaz)
export const SAMPLE_BANK = new Map();
// Çok örnekli kitler: ad → { name, zones: [{ note, vel, buffer }] }
export const KIT_BANK = new Map();

export function defaultParams(inst) {
  const def = INSTRUMENTS[inst];
  const out = {};
  for (const [k, v] of Object.entries(def.params)) out[k] = v.def;
  return out;
}

// Kalibrasyon: her enstrümanın varsayılan ayarlarla birbirine dengeli çıkması için kanal giriş kazancı (dB).
// Ölçüm: tek nota, vol 1, düz master; hedef tepe değerleri kick ≈ -8 dB referansına göre.
export const LEVEL_DB = {
  kick: -3.6, snare: -4, clap: 8.3, hat: 7.7, openhat: 3, cowbell: 1.8, bass808: -2.7, bass: -3.3,
  lead: 0.9, pluck: 4.3, bell: 6.8, piano: 7.7, pad: 2, guitar: 0.8, vox: 6.2, perc: 9.8, fx: 7.9, sampler: 0,
  acoustic: 1, bassgtr: 2.2, baglama: -3.3, strings: 2.8, organ: 5, brass: 2.6, flute: 4.6, felt: 8.3, multi: 0,
};
