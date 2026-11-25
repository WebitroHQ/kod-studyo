// Ses motoru: kanal grafı, sidechain, send efektleri, master zinciri,
// gerçek zamanlı zamanlayıcı ve ofline render (WAV için).

import { INSTRUMENTS, driveCurve, LEVEL_DB } from './instruments.js';

export const STEPS = 32; // desen başına 16'lık adım (2 ölçü)

const dbToGain = (db) => Math.pow(10, db / 20);

export const MASTER_DEFAULT = { low: 0, high: 0, drive: 0.15, glue: 0.4, makeup: 3, ceiling: -0.8, reverb: 1.6, damp: 0.5, wow: 0, noise: 0 };

// ---------- master zinciri ----------
// Web Audio'nun DynamicsCompressor'ı kendi otomatik makeup kazancını ekler (spec: tam ölçek
// kazancının tersinin 0.6 kuvveti). Kazanç yapısını öngörülebilir tutmak için bunu geri alıyoruz.
const autoMakeupDb = (threshold, ratio) => -0.6 * threshold * (1 - 1 / ratio);

// Son kademe: 0.8'e kadar doğrusal, üstü yumuşak doyum; çıkış asla ±1'i aşmaz
let clipCurve = null;
function softClipCurve() {
  if (!clipCurve) {
    const n = 4096; clipCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
      clipCurve[i] = Math.sign(x) * (a < 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2));
    }
  }
  return clipCurve;
}

function createMaster(ctx, dest) {
  const input = ctx.createGain(); input.gain.value = 0.42; // kanal toplamı için headroom
  // 25 Hz altını kes: duyulmayan sub-sonik enerji limiter'ı boşuna çalıştırıyordu
  const hpf1 = ctx.createBiquadFilter(), hpf2 = ctx.createBiquadFilter();
  hpf1.type = hpf2.type = 'highpass'; hpf1.frequency.value = hpf2.frequency.value = 25; hpf1.Q.value = hpf2.Q.value = 0.54;
  const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 90;
  const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 7000;
  const pre = ctx.createGain();
  const sat = ctx.createWaveShaper(); sat.oversample = '4x';
  const post = ctx.createGain();
  const glue = ctx.createDynamicsCompressor();
  glue.attack.value = 0.012; glue.release.value = 0.18; glue.knee.value = 6;
  const glueComp = ctx.createGain();
  const makeup = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
  limiter.threshold.value = -2;
  const limComp = ctx.createGain(); limComp.gain.value = dbToGain(-autoMakeupDb(-2, 20));
  const clip = ctx.createWaveShaper(); clip.curve = softClipCurve(); clip.oversample = '4x';
  const out = ctx.createGain();
  const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
  // bant sıcaklığı: tüm miks hafifçe modüle edilen bir gecikmeden geçer → wow (0.5 Hz) ve flutter (6 Hz) perde dalgalanması
  const tape = ctx.createDelay(0.05); tape.delayTime.value = 0.008;
  const wowL = ctx.createOscillator(), wowG = ctx.createGain(); wowL.frequency.value = 0.45; wowG.gain.value = 0;
  const flL = ctx.createOscillator(), flG = ctx.createGain(); flL.frequency.value = 6.2; flG.gain.value = 0;
  wowL.connect(wowG).connect(tape.delayTime); flL.connect(flG).connect(tape.delayTime);
  wowL.start(0); flL.start(0);
  // hışırtı (bant/plak) + seyrek çıtırtı, limiter'dan önce eklenir
  const hiss = ctx.createBufferSource(); hiss.buffer = noiseBed(ctx); hiss.loop = true;
  const hissHp = ctx.createBiquadFilter(); hissHp.type = 'highpass'; hissHp.frequency.value = 900;
  const hissLp = ctx.createBiquadFilter(); hissLp.type = 'lowpass'; hissLp.frequency.value = 7000;
  const hissG = ctx.createGain(); hissG.gain.value = 0;
  hiss.connect(hissHp).connect(hissLp).connect(hissG).connect(makeup); hiss.start(0);
  input.connect(hpf1).connect(hpf2).connect(low).connect(high).connect(pre).connect(sat).connect(post).connect(tape).connect(glue).connect(glueComp)
    .connect(makeup).connect(limiter).connect(limComp).connect(clip).connect(out);
  out.connect(dest); out.connect(analyser);

  function set(m) {
    const p = { ...MASTER_DEFAULT, ...m };
    low.gain.value = p.low; high.gain.value = p.high;
    // saturasyon: sürüş arttıkça daha çok harmonik, seviye yaklaşık sabit
    sat.curve = driveCurve(p.drive * 0.7);
    pre.gain.value = 1 + p.drive * 0.8; post.gain.value = 1 / (1 + p.drive * 0.8);
    const T = -6 - p.glue * 20, R = 1.5 + p.glue * 3;
    glue.threshold.value = T; glue.ratio.value = R;
    glueComp.gain.value = dbToGain(-autoMakeupDb(T, R));
    makeup.gain.value = dbToGain(p.makeup);
    out.gain.value = dbToGain(Math.min(0, p.ceiling));
    wowG.gain.value = 0.0012 * (p.wow || 0); flG.gain.value = 0.00012 * (p.wow || 0);
    hissG.gain.value = 0.02 * (p.noise || 0);
  }
  return { input, analyser, set };
}

