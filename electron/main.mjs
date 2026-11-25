// Kod Stüdyo masaüstü uygulaması (Windows / macOS / Linux).
// Normal açılış: yerel sunucuyu başlatır, stüdyo penceresini açar; render işleri gizli bir pencerede yapılır.
// "--background": pencere açmadan yalnızca sunucu + render işçisi (MCP/CLI ajanları gerektiğinde böyle başlatır);
//   sistem tepsisinden açılıp kapatılabilir.
// Ajanlar için MCP/CLI, uygulamanın içindeki Node ile çalışır (ELECTRON_RUN_AS_NODE=1, bin/kod-studyo.mjs);
// Electron ana sürecinde Windows'ta stdin okunamadığı için MCP burada çalıştırılmaz.

import { app, BrowserWindow, Menu, Tray, nativeImage, shell, dialog, clipboard } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { startServer } from '../server.mjs';
import { findServer, PORTS } from '../lib/client.mjs';

const BACKGROUND = process.argv.includes('--background');
const DATA = process.env.KOD_STUDYO_DATA || path.join(app.getPath('documents'), 'Kod Studyo');
const log = (m) => process.stderr.write(String(m) + '\n');

app.setName('Kod Stüdyo');
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let base = null;          // çalışan sunucunun adresi
let ownServer = false;    // sunucu bu süreçte mi
let mainWin = null, workerWin = null, tray = null;

function ensureWorker() {
  if (workerWin && !workerWin.isDestroyed()) return;
  workerWin = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } });
  workerWin.webContents.setAudioMuted(true);
  workerWin.loadURL(base + '/worker.html');
  workerWin.on('closed', () => { workerWin = null; });
}

function openUi() {
  if (mainWin && !mainWin.isDestroyed()) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.focus(); return; }
  mainWin = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 600, backgroundColor: '#12110f', autoHideMenuBar: true,
    title: 'Kod Stüdyo', icon: path.join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: { backgroundThrottling: false },
  });
  mainWin.loadURL(base + '/');
  // dış bağlantılar sistem tarayıcısında açılsın
  mainWin.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith(base)) { shell.openExternal(url); return { action: 'deny' }; } return { action: 'allow' }; });
  mainWin.on('closed', () => { mainWin = null; });
}

async function ensureBase() {
  if (base) return base;
  base = await findServer();
  if (base) return base;
  for (const port of [...PORTS, 0]) {
    try {
      ({ url: base } = await startServer({ port, dataDir: DATA, log, hooks: { ensureWorker, openUi } }));
      ownServer = true;
      return base;
    } catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  }
  throw new Error('sunucu başlatılamadı');
}

// Ajan kurulum bilgisi: MCP istemcilerine (Claude Code, Claude Desktop, Cursor…) yazılacak komut
function mcpCommand() {
  return { command: process.execPath, args: [path.join(app.getAppPath(), 'bin', 'kod-studyo.mjs'), 'mcp'], env: { ELECTRON_RUN_AS_NODE: '1' } };
}
function showAgentSetup() {
  const c = mcpCommand();
  const cfg = JSON.stringify({ mcpServers: { 'kod-studyo': c } }, null, 2);
  const cli = `claude mcp add kod-studyo -s user -e ELECTRON_RUN_AS_NODE=1 -- "${c.command}" ${c.args.map((a) => `"${a}"`).join(' ')}`;
  const r = dialog.showMessageBoxSync(mainWin, {
    type: 'info', title: 'Yapay zekâ ajanı bağla',
    message: 'Kod Stüdyo bir MCP sunucusu olarak ajanlara açılabilir.',
    detail: `Claude Code:\n${cli}\n\nClaude Desktop / Cursor (mcpServers yapılandırması):\n${cfg}\n\nHTTP API (uygulama açıkken): ${base}/api/agent`,
    buttons: ['Claude Code komutunu kopyala', 'JSON yapılandırmasını kopyala', 'Kapat'], defaultId: 0, cancelId: 2,
  });
  if (r === 0) clipboard.writeText(cli);
  if (r === 1) clipboard.writeText(cfg);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'Dosya', submenu: [
      { label: 'Kayıt klasörünü aç', click: () => { const d = path.join(DATA, 'exports'); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); } },
      { type: 'separator' },
      isMac ? { role: 'close', label: 'Kapat' } : { role: 'quit', label: 'Çıkış' },
    ] },
    { label: 'Düzen', submenu: [{ role: 'undo', label: 'Geri al' }, { role: 'redo', label: 'Yinele' }, { type: 'separator' }, { role: 'cut', label: 'Kes' }, { role: 'copy', label: 'Kopyala' }, { role: 'paste', label: 'Yapıştır' }, { role: 'selectAll', label: 'Tümünü seç' }] },
    { label: 'Görünüm', submenu: [{ role: 'reload', label: 'Yenile' }, { role: 'toggleDevTools', label: 'Geliştirici araçları' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen', label: 'Tam ekran' }] },
    { label: 'Ajan', submenu: [
      { label: 'Yapay zekâ ajanı bağla (MCP)…', click: showAgentSetup },
      { label: 'API belgesi', click: () => shell.openExternal(base + '/api/agent') },
    ] },
  ]));
}

function buildTray() {
  const img = nativeImage.createFromPath(path.join(app.getAppPath(), 'build', 'icon.png')).resize({ width: 18, height: 18 });
  tray = new Tray(img);
  tray.setToolTip('Kod Stüdyo');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Stüdyoyu aç', click: openUi },
    { label: 'Yapay zekâ ajanı bağla (MCP)…', click: showAgentSetup },
    { label: 'Kayıt klasörü', click: () => { const d = path.join(DATA, 'exports'); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); } },
    { type: 'separator' },
    { label: "Kod Stüdyo'dan çık", click: () => app.exit(0) },
  ]));
  tray.on('click', openUi);
}

app.on('second-instance', (_e, argv) => { if (!argv.includes('--background')) openUi(); });
app.on('window-all-closed', () => {
  // arka planda (ajanlar için) başlatıldıysa pencere kapansa da tepside çalışmaya devam et
  if (BACKGROUND || process.platform === 'darwin') return;
  app.quit();
});
app.on('activate', () => { if (base) openUi(); });

app.whenReady().then(async () => {
  if (!gotLock) return;
  try {
    await ensureBase();
    buildMenu();
    if (BACKGROUND) {
      if (process.platform === 'darwin' && app.dock) app.dock.hide();
      buildTray();
    } else openUi();
    if (ownServer) ensureWorker();
  } catch (e) {
    log(e.stack || e.message);
    dialog.showErrorBox('Kod Stüdyo başlatılamadı', e.message);
    app.exit(1);
  }
});
