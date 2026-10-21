import React, { useEffect, useState } from 'react'
import { Search, GitBranch, GitCommitHorizontal, ArrowUp, ArrowDown, History, Play, Hammer, Bug, Package, Square, FlaskConical, Puzzle, Check } from 'lucide-react'
import { useStore } from '../store'
import { gotoLine } from './EditorPane'

/* ---------------- Search ---------------- */
export function SearchPanel() {
  const { projectRoot } = useStore()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  async function run() {
    if (!projectRoot || !q.trim()) return
    setBusy(true)
    try { setHits(await window.api.project.search(projectRoot, q.trim())) } finally { setBusy(false) }
  }
  return (
    <div className="h-full flex flex-col p-3 gap-2">
      <div className="text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold">Поиск по проекту</div>
      <div className="flex items-center gap-1.5 bg-[#14141F] border border-(--color-border) rounded-lg px-2 py-1.5 focus-within:border-(--color-accent2)">
        <Search size={13} className="text-(--color-muted)" />
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Текст для поиска…" className="flex-1 bg-transparent outline-none text-[12.5px]" />
      </div>
      <button onClick={run} disabled={busy} className="text-[12px] bg-(--color-accent) hover:bg-(--color-accent2) text-white rounded-lg py-1.5 disabled:opacity-50">{busy ? 'Поиск…' : 'Найти'}</button>
      <div className="flex-1 overflow-auto min-h-0 space-y-0.5">
        {hits.map((h, i) => (
          <button key={i} onClick={() => gotoLine(h.file, h.line)} className="block w-full text-left px-2 py-1 rounded hover:bg-(--color-hover)">
            <div className="text-[11.5px] text-(--color-accent2) truncate">{h.rel}:{h.line}</div>
            <div className="text-[11.5px] truncate text-[#C9CAD6] font-mono">{h.text}</div>
          </button>
        ))}
        {hits.length === 0 && <div className="text-[12px] text-(--color-muted)">Semantic-поиск выполняет AI: индекс проекта хранится в .wincode/index.json и подмешивается агенту автоматически.</div>}
      </div>
    </div>
  )
}

/* ---------------- Git ---------------- */
export function GitPanel() {
  const { projectRoot, log } = useStore()
  const [status, setStatus] = useState('')
  const [branch, setBranch] = useState('')
  const [msg, setMsg] = useState('')
  const [history, setHistory] = useState('')

  async function refresh() {
    if (!projectRoot) return
    const s = await window.api.git(projectRoot, ['status', '--short'])
    const b = await window.api.git(projectRoot, ['branch', '--show-current'])
    setStatus(s.code === 0 ? s.output : 'Не git-репозиторий')
    setBranch(b.output.trim())
  }
  useEffect(() => { refresh() }, [projectRoot])

  async function g(args: string[], label: string) {
    if (!projectRoot) return
    const r = await window.api.git(projectRoot, args)
    log(`git ${label}: ${r.output.trim() || (r.code === 0 ? 'OK' : 'ошибка')}`, r.code === 0 ? 'sys' : 'err')
    useStore.getState().set({ showBottom: true, bottomTab: 'output' })
    refresh()
  }

  if (!projectRoot) return <div className="p-3 text-[12.5px] text-(--color-muted)">Откройте проект для работы с Git.</div>
  const files = status.split('\n').filter(Boolean)
  return (
    <div className="h-full flex flex-col p-3 gap-2 overflow-auto">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold"><GitBranch size={13} /> Git {branch && <span className="text-(--color-accent2) normal-case">· {branch}</span>}</div>
      {status === 'Не git-репозиторий' ? (
        <button onClick={() => g(['init'], 'init')} className="text-[12.5px] bg-(--color-accent) text-white rounded-lg py-2">Инициализировать репозиторий</button>
      ) : (<>
        <div className="text-[12px] space-y-0.5 max-h-56 overflow-auto">
          {files.length === 0 && <div className="text-(--color-muted) flex items-center gap-1"><Check size={13} className="text-emerald-400" /> Нет изменений</div>}
          {files.map((f, i) => <div key={i} className="font-mono truncate"><span className={f.startsWith('??') ? 'text-emerald-300' : 'text-amber-300'}>{f.slice(0, 2)}</span> {f.slice(3)}</div>)}
        </div>
        <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Сообщение коммита…" className="bg-[#14141F] border border-(--color-border) rounded-lg px-2 py-1.5 text-[12.5px] outline-none focus:border-(--color-accent2)" />
        <button onClick={async () => { await window.api.git(projectRoot, ['add', '-A']); g(['commit', '-m', msg || 'Update'], 'commit'); setMsg('') }} className="flex items-center justify-center gap-1.5 text-[12.5px] bg-(--color-accent) hover:bg-(--color-accent2) text-white rounded-lg py-1.5"><GitCommitHorizontal size={14} /> Stage All + Commit</button>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => g(['push'], 'push')} className="flex items-center justify-center gap-1 text-[12px] bg-(--color-hover) rounded-lg py-1.5 hover:bg-(--color-selected)"><ArrowUp size={13} /> Push</button>
          <button onClick={() => g(['pull'], 'pull')} className="flex items-center justify-center gap-1 text-[12px] bg-(--color-hover) rounded-lg py-1.5 hover:bg-(--color-selected)"><ArrowDown size={13} /> Pull</button>
          <button onClick={async () => { const n = prompt('Имя новой ветки:'); if (n) g(['checkout', '-b', n], 'branch') }} className="flex items-center justify-center gap-1 text-[12px] bg-(--color-hover) rounded-lg py-1.5 hover:bg-(--color-selected)"><GitBranch size={13} /> Новая ветка</button>
          <button onClick={async () => { const r = await window.api.git(projectRoot, ['log', '--oneline', '-20']); setHistory(r.output) }} className="flex items-center justify-center gap-1 text-[12px] bg-(--color-hover) rounded-lg py-1.5 hover:bg-(--color-selected)"><History size={13} /> История</button>
        </div>
        {history && <pre className="text-[11px] bg-[#14141F] border border-(--color-border) rounded-lg p-2 overflow-auto font-mono">{history}</pre>}
      </>)}
    </div>
  )
}

