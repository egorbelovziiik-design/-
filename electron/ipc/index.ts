import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { IPC } from '../shared/types';
import type { AIProviderConfig, AgentMode, TemplateVars, WinCodeSettings, ProjectMemory } from '../shared/types';
import * as files from '../services/files';
import * as git from '../services/git';
import * as terminal from '../services/terminal';
import * as build from '../services/build';
import * as memory from '../services/memory';
import * as indexer from '../services/indexer';
import * as plugins from '../services/plugins';
import { streamChat, testProvider, chatOnce, type ProviderAuth } from '../services/ai/providers';
import { runAgent, respondPermission, stopAgent, inlineComplete, analyzeError } from '../services/ai/agent';
import {
  getSettings,
  setSettings,
  resetSettings,
  setProviderApiKey,
  updateProvider,
  addProvider,
  removeProvider,
  getProviderWithSecret,
  pushRecentProject,
  recentProjectsStore,
} from '../services/settings';
import { generateTemplate, TEMPLATES, MC_VERSIONS } from '../services/templates';
import { allowRoot, allowedRootsList, disallowRoot } from '../services/security';

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function authFor(providerId?: string): ProviderAuth {
  const settings = getSettings();
  const id = providerId || settings.ai.activeProviderId;
  const found = getProviderWithSecret(id);
  if (!found) throw new Error('AI provider not configured: ' + id);
  return found;
}

