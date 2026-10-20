import { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  AlertTriangle,
  Hammer,
  Bug,
  Plus,
  X,
  Trash2,
  Square,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useApp } from '../state/store';
import TerminalView from './TerminalPanel';

export default function BottomPanel() {
  const bottomTab = useApp((s) => s.bottomTab);
  const setBottomTab = useApp((s) => s.setBottomTab);
  const terminals = useApp((s) => s.terminals);
  const activeTerminalId = useApp((s) => s.activeTerminalId);
  const createTerminal = useApp((s) => s.createTerminal);
  const closeTerminal = useApp((s) => s.closeTerminal);
  const problems = useApp((s) => s.problems);
  const buildLog = useApp((s) => s.buildLog);
  const buildRunning = useApp((s) => s.buildRunning);
  const lastBuild = useApp((s) => s.lastBuild);
  const stopBuild = useApp((s) => s.stopBuild);
  const buildTasks = useApp((s) => s.buildTasks);
  const runBuild = useApp((s) => s.runBuild);
  const openFile = useApp((s) => s.openFile);

  const tabs = [
    { id: 'terminal' as const, label: 'Terminal', icon: TerminalIcon },
    { id: 'problems' as const, label: `Problems (${problems.length})`, icon: AlertTriangle },
    { id: 'build' as const, label: 'Build', icon: Hammer },
    { id: 'debug' as const, label: 'Debug', icon: Bug },
    { id: 'output' as const, label: 'Output', icon: Sparkles },
  ];

  return (
    <div className="flex h-full flex-col" style={{ borderTop: '1px solid var(--wc-border)' }}>
      <div className="flex h-8 shrink-0 items-center gap-1 px-2" style={{ borderBottom: '1px solid var(--wc-border)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors"
            style={{
              color: bottomTab === t.id ? 'var(--wc-neon)' : 'var(--wc-muted)',
              background: bottomTab === t.id ? 'var(--wc-active)' : 'transparent',
            }}
            onClick={() => setBottomTab(t.id)}
          >
            <t.icon size={11} />
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {bottomTab === 'terminal' && (
            <>
              <button className="rounded p-1 hover:bg-[var(--wc-hover)]" title="New terminal" onClick={() => void createTerminal()}>
                <Plus size={12} />
              </button>
              {activeTerminalId && (
                <button className="rounded p-1 hover:bg-[var(--wc-hover)]" title="Kill terminal" onClick={() => void closeTerminal(activeTerminalId)}>
                  <X size={12} />
                </button>
              )}
            </>
          )}
          {bottomTab === 'build' && (
            <>
              {buildTasks.slice(0, 3).map((t) => (
                <button key={t.label} className="wc-btn py-0.5 text-[10px]" disabled={buildRunning} onClick={() => void runBuild(t)}>
                  {t.label.split(':').pop()}
                </button>
              ))}
              {buildRunning ? (
                <button className="wc-btn py-0.5 text-[10px]" style={{ color: '#EF4444' }} onClick={() => void stopBuild()}>
                  <Square size={10} /> Stop
                </button>
              ) : (
                <button className="wc-btn wc-btn-primary py-0.5 text-[10px]" onClick={() => void runBuild()}>
                  <Hammer size={10} /> Run
                </button>
              )}
            </>
          )}
          <button
            className="rounded p-1 hover:bg-[var(--wc-hover)]"
            title="Hide panel"
            onClick={() => useApp.setState({ showBottom: false })}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {bottomTab === 'terminal' && (
          <div className="flex h-full">
            <div className="w-28 shrink-0 overflow-y-auto py-1" style={{ borderRight: '1px solid var(--wc-border)' }}>
              {terminals.map((t) => (
                <button
                  key={t.id}
                  className="block w-full truncate px-2 py-1 text-left text-[10.5px]"
                  style={{
                    color: t.id === activeTerminalId ? 'var(--wc-neon)' : 'var(--wc-muted)',
                    background: t.id === activeTerminalId ? 'var(--wc-active)' : 'transparent',
                  }}
                  onClick={() => useApp.setState({ activeTerminalId: t.id })}
                >
                  {t.name}
                  {t.kind === 'pipe' && ' *'}
                </button>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              {activeTerminalId ? (
                <TerminalView key={activeTerminalId} termId={activeTerminalId} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <button className="wc-btn" onClick={() => void createTerminal()}>
                    <Plus size={12} /> Start terminal
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {bottomTab === 'problems' && (
          <div className="h-full overflow-y-auto">
            {problems.length === 0 ? (
              <div className="flex h-full items-center justify-center gap-2 text-[12px]" style={{ color: 'var(--wc-muted)' }}>
                <CheckCircle2 size={14} color="#22C55E" /> No problems detected
              </div>
            ) : (
              problems.map((p, i) => (
                <button
                  key={i}
                  className="flex w-full items-start gap-2 px-3 py-1 text-left text-[11.5px] hover:bg-[var(--wc-hover)]"
                  onClick={() => void openFile(p.file)}
                >
                  {p.severity === 'error' ? (
                    <XCircle size={12} color="#EF4444" className="mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle size={12} color="#F59E0B" className="mt-0.5 shrink-0" />
                  )}
                  <span className="truncate" style={{ color: 'var(--wc-text)' }}>
                    {p.message}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px]" style={{ color: 'var(--wc-muted)' }}>
                    {p.file.split(/[\\/]/).pop()}:{p.line}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {bottomTab === 'build' && <BuildLog log={buildLog} running={buildRunning} lastBuild={lastBuild} />}

        {bottomTab === 'debug' && <DebugConsole />}

        {bottomTab === 'output' && <BuildLog log={buildLog} running={buildRunning} lastBuild={lastBuild} />}
      </div>
    </div>
  );
}

function BuildLog({
  log,
  running,
  lastBuild,
}: {
  log: string;
  running: boolean;
  lastBuild: import('@shared/types').BuildResult | null;
}) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log]);

  return (
    <div className="relative h-full">
      <pre
        ref={ref}
        className="selectable h-full overflow-y-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11px] leading-relaxed"
        style={{ color: 'var(--wc-text)', background: 'var(--wc-editor)' }}
      >
        {log || (running ? 'Starting…' : 'Build output will appear here. Press F5 or use the Build tab buttons.')}
      </pre>
      {running && (
        <div className="absolute right-3 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]" style={{ background: 'var(--wc-panel)', color: 'var(--wc-neon)' }}>
          <Loader2 size={10} className="spin" /> building…
        </div>
      )}
      {lastBuild && (
        <div
          className="absolute bottom-2 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]"
          style={{
            background: 'var(--wc-panel)',
            color: lastBuild.ok ? '#22C55E' : '#EF4444',
            border: '1px solid var(--wc-border)',
          }}
        >
          {lastBuild.ok ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
          {lastBuild.ok ? 'Build succeeded' : `Build failed (exit ${lastBuild.exitCode})`} · {(lastBuild.durationMs / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}

function DebugConsole() {
  const lastBuild = useApp((s) => s.lastBuild);
  const buildLog = useApp((s) => s.buildLog);
  const [aiText, setAiText] = useState('');
  const [busy, setBusy] = useState(false);
  const notify = useApp((s) => s.notify);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid var(--wc-border)' }}>
        <Bug size={12} color="var(--wc-neon)" />
        <span className="text-[11px]" style={{ color: 'var(--wc-muted)' }}>
          Debug console — breakpoints via JDT/DAP adapters are configured in Settings → Debugger.
          Use <b>Fix with AI</b> to analyze the latest run.
        </span>
        <button
          className="wc-btn wc-btn-primary ml-auto py-0.5 text-[10px]"
          disabled={busy || !buildLog}
          onClick={async () => {
            setBusy(true);
            try {
              const files = (useApp.getState().tabs ?? []).map((t) => t.name).join(', ');
              const res = await window.wincode.aiAnalyzeError(useApp.getState().activeProviderId, buildLog, files);
              setAiText(res.text);
            } catch (err) {
              notify('error', 'AI analysis failed', (err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 size={10} className="spin" /> : <Sparkles size={10} />} Fix with AI
        </button>
      </div>
      <div className="selectable min-h-0 flex-1 overflow-y-auto px-3 py-2 text-[11px]" style={{ background: 'var(--wc-editor)' }}>
        {lastBuild ? (
          <div className="mb-2">
            Last run: <span style={{ color: lastBuild.ok ? '#22C55E' : '#EF4444' }}>{lastBuild.ok ? 'OK' : 'FAILED'}</span> — {lastBuild.command}
          </div>
        ) : (
          <div style={{ color: 'var(--wc-muted)' }}>Run the project (F5) to start a debug session.</div>
        )}
        {aiText && (
          <div className="ai-text mt-2 whitespace-pre-wrap rounded-lg border p-3" style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-text)' }}>
            {aiText}
          </div>
        )}
      </div>
    </div>
  );
}
