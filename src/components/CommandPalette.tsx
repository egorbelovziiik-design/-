import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, FileText, Command, CornerDownLeft } from 'lucide-react';
import { useApp } from '../state/store';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export default function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const setOverlay = useApp((s) => s.setOverlay);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const s = useApp.getState();
    const base: Cmd[] = [
      { id: 'new-project', label: 'New Project…', hint: 'wizard', run: () => s.setOverlay('wizard', true) },
      { id: 'open-folder', label: 'Open Folder…', run: async () => { const f = await window.wincode.pickFolder(); if (f) await s.openWorkspace(f); } },
      { id: 'save', label: 'Save File', hint: 'Ctrl+S', run: () => { if (s.activeTabId) void s.saveFile(s.activeTabId); } },
      { id: 'save-all', label: 'Save All', run: () => void s.saveAll() },
      { id: 'toggle-ai', label: 'Toggle AI Panel', hint: 'Ctrl+Shift+A', run: () => useApp.setState({ showRight: !useApp.getState().showRight }) },
      { id: 'toggle-terminal', label: 'Toggle Terminal', hint: 'Ctrl+`', run: () => useApp.setState({ showBottom: !useApp.getState().showBottom, bottomTab: 'terminal' }) },
      { id: 'run-build', label: 'Run Project', hint: 'F5', run: () => void s.runBuild() },
      { id: 'stop-build', label: 'Stop Build', run: () => void s.stopBuild() },
      { id: 'settings', label: 'Open Settings', hint: 'Ctrl+,', run: () => s.setOverlay('settings', true) },
      { id: 'gui-builder', label: 'Open AI GUI Builder', run: () => s.setOverlay('guiBuilder', true) },
      { id: 'rebuild-index', label: 'Rebuild AI Project Index', run: async () => { if (s.workspaceRoot) { const r = await window.wincode.indexRebuild(s.workspaceRoot); s.notify('success', `Indexed ${r.files} files`); } } },
      { id: 'agent-ask', label: 'AI Mode: ASK', run: () => s.setAiMode('ASK') },
      { id: 'agent-agent', label: 'AI Mode: AGENT', run: () => s.setAiMode('AGENT') },
      { id: 'agent-plan', label: 'AI Mode: PLAN', run: () => s.setAiMode('PLAN') },
      { id: 'agent-debug', label: 'AI Mode: DEBUG', run: () => s.setAiMode('DEBUG') },
      { id: 'split', label: 'Split Editor', hint: 'Ctrl+\\', run: () => s.splitEditor() },
      { id: 'about', label: 'About WinCode AI', run: () => s.setOverlay('about', true) },
    ];
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // quick-open file list
  useEffect(() => {
    if (!open) return;
    const collect = (nodes: import('@shared/types').FileNode[], out: string[] = []) => {
      for (const n of nodes) {
        if (!n.isDir) out.push(n.path);
        if (n.children) collect(n.children, out);
      }
      return out;
    };
    setFiles(collect(useApp.getState().fileTree).slice(0, 400));
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const fileItems: Cmd[] = files
      .filter((f) => !q || f.toLowerCase().includes(q))
      .slice(0, 12)
      .map((f) => ({
        id: 'file:' + f,
        label: f.split(/[\\/]/).pop() ?? f,
        hint: f.split(/[\\/]/).slice(0, -1).join('/'),
        run: () => void useApp.getState().openFile(f),
      }));
    const cmdItems = commands.filter((c) => !q || c.label.toLowerCase().includes(q));
    return query.trim() ? [...fileItems, ...cmdItems] : [...cmdItems, ...fileItems];
  }, [query, commands, files]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex justify-center pt-[90px]" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={() => setOverlay('palette', false)}>
      <div
        className="h-fit w-[560px] max-w-[92vw] overflow-hidden rounded-xl border shadow-panel animate-fade-in"
        style={{ background: 'var(--wc-panel)', borderColor: 'var(--wc-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: '1px solid var(--wc-border)' }}>
          <Search size={14} style={{ color: 'var(--wc-neon)' }} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[13px] outline-none"
            placeholder="Type a command or file name…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const r = results[selected];
                if (r) {
                  r.run();
                  setOverlay('palette', false);
                }
              }
            }}
          />
          <kbd className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--wc-active)', color: 'var(--wc-muted)' }}>
            Esc
          </kbd>
        </div>
        <div className="max-h-[380px] overflow-y-auto py-1">
          {results.map((r, i) => (
            <button
              key={r.id}
              className="flex w-full items-center gap-2.5 px-3.5 py-1.5 text-left"
              style={{
                background: i === selected ? 'var(--wc-active)' : 'transparent',
              }}
              onMouseEnter={() => setSelected(i)}
              onClick={() => {
                r.run();
                setOverlay('palette', false);
              }}
            >
              {r.id.startsWith('file:') ? (
                <FileText size={13} style={{ color: 'var(--wc-muted)' }} />
              ) : (
                <Command size={13} style={{ color: 'var(--wc-neon)' }} />
              )}
              <span className="truncate text-[11.5px]">{r.label}</span>
              {r.hint && (
                <span className="ml-auto truncate text-[9.5px]" style={{ color: 'var(--wc-muted)' }}>
                  {r.hint}
                </span>
              )}
              {i === selected && <CornerDownLeft size={11} style={{ color: 'var(--wc-muted)' }} />}
            </button>
          ))}
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--wc-muted)' }}>
              Nothing found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
