import React, { useEffect, useRef, useState } from 'react'
import { Send, Square, Sparkles, Check, X, RefreshCw, FileCode2, Hammer, Trash2, Eye, Play, ChevronDown } from 'lucide-react'
import { useStore } from '../store'
import { PROVIDERS, type AiMode, type ChatMessage, type ProposedFile } from '@shared/types'
import { getEditor } from './EditorPane'
import DiffModal from './DiffModal'

interface UiMsg { id: number; role: 'user' | 'assistant' | 'system'; content: string; files?: ProposedFile[]; applied?: boolean }
let mid = 0
let reqCounter = 0

const SYSTEM = `Ты — WinCode Intelligence, элитный AI-инженер внутри IDE WinCode AI. Специализация: Java 21, Kotlin, Minecraft (Fabric/Forge/NeoForge/Paper), Mixin, Gradle/Maven, лаунчеры Minecraft (Offline UUID по стандарту ваниллы; Microsoft — только официальный OAuth Device Code + Xbox Live + XSTS + Minecraft Services), Python, TypeScript, C++, C#.
Правила режима изменения файлов (EDIT/AGENT/AUTOPILOT):
- Каждый файл, который нужно создать или изменить, возвращай ЦЕЛИКОМ в блоке вида:
\`\`\`file:относительный/путь/Файл.java
<полное содержимое файла>
\`\`\`
- Пути относительные от корня проекта. Не используй "..." и сокращения — только полный рабочий код.
- Сначала краткий план, затем файлы. Код должен компилироваться: проверяй импорты, сигнатуры Fabric/Yarn 1.21.x, Gradle-конфигурацию.
- Для Gradle используй Fabric Loom 1.9+, Java 21, актуальные версии зависимостей.
Отвечай на русском, код и идентификаторы — на английском.`

const MODES: { id: AiMode; label: string; hint: string }[] = [
  { id: 'ASK', label: 'Ask', hint: 'Только ответы, без изменения файлов' },
  { id: 'EDIT', label: 'Edit', hint: 'Предлагает изменения файлов, вы применяете вручную' },
  { id: 'AGENT', label: 'Agent', hint: 'План → файлы → применение → сборка → авто-исправление ошибок' },
  { id: 'PLAN', label: 'Plan', hint: 'Составляет подробный план архитектуры' },
  { id: 'DEBUG', label: 'Debug', hint: 'Анализирует ошибки/лог и чинит их' },
  { id: 'AUTOPILOT', label: 'Autopilot', hint: 'Полная автономия: применяет и собирает без вопросов (кроме удалений)' }
]

function extractFiles(text: string): ProposedFile[] {
  const out: ProposedFile[] = []
  const re = /```file:([^\n`]+)\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text))) out.push({ path: m[1].trim(), content: m[2].replace(/\n$/, ''), exists: false })
  return out
}

