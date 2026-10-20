import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Send,
  Square,
  Bot,
  User,
  Paperclip,
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  ChevronDown,
  Brain,
} from 'lucide-react';
import { useApp, type AgentLogEntry } from '../state/store';
import type { AgentMode, AIMessage } from '@shared/types';

const MODES: { id: AgentMode; title: string; desc: string }[] = [
  { id: 'ASK', title: 'ASK', desc: 'Answers only — no file changes' },
  { id: 'EDIT', title: 'EDIT', desc: 'Edits only the selected files' },
  { id: 'AGENT', title: 'AGENT', desc: 'Full autonomous development' },
  { id: 'PLAN', title: 'PLAN', desc: 'Architecture & planning' },
  { id: 'DEBUG', title: 'DEBUG', desc: 'Find and fix bugs' },
  { id: 'AUTOPILOT', title: 'AUTOPILOT', desc: 'Execute the agreed plan' },
];

function renderMarkdownLite(text: string): string {
  // Safe minimal markdown: escape HTML, then code blocks / inline code / bold.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code}</code></pre>`)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

export default function AIPanel() {
  const settings = useApp((s) => s.settings);
  const aiMessages = useApp((s) => s.aiMessages);
  const aiStreaming = useApp((s) => s.aiStreaming);
  const aiMode = useApp((s) => s.aiMode);
  const agentLog = useApp((s) => s.agentLog);
  const pushAiMessage = useApp((s) => s.pushAiMessage);
  const setAiStreaming = useApp((s) => s.setAiStreaming);
  const pushAgentLog = useApp((s) => s.pushAgentLog);
  const setAiMode = useApp((s) => s.setAiMode);
  const notify = useApp((s) => s.notify);
  const activeTabPath = useApp((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.path ?? null;
  });

  const [input, setInput] = useState('');
  const [providers, setProviders] = useState<{ id: string; name: string; model: string; hasApiKey: boolean; kind: string }[]>([]);
  const [providerId, setProviderId] = useState(settings?.ai.activeProviderId ?? 'openai');
  const [model, setModel] = useState('');
  const [modeOpen, setModeOpen] = useState(false);
  const [includeFile, setIncludeFile] = useState(true);
  const [view, setView] = useState<'chat' | 'agent'>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRequestId = useRef<string | null>(null);
  const streamBuffer = useRef<string>('');

  // providers list
  useEffect(() => {
    void window.wincode.aiListProviders().then((list) => {
      setProviders(list);
      const active = list.find((p) => p.id === providerId) ?? list[0];
      if (active) {
        setProviderId(active.id);
        setModel(active.model);
      }
    });
  }, []);

  // stream events
  useEffect(() => {
    const offChunk = window.wincode.onAiStreamChunk(({ requestId, delta }) => {
      if (requestId !== activeRequestId.current) return;
      streamBuffer.current += delta;
      // live-update last assistant message
      const msgs = useApp.getState().aiMessages;
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant' && last.ts === -1) {
        useApp.setState({
          aiMessages: [...msgs.slice(0, -1), { ...last, content: streamBuffer.current }],
        });
      }
    });
    const offDone = window.wincode.onAiStreamDone(() => {
      const msgs = useApp.getState().aiMessages;
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant' && last.ts === -1) {
        useApp.setState({
          aiMessages: [...msgs.slice(0, -1), { ...last, content: streamBuffer.current, ts: Date.now() }],
        });
      }
      setAiStreaming(false);
      activeRequestId.current = null;
    });
    const offError = window.wincode.onAiStreamError(({ message, cancelled }) => {
      setAiStreaming(false);
      activeRequestId.current = null;
      if (!cancelled) {
        pushAiMessage({ role: 'assistant', content: `⚠️ **Error:** ${message}`, ts: Date.now() });
        notify('error', 'AI request failed', message);
      }
    });
    const offAgent = window.wincode.onAiAgentEvent((event) => {
      const e = event as AgentLogEntry;
      pushAgentLog(e);
      if (e.type === 'text') {
        const msgs = useApp.getState().aiMessages;
        const last = msgs[msgs.length - 1];
        const delta = String(e.payload ?? '');
        if (last && last.role === 'assistant' && last.ts === -1) {
          useApp.setState({
            aiMessages: [...msgs.slice(0, -1), { ...last, content: last.content + delta }],
          });
        } else {
          pushAiMessage({ role: 'assistant', content: delta, ts: -1 });
        }
      } else if (e.type === 'done') {
        const msgs = useApp.getState().aiMessages;
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant' && last.ts === -1) {
          useApp.setState({ aiMessages: [...msgs.slice(0, -1), { ...last, ts: Date.now() }] });
        }
        setAiStreaming(false);
        useApp.setState({ aiRunActive: false });
        void useApp.getState().refreshTree();
      } else if (e.type === 'error') {
        const payload = e.payload as { message?: string };
        pushAiMessage({ role: 'assistant', content: `⚠️ **Agent error:** ${payload?.message ?? 'unknown'}`, ts: Date.now() });
        setAiStreaming(false);
        useApp.setState({ aiRunActive: false });
      } else if (e.type === 'stopped') {
        pushAiMessage({ role: 'assistant', content: '_(agent stopped)_', ts: Date.now() });
        setAiStreaming(false);
        useApp.setState({ aiRunActive: false });
      }
    });
    return () => {
      offChunk();
      offDone();
      offError();
      offAgent();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [aiMessages, agentLog]);

  const history = useMemo<AIMessage[]>(
    () => aiMessages.filter((m) => m.ts !== -1).map(({ role, content }) => ({ role, content })),
    [aiMessages],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || aiStreaming) return;
    setInput('');

    const root = useApp.getState().workspaceRoot;
    let content = text;
    if (includeFile && activeTabPath) {
      const file = useApp.getState().openFiles[activeTabPath];
      const snippet = file?.content.slice(0, 6000) ?? '';
      content = `Current file: \`${activeTabPath}\`\n\`\`\`\n${snippet}\n\`\`\`\n\n${text}`;
    }

    pushAiMessage({ role: 'user', content: text, ts: Date.now() });
    pushAiMessage({ role: 'assistant', content: '', ts: -1 });
    setAiStreaming(true);
    streamBuffer.current = '';

    if (aiMode === 'ASK') {
      const requestId = `req_${Date.now()}`;
      activeRequestId.current = requestId;
      const sysMsg: AIMessage = {
        role: 'system',
        content:
          'You are WinCode Intelligence, the AI engine of the WinCode AI IDE. You are an expert in Java, Kotlin, Minecraft mod development (Fabric/Forge/NeoForge/Mixin), Gradle, TypeScript, Python, C++, architecture and debugging. Answer precisely with real code. Keep answers focused.',
      };
      await window.wincode.aiStream(
        requestId,
        [sysMsg, ...history.slice(-12), { role: 'user', content }],
        { providerId, model: model || undefined, temperature: settings?.ai.temperature ?? 0.4 },
      );
    } else {
      if (!root) {
        pushAiMessage({ role: 'assistant', content: '⚠️ Open a project first — Agent modes need a project workspace.', ts: Date.now() });
        setAiStreaming(false);
        return;
      }
      useApp.setState({ aiRunActive: true });
      setView('agent');
      const runId = `run_${Date.now()}`;
      activeRequestId.current = runId;
      await window.wincode.aiAgentRun(runId, content, history.slice(-10), aiMode, root);
    }
  };

  const stop = async () => {
    if (activeRequestId.current) {
      await window.wincode.aiAgentStop(activeRequestId.current);
      await window.wincode.aiStreamCancel(activeRequestId.current);
    }
    setAiStreaming(false);
    useApp.setState({ aiRunActive: false });
  };

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="shrink-0 px-3 pt-2.5" style={{ borderBottom: '1px solid var(--wc-border)' }}>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: 'linear-gradient(135deg,#9333EA,#A855F7)' }}>
            <Sparkles size={13} color="white" />
          </div>
          <span className="text-[12px] font-semibold">WinCode Intelligence</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              className={`rounded px-1.5 py-0.5 text-[10px] ${view === 'chat' ? '' : ''}`}
              style={{ color: view === 'chat' ? 'var(--wc-neon)' : 'var(--wc-muted)', background: view === 'chat' ? 'var(--wc-active)' : 'transparent' }}
              onClick={() => setView('chat')}
            >
              Chat
            </button>
            <button
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{ color: view === 'agent' ? 'var(--wc-neon)' : 'var(--wc-muted)', background: view === 'agent' ? 'var(--wc-active)' : 'transparent' }}
              onClick={() => setView('agent')}
            >
              Agent log
            </button>
            <button
              className="rounded p-1 hover:bg-[var(--wc-hover)]"
              title="Clear chat"
              onClick={() => useApp.setState({ aiMessages: [], agentLog: [] })}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* provider + mode */}
        <div className="mt-2 flex gap-1.5">
          <select
            className="wc-input flex-1 py-1 text-[10.5px]"
            value={providerId}
            onChange={(e) => {
              const p = providers.find((x) => x.id === e.target.value);
              if (p) {
                setProviderId(p.id);
                setModel(p.model);
                useApp.getState().setAiProvider(p.id, p.model);
              }
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.model}
                {!p.hasApiKey && p.kind !== 'ollama' && p.kind !== 'lmstudio' ? ' (no key)' : ''}
              </option>
            ))}
          </select>
          <div className="relative">
            <button className="wc-btn py-1 text-[10.5px]" onClick={() => setModeOpen(!modeOpen)}>
              <Bot size={11} /> {aiMode} <ChevronDown size={10} />
            </button>
            {modeOpen && (
              <div className="ctx-menu absolute right-0 top-full z-30 mt-1 w-56 animate-fade-in">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className="ctx-item w-full"
                    onClick={() => {
                      setAiMode(m.id);
                      setModeOpen(false);
                    }}
                  >
                    <div>
                      <div className="font-medium" style={{ color: aiMode === m.id ? 'var(--wc-neon)' : 'var(--wc-text)' }}>{m.title}</div>
                      <div className="text-[10px]" style={{ color: 'var(--wc-muted)' }}>{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2 pb-2">
          <input
            id="ai-attach"
            type="checkbox"
            checked={includeFile}
            onChange={(e) => setIncludeFile(e.target.checked)}
            className="accent-purple-600"
          />
          <label htmlFor="ai-attach" className="flex cursor-pointer items-center gap-1 text-[10px]" style={{ color: 'var(--wc-muted)' }}>
            <Paperclip size={9} /> Attach current file {activeTabPath ? `(${activeTabPath.split(/[\\/]/).pop()})` : ''}
          </label>
          {settings?.ai.inlineCompletion && (
            <span className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: 'var(--wc-muted)' }}>
              <Brain size={9} /> inline AI on
            </span>
          )}
        </div>
      </div>

      {/* messages / agent log */}
      {view === 'chat' ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2.5">
          {aiMessages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Sparkles size={28} style={{ color: 'var(--wc-neon)' }} className="opacity-70" />
              <div className="text-[12px] font-medium">How can I help you build today?</div>
              <div className="max-w-[260px] text-[11px] leading-relaxed" style={{ color: 'var(--wc-muted)' }}>
                Try: <i>«Create a Minecraft Visual Client for Fabric 1.21.4 with ClickGUI, HUD and module system»</i>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {['Explain this project', 'Fix the last build error', 'Add a new module', 'Create Fabric mod'].map((q) => (
                  <button
                    key={q}
                    className="rounded-full border px-2.5 py-1 text-[10px] transition-colors hover:border-[var(--wc-accent)]"
                    style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-muted)' }}
                    onClick={() => setInput(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {aiMessages.map((m, i) => (
            <div key={i} className="mb-3 flex gap-2">
              <div
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: m.role === 'user' ? 'var(--wc-active)' : 'linear-gradient(135deg,#9333EA,#A855F7)',
                }}
              >
                {m.role === 'user' ? <User size={12} /> : <Bot size={12} color="white" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[10px] font-medium" style={{ color: 'var(--wc-muted)' }}>
                  {m.role === 'user' ? 'You' : 'WinCode Intelligence'}
                  {m.ts === -1 && <span className="ml-2 animate-pulse-soft">typing…</span>}
                </div>
                <div
                  className="ai-text selectable whitespace-pre-wrap break-words rounded-lg border p-2.5 text-[11.5px] leading-relaxed"
                  style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)', color: 'var(--wc-text)' }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
          {agentLog.length === 0 ? (
            <div className="pt-8 text-center text-[11px]" style={{ color: 'var(--wc-muted)' }}>
              Agent activity will appear here: plans, tool calls, file writes, builds.
            </div>
          ) : (
            agentLog.map((e) => <AgentLogRow key={e.id + e.ts} entry={e} />)
          )}
        </div>
      )}

      {/* input */}
      <div className="shrink-0 p-2.5" style={{ borderTop: '1px solid var(--wc-border)' }}>
        <div className="relative">
          <textarea
            className="wc-input w-full resize-none pr-10 text-[11.5px]"
            rows={3}
            placeholder={
              aiMode === 'ASK'
                ? 'Ask anything about your code…'
                : `Describe the task for ${aiMode} mode — e.g. "Create a Fabric 1.21.4 client with ClickGUI and HUD"…`
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          {aiStreaming ? (
            <button
              className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-md text-white"
              style={{ background: '#EF4444' }}
              onClick={() => void stop()}
              title="Stop"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-md text-white transition-transform hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#9333EA,#A855F7)' }}
              onClick={() => void send()}
              title="Send (Enter)"
            >
              <Send size={13} />
            </button>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-[9.5px]" style={{ color: 'var(--wc-muted)' }}>
          <span>Enter to send · Shift+Enter newline</span>
          <span>
            {providers.find((p) => p.id === providerId)?.kind ?? ''} · {model || 'default model'}
          </span>
        </div>
      </div>
    </div>
  );
}

function AgentLogRow({ entry }: { entry: AgentLogEntry }) {
  if (entry.type === 'tool-start') {
    const p = entry.payload as { name: string; arguments: string };
    return (
      <div className="mb-1.5 flex items-start gap-2 rounded-lg border p-2" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)' }}>
        <Wrench size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--wc-neon)' }} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium">{p.name}</div>
          <div className="selectable truncate font-mono text-[9.5px]" style={{ color: 'var(--wc-muted)' }}>
            {p.arguments?.slice(0, 160)}
          </div>
        </div>
        <Loader2 size={11} className="spin shrink-0" style={{ color: 'var(--wc-muted)' }} />
      </div>
    );
  }
  if (entry.type === 'tool-result') {
    const p = entry.payload as { name: string; content: string; isError?: boolean };
    return (
      <div className="mb-1.5 flex items-start gap-2 rounded-lg border p-2 text-[10px]" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)' }}>
        {p.isError ? <XCircle size={11} className="mt-0.5 shrink-0" color="#EF4444" /> : <CheckCircle2 size={11} className="mt-0.5 shrink-0" color="#22C55E" />}
        <div className="selectable min-w-0 flex-1 whitespace-pre-wrap" style={{ color: 'var(--wc-muted)' }}>
          {p.content?.slice(0, 400)}
        </div>
      </div>
    );
  }
  if (entry.type === 'permission') {
    const p = entry.payload as { description: string };
    return (
      <div className="mb-1.5 rounded-lg border p-2 text-[10.5px]" style={{ borderColor: '#F59E0B', background: 'rgba(245,158,11,0.08)' }}>
        🔔 {p.description}
      </div>
    );
  }
  return (
    <div className="mb-1 px-1 text-[10px]" style={{ color: 'var(--wc-muted)' }}>
      [{entry.type}] {typeof entry.payload === 'string' ? entry.payload.slice(0, 200) : JSON.stringify(entry.payload)?.slice(0, 200)}
    </div>
  );
}
