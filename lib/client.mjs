// Kod Stüdyo HTTP istemcisi: çalışan bir stüdyo bulur (masaüstü uygulaması ya da node server.mjs),
// yoksa sunucuyu bu süreç içinde başlatır. CLI ve MCP sunucusu bunu kullanır.

export const PORTS = [4209, 4210, 4211, 4212, 4213];

export async function findServer(ports = PORTS) {
  for (const p of ports) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/api/status`, { signal: AbortSignal.timeout(800) });
      const d = await r.json();
      if (d.app === 'kod-studyo') return `http://127.0.0.1:${p}`;
    } catch { /* bu portta yok */ }
  }
  return null;
}

// Node modunda sunucuyu içeride başlat; render işçisi gerektiğinde başsız Chrome/Edge açılır.
export async function startLocalServer({ log = (m) => process.stderr.write(m + '\n'), dataDir } = {}) {
  const { startServer } = await import('../server.mjs');
  const { launchHeadlessWorker, openBrowser } = await import('./headless.mjs');
  let worker = null, url = '';
  const ensureWorker = () => { if (!worker || worker.exitCode != null) worker = launchHeadlessWorker(url); };
  for (const port of [...PORTS, 0]) {
    try {
      ({ url } = await startServer({ port, dataDir, log, hooks: { ensureWorker, openUi: () => openBrowser(url) } }));
      break;
    } catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  }
  const cleanup = () => { if (worker) try { worker.kill(); } catch { /* yok say */ } };
  process.on('exit', cleanup);
  return url;
}

// Masaüstü uygulamasının içindeki Node ile çalışıyorsak (ELECTRON_RUN_AS_NODE): uygulamayı arka planda
// (pencere açmadan, sistem tepsisinde) başlat; render işçisi uygulamanın gizli penceresidir.
async function startDesktopBackground() {
  const { spawn } = await import('node:child_process');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(process.execPath, [appRoot, '--background'], { detached: true, stdio: 'ignore', env }).unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((ok) => setTimeout(ok, 500));
    const url = await findServer();
    if (url) return url;
  }
  throw new Error('Kod Stüdyo uygulaması başlatılamadı (30 sn içinde yanıt yok)');
}

export async function ensureServer(opts = {}) {
  const found = await findServer();
  if (found) return found;
  if (process.versions.electron && process.env.ELECTRON_RUN_AS_NODE) return startDesktopBackground();
  return startLocalServer(opts);
}

export async function api(base, method, path, body) {
  const r = await fetch(base + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error((data && data.error) || `HTTP ${r.status}`);
  return data;
}