function renderMd(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let html = esc(text)
  html = html.replace(/```file:([^\n]+)\n[\s\S]*?```/g, (_m, p) => `\n<span style="color:#A855F7">📄 файл: ${p} (см. список ниже)</span>\n`)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _l, code) => `<pre><code>${code}</code></pre>`)
  html = html.replace(/`([^`\n]+)`/g, '<code style="background:#1C1C2E;padding:0 4px;border-radius:4px">$1</code>')
  html = html.replace(/^### (.*)$/gm, '<div style="font-weight:600;margin-top:8px">$1</div>')
  html = html.replace(/^## (.*)$/gm, '<div style="font-weight:700;font-size:15px;margin-top:10px">$1</div>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/^- (.*)$/gm, '• $1')
  html = html.replace(/\n/g, '<br/>')
  return html
}

export default function AiPanel() {
  const { ai, setAi, projectRoot, activeTab, log, settings } = useStore()
  const [mode, setMode] = useState<AiMode>('AGENT')
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<UiMsg[]>([
    { id: ++mid, role: 'assistant', content: 'Привет! Я — **WinCode Intelligence**. Могу создать проект с нуля (например: *«Создай Minecraft Visual Client для Fabric 1.21.4 с ClickGUI и HUD»*), исправить ошибки сборки, написать Java/Kotlin/Python код или проанализировать весь проект. Настройте модель справа вверху или в Настройках → AI (поддерживаются OpenAI, Claude, Gemini, OpenRouter, Ollama, LM Studio).' }
  ])
  const [streaming, setStreaming] = useState<string | null>(null)
  const [steps, setSteps] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [diffFile, setDiffFile] = useState<ProposedFile | null>(null)
  const [showModels, setShowModels] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentReq = useRef<string>('')
  const lastPrompt = useRef<string>('')

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [msgs, streaming, steps])

  useEffect(() => {
    const off1 = window.api.ai.onChunk(({ reqId, chunk }: any) => { if (reqId === currentReq.current) setStreaming(s => (s ?? '') + chunk) })
    const ask = (e: any) => { if (e.detail?.text) { setMode(e.detail.mode || 'EDIT'); send(e.detail.text, e.detail.mode || 'EDIT') } }
    window.addEventListener('wincode:ai-ask', ask)
    const promptEv = (e: any) => { if (e.detail?.text) setInput(e.detail.text) }
    window.addEventListener('wincode:ai-prompt', promptEv)
    return () => { off1?.(); window.removeEventListener('wincode:ai-ask', ask); window.removeEventListener('wincode:ai-prompt', promptEv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, projectRoot, msgs])

  const needsKey = PROVIDERS[ai.provider].needsKey && !ai.apiKey

  async function buildContext(userText: string): Promise<string> {
    const parts: string[] = []
    const ed = getEditor()
    const model = ed?.getModel()
    if (projectRoot) {
      parts.push(`Корень проекта: ${projectRoot}`)
      try {
        const idxRaw = await window.api.fs.read(`${projectRoot}/.wincode/index.json`).catch(() => '')
        if (idxRaw) {
          const idx = JSON.parse(idxRaw)
          parts.push(`Структура проекта (${idx.files.length} файлов, символы):\n` + idx.files.slice(0, 250).map((f: any) => `- ${f.path}${f.symbols.length ? ' [' + f.symbols.slice(0, 8).join(', ') + ']' : ''}`).join('\n'))
        }
        const rel: any[] = await window.api.project.relevant(projectRoot, userText)
        for (const r of rel) parts.push(`\n--- Файл ${r.path} ---\n${r.content}`)
      } catch { /* index optional */ }
    }
    if (activeTab && model) {
      const rel = projectRoot ? activeTab.slice(projectRoot.length + 1) : activeTab
      parts.push(`\n--- Открытый файл ${rel} ---\n${model.getValue().slice(0, 16000)}`)
      const sel = ed.getSelection()
      if (sel && !sel.isEmpty()) parts.push(`\n--- Выделенный код ---\n${model.getValueInRange(sel)}`)
    }
    return parts.join('\n')
  }

  async function send(text: string, useMode: AiMode = mode, historyOverride?: UiMsg[]) {
    const prompt = text.trim()
    if (!prompt || busy) return
    if (needsKey) {
      setMsgs(m => [...m, { id: ++mid, role: 'system', content: `⚠️ Для провайдера ${PROVIDERS[ai.provider].label} нужен API-ключ. Откройте Настройки → AI и укажите ключ — или выберите локальную Ollama (работает без интернета и ключа).` }])
      return
    }
    lastPrompt.current = prompt
    setInput('')
    setBusy(true)
    const userMsg: UiMsg = { id: ++mid, role: 'user', content: prompt }
    const hist = historyOverride ?? [...msgs, userMsg]
    setMsgs(hist)
    setSteps(useMode === 'AGENT' || useMode === 'AUTOPILOT' ? ['Анализ запроса и индекса проекта…'] : [])
    setStreaming('')

    const ctx = await buildContext(prompt)
    const modeInstr: Record<AiMode, string> = {
      ASK: 'Режим ASK: отвечай текстом и кодом в обычных блоках, НЕ создавай file:-блоки.',
      EDIT: 'Режим EDIT: все изменения оформляй как file:-блоки целиком.',
      AGENT: 'Режим AGENT: 1) краткий план списком; 2) все файлы как file:-блоки целиком. Я применю их и запущу сборку; если придут ошибки компиляции — исправляй file:-блоками.',
      PLAN: 'Режим PLAN: дай детальный план: архитектура, файлы, зависимости, этапы. Код не пиши.',
      DEBUG: 'Режим DEBUG: найди первопричину ошибки, объясни её и дай исправления file:-блоками целиком.',
      AUTOPILOT: 'Режим AUTOPILOT: как AGENT, но действуй до полностью рабочего результата, минимизируй вопросы.'
    }
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM + '\n' + modeInstr[useMode] },
      ...hist.filter(m => m.role !== 'system').slice(-10).map(m => ({ role: m.role as any, content: m.content.slice(0, 20000) })),
      { role: 'user', content: (ctx ? `[Контекст проекта]\n${ctx}\n\n[Запрос пользователя]\n` : '') + prompt }
    ]

    const reqId = `req-${++reqCounter}`
    currentReq.current = reqId
    try {
      const full: string = await window.api.ai.chat(reqId, ai, messages)
      const files = (useMode !== 'ASK' && useMode !== 'PLAN') ? extractFiles(full) : []
      if (files.length && projectRoot) {
        for (const f of files) f.exists = await window.api.fs.exists(joinPath(projectRoot, f.path)).catch(() => false)
      }
      const asst: UiMsg = { id: ++mid, role: 'assistant', content: full, files }
      const nextHist = [...hist, asst]
      setMsgs(nextHist)
      setStreaming(null)
      if ((useMode === 'AUTOPILOT') && files.length && projectRoot) {
        await applyAndMaybeBuild(asst, files, nextHist, true)
      } else if (files.length) {
        setSteps([`AI предложил ${files.length} файл(ов). Проверьте и нажмите «Применить».`])
      }
    } catch (e: any) {
      setStreaming(null)
      setMsgs(m => [...m, { id: ++mid, role: 'system', content: `❌ ${e.message}` }])
      setSteps([])
    } finally { setBusy(false) }
  }

  function joinPath(root: string, rel: string) {
    return root.replace(/[\\/]$/, '') + '/' + rel.replace(/\\/g, '/').replace(/^\//, '')
  }

  async function applyAndMaybeBuild(msg: UiMsg, files: ProposedFile[], hist: UiMsg[], autoBuild: boolean) {
    if (!projectRoot) { log('Откройте или создайте проект, чтобы применять файлы AI.', 'err'); return }
    setSteps(s => [...s, `Запись ${files.length} файл(ов)…`])
    const map: Record<string, string> = {}
    files.forEach(f => (map[f.path] = f.content))
    await window.api.project.createFiles(projectRoot, map)
    await window.api.project.index(projectRoot).catch(() => {})
    await useStore.getState().refreshTree()
    setMsgs(m => m.map(x => (x.id === msg.id ? { ...x, applied: true } : x)))
    setSteps(s => [...s, 'Файлы применены ✓'])
    const first = files.find(f => /\.(java|kt|py|ts|js)$/.test(f.path))
    if (first) useStore.getState().openFile(joinPath(projectRoot, first.path))
    if (autoBuild) await buildAndFix(hist, 0)
  }

  /** Agent verify loop: run the project build, feed compiler errors back to the model (max 3 rounds). */
  async function buildAndFix(hist: UiMsg[], round: number) {
    if (!projectRoot || round > 2) return
    const isGradle = await window.api.fs.exists(joinPath(projectRoot, 'gradlew.bat')) || await window.api.fs.exists(joinPath(projectRoot, 'build.gradle'))
    const isMaven = await window.api.fs.exists(joinPath(projectRoot, 'pom.xml'))
    const isNpm = await window.api.fs.exists(joinPath(projectRoot, 'package.json'))
    const cmd = isGradle ? (navigator.platform.startsWith('Win') ? '.\\gradlew.bat build --console=plain' : './gradlew build --console=plain')
      : isMaven ? 'mvn -q -DskipTests package' : isNpm ? 'npm run build' : null
    if (!cmd) { setSteps(s => [...s, 'Система сборки не найдена — пропускаю проверку.']); return }
    setSteps(s => [...s, `Сборка${round ? ` (попытка ${round + 1})` : ''}: ${cmd}`])
    useStore.getState().set({ showBottom: true, bottomTab: 'output' })
    log(`AI Agent → ${cmd}`, 'sys')
    const res: { code: number; output: string } = await window.api.proc.exec(cmd, projectRoot)
    log(res.output.slice(-4000), res.code === 0 ? 'out' : 'err')
    if (res.code === 0) {
      setSteps(s => [...s, 'Сборка успешна ✓ Задача завершена.'])
      setMsgs(m => [...m, { id: ++mid, role: 'system', content: '✅ **Сборка прошла успешно.** Проект компилируется — можно запускать (кнопка ▶ в панели «Запуск и сборка» слева или `gradlew runClient` для Minecraft).' }])
    } else {
      setSteps(s => [...s, 'Ошибка компиляции — отправляю лог модели для исправления…'])
      await send(`Сборка завершилась с ошибками (код ${res.code}). Исправь ВСЕ ошибки, вернув изменённые файлы целиком file:-блоками. Лог:\n\n\`\`\`\n${res.output.slice(-7000)}\n\`\`\``, mode, hist)
    }
  }

  const stop = () => { window.api.ai.stop(currentReq.current); setBusy(false); setStreaming(null); setSteps(s => [...s, 'Остановлено пользователем.']) }

  const quick = [
    'Создай Minecraft Visual Client для Fabric 1.21.4: ClickGUI (чёрно-фиолетовый, анимации), HUD Editor, система модулей, конфиги, Gradle',
    'Создай Minecraft Launcher: Offline Account + Microsoft Account (OAuth Device Code), выбор версии, Fabric, настройки RAM, сборка в EXE',
    'Проанализируй мой проект и расскажи его архитектуру',
    'Исправь все ошибки компиляции в проекте'
  ]

  return (
    <div className="flex flex-col h-full bg-(--color-panel) border-l border-(--color-border)">
      {/* header */}
      <div className="flex items-center gap-2 px-3 h-11 border-b border-(--color-border) shrink-0">
        <Sparkles size={16} className="text-(--color-accent2)" />
        <div className="font-semibold text-[13px]">WinCode Intelligence</div>
        <div className="flex-1" />
        <div className="relative">
          <button onClick={() => setShowModels(v => !v)} className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded bg-(--color-hover) hover:bg-(--color-selected) max-w-[180px]">
            <span className="truncate">{PROVIDERS[ai.provider].label} · {ai.model}</span><ChevronDown size={12} />
          </button>
          {showModels && (
            <div className="absolute right-0 top-8 z-50 w-72 bg-[#151524] border border-(--color-border) rounded-lg shadow-2xl p-2 max-h-96 overflow-auto">
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <div key={id} className="mb-1">
                  <div className="text-[11px] text-(--color-muted) px-1.5 py-0.5">{p.label}</div>
                  {p.models.map(m => (
                    <button key={m} onClick={() => { setAi({ provider: id as any, model: m, baseUrl: p.baseUrl }); setShowModels(false) }}
                      className={`block w-full text-left text-[12.5px] px-2 py-1 rounded hover:bg-(--color-selected) ${ai.provider === id && ai.model === m ? 'text-(--color-accent2)' : ''}`}>{m}</button>
                  ))}
                </div>
              ))}
              <div className="text-[11px] text-(--color-muted) px-1.5 pt-1 border-t border-(--color-border)">API-ключи, Base URL и температура — в Настройках → AI.</div>
            </div>
          )}
        </div>
        <button title="Очистить чат" className="p-1.5 rounded hover:bg-(--color-hover) text-(--color-muted)" onClick={() => { setMsgs([]); setSteps([]) }}><Trash2 size={14} /></button>
      </div>

      {/* modes */}
      <div className="flex gap-1 px-3 py-2 border-b border-(--color-border) shrink-0 flex-wrap">
        {MODES.map(m => (
          <button key={m.id} title={m.hint} onClick={() => setMode(m.id)}
            className={`text-[11.5px] px-2.5 py-1 rounded-full border ${mode === m.id ? 'bg-(--color-accent) border-(--color-accent) text-white' : 'border-(--color-border) text-(--color-muted) hover:text-white hover:border-(--color-accent2)'}`}>{m.label}</button>
        ))}
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {msgs.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[96%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-(--color-accent)/85 text-white' : m.role === 'system' ? 'bg-[#1D1B2E] border border-[#34305A] w-full' : 'bg-[#14141F] border border-(--color-border) w-full'}`}>
              {m.role !== 'user' && m.role !== 'system' && <div className="flex items-center gap-1.5 text-[11px] text-(--color-accent2) mb-1"><Sparkles size={11} /> WinCode Intelligence · {ai.model}</div>}
              <div className="md break-words" dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} />
              {m.files && m.files.length > 0 && (
                <div className="mt-2 border border-(--color-border) rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-[#171728] text-[12px]">
                    <FileCode2 size={13} className="text-(--color-accent2)" />
                    <span>{m.applied ? 'Применено' : 'Предложенные файлы'}: {m.files.length}</span>
                    <div className="flex-1" />
                    {!m.applied ? (<>
                      <button className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11.5px]" onClick={() => applyAndMaybeBuild(m, m.files!, msgs, mode === 'AGENT' || mode === 'AUTOPILOT')}><Check size={12} /> Применить</button>
                      <button className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600/60 hover:bg-red-600 text-white text-[11.5px]" onClick={() => setMsgs(x => x.map(y => y.id === m.id ? { ...y, files: [] } : y))}><X size={12} /> Отклонить</button>
                    </>) : <span className="text-emerald-400 text-[11.5px] flex items-center gap-1"><Check size={12} /> записано в проект</span>}
                  </div>
                  <div className="max-h-44 overflow-auto">
                    {m.files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1 text-[12px] hover:bg-(--color-hover)">
                        <span className={`text-[10px] px-1 rounded ${f.exists ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{f.exists ? 'Изменить' : 'Новый'}</span>
                        <span className="truncate flex-1">{f.path}</span>
                        <span className="text-(--color-muted)">{f.content.split('\n').length} строк</span>
                        <button title="Preview Diff" className="p-1 rounded hover:bg-(--color-selected)" onClick={() => setDiffFile(f)}><Eye size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {steps.length > 0 && (
          <div className="border border-[#34305A] bg-[#141228] rounded-xl px-3 py-2 text-[12px] space-y-1">
            <div className="flex items-center gap-1.5 text-(--color-accent2) font-medium"><Hammer size={12} /> Этапы агента</div>
            {steps.map((s, i) => <div key={i} className="flex gap-2"><span className="text-(--color-accent2)">{i === steps.length - 1 && busy ? '●' : '✓'}</span><span>{s}</span></div>)}
          </div>
        )}

        {streaming !== null && (
          <div className="bg-[#14141F] border border-(--color-border) rounded-xl px-3 py-2 text-[13px] w-full">
            <div className="flex items-center gap-1.5 text-[11px] text-(--color-accent2) mb-1"><Sparkles size={11} /> Генерация<span className="typing-dot">…</span></div>
            <div className="md break-words" dangerouslySetInnerHTML={{ __html: renderMd(streaming || 'Модель думает…') }} />
          </div>
        )}

        {!busy && msgs.length <= 1 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11.5px] text-(--color-muted)">Попробуйте:</div>
            {quick.map((q, i) => (
              <button key={i} onClick={() => send(q)} className="block w-full text-left text-[12px] px-2.5 py-2 rounded-lg border border-(--color-border) hover:border-(--color-accent2) hover:bg-(--color-hover)">{q}</button>
            ))}
          </div>
        )}
      </div>

      {/* input */}
      <div className="p-3 border-t border-(--color-border) shrink-0">
        {needsKey && <div className="text-[11.5px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1.5 mb-2">Нужен API-ключ для {PROVIDERS[ai.provider].label}: Настройки → AI. Или выберите Ollama (локально, бесплатно).</div>}
        <div className="flex items-end gap-2 bg-[#14141F] border border-(--color-border) rounded-xl px-2 py-1.5 focus-within:border-(--color-accent2)">
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder={projectRoot ? 'Опишите задачу… Например: создай ClickGUI для Fabric 1.21.4' : 'Откройте проект — или опишите, и агент создаст файлы после открытия папки'}
            className="flex-1 bg-transparent outline-none resize-none text-[13px] placeholder:text-(--color-muted)/70" />
          {busy ? (
            <button onClick={stop} title="Стоп" className="p-2 rounded-lg bg-red-600/80 text-white"><Square size={15} /></button>
          ) : (
            <button onClick={() => send(input)} title="Отправить (Enter)" className="p-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent2) text-white disabled:opacity-40" disabled={!input.trim()}><Send size={15} /></button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-(--color-muted)">
          <span>{MODES.find(m => m.id === mode)?.hint}</span>
          <div className="flex-1" />
          {lastPrompt.current && !busy && <button className="flex items-center gap-1 hover:text-white" onClick={() => send(lastPrompt.current)}><RefreshCw size={11} /> Regenerate</button>}
          {mode !== 'ASK' && projectRoot && <button className="flex items-center gap-1 hover:text-white" onClick={() => buildAndFix(msgs, 0)}><Play size={11} /> Собрать и починить</button>}
        </div>
      </div>

      {diffFile && <DiffModal file={diffFile} onClose={() => setDiffFile(null)} />}
    </div>
  )
}