/* ---------------- Run / Build ---------------- */
let runSeq = 0
export async function detectBuild(root: string) {
  const has = async (f: string) => window.api.fs.exists(`${root}/${f}`).catch(() => false)
  const win = navigator.platform.startsWith('Win')
  if (await has('build.gradle') || await has('build.gradle.kts'))
    return { kind: 'Gradle', build: win ? '.\\gradlew.bat build --console=plain' : './gradlew build --console=plain', run: win ? '.\\gradlew.bat runClient --console=plain' : './gradlew runClient --console=plain', test: win ? '.\\gradlew.bat test --console=plain' : './gradlew test --console=plain', clean: win ? '.\\gradlew.bat clean' : './gradlew clean' }
  if (await has('pom.xml')) return { kind: 'Maven', build: 'mvn -DskipTests package', run: 'mvn package exec:java', test: 'mvn test', clean: 'mvn clean' }
  if (await has('package.json')) return { kind: 'npm', build: 'npm run build', run: 'npm run dev', test: 'npm test', clean: 'npm run clean' }
  if (await has('Cargo.toml')) return { kind: 'Cargo', build: 'cargo build', run: 'cargo run', test: 'cargo test', clean: 'cargo clean' }
  if (await has('CMakeLists.txt')) return { kind: 'CMake', build: 'cmake -B build && cmake --build build', run: '', test: '', clean: '' }
  return null
}

export function runCommand(cmd: string, cwd: string, label?: string) {
  const st = useStore.getState()
  const id = `run-${++runSeq}`
  st.set({ showBottom: true, bottomTab: 'output', building: label || cmd })
  st.log(`▶ ${cmd}   (в ${cwd})`, 'sys')
  const started = Date.now()
  window.api.proc.run(id, cmd, cwd)
  ;(window as any).__wcRunning = id
  const offExit = window.api.proc.onExit(({ id: eid, code }: any) => {
    if (eid !== id) return
    const secs = ((Date.now() - started) / 1000).toFixed(1)
    st.log(code === 0 ? `✓ Завершено успешно за ${secs} с` : `✗ Завершено с кодом ${code} за ${secs} с. Кнопка «Fix with AI» в чате поможет исправить ошибки.`, code === 0 ? 'sys' : 'err')
    st.set({ building: null, statusMsg: code === 0 ? 'Сборка успешна' : 'Ошибка сборки' })
    offExit?.()
  })
  return id
}

