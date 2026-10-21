import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { monaco, setupMonaco } from '../monacoSetup'
import { useStore } from '../store'
import { langFromPath, type ProposedFile } from '@shared/types'

export default function DiffModal({ file, onClose }: { file: ProposedFile; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { projectRoot, settings } = useStore()

  useEffect(() => {
    setupMonaco()
    if (!ref.current) return
    let disposed = false
    let editor: monaco.editor.IStandaloneDiffEditor | null = null
    ;(async () => {
      let originalText = ''
      if (projectRoot) {
        try { originalText = await window.api.fs.read(projectRoot.replace(/[\\/]$/, '') + '/' + file.path) } catch { originalText = '' }
      }
      if (disposed || !ref.current) return
      editor = monaco.editor.createDiffEditor(ref.current, {
        theme: settings.theme, automaticLayout: true, readOnly: true,
        fontSize: settings.fontSize, fontFamily: settings.fontFamily, renderSideBySide: true
      })
      const lang = langFromPath(file.path)
      editor.setModel({
        original: monaco.editor.createModel(originalText, lang),
        modified: monaco.editor.createModel(file.content, lang)
      })
    })()
    return () => { disposed = true; editor?.getModel()?.original.dispose(); editor?.getModel()?.modified.dispose(); editor?.dispose() }
  }, [file])

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-8" onClick={onClose}>
      <div className="bg-(--color-panel) border border-(--color-border) rounded-xl w-full h-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 h-11 border-b border-(--color-border)">
          <span className="text-[13px] font-medium">Diff: {file.path}</span>
          <span className="text-[11px] text-(--color-muted)">слева — текущий файл, справа — версия AI</span>
          <div className="flex-1" />
          <button className="p-1.5 rounded hover:bg-(--color-hover)" onClick={onClose}><X size={16} /></button>
        </div>
        <div ref={ref} className="flex-1 min-h-0" />
      </div>
    </div>
  )
}
