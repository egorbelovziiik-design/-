import { GitBranch, AlertTriangle, XCircle, Radio, Cpu, Bell, Sparkles, CheckCircle2 } from 'lucide-react';
import { useApp } from '../state/store';

export default function StatusBar() {
  const settings = useApp((s) => s.settings);
  const gitBranch = useApp((s) => s.gitBranch);
  const problems = useApp((s) => s.problems);
  const buildRunning = useApp((s) => s.buildRunning);
  const lastBuild = useApp((s) => s.lastBuild);
  const activeTab = useApp((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const aiMode = useApp((s) => s.aiMode);
  const setBottomTab = useApp((s) => s.setBottomTab);
  const setActivity = useApp((s) => s.setActivity);
  const setOverlay = useApp((s) => s.setOverlay);
  const notifications = useApp((s) => s.notifications);

  if (settings && !settings.appearance.statusBarVisible) return null;

  const errors = problems.filter((p) => p.severity === 'error').length;
  const warnings = problems.filter((p) => p.severity === 'warning').length;

  return (
    <div
      className="flex h-6 shrink-0 items-center gap-3 px-3 text-[10.5px]"
      style={{ background: 'var(--wc-statusbar)', borderTop: '1px solid var(--wc-border)', color: 'var(--wc-muted)' }}
    >
      <button className="flex items-center gap-1 hover:text-[var(--wc-text)]" onClick={() => setActivity('git')} title="Git branch">
        <GitBranch size={11} style={{ color: 'var(--wc-neon)' }} />
        {gitBranch || 'no repo'}
      </button>

      <button className="flex items-center gap-1.5 hover:text-[var(--wc-text)]" onClick={() => setBottomTab('problems')}>
        <XCircle size={11} color={errors ? '#EF4444' : 'inherit'} /> {errors}
        <AlertTriangle size={11} color={warnings ? '#F59E0B' : 'inherit'} /> {warnings}
      </button>

      {buildRunning ? (
        <span className="flex items-center gap-1" style={{ color: 'var(--wc-neon)' }}>
          <Radio size={10} className="pulse-dot" /> Building…
        </span>
      ) : lastBuild ? (
        <button className="flex items-center gap-1 hover:text-[var(--wc-text)]" onClick={() => setBottomTab('build')}>
          {lastBuild.ok ? <CheckCircle2 size={10} color="#22C55E" /> : <XCircle size={10} color="#EF4444" />}
          {lastBuild.ok ? 'Build OK' : 'Build failed'}
        </button>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        {activeTab && (
          <span>
            Ln {activeTab.cursor?.line ?? 1}, Col {activeTab.cursor?.column ?? 1} · {activeTab.language}
          </span>
        )}
        <button className="flex items-center gap-1 hover:text-[var(--wc-text)]" onClick={() => useApp.setState({ showRight: true })}>
          <Sparkles size={10} style={{ color: 'var(--wc-neon)' }} /> AI: {aiMode}
        </button>
        <button className="hover:text-[var(--wc-text)]" onClick={() => setOverlay('settings', true, 'performance')}>
          <Cpu size={11} />
        </button>
        <button
          className="relative hover:text-[var(--wc-text)]"
          title={notifications.length ? notifications[notifications.length - 1].message : 'Notifications'}
          onClick={() => setOverlay('settings', true, 'privacy')}
        >
          <Bell size={11} />
          {notifications.length > 0 && (
            <span className="absolute -right-1.5 -top-1 flex h-2.5 w-2.5 items-center justify-center">
              <span className="absolute h-2 w-2 rounded-full" style={{ background: 'var(--wc-accent)' }} />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
