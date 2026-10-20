import { app, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { JsonStore } from './store';
import type { WinCodeSettings, AIProviderConfig } from '../shared/types';
import { PROVIDER_CATALOG, presetToConfig } from '../shared/providers-catalog';

export const DEFAULT_SETTINGS: WinCodeSettings = {
  appearance: {
    theme: 'aurora-dark',
    accentColor: '#9333EA',
    uiFont: '"Segoe UI", Inter, system-ui, sans-serif',
    editorFont: '"Cascadia Code", Consolas, "JetBrains Mono", monospace',
    editorFontSize: 14,
    editorLigatures: true,
    minimap: true,
    smoothAnimations: true,
    statusBarVisible: true,
  },
  editor: {
    tabSize: 4,
    insertSpaces: true,
    wordWrap: 'off',
    autoSave: 'afterDelay',
    autoSaveDelayMs: 1200,
    formatOnSave: false,
    lineNumbers: 'on',
    bracketPairs: true,
    stickyScroll: true,
  },
  ai: {
    activeProviderId: 'openai',
    providers: PROVIDER_CATALOG.map(presetToConfig),
    inlineCompletion: true,
    inlineCompletionDelayMs: 400,
    agentAutoApproveSafe: true,
    temperature: 0.4,
    maxContextFiles: 24,
  },
  minecraft: {
    defaultMinecraftVersion: '1.21.4',
    defaultLoader: 'fabric',
    defaultJavaVersion: '21',
    gradleJvmArgs: '-Xmx4G',
  },
  terminal: {
    shellWindows: 'powershell.exe',
    shellLinux: '/bin/bash',
    fontSize: 13,
    scrollback: 8000,
  },
  git: {
    userName: '',
    userEmail: '',
    autoFetch: false,
  },
  performance: {
    indexLargeFiles: false,
    maxFileSizeKb: 512,
    lazyTree: true,
  },
  privacy: {
    sendCodeToAI: true,
    anonymousStats: false,
  },
  keybindings: {
    'file.save': 'Ctrl+S',
    'file.saveAll': 'Ctrl+K S',
    'file.quickOpen': 'Ctrl+P',
    'command.palette': 'Ctrl+Shift+P',
    'terminal.toggle': 'Ctrl+`',
    'ai.toggle': 'Ctrl+Shift+A',
    'ai.inline': 'Ctrl+Space',
    'search.toggle': 'Ctrl+Shift+F',
    'build.run': 'F5',
    'build.debug': 'F6',
    'build.build': 'Ctrl+Shift+B',
    'view.explorer': 'Ctrl+Shift+E',
    'view.git': 'Ctrl+Shift+G',
    'editor.split': 'Ctrl+\\',
    'settings.open': 'Ctrl+,',
  },
};

let store: JsonStore<WinCodeSettings> | null = null;

/**
 * Migration: when new provider presets appear in the catalog, add them to the
 * user's existing settings without touching configured providers/keys.
 */
function mergeProviderPresets(s: JsonStore<WinCodeSettings>): void {
  const cur = s.get();
  const known = new Set(cur.ai.providers.map((p) => p.id));
  const missing = PROVIDER_CATALOG.filter((p) => !known.has(p.id));
  if (missing.length === 0) return;
  cur.ai.providers = [...cur.ai.providers, ...missing.map(presetToConfig)];
  s.replace(cur);
}

export function settingsStore(): JsonStore<WinCodeSettings> {
  if (!store) {
    store = new JsonStore<WinCodeSettings>(path.join(app.getPath('userData'), 'settings.json'), DEFAULT_SETTINGS);
    mergeProviderPresets(store);
  }
  return store;
}

export function getSettings(): WinCodeSettings {
  return settingsStore().get();
}

export function setSettings(patch: Partial<WinCodeSettings>): WinCodeSettings {
  const s = settingsStore();
  const current = s.get();
  const merged: WinCodeSettings = { ...current, ...patch };

  // Never let a renderer-side patch erase encrypted provider secrets:
  // merge providers by id, preserving apiKeyEnc/hasApiKey from the current store.
  if (patch.ai?.providers) {
    const prevById = new Map(current.ai.providers.map((p) => [p.id, p]));
    merged.ai = {
      ...current.ai,
      ...patch.ai,
      providers: patch.ai.providers.map((p) => {
        const prev = prevById.get(p.id);
        return {
          ...p,
          apiKeyEnc: prev?.apiKeyEnc,
          hasApiKey: Boolean(prev?.apiKeyEnc),
        };
      }),
    };
  }

  return s.replace(merged);
}

export function resetSettings(): WinCodeSettings {
  return settingsStore().replace(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
}

/* ---------- API key encryption ---------- */

export function encryptKey(plain: string): string {
  if (!plain) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return 'sec:' + safeStorage.encryptString(plain).toString('base64');
    }
  } catch {
    /* fall through */
  }
  return 'b64:' + Buffer.from(plain, 'utf-8').toString('base64');
}

