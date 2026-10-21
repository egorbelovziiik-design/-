import React, { useEffect, useRef } from 'react'
import { X, Circle, SplitSquareHorizontal, Wand2, Save } from 'lucide-react'
import { monaco, setupMonaco } from '../monacoSetup'
import { useStore } from '../store'
import { langFromPath } from '@shared/types'
import { registerAiInline } from '../aiInline'

const models = new Map<string, monaco.editor.ITextModel>()
const viewStates = new Map<string, monaco.editor.ICodeEditorViewState | null>()
let editorRef: monaco.editor.IStandaloneCodeEditor | null = null
export function getEditor() { return editorRef }
export function getModel(path: string) { return models.get(path) }

export async function ensureModel(path: string): Promise<monaco.editor.ITextModel> {
  if (models.has(path)) return models.get(path)!
  const content: string = await window.api.fs.read(path)
  const uri = monaco.Uri.file(path)
  const existing = monaco.editor.getModel(uri)
  const model = existing ?? monaco.editor.createModel(content, langFromPath(path), uri)
  models.set(path, model)
  model.onDidChangeContent(() => useStore.getState().setDirty(path, true))
  return model
}

export async function saveFile(path: string) {
  const m = models.get(path)
  if (!m) return
  await window.api.fs.write(path, m.getValue())
  useStore.getState().setDirty(path, false)
  useStore.getState().set({ statusMsg: `Сохранено: ${path.split(/[\\/]/).pop()}` })
}

export function gotoLine(path: string, line: number) {
  useStore.getState().openFile(path)
  setTimeout(() => {
    editorRef?.revealLineInCenter(line)
    editorRef?.setPosition({ lineNumber: line, column: 1 })
    editorRef?.focus()
  }, 120)
}

