import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

/**
 * Security layer for all filesystem IPC.
 * - Only absolute paths are accepted.
 * - Paths must resolve inside one of the "allowed roots" (opened project folders),
 *   inside the app userData dir, or be a root explicitly approved by the user via dialog.
 * - Sensitive system locations are always blocked.
 */

const allowedRoots = new Set<string>();

const BLOCKED_PREFIXES = [
  path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32'),
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/boot',
  '/sys',
  '/proc',
];

export function allowRoot(root: string) {
  const resolved = path.resolve(root);
  allowedRoots.add(normalizeKey(resolved));
}

export function disallowRoot(root: string) {
  allowedRoots.delete(normalizeKey(root));
}

export function allowedRootsList(): string[] {
  return [...allowedRoots];
}

function normalizeKey(p: string): string {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function isPathSafe(input: string, opts: { mustExist?: boolean } = {}): { ok: boolean; resolved?: string; reason?: string } {
  if (!input || typeof input !== 'string') return { ok: false, reason: 'Empty path' };
  if (!path.isAbsolute(input)) return { ok: false, reason: 'Path must be absolute' };

  const resolved = path.resolve(input);

  for (const blocked of BLOCKED_PREFIXES) {
    const b = normalizeKey(blocked);
    if (normalizeKey(resolved) === b || normalizeKey(resolved).startsWith(b + path.sep)) {
      return { ok: false, reason: `Blocked system path: ${blocked}` };
    }
  }

  // Never allow writes/reads to our own binary internals
  if (normalizeKey(resolved).startsWith(normalizeKey(app.getAppPath()))) {
    return { ok: true, resolved };
  }

  const key = normalizeKey(resolved);
  const inAllowed = [...allowedRoots].some((root) => key === root || key.startsWith(root + path.sep));
  const inUserData = key === normalizeKey(app.getPath('userData')) || key.startsWith(normalizeKey(app.getPath('userData')) + path.sep);

  if (!inAllowed && !inUserData) {
    return { ok: false, reason: 'Path is outside of opened projects' };
  }

  if (opts.mustExist && !fs.existsSync(resolved)) {
    return { ok: false, reason: 'Path does not exist' };
  }

  return { ok: true, resolved };
}

export function assertPathSafe(input: string, opts: { mustExist?: boolean } = {}): string {
  const res = isPathSafe(input, opts);
  if (!res.ok || !res.resolved) throw new Error(res.reason ?? 'Unsafe path');
  return res.resolved;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.gradle',
  'build',
  'out',
  'dist',
  'target',
  '.idea',
  '.vscode',
  '.venv',
  '__pycache__',
  '.next',
  '.nuxt',
  'coverage',
  '.mypy_cache',
  '.pytest_cache',
  'release',
]);

export function shouldIgnoreDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

export function isProbablyBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}