// Reverb dürtü yanıtı: 18 ms ön gecikme, 6 erken yansıma, kanal başına ayrık gürültü kuyruğu (−60 dB = seconds),
// kuyruk ilerledikçe tek kutuplu alçak geçiren daha çok kapanır (damp) → doğal, koyulaşan bir oda.
function reverbIR(ctx, seconds, damp = 0.5) {
  const sr = ctx.sampleRate;
  const pre = Math.floor(0.018 * sr);
  const len = Math.floor(sr * seconds) + pre;
  const buf = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 2 });
  const taps = [[0.011, 0.5], [0.019, 0.35], [0.027, 0.42], [0.036, 0.3], [0.047, 0.26], [0.061, 0.2]];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (const [tt, g] of taps) { const i = pre + Math.floor((tt + c * 0.0023) * sr); if (i < len) d[i] += g * (c ? -1 : 1); }
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const x = (i - pre) / sr;
      const env = Math.exp((-6.9 * x) / seconds);
      const a = Math.min(0.97, 0.15 + damp * 0.8 * (x / seconds) + damp * 0.1); // zamanla koyulaşma
      lp = lp * a + rnd() * (1 - a);
      d[i] += lp * env * (1.6 + damp * 2.5) * 0.6; // eski IR ile aynı toplam enerji (≈ −4.5 dB)
    }
  }
  return buf;
}

// 4 sn'lik hışırtı/çıtırtı yatağı (loop)
const bedCache = new Map();
function noiseBed(ctx) {
  if (bedCache.has(ctx.sampleRate)) return bedCache.get(ctx.sampleRate);
  const sr = ctx.sampleRate, len = sr * 4;
  const buf = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 2 });
  let seed = 777;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = rnd() * 0.5;
    for (let k = 0; k < 18; k++) { // çıtırtılar
      const i = Math.floor(((rnd() + 1) / 2) * (len - 200));
      const amp = 2 + ((rnd() + 1) / 2) * 6;
      for (let j = 0; j < 60; j++) d[i + j] += amp * Math.exp(-j / 8) * (j % 2 ? -1 : 1);
    }
  }
  bedCache.set(sr, buf);
  return buf;
}

// Bitcrush: genliği basamaklara böler (0 = dokunmaz, 1 = 3 bit). Hyperpop / lo-fi ses tasarımı için.
const crushCache = new Map();
function crushCurve(amount) {
  const k = Math.round(amount * 20);
  if (!crushCache.has(k)) {
    const n = 4096, c = new Float32Array(n);
    const steps = k === 0 ? 0 : Math.pow(2, 12 - k * 0.45);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = steps ? Math.round(x * steps) / steps : x;
    }
    crushCache.set(k, c);
  }
  return crushCache.get(k);
}

// ---------- grafik ----------
function buildGraph(ctx, dest, song, raw = false) {
  // raw: master zinciri yok (parça parça render için); master sonra tek geçişte uygulanır
  let master;
  if (raw) { const input = ctx.createGain(); input.connect(dest); master = { input, analyser: null, set() {} }; }
  else master = createMaster(ctx, dest);
  const reverb = ctx.createConvolver();
  reverb.buffer = reverbIR(ctx, (song.master && song.master.reverb) || MASTER_DEFAULT.reverb, song.master && song.master.damp != null ? song.master.damp : MASTER_DEFAULT.damp);
  const revOut = ctx.createGain(); revOut.gain.value = 0.9;
  // reverb'e giden sinyalin altını/üstünü kes: pes frekanslar odada çamur ve stereo bas yapmasın
  const revHp = ctx.createBiquadFilter(); revHp.type = 'highpass'; revHp.frequency.value = 180;
  const revLp = ctx.createBiquadFilter(); revLp.type = 'lowpass'; revLp.frequency.value = 9000;
  revHp.connect(revLp).connect(reverb);
  reverb.connect(revOut).connect(master.input);
  const delay = ctx.createDelay(2), fb = ctx.createGain(), dlp = ctx.createBiquadFilter();
  fb.gain.value = 0.38; dlp.type = 'lowpass'; dlp.frequency.value = 3500;
  delay.connect(dlp).connect(fb).connect(delay); dlp.connect(master.input);
  const g = { ctx, master, reverb, revIn: revHp, delay, buses: new Map(), states: new Map() };
  syncGraph(g, song);
  return g;
}

