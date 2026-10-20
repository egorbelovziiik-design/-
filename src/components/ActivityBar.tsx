import { Files, Search, GitBranch, Bug, Puzzle, Pickaxe, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useApp } from '../state/store';

const items = [
  { id: 'explorer' as const, icon: Files, label: 'Explorer (Ctrl+Shift+E)' },
  { id: 'search' as const, icon: Search, label: 'Search (Ctrl+Shift+F)' },
  { id: 'git' as const, icon: GitBranch, label: 'Source Control (Ctrl+Shift+G)' },
  { id: 'minecraft' as const, icon: Pickaxe, label: 'Minecraft Development Center' },
  { id: 'debug' as const, icon: Bug, label: 'Run & Debug' },
  { id: 'plugins' as const, icon: Puzzle, label: 'Plugins' },
];

export default function ActivityBar() {
  const activity = useApp((s) => s.activity);
  const setActivity = useApp((s) => s.setActivity);
  const showLeft = useApp((s) => s.showLeft);
  const gitEntries = useApp((s) => s.gitEntries);
  const problems = useApp((s) => s.problems);

  return (
    <div
      className="flex w-12 shrink-0 flex-col items-center justify-between py-2"
      style={{ background: 'var(--wc-titlebar)', borderRight: '1px solid var(--wc-border)' }}
    >
      <div className="flex flex-col items-center gap-1">
        {items.map(({ id, icon: Icon, label }) => {
          const active = activity === id;
          const badge = id === 'git' ? gitEntries.length : id === 'debug' ? problems.filter((p) => p.severity === 'error').length : 0;
          return (
            <button
              key={id}
              title={label}
              onClick={() => (active && showLeft ? useApp.setState({ showLeft: false }) : setActivity(id))}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-all"
              style={{
                color: active ? 'var(--wc-neon)' : 'var(--wc-muted)',
                background: active ? 'var(--wc-active)' : 'transparent',
              }}
            >
              <Icon size={18} />
              {badge > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: 'var(--wc-accent)' }}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        title={showLeft ? 'Hide side panel' : 'Show side panel'}
        onClick={() => useApp.setState({ showLeft: !showLeft })}
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ color: 'var(--wc-muted)' }}
      >
        {showLeft ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
      </button>
    </div>
  );
}