export function RunPanel() {
  const { projectRoot, building, log } = useStore()
  const [sys, setSys] = useState<any>(null)
  const [custom, setCustom] = useState('')

  useEffect(() => { if (projectRoot) detectBuild(projectRoot).then(setSys) }, [projectRoot])
  if (!projectRoot) return <div className="p-3 text-[12.5px] text-(--color-muted)">Откройте проект.</div>

  const btn = 'flex items-center justify-center gap-1.5 text-[12.5px] rounded-lg py-2 transition'
  return (
    <div className="h-full flex flex-col p-3 gap-2 overflow-auto">
      <div className="text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold">Запуск и сборка {sys && <span className="text-(--color-accent2) normal-case">· {sys.kind}</span>}</div>
      {sys ? (<>
        <button className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`} onClick={() => runCommand(sys.run || sys.build, projectRoot, 'RUN')}><Play size={14} /> RUN {sys.kind === 'Gradle' ? '(runClient / run)' : ''}</button>
        <button className={`${btn} bg-(--color-accent) hover:bg-(--color-accent2) text-white`} onClick={() => runCommand(sys.build, projectRoot, 'BUILD')}><Hammer size={14} /> BUILD</button>
        <div className="grid grid-cols-2 gap-1.5">
          <button className={`${btn} bg-(--color-hover) hover:bg-(--color-selected)`} onClick={() => runCommand(sys.test || sys.build, projectRoot, 'TEST')}><FlaskConical size={13} /> TEST</button>
          <button className={`${btn} bg-(--color-hover) hover:bg-(--color-selected)`} onClick={() => runCommand(sys.clean || sys.build, projectRoot, 'PACKAGE')}><Package size={13} /> CLEAN</button>
        </div>
        <button className={`${btn} bg-(--color-hover) hover:bg-(--color-selected)`}
          onClick={() => window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'DEBUG', text: 'Собери проект, проанализируй ошибки компиляции из последнего вывода сборки и исправь их полностью.' } }))}>
          <Bug size={13} /> Fix with AI (DEBUG)
        </button>
        {building && <button className={`${btn} bg-red-600/80 text-white`} onClick={() => { const id = (window as any).__wcRunning; if (id) window.api.proc.kill(id) }}><Square size={13} /> STOP</button>}
        <div className="text-[11.5px] text-(--color-muted)">Отладка (DAP): для Java используйте запуск с `-agentlib:jdwp` через поле ниже и подключайте свой debug-клиент; точки останова в редакторе поддерживаются в полной версии Java LS. Текущий статус DAP-моста честно отмечен в Plugin Manager.</div>
      </>) : <div className="text-[12px] text-(--color-muted)">Система сборки не определена (нет build.gradle / pom.xml / package.json / Cargo.toml). Используйте произвольную команду ниже или попросите AI настроить Gradle.</div>}
      <div className="border-t border-(--color-border) pt-2 mt-1">
        <div className="text-[11.5px] text-(--color-muted) mb-1">Произвольная команда:</div>
        <div className="flex gap-1.5">
          <input value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && custom && runCommand(custom, projectRoot)} placeholder="java -version, python main.py…" className="flex-1 bg-[#14141F] border border-(--color-border) rounded-lg px-2 py-1.5 text-[12.5px] outline-none min-w-0 font-mono" />
          <button className="px-3 rounded-lg bg-(--color-accent) text-white text-[12.5px]" onClick={() => custom && runCommand(custom, projectRoot)}>Run</button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Plugins ---------------- */
const PLUGINS = [
  { name: 'Monaco Language Pack', desc: 'Подсветка и IntelliSense для Java, Kotlin, Python, TS/JS, C++, C#, Rust, Go, SQL, YAML и др.', status: 'Встроено', on: true },
  { name: 'TypeScript / JSON / CSS / HTML Language Services', desc: 'Полные языковые сервисы Monaco (автодополнение, диагностика, hover, форматирование).', status: 'Встроено', on: true },
  { name: 'Eclipse JDT Language Server (Java)', desc: 'Процесс JDT LS запускается из настроек Java. Полный мост LSP↔Monaco (references/rename по проекту) в разработке.', status: 'Частично', on: true },
  { name: 'Kotlin Language Server', desc: 'Планируется подключение fwcd/kotlin-language-server аналогично JDT LS.', status: 'В разработке', on: false },
  { name: 'AI Inline Completion', desc: 'Ghost-text от вашей модели (Tab — принять). Включается в настройках редактора.', status: 'Встроено', on: true },
  { name: 'Minecraft Tools', desc: 'Генераторы Fabric/Forge/NeoForge/Paper, Launcher Builder, аккаунты Offline/Microsoft.', status: 'Встроено', on: true },
  { name: 'AI Providers: OpenAI / Claude / Gemini / OpenRouter / Ollama / LM Studio', desc: 'Настоящие streaming API-подключения из настроек AI.', status: 'Встроено', on: true },
  { name: 'Debug Adapter Protocol bridge', desc: 'Планируется: Java Debug Server / Python debugpy через DAP.', status: 'В разработке', on: false },
  { name: 'node-pty (полный PTY)', desc: 'Сейчас терминал работает через настоящий процесс PowerShell/cmd (pipe). PTY-версия в разработке — требует native-сборки.', status: 'Частично', on: true }
]
export function PluginsPanel() {
  return (
    <div className="h-full flex flex-col p-3 gap-2 overflow-auto">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold"><Puzzle size={13} /> Plugin Manager</div>
      <div className="text-[11.5px] text-(--color-muted)">Честные статусы модулей: ничего не имитируется.</div>
      {PLUGINS.map((p, i) => (
        <div key={i} className="border border-(--color-border) rounded-lg p-2.5 bg-[#12121D]">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-medium flex-1">{p.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.status === 'Встроено' ? 'bg-emerald-500/15 text-emerald-300' : p.status === 'Частично' ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-500/15 text-zinc-300'}`}>{p.status}</span>
          </div>
          <div className="text-[11.5px] text-(--color-muted) mt-1 leading-snug">{p.desc}</div>
        </div>
      ))}
    </div>
  )
}
