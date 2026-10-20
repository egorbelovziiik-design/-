/* Shared types between Electron main and renderer. */

export interface WinCodeSettings {
  appearance: {
    theme: 'aurora-dark' | 'midnight' | 'dracula' | 'synthwave' | 'light' | 'solarized';
    accentColor: string;
    uiFont: string;
    editorFont: string;
    editorFontSize: number;
    editorLigatures: boolean;
    minimap: boolean;
    smoothAnimations: boolean;
    statusBarVisible: boolean;
  };
  editor: {
    tabSize: number;
    insertSpaces: boolean;
    wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
    autoSave: 'off' | 'afterDelay' | 'onFocusChange';
    autoSaveDelayMs: number;
    formatOnSave: boolean;
    lineNumbers: 'on' | 'off' | 'relative';
    bracketPairs: boolean;
    stickyScroll: boolean;
  };
  ai: {
    activeProviderId: string;
    providers: AIProviderConfig[];
    inlineCompletion: boolean;
    inlineCompletionDelayMs: number;
    agentAutoApproveSafe: boolean;
    temperature: number;
    maxContextFiles: number;
  };
  minecraft: {
    defaultMinecraftVersion: string;
    defaultLoader: 'fabric' | 'forge' | 'neoforge' | 'quilt';
    defaultJavaVersion: string;
    gradleJvmArgs: string;
  };
  terminal: {
    shellWindows: string;
    shellLinux: string;
    fontSize: number;
    scrollback: number;
  };
  git: {
    userName: string;
    userEmail: string;
    autoFetch: boolean;
  };
  performance: {
    indexLargeFiles: boolean;
    maxFileSizeKb: number;
    lazyTree: boolean;
  };
  privacy: {
    sendCodeToAI: boolean;
    anonymousStats: boolean;
  };
  keybindings: Record<string, string>;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  kind: 'openai' | 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama' | 'lmstudio' | 'openrouter' | 'custom';
  baseUrl: string;
  model: string;
  apiKeyEnc?: string;
  hasApiKey: boolean;
  temperature: number;
  maxContextTokens: number;
  enabled: boolean;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: AIToolCall[];
  name?: string;
  ts?: number;
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AIToolResult {
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}

export type AgentMode = 'ASK' | 'EDIT' | 'AGENT' | 'PLAN' | 'DEBUG' | 'AUTOPILOT';

export interface PermissionRequest {
  id: string;
  tool: string;
  description: string;
  detail: string;
  dangerous: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  mtime?: number;
  children?: FileNode[];
  loaded?: boolean;
}

export interface TabModel {
  id: string;
  path: string;
  name: string;
  language: string;
  dirty: boolean;
  viewColumn: 0 | 1;
  cursor?: { line: number; column: number };
}

export interface ProblemItem {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: string;
}

export interface BuildResult {
  ok: boolean;
  exitCode: number;
  command: string;
  durationMs: number;
  problems: ProblemItem[];
  tail: string;
}

export interface GitStatusEntry {
  path: string;
  index: string;
  working: string;
  staged: boolean;
  conflicted: boolean;
}

export interface ProjectTemplateFile {
  path: string;
  content: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  category: 'general' | 'minecraft' | 'web' | 'ai';
  description: string;
  languages: string[];
  generate(vars: TemplateVars): ProjectTemplateFile[];
}

export interface TemplateVars {
  projectName: string;
  packageName: string;
  minecraftVersion?: string;
  loader?: 'fabric' | 'forge' | 'neoforge' | 'quilt';
  javaVersion?: string;
  modVersion?: string;
  author?: string;
  description?: string;
}

export interface MCVersionCompat {
  minecraft: string;
  java: string;
  fabricLoader: string;
  fabricApi: string;
  yarn: string;
  loom: string;
  forge: string;
  neoforge: string;
  quiltLoader: string;
}

export interface ProjectMemory {
  projectPath: string;
  architecture: string;
  keyClasses: string[];
  dependencies: string[];
  changeHistory: string[];
  errorHistory: string[];
  userPreferences: string[];
  minecraft?: { version: string; loader: string; java: string };
  notes: string;
  updatedAt: number;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  kind: 'language' | 'theme' | 'ai' | 'tool' | 'minecraft' | 'debugger' | 'formatter';
  main: string;
  enabled: boolean;
  installedAt: number;
}

export interface QuickPickItem {
  id: string;
  label: string;
  detail?: string;
}

export const IPC = {
  // app / window
  appInfo: 'app:info',
  windowMinimize: 'window:minimize',
  windowMaximize: 'window:maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  pickFolder: 'dialog:pick-folder',
  pickFile: 'dialog:pick-file',
  pickSaveFile: 'dialog:pick-save-file',
  showMessage: 'dialog:message',
  // files
  listDir: 'fs:list-dir',
  readFile: 'fs:read-file',
  writeFile: 'fs:write-file',
  createNode: 'fs:create',
  renameNode: 'fs:rename',
  deleteNode: 'fs:delete',
  copyNode: 'fs:copy',
  searchFiles: 'fs:search',
  revealInOs: 'fs:reveal',
  // projects
  createProject: 'project:create',
  openProject: 'project:open',
  recentProjects: 'project:recent',
  detectProject: 'project:detect',
  // terminal
  termCreate: 'term:create',
  termWrite: 'term:write',
  termResize: 'term:resize',
  termKill: 'term:kill',
  termData: 'term:data',
  termExit: 'term:exit',
  // git
  gitStatus: 'git:status',
  gitDiff: 'git:diff',
  gitLog: 'git:log',
  gitCommit: 'git:commit',
  gitPush: 'git:push',
  gitPull: 'git:pull',
  gitBranches: 'git:branches',
  gitCheckout: 'git:checkout',
  gitCreateBranch: 'git:create-branch',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitDiscard: 'git:discard',
  gitClone: 'git:clone',
  gitInit: 'git:init',
  // ai
  aiChat: 'ai:chat',
  aiChatCancel: 'ai:chat-cancel',
  aiStream: 'ai:stream',
  aiStreamChunk: 'ai:stream-chunk',
  aiStreamDone: 'ai:stream-done',
  aiStreamError: 'ai:stream-error',
  aiInline: 'ai:inline',
  aiSetKey: 'ai:set-key',
  aiTestProvider: 'ai:test-provider',
  aiPermissionRequest: 'ai:permission-request',
  aiPermissionResponse: 'ai:permission-response',
  aiAgentEvent: 'ai:agent-event',
  aiAgentRun: 'ai:agent-run',
  aiAgentStop: 'ai:agent-stop',
  // memory / index
  memoryGet: 'memory:get',
  memorySave: 'memory:save',
  indexQuery: 'index:query',
  indexRebuild: 'index:rebuild',
  // build
  buildRun: 'build:run',
  buildStop: 'build:stop',
  buildOutput: 'build:output',
  buildDone: 'build:done',
  buildDetect: 'build:detect',
  // debug
  debugStart: 'debug:start',
  debugStop: 'debug:stop',
  debugEvent: 'debug:event',
  // settings
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsReset: 'settings:reset',
  settingsExport: 'settings:export',
  // plugins
  pluginsList: 'plugins:list',
  pluginsInstall: 'plugins:install',
  pluginsToggle: 'plugins:toggle',
  pluginsUninstall: 'plugins:uninstall',
  // misc
  notify: 'ui:notify',
  updateCheck: 'update:check',
} as const;
