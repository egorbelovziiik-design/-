import { useEffect, useRef, useState } from 'react';
import { X, Save, SplitSquareHorizontal, Sparkles, Loader2, FileCode2 } from 'lucide-react';
import { useApp } from '../state/store';
import { setupMonaco, monaco, themeFor, registerInlineAI, setModelMarkers } from '../lib/monaco-setup';

export default function EditorArea({ column }: { column: 0 | 1 }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorsRef = useRef<Map<string, import('monaco-editor').editor.IStandaloneCodeEditor>>(new Map());
  const lastInColumn = useRef<Map<number, string>>(new Map());
  const [ready, setReady] = useState(false);
  const settings = useApp((s) => s.settings);
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const openFiles = useApp((s) => s.openFiles);
  const problems = useApp((s) => s.problems);
  const markDirty = useApp((s) => s.markDirty);
  const saveFile = useApp((s) => s.saveFile);
  const closeTab = useApp((s) => s.closeTab);
  const setActiveTab = useApp((s) => s.setActiveTab);
  const splitEditor = useApp((s) => s.splitEditor);
  const notify = useApp((s) => s.notify);
  const workspaceRoot = useApp((s) => s.workspaceRoot);
  const [aiBusy, setAiBusy] = useState(false);

  const columnTabs = tabs.filter((t) => t.viewColumn === column);
  const activeInColumn =
    columnTabs.find((t) => t.id === activeTabId) ??
    columnTabs.find((t) => t.id === lastInColumn.current.get(column)) ??
    columnTabs[columnTabs.length - 1];

  useEffect(() => {
    if (activeInColumn) lastInColumn.current.set(column, activeInColumn.id);
  }, [activeInColumn?.id, column]);

  // Monaco bootstrap
  useEffect(() => {
    setupMonaco();
    registerInlineAI(async (prefix, suffix, language, filePath) => {
      const s = useApp.getState();
      if (!s.settings?.ai.inlineCompletion) return '';
      try {
        setAiBusy(true);
        const res = await window.wincode.aiInline(s.activeProviderId, prefix, suffix, language, filePath);
        return res.text;
      } catch {
        return '';
      } finally {
        setAiBusy(false);
      }
    });
    setReady(true);
  }, []);

  // Create / show editors per tab
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const editors = editorsRef.current;

    for (const tab of columnTabs) {
      const file = openFiles[tab.path];
      if (!file || file.loading) continue;
      const uri = monaco.Uri.file(tab.path);
      let model = monaco.editor.getModel(uri);
      if (!model) {
        model = monaco.editor.createModel(file.content, tab.language, uri);
        model.onDidChangeContent(() => {
          const current = useApp.getState().openFiles[tab.path];
          if (current && model!.getValue() !== current.content) {
            markDirty(tab.path, model!.getValue());
          }
        });
      } else if (model.getValue() !== file.content) {
        // sync external changes (e.g. AI wrote the file) when editor is not focused
        const editor = editors.get(tab.id);
        if (!editor || !editor.hasTextFocus()) {
          model.setValue(file.content);
        }
      }

      if (!editors.has(tab.id)) {
        const editor = monaco.editor.create(containerRef.current, {
          model,
          theme: themeFor(settings),
          fontFamily: settings?.appearance.editorFont ?? '"Cascadia Code", Consolas, monospace',
          fontSize: settings?.appearance.editorFontSize ?? 14,
          fontLigatures: settings?.appearance.editorLigatures ?? true,
          minimap: { enabled: settings?.appearance.minimap ?? true },
          lineNumbers: settings?.editor.lineNumbers ?? 'on',
          wordWrap: settings?.editor.wordWrap ?? 'off',
          tabSize: settings?.editor.tabSize ?? 4,
          insertSpaces: settings?.editor.insertSpaces ?? true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          bracketPairColorization: { enabled: settings?.editor.bracketPairs ?? true },
          stickyScroll: { enabled: settings?.editor.stickyScroll ?? true },
          padding: { top: 8 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          suggest: { showMethods: true, showFunctions: true, preview: true },
          quickSuggestions: true,
        });
        editor.onDidFocusEditorText(() => setActiveTab(tab.id));
        editors.set(tab.id, editor);
      }
    }

    // visibility: only the active tab in this column is shown
    for (const [tabId, editor] of editors) {
      const tab = columnTabs.find((t) => t.id === tabId);
      const dom = editor.getDomNode();
      if (!dom) continue;
      const visible = tab && tab.id === activeInColumn?.id;
      if (visible && dom.parentElement !== containerRef.current) {
        containerRef.current.appendChild(dom);
      }
      if (!visible && dom.parentElement === containerRef.current) {
        dom.remove();
      }
    }

    const activeEditor = activeInColumn ? editors.get(activeInColumn.id) : undefined;
    activeEditor?.layout();
    activeEditor?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, columnTabs.map((t) => t.id).join(','), activeInColumn?.id, openFiles, settings]);

  // theme updates
  useEffect(() => {
    monaco.editor.setTheme(themeFor(settings));
  }, [settings?.appearance.theme]);

  // build problem markers
  useEffect(() => {
    for (const tab of tabs) {
      setModelMarkers(problems, tab.path);
    }
  }, [problems, tabs]);

  // autosave
  useEffect(() => {
    if (!settings?.editor.autoSave || settings.editor.autoSave === 'off') return;
    const interval = setInterval(() => {
      const s = useApp.getState();
      for (const tab of s.tabs) {
        const f = s.openFiles[tab.path];
        if (f && f.content !== f.original) void s.saveFile(tab.id);
      }
    }, settings.editor.autoSaveDelayMs || 1200);
    return () => clearInterval(interval);
  }, [settings?.editor.autoSave, settings?.editor.autoSaveDelayMs]);

  return (
    <div className="flex min-w-0 flex-1 flex-col" style={{ background: 'var(--wc-editor)' }}>
      {/* Tabs */}
      <div className="flex h-9 shrink-0 items-stretch overflow-x-auto" style={{ background: 'var(--wc-panel)', borderBottom: '1px solid var(--wc-border)' }}>
        {columnTabs.length === 0 && column === 0 && (
          <div className="flex items-center px-3 text-[11px]" style={{ color: 'var(--wc-muted)' }}>
            No file open — use Explorer or Ctrl+P
          </div>
        )}
        {column === 1 && columnTabs.length === 0 && (
          <div className="flex items-center px-3 text-[11px]" style={{ color: 'var(--wc-muted)' }}>
            Split view — open a file here
          </div>
        )}
        {columnTabs.map((tab) => {
          const active = tab.id === activeInColumn?.id;
          return (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/tab-id', tab.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const draggedId = e.dataTransfer.getData('text/tab-id');
                if (draggedId && draggedId !== tab.id) useApp.getState().moveTabToColumn(draggedId, column);
              }}
              onClick={() => setActiveTab(tab.id)}
              onMouseDown={(e) => {
                if (e.button === 1) void closeTab(tab.id);
              }}
              className="group flex min-w-[120px] cursor-pointer items-center gap-1.5 px-3 text-[11.5px] transition-colors"
              style={{
                background: active ? 'var(--wc-editor)' : 'transparent',
                color: active ? 'var(--wc-text)' : 'var(--wc-muted)',
                borderTop: active ? '2px solid var(--wc-accent)' : '2px solid transparent',
                borderRight: '1px solid var(--wc-border)',
              }}
              title={tab.path}
            >
              <FileCode2 size={11} />
              <span className="max-w-[140px] truncate">{tab.name}</span>
              {tab.dirty && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--wc-neon)' }} />}
              <button
                className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  void closeTab(tab.id);
                }}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-0.5 px-2">
          {aiBusy && <Loader2 size={11} className="spin" style={{ color: 'var(--wc-neon)' }} />}
          <button
            className="rounded p-1 hover:bg-[var(--wc-hover)]"
            title="Trigger AI inline completion (Ctrl+Space)"
            onClick={() => {
              notify('info', 'Type in the editor — AI suggests completions as ghost text. Tab accepts, Esc dismisses.');
            }}
          >
            <Sparkles size={12} style={{ color: 'var(--wc-neon)' }} />
          </button>
          <button className="rounded p-1 hover:bg-[var(--wc-hover)]" title="Split editor (Ctrl+\)" onClick={splitEditor}>
            <SplitSquareHorizontal size={12} />
          </button>
          <button
            className="rounded p-1 hover:bg-[var(--wc-hover)]"
            title="Save (Ctrl+S)"
            onClick={() => activeInColumn && void saveFile(activeInColumn.id)}
          >
            <Save size={12} />
          </button>
        </div>
      </div>

      {/* Monaco mount */}
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {(!activeInColumn || openFiles[activeInColumn.path]?.loading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--wc-muted)' }}>
            {openFiles[activeInColumn?.path ?? '']?.loading ? (
              <>
                <Loader2 size={26} className="spin" style={{ color: 'var(--wc-neon)' }} />
                <span className="text-[12px]">Loading file…</span>
              </>
            ) : (
              <>
                <div className="grad-text text-2xl font-bold">WinCode AI</div>
                <div className="text-[12px]">Open a file, or ask the AI to generate a project.</div>
                {workspaceRoot && (
                  <div className="max-w-[380px] text-center text-[11px] leading-relaxed">
                    <span className="font-mono text-[10px]">{workspaceRoot}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
