import { X, Sparkles, Github, Cpu, CheckCircle2 } from 'lucide-react';
import { useApp } from '../state/store';
import { useState, useEffect } from 'react';

export default function AboutDialog() {
  const open = useApp((s) => s.aboutOpen);
  const setOverlay = useApp((s) => s.setOverlay);
  const [info, setInfo] = useState<{ version: string; platform: string; electron: string; node: string } | null>(null);

  useEffect(() => {
    if (open) void window.wincode.appInfo().then(setInfo);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setOverlay('about', false)}>
      <div
        className="w-[480px] rounded-2xl border p-6 shadow-panel animate-fade-in"
        style={{ background: 'var(--wc-panel)', borderColor: 'var(--wc-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-glow" style={{ background: 'linear-gradient(135deg,#9333EA,#A855F7)' }}>
            <Sparkles size={24} color="white" />
          </div>
          <div>
            <div className="grad-text text-xl font-bold">WinCode AI</div>
            <div className="text-[11px]" style={{ color: 'var(--wc-muted)' }}>
              Professional AI-powered IDE {info?.version ? `v${info.version}` : ''}
            </div>
          </div>
          <button className="ml-auto rounded-lg p-1.5 hover:bg-white/10" onClick={() => setOverlay('about', false)}>
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 space-y-1.5 text-[11px]" style={{ color: 'var(--wc-muted)' }}>
          {info && (
            <>
              <div className="flex items-center gap-2">
                <Cpu size={11} /> Electron {info.electron} · Node {info.node} · {info.platform}
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <CheckCircle2 size={11} color="#22C55E" /> Monaco Editor · xterm.js · node-pty · Universal AI providers
          </div>
          <div className="flex items-center gap-2">
            <Github size={11} /> Built with Electron, React, TypeScript, Vite, Tailwind CSS
          </div>
        </div>

        <div className="mt-4 rounded-xl border p-3 text-[10.5px] leading-relaxed" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)', color: 'var(--wc-muted)' }}>
          WinCode Intelligence connects directly to the AI provider you configure (OpenAI, Claude, Gemini, OpenRouter,
          Ollama, LM Studio). Your code and keys stay on your machine except for requests you make to those providers.
          Minecraft-related tools are intended for local development and use on your own servers, in line with the Mojang
          EULA.
        </div>
      </div>
    </div>
  );
}