export default function EditorPane() {
  const hostRef = useRef<HTMLDivElement>(null)
  const { tabs, activeTab, closeTab, set, settings, projectRoot } = useStore()

  useEffect(() => {
    setupMonaco()
    if (!hostRef.current || editorRef) return
    const editor = monaco.editor.create(hostRef.current, {
      theme: settings.theme,
      automaticLayout: true,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      minimap: { enabled: settings.minimap, scale: 1 },
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? 'on' : 'off',
      padding: { top: 10 },
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      renderLineHighlight: 'all',
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      inlineSuggest: { enabled: true, mode: 'prefix' },
      suggest: { showStatusBar: true },
      quickSuggestions: { other: true, comments: false, strings: false }
    })
    editorRef = editor
    registerAiInline()
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const a = useStore.getState().activeTab
      if (a) saveFile(a)
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.formatDocument')?.run()
    })
    editor.addAction({
      id: 'wincode.aiRefactor',
      label: 'WinCode AI: объяснить / отрефакторить выделенное',
      contextMenuGroupId: '1_modification',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      run: ed => {
        const sel = ed.getModel()?.getValueInRange(ed.getSelection()!) || ''
        const ev = new CustomEvent('wincode:ai-ask', { detail: { mode: 'EDIT', text: sel ? `Отрефактори и улучши этот код, затем объясни изменения:\n\n\`\`\`\n${sel}\n\`\`\`` : '' } })
        window.dispatchEvent(ev)
      }
    })
    editor.addAction({
      id: 'wincode.aiDoc',
      label: 'WinCode AI: сгенерировать документацию (JavaDoc)',
      contextMenuGroupId: '1_modification',
      run: ed => {
        const sel = ed.getModel()?.getValueInRange(ed.getSelection()!) || ed.getModel()?.getValue() || ''
        window.dispatchEvent(new CustomEvent('wincode:ai-ask', { detail: { mode: 'EDIT', text: `Добавь качественную документацию (JavaDoc/docstring) к этому коду и верни файл целиком:\n\n\`\`\`\n${sel.slice(0, 8000)}\n\`\`\`` } }))
      }
    })
    // Live diagnostics -> Problems panel count
    monaco.editor.onDidChangeMarkers(() => {
      const markers = monaco.editor.getModelMarkers({})
      window.dispatchEvent(new CustomEvent('wincode:markers', { detail: markers.map(m => ({ file: m.resource.fsPath, line: m.startLineNumber, msg: m.message, severity: m.severity })) }))
    })
    return () => { /* keep editor alive */ }
  }, [])

  // apply settings live
  useEffect(() => {
    editorRef?.updateOptions({
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      minimap: { enabled: settings.minimap },
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? 'on' : 'off'
    })
    monaco.editor.setTheme(settings.theme)
  }, [settings])

  // switch active model
  useEffect(() => {
    const ed = editorRef
    if (!ed || !activeTab) return
    const prev = ed.getModel()
    if (prev) {
      const prevPath = [...models.entries()].find(([, m]) => m === prev)?.[0]
      if (prevPath) viewStates.set(prevPath, ed.saveViewState())
    }
    ensureModel(activeTab).then(m => {
      ed.setModel(m)
      const vs = viewStates.get(activeTab)
      if (vs) ed.restoreViewState(vs)
      ed.focus()
    }).catch(e => useStore.getState().log(`Не удалось открыть файл: ${e.message}`, 'err'))
  }, [activeTab])

  // autosave
  useEffect(() => {
    if (!settings.autoSave) return
    const t = setInterval(() => {
      useStore.getState().tabs.filter(tb => tb.dirty).forEach(tb => saveFile(tb.path).catch(() => {}))
    }, 2500)
    return () => clearInterval(t)
  }, [settings.autoSave])

  const crumbs = activeTab && projectRoot ? activeTab.slice(projectRoot.length + 1).split(/[\\/]/) : []

  return (
    <div className="flex flex-col h-full bg-(--color-editor) min-w-0">
      {/* tabs */}
      <div className="flex items-center bg-(--color-panel) border-b border-(--color-border) h-9 shrink-0 overflow-x-auto">
        {tabs.map(t => (
          <div key={t.path}
            onClick={() => set({ activeTab: t.path })}
            onAuxClick={e => e.button === 1 && closeTab(t.path)}
            title={t.path}
            className={`group flex items-center gap-1.5 px-3 h-9 text-[12.5px] cursor-pointer border-r border-(--color-border) shrink-0 ${t.path === activeTab ? 'bg-(--color-editor) text-white border-t-2 border-t-(--color-accent2)' : 'text-(--color-muted) hover:bg-(--color-hover)'}`}>
            <span>{t.name}</span>
            {t.dirty
              ? <Circle size={8} className="fill-(--color-accent2) text-(--color-accent2) group-hover:hidden" />
              : null}
            <X size={13} className={`${t.dirty ? 'hidden group-hover:block' : ''} hover:text-white rounded`}
              onClick={e => { e.stopPropagation(); closeTab(t.path) }} />
          </div>
        ))}
        <div className="flex-1" />
        {activeTab && (
          <div className="flex items-center gap-1 pr-2 shrink-0">
            <button title="Сохранить (Ctrl+S)" className="p-1.5 rounded hover:bg-(--color-hover) text-(--color-muted) hover:text-white" onClick={() => saveFile(activeTab)}><Save size={14} /></button>
            <button title="Форматировать (Ctrl+Shift+F)" className="p-1.5 rounded hover:bg-(--color-hover) text-(--color-muted) hover:text-white" onClick={() => editorRef?.getAction('editor.action.formatDocument')?.run()}><Wand2 size={14} /></button>
            <button title="Найти и заменить (Ctrl+H)" className="p-1.5 rounded hover:bg-(--color-hover) text-(--color-muted) hover:text-white" onClick={() => editorRef?.getAction('editor.action.startFindReplaceAction')?.run()}><SplitSquareHorizontal size={14} /></button>
          </div>
        )}
      </div>
      {/* breadcrumbs */}
      {crumbs.length > 0 && (
        <div className="flex items-center gap-1 px-3 h-6 text-[11.5px] text-(--color-muted) bg-(--color-editor) border-b border-(--color-border)/50 shrink-0 overflow-hidden">
          {crumbs.map((c, i) => <React.Fragment key={i}><span className={i === crumbs.length - 1 ? 'text-(--color-text)' : ''}>{c}</span>{i < crumbs.length - 1 && <span className="opacity-50">›</span>}</React.Fragment>)}
        </div>
      )}
      <div ref={hostRef} className="flex-1 min-h-0" />
      {!activeTab && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center opacity-60">
            <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-fuchsia-500 bg-clip-text text-transparent">&lt;/&gt; WinCode AI</div>
            <div className="text-sm text-(--color-muted) mt-3">Откройте файл в проводнике слева, или попросите AI-агента создать проект</div>
            <div className="text-xs text-(--color-muted) mt-2">Ctrl+P — быстрый поиск файла · Ctrl+Shift+P — команды · Ctrl+K — AI по выделенному коду</div>
          </div>
        </div>
      )}
    </div>
  )
}
