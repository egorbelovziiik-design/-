import React, { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FilePlus, FolderPlus, RefreshCw, Pencil, Trash2, Coffee, FileJson, FileCode2 } from 'lucide-react'
import { useStore } from '../store'
import type { FileNode } from '@shared/types'

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'java' || ext === 'kt') return <Coffee size={13} className="text-orange-300 shrink-0" />
  if (ext === 'json') return <FileJson size={13} className="text-yellow-200 shrink-0" />
  if (['ts', 'js', 'tsx', 'py', 'cpp', 'cs', 'gradle', 'html', 'css'].includes(ext || '')) return <FileCode2 size={13} className="text-sky-300 shrink-0" />
  return <File size={13} className="text-(--color-muted) shrink-0" />
}

interface Ctx { x: number; y: number; node: FileNode | null }
let ctxSet: ((c: Ctx | null) => void) | null = null

function Node({ node, depth }: { node: FileNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const { openFile, activeTab } = useStore()
  const active = activeTab === node.path
  return (
    <div>
      <div
        className={`flex items-center gap-1 px-1.5 py-[3px] text-[12.5px] cursor-pointer rounded-sm ${active ? 'bg-(--color-selected) text-white' : 'text-[#C9CAD6] hover:bg-(--color-hover)'}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => (node.isDir ? setOpen(o => !o) : openFile(node.path))}
        onContextMenu={e => { e.preventDefault(); ctxSet?.({ x: e.clientX, y: e.clientY, node }) }}>
        {node.isDir ? (open ? <ChevronDown size={13} className="text-(--color-muted)" /> : <ChevronRight size={13} className="text-(--color-muted)" />) : <span className="w-[13px]" />}
        {node.isDir ? (open ? <FolderOpen size={14} className="text-(--color-accent2) shrink-0" /> : <Folder size={14} className="text-(--color-accent2) shrink-0" />) : fileIcon(node.name)}
        <span className="truncate">{node.name}</span>
      </div>
      {node.isDir && open && node.children?.map(c => <Node key={c.path} node={c} depth={depth + 1} />)}
    </div>
  )
}

export default function Explorer() {
  const { tree, projectRoot, refreshTree, openFile, log } = useStore()
  const [ctx, setCtx] = useState<Ctx | null>(null)
  ctxSet = setCtx

  const dirOf = (node: FileNode | null) => !node ? projectRoot! : node.isDir ? node.path : node.path.replace(/[\\/][^\\/]*$/, '')

  async function newFile(node: FileNode | null) {
    const name = prompt('Имя нового файла (например, Main.java):')
    if (!name) return
    const p = `${dirOf(node)}/${name}`
    await window.api.fs.write(p, '')
    await refreshTree(); openFile(p)
  }
  async function newFolder(node: FileNode | null) {
    const name = prompt('Имя новой папки:')
    if (!name) return
    await window.api.fs.mkdir(`${dirOf(node)}/${name}`)
    await refreshTree()
  }
  async function rename(node: FileNode) {
    const name = prompt('Новое имя:', node.name)
    if (!name || name === node.name) return
    await window.api.fs.rename(node.path, node.path.replace(/[^\\/]*$/, name))
    await refreshTree()
  }
  async function remove(node: FileNode) {
    if (!confirm(`Удалить ${node.isDir ? 'папку' : 'файл'} «${node.name}»? Действие необратимо.`)) return
    await window.api.fs.delete(node.path)
    log(`Удалено: ${node.path}`, 'sys')
    await refreshTree()
  }

  if (!projectRoot) return <div className="p-3 text-[12.5px] text-(--color-muted)">Проект не открыт. Файл → Открыть папку проекта, или создать Minecraft-проект в разделе Minecraft слева.</div>

  return (
    <div className="h-full flex flex-col" onClick={() => setCtx(null)}>
      <div className="flex items-center px-3 h-9 text-[11px] uppercase tracking-wider text-(--color-muted) font-semibold shrink-0">
        <span className="truncate" title={projectRoot}>{projectRoot.split(/[\\/]/).pop()}</span>
        <div className="flex-1" />
        <button className="p-1 rounded hover:bg-(--color-hover)" title="Новый файл" onClick={() => newFile(null)}><FilePlus size={14} /></button>
        <button className="p-1 rounded hover:bg-(--color-hover)" title="Новая папка" onClick={() => newFolder(null)}><FolderPlus size={14} /></button>
        <button className="p-1 rounded hover:bg-(--color-hover)" title="Обновить" onClick={refreshTree}><RefreshCw size={14} /></button>
      </div>
      <div className="flex-1 overflow-auto px-1.5 pb-3 min-h-0">
        {tree.map(n => <Node key={n.path} node={n} depth={0} />)}
        {tree.length === 0 && <div className="text-[12px] text-(--color-muted) px-2 py-2">Папка пуста. Попросите AI-агента создать здесь проект.</div>}
      </div>
      {ctx && (
        <div className="fixed z-[70] bg-[#171726] border border-(--color-border) rounded-lg shadow-2xl py-1 w-52" style={{ left: ctx.x, top: ctx.y }} onClick={e => e.stopPropagation()}>
          <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[12.5px] hover:bg-(--color-selected)" onClick={() => { newFile(ctx.node); setCtx(null) }}><FilePlus size={13} /> Новый файл</button>
          <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[12.5px] hover:bg-(--color-selected)" onClick={() => { newFolder(ctx.node); setCtx(null) }}><FolderPlus size={13} /> Новая папка</button>
          {ctx.node && <>
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[12.5px] hover:bg-(--color-selected)" onClick={() => { rename(ctx.node!); setCtx(null) }}><Pencil size={13} /> Переименовать</button>
            <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[12.5px] text-red-300 hover:bg-red-500/10" onClick={() => { remove(ctx.node!); setCtx(null) }}><Trash2 size={13} /> Удалить</button>
          </>}
        </div>
      )}
    </div>
  )
}
