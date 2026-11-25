// Electron olmadan (node server.mjs) çalışırken render işçisi: sistemdeki Chrome/Edge/Chromium'u
// başsız (headless) açıp /worker.html'e yönlendirir. Windows'ta Edge her zaman vardır.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function candidates() {
  const env = process.env.KOD_STUDYO_BROWSER ? [process.env.KOD_STUDYO_BROWSER] : [];
  if (process.platform === 'win32') {
    const pf = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return [...env, ...pf.flatMap((d) => [
      path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(d, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(d, 'Chromium', 'Application', 'chrome.exe'),
      path.join(d, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    ])];
  }
  if (process.platform === 'darwin') {
    return [...env, ...['Google Chrome', 'Microsoft Edge', 'Chromium', 'Brave Browser'].map((n) => `/Applications/${n}.app/Contents/MacOS/${n}`)];
  }
  return [...env, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium'];
}

export function findBrowser() {
  return candidates().find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}

export function launchHeadlessWorker(baseUrl) {
  const exe = findBrowser();
  if (!exe) throw new Error('Render için Chrome, Edge ya da Chromium bulunamadı. Birini kurun, KOD_STUDYO_BROWSER ile yolunu verin ya da masaüstü uygulamasını kullanın.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kod-studyo-worker-'));
  const child = spawn(exe, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--user-data-dir=${profile}`, `${baseUrl}/worker.html`,
  ], { stdio: 'ignore', detached: false });
  child.on('exit', () => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* yok say */ } });
  return child;
}

export function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
}
