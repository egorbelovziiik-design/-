import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { assertPathSafe } from './security';
import type { GitStatusEntry } from '../shared/types';

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[], opts: { input?: string; timeoutMs?: number } = {}): Promise<string> {
  const resolved = assertPathSafe(cwd, { mustExist: true });
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: resolved,
      maxBuffer: 32 * 1024 * 1024,
      timeout: opts.timeoutMs ?? 60000,
      windowsHide: true,
    });
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    throw new Error(e.stderr?.trim() || e.message);
  }
}

export async function isRepo(cwd: string): Promise<boolean> {
  try {
    const out = await git(cwd, ['rev-parse', '--is-inside-work-tree']);
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

export async function gitStatus(cwd: string): Promise<{ entries: GitStatusEntry[]; branch: string; ahead: number; behind: number }> {
  const branch = (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => 'HEAD')).trim();
  let ahead = 0;
  let behind = 0;
  try {
    const counts = (await git(cwd, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])).trim().split(/\s+/);
    behind = Number(counts[0]) || 0;
    ahead = Number(counts[1]) || 0;
  } catch {
    /* no upstream */
  }
  const porcelain = await git(cwd, ['status', '--porcelain=v1', '-uall']);
  const entries: GitStatusEntry[] = [];
  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue;
    const index = line[0] ?? ' ';
    const working = line[1] ?? ' ';
    let file = line.slice(3).trim();
    if (file.includes(' -> ')) file = file.split(' -> ').pop()!;
    entries.push({
      path: file,
      index,
      working,
      staged: index !== ' ' && index !== '?',
      conflicted: index === 'U' || working === 'U',
    });
  }
  return { entries, branch, ahead, behind };
}

export async function gitDiff(cwd: string, file?: string, staged = false): Promise<string> {
  const args = ['diff'];
  if (staged) args.push('--cached');
  if (file) args.push('--', file);
  return git(cwd, args);
}

export async function gitLog(cwd: string, count = 50): Promise<{ hash: string; author: string; date: string; subject: string }[]> {
  const out = await git(cwd, ['log', `-${count}`, '--pretty=format:%H%x1f%an%x1f%ad%x1f%s', '--date=short']);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, author, date, subject] = line.split('\x1f');
      return { hash: hash ?? '', author: author ?? '', date: date ?? '', subject: subject ?? '' };
    });
}

export async function gitCommit(cwd: string, message: string, amend = false): Promise<string> {
  if (!message.trim()) throw new Error('Commit message is empty');
  const args = ['commit', '-m', message];
  if (amend) args.push('--amend');
  return git(cwd, args);
}

export async function gitPush(cwd: string, setOrigin = true): Promise<string> {
  const branch = (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  return git(cwd, setOrigin ? ['push', '-u', 'origin', branch] : ['push'], { timeoutMs: 180000 });
}

export async function gitPull(cwd: string): Promise<string> {
  return git(cwd, ['pull', '--rebase=false'], { timeoutMs: 180000 });
}

export async function gitBranches(cwd: string): Promise<{ name: string; current: boolean; remote: boolean }[]> {
  const out = await git(cwd, ['branch', '-a', '--no-color']);
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const current = l.startsWith('*');
      const name = l.replace(/^\*?\s+/, '').replace(/^remotes\//, '');
      return { name, current, remote: l.includes('remotes/') };
    });
}

export async function gitCheckout(cwd: string, branch: string): Promise<string> {
  return git(cwd, ['checkout', branch]);
}

export async function gitCreateBranch(cwd: string, branch: string): Promise<string> {
  return git(cwd, ['checkout', '-b', branch]);
}

export async function gitStage(cwd: string, files: string[]): Promise<void> {
  await git(cwd, ['add', '--', ...files]);
}

export async function gitUnstage(cwd: string, files: string[]): Promise<void> {
  await git(cwd, ['reset', 'HEAD', '--', ...files]);
}

export async function gitDiscard(cwd: string, file: string): Promise<void> {
  const resolved = assertPathSafe(path.resolve(cwd, file), { mustExist: true });
  // restore from index if tracked, otherwise reject (untracked needs explicit delete)
  try {
    await git(cwd, ['checkout', '--', file]);
  } catch {
    throw new Error('File is untracked — delete it instead of discarding.');
  }
  void resolved;
}

export async function gitInit(cwd: string): Promise<string> {
  return git(cwd, ['init']);
}

export async function gitClone(url: string, targetDir: string): Promise<string> {
  if (!/^https?:\/\/|^git@|^ssh:\/\//.test(url)) throw new Error('Unsupported repository URL');
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  return git(path.dirname(targetDir), ['clone', url, targetDir], { timeoutMs: 600000 });
}
