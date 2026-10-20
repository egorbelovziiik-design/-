import path from 'node:path';
import { app } from 'electron';
import { JsonStore, projectMemoryPath } from './store';
import type { ProjectMemory } from '../shared/types';

const caches = new Map<string, JsonStore<ProjectMemory>>();

function defaults(projectPath: string): ProjectMemory {
  return {
    projectPath,
    architecture: '',
    keyClasses: [],
    dependencies: [],
    changeHistory: [],
    errorHistory: [],
    userPreferences: [],
    notes: '',
    updatedAt: Date.now(),
  };
}

function storeFor(projectPath: string): JsonStore<ProjectMemory> {
  const key = path.resolve(projectPath);
  let s = caches.get(key);
  if (!s) {
    s = new JsonStore<ProjectMemory>(projectMemoryPath(app.getPath('userData'), key), defaults(key));
    caches.set(key, s);
  }
  return s;
}

export async function loadMemory(projectPath: string): Promise<ProjectMemory> {
  return storeFor(projectPath).get();
}

export async function saveMemory(projectPath: string, mem: ProjectMemory): Promise<ProjectMemory> {
  mem.updatedAt = Date.now();
  return storeFor(projectPath).replace(mem);
}

export async function appendMemory(projectPath: string, patch: Partial<ProjectMemory> & { changeHistory?: string[] }): Promise<ProjectMemory> {
  const s = storeFor(projectPath);
  const cur = s.get();
  const next: ProjectMemory = {
    ...cur,
    ...patch,
    changeHistory: [...cur.changeHistory, ...(patch.changeHistory ?? [])].slice(-200),
    errorHistory: [...cur.errorHistory, ...(patch.errorHistory ?? [])].slice(-200),
    updatedAt: Date.now(),
  };
  return s.replace(next);
}

export async function recordBuildError(projectPath: string, message: string): Promise<void> {
  await appendMemory(projectPath, {
    errorHistory: [`${new Date().toISOString()} ${message.slice(0, 500)}`],
  });
}
