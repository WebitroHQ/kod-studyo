"""Matharium videosunun sesi: bölüm sınırları (sessizlikler), adım süresi ve dalga biçimi (harmonik yapısı)."""
import subprocess
import sys

import numpy as np

SR = 44100
path = sys.argv[1]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
print(f"süre {len(x)/SR:.2f} sn, tepe {20*np.log10(np.abs(x).max()):.1f} dB")

# 20 ms pencerelerde seviye → sessiz aralıklar (bölüm sınırları)
w = int(0.02 * SR)
lev = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, len(x) - w, w)])
db = 20 * np.log10(lev + 1e-9)
quiet = db < (np.median(db) - 25)
gaps, start = [], None
for i, q in enumerate(quiet):
    if q and start is None:
        start = i
    if not q and start is not None:
        if (i - start) * 0.02 >= 0.25:
            gaps.append((start * 0.02, i * 0.02))
        start = None
print('sessiz aralıklar (≥0.25 sn):', ', '.join(f"{a:.2f}–{b:.2f}" for a, b in gaps))

# onset aralıkları → adım süresi
n, hop = 2048, 256
win = np.hanning(n)
fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * win
S = np.abs(np.fft.rfft(fr, axis=1))
f = np.fft.rfftfreq(n, 1 / SR)
flux = np.maximum(0, np.diff(np.log1p(S), axis=0)).sum(axis=1)
fps = SR / hop
for (a, b) in [(0.3, 12.5), (13.5, 25.5), (27, 39), (40.5, 52.5), (54, 65.5)]:
    seg = flux[int(a * fps):int(b * fps)]
    seg = seg - seg.mean()
    ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
    lo, hi = int(0.05 * fps), int(0.6 * fps)
    lag = lo + np.argmax(ac[lo:hi])
    print(f"bölüm {a:.0f}-{b:.0f} sn: en güçlü onset periyodu {lag / fps * 1000:.0f} ms")

# dalga biçimi: ilk bölümün ortasından bir pencerede harmonik oranları
seg = x[int(2.0 * SR):int(2.0 * SR) + 16384] * np.hanning(16384)
sp = np.abs(np.fft.rfft(seg)); ff = np.fft.rfftfreq(16384, 1 / SR)
band = (ff > 150) & (ff < 1500)
f0 = ff[band][np.argmax(sp[band])]
amps = []
for h in range(1, 9):
    i = np.argmin(np.abs(ff - f0 * h))
    amps.append(sp[max(0, i - 3):i + 4].max())
amps = np.array(amps) / amps[0]
print(f"temel ~{f0:.1f} Hz; harmonikler (1..8, temel=1):", ' '.join(f"{a:.2f}" for a in amps))
print("  kare dalga beklentisi: tek harmonikler 1/3, 1/5, 1/7; çift ~0 · testere: 1/2, 1/3, 1/4 …")