export function registerIpc() {
  /* ---------------- App / window ---------------- */
  ipcMain.handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    node: process.versions.node,
    userData: app.getPath('userData'),
    allowedRoots: allowedRootsList(),
  }));

  ipcMain.handle(IPC.windowMinimize, (e) => senderWindow(e)?.minimize());
  ipcMain.handle(IPC.windowMaximize, (e) => {
    const win = senderWindow(e);
    if (!win) return false;
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }
    win.maximize();
    return true;
  });
  ipcMain.handle(IPC.windowClose, (e) => senderWindow(e)?.close());
  ipcMain.handle(IPC.windowIsMaximized, (e) => senderWindow(e)?.isMaximized() ?? false);

  ipcMain.handle(IPC.pickFolder, async (e) => {
    const res = await dialog.showOpenDialog(senderWindow(e)!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Open folder',
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const folder = res.filePaths[0];
    allowRoot(folder);
    pushRecentProject(folder);
    void indexer.indexProjectQuick(folder);
    return folder;
  });

  ipcMain.handle(IPC.pickFile, async (e, filters?: { name: string; extensions: string[] }[]) => {
    const res = await dialog.showOpenDialog(senderWindow(e)!, {
      properties: ['openFile'],
      filters: filters?.length ? filters : [{ name: 'All files', extensions: ['*'] }],
    });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle(IPC.pickSaveFile, async (e, defaultName?: string) => {
    const res = await dialog.showSaveDialog(senderWindow(e)!, { defaultPath: defaultName });
    return res.canceled ? null : res.filePath;
  });

  ipcMain.handle(IPC.showMessage, async (e, opts: { type?: string; title: string; message: string; buttons?: string[] }) => {
    const res = await dialog.showMessageBox(senderWindow(e)!, {
      type: (opts.type as 'info' | 'warning' | 'error' | 'question') ?? 'info',
      title: opts.title,
      message: opts.message,
      buttons: opts.buttons ?? ['OK'],
    });
    return res.response;
  });

  /* ---------------- Files ---------------- */
  ipcMain.handle(IPC.listDir, (_e, dirPath: string) => files.listDirectory(dirPath));
  ipcMain.handle(IPC.readFile, (_e, filePath: string) => files.readFileText(filePath));
  ipcMain.handle(IPC.writeFile, (_e, filePath: string, content: string) => files.writeFileText(filePath, content));
  ipcMain.handle(IPC.createNode, (_e, target: string, kind: 'file' | 'dir', content?: string) =>
    files.createNode(target, kind, content ?? ''),
  );
  ipcMain.handle(IPC.renameNode, (_e, from: string, to: string) => files.renameNode(from, to));
  ipcMain.handle(IPC.deleteNode, (_e, target: string) => files.deleteNode(target));
  ipcMain.handle(IPC.copyNode, (_e, from: string, to: string) => files.copyNode(from, to));
  ipcMain.handle(IPC.searchFiles, (_e, root: string, query: string, opts: unknown) =>
    files.searchInFiles(root, query, (opts as Record<string, unknown>) ?? {}),
  );
  ipcMain.handle(IPC.revealInOs, (_e, target: string) => files.revealInOs(target));

  /* ---------------- Projects ---------------- */
  ipcMain.handle(IPC.openProject, async (_e, folder: string) => {
    if (!fs.existsSync(folder)) throw new Error('Folder does not exist: ' + folder);
    allowRoot(folder);
    pushRecentProject(folder);
    void indexer.indexProjectQuick(folder);
    return { ok: true, root: folder };
  });

  ipcMain.handle(IPC.recentProjects, () => recentProjectsStore().get().projects);

  ipcMain.handle(IPC.detectProject, (_e, root: string) => {
    const p = (f: string) => path.join(root, f);
    const kind: string[] = [];
    if (fs.existsSync(p('build.gradle')) || fs.existsSync(p('build.gradle.kts'))) kind.push('gradle');
    if (fs.existsSync(p('pom.xml'))) kind.push('maven');
    if (fs.existsSync(p('package.json'))) kind.push('npm');
    if (fs.existsSync(p('src/main/resources/fabric.mod.json'))) kind.push('fabric');
    if (fs.existsSync(p('src/main/resources/META-INF/mods.toml'))) kind.push('forge');
    if (fs.existsSync(p('src/main/resources/META-INF/neoforge.mods.toml'))) kind.push('neoforge');
    if (fs.existsSync(p('CMakeLists.txt'))) kind.push('cmake');
    if (fs.existsSync(p('Cargo.toml'))) kind.push('cargo');
    if (fs.existsSync(p('pyproject.toml')) || fs.existsSync(p('requirements.txt'))) kind.push('python');
    return kind;
  });

  ipcMain.handle(IPC.createProject, async (_e, targetDir: string, templateId: string, vars: TemplateVars) => {
    const root = path.resolve(targetDir);
    allowRoot(root);
    fs.mkdirSync(root, { recursive: true });
    const generated = generateTemplate(templateId, vars);
    const count = await build.writeProjectFiles(root, generated);
    pushRecentProject(root);
    void indexer.indexProjectQuick(root);
    return { ok: true, files: count, root, generatedPaths: generated.map((f) => f.path) };
  });

  /* ---------------- Templates ---------------- */
  ipcMain.handle('templates:list', () =>
    TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, description: t.description, languages: t.languages })),
  );
  ipcMain.handle('templates:mc-versions', () => MC_VERSIONS);
  ipcMain.handle('templates:preview', (_e, id: string, vars: TemplateVars) =>
    generateTemplate(id, vars).map((f) => ({ path: f.path, bytes: Buffer.byteLength(f.content, 'utf-8') })),
  );

  /* ---------------- Terminal ---------------- */
  ipcMain.handle(IPC.termCreate, (e, id: string, cwd: string, opts?: { shell?: string; cols?: number; rows?: number }) =>
    terminal.createTerminal(id, cwd, e.sender, opts ?? {}),
  );
  ipcMain.handle(IPC.termWrite, (_e, id: string, data: string) => terminal.writeTerminal(id, data));
  ipcMain.handle(IPC.termResize, (_e, id: string, cols: number, rows: number) => terminal.resizeTerminal(id, cols, rows));
  ipcMain.handle(IPC.termKill, (_e, id: string) => terminal.killTerminal(id));

  /* ---------------- Git ---------------- */
  ipcMain.handle(IPC.gitStatus, (_e, root: string) => git.gitStatus(root));
  ipcMain.handle(IPC.gitDiff, (_e, root: string, file?: string, staged?: boolean) => git.gitDiff(root, file, !!staged));
  ipcMain.handle(IPC.gitLog, (_e, root: string, count?: number) => git.gitLog(root, count ?? 50));
  ipcMain.handle(IPC.gitCommit, (_e, root: string, message: string, amend?: boolean) => git.gitCommit(root, message, !!amend));
  ipcMain.handle(IPC.gitPush, (_e, root: string) => git.gitPush(root));
  ipcMain.handle(IPC.gitPull, (_e, root: string) => git.gitPull(root));
  ipcMain.handle(IPC.gitBranches, (_e, root: string) => git.gitBranches(root));
  ipcMain.handle(IPC.gitCheckout, (_e, root: string, branch: string) => git.gitCheckout(root, branch));
  ipcMain.handle(IPC.gitCreateBranch, (_e, root: string, branch: string) => git.gitCreateBranch(root, branch));
  ipcMain.handle(IPC.gitStage, (_e, root: string, filesList: string[]) => git.gitStage(root, filesList));
  ipcMain.handle(IPC.gitUnstage, (_e, root: string, filesList: string[]) => git.gitUnstage(root, filesList));
  ipcMain.handle(IPC.gitDiscard, (_e, root: string, file: string) => git.gitDiscard(root, file));
  ipcMain.handle(IPC.gitClone, async (e, url: string) => {
    const res = await dialog.showOpenDialog(senderWindow(e)!, { properties: ['openDirectory', 'createDirectory'] });
    if (res.canceled || !res.filePaths[0]) return null;
    const target = path.join(res.filePaths[0], path.basename(url.replace(/\.git$/, '')));
    await git.gitClone(url, target);
    allowRoot(target);
    pushRecentProject(target);
    return target;
  });
  ipcMain.handle(IPC.gitInit, (_e, root: string) => git.gitInit(root));

  /* ---------------- AI ---------------- */
  ipcMain.handle(IPC.aiSetKey, (_e, providerId: string, apiKey: string) => {
    setProviderApiKey(providerId, apiKey);
    return { ok: true };
  });

  ipcMain.handle(IPC.aiTestProvider, async (_e, providerId: string) => {
    const auth = authFor(providerId);
    return testProvider(auth);
  });

  ipcMain.handle('ai:list-providers', () => {
    const s = getSettings();
    return s.ai.providers.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      baseUrl: p.baseUrl,
      model: p.model,
      hasApiKey: p.hasApiKey,
      temperature: p.temperature,
      maxContextTokens: p.maxContextTokens,
      enabled: p.enabled,
    }));
  });

  ipcMain.handle('ai:update-provider', (_e, providerId: string, patch: Partial<AIProviderConfig>) => {
    updateProvider(providerId, patch);
    return { ok: true };
  });
  ipcMain.handle('ai:add-provider', (_e, provider: AIProviderConfig) => {
    addProvider(provider);
    return { ok: true };
  });
  ipcMain.handle('ai:remove-provider', (_e, providerId: string) => {
    removeProvider(providerId);
    return { ok: true };
  });

  const aborts = new Map<string, AbortController>();

  ipcMain.handle(IPC.aiStream, (e, requestId: string, messages: unknown, opts?: { providerId?: string; model?: string; temperature?: number; maxTokens?: number }) => {
    const auth = authFor(opts?.providerId);
    const controller = new AbortController();
    aborts.set(requestId, controller);
    streamChat(
      auth,
      messages as never,
      {
        onTextDelta: (delta) => e.sender.send('ai:stream-chunk', { requestId, delta }),
        onDone: (info) => {
          aborts.delete(requestId);
          e.sender.send('ai:stream-done', { requestId, ...info });
        },
        onError: (err) => {
          aborts.delete(requestId);
          e.sender.send('ai:stream-error', { requestId, message: err.message, cancelled: err.name === 'AICancelledError' });
        },
      },
      { model: opts?.model, temperature: opts?.temperature, maxTokens: opts?.maxTokens, signal: controller.signal },
    );
    return { ok: true };
  });

  ipcMain.handle(IPC.aiChatCancel, (_e, requestId: string) => {
    aborts.get(requestId)?.abort();
    aborts.delete(requestId);
    return { ok: true };
  });

  ipcMain.handle(IPC.aiInline, async (_e, providerId: string | undefined, prefix: string, suffix: string, language: string, projectContext: string) => {
    const auth = authFor(providerId);
    const text = await inlineComplete(auth, prefix, suffix, language, projectContext);
    return { text };
  });

  ipcMain.handle('ai:analyze-error', async (_e, providerId: string | undefined, logTail: string, projectFiles: string) => {
    const auth = authFor(providerId);
    return { text: await analyzeError(auth, logTail, projectFiles) };
  });

  ipcMain.handle(IPC.aiAgentRun, (e, runId: string, message: string, history: unknown, mode: AgentMode, projectRoot: string, allowedFiles?: string[]) => {
    const auth = authFor();
    void runAgent(runId, message, (history as never) ?? [], {
      webContents: e.sender,
      projectRoot,
      mode,
      auth,
      allowedFiles,
    });
    return { ok: true };
  });

  ipcMain.handle(IPC.aiAgentStop, (_e, runId: string) => {
    stopAgent(runId);
    return { ok: true };
  });

  ipcMain.handle(IPC.aiPermissionResponse, (_e, requestId: string, approved: boolean) => {
    respondPermission(requestId, approved);
    return { ok: true };
  });

  /* ---------------- Memory / Index ---------------- */
  ipcMain.handle(IPC.memoryGet, (_e, projectRoot: string) => memory.loadMemory(projectRoot));
  ipcMain.handle(IPC.memorySave, (_e, projectRoot: string, mem: ProjectMemory) => memory.saveMemory(projectRoot, mem));
  ipcMain.handle(IPC.indexQuery, (_e, projectRoot: string, query: string, limit?: number) => indexer.queryIndex(projectRoot, query, limit ?? 12));
  ipcMain.handle(IPC.indexRebuild, async (e, projectRoot: string) => indexer.rebuildIndex(projectRoot, (m) => e.sender.send('ui:notify', { kind: 'info', message: m })));

  /* ---------------- Build ---------------- */
  ipcMain.handle(IPC.buildDetect, (_e, projectRoot: string) => build.detectBuildSystem(projectRoot));
  ipcMain.handle(IPC.buildRun, (e, projectRoot: string, spec: { command: string; args: string[]; label: string }) => {
    build.runBuildTask(projectRoot, spec, {
      onOutput: (chunk) => e.sender.send('build:output', { chunk }),
      onDone: (result) => {
        e.sender.send('build:done', result);
        if (!result.ok) void memory.recordBuildError(projectRoot, result.problems.map((p) => p.message).join('; ') || result.tail.slice(-400));
      },
    });
    return { ok: true };
  });
  ipcMain.handle(IPC.buildStop, () => ({ stopped: build.stopBuildTask() }));

  /* ---------------- Settings ---------------- */
  ipcMain.handle(IPC.settingsGet, () => {
    // Never expose API key material to the renderer.
    const s = JSON.parse(JSON.stringify(getSettings())) as WinCodeSettings;
    for (const p of s.ai.providers) {
      delete (p as { apiKeyEnc?: string }).apiKeyEnc;
    }
    return s;
  });
  ipcMain.handle(IPC.settingsSet, (_e, patch: Partial<WinCodeSettings>) => {
    const merged = setSettings(patch);
    const s = JSON.parse(JSON.stringify(merged)) as WinCodeSettings;
    for (const p of s.ai.providers) delete (p as { apiKeyEnc?: string }).apiKeyEnc;
    return s;
  });
  ipcMain.handle(IPC.settingsReset, () => {
    resetSettings();
    return getSettings();
  });

  /* ---------------- Plugins ---------------- */
  ipcMain.handle(IPC.pluginsList, async () => ({ installed: await plugins.listPlugins(), builtin: plugins.BUILTIN_EXTENSIONS }));
  ipcMain.handle(IPC.pluginsInstall, async (_e, sourceDir: string) => plugins.installPlugin(sourceDir));
  ipcMain.handle(IPC.pluginsToggle, (_e, id: string, enabled: boolean) => plugins.togglePlugin(id, enabled));
  ipcMain.handle(IPC.pluginsUninstall, (_e, id: string) => plugins.uninstallPlugin(id));

  /* ---------------- Misc ---------------- */
  ipcMain.handle(IPC.updateCheck, () => ({ current: app.getVersion(), latest: app.getVersion(), upToDate: true }));

  ipcMain.handle('allow-root', (_e, root: string) => {
    allowRoot(root);
    return allowedRootsList();
  });
  ipcMain.handle('disallow-root', (_e, root: string) => {
    disallowRoot(root);
    return allowedRootsList();
  });

  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });
}
