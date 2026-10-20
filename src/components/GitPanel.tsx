import { useState, useEffect } from 'react';
import { GitBranch, GitCommitHorizontal, GitPullRequestArrow, RefreshCw, Download, Upload, Plus, Loader2, Trash2, History } from 'lucide-react';
import { useApp } from '../state/store';

export default function GitPanel() {
  const root = useApp((s) => s.workspaceRoot);
  const entries = useApp((s) => s.gitEntries);
  const branch = useApp((s) => s.gitBranch);
  const ahead = useApp((s) => s.gitAhead);
  const behind = useApp((s) => s.gitBehind);
  const log = useApp((s) => s.gitLog);
  const refreshGit = useApp((s) => s.refreshGit);
  const notify = useApp((s) => s.notify);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'changes' | 'history'>('changes');
  const [branches, setBranches] = useState<{ name: string; current: boolean; remote: boolean }[]>([]);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');

  useEffect(() => {
    if (!root) return;
    void refreshGit();
  }, [root, refreshGit]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const res = await fn();
      notify('success', `${label} OK${typeof res === 'string' && res.trim() ? '' : ''}`);
      await refreshGit();
    } catch (err) {
      notify('error', `${label} failed`, (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const staged = entries.filter((e) => e.staged);
  const unstaged = entries.filter((e) => !e.staged);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-3" style={{ borderBottom: '1px solid var(--wc-border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Source Control
        </span>
        <button className="rounded p-1 hover:bg-[var(--wc-hover)]" onClick={() => void refreshGit()} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {!root ? (
        <div className="p-4 text-[12px]" style={{ color: 'var(--wc-muted)' }}>
          Open a project to use Git integration.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--wc-border)' }}>
            <GitBranch size={13} color="var(--wc-neon)" />
            <select
              className="wc-input flex-1 py-1 text-[11.5px]"
              value={branch}
              onFocus={async () => setBranches(await window.wincode.gitBranches(root).catch(() => []))}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  const name = prompt('New branch name:');
                  if (name) void run('Create branch', () => window.wincode.gitCreateBranch(root, name));
                } else {
                  void run('Checkout', () => window.wincode.gitCheckout(root, e.target.value));
                }
              }}
            >
              <option value={branch}>{branch || 'HEAD'}</option>
              {branches
                .filter((b) => !b.current && !b.remote)
                .map((b) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              <option value="__new__">+ New branch…</option>
            </select>
            {(ahead > 0 || behind > 0) && (
              <span className="text-[10px]" style={{ color: 'var(--wc-muted)' }}>
                ↑{ahead} ↓{behind}
              </span>
            )}
          </div>

          <div className="flex gap-1 px-3 py-2">
            <button className="wc-btn flex-1 justify-center py-1 text-[11px]" disabled={busy} onClick={() => void run('Pull', () => window.wincode.gitPull(root))}>
              {busy ? <Loader2 size={11} className="spin" /> : <Download size={11} />} Pull
            </button>
            <button className="wc-btn flex-1 justify-center py-1 text-[11px]" disabled={busy} onClick={() => void run('Push', () => window.wincode.gitPush(root))}>
              <Upload size={11} /> Push
            </button>
            <button className="wc-btn flex-1 justify-center py-1 text-[11px]" onClick={() => void run('Init', () => window.wincode.gitInit(root))}>
              <Plus size={11} /> Init
            </button>
          </div>

          <div className="px-3 pb-2">
            <textarea
              className="wc-input w-full resize-none text-[11.5px]"
              rows={2}
              placeholder="Commit message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              className="wc-btn wc-btn-primary mt-1.5 w-full justify-center py-1 text-[11.5px]"
              disabled={busy || !message.trim()}
              onClick={async () => {
                if (!staged.length) {
                  await window.wincode.gitStage(root, unstaged.map((e) => e.path)).catch(() => undefined);
                }
                await run('Commit', async () => {
                  const out = await window.wincode.gitCommit(root, message.trim());
                  setMessage('');
                  return out;
                });
              }}
            >
              <GitCommitHorizontal size={12} /> Commit {staged.length > 0 ? `(${staged.length} staged)` : 'all changes'}
            </button>
          </div>

          <div className="flex gap-1 px-3 pb-1 text-[10.5px]">
            <button
              className="rounded px-2 py-0.5"
              style={{ background: view === 'changes' ? 'var(--wc-active)' : 'transparent', color: 'var(--wc-text)' }}
              onClick={() => setView('changes')}
            >
              Changes ({entries.length})
            </button>
            <button
              className="rounded px-2 py-0.5"
              style={{ background: view === 'history' ? 'var(--wc-active)' : 'transparent', color: 'var(--wc-text)' }}
              onClick={() => setView('history')}
            >
              <History size={10} className="mr-1 inline" /> History
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {view === 'changes' ? (
              entries.length === 0 ? (
                <div className="px-4 py-4 text-center text-[11.5px]" style={{ color: 'var(--wc-muted)' }}>
                  Working tree clean ✨
                </div>
              ) : (
                entries.map((e) => (
                  <div key={e.path} className="group flex items-center gap-2 px-3 py-[3px] text-[11.5px] hover:bg-[var(--wc-hover)]">
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white"
                      style={{ background: e.conflicted ? '#EF4444' : e.staged ? '#22C55E' : '#F59E0B' }}
                    >
                      {e.index !== ' ' && e.index !== '?' ? e.index : e.working}
                    </span>
                    <span className="flex-1 truncate" style={{ color: 'var(--wc-muted)' }} title={e.path}>
                      {e.path}
                    </span>
                    <button
                      className="hidden group-hover:block"
                      title={e.staged ? 'Unstage' : 'Stage'}
                      onClick={() =>
                        void run(e.staged ? 'Unstage' : 'Stage', () =>
                          e.staged ? window.wincode.gitUnstage(root, [e.path]) : window.wincode.gitStage(root, [e.path]),
                        )
                      }
                    >
                      <Plus size={11} />
                    </button>
                    {!e.staged && (
                      <button
                        className="hidden group-hover:block"
                        title="Discard changes"
                        onClick={() => void run('Discard', () => window.wincode.gitDiscard(root, e.path))}
                      >
                        <Trash2 size={11} color="#EF4444" />
                      </button>
                    )}
                  </div>
                ))
              )
            ) : (
              log.map((c) => (
                <div key={c.hash} className="px-3 py-1.5 hover:bg-[var(--wc-hover)]">
                  <div className="truncate text-[11.5px]" style={{ color: 'var(--wc-text)' }}>
                    {c.subject}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--wc-muted)' }}>
                    <span className="font-mono">{c.hash.slice(0, 7)}</span> · {c.author} · {c.date}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2" style={{ borderTop: '1px solid var(--wc-border)' }}>
            {cloneOpen ? (
              <div className="space-y-1.5">
                <input
                  className="wc-input w-full text-[10.5px]"
                  placeholder="https://github.com/user/repo.git"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                />
                <div className="flex gap-1.5">
                  <button
                    className="wc-btn wc-btn-primary flex-1 justify-center py-1 text-[10.5px]"
                    disabled={busy || !cloneUrl.trim()}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const target = await window.wincode.gitClone(cloneUrl.trim());
                        if (target) {
                          notify('success', 'Repository cloned');
                          await useApp.getState().openWorkspace(target);
                          setCloneOpen(false);
                          setCloneUrl('');
                        }
                      } catch (err) {
                        notify('error', 'Clone failed', (err as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Clone
                  </button>
                  <button className="wc-btn py-1 text-[10.5px]" onClick={() => setCloneOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="wc-btn w-full justify-center py-1 text-[11px]" onClick={() => setCloneOpen(true)}>
                <GitPullRequestArrow size={11} /> Clone Repository…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}


