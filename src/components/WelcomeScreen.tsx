import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Clock, Pickaxe, Sparkles, Github, Download, Rocket, Gamepad2, Bot } from 'lucide-react';
import { useApp } from '../state/store';

export default function WelcomeScreen() {
  const recent = useApp((s) => s.recentProjects);
  const openWorkspace = useApp((s) => s.openWorkspace);
  const setOverlay = useApp((s) => s.setOverlay);
  const notify = useApp((s) => s.notify);
  const [version, setVersion] = useState('');

  useEffect(() => {
    void window.wincode.appInfo().then((i) => setVersion(i.version));
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" style={{ background: 'var(--wc-bg)' }}>
      {/* decorative glow */}
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #9333EA 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-20 h-[480px] w-[480px] rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #A855F7 0%, transparent 70%)' }}
      />

      <div className="relative z-10 flex w-full max-w-5xl gap-10 px-10">
        {/* Left: brand + actions */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-glow" style={{ background: 'linear-gradient(135deg,#9333EA,#A855F7)' }}>
              <Sparkles size={24} color="white" />
            </div>
            <div>
              <h1 className="grad-text text-3xl font-bold leading-none">WinCode AI</h1>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--wc-muted)' }}>
                Intelligent IDE · Java · Minecraft · AI Agent {version && `· v${version}`}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2.5">
            <button className="wc-btn wc-btn-primary justify-start px-4 py-3 text-[13px]" onClick={() => setOverlay('wizard', true)}>
              <Plus size={16} /> New Project — Java, Minecraft, Web, AI…
            </button>
            <button
              className="wc-btn justify-start px-4 py-3 text-[13px]"
              onClick={async () => {
                const folder = await window.wincode.pickFolder();
                if (folder) await openWorkspace(folder);
              }}
            >
              <FolderOpen size={16} style={{ color: 'var(--wc-neon)' }} /> Open Folder
            </button>
            <button
              className="wc-btn justify-start px-4 py-3 text-[13px]"
              onClick={async () => {
                const res = await window.wincode.showMessage({
                  title: 'Clone Git Repository',
                  message: 'Open the Git panel (Ctrl+Shift+G) after opening a folder, or use the terminal:\ngit clone <repo-url>',
                  buttons: ['Open terminal', 'Close'],
                });
                if (res === 0) {
                  await useApp.getState().createTerminal();
                  useApp.setState({ showBottom: true, bottomTab: 'terminal' });
                  notify('info', 'Run: git clone <url> in the terminal');
                }
              }}
            >
              <Github size={16} style={{ color: 'var(--wc-neon)' }} /> Clone Repository
            </button>
            <button
              className="wc-btn justify-start px-4 py-3 text-[13px]"
              onClick={() => setOverlay('guiBuilder', true)}
            >
              <Gamepad2 size={16} style={{ color: 'var(--wc-neon)' }} /> AI GUI Builder
            </button>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-2">
            {[
              { icon: Pickaxe, title: 'Minecraft Dev', desc: 'Fabric / Forge / NeoForge' },
              { icon: Bot, title: 'AI Agent', desc: 'Builds projects end-to-end' },
              { icon: Rocket, title: 'Build & Run', desc: 'Gradle · Maven · npm' },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border p-3" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-panel)' }}>
                <f.icon size={16} style={{ color: 'var(--wc-neon)' }} />
                <div className="mt-1.5 text-[11px] font-medium">{f.title}</div>
                <div className="text-[10px]" style={{ color: 'var(--wc-muted)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: recent */}
        <div className="w-[320px]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
            <Clock size={12} /> Recent Projects
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {recent.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-[11px]" style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-muted)' }}>
                No recent projects yet.
                <br />
                Create your first project to get started.
              </div>
            ) : (
              recent.slice(0, 10).map((p) => (
                <button
                  key={p.path}
                  className="group flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all hover:translate-x-0.5"
                  style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-panel)' }}
                  onClick={() => void openWorkspace(p.path)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--wc-active)' }}>
                    <FolderOpen size={14} style={{ color: 'var(--wc-neon)' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11.5px] font-medium">{p.name}</div>
                    <div className="truncate text-[9.5px]" style={{ color: 'var(--wc-muted)' }}>
                      {p.path}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="mt-6 rounded-xl border p-3.5" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-panel)' }}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              <Download size={12} style={{ color: 'var(--wc-neon)' }} /> Quick start
            </div>
            <div className="mt-1.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--wc-muted)' }}>
              1. Create a <b>Minecraft Visual Client</b> project
              <br />
              2. Open the AI panel (<span className="font-mono">Ctrl+Shift+A</span>)
              <br />
              3. Set your API key in Settings → AI
              <br />
              4. Ask the Agent to build features for you
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
