# Kod Stüdyo for AI agents

Kod Stüdyo runs locally and needs no API keys. You can use it three ways: MCP, the CLI or HTTP. All three drive the same engine.

Every song you make is saved in `Documents/Kod Studyo/exports/ajan/` as two files:

- `<name>.kodstudyo.json`: the song
- `<name>.wav`: the rendered audio

When running from source, the folder is `kod-studyo/exports/ajan/`.

## Install

See the [README](README.md#for-ai-agents-install-and-connect). In short, run `scripts/install.ps1` on Windows or `scripts/install.sh` on macOS and Linux. The script installs the app and registers the MCP server with Claude Code.

## 1. MCP (recommended)

The installed app ships its own Node runtime, so no separate Node install is needed. Run it with `ELECTRON_RUN_AS_NODE=1`:

| | command | args |
|---|---|---|
| Windows | `%LOCALAPPDATA%\Programs\kod-studyo\kod-studyo.exe` | `%LOCALAPPDATA%\Programs\kod-studyo\resources\app\bin\kod-studyo.mjs`, `mcp` |
| macOS | `/Applications/kod-studyo.app/Contents/MacOS/kod-studyo` | `/Applications/kod-studyo.app/Contents/Resources/app/bin/kod-studyo.mjs`, `mcp` |
| From source | `node` | `/path/to/kod-studyo/bin/kod-studyo.mjs`, `mcp` |

Set the environment variable `ELECTRON_RUN_AS_NODE=1` for the Windows and macOS rows. The app can also copy this setup for you: open **Ajan → Yapay zekâ ajanı bağla (MCP)** in the app menu.

Claude Desktop / Cursor (`mcpServers` config), macOS example:

```json
{
  "mcpServers": {
    "kod-studyo": {
      "command": "/Applications/kod-studyo.app/Contents/MacOS/kod-studyo",
      "args": ["/Applications/kod-studyo.app/Contents/Resources/app/bin/kod-studyo.mjs", "mcp"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

**If the app is closed,** the first tool call starts it in the background: a tray icon appears and no window opens.

**If the app is open,** the agent uses it, and `open_in_studio` shows the song in the user's window.

**From source,** renders run in a headless Chrome, Edge or Chromium. Set `KOD_STUDYO_BROWSER` to point at a specific browser binary.

### Tools

| Tool | What it does |
|---|---|
| `studio_status` | Shows whether the studio is up, whether the render worker and user window are connected, and where files are saved. |
| `list_genres` | Lists style ids for `generate_song.genre`, e.g. `brazilian_phonk`, `drift_phonk`, `rj_type`, `trap`, `lofi`, `ambient`, `arabesk`. |
| `list_instruments` | Lists instrument presets for `generate_song.instruments` (guitar types, bağlama, 808, strings…) and the base instruments you can use in song JSON. |
| `song_format` | Describes the song JSON format. |
| `generate_song` | Composes a full song and saves and renders it. See below. |
| `get_song` | Returns the full JSON of a saved song (`file`) or a bundled one (`library`). |
| `render_song` | Renders edited or hand-written song JSON to WAV. Takes `song`, `file` or `library`. |
| `list_songs` | Lists bundled and saved songs. |
| `list_formula_presets` | Lists songs written as math formulas (primes, π, φ, Collatz…). |
| `render_formula` | Renders a formula preset or your own formula song. |
| `open_in_studio` | Opens a song in the user's studio window. |

`generate_song` takes:

- `prompt`: free text in English or Turkish, e.g. `"dark brazilian phonk 130 bpm heavy 808"`
- `genre`, `seed`, `bpm`, `root`, `scale`
- `mood`: `dark` or `bright`
- `length`: from 1 (short) to 5 (long)
- `instruments`, `vocals`, `name`
- `render`: set to `false` to only write the JSON
- `open_in_studio`

The same `seed` gives the same song.

A typical loop:

1. Call `generate_song` with a prompt and a seed.
2. Call `get_song` with the returned `file`.
3. Edit the notes, instruments or mix.
4. Call `render_song` to render it again.
5. Call `open_in_studio` so the user can listen and keep editing by hand.

### Song JSON in brief

- A pattern is 2 bars = 32 steps of 16th notes.
- `patterns.P1[trackId]` is a list of events `{s, n, l, v, g?, r?}`:
  - `s` (0–31): step
  - `n`: MIDI note (use 60 for drums)
  - `l`: length in steps
  - `v` (0–1): velocity
  - `g`: glide from the previous note
  - `r` (2–4): ratchet
- `arrangement` lists `{name, pattern, reps}`.
- `master` holds `low`/`high` (dB), `drive`, `glue`, `makeup`, `ceiling`.
- Call `song_format` for the full description.

### Formula songs

A formula song is `{timbre, gap, sections: [{name, duration, defs, voices: [{name, gain, timbre, expr}]}]}`.

- `defs`: JavaScript evaluated per sample, with `t` (seconds), `x` (−4.25…4.25 across the section) and `D` (section length) available.
- `expr`: returns a pitch `y` in octaves, where `midi(m)` converts a MIDI note, `y = 0` is E4 and `REST` means silence. It can also return `[y, amplitude]` for plucked or percussive sounds.
- Helpers: `floor mod frac exp sin digit(N, base, i) seg(...) note(m) midi(m)`.
- Timbres: `sine square saw triangle matharium ep noise`.

## 2. CLI

```bash
node bin/kod-studyo.mjs generate "calm lofi with piano" --seed 3 --length 2
node bin/kod-studyo.mjs render exports/ajan/song.kodstudyo.json --open
node bin/kod-studyo.mjs formula altin
node bin/kod-studyo.mjs help
```

Output is JSON, and the `wav` field holds the file path. With only the installed app, use its runtime instead of `node`: `ELECTRON_RUN_AS_NODE=1 <app executable> <app>/resources/app/bin/kod-studyo.mjs ...`.

## 3. HTTP

While the app or `node server.mjs` is running, `GET http://localhost:4209/api/agent` describes the API.

```bash
curl -X POST localhost:4209/api/agent/generate -d '{"genre":"lofi","seed":5,"length":1}'
```

| Endpoint | Body |
|---|---|
| `POST /api/agent/generate` | `{prompt, genre, seed, bpm, root, scale, mood, length, instruments, vocals, name, render, open}` |
| `POST /api/agent/render` | `{song \| file \| library, name, open}` |
| `POST /api/agent/formula` | `{preset \| song, name}` |
| `POST /api/agent/open` | `{song \| file \| library}` |

`GET` endpoints: `/api/agent/genres`, `/api/agent/instruments`, `/api/agent/formulas`, `/api/agent/library`, `/api/agent/song?file=…`, `/api/agent/format`.

## How it works

- **Composing** happens in Node (`public/js/generator.js`, `public/js/recipe.js`).
- **Rendering** needs Web Audio. The server queues render jobs for a render worker (`public/worker.html`), which turns the song into a WAV and posts it back. The worker runs in a hidden window of the desktop app, or in a headless Chrome/Edge in source mode.
- **Formula songs** render directly in Node.
- **The user's studio window** polls `/api/ui/inbox`, so songs an agent opens appear there.
