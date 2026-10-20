/* Renderer-side typing for the preload bridge. */
export interface WinCodeAPI {
  appInfo(): Promise<{ version: string; platform: string; electron: string; node: string; userData: string; allowedRoots: string[] }>;
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onMaximized(cb: (max: boolean) => void): () => void;
  pickFolder(): Promise<string | null>;
  pickFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null>;
  pickSaveFile(defaultName?: string): Promise<string | null>;
  showMessage(opts: { type?: string; title: string; message: string; buttons?: string[] }): Promise<number>;
  onMenuAction(cb: (action: string) => void): () => void;

  listDir(dir: string): Promise<import('@shared/types').FileNode[]>;
  readFile(file: string): Promise<{ content: string; language: string; truncated: boolean }>;
  writeFile(file: string, content: string): Promise<void>;
  createNode(target: string, kind: 'file' | 'dir', content?: string): Promise<void>;
  renameNode(from: string, to: string): Promise<void>;
  deleteNode(target: string): Promise<void>;
  copyNode(from: string, to: string): Promise<void>;
  searchFiles(root: string, query: string, opts?: Record<string, unknown>): Promise<{ file: string; line: number; column: number; text: string; preview: string }[]>;
  revealInOs(target: string): Promise<void>;

  openProject(folder: string): Promise<{ ok: boolean; root: string }>;
  recentProjects(): Promise<{ path: string; name: string; openedAt: number }[]>;
  detectProject(root: string): Promise<string[]>;
  createProject(targetDir: string, templateId: string, vars: unknown): Promise<{ ok: boolean; files: number; root: string; generatedPaths: string[] }>;
  allowRoot(root: string): Promise<string[]>;

  listTemplates(): Promise<{ id: string; name: string; category: string; description: string; languages: string[] }[]>;
  mcVersions(): Promise<import('@shared/types').MCVersionCompat[]>;
  previewTemplate(id: string, vars: unknown): Promise<{ path: string; bytes: number }[]>;

  termCreate(id: string, cwd: string, opts?: { shell?: string; cols?: number; rows?: number }): Promise<{ ok: boolean; kind: string; message?: string }>;
  termWrite(id: string, data: string): Promise<void>;
  termResize(id: string, cols: number, rows: number): Promise<void>;
  termKill(id: string): Promise<void>;
  onTermData(cb: (payload: { id: string; data: string }) => void): () => void;
  onTermExit(cb: (payload: { id: string; exitCode: number }) => void): () => void;

  gitStatus(root: string): Promise<{ entries: import('@shared/types').GitStatusEntry[]; branch: string; ahead: number; behind: number }>;
  gitDiff(root: string, file?: string, staged?: boolean): Promise<string>;
  gitLog(root: string, count?: number): Promise<{ hash: string; author: string; date: string; subject: string }[]>;
  gitCommit(root: string, message: string, amend?: boolean): Promise<string>;
  gitPush(root: string): Promise<string>;
  gitPull(root: string): Promise<string>;
  gitBranches(root: string): Promise<{ name: string; current: boolean; remote: boolean }[]>;
  gitCheckout(root: string, branch: string): Promise<string>;
  gitCreateBranch(root: string, branch: string): Promise<string>;
  gitStage(root: string, files: string[]): Promise<void>;
  gitUnstage(root: string, files: string[]): Promise<void>;
  gitDiscard(root: string, file: string): Promise<void>;
  gitClone(url: string): Promise<string | null>;
  gitInit(root: string): Promise<string>;

  aiListProviders(): Promise<{ id: string; name: string; kind: string; baseUrl: string; model: string; hasApiKey: boolean; temperature: number; maxContextTokens: number; enabled: boolean }[]>;
  aiUpdateProvider(id: string, patch: unknown): Promise<{ ok: boolean }>;
  aiAddProvider(provider: unknown): Promise<{ ok: boolean }>;
  aiRemoveProvider(id: string): Promise<{ ok: boolean }>;
  aiSetKey(providerId: string, key: string): Promise<{ ok: boolean }>;
  aiTestProvider(providerId: string): Promise<{ ok: boolean; latencyMs: number; message: string; models?: string[] }>;
  aiStream(requestId: string, messages: unknown, opts?: unknown): Promise<{ ok: boolean }>;
  aiStreamCancel(requestId: string): Promise<{ ok: boolean }>;
  aiInline(providerId: string | undefined, prefix: string, suffix: string, language: string, projectContext: string): Promise<{ text: string }>;
  aiAnalyzeError(providerId: string | undefined, logTail: string, projectFiles: string): Promise<{ text: string }>;
  aiAgentRun(runId: string, message: string, history: unknown, mode: string, projectRoot: string, allowedFiles?: string[]): Promise<{ ok: boolean }>;
  aiAgentStop(runId: string): Promise<{ ok: boolean }>;
  aiPermissionResponse(requestId: string, approved: boolean): Promise<{ ok: boolean }>;
  onAiStreamChunk(cb: (payload: { requestId: string; delta: string }) => void): () => void;
  onAiStreamDone(cb: (payload: { requestId: string; finishReason: string }) => void): () => void;
  onAiStreamError(cb: (payload: { requestId: string; message: string; cancelled?: boolean }) => void): () => void;
  onAiAgentEvent(cb: (event: unknown) => void): () => void;
  onAiPermission(cb: (req: unknown) => void): () => void;

  memoryGet(root: string): Promise<import('@shared/types').ProjectMemory>;
  memorySave(root: string, mem: unknown): Promise<import('@shared/types').ProjectMemory>;
  indexQuery(root: string, query: string, limit?: number): Promise<{ file: string; score: number; excerpt: string }[]>;
  indexRebuild(root: string): Promise<{ files: number; skipped: number }>;

  buildDetect(root: string): Promise<{ kind: string; command: string; args: string[]; label: string }[]>;
  buildRun(root: string, spec: { command: string; args: string[]; label: string }): Promise<{ ok: boolean }>;
  buildStop(): Promise<{ stopped: boolean }>;
  onBuildOutput(cb: (payload: { chunk: string }) => void): () => void;
  onBuildDone(cb: (result: import('@shared/types').BuildResult) => void): () => void;

  settingsGet(): Promise<import('@shared/types').WinCodeSettings>;
  settingsSet(patch: unknown): Promise<import('@shared/types').WinCodeSettings>;
  settingsReset(): Promise<import('@shared/types').WinCodeSettings>;

  pluginsList(): Promise<{ installed: import('@shared/types').PluginManifest[]; builtin: import('@shared/types').PluginManifest[] }>;
  pluginsInstall(sourceDir: string): Promise<import('@shared/types').PluginManifest>;
  pluginsToggle(id: string, enabled: boolean): Promise<import('@shared/types').PluginManifest[]>;
  pluginsUninstall(id: string): Promise<import('@shared/types').PluginManifest[]>;

  updateCheck(): Promise<{ current: string; latest: string; upToDate: boolean }>;
  onNotify(cb: (payload: { kind: string; message: string }) => void): () => void;
  relaunch(): Promise<void>;
}
