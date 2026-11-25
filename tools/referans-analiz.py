"""Referans parça analizi: "bu tarzda yap" istekleri için bir şarkının ölçülebilir özelliklerini çıkarır.
Melodiyi kopyalamak için değil; tempo, ton, davul kalıbı yoğunluğu, bas notaları, bölüm yapısı ve
frekans dengesi gibi tarz özelliklerini görmek için.

Kullanım: python tools/referans-analiz.py <ses dosyası>   (ffmpeg gerekir)
"""
import subprocess
import sys

import numpy as np

SR = 22050
NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
# Krumhansl-Kessler ton profilleri
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def stft(x, n=2048, hop=512):
    win = np.hanning(n)
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * win
    return np.abs(np.fft.rfft(frames, axis=1)), np.fft.rfftfreq(n, 1 / SR), hop


def band_onset(S, freqs, lo, hi):
    e = np.log1p(S[:, (freqs >= lo) & (freqs < hi)].sum(axis=1))
    d = np.maximum(0, np.diff(e, prepend=e[0]))
    return d / (d.max() + 1e-9)


def tempo(onset, hop):
    fps = SR / hop
    ac = np.correlate(onset - onset.mean(), onset - onset.mean(), 'full')[len(onset) - 1:]
    best, bpm = 0, 0
    for b in np.arange(60, 181, 0.5):
        lag = fps * 60 / b
        i = int(round(lag))
        if i + 1 >= len(ac):
            continue
        # vuruş ve iki katı gecikmeye bak (yarım/çift tempo karışıklığını azaltır)
        sc = ac[i] + 0.5 * ac[min(len(ac) - 1, 2 * i)]
        if sc > best:
            best, bpm = sc, b
    return bpm


def main():
    path = sys.argv[1]
    x = load(path)
    dur = len(x) / SR
    S, freqs, hop = stft(x)
    fps = SR / hop
    full = band_onset(S, freqs, 30, 11000)
    bpm = tempo(full, hop)
    print(f"süre {dur:.1f} sn · tahmini tempo {bpm:.1f} BPM (yarı/çift tempo da olabilir: {bpm/2:.1f} / {bpm*2:.1f})")

    # ton: 80–2000 Hz kromagram
    chroma = np.zeros(12)
    m = (freqs > 80) & (freqs < 2000)
    midi = 69 + 12 * np.log2(freqs[m] / 440)
    pcs = np.round(midi).astype(int) % 12
    energy = (S[:, m] ** 2).sum(axis=0)
    for pc, e in zip(pcs, energy):
        chroma[pc] += e
    chroma /= chroma.max()
    scores = []
    for k in range(12):
        scores.append((np.corrcoef(np.roll(MAJ, k), chroma)[0, 1], NOTES[k] + ' majör'))
        scores.append((np.corrcoef(np.roll(MIN, k), chroma)[0, 1], NOTES[k] + ' minör'))
    scores.sort(reverse=True)
    print('ton adayları:', ', '.join(f"{n} ({s:.2f})" for s, n in scores[:3]))
    print('nota sınıfı ağırlıkları:', ' '.join(f"{NOTES[i]}:{chroma[i]:.2f}" for i in np.argsort(-chroma)[:8]))

    # bas (808) notaları: 30–130 Hz tepe frekansı, enerjili karelerde
    lowm = (freqs >= 30) & (freqs < 130)
    lowS = S[:, lowm]
    lowE = lowS.sum(axis=1)
    thr = np.percentile(lowE, 60)
    hist = {}
    for i in np.where(lowE > thr)[0]:
        f = freqs[lowm][np.argmax(lowS[i])]
        n = int(round(69 + 12 * np.log2(f / 440)))
        hist[n] = hist.get(n, 0) + 1
    top = sorted(hist.items(), key=lambda kv: -kv[1])[:6]
    print('bas notaları (en sık):', ', '.join(f"{NOTES[n % 12]}{n // 12 - 1}({c})" for n, c in top))

    # bölüm yapısı: 2 saniyelik bloklarda RMS ve bant payları
    blk = int(2 * fps)
    sub = S[:, freqs < 60].sum(axis=1) ** 1
    mids = S[:, (freqs >= 400) & (freqs < 4000)].sum(axis=1)
    highs = S[:, freqs >= 6000].sum(axis=1)
    tot = S.sum(axis=1) + 1e-9
    print('\nzaman çizelgesi (2 sn): seviye | alt bas% orta% tiz%')
    rows = []
    for i in range(0, len(tot) - blk, blk):
        sl = slice(i, i + blk)
        rms = 20 * np.log10(np.sqrt(np.mean(x[int(i * hop):int((i + blk) * hop)] ** 2)) + 1e-9)
        rows.append((i / fps, rms, 100 * sub[sl].sum() / tot[sl].sum(), 100 * mids[sl].sum() / tot[sl].sum(), 100 * highs[sl].sum() / tot[sl].sum()))
    for t, r, a, b, c in rows:
        bar = '#' * max(0, int((r + 40) / 1.5))
        print(f"  {int(t // 60)}:{int(t % 60):02d} {r:6.1f} dB {bar:26s} {a:4.0f} {b:4.0f} {c:4.0f}")

    # davul kalıbı: en yüksek tempoya göre 16'lık ızgara, yüksek enerjili bölgelerde ortalama
    kick = band_onset(S, freqs, 30, 120)
    snare = band_onset(S, freqs, 1500, 5000)
    hat = band_onset(S, freqs, 7000, 11000)
    for B in (bpm, bpm / 2):
        step = fps * 60 / B / 4
        nsteps = int(len(full) / step)
        # faz: kick onsetlerini en iyi hizalayan kaydırma
        best_phase, best_val = 0, -1
        for ph in np.linspace(0, step * 4, 32, endpoint=False):
            idx = (ph + np.arange(0, nsteps - 4, 4) * step).astype(int)
            idx = idx[idx < len(kick)]
            v = kick[idx].mean()
            if v > best_val:
                best_val, best_phase = v, ph
        loud = set(int(t // 2) for t, r, *_ in rows if r > np.percentile([r for _, r, *_ in rows], 50))
        grids = {}
        for name, on in (('kick', kick), ('snare/clap', snare), ('hat', hat)):
            g = np.zeros(16); cnt = np.zeros(16)
            for k in range(nsteps):
                pos = int(best_phase + k * step)
                if pos >= len(on) or int(pos / fps // 2) not in loud:
                    continue
                g[k % 16] += on[max(0, pos - 1):pos + 2].max(); cnt[k % 16] += 1
            grids[name] = g / np.maximum(cnt, 1)
        print(f"\n16'lık davul yoğunluğu @ {B:.1f} BPM (0–9; yüksek enerjili bölgeler):")
        for name, g in grids.items():
            gg = g / (g.max() + 1e-9)
            print(f"  {name:10s} " + ''.join(str(min(9, int(v * 9.99))) for v in gg))

    # frekans dengesi (analiz.py ile aynı bantlar)
    spec = (S ** 2).sum(axis=0)
    total = spec[freqs >= 20].sum()
    print('\nbant enerjisi:')
    for name, lo, hi in [("alt bas 20-60", 20, 60), ("bas 60-150", 60, 150), ("alt orta 150-400", 150, 400), ("orta 400-1k", 400, 1000),
                         ("üst orta 1-3k", 1000, 3000), ("varlık 3-6k", 3000, 6000), ("parlaklık 6-11k", 6000, 11025)]:
        e = spec[(freqs >= lo) & (freqs < hi)].sum()
        print(f"  {name:18s} {100 * e / total:5.1f}%")


if __name__ == '__main__':
    main()
