import { create } from 'zustand'
import type { AiProviderConfig, FileNode, McAccount, ProviderId } from '@shared/types'
import { PROVIDERS } from '@shared/types'

export interface Tab {
  path: string
  name: string
  dirty: boolean
}

export interface OutputLine { id: number; text: string; kind: 'out' | 'err' | 'sys' }

interface Settings {
  theme: 'wincode-dark' | 'wincode-midnight' | 'wincode-light'
  accent: string
  fontSize: number
  fontFamily: string
  autoSave: boolean
  minimap: boolean
  wordWrap: boolean
  tabSize: number
  aiInline: boolean
  jdtPath: string
  javaHome: string
  azureClientId: string
  defaultShell: 'powershell' | 'cmd'
  launcherRam: number
}

const defaultSettings: Settings = {
  theme: 'wincode-dark',
  accent: '#9333EA',
  fontSize: 13,
  fontFamily: "'JetBrains Mono', Consolas, monospace",
  autoSave: true,
  minimap: true,
  wordWrap: false,
  tabSize: 4,
  aiInline: true,
  jdtPath: '',
  javaHome: '',
  azureClientId: '',
  defaultShell: 'powershell',
  launcherRam: 4096
}

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback } catch { return fallback }
}

export type SideView = 'explorer' | 'search' | 'git' | 'minecraft' | 'accounts' | 'plugins' | 'run'
export type BottomTab = 'terminal' | 'output' | 'problems'

interface State {
  // project
  projectRoot: string | null
  tree: FileNode[]
  recentProjects: string[]
  // editor
  tabs: Tab[]
  activeTab: string | null
  // layout
  sideView: SideView
  showSide: boolean
  showAi: boolean
  showBottom: boolean
  bottomTab: BottomTab
  showSettings: boolean
  showWelcome: boolean
  sideWidth: number
  aiWidth: number
  bottomHeight: number
  // settings & ai
  settings: Settings
  ai: AiProviderConfig
  // output/build
  output: OutputLine[]
  building: string | null
  accounts: McAccount[]
  activeAccountId: string | null
  statusMsg: string

  set: (p: Partial<State>) => void
  setSettings: (p: Partial<Settings>) => void
  setAi: (p: Partial<AiProviderConfig>) => void
  log: (text: string, kind?: OutputLine['kind']) => void
  openProject: (root: string) => Promise<void>
  refreshTree: () => Promise<void>
  openFile: (path: string) => void
  closeTab: (path: string) => void
  setDirty: (path: string, dirty: boolean) => void
}

let outId = 0

export const useStore = create<State>((set, get) => ({
  projectRoot: null,
  tree: [],
  recentProjects: JSON.parse(localStorage.getItem('wc.recent') || '[]'),
  tabs: [],
  activeTab: null,
  sideView: 'explorer',
  showSide: true,
  showAi: true,
  showBottom: true,
  bottomTab: 'terminal',
  showSettings: false,
  showWelcome: true,
  sideWidth: 270,
  aiWidth: 400,
  bottomHeight: 240,
  settings: load('wc.settings', defaultSettings),
  ai: load<AiProviderConfig>('wc.ai', { provider: 'ollama', model: 'qwen2.5-coder:14b', baseUrl: PROVIDERS.ollama.baseUrl, apiKey: '', temperature: 0.3, maxTokens: 8192 }),
  output: [{ id: 0, text: 'WinCode AI готов. Откройте проект или создайте новый через меню Файл.', kind: 'sys' }],
  building: null,
  accounts: JSON.parse(localStorage.getItem('wc.accounts') || '[]'),
  activeAccountId: localStorage.getItem('wc.activeAccount'),
  statusMsg: 'Готово',

  set: p => set(p),
  setSettings: p => {
    const s = { ...get().settings, ...p }
    localStorage.setItem('wc.settings', JSON.stringify(s))
    set({ settings: s })
  },
  setAi: p => {
    let ai = { ...get().ai, ...p }
    if (p.provider && p.provider !== get().ai.provider) {
      const d = PROVIDERS[p.provider as ProviderId]
      ai = { ...ai, baseUrl: d.baseUrl, model: d.models[0] }
      window.api.secret.get(`ai:${p.provider}`).then((k: string) => get().setAi({ apiKey: k || '' })).catch(() => {})
    }
    if (typeof p.apiKey === 'string') window.api.secret.set(`ai:${ai.provider}`, p.apiKey).catch(() => {})
    const { apiKey, ...persist } = ai
    localStorage.setItem('wc.ai', JSON.stringify(persist))
    set({ ai })
  },
  log: (text, kind = 'out') => set(s => ({ output: [...s.output.slice(-1500), ...text.split('\n').map(t => ({ id: ++outId, text: t, kind }))] })),
  openProject: async root => {
    set({ projectRoot: root, showWelcome: false, tabs: [], activeTab: null, statusMsg: 'Индексирование проекта…' })
    const recent = [root, ...get().recentProjects.filter(r => r !== root)].slice(0, 10)
    localStorage.setItem('wc.recent', JSON.stringify(recent))
    set({ recentProjects: recent })
    get().log(`Проект открыт: ${root}`, 'sys')
    await get().refreshTree()
    try {
      const idx: any = await window.api.project.index(root)
      get().log(`AI Project Memory: проиндексировано файлов — ${idx.files.length}. Индекс сохранён в .wincode/index.json`, 'sys')
      set({ statusMsg: 'Готово' })
    } catch (e: any) {
      get().log(`Индексирование не удалось: ${e.message}`, 'err')
      set({ statusMsg: 'Готово' })
    }
  },
  refreshTree: async () => {
    const root = get().projectRoot
    if (!root) return
    try { set({ tree: await window.api.fs.tree(root) }) } catch (e: any) { get().log(`Проводник: ${e.message}`, 'err') }
  },
  openFile: path => {
    const name = path.split(/[\\/]/).pop() || path
    set(s => ({
      tabs: s.tabs.some(t => t.path === path) ? s.tabs : [...s.tabs, { path, name, dirty: false }],
      activeTab: path
    }))
  },
  closeTab: path => {
    set(s => {
      const tabs = s.tabs.filter(t => t.path !== path)
      return { tabs, activeTab: s.activeTab === path ? (tabs[tabs.length - 1]?.path ?? null) : s.activeTab }
    })
  },
  setDirty: (path, dirty) => set(s => ({ tabs: s.tabs.map(t => (t.path === path ? { ...t, dirty } : t)) }))
}))

export function saveAccounts(accounts: McAccount[], activeId: string | null) {
  localStorage.setItem('wc.accounts', JSON.stringify(accounts.map(a => ({ ...a, accessToken: undefined }))))
  if (activeId) localStorage.setItem('wc.activeAccount', activeId)
  else localStorage.removeItem('wc.activeAccount')
  useStore.setState({ accounts, activeAccountId: activeId })
}
