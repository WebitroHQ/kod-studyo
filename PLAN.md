# Kod Stüdyo — plan

Tarayıcıda çalışan, FL Studio'nun sadeleştirilmiş hali olan bir müzik stüdyosu.
Bütün sesler **kodla sentezlenir** (hazır sample paketi yok). Üç yoldan müzik çıkar:

1. **Kendi üretimi (AI'sız):** tarz profili + kural motoru + seed → tam şarkı. İnternet ve anahtar gerekmez.
2. **Kullanıcı:** step sequencer, piyano rulosu, mikser, master. Üretilen her şey elle düzenlenebilir.
3. **AI (opsiyonel):** API anahtarı girilirse Claude şarkıyı nota nota besteler veya mevcut şarkıyı
   ("drop'u sertleştir") düzenler; ElevenLabs ile ses örneği / vokal / müzik parçası üretilip sampler kanalına düşer.

AI ve kullanıcı aynı veri modelini kullanır: AI'nın yazdığı şarkı da kullanıcının elle düzenleyebildiği şarkıdır.
Hiçbir yol diğerine bağımlı değil.

## Araştırma özeti

- **Kodla müzik:** Web Audio API (osilatör, filtre, WaveShaper, Convolver, Compressor, OfflineAudioContext)
  tam bir synth + mikser + master zinciri kurmaya ve WAV dışa aktarmaya yetiyor. Strudel / Tone.js bu alanın
  bilinen örnekleri; biz bağımlılıksız kendi motorumuzu yazıyoruz (ofline render ve tam kontrol için).
- **Brazilian phonk / funk automotivo:** ~125–135 BPM, ölçeğe göre akort edilmiş ve distorsiyonlu **808 cowbell
  melodisi**, cowbell'i takip eden distorsiyonlu 808 bas, senkoplu tamborzão kökenli davul, sidechain, sert master.
- **Drift / Memphis phonk:** 808 cowbell + bell melodileri, glide'lı 808, hi-hat rolls, vokal chop, lo-fi doku.
- **RJ Pasin:** New York'lu prodüktör/gitarist. Gitar merkezli, glitch/stutter düzenlemeli, kısa ve döngüsel
  parçalar; hyperpop'tan djent'e uzanan tarz. Bizdeki "RJ tarzı" profil bundan esinlenir: distorsiyonlu
  Karplus-Strong gitar riffi + kesik (ratchet) düzenlemeler + trap/hyperpop davul.
- **Vokal:** Kodla formant sentezi (a/e/i/o/u) ile pitch'li "vocal chop" yapılabilir. Sözlü vokal için
  TTS/şarkı gerekir → ElevenLabs anahtarıyla opsiyonel.
- **Müzik AI API'leri:** ElevenLabs Music / Sound Effects / TTS doğrudan ses üretir; Claude ise yapılandırılmış
  JSON ile notaları besteler (düzenlenebilir kalır). Lisans koşulları ticari kullanımda kontrol edilmeli.

## Mimari

```
kod-studyo/
  server.mjs          statik sunucu (port 4209) + /api/ai/* proxy (anahtarlar sunucuda veya istekte)
  public/
    index.html, style.css
    js/theory.js      nota, ölçek, akor yardımcıları, seed'li RNG
    js/instruments.js 17 sentez enstrüman (kick, 808, cowbell, gitar, formant vokal, sampler...)
    js/engine.js      zamanlayıcı, kanal grafı, sidechain, reverb/delay, master zinciri, offline render
    js/genres.js      tarz profilleri (veri) — yeni tarz = yeni profil
    js/generator.js   kural motoru: davul, bas, akor, melodi, riff, vokal chop, aranjman
    js/prompt.js      AI'sız komut çözücü ("karanlık brazilian phonk 130") → üretici ayarları
    js/ai.js          Claude / ElevenLabs istemcisi
    js/wav.js         WAV kodlayıcı
    js/app.js         arayüz
```

### Veri modeli (şarkı JSON)
`bpm, swing, root, scale, tracks[], patterns{id: {trackId: events[]}}, arrangement[{name, pattern, reps}], master{}`
Olay: `{s: adım(0–31), n: midi, v: hız, l: uzunluk, g: glide, r: ratchet}`. Desen = 2 ölçü × 16'lık.

### Tarzlar
Öne çıkanlar: Brazilian Phonk, Drift Phonk, Memphis Phonk, RJ Tarzı (gitar/glitch).
Ayrıca: Trap, Drill, Boom Bap, Lo-fi, House, Techno, Drum & Bass, Reggaeton, Afrobeats,
Synthwave, Hyperpop, Ambient, Pop.

### Master ("oto master")
EQ (low/high shelf) → saturasyon → glue kompresör → makeup → limiter. Tarza göre preset.
Oto-master: şarkıyı ofline render edip RMS ölçer, hedef loudness'a göre makeup kazancını ayarlar.

## Yol haritası

- **Faz 1 (şimdi):** motor, enstrümanlar, tüm tarz profilleri, kural üretici, step sequencer, piyano rulosu,
  mikser, master + oto-master, aranjman, WAV dışa aktarma, JSON kaydet/yükle, AI'sız komut çözücü,
  Claude ile besteleme/düzenleme, ElevenLabs ile sample/vokal üretimi.
- **Faz 2:** kanal başına efekt rafı, otomasyon, stem dışa aktarma, MIDI dışa aktarma, kullanıcı sample'ı sürükle-bırak.
- **Faz 3:** masaüstü paketleme (Electron/Tauri), preset paylaşımı, GitHub'da açık kaynak yayın.
