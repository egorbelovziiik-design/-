import fs from 'node:fs/promises';
import path from 'node:path';
import { pluginsDir } from './settings';
import { JsonStore } from './store';
import type { PluginManifest } from '../shared/types';

/**
 * Plugin system. Plugins are sandboxed extension packages (a folder with
 * wincode-plugin.json + optional JS entry). They can contribute themes,
 * snippets, templates, AI prompts and tool commands. Plugin code never gets
 * direct Node access — it runs in the renderer sandbox through a manifest API.
 */
interface PluginState {
  plugins: PluginManifest[];
}

let store: JsonStore<PluginState> | null = null;
function pluginStore(): JsonStore<PluginState> {
  if (!store) store = new JsonStore<PluginState>(path.join(pluginsDir(), 'installed.json'), { plugins: [] });
  return store;
}

export async function listPlugins(): Promise<PluginManifest[]> {
  return pluginStore().get().plugins;
}

export async function installPlugin(sourceDir: string): Promise<PluginManifest> {
  const manifestPath = path.join(sourceDir, 'wincode-plugin.json');
  const raw = await fs.readFile(manifestPath, 'utf-8').catch(() => {
    throw new Error('Not a WinCode plugin: wincode-plugin.json not found');
  });
  const manifest = JSON.parse(raw) as PluginManifest;
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error('Invalid plugin manifest: id, name and version are required');
  }

  const target = path.join(pluginsDir(), manifest.id);
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(sourceDir, target, { recursive: true });

  const installed: PluginManifest = { ...manifest, enabled: true, installedAt: Date.now() };
  const s = pluginStore();
  const plugins = [...s.get().plugins.filter((p) => p.id !== manifest.id), installed];
  s.replace({ plugins });
  return installed;
}

export async function togglePlugin(id: string, enabled: boolean): Promise<PluginManifest[]> {
  const s = pluginStore();
  const plugins = s.get().plugins.map((p) => (p.id === id ? { ...p, enabled } : p));
  s.replace({ plugins });
  return plugins;
}

export async function uninstallPlugin(id: string): Promise<PluginManifest[]> {
  const s = pluginStore();
  const plugins = s.get().plugins.filter((p) => p.id !== id);
  s.replace({ plugins });
  await fs.rm(path.join(pluginsDir(), id), { recursive: true, force: true });
  return plugins;
}

/** Built-in extension pack shown in the manager as preinstalled (always available). */
export const BUILTIN_EXTENSIONS = [
  {
    id: 'lang-java-plus',
    name: 'Java+ Language Pack',
    version: '1.0.0',
    description: 'Java & Kotlin snippets, Minecraft mappings helpers, Gradle task templates.',
    author: 'WinCode AI',
    kind: 'language' as const,
    main: 'builtin',
    enabled: true,
    installedAt: 0,
  },
  {
    id: 'theme-pack',
    name: 'Premium Theme Pack',
    version: '1.0.0',
    description: 'Aurora Dark, Midnight, Dracula, Synthwave, Solarized, Light — built-in themes.',
    author: 'WinCode AI',
    kind: 'theme' as const,
    main: 'builtin',
    enabled: true,
    installedAt: 0,
  },
  {
    id: 'minecraft-toolkit',
    name: 'Minecraft Dev Toolkit',
    version: '1.0.0',
    description: 'Fabric/Forge/NeoForge project wizard, version compatibility matrix, ClickGUI & HUD generators.',
    author: 'WinCode AI',
    kind: 'minecraft' as const,
    main: 'builtin',
    enabled: true,
    installedAt: 0,
  },
  {
    id: 'ai-providers',
    name: 'Universal AI Providers',
    version: '1.0.0',
    description: 'OpenAI, Claude, Gemini, OpenRouter, Ollama, LM Studio, custom OpenAI-compatible endpoints.',
    author: 'WinCode AI',
    kind: 'ai' as const,
    main: 'builtin',
    enabled: true,
    installedAt: 0,
  },
];
