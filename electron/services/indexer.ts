/**
 * Project indexer — background file index powering semantic-ish search and RAG.
 * Tokenizes project text files, builds an inverted index with TF-IDF scoring,
 * persists a cache keyed by file mtime, and supports incremental updates.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { JsonStore } from './store';
import { shouldIgnoreDir, isProbablyBinary } from './security';
import { getSettings } from './settings';

interface IndexDoc {
  file: string;
  mtime: number;
  size: number;
  tokens: Record<string, number>; // token -> tf
  excerpt: string;
}

interface IndexState {
  projectPath: string;
  docs: Record<string, IndexDoc>;
  builtAt: number;
}

const stores = new Map<string, JsonStore<IndexState>>();

function storeFor(projectPath: string): JsonStore<IndexState> {
  const key = path.resolve(projectPath);
  let s = stores.get(key);
  if (!s) {
    const safe = key.replace(/[^a-zA-Z0-9]/g, '_').slice(-80);
    s = new JsonStore<IndexState>(path.join(app.getPath('userData'), 'index', `${safe}.json`), {
      projectPath: key,
      docs: {},
      builtAt: 0,
    });
    stores.set(key, s);
  }
  return s;
}

const TOKEN_RE = /[A-Za-z_][A-Za-z0-9_]{2,}|[\u0400-\u04FF]{3,}/g;

function tokenize(text: string): Record<string, number> {
  const tf: Record<string, number> = {};
  const matches = text.toLowerCase().match(TOKEN_RE) ?? [];
  for (const m of matches) {
    tf[m] = (tf[m] ?? 0) + 1;
    // Split camelCase / snake_case parts for better recall
    const parts = m.split(/[_$]/);
    for (const p of parts) {
      const camel = p.match(/[a-z]+|[0-9]+/g) ?? [];
      for (const c of camel) {
        if (c.length >= 3) tf[c] = (tf[c] ?? 0) + 1;
      }
    }
  }
  return tf;
}

async function walk(projectPath: string, onFile: (full: string) => Promise<void>) {
  const settings = getSettings();
  const maxBytes = settings.performance.maxFileSizeKb * 1024;

  async function rec(dir: string, depth: number) {
    if (depth > 12) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!shouldIgnoreDir(e.name)) await rec(full, depth + 1);
      } else if (e.isFile()) {
        try {
          const st = await fs.stat(full);
          if (st.size > maxBytes) continue;
          await onFile(full);
        } catch {
          /* skip */
        }
      }
    }
  }
  await rec(projectPath, 0);
}

export async function rebuildIndex(projectPath: string, onProgress?: (msg: string) => void): Promise<{ files: number; skipped: number }> {
  const store = storeFor(projectPath);
  const state = store.get();
  const docs = state.docs;
  let files = 0;
  let skipped = 0;
  const settings = getSettings();

  await walk(projectPath, async (full) => {
    const key = full;
    try {
      const st = await fs.stat(full);
      const existing = docs[key];
      if (existing && Math.abs(existing.mtime - st.mtimeMs) < 1) {
        files++;
        return;
      }
      const buf = await fs.readFile(full);
      if (isProbablyBinary(buf)) {
        skipped++;
        return;
      }
      const text = buf.toString('utf-8');
      if (!settings.performance.indexLargeFiles && st.size > 256 * 1024) {
        skipped++;
        return;
      }
      docs[key] = {
        file: key,
        mtime: st.mtimeMs,
        size: st.size,
        tokens: tokenize(text),
        excerpt: text.slice(0, 400).replace(/\s+/g, ' '),
      };
      files++;
      if (files % 150 === 0) onProgress?.(`Indexed ${files} files...`);
    } catch {
      skipped++;
    }
  });

  // Drop docs for deleted files
  for (const key of Object.keys(docs)) {
    if (!fsSync.existsSync(key)) delete docs[key];
  }

  store.replace({ projectPath, docs, builtAt: Date.now() });
  return { files, skipped };
}

export interface IndexHit {
  file: string;
  score: number;
  excerpt: string;
  line?: number;
}

export function queryIndex(projectPath: string, query: string, limit = 12): IndexHit[] {
  const store = storeFor(projectPath);
  const { docs } = store.get();
  const qTokens = Object.keys(tokenize(query));
  if (!qTokens.length) return [];

  const N = Object.keys(docs).length || 1;
  const df: Record<string, number> = {};
  for (const t of qTokens) {
    for (const doc of Object.values(docs)) {
      if (doc.tokens[t]) df[t] = (df[t] ?? 0) + 1;
    }
  }

  const scored: IndexHit[] = [];
  for (const doc of Object.values(docs)) {
    let score = 0;
    for (const t of qTokens) {
      const tf = doc.tokens[t];
      if (!tf) continue;
      const idf = Math.log(1 + N / (1 + (df[t] ?? 0)));
      score += (1 + Math.log(tf)) * idf;
    }
    // Boost filename matches
    const lowerName = doc.file.toLowerCase();
    for (const t of qTokens) {
      if (lowerName.includes(t)) score *= 1.6;
    }
    if (score > 0) scored.push({ file: doc.file, score, excerpt: doc.excerpt });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export async function indexProjectQuick(projectPath: string): Promise<void> {
  // Fire-and-forget background rebuild after opening a project.
  setTimeout(() => {
    rebuildIndex(projectPath).catch((err) => console.warn('[index] rebuild failed', err));
  }, 500);
}
