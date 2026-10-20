import fs from 'node:fs';
import path from 'node:path';

/**
 * Lightweight atomic JSON document store.
 * Used for settings, project memory, recent projects, plugins and the index cache.
 * Writes are atomic (tmp file + rename) so a crash never corrupts user data.
 */
export class JsonStore<T extends object> {
  private filePath: string;
  private cache: T;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath: string, defaults: T) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        this.cache = { ...defaults, ...(JSON.parse(raw) as T) };
      } catch {
        this.cache = { ...defaults };
      }
    } else {
      this.cache = { ...defaults };
      this.flushSync();
    }
  }

  get(): T {
    return this.cache;
  }

  update(patch: Partial<T> | ((current: T) => T)): T {
    this.cache = typeof patch === 'function' ? patch(this.cache) : { ...this.cache, ...patch };
    this.scheduleFlush();
    return this.cache;
  }

  replace(next: T): T {
    this.cache = next;
    this.scheduleFlush();
    return this.cache;
  }

  private scheduleFlush() {
    this.writeQueue = this.writeQueue.then(() => this.flushSync()).catch(() => undefined);
  }

  async flush(): Promise<void> {
    await this.writeQueue;
    this.flushSync();
  }

  private flushSync() {
    try {
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.cache, null, 2), 'utf-8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error('[JsonStore] write failed', this.filePath, err);
    }
  }
}

export function projectMemoryPath(userData: string, projectPath: string) {
  const safe = projectPath.replace(/[^a-zA-Z0-9]/g, '_').slice(-80);
  return path.join(userData, 'memory', `${safe}.json`);
}
