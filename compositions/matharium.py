"""Matharium videosundaki şarkıyı, ekranda gösterilen formülleri ÖRNEK ÖRNEK hesaplayarak üretir.

Her bölüm x ∈ [−4.25, 4.25] aralığını bölüm süresi boyunca doğrusal tarar; her ses örneği için
formüllerden y(x) bulunur ve frekans f = 329.63 · 2^y Hz (y = 0 → E4; videonun sesiyle ölçülerek doğrulandı:
ilk notalar B3 A3 G#3 C#4). Notalar dev tamsayıların 8/16/32 tabanındaki rakamlarına gömülüdür.

Tını: videodan ölçülen harmonik genlikleri (1, .84, .49, .37, .18, .11, .07, .05) toplamalı sentezle.
Çalıştır: python compositions/matharium.py  →  exports/matharium_formul.wav
"""
import math
import os
import wave

import numpy as np

SR = 44100
TOTAL = 66.22                  # video süresi (sn)
# Her bölümün başlangıcı ve süresi videonun sesine nota dizisi oturtularak ölçüldü (tools/hizala.py):
# bölüm 1–2 %100, bölüm 3 %94, bölüm 5 %100 eşleşme; bölüm 4'te video bazı susmaları (d = 31) atlıyor.
TIMING = [(0.110, 64 * 0.21550), (14.052, 128 * 0.10825), (28.048, 128 * 0.09898), (40.512, 64 * 0.20300), (52.314, 64 * 0.19217)]
C = -0.33496                   # y ofseti: 2^C ≈ 4 yarım ton aşağı
F_REF = 329.63                 # y = 0 frekansı (E4)
HARM = [1, .84, .49, .37, .18, .11, .07, .05]
REST = None


def x_axis(dur):
    """Bölüm boyunca x, −4.25'ten 4.25'e doğrusal taranır."""
    t = np.arange(int(dur * SR)) / SR
    return -4.25 + 8.5 * t / dur


