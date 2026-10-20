import { useEffect } from 'react';
import { useApp } from './state/store';
import TitleBar from './components/TitleBar';
import ActivityBar from './components/ActivityBar';
import Explorer from './components/Explorer';
import SearchPanel from './components/SearchPanel';
import GitPanel from './components/GitPanel';
import PluginsPanel from './components/PluginsPanel';
import MinecraftPanel from './components/MinecraftPanel';
import EditorArea from './components/EditorArea';
import BottomPanel from './components/BottomPanel';
import AIPanel from './components/AIPanel';
import StatusBar from './components/StatusBar';
import WelcomeScreen from './components/WelcomeScreen';
import Notifications from './components/Notifications';
import SettingsWindow from './components/SettingsWindow';
import NewProjectWizard from './components/NewProjectWizard';
import CommandPalette from './components/CommandPalette';
import PermissionModal from './components/PermissionModal';
import GuiBuilder from './components/GuiBuilder';
import AboutDialog from './components/AboutDialog';

export default function App() {
  const booted = useApp((s) => s.booted);
  const view = useApp((s) => s.view);
  const boot = useApp((s) => s.boot);
  const showLeft = useApp((s) => s.showLeft);
  const showRight = useApp((s) => s.showRight);
  const showBottom = useApp((s) => s.showBottom);
  const activity = useApp((s) => s.activity);
  const leftWidth = useApp((s) => s.leftWidth);
  const rightWidth = useApp((s) => s.rightWidth);
  const bottomHeight = useApp((s) => s.bottomHeight);
  const splitView = useApp((s) => s.splitView);

  useEffect(() => {
    void boot();
  }, [boot]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const store = useApp.getState();
      if (mod && key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (store.activeTabId) void store.saveFile(store.activeTabId);
      } else if (mod && key === 's' && e.shiftKey) {
        e.preventDefault();
        void store.saveAll();
      } else if (mod && key === 'p' && !e.shiftKey) {
        e.preventDefault();
        store.setOverlay('palette', true);
      } else if (mod && key === 'p' && e.shiftKey) {
        e.preventDefault();
        store.setOverlay('palette', true);
      } else if (mod && key === 'e' && e.shiftKey) {
        e.preventDefault();
        store.setActivity('explorer');
      } else if (mod && key === 'f' && e.shiftKey) {
        e.preventDefault();
        store.setActivity('search');
      } else if (mod && key === 'g' && e.shiftKey) {
        e.preventDefault();
        store.setActivity('git');
      } else if (mod && key === 'a' && e.shiftKey) {
        e.preventDefault();
        useApp.setState({ showRight: !useApp.getState().showRight });
      } else if (mod && key === ',') {
        e.preventDefault();
        store.setOverlay('settings', true);
      } else if (mod && key === '\\') {
        e.preventDefault();
        store.splitEditor();
      } else if (e.key === '`' && mod) {
        e.preventDefault();
        useApp.setState({ showBottom: !useApp.getState().showBottom, bottomTab: 'terminal' });
      } else if (e.key === 'F5' && !e.shiftKey) {
        e.preventDefault();
        void store.runBuild();
      } else if (e.key === 'F5' && e.shiftKey) {
        e.preventDefault();
        void store.stopBuild();
      } else if (e.key === 'Escape') {
        store.setOverlay('palette', false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!booted) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: 'var(--wc-bg)' }}>
        <div className="text-center">
          <div className="grad-text mb-3 text-3xl font-bold">WinCode AI</div>
          <div className="text-sm" style={{ color: 'var(--wc-muted)' }}>
            Loading workspace…
          </div>
          <div className="mx-auto mt-4 h-1 w-44 overflow-hidden rounded-full" style={{ background: 'var(--wc-border)' }}>
            <div className="h-full w-1/2 rounded-full" style={{ background: 'var(--wc-accent)', animation: 'wc-shimmer 1.2s infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--wc-bg)' }}>
      <TitleBar />
      {view === 'welcome' ? (
        <WelcomeScreen />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ActivityBar />
          {showLeft && (
            <>
              <div
                className="relative shrink-0 overflow-hidden"
                style={{ width: leftWidth, background: 'var(--wc-panel)', borderRight: '1px solid var(--wc-border)' }}
              >
                {activity === 'explorer' && <Explorer />}
                {activity === 'search' && <SearchPanel />}
                {activity === 'git' && <GitPanel />}
                {activity === 'debug' && <MinecraftPanel mode="debug" />}
                {activity === 'plugins' && <PluginsPanel />}
                {activity === 'minecraft' && <MinecraftPanel />}
              </div>
              <div
                className="w-[3px] cursor-col-resize transition-colors hover:bg-[var(--wc-accent)]"
                onMouseDown={(e) => {
                  const startX = e.clientX;
                  const startW = leftWidth;
                  const onMove = (ev: MouseEvent) => useApp.setState({ leftWidth: Math.max(180, Math.min(520, startW + ev.clientX - startX)) });
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              />
            </>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
              <EditorArea column={0} />
              {splitView && (
                <>
                  <div
                    className="w-[3px] cursor-col-resize hover:bg-[var(--wc-accent)]"
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                  />
                  <EditorArea column={1} />
                </>
              )}
            </div>
            {showBottom && (
              <>
                <div
                  className="h-[3px] cursor-row-resize transition-colors hover:bg-[var(--wc-accent)]"
                  onMouseDown={(e) => {
                    const startY = e.clientY;
                    const startH = bottomHeight;
                    const onMove = (ev: MouseEvent) => useApp.setState({ bottomHeight: Math.max(100, Math.min(640, startH + startY - ev.clientY)) });
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                />
                <div style={{ height: bottomHeight, background: 'var(--wc-panel)' }} className="shrink-0">
                  <BottomPanel />
                </div>
              </>
            )}
          </div>
          {showRight && (
            <>
              <div
                className="w-[3px] cursor-col-resize transition-colors hover:bg-[var(--wc-accent)]"
                onMouseDown={(e) => {
                  const startX = e.clientX;
                  const startW = rightWidth;
                  const onMove = (ev: MouseEvent) => useApp.setState({ rightWidth: Math.max(260, Math.min(640, startW + startX - ev.clientX)) });
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              />
              <div className="shrink-0 overflow-hidden" style={{ width: rightWidth, background: 'var(--wc-panel)', borderLeft: '1px solid var(--wc-border)' }}>
                <AIPanel />
              </div>
            </>
          )}
        </div>
      )}
      <StatusBar />
      <Notifications />
      <SettingsWindow />
      <NewProjectWizard />
      <CommandPalette />
      <PermissionModal />
      <GuiBuilder />
      <AboutDialog />
    </div>
  );
}
