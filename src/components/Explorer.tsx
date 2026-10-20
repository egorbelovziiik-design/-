import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
  FilePlus,
  FolderPlus,
  Trash2,
  Pencil,
  Copy,
  Save,
  TerminalSquare,
} from 'lucide-react';
import { useApp } from '../state/store';
import type { FileNode } from '@shared/types';

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const colors: Record<string, string> = {
    java: '#E76F00',
    kt: '#A97BFF',
    ts: '#3178C6',
    tsx: '#3178C6',
    js: '#F7DF1E',
    json: '#CBCB41',
    py: '#3776AB',
    html: '#E34F26',
    css: '#42A5F5',
    gradle: '#02303A',
    xml: '#E76F00',
    md: '#7C4DFF',
  };
  return colors[ext] ?? 'var(--wc-muted)';
}

function Node({
  node,
  depth,
  onContextMenu,
}: {
  node: FileNode;
  depth: number;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
}) {
  const expandedDirs = useApp((s) => s.expandedDirs);
  const toggleDir = useApp((s) => s.toggleDir);
  const openFile = useApp((s) => s.openFile);
  const activeTab = useApp((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const expanded = !!expandedDirs[node.path];
  const isActive = activeTab?.path === node.path;

  return (
    <>
      <div
        className="group flex cursor-pointer items-center gap-1 rounded py-[3px] pr-2 text-[12.5px] transition-colors"
        style={{
          paddingLeft: 8 + depth * 12,
          background: isActive ? 'var(--wc-active)' : 'transparent',
          color: isActive ? 'var(--wc-text)' : 'var(--wc-muted)',
        }}
        onClick={() => (node.isDir ? toggleDir(node.path) : void openFile(node.path))}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {node.isDir ? (
          <>
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {expanded ? <FolderOpen size={14} color="var(--wc-neon)" /> : <Folder size={14} color="var(--wc-neon)" />}
          </>
        ) : (
          <>
            <span className="w-[13px]" />
            <FileText size={13} color={fileIcon(node.name)} />
          </>
        )}
        <span className="truncate">{node.name}</span>
        {!node.isDir && node.size !== undefined && node.size < 1024 && (
          <span className="ml-auto hidden text-[10px] group-hover:inline" style={{ color: 'var(--wc-muted)' }}>
            {node.size}B
          </span>
        )}
      </div>
      {node.isDir && expanded && node.children?.map((child) => (
        <Node key={child.path} node={child} depth={depth + 1} onContextMenu={onContextMenu} />
      ))}
    </>
  );
}

export default function Explorer() {
  const fileTree = useApp((s) => s.fileTree);
  const workspaceRoot = useApp((s) => s.workspaceRoot);
  const refreshTree = useApp((s) => s.refreshTree);
  const notify = useApp((s) => s.notify);
  const [ctx, setCtx] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const refresh = useCallback(() => void refreshTree(), [refreshTree]);

  useEffect(() => {
    if (!workspaceRoot) return;
    refresh();
  }, [workspaceRoot, refresh]);

  const onContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, node });
  };

  const doCreate = async (kind: 'file' | 'dir', base: FileNode | null) => {
    setCtx(null);
    const parent = base && base.isDir ? base.path : base ? base.path.split(/[\\/]/).slice(0, -1).join('/') : workspaceRoot;
    const name = prompt(kind === 'file' ? 'New file name:' : 'New folder name:');
    if (!name || !parent) return;
    try {
      await window.wincode.createNode(`${parent}/${name}`, kind);
      await refresh();
      if (kind === 'file') await useApp.getState().openFile(`${parent}/${name}`);
      notify('success', `Created ${name}`);
    } catch (err) {
      notify('error', `Create failed`, (err as Error).message);
    }
  };

  const doRename = async (node: FileNode) => {
    setCtx(null);
    setRenaming(node.path);
    setNewName(node.name);
  };

  const commitRename = async (node: FileNode) => {
    const name = newName.trim();
    setRenaming(null);
    if (!name || name === node.name) return;
    const parent = node.path.split(/[\\/]/).slice(0, -1).join('/');
    try {
      await window.wincode.renameNode(node.path, `${parent}/${name}`);
      await refresh();
      notify('success', `Renamed to ${name}`);
    } catch (err) {
      notify('error', 'Rename failed', (err as Error).message);
    }
  };

  const doDelete = async (node: FileNode) => {
    setCtx(null);
    const res = await window.wincode.showMessage({
      type: 'warning',
      title: 'Delete',
      message: `Move "${node.name}" to the Recycle Bin?`,
      buttons: ['Delete', 'Cancel'],
    });
    if (res !== 0) return;
    try {
      await window.wincode.deleteNode(node.path);
      await refresh();
      notify('success', `Deleted ${node.name}`);
    } catch (err) {
      notify('error', 'Delete failed', (err as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-3" style={{ borderBottom: '1px solid var(--wc-border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button className="rounded p-1 hover:bg-[var(--wc-hover)]" title="New file" onClick={() => void doCreate('file', null)}>
            <FilePlus size={13} />
          </button>
          <button className="rounded p-1 hover:bg-[var(--wc-hover)]" title="New folder" onClick={() => void doCreate('dir', null)}>
            <FolderPlus size={13} />
          </button>
          <button className="rounded p-1 hover:bg-[var(--wc-hover)]" title="Refresh" onClick={refresh}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
      {workspaceRoot && (
        <div className="truncate px-3 py-1.5 text-[11px]" style={{ color: 'var(--wc-muted)', borderBottom: '1px solid var(--wc-border)' }}>
          {workspaceRoot.split(/[\\/]/).pop()}
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--wc-muted)' }}>
            Empty project folder.
            <br />
            Right-click to create files.
          </div>
        ) : (
          fileTree.map((node) =>
            renaming === node.path ? (
              <input
                key={node.path}
                autoFocus
                className="wc-input mx-2 my-0.5 w-[calc(100%-16px)] text-[12px]"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => void commitRename(node)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename(node);
                  if (e.key === 'Escape') setRenaming(null);
                }}
              />
            ) : (
              <Node key={node.path} node={node} depth={0} onContextMenu={onContextMenu} />
            ),
          )
        )}
      </div>

      {ctx && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtx(null)} onContextMenu={(e) => e.preventDefault()} />
          <div className="ctx-menu fixed z-50 animate-fade-in" style={{ left: ctx.x, top: ctx.y }}>
            <button className="ctx-item w-full" onClick={() => void doCreate('file', ctx.node)}>
              <span className="flex items-center gap-2"><FilePlus size={13} /> New File</span>
            </button>
            <button className="ctx-item w-full" onClick={() => void doCreate('dir', ctx.node)}>
              <span className="flex items-center gap-2"><FolderPlus size={13} /> New Folder</span>
            </button>
            <div className="my-1 h-px" style={{ background: 'var(--wc-border)' }} />
            <button className="ctx-item w-full" onClick={() => void doRename(ctx.node)}>
              <span className="flex items-center gap-2"><Pencil size={13} /> Rename</span>
            </button>
            <button
              className="ctx-item w-full"
              onClick={() => {
                void navigator.clipboard?.writeText(ctx.node.path);
                setCtx(null);
                notify('info', 'Path copied');
              }}
            >
              <span className="flex items-center gap-2"><Copy size={13} /> Copy Path</span>
            </button>
            <button
              className="ctx-item w-full"
              onClick={() => {
                void window.wincode.revealInOs(ctx.node.path);
                setCtx(null);
              }}
            >
              <span className="flex items-center gap-2"><Save size={13} /> Reveal in Explorer</span>
            </button>
            <button
              className="ctx-item w-full"
              onClick={() => {
                void useApp.getState().createTerminal();
                setCtx(null);
              }}
            >
              <span className="flex items-center gap-2"><TerminalSquare size={13} /> Open Terminal Here</span>
            </button>
            <div className="my-1 h-px" style={{ background: 'var(--wc-border)' }} />
            <button className="ctx-item w-full" style={{ color: '#EF4444' }} onClick={() => void doDelete(ctx.node)}>
              <span className="flex items-center gap-2"><Trash2 size={13} /> Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
