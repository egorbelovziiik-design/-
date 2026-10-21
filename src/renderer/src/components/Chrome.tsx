import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Square, X, Play, Hammer, FolderOpen, Sparkles, Gamepad2, Blocks, Rocket, Clock, ChevronRight, LayoutTemplate } from 'lucide-react'
import { useStore } from '../store'
import { saveFile } from './EditorPane'
import { runCommand, detectBuild } from './SidePanels'

interface MenuItem { label?: string; shortcut?: string; action?: () => void; sep?: boolean }

export function TitleBar({ onOpenGuiBuilder }: { onOpenGuiBuilder: () => void }) {
  const st = useStore()
  const [menu, setMenu] = useState<string | null>(null)

  const openFolder = async () => { const d = await window.api.dialog.openFolder(); if (d) st.openProject(d) }
  const cloneRepo = async () => {
    const url = prompt('URL git-репозитория (https://github.com/...):')
    if (!url) return
    const parent = await window.api.dialog.openFolder()
    if (!parent) return
    const name = url.split('/').pop()?.replace(/\.git$/, '') || 'repo'
    st.log(`git clone ${url}`, 'sys'); st.set({ showBottom: true, bottomTab: 'output' })
    const r = await window.api.proc.exec(`git clone ${url}`, parent)
    st.log(r.output, r.code === 0 ? 'sys' : 'err')
    if (r.code === 0) st.openProject(`${parent}/${name}`)
  }
  const aiNewProject = () => {
    st.set({ showAi: true })
    window.dispatchEvent(new CustomEvent('wincode:ai-prompt', { detail: { text: 'Создай проект с нуля: ' } }))
  }

  const menus: Record<string, MenuItem[]> = {
    'Файл': [
      { label: 'Открыть папку проекта…', shortcut: 'Ctrl+O', action: openFolder },
      { label: 'Клонировать репозиторий…', action: cloneRepo },
      { sep: true },
      { label: 'Новый Minecraft-проект…', action: () => st.set({ showSide: true, sideView: 'minecraft', showWelcome: false }) },
      { label: 'AI: сгенерировать проект…', action: aiNewProject },
      { sep: true },
      { label: 'Сохранить', shortcut: 'Ctrl+S', action: () => st.activeTab && saveFile(st.activeTab) },
      { label: 'Сохранить всё', action: () => st.tabs.forEach(t => t.dirty && saveFile(t.path)) },
      { sep: true },
      { label: 'Закрыть проект', action: () => st.set({ projectRoot: null, tree: [], tabs: [], activeTab: null, showWelcome: true }) },
      { label: 'Выход', action: () => window.api.window.close() }
    ],
    'Правка': [
      { label: 'Найти в файле', shortcut: 'Ctrl+F', action: () => window.dispatchEvent(new CustomEvent('wincode:editor-action', { detail: 'actions.find' })) },
      { label: 'Найти и заменить', shortcut: 'Ctrl+H', action: () => window.dispatchEvent(new CustomEvent('wincode:editor-action', { detail: 'editor.action.startFindReplaceAction' })) },
      { label: 'Форматировать документ', shortcut: 'Ctrl+Shift+F', action: () => window.dispatchEvent(new CustomEvent('wincode:editor-action', { detail: 'editor.action.formatDocument' })) },
      { label: 'Поиск по проекту', action: () => st.set({ showSide: true, sideView: 'search' }) }
    ],
    'Вид': [
      { label: 'Проводник', shortcut: 'Ctrl+Shift+E', action: () => st.set({ showSide: true, sideView: 'explorer' }) },
      { label: 'Терминал', shortcut: 'Ctrl+`', action: () => st.set({ showBottom: !st.showBottom, bottomTab: 'terminal' }) },
      { label: 'AI-панель', action: () => st.set({ showAi: !st.showAi }) },
      { label: 'Боковая панель', shortcut: 'Ctrl+B', action: () => st.set({ showSide: !st.showSide }) },
      { label: 'Стартовый экран', action: () => st.set({ showWelcome: true }) },
      { sep: true },
      { label: 'Настройки…', shortcut: 'Ctrl+,', action: () => st.set({ showSettings: true }) }
    ],
    'Сборка': [
      { label: 'Собрать проект (BUILD)', shortcut: 'F9', action: async () => { if (st.projectRoot) { const s = await detectBuild(st.projectRoot); if (s) runCommand(s.build, st.projectRoot, 'BUILD'); else st.log('Система сборки не найдена', 'err') } } },
      { label: 'Запустить (RUN)', shortcut: 'F5', action: async () => { if (st.projectRoot) { const s = await detectBuild(st.projectRoot); if (s) runCommand(s.run || s.build, st.projectRoot, 'RUN') } } },
      { label: 'Остановить', action: () => { const id = (window as any).__wcRunning; if (id) window.api.proc.kill(id) } },
      { sep: true },
      { label: 'Minecraft: runClient', action: () => st.projectRoot && runCommand(navigator.platform.startsWith('Win') ? '.\\gradlew.bat runClient' : './gradlew runClient', st.projectRoot, 'runClient') }
    ],
    'AI': [
      { label: 'Спросить WinCode Intelligence', action: () => st.set({ showAi: true }) },
      { label: 'Объяснить открытый файл', action: () => window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'ASK', text: 'Подробно объясни открытый файл: назначение, архитектуру, ключевые методы и возможные проблемы.' } })) },
      { label: 'Сгенерировать тесты для файла', action: () => window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'AGENT', text: 'Напиши полноценные юнит-тесты (JUnit 5 / pytest / vitest — по стеку проекта) для открытого файла и добавь их в проект.' } })) },
      { label: 'AI Code Review проекта', action: () => window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'ASK', text: 'Проведи code review проекта по индексу: уязвимости, запахи кода, производительность, конкретные рекомендации с файлами.' } })) },
      { label: 'AI Commit Message', action: async () => { if (st.projectRoot) { const d = await window.api.git(st.projectRoot, ['diff', '--stat']); window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'ASK', text: `Придумай ёмкое commit-сообщение (Conventional Commits) для этих изменений:\n${d.output}` } })) } } },
      { label: 'GUI Builder (визуальный редактор)', action: onOpenGuiBuilder }
    ],
    'Minecraft': [
      { label: 'Minecraft Development Center', action: () => st.set({ showSide: true, sideView: 'minecraft' }) },
      { label: 'Аккаунты Offline / Microsoft', action: () => st.set({ showSide: true, sideView: 'accounts' }) },
      { label: 'AI: создать Visual Client (Fabric 1.21.4)', action: () => window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'AGENT', text: 'Создай Minecraft Visual Client для Fabric 1.21.4 с красивым ClickGUI, HUD Editor, фиолетовыми анимациями, системой модулей и конфигами' } })) },
      { label: 'AI: создать Launcher (Offline + Microsoft)', action: () => window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'AGENT', text: 'Создай Minecraft Launcher с красивым интерфейсом, Offline Account, Microsoft Account, выбором версии Minecraft, поддержкой Fabric и настройками памяти' } })) }
    ]
  }

  return (
    <div className="h-11 bg-(--color-panel) border-b border-(--color-border) flex items-center drag-region shrink-0 relative z-40"
      onMouseLeave={() => setMenu(null)}>
      <div className="flex items-center gap-2 pl-3 pr-2 no-drag">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-600 to-fuchsia-500 flex items-center justify-center text-white text-[11px] font-bold">&lt;/&gt;</div>
        <span className="font-semibold text-[13px]">WinCode <span className="text-(--color-accent2)">AI</span></span>
      </div>
      <div className="flex items-center no-drag">
        {Object.entries(menus).map(([name, items]) => (
          <div key={name} className="relative">
            <button className={`px-2.5 py-1 text-[12.5px] rounded ${menu === name ? 'bg-(--color-selected) text-white' : 'text-[#C9CAD6] hover:bg-(--color-hover)'}`}
              onClick={() => setMenu(menu === name ? null : name)} onMouseEnter={() => menu && setMenu(name)}>{name}</button>
            <AnimatePresence>
              {menu === name && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full mt-1 w-80 bg-[#151524] border border-(--color-border) rounded-xl shadow-2xl py-1.5 z-50">
                  {items.map((it, i) => it.sep
                    ? <div key={i} className="my-1.5 border-t border-(--color-border)" />
                    : <button key={i} className="flex items-center w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-(--color-selected)"
                        onClick={() => { setMenu(null); it.action?.() }}>
                        <span className="flex-1">{it.label}</span>
                        {it.shortcut && <span className="text-[11px] text-(--color-muted)">{it.shortcut}</span>}
                      </button>)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="flex-1" />
      <div className="flex items-center gap-1.5 no-drag pr-2">
        <button title="RUN (F5)" className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white text-[12px]"
          onClick={async () => { if (st.projectRoot) { const s = await detectBuild(st.projectRoot); if (s) runCommand(s.run || s.build, st.projectRoot, 'RUN') } }}><Play size={12} /> Run</button>
        <button title="BUILD (F9)" className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-(--color-accent) hover:bg-(--color-accent2) text-white text-[12px]"
          onClick={async () => { if (st.projectRoot) { const s = await detectBuild(st.projectRoot); if (s) runCommand(s.build, st.projectRoot, 'BUILD') } }}><Hammer size={12} /> Build</button>
      </div>
      <div className="flex items-center no-drag">
        <button className="px-3.5 h-11 hover:bg-(--color-hover)" onClick={() => window.api.window.minimize()}><Minus size={15} /></button>
        <button className="px-3.5 h-11 hover:bg-(--color-hover)" onClick={() => window.api.window.maximize()}><Square size={13} /></button>
        <button className="px-3.5 h-11 hover:bg-red-600" onClick={() => window.api.window.close()}><X size={15} /></button>
      </div>
    </div>
  )
}

export function Welcome() {
  const st = useStore()
  const openFolder = async () => { const d = await window.api.dialog.openFolder(); if (d) st.openProject(d) }
  const card = 'flex items-start gap-3 text-left border border-(--color-border) bg-[#12121D] hover:border-(--color-accent2) hover:bg-(--color-selected) rounded-2xl p-4 transition w-full'
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-30 bg-(--color-bg) overflow-auto">
      <div className="max-w-3xl mx-auto py-14 px-6">
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-500 flex items-center justify-center text-white text-2xl font-bold shadow-[0_0_50px_#9333EA66]">&lt;/&gt;</div>
          <h1 className="text-3xl font-bold mt-4">WinCode <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">AI</span></h1>
          <p className="text-(--color-muted) mt-2 text-[14px]">Профессиональная AI IDE для Java, Kotlin и Minecraft-разработки.<br />Настоящий редактор, настоящий AI-агент, настоящая сборка.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className={card} onClick={() => st.set({ showWelcome: false, showSide: true, sideView: 'minecraft' })}>
            <Gamepad2 className="text-(--color-accent2) mt-0.5" size={20} />
            <span><span className="block font-medium text-[14px]">Minecraft Client / Mod</span><span className="text-[12px] text-(--color-muted)">Fabric Visual Client с ClickGUI, Forge, NeoForge, Paper — реальные Gradle-проекты</span></span>
          </button>
          <button className={card} onClick={() => st.set({ showWelcome: false, showSide: true, sideView: 'minecraft' })}>
            <Rocket className="text-(--color-accent2) mt-0.5" size={20} />
            <span><span className="block font-medium text-[14px]">Minecraft Launcher</span><span className="text-[12px] text-(--color-muted)">Offline Account + Microsoft OAuth, версии Mojang, сборка в EXE</span></span>
          </button>
          <button className={card} onClick={openFolder}>
            <FolderOpen className="text-(--color-accent2) mt-0.5" size={20} />
            <span><span className="block font-medium text-[14px]">Открыть проект</span><span className="text-[12px] text-(--color-muted)">Java, Kotlin, Python, C++, TypeScript — с AI-памятью проекта</span></span>
          </button>
          <button className={card} onClick={() => { st.set({ showWelcome: false, showAi: true }); window.dispatchEvent(new CustomEvent('wincode:ai-prompt', { detail: { text: 'Создай проект с нуля: ' } })) }}>
            <Sparkles className="text-(--color-accent2) mt-0.5" size={20} />
            <span><span className="block font-medium text-[14px]">AI Generate Project</span><span className="text-[12px] text-(--color-muted)">Агент создаст структуру, код и проверит сборку</span></span>
          </button>
        </div>
        {st.recentProjects.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold mb-2"><Clock size={12} /> Недавние проекты</div>
            {st.recentProjects.map(r => (
              <button key={r} onClick={() => st.openProject(r)} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-(--color-hover)">
                <Blocks size={14} className="text-(--color-accent2)" />
                <span className="flex-1 min-w-0"><span className="block text-[13px]">{r.split(/[\\/]/).pop()}</span><span className="block text-[11px] text-(--color-muted) truncate">{r}</span></span>
                <ChevronRight size={14} className="text-(--color-muted)" />
              </button>
            ))}
          </div>
        )}
        <div className="text-center text-[11.5px] text-(--color-muted) mt-10">AI-модель не настроена? Настройки → AI: OpenAI / Claude / Gemini / OpenRouter — или Ollama локально без интернета.</div>
      </div>
    </motion.div>
  )
}

/* ---------- AI GUI Builder: visual canvas -> real code file ---------- */
interface GuiEl { id: number; kind: string; x: number; y: number; w: number; text: string }
let guiId = 0
const PALETTE = [
  { kind: 'button', label: 'Кнопка' }, { kind: 'label', label: 'Текст' }, { kind: 'input', label: 'Поле ввода' },
  { kind: 'slider', label: 'Слайдер' }, { kind: 'switch', label: 'Переключатель' }, { kind: 'panel', label: 'Панель' },
  { kind: 'image', label: 'Изображение' }, { kind: 'dropdown', label: 'Список' }
]

export function GuiBuilder({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const [els, setEls] = useState<GuiEl[]>([
    { id: ++guiId, kind: 'label', x: 30, y: 20, w: 220, text: 'Мой интерфейс' },
    { id: ++guiId, kind: 'button', x: 30, y: 70, w: 160, text: 'Играть' },
    { id: ++guiId, kind: 'slider', x: 30, y: 125, w: 220, text: 'Громкость' }
  ])
  const [sel, setSel] = useState<number | null>(null)
  const [target, setTarget] = useState<'javafx' | 'html' | 'react'>('javafx')
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  function add(kind: string) { setEls(e => [...e, { id: ++guiId, kind, x: 40 + (e.length * 14) % 300, y: 40 + (e.length * 18) % 260, w: 170, text: PALETTE.find(p => p.kind === kind)?.label || kind }]) }

  function onMouseMove(e: React.MouseEvent) {
    if (!drag.current || !canvasRef.current) return
    const r = canvasRef.current.getBoundingClientRect()
    setEls(list => list.map(el => el.id === drag.current!.id ? { ...el, x: Math.max(0, e.clientX - r.left - drag.current!.dx), y: Math.max(0, e.clientY - r.top - drag.current!.dy) } : el))
  }

  function genCode(): string {
    if (target === 'javafx') {
      const body = els.map(el => {
        switch (el.kind) {
          case 'button': return `        Button b${el.id} = new Button("${el.text}"); b${el.id}.setLayoutX(${Math.round(el.x)}); b${el.id}.setLayoutY(${Math.round(el.y)}); b${el.id}.setPrefWidth(${el.w}); b${el.id}.setStyle("-fx-background-color:#9333EA;-fx-text-fill:white;-fx-background-radius:8;"); root.getChildren().add(b${el.id});`
          case 'label': return `        Label l${el.id} = new Label("${el.text}"); l${el.id}.setLayoutX(${Math.round(el.x)}); l${el.id}.setLayoutY(${Math.round(el.y)}); l${el.id}.setStyle("-fx-text-fill:#E5E7EB;-fx-font-size:16px;-fx-font-weight:bold;"); root.getChildren().add(l${el.id});`
          case 'input': return `        TextField t${el.id} = new TextField(); t${el.id}.setPromptText("${el.text}"); t${el.id}.setLayoutX(${Math.round(el.x)}); t${el.id}.setLayoutY(${Math.round(el.y)}); t${el.id}.setPrefWidth(${el.w}); root.getChildren().add(t${el.id});`
          case 'slider': return `        Slider s${el.id} = new Slider(0, 100, 50); s${el.id}.setLayoutX(${Math.round(el.x)}); s${el.id}.setLayoutY(${Math.round(el.y)}); s${el.id}.setPrefWidth(${el.w}); root.getChildren().add(s${el.id}); // ${el.text}`
          case 'switch': return `        CheckBox c${el.id} = new CheckBox("${el.text}"); c${el.id}.setLayoutX(${Math.round(el.x)}); c${el.id}.setLayoutY(${Math.round(el.y)}); root.getChildren().add(c${el.id});`
          default: return `        // ${el.kind} "${el.text}" at (${Math.round(el.x)},${Math.round(el.y)})`
        }
      }).join('\n')
      return `import javafx.scene.control.*;\nimport javafx.scene.layout.Pane;\n\n/** Сгенерировано WinCode AI GUI Builder */\npublic class GeneratedGui {\n    public static Pane build() {\n        Pane root = new Pane();\n        root.setPrefSize(720, 480);\n        root.setStyle("-fx-background-color:#0D0D14;");\n${body}\n        return root;\n    }\n}\n`
    }
    if (target === 'react') {
      const body = els.map(el => {
        const style = `style={{ position:'absolute', left:${Math.round(el.x)}, top:${Math.round(el.y)}, width:${el.w} }}`
        switch (el.kind) {
          case 'button': return `      <button ${style} className="bg-purple-600 text-white rounded-lg py-2">${el.text}</button>`
          case 'label': return `      <div ${style} className="text-lg font-bold">${el.text}</div>`
          case 'input': return `      <input ${style} placeholder="${el.text}" className="bg-[#14141F] border border-zinc-700 rounded-lg px-2 py-1.5" />`
          case 'slider': return `      <input type="range" ${style} /> {/* ${el.text} */}`
          case 'switch': return `      <label ${style}><input type="checkbox" /> ${el.text}</label>`
          default: return `      <div ${style}>${el.text}</div>`
        }
      }).join('\n')
      return `// Сгенерировано WinCode AI GUI Builder\nexport default function GeneratedGui() {\n  return (\n    <div style={{ position:'relative', width:720, height:480, background:'#0D0D14', color:'#E5E7EB' }}>\n${body}\n    </div>\n  )\n}\n`
    }
    const body = els.map(el => `  <div style="position:absolute;left:${Math.round(el.x)}px;top:${Math.round(el.y)}px;width:${el.w}px" data-kind="${el.kind}">${el.text}</div>`).join('\n')
    return `<!doctype html>\n<!-- Сгенерировано WinCode AI GUI Builder -->\n<html><head><meta charset="utf-8"><title>Generated GUI</title><style>body{background:#0D0D14;color:#E5E7EB;font-family:Segoe UI,sans-serif}.btn{background:#9333EA;color:#fff;border:0;border-radius:8px;padding:8px 16px}</style></head>\n<body><div style="position:relative;width:720px;height:480px;margin:24px auto;border:1px solid #26263D;border-radius:14px">\n${body}\n</div></body></html>\n`
  }

  async function save() {
    if (!st.projectRoot) { st.log('GUI Builder: сначала откройте проект.', 'err'); return }
    const name = target === 'javafx' ? 'GeneratedGui.java' : target === 'react' ? 'GeneratedGui.tsx' : 'generated-gui.html'
    const p = `${st.projectRoot}/${name}`
    await window.api.fs.write(p, genCode())
    await st.refreshTree()
    st.openFile(p)
    st.log(`GUI Builder: код сохранён в ${name}`, 'sys')
    onClose()
  }

  async function aiImprove() {
    onClose()
    window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'AGENT', text: `Вот сгенерированный GUI Builder-ом интерфейс (${target}). Преврати его в красивый полноценный интерфейс в чёрно-фиолетовом премиум-стиле с анимациями, Blur/Glow-эффектами и рабочей логикой. Верни готовые файлы.\n\n\`\`\`\n${genCode()}\n\`\`\`` } }))
  }

  const selected = els.find(e => e.id === sel)
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-5" onClick={onClose}>
      <div className="bg-(--color-panel) border border-(--color-border) rounded-2xl w-[1060px] max-w-full h-[680px] max-h-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 h-12 border-b border-(--color-border)">
          <LayoutTemplate size={16} className="text-(--color-accent2)" />
          <span className="font-medium text-[14px]">AI GUI Builder</span>
          <span className="text-[11.5px] text-(--color-muted)">Перетаскивайте элементы на холсте → получите настоящий код</span>
          <div className="flex-1" />
          <select value={target} onChange={e => setTarget(e.target.value as any)} className="bg-[#14141F] border border-(--color-border) rounded-lg px-2 py-1 text-[12.5px]">
            <option value="javafx">JavaFX (Java)</option><option value="react">React / TSX</option><option value="html">HTML/CSS</option>
          </select>
          <button className="px-3 py-1.5 rounded-lg bg-(--color-accent) text-white text-[12.5px]" onClick={save}>Сохранить код в проект</button>
          <button className="px-3 py-1.5 rounded-lg bg-fuchsia-600/80 text-white text-[12.5px]" onClick={aiImprove}>AI: доработать дизайн</button>
          <button className="p-1.5 rounded hover:bg-(--color-hover)" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-44 border-r border-(--color-border) p-2 space-y-1.5 shrink-0">
            <div className="text-[11px] uppercase text-(--color-muted) font-semibold px-1">Элементы</div>
            {PALETTE.map(p => <button key={p.kind} onClick={() => add(p.kind)} className="block w-full text-left text-[12.5px] px-2.5 py-1.5 rounded-lg border border-(--color-border) hover:border-(--color-accent2) hover:bg-(--color-hover)">+ {p.label}</button>)}
            {selected && (
              <div className="pt-3 space-y-1.5">
                <div className="text-[11px] uppercase text-(--color-muted) font-semibold px-1">Свойства</div>
                <input className="w-full bg-[#14141F] border border-(--color-border) rounded-lg px-2 py-1 text-[12.5px]" value={selected.text} onChange={e => setEls(l => l.map(x => x.id === selected.id ? { ...x, text: e.target.value } : x))} />
                <span className="text-[11px] text-(--color-muted)">Ширина: {selected.w}</span>
                <input type="range" min={60} max={420} value={selected.w} onChange={e => setEls(l => l.map(x => x.id === selected.id ? { ...x, w: Number(e.target.value) } : x))} className="w-full accent-purple-500" />
                <button className="w-full text-[12px] px-2 py-1 rounded-lg bg-red-600/70 text-white" onClick={() => { setEls(l => l.filter(x => x.id !== selected.id)); setSel(null) }}>Удалить элемент</button>
              </div>
            )}
          </div>
          <div ref={canvasRef} className="flex-1 relative m-4 rounded-xl border border-dashed border-[#34305A] bg-[#0D0D14] overflow-hidden"
            onMouseMove={onMouseMove} onMouseUp={() => (drag.current = null)} onClick={() => setSel(null)}>
            {els.map(el => (
              <div key={el.id} style={{ position: 'absolute', left: el.x, top: el.y, width: el.w }} className={`cursor-move ${sel === el.id ? 'outline outline-2 outline-purple-500 rounded-lg' : ''}`}
                onMouseDown={e => { e.stopPropagation(); setSel(el.id); const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); drag.current = { id: el.id, dx: e.clientX - r.left, dy: e.clientY - r.top } }}>
                {el.kind === 'button' && <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-center rounded-lg py-2 text-[13px] shadow-[0_0_18px_#9333EA55]">{el.text}</div>}
                {el.kind === 'label' && <div className="text-[16px] font-bold">{el.text}</div>}
                {el.kind === 'input' && <div className="bg-[#14141F] border border-[#2A2A42] rounded-lg px-2.5 py-2 text-[12.5px] text-(--color-muted)">{el.text}…</div>}
                {el.kind === 'slider' && <div><div className="text-[11px] text-(--color-muted) mb-0.5">{el.text}</div><div className="h-1.5 rounded bg-[#26263D]"><div className="h-full w-1/2 rounded bg-(--color-accent2)" /></div></div>}
                {el.kind === 'switch' && <div className="flex items-center gap-2 text-[12.5px]"><span className="w-9 h-5 rounded-full bg-(--color-accent) relative"><span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white" /></span>{el.text}</div>}
                {el.kind === 'panel' && <div className="border border-[#26263D] bg-[#11111B] rounded-xl h-24 p-2 text-[12px] text-(--color-muted)">{el.text}</div>}
                {el.kind === 'image' && <div className="border border-[#26263D] bg-[#15152A] rounded-xl h-20 flex items-center justify-center text-[12px] text-(--color-muted)">🖼 {el.text}</div>}
                {el.kind === 'dropdown' && <div className="bg-[#14141F] border border-[#2A2A42] rounded-lg px-2.5 py-2 text-[12.5px] flex justify-between">{el.text}<span>▾</span></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
