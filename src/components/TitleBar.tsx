import { useState, useRef, useEffect } from 'react';
import { Minus, Square, X, Copy, Sparkles, Bot } from 'lucide-react';
import { useApp } from '../state/store';

interface MenuDef {
  label: string;
  items: {
    label: string;
    shortcut?: string;
    action?: () => void;
    separator?: boolean;
  }[];
}

export default function TitleBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const store = useApp();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    return window.wincode.onMenuAction((action) => {
      const s = useApp.getState();
      switch (action) {
        case 'file.save':
          if (s.activeTabId) void s.saveFile(s.activeTabId);
          break;
        case 'file.saveAll':
          void s.saveAll();
          break;
        case 'file.open':
          void (async () => {
            const folder = await window.wincode.pickFolder();
            if (folder) await s.openWorkspace(folder);
          })();
          break;
        case 'file.new':
          s.setOverlay('palette', true);
          break;
        case 'settings.open':
          s.setOverlay('settings', true);
          break;
        case 'build.run':
          void s.runBuild();
          break;
        case 'build.build':
          void s.runBuild(s.buildTasks[0]);
          break;
        case 'build.stop':
          void s.stopBuild();
          break;
        case 'build.debug':
          s.setBottomTab('debug');
          void s.runBuild();
          break;
        case 'ai.toggle':
          useApp.setState({ showRight: !useApp.getState().showRight });
          break;
        case 'ai.agent':
          useApp.setState({ showRight: true, aiMode: 'AGENT' });
          break;
        case 'ai.inline':
          s.notify('info', 'Inline AI completion is active — type in the editor and press Ctrl+Space');
          break;
        case 'help.about':
          s.setOverlay('about', true);
          break;
      }
    });
  }, []);

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'New Project…', shortcut: 'Ctrl+Shift+N', action: () => store.setOverlay('wizard', true) },
        { label: 'New File', shortcut: 'Ctrl+N', action: () => store.setOverlay('palette', true) },
        { label: 'Open Folder…', shortcut: 'Ctrl+O', action: async () => { const f = await window.wincode.pickFolder(); if (f) await store.openWorkspace(f); } },
        { label: 'Clone Git Repository…', action: async () => { const url = await window.wincode.showMessage({ title: 'Clone repository', message: 'Use the Git panel (Ctrl+Shift+G) → Clone to enter a repository URL.', buttons: ['Open Git panel', 'Close'] }); if (url === 0) store.setActivity('git'); } },
        { label: '', separator: true },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => { if (store.activeTabId) void store.saveFile(store.activeTabId); } },
        { label: 'Save All', shortcut: 'Ctrl+K S', action: () => void store.saveAll() },
        { label: '', separator: true },
        { label: 'Settings', shortcut: 'Ctrl+,', action: () => store.setOverlay('settings', true) },
        { label: 'Close Project', action: () => store.closeWorkspace() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
        { label: '', separator: true },
        { label: 'Find in Files', shortcut: 'Ctrl+Shift+F', action: () => store.setActivity('search') },
        { label: 'Command Palette', shortcut: 'Ctrl+Shift+P', action: () => store.setOverlay('palette', true) },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: () => store.setActivity('explorer') },
        { label: 'AI Panel', shortcut: 'Ctrl+Shift+A', action: () => useApp.setState({ showRight: !useApp.getState().showRight }) },
        { label: 'Terminal', shortcut: 'Ctrl+`', action: () => useApp.setState({ showBottom: true, bottomTab: 'terminal' }) },
        { label: 'Problems', action: () => store.setBottomTab('problems') },
        { label: 'Build Panel', action: () => store.setBottomTab('build') },
        { label: 'Split Editor', shortcut: 'Ctrl+\\', action: () => store.splitEditor() },
        { label: '', separator: true },
        { label: 'GUI Builder', action: () => store.setOverlay('guiBuilder', true) },
      ],
    },
    {
      label: 'Run',
      items: [
        { label: 'Run Project', shortcut: 'F5', action: () => void store.runBuild() },
        { label: 'Build', shortcut: 'Ctrl+Shift+B', action: () => void store.runBuild(store.buildTasks[0]) },
        { label: 'Debug', shortcut: 'F6', action: () => { store.setBottomTab('debug'); void store.runBuild(); } },
        { label: 'Stop', shortcut: 'Shift+F5', action: () => void store.stopBuild() },
      ],
    },
    {
      label: 'AI',
      items: [
        { label: 'Chat / Agent Panel', shortcut: 'Ctrl+Shift+A', action: () => useApp.setState({ showRight: true }) },
        { label: 'Mode: ASK', action: () => store.setAiMode('ASK') },
        { label: 'Mode: AGENT', action: () => store.setAiMode('AGENT') },
        { label: 'Mode: PLAN', action: () => store.setAiMode('PLAN') },
        { label: 'Mode: DEBUG', action: () => store.setAiMode('DEBUG') },
        { label: 'Mode: AUTOPILOT', action: () => store.setAiMode('AUTOPILOT') },
        { label: '', separator: true },
        { label: 'AI Settings…', action: () => store.setOverlay('settings', true, 'ai') },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'About WinCode AI', action: () => store.setOverlay('about', true) },
        { label: 'Check for Updates', action: async () => { const r = await window.wincode.updateCheck(); store.notify('info', `WinCode AI ${r.current} — up to date`); } },
      ],
    },
  ];

  return (
    <div
      className="wc-titlebar flex h-9 shrink-0 items-center justify-between px-2"
      style={{ background: 'var(--wc-titlebar)', borderBottom: '1px solid var(--wc-border)' }}
    >
      <div className="no-drag flex items-center gap-1">
        <div className="mr-1 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: 'linear-gradient(135deg,#9333EA,#A855F7)' }}>
            <Sparkles size={12} color="white" />
          </div>
          <span className="text-[12px] font-semibold tracking-wide" style={{ color: 'var(--wc-text)' }}>
            WinCode AI
          </span>
        </div>
        <div ref={menuRef} className="flex items-center">
          {menus.map((menu) => (
            <div key={menu.label} className="relative">
              <button
                className={`rounded px-2.5 py-1 text-[12px] transition-colors ${openMenu === menu.label ? 'font-medium' : ''}`}
                style={{
                  color: openMenu === menu.label ? 'var(--wc-neon)' : 'var(--wc-muted)',
                  background: openMenu === menu.label ? 'var(--wc-hover)' : 'transparent',
                }}
                onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
                onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
              >
                {menu.label}
              </button>
              {openMenu === menu.label && (
                <div className="ctx-menu absolute left-0 top-full mt-1 animate-fade-in">
                  {menu.items.map((item, i) =>
                    item.separator ? (
                      <div key={i} className="my-1 h-px" style={{ background: 'var(--wc-border)' }} />
                    ) : (
                      <button
                        key={i}
                        className="ctx-item w-full"
                        onClick={() => {
                          setOpenMenu(null);
                          item.action?.();
                        }}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && <span className="text-[11px]" style={{ color: 'var(--wc-muted)' }}>{item.shortcut}</span>}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {store.workspaceRoot && (
          <div className="ml-3 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--wc-muted)' }}>
            <Bot size={12} />
            <span className="max-w-[280px] truncate">{store.workspaceRoot}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          className="no-drag rounded px-2 py-1 text-[11px]"
          style={{ color: 'var(--wc-muted)' }}
          onClick={() => useApp.setState({ showRight: !useApp.getState().showRight })}
          title="Toggle AI panel (Ctrl+Shift+A)"
        >
          <Copy size={13} className="hidden" />
          AI
        </button>
        <div className="no-drag flex items-center">
          <button
            className="flex h-8 w-10 items-center justify-center rounded transition-colors hover:bg-white/10"
            onClick={() => void window.wincode.minimize()}
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            className="flex h-8 w-10 items-center justify-center rounded transition-colors hover:bg-white/10"
            onClick={() => void window.wincode.maximize()}
            title="Maximize"
          >
            <Square size={11} />
          </button>
          <button
            className="flex h-8 w-10 items-center justify-center rounded transition-colors hover:bg-red-500/80"
            onClick={() => void window.wincode.close()}
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