function syncGraph(g, song) {
  const { ctx } = g;
  const live = new Set();
  const anySolo = song.tracks.some((t) => t.solo);
  for (const tr of song.tracks) {
    live.add(tr.id);
    let b = g.buses.get(tr.id);
    if (!b) {
      const input = ctx.createGain(), duck = ctx.createGain(), pan = ctx.createStereoPanner(), vol = ctx.createGain();
      const rev = ctx.createGain(), dly = ctx.createGain();
      const crush = ctx.createWaveShaper(); crush.curve = crushCurve(0);
      input.connect(crush).connect(duck).connect(pan).connect(vol);
      vol.connect(g.master.input); vol.connect(rev).connect(g.revIn); vol.connect(dly).connect(g.delay);
      b = { input, duck, pan, vol, rev, dly, crush, crushAmt: 0 };
      g.buses.set(tr.id, b);
      g.states.set(tr.id, { lastNote: null, voice: null });
    }
    const audible = !tr.mute && (!anySolo || tr.solo);
    b.input.gain.value = dbToGain(LEVEL_DB[tr.inst] || 0);
    b.vol.gain.value = audible ? tr.vol : 0;
    b.pan.pan.value = tr.pan;
    b.rev.gain.value = tr.rev;
    if ((tr.crush || 0) !== b.crushAmt) { b.crushAmt = tr.crush || 0; b.crush.curve = crushCurve(b.crushAmt); }
    b.dly.gain.value = tr.dly;
  }
  for (const [id, b] of g.buses) {
    if (!live.has(id)) { b.vol.disconnect(); g.buses.delete(id); g.states.delete(id); }
  }
  g.master.set(song.master || {});
  // reverb süresi/koyuluğu değiştiyse dürtü yanıtını yeniden üret
  const m = { ...MASTER_DEFAULT, ...(song.master || {}) };
  const irKey = m.reverb.toFixed(2) + '|' + m.damp.toFixed(2);
  if (g.irKey && g.irKey !== irKey) g.reverb.buffer = reverbIR(ctx, m.reverb, m.damp);
  g.irKey = irKey;
  const stepDur = 60 / song.bpm / 4;
  g.delay.delayTime.value = Math.min(1.9, stepDur * 3);
}

