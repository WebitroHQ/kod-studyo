# Kod Stüdyo

Kodla müzik yapan, FL Studio'nun sade hali bir tarayıcı stüdyosu. Bütün sesler Web Audio ile sentezlenir;
hazır sample yoktur. AI olmadan tam şarkı üretir, kullanıcı her şeyi elle düzenler, istenirse AI (Claude /
ElevenLabs) devreye girer.

## Kurulum

**Masaüstü uygulaması (önerilen):**

- **Windows:** `KodStudyo-<sürüm>-Setup.exe` dosyasını çalıştır. Uygulama imzasız olduğu için SmartScreen
  "Bilinmeyen yayımcı" diyebilir: "Ek bilgi → Yine de çalıştır".
- **macOS:** `KodStudyo-<sürüm>-arm64.dmg` (Apple Silicon) ya da `-x64.dmg` (Intel). İmzasız uygulama ilk açılışta
  engellenirse Uygulamalar'da sağ tık → Aç; olmazsa Terminal'de `xattr -cr /Applications/kod-studyo.app`.

Şarkılar ve WAV'lar `Belgeler/Kod Studyo/exports/` altına kaydedilir (menü: Dosya → Kayıt klasörünü aç).
API anahtarları isteğe bağlıdır: ⚙ ayarlarından ya da `Belgeler/Kod Studyo/.env` dosyasından.

**Kaynaktan (Node 20+):**

```bash
npm install
npm run app      # masaüstü uygulaması (Electron)
npm start        # yalnızca sunucu: http://localhost:4209 (tarayıcıda aç)
```

**Paketleri derlemek:** `npm run dist:win` (Windows'ta) → `dist/KodStudyo-*-Setup.exe`;
`npm run dist:mac` yalnızca macOS'ta çalışır. İkisi birden: GitHub Actions'ta `build` iş akışı
(`.github/workflows/build.yml`, elle ya da `v*` etiketiyle) Windows ve macOS paketlerini üretir.

## Yapay zekâ ajanları

Ajanlar (Claude Code, Claude Desktop, Cursor…) stüdyoyu kullanıcıyla aynı motorla kullanır: şarkı üretir,
JSON'unu düzenler, WAV'a render eder ve kullanıcının stüdyo penceresinde açar. Ayrıntı: [AGENTS.md](AGENTS.md).
Kurulum komutu uygulamada hazır: **Ajan → Yapay zekâ ajanı bağla (MCP)** (kopyala-yapıştır).

AI anahtarları isteğe bağlıdır: arayüzdeki ⚙ ayarlarından ya da `.env` dosyasından (`.env.example`'a bakın).

## Neler var

- **Şarkı iste (Suno modu):** tek kutuya yaz, ElevenLabs Music vokalli ya da enstrümantal tam şarkı üretsin.
  Tarz şablonu seçince o tarzın tipik enstrümanları otomatik işaretlenir, yazdığın enstrümanlar
  (akustik, keman, bağlama…) algılanır. "Önce planla" ücretsizdir: bölümleri ve sözleri görüp düzenleyebilirsin.
  Üretilenler `exports/sarkilar/` klasörüne kaydedilir ve "Stüdyoya ekle" ile sampler kanalı olur.
  Aynı istek "Kod motoruyla yap" ile AI'sız olarak stüdyoda da üretilir.
- **Enstrümantasyon bilgi tabanı** (`public/js/instrumentation.js`): tarz → tipik enstrümanlar, kelime → enstrüman, hazır kanal preset'leri.

- **Kendi motoru (AI'sız):** 20 tarz profili (Rock, Akustik pop, Arabesk/Türk pop dahil); 25 enstrüman (elektro gitar preset'leri, akustik, bas gitar, bağlama, yaylılar, org, brass, flüt…); Brazilian / Drift / Memphis Phonk ve RJ Pasin tarzı (gitar + glitch)
  öne çıkarılmış; Trap, Drill, Boom Bap, Lo-fi, House, Techno, DnB, Synthwave, Hyperpop, Ambient, Reggaeton,
  Afrobeats, Pop. Seed ile tekrarlanabilir üretim; kanal başına 🎲 ile tek parçayı yeniden üretme.
- **Yazarak isteme:** "karanlık brazilian phonk 130 bpm, ağır 808, vokalsiz" → anahtarsız çözücü veya Claude.
- **Stüdyo:** aranjman (bölüm/desen/tekrar), kanal rafı (step sequencer, roll/ratchet), ölçeğe kilitli piyano
  rulosu (glide), enstrüman parametreleri, mikser (pan, reverb, delay, sidechain duck), master zinciri
  (EQ, saturasyon, glue, limiter) ve hedef loudness'a göre **Oto-Master**.
- **Vokal:** kodla formant sentezli vokal chop; sözlü vokal / efekt / müzik parçası için ElevenLabs (sampler kanalına düşer).
- **Dışa aktarma:** WAV, proje JSON (kaydet/aç), geri al (Ctrl+Z), Boşluk = çal/durdur.

Ayrıntılı plan ve yol haritası: [PLAN.md](PLAN.md).

## Gerçek enstrüman kitleri

`node tools/vsco-indir.mjs` [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) (CC0) içinden
upright piyano, keman/çello seksiyonu, arp ve flütü indirir, MP3'e çevirir ve `public/kits/<kit>/kit.json`
olarak hazırlar. Upright piyano kaydı Simon Dalzell (Ivy Audio) / Versilian Studios'a aittir; atıf teşvik ediliyor.
Stüdyoda "Kayıtlı Enstrüman (kit)" kanalı bu kitleri çalar; seviyeler yüklenirken otomatik normalize edilir.

## Araçlar

- `python tools/analiz.py exports/sarki.wav` — frekans bantları, dinamik, stereo ve bas mono uyumu teşhisi
- `node tools/kit-uret.mjs phonk` — ElevenLabs (ücretsiz plan) TTS ile vokal nidası kiti
- `node compositions/uzun-sakin.mjs [seed] [--gercek]` — kendini tekrar etmeyen uzun sakin parça

## Formül sekmesi

Matematiksel ifadelerden şarkı: her bölüm x ∈ [−4.25, 4.25] aralığını süresi boyunca tarar, ses ifadeleri y döndürür
(y = 0 → E4, y = 1 bir oktav yukarı; `REST` = sus). Ses örnek örnek hesaplanır, grafik videodaki gibi çizilir.
Yardımcılar: `floor mod frac exp digit(N, taban, i) seg(p, [[nota, a, b], …]) note(m) midi(m)`.
Hazır: matharium videosundaki 5 bölüm (`compositions/matharium.py` ile aynı formüller), pentatonik merdiven, Eno döngüleri.

