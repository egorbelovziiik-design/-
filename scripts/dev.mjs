import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    ...opts,
  });
  return child;
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume();
          resolve();
        });
        req.on('error', reject);
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return false;
}

// 1) Compile electron main/preload
await new Promise((resolve, reject) => {
  const b = run(process.execPath, [path.join(root, 'scripts/build-electron.mjs')]);
  b.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('electron build failed'))));
});

// 2) Start vite
const vite = run(path.join(root, 'node_modules/.bin/vite'), ['--port', '5173'], {
  env: { ...process.env },
});

const ok = await waitForServer('http://127.0.0.1:5173');
if (!ok) {
  console.error('[dev] vite did not start');
  vite.kill();
  process.exit(1);
}

// 3) Start electron
const electronBin = path.join(root, 'node_modules/.bin/electron');
const electron = run(electronBin, ['.'], {
  env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' },
});

electron.on('exit', (code) => {
  vite.kill();
  process.exit(code ?? 0);
});