def digit(N, base, i):
    return (N // base ** i) % base


# ---------- bölüm 1 ----------
def part1(x):
    u = 64 * (x + 4.25) / 8.5
    n = np.floor(u).astype(int)
    T = [71, 70, 68, 73, 78, 76, REST, 76]
    y = np.full(len(x), np.nan)
    for i, nn in enumerate(n):
        N = 220480139724424 if u[i] < 32 else 119328291981064
        d = digit(N, 8, nn % 16)
        if d == 6:
            continue
        y[i] = C + (T[d] - 72 - (1 if nn % 4 == 1 else 0)) / 12
    return [y]


# ---------- bölüm 2 ----------
def part2(x):
    u = 128 * (x + 4.25) / 8.5
    n = np.floor(u).astype(int)
    y = np.full(len(x), np.nan)
    for i, nn in enumerate(n):
        k = nn // 4
        N = 39634348 if k < 24 else 576505260
        d = digit(N, 16, k % 8)
        r = nn % 4
        if r == 0:
            m = 80
        elif r == 1:
            m = 81
        elif r == 2:
            m = 83 if k < 16 else 78 + d
        else:
            m = 85 if k < 30 else 81
        y[i] = C + (m - 72) / 12
    return [y]


# ---------- bölüm 3: altı ses, [başlangıç, bitiş) aralıklarıyla ----------
P3 = {
    'm1': [(98, 0, 4), (96, 4, 6), (98, 6, 8), (95, 8, 12), (90, 12, 24), (84, 24, 26), (86, 26, 27), (84, 27, 28), (91, 28, 30), (93, 30, 31), (91, 31, 32)],
    'm2': [(76, 16, 20), (79, 20, 22), (83, 22, 24)],
    'm3': [(60, 0, 4), (60, 6, 8), (64, 12, 16), (64, 20, 22), (64, 24, 28), (64, 30, 31)],
    'm4': [(67, 0, 4), (67, 6, 10), (67, 11, 12), (71, 12, 16), (71, 20, 22), (71, 24, 28), (71, 30, 31)],
    'm5': [(72, 8, 10), (72, 11, 12)],
    'm6': [(84, 0, 12), (83, 12, 24)],
}


def part3(x):
    u = 128 * (x + 4.25) / 8.5
    p = np.mod(u, 32)
    out = []
    for segs in P3.values():
        y = np.full(len(x), np.nan)
        for m, a, b in segs:
            sel = (p >= a) & (p < b)
            y[sel] = C + (m - 72) / 12
        out.append(y)
    return out


# ---------- bölüm 4: perde kaymalı "pluck" ----------
def part4(x):
    u = 64 * (x + 4.25) / 8.5
    n = np.floor(u).astype(int)
    fr = u - n
    y = np.full(len(x), np.nan)
    for i, nn in enumerate(n):
        b = nn // 8
        N = {0: 252308832243, 2: 252308832243, 4: 252308832243, 1: 1080706072044, 3: 1080706072044, 5: 1080706072044, 6: 110944009779, 7: 4269093327}[min(b, 7)]
        d = digit(N, 32, nn % 8)
        if d == 31 or fr[i] >= 0.88:
            continue
        y[i] = C + (60 + d - 62 - 2.2 * math.exp(-12 * fr[i])) / 12
    return [y]


# ---------- bölüm 5: melodi + iki bas sesi ----------
def part5(x):
    u = 64 * (x + 4.25) / 8.5
    v = 32 * (x + 4.25) / 8.5
    w = np.mod(v, 8)
    y1 = np.full(len(x), np.nan)
    y2 = np.full(len(x), np.nan)
    y3 = np.full(len(x), np.nan)
    for i in range(len(x)):
        b = int(u[i] // 8)
        N = {0: 110771808652, 2: 110771808652, 4: 110771808652, 1: 169125, 3: 169125, 5: 169125, 6: 110771808519, 7: 460013606053}[min(b, 7)]
        d = digit(N, 32, int(math.floor(u[i])) % 8)
        if d != 31:
            y1[i] = C + (d + 8) / 12
        m2 = 68 if v[i] >= 30 else (58 if w[i] < 2 else 46 if w[i] < 4 else 59)
        m3 = 61 if v[i] >= 30 else (53 if w[i] < 4 else 54)
        y2[i] = C + (m2 - 62) / 12
        y3[i] = C + (m3 - 62) / 12
    return [y1, y2, y3]


# ---------- sentez: y(t) → ses ----------
def voice(y, gain=0.22):
    on = ~np.isnan(y)
    f = np.where(on, F_REF * np.power(2.0, np.nan_to_num(y)), 0.0)
    phase = 2 * np.pi * np.cumsum(f) / SR
    sig = sum(a * np.sin(h * phase) for h, a in enumerate(HARM, start=1)) / sum(HARM)
    # nota açılış/kapanışlarında 3 ms yumuşatma (tık sesini önler); aynı nota içinde kesinti yok
    env = on.astype(float)
    k = int(0.003 * SR)
    kern = np.ones(k) / k
    env = np.convolve(env, kern, mode='same')
    # perde sıçramalarında da (yeni nota) çok kısa bir yumuşatma
    jump = np.zeros(len(y), bool)
    jump[1:] = on[1:] & on[:-1] & (np.abs(np.diff(np.nan_to_num(y))) > 1 / 24)
    dip = np.ones(len(y))
    for j in np.where(jump)[0]:
        a, b = max(0, j - k // 2), min(len(y), j + k // 2)
        dip[a:b] = np.minimum(dip[a:b], np.abs(np.linspace(-1, 1, b - a)))
    return sig * env * dip * gain


def main():
    fns = [part1, part2, part3, part4, part5]
    gains = [[0.3], [0.3], [0.22, 0.2, 0.16, 0.16, 0.18, 0.16], [0.3], [0.26, 0.22, 0.2]]
    out = np.zeros(int(TOTAL * SR) + SR)
    for fn, gs, (start, dur) in zip(fns, gains, TIMING):
        x = x_axis(dur)
        mix = sum(voice(y, g) for y, g in zip(fn(x), gs))
        a = int(start * SR)
        out[a:a + len(mix)] += mix
    out = out[:int(TOTAL * SR)]
    out = out / np.abs(out).max() * 10 ** (-1 / 20)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(root, 'exports', 'matharium_formul.wav')
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes((out * 32767).astype(np.int16).tobytes())
    print(f"yazıldı: {path} ({len(out) / SR:.2f} sn)")


if __name__ == '__main__':
    main()
