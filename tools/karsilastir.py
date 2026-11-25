"""İki sesi bölüm bölüm karşılaştırır: tek sesli bölümlerde adım başına baskın nota eşleşmesi,
tüm bölümlerde adım başına kromagram (12 nota sınıfı) kosinüs benzerliği.
Kullanım: python tools/karsilastir.py <orijinal> <bizimki> [bölüm_sayısı=5]
"""
import subprocess
import sys

import numpy as np

SR = 22050
NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def frame(x, t0, t1):
    s = x[int(t0 * SR):int(t1 * SR)]
    n = 4096
    s = np.pad(s, (0, max(0, n - len(s))))[:n] * np.hanning(n)
    sp = np.abs(np.fft.rfft(s)) + 1e-12
    ff = np.fft.rfftfreq(n, 1 / SR)
    return sp, ff


def pitch(sp, ff):
    h = sp.copy()
    for k in (2, 3):
        h[:len(sp) // k] *= sp[::k][:len(sp) // k]
    m = (ff > 70) & (ff < 1500)
    f = ff[np.argmax(h * m)]
    return int(round(69 + 12 * np.log2(f / 440)))


def chroma(sp, ff):
    c = np.zeros(12)
    m = (ff > 60) & (ff < 3000)
    mid = np.round(69 + 12 * np.log2(ff[m] / 440)).astype(int) % 12
    np.add.at(c, mid, sp[m] ** 2)
    return c / (np.linalg.norm(c) + 1e-12)


def main():
    a, b = load(sys.argv[1]), load(sys.argv[2])
    parts = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    D = min(len(a), len(b)) / SR / parts
    steps = [64, 128, 128, 64, 64]
    for p in range(parts):
        st = steps[p] if p < len(steps) else 64
        dt = D / st
        same, tot, cs = 0, 0, []
        for n in range(st):
            t0 = p * D + n * dt + dt * 0.15
            t1 = t0 + dt * 0.6
            sa, fa = frame(a, t0, t1)
            sb, fb = frame(b, t0, t1)
            if sa.max() < 1e-3 and sb.max() < 1e-3:
                continue
            cs.append(float(chroma(sa, fa) @ chroma(sb, fb)))
            pa, pb = pitch(sa, fa), pitch(sb, fb)
            tot += 1
            same += pa % 12 == pb % 12
        print(f"bölüm {p + 1}: baskın nota sınıfı eşleşmesi %{100 * same / max(1, tot):.0f} ({same}/{tot}), kromagram benzerliği ort. {np.mean(cs):.2f}")


if __name__ == '__main__':
    main()
