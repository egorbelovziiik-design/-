import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { shell } from 'electron';
import { assertPathSafe, shouldIgnoreDir, isProbablyBinary, allowRoot } from './security';
import type { FileNode } from '../shared/types';

const MAX_READ_BYTES = 8 * 1024 * 1024;

export async function listDirectory(dirPath: string): Promise<FileNode[]> {
  const resolved = assertPathSafe(dirPath, { mustExist: true });
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const full = path.join(resolved, entry.name);
    let size = 0;
    let mtime = 0;
    try {
      const st = await fs.stat(full);
      size = st.size;
      mtime = st.mtimeMs;
    } catch {
      continue;
    }
    nodes.push({
      name: entry.name,
      path: full,
      isDir: entry.isDirectory(),
      size,
      mtime,
      loaded: false,
    });
  }
  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return nodes;
}

export async function readFileText(filePath: string): Promise<{ content: string; language: string; truncated: boolean }> {
  const resolved = assertPathSafe(filePath, { mustExist: true });
  const stat = await fs.stat(resolved);
  if (stat.isDirectory()) throw new Error('Cannot open a directory as a file');
  const buf = await fs.readFile(resolved);
  if (isProbablyBinary(buf)) {
    return { content: `// [WinCode AI] Binary file (${stat.size} bytes) — preview not available.\n`, language: 'plaintext', truncated: true };
  }
  const truncated = buf.length > MAX_READ_BYTES;
  const content = truncated ? buf.subarray(0, MAX_READ_BYTES).toString('utf-8') : buf.toString('utf-8');
  return { content, language: detectLanguage(resolved), truncated };
}

export async function writeFileText(filePath: string, content: string): Promise<void> {
  const resolved = assertPathSafe(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const tmp = resolved + '.wc-tmp';
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, resolved);
}

export async function createNode(target: string, kind: 'file' | 'dir', content = ''): Promise<void> {
  const resolved = assertPathSafe(target);
  if (fsSync.existsSync(resolved)) throw new Error('Already exists: ' + target);
  if (kind === 'dir') {
    await fs.mkdir(resolved, { recursive: true });
  } else {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
  }
}

export async function renameNode(from: string, to: string): Promise<void> {
  const src = assertPathSafe(from, { mustExist: true });
  const dst = assertPathSafe(to);
  if (fsSync.existsSync(dst)) throw new Error('Target already exists: ' + to);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.rename(src, dst);
}

export async function deleteNode(target: string): Promise<void> {
  const resolved = assertPathSafe(target, { mustExist: true });
  // Use OS recycle bin — a safe delete that can be undone by the user.
  const result = await shell.trashItem(resolved).catch((err: Error) => err);
  if (result instanceof Error) {
    throw new Error('Delete failed: ' + result.message);
  }
}

export async function copyNode(from: string, to: string): Promise<void> {
  const src = assertPathSafe(from, { mustExist: true });
  const dst = assertPathSafe(to);
  await fs.cp(src, dst, { recursive: true, force: false, errorOnExist: true });
}

export interface SearchHit {
  file: string;
  line: number;
  column: number;
  text: string;
  preview: string;
}

export async function searchInFiles(rootPath: string, query: string, opts: { regex?: boolean; caseSensitive?: boolean; maxResults?: number } = {}): Promise<SearchHit[]> {
  const root = assertPathSafe(rootPath, { mustExist: true });
  const maxResults = opts.maxResults ?? 800;
  const hits: SearchHit[] = [];
  if (!query) return hits;

  let matcher: RegExp;
  try {
    matcher = opts.regex
      ? new RegExp(query, opts.caseSensitive ? 'g' : 'gi')
      : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), opts.caseSensitive ? 'g' : 'gi');
  } catch (err) {
    throw new Error('Invalid regular expression: ' + (err as Error).message);
  }

  async function walk(dir: string) {
    if (hits.length >= maxResults) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (hits.length >= maxResults) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldIgnoreDir(entry.name)) await walk(full);
        continue;
      }
      try {
        const st = await fs.stat(full);
        if (st.size > 1024 * 1024) continue;
        const buf = await fs.readFile(full);
        if (isProbablyBinary(buf)) continue;
        const lines = buf.toString('utf-8').split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          matcher.lastIndex = 0;
          const m = matcher.exec(lines[i]);
          if (m) {
            hits.push({
              file: full,
              line: i + 1,
              column: m.index + 1,
              text: m[0],
              preview: lines[i].slice(0, 300),
            });
            if (hits.length >= maxResults) return;
          }
        }
      } catch {
        /* skip */
      }
    }
  }

  await walk(root);
  return hits;
}

export function revealInOs(target: string) {
  const resolved = assertPathSafe(target, { mustExist: true });
  shell.showItemInFolder(resolved);
}

export function registerProjectRoot(root: string) {
  allowRoot(root);
}

const LANG_BY_EXT: Record<string, string> = {
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.py': 'python',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.json': 'json',
  '.xml': 'xml',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.md': 'markdown',
  '.gradle': 'groovy',
  '.properties': 'ini',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rs': 'rust',
  '.go': 'go',
  '.sh': 'shell',
  '.bat': 'bat',
  '.ps1': 'powershell',
  '.sql': 'sql',
  '.toml': 'ini',
  '.lock': 'plaintext',
  '.txt': 'plaintext',
  '.log': 'plaintext',
  '.glsl': 'plaintext',
  '.fsh': 'plaintext',
  '.vsh': 'plaintext',
  '.gitignore': 'plaintext',
};

export function detectLanguage(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';
  const ext = path.extname(base);
  return LANG_BY_EXT[ext] ?? 'plaintext';
}
