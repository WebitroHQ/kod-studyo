"""Bir WAV dosyasının miks teşhisi: frekans bantlarına enerji dağılımı, dinamik, stereo, düşük uç mono uyumu.

Kullanım:  python tools/analiz.py exports/sarki.wav [baslangic_sn] [sure_sn]
Referans: tipik modern trap/phonk miksinde enerji alt bas + bas bölgesinde yoğun, 2–5 kHz'de belirgin bir
"varlık" bandı, 10 kHz üstünde yumuşak bir düşüş vardır. Bu araç kesin doğru söylemez; kulakla karşılaştırma içindir.
"""
import sys
import wave

import numpy as np

BANDS = [("alt bas 20-60", 20, 60), ("bas 60-150", 60, 150), ("alt orta 150-400", 150, 400),
         ("orta 400-1k", 400, 1000), ("üst orta 1-3k", 1000, 3000), ("varlık 3-6k", 3000, 6000),
         ("parlaklık 6-12k", 6000, 12000), ("hava 12k+", 12000, 22050)]


def load(path):
    w = wave.open(path)
    sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
    a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64) / 32768
    return sr, a.reshape(-1, ch)


def main():
    path = sys.argv[1]
    sr, x = load(path)
    if len(sys.argv) > 2:
        s0 = int(float(sys.argv[2]) * sr)
        dur = int(float(sys.argv[3]) * sr) if len(sys.argv) > 3 else len(x)
        x = x[s0:s0 + dur]
    L, R = x[:, 0], x[:, -1]
    mid, side = (L + R) / 2, (L - R) / 2
    rms = lambda v: 20 * np.log10(np.sqrt(np.mean(v ** 2)) + 1e-12)
    peak = 20 * np.log10(np.max(np.abs(x)) + 1e-12)
    print(f"süre {len(x)/sr:.1f} sn · RMS {rms(mid):.1f} dB · tepe {peak:.1f} dB · crest {peak - rms(mid):.1f} dB")
    print(f"stereo genişlik (side/mid) {rms(side) - rms(mid):.1f} dB")

    # bant enerjileri (Welch benzeri ortalama spektrum)
    nfft = 8192
    win = np.hanning(nfft)
    spec = np.zeros(nfft // 2 + 1)
    hops = range(0, len(mid) - nfft, nfft // 2)
    for i in hops:
        spec += np.abs(np.fft.rfft(mid[i:i + nfft] * win)) ** 2
    freqs = np.fft.rfftfreq(nfft, 1 / sr)
    total = spec[(freqs >= 20)].sum()
    print("\nbant enerjisi (toplamın yüzdesi / dB):")
    for name, lo, hi in BANDS:
        e = spec[(freqs >= lo) & (freqs < hi)].sum()
        print(f"  {name:18s} {100 * e / total:5.1f}%  {10 * np.log10(e / total + 1e-12):6.1f} dB")

    # düşük uç mono uyumu: 150 Hz altında side enerjisi
    def lowpass_energy(v):
        e = 0
        for i in hops:
            f = np.abs(np.fft.rfft(v[i:i + nfft] * win)) ** 2
            e += f[(freqs >= 20) & (freqs < 150)].sum()
        return e
    lm, ls = lowpass_energy(mid), lowpass_energy(side)
    print(f"\n150 Hz altı side/mid oranı {10 * np.log10(ls / (lm + 1e-12) + 1e-12):.1f} dB (-20 dB'den düşük olmalı: bas mono)")

    # dinamik: 400 ms pencerelerde RMS dağılımı
    blk = int(0.4 * sr)
    vals = [rms(mid[i:i + blk]) for i in range(0, len(mid) - blk, blk)]
    vals = [v for v in vals if v > -60]
    if vals:
        print(f"kısa dönem RMS: en düşük {min(vals):.1f}, medyan {np.median(vals):.1f}, en yüksek {max(vals):.1f} dB")


if __name__ == "__main__":
    main()
