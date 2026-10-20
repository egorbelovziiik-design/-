import { contextBridge, ipcRenderer } from 'electron';

/**
 * Secure preload bridge. The renderer never touches Node.js directly.
 * Only whitelisted channels are exposed, and event listeners are namespaced
 * to prevent channel injection.
 */
const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const on = (channel: string, callback: (...args: any[]) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

const api = {
  // app / window
  appInfo: () => invoke('app:info'),
  minimize: () => invoke('window:minimize'),
  maximize: () => invoke('window:maximize'),
  close: () => invoke('window:close'),
  isMaximized: () => invoke('window:is-maximized'),
  onMaximized: (cb: (max: boolean) => void) => on('window:maximized', cb),
  pickFolder: () => invoke('dialog:pick-folder'),
  pickFile: (filters?: { name: string; extensions: string[] }[]) => invoke('dialog:pick-file', filters),
  pickSaveFile: (defaultName?: string) => invoke('dialog:pick-save-file', defaultName),
  showMessage: (opts: { type?: string; title: string; message: string; buttons?: string[] }) => invoke('dialog:message', opts),
  onMenuAction: (cb: (action: string) => void) => on('menu:action', cb),

  // files
  listDir: (dir: string) => invoke('fs:list-dir', dir),
  readFile: (file: string) => invoke('fs:read-file', file),
  writeFile: (file: string, content: string) => invoke('fs:write-file', file, content),
  createNode: (target: string, kind: 'file' | 'dir', content?: string) => invoke('fs:create', target, kind, content),
  renameNode: (from: string, to: string) => invoke('fs:rename', from, to),
  deleteNode: (target: string) => invoke('fs:delete', target),
  copyNode: (from: string, to: string) => invoke('fs:copy', from, to),
  searchFiles: (root: string, query: string, opts?: Record<string, unknown>) => invoke('fs:search', root, query, opts),
  revealInOs: (target: string) => invoke('fs:reveal', target),

  // projects
  openProject: (folder: string) => invoke('project:open', folder),
  recentProjects: () => invoke('project:recent'),
  detectProject: (root: string) => invoke('project:detect', root),
  createProject: (targetDir: string, templateId: string, vars: unknown) => invoke('project:create', targetDir, templateId, vars),
  allowRoot: (root: string) => invoke('allow-root', root),

  // templates
  listTemplates: () => invoke('templates:list'),
  mcVersions: () => invoke('templates:mc-versions'),
  previewTemplate: (id: string, vars: unknown) => invoke('templates:preview', id, vars),

  // terminal
  termCreate: (id: string, cwd: string, opts?: { shell?: string; cols?: number; rows?: number }) => invoke('term:create', id, cwd, opts),
  termWrite: (id: string, data: string) => invoke('term:write', id, data),
  termResize: (id: string, cols: number, rows: number) => invoke('term:resize', id, cols, rows),
  termKill: (id: string) => invoke('term:kill', id),
  onTermData: (cb: (payload: { id: string; data: string }) => void) => on('term:data', cb),
  onTermExit: (cb: (payload: { id: string; exitCode: number }) => void) => on('term:exit', cb),

  // git
  gitStatus: (root: string) => invoke('git:status', root),
  gitDiff: (root: string, file?: string, staged?: boolean) => invoke('git:diff', root, file, staged),
  gitLog: (root: string, count?: number) => invoke('git:log', root, count),
  gitCommit: (root: string, message: string, amend?: boolean) => invoke('git:commit', root, message, amend),
  gitPush: (root: string) => invoke('git:push', root),
  gitPull: (root: string) => invoke('git:pull', root),
  gitBranches: (root: string) => invoke('git:branches', root),
  gitCheckout: (root: string, branch: string) => invoke('git:checkout', root, branch),
  gitCreateBranch: (root: string, branch: string) => invoke('git:create-branch', root, branch),
  gitStage: (root: string, files: string[]) => invoke('git:stage', root, files),
  gitUnstage: (root: string, files: string[]) => invoke('git:unstage', root, files),
  gitDiscard: (root: string, file: string) => invoke('git:discard', root, file),
  gitClone: (url: string) => invoke('git:clone', url),
  gitInit: (root: string) => invoke('git:init', root),

  // ai
  aiListProviders: () => invoke('ai:list-providers'),
  aiUpdateProvider: (id: string, patch: unknown) => invoke('ai:update-provider', id, patch),
  aiAddProvider: (provider: unknown) => invoke('ai:add-provider', provider),
  aiRemoveProvider: (id: string) => invoke('ai:remove-provider', id),
  aiSetKey: (providerId: string, key: string) => invoke('ai:set-key', providerId, key),
  aiTestProvider: (providerId: string) => invoke('ai:test-provider', providerId),
  aiStream: (requestId: string, messages: unknown, opts?: unknown) => invoke('ai:stream', requestId, messages, opts),
  aiStreamCancel: (requestId: string) => invoke('ai:chat-cancel', requestId),
  aiInline: (providerId: string | undefined, prefix: string, suffix: string, language: string, projectContext: string) =>
    invoke('ai:inline', providerId, prefix, suffix, language, projectContext),
  aiAnalyzeError: (providerId: string | undefined, logTail: string, projectFiles: string) =>
    invoke('ai:analyze-error', providerId, logTail, projectFiles),
  aiAgentRun: (runId: string, message: string, history: unknown, mode: string, projectRoot: string, allowedFiles?: string[]) =>
    invoke('ai:agent-run', runId, message, history, mode, projectRoot, allowedFiles),
  aiAgentStop: (runId: string) => invoke('ai:agent-stop', runId),
  aiPermissionResponse: (requestId: string, approved: boolean) => invoke('ai:permission-response', requestId, approved),
  onAiStreamChunk: (cb: (payload: { requestId: string; delta: string }) => void) => on('ai:stream-chunk', cb),
  onAiStreamDone: (cb: (payload: { requestId: string; finishReason: string }) => void) => on('ai:stream-done', cb),
  onAiStreamError: (cb: (payload: { requestId: string; message: string; cancelled?: boolean }) => void) => on('ai:stream-error', cb),
  onAiAgentEvent: (cb: (event: unknown) => void) => on('ai:agent-event', cb),
  onAiPermission: (cb: (req: unknown) => void) => on('ai:permission-request', cb),

  // memory / index
  memoryGet: (root: string) => invoke('memory:get', root),
  memorySave: (root: string, mem: unknown) => invoke('memory:save', root, mem),
  indexQuery: (root: string, query: string, limit?: number) => invoke('index:query', root, query, limit),
  indexRebuild: (root: string) => invoke('index:rebuild', root),

  // build
  buildDetect: (root: string) => invoke('build:detect', root),
  buildRun: (root: string, spec: { command: string; args: string[]; label: string }) => invoke('build:run', root, spec),
  buildStop: () => invoke('build:stop'),
  onBuildOutput: (cb: (payload: { chunk: string }) => void) => on('build:output', cb),
  onBuildDone: (cb: (result: unknown) => void) => on('build:done', cb),

  // settings
  settingsGet: () => invoke('settings:get'),
  settingsSet: (patch: unknown) => invoke('settings:set', patch),
  settingsReset: () => invoke('settings:reset'),

  // plugins
  pluginsList: () => invoke('plugins:list'),
  pluginsInstall: (sourceDir: string) => invoke('plugins:install', sourceDir),
  pluginsToggle: (id: string, enabled: boolean) => invoke('plugins:toggle', id, enabled),
  pluginsUninstall: (id: string) => invoke('plugins:uninstall', id),

  // misc
  updateCheck: () => invoke('update:check'),
  onNotify: (cb: (payload: { kind: string; message: string }) => void) => on('ui:notify', cb),
  relaunch: () => invoke('app:relaunch'),
};

export type WinCodeAPI = typeof api;

contextBridge.exposeInMainWorld('wincode', api);
