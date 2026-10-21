import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Plus, X, Trash2, Terminal, ListVideo, AlertTriangle } from 'lucide-react'
import { useStore } from '../store'
import { gotoLine } from './EditorPane'

interface TermSession { id: string; name: string }
let termSeq = 0
const termInstances = new Map<string, XTerm>()

function TermView({ session, visible }: { session: TermSession; visible: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const { projectRoot, settings } = useStore()

  useEffect(() => {
    if (!ref.current || termInstances.has(session.id)) return
    const term = new XTerm({
      theme: { background: '#0D0D14', foreground: '#E5E7EB', cursor: '#A855F7', selectionBackground: '#9333EA55' },
      fontFamily: "'Cascadia Code', Consolas, monospace",
      fontSize: 12,
      cursorBlink: true,
      convertEol: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(ref.current)
    fit.fit()
    termInstances.set(session.id, term)
    term.writeln('\x1b[35mWinCode AI Terminal\x1b[0m — настоящий процесс Windows. Ввод построчный (Enter — выполнить команду).')
    window.api.term.create(session.id, projectRoot || '', settings.defaultShell)

    let line = ''
    term.onData(d => {
      if (d === '\r') { term.write('\r\n'); window.api.proc.write(session.id, line + '\n'); line = '' }
      else if (d === '\x7f') { if (line) { line = line.slice(0, -1); term.write('\b \b') } }
      else if (d === '\x03') { window.api.proc.write(session.id, '\x03'); line = ''; term.write('^C\r\n') }
      else if (d.length === 1 && d >= ' ') { line += d; term.write(d) }
    })
    const off = window.api.proc.onData(({ id, data }: any) => {
      if (id === session.id) term.write(String(data).replace(/\r?\n/g, '\r\n'))
    })
    const offExit = window.api.proc.onExit(({ id }: any) => {
      if (id === session.id) term.writeln('\r\n\x1b[33m[процесс завершён — создайте новый терминал кнопкой +]\x1b[0m')
    })
    const ro = new ResizeObserver(() => { try { fit.fit() } catch { /* noop */ } })
    ro.observe(ref.current)
    return () => { off?.(); offExit?.(); ro.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={ref} className="h-full w-full" style={{ display: visible ? 'block' : 'none' }} />
}

interface Problem { file: string; line: number; msg: string; severity: number }

export default function BottomPanel() {
  const { bottomTab, set, output, building, projectRoot } = useStore()
  const [sessions, setSessions] = useState<TermSession[]>([{ id: `term-${++termSeq}`, name: 'PowerShell 1' }])
  const [active, setActive] = useState(sessions[0].id)
  const [problems, setProblems] = useState<Problem[]>([])
  const outRef = useRef<HTMLDivElement>(null)

  // stream build/run output into the store output log
  useEffect(() => {
    const off = window.api.proc.onData(({ id, data }: any) => {
      if (id.startsWith('run-')) useStore.getState().log(String(data).replace(/\r/g, '').replace(/\n$/, ''), 'out')
    })
    const onMarkers = (e: any) => setProblems(e.detail || [])
    window.addEventListener('wincode:markers', onMarkers)
    return () => { off?.(); window.removeEventListener('wincode:markers', onMarkers) }
  }, [])

  useEffect(() => { outRef.current?.scrollTo({ top: 1e9 }) }, [output])

  function newTerm() {
    const s = { id: `term-${++termSeq}`, name: `${useStore.getState().settings.defaultShell === 'cmd' ? 'CMD' : 'PowerShell'} ${termSeq}` }
    setSessions(v => [...v, s]); setActive(s.id)
  }
  function killTerm(id: string) {
    window.api.proc.kill(id)
    termInstances.get(id)?.dispose(); termInstances.delete(id)
    setSessions(v => v.filter(s => s.id !== id))
    if (active === id && sessions.length > 1) setActive(sessions.find(s => s.id !== id)!.id)
  }

  const tab = (id: string, label: React.ReactNode) => (
    <button onClick={() => set({ bottomTab: id as any })}
      className={`flex items-center gap-1.5 px-3 h-8 text-[12px] uppercase tracking-wide ${bottomTab === id ? 'text-white border-b-2 border-(--color-accent2)' : 'text-(--color-muted) hover:text-white'}`}>{label}</button>
  )

  return (
    <div className="flex flex-col h-full bg-(--color-panel) border-t border-(--color-border)">
      <div className="flex items-center h-8 border-b border-(--color-border) shrink-0 px-1">
        {tab('terminal', <><Terminal size={13} /> Терминал</>)}
        {tab('output', <><ListVideo size={13} /> Вывод {building && <span className="text-(--color-accent2) normal-case flex items-center gap-1"><span className="typing-dot">●</span> {building}</span>}</>)}
        {tab('problems', <><AlertTriangle size={13} /> Проблемы {problems.length > 0 && <span className="bg-red-500/80 text-white text-[10px] px-1.5 rounded-full normal-case">{problems.length}</span>}</>)}
        <div className="flex-1" />
        {bottomTab === 'terminal' && (
          <div className="flex items-center gap-1 pr-1">
            {sessions.map(s => (
              <span key={s.id} onClick={() => setActive(s.id)} className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded cursor-pointer ${active === s.id ? 'bg-(--color-selected) text-white' : 'text-(--color-muted) hover:bg-(--color-hover)'}`}>
                {s.name}<X size={11} onClick={e => { e.stopPropagation(); killTerm(s.id) }} />
              </span>
            ))}
            <button className="p-1 rounded hover:bg-(--color-hover)" title="Новый терминал" onClick={newTerm}><Plus size={14} /></button>
          </div>
        )}
        {bottomTab === 'output' && (
          <button className="p-1 rounded hover:bg-(--color-hover) mr-1" title="Очистить вывод" onClick={() => useStore.setState({ output: [] })}><Trash2 size={13} /></button>
        )}
        <button className="p-1 rounded hover:bg-(--color-hover)" title="Скрыть панель (Ctrl+J)" onClick={() => set({ showBottom: false })}><X size={14} /></button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {sessions.map(s => (
          <div key={s.id} className="absolute inset-0" style={{ display: bottomTab === 'terminal' ? 'block' : 'none' }}>
            <TermView session={s} visible={active === s.id} />
          </div>
        ))}
        {bottomTab === 'output' && (
          <div ref={outRef} className="absolute inset-0 overflow-auto p-2 font-mono text-[12px] leading-[1.45] whitespace-pre-wrap break-all" style={{ userSelect: 'text' }}>
            {output.map(l => <div key={l.id} className={l.kind === 'err' ? 'text-red-300' : l.kind === 'sys' ? 'text-(--color-accent2)' : 'text-[#C9CAD6]'}>{l.text}</div>)}
          </div>
        )}
        {bottomTab === 'problems' && (
          <div className="absolute inset-0 overflow-auto p-1.5">
            {problems.length === 0 && <div className="text-[12.5px] text-(--color-muted) p-2">Проблем в открытых файлах не найдено (диагностика Monaco для TS/JSON/CSS/HTML). Ошибки Java/Kotlin покажет сборка Gradle/Maven — кнопка Fix with AI исправит их через модель.</div>}
            {problems.map((p, i) => (
              <button key={i} onClick={() => gotoLine(p.file, p.line)} className="flex items-start gap-2 w-full text-left px-2 py-1 rounded hover:bg-(--color-hover) text-[12.5px]">
                <AlertTriangle size={13} className={p.severity === 8 ? 'text-red-400 mt-0.5' : 'text-amber-300 mt-0.5'} />
                <span className="flex-1">{p.msg}</span>
                <span className="text-(--color-muted)">{projectRoot ? p.file.slice(projectRoot.length + 1) : p.file}:{p.line}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