// -1..1 arası, (kanal, adım, alt vuruş) için hep aynı sözde rastgele değer
function jitter(id, step, k) {
  let h = 2166136261;
  const s = id + ':' + step + ':' + k;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

// Bir adımı belirtilen zamana planla. Gerçek zamanlı ve ofline ortak kullanır.
function scheduleStep(g, song, patId, step, t) {
  const pat = song.patterns[patId];
  if (!pat) return;
  const stepDur = 60 / song.bpm / 4;
  const swingOff = step % 2 === 1 ? (song.swing || 0) * stepDur * 0.66 : 0;
  const anySolo = song.tracks.some((tr) => tr.solo);
  const kicks = [];
  for (const tr of song.tracks) {
    const evs = pat[tr.id];
    if (!evs || !evs.length) continue;
    if (tr.mute || (anySolo && !tr.solo)) continue;
    const inst = INSTRUMENTS[tr.inst];
    const bus = g.buses.get(tr.id), st = g.states.get(tr.id);
    if (!inst || !bus) continue;
    const loose = (song.humanize || 0) > 0 && tr.inst !== 'kick' && tr.inst !== 'bass808';
    for (const ev of evs) {
      if (ev.s !== step) continue;
      const r = Math.max(1, ev.r || 1);
      for (let k = 0; k < r; k++) {
        // insanileştirme: olaya bağlı (tekrarlanabilir) küçük zaman ve hız sapması
        const hsh = loose ? jitter(tr.id, step, k) : 0;
        const tt = Math.max(0, t + swingOff + (k * stepDur) / r + hsh * ((song.humanize || 0) / 1000));
        const midi = ev.n != null ? ev.n : 60;
        const note = {
          midi,
          vel: (ev.v != null ? ev.v : 0.9) * (k > 0 ? 0.8 : 1) * (loose ? 1 + jitter(tr.id, step, k + 7) * 0.06 : 1),
          len: ((ev.l || 1) * stepDur) / r,
          glideFrom: ev.g && st.lastNote != null && st.lastNote !== midi ? st.lastNote : null,
          rev: !!ev.rv,
        };
        try { inst.play(g.ctx, bus.input, tt, note, tr.params, st, tr); } catch (e) { console.warn(tr.inst, e); }
        st.lastNote = midi;
        if (tr.inst === 'kick') kicks.push(tt);
      }
    }
  }
  // sidechain: kick vurduğunda "duck" ayarlı kanalları bastır
  if (kicks.length) {
    for (const tr of song.tracks) {
      if (!tr.duck) continue;
      const b = g.buses.get(tr.id);
      if (!b) continue;
      for (const kt of kicks) {
        b.duck.gain.setValueAtTime(1 - tr.duck * 0.85, kt);
        b.duck.gain.setTargetAtTime(1, kt + 0.015, 0.06 + tr.duck * 0.05);
      }
    }
  }
}

// Şarkı akışı: (bölüm, tekrar, adım) dizisi
export function timeline(song) {
  const out = [];
  song.arrangement.forEach((sec, si) => {
    for (let r = 0; r < Math.max(1, sec.reps); r++) out.push({ si, pat: sec.pattern });
  });
  return out;
}

export function songSeconds(song) {
  return timeline(song).length * STEPS * (60 / song.bpm / 4);
}

export class Engine {
  constructor() {
    this.ctx = null; this.graph = null; this.playing = false;
    this.queue = []; this.timer = null; this.song = null;
    this.mode = 'pattern'; this.patId = null;
  }

  ensure(song) {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.graph = buildGraph(this.ctx, this.ctx.destination, song);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  update(song) {
    this.song = song;
    if (this.graph) syncGraph(this.graph, song);
  }

  get analyser() { return this.graph && this.graph.master.analyser; }

  play(song, mode, patId, startSection = 0) {
    this.ensure(song);
    this.stop();
    this.update(song);
    this.mode = mode; this.patId = patId;
    this.playing = true;
    this.pos = { tl: 0, step: 0 };
    if (mode === 'song') {
      const tl = timeline(song);
      this.pos.tl = Math.max(0, tl.findIndex((x) => x.si === startSection));
    }
    this.nextTime = this.ctx.currentTime + 0.06;
    const tick = () => {
      if (!this.playing) return;
      const s = this.song;
      const stepDur = 60 / s.bpm / 4;
      while (this.nextTime < this.ctx.currentTime + 0.12) {
        let pat, si = -1;
        if (this.mode === 'song') {
          const tl = timeline(s);
          if (!tl.length) break;
          if (this.pos.tl >= tl.length) this.pos.tl = 0;
          pat = tl[this.pos.tl].pat; si = tl[this.pos.tl].si;
        } else pat = this.patId;
        scheduleStep(this.graph, s, pat, this.pos.step, this.nextTime);
        this.queue.push({ time: this.nextTime, step: this.pos.step, si, pat });
        this.nextTime += stepDur;
        this.pos.step++;
        if (this.pos.step >= STEPS) { this.pos.step = 0; this.pos.tl++; }
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }

  setPattern(patId) { this.patId = patId; }

  stop() {
    this.playing = false;
    clearInterval(this.timer); this.timer = null;
    this.queue = [];
    if (this.graph) for (const st of this.graph.states.values()) { st.lastNote = null; st.voice = null; }
  }

  // Arayüz için: şu an duyulan adım
  currentStep() {
    if (!this.playing || !this.ctx) return null;
    const now = this.ctx.currentTime;
    let cur = null;
    while (this.queue.length && this.queue[0].time <= now) cur = this.queue.shift();
    if (cur) this.lastShown = cur;
    return this.lastShown || null;
  }

  preview(song, track, midi) {
    this.ensure(song);
    this.update(song);
    const inst = INSTRUMENTS[track.inst];
    const bus = this.graph.buses.get(track.id);
    if (!inst || !bus) return;
    const st = { lastNote: null, voice: null };
    inst.play(this.ctx, bus.input, this.ctx.currentTime + 0.01, { midi, vel: 0.85, len: 0.3, glideFrom: null }, track.params, st, track);
  }

  // Ofline render. Tek büyük OfflineAudioContext'te biten düğümler toplanmadığı için render
  // zamanla yavaşlıyor; bu yüzden şarkı 2 desenlik parçalar halinde (master'sız) render edilip
  // toplanır, master zinciri en sonda tek geçişte uygulanır.
  // opts.pattern: tek desen, opts.maxSteps: yalnızca baş kısım, opts.tail: sondaki kuyruk (sn).
  async render(song, opts = {}) {
    const sr = opts.sampleRate || 44100;
    const stepDur = 60 / song.bpm / 4;
    const tl = opts.pattern ? [{ pat: opts.pattern }] : timeline(song);
    let totalSteps = tl.length * STEPS;
    if (opts.maxSteps) totalSteps = Math.min(totalSteps, opts.maxSteps);
    const tail = opts.tail != null ? opts.tail : 2.5;
    const ring = 2.5; // parça kuyruğu: reverb/delay/808 sönümü
    const lead = 0.02;
    const totalLen = Math.ceil((lead + totalSteps * stepDur + tail) * sr);
    const mix = [new Float32Array(totalLen), new Float32Array(totalLen)];
    const lastNotes = new Map();
    const chunk = STEPS * 2;
    for (let c0 = 0; c0 < totalSteps; c0 += chunk) {
      const n = Math.min(chunk, totalSteps - c0);
      const ctx = new OfflineAudioContext(2, Math.ceil((lead + n * stepDur + ring) * sr), sr);
      const g = buildGraph(ctx, ctx.destination, song, true);
      for (const [id, ln] of lastNotes) { const st = g.states.get(id); if (st) st.lastNote = ln; }
      for (let i = c0; i < c0 + n; i++) {
        const entry = tl[Math.floor(i / STEPS)];
        scheduleStep(g, song, entry.pat, i % STEPS, lead + (i - c0) * stepDur);
      }
      for (const [id, st] of g.states) lastNotes.set(id, st.lastNote);
      const buf = await ctx.startRendering();
      const off = Math.round(c0 * stepDur * sr);
      for (let ch = 0; ch < 2; ch++) {
        const src = buf.getChannelData(ch), dst = mix[ch];
        const end = Math.min(src.length, totalLen - off);
        for (let k = 0; k < end; k++) dst[off + k] += src[k];
      }
    }
    // master geçişi
    const ctx = new OfflineAudioContext(2, totalLen, sr);
    const master = createMaster(ctx, ctx.destination);
    master.set(song.master || {});
    const pre = new AudioBuffer({ length: totalLen, sampleRate: sr, numberOfChannels: 2 });
    pre.copyToChannel(mix[0], 0); pre.copyToChannel(mix[1], 1);
    const src = ctx.createBufferSource(); src.buffer = pre; src.connect(master.input); src.start(0);
    return ctx.startRendering();
  }
}

// RMS ve tepe ölçümü (dBFS)
export function measure(buffer) {
  let sum = 0, peak = 0, n = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i += 2) { const v = d[i]; sum += v * v; n++; const a = Math.abs(v); if (a > peak) peak = a; }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  return { rmsDb: 20 * Math.log10(rms + 1e-9), peakDb: 20 * Math.log10(peak + 1e-9) };
}

// Oto-master: hedef RMS'e ulaşana kadar makeup kazancını ayarla (2-3 tur ofline render).
export async function autoMaster(engine, song, targetRmsDb, onProgress) {
  const m = { ...MASTER_DEFAULT, ...song.master };
  // en dolu bölümü analiz et (en çok olaya sahip desen)
  let best = song.arrangement[0] && song.arrangement[0].pattern, bestCount = -1;
  for (const [pid, pat] of Object.entries(song.patterns)) {
    const c = Object.values(pat).reduce((s, evs) => s + evs.length, 0);
    if (c > bestCount) { bestCount = c; best = pid; }
  }
  let result = null;
  for (let i = 0; i < 4; i++) {
    const buf = await engine.render({ ...song, master: m }, { pattern: best, tail: 0 });
    result = measure(buf);
    if (onProgress) onProgress(i, result, m.makeup);
    const diff = targetRmsDb - result.rmsDb;
    if (Math.abs(diff) < 0.5) break;
    m.makeup = Math.max(-6, Math.min(24, m.makeup + diff * 0.9));
  }
  return { master: m, result };
}
