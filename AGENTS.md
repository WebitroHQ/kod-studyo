# Kod Stüdyo: yapay zekâ ajanları için

Kod Stüdyo yerel çalışır ve API anahtarı istemez. Ajanlar üç yoldan bağlanabilir. Üçü de aynı motoru kullanır:

1. MCP
2. Komut satırı
3. HTTP

Ajanın ürettiği şarkılar `Belgeler/Kod Studyo/exports/ajan/` klasörüne kaydedilir:

- `<ad>.kodstudyo.json`: şarkının JSON'u
- `<ad>.wav`: render edilmiş ses

Kaynaktan çalışırken bu klasör `kod-studyo/exports/ajan/` olur.

## 1. MCP (önerilen)

### Masaüstü uygulaması kuruluysa

Komut, uygulamanın kendi içindeki Node'u kullanır (`ELECTRON_RUN_AS_NODE=1`). Bu yüzden ayrıca Node kurmak gerekmez.

En kolay yol, uygulamadaki **Ajan → Yapay zekâ ajanı bağla (MCP)** menüsü. Doğru yolları içeren komutu panoya kopyalar.

Komutu elle yazmak istersen:

**Windows, Claude Code:**

```bash
claude mcp add kod-studyo -s user -e ELECTRON_RUN_AS_NODE=1 -- "%LOCALAPPDATA%\Programs\Kod Studyo\kod-studyo.exe" "%LOCALAPPDATA%\Programs\Kod Studyo\resources\app\bin\kod-studyo.mjs" mcp
```

**macOS, Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "kod-studyo": {
      "command": "/Applications/Kod Studyo.app/Contents/MacOS/kod-studyo",
      "args": ["/Applications/Kod Studyo.app/Contents/Resources/app/bin/kod-studyo.mjs", "mcp"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

Uygulama kapalıyken bir araç çağrılırsa uygulama arka planda pencere açmadan başlar ve sistem tepsisinde görünür. Uygulama açıksa ajan onun sunucusunu kullanır. Bu durumda `open_in_studio` şarkıyı kullanıcının açık penceresine gönderir.

### Kaynaktan (Node 20+)

```bash
claude mcp add kod-studyo -- node /yol/kod-studyo/bin/kod-studyo.mjs mcp
```

Bu modda render için sistemdeki Chrome, Edge ya da Chromium başsız (headless) çalıştırılır.

### Araçlar

| Araç | Ne yapar |
|---|---|
| `studio_status` | Stüdyonun durumunu ve kayıt klasörünü gösterir. |
| `list_genres` | Tarzları listeler (ör. `brazilian_phonk`, `rj_type`, `lofi`, `arabesk`, `ambient`…). |
| `list_instruments` | Enstrüman ön ayarlarını listeler: gitar türleri, bağlama, 808, yaylılar… |
| `song_format` | Şarkı JSON biçimini açıklar. |
| `generate_song` | Yazıdan ya da seçeneklerden şarkı üretir, kaydeder ve WAV'a render eder. |
| `get_song` | Bir şarkının JSON'unu döndürür. |
| `render_song` | Düzenlenmiş ya da elle yazılmış JSON'u WAV'a render eder. |
| `list_songs` | Hazır ve kayıtlı şarkıları listeler. |
| `list_formula_presets` | Formül şarkısı ön ayarlarını listeler. |
| `render_formula` | Matematik formülleriyle yazılmış şarkıyı render eder. |
| `open_in_studio` | Şarkıyı kullanıcının stüdyo penceresinde açar. |

Tipik bir akış:

1. `generate_song` ile `{prompt: "sakin lofi, piyano", seed: 3}` gibi bir şarkı üret.
2. `get_song` ile dönen `file`'ı oku.
3. Notaları ya da mikseri düzenle.
4. `render_song` ile tekrar render et.
5. `open_in_studio` ile kullanıcıya göster.

Aynı `seed` aynı şarkıyı üretir.

## 2. Komut satırı

```bash
node bin/kod-studyo.mjs generate "karanlık phonk 130 bpm ağır 808" --seed 7 --length 2
node bin/kod-studyo.mjs render exports/ajan/sarki.kodstudyo.json --open
node bin/kod-studyo.mjs formula altin
node bin/kod-studyo.mjs help
```

Çıktı JSON'dur. Oluşan dosyanın yolu `wav` alanındadır.

Uygulama kuruluysa Node yerine uygulamanın kendi Node'u da kullanılabilir. Uygulama klasöründe:

```bash
ELECTRON_RUN_AS_NODE=1 ./kod-studyo resources/app/bin/kod-studyo.mjs ...
```

## 3. HTTP

Uygulama ya da `node server.mjs` açıkken API `http://localhost:4209/api/agent` adresinde çalışır. Bu adres uçların listesini döndürür.

```bash
curl -X POST localhost:4209/api/agent/generate -d '{"genre":"lofi","seed":5,"length":1}'
```

| Uç | İstek |
|---|---|
| `POST /api/agent/generate` | `{prompt, genre, seed, bpm, root, scale, mood, length, instruments, vocals, name, render, open}` |
| `POST /api/agent/render` | `{song \| file \| library, name, open}` |
| `POST /api/agent/formula` | `{preset \| song, name}` |
| `POST /api/agent/open` | `{song \| file \| library}` |
| `GET` uçları | `/api/agent/genres`, `/api/agent/instruments`, `/api/agent/formulas`, `/api/agent/library`, `/api/agent/song?file=…`, `/api/agent/format` |

## Nasıl çalışır

- **Besteleme Node'da yapılır.** Kural tabanlı besteci (`public/js/generator.js`, `recipe.js`) çalışır.
- **Render tarayıcı motorunda yapılır.** Ses motoru Web Audio kullanır. Sunucu render işini bir kuyruğa koyar. İşi bir "render işçisi" alır, WAV'a çevirir ve geri yollar.
  - İşçi, uygulamada gizli bir pencerede çalışır (`public/worker.html`).
  - Node modunda işçi başsız Chrome/Edge'dir.
- **Formül şarkıları doğrudan Node'da render edilir.**
- **Kullanıcının penceresi gelen kutusunu dinler.** Pencere `/api/ui/inbox`'u yoklar. Ajan `open` dediğinde şarkı ekrana gelir, kullanıcı elle düzenlemeye devam eder.
