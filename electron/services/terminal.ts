import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import type { WebContents } from 'electron';
import { assertPathSafe } from './security';

export interface PtyHandle {
  id: string;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  kind: 'pty' | 'pipe';
}

/* node-pty is loaded lazily so the IDE still runs if the native module is unavailable
   (then a robust pipe-based shell fallback is used). */
let ptyModule: typeof import('node-pty') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ptyModule = require('node-pty');
} catch (err) {
  console.warn('[terminal] node-pty unavailable, using pipe fallback:', (err as Error).message);
}

const sessions = new Map<string, PtyHandle>();

export function defaultShell(): string {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL ?? '/bin/bash';
}

export function createTerminal(
  id: string,
  cwd: string,
  webContents: WebContents,
  opts: { shell?: string; cols?: number; rows?: number; env?: Record<string, string> } = {},
): { ok: boolean; kind: 'pty' | 'pipe'; message?: string } {
  if (sessions.has(id)) {
    sessions.get(id)!.kill();
    sessions.delete(id);
  }

  let resolvedCwd = cwd;
  try {
    resolvedCwd = assertPathSafe(cwd, { mustExist: true });
  } catch {
    resolvedCwd = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
  }

  const shell = opts.shell || defaultShell();
  const cols = opts.cols ?? 120;
  const rows = opts.rows ?? 30;
  const env = { ...process.env, ...opts.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } as Record<string, string>;

  if (ptyModule) {
    try {
      const pty = ptyModule.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: resolvedCwd,
        env,
      });
      const handle: PtyHandle = {
        id,
        kind: 'pty',
        write: (data) => pty.write(data),
        resize: (c, r) => pty.resize(c, r),
        kill: () => {
          try {
            pty.kill();
          } catch {
            /* already dead */
          }
        },
      };
      pty.onData((data) => webContents.send('term:data', { id, data }));
      pty.onExit(({ exitCode }) => {
        webContents.send('term:exit', { id, exitCode });
        sessions.delete(id);
      });
      sessions.set(id, handle);
      return { ok: true, kind: 'pty' };
    } catch (err) {
      console.warn('[terminal] pty spawn failed:', (err as Error).message);
    }
  }

  // Pipe fallback — interactive-ish shell over stdio.
  const isWin = process.platform === 'win32';
  const child: ChildProcessWithoutNullStreams = spawn(shell, isWin ? ['-NoLogo'] : ['-i'], {
    cwd: resolvedCwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const decoder = new TextDecoder();
  child.stdout.on('data', (buf) => webContents.send('term:data', { id, data: decoder.decode(buf) }));
  child.stderr.on('data', (buf) => webContents.send('term:data', { id, data: decoder.decode(buf) }));
  child.on('exit', (code) => {
    webContents.send('term:exit', { id, exitCode: code ?? 0 });
    sessions.delete(id);
  });
  const handle: PtyHandle = {
    id,
    kind: 'pipe',
    write: (data) => {
      // Convert CRLF for cmd-style input on pipes
      child.stdin.write(data.replace(/\r/g, '\n'));
    },
    resize: () => undefined,
    kill: () => child.kill(),
  };
  sessions.set(id, handle);
  webContents.send('term:data', {
    id,
    data: '\r\n[WinCode AI] Terminal running in compatibility mode (pipe). Full PTY available after node-pty loads.\r\n',
  });
  return { ok: true, kind: 'pipe', message: 'pipe-fallback' };
}

export function writeTerminal(id: string, data: string) {
  sessions.get(id)?.write(data);
}

export function resizeTerminal(id: string, cols: number, rows: number) {
  sessions.get(id)?.resize(cols, rows);
}

export function killTerminal(id: string) {
  const s = sessions.get(id);
  if (s) {
    s.kill();
    sessions.delete(id);
  }
}

export function killAllTerminals() {
  for (const [, s] of sessions) s.kill();
  sessions.clear();
}
