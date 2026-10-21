import React, { useEffect, useRef, useState } from 'react'
import { Files, Search, GitBranch, Gamepad2, Users, Puzzle, PlayCircle, Settings, Bot, FolderOpen } from 'lucide-react'
import { useStore, type SideView } from './store'
import { TitleBar, Welcome, GuiBuilder } from './components/Chrome'
import Explorer from './components/Explorer'
import EditorPane, { getEditor } from './components/EditorPane'
import AiPanel from './components/AiPanel'
import BottomPanel from './components/BottomPanel'
import SettingsModal from './components/SettingsModal'
import { SearchPanel, GitPanel, RunPanel, PluginsPanel } from './components/SidePanels'
import { MinecraftPanel, AccountsPanel } from './components/Minecraft'

const ACTIVITY: { id: SideView; icon: any; title: string }[] = [
  { id: 'explorer', icon: Files, title: 'Проводник (Ctrl+Shift+E)' },
  { id: 'search', icon: Search, title: 'Поиск по проекту' },
  { id: 'git', icon: GitBranch, title: 'Git' },
  { id: 'run', icon: PlayCircle, title: 'Запуск и сборка' },
  { id: 'minecraft', icon: Gamepad2, title: 'Minecraft Development Center' },
  { id: 'accounts', icon: Users, title: 'Minecraft Accounts: Offline / Microsoft' },
  { id: 'plugins', icon: Puzzle, title: 'Plugin Manager' }
]

function Resizer({ onDelta, vertical }: { onDelta: (d: number) => void; vertical?: boolean }) {
  const start = useRef<number | null>(null)
  return (
    <div
      className={`${vertical ? 'h-1 cursor-row-resize w-full' : 'w-1 cursor-col-resize h-full'} shrink-0 hover:bg-(--color-accent2)/60 transition-colors z-20`}
      onMouseDown={e => {
        start.current = vertical ? e.clientY : e.clientX
        const move = (ev: MouseEvent) => {
          if (start.current == null) return
          const cur = vertical ? ev.clientY : ev.clientX
          onDelta(cur - start.current)
          start.current = cur
        }
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); start.current = null }
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
      }}
    />
  )
}