export function decryptKey(stored: string | undefined): string {
  if (!stored) return '';
  try {
    if (stored.startsWith('sec:')) {
      return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'));
    }
    if (stored.startsWith('b64:')) {
      return Buffer.from(stored.slice(4), 'base64').toString('utf-8');
    }
  } catch {
    return '';
  }
  return '';
}

export function setProviderApiKey(providerId: string, apiKey: string): WinCodeSettings {
  const s = settingsStore();
  const next = s.get();
  next.ai.providers = next.ai.providers.map((p) =>
    p.id === providerId
      ? { ...p, apiKeyEnc: apiKey ? encryptKey(apiKey) : undefined, hasApiKey: Boolean(apiKey) }
      : p,
  );
  return s.replace(next);
}

export function updateProvider(providerId: string, patch: Partial<AIProviderConfig>): WinCodeSettings {
  const s = settingsStore();
  const next = s.get();
  next.ai.providers = next.ai.providers.map((p) => (p.id === providerId ? { ...p, ...patch, id: p.id } : p));
  return s.replace(next);
}

export function addProvider(provider: AIProviderConfig): WinCodeSettings {
  const s = settingsStore();
  const next = s.get();
  if (next.ai.providers.some((p) => p.id === provider.id)) return next;
  next.ai.providers.push(provider);
  return s.replace(next);
}

export function removeProvider(providerId: string): WinCodeSettings {
  const s = settingsStore();
  const next = s.get();
  next.ai.providers = next.ai.providers.filter((p) => p.id !== providerId);
  return s.replace(next);
}

export function getProviderWithSecret(providerId: string): { provider: AIProviderConfig; apiKey: string } | null {
  const s = getSettings();
  const provider = s.ai.providers.find((p) => p.id === providerId) ?? s.ai.providers[0];
  if (!provider) return null;
  return { provider, apiKey: decryptKey(provider.apiKeyEnc) };
}

/* ---------- Recent projects ---------- */

interface RecentStore {
  projects: { path: string; name: string; openedAt: number }[];
}

let recentStore: JsonStore<RecentStore> | null = null;
export function recentProjectsStore(): JsonStore<RecentStore> {
  if (!recentStore) {
    recentStore = new JsonStore<RecentStore>(path.join(app.getPath('userData'), 'recent.json'), { projects: [] });
  }
  return recentStore;
}

export function pushRecentProject(projectPath: string) {
  const s = recentProjectsStore();
  const name = path.basename(projectPath);
  const projects = [
    { path: projectPath, name, openedAt: Date.now() },
    ...s.get().projects.filter((p) => p.path !== projectPath),
  ].slice(0, 24);
  s.replace({ projects });
}

export function userDataDir(): string {
  return app.getPath('userData');
}

export function pluginsDir(): string {
  const dir = path.join(app.getPath('userData'), 'plugins');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
