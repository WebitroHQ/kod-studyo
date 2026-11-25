"""Formülden çıkan nota dizisini videonun sesine oturtur: her bölüm için başlangıç zamanı ve adım süresi
(ızgara araması), eşleşme yüzdesiyle. Sonuç compositions/matharium.py'deki ZAMANLAMA'ya yazılır.
"""
import subprocess
import sys

import numpy as np

sys.path.insert(0, __import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'compositions'))
import matharium as M  # noqa: E402

SR = 22050
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)

# 10 ms adımlı baskın nota sınıfı izi (HPS)
n, hop = 4096, 220
win = np.hanning(n)
fr = np.lib.stride_tricks.sliding_window_view(np.pad(x, (n // 2, n)), n)[::hop] * win
S = np.abs(np.fft.rfft(fr, axis=1)) + 1e-12
ff = np.fft.rfftfreq(n, 1 / SR)
H = S.copy()
for k in (2, 3):
    H[:, :S.shape[1] // k] *= S[:, ::k][:, :S.shape[1] // k]
m = (ff > 70) & (ff < 1500)
idx = np.argmax(H * m, axis=1)
pc = np.round(69 + 12 * np.log2(np.maximum(ff[idx], 1) / 440)).astype(int) % 12
loud = S.sum(axis=1) > np.percentile(S.sum(axis=1), 15)
fps = SR / hop


def expected(part, steps):
    """Bölümün her adımının beklenen nota sınıfı (ana ses), None = sus."""
    xs = -4.25 + 8.5 * (np.arange(steps) + 0.5) / steps
    ys = {1: M.part1, 2: M.part2, 3: M.part3, 4: M.part4, 5: M.part5}[part](xs)[0]
    out = []
    for y in ys:
        out.append(None if np.isnan(y) else int(round(64 + 12 * y)) % 12)
    return out


def score(exp, start, dt):
    hit = tot = 0
    for i, e in enumerate(exp):
        if e is None:
            continue
        t = start + (i + 0.5) * dt
        j = int(t * fps)
        if j >= len(pc) or not loud[j]:
            continue
        tot += 1
        hit += pc[j] == e
    return hit / max(1, tot)


STEPS = {1: 64, 2: 128, 3: 128, 4: 64, 5: 64}
guess = 0.0
res = {}
for part in range(1, 6):
    exp = expected(part, STEPS[part])
    best = (0, 0, 0)
    for dt in np.linspace(0.19, 0.23, 81) * (64 / STEPS[part]):
        for start in np.arange(max(0, guess - 2), guess + 4, 0.01):
            s = score(exp, start, dt)
            if s > best[0]:
                best = (s, start, dt)
    s, start, dt = best
    res[part] = (round(start, 3), round(dt, 5))
    print(f"bölüm {part}: başlangıç {start:.2f} sn, adım {dt * 1000:.1f} ms, süre {dt * STEPS[part]:.2f} sn, eşleşme %{100 * s:.0f}")
    guess = start + dt * STEPS[part]
print('ZAMANLAMA =', res)