function QuickOpen({ mode, onClose }: { mode: 'file' | 'command'; onClose: () => void }) {
  const st = useStore()
  const [q, setQ] = useState('')
  const [files, setFiles] = useState<{ rel: string; path: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    if (mode === 'file' && st.projectRoot) {
      window.api.fs.read(`${st.projectRoot}/.wincode/index.json`).then((raw: string) => {
        const idx = JSON.parse(raw)
        setFiles(idx.files.map((f: any) => ({ rel: f.path, path: `${st.projectRoot}/${f.path}` })))
      }).catch(() => {})
    }
  }, [])

  const commands = [
    { label: 'WinCode AI: объяснить проект', run: () => window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'ASK', text: 'Проанализируй архитектуру моего проекта по индексу и ключевым файлам.' } })) },
    { label: 'WinCode AI: исправить ошибки сборки', run: () => window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'DEBUG', text: 'Исправь все ошибки компиляции проекта.' } })) },
    { label: 'Переиндексировать проект (AI Memory)', run: async () => { if (st.projectRoot) { await window.api.project.index(st.projectRoot); st.log('Индекс проекта обновлён.', 'sys') } } },
    { label: 'Открыть настройки', run: () => st.set({ showSettings: true }) },
    { label: 'Minecraft Development Center', run: () => st.set({ showSide: true, sideView: 'minecraft' }) },
    { label: 'Показать/скрыть терминал', run: () => st.set({ showBottom: !st.showBottom }) },
    { label: 'Показать/скрыть AI-панель', run: () => st.set({ showAi: !st.showAi }) },
    { label: 'Стартовый экран', run: () => st.set({ showWelcome: true }) }
  ]

  const filteredFiles = files.filter(f => f.rel.toLowerCase().includes(q.toLowerCase())).slice(0, 40)
  const filteredCmds = commands.filter(c => c.label.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex justify-center pt-24" onClick={onClose}>
      <div className="w-[560px] max-w-[92vw] h-fit bg-[#151524] border border-(--color-border) rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder={mode === 'file' ? 'Имя файла…' : 'Команда…'}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter') {
              if (mode === 'file' && filteredFiles[0]) { st.openFile(filteredFiles[0].path); onClose() }
              if (mode === 'command' && filteredCmds[0]) { filteredCmds[0].run(); onClose() }
            }
          }}
          className="w-full bg-transparent px-4 py-3 text-[14px] outline-none border-b border-(--color-border)" />
        <div className="max-h-[46vh] overflow-auto py-1">
          {mode === 'file' ? filteredFiles.map((f, i) => (
            <button key={i} className="block w-full text-left px-4 py-1.5 text-[13px] hover:bg-(--color-selected)" onClick={() => { st.openFile(f.path); onClose() }}>
              <span>{f.rel.split('/').pop()}</span> <span className="text-(--color-muted) text-[11.5px]">{f.rel}</span>
            </button>
          )) : filteredCmds.map((c, i) => (
            <button key={i} className="block w-full text-left px-4 py-1.5 text-[13px] hover:bg-(--color-selected)" onClick={() => { c.run(); onClose() }}>{c.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const st = useStore()
  const [quick, setQuick] = useState<'file' | 'command' | null>(null)
  const [guiBuilder, setGuiBuilder] = useState(false)
  const [branch, setBranch] = useState('')

  useEffect(() => {
    // restore encrypted API key for current provider
    window.api.secret.get(`ai:${useStore.getState().ai.provider}`).then((k: string) => { if (k) useStore.getState().setAi({ apiKey: k }) }).catch(() => {})
    const onAction = (e: any) => getEditor()?.getAction(e.detail)?.run()
    window.addEventListener('wincode:editor-action', onAction)
    const keys = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); setQuick(e.shiftKey ? 'command' : 'file') }
      else if (mod && e.key === '`') { st.set({ showBottom: !st.showBottom, bottomTab: 'terminal' }) }
      else if (mod && e.key.toLowerCase() === 'j') st.set({ showBottom: !st.showBottom })
      else if (mod && e.key.toLowerCase() === 'b') st.set({ showSide: !st.showSide })
      else if (mod && e.key === ',') st.set({ showSettings: true })
      else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); window.api.dialog.openFolder().then(d => d && st.openProject(d)) }
    }
    window.addEventListener('keydown', keys)
    return () => { window.removeEventListener('wincode:editor-action', onAction); window.removeEventListener('keydown', keys) }
  }, [])

  useEffect(() => {
    if (!st.projectRoot) { setBranch(''); return }
    window.api.git(st.projectRoot, ['branch', '--show-current']).then(r => setBranch(r.output.trim())).catch(() => {})
  }, [st.projectRoot, st.tree])

  const sideContent = {
    explorer: <Explorer />, search: <SearchPanel />, git: <GitPanel />, run: <RunPanel />,
    minecraft: <MinecraftPanel />, accounts: <AccountsPanel />, plugins: <PluginsPanel />
  }[st.sideView]

  const activeAccount = st.accounts.find(a => a.id === st.activeAccountId)

  return (
    <div className="h-full flex flex-col bg-(--color-bg) relative">
      <TitleBar onOpenGuiBuilder={() => setGuiBuilder(true)} />

      <div className="flex flex-1 min-h-0">
        {/* activity bar */}
        <div className="w-12 bg-(--color-panel) border-r border-(--color-border) flex flex-col items-center py-2 gap-1 shrink-0 z-20">
          {ACTIVITY.map(a => (
            <button key={a.id} title={a.title}
              onClick={() => st.set({ sideView: a.id, showSide: st.sideView === a.id ? !st.showSide : true, showWelcome: false })}
              className={`relative p-2.5 rounded-xl transition ${st.sideView === a.id && st.showSide ? 'text-(--color-accent2) bg-(--color-selected)' : 'text-(--color-muted) hover:text-white hover:bg-(--color-hover)'}`}>
              {st.sideView === a.id && st.showSide && <span className="absolute left-[-9px] top-2 bottom-2 w-0.5 bg-(--color-accent2) rounded" />}
              <a.icon size={19} />
            </button>
          ))}
          <div className="flex-1" />
          <button title="WinCode Intelligence" onClick={() => st.set({ showAi: !st.showAi })}
            className={`p-2.5 rounded-xl ${st.showAi ? 'text-(--color-accent2) bg-(--color-selected)' : 'text-(--color-muted) hover:text-white hover:bg-(--color-hover)'}`}><Bot size={19} /></button>
          <button title="Настройки (Ctrl+,)" onClick={() => st.set({ showSettings: true })}
            className="p-2.5 rounded-xl text-(--color-muted) hover:text-white hover:bg-(--color-hover)"><Settings size={19} /></button>
        </div>

        {/* side panel */}
        {st.showSide && (<>
          <div className="bg-(--color-panel) shrink-0 min-h-0 overflow-hidden" style={{ width: st.sideWidth }}>{sideContent}</div>
          <Resizer onDelta={d => st.set({ sideWidth: Math.min(520, Math.max(200, st.sideWidth + d)) })} />
        </>)}

        {/* center */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          <div className="flex-1 min-h-0 relative">
            <EditorPane />
          </div>
          {st.showBottom && (<>
            <Resizer vertical onDelta={d => st.set({ bottomHeight: Math.min(560, Math.max(110, st.bottomHeight - d)) })} />
            <div className="shrink-0" style={{ height: st.bottomHeight }}><BottomPanel /></div>
          </>)}
        </div>

        {/* AI panel */}
        {st.showAi && (<>
          <Resizer onDelta={d => st.set({ aiWidth: Math.min(720, Math.max(300, st.aiWidth - d)) })} />
          <div className="shrink-0 min-h-0" style={{ width: st.aiWidth }}><AiPanel /></div>
        </>)}
      </div>

      {/* status bar */}
      <div className="h-6.5 bg-[#0C0C15] border-t border-(--color-border) flex items-center px-3 gap-4 text-[11.5px] text-(--color-muted) shrink-0 py-0.5">
        <span className="flex items-center gap-1"><FolderOpen size={11} /> {st.projectRoot ? st.projectRoot.split(/[\\/]/).pop() : 'Нет проекта'}</span>
        {branch && <span className="flex items-center gap-1"><GitBranch size={11} /> {branch}</span>}
        {activeAccount && <span>{activeAccount.type === 'microsoft' ? '🟦' : '⬜'} {activeAccount.username}</span>}
        <span>{st.building ? `⚙ ${st.building}…` : st.statusMsg}</span>
        <div className="flex-1" />
        <button className="hover:text-white" onClick={() => st.set({ showSettings: true })}>AI: {st.ai.model}</button>
        <span>UTF-8</span>
        <span>WinCode AI 1.0</span>
      </div>

      {st.showWelcome && <Welcome />}
      {st.showSettings && <SettingsModal />}
      {quick && <QuickOpen mode={quick} onClose={() => setQuick(null)} />}
      {guiBuilder && <GuiBuilder onClose={() => setGuiBuilder(false)} />}
    </div>
  )
}
