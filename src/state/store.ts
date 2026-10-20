import { create } from 'zustand';
import type {
  AIMessage,
  AgentMode,
  BuildResult,
  FileNode,
  GitStatusEntry,
  PermissionRequest,
  ProblemItem,
  ProjectMemory,
  TabModel,
  WinCodeSettings,
} from '@shared/types';

export interface NotificationItem {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
  detail?: string;
  ts: number;
}

export interface AgentLogEntry {
  id: string;
  type: 'text' | 'tool-start' | 'tool-result' | 'plan' | 'step' | 'permission' | 'done' | 'error' | 'stopped';
  payload: unknown;
  ts: number;
}

export interface OpenFileState {
  content: string;
  original: string;
  language: string;
  loading: boolean;
}

export interface TerminalSession {
  id: string;
  name: string;
  kind: string;
}

type ActivityView = 'explorer' | 'search' | 'git' | 'debug' | 'plugins' | 'minecraft';
type BottomTab = 'terminal' | 'problems' | 'build' | 'debug' | 'output';

interface AppState {
  /* lifecycle */
  booted: boolean;
  view: 'welcome' | 'workspace';
  workspaceRoot: string | null;
  projectKinds: string[];
  recentProjects: { path: string; name: string; openedAt: number }[];
  settings: WinCodeSettings | null;

  /* layout */
  activity: ActivityView;
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  showLeft: boolean;
  showRight: boolean;
  showBottom: boolean;
  bottomTab: BottomTab;
  windowMaximized: boolean;

  /* files & editor */
  fileTree: FileNode[];
  expandedDirs: Record<string, boolean>;
  openFiles: Record<string, OpenFileState>;
  tabs: TabModel[];
  activeTabId: string | null;
  splitView: boolean;
  problems: ProblemItem[];

  /* search */
  searchQuery: string;
  searchResults: { file: string; line: number; column: number; text: string; preview: string }[];
  searchRunning: boolean;

  /* build */
  buildTasks: { kind: string; command: string; args: string[]; label: string }[];
  buildLog: string;
  buildRunning: boolean;
  lastBuild: BuildResult | null;

  /* terminal */
  terminals: TerminalSession[];
  activeTerminalId: string | null;

  /* git */
  gitEntries: GitStatusEntry[];
  gitBranch: string;
  gitAhead: number;
  gitBehind: number;
  gitLog: { hash: string; author: string; date: string; subject: string }[];

  /* ai */
  aiMessages: AIMessage[];
  aiStreaming: boolean;
  aiMode: AgentMode;
  aiRunActive: boolean;
  agentLog: AgentLogEntry[];
  permissionReq: PermissionRequest | null;
  activeProviderId: string;
  activeModel: string;

  /* memory */
  memory: ProjectMemory | null;

  /* overlays */
  settingsOpen: boolean;
  settingsSection: string;
  wizardOpen: boolean;
  paletteOpen: boolean;
  guiBuilderOpen: boolean;
  aboutOpen: boolean;
  notifications: NotificationItem[];

  /* actions */
  boot(): Promise<void>;
  setSettings(patch: Partial<WinCodeSettings>): Promise<void>;
  openWorkspace(root: string): Promise<void>;
  closeWorkspace(): void;
  refreshTree(dir?: string): Promise<void>;
  toggleDir(path: string): void;
  openFile(path: string): Promise<void>;
  closeTab(tabId: string): Promise<void>;
  setActiveTab(tabId: string): void;
  saveFile(tabId: string): Promise<void>;
  saveAll(): Promise<void>;
  markDirty(path: string, content: string): void;
  splitEditor(): void;
  moveTabToColumn(tabId: string, column: 0 | 1): void;
  notify(kind: NotificationItem['kind'], message: string, detail?: string): void;
  dismissNotification(id: string): void;
  runSearch(query: string): Promise<void>;
  runBuild(task?: { command: string; args: string[]; label: string }): Promise<void>;
  stopBuild(): Promise<void>;
  appendBuildLog(chunk: string): void;
  createTerminal(name?: string): Promise<void>;
  closeTerminal(id: string): Promise<void>;
  setActivity(a: ActivityView): void;
  setBottomTab(t: BottomTab): void;
  refreshGit(): Promise<void>;
  setAiMode(m: AgentMode): void;
  pushAiMessage(m: AIMessage): void;
  setAiStreaming(v: boolean): void;
  pushAgentLog(e: AgentLogEntry): void;
  setPermissionReq(p: PermissionRequest | null): void;
  setAiProvider(id: string, model: string): void;
  loadMemory(): Promise<void>;
  setView(v: 'welcome' | 'workspace'): void;
  setOverlay(name: 'settings' | 'wizard' | 'palette' | 'guiBuilder' | 'about', open: boolean, section?: string): void;
}

export const useApp = create<AppState>((set, get) => ({
  booted: false,
  view: 'welcome',
  workspaceRoot: null,
  projectKinds: [],
  recentProjects: [],
  settings: null,

  activity: 'explorer',
  leftWidth: 260,
  rightWidth: 340,
  bottomHeight: 220,
  showLeft: true,
  showRight: true,
  showBottom: true,
  bottomTab: 'terminal',
  windowMaximized: false,

  fileTree: [],
  expandedDirs: {},
  openFiles: {},
  tabs: [],
  activeTabId: null,
  splitView: false,
  problems: [],

  searchQuery: '',
  searchResults: [],
  searchRunning: false,

  buildTasks: [],
  buildLog: '',
  buildRunning: false,
  lastBuild: null,

  terminals: [],
  activeTerminalId: null,

  gitEntries: [],
  gitBranch: '',
  gitAhead: 0,
  gitBehind: 0,
  gitLog: [],

  aiMessages: [],
  aiStreaming: false,
  aiMode: 'AGENT',
  aiRunActive: false,
  agentLog: [],
  permissionReq: null,
  activeProviderId: 'openai',
  activeModel: 'gpt-4o',

  memory: null,

  settingsOpen: false,
  settingsSection: 'appearance',
  wizardOpen: false,
  paletteOpen: false,
  guiBuilderOpen: false,
  aboutOpen: false,
  notifications: [],

  async boot() {
    const api = window.wincode;
    const settings = await api.settingsGet();
    const recent = await api.recentProjects();
    const info = await api.appInfo();
    document.documentElement.setAttribute('data-theme', settings.appearance.theme);
    set({ settings, recentProjects: recent, booted: true, activeProviderId: settings.ai.activeProviderId });
    void info;

    api.onNotify((n) => get().notify((n.kind as NotificationItem['kind']) ?? 'info', n.message));
    api.onMaximized((m) => set({ windowMaximized: m }));
    api.onAiPermission((req) => set({ permissionReq: req as PermissionRequest }));
    api.onBuildOutput(({ chunk }) => get().appendBuildLog(chunk));
    api.onBuildDone((result) => {
      set({
        buildRunning: false,
        lastBuild: result,
        problems: result.problems ?? [],
      });
      if (result.ok) get().notify('success', 'Build succeeded');
      else get().notify('error', `Build failed (exit ${result.exitCode})`, result.problems?.[0]?.message);
    });
  },

  async setSettings(patch) {
    const next = await window.wincode.settingsSet(patch);
    document.documentElement.setAttribute('data-theme', next.appearance.theme);
    set({ settings: next });
  },

  async openWorkspace(root) {
    const api = window.wincode;
    await api.openProject(root);
    const kinds = await api.detectProject(root);
    const buildTasks = await api.buildDetect(root);
    set({
      workspaceRoot: root,
      view: 'workspace',
      projectKinds: kinds,
      buildTasks,
      expandedDirs: { [root]: true },
    });
    await get().refreshTree();
    await get().refreshGit();
    void get().loadMemory();
    const recent = await api.recentProjects();
    set({ recentProjects: recent });
    get().notify('success', `Project opened: ${root}`);
  },

  closeWorkspace() {
    set({
      view: 'welcome',
      workspaceRoot: null,
      fileTree: [],
      tabs: [],
      openFiles: {},
      activeTabId: null,
      aiMessages: [],
      agentLog: [],
      problems: [],
      buildLog: '',
    });
  },

  async refreshTree(dir) {
    const root = get().workspaceRoot;
    if (!root) return;
    const target = dir ?? root;
    const children = await window.wincode.listDir(target);
    if (target === root) {
      set({ fileTree: children });
      return;
    }
    // patch nested node
    const patchNode = (nodes: FileNode[]): FileNode[] =>
      nodes.map((n) => {
        if (n.path === target) return { ...n, children, loaded: true };
        if (n.children) return { ...n, children: patchNode(n.children) };
        return n;
      });
    set({ fileTree: patchNode(get().fileTree) });
  },

  toggleDir(path) {
    const expanded = { ...get().expandedDirs };
    if (expanded[path]) {
      delete expanded[path];
    } else {
      expanded[path] = true;
      void get().refreshTree(path);
    }
    set({ expandedDirs: expanded });
  },

  async openFile(path) {
    const state = get();
    const existingTab = state.tabs.find((t) => t.path === path);
    const tabId = existingTab?.id ?? `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const name = path.split(/[\\/]/).pop() ?? path;

    if (!existingTab) {
      const tab: TabModel = {
        id: tabId,
        path,
        name,
        language: 'plaintext',
        dirty: false,
        viewColumn: 0,
      };
      set({
        tabs: [...get().tabs, tab],
        activeTabId: tabId,
        openFiles: {
          ...get().openFiles,
          [path]: { content: '', original: '', language: 'plaintext', loading: true },
        },
      });
    } else {
      set({ activeTabId: tabId });
      return;
    }

    try {
      const res = await window.wincode.readFile(path);
      set({
        openFiles: {
          ...get().openFiles,
          [path]: { content: res.content, original: res.content, language: res.language, loading: false },
        },
        tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, language: res.language } : t)),
      });
      if (res.truncated) get().notify('warning', `File truncated for preview: ${name}`);
    } catch (err) {
      set({
        openFiles: {
          ...get().openFiles,
          [path]: { content: `// Failed to open: ${(err as Error).message}`, original: '', language: 'plaintext', loading: false },
        },
      });
      get().notify('error', `Cannot open ${name}`, (err as Error).message);
    }
  },

  async closeTab(tabId) {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const file = get().openFiles[tab.path];
    if (file && file.content !== file.original) {
      const idx = await window.wincode.showMessage({
        type: 'warning',
        title: 'Unsaved changes',
        message: `"${tab.name}" has unsaved changes. Save before closing?`,
        buttons: ['Save', "Don't save", 'Cancel'],
      });
      if (idx === 2) return;
      if (idx === 0) await get().saveFile(tabId);
    }
    const openFiles = { ...get().openFiles };
    delete openFiles[tab.path];
    const tabs = get().tabs.filter((t) => t.id !== tabId);
    const activeTabId = get().activeTabId === tabId ? (tabs[tabs.length - 1]?.id ?? null) : get().activeTabId;
    set({ tabs, openFiles, activeTabId });
  },

  setActiveTab(tabId) {
    set({ activeTabId: tabId });
  },

  async saveFile(tabId) {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const file = get().openFiles[tab.path];
    if (!file) return;
    try {
      await window.wincode.writeFile(tab.path, file.content);
      set({
        openFiles: { ...get().openFiles, [tab.path]: { ...file, original: file.content } },
        tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, dirty: false } : t)),
      });
      get().notify('success', `Saved ${tab.name}`);
    } catch (err) {
      get().notify('error', `Save failed: ${tab.name}`, (err as Error).message);
    }
  },

  async saveAll() {
    for (const tab of get().tabs) {
      const f = get().openFiles[tab.path];
      if (f && f.content !== f.original) await get().saveFile(tab.id);
    }
  },

  markDirty(path, content) {
    const file = get().openFiles[path];
    if (!file) return;
    set({
      openFiles: { ...get().openFiles, [path]: { ...file, content } },
      tabs: get().tabs.map((t) => (t.path === path ? { ...t, dirty: t.dirty || content !== file.original } : t)),
    });
  },

  splitEditor() {
    const state = get();
    const active = state.tabs.find((t) => t.id === state.activeTabId);
    if (!active) return;
    const column: 0 | 1 = active.viewColumn === 0 ? 1 : 0;
    set({
      splitView: true,
      tabs: state.tabs.map((t) => (t.id === active.id ? { ...t, viewColumn: column } : t)),
    });
  },

  moveTabToColumn(tabId, column) {
    set({ tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, viewColumn: column } : t)), splitView: get().splitView || column === 1 });
  },

  notify(kind, message, detail) {
    const item: NotificationItem = { id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind, message, detail, ts: Date.now() };
    set({ notifications: [...get().notifications.slice(-5), item] });
    if (kind !== 'error') {
      setTimeout(() => get().dismissNotification(item.id), 5200);
    }
  },

  dismissNotification(id) {
    set({ notifications: get().notifications.filter((n) => n.id !== id) });
  },

  async runSearch(query) {
    const root = get().workspaceRoot;
    if (!root || !query.trim()) {
      set({ searchResults: [], searchQuery: query });
      return;
    }
    set({ searchRunning: true, searchQuery: query });
    try {
      const results = await window.wincode.searchFiles(root, query, { maxResults: 400 });
      set({ searchResults: results });
    } catch (err) {
      get().notify('error', 'Search failed', (err as Error).message);
    } finally {
      set({ searchRunning: false });
    }
  },

  async runBuild(task) {
    const root = get().workspaceRoot;
    if (!root) return;
    const spec = task ?? get().buildTasks[0];
    if (!spec) {
      get().notify('warning', 'No build task detected in this project');
      return;
    }
    set({ buildRunning: true, buildLog: '', lastBuild: null, bottomTab: 'build', showBottom: true, problems: [] });
    await window.wincode.buildRun(root, { command: spec.command, args: spec.args, label: spec.label });
  },

  async stopBuild() {
    await window.wincode.buildStop();
  },

  appendBuildLog(chunk) {
    const log = get().buildLog;
    set({ buildLog: (log + chunk).slice(-400000) });
  },

  async createTerminal(name) {
    const root = get().workspaceRoot ?? (await window.wincode.appInfo()).userData;
    const id = `term_${Date.now()}`;
    const session: TerminalSession = { id, name: name ?? `Terminal ${get().terminals.length + 1}`, kind: 'pty' };
    const res = await window.wincode.termCreate(id, root);
    set({
      terminals: [...get().terminals, { ...session, kind: res.kind }],
      activeTerminalId: id,
      showBottom: true,
      bottomTab: 'terminal',
    });
  },

  async closeTerminal(id) {
    await window.wincode.termKill(id);
    const terminals = get().terminals.filter((t) => t.id !== id);
    set({
      terminals,
      activeTerminalId: get().activeTerminalId === id ? (terminals[terminals.length - 1]?.id ?? null) : get().activeTerminalId,
    });
  },

  setActivity(a) {
    set({ activity: a, showLeft: true });
  },

  setBottomTab(t) {
    set({ bottomTab: t, showBottom: true });
  },

  async refreshGit() {
    const root = get().workspaceRoot;
    if (!root) return;
    try {
      const status = await window.wincode.gitStatus(root);
      set({ gitEntries: status.entries, gitBranch: status.branch, gitAhead: status.ahead, gitBehind: status.behind });
      const log = await window.wincode.gitLog(root, 30).catch(() => []);
      set({ gitLog: log });
    } catch {
      set({ gitEntries: [], gitBranch: '' });
    }
  },

  setAiMode(m) {
    set({ aiMode: m });
  },

  pushAiMessage(m) {
    set({ aiMessages: [...get().aiMessages, m] });
  },

  setAiStreaming(v) {
    set({ aiStreaming: v });
  },

  pushAgentLog(e) {
    set({ agentLog: [...get().agentLog, e].slice(-300) });
  },

  setPermissionReq(p) {
    set({ permissionReq: p });
  },

  setAiProvider(id, model) {
    set({ activeProviderId: id, activeModel: model });
  },

  async loadMemory() {
    const root = get().workspaceRoot;
    if (!root) return;
    try {
      const mem = await window.wincode.memoryGet(root);
      set({ memory: mem });
    } catch {
      set({ memory: null });
    }
  },

  setView(v) {
    set({ view: v });
  },

  setOverlay(name, open, section) {
    const patch: Partial<AppState> = {};
    if (name === 'settings') {
      (patch as { settingsOpen: boolean }).settingsOpen = open;
      if (section) (patch as { settingsSection: string }).settingsSection = section;
    }
    if (name === 'wizard') (patch as { wizardOpen: boolean }).wizardOpen = open;
    if (name === 'palette') (patch as { paletteOpen: boolean }).paletteOpen = open;
    if (name === 'guiBuilder') (patch as { guiBuilderOpen: boolean }).guiBuilderOpen = open;
    if (name === 'about') (patch as { aboutOpen: boolean }).aboutOpen = open;
    set(patch as AppState);
  },
}));
